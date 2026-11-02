# 场景：扩展层自动总结历史对话 (G03)

## 这是什么

**自动总结**不是 pi-agent 的内置功能——SDK 不提供"开关一下就自动总结"的配置。本场景讲的是**用扩展层 hook 在每轮 / 每次 prompt 结束时提取要点并持久化**，实现"跨 session 的记忆外挂"：即使切换会话或重启，Agent 也能回顾之前的讨论要点。

SDK 提供的素材只有事件 hook（`turn_end` / `agent_end` / `message_end`）和会话树持久化 API（`pi.appendEntry`）。具体怎么提取、存到哪、什么时候加载回上下文，都是扩展自己实现的。

## 什么时候用 / 不用会怎样

| 你的场景 | 用什么 | 为什么 |
|---------|--------|--------|
| 想让 Agent 在下次会话启动时"记得"上次讨论的要点 | **本场景**（turn_end 提取 + before_agent_start 注入） | 跨会话保留高浓度上下文，避免从零开始 |
| 只是上下文窗口快爆了，需要"压缩窗口内的旧消息" | [G02 自定义 compaction](G02-custom-compaction.md) | compaction 是 SDK 内置机制，把旧消息替换为摘要 entry；本场景是把要点**写到外部存储**（或会话树的自定义 entry） |
| 想在每轮 LLM 调用前注入最新外部信息（Git status、API 状态） | [G01 context 注入](G01-context-injection.md) | G01 是"读 → 注入"，G03 是"提取 → 持久化"——互补关系 |
| 想让 Claude / 用户能看到摘要文件 | 写到 cwd 外部文件（如 `.agent/summaries/*.md`） | 用 `pi.appendEntry` 写进 `~/.pi/agent/sessions/<encoded-cwd>/*.jsonl` 用户看不到 |
| 只是想监控每轮的关键事件 | `message_end` / `tool_execution_end` | 不需要持久化时，直接订阅事件做副作用即可 |

**一句话区分 G02 vs G03**：G02 **替换** SDK 内置 compaction 的摘要为自定义实现（结果进会话树，LLM 看得到）；G03 **额外**提取要点到外部存储或 CustomEntry（LLM 默认看不到，需扩展主动注入）。

## 涉及 SDK

| 能力 | 签名 / 真实字段 | 用途 | 详细文档 |
|------|----------------|------|---------|
| `pi.on("turn_end")` | `(event: { type, turnIndex, message: AgentMessage, toolResults: ToolResultMessage[] }, ctx) => void` | 每个 turn 结束时提取**本轮 assistant 回复 + 工具结果** | [sdk_doc/04-events.md](../sdk_doc/04-events.md) |
| `pi.on("agent_end")` | `(event: { type, messages: AgentMessage[] }, ctx) => void` | Agent 循环结束时做最终总结（**不可作唯一结束信号**） | [sdk_doc/04-events.md](../sdk_doc/04-events.md) |
| `pi.on("message_end")` | `(event: { type, message: AgentMessage }, ctx) => void \| { message? }` | 抓 user message / 多次 assistant 消息（粒度是每次 LLM 调用） | [sdk_doc/04-events.md](../sdk_doc/04-events.md) |
| `pi.on("before_agent_start")` | `(event, ctx) => BeforeAgentStartEventResult \| void`（可返回 `{ message?, systemPrompt? }` 注入消息 / 替换系统提示词） | **下次会话启动时**加载历史摘要并注入（每次 prompt 触发一次，无死循环风险） | [sdk_doc/04-events.md](../sdk_doc/04-events.md) |
| `pi.appendEntry(customType, data?)` | `(customType: string, data?: T) => void` | 写入 CustomEntry 到会话树（`~/.pi/agent/sessions/<encoded-cwd>/<timestamp>_<sessionId>.jsonl`，跨 session 持久化） | [sdk_doc/07-extensions-api.md](../sdk_doc/07-extensions-api.md) |
| `generateSummary()` / `serializeConversation()` | SDK 公开的摘要工具函数 | 让 LLM 生成结构化摘要（同 compaction 内部用的工具） | [sdk_doc/18-compaction.md](../sdk_doc/18-compaction.md) |

> ⚠️ **派发层次差异**（★ E02 横向陷阱）：`before_agent_start` 是**扩展独有事件**——只在扩展层 `pi.on` 派发，`session.subscribe` 静默收不到。详见 [04-events.md 坑 4](../sdk_doc/04-events.md#坑-46-个扩展独有事件sessionsubscribe-静默收不到-最大集成坑)。

## ⚠️ 最大陷阱：turn_end 拿不到 user message

**事实**：`TurnEndEvent.message` 是**本轮的 assistant message**（agent-loop.ts——`streamAssistantResponse` 的返回值），不是 user message。

```ts
// agent-loop.ts（每个 turn 流式生成 assistant 后触发）
const message = await streamAssistantResponse(currentContext, config, signal, emit, streamFn);
// ...
await emit({ type: "turn_end", message, toolResults: [] });
//                           ↑ 这是 assistant message
```

**常见误期待**：以为 turn_end 能拿到"本轮用户问了什么"——拿不到。要拿 user message：

1. **在 `message_end` hook 里抓** `event.message.role === "user"`（ext-types.ts）
2. **在 `agent_end` hook 里从 messages 数组找最后一条 user**（ext-types.ts）
3. **before_agent_start** 先检查 event.messageType === "user" 才读 prompt；custom 分支读 message

## 实现思路

### 模式 A：turn_end 提取 + appendEntry 持久化（推荐用于"每轮摘要"）

```ts
import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";

const autoSummarizeExt: ExtensionFactory = (pi) => {
  // 持久化每轮摘要到会话树（CustomEntry，跨 session 可读）
  pi.on("turn_end", async (event, ctx) => {
    // event.message 是本轮 assistant message（单条）
    // event.toolResults 是本轮工具结果数组
    // event.turnIndex 是 turn 序号（扩展层独有字段）

    if (event.message.role !== "assistant") return; // AgentMessage 含没有 content 的 system/custom 分支
    const assistantText = extractText(event.message.content);
    const toolsUsed = event.toolResults.map((r) => r.toolName);  // 注意是 toolName，不是 name
    const turnIndex = event.turnIndex;

    const summary = [
      `--- Turn ${turnIndex} ---`,
      `Actions: ${toolsUsed.join(", ") || "none"}`,
      `Response: ${assistantText.slice(0, 200)}`,
    ].join("\n");

    // ✅ 写入会话树（CustomEntry 类型），跨 session 持久化到 ~/.pi/agent/sessions/<encoded-cwd>/*.jsonl
    pi.appendEntry("turn_summary", {
      turnIndex,
      toolsUsed,
      responsePreview: assistantText.slice(0, 200),
      timestamp: Date.now(),
    });
  });
};

export default autoSummarizeExt;

// ⚠️ 用户自定义辅助函数（不是 SDK API）
// AssistantMessage.content 是 (TextContent | ThinkingContent | ToolCall)[]
// 需要过滤出 TextContent 并拼接
function extractText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((c): c is { type: "text"; text: string } => c?.type === "text")
    .map((c) => c.text)
    .join("");
}
```

**关键细节**（源码 ai/types.ts）：
- `AssistantMessage.content` 类型是 `(TextContent | ThinkingContent | ToolCall)[]`，**永远不是 string**——必须用 extractText 这类帮助函数
- `ToolResultMessage.toolName` 才是工具名（ai/types.ts），不是 `.name`
- `pi.appendEntry` 写入 CustomEntry 到当前 leaf 之后，作为 session 历史的一部分持久化到 `~/.pi/agent/sessions/<encoded-cwd>/`（session-manager.ts；`<encoded-cwd>` 是 cwd 路径把 `/`、`\`、`:` 全替换为 `-` 得到的安全目录名，文件名 `<timestamp>_<sessionId>.jsonl`）。注意：CustomEntry **不进 LLM 上下文**（`buildSessionContext` 只还原 message/compaction/model 等条目，自定义类型被忽略）——所以要靠 `before_agent_start` 主动注入才能让 Agent"看见"

### 模式 B：message_end 抓 user + assistant 配对（推荐用于"问答摘要"）

如果想记录"用户问了什么 + Agent 怎么回的"，用 `message_end`（粒度是**每次 LLM 调用**，不是每个 turn）：

```ts
import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";

const qaLogExt: ExtensionFactory = (pi) => {
  let pendingUser: string | null = null;

  pi.on("message_end", async (event, ctx) => {
    const msg = event.message;

    // 抓 user message（每个 turn 入口的 user）
    if (msg.role === "user") {
      const text = typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.filter((c): c is { type: "text"; text: string } => c.type === "text")
              .map((c) => c.text).join("")
          : "";
      if (text.trim()) {
        pendingUser = text.slice(0, 100);
      }
      return;
    }

    // 抓 assistant message（注意：一次 user 提问可能触发多次 message_end(assistant)，见 04-events.md 坑 2）
    if (msg.role === "assistant" && pendingUser) {
      const replyText = extractText(msg.content);
      if (!replyText.trim()) return;  // 跳过空消息（坑 2）

      pi.appendEntry("qa_pair", {
        question: pendingUser,
        answerPreview: replyText.slice(0, 200),
        timestamp: Date.now(),
      });
      pendingUser = null;  // 配对完成后清空
    }
  });
};

export default qaLogExt;

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content.filter((c) => c?.type === "text").map((c) => c.text).join("");
}
```

> ⚠️ **`message_end(assistant)` 单轮触发多次**（[04-events.md 坑 2](../sdk_doc/04-events.md#坑-2message_end-单轮对话触发多次粒度是每次-llm-调用而非每条最终消息)）：用户发一条消息、Agent 调一次工具再回复，会产生多条 assistant message_end；数量依 provider/turn 而变。上例跳过空 assistant，但非空中间文本仍可提前消费 pendingUser——实战中需要"只配对非空 assistant"或"延迟到 turn_end 才落库"。

### 模式 C：agent_settled 总结当前 projected context

同步 hook 中 await 摘要会延长 prompt 的 resolve，这是明确的延迟取舍，不是必须 fire-and-forget。appendEntry 必须在所属 session 生命周期内完成；后台落库应改为宿主队列和固定外部目标，不使用迟到的 pi.appendEntry。

```ts
import { buildSessionContext, generateSummary, type ExtensionFactory } from "@earendil-works/pi-coding-agent";
const summarize: ExtensionFactory = (pi) => {
  pi.on("agent_settled", async (event, ctx) => {
    if (event.aborted || !ctx.model) return;
    const sessionId = ctx.sessionManager.getSessionId();
    const { messages } = buildSessionContext(
      ctx.sessionManager.getEntries(), ctx.sessionManager.getLeafId(),
    ); // 当前 leaf 投影，保留 compaction/context edits；不直接摘要原始分支
    if (!messages.length) return;
    const summary = await generateSummary(
      messages, ctx.model, 16384, undefined, undefined, undefined,
      "Summarize visible decisions only", undefined, undefined,
      (model, context, options) => ctx.modelRegistry.streamSimple(model, context, options),
      undefined, undefined, undefined, sessionId,
    );
    // 宿主仍须串行化 prompt 与会话替换，并在切换前等待此 handler；ID guard 不是并发协议
    if (ctx.sessionManager.getSessionId() !== sessionId) return;
    pi.appendEntry("session_summary", { summary, timestamp: Date.now() });
  });
};
export default summarize;
```

registry stream 负责 runtime provider/auth（包括 headers/env/baseUrl），不是把 apiKey 传 undefined 就会访问 session 凭据。虚拟选型需要选真实摘要模型，见 G02。handler 异常由扩展 runner 上报；若由宿主后台执行，必须 catch、取消和 drain。

宿主观察正确形式是 `session.subscribe((event) => { if (event.type === "agent_settled") { ... } })`，没有 subscribe(eventName, listener) 重载。listener 不被 await；宿主自行管理任务和退出 flush。

### 模式 D：跨 session 加载历史摘要（用 before_agent_start）

下次会话启动时把上次的摘要注入上下文。**用 `before_agent_start`**（每次 prompt 触发一次，无死循环风险），不要用 `turn_start`（会触发死循环，见 G01 陷阱 1）：

```ts
import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const loadHistoryExt: ExtensionFactory = (pi) => {
  let loaded = false;
  pi.on("session_start", () => { loaded = false; });

  pi.on("before_agent_start", async (event, ctx) => {
    if (loaded) return;  // 整个 session 只加载一次
    loaded = true;

    // 从外部存储加载历史摘要（用户自定义路径）
    try {
      const summaryPath = join(ctx.cwd, ".agent", "summaries", "last-session.md");
      const history = await readFile(summaryPath, "utf-8");

      if (history.trim()) {
        // before_agent_start 可返回 { message } 注入消息 或 { systemPrompt } 替换系统提示词
        // 注入消息：return { message: { customType: "history", content: history, display: true } }
        // 替换系统提示词：return { systemPrompt: `${event.systemPrompt}\n\n[History]\n${history}` }
        // 这里用 message 注入，让 Agent 在对话流中看到历史摘要
        return {
          message: {
            customType: "session_history",
            content: [{ type: "text", text: `[Previous Session Summary]\n${history}` }],
            display: true,
          },
        };
      }
    } catch {
      // 文件不存在或读取失败——首次会话无历史
    }
  });
};

export default loadHistoryExt;
```

> ⚠️ **不要在 `turn_start` 里 `sendUserMessage + deliverAs:"steer"`**：每个 steer 触发新一轮 turn → 新 turn 触发 turn_start → 又 steer → **无限循环**直到 token 耗尽（[G01 陷阱 1](G01-context-injection.md#陷阱-1turn_start--sendusermessage--steer-死循环)）。注入上下文走 `pi.on("context")` 或 `before_agent_start`。

## SDK 提供的摘要工具

SDK 公开了两个函数（`@earendil-works/pi-coding-agent` 导出），让扩展能复用内置 compaction 的摘要能力：

### `serializeConversation(messages: Message[]): string`

把 Message 数组序列化为纯文本，省略 thinking，toolResult 截断到 2000 字符。摘要当前投影而不是所有原始分支条目。

```ts
import { serializeConversation, convertToLlm } from "@earendil-works/pi-coding-agent";

import type { AgentMessage } from "@earendil-works/pi-agent-core";
// AgentMessage[] → LLM Message[] → 纯文本
const toSummaryText = (messages: AgentMessage[]) => serializeConversation(convertToLlm(messages));
```

### `generateSummary(messages, model, reserveTokens, apiKey, headers?, signal?, customInstructions?, previousSummary?, thinkingLevel?, streamFn?, env?, retry?, callbacks?, sessionId?): Promise<string>`

让 LLM 生成结构化摘要（compaction.ts）。传 `previousSummary` 走"增量更新"prompt，不传走"首次摘要"prompt。

第 4 个位置参数 apiKey 必填但可为 undefined。它不自动引用 session ModelRuntime；默认底层 stream 可能使用 ambient env，不能保证 stored OAuth/自定义 provider 生效。传 registry/runtime streamFn（模式 C）保留认证配置。sessionId 是尾部可选参数。

### `generateSummaryWithUsage(...)`: Promise<{ text: string, usage: Usage }>

与 `generateSummary` 签名相同，但返回 `{ text, usage }` 而非裸 `string`（compaction.ts）。`usage` 含本次摘要调用的 token 用量信息，适合需要追踪 / 限制摘要开销的场景。

> **CompactionResult**：新增可选字段 `usage?: Usage`，自定义 compaction 策略（[G02](G02-custom-compaction.md)）可以在返回值中带上摘要的 token 用量。

完整调用见模式 C；ctx.model 需检查，ExtensionContext 没有通用 ctx.signal。取消信号由对应事件（如 session_before_compact）或宿主拥有的 AbortController 提供。

> 与 [G02 自定义 compaction](G02-custom-compaction.md) 的关系：G02 在 `session_before_compact` 里调 `generateSummary` 生成摘要、返回 `{ compaction: CompactionResult }` 让 SDK 用；G03 在任意 hook 里调 `generateSummary` 生成摘要、自己写到外部存储。两者用同一个工具函数，但落点不同。

## 常见误期待与陷阱

### 陷阱 1：以为 turn_end 能拿到 user message

**现象**：在 `turn_end` 里读 `event.userMessage` 或从 `event.message.role === "user"` 判断，期望抓到本轮用户提问。

**实际**：`TurnEndEvent.message` 的公开类型是 AgentMessage；常见模型步骤是 assistant，读取 content 前先检查 role。`event.userMessage` 字段**完全不存在**（完整 boundary payload 见 04-events）。

**修复**：用 `message_end` hook 抓 role==="user"，或在 `agent_end` 里从 messages 数组里反向找。

### 陷阱 2：以为 AssistantMessage.content 是 string

**现象**：写 `msg.content.slice(0, 100)` 期望截断文本。

**实际**：`AssistantMessage.content` 类型是 `(TextContent | ThinkingContent | ToolCall)[]`（ai/types.ts），**永远是数组**。`UserMessage.content` 才可能是 string（联合类型 `string | (TextContent | ImageContent)[]`）。

**修复**：用 extractText 帮助函数：

```ts
function extractText(content: unknown): string {
  if (typeof content === "string") return content;  // UserMessage 才走这条
  if (!Array.isArray(content)) return "";
  return content
    .filter((c): c is { type: "text"; text: string } => c?.type === "text")
    .map((c) => c.text)
    .join("");
}
```

### 陷阱 3：以为 ToolResultMessage 有 `name` 字段

**现象**：在 turn_end 里 `event.toolResults.map(r => r.name)`。

**实际**：ToolResultMessage 字段是 `toolName`（ai/types.ts），不是 `name`。TypeScript 会报错（除非代码用了 any）。

**修复**：用 `r.toolName`。

### 陷阱 4：把 agent_end 当成流程完全结束

**现象**：把"整体会话摘要"完全押在 `agent_end` 上，期望它只在最终结束时触发一次。

**实际**：低层循环在错误、取消、turn 结束与正常退出等边界派发 `agent_end`，retry 场景下会被拆成多次。同时扩展层 `agent_end` 还被丢弃 `willRetry`（坑 5），扩展层无法区分"还要重试"和"真结束"。

**修复**：
- 用 `agent_settled` 替代 `agent_end` 做最终摘要落库信号（所有 retry/compaction/queue 处理完才触发一次）
- 整体摘要应在 `turn_end`（增量）+ `agent_settled`（最终）双轨记录
- 外层集成用 `try/finally` 或 watchdog 超时兜底

### 陷阱 5：用 turn_start 加载历史 → 死循环

**现象**：在 `turn_start` 里 `pi.sendUserMessage(historySummary, { deliverAs: "steer" })` 期望注入历史。

**实际**：每个 steer 触发新一轮 turn → 新 turn 触发 turn_start → 又 steer → **无限循环**（[G01 陷阱 1](G01-context-injection.md#陷阱-1turn_start--sendusermessage--steer-死循环)）。

**修复**：用 `before_agent_start`（每次 prompt 触发一次，不触发新 turn）或 `context` hook（改本轮 LLM 输入快照）。

## 变体与延伸

- 注入外部记忆与上下文 → [场景 G01](G01-context-injection.md)（聚焦"怎么注入"，G03 聚焦"怎么提取")
- 自定义 compaction 策略（替换 SDK 内置摘要）→ [场景 G02](G02-custom-compaction.md)
- 生命周期 hooks 完整参考 → [场景 E04](E04-lifecycle-hooks.md)
- compaction 内部机制与触发公式 → [sdk_doc/18-compaction.md](../sdk_doc/18-compaction.md)
- 事件派发层次（扩展层 vs subscribe 层）→ [sdk_doc/04-events.md 坑 4](../sdk_doc/04-events.md#坑-46-个扩展独有事件sessionsubscribe-静默收不到-最大集成坑)

# 场景：注入外部记忆与上下文 (G01)

## 目标

让 Agent 在每次回复时都能参考**最新**的外部信息——用户偏好、最近的数据库记录、Git 改动、API 状态等。本场景覆盖**四种注入机制**的选型与组合：context files（项目级静态规则）、`pi.on("context")` hook（每轮 LLM 调用前改消息快照）、`pi.on("before_agent_start")` hook（每次 prompt 改系统提示词）、`session.steer()` / `pi.sendUserMessage({ deliverAs: "steer" })`（补充用户消息触发新一轮 turn）。

## 什么时候用 / 不用会怎样

**核心判断**：你想注入的信息是**项目级长期规则**（几乎不变）还是**运行时动态数据**（每轮都变）？是**进 system prompt** 还是**进 messages 历史**？是否**触发新一轮 turn**？

| 你的场景 | 用什么 | 为什么 |
|---------|--------|--------|
| 项目代码风格、Git 工作流、命名约定等长期规则 | **Context Files**（`AGENTS.md` / `CLAUDE.md`） | 启动时一次性加载进 system prompt，零运行时开销，跨会话持久 |
| 想在不改文件系统的情况下注入额外的 project rules | **`agentsFilesOverride`**（虚拟 context file） | 同上，但运行时构造，无需写盘 |
| 每轮 LLM 调用前**动态修改**发给模型的消息列表（如裁剪、替换、追加临时上下文） | **`pi.on("context")`** hook | 只改本轮 LLM 输入快照，不进 messages 历史，不触发新 turn |
| 每次用户 prompt 时**追加/修改系统提示词**（如当前会话的环境变量） | **`pi.on("before_agent_start")`** hook | 每次 prompt 触发一次，能改 system prompt |
| Agent 正在工作中补充一句**用户指示**（如"先写测试再重构"） | **`session.steer()`** / **`pi.sendUserMessage({ deliverAs: "steer" })`** | 加 user message 进对话流，触发新一轮 turn，插队语义 |
| 想在会话启动时**预加载项目元数据**（依赖树、Git status） | [G04](G04-preload-context.md) | 与本场景互补，G04 聚焦"读什么"，G01 聚焦"怎么注入" |

**一句话区分**：Context Files 注入**静态规则**到 system prompt；`context` hook **临时改**本轮 LLM 输入；`steer` 加**用户消息**进历史并触发新 turn。

> ⚠️ **`turn_start` 不是"注入上下文"的推荐 hook**——它是每轮触发的"通知"，在其中无条件 `sendUserMessage + deliverAs:"steer"` 会**死循环**（详见 [陷阱 1](#陷阱-1turn_start--sendusermessage--steer-死循环)）。如果你只想"每轮 LLM 调用前改消息"，用 `pi.on("context")`。

## 涉及 SDK

| 能力 | 签名 | 用途 | 详细文档 |
|------|------|------|---------|
| Context Files | `loadProjectContextFiles({ cwd, agentDir })` → `Array<{path, content}>` | 启动时发现 `AGENTS.md` / `CLAUDE.md`，注入 system prompt | [11-context-files.md](../sdk_doc/11-context-files.md) |
| `agentsFilesOverride` | `(base) => ({ agentsFiles })`（在 `DefaultResourceLoader` options 中） | 过滤/追加虚拟 context files | [11-context-files.md](../sdk_doc/11-context-files.md) |
| `pi.on("context")` | `(event: ContextEvent, ctx) => { messages?: AgentMessage[] } \| void` | **每轮 LLM 调用前**修改发给模型的消息列表（扩展独有，subscribe 收不到。event.messages 是 structuredClone 深拷贝，直接 mutation 无效，必须 return） | [04-events.md](../sdk_doc/04-events.md) |
| `pi.on("before_agent_start")` | `(event: BeforeAgentStartEvent, ctx) => void` | **每次 prompt 后**、agent loop 前触发，能读 systemPrompt（扩展独有） | [04-events.md](../sdk_doc/04-events.md) |
| `pi.on("turn_start")` | `(event: TurnStartEvent, ctx) => void` | 每个 turn 开始时触发（含 `turnIndex`、`timestamp`） | [04-events.md](../sdk_doc/04-events.md) |
| `pi.sendUserMessage()` | `sendUserMessage(content: string \| (TextContent \| ImageContent)[], options?: { deliverAs?: "steer" \| "followUp" }): void` | 扩展中投递 user 消息（流式时按 deliverAs 入队） | [07-extensions-api.md](../sdk_doc/07-extensions-api.md) |
| `session.steer()` | `async steer(text: string, images?: ImageContent[]): Promise<void>` | 入队 steering 消息（当前 turn 结束后注入并触发新一轮） | [02-agent-session.md](../sdk_doc/02-agent-session.md) |

> ⚠️ **派发层次差异**（★ E02 横向陷阱）：`context` 和 `before_agent_start` 是**扩展独有事件**——只在扩展层 `pi.on` 派发，`session.subscribe` 静默收不到。如果用 subscribe 监听这两个事件，handler 根本不会被调用。详见 [04-events.md 坑 4](../sdk_doc/04-events.md#坑-46-个扩展独有事件sessionsubscribe-静默收不到-最大集成坑)。

## 四种注入机制（先理解，再写代码）

### 机制 1：Context Files —— 项目级静态规则

**层次**：注入 **system prompt** 的 `<project_context>` 块。

**发现逻辑**（源码 `resource-loader.ts`）：
1. 全局：按同目录候选顺序取一份（约 `~/.pi/agent/`）
2. 从 cwd 向根目录逐级递归，每级按 `AGENTS.override.md` > `AGENTS.md` > `AGENTS.MD` > `CLAUDE.md` > `CLAUDE.MD` 优先级查找
3. 注入顺序：父级 → 子级，全部包裹在同一 `<project_context>` 块

**核心陷阱（★ A03）**：即使设置了 `customPrompt`（替换默认 system prompt），`buildSystemPrompt` **仍然会自动追加** contextFiles / skills / cwd（源码 `system-prompt.ts`）。**customPrompt 不是最终 prompt**——它替换的是「主体描述」，但项目规则、技能列表、当前工作目录仍会被追加到末尾。

**完全屏蔽 context files 的两种方法**（源码 `resource-loader.ts`）：

```ts
// 方法 1：noContextFiles: true —— 完全跳过发现
const loader = new DefaultResourceLoader({
  cwd, agentDir, noContextFiles: true,
});

// 方法 2：agentsFilesOverride 返回空数组 —— 发现后清空
const loader = new DefaultResourceLoader({
  cwd, agentDir,
  agentsFilesOverride: () => ({ agentsFiles: [] }),
});
```

**★ C03 横向陷阱**：context files 加载**不受 `projectTrusted` 门槛**（源码 `resource-loader.ts`——该段在 projectTrusted 检查之外）。即使项目未被信任，AGENTS.md / CLAUDE.md 也会被无条件读取注入。projectTrusted 控制项目 settings/extensions/skills/prompts/themes/SYSTEM/APPEND 及 MCP 配置发现，不是 OS 沙盒。这意味着——**若 cwd 父级链路上有恶意 AGENTS.md，会被自动注入 system prompt**，是宿主环境注入风险点。

完整用法详见 [11-context-files.md](../sdk_doc/11-context-files.md)。

### 机制 2：`pi.on("context")` —— 每轮 LLM 调用前修改消息快照

**层次**：修改本轮非 system 对话快照（不进历史/不触发 turn）；Pi 恢复 prompt 和工具状态后再派发 `context_with_system`，后者拥有完整 transcript 的 system/tool declarations，返回值直接送出。删掉 system 也会删掉其声明，需自行负责。

**派发时机**：在 `streamAssistantResponse` 内、`convertToLlm` 之前（源码 `agent-loop.ts`）。handler 返回 `{ messages?: AgentMessage[] }` 时替换；返回 `void / undefined` 时保持原 messages。

**handler 签名**：

```ts
pi.on("context", async (event, ctx) => {
  // event.messages: 即将发给 LLM 的 AgentMessage[]（含历史 + 当前 turn）
  // ⚠️ event.messages 是 structuredClone 深拷贝（runner.ts），直接 mutation 无效，必须 return 替换
  // 返回 { messages } 替换；返回 void 保持原样
  return { messages: [...event.messages, { role: "user", content: "[Runtime Note] ...", timestamp: Date.now() }] };
});
```

### 机制 3：`pi.on("before_agent_start")` —— 每次 prompt 后改系统提示词

**层次**：在**每次 prompt** 后、agent loop 启动前触发（源码 `agent-session.ts`）。**每次 prompt 只触发一次**，不像 `turn_start` 每轮都触发——因此是注入"每次会话开始加载一次"上下文的**安全 hook**（不会死循环）。

**event payload**（源码 `extensions/types.ts`）：

```ts
// BeforeAgentStartEvent 是判别联合：公共字段 type/systemPrompt/systemPromptOptions
// messageType === "user" 时有 prompt/images；"custom" 时有 message
pi.on("before_agent_start", (event) => {
  if (event.messageType === "user") console.log(event.prompt);
  else console.log(event.message.customType);
});
```

**典型用途**：读取项目元数据、当前会话环境变量，**记入数据库或日志**——也可通过返回 `{ systemPrompt }` 直接修改本轮 systemPrompt（types.ts `BeforeAgentStartEventResult`），修改 systemPrompt 的另一条路径是 `systemPromptOverride`（详见 [08-resource-loader.md](../sdk_doc/08-resource-loader.md)）。

### 机制 4：`session.steer()` / `pi.sendUserMessage({ deliverAs: "steer" })` —— 补充用户消息触发新一轮 turn

**层次**：加 **user message** 进对话流，**插队**触发新一轮 turn。

**核心语义**（[F05](F05-steer-session.md) 详述）：
- steer 不打断当前 LLM 调用，但会**插队**——当前 turn 结束后立刻注入并触发新一轮 turn
- 与 `followUp`（等 Agent 想停时再投递）形成对照
- steer 消息**进入 messages 历史**（user role），与 context hook 的"临时改 LLM 输入"层次不同

详细机制（含死循环陷阱、steeringMode、queue_update）→ [F05](F05-steer-session.md)。

## 核心代码

### 模式 A：用 Context Files 注入项目规则（推荐，零运行时开销）

```ts
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const loader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  // 追加一条运行时规则（无需写文件）
  agentsFilesOverride: (base) => ({
    agentsFiles: [
      ...base.agentsFiles,
      {
        path: "/virtual/RUNTIME.md",
        content: `# Runtime Rules
- Current branch: main
- Always write tests before refactoring
- Use TypeScript strict mode`,
      },
    ],
  }),
});

await loader.reload();

const { session } = await createAgentSession({
  resourceLoader: loader,
  sessionManager: SessionManager.inMemory(),
});

try {
  // Agent 的 system prompt 末尾会包含 <project_context> 块
  // 含虚拟 RUNTIME.md 的内容
  await session.prompt("Help me refactor src/utils.ts");
} finally {
  session.dispose();
}
```

> ⚠️ **★ A03 陷阱**：即使你给 `DefaultResourceLoader` 传了 `systemPrompt: "my custom prompt"`（或用 `systemPromptOverride`），**context files / skills / cwd 仍会被自动追加**（system-prompt.ts）。customPrompt 替换的是"主体描述"，不是"最终 prompt"。想完全屏蔽 context files 用 `noContextFiles: true`。

### 模式 B：用 `pi.on("context")` hook 每轮注入动态数据（推荐，避免死循环）

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
// 扩展文件 extensions/runtime-context.ts
export default (pi: ExtensionAPI) => {
  pi.on("context", async (event, ctx) => {
    // event.messages 不含 system；Pi 会恢复自己的 prompt/tool 状态
    // 拼接运行时上下文（如最近的 Git 改动）
    const recentChanges = await getRecentGitCommits(ctx.cwd);  // 用户自定义函数
    if (!recentChanges) return;  // 没改动就不改 messages

    // 追加一条临时 user message（不进 messages 历史，只本轮 LLM 看到）
    return {
      messages: [
        ...event.messages,
        {
          role: "user" as const,
          content: `[Runtime Context]\n${recentChanges}`,
          timestamp: Date.now(),
        },
      ],
    };
  });
};

// 用户自定义函数（不是 SDK API）
async function getRecentGitCommits(cwd: string): Promise<string | null> {
  // 实现略——可用 child_process.execSync("git log --oneline -5", { cwd })
  return null;
}
```

**为什么用 `context` 而不是 `turn_start` + steer**：
- `context` 修改的是**本轮 LLM 输入快照**——不进 messages 历史、不触发新 turn、不会死循环
- `turn_start` 里 `sendUserMessage + deliverAs:"steer"` 会**插队触发新一轮 turn**，新 turn 又触发 turn_start，形成死循环（[陷阱 1](#陷阱-1turn_start--sendusermessage--steer-死循环)）

### 模式 C：用 `before_agent_start` 每次 prompt 注入一次（适合"加载项目元数据"）

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
// 扩展文件 extensions/preload.ts
export default (pi: ExtensionAPI) => {
  let lastLoadedAt = 0;
  const CACHE_TTL_MS = 60_000;  // 1 分钟缓存

  pi.on("before_agent_start", async (event, ctx) => {
    // 每次 prompt 触发一次（不是每轮 turn）
    // 适合"加载项目元数据"这类相对稳定的操作
    if (Date.now() - lastLoadedAt < CACHE_TTL_MS) return;  // 缓存命中

    const pkg = await loadPackageJson(ctx.cwd);  // 用户自定义函数
    console.log(`[Preload] Project: ${pkg.name}, deps: ${Object.keys(pkg.dependencies || {}).length}`);
    lastLoadedAt = Date.now();

    // 注意：before_agent_start 的 event.systemPrompt 是当前快照（只读）
    // 但可通过返回 { systemPrompt } 修改（types.ts BeforeAgentStartEventResult）
    // 修改 systemPrompt 的另一条路径是 systemPromptOverride（见 08-resource-loader.md）
    // 这里只做"读取 + 缓存"，注入走 context hook 或 steer
  });
};

async function loadPackageJson(cwd: string) {
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(`${cwd}/package.json`, "utf-8"));
}
```

### 模式 D：用 `session.steer()` 在 Agent 工作中补充指示

```ts
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
const { session } = await createAgentSession({ sessionManager: SessionManager.inMemory() });
// 用宿主动作回调而不是计时保证：仅在 streaming 时 steer，await/catch 由宿主负责
async function onUserCorrection(text: string) {
  if (session.isStreaming) await session.steer(text);
  else await session.prompt(text);
}
try { await session.prompt("重构 src/utils.ts"); }
finally { session.dispose(); }
// 将 onUserCorrection 接到 UI；不保留退出后仍会触发的 timer
```

> ⚠️ **steer 生效前提**：loop 必须还在跑。GLM 等快模型 + 简单 prompt 时，loop 可能在 timer 触发前就退出，steer 消息永远不被消费。详见 [F05 核心机制 3](F05-steer-session.md#3-steer-的生效前提loop-必须还在跑)。

## 在扩展中持久化记忆

扩展 handler 会被 await。简单持久化可在 agent_settled 中 await；需要后台工作时，由宿主拥有 snapshot、固定 session/tenant ID、取消/错误处理队列及退出 flush，不在未捕获 rejection 的 queueMicrotask 中写当前会话。事件 listener 不被 await，并不意味着自动可靠落库。

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export default function (pi: ExtensionAPI) {
  pi.on("agent_settled", (event, ctx) => {
    if (event.aborted) return;
    // 同步写当前会话，无迟到的跨会话 append
    pi.appendEntry("settled_note", {
      sessionId: ctx.sessionManager.getSessionId(), timestamp: Date.now(),
    });
  });
}
```

要总结当前可见上下文（含压缩/编辑），见 [G03](G03-auto-summarize.md)。agent_end 在低层重试间隙也触发，不能当唯一最终信号。

## 常见误期待与陷阱

### 陷阱 1：`turn_start` + `sendUserMessage` + `steer` 死循环

**现象**：在 `turn_start` hook 里无条件调用 `pi.sendUserMessage(text, { deliverAs: "steer" })`，期望"每轮注入上下文"。实际：每个 steer 触发新一轮 turn → 新一轮 turn 触发 turn_start → 又 steer → **无限循环**直到 token 耗尽。

**修复**：
- 想每轮 LLM 调用前改消息 → 用 `pi.on("context")` hook（不触发新 turn）
- 想每次 prompt 加载一次 → 用 `pi.on("before_agent_start")`（每次 prompt 只触发一次）
- 非要在 `turn_start` 注入 → 加去重条件（如"只在首轮" `event.turnIndex === 0`，或基于时间戳的缓存）

详见 [F05 扩展中注入 steer 消息](F05-steer-session.md#扩展中注入-steer-消息)。

### 陷阱 2：「customPrompt 就是最终 system prompt」

**现象**：给 `DefaultResourceLoader` 设了 `systemPrompt: "You are a helpful assistant"`，期望 Agent 只看到这一句。实际：Agent 的 system prompt 末尾会被自动追加 `<project_context>` 块（contextFiles）、skills 列表、`Current working directory: ...`。

**根因**：`buildSystemPrompt` 的 `customPrompt` 分支仍会执行追加逻辑（system-prompt.ts）。

**修复**：
- 完全屏蔽 context files → `noContextFiles: true`
- 屏蔽 skills → 不传 `skills`（或 `skillsOverride: () => ({ skills: [], diagnostics: [] })`）
- 完整覆盖用 before_agent_start 返回 `{ systemPrompt }` 或 options.forceSystemPrompt；包括空字符串，不再追加 sections

详见 [11-context-files.md](../sdk_doc/11-context-files.md)。

### 陷阱 3：「context files 受 projectTrusted 保护」

**现象**：以为项目未被信任时，AGENTS.md / CLAUDE.md 不会被加载。实际：**不受 projectTrusted 门槛**（resource-loader.ts），无条件从文件系统读取注入。projectTrusted 控制项目资源发现，不是 OS 沙盒。

**修复**：
- 二次开发场景（用 pi-agent 开发第三方 Agent）→ 用 `noContextFiles: true` 关闭兼容机制
- 宿主 CLAUDE.md（给 Claude Code 开发者看的项目文档）会被误注入到运行时 Agent——必关

详见 [11-context-files.md 集成踩坑](../sdk_doc/11-context-files.md#集成踩坑用-pi-agent-二次开发第三方-agent-时必须隔离宿主-claudemd)。

### 陷阱 4：「subscribe 能监听 context 事件」

**现象**：在 Express SSE 路由用 `session.subscribe` 监听 `event.type === "context"`，期望抓取发给 LLM 的消息。实际：**handler 根本不会被 context 事件触发**——context 事件不经 subscribe 层 `_emit` 分发，只在扩展层 `pi.on` 派发。

**根因**：`context` 是扩展独有事件（[04-events.md 坑 4](../sdk_doc/04-events.md#坑-46-个扩展独有事件sessionsubscribe-静默收不到-最大集成坑)），只在 `pi.on` 派发。

**修复**：把抓取逻辑写成**扩展**（走 `pi.on("context", ...)`），通过 `extensionFactories` 注入 session。详见 [04-events.md 坑 4](../sdk_doc/04-events.md#坑-46-个扩展独有事件sessionsubscribe-静默收不到-最大集成坑)。

## 变体与延伸

- 在 turn 启动时预加载项目数据 → [场景 G04](G04-preload-context.md)（聚焦"读什么"，G01 聚焦"怎么注入"）
- 自动总结并持久化记忆 → [场景 G03](G03-auto-summarize.md)
- steer 的入队机制详解（steeringMode、queue_update、生效前提）→ [场景 F05](F05-steer-session.md)
- context files 完整 API（loadProjectContextFiles / agentsFilesOverride / noContextFiles）→ [11-context-files.md](../sdk_doc/11-context-files.md)
- resource loader 完整 API（systemPromptOverride 等）→ [08-resource-loader.md](../sdk_doc/08-resource-loader.md)
- 扩展层事件完整清单（含 context / before_agent_start 等扩展独有 hooks，非穷举）→ [04-events.md](../sdk_doc/04-events.md)

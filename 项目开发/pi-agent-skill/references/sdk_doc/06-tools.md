# 06 - 工具系统 (Tools)

`@earendil-works/pi-coding-agent` 导出完整工具系统，支持使用内置工具（read / bash / powershell / edit / write / grep / find / ls）和注册自定义工具。

**什么时候需要自定义工具**：内置工具覆盖的是通用 coding 操作（读写文件、跑命令）。当你要让 agent 调用你的业务能力——查数据库、调内部服务、读特定索引、操作私有 API——时，就需要 `customTools`。不用的话 agent 只能通过 bash 绕路（如 `curl` 内部接口、写临时脚本），既慢又容易出错，还把敏感凭据暴露进 shell 历史；而一个封装好的 customTool 可以在 `execute` 内部安全地取凭据、做参数校验、返回结构化结果。

## 内置工具一览

| 工具名 | 功能 | 所属类别 |
|--------|------|----------|
| `read` | 读取文件内容 | coding / readonly |
| `bash` | 执行 shell 命令 | coding |
| `powershell` | 执行 PowerShell 命令 | shell |
| `edit` | 精确字符串替换编辑 | coding |
| `write` | 写入/覆盖文件 | coding |
| `grep` | 基于 ripgrep 的内容搜索 | readonly |
| `find` | 文件 glob 匹配搜索 | readonly |
| `ls` | 列出目录内容 | readonly |

## 工厂函数

这些是 SDK 导出的工具工厂函数，可接受自定义 cwd 和选项：

```ts
import {
  createReadTool, createBashTool, createEditTool, createWriteTool,
  createGrepTool, createFindTool, createLsTool, createPowerShellTool,
  createCodingTools,      // [read, bash, edit, write]
  createReadOnlyTools,    // [read, grep, find, ls]
} from "@earendil-works/pi-coding-agent";
```

所有单工具工厂共享模式：`createXxxTool(cwd: string, options?: XxxToolOptions)`。

包根公开单工具 `createReadToolDefinition` / `createBashToolDefinition` / `createPowerShellToolDefinition` / `createEditToolDefinition` / `createWriteToolDefinition` / `createGrepToolDefinition` / `createFindToolDefinition` / `createLsToolDefinition`。内部批量 `createCodingToolDefinitions`、`createReadOnlyToolDefinitions`、`createAllToolDefinitions`、`createAllTools` **不从包根导出**，不要用未公开子路径绕过 exports。

## 工具选择规则（1.2.0 权威表）

这是 `tools` / `excludeTools` / `noTools` 的统一落点；场景文档引用此表，避免复制规则。

| 配置 | 选择与注册行为 |
|---|---|
| 未传 tools/noTools | 使用 settings 的 `defaultTools`；未配置时默认 read/bash/edit/write。不是启用全部已注册内置工具。扩展/custom 工具按 exposure/defaultActive 激活 |
| `tools: ["read", "my_*"]` | plain allowlist，支持 `*` 任意字符匹配；内置/扩展/custom 工具按匹配过滤 |
| `tools: ["+my_tool", "-bash"]` | modifier-only 列表，以默认选择为基准按精确名称增减；不能与 plain 条目混用，混用会抛错 |
| `excludeTools: ["mcp__docs__delete*"]` | denylist 支持 `*`，在选择后过滤，含 MCP |
| `noTools: "builtin"` | 不初始激活默认内置工具，不是永久禁止它们；保留扩展/custom 的默认激活 |
| `tools: []` 或未传 tools 的 `noTools: "all"` | 禁用全部来源，包括 MCP |
| 同时 tools 与 noTools | 显式 tools 优先，noTools 不参与选择 |

**MCP 例外**：非空 plain allowlist 通常保留 MCP 注册，供 codemode/tool search 调用，即使 MCP 名未列入。只有条目以 `mcp__` 开头时才显式收紧 MCP 注册范围；`excludeTools` 仍生效。只传 `["read"]` 不是“只读宿主隔离”。宿主权限与 OS/容器隔离不由工具名选择保证。

## 在会话中注册自定义工具

> **依赖**：示例从 `typebox` 导入 `Type`。目标 SDK 的直接依赖为 1.3.27；宿主项目应声明自己的直接依赖，不依赖 npm/pnpm 的提升布局。
>
> ```bash
> npm install typebox
> ```

有两种方式注册自定义工具：

### 方式一：通过 `createAgentSession()` 的 `customTools` 参数

```ts
import { createAgentSession, defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const myTool = defineTool({
  name: "my_tool",
  label: "My Tool",
  description: "Does something useful",
  parameters: Type.Object({
    input: Type.String({ description: "The input string" }),
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    return {
      content: [{ type: "text", text: `Processed: ${params.input}` }],
      details: { result: params.input.toUpperCase() },
    };
  },
});

const { session } = await createAgentSession({
  tools: ["read", "bash", "my_tool"],  // 显式声明允许的工具（含自定义）
  customTools: [myTool],
});
```

### 方式二：在 Extension 内通过 `pi.registerTool()` 注册

```ts
const myExtension: ExtensionFactory = (pi) => {
  pi.registerTool(defineTool({
    name: "custom_search",
    label: "Custom Search",
    description: "Search custom index",
    parameters: Type.Object({ query: Type.String() }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return { content: [{ type: "text", text: params.query }], details: undefined };
    },
  }));
};
```

### 两种方式怎么选

| 维度 | 方式一 `customTools` | 方式二 `pi.registerTool` |
|------|---------------------|-------------------------|
| 归属层级 | SDK 级（`createAgentSession` 参数） | 扩展级（走 extension runner） |
| 生命周期 | 随 session 创建固定 | 随扩展 reload 重建 |
| `sourceInfo` | `<sdk:工具名>` | 扩展路径 |
| 分发复用 | 适合一次性嵌入 | 适合随扩展分发给多个项目 |
| 受 `tools`/`excludeTools`/`noTools` 过滤 | 是 | 是（二者一致） |

**决策提示**：纯 SDK 嵌入、工具只服务当前会话 → 用 `customTools`；要让工具随扩展分发出可复用的能力包、参与扩展热重载 → 用 `registerTool`。

### customTools 与选择

纯添加业务工具可省略 `tools`，其默认激活仍受 exposure/defaultActive 控制。plain allowlist 要包含业务工具名；modifier-only 列表可用 `["+my_tool"]` 保留默认选择。完整规则见上方权威表。

## ToolDefinition 接口详解

```ts
interface ToolDefinition<TParams extends TSchema, TDetails = unknown, TState = any> {
  name: string;                    // 工具名，LLM 调用时使用
  label: string;                   // UI 中显示的人类可读标签
  description: string;             // 给 LLM 看的工具描述

  promptSnippet?: string;          // 出现在系统提示词 "可用工具" 区块的一行摘要
  promptGuidelines?: string[];     // 追加到系统提示词 "Guidelines" 区块的提示项

  outputSchema?: TSchema;          // successful structuredContent 的 JSON Schema
  exposure?: ToolExposure;
  namespace?: ToolNamespace;       // name / aliases? / description? / instructions?
  defaultActive?: boolean;
  annotations?: ToolAnnotations;   // 作者提供的提示，不是已验证权限
  reachesTools?: (input: Record<string, unknown>) => "all" | readonly string[];
  prepareLoadout?: (loadout: ToolLoadout) => ToolLoadoutChanges | undefined;
  parameters: TParams;             // TypeBox schema，定义工具参数
  constrainedSampling?: false | ConstrainedSamplingConfig;  // 工具约束采样（见下文详解）
  renderShell?: "default" | "self"; // 控制外壳渲染方式

  prepareArguments?: (args: unknown) => Static<TParams>;
  executionMode?: ToolExecutionMode; // "sequential" | "parallel"

  execute(
    toolCallId: string,
    params: Static<TParams>,
    signal: AbortSignal | undefined,     // 用于响应取消信号
    onUpdate: AgentToolUpdateCallback<TDetails> | undefined, // 流式更新回调
    ctx: ExtensionToolContext,              // 扩展上下文
  ): Promise<AgentToolResult<TDetails>>;

  renderCall?: (args: Static<TParams>, theme: Theme, context: ToolRenderContext<TState, Static<TParams>>) => Component;
  renderResult?: (result: AgentToolResult<TDetails>, options: ToolRenderResultOptions, theme: Theme, context: ToolRenderContext<TState, Static<TParams>>) => Component;
}
```

> ℹ️ **`renderCall` / `renderResult` 用于 TUI 和 HTML 导出**：它们返回 `Component`（终端 UI 组件），不是 Web 前端组件；普通 SDK 流式输出不自动显示它们。**SDK 嵌入场景（RPC/print/json 模式）不渲染 Component，这两个字段可完全省略**。SDK 用户只需实现 `name` / `label` / `description` / `parameters` / `execute` 即可。

### `defineTool()` 包装函数

```ts
export function defineTool<TParams extends TSchema, TDetails = unknown, TState = any>(
  tool: ToolDefinition<TParams, TDetails, TState>,
): ToolDefinition<TParams, TDetails, TState> & AnyToolDefinition;
```

**作用**：保持 `parameters` 的 TypeBox 类型推断不被 `customTools` 数组类型收窄为 `unknown`。当把工具定义赋值给变量或在数组中传递时，强烈推荐使用。

## AgentToolResult 结构

`execute()` 必须返回该类型：

```ts
interface AgentToolResult<TDetails> {
  content: (TextContent | ImageContent)[];  // 返回给 LLM 的内容
  details: TDetails;                         // 扩展专用元数据（不进 LLM 上下文）
  isError?: boolean;                         // returned error 受支持；也可 throw
  structuredContent?: JsonValue;             // 机器可读结果，与 outputSchema 对应
  usage?: Usage;                             // 工具自身的 token 使用量（工具内部调 LLM 时回传）。注意：它**纳入 cost/token 展示总计**（归入 "Tools/summaries" 桶），但**不参与 context 窗口核算**——context 只算 assistant 消息的 provider usage，tool usage 不会喂回去膨胀上下文
  addedToolNames?: string[];                 // transcript-level 动态工具注册（动态工具发现的替代路径）
  terminate?: boolean;                       // 设为 true 可在当前工具批次完成后提前终止 agent loop
}
```

### constrainedSampling（工具约束采样）

**解决什么问题**：LLM 调用工具时，参数可能是任意自由文本——但你希望某些字段严格符合结构（如完整 JSON、正则约束、Lark 语法）。`constrainedSampling` 字段让 provider 在采样阶段就强制约束，提升工具参数生成质量（尤其结构化数据 / JSON 输出场景）。

**两种约束类型**（`ConstrainedSamplingConfig`，见 `packages/ai/src/types.ts`）：

```ts
type ConstrainedSamplingConfig =
  | { type: "json_schema"; strict: "prefer" | "require" }   // JSON Schema 约束（"require" = 必须支持，"prefer" = 优先但允许降级）
  | { type: "grammar"; variants: Partial<Record<GrammarFormat, string>> }  // 语法约束（GrammarFormat = "openai_lark" | "openai_regex"）
```

在完整 `defineTool` 中设置 `constrainedSampling: { type: "json_schema", strict: "require" }` 或 grammar variants。`require` 表示要求 provider 支持，不应承诺不支持时静默降级；具体支持以该 provider 的固定版本声明/实现为准。

- `content` 中的文字会参与后续的 LLM 对话上下文
- `details` 是工具返回的结构化数据，用于 UI 渲染或扩展内部逻辑
- `terminate` 仅当同一批次所有工具都返回 `terminate: true` 时生效，agent 不再继续下一轮 LLM 调用

## execute() 各参数说明

| 参数 | 类型 | 说明 |
|------|------|------|
| `toolCallId` | `string` | 本次工具调用的唯一 ID |
| `params` | `Static<TParams>` | 经 TypeBox schema 校验后的参数 |
| `signal` | `AbortSignal \| undefined` | 取消信号，用于支持中断长时间运行的工具 |
| `onUpdate` | `AgentToolUpdateCallback \| undefined` | 流式更新回调，可在执行中途推送进度 |
| `ctx` | `ExtensionToolContext` | 工具运行时的会话上下文，常用：`ctx.cwd`（项目根）、`ctx.model`（当前模型）、`ctx.modelRegistry`、`ctx.mode`、`ctx.sessionManager`、`ctx.ui`（UI 交互，仅 interactive/RPC 模式可用，可用 `ctx.hasUI` 判断）、`ctx.signal`（abort 信号，用于响应中断）、`ctx.abort()`（自行中断）、`ctx.compact()`（触发压缩）、`ctx.getSystemPrompt()`、`ctx.scopedModels` 等。⚠️ 注意：`getFlag()` **不在** `ctx` 上——它在扩展 factory 的 `pi`（`ExtensionAPI`）对象上，即 `pi.getFlag("x")`，在 `execute()` 的 `ctx` 里取不到 |

## 关键注意事项

1. **重名规则分层**：跨扩展同名工具 first-wins；loader 可报告 tools/flags 冲突。SDK customTools 合并在扩展后，同名可覆盖；不要推断“后加载扩展胜出”。命名 inline 的 replaceable 行为见 [资源加载器](08-resource-loader.md)。
2. **选择规则**：统一见上方权威表。
3. **active ≠ callable**：见下方 exposure；权限限制需涵盖嵌套调用。
4. **`prepareArguments`**：在 schema 校验之前运行，用于兼容性转换或参数清洗
5. **`signal` 参数**：实现工具时务必检查 `signal.aborted`，在长时间操作中及时终止
6. **`renderShell: "self"`**：告诉 UI 框架不要包裹默认的外壳，由工具自己渲染边框
7. **`withFileMutationQueue`**：SDK 导出的高阶函数（`core/tools/index.ts`），用于给文件操作加串行队列。同一文件的写操作排队执行，不同文件的仍可并行。内置 `edit` / `write` 工具已内置使用；自定义文件操作工具如有并发写入冲突，可手动包裹 `withFileMutationQueue(filePath, async () => { ... })`。签名：`withFileMutationQueue<T>(filePath: string, fn: () => Promise<T>): Promise<T>`

> 其他内置工具（bash / edit / write / grep / find / ls）各自的 Options 接口（`BashToolOptions` / `EditToolOptions` 等）详见源码：
> `core/tools/{bash,edit,write,grep,find,ls}.ts`

## 内置工具的安全边界

### 内置 read tool 不支持路径白名单

**现象**：用 `createReadTool(cwd)` 创建的内置 read tool，`cwd` 只决定**相对路径的解析基目录**，不限制可读范围。模型理论上可以读项目任意文件。

**后果**：处理含 `.env`（API Key）、源码、密钥等敏感文件的项目时，存在提示词注入风险——恶意用户输入可能诱导模型 `read .env`，把密钥泄露到对话上下文。

**`ReadToolOptions` 实际字段**（确认于 pi-coding-agent 类型定义）：

```ts
interface ReadToolOptions {
  autoResizeImages?: boolean;   // 图片自动缩放（默认 true，最大 2000x2000）
  operations?: ReadOperations;  // 自定义文件读取实现（用于 SSH 等远程场景）
}
```

**没有** `allowedPaths` / `sandbox` / `rootDir` 之类的路径限制字段。其他内置工具（bash / edit / write）的 options 同样不含路径白名单——内置工具的定位是"通用 coding 工具"，安全边界需使用者自行加。

> 💡 **bash 工具的命令拦截点**：虽然没有路径白名单，`BashToolOptions` 提供了 `spawnHook?: BashSpawnHook`（签名 `(context: BashSpawnContext) => BashSpawnContext`），在命令真正 spawn 之前被调用，可改写或拒绝命令——这是 bash 工具内置的安全/审计挂钩点。详见 `core/tools/bash.ts` 的 `BashSpawnHook` 类型。

**词法教学示例，非宿主沙箱**：`path.resolve` 不模拟内置 `~` / `@` 展开，也不解析 symlink；允许目录中的链接可指向外部。此包装仅展示委派模式。实际多租户隔离须由宿主的 OS/容器/受限文件系统提供，不要依赖此检查承诺安全。

用 `createReadToolDefinition()` 拿到内置定义，包装一层路径校验。保留内置的 offset / limit / 截断 / 图片处理能力，只在执行前做路径检查：

```ts
import {
  createReadToolDefinition,
  defineTool,
} from "@earendil-works/pi-coding-agent";
import * as path from "node:path";

const ALLOWED_DIR = path.resolve(process.cwd(), ".pi", "skills");
const baseRead = createReadToolDefinition(process.cwd());

export const readSkillTool = defineTool({
  ...baseRead,
  name: "read",
  description:
    baseRead.description +
    "。词法教学限制：仅允许读取 .pi/skills/ 目录内文件。",
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    const requested = path.resolve(process.cwd(), params.path);
    // 必须严格位于 ALLOWED_DIR 内（防 ../ 逃逸、防 .pi\skills-evil\ 前缀欺骗）
    const allowed =
      requested === ALLOWED_DIR ||
      requested.startsWith(ALLOWED_DIR + path.sep);
    if (!allowed) {
      return {
        content: [
          {
            type: "text" as const,
            text: `权限拒绝：read 工具只能读取 ${ALLOWED_DIR} 内的文件。`,
          },
        ],
        details: undefined,
        isError: true,
      };
    }
    return baseRead.execute(toolCallId, params, signal, onUpdate, ctx);
  },
});
```

**典型应用场景**：当 read tool 主要用于"让模型按需读 skill 正文"时（见 [09-skills.md](09-skills.md) 的「Skill 正文不自动注入」踩坑节），把范围限制在 `.pi/skills/` 既满足 pi-agent 渐进式披露的设计意图，但不能保证防止敏感文件泄露；宿主隔离仍是前提。

## Exposure 与嵌套调用

`direct`：active 时声明且 callable；`model-only`：active 时声明但不可嵌套调用；`codemode`：注册后 callable，不默认声明，codemode 列出；`deferred`：同样 callable，但由搜索发现；`hidden`：注册但不可达，激活无效。direct/model-only 默认自动激活，`defaultActive:false` 可关闭。

`execute` 的第五参数是 `ExtensionToolContext`，含 `tools` 与 `executeTool(name,args,{signal?,onUpdate?})`。嵌套调用经过同一校验/权限/hooks，工具失败返回 `isError:true` outcome；事件带 `parentToolCallId`，子调用 ID 为 `<parent>/<n>`，不单独进入 transcript，父结果有有界 nestedCalls 记录。

`namespace.aliases` 供 namespace 查找；`reachesTools` 声明调用可能触及的工具/namespace（可 over-match，非权限保证）；`prepareLoadout` 可改 model-facing descriptions / hiddenDeclarations，隐藏声明不会删除 active/callable 状态。

声明 `outputSchema` 的成功结果应返回 `structuredContent`，codemode 优先接收它；脱敏需同时处理它。tool_result 改 content 而不返回 structuredContent 会丢弃旧结构化输出。文本/图片类型来自 `@earendil-works/pi-ai`，不是 coding-agent 包根。

# ExtensionAPI (pi 对象)

## 这是什么

`ExtensionAPI` 是扩展的**核心操作接口**。每个扩展函数接收一个 `pi` 参数，通过它订阅事件、注册工具、发送消息、控制 UI 等。

**什么时候写扩展**：当你需要拦截/修改工具调用、注入系统提示词、接自定义 Provider、变换用户输入、或订阅生命周期做埋点/后处理时，写一个扩展文件并 `export default (pi) => {...}`。普通"响应事件做记录"的需求也能用外部 `session.subscribe()`（见 04-events.md），但只有扩展能拦截/修改事件流、注册工具与命令。

```ts
// 扩展文件 (extensions/my-ext.ts) 或 extensionFactory
export default (pi: ExtensionAPI) => {
  pi.on("agent_start", (event, ctx) => { /* ... */ });
  pi.registerTool({ name: "my_tool", /* ... */ });
};
```

## 完整接口

### 事件订阅

```ts
pi.on(eventName, handler): () => void
```

支持的所有事件名（详见 [04-events.md](04-events.md)）：

> **派发层提示**：标 ⭐ 的事件是**扩展独有**，只经 `pi.on`（扩展层 `_extensionRunner.emit`）派发，**外部 `session.subscribe()` 收不到**（不在 `AgentSessionEvent` union 中）。下表所有 `session_*` 事件（`session_start` / `session_before_*` / `session_compact` / `session_shutdown` / `session_tree`）也都是扩展独有，**除 `session_info_changed` 外** subscribe 层均收不到。`agent_settled` 的"两层"指扩展层 `pi.on` + session subscribe 层（详见 04-events.md）。

事件归属、公共 payload 与可操作边界统一见 [04-events.md](04-events.md)。1.2.0 还包括 agent_before_settle、context_with_system、provider_stream_event、ui_prompt_start/end、mcp_servers_change、session_compact_failed、cache_warming_decision；turn_end 可返回 BoundaryResult，settled 带 aborted。pi.on 返回退订函数。

Handler 函数签名：`(event: EventType, ctx: ExtensionContext) => Promise<ResultType | void> | ResultType | void`（支持 async/await）

### 工具注册

```ts
pi.registerTool(tool: ToolDefinition): void
```

运行时动态注册一个 LLM 可调用的工具。参见 [06-tools.md](06-tools.md) 的 ToolDefinition 详解。

### 命令/快捷键/CLI Flag

```ts
pi.registerCommand(name: string, options: {
  description?: string;
  handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  getArgumentCompletions?: (argumentPrefix: string) => AutocompleteItem[] | null | Promise<AutocompleteItem[] | null>;
}): void

pi.registerShortcut(shortcut: KeyId, options: {
  description?: string;
  handler: (ctx: ExtensionContext) => Promise<void> | void;
}): void

pi.registerFlag(name: string, options: {
  description?: string;
  type: "boolean" | "string";
  default?: boolean | string;
}): void

pi.getFlag(name: string): boolean | string | undefined
```

### 消息渲染

```ts
pi.registerMessageRenderer<T>(customType: string, renderer: MessageRenderer<T>): void
pi.registerMarkdownTransformer(transformer: MarkdownTransformer): void  // 用户/助手 Markdown 渲染前变换
pi.registerEntryRenderer<T>(customType: string, renderer: EntryRenderer<T>): void  // 自定义 entry 渲染器（CustomEntry，不进 LLM 上下文）
```

- `registerMessageRenderer` 为 `CustomMessageEntry` 注册渲染器
- `registerMarkdownTransformer` 在用户/助手 Markdown 渲染到交互式 transcript 前做变换（如链接展开、代码块高亮预处理）
- `registerEntryRenderer` 为 `CustomEntry`（不参与 LLM 上下文的会话条目，如日志/状态行）注册渲染器

### 消息发送

```ts
pi.sendMessage<T>(message: {
  customType: string;
  content: string | (TextContent | ImageContent)[];
  display: boolean;
  details?: T;
}, options?: {
  triggerTurn?: boolean;
  deliverAs?: "steer" | "followUp" | "nextTurn";
}): void

pi.sendUserMessage(
  content: string | (TextContent | ImageContent)[],
  options?: { deliverAs?: "steer" | "followUp"; expandPromptTemplates?: boolean }
): void
```

`sendUserMessage` 在 Agent 空闲时立即触发 turn；流式中按 `deliverAs` 入队（steer/followUp）。`sendMessage` 默认不触发 turn（需显式 `triggerTurn: true`）。

### 会话状态

```ts
pi.appendEntry<T>(customType: string, data?: T): void
pi.setSessionName(name: string): void
pi.getSessionName(): string | undefined
pi.setLabel(entryId: string, label: string | undefined): void
```

### Shell 执行

```ts
pi.exec(command: string, args: string[], options?: ExecOptions): Promise<ExecResult>
```

### 工具/Tools 管理

```ts
pi.getActiveTools(): string[]
pi.getAllTools(): ToolInfo[]
pi.setActiveTools(toolNames: string[]): void
pi.getCommands(): SlashCommandInfo[]
```

`ToolInfo` 还含 reachesTools / namespace / exposure 等当前元数据；具体以 public declaration 为准，工具语义统一见 [06-tools.md](06-tools.md)。

### 模型控制

```ts
pi.setModel(model: Model<any>): Promise<boolean>
pi.getThinkingLevel(): ThinkingLevel
pi.setThinkingLevel(level: ThinkingLevel): void
```

### Provider 注册（双重载）

```ts
// 重载 1：注册完整 pi-ai Provider 对象
pi.registerProvider(provider: Provider): void

// 重载 2：注册静态配置
pi.registerProvider(name: string, config: ProviderConfig): void
```

这是接入自定义模型的关键 API。ProviderConfig 主要字段（详见 [16-custom-provider.md](16-custom-provider.md)）：
- `name?` — UI 显示名
- `baseUrl` — API 端点
- `apiKey` — 密钥（支持 `$ENV_VAR` 引用 / `!command` / 字面值）
- `api` — API 格式。已知值：`"anthropic-messages"` / `"openai-responses"` / `"openai-completions"` / `"azure-openai-responses"` / `"openai-codex-responses"` / `"mistral-conversations"` / `"bedrock-converse-stream"` / `"google-generative-ai"` / `"google-vertex"` / `"pi-messages"`，也支持自定义 string
- `streamSimple?` — 自定义流式处理器（用于非标准 API 格式）
- `refreshModels?` — 模型列表刷新回调（支持 `/refresh` 命令动态拉取模型目录）
- `models` — 模型列表（含 contextWindow, maxTokens, cost 等）
- `headers` — 自定义请求头（可选，`Record<string, string>`）
- `authHeader` — 默认 false。为 `true` 时用 API Key 自动添加 `Authorization: Bearer` 头（协议无关）。注意 openai-completions 下 SDK 已自动带 Bearer，此字段可省；主要给「要求 Bearer 的非 openai 协议代理」用
- `oauth` — OAuth 配置（可选，含 `refreshToken(credentials, signal: AbortSignal)` 必须接收 signal 参数）

```ts
pi.registerProvider("my-proxy", {
  baseUrl: "https://proxy.example.com",
  apiKey: "$PROXY_API_KEY",
  api: "anthropic-messages",
  authHeader: true,            // 仅当代理要求 Bearer（而非 x-api-key）时；anthropic-messages 默认走 x-api-key
  models: [{
    id: "claude-sonnet-4-20250514",
    name: "Claude 4 Sonnet (proxy)",
    reasoning: false,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200000,
    maxTokens: 16384
  }]
});
```

> 完整 Provider 对象注册详见 [16-custom-provider.md 模式 5](16-custom-provider.md#模式-5注册完整-pi-ai-provider-对象v0810)。

### 扩展间事件总线（EventBus）

```ts
pi.events: EventBus  // 共享事件总线，用于扩展间通信
```

跨扩展通信的轻量级事件总线。与 `pi.on`（pi-agent 生命周期事件）不同，`pi.events` 用于扩展自定义事件，多个扩展之间可借此协调状态。详见 SDK 源码 `extensions/types.ts`。

### Provider 反注册

```ts
pi.unregisterProvider(name: string): void
```

移除已注册的 provider 及其所有模型，恢复被覆盖的内置模型。若 provider 未注册则无操作（不抛错）。适用于 provider 热更新、测试清理等场景。

```ts
pi.unregisterProvider("my-proxy");
```

## ExtensionContext

每个 event handler 的第二个参数 `ctx` 提供了操作上下文：

| 属性/方法 | 类型 | 说明 |
|-----------|------|------|
| `ctx.ui` | `ExtensionUIContext` | 宿主绑定的 UI 操作（先检查 hasUI；Web 二次开发通常自行实现，本 skill 未收录详细文档，查 SDK 源码） |
| `ctx.hasUI` | `boolean` | 是否有可用 UI（由绑定的 uiContext 是否为 no-op 决定，不由 mode 决定） |
| `ctx.mode` | `"tui" \| "rpc" \| "json" \| "print"` | **运行模式**。扩展可根据模式差异化行为：tui 有交互 UI；rpc/json 给 SDK 调用方；print 一次性输出 |
| `ctx.cwd` | `string` | 当前工作目录 |
| `ctx.isProjectTrusted()` | `() => boolean` | **项目是否被用户信任**。用于决定是否执行潜在危险操作（写文件、跑 bash 等） |
| `ctx.sessionManager` | `ReadonlySessionManager` | 只读会话管理器（只读方法的 Pick 子集，**含 `buildContextEntries()` 不含 `buildSessionContext()`**） |
| `ctx.modelRegistry` | `ModelRegistry` | 模型注册表兼容包装器（内部委托 `ModelRuntime`） |
| `ctx.model` | `Model<any> \| undefined` | 当前模型 |
| `ctx.scopedModels` | `readonly ScopedModel[]` | 会话解析的模型作用域快照（来自 `--models` / `enabledModels` 设置，空 = 所有可用模型） |
| `ctx.thinkingLevel?` | `ThinkingLevel \| undefined` | 当前思考等级（会话运行时提供时） |
| `ctx.isIdle()` | `() => boolean` | Agent 是否空闲 |
| `ctx.signal` | `AbortSignal \| undefined` | 当前 AbortSignal |
| `ctx.abort()` | `() => void` | 中止当前操作 |
| `ctx.shutdown()` | `() => void` | 关闭 pi |
| `ctx.hasPendingMessages()` | `() => boolean` | 是否有待处理消息 |
| `ctx.getContextUsage()` | `() => ContextUsage \| undefined` | 上下文用量 |
| `ctx.compact()` | `(options?: CompactOptions) => void` | 触发压缩。`CompactOptions = { customInstructions?: string; onComplete?: (result: CompactionResult) => void; onError?: (error: Error) => void }` |
| `ctx.getSystemPrompt()` | `() => string` | 获取当前系统提示词 |

## ExtensionCommandContext（命令 handler 专用）

命令 handler 的 ctx 额外提供：

| 方法 | 类型 | 说明 |
|------|------|------|
| `waitForIdle()` | `() => Promise<void>` | 等待 Agent 空闲 |
| `getSystemPromptOptions()` | `() => BuildSystemPromptOptions` | 获取系统提示词构建选项，可用于分析当前 system prompt 配置 |
| `newSession(options?)` | `(options?: { parentSession?, setup?, withSession? }) => Promise<{ cancelled: boolean }>` | 创建新会话 |
| `fork(entryId, options?)` | `(entryId: string, options?: { position?, withSession? }) => Promise<{ cancelled: boolean }>` | 从指定条目分叉 |
| `navigateTree(targetId, options?)` | `(targetId: string, options?: { summarize?, customInstructions?, replaceInstructions?, label? }) => Promise<{ cancelled: boolean }>` | 导航会话树 |
| `switchSession(sessionPath, options?)` | `(sessionPath: string, options?: { withSession? }) => Promise<{ cancelled: boolean }>` | 切换到其他会话文件 |
| `reload()` | `() => Promise<void>` | 重载扩展/skills/prompts/themes |

## ReplacedSessionContext（withSession 回调参数）

`newSession()` / `fork()` / `switchSession()` 的 `withSession` 回调接收此上下文。它继承 `ExtensionCommandContext` 全部方法，并额外提供绑定到新会话的消息发送能力：

| 方法 | 类型 | 说明 |
|------|------|------|
| `sendMessage<T>()` | `(message, options?) => Promise<void>` | 向新会话发送自定义消息（支持 `triggerTurn` / `deliverAs`） |
| `sendUserMessage()` | `(content, options?) => Promise<void>` | 向新会话发送用户消息（支持 `deliverAs`） |

## 1.2.0 注册入口

- `pi.registerToolRenderer(resolver: ToolRendererResolver): void`，resolver 为 `(toolName,next)=>ToolRenderers|undefined`。
- `pi.registerMcpServer(name,config)` / `unregisterMcpServer(name)` / `getMcpServers()`；SDK 使用 MCP extension 时还需 bindExtensions 触发连接。
- `pi.registerVirtualModel(model)` / `unregisterVirtualModel(provider,id)`；配置以 public ExtensionVirtualModel 声明为准，不混同 Provider 注册。
- tool execute 的 ctx 是 `ExtensionToolContext`（含 tools/executeTool），事件 ctx 是 ExtensionContext；详见 [06-tools.md](06-tools.md)。

命令可用 `session.prompt("/name args")` 在 SDK 中调用，不是 TUI 专属。需要资源 startup 时 loader.reload → createAgentSession({resourceLoader:loader}) → session.bindExtensions({})。

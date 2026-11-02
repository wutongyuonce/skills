# createAgentSession

## 这是什么

`createAgentSession` 是 pi-agent SDK 的**主入口函数**。它接受全部配置，返回一个可用的 `AgentSession` 实例。所有 Agent 创建都从这里开始。

## 函数签名

```ts
function createAgentSession(options?: CreateAgentSessionOptions): Promise<CreateAgentSessionResult>;
```

## 参数表：CreateAgentSessionOptions

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `cwd` | `string` | `options.sessionManager?.getCwd()` ?? `process.cwd()` | 项目根目录，用于发现 `.pi/` 配置和扩展；若未传 `cwd` 但传了 `sessionManager`，先用其 `getCwd()` |
| `agentDir` | `string` | `~/.pi/agent`（来自 `getAgentDir()`） | 全局配置目录 |
| `modelRuntime` | `ModelRuntime` | `await ModelRuntime.create({ authPath, modelsPath })` | 模型/认证运行时（统一 `authStorage` + `modelRegistry`，二者已不在 Options 上） |
| `model` | `Model<any>` | 从 settings 读取，否则选第一个可用 | 指定使用的模型 |
| `thinkingLevel` | `ThinkingLevel` | 新会话先取 per-model thinking override，再取全局设置，否则 `"medium"` | 推理深度：`"off"` / `"minimal"` / `"low"` / `"medium"` / `"high"` / `"xhigh"` / `"max"`（7 档，按模型能力 `clampThinkingLevel()` 自动降级） |
| `scopedModels` | `Array<{model, thinkingLevel?}>` | `undefined` | 候选模型列表；TUI 下用 Ctrl+P 切换，SDK 下用 `session.cycleModel("forward" \| "backward")` 编程切换 |
| `noTools` | `"all"` / `"builtin"` | `undefined` | 抑制工具：`"all"` 禁用全部，`"builtin"` 禁用内置但保留扩展工具 |
| `tools` | `string[]` | settings.defaultTools 或默认选择 | patterns allowlist 或 modifier-only 列表；详见工具规则 |
| `excludeTools` | `string[]` | `undefined` | 名称/pattern denylist，含 MCP，选择后生效 |
| `customTools` | `ToolDefinition[]` | `undefined` | 自定义工具列表，使用 `defineTool()` 定义 |
| `resourceLoader` | `ResourceLoader` | `DefaultResourceLoader` | 资源加载器：控制 prompt/skills/themes/扩展 的发现与加载 |
| `sessionManager` | `SessionManager` | `SessionManager.create(cwd, getDefaultSessionDir(cwd, agentDir))` | 会话管理器：控制会话的持久化方式；默认持久化到 `~/.pi/agent/sessions/<编码后的-cwd>/`（cwd 被编码成形如 `--path-with-dashes--` 的安全目录名，**不在项目目录内**），传 `SessionManager.inMemory(cwd)` 可走内存 |
| `settingsManager` | `SettingsManager` | `SettingsManager.create(cwd, agentDir)` | 设置管理器 |
| `sessionStartEvent` | `SessionStartEvent` | `undefined` | 扩展运行时的会话启动事件元数据 |

## 返回值：CreateAgentSessionResult

```ts
interface CreateAgentSessionResult {
  session: AgentSession;           // 创建的会话实例
  extensionsResult: LoadExtensionsResult;  // 扩展加载结果
  modelFallbackMessage?: string;   // 模型回退警告，详见下方「会话恢复行为」
}
```

`modelFallbackMessage` 在两种场景下会赋值：

1. **会话保存的模型无法恢复**——比如上次用了 `anthropic/claude-opus-4-5`，但本次启动后该模型未配置 API key。此时若还能找到其他可用模型，消息形如 `Could not restore model anthropic/claude-opus-4-5. Using <provider>/<modelId>`；若彻底找不到可用模型，`modelFallbackMessage` 会被**覆盖**为 `formatNoModelsAvailableMessage()` 的输出（形如 `No models available. Use /login to log into a provider via OAuth or API key. See: ...`），原 `"Could not restore..."` 消息不保留。
2. **完全无可用模型**——`modelRuntime` 里没有任何已配置 API key 的模型（`hasConfiguredAuth` 全部失败），消息由 `formatNoModelsAvailableMessage()` 生成。注意：此时 `session` 仍会返回，**不会 throw**；真正的报错发生在 `session.prompt()` 时（`!this.model` → throw `formatNoModelSelectedMessage()`）。

> 💡 **迁移提示**：`CreateAgentSessionOptions` 上的 `authStorage` / `modelRegistry` 参数已被 `modelRuntime` 整体替换。旧代码 `{ authStorage, modelRegistry }` → 新代码 `{ modelRuntime: await ModelRuntime.create({ authPath, modelsPath }) }`。若不传 `modelRuntime`，`createAgentSession` 会用默认路径 `<agentDir>/auth.json` + `<agentDir>/models.json` 自动构造一个。`AuthStorage` 类不再从包根导出（`ModelRegistry` 类仍从包根导出，可用）；一次性读取 auth.json 用 `readStoredCredential()`（见 [sdk_doc/05](05-auth-model-registry.md)）。

## 用法示例

### 最简启动（全默认）

```ts
import { createAgentSession } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession();
try {
  await session.prompt("Hello!");
} finally {
  session.dispose();  // 必须释放：清理监听器、中止重试/压缩/分支摘要/bash 任务、使扩展上下文失效、断开 agent 连接
}
```

### 指定模型 + 思考等级

```ts
import { getModel } from "@earendil-works/pi-ai/compat"; // 注意：getModel 已标记 @deprecated，新代码建议用 getBuiltinModel from "@earendil-works/pi-ai/providers/all" 或 Models.getModel()
import { createAgentSession } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession({
  model: getModel("anthropic", "claude-opus-4-5"),
  thinkingLevel: "high",
});
```

### 工具白名单（只读模式）

```ts
const { session } = await createAgentSession({
  tools: ["read", "grep", "find", "ls"],  // 文件工具只读；MCP 保留规则见 06
});
```

### 完整自定义

```ts
const modelRuntime = await ModelRuntime.create({ authPath, modelsPath });
const { session } = await createAgentSession({
  cwd: "/path/to/project",
  model: getModel("openai", "gpt-5"),
  thinkingLevel: "medium",
  tools: ["read", "bash", "my_tool"],
  customTools: [myToolDefinition],
  resourceLoader: myResourceLoader,
  sessionManager: SessionManager.inMemory(),
  modelRuntime, // 替代 authStorage + modelRegistry
  settingsManager: mySettingsManager,
});
```

## 关键细节

### 工具白名单/黑名单/抑制三者的优先级（★ 易踩坑）

工具选择规则（`*`、modifier-only、defaultTools、MCP 注册例外）统一见 [06-tools.md 权威表](06-tools.md#工具选择规则120-权威表)。只读工具名选择不是宿主隔离；非空 allowlist 通常保留未显式 scoped 的 MCP 注册。

### 其他细节

- `model` 从 `@earendil-works/pi-ai/compat` 的 `getModel()` 获取（注意是 `/compat` 子路径，不是包根；源码 JSDoc 里写的 `@earendil-works/pi-ai` 是其自身历史残留），不是随便传字符串
- `thinkingLevel` 会被 `clampThinkingLevel()` 按模型能力自动降级（如传 `"high"` 但模型不支持，会回退到模型支持的最高档）；另外，若 model 解析失败（`model === undefined`），thinkingLevel 会被强制设为 `"off"`
- **自定义 `resourceLoader` 必须自己先 `await loader.reload()`**——只有未传 `resourceLoader` 时 `createAgentSession` 才会自动 reload（源码 `sdk.ts`）
- 记得在 `try/finally` 中调用 `session.dispose()`
- **项目级配置的信任开关（`projectTrusted`）不在 `createAgentSession` 参数上**——它属于传入的 `settingsManager`。默认 `SettingsManager.create()` 视项目为可信（`projectTrusted=true`），会正常加载 `<cwd>/.pi/settings.json`。但若自定义 `settingsManager` 时误传 `projectTrusted=false`，项目级配置会**静默失效**（源码 `loadFromStorage`：`scope === "project" && !projectTrusted` 直接返回 `{}`）。这是 SDK 集成的隐性陷阱：配置没生效但没有任何报错。

## 新建与恢复

默认 `createAgentSession()` 使用 `SessionManager.create()` **新建会话**，第二次调用不会自动续接上一次。不需要清空任何已有会话目录，也不应为新建而删除历史。

要恢复，显式传入已有内容的 manager：

```ts
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

const cwd = process.cwd();
const { session } = await createAgentSession({
  cwd,
  sessionManager: SessionManager.continueRecent(cwd),
});
try {
  await session.prompt("继续上次的工作");
} finally {
  session.dispose();
}
```

也可用 `SessionManager.open(path)` 打开指定文件，或用 `SessionManager.inMemory(cwd, header, entries)` 恢复宿主保存的条目。恢复时会重建选中分支的模型上下文、模型与思考等级；显式传入的模型覆盖保存的选择。没有可恢复模型时检查 `modelFallbackMessage`。

`SessionManager` 是已完成历史的权威来源。直接赋值 `session.agent.state.messages` 不会替换后续请求的持久化上下文；持久上下文变更通过 manager 的追加/编辑接口完成，再调用 `session.refreshContext()`。详见 [会话管理](12-session-manager.md)。

需要扩展启动 hooks 时在创建后显式 `await session.bindExtensions({})`；`createAgentSession` 不替调用者派发 startup。

# 场景：用 Faux Provider 做测试 (H03)

## 这是什么 / 不是什么

原生 `fauxProvider()` 返回带 `.provider` 的本地 handle，模拟 chat 事件流/usage/错误/deferred，而不是 HTTP 网络行为。Agent loop、工具执行和会话持久化仍是真实的；测试工具要使用临时 fixture，不能读假路径或宿主私密文件。

SDK 集成推荐 `runtime.registerNativeProvider(faux.provider)` 并同时传 runtime 和 faux.getModel()。只传 model 不会让默认 runtime 知道 provider/auth；native faux 的 auth resolve 返回 `{ auth: {} }`，无需 faux-key。

## 核心代码：四次 prompt，五个 scripted responses

第二次 prompt 的 toolUse 后会继续调用模型，所以需额外一条工具收尾响应。以下用实际临时 config、read 的 `path` 参数，并禁用 retry/compaction 来固定队列含义；测试代理负责运行断言。

```ts
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fauxProvider, fauxAssistantMessage, fauxToolCall, fauxText, fauxThinking, getCurrentTools, InMemoryCredentialStore } from "@earendil-works/pi-ai";
import { ModelRuntime, SessionManager, SettingsManager, DefaultResourceLoader, createAgentSession } from "@earendil-works/pi-coding-agent";

const cwd = await mkdtemp(join(tmpdir(), "pi-faux-"));
const configPath = join(cwd, "config.ts");
const faux = fauxProvider();
let session: Awaited<ReturnType<typeof createAgentSession>>["session"] | undefined;
let runtime: ModelRuntime | undefined;
try {
  await writeFile(configPath, "export const enabled = true;\n");
  runtime = await ModelRuntime.create({
    credentials: new InMemoryCredentialStore(), modelsPath: null,
    modelsStorePath: join(cwd, "models-store.json"), allowModelNetwork: false,
  });
  runtime.registerNativeProvider(faux.provider);
  faux.setResponses([
    fauxAssistantMessage("Hello"),                                       // prompt 1
    fauxAssistantMessage([fauxThinking("check config"), fauxText("Reading"),
      fauxToolCall("read", { path: configPath })], { stopReason: "toolUse" }), // prompt 2 call 1
    fauxAssistantMessage("Config checked"),                              // prompt 2 continuation
    (context, _options, state, model) => fauxAssistantMessage(
      `[${model.id}] call ${state.callCount}; tools ${getCurrentTools(context.messages)?.length ?? 0}`,
    ),                                                                  // prompt 3
    fauxAssistantMessage("", { stopReason: "error", errorMessage: "Scripted failure" }), // prompt 4
  ]);
  const settingsManager = SettingsManager.inMemory({
    retry: { enabled: false }, compaction: { enabled: false },
  });
  const loader = new DefaultResourceLoader({
    cwd, agentDir: join(cwd, "agent"), settingsManager,
    noExtensions: true, noSkills: true, noPromptTemplates: true, noContextFiles: true,
  });
  await loader.reload();
  ({ session } = await createAgentSession({
    cwd, model: faux.getModel(), modelRuntime: runtime,
    settingsManager, resourceLoader: loader,
    sessionManager: SessionManager.inMemory(cwd), tools: ["read"],
  }));
  await session.prompt("hi");
  await session.prompt("check config");
  await session.prompt("dynamic");
  await session.prompt("fail me");
  assert.equal(faux.state.callCount, 5);
  assert.equal(faux.getPendingResponseCount(), 0);
  assert.ok(session.state.messages.some((m) => m.role === "assistant" && m.stopReason === "error"));
} finally {
  session?.dispose();
  runtime?.unregisterProvider(faux.provider.id);
  await rm(cwd, { recursive: true, force: true });
}
```

原生 handle 没有 unregister()；清理 owning runtime 注册即可。若仅测试模型层，可用 runtime.completeSimple(model, Context) 消费最终消息或 runtime.streamSimple 返回的事件流；手工构造 UserMessage 必须包含 timestamp。

## compat 与 native handle

| 入口 | 返回 | 注册/清理 |
|------|------|-----------|
| public `fauxProvider()`（根或 providers/faux） | FauxProviderHandle，有 provider，无 unregister | runtime.registerNativeProvider(faux.provider) / runtime.unregisterProvider(id) |
| deprecated compat `registerFauxProvider()` | FauxProviderRegistration，无 provider，有 unregister | 全局 API registry 注册；unregister 只清理它，不清理 ModelRuntime |

不要把 compat handle 当成 native Provider。新 SDK 测试不必手动复制模型列表/伪造 auth。

## `RegisterFauxProviderOptions` 完整字段

源码：`packages/ai/src/providers/faux`

| 字段 | 类型 | 默认 | 含义 |
|------|------|------|------|
| `api` | `string` | `faux:<ts>:<rand>`（`randomId(DEFAULT_API)`，不传时；faux）。显式传 `api` 才固定为该值 | API 标识。**传自定义值时**：调 `registerFauxProvider({ api: "faux:test" })` 后，所有 message 的 `.api` 字段都会被改写成 `"faux:test"`（见 faux `cloneMessage`） |
| `provider` | `string` | `"faux"` | Provider 标识。和 `api` 一样会被改写到 message |
| `models` | `FauxModelDefinition[]` | 单模型 `faux-1` | 模型列表。第一个模型是 `getModel()` 的默认返回 |
| `tokensPerSecond` | `number` | `undefined`（即瞬时） | 流式速率。`<= 0` 或 `undefined` 都表示不延迟（faux）。**用于模拟真实流式时序** |
| `tokenSize` | `{ min?, max? }` | `{ min: 3, max: 5 }` | 每个 delta chunk 的 token 大小区间（字符数 = tokenSize × 4）。**只影响 delta 粒度，不影响总内容** |

### `FauxModelDefinition` 字段

源码：`packages/ai/src/providers/faux`

| 字段 | 类型 | 默认 | 含义 |
|------|------|------|------|
| `id` | `string` | **必填** | 模型 id（如 `"faux-fast"`） |
| `name` | `string?` | = `id` | 显示名 |
| `reasoning` | `boolean?` | `false` | 是否支持 thinking。**影响**：`streamWithDeltas` 不会因 reasoning false 拒发 thinking 块，但上层 Agent 会在 `thinkingLevel !== "off"` 时检查 model.reasoning 决定是否发 thinking 参数 |
| `input` | `("text"\|"image")[]?` | `["text", "image"]` | 支持的输入类型 |
| `cost` | `{ input, output, cacheRead, cacheWrite }?` | 全 0 | 单价（Faux 永远算 0 成本） |
| `contextWindow` | `number?` | `128000` | 上下文窗口 |
| `maxTokens` | `number?` | `16384` | 单次最大输出 |

## 工厂函数：动态生成响应

队列里除了 `AssistantMessage`，还可以放 **工厂函数**。源码：`packages/ai/src/providers/faux`

```ts
export type FauxResponseFactory = (
  context: TranscriptContext,
  options: SimpleStreamOptions | undefined,
  state: FauxProviderState,
  model: Model<string>,
) => AssistantMessage | Promise<AssistantMessage>;
```

| 参数 | 类型 | 含义 |
|------|------|------|
| `context` | `TranscriptContext` | 只有 messages；prompt/tools 在 system 消息中，用 getCurrentSystemPrompt/getCurrentTools 读取 |
| `options` | `SimpleStreamOptions \| undefined` | stream 调用选项，含 `sessionId`、`cacheRetention`、`signal`（abort）、`apiKey` 等 |
| `state` | `{ callCount: number }` | 调用计数器（**注意**：调用 factory 前 callCount 已经自增，所以首次 factory 收到的是 `callCount: 1`） |
| `model` | `Model<string>` | 当前请求的 model 实例（多模型时用于分支） |

**返回值**：`AssistantMessage` 或 `Promise<AssistantMessage>`（支持 async）。返回 Promise 时会 await，适合做异步上下文读取。

**常见用法**：

```ts
// 按 model.id 分支
faux.setResponses([
  (_ctx, _opt, _state, model) =>
    model.reasoning
      ? fauxAssistantMessage([fauxThinking("hmm..."), fauxText("ok")])
      : fauxAssistantMessage("ok"),
]);

// 异步读取数据库
faux.setResponses([
  async (ctx) => {
    const expected = await db.query("select ...");
    return fauxAssistantMessage(`expected: ${expected}`);
  },
]);

// 测试 abort
faux.setResponses([
  async (_ctx, opt) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (opt?.signal?.aborted) {
      return fauxAssistantMessage("aborted", { stopReason: "aborted", errorMessage: "aborted" });
    }
    return fauxAssistantMessage("done");
  },
]);
```

## 错误注入：3 种方式

### 方式 1：`stopReason: "error"` + `errorMessage`（构造错误 AssistantMessage）

```ts
faux.setResponses([
  fauxAssistantMessage("Simulated 500", {
    stopReason: "error",
    errorMessage: "Internal Server Error",
  }),
]);
```

**行为**（faux）：stream 会发 `{ type: "error", reason: "error", error: message }` 事件，然后 `stream.end(message)`。**注意**：内容 `"Simulated 500"` 仍然会被流式输出（走 text_start / text_delta / text_end），只是在末尾发 error 事件而不是 done。

### 方式 2：Factory 抛异常

```ts
faux.setResponses([
  (_ctx, _opt, _state, _model) => {
    throw new Error("boom");
  },
]);
```

**行为**（faux）：被 catch 捕获，发出 error 事件；error 字段仍是 AssistantMessage，errorMessage 才是异常文本。**和方式 1 区别**：不会流式输出任何 content（content 是空数组）。

### 方式 3：队列耗尽自动错误

不预设足够响应即可：

```ts
faux.setResponses([fauxAssistantMessage("only one")]);
await session.prompt("first");   // OK
await session.prompt("second");  // 最终 assistant errorMessage = "No more faux responses queued"，不要假设 prompt reject
```

**行为**（faux）：构造 `errorMessage: "No more faux responses queued"` 的 AssistantMessage，stopReason 为 "error"。

> **测试断言**：所有 3 种错误都让最终 `AssistantMessage.stopReason === "error"`、`errorMessage` 非空。差异在 stream 中途是否有 content delta。

## 流式模拟行为

Faux Provider 不创建真连接，但**模拟**流式时序，方便测试 UI delta 处理。

### `tokensPerSecond` 控制整体速率

```ts
const faux = fauxProvider({ tokensPerSecond: 10 });  // 慢速
```

- `undefined` 或 `<= 0`：每个 chunk 异步调度，几乎瞬时
- 正数：每个 chunk 延迟 `(tokens / tokensPerSecond) * 1000` ms（faux）

### `tokenSize` 控制 delta 粒度

```ts
const faux = fauxProvider({ tokenSize: { min: 1, max: 1 } });  // 每次只 1 token
```

输入文本被切成 `tokenSize * 4` 个字符的 chunk（faux），每个 chunk 之间按 `tokensPerSecond` 延迟。

### Abort 行为

streamWithDeltas 在每个 chunk 边界检查 `signal?.aborted`（faux、341-346 等）：

- **stream 开始前 abort**：发 `{ type: "error", reason: "aborted", error: abortedMessage }`，`content: []`
- **stream 中途 abort**：已发出的 delta 保留，后续不发；末尾发 `error` 事件，`stopReason: "aborted"`、`errorMessage: "Request was aborted"`

## Usage 估算：自动 + 可选 prompt cache 模拟

**自动估算**（faux）：每次响应都会算 usage，无需手动指定。

| 字段 | 算法 |
|------|------|
| `input` | `Math.ceil(serializeContext(context).length / 4)` |
| `output` | `Math.ceil(assistantContentToText(content).length / 4)` |
| `cacheRead` | 见下方 cache 逻辑 |
| `cacheWrite` | 见下方 cache 逻辑 |
| `totalTokens` | `input + output + cacheRead + cacheWrite` |
| `cost` | 永远全 0（faux） |

**Context 序列化**（faux）：`system:<prompt> + 每条 message + tools JSON`。具体见 `serializeContext`。

### Prompt cache 模拟（per sessionId）

如果 `options.sessionId` 存在且 `cacheRetention !== "none"`（faux）：

- **首次**：`cacheWrite = input tokens`、`cacheRead = 0`
- **后续**（相同 sessionId）：算与上次 prompt 的**公共前缀**长度，前缀部分计入 `cacheRead`，差异部分计入 `cacheWrite`、`input = promptTokens - cacheRead`
- **跨 sessionId**：不共享 cache（faux 查 `promptCache.get(sessionId)`）

> **测试断言**：`first.usage.cacheWrite > 0`、`second.usage.cacheRead > 0`、`crossSession.usage.cacheRead === 0`。源码测试：`packages/ai/test/faux-provider.test`。

## `FauxContentBlock` 类型限制

源码：`packages/ai/src/providers/faux`

```ts
export type FauxContentBlock = TextContent | ThinkingContent | ToolCall;
```

**不能放 ImageContent**——faux 的 `fauxAssistantMessage` 只接受上述 3 种 block。如果想测试 image 输入，要在 **user message** 那侧塞 image（context.messages[].content 支持 ImageContent），faux 的 `serializeContext` 会把 image 算成 `[image:mime:length]` 估算 token（faux）。

## `fauxAssistantMessage` 完整签名

源码：`packages/ai/src/providers/faux`

```ts
function fauxAssistantMessage(
  content: string | FauxContentBlock | FauxContentBlock[],
  options?: {
    stopReason?: AssistantMessage["stopReason"];  // 默认 "stop"
    errorMessage?: string;                        // 默认 undefined
    responseId?: string;                          // 默认 undefined
    timestamp?: number;                           // 默认 Date.now()
  },
): AssistantMessage;
```

**重要**：返回的 message 的 `api` / `provider` / `model` 字段是**占位**（`"faux"` / `"faux"` / `"faux-1"`，见 faux）。在 stream 流式时会被 `cloneMessage`（faux）**改写**为 `registerFauxProvider` 时传入的 `api` / `provider` / 当前 model id。所以测试时如果断言 `message.provider === "my-custom"`，要记得 `registerFauxProvider({ provider: "my-custom" })`。

## `AssistantMessageEvent` 协议（stream 事件类型）

Faux 发出的事件符合 `packages/ai/src/types` 的协议。完整 12 种：

| 事件 type | 何时发 | 关键字段 |
|-----------|-------|---------|
| `start` | stream 开始 | `partial: AssistantMessage`（content 空数组） |
| `text_start` | 文本块开始 | `contentIndex` / `partial` |
| `text_delta` | 文本块增量 | `delta: string` / `contentIndex` / `partial` |
| `text_end` | 文本块结束 | `contentIndex` / `content: string`（完整文本）/ `partial` |
| `thinking_start` | thinking 块开始 | `contentIndex` / `partial` |
| `thinking_delta` | thinking 块增量 | `contentIndex` / `delta: string` / `partial` |
| `thinking_end` | thinking 块结束 | `contentIndex` / `content: string`（完整文本）/ `partial` |
| `toolcall_start` | 工具调用开始 | `contentIndex` / `partial`（arguments 空对象） |
| `toolcall_delta` | 工具参数 JSON 增量 | `contentIndex` / `delta: string`（JSON 片段）/ `partial` |
| `toolcall_end` | 工具调用结束 | `contentIndex` / `toolCall: ToolCall`（完整对象）/ `partial` |
| `done` | 正常结束 | `reason: "stop" \| "length" \| "toolUse"` / `message` |
| `error` | 异常结束 | `reason: "aborted" \| "error"` / `error: AssistantMessage` |

> **`done` 和 `error` 是互斥终止事件**：每个 stream 必发其一，且是最后一个事件。

## 常见误期待与陷阱

- 每个工具调用后的 continuation 也消耗 scripted response；禁用 retry/compaction 后才按本例断言五次。
- state.callCount 不因 setResponses 重置；所有模型共享同一 provider 队列，可在 factory 按 model.id 分支。
- factory context 没有 .tools/.systemPrompt；操作 transcript helpers。
- error/abort/队列耗尽是 AssistantMessage 终止状态，不保证 session.prompt 抛异常。瞬态错误可触发重试；需要固定队列时关闭 retry。
- fauxAssistantMessage 的 content 只接受 text/thinking/toolCall；测试 image 放到 user content。
- 原生注册只替换模型层，read/bash 等真实工具仍执行；没有测试沙盒保证。
- tokensPerSecond 不提供同步完成保证；速率和队列行为需要 test agent 验证，本文不宣称已运行。

## 变体与延伸

- 接入真实自定义 Provider → [H02](H02-custom-provider.md)
- 完全手写 ResourceLoader / ModelRegistry → [H01](H01-full-control.md)
- 测试工具拦截扩展 → [场景 E01](E01-tool-intercept.md)
- Faux 完整源码 → `packages/ai/src/providers/faux.ts`
- Faux 官方测试用例 → `packages/ai/test/faux-provider.test.ts`（覆盖 cache / abort / 多模型 / 错误注入等）
- coding-agent 用 Faux 的真实测试 harness → `packages/coding-agent/test/suite/harness`

# 场景：中止正在运行的 Agent 对话 (F04)

## 目标

在 Agent 运行中（LLM 流式响应、工具执行、retry 等待、compaction 等场景）**主动中止当前操作**，并理解中止后的会话状态、能否恢复、与 dispose/steer 的区别。

## 什么时候用 / 不用会怎样

| 场景 | 用 abort | 不用的后果 |
|------|---------|-----------|
| 用户点了「停止」按钮 | ✅ 立即中止 LLM 调用 | 前端永久转圈，等到 LLM 自己 stop |
| Web/SSE 超时（LLM 挂住） | ✅ 配合应用层 timeout 触发 abort | socket 占用、内存泄漏、用户体验差 |
| 危险命令拦截（扩展层） | ⚠️ 配合 `ctx.abort()`，但**优先用返回值 block**（见下） | 危险命令可能已部分执行 |
| 切换会话（runtime.switchSession） | 用 runtime.switchSession（内部 abort→shutdown→dispose→重建） | session.dispose 不 emit 扩展 shutdown 事件 |
| 想插入一句话到当前对话 | ❌ 用 `session.steer()`（入队，不打断） | abort 不保证丢弃已有 partial/finalized 内容 |

**核心区别一句话**：`abort` 是「**打断当前进行中的 LLM 调用 / 工具执行 / retry 等待**」；`steer` 是「**等当前 turn 结束后把消息塞进下一轮**」；`dispose` 是「**会话整体下线、扩展清理、不再用**」。

## 涉及 SDK

| 能力 | 签名 | 用途 | 详细文档 |
|------|------|------|---------|
| `session.abort()` | `async abort(): Promise<void>` | 中止当前 Agent 操作并**等待 idle** | [sdk_doc/02-agent-session.md](../sdk_doc/02-agent-session.md) |
| `ctx.abort()` | `abort(): void`（同步） | 在扩展中中止当前操作（**不等待**） | [sdk_doc/07-extensions-api.md](../sdk_doc/07-extensions-api.md) |
| `session.subscribe()` | `subscribe(listener): unsubscribe` | 监听 abort 后的 `agent_end` 事件（**含 `willRetry` 字段**） | [sdk_doc/04-events.md](../sdk_doc/04-events.md) |
| `session.steer()` | `async steer(text, images?, options?): Promise<"queued" | "handled">` | 入队 steering 消息（**不打断**当前 turn） | [场景 F05](F05-steer-session.md) |
| `session.dispose()` | `dispose(): void`（同步） | 整体下线会话（**不 emit 扩展 session_shutdown**） | [sdk_doc/02-agent-session.md](../sdk_doc/02-agent-session.md) |
| `runtime.dispose()` | `async dispose(): Promise<void>` | 销毁运行时；替换用 new/switch/fork | [场景 F02](F02-session-runtime.md) |

## 核心机制

### 1. abort 是 async、内部 chain 三个动作


```ts
// 语义摘要，具体状态机以目标实现为准：
await session.abort(); // 请求取消 agent/retry/compaction/branch summary，然后等待 session idle

```

**必须 `await`**——不 await 时 agent 可能仍在 streaming，立刻调用 `session.prompt()` 会抛 `"Agent is already processing. Specify streamingBehavior ('steer' or 'followUp') to queue the message."`（`agent-session.ts:1161`）。

底层 `agent.abort()` 本身是同步的，只调 `abortController.abort()`；`session.abort()` 包了一层 `await waitForIdle()` 才是完整语义。

### 2. 中止不是无声终止——会触发 turn_end + agent_end（双路径）

中止走哪条路径取决于是否叠加了底层异常，两条路径都保证 `turn_end` 和 `agent_end` 会被 emit：

- **主路径（流式中止，不抛异常）**：abort 让 `streamAssistantResponse` 返回 `stopReason: "aborted"`，agent-loop 检测到后**不抛错**，直接 emit `turn_end → agent_end` 正常返回（`agent-loop.ts:196-199`）。这是最常见的情况。
- **兜底路径（abort 叠加底层异常）**：如果 abort 同时触发了底层异常（如网络中断叠 abort），`runWithLifecycle` 的 catch 捕获后由 `handleRunFailure` 包装为 `stopReason: "aborted"` 的失败 assistant message，emit `message_start → message_end → turn_end → agent_end`（`agent.ts:507-523`）。

**两条路径 subscribe 监听器都会收到 `turn_end` + `agent_end`**，UI 可以据此显示"已中止"气泡。

### 3. 中止后会话状态保留、可以继续 prompt

- **消息上下文保留**：abort 不清空 `agent.state.messages`，已完成的 turn 仍可被下一轮 LLM 看到
- **streaming 状态归位**：`finishRun()` 在 finally 中执行，`isStreaming = false`
- **可以继续 prompt**：abort resolve 后 `session.prompt(...)` 可正常调用

### 机制 4：agent_settled vs agent_end

`agent_end` 在 retry 场景下会提前触发（`willRetry: true` 时表示 Agent 还会自动重试），此时 Agent **尚未完全稳定**。`agent_settled` 只在所有 retry / compaction / steer 队列全部消费完毕后才派发（两层都派发），是 abort 后 Agent 完全稳定的**可靠信号**。如果需要在 abort 后确保 Agent 不再有任何后续动作（如读取最终 messages、安全关闭资源），优先监听 `agent_settled` 而非 `agent_end`。

## 核心代码

```ts
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession({ sessionManager: SessionManager.inMemory() });
let aborted = false;
const unsubscribe = session.subscribe((event) => {
  if (event.type === "agent_settled") aborted = event.aborted;
});
const timer = setTimeout(() => {
  void session.abort().catch((error) => console.error("abort failed", error));
}, 300_000); // 宿主总时长策略，不是模型/工具保证
try {
  await session.prompt("分析代码库");
  console.log(aborted ? "已中止" : "已稳定（还需检查最终 assistant error）");
} catch (error) {
  console.error("prompt failed", error);
} finally {
  clearTimeout(timer);
  unsubscribe();
  session.dispose();
}
```

timer/监听器由宿主拥有，异常必须处理；finally 只在 prompt settle 后执行。工具忽略 signal 时，abort 也可能等待很久，不能承诺即时杀死任意宿主工作。

## 扩展中用 ctx.abort()


```ts
interface ExtensionContext {
  signal: AbortSignal | undefined; // 当前 run 的 signal（不在 streaming 时为 undefined）
  abort(): void;                   // 同步——不等待完成
  // ...
}
```

**陷阱：ctx.abort() 是同步的，不会等待 agent 真正停下**。它的实现分两条路径（`agent-session.ts:2415-2421`）：

- **SDK 直用场景**（无宿主 abortHandler）→ `void this.abort()` 即 fire-and-forget 调用**完整的 `session.abort()`**（abortRetry + agent.abort + waitForIdle 三件套），不是只触发 signal。`void` 让它"不等待"，但工作量与 `session.abort()` 等同。
- **TUI 等宿主场景**（宿主设置了 `_extensionAbortHandler`）→ 调用宿主 handler（如 TUI 的 `restoreQueuedMessagesToEditor`），不直接走 session.abort。

如果你在 tool_call 拦截里 `ctx.abort()` 然后继续做事，SDK 直用场景下 session.abort 已经被 fire-and-forget 触发（含 waitForIdle），但你当前代码不会等待它完成——agent 仍可能在 streaming。

### 用返回值拦截优先于 abort

```ts
export default (pi) => {
  pi.on("tool_call", (event, ctx) => {
    if (event.toolName === "bash" && (event.input as any).command.includes("rm -rf")) {
      // ★ 优先用返回值 block——立即生效，工具不会被调用
      return { block: true, reason: "危险命令" };
    }
    // 真的要中止整个 Agent（而不只是拦一个工具）才用 ctx.abort()
    // ctx.abort(); // 同步触发中止，但当前事件循环不会等待 agent 真正停下
  });
};
```

详见 [场景 E01](E01-tool-intercept.md)。

## dispose vs abort：什么时候用哪个

| 维度 | `session.abort()` | `session.dispose()` | `runtime.dispose()` |
|------|-------------------|--------------------|--------------------|
| 签名 | `async`（需 await） | **同步**（void） | `async`（需 await） |
| 目的 | 中止当前操作，**保留会话**继续用 | 整体下线会话，**不再用** | 切换会话时用——先 emit shutdown 再 dispose |
| 触发扩展 `session_shutdown` 事件 | ❌ | ❌ | ✅（await emit） |
| 内部动作 | abortRetry + agent.abort + waitForIdle | abortRetry + abortCompaction + abortBranchSummary + abortBash + agent.abort + invalidate 扩展 + 清理订阅 + cleanupSessionResources | await emitSessionShutdownEvent → beforeSessionInvalidate → session.dispose() |
| 之后能否 `session.prompt()` | ✅ | ❌（已下线） | ❌（session 已 dispose，要用新 session） |

源码：
- `session.dispose()` 同步实现
- `runtime.dispose()` async 实现

模型发起的 bash tool 使用 agent signal，abort 可取消它（取决于执行实现的 signal 响应）。直接 `session.executeBash()` 使用独立取消控制，停止它用 `session.abortBash()`；不要因 abort 没调用 abortBash 就推断所有 bash 都不停，也不要推荐 dispose 代替停止按钮。

**横向提示（F02 发现）**：`runtime.dispose()` 内部 chain 是 `await emit session_shutdown → beforeSessionInvalidate → session.dispose()`——await emit 确保扩展先收到 shutdown，但 session.dispose 内部的 invalidate + cleanup 是同步的。**整个 chain 不是原子的**：如果 emit 或 beforeSessionInvalidate 抛异常，session.dispose 不会执行。

## abort 与 retry 的关系

SDK 有**自动重试**机制（retry settings.enabled + maxRetries + baseDelayMs 指数退避）。当 LLM 返回 retryable error（overloaded / rate limit / 5xx）时：

1. agent_end 事件触发，subscribe 收到的 `willRetry: true`
2. SDK 进入 `await sleep(delayMs, retryAbortController.signal)` 等 backoff
3. backoff 结束后自动 `agent.continue()` 再试

`session.abort()` 内部先调 `abortRetry()`，**会取消 retry 等待**——之后 `willRetry: true` 的语义就失效了。

如果你想**只取消 retry 但不打断当前 LLM 调用**——`abortRetry()` 是公开方法，但它只中断 retry sleep、**不动 agent.abort**；它不暴露在 session 顶层常用接口里（需要从 session 实例上调）。实务上要"只取消 retry 不动 LLM"可以单独调 `abortRetry()`，但要注意它不会让当前 LLM 调用停下，retry 取消后也不会自动续跑。

> `abortRetry()` 中断 retry sleep 后，`_prepareRetry` 的 sleep catch 块会 emit `auto_retry_end`（success: false, finalError: "Retry cancelled"），让 UI 能清理 retry 状态显示。严格说是 `_prepareRetry` 内 catch emit（`agent-session.ts:2713-2723`）而非 `abortRetry` 本身 emit，但因果链（abortRetry → signal abort → sleep 抛 → catch emit）成立。

## 常见误期待与陷阱

1. **「session.abort() 是同步的」**——错。底层 `agent.abort()` 同步，但 `session.abort()` 包了 `await waitForIdle()`，整体 async。不 await 立刻调 `prompt()` 会抛 `"Agent is already processing. Specify streamingBehavior ('steer' or 'followUp') to queue the message."`（`agent-session.ts:1161`）。
2. **「abort 会让 prompt() 抛异常」**——错。通常 abort 后 prompt resolve；仍需 catch 前置/宿主异常，并用 settled.aborted / stopReason 分类。
3. **「subscribe 的 agent_end 没有 willRetry」**——错。subscribe 层的 agent_end **有** willRetry 字段；**扩展层 `pi.on("agent_end")` 的 AgentEndEvent 没有**——两视角混说会踩坑。
4. **「ctx.abort() 之后立刻做事是安全的」**——不一定。SDK 直用场景下 ctx.abort 会 fire-and-forget 触发完整的 session.abort（含 waitForIdle），但当前同步代码不会等待它完成，agent 仍在 streaming；如果在扩展里调完 ctx.abort 还要做"清理 + 返回值"，**返回值的处理优先于 abort 完成时机**，但不要假设 agent 已停下。
5. **「dispose 会自动 emit 扩展 session_shutdown」**——错。`session.dispose()` 同步、**不** emit；只有 `runtime.dispose()` 才 await emit shutdown。**用错会让扩展的 shutdown 处理器（清理资源、保存状态）不触发**。
6. **「abort 清空 messages」**——错。abort 不调 `reset()`，messages 完整保留；下一轮 prompt 可以接着上下文继续。
7. **「setTimeout 回调里 `await session.abort()` 能工作」**——语法错误。setTimeout 普通回调不是 async 函数，await 会报语法错；要么用 `async () => { ... }` 箭头，要么不 await（如果不在乎完成时机）。

## 变体与延伸

- **steer 与 abort 的不同语义** → 见 [场景 F05](F05-steer-session.md)
- **通过 RPC 模式中止**（RPC 专属，本 skill 不展开）
- **扩展中拦截工具调用**（优先用返回值 block，不要急着 abort） → 见 [场景 E01](E01-tool-intercept.md)
- **Web/SSE 集成的超时设计**（防 LLM 挂住）→ 见下方「超时设计」节

## 超时设计（Web/SSE 集成必读）

`session.abort()` 是即时操作，但**什么时候该调用**是集成方的责任。pi-agent SDK 高层入口（`createAgentSession`）的 `CreateAgentSessionOptions` **没有 `timeoutMs` 字段**——但内部 `streamFn` 会从 SettingsManager 合并 timeout：`httpIdleTimeoutMs`（通过 `settings.httpIdleTimeoutMs` 配置）和 `retry.provider.timeoutMs`（通过 `settings.retry.provider.timeoutMs` 配置）。这些属于 transport/provider 请求策略；不应声称只检测 TCP 或不能检测停滞 body。Web/SSE 集成仍建议在**应用层**实现双层 timeout（见下方推荐设计）。

### 宿主超时策略

不依赖 finally 终止 pending Promise。应用可配置总时长上限，断开时请求取消。无事件超时只是启发式：合法的静默工具/重试 backoff/UI 等待也可能长时间不发事件。provider transport 是否检测 body 停滞必须查具体实现，不能凭 HTTP 200 推断永久挂住。

### 推荐设计：双层 timeout + abort 后处理

| 层 | 计时器 | 触发条件 | 作用 |
|----|--------|---------|------|
| 空闲超时 | `idleTimer` | 每次 pi-agent 事件到达都 refresh；N 秒（示例 30s，按工具/UI 策略配置）无事件 | 启发式监测无事件，可能误杀静默任务 |
| 硬上限 | `hardTimer` | 总时长到达上限（默认 5min） | 兜底防失控（事件持续触发但 Agent 实际没进展） |

关键实现要点：

1. **refresh 时机**：在 `session.subscribe` 回调**开头**调 `refreshIdleTimer()`。任何事件（`turn_start` / `message_update` / `tool_execution_start` / `agent_end` 等）都算"活动信号"。
2. **双层独立**：`hardTimer` 不 refresh，是总时长兜底；`idleTimer` 每事件 refresh。
3. **abort 后的两个动作**：
   - **发 error 而非 done**：finally 分支根据 `abortReason` 发 `error` 事件，让前端展示"超时"提示而不是无声结束。
   - **不重复打断**：`abortFired` 标志 + `doneSent`/`res.writableEnded` 检查，避免 timeout 和 req.close 先后到时重复 abort。
4. **配置化**：`CHAT_IDLE_TIMEOUT_MS` / `CHAT_HARD_TIMEOUT_MS` 通过环境变量暴露，默认值写代码里。

### 总时长与无事件上限取舍

```ts
// ❌ 反例：120s 单一总时长
setTimeout(() => fireAbort(), 120_000);
```

取舍：
- **太慢**：挂住场景要等满 120s 才发现
- **误杀**：多轮工具调用（8+ 轮）正常情况也可能超过 120s

### 参考实现

参考实现：单文件含完整双层 timeout + error 反馈。

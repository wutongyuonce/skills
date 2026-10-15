# 多 Agent：由宿主协调独立会话

Pi SDK 没有通用多 Agent 调度参数。选择：同进程的多个 `AgentSession`、工具中创建子会话、官方 subagent 示例的独立 CLI 进程，或 `AgentSessionRuntime` 的会话替换。它们不是相同的隔离/生命周期机制。

## 独立会话并行

下面只隔离对话历史，不隔离工作区文件、环境或默认认证。生产多租户还需独立 cwd、agentDir、ModelRuntime 认证/目录存储及进程权限。

```ts
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

const cwd = process.cwd();
const { session: reviewer } = await createAgentSession({
  cwd, sessionManager: SessionManager.inMemory(cwd), tools: ["read", "grep", "find", "ls"],
});
let implementer: typeof reviewer | undefined;
try {
  ({ session: implementer } = await createAgentSession({
    cwd, sessionManager: SessionManager.inMemory(cwd),
  }));
  const results = await Promise.allSettled([
    reviewer.prompt("检查实现风险，不修改文件"),
    implementer.prompt("解释当前项目入口，不修改文件"),
  ]);
  for (const result of results) if (result.status === "rejected") throw result.reason;
  console.log(reviewer.getLastAssistantText(), implementer.getLastAssistantText());
} finally {
  await Promise.allSettled([reviewer.abort(), ...(implementer ? [implementer.abort()] : [])]);
  reviewer.dispose();
  implementer?.dispose();
}
```

`prompt` 解决不代表模型业务成功；需要检查最后的 assistant `stopReason`（error/aborted）与任务输出。宿主决定失败时停止其余任务、继续收集还是重试，SDK 不替它选择。

## 同进程工具委派

工具的 `execute` 第五参是 `ExtensionToolContext`。需要子会话时：

1. 由宿主显式提供合适的 ModelRuntime；传 `ctx.model` 只传模型值，不复制父会话认证、runtime API key、动态 Provider 或 loader。
2. 用独立 inMemory manager；child loader 禁用发现当前委派扩展，避免递归注册/调用自身。
3. 调用 child loader.reload；需要启动 hook 时 bindExtensions。
4. 将 caller signal 的取消转为 child.abort，捕获异步 abort 错误；等待 prompt/abort，最后 dispose 并移除 listener。
5. 从已完成的 assistant 消息取结果，区分 error/aborted；需要成本汇总时按目标工具 result usage 类型返回子调用使用量。

控制并发、输出、时限是宿主的职责。不要把省略错误处理的 toy delegate 当成生产调度器。工具声明和嵌套调用见 [06-tools](../sdk_doc/06-tools.md)。

## 消息与结束协调

- 变量是 `AgentSession` 时直接用 `session.steer()` / `followUp()`，不是 `session.session.*`。
- steer 不取消当前流；在当前 turn 工具完成后投递。followUp 等当前 run 的待处理工作结束。两者经过 input hooks，返回 queued/handled。
- 队列模式用 `setSteeringMode` / `setFollowUpMode`，不是赋值只读 getter。
- 宿主使用 `session.subscribe(event => ...)`；扩展使用 `pi.on`。前者不是全部 hook 的通用 Event Bus。
- 协调一个拥有的 prompt 可以等待 `prompt()`；观察自动继续是否结束用 `agent_settled` 并检查 `aborted`。它不携带最终答案，答案从会话读。
- 避免 setTimeout 猜测“另一个 Agent 已完成”。以生命周期/任务 Promise 驱动依赖。

## Handoff、fork 与 runtime

Handoff 是生成新任务指令并开新会话，不是自动复制所有历史。要摘要当前有效上下文，用 manager 的 canonical projection，再通过配置的 `ctx.modelRegistry.complete` 调用模型，避免自己重算鉴权或只筛 raw message 条目。

普通扩展在 `pi` 上发消息；普通 `ctx` 不是发送 API。command context 可 newSession；替换后使用 `withSession` 的 fresh context，旧 context 已失效。TUI editor 工作流需检查 mode/model、编辑取消、模型失败和新建取消；RPC 有 UI 不等于拥有全部终端组件。

持久化 fork **创建新会话文件与 ID**，复制选中路径并记录 parentSession；同文件分支导航是 tree 操作。inMemory fork 不写文件。runtime 替换后重绑订阅，清理使用异步 runtime.dispose，而 session.dispose 是同步接口。详见 [F02](F02-session-runtime.md)。

## 独立子进程

官方示例见 [I05](I05-subagent.md)。它不是 OS 沙箱；启动命令、模型/工具继承、确认和资源上限按示例实现核对。完整低层权威见目标包 `docs/sdk.md`、`dist/core/{agent-session,agent-session-runtime,session-manager}.d.ts` 和 `examples/extensions/handoff.ts`。

# 多会话协调的 SDK 边界

SDK 提供会话、工具、扩展和 runtime，不提供一个 `subagent` / `multiAgent` 创建选项。可工作的组装、错误处理和隔离区别见 [H06](../scenarios/H06-multi-agent.md)；进程调度示例见 [I05](../scenarios/I05-subagent.md)。

## 状态所有权

每个 AgentSession 有自己的历史、队列、工具激活和订阅；同一进程的模块、环境与工作区不隔离。默认独立 ModelRuntime 仍可读写同一份 agentDir 认证/配置文件。共享运行时只有宿主显式传相同实例时才共享动态 Provider 注册。

不同会话不能并发编辑同一个 SessionManager / 会话文件。需要协作时由宿主路由消息、结果和任务状态，而不是共享可变历史数组。

## 发送与投递

| 层 | API |
|---|---|
| AgentSession | prompt / steer / followUp / sendUserMessage / sendCustomMessage |
| ExtensionAPI（pi） | sendMessage / sendUserMessage |
| 普通 ExtensionContext | 不提供普通发送方法 |
| runtime 替换后的 fresh context | 可在 withSession 回调中使用其声明的发送方法 |

steer 在当前 assistant turn 和工具完成后投递；followUp 在待处理工作结束后投递，都不是流取消操作。input hook 可转换或消费，返回 queued/handled。取消用 abort。

`session.subscribe` 观察外部生命周期，`pi.on` 提供扩展 hooks；两者集合不同。`agent_settled.aborted` 区分取消；模型业务成功仍需检查完成消息及结果。详见 [事件](04-events.md)。

## 会话替换

AgentSessionRuntime 的 newSession / switchSession / fork / importFromJsonl 替换 active session。替换后旧订阅和 context 失效；使用 setRebindSession 重绑，command withSession 得到 fresh context。宿主自定义 factory 必须返回 services、session、diagnostics 等完整结果，见 [runtime API](03-agent-session-runtime.md)。

清理顺序涉及等待 abort、派发 session_shutdown、before-invalidate 和 session.dispose；runtime.dispose 是异步，不能用同步 session.dispose 代替整个 runtime 生命周期。

持久化 fork 写**新文件**与新 ID，并记录 parentSession。inMemory fork 重建内存 manager；同一文件内选择分支使用 tree/navigation。不要把 fork 和 tree 混为一谈。

## 上下文与摘要

`ctx.sessionManager.getBranch()` 返回 SessionEntry，不是 AgentMessage[]。摘要当前模型历史应使用 manager 的 buildSessionContext/buildSessionProjection，而非只筛 message 条目（会漏 context_edit、branchSummary、customMessage 和压缩效果）。

调用摘要模型优先 `ctx.modelRegistry.complete` / streamSimple，由配置运行时解析鉴权、headers、baseUrl；不要重复手工 getApiKeyAndHeaders 后丢掉部分鉴权结果。自动后台 appendEntry 在替换/销毁后可能写错会话，持久上下文修改使用拥有生命周期的操作或 actionable boundary。

## 资源范围

并行数、输出量、deadline、任务 DAG、重试策略、子进程强制终止均由 host/示例规定，不是 SDK 的全局保证。官方 subagent 的 8任务/4并发/parallel摘要限额只属于该示例；其 details/消息缓冲并不因此有硬上限。

证据：目标包公开声明与 `docs/sdk.md`、`docs/extensions.md`、`examples/extensions/{handoff.ts,subagent/}`。

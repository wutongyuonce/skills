# 子 Agent 调度：官方示例扩展

## 能力来源

`subagent` 来自目标包的 `examples/extensions/subagent/`，不是 `createAgentSession` 内置参数，也不是默认已注册工具。复制整个示例目录（至少 `index.ts` 和 `agents.ts`）后显式加载；单独设置 `tools: ["subagent"]` 不会注册它。

SDK 应通过 `DefaultResourceLoader` 加载并调用 `reload()`、`session.bindExtensions({})`，见 [A06](A06-load-extensions.md)。子进程调度与同进程会话组装的区别见 [H06](H06-multi-agent.md)。

## Agent 定义与发现

示例使用 Markdown frontmatter：

````markdown
---
name: scout
description: Inspect a repository before implementation
tools: [read, grep, find, ls]
---
Read the requested area and report exact file paths. Do not change files.
````

- `name` / `description` 必须是字符串。正文可为空；空正文不添加 system prompt。
- `tools` 支持逗号分隔字符串或 YAML 数组；非字符串项被忽略。省略时由子 CLI 的默认配置决定工具，不继承父会话的 active tool set。
- `model` 可选。省略时传递父会话当前 provider/model 和 thinking level；自己指定 model 时不继承父 thinking。
- 用户 agent 目录通过 `getAgentDir()` 定位，可被环境配置覆盖。
- 项目 agent 从 `ctx.cwd` 向文件系统根查找最近一个 `.pi/agents`，不合并全部祖先，也不按 git 根停止。`params.cwd` / `task.cwd` 只改变子进程工作目录，不改变发现起点。
- `agentScope` 支持 user/project/both；both 下项目同名定义替换用户定义，不合并字段。

## 三种执行方式与实际限额

工具参数一次只能选择一个非空模式：单个任务、parallel、chain。

| 模式 | 行为 |
|---|---|
| 单个 | 运行一个命名 agent |
| parallel | 最多 8 个任务、并发最多 4；合并每个任务的摘要 |
| chain | 按序运行，替换每个 `{previous}`，首个 previous 为空；返回的失败结果会停止后续链 |

这些是示例常量，**不是 SDK 保证**。50 KiB 限额仅用于 parallel 每项的输出摘要；不限制收集的消息、stderr、details，也不约束单个/chain 的最终输出。需要硬资源上限的服务，应另外约束进程、时间、输出和并发。

子进程使用 `--no-session`，收到独立任务和所选 agent 的指令，不复制父历史。它仍可能共享 cwd、文件、配置、凭据和环境，进程分离不等于安全沙箱。

## 启动、确认和取消边界

- 示例 `getPiInvocation()` 在可用时重新执行当前入口。对 Pi CLI 入口成立；任意 SDK host 脚本可能被重新启动为 host，而不是 Pi，tsx 的 loader 参数也不自动复制。自定义宿主应明确选定 Pi CLI 可执行文件/入口。
- 项目 agent 的额外确认要求：请求确实使用项目定义、项目尚未可信、开启 `confirmProjectAgents` 且 `ctx.hasUI` 可用。可信项目跳过此额外确认。
- RPC 可以提供 UI，不能把 RPC 一概视为 `hasUI=false`；print/json 默认无 UI。无 UI 或 LLM 传 `confirmProjectAgents:false` 时不会确认。这是示例交互，不是不可绕过的安全策略。
- Abort 尝试结束子进程，并可能抛出异常；parallel 的 Promise.all 也可能因异常拒绝，不能保证所有失败都返回独立结构化结果。
- 上游示例的 SIGKILL 后备判断使用 `proc.killed`（表示发过信号，不等于已退出），因此不保证顽固进程必被终止。生产 host 应掌握进程退出和资源回收。
- 无效参数的部分分支只返回解释文本，没有 `isError:true`。不要仅靠该字段分类所有失败。

## 输出集成

当前 JSON 模式的完成消息是 `message_end`，工具执行结束是 `tool_execution_end`。示例中的 `tool_result_end` 分支是兼容处理，不是当前标准事件。

上游 `getFinalOutput()` 从后往前找 assistant 的第一个 text block，不保证拼接整条最后回复；若需要完整文本，自己的适配器应合并文本块。流式响应须区分子进程退出、assistant error/aborted 和正常输出。

示例文件和任务常量可能随版本变化，更新时完整核对 `examples/extensions/subagent/{README.md,agents.ts,index.ts}`，而不是把本页限额视为永久协议。

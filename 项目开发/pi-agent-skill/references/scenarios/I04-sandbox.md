# 安全隔离：区分整个 Pi、工具路由与脚本 VM

Pi 扩展是宿主进程加载的代码；内置工具、第三方工具和 shell 使用进程的 OS 权限。项目 trust 是资源加载的确认门，不是写文件/执行命令的权限沙箱。不要在不可信扩展上依赖 `autoload`、工具名称或 trust 代替进程隔离。

## 选择边界

| 方式 | 隔离对象 | 必须核对 |
|---|---|---|
| Plain Docker | 整个 Pi 进程 | 挂载、网络、用户权限；传入的 API key 在容器中 |
| Docker Sandboxes | 管理式整个进程沙箱 | host-held credentials/proxy 配置与允许的网络 |
| OpenShell | 整个进程的沙箱环境 | gateway、挂载、凭据和网络策略 |
| Gondolin 示例扩展 | 指定内置工具与用户 shell 路由到 micro-VM | 未路由的自定义工具仍在 host；环境凭据可能进入 guest |
| Codemode | QuickJS 中的 JavaScript 脚本 | 被调用的工具仍在 host/其各自环境，VM 不限制其 OS 权限 |

要运行来源不明的扩展，隔离**整个 Pi 进程**或先人工审查；只隔离 bash 不能阻止扩展直接读文件、发网络请求或运行子进程。

## Gondolin 的凭据边界

Pi 和文件存储的认证可以留在 host，但被路由的 shell 收到宿主命令环境。环境变量里的 Provider API key 因而可能暴露给 guest；自定义扩展工具也仍在 host，除非单独路由。不能据此声称默认“API key 永远留在 host”或比 Docker 必然更安全。

目标证据：`docs/containerization.md` 的 Gondolin 部分、`examples/extensions/gondolin/index.ts` 的 `sanitizeEnv` / `vm.exec`。

## 官方 sandbox 示例不等于 fail-closed 安全策略

`examples/extensions/sandbox/index.ts` 只覆盖 `bash` 与 `user_bash`，不覆盖 read/write/edit 等文件工具。初始化失败会通知并退回本地执行；关闭、平台不支持时也可能直接本地运行。它不能直接作为不可信工作负载的 fail-closed 权限边界。

其项目 `sandbox.json` 是示例自己读取的配置，不应假设核心 trust 会自动对所有这类读取加门。网络/文件系统配置是浅层合并、数组替换，不是任意深层安全策略合并。

## 整个进程隔离

只挂载必要工作区；敏感目录不挂载，必要只读目录使用 `:ro`。单独使用容器 agentDir，避免把真实 `~/.pi/agent`、SSH、云凭据或全部 home 暴露进去。网络出口及 API key 暴露取决于实际配置。

可固定 SDK 发布版构建镜像：

```dockerfile
FROM node:24
RUN npm install -g @earendil-works/pi-coding-agent@1.2.0
WORKDIR /workspace
ENTRYPOINT ["pi"]
```

这是构建片段，不是已验收的容器策略；用户、挂载和网络还须配置。Docker Sandboxes 的官方调用示意：

```bash
sbx secret set anthropic
sbx run --kit "docker.io/sbx/pi-kit:latest" pi
```

不要在该沙箱里另行登录泄露 host credentials；这些外部工具与镜像需根据自己的部署要求审核，本次 SDK 维护未执行它们。

## 第三方包审查与加载控制

`pi -e npm:<包>` 只是不写配置，仍下载、安装和执行；不是安全试运行。`pi list` 列出配置包，不是源码审计器。审查安装目录、manifest、依赖安装脚本、扩展入口及其文件/网络操作。

`autoload:false` 与资源 filters 只决定加载哪些资源；加载扩展后它仍用进程权限。继承包的 delta 中空数组不禁用继承资源，详见 [包 API](../sdk_doc/20-pi-package.md)。

不可信项目还可能通过始终加载的 context files 或初始 sessionDir 读取影响行为；拒绝 project trust 不能保证完全不读项目内容。subagent 的 `.pi/agents` 是示例自己的约定，确认机制另见 [I05](I05-subagent.md)。

## 同版本材料

核对目标安装包 `docs/security.md`、`docs/containerization.md`（部分分发在包根 `containerization.md`）、相关扩展示例与 `docs/codemode.md`。配置字段和示例内部行为以同版本源码为准。

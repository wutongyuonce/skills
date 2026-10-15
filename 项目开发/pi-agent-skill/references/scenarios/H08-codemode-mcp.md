# 在 SDK 中启用 Codemode、工具搜索和 MCP

## 适用场景

让模型用 JavaScript 批量调用已有工具，或连接 MCP 服务。CLI 会加载内置扩展；SDK 不会自动加载，必须自己组装。

## 组装

以下示例使用标准资源发现；会读取全局配置和可信项目配置。Web 服务应改用租户隔离的 `cwd`、`agentDir`、认证与 MCP 配置。

```ts
import {
  createAgentSession,
  createCodemodeExtension,
  createMcpExtension,
  createToolSearchExtension,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

const cwd = process.cwd();
const agentDir = getAgentDir();
const resourceLoader = new DefaultResourceLoader({
  cwd,
  agentDir,
  extensionFactories: [
    createCodemodeExtension({ mode: "on" }),
    createToolSearchExtension(),
    createMcpExtension(),
  ],
});
await resourceLoader.reload();

const settingsManager = SettingsManager.create(cwd, agentDir);
settingsManager.applyOverrides({ defaultTools: ["+codemode", "+tool_search"] });
const { session } = await createAgentSession({
  cwd,
  agentDir,
  resourceLoader,
  settingsManager,
  sessionManager: SessionManager.inMemory(cwd),
});
try {
  // session_start 才会启动 MCP 连接。只有 reload / createAgentSession 不够。
  await session.bindExtensions({});
  await session.prompt("用 codemode 列出当前目录的文件，并汇总数量。");
} finally {
  session.dispose();
}
```

只需要 Codemode 时，省略 MCP factory；只需要搜索时，按需保留 tool-search。`codemode` 与 `tool_search` 注册时默认不激活，用 `defaultTools` 添加不会把其他工具变成白名单；显式 `tools` 则涉及会话工具过滤，详见 [工具白名单](A04-tool-whitelist.md)。

## 运行边界

- Codemode 的输入是原始 JavaScript，运行在 QuickJS 中，没有 Node API、文件系统、网络或计时器；这些能力只能通过被允许的工具获得。
- 调用工具仍会执行真实操作。脚本失败不撤销已经执行的操作；脚本结束会取消仍在运行的调用。
- `tools.bash()` 等有 output schema 的工具可能在失败时返回结构化值，必须检查 `exit_code` / `isError` 等业务结果，不能把 Promise fulfilled 当成功。
- `text()` 输出文本；`image()` 输出并保存图片。`store/load` 只保存小型 JSON 状态，成功脚本的状态写入当前会话分支，可恢复。
- MCP 默认 `codemode` exposure 按需发现，不等于把所有工具都声明给模型。脚本用 `searchTools()`、`describeTool()`、`describeNamespace()` 查工具；`direct` 和 `deferred` 的选择影响工具是否直接暴露或由 tool-search 加载。
- `models.classify()` 和 `models.generateImages()` 使用会话的认证，返回值必须检查 `stopReason` / `errorMessage`。模型目录按 chat/image/classifier 分开；详见 [模型运行时](../sdk_doc/05-auth-model-registry.md)。

QuickJS 隔离的是脚本运行环境，**不是宿主工具的安全沙箱**。MCP stdio 服务器和扩展在宿主权限下运行；为不可信项目提供隔离进程、允许列表与租户资源隔离，不能只依赖 Codemode。

## 官方资料入口

以目标安装包为准：

- `examples/sdk/14-codemode-mcp.ts`
- `docs/sdk.md#codemode-mcp`
- `docs/codemode.md`
- `docs/mcp.md`
- `docs/extensions.md` 的 Tool exposure / Nested tool calls

完整字段与限制直接查目标包文档，避免把持续变化的 MCP 配置和 Codemode 限额复制到场景中。

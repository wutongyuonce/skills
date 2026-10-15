# 场景：工具白名单 (A04)

## 目标

限制 Agent 可用的工具集，例如只允许只读工具，禁用写入类工具。

> **默认行为**：使用 settings.defaultTools，未配置时 read/bash/edit/write；不是启用所有内置工具。patterns、modifier-only、MCP 保留例外统一见 [工具规则](../sdk_doc/06-tools.md#工具选择规则120-权威表)。

## 涉及 SDK

| 能力 | 用途 | 详细文档 |
|------|------|---------|
| `createAgentSession` 的 `tools` 选项 | 传入工具名数组，patterns allowlist 或 modifier-only；注意 MCP 保留例外 | [sdk_doc/06-tools.md](../sdk_doc/06-tools.md) |
| `createAgentSession` 的 `excludeTools` 选项 | 黑名单模式：禁用指定工具（在 `tools` 之后生效） | [sdk_doc/06-tools.md](../sdk_doc/06-tools.md) |
| `createAgentSession` 的 `noTools` 选项 | 快速禁用全部或仅内置工具（`"all"` / `"builtin"`） | [sdk_doc/06-tools.md](../sdk_doc/06-tools.md) |
| 内置工具名（含 PowerShell） | `read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`、`powershell` | [sdk_doc/06-tools.md](../sdk_doc/06-tools.md) |

## 实现思路

1. 用 plain allowlist 选择名称/pattern；仅 +/- 的列表用于默认选择增减，不能混用
2. 如果只想禁用个别工具而非全部重列，用 `excludeTools: ["bash"]` 更简洁
3. 如果完全不想要工具，用 `noTools: "all"` 比 `tools: []` 更语义化

**重要**：非空 allowlist 默认保留 MCP 注册供 codemode/tool search；需显式 mcp__ patterns 收紧，或 tools:[] 全禁。白名单不提供文件系统/网络隔离。

**安全考量**：在生产环境或对外暴露的 Agent 中，建议始终设置 `tools` 白名单，避免 Agent 执行 `write`、`bash` 等危险操作。

## 核心代码

```ts
import { createAgentSession } from "@earendil-works/pi-coding-agent";

// 文件工具只读选择（MCP 保留规则见 06）：（find 是 glob 文件搜索）
const { session } = await createAgentSession({
  tools: ["read", "grep", "find", "ls"],
});

// 精确控制：允许读取 + 编辑，但禁止执行 shell
const { session: s2 } = await createAgentSession({
  tools: ["read", "write", "edit", "grep", "find", "ls"],
});

// denylist：从配置的默认选择中排除 bash，不是开启所有注册内置工具
const { session: s3 } = await createAgentSession({
  excludeTools: ["bash"],
});

// 不初始激活默认内置工具；它们仍可重新激活
const { session: s4 } = await createAgentSession({
  noTools: "builtin",
});

// 纯对话模式：完全无工具
const { session: s5 } = await createAgentSession({
  noTools: "all",
});
```

## 运行时切换

```ts
// 修改 model-declared active 集，不等同收紧全部 callable 权限
// 注意：传入的工具名必须在工具注册表中存在，未知名称会被静默忽略
session.setActiveToolsByName(["read", "grep"]);
```

## 变体与延伸
- 完整工具列表及参数说明 → 见 [sdk_doc/06-tools.md](../sdk_doc/06-tools.md)
- 自定义工具（如计算器、日期查询） → 见 [sdk_doc/07-extensions-api.md](../sdk_doc/07-extensions-api.md)
- 工具拦截与修改 → 见 [sdk_doc/07-extensions-api.md](../sdk_doc/07-extensions-api.md)

这些创建片段是独立配置备选；实际只选一种，并在 `finally` dispose 其 session。modifier 示例：`tools: ["+my_tool", "-bash"]`（配合 customTools），plain 与 +/- 混用会 throw。

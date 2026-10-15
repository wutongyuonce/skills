# pi-agent 项目结构建议 — 关键模式与详解

本文档是 [SKILL.md](../SKILL.md) 中"项目结构建议"的深入展开。
按需阅读，遇到具体问题时参考。

---

## 关键模式

> 只列最重要的几个，避免踩坑。

### main.ts 只做组装

不承载业务逻辑。典型流程：

```ts
import { createAgentSession, DefaultResourceLoader, ModelRuntime, getAgentDir } from "@earendil-works/pi-coding-agent";

const cwd = process.cwd();
const modelRuntime = await ModelRuntime.create();
// 在此通过应用模块注册 Provider，再选择其模型。
const resourceLoader = new DefaultResourceLoader({ cwd, agentDir: getAgentDir() });
await resourceLoader.reload();
const { session } = await createAgentSession({ cwd, modelRuntime, resourceLoader });
try {
  await session.bindExtensions({});
  await session.prompt("解释当前项目");
} finally {
  session.dispose();
}
```

### tools/index.ts 汇总导出

```ts
import { toolA } from "./tool-a.js";
import { toolB } from "./tool-b.js";
export const tools = [toolA, toolB];
```

### providers 注册模式

以下是应用模块结构示意，省略业务配置，不是独立可运行代码：

```text
// src/agent/providers/my-provider.ts
export function registerMyProvider(runtime: ModelRuntime) {
  runtime.registerProvider("my-provider", {
    baseUrl: "...",
    apiKey: process.env.MY_API_KEY,
    api: "openai-completions",
    models: [...],
  });
}

// src/agent/main.ts
import { registerMyProvider } from "./providers/my-provider.js";
registerMyProvider(modelRuntime);
```

### 什么时候该加什么

| 触发条件 | 新增 |
|---------|------|
| 项目创建 | `main.ts` + `.pi/SYSTEM.md` + `providers/` |
| 需要自定义能力 | `tools/xxx.ts` + `tools/index.ts` |
| Agent 需要了解业务 | `.pi/skills/*/SKILL.md` |
| 需要对外提供 API | `src/server/` |
| 需要 hook / 拦截 | `.pi/extensions/` 或 `src/agent/extensions/` |
| 用户需要 /command | `.pi/prompts/` |
| 需要独立前端 | `frontend/` |
| 工具 / Server 共用逻辑 | `src/utils/` |

### 常见错误

| 错误 | 后果 | 正确做法 |
|------|------|---------|
| 启动选择扩展 Provider 时忽略注册时序 | 模型不可用 | 可先在 ModelRuntime 注册；扩展方式用 services 构造/刷新后再选择模型，文件位置本身不限制注册 |
| 缺 `type: module` | pi-agent ESM 导入失败 | `package.json` 设 `"type": "module"` |
| 人设硬编码在 main.ts | 改人设需改代码 | 放 `.pi/SYSTEM.md` |
| 所有逻辑塞 main.ts | 难维护难测试 | 按职责拆到对应目录 |

---

## 深入：各目录详解

> 以下按需阅读，遇到具体问题时参考。

### `.pi/SYSTEM.md`

标准 DefaultResourceLoader 在项目可信时发现它，作为系统提示词。修改文件不需编译，但已运行的会话需要 reload 才能更新。自定义 loader/信任配置可改变发现行为。

动态内容（如当前日期）用 `appendSystemPromptOverride` 追加，不要整体覆盖。

### `.pi/APPEND_SYSTEM.md`

追加到 SYSTEM.md 末尾，适合放：
- 安全策略（"不要执行 DROP/DELETE"）
- 输出格式约束（"始终用 Markdown 表格"）
- 项目特定规则

### `.pi/skills/`（或 `.agents/skills/`）

每个子目录一个 `SKILL.md`，发现后先广告名称/描述/路径等 metadata；正文按需读取，不是全部在启动时注入。
适合放数据库表结构、API 接口文档、业务规则、SQL 通用规则等。

pi 还支持社区标准路径 `.agents/skills/`：cwd 及其祖先目录（git 仓库范围内）下的 `.agents/skills/` 会被发现为**项目级** skill（需 project trust），全局的 `~/.agents/skills` 则作为**用户级** skill（无需 trust）。`.pi/skills/` 与 `.agents/skills/` 并行生效，可任选其一。

### `.pi/extensions/`

放需要生命周期 hook 的扩展文件。适合的场景：

| 扩展 | 实现方式 |
|------|---------|
| 审计日志 | `tool_call` hook |
| 查询缓存 | `tool_result` hook |
| 危险操作确认 | `ctx.ui.confirm()`（先检查 hasUI） |
| 自定义命令 | `pi.registerCommand()` |

### `.pi/prompts/`

用户输入 `/report` 时触发的提示词模板。详见 scenarios/C02-prompt-templates.md。

### `src/agent/providers/`

每个 Provider 一个文件，main.ts 中调用注册函数。
让启动模型注册时序显式；扩展也可以注册 Provider，不是必须放在该目录。

### `src/agent/tools/`

一个文件一个工具。≤ 5 个工具扁平放；6 个以上按领域分子目录。
始终用 `index.ts` 汇总导出。

### `src/agent/extensions/`

内联工厂通过 DefaultResourceLoader 的 `extensionFactories` 加载（不是 createAgentSession 选项）；先 reload，需要启动 hook 时 bindExtensions。
适合轻量扩展（≤ 3 个），不需要文件发现机制。

### `src/server/`

Agent 核心逻辑与后端服务解耦。
`server.ts` 负责 Express/Koa 启动和中间件，`routes/` 放具体端点。

### `src/utils/`

`agent/` 和 `server/` 共用的工具函数，如日期格式化、响应封装、错误处理等。
如果只有 agent 用到，直接放 `src/agent/` 下即可。

### `frontend/`

独立的前端项目，有自己的 `package.json` 和构建链。
与后端通过 HTTP API 通信，不直接引用 `src/` 代码。

---

## 规模演进

项目结构随规模自然扩展，不要提前建空目录：

| 规模 | 工具组织 | 扩展组织 |
|------|---------|---------|
| ≤ 5 个工具 | `tools/` 扁平 | `extensionFactories` 内联 |
| 6-15 个工具 | `tools/` 按领域分子目录 | `.pi/extensions/` 文件 |
| > 15 个工具 | `tools/` 多级分组 + index 汇总 | Pi Package 打包 |

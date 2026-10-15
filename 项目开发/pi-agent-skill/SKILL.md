---
name: pi-agent
license: MIT
description: |
  Use when working with pi-agent / @earendil-works/pi-coding-agent SDK — 创建 agent、自定义工具、
  编写扩展、修改系统提示词、管理会话、配置模型、处理认证、加载 skills/prompts/context files、
  实现完全控制模式、或任何需要调用 pi-agent SDK API 的任务时使用。
  也用于企业内网接口接入评估：用户给出企业/内网 LLM 接口文档或地址，问「能不能接」「怎么配」时，
  按接口核对清单给出接入建议 + models.json 配置初稿。
  触发关键词：createAgentSession、AgentSession、pi.on、session.subscribe、extensionFactories、
  ModelRegistry、defineTool、pi-coding-agent、pi-ai、@earendil-works、SSE 流式集成、
  企业接口文档、内网模型接入、OpenAI 兼容判断、接口接入评估。
---

# pi-agent SDK 开发指南

> ⚠️ **版本基线**: 本 skill 的 API 描述已对齐到 **pi-coding-agent v1.2.0**。
>
> **遇 import 失败时**，先查目标包 `package.json` 的 `exports` 与对应 `.d.ts`；物理文件存在不代表该子路径公开。项目已安装其他版本时，以其声明和实现为准。
>
> 1.2.0 的严格 NodeNext 检查存在上游 JSON 声明缺陷；本次严格 Bundler 与离线行为检查通过。验收范围、限制和复跑入口见 [同步报告](references/updates/1.2.0.md)。

## 版本协议 ⭐

本 skill 核对到顶部基线版本。涉及安装/升级 pi-agent 时遵循三步：

1. **默认对齐**：引导安装一律用基线版本 `npm install @earendil-works/pi-coding-agent@1.2.0`，**不装 `latest`**——skill 的 API 描述精确核对到基线版本，装 latest 会立即漂移。场景文档里的安装命令同样以基线版本为准。

2. **升级前评估**：当任务涉及安装/升级（或用户问版本）时，先跑 `npm view @earendil-works/pi-coding-agent version` 拿 latest 与基线对比。若不同，联网查该版本 CHANGELOG/release notes，从 SDK 二次开发角度评估（新功能 / 破坏性变更），给用户简短建议，由用户决定是否升级。日常开发（项目已装好）不触发。

3. **同步 skill**：用户要求同步最新版、指定版本，或发现 SDK 与 skill 漂移时，执行 [update.md](update.md)：固定目标版本，核对完整变更区间、公开 API 和全部参考文件，验证示例后再提高基线。用户已要求同步时直接完成范围内修改；项目依赖升级与 skill 维护分别处理。

**变更查阅渠道**（第 2/3 步执行依据）：

| 渠道 | 路径/命令 | 适用阶段 |
|------|----------|---------|
| ① 目标发布包 CHANGELOG | 已安装的目标版本包，或用 `npm pack @earendil-works/pi-coding-agent@<目标版本>` 取得的 `CHANGELOG.md` | **升级前后均可**；必须核对包版本 |
| ② GitHub | 发布元数据 `repository` / `gitHead` 对应的 CHANGELOG 或 Release | 远程补充；以目标发布提交为准 |

> 旧项目的 node_modules 看不到新版内容；升级前可下载目标版本发布包核对，无需先改项目依赖。具体命令见 [update.md](update.md)。

## Overview

pi-agent 是基于**事件驱动**的 Agent 开发框架(`@earendil-works/pi-coding-agent`)。核心心智模型:

```
createAgentSession()  ← 组装入口(Provider + 工具 + 资源)
       │
       ├── session.prompt(text)          ← 驱动 Agent 主循环
       │
       ├── session.subscribe(handler)    ← 外部订阅层
       │     多数事件与扩展层共有(turn_*/message_*/tool_execution_*/agent_start/agent_end/agent_settled)
       │     外部层独有: queue_update / compaction_* / session_info_changed 等 session 状态事件
       │
       └── 扩展(pi.on)                   ← 内部扩展层
             请求变换 / 拦截 / 可操作生命周期边界
             如 context / context_with_system / tool_call / before_agent_start / input
```

**关键区分**：`session.subscribe` 是宿主观察入口，`pi.on` 是扩展 hook 入口，两者的事件集合与 payload 不相同。请求变换和工具拦截必须走扩展，不能假设 session listener 会收到所有 hook。完整归属和边界语义见 [事件系统](references/sdk_doc/04-events.md)。

扩展 handler 会被 await；慢 I/O 会拖延执行。session listener 不被 await，异步写入需自行捕获错误和管理生命周期；可靠落库由宿主维护队列及收尾 flush，不能把未等待的写入当成已持久化。

> 需要 Pi 不会自动继续的结束信号时，使用 **`agent_settled`**，而不是低层 `agent_end`；用 `aborted` 区分取消。扩展命令或被 input hook 消费的输入不一定产生 agent run。详见 [事件系统](references/sdk_doc/04-events.md)。

---

## When to Use

**该用本 skill**:
- 基于 pi-agent SDK 做 Agent 二次开发(Web 服务、CLI、定制化应用)
- 调用 `createAgentSession` / `AgentSession` / `defineTool` / `pi.on` 等 API

---

## 快速开始

需要 Node.js `>=22.19.0`（以目标发布包 `engines` 为准）。

```bash
npm install @earendil-works/pi-coding-agent@1.2.0
```

最简示例:

```ts
import { createAgentSession } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession();

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

try {
  await session.prompt("What files are in the current directory?");
} finally {
  session.dispose();
}
```

> 完整场景: [scenarios/A01-minimal-startup.md](references/scenarios/A01-minimal-startup.md)

---

## ⭐ 二开起步检查清单

不管做什么 Agent，先过这几项（默认值都是 pi 编码助手的产品烙印）：

**必改三项**
- **系统提示词** → 默认硬编码 pi 人设（不覆盖会自称 "expert coding assistant operating inside pi"），必须覆盖 → [A03](references/scenarios/A03-system-prompt.md)
- **可用工具** → 默认 `read/bash/edit/write` 编码四件套；垂直 Agent 要换业务工具，`bash` 在多用户场景是安全口子 → [A04](references/scenarios/A04-tool-whitelist.md)
- **会话存储** → 默认落盘 `~/.pi/agent/sessions/`；Web 多用户需隔离租户会话、配置和凭据。宿主自行落库可用 `SessionManager.inMemory()`，也可使用独立持久化目录 → [F01](references/scenarios/F01-session-persistence.md)

**易踩坑**：传入自定义 `resourceLoader` 时先 `await loader.reload()`。需要 `session_start` 的扩展还要 `await session.bindExtensions({})`，否则生命周期初始化（如 MCP 连接）不会执行。SDK 不自动加载 CLI 的 Codemode/MCP 内置扩展 → [A06](references/scenarios/A06-load-extensions.md)、[H08](references/scenarios/H08-codemode-mcp.md)

---

## 意图总表

按「我要做什么」找文件。场景编号保留在文件名,向后兼容。

### 1. 启动与组装

| 我想... | 详见 |
|--------|------|
| 最简跑起来 | [A01](references/scenarios/A01-minimal-startup.md) |
| 选模型 / 推理深度 | [A02](references/scenarios/A02-model-selection.md) |
| 改系统提示词 / 人设 | [A03](references/scenarios/A03-system-prompt.md) |
| 指定 cwd | [A05](references/scenarios/A05-custom-cwd.md) |
| 加载 `.pi/` 目录扩展文件 | [A06](references/scenarios/A06-load-extensions.md) |
| 完全手动组装所有组件 | [H01](references/scenarios/H01-full-control.md) |

### 2. 工具系统

| 我想... | 详见 |
|--------|------|
| 写自定义工具(查 DB/调 API) | [D01](references/scenarios/D01-custom-tool.md) |
| 工具白名单(禁用部分工具) | [A04](references/scenarios/A04-tool-whitelist.md) |
| 动态注册 / 覆盖内置工具 | [D02](references/scenarios/D02-dynamic-tools.md) |
| 工具调用前确认(安全闸门) | [D04](references/scenarios/D04-confirm-destructive.md) |
| 工具结果自定义渲染 | [D05](references/scenarios/D05-tool-result-render.md) |
| 限制工具只在特定目录执行 | [D06](references/scenarios/D06-protected-paths.md) |

### 3. 扩展与事件 ⭐(最常用)

| 我想... | 详见 |
|--------|------|
| 写一个完整的扩展 | [E02](references/scenarios/E02-extension-basics.md) |
| 拦截 / 修改工具调用 | [E01](references/scenarios/E01-tool-intercept.md) |
| 在生命周期阶段触发逻辑 | [E04](references/scenarios/E04-lifecycle-hooks.md) |
| 拦截 / 变换用户输入 | [E05](references/scenarios/E05-input-transform.md) |
| 流式处理工具输出 | [E06](references/scenarios/E06-streaming-transform.md) |
| ⭐ **Web/SSE 流式进度集成** | [E11](references/scenarios/E11-sse-progress-streaming.md) |
| turn 开始时预加载数据 | [G04](references/scenarios/G04-preload-context.md) |

### 4. 持久化与会话

| 我想... | 详见 |
|--------|------|
| 持久化会话 / 断点续聊 | [F01](references/scenarios/F01-session-persistence.md) |
| 运行时切换 / 恢复 / 分叉 | [F02](references/scenarios/F02-session-runtime.md) |
| 中止正在运行的 prompt | [F04](references/scenarios/F04-abort-session.md) |
| steer() 注入消息到队列 | [F05](references/scenarios/F05-steer-session.md) |
| 注入外部上下文 / 记忆 | [G01](references/scenarios/G01-context-injection.md) |

> F01 同时覆盖: 获取会话 ID/路径、纯内存会话(`SessionManager.inMemory()`)
> F05 同时覆盖: 读取历史与投影；修改/恢复以 SessionManager 为权威，见 [12](references/sdk_doc/12-session-manager.md)

### 5. 上下文与记忆

| 我想... | 详见 |
|--------|------|
| 加载/过滤/创建自定义 Skill | [C01](references/scenarios/C01-custom-skill.md) |
| 定义 Prompt 模板(`/command`) | [C02](references/scenarios/C02-prompt-templates.md) |
| 注入虚拟 AGENTS.md 指令 | [C03](references/scenarios/C03-context-files.md) |
| 自定义压缩策略 | [G02](references/scenarios/G02-custom-compaction.md) |
| 自动总结历史对话 | [G03](references/scenarios/G03-auto-summarize.md) |

### 6. Provider 与认证

| 我想... | 详见 |
|--------|------|
| 配置 API Key / OAuth | [B01](references/scenarios/B01-auth-config.md) |
| 管理 settings 配置项 | [B02](references/scenarios/B02-settings.md) |
| 获取可用模型列表 | [B03](references/scenarios/B03-available-models.md) |
| 自定义 Provider(智谱等) | [H02](references/scenarios/H02-custom-provider.md) |
| 企业接口能否接入 + 出 models.json 初稿 | [H07](references/scenarios/H07-enterprise-interface.md) |
| 用 Faux Provider 做测试 | [H03](references/scenarios/H03-faux-provider.md) |
| 在 SDK 中启用 Codemode / MCP / 工具搜索 | [H08](references/scenarios/H08-codemode-mcp.md) |

### 7. 多 Agent 与打包发布

| 我想... | 详见 |
|--------|------|
| 多 Agent 协作 | [H06](references/scenarios/H06-multi-agent.md) |
| 打包发布 Pi Package | [I01](references/scenarios/I01-pi-package.md) |
| 通过 npm / git / local 分发扩展 | [I02](references/scenarios/I02-distribute-extension.md) |
| 扩展引用第三方依赖 | [I03](references/scenarios/I03-extension-deps.md) |
| 子 Agent 调度 | [I05](references/scenarios/I05-subagent.md) |

> **未列出的场景**(终端 UI / 自定义命令 / RPC / Sandbox 等低频或 CLI 专属)直接翻 `references/scenarios/` 目录。

---

## 项目结构

**约定**: `.pi/` 放资源(人可编辑),`src/` 放逻辑(开发者维护)。
**核心**: `main.ts` 只做组装(Provider → 工具 → createAgentSession)。

完整目录建议、规模演进、常见错误 → [project-structure.md](references/project-structure.md)

注意：项目结构仅是对新项目的建议，并不是必须选择，请按照实际情况（尤其是旧项目）调整项目结构。

---

## SDK API 索引

按包/模块查 API。每个条目指向 `references/sdk_doc/` 下的详细文档。

### @earendil-works/pi-coding-agent(核心 SDK)

| 模块 | 说明 | 详细 |
|------|------|------|
| `createAgentSession` | 创建会话主入口,接收全部配置 | [01](references/sdk_doc/01-create-agent-session.md) |
| `AgentSession` | prompt / steer / abort / setModel / dispose / subscribe | [02](references/sdk_doc/02-agent-session.md) |
| `AgentSessionRuntime` | newSession / switchSession / fork | [03](references/sdk_doc/03-agent-session-runtime.md) |
| **事件系统** | 全部事件类型、触发时机、数据结构、集成踩坑 | [04](references/sdk_doc/04-events.md) |
| `ModelRuntime` / `ModelRegistry` | 模型/认证运行时、chat/image/classifier 目录与扩展访问入口 | [05](references/sdk_doc/05-auth-model-registry.md) |
| `defineTool` / 工具系统 | 自定义工具定义、内置工具、参数 schema | [06](references/sdk_doc/06-tools.md) |
| `ExtensionAPI` | pi.on / pi.registerTool / pi.registerCommand；UI 在 ctx.ui | [07](references/sdk_doc/07-extensions-api.md) |
| `DefaultResourceLoader` | system prompt / skills / prompts / context files / extensions | [08](references/sdk_doc/08-resource-loader.md) |
| `Skill` 接口 | Skill 数据结构与加载机制(渐进式披露) | [09](references/sdk_doc/09-skills.md) |
| `PromptTemplate` | `/command` 模板 | [10](references/sdk_doc/10-prompt-templates.md) |
| Context Files (AGENTS.md) | 项目级指令文件机制 | [11](references/sdk_doc/11-context-files.md) |
| `SessionManager` | create / continueRecent / open / list / inMemory | [12](references/sdk_doc/12-session-manager.md) |
| `SettingsManager` | applyOverrides / flush / drainErrors | [13](references/sdk_doc/13-settings-manager.md) |

### @earendil-works/pi-ai(AI 层)与高级主题

| 模块 | 说明 | 详细 |
|------|------|------|
| `Models` / Custom Provider | typed 模型查询 / 自定义 Provider 注册 | [16](references/sdk_doc/16-custom-provider.md) |
| Compaction | 上下文窗口压缩机制 | [18](references/sdk_doc/18-compaction.md) |
| Pi Package | 打包、发布、版本管理 | [20](references/sdk_doc/20-pi-package.md) |
| 多 Agent 架构 | 多 Agent 协作模式 | [21](references/sdk_doc/21-multi-agent.md) |
| 扩展推荐 SOP | 按用户需求实时查 npm + 给出推荐清单（用户主动询问时触发） | [22](references/sdk_doc/22-extension-recommender.md) |

> 完整 sdk_doc 索引直接翻 `references/sdk_doc/` 目录（TUI/UI API/Faux Provider/RPC 模式等 CLI 专属低频项已从本 skill 剔除，需要时查 SDK 源码）。



---

## 源码兜底协议 ⭐(本 skill 不够用时)

当 `scenarios/` 和 `sdk_doc/` 都无法回答你的问题时,**不要凭空推断**——直接查 `node_modules` 内的包内容。pi-agent 的 npm 包**自带文档、示例和类型**,任何装了 SDK 的项目都自动拥有。

**触发信号**:类型/字段/方法名在 skill 内 grep 不到、签名未列出、实际行为与描述冲突、集成场景超出已覆盖模式。

**4 层优先级**(信息密度从高到低,先用上层):

| 优先级 | 查什么 | 最适合 |
|--------|--------|--------|
| 1 | `pi-coding-agent/examples/sdk/*.ts` | 「怎么做 X」 |
| 2 | `pi-coding-agent/docs/*.md` | 「X 是什么 / 有哪些能力」 |
| 3 | `*/dist/**/*.d.ts` | 「X 有哪些字段/方法」 |
| 4 | `*/dist/**/*.js` | 「X 为什么这样行为」 |

> 公开入口与材料布局导航、检索配方、降级策略、回流提示 → [source-fallback.md](references/source-fallback.md)

**兜底解决后**:若该问题任何用 pi-agent 的项目都可能遇到,主动建议补进对应 API 文档或场景；用户已要求维护时直接就近更新，按 [update.md](update.md) 验证并记录。

---

## 资源 & 维护

**官方源码参考**: `packages/coding-agent/src/`(SDK)、`packages/agent/src/`(Agent 核心)、`packages/ai/src/`(AI 抽象)

**Skill 维护**: 版本同步与信息纠错按 [update.md](update.md) 执行，并在 [CHANGELOG.md](CHANGELOG.md) 记录已完成的维护及验证结果。

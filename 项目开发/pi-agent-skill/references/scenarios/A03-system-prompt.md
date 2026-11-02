# 场景：替换或追加系统提示词 (A03)

## 什么时候用

自定义 Agent 的系统提示词——完全替换 pi 默认人设，或追加额外全局指令。

**三种"给 Agent 加指令"的方式，选哪个？**

| 方式 | 控制什么 | 何时生效 | 适合场景 |
|------|---------|---------|---------|
| **系统提示词**（本场景） | Agent 的**人格基调**——"你是谁、说话风格、全局行为约束" | 每次 LLM 调用都带，全 session 生效 | 换人设（中文助手/代码专家/海盗腔） |
| [Skill](C01-custom-skill.md) | **按需查阅的知识库**——渐进式披露，Agent 用到才查 | Agent 主动调用 read 时 | 补充专业知识（框架文档、API 参考） |
| [Context File](C03-context-files.md) (AGENTS.md/CLAUDE.md) | **项目级规则**——编码规范、架构约定、禁用项 | 每次 LLM 调用都带（包在 `<project_context>` 标签里） | 给特定项目加规则（目录结构、lint 规则） |

**关键区别**：系统提示词是"Agent 是什么"，Context File 是"项目要求什么"。系统提示词替换会**移除** pi 的默认工具列表/guidelines（下文详述），而 普通 sections 分支把 Context File 加入 project_context；完整 force/返回 systemPrompt 覆盖可绕过。

## 前置条件

1. **安装 SDK**：`npm install @earendil-works/pi-coding-agent@1.2.0`
2. **确认 cwd 和 agentDir**：
   - `cwd`：项目根目录，决定从哪里开始向上查找 `AGENTS.md`/`CLAUDE.md`
   - `agentDir`：pi 全局配置目录，默认 `~/.pi/agent/`，可用 `getAgentDir()` 获取（受 `PI_CODING_AGENT_DIR` 环境变量覆盖，见 config.ts）

## 涉及 SDK

| 能力 | 用途 | 详细文档 |
|------|------|---------|
| `DefaultResourceLoader` | 资源加载器，承载提示词覆写逻辑 | [sdk_doc/08-resource-loader.md](../sdk_doc/08-resource-loader.md) |
| `createAgentSession` | 创建 session，接收 `resourceLoader` 参数 | [sdk_doc/01-create-agent-session.md](../sdk_doc/01-create-agent-session.md) |
| `SessionManager` | 会话管理器（与 ResourceLoader 搭配使用） | [sdk_doc/12-session-manager.md](../sdk_doc/12-session-manager.md) |

## 系统提示词如何被组装（★ 必读）

**这是本场景最容易踩坑的地方**。你以为 `systemPromptOverride: () => "xxx"` 后 LLM 只看到 `"xxx"`——**不是**。

pi 发给 LLM 的最终 system prompt 由 `buildSystemPrompt()` 组装，它按 `customPrompt` 真值选择 preamble；空字符串与 undefined 都回退默认。`forceSystemPrompt !== undefined` 则直接用完整字符串（含空字符串），绕过 sections 组装：

### 分支一：customPrompt 存在（你传了 systemPromptOverride 且返回非空字符串）

以你的 `customPrompt` 为基础，**跳过** pi 的默认 prompt（工具列表/guidelines/pi 文档路径全部移除），但仍**自动追加**：

| 追加项 | 何时追加 | 如何阻止 |
|--------|---------|---------|
| `appendSystemPrompt` | APPEND_SYSTEM.md 存在或你显式传入 | `appendSystemPromptOverride: () => []` |
| **contextFiles** | cwd 或上层目录有 AGENTS.md/CLAUDE.md | `noContextFiles: true` |
| **skills** | 有 skill 索引且 read/bash 可达（隐藏 reader 用 indirect 提示） | `skillsOverride: () => ({ skills: [], diagnostics: [] })` |
| `<cwd>` | 普通 sections 组装总有 cwd（斜杠正规化） | 完整 forceSystemPrompt / before_agent_start 返回 systemPrompt 绕过组装 |

**源码**：system-prompt.ts。

### 分支二：customPrompt 为假值（undefined 或空字符串）

使用 pi 默认的完整 system prompt，包含：

- `You are an expert coding assistant operating inside pi...`
- Available tools 列表（来自 `selectedTools` + `toolSnippets`）
- Guidelines（`promptGuidelines` 选项数组 + 硬编码默认，如 Be concise / Show file paths）
- pi 文档路径（README/docs/examples 三个绝对路径）
- 之后再追加 appendSystemPrompt / contextFiles / skills / cwd

**源码**：system-prompt.ts。

普通 prompt 由有序 sections 渲染：preamble（无标签）、tools/rules/docs（默认分支）、addendum、project_context、skills、cwd；其余 section 用同名 XML 标签。`sections` 可替换/追加非空 section 内容，名称需匹配 `[a-z][a-z0-9_-]*` 且不能是 preamble。要完全 opaque prompt，在 before_agent_start 设置 `event.systemPromptOptions.forceSystemPrompt` 或返回 `{ systemPrompt: "..." }`（空字符串也有效）。

## 实现思路

1. 创建 `DefaultResourceLoader`，传入 `systemPromptOverride` 或 `appendSystemPromptOverride`
2. 调用 `loader.reload()` 使配置生效
3. 创建 `createAgentSession({ resourceLoader: loader, sessionManager })`

### 两个 override 的语义

| override | `base` 参数 | 返回值 | 默认行为（不传 override 时） |
|---------|-----------|-------|---------------------------|
| `systemPromptOverride` | `string \| undefined`——来自 SYSTEM.md 文件内容（项目 `.pi/SYSTEM.md` > 全局 `~/.pi/agent/SYSTEM.md`，项目文件需项目受信；都没有则为 `undefined`）。若构造选项 `systemPrompt`（字符串）被显式传入，则 `base` 来自该选项的 resolvePromptInput 结果而非 SYSTEM.md 发现 | 你的返回值就是最终 customPrompt。返回 undefined/空字符串走默认 preamble；完整空 prompt 需 force/扩展返回值 | 读 SYSTEM.md 文件，无文件则 `undefined` |
| `appendSystemPromptOverride` | `string[]`——仅依赖自动发现时最多 **1 个元素**（项目 `.pi/APPEND_SYSTEM.md` 或全局 `~/.pi/agent/APPEND_SYSTEM.md` 的内容，二选一；都没有则为 `[]`）。如果显式传入构造选项 `appendSystemPrompt: string[]`，则 `base` 包含对应数量元素 | 你的返回数组就是最终 append 内容 | 读 APPEND_SYSTEM.md（单个），无文件则 `[]` |

**源码**：resource-loader.ts、resource-loader.ts。

### 项目信任门槛（B 档）

项目级 `.pi/SYSTEM.md` 和 `.pi/APPEND_SYSTEM.md` **仅在项目受信时**才会被发现。不受信时即使文件存在也会被跳过，直接回退到全局文件。

- 信任状态由 `SettingsManager` 控制，或通过 `loader.reload({ resolveProjectTrust })` 回调决定
- 详见 [sdk_doc/08-resource-loader.md §reload() 选项与项目信任](../sdk_doc/08-resource-loader.md)

## 核心代码

### 方式一：替换主体并关闭资源追加（仍有 cwd section）

替换 pi 默认 prompt 主体，同时关闭所有自动追加项（append / contextFiles / skills），让 customPrompt 是唯一的 prompt 主体（仍保留 `<cwd>` section；不自动追加日期）：

```ts
import { getAgentDir, createAgentSession, DefaultResourceLoader, SessionManager } from "@earendil-works/pi-coding-agent";

const cwd = process.cwd();
const agentDir = getAgentDir();

const loader = new DefaultResourceLoader({
  cwd, agentDir,
  // 1. 替换默认 prompt 主体（pi 的工具列表/guidelines/pi 文档路径全部移除）
  systemPromptOverride: () => "You are a helpful assistant. Keep answers short.",
  // 2. 清空 append，防止 APPEND_SYSTEM.md 内容残留
  appendSystemPromptOverride: () => [],
  // 3. 关闭 context files，防止 AGENTS.md/CLAUDE.md 被自动注入
  noContextFiles: true,
  // 4. 关闭 skills，防止 skill 索引被自动注入
  noSkills: true,
  skillsOverride: () => ({ skills: [], diagnostics: [] }), // 清空显式/扩展路径也加载的索引
});
await loader.reload();

const { session } = await createAgentSession({
  resourceLoader: loader,
  sessionManager: SessionManager.inMemory(cwd),
});
```

> **陷阱**：只设 `systemPromptOverride` + `appendSystemPromptOverride: () => []` **不够**——`buildSystemPrompt()` 仍会自动追加 cwd 下的 `AGENTS.md`/`CLAUDE.md` 和 skills。要屏蔽资源追加用 noContextFiles 和空 skillsOverride；真正完整覆盖用 before_agent_start 返回 systemPrompt 或 forceSystemPrompt。详见上方「系统提示词如何被组装」。

### 方式二：只追加，不改人设

保留 pi 默认 prompt（含工具列表/guidelines），只在末尾追加你的指令。适合"pi 默认人设 OK，但想加几条全局规则"：

```ts
const loader = new DefaultResourceLoader({
  cwd, agentDir,
  // base 来自 APPEND_SYSTEM.md（项目或全局，二选一），可能为空数组 []
  appendSystemPromptOverride: (base) => [
    ...base,
    "Additional rules:\n- Always use Chinese to respond\n- Never modify files without asking",
  ],
});
await loader.reload();

const { session } = await createAgentSession({
  resourceLoader: loader,
  sessionManager: SessionManager.inMemory(cwd),
});
```

### 方式三：读取 SYSTEM.md 内容改写（条件替换）

`base` 是文件内容，不是默认 prompt。下例替换 preamble，仍不会保留默认 tools/rules/docs sections：

```ts
const loader = new DefaultResourceLoader({
  cwd, agentDir,
  systemPromptOverride: (base) => {
    // base 是 SYSTEM.md 的内容，没有该文件时为 undefined
    // 注意：这里拿到的不是 pi 默认 prompt——pi 默认 prompt 由 buildSystemPrompt() 生成
    // 你返回任何非空字符串，pi 默认 prompt 就会被完全替换
    if (base) {
      return base.replace("You are a helpful assistant", "You are a senior code reviewer");
    }
    return "You are a senior code reviewer who focuses on security.";
  },
});
await loader.reload();
```

> **注意**：`base` 是 SYSTEM.md 文件内容，**不是** pi 的默认 prompt 文本。pi 的默认 prompt 在 `buildSystemPrompt()` 里硬编码（system-prompt.ts），可在扩展中通过 event.systemPromptOptions 的 sections/selectedTools 等结构化选项修改；不要把 loader 的 base 当作这份默认文本。

## 从文件读取提示词（B 档）

`systemPrompt` / `appendSystemPrompt` 构造选项可以**直接传文件路径或字符串**，`resolvePromptInput()` 会自动判断：传路径且文件存在则读取内容，否则当作字面字符串。详见 [sdk_doc/08-resource-loader.md](../sdk_doc/08-resource-loader.md)。

```ts
const loader = new DefaultResourceLoader({
  cwd, agentDir,
  systemPrompt: "/path/to/my-prompt.txt",  // 文件路径或字面字符串
});
```

**源码**：resource-loader.ts。

## 扩展层动态替换 system prompt（B 档）

除了 ResourceLoader 层的 override，扩展层也可以在**每次 `prompt()` 调用时**（agent loop 启动前，且一次 prompt 只触发一次）**动态替换** system prompt：

```ts
pi.on("before_agent_start", (event) => {
  // messageType: "user" 才有 prompt/images；"custom" 则有 message
  if (event.messageType === "user") console.log(event.prompt);
  // 返回 systemPrompt 字段是完整、不再追加的覆盖（也可改 systemPromptOptions.forceSystemPrompt）
  // 多个扩展同时返回时按注册顺序链式应用
  return {
    systemPrompt: event.systemPrompt + "\n\nExtra rule for this turn.",
  };
});
```

> **handler 签名**：`(event, ctx) => result`。当前已组装好的 system prompt 放在 **event 参数** 上（`event.systemPrompt`）；若要在 handler 内部读取当前 prompt，用 ctx 的**方法** `ctx.getSystemPrompt()`。注意 ctx 上**没有** `systemPrompt` 属性——写成 `ctx.systemPrompt` 会拿到 `undefined`。

**与 ResourceLoader override 的区别**：

| 维度 | ResourceLoader override | `before_agent_start` 事件 |
|------|------------------------|--------------------------|
| 生效时机 | session 创建时一次定型 | **每次 prompt() 调用触发一次**（一次 prompt 可能跑多轮 turn，但 `before_agent_start` 只发一次） |
| 能否动态变化 | 不能，reload 后固定 | 能，基于运行时状态（用户消息、上下文等） |
| 拿到的 base | SYSTEM.md 文件内容 / APPEND_SYSTEM.md 数组 | 当前已组装好的完整 system prompt |

**源码**：extensions/types.ts（`BeforeAgentStartEvent` / `BeforeAgentStartEventResult` 类型定义）、extensions/runner.ts（`emitBeforeAgentStart` 的链式应用逻辑）。

## 变体与延伸

- 同时加载 Skill → 见 [场景 C01](C01-custom-skill.md)
- 同时注入上下文文件 → 见 [场景 C03](C03-context-files.md)
- 扩展层 `context.getSystemPrompt()` 读取当前 prompt → 见 [sdk_doc/07-extensions-api.md](../sdk_doc/07-extensions-api.md)
- ResourceLoader 完整选项表 → 见 [sdk_doc/08-resource-loader.md](../sdk_doc/08-resource-loader.md)

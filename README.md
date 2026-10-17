# 🧠 Personal Agent Skill Collection

这是我的个人 AI Agent **Skills** 集合，用于扩展 AI 编码助手的专业能力。

Skills 是 AI Agent（如 Claude Code、Codex）的可复用指令模块。每个 skill 定义了特定的工作流程、约束条件和输出格式，让 AI 能够可靠地完成复杂任务——从代码审查、Bug 诊断到生成网页 PPT、研究分析等。

## 目录结构

| 目录 | 内容 |
|---|---|
| `会话工具/` | 会话历史检索、终端复用、上下文交接 |
| `前端 uiux/` | 前端与界面设计 |
| `工作流/` | 需求澄清 → 设计 → 实现 → 评审 → 测试的完整编码流程 |
| `文档多媒体/` | 文档、PPT、配图、研究与写作 |
| `音频视频剪辑/` | 视频/音频处理与封面 |
| `项目开发/` | 具体技术栈（Vite / Vitest / pnpm …）与 SDK |

顶层另有自建的 `pr-hint/`。

## [mattpocock/skills](https://github.com/mattpocock/skills)

mattpocock/skills 的 skill 大多收在 `工作流/`（对应其 `engineering/` 系列），另有几个 `productivity/` skill 位于其他文件夹，覆盖日常编码工作的完整流程。

## 我创建的 Skills

| Skill | 来源 | 说明 |
|---|---|---|
| [pr-hint](./pr-hint/SKILL.md) | — | 研究开源项目中的可贡献机会 |
| [neat](./工作流/neat/SKILL.md) | — | 知识收尾：把代码、文档、Agent 规则和获准记忆收成同一个现役答案 |
| [pr-lifecycle](./工作流/pr-lifecycle/SKILL.md) | [GitHub](https://github.com/wutongyuonce/pr-lifecycle) | 非平凡 PR 的全生命周期纪律：issue/spec 澄清 → 设计 → 实现 → review 修复 → 测试消融 → 终审 |
| [annotate-code-comments-zh](./文档多媒体/annotate-code-comments-zh/SKILL.md) | — | 为代码文件添加统一的中文注释 |
| [note](./文档多媒体/note/SKILL.md) | — | 为项目/技术栈/技术主题撰写、整理中文技术笔记与解析文章 |
| [video2article](./音频视频剪辑/video2article/SKILL.md) | [GitHub](https://github.com/wutongyuonce/video2article) | 把视频/播客重写成「阅读版本」文章：按主题分小节、逐节展开（YouTube 字幕 / 小宇宙官方逐字稿 / 本地 ASR） |
| [trajex-skill](./会话工具/trajex-skill/SKILL.md) | [GitHub](https://github.com/wutongyuonce/Trajex/tree/main/trajex-skill) | 检索过去的 Claude Code / Codex / Pi 会话历史 |
| [pi-agent-skill](./项目开发/pi-agent-skill/SKILL.md) | [GitHub](https://github.com/wutongyuonce/pi-agent-skill) | 面向 pi-agent / `@earendil-works/pi-coding-agent` SDK 的开发指南与接入评估 |

## 其他 Skills

| Skill | 来源 | 说明 |
|---|---|---|
| [herdr](./会话工具/herdr/SKILL.md) | [GitHub](https://github.com/herdrdev/herdr/tree/master/skills/herdr) | 控制 Herdr 终端复用器（工作区、标签、窗格） |
| [clone-website](./前端%20uiux/clone-website/SKILL.md) | [GitHub](https://github.com/JCodesMore/ai-website-cloner-template/tree/master/.codex/skills/clone-website) | 逆向分析并克隆网站 |
| [frontend-design](./前端%20uiux/frontend-design/SKILL.md) | [GitHub](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | 前端界面设计与实现指南 |
| [react-best-practices](./前端%20uiux/react-best-practices/SKILL.md) | [GitHub](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) | Vercel 出品的 React/Next.js 性能优化指南 |
| [shadcn](./前端%20uiux/shadcn/SKILL.md) | [GitHub](https://github.com/shadcn-ui/ui/tree/main/skills/shadcn) | shadcn/ui 组件管理与项目集成 |
| [taste-skill](./前端%20uiux/taste-skill/SKILL.md) | [GitHub](https://github.com/Leonxlnx/taste-skill) | 反模板化前端设计，产出不套模板的界面 |
| [unocss](./前端%20uiux/unocss/SKILL.md) | [GitHub](https://github.com/antfu/skills/tree/main/skills/unocss) | UnoCSS 原子化 CSS：工具规则、shortcuts 与 Wind/Icons/Attributify 预设 |
| [vue](./前端%20uiux/vue/) | [GitHub](https://github.com/vuejs-ai/skills) | Vue 3 最佳实践系列（组合式 API、Router、Pinia、测试、调试等 6 个子 skill） |
| [code-review-skill](./工作流/code-review-skill/SKILL.md) | [GitHub](https://github.com/awesome-skills/code-review-skill) | 覆盖 20+ 语言/框架的全面代码审查指南（React、Vue、Angular、Rust、Go、Python 等） |
| [convert-documents-to-markdown](./文档多媒体/convert-documents-to-markdown/SKILL.md) | [GitHub](https://github.com/firecrawl/anydoc/tree/main/skills/convert-documents-to-markdown) | 将 Word/PPT/Excel/PDF/EPUB 等文档转换为 GitHub Flavored Markdown |
| [diagram-design](./文档多媒体/diagram-design/SKILL.md) | [GitHub](https://github.com/cathrynlavery/diagram-design/tree/main/skills/diagram-design) | 创建架构图、流程图、时序图等可视化图表 |
| [guizang-ppt-skill](./文档多媒体/guizang-ppt-skill/SKILL.md) | [GitHub](https://github.com/op7418/guizang-ppt-skill) | 生成横向翻页网页 PPT，含 WebGL 背景、多风格模板 |
| [guizang-social-card-skill](./文档多媒体/guizang-social-card-skill/SKILL.md) | [GitHub](https://github.com/op7418/guizang-social-card-skill) | 生成社交媒体卡片，支持多种布局和主题 |
| [how-to-read-code](./文档多媒体/how-to-read-code/SKILL.md) | [GitHub](https://github.com/lichuang/how-to-read-code) | 系统化阅读并分析陌生源码库，产出结构化代码阅读报告 |
| [hv-analysis](./文档多媒体/hv-analysis/SKILL.md) | [GitHub](https://github.com/KKKKhazix/khazix-skills/tree/main/hv-analysis) | 横纵分析法深度研究产品/公司/概念，输出 PDF 报告 |
| [ian-xiaohei-illustrations](./文档多媒体/ian-xiaohei-illustrations/SKILL.md) | [GitHub](https://github.com/helloianneo/ian-xiaohei-illustrations/tree/main/ian-xiaohei-illustrations) | 生成 Ian「小黑」风格的中文正文配图 |
| [Kami](./文档多媒体/kami/SKILL.md) | [GitHub](https://github.com/tw93/Kami) | 统一设计语言的文档交付系统 |
| [open-kimi-ppt](./文档多媒体/open-kimi-ppt-skill/skills/open-kimi-ppt/SKILL.md) | [GitHub](https://github.com/binaryify/open-kimi-ppt-skill) | 创建、编辑、复刻和导出演示文稿 |
| [show-me](./文档多媒体/show-me/SKILL.md) | [GitHub](https://github.com/humanlayer/skills/tree/main/plugins/show-me/skills/show-me) | 用简洁图示、代码形状草图和聚焦 HTML 帮用户直观看懂当前主题 |
| [oil-cover](./音频视频剪辑/oil-cover/SKILL.md) | [GitHub](https://github.com/oil-oil/oil-cover) | 生成小红书/B 站 AI 工具实操视频封面 |
| [remotion-best-practices](./音频视频剪辑/remotion-best-practices/SKILL.md) | [GitHub](https://github.com/remotion-dev/skills/tree/main/skills/remotion-best-practices) | Remotion 视频编程的 skill 路由器（字幕、地图、文档、交互等） |
| [video-shotcraft](./音频视频剪辑/video-shotcraft/SKILL.md) | [GitHub](https://github.com/Vincentwei1021/video-shotcraft) | 将产品视频需求转化为可执行的镜头方案 |
| [antfu](./项目开发/antfu/SKILL.md) | [GitHub](https://github.com/antfu/skills/tree/main/skills/antfu) | Anthony Fu 的 JS/TS 工具链与工程约定 |
| [mcp-builder](./项目开发/mcp-builder/SKILL.md) | [GitHub](https://github.com/anthropics/skills/tree/main/skills/mcp-builder) | 高质量 MCP 服务器开发指南（Python FastMCP / Node SDK） |
| [pnpm](./项目开发/pnpm/SKILL.md) | [GitHub](https://github.com/antfu/skills/tree/main/skills/pnpm) | pnpm 包管理与工作区（catalog/patches/overrides）实践 |
| [vite](./项目开发/vite/SKILL.md) | [GitHub](https://github.com/antfu/skills/tree/main/skills/vite) | Vite 配置、插件 API、SSR 与 Rolldown 迁移 |
| [vitest](./项目开发/vitest/SKILL.md) | [GitHub](https://github.com/antfu/skills/tree/main/skills/vitest) | Vitest 单元测试、mock 与覆盖率配置 |

## 同步到 Codex

项目根目录下的 [`sync-pi-skills-to-codex.sh`](./sync-pi-skills-to-codex.sh) 脚本用于将 skills 同步到 Codex 的 skill 目录。

```bash
# 默认同步：$HOME/.pi/agent/skills → $HOME/.codex/skills
./sync-pi-skills-to-codex.sh

# 指定源和目标目录
./sync-pi-skills-to-codex.sh /path/to/skills /path/to/codex/skills
```

脚本会扫描所有包含 `SKILL.md` 的目录，为每个 skill 在目标目录创建符号链接。同步前会先清理目标目录下**过时/不一致的符号链接**（指向已删除、已重命名或不再是 skill 的路径，以及失效的断链）；指向源目录之外的活跃链接会保留，真实文件夹不会被删除。已存在且指向正确的链接会跳过，其余冲突会报告。

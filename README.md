# 🧠 Personal Agent Skill Collection

这是我的个人 AI Agent **Skills** 集合，用于扩展 AI 编码助手的专业能力。

Skills 是 AI Agent（如 Claude Code、Codex）的可复用指令模块。每个 skill 定义了特定的工作流程、约束条件和输出格式，让 AI 能够可靠地完成复杂任务——从代码审查、Bug 诊断到生成网页 PPT、研究分析等。

## 仓库概览

- 当前共收录 **53** 个 skill（不含仓库内部插件目录里的嵌套副本）
- 分类包含：`engineering`、`productivity`、以及自定义 / 第三方整合 skill
- 索引文档以 **仓库实际存在的 `SKILL.md`** 为准维护

> 如果新增或移除了 skill，记得同步更新本 README，避免目录索引和实际仓库状态不一致。

## 工程类（源自 mattpocock/skills/engineering）

这些 skill 来自 [mattpocock/skills](https://github.com/mattpocock/skills) 的 engineering 集合，覆盖日常编码工作的完整流程。

| Skill | 来源 | 说明 |
|---|---|---|
| [ask-matt](./engineering/ask-matt/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/engineering/ask-matt) | 路由/导航，推荐适合当前场景的 skill |
| [code-review](./engineering/code-review/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/engineering/code-review) | 双轴代码审查：代码规范审查 + 需求实现验证 |
| [codebase-design](./engineering/codebase-design/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/engineering/codebase-design) | 深层模块设计规范与共同语言 |
| [diagnosing-bugs](./engineering/diagnosing-bugs/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/engineering/diagnosing-bugs) | 系统化 Bug 诊断：复现 → 假设 → 插桩 → 修复 → 验证 |
| [domain-modeling](./engineering/domain-modeling/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/engineering/domain-modeling) | 领域模型构建与打磨，更新 CONTEXT.md 和 ADR |
| [grill-with-docs](./engineering/grill-with-docs/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/engineering/grill-with-docs) | 挑战式对话，同时构建项目的领域模型 |
| [implement](./engineering/implement/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/engineering/implement) | 根据 spec 或 ticket 实现功能，驱动 TDD 和 code-review |
| [improve-codebase-architecture](./engineering/improve-codebase-architecture/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/engineering/improve-codebase-architecture) | 扫描代码库发现重构机会，生成可视化 HTML 报告 |
| [prototype](./engineering/prototype/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/engineering/prototype) | 构建可丢弃的原型来验证设计决策 |
| [research](./engineering/research/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/engineering/research) | 基于高信任度原始资料进行研究，输出 Markdown 报告 |
| [resolving-merge-conflicts](./engineering/resolving-merge-conflicts/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/engineering/resolving-merge-conflicts) | 逐块解决合并/变基冲突，按意图追溯源码 |
| [setup-matt-pocock-skills](./engineering/setup-matt-pocock-skills/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/engineering/setup-matt-pocock-skills) | 配置仓库以使用 engineering skills（Issue tracker、标签等） |
| [tdd](./engineering/tdd/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/engineering/tdd) | 测试驱动开发，红-绿-重构循环 |
| [to-spec](./engineering/to-spec/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/engineering/to-spec) | 将当前对话转换为 spec 并发布到 Issue tracker |
| [to-tickets](./engineering/to-tickets/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/engineering/to-tickets) | 将计划/对话拆解为带依赖关系的 ticket |
| [triage](./engineering/triage/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/engineering/triage) | Issue 分类状态机 |
| [wayfinder](./engineering/wayfinder/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/engineering/wayfinder) | 大规模工作规划，通过决策 ticket 逐步明确路径 |
| [wizard](./engineering/wizard/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/engineering/wizard) | 生成交互式 bash 向导，引导人类逐步完成只有他们能做的操作 |

## 生产力类（productivity）

| Skill | 来源 | 说明 |
|---|---|---|
| [grilling](./productivity/grilling/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/productivity/grilling) | 对计划、决策或想法进行严格追问 |
| [teach](./productivity/teach/SKILL.md) | [GitHub](https://github.com/mattpocock/skills/tree/main/skills/productivity/teach) | 在工作区内教用户新技能/概念，跨会话保持学习状态 |

## 其他 Skills

| Skill | 来源 | 说明 |
|---|---|---|
| [annotate-code-comments-zh](./annotate-code-comments-zh/SKILL.md) | — | 为代码文件添加统一的中文注释 |
| [blog-content-publisher](./blog-content-publisher/SKILL.md) | — | 发布和维护 Wutong-Yu Astro 博客内容 |
| [code-review-skill](./code-review-skill/SKILL.md) | [GitHub](https://github.com/awesome-skills/code-review-skill) | 覆盖 20+ 语言/框架的全面代码审查指南（React、Vue、Angular、Rust、Go、Python 等） |
| [convert-documents-to-markdown](./convert-documents-to-markdown/SKILL.md) | [GitHub](https://github.com/firecrawl/anydoc/tree/main/skills/convert-documents-to-markdown) | 将 Word/PPT/Excel/PDF/EPUB 等文档转换为 GitHub Flavored Markdown |
| [dg-piagent](./dg-piagent/SKILL.md) | — | 面向 pi-agent / `@earendil-works/pi-coding-agent` SDK 的开发指南与接入评估 |
| [ego-browser](./ego-browser/SKILL.md) | — | 基于 ego-browser 的浏览器自动化、网页测试、截图、表单填写与数据提取 |
| [git-ship](./git-ship/SKILL.md) | [GitHub](https://github.com/oil-oil/git-ship) | 自动化完整 ship 流程：切分支 → commit → push → 建 PR → squash merge |
| [github](./github/SKILL.md) | — | 通过 gh CLI 进行 GitHub 操作：issues、PR、CI、代码审查 |
| [herdr](./herdr/SKILL.md) | [GitHub](https://github.com/herdrdev/herdr/tree/master/skills/herdr) | 控制 Herdr 终端复用器（工作区、标签、窗格） |
| [Humanizer-zh](./Humanizer-zh/SKILL.md) | [GitHub](https://github.com/op7418/Humanizer-zh) | 去除文本中的 AI 生成痕迹，使其更自然 |
| [hv-analysis](./hv-analysis/SKILL.md) | [GitHub](https://github.com/KKKKhazix/khazix-skills/tree/main/hv-analysis) | 横纵分析法深度研究产品/公司/概念，输出 PDF 报告 |
| [mcp-builder](./mcp-builder/SKILL.md) | [GitHub](https://github.com/anthropics/skills/tree/main/skills/mcp-builder) | 高质量 MCP 服务器开发指南（Python FastMCP / Node SDK） |
| [open-kimi-ppt](./open-kimi-ppt-skill/skills/open-kimi-ppt/SKILL.md) | — | 创建、编辑、复刻和导出演示文稿 |
| [pr-hint](./pr-hint/SKILL.md) | — | 研究开源项目中的可贡献机会 |
| [skill-creator](./skill-creator/SKILL.md) | [GitHub](https://github.com/anthropics/skills/tree/main/skills/skill-creator) | 创建、修改和评估 skill，含 evals 与触发词优化 |
| [skill-viz](./skill-viz/SKILL.md) | — | 零依赖 CLI 工具，生成 skill 可视化仪表盘 |
| [stack-notes](./stack-notes/SKILL.md) | — | 整理编程语言、框架和工具栈的快速入门笔记 |
| [trajex-skill](./trajex-skill/SKILL.md) | [GitHub](https://github.com/wutongyuonce/Trajex/tree/main/trajex-skill) | 检索过去的 Claude Code / Codex / Pi 会话历史 |
| [Kami](./uiux、anime、frontend/Kami/SKILL.md) | [GitHub](https://github.com/tw93/Kami) | 统一设计语言的文档交付系统 |
| [clone-website](./uiux、anime、frontend/clone-website/SKILL.md) | [GitHub](https://github.com/JCodesMore/ai-website-cloner-template/tree/master/.codex/skills/clone-website) | 逆向分析并克隆网站 |
| [diagram-design](./uiux、anime、frontend/diagram-design/SKILL.md) | [GitHub](https://github.com/cathrynlavery/diagram-design/tree/main/skills/diagram-design) | 创建架构图、流程图、时序图等可视化图表 |
| [frontend-design](./uiux、anime、frontend/frontend-design/SKILL.md) | [GitHub](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | 前端界面设计与实现指南 |
| [gc-minimal-zine-poster](./uiux、anime、frontend/gc-minimal-zine-poster/SKILL.md) | [GitHub](https://github.com/LiamGvchi/gc-minimal-zine-poster) | 生成极简主义风格的海报图像 |
| [guizang-ppt-skill](./uiux、anime、frontend/guizang-ppt-skill/SKILL.md) | [GitHub](https://github.com/op7418/guizang-ppt-skill) | 生成横向翻页网页 PPT，含 WebGL 背景、多风格模板 |
| [guizang-social-card-skill](./uiux、anime、frontend/guizang-social-card-skill/SKILL.md) | [GitHub](https://github.com/op7418/guizang-social-card-skill) | 生成社交媒体卡片，支持多种布局和主题 |
| [huashu-md-html](./uiux、anime、frontend/huashu-md-html/SKILL.md) | [GitHub](https://github.com/alchaincyf/huashu-md-html) | md/html/docx 多向转换流水线 |
| [ian-xiaohei-illustrations](./uiux、anime、frontend/ian-xiaohei-illustrations/SKILL.md) | [GitHub](https://github.com/helloianneo/ian-xiaohei-illustrations/tree/main/ian-xiaohei-illustrations) | 生成 Ian「小黑」风格的中文正文配图 |
| [oil-cover](./uiux、anime、frontend/oil-cover/SKILL.md) | [GitHub](https://github.com/oil-oil/oil-cover) | 生成小红书/B 站 AI 工具实操视频封面 |
| [photo-to-zine-postcard](./uiux、anime、frontend/photo-to-zine-postcard/SKILL.md) | [GitHub](https://github.com/Whiplashzeb/photo-to-zine-postcard) | 将照片制作成极简双面 zine 明信片 |
| [react-best-practices](./uiux、anime、frontend/react-best-practices/SKILL.md) | [GitHub](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) | Vercel 出品的 React/Next.js 性能优化指南 |
| [shadcn](./uiux、anime、frontend/shadcn/SKILL.md) | [GitHub](https://github.com/shadcn-ui/ui/tree/main/skills/shadcn) | shadcn/ui 组件管理与项目集成 |
| [taste-skill](./uiux、anime、frontend/taste-skill/SKILL.md) | [GitHub](https://github.com/Leonxlnx/taste-skill) | 反模板化前端设计，产出不套模板的界面 |
| [video-shotcraft](./uiux、anime、frontend/video-shotcraft/SKILL.md) | [GitHub](https://github.com/Vincentwei1021/video-shotcraft) | 将产品视频需求转化为可执行的镜头方案 |

## 同步到 Codex

项目根目录下的 [`sync-pi-skills-to-codex.sh`](./sync-pi-skills-to-codex.sh) 脚本用于将 skills 同步到 Codex 的 skill 目录。

```bash
# 默认同步：$HOME/.pi/agent/skills → $HOME/.codex/skills
./sync-pi-skills-to-codex.sh

# 指定源和目标目录
./sync-pi-skills-to-codex.sh /path/to/skills /path/to/codex/skills
```

脚本会扫描所有包含 `SKILL.md` 的目录，为每个 skill 在目标目录创建符号链接。同步前会先清理目标目录下**过时/不一致的符号链接**（指向已删除、已重命名或不再是 skill 的路径，以及失效的断链）；指向源目录之外的活跃链接会保留，真实文件夹不会被删除。已存在且指向正确的链接会跳过，其余冲突会报告。

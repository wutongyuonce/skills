# 🧠 Personal Agent Skill Collection

这是我的个人 AI Agent **Skills** 集合，用于扩展 AI 编码助手的专业能力。

Skills 是 AI Agent（如 Claude Code、Codex）的可复用指令模块。每个 skill 定义了特定的工作流程、约束条件和输出格式，让 AI 能够可靠地完成复杂任务——从代码审查、Bug 诊断到生成网页 PPT、研究分析等。

## 工程类（源自 mattpocock/skills/engineering）

这些 skill 来自 [mattpocock/skills](https://github.com/mattpocock/skills) 的 engineering 集合，覆盖日常编码工作的完整流程。

| Skill | 说明 |
|---|---|
| [ask-matt](./engineering/ask-matt/SKILL.md) | 路由/导航，推荐适合当前场景的 skill |
| [code-review](./engineering/code-review/SKILL.md) | 双轴代码审查：代码规范审查 + 需求实现验证 |
| [codebase-design](./engineering/codebase-design/SKILL.md) | 深层模块设计规范与共同语言 |
| [diagnosing-bugs](./engineering/diagnosing-bugs/SKILL.md) | 系统化 Bug 诊断：复现 → 假设 → 插桩 → 修复 → 验证 |
| [domain-modeling](./engineering/domain-modeling/SKILL.md) | 领域模型构建与打磨，更新 CONTEXT.md 和 ADR |
| [grill-with-docs](./engineering/grill-with-docs/SKILL.md) | 挑战式对话，同时构建项目的领域模型 |
| [implement](./engineering/implement/SKILL.md) | 根据 spec 或 ticket 实现功能，驱动 TDD 和 code-review |
| [improve-codebase-architecture](./engineering/improve-codebase-architecture/SKILL.md) | 扫描代码库发现重构机会，生成可视化 HTML 报告 |
| [prototype](./engineering/prototype/SKILL.md) | 构建可丢弃的原型来验证设计决策 |
| [research](./engineering/research/SKILL.md) | 基于高信任度原始资料进行研究，输出 Markdown 报告 |
| [resolving-merge-conflicts](./engineering/resolving-merge-conflicts/SKILL.md) | 逐块解决合并/变基冲突，按意图追溯源码 |
| [setup-matt-pocock-skills](./engineering/setup-matt-pocock-skills/SKILL.md) | 配置仓库以使用 engineering skills（Issue tracker、标签等） |
| [tdd](./engineering/tdd/SKILL.md) | 测试驱动开发，红-绿-重构循环 |
| [to-spec](./engineering/to-spec/SKILL.md) | 将当前对话转换为 spec 并发布到 Issue tracker |
| [to-tickets](./engineering/to-tickets/SKILL.md) | 将计划/对话拆解为带依赖关系的 ticket |
| [triage](./engineering/triage/SKILL.md) | Issue 分类状态机 |
| [wayfinder](./engineering/wayfinder/SKILL.md) | 大规模工作规划，通过决策 ticket 逐步明确路径 |
| [wizard](./engineering/wizard/SKILL.md) | 生成交互式 bash 向导，引导人类逐步完成只有他们能做的操作 |

## UI 设计类（UI-skills）

一套覆盖界面设计与审查的协作 skill：六个 `better-*` 各自拥有一个领域的规则，`better-interface` 负责跨领域审查编排，`interface-review` 负责变更范围的审查。

| Skill | 说明 |
|---|---|
| [better-accessibility](./UI-skills/better-accessibility/SKILL.md) | 无障碍工程：焦点、键盘支持、ARIA、表单、屏幕阅读器 |
| [better-colors](./UI-skills/better-colors/SKILL.md) | OKLCH 色彩体系：转换、调色板、对比度、Tailwind v4 |
| [better-interface](./UI-skills/better-interface/SKILL.md) | 跨领域界面审查编排，整合六个 better-* 的结论 |
| [better-layout](./UI-skills/better-layout/SKILL.md) | 布局结构：分组、对齐、阅读顺序、响应式断点、RTL |
| [better-typography](./UI-skills/better-typography/SKILL.md) | Web 排版：字体选择、可变字体、字阶、截断与可读性 |
| [better-ui](./UI-skills/better-ui/SKILL.md) | 界面打磨：动效、悬停、阴影、图标等视觉细节 |
| [better-writing](./UI-skills/better-writing/SKILL.md) | 界面文案：按钮标签、错误消息、空状态等 UX 写作 |
| [interface-review](./UI-skills/interface-review/SKILL.md) | 对未提交改动/分支/PR 的界面审查，按变更范围分类发现 |

## 生产力类（productivity）

| Skill | 说明 |
|---|---|
| [handoff](./productivity/handoff/SKILL.md) | 将当前对话压缩为交接文档，供新的 agent 会话继续 |
| [teach](./productivity/teach/SKILL.md) | 在工作区内教用户新技能/概念，跨会话保持学习状态 |

## 其他 Skills

| Skill | 说明 |
|---|---|
| [annotate-code-comments-zh](./annotate-code-comments-zh/SKILL.md) | 为代码文件添加统一的中文注释 |
| [anthropic-art](./anthropic-art/skill/SKILL.md) | 从用户主题生成位图插画，保留视觉系统 |
| [beautify-github-readme](./beautify-github-readme/SKILL.md) | 将仓库主页转化为主题化的视觉故事（SVG + Markdown） |
| [changelog-generator](./changelog-generator/SKILL.md) | 从 git 历史生成符合 Keep a Changelog 规范的 CHANGELOG.md |
| [code-review-skill](./code-review-skill/SKILL.md) | 覆盖 20+ 语言/框架的全面代码审查指南（React、Vue、Angular、Rust、Go、Python 等） |
| [codebase-to-course](./codebase-to-course/SKILL.md) | 将代码库转化为交互式 HTML 课程 |
| [convert-documents-to-markdown](./convert-documents-to-markdown/SKILL.md) | 将 Word/PPT/Excel/PDF/EPUB 等文档转换为 GitHub Flavored Markdown |
| [gc-minimal-zine-poster](./gc-minimal-zine-poster/SKILL.md) | 生成极简主义风格的海报图像 |
| [git-project-status](./git-project-status/SKILL.md) | 为一个或多个 Git 仓库生成综合状态报告 |
| [git-ship](./git-ship/SKILL.md) | 自动化完整 ship 流程：切分支 → commit → push → 建 PR → squash merge |
| [github](./github/SKILL.md) | 通过 gh CLI 进行 GitHub 操作：issues、PR、CI、代码审查 |
| [guizang-ppt-skill](./guizang-ppt-skill/SKILL.md) | 生成横向翻页网页 PPT，含 WebGL 背景、多风格模板 |
| [guizang-social-card-skill](./guizang-social-card-skill/SKILL.md) | 生成社交媒体卡片，支持多种布局和主题 |
| [herdr](./herdr/SKILL.md) | 控制 Herdr 终端复用器（工作区、标签、窗格） |
| [huashu-md-html](./huashu-md-html/SKILL.md) | md/html/docx 多向转换流水线（markitdown + Pandoc + python-docx） |
| [Humanizer-zh](./Humanizer-zh/SKILL.md) | 去除文本中的 AI 生成痕迹，使其更自然 |
| [hv-analysis](./hv-analysis/SKILL.md) | 横纵分析法深度研究产品/公司/概念，输出 PDF 报告 |
| [ian-xiaohei-illustrations](./ian-xiaohei-illustrations/SKILL.md) | 生成 Ian「小黑」风格的中文正文配图 |
| [kami V1.10.0](./kami%20V1.10.0/SKILL.md) | 统一设计语言的文档交付系统 |
| [last30days](./last30days/SKILL.md) | 研究过去30天社交媒体上关于某话题的真实讨论 |
| [mcp-builder](./mcp-builder/SKILL.md) | 高质量 MCP 服务器开发指南（Python FastMCP / Node SDK） |
| [oil-cover](./oil-cover/SKILL.md) | 生成小红书/B 站 AI 工具实操视频封面 |
| [react-best-practices](./react-best-practices/SKILL.md) | Vercel 出品的 React/Next.js 性能优化指南 |
| [skill-creator](./skill-creator/SKILL.md) | 创建、修改和评估 skill，含 evals 与触发词优化 |
| [skill-viz](./skill-viz/SKILL.md) | 零依赖 CLI 工具，生成 skill 可视化仪表盘 |
| [taste-skill](./taste-skill/SKILL.md) | 反模板化前端设计，产出不套模板的界面 |
| [trajex-skill](./trajex-skill/SKILL.md) | 检索过去的 Claude Code / Codex / Pi 会话历史 |
| [writing-great-skills](./writing-great-skills/SKILL.md) | 编写高质量 skill 的参考文档与原则 |

## 同步到 Codex

项目根目录下的 [`sync-pi-skills-to-codex.sh`](./sync-pi-skills-to-codex.sh) 脚本用于将 skills 同步到 Codex 的 skill 目录。

```bash
# 默认同步：$HOME/.pi/agent/skills → $HOME/.codex/skills
./sync-pi-skills-to-codex.sh

# 指定源和目标目录
./sync-pi-skills-to-codex.sh /path/to/skills /path/to/codex/skills
```

脚本会扫描所有包含 `SKILL.md` 的目录，为每个 skill 在目标目录创建符号链接。同步前会先清理目标目录下**过时/不一致的符号链接**（指向已删除、已重命名或不再是 skill 的路径，以及失效的断链）；指向源目录之外的活跃链接会保留，真实文件夹不会被删除。已存在且指向正确的链接会跳过，其余冲突会报告。

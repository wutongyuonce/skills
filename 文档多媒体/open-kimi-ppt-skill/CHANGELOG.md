# 更新日志

[简体中文](CHANGELOG.md) | [English](CHANGELOG_EN.md)

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.3.0] - 2026-08-07

### 新增

- 本地离线 neo-ppt 编辑器镜像（`editor/`）：无 iframe、无 `www.kimi.com`，支持打开 PPTD 文件夹编辑与官方 UI 内导出
- Skill install 同步拷贝完整 `editor/` 与 patched WASM，供已安装的 skill 树离线使用
- 图片 QA / `--browser` 导出改为打本地编辑器（`?ndExport=1` + `payload.json`），不再依赖 kimi.com

### 变更

- 默认 PPTX 导出统一走本地 patched WASM（单一真源 `editor/neo-ppt/assets/pptd_wasm_bg-DPPWdROu.wasm`）
- 本地编辑器关闭分享 / 云盘 / Google Drive 入口；拦截相关云端与 Google API 请求
- 移除旧 iframe 壳（`app.js` / `styles.css`）、废弃的 `export_host.html` 与未接线的浏览器顶栏导出胶水
- **务必升级**：本版本已彻底本地化，编辑与导出均走本地 neo-ppt 镜像 + patched WASM，不再经过官方云端导出链路，也不会再触发「官方导出需要签名」问题；请运行 `npx open-kimi-ppt-skill@latest install -y`（或交互选择目标目录）重新安装，将完全本地化的资源同步到已安装目录。

### 修复

- 修复系统深色主题导致的白屏闪烁（强制 light）
- 修复 demo / 只读打开后无法编辑、演示、导出（`isCreate: false` + 可编辑配置）
- 浏览器会话剥离 `HTTP(S)_PROXY`，避免公司代理 403 本地回环地址

## [1.2.0] - 2026-08-06

### 新增

- CLI 支持 `-h` / `--help` 与 `-V` / `--version`

### 变更

- npm 包名与 CLI 由 `open-kimi-ppt-skills` 统一为 `open-kimi-ppt-skill`（与 GitHub 仓库名一致）。请改用 `npx open-kimi-ppt-skill@latest`；旧包名将不再更新

## [1.1.3] - 2026-08-06

### 新增

- `install` 在交互终端下列出 `.agents` / `.codex` / `.claude` / `.cursor` / `.workbuddy` 技能目录，支持空格多选
- 支持 `-y/--yes`（非交互默认目录）、可重复的 `--target`
- `--all` 仅装到已检测到的 Agent 目录；对应目录不存在的 Agent 会跳过并提示，不会新建目录
- Windows 导出自动启动一个常驻调试浏览器（Chrome，未安装时回退 Edge），规避 agent-browser 无法自行拉起 Chrome 导致的导出失败；实例导出后常驻、后续导出复用同一个，也可用 `AGENT_BROWSER_CDP` 指定自己启动的调试浏览器

### 修复

- 修复 `find_download` 在 Downloads 目录扫描时因 `.crdownload` 被 Chrome 重命名而触发 `FileNotFoundError` 导致导出中断（Related to #4）

### 变更

- README 默认指引 AI 通过 `npx open-kimi-ppt-skill@latest install -y` 安装，不再建议 clone 仓库

## [1.1.2] - 2026-08-06

### 修复

- 修复中文 Windows 下 `export_pptx.py` / `export_images.py` 导出卡住或 GBK 解码失败（stdout 改走临时文件 + UTF-8）
- 规避 agent-browser `--download-path` 导致 Chrome 静默取消下载：改为点击下载并轮询默认 Downloads
- 修复 npm 包误打入 `__pycache__/*.pyc`（`files` 仅列出脚本源文件）

## [1.1.1] - 2026-08-06

### 新增

- PPTD 对齐官方元素级 `animations` 规范；Skill 补充动画 / `notes` 使用边界
- 对齐配图优先级、文风禁令、澄清提问、复刻细则、并行写页等官方策略
- 内置约 30 套 preset design system，并支持点名使用
- 恢复 `customFonts`（Google Fonts）与海报推荐尺寸
- 根目录主题目录：`theme.md` / `theme_EN.md`（含预览图）
- 示例项目 `example/xiaomi-yu7-ppt-animation`（页内元素入场动画）

### 变更

- 场景文档同步官方动画细则与 `customFonts` 引用
- README 补充元素动画、预设主题说明与示例 Prompt

## [1.0.2] - 2026-08-06

### 变更

- `install` 默认直接覆盖已安装的 Skill，无需再加 `--force`（旧的 `--force` 仍可兼容传入）

## [1.0.1] - 2026-08-06

### 新增

- Skill 工作流增加 **step0 本地前置检测**：生成前检查 Node.js 18+、npm/npx、python3，并提示需要 Chromium 系浏览器
- 导出脚本在启动时检测 **Node.js 18+** 与 **npm**；缺失或版本过低时给出明确安装指引
- CLI（`open-kimi-ppt-skill`）启动时校验 Node.js 主版本 ≥ 18
- 缺失 **PyYAML** 时自动 `pip install --user pyyaml`（与 Pillow / websocket-client 行为一致）

### 文档

- 补充多 Agent / 多模型实测截图（ChatGPT·Codex + 5.6 Luna、Reasonix + DeepSeek、WorkBuddy 等）
- 安装说明改为「自动 / 手动二选一」，并补充 Windows 路径说明
- README 结构与示例图更新

## [1.0.0] - 2026-08-05

### 新增

- 首次发布 `open-kimi-ppt-skill`
- PPTD 生成 / 编辑 / 复刻，默认同时交付可编辑 PPTD 项目与 PPTX 成品
- 浏览器侧导出 PPTX（嵌字体、淡入淡出切换），导出前可选多模态视觉质检
- 本地在线 PPTD 编辑器（`npx open-kimi-ppt-skill serve`）
- CLI 安装 Skill 到 `~/.agents/skills`（可用 `--target` 指定其他 Agent 目录）

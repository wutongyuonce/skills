# skill-viz

在终端中可视化 Agent Skills。

`skill-viz` 是一个零依赖的 `npx` CLI 工具，用于扫描本地和全局的 Agent Skill 目录，启动实时仪表盘，并在 skill 变更时自动刷新。

## 快速开始

```bash
npx skill-viz
```

仪表盘会在浏览器中打开。默认使用 `common` 配置，你可以在界面中切换不同的 agent 配置。

## 用法

```bash
npx skill-viz [options]
```

常用示例：

```bash
# 启动实时仪表盘，不自动打开浏览器
npx skill-viz --no-open

# 指定初始 agent 配置
npx skill-viz --agent claude
npx skill-viz --agent pi

# 使用固定端口
npx skill-viz --port 48765

# 扫描指定的工作区根目录
npx skill-viz --root /path/to/project

# 添加额外的 skills 目录
npx skill-viz --include /extra/skills/dir

# 生成静态 HTML 文件后退出
npx skill-viz --once --output skills.html
```

本地开发时：

```bash
npx . --no-open
```

## 参数

| 参数 | 说明 |
| --- | --- |
| `--agent`, `-a <name>` | 初始选中的 agent 配置。 |
| `--root <dir>` | 要扫描的工作区根目录，默认为当前目录。 |
| `--include`, `-I <dir>` | 额外要扫描的 skills 目录，可多次使用。 |
| `--port`, `-p <port>` | 实时服务器的端口，默认为随机可用端口。 |
| `--output`, `-o <file>` | 同时将生成的 HTML 快照写入指定文件。 |
| `--once` | 生成静态 HTML 文件后退出，不启动实时服务器。 |
| `--no-open`, `-n` | 不自动在浏览器中打开仪表盘。 |
| `--help`, `-h` | 显示帮助信息。 |

## Agent 配置

支持的配置：

- `common`
- `pi`
- `claude`
- `codex`
- `antigravity`
- `copilot`
- `mavis`
- `minimax`
- `hermes`

默认情况下，`skill-viz` 以 `common` 启动，显示共享的 `.agents` / `.config/agents` skills。仪表盘会扫描已知的配置，你可以通过 agent 选择器切换视图。

部分 agent 视图会包含共享的 `common` skills（当该 agent 的文档行为加载 `.agents/skills` 时）：

- `pi` — 包含 `common` 以及 Pi 专属 skill 目录。
- `codex` — 包含 `common`，因为 OpenAI Codex 将 `.agents/skills` 作为仓库/用户 skill 位置。
- `antigravity` — 包含 `common`，因为 Google Antigravity 将 workspace skills 记录在 `.agents/skills` 下。
- `claude` — **不**包含 `common`；Claude Code 将 `.claude/skills` 作为个人/项目 skill 目录。

## 仪表盘功能

- skill 文件变更时实时刷新。
- 支持多种 agent 配置的切换。
- 按 skill 名称、描述、脚本、参考资料、资源和路径搜索。
- 内容侧边栏包含 `SKILL.md`、Scripts 和 Resources 分区。
- Markdown 渲染，支持表格和代码高亮。
- 符号链接检测及内联标识。
- 浅色/深色模式。
- 移动端友好的可折叠导航。

## 发布到 npm / npx

`npx` 从 npm registry 运行包。发布步骤：

```bash
npm login
npm pack --dry-run
npm publish --access public --otp YOUR_2FA_CODE
```

如果你的 npm 账号需要双因素认证，请传入 `--otp` 或使用具有发布权限的细粒度 access token。

更新版本时，先 bump 版本号：

```bash
npm version patch
npm publish --access public --otp YOUR_2FA_CODE
```

## License

MIT。详见 [LICENSE](LICENSE)。

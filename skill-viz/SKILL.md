---
name: skill-viz
description: 可视化 Agent Skills 的仪表盘工具。当你需要查看当前安装了哪些 skills、浏览 skill 的结构和内容、检查 skill 的文件变更时使用此技能。
metadata:
  short-description: 生成 skills 可视化仪表盘 HTML
---

# Skill Visualizer

一个零依赖的 CLI 工具，扫描 Agent Skill 目录并生成可视化的 HTML 仪表盘，用于浏览和管理已安装的 skills。

## 项目位置

CLI 工具位于 `/Users/a/.pi/agent/skills/skill-viz`，所有命令需在该目录下执行。

## 何时使用

- 用户想看当前有哪些 skills 已安装
- 用户想浏览某个 skill 的 SKILL.md、scripts、references 等内容
- 用户问"有哪些 skill"、"skill 列表"、"查看 skills"
- 用户想用可视化界面查看 skills

## 使用方法

CLI 入口：`node /Users/a/.pi/agent/skills/skill-viz/index.js`

### 生成静态 HTML 到当前目录（推荐）

```bash
node /Users/a/.pi/agent/skills/skill-viz/index.js --once --no-open --agent pi --output ./pi-skills.html
```

生成后打开：
```bash
open ./pi-skills.html
```

### 启动实时服务器（skill 变更自动刷新）

```bash
node /Users/a/.pi/agent/skills/skill-viz/index.js --no-open --agent pi --port 48765
```

告诉用户打开 `http://127.0.0.1:48765/`，之后新增或修改 skill 文件页面会自动刷新。

## 常用参数

| 参数 | 说明 |
| --- | --- |
| `--agent pi` | 默认选中 Pi agent 的 skill 视图 |
| `--agent codex` | 默认选中 Codex agent 的 skill 视图 |
| `--agent common` | 默认选中 common（共享）skill 视图 |
| `--once` | 生成静态 HTML 文件后退出 |
| `--no-open` | 不自动打开浏览器 |
| `--output <file>` | 指定输出文件路径 |
| `--port <port>` | 指定服务器端口 |

## 仪表盘功能

生成的 HTML 页面支持：
- Agent 下拉切换（pi / codex / claude / copilot 等）
- 按 skill 名称、描述、脚本内容搜索
- 查看 SKILL.md 渲染后的 Markdown 内容
- 浏览 scripts、references、assets 等资源文件
- 浅色/深色模式切换
- 符号链接检测和标识

## 注意事项

- 静态 HTML 是快照，新增 skill 后需重新生成
- 实时服务器模式会监听文件变化并自动刷新
- 页面默认选中 `--agent` 指定的 view，但用户可在界面中切换到其他 agent

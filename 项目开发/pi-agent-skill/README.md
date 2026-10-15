# pi-agent-skill

面向 **Pi Agent SDK 二次开发**的中文 Agent Skill：按开发意图查找 API 参考、场景代码和集成边界，减少凭记忆编造参数或沿用旧版示例。

本仓库提供的是 **给编码 Agent 使用的知识与工作流**，不是 Pi SDK 本体，也不会自动注册工具、启动 MCP 或升级你的项目。

## 当前基线

- 已核对 SDK：`@earendil-works/pi-coding-agent@1.2.0`。
- 使用该 SDK 需要 Node.js `>=22.19.0`。
- 内容：18 份 SDK 参考、43 个场景、项目结构与源码兜底说明。
- 涵盖会话、工具、扩展事件、Provider/认证、上下文/压缩、Codemode/MCP、多 Agent、打包与权限边界。

版本基线以 [SKILL.md](SKILL.md) 为准。已有项目使用其他版本时，优先核对项目实际安装包的公开 exports、声明和实现。

## 安装到 Pi

先阅读本仓库内容，再用 Git 来源安装：

```bash
pi install git:github.com/wutongyuonce/pi-agent-skill
```

重启 Pi，或在已有交互会话中运行 `/reload`。根目录 [package.json](package.json) 只声明 `SKILL.md` 这一项 skill，没有扩展入口或安装脚本。

也可以直接放入用户 skills 目录：

```bash
git clone https://github.com/wutongyuonce/pi-agent-skill.git \
  ~/.pi/agent/skills/pi-agent
```

两种方式选一种，避免同名 skill 冲突。若该目录已经存在，不覆盖原有文件。其他支持 Agent Skills 的工具可使用相应 skills 目录；它们的发现规则需按各自文档确认。

## 使用

在 Pi 中显式调用：

```text
/skill:pi-agent 用 TypeScript 创建一个纯内存会话，并注册业务工具
/skill:pi-agent 检查 SSE 何时真正结束，区分失败和取消
/skill:pi-agent 评估这个企业模型接口如何接入
```

也可以直接要求编码 Agent「使用 pi-agent skill」。入口会按意图指向所需文件，不必一次加载全部参考资料。

常用入口：

| 需求 | 文档 |
|---|---|
| 从零启动 | [A01](references/scenarios/A01-minimal-startup.md) |
| 自定义工具 | [D01](references/scenarios/D01-custom-tool.md) |
| 扩展加载与生命周期 | [A06](references/scenarios/A06-load-extensions.md) |
| Web/SSE 集成 | [E11](references/scenarios/E11-sse-progress-streaming.md) |
| 会话持久化与恢复 | [F01](references/scenarios/F01-session-persistence.md) |
| SDK 中显式加载 Codemode/MCP | [H08](references/scenarios/H08-codemode-mcp.md) |
| 企业接口接入评估 | [H07](references/scenarios/H07-enterprise-interface.md) |
| 权限与沙箱边界 | [I04](references/scenarios/I04-sandbox.md) |

## 目录

```text
SKILL.md                 # Agent 入口与意图索引
references/sdk_doc/      # API 参考
references/scenarios/    # 场景说明与代码
references/updates/      # 版本同步与覆盖报告
validation/              # 固定依赖、离线检查与示例类型检查
update.md                # 完整版本同步流程
CHANGELOG.md             # 已完成的维护记录
```

## 验证与限制

[验证说明](validation/README.md) 提供临时目录复跑命令。1.2.0 基线验收包括：

- 161 个完整文档块/hook 与 14 个官方 SDK 示例通过严格 Bundler/ESNext 类型检查。
- 隔离的会话、认证、工具、事件、队列与恢复行为检查通过，检测到的网络尝试为 0。
- 本地文件链接和安装版本检查通过。签名、伪代码、故意错误示例不冒称独立程序通过编译。

**已知限制**：上游 `pi-ai@1.2.0` 的 42 个 JSON 声明 import 导致严格 NodeNext 报 TS1543。没有使用 `skipLibCheck` 或声明补丁掩盖。真实模型/OAuth/MCP/VM、CLI/UI 和容器端到端路径未运行；完整范围见 [1.2.0 验收报告](references/updates/1.2.0.md)。

## 维护与贡献

发现错误时，请说明 SDK 版本、受影响文件和可复现的错误或预期行为。修正说明与相关场景应在同一变更中对齐。

更新基线请按 [update.md](update.md)：固定目标版本、审查完整发布区间和全部参考文件、验证后再改基线与 [CHANGELOG](CHANGELOG.md)。不要把只修改几个文件称作完整同步，也不要顺带升级使用者的项目。

## 许可证与来源

本仓库采用 [MIT License](LICENSE)。由 [wutongyuonce](https://github.com/wutongyuonce) 维护，非 Pi 官方项目。

参考 [earendil-works/pi](https://github.com/earendil-works/pi) 的发布文档、声明、实现与示例；上游版权和 MIT 条款保留在 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。依赖包本身不随本仓库分发，其许可由各包独立适用。

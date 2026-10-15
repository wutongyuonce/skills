# 源码兜底协议

当 SDK 参考与场景不能回答问题，或描述与项目实际 SDK 冲突时，查**项目安装版本**的包，而不是用运行 Pi 的版本替代项目版本。

## 查询顺序

先在本 skill 的 `references/` 检索符号/意图；仍无答案时按问题查目标安装包：

| 材料 | 回答的问题 |
|---|---|
| `pi-coding-agent/examples/sdk/*.ts` | 如何组装会话、资源与运行时 |
| `pi-coding-agent/docs/*.md` 和相关扩展示例 | 功能、约定、使用边界 |
| 每个包的 `package.json` exports / types 与 `dist/**/*.d.ts` | 实际公开入口、参数、事件与返回值 |
| 对应 `dist/**/*.js` | 默认值、await、派发、错误、状态和清理语义 |

文档可能滞后；公开 API 以 exports 与类型为准，行为以实现和运行结果为准。需要某份 Markdown 时读全文，注意截断续读。

## 按包定位

`@earendil-works/` 不只三个包。SDK 主体是 `pi-coding-agent`；`pi-agent-core` 是低层循环/消息类型，`pi-ai` 是模型、认证与 Provider；Codemode/MCP/TUI 等另有包。先列出实际目录和元数据，再判断材料位置，不依赖固定 docs/examples 数量。

```bash
# 在项目目录运行
npm ls @earendil-works/pi-coding-agent @earendil-works/pi-ai @earendil-works/pi-agent-core
rg -n '<符号>' node_modules/@earendil-works/*/dist -g '*.d.ts'
rg -n '<主题>' node_modules/@earendil-works/pi-coding-agent/docs
```

常用入口：

- `pi-coding-agent/dist/index.d.ts`：根公开 API。
- `pi-coding-agent/dist/core/{sdk,agent-session,session-manager,model-runtime,resource-loader}.d.ts`：核心接口。
- `pi-ai/package.json` 与 `dist/index.d.ts`：核心模型/认证接口；Provider、compat、models 子路径分别核对 exports。
- `pi-agent-core/package.json` 与 `dist/index.d.ts`：低层导出。历史 CHANGELOG 提到 harness 不代表目标根仍导出它。

**物理文件可读不代表能 import 该子路径。** coding-agent 目标版本公开 `.` 与 `./rpc-entry`；compaction helpers 用包根导出，不能导入内部 core 子路径。源仓库的实验 client/plugin/server 也不能作为当前 npm SDK 入口。

## 包未安装

普通开发先确认是否获准安装，并使用 `SKILL.md` 已核对基线；维护可按 [update.md](../update.md) 使用 npm pack 获取目标发布材料，不改项目依赖。远程源码按发布元数据对应版本/提交定位，主分支只作为后续变化线索。

解决的事实属于通用 SDK 集成时，建议就近补入 API 文档或场景；已要求维护时直接修正，验证后按 [update.md](../update.md) 记录。避免将一次环境细节复制成永久 SDK 保证。

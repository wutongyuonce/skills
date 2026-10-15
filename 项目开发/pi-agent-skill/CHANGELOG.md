# pi-agent skill 维护记录

本文件从建立时开始记录实际维护。此前入口引用的 CHANGELOG 不在当前目录中，缺失历史未重建；旧文档所引的 v2.68 等历史记录在本文件中无可核验证据。

## 2026-10-13 — 补齐版本同步流程

- 新增 `update.md`：明确目标发布版本定位、材料获取、完整变更区间与参考文件覆盖、API / 场景同步、验证及基线验收。
- `SKILL.md` 与 `references/source-fallback.md` 的维护入口改为实际存在的 `update.md`，修正只能在安装后读取新版 CHANGELOG 的说明。
- 查询 npm 元数据确认当日 `@earendil-works/pi-coding-agent` 的 latest 为 `1.2.0`，Node 要求为 `>=22.19.0`；本机安装包同为 `1.2.0`。版本仅用于本次记录，后续目标重新查询。
- 核对来源：npm 发布元数据、该已安装包的 `package.json` 与 `examples/sdk/README.md`。
- 本次只补充维护流程，未执行 `0.83.0 → 1.2.0` 的完整 API / 场景同步；已核对基线保持 `0.83.0`。
- 验证：修改 Markdown 的本地文件链接检查通过；维护入口均可解析；未安装、编译或运行 SDK 示例。
- 已有问题：其他参考文件仍有 5 处失效本地文件链接，未纳入本次维护入口修复；执行完整同步时须逐项处理。


## 2026-10-14 — 完整同步 0.83.0 → 1.2.0

- 固定 npm 查询目标 1.2.0；完整审查旧基线之后 21 个发布条目、182 个 .d.ts 差异，并对照公开 exports、声明、实现与目标包 docs/examples。
- 全文核对并修改 18 个 SDK 参考、42 个原场景、2 个辅助参考；新增 H08（SDK 显式启用 Codemode / MCP / tool-search）。版本基线和 active 安装命令统一为 1.2.0，Node 要求 >=22.19.0。
- 同步工具选择/新字段/嵌套调用、扩展事件与 user/custom 启动、settled.aborted、队列投递、权威会话历史/恢复、native auth/typed models/Provider、settings/context override、打包 peers/trust/git/offline 与安全边界；修复旧失效文件链接和残留类型错误。
- `update.md` 明确上游 NodeNext 阻塞时的严格替代检查与报告要求，区分完整示例/片段/故意错误，不掩盖失败。
- 新增可复跑 validation（固定依赖与锁文件、文档示例提取器、离线 assert 检查、说明）。测试复制到新临时目录后 npm ci --ignore-scripts 重跑通过；未升级用户项目或全局 Pi。
- 验证：Node 22.22.2 / TS 5.9.3；严格 Bundler/ESNext 编译验证脚本及全部 14 个官方 SDK 示例通过；161 个文档完整块/hook 编译 0 diagnostics；隔离行为检查通过、网络尝试 0；LSP 对验证文件 0 diagnostics，fixAll 无修改；本地文件链接与 active 安装 pins 检查通过。未使用 skipLibCheck、ts-ignore 或发布声明补丁。
- 限制：严格 NodeNext 仍有 42 个上游 TS1543（pi-ai JSON import 缺 type: json）；本次不修补也不声称该解析模式通过。未运行真实 Provider/OAuth/image/classifier 网络推理、MCP连接、Codemode VM、CLI/UI/容器/Gondolin端到端；接口签名、伪代码、故意错误和零上下文片段不冒称独立程序编译成功。
- 来源、逐文件覆盖、逐块清单和验收细节：[1.2.0 同步报告](references/updates/1.2.0.md)、[验证说明](validation/README.md)。初始维护记录保留为历史，不代表现役基线。


## 2026-10-14 — 准备独立公开仓库

- 补充 README、MIT LICENSE、上游 THIRD_PARTY_NOTICES、.gitignore；SKILL frontmatter 声明 MIT。保留 Pi v1.2.0 的 Mario Zechner 版权与完整许可条款。
- 增加无依赖/无安装脚本的 Pi Package 清单，只暴露根 SKILL.md；本地 PackageManager 解析验证得到唯一 pi-agent skill，无扩展和诊断。
- 验证包增加显式 version，移除锁文件中 313 个临时路径/冗余条目，保留 206 个实际依赖的版本与 integrity；验证说明不再包含作者机器绝对路径。
- 新临时目录 npm ci 后，严格类型、离线行为与161个文档块/hook再次通过。公开内容检查未发现真实 token、私钥或个人临时路径；不包含 node_modules、日志和系统缓存。
- 公开仓库与当前全局 skills 仓库分开，不推送其他 skills。发布仅为 GitHub 仓库，未执行 npm publish。

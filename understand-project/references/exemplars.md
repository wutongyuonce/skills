# 同系列「看懂 X」成稿样例

写作 `看懂 X` 文档时对照以下三篇的节拍、结构与手法。三篇均为同一作者/风格的 Agent-Memory 生态项目解析，覆盖三种量级，适合作为粒度对照样本。

## 1. memU —— 小/轻量、CLI、本地优先（对照：小型项目的讲法）

- 路径：`/Users/a/Desktop/WorkSpace/ALL/Notes/markdown/开发/技术栈/AI&Agent&Infra/Memory/memU.md`
- 标题：《看懂 memU：从运行方式到完整记忆链路》，约 741 行（含图）。
- 结构看点：TLDR 双链路图 → 为什么需要宿主 Agent（职责边界）→ 整体架构（不急着看类名）→ 运行形态（是一组 CLI；**专门论证「没有常驻的本地 MemoryService 进程」**）→ 本地版 vs Cloud 版 → 两条纵向链路（Session→记忆 的八层切分；新问题→取回旧记忆）→ 三类保存内容 → 宿主与操作系统两个扩展维度 → 总结。
- 值得学：小项目如何把「轻量形态 + 无常驻进程 + 靠 cron/宿主定时」讲实；链路切层命名（宿主层/增量层/准备层/Agent 整理层/结果收集层…）。

## 2. OpenViking —— 中/服务型、daemon + 多链路（对照：服务型项目的讲法）

- 路径：`/Users/a/Desktop/WorkSpace/ALL/Notes/markdown/开发/技术栈/AI&Agent&Infra/Memory/OpenViking.md`
- 标题：《看懂 OpenViking：从服务运行到上下文写入、检索与记忆提取》，约 624 行。
- 结构看点：TLDR → 为什么不能只用普通向量库 → **先看运行形态：每个 CLI Agent 的伴生 daemon（daemon 接在宿主的哪一侧）** → 整体架构（接入层到底层存储）→ 三个核心概念（URI / Resource-Memory-Skill / L0-L1-L2）→ 最小可运行实践 → 三条纵向链路（资源进入上下文库 / 新问题取回上下文 / Session→长期记忆，每条链路内部再切子步骤）→ Agent 集成职责 → AGFS+向量索引 → 失败边界与排错（现象→该查哪条链路）→ 阅读源码的最短路线 → 总结。
- 值得学：服务型项目如何讲「daemon 伴生」与「接在宿主哪一侧」；同步归档 vs 异步摘要的区分；「内容已写入 ≠ 可完整检索」类非同时点。

## 3. Letta Code —— 大/巨型代码库（对照：大项目如何控场、如何给源码顺序）

- 路径：`/Users/a/Desktop/WorkSpace/ALL/Notes/markdown/开发/技术栈/AI&Agent&Infra/Memory/Letta Code Memory.md`
- 标题：《看懂 Letta Code：Stateful Agent 与 MemFS 记忆机制》，约 342 行（最短但最凝练）。
- 结构看点：TLDR **用一句话否定式定义开局**（「它不是聊天记录检索 + 向量数据库」）→ 实体树（Agent 拥有 Conversation + MemFS）→ 先分清 Agent / Conversation / Recall / MemFS → 记忆目录组织 → 与记忆有关的项目结构 → 三种运行形态（表格化）→ 主链路 / 写入链路 / Dreaming 后台提炼 → 概念边界（压缩 vs 检索）→ 常见误区 → 一张图串起完整机制 → **源码阅读顺序（8 组文件路径，每组一句「看了能懂什么」）**。
- 值得学：大库讲法 = 概念先行 + 实体树 + 精确到文件组的阅读顺序；全文克制在文件级不铺类图。

## 共性要点（三篇都在做）

1. 文首 epigraph：受众 + 源码基线 commit + 参考资料。
2. 先 TLDR 一图（text 箭头流或实体树），再展开。
3. 「运行形态」单独成章并落到证据（命令/进程/cron/安装产物）。
4. 纵向链路按语义节点切层，节点标注载体与同步/异步。
5. 稳定事实 + 易变细节分开标注；Alpha 项目声明「稳定认知放职责边界与数据流」。
6. 收尾：3～5 条稳定事实 + 一条主线 text 图 + 源码阅读顺序 + 参考资料。

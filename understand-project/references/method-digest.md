# 「看懂 X 项目」系列写作方法 digest

> 抽取自三篇中文项目解析：《看懂 memU：从运行方式到完整记忆链路》(741 行)、《看懂 OpenViking：从服务运行到上下文写入、检索与记忆提取》(624 行)、《看懂 Letta Code：Stateful Agent 与 MemFS 记忆机制》(342 行)。只抽取"作者怎样给小白讲懂一个项目"这一层，不涉及项目本体内容。

## A. 每篇的章节骨架与"每章的写作目的"

### A1. memU（12 章）
1. TLDR：两条链路 text 图 + "所以它不是…"否定清单——先给全局最小模型
2. 为什么需要宿主 Agent 参与：用正反例子（该存/不该存）解释一个架构判断，产出四行职责分工（Agent 管质量 / memU 管流程 / Markdown 是交接结果 / embedding 只管搜索）
3. 先看整体架构，不急着看类名：截图架构 png + 五层 text 图 + 每层"收到什么→做什么→产出什么"表
4. 实际怎样运行：它主要是一组 CLI：**全篇信息量最密的一章**——4.1 安装了什么（包+本地文件+定时任务）；4.2 没有常驻进程（两张前后台进程关系图论证）；4.3 两套独立入口；4.4 不同 Agent 怎样定时执行 Record（调度方式对照表 + 两种 adapter 小节 + 对照插件案例）
5. 本地版和 Cloud 版有什么区别：四列对照表（数据去向 / 用户要运行什么 / 网页能否看到），再拆 SQLite、PostgreSQL 两节各讲一遍"embedding 由谁算"
6. 第一条纵向链路：8 个小节各是一"层"，逐层推进；6.6 单独讲"先把最容易失败的外部调用做完"
7. 失败时哪些状态会变化：一张 4 列表格收束全篇可靠性模型
8. 最终保存的三类内容：每个类型一句话定义（Memory/Skill/Resource）
9. 第二条纵向链路：与第 6 章对照的取回链路
10. 不同 Agent 的记忆会不会放在一起：一句 FAQ 式提问当标题
11. 宿主和操作系统是两个不同的扩展维度：破除"多平台 = 各写一套算法"误解
12. 总结：一段话 + 两条链路用文字重述

材料使用：结构图 png ×2，其余几乎全部是 **text 图 + 表格 + 少量命令/配置名**。

### A2. OpenViking（14 章）
- 引言 blockquote：前置知识声明 + **源码基线（commit + 日期）+ Alpha 声明 + 参考资料 URL 列表**
1. TLDR：三条链路 text 图 + "不是…"否定清单
2. 为什么不能只用普通向量库：罗列普通 RAG 的 chunk 说不清的 5 个问题 → 引出"真实目录树 + 派生索引"的架构结论
3. 先看运行形态：Server 是核心运行时：HTTP 形态图 + 安装包三入口表 + 3.1 Agent 平台的伴生 daemon（平台图）/ 3.2 driver 协议族表 / 3.3 接在 daemon 哪一侧
4. 整体架构：六层（接入→传输→Service→处理与检索→队列→存储）+ 每层边界表
5. 三个核心概念：5.1 目录树样例 5.2 三类来源 5.3 L0/L1/L2 读取深度
6. 最小可运行实践：pip install + 命令序列 + `--wait` 语义 + 最小排错顺序
7–9. 三条纵向链路，每条 4–6 个"每节一小图"小节
10. Agent 集成真正负责什么：接入方式表 + 一次典型回合链路
11. 存储层为什么是 AGFS + 向量索引
12. 失败边界与排错方法：5 条"症状→检查顺序→别急着怀疑什么"
13. 阅读源码的最短路线：4 组文件链
14. 总结：四个稳定事实 + 一条主线 text 图

### A3. Letta（342 行却有 15 章）
1. TLDR：**标题即否定句** + Agent 实体树 + 一次对话核心链路
2. 先分清 Agent / Conversation / Recall / MemFS 四个概念：每小节一个定义 + 隔离边界
3. 记忆目录怎样组织：目录树 + frontmatter 样例 + "目录位置决定加载策略"
4. 与记忆有关的项目结构：src/ 树，15 个文件各带一行人话注释，末句给"拆分边界"
5. 三种运行形态（Cloud / Local backend / 不支持 MemFS 的远端）
6. 主链路：一次用户消息（启动→编译→请求）
7. 写入链路：Agent 怎样真正"记住"
8. Dreaming：后台提炼（触发器表 + worktree 并发隔离链路）
9. Shared Memory：共享的是仓库不是身份
10. Skills 属 memory 体系但不是普通记忆（来源表）
11. Compaction / Recall / MemFS 三者边界表
12. 两套布局兼容细节：告诉读者"理解主链路按 v1 即可"
13. 常见误区：3 条"错。正。"
14. 用一张图串起完整机制：全篇唯一大图收束
15. 源码阅读顺序：8 步
- 参考资料 URL 列表收尾，无独立"总结"章

## B. 文档开篇惯例（0–80 行内建立全局认知）

- **TLDR 两种模板**：① memU/OpenViking——"它做的事情可以压缩成 N 条链路"配 text 图，随即接否定清单「所以它不是：一个新的聊天 Agent / 一个始终运行的本机记忆服务器 / …」，再落一句正面定义（"它是一套安装在现有 Agent 旁边的记忆基础设施"）；② Letta——章节标题即否定（"它不是'聊天记录检索 + 向量数据库'"），正文给一棵 **Agent 实体树**（`Agent ├─ identity ├─ Conversation A/B └─ MemFS`）代替链路图。
- **先给结论性事实再展开**：第一屏先划定"谁负责什么"。memU："这里最重要的事实是：memU 自己不负责理解整段对话并写总结…仍然是宿主 Agent"；OpenViking："不要把 `ov` CLI 和 Server 混在一起理解…真正完成检索的是正在运行的 Server"，"Agent 插件也不是数据库本体"。
- **权威数据源尽早点名**：OpenViking "AGFS 是权威内容，向量库是派生索引"、Letta "Git Markdown 才是当前 MemFS 的持久事实来源"、memU "SQLite 只负责保存向量，不负责计算向量"——这类句子都出现在章节内部（而非结尾），作为读者后续判断的锚。
- **基线/易变信息与稳定认知显式分开**：OpenViking 引言 blockquote 写"本地仓库提交 `f494fc9d`（2026-08-21）。OpenViking 仍处于 Alpha 阶段，命令和内部模块可能继续变化；稳定认知应放在职责边界和数据流上"；Letta 引言写版本 `0.31.11` + 本地 commit + 文档日期，"旧版 memory block API 只在兼容边界中说明"；memU 以句式区分，如"文档中的'记忆服务层'是代码职责，不等于一台持续监听端口的服务器"。行文中还有过程性提醒："理解失败边界比记住命令更重要"（memU 第 7 章）。

## C. "运行形态"是怎么讲的（重点）

每篇都用**一整章**回答"它到底是 CLI / 服务 / daemon / 库"，证据取自安装产物、进程生命周期与入口表，而非 README 自述：

- memU（纯 CLI，无常驻进程）：章题即结论——"memU 实际怎样运行：它主要是一组 CLI"。证据链：安装的是 Python 包 `memu-cli`（提供 `memu`、`memu-codex` 等命令）→ 安装还产生 config/指令/游标/定时任务四类本地文件。**无常驻论证原文**（4.2）：
  > "文档中的'记忆服务层'是代码职责，不等于一台持续监听端口的服务器。"
  > "每次运行 CLI 时，它会在当前进程内创建一个 `MemoryService` 对象…然后随 CLI 一起退出。用户不需要另外启动 `memu-server`、FastAPI 或 Uvicorn。"
  再给两张进程关系图（前台 retrieve 一条、后台 cron 一条）证明"无头 Agent 进程…退出"的短生命周期。定时也分层讲：三列对照表（OS 调度器 + headless CLI / 宿主原生任务系统 / Generic adapter），并纠正直觉："定时器通常不直接执行 `prepare`。它先启动无头 Agent，并把 bridging prompt 交给 Agent"；用"谁执行"表把三段流程标为 prepare=纯代码 / self-evolve=模型工作 / commit=纯代码。
- OpenViking（常驻服务 + CLI + 插件三件套）："先看运行形态：Server 是核心运行时"，给 HTTP 图 `openviking-server :1933`；三入口表一行一个实际职责（server 启动服务 / `ov` 是客户端 / vikingbot 是 Agent 框架）。**关键论证句**："不要把 `ov` CLI 和 Server 混在一起理解。执行 `ov find` 时，真正完成检索的是正在运行的 Server"。再往上加一层：3.1"每个 CLI Agent 的伴生 daemon"平台图，3.2 用 driver 协议族表说明 daemon 怎样消解不同 CLI，3.3 才回答"OpenViking 接在 daemon 的哪一侧"。异步后台处理贯穿全文："内容写入和'可完整检索'不是同一时刻"（7.6）、"commit 分同步归档和异步提取两阶段"（9.2）、"`--wait` 的意义不是让上传本身同步"（6）。
- Letta（三种形态并列）：按 backend 能力枚举 5.1 Cloud（clone/pull，写完先本地 commit、turn 结束再 push）/ 5.2 Local backend（"仍是 Git 仓库，但没有 Letta remote…不执行云端 push"）/ 5.3 不支持 MemFS 的远端（"退回兼容的 standard memory prompt"）。判定式语气："MemFS 是一个真实的 Git checkout，不是虚拟 API 名称"、"不能因为'连接的是 Letta API'就假设一定存在本地 Git 记忆仓库"。**后台提炼（Dreaming）**："不是固定规则抽取器，而是后台 reflection subagent"，触发条件用表（compaction-event / step-count / off），"worktree 的作用是并发隔离：后台 Agent 不直接改主 Agent 正在使用的 checkout"。
- 共性模式：**"运行形态 = 扩展接入"绑定讲**——宿主 Agent（Letta CLI/harness）、平台插件（OpenViking）、OS 调度 + host bridging（memU）分别决定了常驻与否、触发者与生命周期；"先讲清它是被谁拉起来的进程，再讲它内部做什么"。

## D. "纵向核心链路"的讲法（重点）

**切层规范**：链路被切成 5–8 个以"层/小节"命名的最小段，每段标题回答"这一层收到什么、做什么、产出什么"，段与段之间用一行 `→` text 图连接。memU 第 6 章示例节题连读即链路：宿主层→增量层→准备层→Agent 整理层→结果收集层→向量准备层→存储层→状态确认层。OpenViking 用同样的层命名做章节：入口(Router 只做协议适配)→路由(不同来源先走不同获取方式)→获取与解析→提交→语义处理→完成状态。

**同步/异步逐层标注**：memU 把"哪步同步、哪步异步"讲成时序设计：6.6"先把最容易失败的外部调用做完"——"网络错误和 rate limit 最常发生在 embedding 阶段。让它在第一次数据库写入之前完成，可以保证 embedding 失败时原记忆库完全不变"；OpenViking 9.2 用分块图明示前后两段，并给判定句：
```
同步阶段：当前消息 → 写入 archive_NNN/messages.jsonl → 清空 → 返回 archive_uri + task_id
异步阶段：归档消息 → 生成 abstract → 提取候选 → 查相似 → skip/create/merge/delete → 写索引
```
"“commit 已接受”只证明同步归档完成并创建了后台任务；长期记忆是否已经更新，要继续查询 task 状态。"

**状态与失败当作一等公民**：每个链路都有"完成状态 ≠ 数据就绪"的澄清（memU 6.8"成功后才推进 Cursor"、"如果中途失败，正式 cursor 不前移。下次运行会重新处理这批 session"；OpenViking 7.6"内容写入和'可完整检索'不是同一时刻"；Letta 6.2"文件写入但未 commit，不会成为…正式核心记忆"）。memU 第 7 章更是整张表列出失败位置 × 已有记忆是否变化 × cursor 是否推进 × 下次怎样处理。

**值得引用的整图原文（Letta 第 14 章，最小机制自包含）**：
```
用户输入 ── Letta Code ── Conversation recent / compaction summary
                         ├─ MemFS system/* committed content
                         ├─ external memory tree
                         └─ discovered client tools + skills → Model turn
                         正常工具/回答 ｜ 长期信息值得保存 → memory tool
                         → validate → write → git commit → cloud push / local HEAD
                         → 下次 prompt 编译看到新 revision
turn 完成 → transcript delta → trigger → reflection worktree → subagent commit → merge
```

## E. 代码架构 vs 实际层级架构的差别呈现

- 关键手段：**先画一张"文档视角的模块/职责图"，再用一章"运行形态"揭穿它的进程真相**。memU 第 3 章五层图里有"记忆服务层"这样的模块命名，第 4 章标题直接说"它主要是一组 CLI"，4.2 澄清"'记忆服务层'是代码职责，不等于一台持续监听端口的服务器"——同一词汇分两个视角讲，图负责职责、文字负责进程。OpenViking 顺序相反但等效：第 3 章"先看运行形态"先立进程事实（Server/daemon/插件三层各有实体），第 4 章"整体架构"才给逻辑分层（接入→传输→Service→处理与检索→队列→存储），并用组合根说明防误解："`OpenVikingService` 是组合根…它不是一个包办全部业务的大函数；HTTP Router 也不会直接操作底层文件。"
- **引导句原文**：memU 第 3 章标题即"先看整体架构，不急着看类名"，正文接"从上到下，memU 可以理解成五层"；OpenViking 第 13 章"先沿三条调用链读，不要从所有 parser 或 memory 类型开始"；Letta 第 15 章"建议按调用链而不是按文件名散读"。
- 类名只在"它恰好是真实分层边界"时才出现（组合根、authority 存储、Router 只做适配）；Letta 反其道用注释化解：项目结构树每个文件一行人话，末尾总结"这套拆分的边界是：backend 管对话和模型请求，agent 层管持久 Agent 状态…"。memU 还有一章专治此类概念混淆："'支持 macOS、Windows、Linux'不代表每个平台各写了一套记忆算法"（宿主 vs OS 是两轴）。

## F. 收尾惯例

- **"总结/一条主线"**：OpenViking 14 章先给"四个稳定事实"（1. 独立服务，插件管接入时机；2. 目录树是权威、向量是派生；3. 三类内容共享体系；4. 三条链路可独立成败、排错分开验证），再给"如果只记一条完整主线"的 text 图。memU 12 章以一段话 + 提取/检索两条链路文字重复开头 TLDR 但粒度更细。Letta 不设总结章，靠 13 常见误区 + 14 大图收束。
- **"常见误区"**（仅 Letta 成章）：每条"错。正。"两句式，如"每轮会把整个 MemFS 塞进 prompt。错。"——等价于把 TLDR 的否定清单展开成论证。
- **"失败边界与排错"**（仅 OpenViking 成章）：以用户可观测症状为标题（"资源能浏览，但语义搜索不到"），每条给分层检查顺序 + "不要先怀疑 X"的引导（"检查 `task_id`、后台队列和模型配置，不要先怀疑 Parser"）。
- **"源码阅读顺序"**：从运行入口一路点文件。OpenViking 13 章给 4 组文件链：`pyproject.toml → openviking_cli/server_bootstrap.py → openviking/server/app.py → openviking/service/core.py`（服务启动）、routers→service→parse→queue 处理器（资源写入）等，每组末句点明该链"重点看什么差异"。Letta 15 章给 8 步编号链，每步 = 文件 + 一句"该文件回答什么"（如 `src/agent/memory-filesystem.ts`：路径、启用、clone/pull 入口），并把链路终点连回行为概念（post-turn-reflection → reflection-launcher → memory-worktree = Dreaming 完整链路）。memU 无源码顺序章——它自述志在运行形态而非代码。
- **参考资料**：OpenViking 放引言（blockquote 一列官方 README/博客 URL），Letta 放文末（按概念分组的 markdown 链接列表）。

## G. 语言与格式惯例

- 语气面向小白但有前置声明门槛：memU 引言"本文面向第一次接触 memU 的读者。重点不是罗列类名和文件名"；OpenViking 引言"面向第一次接触 OpenViking、但已经了解 Agent 和 RAG 基本概念的读者"；Letta 不加声明但先立四个术语定义。
- 避免罗列类名：术语带代码样式 `memu prepare`、`SearchService.find()`，但**每出现一个专名必给一行人话**（"prepare：纯代码，读取增量、生成 jobs"）；文件树配注释。表格是仅次于 text 图的第二武器（调度方式、同步异步、边界机制、接入方式、记忆类型全用表）。
- text 图/树/箭头用法分级：链路由 `→` 单行推进；实体关系用 `├─└─` 树；多角色流程用 `┌──▼──┐` 画框；单帧大图用来收束全篇。图必须与上下文同屏可读，无外部依赖（png 图仅 memU 两处、带 zoom 注释）。
- 判定式句式高频，直给结论："所以它不是…" / "不要把…混在一起理解" / "…不是对话摘要的另一个名字" / "没有向量检索就没有长期记忆不成立"（Letta 第 11 章）/ "…不能推导出…"（memU 第 10 章）。正确性靠"边界句"兜底：明确说清当前可靠性边界（memU"当前整个 commit_results 没有一个包住所有 repository 写入的总事务。这是当前可靠性边界"）。
- 版本与链接引用：基线信息走 blockquote 或引言首行（commit hash、版本号、日期、"Alpha 阶段"字样）；外链只放权威源（官方 README/docs/blog/repo），不放二手。

## H. 三篇的差异对照（一篇就够点明）

三篇共用同一骨架（TLDR→为什么→架构→运行形态→N 条链路→失败/边界→收尾），详略随项目量级与运行复杂度而变：

| 维度 | memU（741 行） | OpenViking（624 行） | Letta（342 行 / 15 章） |
| --- | --- | --- | --- |
| 运行形态占位 | 第 4 章前置 + 双进程图，**论证"没有常驻进程"** | 第 3 章先立 Server + 伴生 daemon 两层进程事实 | 第 5 章按 backend 枚举三形态，短表即止 |
| 链路数量 | 2 条、单条切 8 层最细 | 3 条、每条 4–6 小节 + 同步异步两阶段图 | 主/写/后台 3 条，压缩成 6–8 章各 3 小节 |
| 概念拆章 | 少（职责分工并入正文） | 中等（5 章概念 3 小节） | 最多（第 2 章拆 4 概念 + 第 12 章兼容布局 + 11 章机制边界） |
| 代码导航 | 无（自述不讲代码） | 13 章 4 组文件链 | 第 4 章文件分布 + 15 章 8 步顺序 |
| 收尾特色 | 失败状态表 + 两段式总结 | 症状式排错 5 条 + 四稳定事实 | 常见误区 3 条 + 全篇一图 |
| 详略规律 | 运行形态论证 > 概念拆分 | 进程/接入层次 > 概念 | 概念边界与源码导航 > 链路展开 |

一句话对照：**复杂度与"读者要不要读源码"决定篇幅投向**——memU 把力气花在"它明明没装服务器，怎么定时跑起来的"（CLI、本地优先），OpenViking 花在"Server、CLI、daemon、插件谁在什么进程里、三条链路何时成败"（服务 + daemon），Letta 花在"先把 4 个概念和 3 套边界切干净，再给文件级顺序"（代码库大、15 章）。共通底线：TLDR 给否定 + 链路图、正文只留 text 图 + 表格 + 带注释的专名、结尾给"可独立验证的稳定事实"。

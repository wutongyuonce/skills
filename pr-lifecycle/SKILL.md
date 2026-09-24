---
name: pr-lifecycle
description: Manage a non-trivial pull request from issue/spec clarification through design, implementation, review fixes, test ablation, and final re-review. Use whenever implementing an issue across modules, drafting or updating a PR design report, responding to PR review, auditing rule ownership or module seams, or preparing a PR for final review—even when the user only says “continue this PR”, “处理最新 review”, or “检查设计边界”. Skip for tiny one-line fixes and purely read-only PR summaries unless the user asks for design or process analysis.
---

# PR Lifecycle

把 PR 当作一份持续收敛的契约：先确定系统必须满足什么，再决定由哪些 module 通过哪些 interface 实现；代码、测试和设计报告始终与当前契约一致。

用户的明确要求优先于本 Skill。项目自己的 `AGENTS.md`、`CONTRIBUTING` 和仓库规范决定具体命令与交付要求；发现冲突时指出冲突并采用更具体的项目规则。

## 1. 先区分四类内容

不要把所有决定都叫作 RULE。

| 内容 | 回答的问题 | 归属 |
|---|---|---|
| 开发过程规则 | Agent 应该怎样完成 PR？ | `AGENTS.md` |
| SPEC | 系统必须满足什么完整行为契约？ | Issue、规格文档或被确认的设计评论 |
| 架构设计 | 哪个 module 负责，interface 和 seam 在哪里？ | 当前设计报告 |
| 实现机制 | 具体用什么算法、数据结构和代码完成？ | 设计报告的实现部分与代码 |

SPEC 不是 RULE 的简单集合。完整 SPEC 应包含：

```text
背景与问题
  -> 范围和参与者
  -> 用户场景与可见行为
  -> 产品规则和不变量
  -> 失败、并发与资源语义
  -> 非目标和可接受取舍
  -> 验收标准
```

RULE 是其中一条局部必须成立的事实。场景、顺序、依赖、失败结果和验收标准把这些 RULE 组织成完整视图。

设计报告负责把 SPEC 中的义务分配给唯一 authority：

- **Module**：同时拥有 interface 和 implementation 的结构。
- **Interface**：调用方正确使用 module 必须知道的一切，包括不变量、顺序、错误和性能特征。
- **Seam**：module interface 所在的位置；行为可以在这里替换而不用修改调用方。
- **Authority**：最终决定某条规则、状态或错误语义的唯一 module。

算法和存储方案通常是实现机制，不要在没有必要时把它们升级成 SPEC。只要外部契约不变，机制应当可以替换。

## 2. 生命周期总览

```text
Issue / 用户目标
  -> 事实恢复
  -> Grilling 决策树
  -> SPEC 门禁
  -> 设计门禁
  -> 实现循环
  -> Review 循环
  -> 消融与最终一致性审查
  -> 请求 re-review / 合并
```

在每个阶段维护三个简短状态：已经确认、当前正在处理、尚未解决。不要因为流程本身阻塞已经获得授权的安全工作；只有尚未确定的产品或设计决定会实质改变结果时，才向用户提问。

## 3. 阶段 A：恢复事实

编码或评价方案前：

1. 阅读 Issue/SPEC、当前 PR 描述和设计报告。
2. 阅读项目 `AGENTS.md`、`CONTRIBUTING`、架构文档、PR 模板和相关验证脚本。
3. 阅读相关 exports、直接 callers/callees、共享 utilities 和现有测试。
4. 查看当前 diff、提交历史、review threads 和 CI 状态；区分当前实现、已废弃中间实现和基线问题。
5. 写下仍然缺失的事实。能从仓库或工具查到的事实自己查，不询问用户。

输出一个短事实摘要：原始问题、当前行为、目标行为、已有约束、未知决策。

## 4. 阶段 B：用 Grilling 形成 SPEC

当需求存在未决策分支时，使用 `grilling` Skill；若不可用，则按相同方式分轮追问。Grilling 是发现和确认决策的方法，不是 SPEC 本身。

按依赖顺序遍历决策树：

1. 根问题：用户、问题、成功结果、范围、非目标。
2. 行为分支：主要场景、顺序、不变量、重复操作和状态变化。
3. 异常分支：失败、部分成功、取消、恢复、并发变化。
4. 约束分支：数据规模、资源上限、兼容性、安全和性能。
5. 验收分支：什么证据足以证明每项义务成立。

只有当前置决策确定后，才追问依赖它的下一层。事实由 Agent 查，真正改变产品结果的决定由用户确认。

当决策树的待决前沿为空，并且用户确认双方理解一致时，Grilling 才算结束；在此之前不要把未经确认的选择写成 SPEC 事实。

SPEC 门禁：能够用 [references/spec-and-design-template.md](references/spec-and-design-template.md) 的 SPEC 部分完整描述行为，且每条验收标准都能追溯到一个场景、RULE 或不变量。不能通过门禁时，不要直接选择实现机制。

## 5. 阶段 C：完成设计报告

先建立 authority 表：

```md
| Rule/state/error/resource | Authority module | Interface/seam | Callers | Evidence |
```

逐项检查：

- 每条规则是否只有一个 authority？
- 调用方是否在重新推断结果或复制判断？
- source-specific knowledge 是否留在对应 adapter？
- 错误的产生、标准化和展示是否由不同职责清楚承担？
- 资源由谁测量、在哪里限制、超限如何呈现？
- interface 是否暴露了调用方不需要知道的内部机制？
- 删除这个 module 后，复杂度会消失，还是扩散到所有 callers？只有后者说明 module 真正提供了 locality。
- 当前方案是否实现了 SPEC 没要求的更强保证？

然后补全主要数据流、失败流、并发/资源语义、明确取舍和义务到测试的映射。使用 [references/spec-and-design-template.md](references/spec-and-design-template.md)。

设计报告是当前实现契约，不是开发日志。历史决策可以放在 review 回复或单独 decision log 中；最终报告删除废弃机制、迁移设想、一次性脚本和中间版本叙述。

## 6. 阶段 D：规划和实现

把工作拆成按义务组织的最小切片，而不是按文件或 review comment 组织。

每个切片执行：

1. 重述要满足的 SPEC 义务。
2. 确认 authority 和受影响的 interface。
3. 搜索所有 sibling callers，避免只修一个入口。
4. 在 authority 中实现最小机制。
5. 添加能够在旧行为上失败的最小 owner-level 测试。
6. 仅在真实 seam 上增加必要的集成测试。
7. 同步更新当前设计报告和义务到测试的映射。
8. 运行与本切片成比例的验证。

每个 commit 应表达一个可独立理解的义务、authority 修正或机制替换，并包含必要的代码、测试和设计更新。Commit message 描述结果和原因，不依赖“第几轮 review”的上下文。

出现以下任一信号时暂停叠加补丁并返回设计门禁：

- 一个局部修复引入多个 package 的新状态；
- 新增协议字段、错误码、TTL/LRU、缓存或客户端恢复状态；
- 同一规则出现在两个以上 module；
- 测试必须穿透 interface 才能验证行为；
- 需要大量 UI 文案解释内部生命周期；
- 无法明确说出新增复杂度对应哪条 SPEC 义务。

## 7. 阶段 E：处理 Review

先把每条 finding 分类为：

- 功能或正确性错误；
- authority、interface 或 seam 问题；
- 超出 SPEC / 过度设计；
- 测试重复或测试错误对象；
- 设计报告与实现漂移；
- 项目规范或验证问题。

然后执行：

```text
Review 现象
  -> 被违反的 SPEC 义务
  -> 真正 authority
  -> sibling callers 和相邻规则
  -> 最小根因修复
  -> owner-level regression
  -> 设计报告同步
```

Reviewer 的具体修改建议是重要证据，但不是必须机械执行的代码指令。若建议保护的是超出 SPEC 的更强保证，应说明取舍，选择满足真实义务的最小方案。

每轮结束后进行横向审查：有没有其他 caller 重复同一规则？有没有新机制取代旧机制却未删除旧代码、文案或测试？有没有把 source knowledge 移进共享 core？

## 8. 阶段 F：测试消融与最终审查

发生架构调整，或经历两轮以上实质性 review 后，主动执行消融。使用 [references/review-and-ablation-checklist.md](references/review-and-ablation-checklist.md)。

为每个最终义务找到最直接的 owner-level 测试，并验证它在破坏该规则时会失败。若多个测试因同一原因失败，优先保留更靠近 authority、更快、更稳定、更能表达意图的测试。

删除或替换：

- 已废弃机制对应的测试；
- 多层重复验证同一 RULE 的测试；
- 只覆盖 reviewer 点名位置、无法覆盖 sibling caller 的测试；
- 修改前就能通过的无效 regression；
- 用巨大 fixture 模拟可注入小上限的测试；
- 用 wall-clock 或进程内存波动证明逻辑有界性的测试。

最终门禁：

1. Issue/SPEC、设计报告、代码和测试一致。
2. 每条规则、状态、错误和资源限制都有唯一 authority。
3. 没有废弃机制、重复推断和过期文档。
4. 每个保留测试都能对应最终义务或真实 seam。
5. 已运行项目要求的 build、format、lint、typecheck 和 tests；未运行或失败的项目被明确报告。
6. PR 摘要保持简洁，并链接详细设计；最终设计报告只描述当前实现。
7. AI review 只作补充，不替代项目要求的人类 approval。

## 9. 输出要求

进行中的更新保持简短，说明：已经完成、验证结果、下一项义务。

设计或 review 汇总应优先给出：

1. 当前结论；
2. SPEC 义务；
3. authority/interface 变化；
4. 删除或拒绝的复杂度；
5. 测试证据和未验证项。

不要把开发历史写进最终设计，但要在 review 回复中诚实说明重要设计变化及原因。

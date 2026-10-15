# Review 与消融检查表

## Review convergence

- [ ] 本轮审查覆盖当前完整 PR diff、相关模块和 SPEC，并说明审查重点。
- [ ] 每条 finding 已核实；确认的问题全部修复，不成立或超出 SPEC 的建议有判断依据。
- [ ] 每次修复或消融后均完成相关验证，并基于修改后的版本再 review。
- [ ] 前一两轮后按需加深模块 authority 边界、过度设计、过度测试和测试消融审查；重点没有替代完整审查。
- [ ] 最后一轮完整 review 没有进一步需要解决的问题，且此前没有未解决的问题。
- [ ] 没有因为轮数、测试通过或问题较小提前结束；外部阻塞或待决契约被明确报告为未完成。

## Review finding

- [ ] 用一句话重述用户可观察的问题。
- [ ] 指出被违反的 SPEC 义务；若不存在，先判断是否超出范围。
- [ ] 找到规则的唯一 authority，而不是只看被评论的文件。
- [ ] 搜索所有 sibling callers 和重复实现。
- [ ] 确认修复没有引入更强但未要求的保证。
- [ ] 在 authority interface 上增加或调整最小 regression。
- [ ] 同步更新设计报告；删除被取代机制的描述。

## Mechanism audit

- [ ] 是否新增跨 package 状态、协议字段或错误码？对应哪条 SPEC 义务？
- [ ] 是否新增缓存、TTL、LRU、锁或长生命周期资源？谁负责释放？
- [ ] 是否让 UI/客户端理解了原本属于 Host、runtime 或 adapter 的内部状态？
- [ ] 是否把只有一个 source 使用的格式知识提取到共享 core？
- [ ] 是否能用更小、无状态或已有机制满足同一义务？

## Test ablation

- [ ] 为每条最终 obligation 找到最直接的 owner-level test。
- [ ] 临时破坏规则时，该 test 确实失败。
- [ ] 删除已废弃中间机制对应的 test。
- [ ] 删除多个层级对同一 RULE 的弱重复测试。
- [ ] 删除在修复前已经通过的伪 regression。
- [ ] 用可注入小上限替代巨大 fixture。
- [ ] 用确定性的调用次数、行数或字节数代替 wall-clock / maxRSS 猜测。
- [ ] 只保留验证真实 interface/seam 的必要 integration test。
- [ ] 消融后最终义务仍有有效测试覆盖，相关验证通过，并已重新 review。

## Final consistency

- [ ] Issue/SPEC、设计报告、实现和测试描述相同的行为。
- [ ] 每条 RULE、状态、错误和资源上限只有一个 authority。
- [ ] 最终设计报告没有中间实现历史、废弃路径或失真 benchmark。
- [ ] PR summary 简短并链接详细设计。
- [ ] 项目要求的验证均已运行，或明确说明未运行原因。
- [ ] 当前 head 的 review 和 CI 状态已重新确认，最后一次完整 review 后没有未经再次 review 的修改。

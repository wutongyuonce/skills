# 按需推荐 Pi 扩展

只在用户要求推荐/搜索扩展时执行。SDK 维护核对本流程不代表已经查询当前社区包；名字、下载量和排序结果不能凭历史记忆生成。

## 搜索与筛选

1. 确认用户意图、运行模式（SDK/CLI）、所需工具/资源及权限边界。
2. 搜索 npm 的 `pi-package` keyword；附加需求词帮助排名，再根据返回的 description/keywords/README 实际筛选，不保证附加词只会扩大结果。
3. 如果需要更大覆盖，用 `from` 分页，说明页数/上限及未覆盖范围；单个 size=50 查询不是全生态审查。

可用的 registry 查询示例：

```bash
curl -fsSG 'https://registry.npmjs.org/-/v1/search' \
  --data-urlencode 'text=keywords:pi-package' \
  --data-urlencode 'size=50' \
  --data-urlencode 'from=0'
```

用户需求词、scope 包名和下载 API 参数必须 URL encode，不能直接把任意用户文本拼进 URL。使用宿主可用的联网工具或 curl/npm；`WebFetch(url,prompt)` 之类命名不是 Pi SDK 方法。

## 核对候选

对每个准备推荐的包核对：

- 当前发布版和发布日期，repository/readme、维护状态及许可证。
- 是否真提供所需功能，而非只因关键词相似。
- 是否按 Pi Package manifest 分发 extensions/skills/prompts/themes。
- 宿主 peer dependencies、所需普通依赖、Node/版本兼容性，以及 npm pack 中资源是否完整。
- 执行/文件/网络权限，安装脚本及潜在敏感配置读取。
- 下载量：优先记录返回的可选 monthly 字段；没有则查 downloads point API并记录其日期区间。不假定所有 search 响应都有该字段。

```bash
npm view '<包名>' version repository peerDependencies engines --json
npm view '<包名>' readme --json
```

score、searchScore 是服务返回的排名信号；不保证字段恒等、分量恒为 1 或分数固定范围。推荐理由来自功能与约束证据，不由分数单独决定。

## 交付与安装边界

给少量候选，逐个提供包名、核对版本、适用条件、风险、来源和明确的未验证项。没有实际查到满足条件的包时就说明未找到，不能虚构。

- 已知包可用 `pi install npm:<包>@<已核对版本>` 安装。
- `pi -e npm:<包>` 不保存配置，但仍下载、安装、执行；不是安全试用。
- `pi list` 列出配置，不审查源码。
- SDK 加载扩展另见 [A06](../scenarios/A06-load-extensions.md)，不能只复制 CLI 命令当 SDK API。
- 安装和升级修改用户状态，须符合其请求范围；只要求推荐时不自动执行。

安全边界见 [I04](../scenarios/I04-sandbox.md)，包分发见 [20](20-pi-package.md)。联网查询结果的时间、分页和限制随本次推荐报告保存，不写成永久事实。

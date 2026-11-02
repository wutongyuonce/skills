# Pi 1.2.0 文档验证

要求 Node `>=22.19.0`、Python 3。本次验收使用 Node 22.22.2、TypeScript 5.9.3。固定 SDK 与验证依赖见 package.json / package-lock.json；验证项目不代表使用 SDK 的业务项目也需要全部这些依赖。

## 隔离运行

将 `SKILL` 设置为本 skill 的绝对路径。复制验证项目到临时目录，不升级项目或全局 Pi，也不在 skill 中创建 node_modules：

```bash
SKILL="$(pwd)" # 先进入仓库根目录，或改为 skill 的绝对路径
WORK=$(mktemp -d)
cp "$SKILL"/validation/{package.json,package-lock.json,tsconfig.json,check-sdk.ts,check-examples.mjs} "$WORK/"
cd "$WORK"
npm ci --ignore-scripts --no-audit --no-fund
npm run check:types
npm run check:runtime
node check-examples.mjs "$SKILL" "$WORK/example-results.json"
python3 "$SKILL/validation/check-docs.py"
# 检查完日志后可删除：rm -rf "$WORK"
```

安装依赖需要 registry/缓存；运行检查不调用真实模型。check-sdk 创建临时 cwd/agentDir，禁用模型网络刷新、analytics、cache warming、retry，拦截 fetch/Socket.connect，并在 finally 清理会话与目录。断言网络尝试数为零；这不是能阻止任意子进程联网的通用沙箱。检查不安装/运行第三方扩展或 shell。

## 检查边界

- `check:types`：验证脚本与包内全部 14 个官方 SDK 示例，严格 Bundler/ESNext 类型检查，无 skipLibCheck、声明补丁或 ts-ignore。只编译示例，不执行其模型请求。
- `check:runtime`：公共导入/factory、tagged native auth 和临时 credential store、auth overrides、create/reload/bind、工具选择/嵌套调用、user/custom 启动/确定性取消、事件两层路由、队列、结构化结果清理、默认新会话/显式磁盘恢复、context_edit/refreshContext 与模型历史权威性。
- `check-examples.mjs`：提取普通 Markdown TS fences；编译所有含 import 的语法完整块及完整 pi.on/register* hooks。为文中明确省略的应用变量补真实 SDK 类型/业务函数声明；不执行这些函数，也不用 any 消除 SDK 错误。项目 barrel 用类型正确的示例工具模块补上下文。输出 manifest 中区分 compiled、reference-fragment、signature-or-pseudocode、intentional-negative-example；quoted snippets、接口签名、伪代码和故意错误示例不宣称独立编译通过。
- `check-docs.py`：检查本地文件链接与当前安装 pins；不检查 Markdown heading anchors 或联网 URL。

本次示例统计：161 compiled、256 reference fragments、5 signatures/pseudocode、5 intentional negatives。这里的片段不是跳过的测试用例；签名/语义通过逐文件发布声明审查，单独片段不等于完整程序。新增或修改文档后统计可能变化。

## 已知上游声明限制

严格 NodeNext 检查当前发布包会失败：`pi-ai/dist/providers/*.models.d.ts` 的 JSON imports 缺少 `type: "json"` attribute（42 个 TS1543）。复现：

```bash
./node_modules/.bin/tsc --noEmit --strict --module NodeNext --moduleResolution NodeNext \
  --resolveJsonModule --target ES2022 --allowImportingTsExtensions --types node \
  check-sdk.ts node_modules/@earendil-works/pi-coding-agent/examples/sdk/*.ts
```

Bundler 检查不放宽类型，只使用另一种模块解析语义。本次不声称 NodeNext 通过，也不修补已发布依赖。Google GenAI 的 optional MCP peer 在验证项目显式安装 `@modelcontextprotocol/sdk@1.32.1`，避免其公开声明解析缺少模块。

未执行：真实 Provider/OAuth 网络交换、image/classifier 远程推理、MCP server 连接、Codemode VM 中运行脚本、CLI 子进程/UI/容器/Gondolin 的端到端测试。factory construction/类型检查通过不代表这些部署路径已测试。完整版本与逐文件覆盖见 [验收报告](../references/updates/1.2.0.md)。

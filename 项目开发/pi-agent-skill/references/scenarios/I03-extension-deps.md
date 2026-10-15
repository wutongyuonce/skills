# 扩展引用第三方依赖

## 依赖归属

扩展由 Pi 加载，但普通依赖仍由包管理器解析。包必须声明实际使用的第三方依赖；不要依赖宿主的偶然 hoisting 或另一个扩展的依赖。

宿主提供的 `@earendil-works/pi-coding-agent`、`pi-ai`、`pi-agent-core`、`pi-tui`、`typebox` 放在 `peerDependencies`，不要放进 `dependencies` 或 `bundledDependencies`。官方推荐的宿主 peer 声明：

```json
{
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-ai": "*",
    "@earendil-works/pi-agent-core": "*",
    "@earendil-works/pi-tui": "*",
    "typebox": "*"
  },
  "dependencies": { "diff": "8.0.4" },
  "pi": { "extensions": ["index.ts"] }
}
```

Peer 声明本身不是 npm 通用的“禁止下载”开关；Pi 的受管安装会抑制自动安装 peers。未使用的 peer 漏列也不会自动把内核打进 tarball。普通 dependencies 通常在消费者安装时解析；只有显式 bundledDependencies 才将依赖打包。

## 安装方式

- npm 源：Pi 在受管安装根执行安装，按检测到的 npm/pnpm/Bun 命令抑制 peers。
- git 源：克隆后安装生产依赖。配置 `npmCommand` 不代表恢复 devDependencies/自动 peers。
- local 源：直接加载原路径；Pi 不代替开发者安装其依赖。

目标版 git 依赖命令（`package-manager.js:getGitDependencyInstallArgs`）：

| 包管理器 | 参数 |
|---|---|
| npm | `install --omit=dev --legacy-peer-deps` |
| pnpm | `install --prod --config.auto-install-peers=false --config.strict-peer-dependencies=false --config.strict-dep-builds=false` |
| Bun | `install --omit=dev --omit=peer` |
| 未识别的自定义命令 | `install` |

自定义命令可用 `npmCommand` 数组配置。Pi 需要 Node `>=22.19.0`；版本管理器示例应使用满足该要求的版本。

## 模块身份与资源

Pi 的扩展加载器根据运行方式使用宿主映射、虚拟模块或别名；这些是实现细节，**不是物理副本永远被忽略的保证**。编译后的 ESM 可能解析到扩展自己安装的内核副本，造成重复运行时；目标版会为这种 manifest 发出警告。

普通第三方包可以使用相对模块、正确解析的 workspace 链接和各自的依赖版本。不同包可能被 hoist，也可能保留嵌套版本；不要假设所有扩展共享唯一实例。Bundling 解决分发路径问题，不提供权限隔离。

若把另一个包的 skills/prompts 等资源从自己的 manifest 引用，其路径须稳定地位于包内。可将资源依赖显式声明并 bundle，再用自己的 `pi.skills` / `pi.prompts` 等字段指向它。普通 JavaScript 导出则按模块 exports 导入，不通过资源字段调用。

## 可编译示例

下面依赖上述 manifest 的 `diff`；业务参数完整，工具声明使用宿主 TypeBox。

```ts
import { diffLines } from "diff";
import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "compare_text",
    label: "Compare text",
    description: "Compare two supplied text values",
    parameters: Type.Object({ before: Type.String(), after: Type.String() }),
    async execute(_id, params) {
      const changes = diffLines(params.before, params.after);
      return {
        content: [{ type: "text", text: JSON.stringify(changes) }],
        details: { changedParts: changes.filter(part => part.added || part.removed).length },
      };
    },
  });
}
```

插件安全边界见 [I04](I04-sandbox.md)。具体安装/加载实现以目标包 `docs/packages.md`、`dist/core/package-manager.js`、`dist/core/extensions/loader.js`、`dist/core/resource-loader.js` 为准。

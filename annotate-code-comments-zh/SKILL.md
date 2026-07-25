---

name: annotate-code-comments-zh

description: Adds structured Chinese code comments for files/functions. Invoke when user asks to annotate code, explain each function, or standardize comment style.

---

# 代码中文注释

把代码文件按统一的中文注释风格补充说明，适用于用户要求：

- “详细注释一下这个文件/这个模块”
- “逐个注释每个函数”
- “说明每个函数的定位、作用、调用关系”
- “按某种固定风格统一整理注释”

## 核心要求

输出的注释应满足这几个要求：

- 如果存在**原有英文注释**则翻译为中文后保留
- 中文为主，**专业术语保留英文原词**
- **不改变现有逻辑、控制流、类型和行为**
- 若文件已有注释，**优先统一风格**，而不是机械叠加

- **注释类型**包括**文件头注释、类注释、函数头注释、函数内部注释、字段注释**等
- **注释内容**包括**模块定位/职责、提供能力/功能、被谁调用、调用了谁、典型调用链、参数、返回值**等，不仅要考虑本文件内代码，还要考虑项目其余代码

- 类内部存在大量函数和字段并且可以**分类**的情况下，进行分类，调整顺序后再进行进一步注释
- 函数头只写**高层信息**，具体步骤在函数体内部每行代码**就近注释**，**按执行阶段分段**，解释“为什么这样做”，不只是复述代码字面意思

- 先通读文件，再决定注释密度，在注释内容完整、含义清晰的前提下**尽量保持精简**，**注释复杂度要与代码量匹配**，简单函数少写，复杂函数多写，不给每一行都加注释，比如简单的 getter、setter 函数只需一句话总结即可，没有调用者/参数/返回值就可以不写

## 参考模板

### 文件头注释

```ts
/**
 * 资源加载器模块
 *
 * 文件定位：coding-agent 的统一资源加载与管理层。
 *
 * 功能概述：
 * - 集中管理扩展、技能、提示模板、主题和上下文文件
 * - 合并用户级、项目级和 CLI 指定资源
 *
 * 调用链路：
 *   应用启动 → DefaultResourceLoader.reload() → packageManager.resolve() → 各资源加载器
 */
```

### 函数头注释

```ts
/**
 * 从指定目录中加载第一个找到的上下文文件。
 *
 * 定位：模块内部辅助函数，为 loadProjectContextFiles() 提供单目录级别的上下文发现能力。
 *
 * 被谁调用：
 *   - loadProjectContextFiles()
 *
 * 调用了谁：
 *   - node:fs.existsSync()
 *   - node:fs.readFileSync()
 *   - node:path.join()
 *
 * @param dir 要搜索的目录绝对路径
 * @returns 找到时返回 { path, content }，否则返回 null
 */
```

### 函数体内部步骤注释

```ts
function resolvePromptInput(input: string | undefined, description: string): string | undefined {
    // 空输入直接视为未提供。
    if (!input) {
        return undefined;
    }

    // 若输入本身是一个存在的文件路径，则优先读取文件内容。
    if (existsSync(input)) {
        try {
            return readFileSync(input, "utf-8");
        } catch (error) {
            // 文件可见但读取失败时，退回原始输入，避免彻底丢失提示词。
            console.error(chalk.yellow(`Warning: Could not read ${description} file ${input}: ${error}`));
            return input;
        }
    }

    // 不存在的路径按纯文本提示词处理。
    return input;
}
```
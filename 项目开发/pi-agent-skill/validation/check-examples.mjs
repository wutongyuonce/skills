// Type-check documentation examples without executing them. No declaration patches or skipLibCheck.
import { readFile, writeFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const here = dirname(fileURLToPath(import.meta.url));
const skill = resolve(process.argv[2] ?? join(here, ".."));
const output = await mkdtemp(join(here, ".check-examples-"));
const manifest = [];
async function markdown(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".check-")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await markdown(path));
    else if (entry.name.endsWith(".md")) found.push(path);
  }
  return found.sort();
}
const hookImports = `import { Type } from "typebox";
import { defineTool, isToolCallEventType, type ExtensionAPI, type ExtensionFactory,
  type ExtensionContext, type ToolCallEvent, type ToolResultEvent } from "@earendil-works/pi-coding-agent";
import type { TextContent } from "@earendil-works/pi-ai";
declare const pi: ExtensionAPI;
`;
try {
  for (const path of await markdown(skill)) {
    const source = await readFile(path, "utf8");
    const blocks = [...source.matchAll(/^```(?:ts|typescript)\n([\s\S]*?)^```/gm)];
    for (let i = 0; i < blocks.length; i++) {
      let code = blocks[i][1];
      const file = relative(skill, path);
      const item = { file, block: i, status: "reference-fragment" };
      const imported = /^import /m.test(code);
      const hook = /^(?:pi\.(?:on|registerTool|registerCommand|registerProvider)\(|const myExtension: ExtensionFactory =)/m.test(code);
      if (!imported && !hook) { manifest.push(item); continue; }
      if (!imported && /\/\/\s*❌/.test(code)) {
        item.status = "intentional-negative-example"; manifest.push(item); continue;
      }
      const parsed = ts.createSourceFile("example.ts", code, ts.ScriptTarget.Latest, true);
      if (parsed.parseDiagnostics.length) {
        item.status = "signature-or-pseudocode"; manifest.push(item); continue;
      }
      if (!imported) code = hookImports + code;
      // These symbols are explicitly supplied by the host/application in the text.
      // Keep their real SDK types instead of declaring any or silencing diagnostics.
      if (file === "references/sdk_doc/03-agent-session-runtime.md" && code.includes("[myCustomTool]")) {
        code = 'import type { CreateAgentSessionOptions } from "@earendil-works/pi-coding-agent";\ndeclare const myCustomTool: NonNullable<CreateAgentSessionOptions["customTools"]>[number];\n' + code;
        item.context = "application tool: CreateAgentSessionOptions.customTools element";
      }
      if (file === "references/sdk_doc/18-compaction.md" && code.includes("agentSession.sessionManager")) {
        code = 'import type { AgentSession } from "@earendil-works/pi-coding-agent";\ndeclare const agentSession: AgentSession;\n' + code;
        item.context = "host session: AgentSession";
      }
      const business = {
        "references/scenarios/D04-confirm-destructive.md": 'declare const dangerous: boolean; declare const modifiedCmd: string;',
        "references/scenarios/D06-protected-paths.md": 'declare function computeRootsForUser(id: string): string[];',
        "references/scenarios/E01-tool-intercept.md": `declare const dangerous: boolean; declare const modifiedCmd: string;
          declare function isForbidden(event: ToolCallEvent): boolean;
          declare function logToolCall(event: ToolCallEvent): void;
          declare function logToolResult(event: ToolResultEvent): void;
          declare function sanitizeContent<T>(content: T): T;
          declare function isAllowedDomain(email: string): boolean;`,
        "references/scenarios/E04-lifecycle-hooks.md": 'declare function loadDynamicRules(cwd: string): string; declare function sanitizeContent<T>(content: T): T;',
        "references/scenarios/E05-input-transform.md": 'declare function translateText(text: string, from: string, to: string): Promise<string>;',
        "references/sdk_doc/04-events.md": 'declare function handleText(delta: string): void;',
        "references/sdk_doc/16-custom-provider.md": `declare function exchangeToken(code: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
          declare const newCredentials: { access: string; refresh: string; expires: number };`,
      }[file];
      if (business && !imported) { code = business + "\n" + code; item.context = "typed application placeholders: " + business; }
      const target = join(output, file.replace(/[^a-zA-Z0-9_-]/g, "_") + `_${i}.ts`);
      await writeFile(target, code + "\nexport {};\n");
      item.status = "compiled"; item.output = target; manifest.push(item);
    }
  }
  // The project-structure barrel deliberately references application-owned modules.
  for (const [name, factory] of [["tool-a", "createReadToolDefinition"], ["tool-b", "createBashToolDefinition"]]) {
    await writeFile(join(output, name + ".ts"), `import { ${factory} } from "@earendil-works/pi-coding-agent";\nexport const ${name === "tool-a" ? "toolA" : "toolB"} = ${factory}(process.cwd());\n`);
  }
  const files = manifest.filter(x => x.status === "compiled").map(x => x.output);
  const program = ts.createProgram(files, {
    noEmit: true, strict: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    resolveJsonModule: true, allowImportingTsExtensions: true,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) {
    console.error(ts.formatDiagnostics(diagnostics, { getCanonicalFileName: x => x,
      getCurrentDirectory: () => output, getNewLine: () => "\n" }));
  }
  const totals = Object.fromEntries([...new Set(manifest.map(x => x.status))].map(status =>
    [status, manifest.filter(x => x.status === status).length]));
  // Optional report is an explicit caller-selected output, not a persistent SDK artifact.
  if (process.argv[3]) await writeFile(resolve(process.argv[3]), JSON.stringify({ totals, diagnostics: diagnostics.length,
    examples: manifest.map(({ output, ...item }) => item) }, null, 2) + "\n");
  console.log(JSON.stringify({ totals, diagnostics: diagnostics.length }));
  process.exitCode = diagnostics.length ? 1 : 0;
} finally { await rm(output, { recursive: true, force: true }); }

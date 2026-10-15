// Portable offline integration check for pi 1.2.0. Run with Node 22's type stripping.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Socket } from "node:net";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { Models, ImageModel, ImageApi, ClassifierModel, ClassifierApi, ImagesContext, ClassifierContext } from "@earendil-works/pi-ai";
import type {
  AgentSession, AgentSessionEvent, BeforeAgentStartEvent, ExtensionAPI,
  ExtensionFactory, ExtensionEvent, CreateAgentSessionOptions, FileEntry,
} from "@earendil-works/pi-coding-agent";

// Compile-only examples: operation-specific public types and methods, no model calls.
function publicModelExamples(models: Models, image: ImageModel<ImageApi>, classifier: ClassifierModel<ClassifierApi>,
  images: ImagesContext, classification: ClassifierContext) {
  return [models.getModelsOfType("image"), models.getModelsOfType("classifier"),
    models.generateImages(image, images), models.classify(classifier, classification)];
}
void publicModelExamples;
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}
function text(messages: readonly AgentMessage[]) { return JSON.stringify(messages); }
const root = await mkdtemp(join(dirname(fileURLToPath(import.meta.url)), ".check-sdk-"));
const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
const previousFetch = globalThis.fetch;
const previousConnect = Socket.prototype.connect;
const sessions: AgentSession[] = [];
const releases: (() => void)[] = [];
const extensionErrors: unknown[] = [];
let networkAttempts = 0;
try {
  const cwd = join(root, "cwd");
  const agentDir = join(root, "agent");
  await mkdir(cwd); await mkdir(agentDir);
  process.env.PI_CODING_AGENT_DIR = agentDir;
  globalThis.fetch = async () => { networkAttempts++; throw new Error("Network forbidden by validation"); };
  Socket.prototype.connect = function (): never {
    networkAttempts++; throw new Error("Sockets forbidden by validation");
  };
  const sdk = await import("@earendil-works/pi-coding-agent");
  const { calculateContextTokens, estimateTokens, findCutPoint, serializeConversation,
    prepareBranchEntries, generateSummary } = sdk;
  const ai = await import("@earendil-works/pi-ai");
  const compat = await import("@earendil-works/pi-ai/compat");
  const modelExports = await import("@earendil-works/pi-ai/models");
  const codemode = await import("@earendil-works/pi-codemode");
  const mcp = await import("@earendil-works/pi-mcp");
  assert.equal(typeof codemode.CodemodeSandbox, "function");
  assert.equal(typeof mcp.McpClient, "function");
  const { Type } = await import("typebox");
  for (const helper of [calculateContextTokens, estimateTokens, findCutPoint,
    serializeConversation, prepareBranchEntries, generateSummary]) assert.equal(typeof helper, "function");
  assert.equal(estimateTokens({ role: "user", content: "offline", timestamp: 1 }) > 0, true);
  assert.equal(typeof compat.getModel, "function");
  assert.equal(typeof modelExports.createModels, "function");
  for (const factory of [sdk.createCodemodeExtension, sdk.createMcpExtension, sdk.createToolSearchExtension]) {
    assert.equal(typeof factory, "function");
  }
  // Constructing these factories neither connects MCP nor starts a VM/UI.
  assert.equal(typeof sdk.createCodemodeExtension({ mode: "on" }), "function");
  assert.equal(typeof sdk.createMcpExtension(), "function");
  assert.equal(typeof sdk.createToolSearchExtension(), "function");
  console.log("PASS public model/image/classifier/codemode/MCP imports and factory construction");

  const runtime = await sdk.ModelRuntime.create({ authPath: join(agentDir, "auth.json"),
    modelsPath: null, modelsStorePath: join(agentDir, "models-store.json"),
    allowModelNetwork: false, refreshOnCreate: false });
  const faux = ai.fauxProvider({ api: "validation-faux", provider: "validation-faux",
    tokenSize: { min: 1000, max: 1000 }, tokensPerSecond: 0 });
  runtime.registerNativeProvider(faux.provider);
  const authModel = { ...faux.getModel(), id: "auth-chat", provider: "validation-auth" };
  runtime.registerNativeProvider(ai.createProvider({
    id: "validation-auth", models: [authModel],
    api: { stream: faux.provider.stream, streamSimple: faux.provider.streamSimple },
    auth: { apiKey: {
      name: "Offline credential fixture",
      login: async (interaction) => ({ type: "api_key",
        key: await interaction.prompt({ type: "secret", message: "Fixture only" }), env: { FIXTURE: "scoped" } }),
      check: async ({ credential }) => credential?.key ? { type: "api_key", source: "fixture" } : undefined,
      resolve: async ({ credential }) => credential?.key ? {
        auth: { apiKey: credential.key, headers: { "X-Fixture": "present", "X-Removed": null } },
        env: credential.env, source: "fixture",
      } : undefined,
    } },
  }));
  assert.equal(await runtime.checkAuth("validation-auth"), undefined);
  assert.equal(await runtime.getAuth(authModel), undefined);
  const credential = await runtime.login("validation-auth", "api_key", {
    prompt: async (prompt) => { assert.equal(prompt.type, "secret"); return "offline-fixture-key"; },
    notify: () => {},
  });
  assert.equal(credential.type, "api_key");
  assert.deepEqual(await runtime.checkAuth("validation-auth"), { type: "api_key", source: "fixture" });
  const auth = await runtime.getAuth(authModel);
  assert.equal(auth?.auth.apiKey, "offline-fixture-key");
  assert.deepEqual(auth?.env, { FIXTURE: "scoped" });
  assert.deepEqual(auth?.auth.headers, { "X-Fixture": "present", "X-Removed": null });
  assert.deepEqual(await runtime.listCredentials(), [{ providerId: "validation-auth", type: "api_key" }]);
  assert.equal((await runtime.getAuth(authModel, { apiKey: "request-only" }))?.auth.apiKey, "request-only");
  await runtime.setRuntimeApiKey("validation-auth", "runtime-only");
  assert.equal((await runtime.getAuth(authModel))?.auth.apiKey, "runtime-only");
  await runtime.removeRuntimeApiKey("validation-auth");
  assert.equal((await runtime.getAuth(authModel))?.auth.apiKey, "offline-fixture-key");
  await runtime.logout("validation-auth");
  assert.deepEqual(await runtime.listCredentials(), []);
  assert.equal(await runtime.getAuth(authModel), undefined);
  console.log("PASS tagged native auth login/check, credential metadata, scoped env/nullable headers, request/runtime overrides, logout");
  const response = (value: string) => ai.fauxAssistantMessage(value, { timestamp: 1 });
  const result = (value: string) => ({ content: [{ type: "text" as const, text: value }], details: {} });
  let childExecutions = 0;
  const child = sdk.defineTool({ name: "check_child", label: "Child", description: "Return a value",
    parameters: Type.Object({ value: Type.String() }),
    async execute(_id, params, _signal, update) {
      childExecutions++; update?.(result("partial")); return result(params.value);
    } });
  const parent = sdk.defineTool({ name: "check_parent", label: "Parent", description: "Call child",
    parameters: Type.Object({}), async execute(_id, _params, _signal, _update, ctx) {
      const outcome = await ctx.executeTool("check_child", { value: "nested-ok" });
      return result(JSON.stringify(outcome));
    } });
  const inactive = sdk.defineTool({ name: "check_inactive", label: "Inactive", description: "Inactive",
    defaultActive: false, parameters: Type.Object({}), async execute() { return result("inactive"); } });
  const settings = (defaultTools?: string[]) => sdk.SettingsManager.inMemory({
    defaultTools, compaction: { enabled: false }, retry: { enabled: false }, cacheWarming: "off",
    enableAnalytics: false, enableInstallTelemetry: false,
  });
  function loader(factory?: ExtensionFactory, defaults?: string[]) {
    return new sdk.DefaultResourceLoader({ cwd, agentDir, settingsManager: settings(defaults),
      noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
      extensionFactories: factory ? [factory] : [], systemPrompt: "Offline integration fixture.",
      skillsOverride: () => ({ skills: [], diagnostics: [] }),
      promptsOverride: () => ({ prompts: [], diagnostics: [] }),
      themesOverride: () => ({ themes: [], diagnostics: [] }),
      agentsFilesOverride: () => ({ agentsFiles: [] }), appendSystemPromptOverride: () => [],
    });
  }
  async function create(options: Partial<CreateAgentSessionOptions> = {}) {
    const { session } = await sdk.createAgentSession({ cwd, agentDir, modelRuntime: runtime,
      model: faux.getModel(), thinkingLevel: "off", settingsManager: settings(),
      sessionManager: sdk.SessionManager.inMemory(cwd), resourceLoader: loader(),
      customTools: [child, parent, inactive], ...options });
    sessions.push(session); return session;
  }

  let factoryCalls = 0; let starts = 0;
  let pi!: ExtensionAPI;
  let current!: AgentSession;
  const before: BeforeAgentStartEvent[] = [];
  const busy: boolean[] = [];
  const extEvents: ExtensionEvent[] = [];
  const sessionEvents: AgentSessionEvent[] = [];
  let structuredSeen = false;
  let structuredAfter: unknown;
  let hold: { entered: ReturnType<typeof deferred>; release: ReturnType<typeof deferred> } | undefined;
  const extension: ExtensionFactory = (api) => {
    factoryCalls++; pi = api;
    api.registerTool(sdk.defineTool({ name: "check_extension", label: "Extension", description: "Extension tool",
      parameters: Type.Object({}), async execute() { return result("extension"); } }));
    api.on("session_start", (event) => { starts++; extEvents.push(event); });
    api.on("before_agent_start", async (event, ctx) => {
      before.push(event); busy.push(current.isStreaming && !current.isIdle && !ctx.isIdle());
      if (hold) { const gate = hold; hold = undefined; gate.entered.resolve(); await gate.release.promise; }
    });
    api.on("input", (event) => {
      extEvents.push(event);
      if (event.text.startsWith("consume:")) return { action: "handled" };
      if (event.text.startsWith("change:")) return { action: "transform", text: event.text.replace("change:", "transformed:") };
    });
    api.on("context", (event) => { extEvents.push(event); });
    api.on("tool_call", (event) => { extEvents.push(event); });
    api.on("tool_result", (event) => {
      extEvents.push(event);
      if (event.toolName === "check_structured") return {
        content: [{ type: "text" as const, text: "redacted result" }],
      };
    });
    api.on("tool_result", (event) => {
      if (event.toolName === "check_structured") {
        structuredSeen = true; structuredAfter = event.structuredContent;
      }
    });
    api.on("tool_execution_start", (event) => { extEvents.push(event); });
    api.on("tool_execution_update", (event) => { extEvents.push(event); });
    api.on("tool_execution_end", (event) => { extEvents.push(event); });
    api.on("agent_settled", (event) => { extEvents.push(event); });
  };
  const resources = loader(extension);
  const unloaded = await create({ resourceLoader: resources });
  assert.equal(factoryCalls, 0, "supplied loaders are not automatically reloaded");
  assert.equal(unloaded.getToolDefinition("check_extension"), undefined);
  unloaded.dispose();
  await resources.reload();
  assert.equal(factoryCalls, 1);
  assert.deepEqual(resources.getExtensions().errors, []);
  current = await create({ resourceLoader: resources });
  const unsubscribe = current.subscribe((event) => sessionEvents.push(event));
  assert.equal(starts, 0);
  assert.ok(current.getToolDefinition("check_extension"));
  await current.bindExtensions({ onError: (error) => { extensionErrors.push(error); } });
  assert.equal(starts, 1);
  console.log("PASS create/dispose, explicit loader.reload(), bindExtensions session_start");

  for (const [options, expected] of [
    [{}, ["read", "bash", "edit", "write", "check_child", "check_parent"]],
    [{ tools: ["check_ch*"] }, ["check_child"]],
    [{ tools: [] }, []],
    [{ noTools: "all" }, []],
    [{ noTools: "builtin" }, ["check_child", "check_parent"]],
    [{ settingsManager: settings(["check_inactive"]) }, ["check_inactive", "check_child", "check_parent"]],
    [{ settingsManager: settings(["-bash", "+check_inactive"]) }, ["read", "edit", "write", "check_inactive", "check_child", "check_parent"]],
    [{ tools: ["+check_inactive", "-bash"] }, ["read", "edit", "write", "check_inactive", "check_child", "check_parent"]],
    [{ tools: ["check_*"], excludeTools: ["check_parent"] }, ["check_child", "check_inactive"]],
  ] satisfies [Partial<CreateAgentSessionOptions>, string[]][]) {
    const s = await create(options);
    assert.deepEqual(s.getActiveToolNames().sort(), expected.sort());
    if (options.tools?.length === 0) assert.equal(s.getToolDefinition("check_child"), undefined);
    if (options.tools?.[0] === "check_ch*") {
      assert.equal(s.getToolDefinition("check_parent"), undefined);
      s.setActiveToolsByName(["check_parent", "bash", "check_child"]);
      assert.deepEqual(s.getActiveToolNames(), ["check_child"], "allowlist cannot be bypassed dynamically");
    }
    s.dispose();
  }
  await assert.rejects(create({ tools: ["read", "+bash"] }), /mix|allowlist|modifier/i);
  pi.registerTool(sdk.defineTool({ name: "check_late", label: "Late", description: "Late registration",
    parameters: Type.Object({}), async execute() { return result("late"); } }));
  assert.ok(current.getActiveToolNames().includes("check_late"));
  console.log("PASS custom/extension/late tool registration, allowlists, defaultTools, modifiers, exclusions, noTools");

  faux.setResponses([response("user-ok")]);
  await current.prompt("user-start", { source: "rpc" });
  assert.equal(before.at(-1)?.messageType, "user");
  const userStart = before.at(-1)!;
  if (userStart.messageType === "user") assert.equal(userStart.prompt, "user-start");
  assert.equal(current.getLastAssistantText(), "user-ok");
  faux.setResponses([response("custom-ok")]);
  const customSettled = deferred();
  const off = current.subscribe((event) => { if (event.type === "agent_settled") customSettled.resolve(); });
  pi.sendMessage({ customType: "fixture", content: "custom-start", display: false }, { triggerTurn: true });
  await customSettled.promise; await current.waitForIdle(); off();
  const customStart = before.at(-1)!;
  assert.equal(customStart.messageType, "custom");
  if (customStart.messageType === "custom") {
    assert.equal(customStart.message.customType, "fixture"); assert.equal(customStart.message.content, "custom-start");
    assert.equal("prompt" in customStart, false);
  }
  assert.equal(current.getLastAssistantText(), "custom-ok");
  assert.ok(busy.every(Boolean));
  console.log("PASS user/custom before_agent_start union, pi.sendMessage triggerTurn, busy start handlers");

  const gate = { entered: deferred(), release: deferred() }; releases.push(gate.release.resolve); hold = gate;
  const callsBeforeAbort = faux.state.callCount;
  const abortRun = current.prompt("abort-at-start");
  await gate.entered.promise;
  assert.equal(current.isIdle, false); assert.equal(current.isStreaming, true);
  const abort = current.abort(); gate.release.resolve();
  await Promise.all([abortRun, abort]);
  assert.equal(current.isIdle, true);
  const abortedSession = sessionEvents.filter((e) => e.type === "agent_settled").at(-1);
  const abortedExtension = extEvents.filter((e) => e.type === "agent_settled").at(-1);
  assert.equal(abortedSession?.aborted, true); assert.equal(abortedExtension?.aborted, true);
  assert.equal(faux.state.callCount, callsBeforeAbort, "startup abort avoids provider call");
  console.log("PASS deterministic startup abort, agent_settled.aborted in both event layers");

  faux.setResponses([ai.fauxAssistantMessage(ai.fauxToolCall("check_parent", {}, { id: "outer" }),
    { stopReason: "toolUse", timestamp: 1 }), response("tools-ok")]);
  await current.prompt("nested-tools");
  assert.equal(childExecutions, 1);
  for (const type of ["tool_execution_start", "tool_execution_update", "tool_execution_end"] as const) {
    assert.ok(sessionEvents.some((e) => e.type === type && e.parentToolCallId === "outer"));
    assert.ok(extEvents.some((e) => e.type === type && e.parentToolCallId === "outer"));
  }
  for (const type of ["tool_call", "tool_result"] as const) {
    assert.ok(extEvents.some((e) => e.type === type && e.parentToolCallId === "outer"));
  }
  const nested = current.messages.filter((m) => m.role === "toolResult");
  assert.equal(nested.length, 1, "nested result does not become a top-level transcript result");
  assert.equal(nested[0]?.nestedCalls?.calls[0]?.id, "outer/1");
  assert.equal(nested[0]?.nestedCalls?.calls[0]?.status, "ok");
  for (const exclusive of ["session_start", "input", "context", "before_agent_start", "tool_call", "tool_result"]) {
    assert.equal(sessionEvents.some((e) => String(e.type) === exclusive), false);
  }
  assert.ok(extEvents.some((e) => e.type === "context"));
  assert.equal(sessionEvents.filter((e) => e.type === "agent_settled").at(-1)?.aborted, false);
  assert.equal(extEvents.filter((e) => e.type === "agent_settled").at(-1)?.aborted, false);
  console.log("PASS event routing, normal settlement, nested parentToolCallId and transcript record");

  const queueGate = { entered: deferred(), release: deferred() }; releases.push(queueGate.release.resolve); hold = queueGate;
  faux.setResponses([response("initial-and-steered"), response("followed")]);
  const queueRun = current.prompt("queue-start"); await queueGate.entered.promise;
  await assert.rejects(current.prompt("busy-no-delivery"), /stream|running|steer|follow/i);
  assert.equal(await current.steer("consume:steer"), "handled");
  assert.equal(await current.followUp("consume:follow"), "handled");
  assert.equal(await current.steer("change:steer", undefined, { source: "rpc" }), "queued");
  assert.equal(await current.followUp("change:follow", undefined, { source: "rpc" }), "queued");
  assert.deepEqual(current.getSteeringMessages(), ["transformed:steer"]);
  assert.deepEqual(current.getFollowUpMessages(), ["transformed:follow"]);
  assert.equal(current.pendingMessageCount, 2);
  queueGate.release.resolve(); await queueRun;
  assert.equal(current.pendingMessageCount, 0);
  assert.ok(text(current.messages).includes("transformed:steer"));
  assert.ok(text(current.messages).includes("transformed:follow"));
  assert.equal(text(current.messages).includes("consume:"), false);
  assert.equal(faux.getPendingResponseCount(), 0);
  assert.ok(extEvents.some((e) => e.type === "input" && e.source === "rpc" && e.streamingBehavior === "steer"));
  assert.ok(extEvents.some((e) => e.type === "input" && e.source === "rpc" && e.streamingBehavior === "followUp"));
  assert.equal(current.isIdle, true);
  assert.equal(sessionEvents.filter((e) => e.type === "agent_settled").length, 5);
  assert.equal(extEvents.filter((e) => e.type === "agent_settled").length, 5);
  assert.ok(busy.every(Boolean));
  console.log("PASS steer/followUp queued/handled, transformed delivery, queue drain and busy prompt rejection");

  pi.registerTool(sdk.defineTool({ name: "check_structured", label: "Structured", description: "Fixture",
    parameters: Type.Object({}), async execute() {
      return { content: [{ type: "text", text: "sensitive fixture" }],
        structuredContent: { value: "sensitive fixture" }, details: { stage: "fixture" }, isError: true };
    } }));
  faux.setResponses([ai.fauxAssistantMessage(ai.fauxToolCall("check_structured", {}, { id: "structured" }),
    { stopReason: "toolUse", timestamp: 1 }), response("structured-ok")]);
  await current.prompt("structured-result");
  const structured = current.messages.filter((m) => m.role === "toolResult").at(-1)!;
  assert.equal(structuredSeen, true, "post-transform observer must run");
  assert.equal(structuredAfter, undefined, "content-only transform must discard stale structured data");
  assert.equal(structured.isError, true, "redaction must not turn a failure into success");
  assert.deepEqual(structured.content, [{ type: "text", text: "redacted result" }]);
  assert.deepEqual(structured.details, { stage: "fixture" });
  console.log("PASS tool_result replacement clears stale structuredContent, preserves details and failure state");

  const stamp = "2026-01-01T00:00:00.000Z";
  const entries: FileEntry[] = [
    { type: "session", version: sdk.CURRENT_SESSION_VERSION, id: "external-session", timestamp: stamp, cwd },
    { type: "message", id: "external-user", parentId: null, timestamp: stamp,
      message: { role: "user", content: "external-original", timestamp: 1 } },
  ];
  const manager = sdk.SessionManager.inMemory(cwd, undefined, structuredClone(entries));
  const restored = await create({ sessionManager: manager, tools: [] });
  assert.equal(manager.getSessionId(), "external-session");
  assert.equal(manager.isPersisted(), false); assert.equal(manager.getSessionFile(), undefined);
  assert.ok(text(restored.messages).includes("external-original"));
  manager.appendContextEdit("external-user", { content: "external-edited" });
  restored.agent.state.messages = [{ role: "user", content: "state-only", timestamp: 1 }];
  restored.refreshContext();
  assert.ok(text(restored.messages).includes("external-edited"));
  assert.equal(text(restored.messages).includes("state-only"), false);
  const original = manager.getEntry("external-user");
  assert.equal(original?.type, "message");
  if (original?.type === "message" && original.message.role === "user") {
    assert.equal(original.message.content, "external-original");
  }
  let requestHistory = "";
  faux.setResponses([(context) => { requestHistory = text(context.messages); return response("restored-ok"); }]);
  restored.agent.state.messages.push({ role: "user", content: "unpersisted-ghost", timestamp: 1 });
  await restored.prompt("continue-restored");
  assert.ok(requestHistory.includes("external-edited"));
  assert.equal(requestHistory.includes("external-original"), false);
  assert.equal(requestHistory.includes("unpersisted-ghost"), false);
  manager.appendContextEdit("external-user", null); restored.refreshContext();
  assert.equal(text(restored.messages).includes("external-edited"), false);
  manager.branch("external-user"); restored.refreshContext();
  assert.ok(text(restored.messages).includes("external-original"), "edits apply only on their branch");
  const persistent = await create({ sessionManager: undefined, tools: [] });
  faux.setResponses([response("persisted-ok")]);
  await persistent.prompt("persisted-user");
  const persistedPath = persistent.sessionManager.getSessionFile();
  assert.ok(persistedPath?.startsWith(agentDir), "default storage belongs to isolated agentDir");
  const persistedId = persistent.sessionManager.getSessionId();
  persistent.dispose();
  const fresh = await create({ sessionManager: undefined, tools: [] });
  assert.notEqual(fresh.sessionManager.getSessionId(), persistedId);
  assert.equal(text(fresh.messages).includes("persisted-user"), false, "default create is new, not continuation");
  const diskRestored = await create({ sessionManager: sdk.SessionManager.open(persistedPath!), tools: [] });
  assert.equal(diskRestored.sessionManager.getSessionId(), persistedId);
  assert.ok(text(diskRestored.messages).includes("persisted-user"));
  assert.ok(text(diskRestored.messages).includes("persisted-ok"));
  console.log("PASS default-new disk sessions, isolated storage, explicit open restores persisted history");
  restored.dispose(); unsubscribe(); current.dispose();
  await current.settingsManager.flush();
  assert.deepEqual(current.settingsManager.drainErrors(), []);
  assert.deepEqual(extensionErrors, []);
  assert.equal(networkAttempts, 0);
  console.log("PASS external in-memory restore, appendContextEdit/refreshContext, authoritative provider history, branch-relative edits");
  console.log("PASS all runtime assertions; no network attempts; finally removes fixture paths and disposes sessions");
} finally {
  for (const release of releases) release();
  for (const session of sessions) session.dispose();
  globalThis.fetch = previousFetch; Socket.prototype.connect = previousConnect;
  if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  await rm(root, { recursive: true, force: true });
}

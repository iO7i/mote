import { createScriptedAdapter, runScriptedConversation } from "../eval/fake-provider.mjs";

let failed = 0;
const expect = (name, value, detail = "") => { if (!value) { failed++; console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`); } };
const tools = [{ name: "list_files" }, { name: "write_file" }, { name: "run_check" }];

const transcript = [
  { text: "inspect", toolCalls: [{ id: "c1", name: "list_files", input: {} }], usage: { inputTokens: 10, outputTokens: 3 } },
  { text: "edit", toolCalls: [{ id: "c2", name: "write_file", arguments: '{"path":"solution.mt","content":"ok"}' }], usage: { inputTokens: 12, outputTokens: 4 } },
  { text: "verify", toolCalls: [{ id: "c3", name: "run_check", input: {} }], usage: { inputTokens: 14, outputTokens: 5 } },
  { text: "done", usage: { inputTokens: 16, outputTokens: 2 } },
];
const adapter = createScriptedAdapter({ transcript });
const events = [];
const execution = await runScriptedConversation({ adapter, messages: [{ role: "user", content: "task" }], tools, executeTool: async (call) => { events.push(call.name); return call.input?.rawArguments ? { error: "malformed arguments" } : { ok: true, name: call.name }; }, onEvent: (event) => events.push(event.event) });
expect("script completes", execution.status === "COMPLETED");
expect("tool calls preserve transcript order", execution.trace.filter((event) => event.event === "tool").map((event) => event.name).join(",") === "list_files,write_file,run_check");
expect("usage is cumulative", execution.usage.inputTokens === 52 && execution.usage.outputTokens === 14 && execution.usage.billedTokens === 66);
expect("transcript hash is reproducible", adapter.transcriptHash === createScriptedAdapter({ transcript }).transcriptHash);
expect("request trace is recorded", adapter.requests.length === 4 && adapter.requests[1].messageCount > adapter.requests[0].messageCount);

const malformed = createScriptedAdapter({ transcript: [{ toolCalls: [{ name: "write_file", arguments: "not-json" }] }, { text: "stop" }] });
const malformedRun = await runScriptedConversation({ adapter: malformed, tools, executeTool: (call) => ({ receivedRawArguments: !!call.input.rawArguments }) });
expect("malformed arguments remain visible to the tool boundary", malformedRun.trace[1].output.receivedRawArguments === true);

const exhausted = createScriptedAdapter({ transcript: [{ toolCalls: [{ name: "list_files" }, { name: "run_check" }] }] });
const budgetRun = await runScriptedConversation({ adapter: exhausted, tools, budgets: { maxToolCalls: 1 }, executeTool: () => ({ ok: true }) });
expect("tool budget stops execution", budgetRun.status === "BUDGET_EXHAUSTED" && budgetRun.toolCalls === 1);

console.log(`${failed ? "FAIL" : "PASS"} scripted provider harness`);
process.exit(failed ? 1 : 0);

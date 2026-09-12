// Deterministic provider substitute for harness tests and dry-run experiments.
// It never performs network I/O and records enough trace to audit ordering.
import { hashJson } from "../bench/protocol.mjs";

export function createScriptedAdapter({ transcript, model = "scripted-model", provider = "scripted-provider" }) {
  if (!Array.isArray(transcript) || transcript.length === 0) throw new Error("transcript must be a non-empty array");
  let cursor = 0;
  const requests = [];
  return Object.freeze({
    transport: "scripted",
    model,
    provider,
    transcriptHash: hashJson(transcript),
    requests,
    complete: async (request) => {
      requests.push({ index: cursor, messageCount: request.messages?.length ?? 0, toolNames: (request.tools ?? []).map((tool) => tool.name) });
      if (cursor >= transcript.length) throw new Error("scripted transcript exhausted");
      const step = transcript[cursor++];
      if (step.error) throw new Error(step.error);
      return normalizeStep(step, cursor - 1);
    },
  });
}

export async function runScriptedConversation({ adapter, messages = [], tools = [], executeTool, budgets = {}, onEvent = () => {} }) {
  const limits = { maxRepairRounds: 12, maxToolCalls: 200, cumulativeInputTokens: 100_000, cumulativeOutputTokens: 100_000, ...budgets };
  const usage = { inputTokens: 0, outputTokens: 0, billedTokens: 0, cachedTokens: 0, reasoningTokens: 0 };
  const trace = [];
  const history = [...messages];
  let toolCalls = 0;
  let repairRounds = 0;
  let status = "COMPLETED";
  for (let round = 0; round <= limits.maxRepairRounds; round++) {
    repairRounds = round;
    let response;
    try { response = await adapter.complete({ messages: history, tools }); }
    catch (error) { status = error.message === "scripted transcript exhausted" ? "TRANSCRIPT_EXHAUSTED" : "PROVIDER_ERROR"; break; }
    addUsage(usage, response.usage);
    trace.push({ event: "completion", round, text: response.text, toolCalls: response.toolCalls.map((call) => ({ id: call.id, name: call.name, input: call.input })) });
    onEvent(trace.at(-1));
    if (!response.toolCalls.length) break;
    history.push({ role: "assistant", content: response.text, toolCalls: response.toolCalls });
    for (const call of response.toolCalls) {
      if (toolCalls >= limits.maxToolCalls) { status = "BUDGET_EXHAUSTED"; break; }
      toolCalls++;
      let output;
      try { output = await executeTool(call, { round, toolCallIndex: toolCalls - 1 }); }
      catch (error) { output = { error: error instanceof Error ? error.message : String(error) }; }
      trace.push({ event: "tool", round, index: toolCalls - 1, id: call.id, name: call.name, output });
      onEvent(trace.at(-1));
      history.push({ role: "tool", toolCallId: call.id, name: call.name, content: JSON.stringify(output) });
    }
    if (status === "BUDGET_EXHAUSTED") break;
    if (usage.inputTokens >= limits.cumulativeInputTokens || usage.outputTokens >= limits.cumulativeOutputTokens) { status = "BUDGET_EXHAUSTED"; break; }
  }
  if (repairRounds >= limits.maxRepairRounds && status === "COMPLETED") status = "REPAIR_ROUND_LIMIT";
  return { schemaVersion: 1, status, usage, toolCalls, repairRounds, trace, messages: history, transcriptHash: adapter.transcriptHash ?? null };
}

function normalizeStep(step, index) {
  const response = step.response ?? step;
  const calls = (response.toolCalls ?? response.tool_calls ?? []).map((call, callIndex) => ({
    id: call.id ?? `scripted-${index}-${callIndex}`,
    name: call.name ?? call.function?.name,
    input: call.input ?? parseArguments(call.arguments ?? call.function?.arguments),
  }));
  const usage = response.usage ?? {};
  const inputTokens = Number(usage.inputTokens ?? usage.input_tokens ?? 0);
  const outputTokens = Number(usage.outputTokens ?? usage.output_tokens ?? 0);
  return { text: String(response.text ?? response.output_text ?? ""), toolCalls: calls, requestId: response.requestId ?? `scripted-${index}`, usage: { inputTokens, outputTokens, cachedTokens: Number(usage.cachedTokens ?? 0), reasoningTokens: Number(usage.reasoningTokens ?? 0), billedTokens: Number(usage.billedTokens ?? usage.total_tokens ?? inputTokens + outputTokens) } };
}

function parseArguments(value) {
  if (value === undefined) return {};
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return { rawArguments: value }; }
}

function addUsage(total, value) {
  for (const key of Object.keys(total)) total[key] += Number(value[key] ?? 0);
}

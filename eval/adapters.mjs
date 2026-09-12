// Provider-neutral model adapters. Model IDs and settings are supplied at run
// time; no stale marketing model name is treated as a default.

export const TRANSPORTS = Object.freeze(["openai-responses", "openai-chat", "anthropic-messages"]);

export function createAdapter({ transport, provider, model, apiKey, baseUrl, fetchImpl = globalThis.fetch, settings = {} }) {
  if (!TRANSPORTS.includes(transport)) throw new Error(`unsupported transport '${transport}'`);
  if (!model) throw new Error("model is required; pass the provider's current model or snapshot ID");
  if (typeof fetchImpl !== "function") throw new Error("fetch is unavailable");
  const endpoint = baseUrl ?? defaultEndpoint(transport);
  return Object.freeze({ transport, provider: provider ?? transport, model, settings, complete: (request) => complete({ transport, endpoint, apiKey, model, settings, fetchImpl, request }) });
}

export async function complete({ transport, endpoint, apiKey, model, settings, fetchImpl, request }) {
  const payload = transport === "anthropic-messages"
    ? anthropicPayload(model, settings, request)
    : transport === "openai-chat"
      ? openAiChatPayload(model, settings, request)
      : openAiResponsesPayload(model, settings, request);
  const headers = { "content-type": "application/json", ...authHeaders(transport, apiKey) };
  const response = await fetchImpl(endpoint, { method: "POST", headers, body: JSON.stringify(payload) });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!response.ok) throw new Error(`${transport} ${response.status}: ${body.error?.message ?? body.message ?? text.slice(0, 500)}`);
  return transport === "anthropic-messages" ? normalizeAnthropic(body) : normalizeOpenAI(body);
}

function defaultEndpoint(transport) {
  if (transport === "anthropic-messages") return "https://api.anthropic.com/v1/messages";
  if (transport === "openai-chat") return "https://api.openai.com/v1/chat/completions";
  return "https://api.openai.com/v1/responses";
}

function authHeaders(transport, apiKey) {
  if (!apiKey) throw new Error("provider API key is required for a live run");
  return transport === "anthropic-messages"
    ? { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
    : { authorization: `Bearer ${apiKey}` };
}

function openAiResponsesPayload(model, settings, request) {
  return { model, input: responseInput(request.messages), tools: toolsFor("openai-responses", request.tools), max_output_tokens: settings.maxOutputTokens ?? 4096, temperature: settings.temperature, top_p: settings.topP, seed: settings.seed };
}

function openAiChatPayload(model, settings, request) {
  return { model, messages: chatMessages(request.messages), tools: toolsFor("openai-chat", request.tools), max_tokens: settings.maxOutputTokens ?? 4096, temperature: settings.temperature, top_p: settings.topP, seed: settings.seed };
}

function anthropicPayload(model, settings, request) {
  const system = request.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n") || undefined;
  return { model, system, messages: anthropicMessages(request.messages), tools: toolsFor("anthropic-messages", request.tools), max_tokens: settings.maxOutputTokens ?? 4096, temperature: settings.temperature, top_p: settings.topP };
}

function toolsFor(transport, tools = []) {
  if (transport === "anthropic-messages") return tools;
  if (transport === "openai-chat") return tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.input_schema } }));
  return tools.map((tool) => ({ type: "function", name: tool.name, description: tool.description, parameters: tool.input_schema }));
}

function chatMessages(messages) {
  return messages.map((message) => message.role === "assistant" && message.toolCalls?.length
    ? { role: "assistant", content: message.content || null, tool_calls: message.toolCalls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: JSON.stringify(call.input) } })) }
    : message.role === "tool" ? { role: "tool", tool_call_id: message.toolCallId, content: message.content } : message);
}

function responseInput(messages) {
  return messages.flatMap((message) => message.role === "assistant" && message.toolCalls?.length
    ? [{ role: "assistant", content: message.content || "" }, ...message.toolCalls.map((call) => ({ type: "function_call", call_id: call.id, name: call.name, arguments: JSON.stringify(call.input) }))]
    : message.role === "tool" ? [{ type: "function_call_output", call_id: message.toolCallId, output: message.content }] : [message]);
}

function anthropicMessages(messages) {
  return messages.filter((message) => message.role !== "system").map((message) => message.role === "assistant" && message.toolCalls?.length
    ? { role: "assistant", content: [...(message.content ? [{ type: "text", text: message.content }] : []), ...message.toolCalls.map((call) => ({ type: "tool_use", id: call.id, name: call.name, input: call.input }))] }
    : message.role === "tool" ? { role: "user", content: [{ type: "tool_result", tool_use_id: message.toolCallId, content: message.content }] } : message);
}

function normalizeOpenAI(body) {
  const text = body.output_text ?? body.choices?.[0]?.message?.content ?? body.output?.flatMap((item) => item.content ?? []).filter((part) => part.type === "output_text").map((part) => part.text).join("") ?? "";
  const calls = body.output?.filter((item) => item.type === "function_call").map((item) => ({ id: item.call_id ?? item.id, name: item.name, input: parseJson(item.arguments) }))
    ?? body.choices?.[0]?.message?.tool_calls?.map((item) => ({ id: item.id, name: item.function.name, input: parseJson(item.function.arguments) })) ?? [];
  return { text, toolCalls: calls, requestId: body.id ?? null, usage: usage(body.usage) };
}

function normalizeAnthropic(body) {
  return { text: body.content?.filter((part) => part.type === "text").map((part) => part.text).join("") ?? "", toolCalls: body.content?.filter((part) => part.type === "tool_use").map((part) => ({ id: part.id, name: part.name, input: part.input })) ?? [], requestId: body.id ?? null, usage: usage(body.usage) };
}

function usage(value = {}) {
  const input = value.input_tokens ?? value.prompt_tokens ?? 0;
  const output = value.output_tokens ?? value.completion_tokens ?? 0;
  const cached = value.cache_read_input_tokens ?? value.prompt_tokens_details?.cached_tokens ?? 0;
  const reasoning = value.completion_tokens_details?.reasoning_tokens ?? value.reasoning_tokens ?? 0;
  return { inputTokens: input, outputTokens: output, cachedTokens: cached, reasoningTokens: reasoning, billedTokens: value.total_tokens ?? input + output };
}

function parseJson(value) { try { return typeof value === "string" ? JSON.parse(value) : value; } catch { return { rawArguments: value }; } }

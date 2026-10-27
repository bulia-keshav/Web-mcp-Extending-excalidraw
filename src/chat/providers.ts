import type { ChatSettings, ProviderTool, ToolCall } from "./types";
import { SYSTEM_PROMPT } from "./types";

export type ProviderReply = {
  text: string;
  calls: ToolCall[];
  /** Raw message, kept so it can be echoed back on the next request. */
  raw: unknown;
};

export class ProviderError extends Error {}

/**
 * Both providers are called straight from the browser with the user's own key.
 * Nothing is proxied through a server we own, so there is no backend and no
 * cost to the host — and the key never leaves this browser except to go to the
 * provider the user chose.
 */
export async function sendToProvider(
  settings: ChatSettings,
  history: unknown[],
  tools: ProviderTool[],
): Promise<ProviderReply> {
  return settings.provider === "anthropic"
    ? sendAnthropic(settings, history, tools)
    : sendOpenAI(settings, history, tools);
}

async function sendAnthropic(
  settings: ChatSettings,
  history: unknown[],
  tools: ProviderTool[],
): Promise<ProviderReply> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      // Required for calls made directly from a browser.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: history,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      })),
    }),
  });

  if (!res.ok) throw new ProviderError(await describeError(res));
  const data = await res.json();

  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n")
    .trim();

  const calls: ToolCall[] = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "tool_use")
    .map((b: { id: string; name: string; input: unknown }) => ({ id: b.id, name: b.name, input: b.input }));

  return { text, calls, raw: { role: "assistant", content: data.content } };
}

async function sendOpenAI(
  settings: ChatSettings,
  history: unknown[],
  tools: ProviderTool[],
): Promise<ProviderReply> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
      tools: tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.inputSchema },
      })),
    }),
  });

  if (!res.ok) throw new ProviderError(await describeError(res));
  const data = await res.json();
  const msg = data.choices?.[0]?.message ?? {};

  const calls: ToolCall[] = (msg.tool_calls ?? []).map(
    (c: { id: string; function: { name: string; arguments: string } }) => ({
      id: c.id,
      name: c.function.name,
      input: safeParse(c.function.arguments),
    }),
  );

  return { text: (msg.content ?? "").trim(), calls, raw: msg };
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return {}; }
}

/** Surface the provider's own message — usually says exactly what is wrong. */
async function describeError(res: Response): Promise<string> {
  let detail = "";
  try {
    const body = await res.json();
    detail = body?.error?.message ?? JSON.stringify(body).slice(0, 300);
  } catch {
    detail = res.statusText;
  }
  if (res.status === 401) return `${detail} (check your API key)`;
  if (res.status === 404) return `${detail} (check the model name)`;
  return `${res.status}: ${detail}`;
}

/** Shape a tool result for the next request, per provider. */
export function toolResultMessage(
  provider: ChatSettings["provider"],
  call: ToolCall,
  result: unknown,
): unknown {
  const text = JSON.stringify(result);
  return provider === "anthropic"
    ? { role: "user", content: [{ type: "tool_result", tool_use_id: call.id, content: text }] }
    : { role: "tool", tool_call_id: call.id, content: text };
}

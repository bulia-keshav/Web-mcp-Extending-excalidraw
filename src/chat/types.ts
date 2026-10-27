export type Provider = "anthropic" | "openai";

export type ChatSettings = {
  provider: Provider;
  apiKey: string;
  model: string;
};

export type ToolCall = { id: string; name: string; input: unknown };

export type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; calls: ToolCall[] }
  | { role: "tool"; callId: string; name: string; result: unknown };

export type ProviderTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: "claude-sonnet-5-5",
  openai: "gpt-4o",
};

export const SETTINGS_KEY = "sketchpad-agent:chat-settings:v1";

export function loadSettings(): ChatSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...JSON.parse(raw) } as ChatSettings;
  } catch { /* private mode */ }
  return { provider: "anthropic", apiKey: "", model: DEFAULT_MODEL.anthropic };
}

export function saveSettings(s: ChatSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export const SYSTEM_PROMPT = `You are drawing on a shared Excalidraw whiteboard alongside a human, using the tools provided.

Call how_to_draw_here once at the start of a session to learn the tool set and the rules.

Key points:
- You cannot see the canvas. Call get_scene to read it; never claim to have looked at it.
- The human draws here too. If they say "these" or "this one", call get_selection.
- Never invent x/y coordinates. Omit them and the page positions things sensibly.
- Prefer a whole-diagram tool (draw_flowchart, draw_chart, draw_timeline, draw_hierarchy,
  draw_graph, draw_table, draw_board) over placing shapes one by one.
- Be brief in your replies. The drawing is the output, not your description of it.`;

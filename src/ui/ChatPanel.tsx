import { useEffect, useRef, useState } from "react";
import { allTools } from "../webmcp/tools";
import { invoke } from "../webmcp/registry";
import { sendToProvider, toolResultMessage, ProviderError } from "../chat/providers";
import {
  loadSettings, saveSettings, DEFAULT_MODEL,
  type ChatSettings, type Provider, type Turn,
} from "../chat/types";
import "./ChatPanel.css";

const MAX_TOOL_ROUNDS = 8;

export default function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [settings, setSettings] = useState<ChatSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(!loadSettings().apiKey);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const history = useRef<unknown[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [turns, busy]);

  const update = (patch: Partial<ChatSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    if (!settings.apiKey) { setShowSettings(true); return; }

    setDraft("");
    setError(null);
    setBusy(true);
    setTurns((t) => [...t, { role: "user", text }]);
    history.current.push({ role: "user", content: text });

    const toolDefs = allTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));

    try {
      // Keep going while the model wants tools, so one instruction can produce
      // several drawing calls without the human pressing send again.
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const reply = await sendToProvider(settings, history.current, toolDefs);
        history.current.push(reply.raw);
        setTurns((t) => [...t, { role: "assistant", text: reply.text, calls: reply.calls }]);

        if (!reply.calls.length) break;

        for (const call of reply.calls) {
          const result = await invoke(call.name, call.input);
          setTurns((t) => [...t, { role: "tool", callId: call.id, name: call.name, result }]);
          history.current.push(toolResultMessage(settings.provider, call, result));
        }
      }
    } catch (err) {
      setError(err instanceof ProviderError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <aside className="chat-panel">
      <header className="chat-head">
        <strong>Ask the canvas</strong>
        <div>
          <button onClick={() => setShowSettings((v) => !v)} title="API settings">⚙</button>
          <button onClick={onClose} aria-label="Close">×</button>
        </div>
      </header>

      {showSettings && (
        <div className="chat-settings">
          <label>
            Provider
            <select
              value={settings.provider}
              onChange={(e) => {
                const provider = e.target.value as Provider;
                update({ provider, model: DEFAULT_MODEL[provider] });
              }}
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </select>
          </label>
          <label>
            API key
            <input
              type="password"
              value={settings.apiKey}
              placeholder={settings.provider === "anthropic" ? "sk-ant-…" : "sk-…"}
              onChange={(e) => update({ apiKey: e.target.value.trim() })}
            />
          </label>
          <label>
            Model
            <input value={settings.model} onChange={(e) => update({ model: e.target.value.trim() })} />
          </label>
          <p className="chat-note">
            Your key is stored only in this browser and is sent only to {settings.provider}.
            It never reaches this site's server — there isn't one.
          </p>
        </div>
      )}

      <div className="chat-log" ref={scroller}>
        {turns.length === 0 && !showSettings && (
          <div className="chat-empty">
            <p>Try:</p>
            <ul>
              <li onClick={() => setDraft("Draw a flowchart of how a pull request gets reviewed and merged")}>
                “Draw a flowchart of how a pull request gets reviewed and merged”
              </li>
              <li onClick={() => setDraft("Bar chart: Q1 120, Q2 190, Q3 90, Q4 170 — and call out the best quarter")}>
                “Bar chart: Q1 120, Q2 190, Q3 90, Q4 170 — call out the best”
              </li>
              <li onClick={() => setDraft("Make the shapes I've selected into a neat horizontal row")}>
                “Make the shapes I've selected into a neat horizontal row”
              </li>
            </ul>
          </div>
        )}

        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <div key={i} className="chat-msg chat-msg--user">{turn.text}</div>
          ) : turn.role === "assistant" ? (
            turn.text ? <div key={i} className="chat-msg chat-msg--bot">{turn.text}</div> : null
          ) : (
            <div key={i} className={`chat-tool ${isOk(turn.result) ? "" : "is-error"}`}>
              <code>{turn.name}</code>
              <span>{summarise(turn.result)}</span>
            </div>
          ),
        )}

        {busy && <div className="chat-msg chat-msg--bot chat-busy">drawing…</div>}
        {error && <div className="chat-error">{error}</div>}
      </div>

      <div className="chat-compose">
        <textarea
          value={draft}
          rows={2}
          placeholder="Ask it to draw something…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
          }}
        />
        <button className="chat-send" disabled={busy || !draft.trim()} onClick={() => void send()}>
          Send
        </button>
      </div>
    </aside>
  );
}

function isOk(result: unknown): boolean {
  return !!(result && typeof result === "object" && (result as { ok?: boolean }).ok);
}

function summarise(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const r = result as Record<string, unknown>;
  if (r.ok === false) return String(r.error ?? "failed");
  for (const key of ["created", "patched", "deleted", "focused", "undone"]) {
    const v = r[key];
    if (Array.isArray(v)) return `${v.length} element${v.length === 1 ? "" : "s"}`;
  }
  if (typeof r.count === "number") return `${r.count} element${r.count === 1 ? "" : "s"}`;
  return "ok";
}

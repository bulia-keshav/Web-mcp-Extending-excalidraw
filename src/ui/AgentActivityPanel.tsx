import { useEffect, useState } from "react";
import { subscribe, undoById, isRevertible, type AgentAction } from "../webmcp/actionStack";
import type { WebMCPMode } from "../webmcp/detect";
import "./AgentActivityPanel.css";

const MODE_LABEL: Record<WebMCPMode, string> = {
  native: "Connected to an agent",
  shim: "No agent host — local test mode",
  none: "WebMCP unavailable",
};

export default function AgentActivityPanel({
  open,
  onClose,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  mode: WebMCPMode;
}) {
  const [actions, setActions] = useState<AgentAction[]>([]);

  useEffect(() => subscribe(setActions), []);

  if (!open) return null;

  const recent = [...actions].reverse();

  return (
    <aside className="agent-panel">
      <header className="agent-panel__head">
        <div>
          <strong>Agent activity</strong>
          <span className={`agent-panel__mode agent-panel__mode--${mode}`}>{MODE_LABEL[mode]}</span>
        </div>
        <button onClick={onClose} aria-label="Close panel">×</button>
      </header>

      {recent.length === 0 ? (
        <p className="agent-panel__empty">
          Nothing yet. Every tool call the agent makes shows up here, and each one
          can be undone on its own.
        </p>
      ) : (
        <ol className="agent-panel__list">
          {recent.map((a) => (
            <li key={a.id} className={a.ok ? "" : "is-error"} data-undone={a.undone ? "1" : undefined}>
              <div className="agent-panel__row">
                <code>{a.tool}</code>
                <time>{new Date(a.at).toLocaleTimeString()}</time>
              </div>
              <div className="agent-panel__summary">{a.summary}</div>
              {isRevertible(a) && (
                <button className="agent-panel__undo" onClick={() => undoById(a.id)}>
                  Undo this step
                </button>
              )}
              {a.undone && <span className="agent-panel__undone">undone</span>}
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

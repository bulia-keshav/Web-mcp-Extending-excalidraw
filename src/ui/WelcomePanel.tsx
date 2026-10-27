import { useEffect, useState } from "react";
import type { WebMCPMode } from "../webmcp/detect";
import "./WelcomePanel.css";

const DISMISS_KEY = "sketchpad-agent:welcome-dismissed:v1";

/**
 * Most visitors arrive in a browser with no WebMCP host, so the thing that
 * makes this app interesting is invisible to them — it just looks like a
 * drawing board. A small coloured dot was not enough signal. This says what
 * the page is and how to actually reach the agent tools.
 */
export default function WelcomePanel({
  mode,
  toolCount,
  onOpenChat,
}: {
  mode: WebMCPMode;
  toolCount: number;
  onOpenChat?: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch { /* private mode */ }
    // Someone already connected to an agent does not need the explainer.
    if (!dismissed && mode !== "native") setOpen(true);
  }, [mode]);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  };

  if (!open) return null;

  const connected = mode === "native";

  return (
    <div className="welcome-backdrop" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-card">
        <h1 id="welcome-title">An Excalidraw canvas your AI can draw on</h1>
        <p className="welcome-lede">
          This whiteboard exposes <strong>{toolCount} tools</strong> to an AI agent, so it can
          build charts, flowcharts, timelines and whole boards <em>on the canvas you are
          working on</em> — while you keep drawing.
        </p>

        <div className={`welcome-status welcome-status--${connected ? "on" : "off"}`}>
          {connected
            ? "An agent is connected. Just ask it to draw something."
            : "No AI agent is connected to this page right now."}
        </div>

        {!connected && (
          <>
            <h2>Two ways to use it</h2>
            <ol className="welcome-ways">
              <li>
                <strong>Use your own AI key — works in any browser.</strong>
                <span>
                  Open the chat panel, paste an Anthropic or OpenAI key, and start asking.
                  The key is stored only in this browser and never sent anywhere but the
                  provider.
                </span>
                {onOpenChat && (
                  <button className="welcome-primary" onClick={() => { dismiss(); onOpenChat(); }}>
                    Open the chat panel
                  </button>
                )}
              </li>
              <li>
                <strong>Open this page inside an AI browser.</strong>
                <span>
                  In ChatGPT's built-in browser, or Chrome with{" "}
                  <code>chrome://flags/#enable-webmcp-testing</code> enabled, the agent
                  discovers all {toolCount} tools automatically — no key needed.
                </span>
              </li>
            </ol>
          </>
        )}

        <div className="welcome-actions">
          <button className="welcome-ghost" onClick={dismiss}>
            {connected ? "Got it" : "Just let me draw"}
          </button>
          <a
            className="welcome-link"
            href="https://github.com/bulia-keshav/Web-mcp-Extending-excalidraw"
            target="_blank"
            rel="noreferrer noopener"
          >
            How it works ↗
          </a>
        </div>
      </div>
    </div>
  );
}

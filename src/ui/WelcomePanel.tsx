import { useEffect, useState } from "react";
import type { WebMCPMode } from "../webmcp/detect";
import "./WelcomePanel.css";

const DISMISS_KEY = "sketchpad-agent:welcome-dismissed:v1";

/**
 * Most visitors arrive without a WebMCP host, so the thing that makes this app
 * interesting is invisible and it reads as a plain drawing board.
 *
 * It never appears when an agent is already connected, which is why there is
 * no status line — the panel's presence is the status.
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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch { /* private mode */ }
    if (!dismissed && mode !== "native") setOpen(true);
  }, [mode]);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  };

  // The no-key route is the one most people will take, so it has to be an
  // action too — not a sentence telling them to go and do something.
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      window.prompt("Copy this link, then open it in ChatGPT's browser:", window.location.href);
    }
  };

  if (!open) return null;

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome__note">
        <h1 id="welcome-title" className="welcome__title">
          Your AI can draw <mark>here</mark>.
        </h1>

        <p className="welcome__body">
          {toolCount} tools, drawn straight onto the canvas you are already using.
        </p>

        <p className="welcome__keywords">
          charts, flowcharts, timelines, hierarchies, relationship graphs,
          tables, multi-panel boards, callouts, duplication, arranging, undo
        </p>

        <div className="welcome__choices">
          <button className="welcome__go" onClick={copyLink}>
            {copied ? "Link copied — now paste it in ChatGPT" : "Open in ChatGPT's browser"}
          </button>
          {onOpenChat && (
            <button
              className="welcome__alt-go"
              onClick={() => { dismiss(); onOpenChat(); }}
            >
              Use your own API key
            </button>
          )}
        </div>

        <button className="welcome__skip" onClick={dismiss}>Just let me draw</button>
      </div>
    </div>
  );
}

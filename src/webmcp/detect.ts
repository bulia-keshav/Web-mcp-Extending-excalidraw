import type { ModelContextLike } from "./types";

/**
 * Two surfaces exist and they are NOT the same object:
 *   - document.modelContext  — ChatGPT's built-in browser (site tools)
 *   - navigator.modelContext — the W3C/Chrome surface (chrome://flags/#enable-webmcp-testing)
 * Registering on only one silently exposes nothing in the other, so we
 * register on every host actually present.
 */
type HostCarrier = { modelContext?: ModelContextLike };

function candidates(): Array<{ label: string; host: ModelContextLike }> {
  const found: Array<{ label: string; host: ModelContextLike }> = [];

  const doc = (document as unknown as HostCarrier).modelContext;
  if (typeof doc?.registerTool === "function") found.push({ label: "document", host: doc });

  const nav = (navigator as unknown as HostCarrier).modelContext;
  if (typeof nav?.registerTool === "function" && nav !== doc) {
    found.push({ label: "navigator", host: nav });
  }

  return found;
}

/** True when a genuine WebMCP host is present (not our stand-in). */
export function hasNativeWebMCP(): boolean {
  return candidates().some(({ host }) => !host.__isShim);
}

export type WebMCPMode = "native" | "shim" | "none";

export function currentMode(): WebMCPMode {
  const found = candidates();
  if (found.some(({ host }) => !host.__isShim)) return "native";
  if (found.length) return "shim";
  return "none";
}

/** Which surfaces we are registered against — shown in the UI and the harness. */
export function hostLabels(): string[] {
  return candidates().map(({ label, host }) => (host.__isShim ? `${label} (shim)` : label));
}

/**
 * Every real host present, plus an inert stand-in if there are none.
 *
 * The shim ships to production on purpose: it keeps the real registration path
 * running so the deployed build can be exercised without an agent, while
 * currentMode() always reports honestly which one is in play. It never
 * replaces a genuine host.
 */
export function resolveHosts(): ModelContextLike[] {
  const found = candidates();
  if (found.length) return found.map((f) => f.host);

  const shim: ModelContextLike = { __isShim: true, registerTool: () => () => {} };
  try {
    Object.defineProperty(document, "modelContext", { value: shim, configurable: true, writable: true });
  } catch {
    (document as unknown as HostCarrier).modelContext = shim;
  }
  return [shim];
}

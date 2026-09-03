import type { ModelContextLike } from "./types";

/**
 * True only when a real WebMCP host (ChatGPT, or Chrome with
 * chrome://flags/#enable-webmcp-testing) has injected the API.
 */
export function hasNativeWebMCP(): boolean {
  return typeof document.modelContext?.registerTool === "function" && !document.modelContext?.__isShim;
}

export type WebMCPMode = "native" | "shim" | "none";

export function currentMode(): WebMCPMode {
  if (hasNativeWebMCP()) return "native";
  if (document.modelContext?.__isShim) return "shim";
  return "none";
}

/**
 * When no host is present we install an inert stand-in so the *real*
 * registration code path still executes. This ships to production on purpose:
 * it lets the deployed build be exercised end-to-end without ChatGPT, while
 * `currentMode()` always reports honestly which one is in play. It never
 * overwrites a genuine host.
 */
export function installShimIfAbsent(): ModelContextLike {
  if (document.modelContext?.registerTool) return document.modelContext;

  const shim: ModelContextLike = {
    __isShim: true,
    registerTool: () => () => {},
  };
  try {
    Object.defineProperty(document, "modelContext", {
      value: shim,
      configurable: true,
      writable: true,
    });
  } catch {
    (document as unknown as { modelContext: ModelContextLike }).modelContext = shim;
  }
  return shim;
}

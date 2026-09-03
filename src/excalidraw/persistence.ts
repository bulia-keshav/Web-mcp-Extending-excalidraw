import { restoreAppState, restoreElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles, ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";

/**
 * The npm package does NOT persist anything on its own (that lives in
 * excalidraw.com's app code, not the library). We own this.
 */
const KEY = "sketchpad-agent:scene:v1";

/** appState is huge and full of transient junk; only these keys are worth keeping. */
const APP_STATE_KEYS = [
  "viewBackgroundColor",
  "currentItemStrokeColor",
  "currentItemBackgroundColor",
  "currentItemFontFamily",
  "currentItemFontSize",
  "currentItemStrokeWidth",
  "currentItemRoughness",
  "gridSize",
  "theme",
  "name",
] as const;
// Deliberately NOT persisting zoom/scrollX/scrollY: restoring them fights
// `scrollToContent: true` on load, which leaves the restored drawing parked
// off-screen. Fitting to content on open is the more predictable behaviour.

export function loadScene(): ExcalidrawInitialDataState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      elements?: unknown;
      appState?: unknown;
      files?: BinaryFiles;
    };
    return {
      elements: restoreElements((parsed.elements as ExcalidrawElement[]) ?? [], null),
      appState: restoreAppState((parsed.appState as Partial<AppState>) ?? {}, null),
      files: parsed.files ?? {},
      scrollToContent: true,
    };
  } catch (err) {
    console.warn("[persistence] Could not restore scene, starting fresh:", err);
    try { localStorage.removeItem(KEY); } catch { /* quota/private mode */ }
    return null;
  }
}

function pickAppState(appState: AppState): Partial<AppState> {
  const out: Record<string, unknown> = {};
  for (const k of APP_STATE_KEYS) {
    if (k in appState) out[k] = (appState as unknown as Record<string, unknown>)[k];
  }
  return out as Partial<AppState>;
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Debounced so a drag doesn't write on every pointermove. */
export function scheduleSave(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
  delay = 500,
) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          elements: elements.filter((el) => !el.isDeleted),
          appState: pickAppState(appState),
          files,
        }),
      );
    } catch (err) {
      // Images push scenes past the ~5MB localStorage quota quickly.
      console.warn("[persistence] Save failed (quota?):", err);
    }
  }, delay);
}

export function clearSaved() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

import { getCommonBounds } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { requireAPI } from "./apiRef";
import { getLiveElements, getElementById } from "./sceneOps";

/**
 * The agent never supplies absolute coordinates — LLMs are bad at x/y.
 * It supplies intent; this module turns intent into numbers.
 */
export type Placement =
  | { mode: "viewport" }
  | { mode: "next_to"; refId: string; side?: "right" | "below" | "left" | "above"; gap?: number }
  | { mode: "free_space" }
  | { mode: "absolute"; x: number; y: number };

export type Rect = { x: number; y: number; width: number; height: number };

/** The scene rectangle the human can currently see. */
export function viewportRect(): Rect {
  const st = requireAPI().getAppState();
  const zoom = st.zoom?.value ?? 1;
  return {
    x: -st.scrollX,
    y: -st.scrollY,
    width: st.width / zoom,
    height: st.height / zoom,
  };
}

/** Bounding box of everything live on the canvas, or null if empty. */
export function sceneBounds(): Rect | null {
  const els = getLiveElements();
  if (!els.length) return null;
  const [x1, y1, x2, y2] = getCommonBounds(els as ExcalidrawElement[]);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export function boundsOf(elements: readonly ExcalidrawElement[]): Rect | null {
  if (!elements.length) return null;
  const [x1, y1, x2, y2] = getCommonBounds(elements as ExcalidrawElement[]);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

const DEFAULT_GAP = 80;

/**
 * Returns the top-left corner at which content of the given size should be
 * placed. Composite tools build at origin (0,0) then translate by this.
 */
export function resolvePlacement(
  placement: Placement | undefined,
  contentWidth: number,
  contentHeight: number,
): { x: number; y: number } {
  const p = placement ?? { mode: "viewport" as const };

  switch (p.mode) {
    case "absolute":
      return { x: p.x, y: p.y };

    case "next_to": {
      const ref = getElementById(p.refId);
      if (!ref) {
        // Degrade gracefully rather than throwing — the agent gets *something*
        // placed where the human is looking, and a warning in the result.
        return centerOf(viewportRect(), contentWidth, contentHeight);
      }
      const gap = p.gap ?? DEFAULT_GAP;
      const side = p.side ?? "right";
      const rw = ref.width ?? 0;
      const rh = ref.height ?? 0;
      switch (side) {
        case "right": return { x: ref.x + rw + gap, y: ref.y };
        case "left": return { x: ref.x - gap - contentWidth, y: ref.y };
        case "below": return { x: ref.x, y: ref.y + rh + gap };
        case "above": return { x: ref.x, y: ref.y - gap - contentHeight };
      }
      break;
    }

    case "free_space": {
      const b = sceneBounds();
      if (!b) return centerOf(viewportRect(), contentWidth, contentHeight);
      return { x: b.x + b.width + DEFAULT_GAP, y: b.y };
    }

    case "viewport":
    default:
      return centerOf(viewportRect(), contentWidth, contentHeight);
  }

  return centerOf(viewportRect(), contentWidth, contentHeight);
}

function centerOf(rect: Rect, w: number, h: number) {
  return {
    x: Math.round(rect.x + rect.width / 2 - w / 2),
    y: Math.round(rect.y + rect.height / 2 - h / 2),
  };
}

/** Translate a batch of skeleton-ish objects that carry x/y. */
export function translateAll<T extends { x?: number; y?: number }>(
  items: T[],
  dx: number,
  dy: number,
): T[] {
  return items.map((it) => ({ ...it, x: (it.x ?? 0) + dx, y: (it.y ?? 0) + dy }));
}

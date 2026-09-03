import { defineTool, z } from "../defineTool";
import { getLiveElements, getSelectedElements } from "../../excalidraw/sceneOps";
import { requireAPI } from "../../excalidraw/apiRef";
import { boundsOf, viewportRect } from "../../excalidraw/placement";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

const MAX_ELEMENTS = 80;

/** Compact projection — never hand raw Excalidraw elements to the agent. */
function brief(el: ExcalidrawElement) {
  const anyEl = el as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {
    id: el.id,
    type: el.type,
    x: Math.round(el.x),
    y: Math.round(el.y),
    w: Math.round(el.width),
    h: Math.round(el.height),
  };
  const text = (anyEl.text as string | undefined) ?? undefined;
  if (text) out.text = text.length > 120 ? `${text.slice(0, 120)}…` : text;
  if (anyEl.containerId) out.containerId = anyEl.containerId;
  if (el.strokeColor && el.strokeColor !== "#1e1e1e") out.strokeColor = el.strokeColor;
  if (el.backgroundColor && el.backgroundColor !== "transparent") out.backgroundColor = el.backgroundColor;
  if (anyEl.startBinding) out.boundStart = (anyEl.startBinding as { elementId: string }).elementId;
  if (anyEl.endBinding) out.boundEnd = (anyEl.endBinding as { elementId: string }).elementId;
  return out;
}

/**
 * Bound text lives in its own element; fold it into its container's label.
 * The lookup is built from the WHOLE scene, not the subset being projected —
 * a selection of shapes does not include their bound text children, so a
 * subset-only map would report every selected shape as unlabelled.
 */
function withLabels(els: readonly ExcalidrawElement[]) {
  const textByContainer = new Map<string, string>();
  for (const el of getLiveElements()) {
    const c = (el as unknown as { containerId?: string }).containerId;
    const t = (el as unknown as { text?: string }).text;
    if (c && t) textByContainer.set(c, t);
  }
  return els
    .filter((el) => !(el as unknown as { containerId?: string }).containerId)
    .map((el) => {
      const b = brief(el);
      const label = textByContainer.get(el.id);
      if (label) b.label = label;
      return b;
    });
}

export const getScene = defineTool({
  name: "get_scene",
  description: `Read what is currently drawn on the canvas. Call this before modifying anything you did not just create, so you use real element ids instead of guessing.

Returns compact records: id, type, x, y, w, h, and label/text where present. "summary" (default) caps the list so the response stays small; use "full" only when you genuinely need every element.

Example: {"detail":"summary"}`,
  schema: z.object({
    detail: z.enum(["summary", "full"]).default("summary")
      .describe("summary caps at 80 elements and groups counts by type; full returns everything up to `limit`."),
    limit: z.number().int().positive().max(500).optional()
      .describe("Maximum elements to return. Defaults to 80."),
  }),
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  execute: ({ detail, limit }) => {
    const live = getLiveElements();
    const byType: Record<string, number> = {};
    for (const el of live) byType[el.type] = (byType[el.type] ?? 0) + 1;

    const projected = withLabels(live);
    const cap = limit ?? (detail === "summary" ? MAX_ELEMENTS : 500);
    const elements = projected.slice(0, cap);

    return {
      ok: true,
      count: live.length,
      byType,
      elements,
      truncated: projected.length > cap,
      bounds: boundsOf(live),
    };
  },
});

export const getSelection = defineTool({
  name: "get_selection",
  description: `Read the elements the human currently has selected on the canvas. This is how you act on what they mean by "these" or "this one" without asking them to describe it.

Call this first whenever the request refers to something the user has highlighted. Returns the selected elements and their combined bounding box; an empty list means nothing is selected.

Example: {}`,
  schema: z.object({}),
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  execute: () => {
    const selected = getSelectedElements();
    return {
      ok: true,
      count: selected.length,
      ids: selected.map((el) => el.id),
      elements: withLabels(selected),
      bounds: boundsOf(selected),
    };
  },
});

export const getViewport = defineTool({
  name: "get_viewport",
  description: `Read the region of the canvas the human is currently looking at, plus zoom level. Useful when you want to reason about whether something you drew is actually on screen. Most of the time you do not need this — drawing tools already default to placing content in the visible area.

Example: {}`,
  schema: z.object({}),
  annotations: { readOnlyHint: true },
  execute: () => {
    const st = requireAPI().getAppState();
    const r = viewportRect();
    return {
      ok: true,
      visible: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
      zoom: st.zoom?.value ?? 1,
      scrollX: Math.round(st.scrollX),
      scrollY: Math.round(st.scrollY),
    };
  },
});

export const findElements = defineTool({
  name: "find_elements",
  description: `Find elements whose text or label contains a phrase (case-insensitive). Use this to extend or edit an existing diagram instead of redrawing it — e.g. the user says "make the Login box red" and you need its id.

Example: {"query":"login"}`,
  schema: z.object({
    query: z.string().min(1).describe("Substring to look for in element text and labels."),
    type: z.string().optional().describe('Optional element type filter, e.g. "rectangle" or "text".'),
  }),
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  execute: ({ query, type }) => {
    const q = query.toLowerCase();
    const live = getLiveElements();
    const matches = withLabels(live).filter((el) => {
      if (type && el.type !== type) return false;
      const hay = `${(el.text as string) ?? ""} ${(el.label as string) ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    return { ok: true, query, count: matches.length, elements: matches.slice(0, MAX_ELEMENTS) };
  },
});

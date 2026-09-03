import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { getElementById } from "./sceneOps";

/**
 * The agent describes shapes semantically and refers to them by its own
 * temporary ids. We map those onto real element ids up front and pass them
 * through with `regenerateIds: false`, so bindings resolve inside a single
 * convert call and the agent gets a tempId -> realId map back.
 */

export type SkeletonSpec = {
  tempId?: string;
  type: "rectangle" | "ellipse" | "diamond" | "text" | "arrow" | "line" | "frame";
  label?: string;
  text?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  start?: { tempId?: string; id?: string };
  end?: { tempId?: string; id?: string };
  children?: string[];
  name?: string;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: "hachure" | "cross-hatch" | "solid";
  strokeWidth?: number;
  roughness?: number;
  fontSize?: number;
  opacity?: number;
  angle?: number;
};

let counter = 0;
export function newId(prefix = "el"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}_${Math.random().toString(36).slice(2, 8)}`;
}

export type BuildResult = {
  elements: ExcalidrawElement[];
  /** tempId -> real element id, returned to the agent for follow-up calls */
  idMap: Record<string, string>;
  warnings: string[];
};

const DEFAULT_W = 180;
const DEFAULT_H = 90;

export function buildFromSkeletons(specs: SkeletonSpec[]): BuildResult {
  const warnings: string[] = [];
  const idMap: Record<string, string> = {};

  // Pass 1: assign a real id to every tempId before anything references it.
  for (const s of specs) {
    if (s.tempId && !idMap[s.tempId]) idMap[s.tempId] = newId(s.type.slice(0, 4));
  }

  const resolveRef = (ref?: { tempId?: string; id?: string }): string | undefined => {
    if (!ref) return undefined;
    if (ref.tempId) {
      const mapped = idMap[ref.tempId];
      if (!mapped) {
        warnings.push(`Unknown tempId "${ref.tempId}" in a binding; arrow left unbound.`);
        return undefined;
      }
      return mapped;
    }
    return ref.id;
  };

  const byTempId = new Map(specs.filter((s) => s.tempId).map((s) => [idMap[s.tempId!], s]));

  // Pass 2: build skeletons.
  const skeletons: ExcalidrawElementSkeleton[] = [];

  for (const s of specs) {
    const id = s.tempId ? idMap[s.tempId] : newId(s.type.slice(0, 4));

    const style: Record<string, unknown> = {};
    if (s.strokeColor) style.strokeColor = s.strokeColor;
    if (s.backgroundColor) style.backgroundColor = s.backgroundColor;
    if (s.fillStyle) style.fillStyle = s.fillStyle;
    if (s.strokeWidth != null) style.strokeWidth = s.strokeWidth;
    if (s.roughness != null) style.roughness = s.roughness;
    if (s.opacity != null) style.opacity = s.opacity;
    if (s.angle != null) style.angle = s.angle;

    if (s.type === "frame") {
      skeletons.push({
        type: "frame",
        id,
        children: (s.children ?? []) as readonly string[],
        name: s.name ?? s.label ?? "Frame",
        ...(s.x != null ? { x: s.x } : {}),
        ...(s.y != null ? { y: s.y } : {}),
      } as ExcalidrawElementSkeleton);
      continue;
    }

    if (s.type === "text") {
      skeletons.push({
        type: "text",
        id,
        x: s.x ?? 0,
        y: s.y ?? 0,
        text: s.text ?? s.label ?? "",
        ...(s.fontSize ? { fontSize: s.fontSize } : {}),
        ...style,
      } as ExcalidrawElementSkeleton);
      continue;
    }

    if (s.type === "arrow" || s.type === "line") {
      const startId = resolveRef(s.start);
      const endId = resolveRef(s.end);

      // A bound arrow still needs its own geometry: Excalidraw records the
      // binding but does not invent a span, so without this the arrow
      // collapses to a stub in the corner of its source shape.
      const span = geometryBetween(specs, byTempId, s, startId, endId);

      skeletons.push({
        type: s.type,
        id,
        x: span.x,
        y: span.y,
        width: span.width,
        height: span.height,
        // Explicit points are required for exact geometry: Excalidraw treats
        // width:0 as "unset" and substitutes a default of 100, which turns a
        // vertical axis line into a diagonal.
        points: [
          [0, 0],
          [span.width, span.height],
        ],
        ...(startId ? { start: { id: startId } } : {}),
        ...(endId ? { end: { id: endId } } : {}),
        // Bound label on an arrow must go through `label`, not a text element.
        ...(s.label ? { label: { text: s.label, ...(s.fontSize ? { fontSize: s.fontSize } : {}) } } : {}),
        ...style,
      } as ExcalidrawElementSkeleton);
      continue;
    }

    // rectangle | ellipse | diamond
    skeletons.push({
      type: s.type,
      id,
      x: s.x ?? 0,
      y: s.y ?? 0,
      width: s.width ?? DEFAULT_W,
      height: s.height ?? DEFAULT_H,
      // `label` keeps text centred and moving with the container. A separate
      // text element would drift the moment the human drags the shape.
      ...(s.label ? { label: { text: s.label, ...(s.fontSize ? { fontSize: s.fontSize } : {}) } } : {}),
      ...style,
    } as ExcalidrawElementSkeleton);
  }

  // regenerateIds:false preserves the ids assigned above, so bindings resolve.
  const elements = convertToExcalidrawElements(skeletons, {
    regenerateIds: false,
  }) as unknown as ExcalidrawElement[];

  return { elements, idMap, warnings };
}

/** Width/height of a set of skeletons, for placement before they exist. */
export function measureSkeletons(specs: SkeletonSpec[]): { width: number; height: number } {
  let maxX = 0;
  let maxY = 0;
  for (const s of specs) {
    maxX = Math.max(maxX, (s.x ?? 0) + (s.width ?? DEFAULT_W));
    maxY = Math.max(maxY, (s.y ?? 0) + (s.height ?? DEFAULT_H));
  }
  return { width: maxX, height: maxY };
}

type Box = { x: number; y: number; width: number; height: number };

/** Geometry of a bound endpoint, whether it is in this batch or already on the canvas. */
function boxFor(byTempId: Map<string, SkeletonSpec>, realId: string | undefined): Box | null {
  if (!realId) return null;
  const spec = byTempId.get(realId);
  if (spec) {
    return {
      x: spec.x ?? 0,
      y: spec.y ?? 0,
      width: spec.width ?? DEFAULT_W,
      height: spec.height ?? DEFAULT_H,
    };
  }
  const existing = getElementById(realId);
  if (existing) {
    return { x: existing.x, y: existing.y, width: existing.width, height: existing.height };
  }
  return null;
}

const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

const ARROW_GAP = 8;

/**
 * Where the line from a box's centre in direction (dx,dy) crosses its edge.
 * Without this the arrow is drawn from centre to centre and visibly strikes
 * through the labels of both shapes.
 */
function edgePoint(box: Box, dx: number, dy: number) {
  const c = centre(box);
  const hw = box.width / 2;
  const hh = box.height / 2;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < 1e-6 && ay < 1e-6) return c;
  // Scale the direction until it first touches a vertical or horizontal edge.
  const t = Math.min(ax > 1e-6 ? hw / ax : Infinity, ay > 1e-6 ? hh / ay : Infinity);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

/**
 * Edge-to-edge span with a small gap at each end, so the arrow reads as
 * connecting the shapes rather than piercing them.
 */
function geometryBetween(
  _specs: SkeletonSpec[],
  byTempId: Map<string, SkeletonSpec>,
  s: SkeletonSpec,
  startId: string | undefined,
  endId: string | undefined,
): Box {
  const a = boxFor(byTempId, startId);
  const b = boxFor(byTempId, endId);

  if (a && b) {
    const ca = centre(a);
    const cb = centre(b);
    let dx = cb.x - ca.x;
    let dy = cb.y - ca.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    const from = edgePoint(a, ux, uy);
    const to = edgePoint(b, -ux, -uy);

    const sx = from.x + ux * ARROW_GAP;
    const sy = from.y + uy * ARROW_GAP;
    const ex = to.x - ux * ARROW_GAP;
    const ey = to.y - uy * ARROW_GAP;

    return { x: sx, y: sy, width: ex - sx, height: ey - sy };
  }

  // Unbound (or half-bound) arrow: honour whatever the caller gave us.
  return {
    x: s.x ?? 0,
    y: s.y ?? 0,
    width: s.width ?? 100,
    height: s.height ?? 0,
  };
}

/**
 * Tag every element of a composite (a chart, a table, a flowchart) with a
 * shared group id. Two payoffs: the human can drag the whole diagram as one
 * unit, and `placement: next_to` can resolve the diagram's real extent instead
 * of the bounding box of whichever single element the agent happened to name.
 */
export function groupElements(
  elements: ExcalidrawElement[],
  groupId = newId("grp"),
): { elements: ExcalidrawElement[]; groupId: string } {
  return {
    groupId,
    elements: elements.map((el) => ({
      ...el,
      groupIds: [...(el.groupIds ?? []), groupId],
    })) as ExcalidrawElement[],
  };
}

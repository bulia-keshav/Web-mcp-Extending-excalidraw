import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import { requireAPI } from "./apiRef";

/** Rough advance width of a glyph as a fraction of font size. */
const CHAR_WIDTH_RATIO = 0.58;
const MIN_LABEL_FONT = 10;

export type MermaidShape = "rectangle" | "diamond" | "round" | "stadium" | "circle";

/**
 * Mermaid treats a pile of characters as syntax. Anything the agent puts in a
 * label has to be quoted and escaped or the whole diagram fails to parse.
 */
export function escapeLabel(text: string): string {
  return text
    .replace(/"/g, "&quot;")
    .replace(/\n/g, " ")
    .replace(/[<>]/g, (m) => (m === "<" ? "&lt;" : "&gt;"))
    .trim();
}

/** Mermaid node ids must be simple identifiers. */
export function safeNodeId(raw: string, index: number): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z]/.test(cleaned) ? cleaned : `n${index}_${cleaned}`;
}

export function shapeSyntax(id: string, label: string, shape: MermaidShape = "rectangle"): string {
  const t = `"${escapeLabel(label)}"`;
  switch (shape) {
    case "diamond": return `${id}{${t}}`;
    case "round": return `${id}(${t})`;
    case "stadium": return `${id}([${t}])`;
    case "circle": return `${id}((${t}))`;
    default: return `${id}[${t}]`;
  }
}


let diagramSeq = 0;

/**
 * A caller's node id is a LABEL, not an identity.
 *
 * Feeding it straight to Mermaid caused two bugs: ids like "call", "class",
 * "end", "graph", "style", "subgraph" are Mermaid keywords and killed the
 * parse; and because ids survive conversion verbatim, two diagrams using the
 * same names (h0, or a/b) collided into one scene, leaving arrows bound to
 * whichever node happened to be found first.
 *
 * So callers' ids never reach Mermaid. Each diagram gets its own scope which
 * hands out opaque, unique, keyword-free tokens, and the caller's own id comes
 * back to them in `nodeIds`.
 */
export type DiagramScope = {
  prefix: string;
  /** Stable token for a caller id — same id in, same token out. */
  tokenFor: (callerId: string) => string;
  /** callerId -> token, for building the returned nodeIds map. */
  tokens: Record<string, string>;
};

export function newDiagramScope(): DiagramScope {
  diagramSeq += 1;
  const prefix = `d${Date.now().toString(36)}${diagramSeq}`;
  const tokens: Record<string, string> = {};
  let next = 0;

  return {
    prefix,
    tokens,
    tokenFor(callerId: string) {
      const existing = tokens[callerId];
      if (existing) return existing;
      // Short and diagram-local; namespaceElements makes it globally unique.
      const token = `n${next++}`;
      tokens[callerId] = token;
      return token;
    },
  };
}

type Rewritable = Record<string, unknown>;

/**
 * Make every element id in a freshly converted diagram unique, rewriting all
 * internal references so bindings keep pointing at the right elements. Applied
 * to the raw-mermaid path too, where we cannot control the ids at source.
 */
function namespaceElements(
  elements: ExcalidrawElement[],
  prefix: string,
): { elements: ExcalidrawElement[]; idMap: Record<string, string> } {
  const idMap: Record<string, string> = {};
  for (const el of elements) idMap[el.id] = `${prefix}_${el.id}`;

  const remap = (id: unknown) => (typeof id === "string" && idMap[id] ? idMap[id] : id);

  const out = elements.map((el) => {
    const e = { ...(el as unknown as Rewritable) };
    e.id = idMap[el.id];

    for (const key of ["startBinding", "endBinding"]) {
      const b = e[key] as { elementId?: string } | null | undefined;
      if (b?.elementId) e[key] = { ...b, elementId: remap(b.elementId) };
    }
    if (e.containerId) e.containerId = remap(e.containerId);
    if (e.frameId) e.frameId = remap(e.frameId);
    if (Array.isArray(e.boundElements)) {
      e.boundElements = (e.boundElements as Array<{ id: string }>).map((b) => ({ ...b, id: remap(b.id) as string }));
    }
    return e as unknown as ExcalidrawElement;
  });

  return { elements: out, idMap };
}

export type MermaidRender = {
  elements: ExcalidrawElement[];
  files: BinaryFiles | null;
  /** mermaid node id -> real Excalidraw element id */
  nodeIds: Record<string, string>;
  width: number;
  height: number;
};

/**
 * Parse Mermaid text and place the result at (offsetX, offsetY).
 *
 * mermaid is dynamically imported so it stays out of the initial bundle —
 * the library is ~84MB unpacked and most sessions never draw a flowchart.
 */
export async function renderMermaid(
  definition: string,
  offset: { x: number; y: number } | null,
  opts?: { fontSize?: number; scope?: DiagramScope },
): Promise<MermaidRender> {
  const scope = opts?.scope;
  const { parseMermaidToExcalidraw } = await import("@excalidraw/mermaid-to-excalidraw");

  const parsed = await parseMermaidToExcalidraw(definition, {
    themeVariables: { fontSize: `${opts?.fontSize ?? 16}px` },
  });

  const skeletons = parsed.elements as unknown as Array<Record<string, unknown>>;

  // Normalise to origin first so placement is predictable regardless of the
  // coordinates mermaid's layout engine happens to emit.
  let minX = Infinity;
  let minY = Infinity;
  for (const s of skeletons) {
    if (typeof s.x === "number") minX = Math.min(minX, s.x as number);
    if (typeof s.y === "number") minY = Math.min(minY, s.y as number);
  }
  if (!Number.isFinite(minX)) minX = 0;
  if (!Number.isFinite(minY)) minY = 0;

  const dx = (offset?.x ?? 0) - minX;
  const dy = (offset?.y ?? 0) - minY;

  const shifted = skeletons.map((s) => {
    const moved: Record<string, unknown> = {
      ...s,
      ...(typeof s.x === "number" ? { x: (s.x as number) + dx } : {}),
      ...(typeof s.y === "number" ? { y: (s.y as number) + dy } : {}),
    };

    // A diamond's usable text area is its inscribed rectangle — about half its
    // width — so mermaid's sizing leaves "Urgent?" wrapping mid-word to
    // "Urge / nt?". Shrink the LABEL to fit rather than growing the shape:
    // mermaid computed every edge endpoint against the original geometry, so
    // resizing the diamond makes arrows terminate inside it.
    if (moved.type === "diamond" && typeof moved.width === "number") {
      const label = moved.label as { text?: string; fontSize?: number } | undefined;
      if (label?.text) {
        const usable = (moved.width as number) * 0.5 - 12;
        const size = label.fontSize ?? 16;
        const longestWord = label.text.split(/\s+/).reduce((a, b) => (a.length >= b.length ? a : b), "");
        const estimated = longestWord.length * size * CHAR_WIDTH_RATIO;
        if (estimated > usable && usable > 0) {
          moved.label = {
            ...label,
            fontSize: Math.max(MIN_LABEL_FONT, Math.floor(size * (usable / estimated))),
          };
        }
      }
    }

    return moved;
  });

  const converted = convertToExcalidrawElements(
    shifted as never,
    { regenerateIds: false },
  ) as unknown as ExcalidrawElement[];

  // Unique per diagram, so drawing the same shape twice cannot collide.
  const { elements, idMap } = namespaceElements(converted, scope?.prefix ?? newDiagramScope().prefix);

  if (parsed.files) {
    requireAPI().addFiles(Object.values(parsed.files));
  }

  // mermaid node id -> the real (namespaced) canvas id
  const nodeIds: Record<string, string> = {};
  for (const sk of skeletons) {
    const id = sk.id as string | undefined;
    if (id && idMap[id]) nodeIds[id] = idMap[id];
  }

  let maxX = 0;
  let maxY = 0;
  for (const el of elements) {
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }

  return {
    elements,
    files: (parsed.files as unknown as BinaryFiles) ?? null,
    nodeIds,
    width: maxX - (offset?.x ?? 0),
    height: maxY - (offset?.y ?? 0),
  };
}

/** Rough size estimate so placement can run before mermaid has laid anything out. */
export async function measureMermaid(definition: string): Promise<{ width: number; height: number }> {
  const { parseMermaidToExcalidraw } = await import("@excalidraw/mermaid-to-excalidraw");
  const parsed = await parseMermaidToExcalidraw(definition, {});
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of parsed.elements as unknown as Array<Record<string, number>>) {
    if (typeof s.x !== "number") continue;
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + (s.width ?? 0));
    maxY = Math.max(maxY, s.y + (s.height ?? 0));
  }
  if (!Number.isFinite(minX)) return { width: 600, height: 400 };
  return { width: maxX - minX, height: maxY - minY };
}

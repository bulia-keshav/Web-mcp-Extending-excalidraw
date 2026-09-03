import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import { requireAPI } from "./apiRef";

const DIAMOND_SCALE_X = 1.7;
const DIAMOND_SCALE_Y = 1.15;

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
  opts?: { fontSize?: number },
): Promise<MermaidRender> {
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

    // Mermaid sizes a diamond for its own renderer, where the label sits in a
    // wider usable area than Excalidraw's diamond gives it. Left alone, a word
    // like "Urgent?" wraps mid-word to "Urge / nt?". Widen the diamond about
    // its own centre so the label fits on one line.
    if (moved.type === "diamond" && typeof moved.width === "number" && typeof moved.height === "number") {
      const w = moved.width as number;
      const h = moved.height as number;
      const nw = w * DIAMOND_SCALE_X;
      const nh = h * DIAMOND_SCALE_Y;
      moved.width = nw;
      moved.height = nh;
      if (typeof moved.x === "number") moved.x = (moved.x as number) - (nw - w) / 2;
      if (typeof moved.y === "number") moved.y = (moved.y as number) - (nh - h) / 2;
    }

    return moved;
  });

  const elements = convertToExcalidrawElements(
    shifted as never,
    { regenerateIds: false },
  ) as unknown as ExcalidrawElement[];

  if (parsed.files) {
    requireAPI().addFiles(Object.values(parsed.files));
  }

  const nodeIds: Record<string, string> = {};
  for (const s of skeletons) {
    const id = s.id as string | undefined;
    if (id) nodeIds[id] = id;
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

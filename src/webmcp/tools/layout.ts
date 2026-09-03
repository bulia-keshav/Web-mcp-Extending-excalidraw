import { defineTool, z } from "../defineTool";
import { getLiveElements, patchElements } from "../../excalidraw/sceneOps";
import { noteBeforePatch } from "../registry";

export const arrange = defineTool({
  name: "arrange",
  description: `Reposition existing elements into a tidy row, column, or grid. This is the tool for "line these up", "make these a horizontal pipeline", "tidy this up".

Usually you call get_selection first and pass those ids. Arrows bound to the moved shapes stay attached.

Example: {"ids":["a1","b2","c3"],"mode":"row","gap":60,"align":"center"}`,
  schema: z.object({
    ids: z.array(z.string()).min(2),
    mode: z.enum(["row", "column", "grid"]).default("row")
      .describe("row = left to right, column = top to bottom, grid = wrapped rows."),
    gap: z.number().min(0).max(400).default(60).describe("Space between elements in canvas units."),
    align: z.enum(["left", "center", "top"]).default("center")
      .describe("How to line up the cross axis."),
    columns: z.number().int().min(1).max(10).optional().describe("Grid mode only: how many per row."),
  }),
  annotations: { readOnlyHint: false },
  execute: ({ ids, mode, gap, align, columns }) => {
    const byId = new Map(getLiveElements().map((el) => [el.id, el]));
    const targets = ids.map((id) => byId.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof byId.get>>[];

    if (targets.length < 2) {
      return { ok: false, error: "not_enough_elements", hint: "Need at least two existing ids to arrange." };
    }

    // Anchor on the top-left of the current group so the drawing does not jump.
    const startX = Math.min(...targets.map((el) => el.x));
    const startY = Math.min(...targets.map((el) => el.y));

    const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];

    if (mode === "row") {
      const maxH = Math.max(...targets.map((el) => el.height));
      let x = startX;
      for (const el of targets) {
        const y = align === "top" ? startY : startY + (maxH - el.height) / 2;
        updates.push({ id: el.id, patch: { x, y } });
        x += el.width + gap;
      }
    } else if (mode === "column") {
      const maxW = Math.max(...targets.map((el) => el.width));
      let y = startY;
      for (const el of targets) {
        const x = align === "left" ? startX : startX + (maxW - el.width) / 2;
        updates.push({ id: el.id, patch: { x, y } });
        y += el.height + gap;
      }
    } else {
      const cols = columns ?? Math.ceil(Math.sqrt(targets.length));
      const cellW = Math.max(...targets.map((el) => el.width)) + gap;
      const cellH = Math.max(...targets.map((el) => el.height)) + gap;
      targets.forEach((el, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        updates.push({ id: el.id, patch: { x: startX + c * cellW, y: startY + r * cellH } });
      });
    }

    noteBeforePatch(updates.map((u) => u.id));
    const res = patchElements(updates);
    return { ok: true, mode, arranged: res.patched, missing: ids.filter((id) => !byId.has(id)) };
  },
});

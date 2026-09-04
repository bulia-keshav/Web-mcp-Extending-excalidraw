import { defineTool, z, placementSchema } from "../defineTool";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { appendElements } from "../../excalidraw/sceneOps";
import { newId } from "../../excalidraw/skeleton";
import { resolvePlacement, type Placement } from "../../excalidraw/placement";
import { INK } from "../../excalidraw/palette";
import { invoke } from "../registry";
import { PANEL_NODE_CAP } from "../limits";

const GAP = 110;
const TITLE_H = 46;

const panelSchema = z.object({
  title: z.string().describe("Panel heading, shown above the diagram."),
  kind: z.enum(["flowchart", "hierarchy", "timeline", "graph", "table", "chart"]),
  spec: z.record(z.string(), z.unknown())
    .describe("The input you would pass to that kind's own tool, minus `placement`."),
});

const TOOL_FOR: Record<string, string> = {
  flowchart: "draw_flowchart",
  hierarchy: "draw_hierarchy",
  timeline: "draw_timeline",
  graph: "draw_graph",
  table: "draw_table",
  chart: "draw_chart",
};

export const drawBoard = defineTool({
  name: "draw_board",
  description: `Draw SEVERAL diagrams at once, laid out in a grid, each with its own heading. This is the right tool for a long document — a thesis chapter, a paper, a novel — where one diagram would be an unreadable hairball.

Do not try to fit a whole document into one diagram. Produce 3 to 6 panels, one per major section or theme, each under ${PANEL_NODE_CAP} nodes. Keep labels under six words and put detail in "detail" fields rather than in node labels.

Each panel's "spec" is exactly what you would pass to that kind's own tool. Returns per-panel ids so you can extend one panel later instead of redrawing everything.

Example: {"columns":2,"panels":[
  {"title":"Structure","kind":"hierarchy","spec":{"root":{"label":"Chapter 3","children":[{"label":"Method"},{"label":"Results"}]}}},
  {"title":"Procedure","kind":"flowchart","spec":{"nodes":[{"id":"a","label":"Recruit"},{"id":"b","label":"Measure"}],"edges":[{"from":"a","to":"b"}]}}
]}`,
  schema: z.object({
    title: z.string().optional().describe("Overall board heading."),
    panels: z.array(panelSchema).min(1).max(8),
    columns: z.number().int().min(1).max(4).default(2),
    placement: placementSchema,
  }),
  annotations: { readOnlyHint: false },
  execute: async ({ title, panels, columns, placement }) => {
    // Anchor the whole board once; panels are then placed at absolute
    // positions relative to it.
    const origin = resolvePlacement(placement as Placement | undefined, 1400, 900);

    const boardTitleH = title ? 60 : 0;
    let cursorX = origin.x;
    let cursorY = origin.y + boardTitleH;
    let rowHeight = 0;
    let col = 0;

    const results: Array<Record<string, unknown>> = [];
    const failures: Array<{ title: string; error: string; hint?: string }> = [];
    const allCreated: string[] = [];

    if (title) {
      const [titleEl] = convertToExcalidrawElements(
        [{ type: "text", id: newId("btitle"), x: origin.x, y: origin.y, text: title, fontSize: 28, strokeColor: INK } as never],
        { regenerateIds: false },
      ) as unknown as ExcalidrawElement[];
      appendElements([titleEl]);
      allCreated.push(titleEl.id);
    }

    for (const panel of panels) {
      const toolName = TOOL_FOR[panel.kind];

      // Heading for the panel
      const [heading] = convertToExcalidrawElements(
        [{ type: "text", id: newId("ptitle"), x: cursorX, y: cursorY, text: panel.title, fontSize: 20, strokeColor: INK } as never],
        { regenerateIds: false },
      ) as unknown as ExcalidrawElement[];
      appendElements([heading]);
      allCreated.push(heading.id);

      // Each panel is drawn through its own tool, so board output is identical
      // to what the individual tools produce — one renderer, not two.
      const res = (await invoke(toolName, {
        ...panel.spec,
        placement: { mode: "absolute", x: cursorX, y: cursorY + TITLE_H },
      })) as Record<string, unknown>;

      if (!res.ok) {
        failures.push({
          title: panel.title,
          error: String(res.error ?? "panel_failed"),
          hint: res.hint ? String(res.hint) : undefined,
        });
        // Still advance the cursor so one bad panel does not stack the rest.
        cursorX += 600 + GAP;
        rowHeight = Math.max(rowHeight, 300);
      } else {
        const size = (res.size as { width: number; height: number } | undefined) ?? { width: 600, height: 360 };
        const created = (res.created as string[] | undefined) ?? [];
        allCreated.push(...created);
        results.push({
          title: panel.title,
          kind: panel.kind,
          refId: res.refId,
          groupId: res.groupId,
          nodeIds: res.nodeIds ?? res.cells ?? res.points ?? res.eventIds,
        });
        cursorX += size.width + GAP;
        rowHeight = Math.max(rowHeight, size.height + TITLE_H);
      }

      col += 1;
      if (col >= columns) {
        col = 0;
        cursorX = origin.x;
        cursorY += rowHeight + GAP;
        rowHeight = 0;
      }
    }

    // Every panel failed: report it as a failure so the agent retries, rather
    // than claiming success over an empty board.
    if (!results.length) {
      return {
        ok: false,
        error: "all_panels_failed",
        hint: failures.map((f) => `${f.title}: ${f.error}${f.hint ? ` (${f.hint})` : ""}`).join("; "),
      };
    }

    return {
      ok: true,
      panels: results,
      created: allCreated.length,
      placedAt: origin,
      ...(failures.length
        ? { failures, hint: "Some panels failed; the rest were drawn. Fix those specs and add them with the individual tools." }
        : {}),
    };
  },
});

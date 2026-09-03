import { defineTool, z, placementSchema } from "../defineTool";
import { buildFromSkeletons, groupElements, type SkeletonSpec } from "../../excalidraw/skeleton";
import { appendElements } from "../../excalidraw/sceneOps";
import { resolvePlacement, type Placement } from "../../excalidraw/placement";
import { INK } from "../../excalidraw/palette";
import { noteCreated } from "../registry";

const HEADER_FILL = "#e7f5ff";
const ROW_H = 44;

export const drawTable = defineTool({
  name: "draw_table",
  description: `Draw a table as a grid of cells with a shaded header row. Use this for comparisons, result summaries, or any small tabular data the user wants on the canvas rather than in chat.

Returns cell ids keyed "row:col" (header row is row 0), so you can restyle or annotate individual cells afterwards.

Keep it readable: at most about 8 columns and 20 rows. For long data, summarise first.

Example: {"headers":["Method","Accuracy"],"rows":[["Baseline","71%"],["Ours","88%"]]}`,
  schema: z.object({
    headers: z.array(z.string()).min(1).max(10),
    rows: z.array(z.array(z.string())).min(1).max(40),
    columnWidth: z.number().min(60).max(500).default(170),
    placement: placementSchema,
  }),
  annotations: { readOnlyHint: false },
  execute: ({ headers, rows, columnWidth, placement }) => {
    const bad = rows.findIndex((r) => r.length !== headers.length);
    if (bad !== -1) {
      return {
        ok: false,
        error: "ragged_rows",
        hint: `Row ${bad} has ${rows[bad].length} cells but there are ${headers.length} headers. Pad short rows with "".`,
      };
    }

    const cols = headers.length;
    const width = cols * columnWidth;
    const height = (rows.length + 1) * ROW_H;

    const specs: SkeletonSpec[] = [];
    const cellTemp: Record<string, string> = {};

    headers.forEach((h, c) => {
      const tempId = `c0_${c}`;
      specs.push({
        tempId, type: "rectangle", label: h,
        x: c * columnWidth, y: 0, width: columnWidth, height: ROW_H,
        backgroundColor: HEADER_FILL, fillStyle: "solid", strokeColor: INK, fontSize: 16,
      });
      cellTemp[`0:${c}`] = tempId;
    });

    rows.forEach((row, r) => {
      row.forEach((cell, c) => {
        const tempId = `c${r + 1}_${c}`;
        specs.push({
          tempId, type: "rectangle", label: cell,
          x: c * columnWidth, y: (r + 1) * ROW_H, width: columnWidth, height: ROW_H,
          strokeColor: INK, fontSize: 16,
        });
        cellTemp[`${r + 1}:${c}`] = tempId;
      });
    });

    const origin = resolvePlacement(placement as Placement | undefined, width, height);
    const positioned = specs.map((s) => ({ ...s, x: (s.x ?? 0) + origin.x, y: (s.y ?? 0) + origin.y }));

    const built = buildFromSkeletons(positioned);
    const { elements, groupId } = groupElements(built.elements);
    const idMap = built.idMap;
    appendElements(elements);
    noteCreated(elements.map((el) => el.id));

    const cells: Record<string, string> = {};
    for (const [key, tempId] of Object.entries(cellTemp)) {
      if (idMap[tempId]) cells[key] = idMap[tempId];
    }

    return {
      ok: true,
      created: elements.map((el) => el.id),
      groupId,
      refId: elements[0]?.id,
      cells,
      shape: { rows: rows.length + 1, cols },
      placedAt: origin,
      size: { width, height },
    };
  },
});

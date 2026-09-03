import { defineTool, z } from "../defineTool";
import { buildFromSkeletons, type SkeletonSpec } from "../../excalidraw/skeleton";
import { appendElements, getElementById } from "../../excalidraw/sceneOps";
import { noteCreated } from "../registry";

const OFFSET = 130;

export const annotate = defineTool({
  name: "annotate",
  description: `Add a callout note pointing at a specific element: a short piece of text placed beside it, with an arrow linking the two. Use this to draw attention to something — the tallest bar in a chart, the bottleneck in a flowchart, the cell with the best result.

Get the target id from draw_chart's "points", draw_table's "cells", a draw_* tool's "nodeIds", get_selection, or find_elements.

Example: {"targetId":"abc123","text":"biggest jump","side":"top","color":"#e03131"}`,
  schema: z.object({
    targetId: z.string().describe("The element the note points at."),
    text: z.string().min(1).max(200).describe("Keep it short — a phrase, not a paragraph."),
    side: z.enum(["top", "right", "bottom", "left"]).default("top")
      .describe("Which side of the target to put the note on."),
    color: z.string().optional().describe('Hex colour for the note and arrow, e.g. "#e03131".'),
  }),
  annotations: { readOnlyHint: false },
  execute: ({ targetId, text, side, color }) => {
    const target = getElementById(targetId);
    if (!target) {
      return { ok: false, error: "no_such_element", hint: `No element with id "${targetId}". Call get_scene or find_elements for current ids.` };
    }

    const stroke = color ?? "#e03131";
    // Rough text box so the callout can be positioned before it is measured.
    const noteW = Math.min(280, Math.max(90, text.length * 9));
    const noteH = 26;

    const cx = target.x + target.width / 2;
    const cy = target.y + target.height / 2;

    let nx = cx - noteW / 2;
    let ny = cy - noteH / 2;
    switch (side) {
      case "top":    ny = target.y - OFFSET; break;
      case "bottom": ny = target.y + target.height + OFFSET - noteH; break;
      case "left":   nx = target.x - OFFSET - noteW; break;
      case "right":  nx = target.x + target.width + OFFSET; break;
    }

    const specs: SkeletonSpec[] = [
      {
        tempId: "note",
        type: "rectangle",
        label: text,
        x: nx, y: ny, width: noteW, height: noteH,
        strokeColor: stroke,
        backgroundColor: "transparent",
        fontSize: 16,
      },
      {
        tempId: "lead",
        type: "arrow",
        start: { tempId: "note" },
        end: { id: targetId },
        strokeColor: stroke,
      },
    ];

    const { elements, idMap } = buildFromSkeletons(specs);
    appendElements(elements);
    noteCreated(elements.map((el) => el.id));

    return {
      ok: true,
      created: elements.map((el) => el.id),
      noteId: idMap.note,
      arrowId: idMap.lead,
      targetId,
    };
  },
});

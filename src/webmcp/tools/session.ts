import { defineTool, z } from "../defineTool";
import * as actionStack from "../actionStack";
import { getLiveElements, softDelete } from "../../excalidraw/sceneOps";
import { noteRemoved } from "../registry";

export const undoAgentStep = defineTool({
  name: "undo_agent_step",
  description: `Undo your own most recent change(s) to the canvas. Use this when the human says that was wrong, or you realise you drew the wrong thing.

This only reverses YOUR actions — it never touches what the human drew themselves.

Example: {"steps":1}`,
  schema: z.object({
    steps: z.number().int().positive().max(20).default(1)
      .describe("How many of your recent actions to reverse. Defaults to 1."),
  }),
  annotations: { readOnlyHint: false },
  execute: ({ steps }) => {
    const res = actionStack.undo(steps);
    if (!res.undone.length) return { ok: false, error: "nothing_to_undo", hint: "You have not made any reversible changes yet." };
    return { ok: true, undone: res.undone };
  },
});

export const clearCanvas = defineTool({
  name: "clear_canvas",
  description: `Erase everything on the canvas. This removes the human's own work too, so ALWAYS ask them to confirm in the conversation before calling it, and only call it when they have clearly said yes.

Example: {"confirm":true}`,
  schema: z.object({
    confirm: z.literal(true).describe("Must be exactly true, and only after the human has agreed."),
  }),
  annotations: { readOnlyHint: false, destructiveHint: true },
  execute: () => {
    const ids = getLiveElements().map((el) => el.id);
    if (!ids.length) return { ok: true, deleted: [], note: "Canvas was already empty." };
    softDelete(ids);
    noteRemoved(ids);
    return { ok: true, deleted: ids, count: ids.length };
  },
});

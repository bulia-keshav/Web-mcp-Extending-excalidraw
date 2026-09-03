import { defineTool, z } from "../defineTool";
import { NODE_CAP, PANEL_NODE_CAP } from "../limits";
import { getLiveElements } from "../../excalidraw/sceneOps";
import { isReady } from "../../excalidraw/apiRef";

/**
 * Per-tool descriptions say what each tool does. Nothing said how they fit
 * together, so an agent had to infer the workflow. This is the missing
 * overview: cheap to call, and it prevents the common failure modes
 * (guessing coordinates, redrawing instead of editing, one giant diagram).
 */
export const howToDraw = defineTool({
  name: "how_to_draw_here",
  description: `Read this FIRST, before drawing anything on this canvas. It explains which tool to reach for, how positioning works, and the limits that will otherwise make your calls fail. Costs one quick call and saves several wrong ones.

Example: {}`,
  schema: z.object({}),
  annotations: { readOnlyHint: true },
  execute: () => ({
    ok: true,
    canvas_is_shared_with_a_human: true,

    important: [
      "You cannot see this canvas. Never claim you can see what is drawn — call get_scene to read it, or ask the human.",
      "A human is drawing here too. Your writes are appended and never overwrite their work, so it is safe to add while they work.",
      "Never guess x/y coordinates. Omit them and the page positions things where the human is looking.",
    ],

    pick_the_right_tool: {
      "a process, steps, decisions, an algorithm": "draw_flowchart",
      "a strict tree: outline, org chart, taxonomy": "draw_hierarchy",
      "things related to each other in no hierarchy: characters, concepts, components": "draw_graph",
      "events in order: milestones, stages, plot": "draw_timeline",
      "numbers the user gave you (CSV, figures)": "draw_chart",
      "small tabular data, comparisons": "draw_table",
      "a long document, a whole chapter, several themes at once": "draw_board",
      "a few loose shapes, or extending something that already exists": "add_elements",
    },

    typical_workflow: [
      "If the user refers to 'these' or 'this one', call get_selection first — it returns exactly what they have highlighted.",
      "To change something already drawn, get its id from get_scene or find_elements, then use update_elements or restyle. Do not redraw the whole diagram.",
      "After drawing something, consider focus_on so the human is actually looking at it.",
      "Drawing tools return ids (nodeIds / cells / points / eventIds). Keep them — they are how you annotate or edit that exact element later.",
      "To put something beside an existing diagram, pass placement {mode:'next_to', refId:<any id from that diagram>, side:'right'}.",
    ],

    limits_that_will_fail_your_call: {
      node_cap: `${NODE_CAP} nodes per diagram. Over that returns error "too_many_nodes".`,
      what_to_do_instead: `Use draw_board with 3-6 panels, one per section or theme, each under ${PANEL_NODE_CAP} nodes.`,
      labels: "Keep labels under about six words. Put detail in a 'detail' field where the tool has one, not in the label.",
    },

    if_you_make_a_mistake: "Call undo_agent_step. It reverses only your own changes and never touches what the human drew.",

    canvas_right_now: isReady()
      ? { element_count: getLiveElements().length, empty: getLiveElements().length === 0 }
      : { still_loading: true },
  }),
});

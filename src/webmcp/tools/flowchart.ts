import { defineTool, z, placementSchema } from "../defineTool";
import { renderMermaid, shapeSyntax, safeNodeId, escapeLabel, type MermaidShape } from "../../excalidraw/mermaid";
import { appendElements } from "../../excalidraw/sceneOps";
import { groupElements } from "../../excalidraw/skeleton";
import { resolvePlacement, type Placement } from "../../excalidraw/placement";
import { noteCreated } from "../registry";
import { NODE_CAP } from "../limits";

const nodeSchema = z.object({
  id: z.string().describe("Short identifier you will use in edges, e.g. \"start\"."),
  label: z.string().describe("Text shown in the box. Keep it under about six words."),
  shape: z.enum(["rectangle", "diamond", "round", "stadium", "circle"]).optional()
    .describe('Use "diamond" for decisions and "stadium" for start/end. Defaults to rectangle.'),
});

const edgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional().describe('Text on the arrow, e.g. "yes" / "no".'),
});

/** Turn the structured form into Mermaid text so both inputs share one renderer. */
export function nodesToMermaid(
  nodes: Array<{ id: string; label: string; shape?: string }>,
  edges: Array<{ from: string; to: string; label?: string }>,
  direction: string,
): { text: string; idFor: Record<string, string> } {
  const idFor: Record<string, string> = {};
  nodes.forEach((n, i) => { idFor[n.id] = safeNodeId(n.id, i); });

  const lines = [`flowchart ${direction}`];
  for (const n of nodes) {
    lines.push(`  ${shapeSyntax(idFor[n.id], n.label, (n.shape as MermaidShape) ?? "rectangle")}`);
  }
  for (const e of edges) {
    const a = idFor[e.from];
    const b = idFor[e.to];
    if (!a || !b) continue;
    lines.push(e.label ? `  ${a} -->|"${escapeLabel(e.label)}"| ${b}` : `  ${a} --> ${b}`);
  }
  return { text: lines.join("\n"), idFor };
}

export const drawFlowchart = defineTool({
  name: "draw_flowchart",
  description: `Draw a proper flowchart with automatic layout. Use this — not add_elements — whenever the user describes a process, algorithm, decision tree, pipeline, or any set of steps connected by arrows. Layout, spacing and arrow routing are handled for you.

Give either "nodes" + "edges" (preferred — you do not have to know Mermaid) or a raw "mermaid" string. Use shape "diamond" for decision points.

Keep it under ${NODE_CAP} nodes; for anything bigger, split it into a draw_board with several panels.

Example: {"nodes":[{"id":"s","label":"Submit","shape":"stadium"},{"id":"d","label":"Approved?","shape":"diamond"},{"id":"p","label":"Publish"}],"edges":[{"from":"s","to":"d"},{"from":"d","to":"p","label":"yes"}],"direction":"LR"}`,
  schema: z.object({
    nodes: z.array(nodeSchema).optional(),
    edges: z.array(edgeSchema).optional(),
    direction: z.enum(["TD", "LR", "BT", "RL"]).default("TD")
      .describe("TD = top-down (default), LR = left-to-right. Use LR for pipelines."),
    mermaid: z.string().optional()
      .describe('Raw Mermaid, e.g. "flowchart LR\\n A[One] --> B[Two]". Only use if you specifically need Mermaid syntax.'),
    placement: placementSchema,
  }),
  annotations: { readOnlyHint: false },
  execute: async ({ nodes, edges, direction, mermaid, placement }) => {
    let text: string;
    let idFor: Record<string, string> = {};

    if (mermaid?.trim()) {
      text = mermaid.trim();
    } else if (nodes?.length) {
      if (nodes.length > NODE_CAP) {
        return {
          ok: false,
          error: "too_many_nodes",
          hint: `${nodes.length} nodes exceeds the ${NODE_CAP} cap. Split it into a draw_board with one panel per section, each under 25 nodes.`,
        };
      }
      const gen = nodesToMermaid(nodes, edges ?? [], direction);
      text = gen.text;
      idFor = gen.idFor;
    } else {
      return { ok: false, error: "invalid_input", hint: 'Provide either "nodes" (with optional "edges") or a "mermaid" string.' };
    }

    let render;
    try {
      // Lay out at origin first so we know the true size before placing it.
      render = await renderMermaid(text, { x: 0, y: 0 });
    } catch (err) {
      return {
        ok: false,
        error: "mermaid_parse_failed",
        hint: `${err instanceof Error ? err.message : String(err)}. Check labels for characters that need escaping, or pass nodes/edges instead of raw mermaid.`,
      };
    }

    const origin = resolvePlacement(placement as Placement | undefined, render.width, render.height);
    const placed = await renderMermaid(text, origin);

    const { elements: grouped, groupId } = groupElements(placed.elements);
    appendElements(grouped);
    noteCreated(grouped.map((el) => el.id));

    // Map the agent's own node ids onto real element ids for follow-up calls.
    const nodeIds: Record<string, string> = {};
    for (const [agentId, mermaidId] of Object.entries(idFor)) {
      if (placed.nodeIds[mermaidId]) nodeIds[agentId] = placed.nodeIds[mermaidId];
    }

    return {
      ok: true,
      created: grouped.map((el) => el.id),
      groupId,
      refId: grouped[0]?.id,
      nodeIds: Object.keys(nodeIds).length ? nodeIds : placed.nodeIds,
      placedAt: origin,
      size: { width: Math.round(render.width), height: Math.round(render.height) },
    };
  },
});

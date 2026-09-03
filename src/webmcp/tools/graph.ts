import { defineTool, z, placementSchema } from "../defineTool";
import { renderMermaid, escapeLabel, safeNodeId } from "../../excalidraw/mermaid";
import { appendElements } from "../../excalidraw/sceneOps";
import { groupElements } from "../../excalidraw/skeleton";
import { resolvePlacement, type Placement } from "../../excalidraw/placement";
import { noteCreated } from "../registry";
import { NODE_CAP } from "../limits";

export const drawGraph = defineTool({
  name: "draw_graph",
  description: `Draw a relationship graph — things connected to each other in no particular hierarchy. Use this for characters in a novel, concepts in a literature review, components in a system, or citations between works.

Use "group" on nodes to cluster related items; each group is drawn as a labelled box around its members. Edges are undirected by default; set "directed": true for an arrow.

Keep it under ${NODE_CAP} nodes. If the structure is a strict tree, draw_hierarchy gives a cleaner result.

Example: {"nodes":[{"id":"anna","label":"Anna","group":"Family"},{"id":"pyotr","label":"Pyotr","group":"Family"},{"id":"vronsky","label":"Vronsky"}],"edges":[{"from":"anna","to":"pyotr","label":"married to"},{"from":"anna","to":"vronsky","label":"affair","directed":true}]}`,
  schema: z.object({
    title: z.string().optional(),
    nodes: z.array(z.object({
      id: z.string(),
      label: z.string(),
      group: z.string().optional().describe("Nodes sharing a group are drawn inside a labelled cluster."),
    })).min(1),
    edges: z.array(z.object({
      from: z.string(),
      to: z.string(),
      label: z.string().optional(),
      directed: z.boolean().default(false),
    })).default([]),
    direction: z.enum(["TD", "LR"]).default("LR"),
    placement: placementSchema,
  }),
  annotations: { readOnlyHint: false },
  execute: async ({ nodes, edges, direction, placement }) => {
    if (nodes.length > NODE_CAP) {
      return {
        ok: false,
        error: "too_many_nodes",
        hint: `${nodes.length} nodes exceeds the ${NODE_CAP} cap. Split into a draw_board with one panel per theme, each under 25 nodes.`,
      };
    }

    const idFor: Record<string, string> = {};
    nodes.forEach((n, i) => { idFor[n.id] = safeNodeId(n.id, i); });

    const lines = [`flowchart ${direction}`];

    // Clusters first, then anything ungrouped.
    const groups = new Map<string, typeof nodes>();
    const loose: typeof nodes = [];
    for (const n of nodes) {
      if (n.group) {
        const list = groups.get(n.group) ?? [];
        list.push(n);
        groups.set(n.group, list);
      } else loose.push(n);
    }

    let gi = 0;
    for (const [groupName, members] of groups) {
      lines.push(`  subgraph g${gi}["${escapeLabel(groupName)}"]`);
      for (const n of members) lines.push(`    ${idFor[n.id]}["${escapeLabel(n.label)}"]`);
      lines.push("  end");
      gi += 1;
    }
    for (const n of loose) lines.push(`  ${idFor[n.id]}["${escapeLabel(n.label)}"]`);

    for (const e of edges) {
      const a = idFor[e.from];
      const b = idFor[e.to];
      if (!a || !b) continue;
      const connector = e.directed ? "-->" : "---";
      lines.push(e.label ? `  ${a} ${connector}|"${escapeLabel(e.label)}"| ${b}` : `  ${a} ${connector} ${b}`);
    }

    const text = lines.join("\n");

    let measured;
    try {
      measured = await renderMermaid(text, { x: 0, y: 0 });
    } catch (err) {
      return { ok: false, error: "layout_failed", hint: err instanceof Error ? err.message : String(err) };
    }

    const origin = resolvePlacement(placement as Placement | undefined, measured.width, measured.height);
    const placed = await renderMermaid(text, origin);
    const { elements, groupId } = groupElements(placed.elements);

    appendElements(elements);
    noteCreated(elements.map((el) => el.id));

    const nodeIds: Record<string, string> = {};
    for (const [agentId, mid] of Object.entries(idFor)) {
      if (placed.nodeIds[mid]) nodeIds[agentId] = placed.nodeIds[mid];
    }

    return {
      ok: true,
      created: elements.map((el) => el.id),
      groupId,
      refId: elements[0]?.id,
      nodeIds,
      placedAt: origin,
      size: { width: Math.round(measured.width), height: Math.round(measured.height) },
    };
  },
});

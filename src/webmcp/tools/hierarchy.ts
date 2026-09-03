import { defineTool, z, placementSchema } from "../defineTool";
import { renderMermaid, shapeSyntax, safeNodeId } from "../../excalidraw/mermaid";
import { appendElements } from "../../excalidraw/sceneOps";
import { groupElements } from "../../excalidraw/skeleton";
import { resolvePlacement, type Placement } from "../../excalidraw/placement";
import { noteCreated } from "../registry";
import { NODE_CAP } from "../limits";

type TreeNode = { label: string; children?: TreeNode[] };

const treeNode: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    label: z.string().describe("Short — under about six words."),
    children: z.array(treeNode).optional(),
  }),
);

function flatten(root: TreeNode) {
  const nodes: Array<{ id: string; label: string }> = [];
  const edges: Array<{ from: string; to: string }> = [];
  let n = 0;
  const walk = (node: TreeNode, parentId: string | null) => {
    const id = safeNodeId(`h${n}`, n);
    n += 1;
    nodes.push({ id, label: node.label });
    if (parentId) edges.push({ from: parentId, to: id });
    for (const child of node.children ?? []) walk(child, id);
  };
  walk(root, null);
  return { nodes, edges };
}

export const drawHierarchy = defineTool({
  name: "draw_hierarchy",
  description: `Draw a tree: section outlines, org charts, taxonomies, "chapter -> sections -> key points". Use this when the structure is strictly nested (every item has one parent). If items connect to each other in more than one direction, use draw_graph instead.

Nest with "children" to any depth. Keep the whole tree under ${NODE_CAP} nodes — for a long document, produce a draw_board with one hierarchy panel per major section instead.

Example: {"root":{"label":"Chapter 3","children":[{"label":"Method","children":[{"label":"Sampling"}]},{"label":"Results"}]},"direction":"TD"}`,
  schema: z.object({
    title: z.string().optional(),
    root: treeNode,
    direction: z.enum(["TD", "LR"]).default("TD")
      .describe("TD = top-down. LR reads better for deep outlines."),
    placement: placementSchema,
  }),
  annotations: { readOnlyHint: false },
  execute: async ({ root, direction, placement }) => {
    const { nodes, edges } = flatten(root);
    if (nodes.length > NODE_CAP) {
      return {
        ok: false,
        error: "too_many_nodes",
        hint: `${nodes.length} nodes exceeds the ${NODE_CAP} cap. Split into a draw_board with one panel per branch, each under 25 nodes.`,
      };
    }

    const lines = [`flowchart ${direction}`];
    for (const n of nodes) lines.push(`  ${shapeSyntax(n.id, n.label, "rectangle")}`);
    for (const e of edges) lines.push(`  ${e.from} --> ${e.to}`);
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

    return {
      ok: true,
      created: elements.map((el) => el.id),
      groupId,
      refId: elements[0]?.id,
      nodeCount: nodes.length,
      placedAt: origin,
      size: { width: Math.round(measured.width), height: Math.round(measured.height) },
    };
  },
});

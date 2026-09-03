import { defineTool, z, placementSchema } from "../defineTool";
import { buildFromSkeletons, measureSkeletons, type SkeletonSpec } from "../../excalidraw/skeleton";
import { appendElements, patchElements, softDelete, getLiveElements, getElementById } from "../../excalidraw/sceneOps";
import { resolvePlacement, type Placement } from "../../excalidraw/placement";
import { requireAPI } from "../../excalidraw/apiRef";
import { noteCreated, noteRemoved, noteBeforePatch } from "../registry";
import { NODE_CAP } from "../limits";

const shapeEnum = z.enum(["rectangle", "ellipse", "diamond", "text", "arrow", "line", "frame"]);

const skeletonSchema = z.object({
  tempId: z.string().optional()
    .describe("Your own name for this element, so later elements in the same call can bind arrows to it."),
  type: shapeEnum,
  label: z.string().optional()
    .describe("Text INSIDE a shape, or ON an arrow. Prefer this over a separate text element — it stays centred and moves with the shape."),
  text: z.string().optional().describe('Content for type "text" only.'),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  start: z.object({ tempId: z.string().optional(), id: z.string().optional() }).optional()
    .describe('Arrows only. Bind the tail: {"tempId":"a"} for something in this call, {"id":"<realId>"} for an existing element.'),
  end: z.object({ tempId: z.string().optional(), id: z.string().optional() }).optional()
    .describe("Arrows only. Bind the head, same shape as `start`."),
  children: z.array(z.string()).optional().describe("Frames only: real ids of the elements this frame contains."),
  name: z.string().optional().describe("Frames only: the frame's title."),
  strokeColor: z.string().optional().describe('Hex, e.g. "#e03131".'),
  backgroundColor: z.string().optional().describe('Fill, e.g. "#ffec99". Use "transparent" for none.'),
  fillStyle: z.enum(["hachure", "cross-hatch", "solid"]).optional(),
  strokeWidth: z.number().optional(),
  roughness: z.number().optional().describe("0 = clean lines, 1 = hand-drawn (default), 2 = sketchy."),
  fontSize: z.number().optional(),
  opacity: z.number().min(0).max(100).optional(),
});

export const addElements = defineTool({
  name: "add_elements",
  description: `Draw new shapes, text and arrows on the canvas. Use this for freeform or small structures; prefer draw_flowchart when the user describes a process with steps, and draw_chart/draw_table for data.

Bindings are the important part: give each shape a "tempId", then an arrow with start/end referring to those tempIds will attach to the shapes and re-route automatically when the human drags them. Put text inside a shape with "label", not as a separate text element.

You usually should NOT pass x/y — omit them and the content is placed where the human is looking.

Example: {"elements":[
  {"tempId":"a","type":"rectangle","label":"Draft"},
  {"tempId":"b","type":"rectangle","label":"Review","x":300,"y":0},
  {"tempId":"e","type":"arrow","label":"submit","start":{"tempId":"a"},"end":{"tempId":"b"}}
]}`,
  schema: z.object({
    elements: z.array(skeletonSchema).min(1).max(NODE_CAP)
      .describe("The shapes to draw. Coordinates are relative to each other; the whole group gets positioned by `placement`."),
    placement: placementSchema,
  }),
  annotations: { readOnlyHint: false },
  execute: ({ elements, placement }) => {
    const specs = elements as SkeletonSpec[];

    if (specs.length > NODE_CAP) {
      return {
        ok: false,
        error: "too_many_nodes",
        hint: `Received ${specs.length}, cap is ${NODE_CAP}. Split into a draw_board with several panels.`,
      };
    }

    // Content is authored around origin, then translated as a whole so the
    // agent never has to think in absolute canvas coordinates.
    const { width, height } = measureSkeletons(specs);
    const origin = resolvePlacement(placement as Placement | undefined, width || 200, height || 120);

    const positioned = specs.map((s) => ({
      ...s,
      x: (s.x ?? 0) + origin.x,
      y: (s.y ?? 0) + origin.y,
    }));

    const { elements: built, idMap, warnings } = buildFromSkeletons(positioned);

    appendElements(built);
    noteCreated(built.map((el) => el.id));

    return {
      ok: true,
      created: built.map((el) => el.id),
      idMap,
      placedAt: origin,
      ...(warnings.length ? { warnings } : {}),
    };
  },
});

export const updateElements = defineTool({
  name: "update_elements",
  description: `Change existing elements by id — move, resize, recolour, or retext them. Get ids from get_scene, get_selection or find_elements.

To change only colours on several elements at once, restyle is simpler. Use this when you need to move or resize things.

Example: {"updates":[{"id":"abc123","patch":{"x":400,"backgroundColor":"#ffec99"}}]}`,
  schema: z.object({
    updates: z.array(
      z.object({
        id: z.string(),
        patch: z.object({
          x: z.number().optional(),
          y: z.number().optional(),
          width: z.number().optional(),
          height: z.number().optional(),
          strokeColor: z.string().optional(),
          backgroundColor: z.string().optional(),
          fillStyle: z.enum(["hachure", "cross-hatch", "solid"]).optional(),
          strokeWidth: z.number().optional(),
          roughness: z.number().optional(),
          opacity: z.number().min(0).max(100).optional(),
          angle: z.number().optional(),
          text: z.string().optional().describe("New text. Works on text elements and on a shape's bound label."),
          fontSize: z.number().optional(),
        }),
      }),
    ).min(1),
  }),
  annotations: { readOnlyHint: false },
  execute: ({ updates }) => {
    // A shape's visible text lives in a separate bound-text child element, so
    // retargeting text edits onto that child is what makes labels editable.
    const live = getLiveElements();
    const boundTextByContainer = new Map<string, string>();
    for (const el of live) {
      const c = (el as unknown as { containerId?: string }).containerId;
      if (c) boundTextByContainer.set(c, el.id);
    }

    const expanded: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const missing: string[] = [];

    for (const u of updates) {
      if (!getElementById(u.id)) { missing.push(u.id); continue; }
      const { text, fontSize, ...rest } = u.patch as Record<string, unknown>;

      if (Object.keys(rest).length) expanded.push({ id: u.id, patch: rest });

      if (text != null || fontSize != null) {
        const textTarget = boundTextByContainer.get(u.id) ?? u.id;
        expanded.push({
          id: textTarget,
          patch: {
            ...(text != null ? { text, originalText: text } : {}),
            ...(fontSize != null ? { fontSize } : {}),
          },
        });
      }
    }

    if (!expanded.length) {
      return { ok: false, error: "no_such_elements", hint: `Unknown ids: ${missing.join(", ")}. Call get_scene for current ids.` };
    }

    noteBeforePatch(expanded.map((e) => e.id));
    const res = patchElements(expanded);
    return { ok: true, patched: res.patched, ...(missing.length ? { missing } : {}) };
  },
});

export const deleteElements = defineTool({
  name: "delete_elements",
  description: `Remove elements from the canvas by id. They are soft-deleted, so undo_agent_step can bring them back. Get ids from get_scene, get_selection or find_elements.

Example: {"ids":["abc123","def456"]}`,
  schema: z.object({ ids: z.array(z.string()).min(1) }),
  annotations: { readOnlyHint: false, destructiveHint: true },
  execute: ({ ids }) => {
    const res = softDelete(ids);
    noteRemoved(res.deleted);
    return { ok: true, deleted: res.deleted, ...(res.missing.length ? { missing: res.missing } : {}) };
  },
});

export const restyle = defineTool({
  name: "restyle",
  description: `Change the appearance of several elements at once without touching their position or text. This is the tool for "make these yellow", "make the decision box red", "thicken these lines".

Example: {"ids":["abc","def"],"backgroundColor":"#ffec99","fillStyle":"solid"}`,
  schema: z.object({
    ids: z.array(z.string()).min(1),
    strokeColor: z.string().optional(),
    backgroundColor: z.string().optional(),
    fillStyle: z.enum(["hachure", "cross-hatch", "solid"]).optional(),
    strokeWidth: z.number().optional(),
    roughness: z.number().optional().describe("0 = clean, 1 = hand-drawn, 2 = sketchy."),
    fontSize: z.number().optional(),
    opacity: z.number().min(0).max(100).optional(),
  }),
  annotations: { readOnlyHint: false },
  execute: ({ ids, fontSize, ...style }) => {
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(style)) if (v !== undefined) patch[k] = v;

    const live = getLiveElements();
    const boundTextByContainer = new Map<string, string>();
    for (const el of live) {
      const c = (el as unknown as { containerId?: string }).containerId;
      if (c) boundTextByContainer.set(c, el.id);
    }

    const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const missing: string[] = [];
    for (const id of ids) {
      if (!getElementById(id)) { missing.push(id); continue; }
      if (Object.keys(patch).length) updates.push({ id, patch });
      if (fontSize != null) updates.push({ id: boundTextByContainer.get(id) ?? id, patch: { fontSize } });
    }

    if (!updates.length) {
      return { ok: false, error: "nothing_to_style", hint: missing.length ? `Unknown ids: ${missing.join(", ")}` : "No style properties given." };
    }

    noteBeforePatch(updates.map((u) => u.id));
    const res = patchElements(updates);
    return { ok: true, patched: res.patched, ...(missing.length ? { missing } : {}) };
  },
});

export const focusOn = defineTool({
  name: "focus_on",
  description: `Scroll and zoom the human's view so the given elements fill the screen, and select them. Use this after drawing something off-screen, or to point at what you are talking about.

Example: {"ids":["abc123"]}`,
  schema: z.object({
    ids: z.array(z.string()).min(1),
    select: z.boolean().default(false)
      .describe("Also highlight the elements. Off by default, because selecting opens Excalidraw's style panel over the canvas."),
  }),
  annotations: { readOnlyHint: false },
  execute: ({ ids, select }) => {
    const targets = getLiveElements().filter((el) => ids.includes(el.id));
    if (!targets.length) return { ok: false, error: "no_such_elements", hint: "None of those ids are on the canvas." };

    const api = requireAPI();
    // Selection must be applied BEFORE scrolling: updateScene re-derives scroll
    // state, so doing it afterwards throws away the scrollToContent result.
    if (select) {
      api.updateScene({
        appState: { selectedElementIds: Object.fromEntries(targets.map((el) => [el.id, true])) },
      });
    }
    // fitToViewport centres the content and leaves a margin; fitToContent
    // parked the drawing in the top-left corner instead.
    // animate:false is deliberate — the animated variant was reliably left
    // stranded part-way through, landing on an arbitrary scroll position.
    api.scrollToContent(targets, {
      fitToViewport: true,
      viewportZoomFactor: 0.7,
      animate: false,
      maxZoom: 1.5,
    });
    return { ok: true, focused: targets.map((el) => el.id) };
  },
});

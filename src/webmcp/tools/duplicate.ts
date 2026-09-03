import { defineTool, z } from "../defineTool";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { getLiveElements, appendElements } from "../../excalidraw/sceneOps";
import { newId } from "../../excalidraw/skeleton";
import { resolvePlacement, boundsOf, type Placement } from "../../excalidraw/placement";
import { noteCreated } from "../registry";
import { placementSchema } from "../defineTool";

type Rewritable = Record<string, unknown>;

export const duplicateElements = defineTool({
  name: "duplicate_elements",
  description: `Copy existing elements and place the copies somewhere else. Use this to repeat a shape or a whole diagram instead of rebuilding it call by call — "another one of these", "copy that flowchart and change the labels", "three more of this box".

Arrows between the copied elements are re-bound to the COPIES, so the duplicate is independent: editing or moving it does not disturb the original. Text inside a copied shape comes along automatically.

Returns "idMap" (original id -> new id) so you can immediately restyle or retext the copy.

Example: {"ids":["abc123"],"placement":{"mode":"next_to","refId":"abc123","side":"right"}}`,
  schema: z.object({
    ids: z.array(z.string()).min(1).describe("Elements to copy. Get them from get_selection, get_scene or find_elements."),
    count: z.number().int().min(1).max(10).default(1)
      .describe("How many copies to make. Each is offset further along."),
    placement: placementSchema,
  }),
  annotations: { readOnlyHint: false },
  execute: ({ ids, count, placement }) => {
    const live = getLiveElements();
    const byId = new Map(live.map((el) => [el.id, el]));

    const roots = ids.map((id) => byId.get(id)).filter(Boolean) as ExcalidrawElement[];
    if (!roots.length) {
      return { ok: false, error: "no_such_elements", hint: "None of those ids are on the canvas. Call get_scene for current ids." };
    }

    // Pull in the pieces that belong to the selection even if not named:
    // a shape's bound text, and any arrow whose BOTH ends are inside the set.
    const chosen = new Map<string, ExcalidrawElement>(roots.map((el) => [el.id, el]));

    for (const el of live) {
      const containerId = (el as unknown as { containerId?: string }).containerId;
      if (containerId && chosen.has(containerId)) chosen.set(el.id, el);
    }
    for (const el of live) {
      if (el.type !== "arrow" && el.type !== "line") continue;
      const e = el as unknown as { startBinding?: { elementId: string }; endBinding?: { elementId: string } };
      const a = e.startBinding?.elementId;
      const b = e.endBinding?.elementId;
      if (a && b && chosen.has(a) && chosen.has(b)) chosen.set(el.id, el);
    }

    const source = [...chosen.values()];
    const bounds = boundsOf(source);
    const width = bounds?.width ?? 200;
    const height = bounds?.height ?? 120;

    const created: string[] = [];
    const maps: Array<Record<string, string>> = [];

    for (let copy = 0; copy < count; copy++) {
      // First copy honours `placement`; extras step along beside it.
      const target = resolvePlacement(placement as Placement | undefined, width, height);
      const dx = target.x - (bounds?.x ?? 0) + copy * (width + 60);
      const dy = target.y - (bounds?.y ?? 0);

      const idMap: Record<string, string> = {};
      for (const el of source) idMap[el.id] = newId(el.type.slice(0, 4));

      // A fresh group id keeps the copy draggable as its own unit rather than
      // joining the original's group.
      const groupMap: Record<string, string> = {};
      const remapGroup = (g: string) => (groupMap[g] ??= newId("grp"));
      const remap = (id: unknown) => (typeof id === "string" && idMap[id] ? idMap[id] : undefined);

      const clones = source.map((el) => {
        const e = { ...(el as unknown as Rewritable) };
        e.id = idMap[el.id];
        e.x = (el.x ?? 0) + dx;
        e.y = (el.y ?? 0) + dy;
        e.version = 1;
        e.versionNonce = Math.floor(Math.random() * 2 ** 31);
        e.updated = Date.now();
        e.seed = Math.floor(Math.random() * 2 ** 31);

        if (Array.isArray(e.groupIds)) e.groupIds = (e.groupIds as string[]).map(remapGroup);

        // Bindings that point outside the copied set are dropped rather than
        // left pointing at the original — a copy must not tug the source about.
        for (const key of ["startBinding", "endBinding"]) {
          const b = e[key] as { elementId?: string } | null | undefined;
          if (!b?.elementId) continue;
          const next = remap(b.elementId);
          e[key] = next ? { ...b, elementId: next } : null;
        }
        const containerId = e.containerId as string | undefined;
        if (containerId) e.containerId = remap(containerId) ?? null;
        if (Array.isArray(e.boundElements)) {
          e.boundElements = (e.boundElements as Array<{ id: string; type: string }>)
            .map((b) => { const n = remap(b.id); return n ? { ...b, id: n } : null; })
            .filter(Boolean);
        }
        if (e.frameId) e.frameId = remap(e.frameId) ?? null;

        return e as unknown as ExcalidrawElement;
      });

      appendElements(clones);
      created.push(...clones.map((el) => el.id));
      maps.push(idMap);
    }

    noteCreated(created);

    return {
      ok: true,
      created,
      copies: count,
      idMap: maps[0],
      ...(maps.length > 1 ? { idMaps: maps } : {}),
      includedExtras: source.length - roots.length,
    };
  },
});

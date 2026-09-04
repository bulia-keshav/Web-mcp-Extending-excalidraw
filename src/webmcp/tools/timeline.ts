import { defineTool, z, placementSchema } from "../defineTool";
import { buildFromSkeletons, groupElements, type SkeletonSpec } from "../../excalidraw/skeleton";
import { appendElements } from "../../excalidraw/sceneOps";
import { resolvePlacement, type Placement } from "../../excalidraw/placement";
import { INK, MUTED, colorFor } from "../../excalidraw/palette";
import { noteCreated } from "../registry";
import { NODE_CAP } from "../limits";

const STEP_X = 240;
const STEP_Y = 130;

export const drawTimeline = defineTool({
  name: "draw_timeline",
  description: `Draw an ordered sequence of events along an axis: plot events, experiment stages, project milestones, historical background. Labels alternate above and below the line so they do not collide.

Use this when order matters but there is no branching. If steps branch or loop, use draw_flowchart.

Example: {"title":"Study timeline","events":[{"label":"Recruit","detail":"n=120"},{"label":"Baseline"},{"label":"Follow-up","detail":"12 weeks"}],"orientation":"horizontal"}`,
  schema: z.object({
    title: z.string().optional(),
    events: z.array(z.object({
      label: z.string().describe("Short name for the event."),
      detail: z.string().optional().describe("Secondary line — dates, counts, notes. Put detail HERE, not in the label."),
    })).min(2).max(NODE_CAP),
    orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
    placement: placementSchema,
  }),
  annotations: { readOnlyHint: false },
  execute: ({ title, events, orientation, placement }) => {
    const horizontal = orientation === "horizontal";
    const specs: SkeletonSpec[] = [];

    const axisLen = horizontal ? STEP_X * (events.length - 1) + 120 : STEP_Y * (events.length - 1) + 100;
    const titleH = title ? 44 : 0;
    const axisOffset = horizontal ? titleH + 130 : 0;

    if (title) {
      specs.push({ tempId: "title", type: "text", text: title, x: 0, y: 0, fontSize: 20, strokeColor: INK });
    }

    // The axis
    specs.push({
      tempId: "axis",
      type: "line",
      x: horizontal ? 0 : 120,
      y: horizontal ? axisOffset : titleH,
      width: horizontal ? axisLen : 0,
      height: horizontal ? 0 : axisLen,
      strokeColor: MUTED,
      strokeWidth: 2,
    });

    events.forEach((ev, i) => {
      const above = i % 2 === 0;
      const cx = horizontal ? 60 + STEP_X * i : 120;
      const cy = horizontal ? axisOffset : titleH + 50 + STEP_Y * i;

      // Marker on the axis
      specs.push({
        tempId: `dot_${i}`,
        type: "ellipse",
        x: cx - 9, y: cy - 9, width: 18, height: 18,
        strokeColor: colorFor(i), backgroundColor: colorFor(i), fillStyle: "solid",
      });

      const boxW = 190;
      const boxH = ev.detail ? 68 : 44;
      const bx = horizontal ? cx - boxW / 2 : (above ? cx + 40 : cx + 40);
      const by = horizontal ? (above ? cy - 40 - boxH : cy + 40) : cy - boxH / 2;

      // Detail goes in the bound label as a second line rather than a separate
      // text element: a free text element is positioned independently of the
      // container's centred label and ends up sitting on the border.
      specs.push({
        tempId: `ev_${i}`,
        type: "rectangle",
        label: ev.detail ? `${ev.label}\n${ev.detail}` : ev.label,
        x: bx, y: by, width: boxW, height: boxH,
        strokeColor: colorFor(i),
        backgroundColor: "transparent",
        fontSize: 16,
      });

      // Stem from the axis to the label box
      specs.push({
        tempId: `stem_${i}`,
        type: "line",
        x: horizontal ? cx : cx + 9,
        y: horizontal ? (above ? cy - 40 : cy + 9) : cy,
        width: horizontal ? 0 : 31,
        height: horizontal ? 31 : 0,
        strokeColor: MUTED,
      });
    });

    const width = horizontal ? axisLen : 360;
    // Measured, not guessed: the lowest label box bottoms out at
    // axisOffset + 40 + boxH (max 68), so +125 covers it with a small margin.
    // The old +300 reserved ~200px of phantom height, which draw_board then
    // used as the row height and turned into a huge empty band on the canvas.
    const height = horizontal ? axisOffset + 125 : titleH + axisLen + 80;

    const origin = resolvePlacement(placement as Placement | undefined, width, height);
    const positioned = specs.map((s) => ({ ...s, x: (s.x ?? 0) + origin.x, y: (s.y ?? 0) + origin.y }));

    const built = buildFromSkeletons(positioned);
    const { elements, groupId } = groupElements(built.elements);
    appendElements(elements);
    noteCreated(elements.map((el) => el.id));

    const eventIds: Record<string, string> = {};
    events.forEach((_, i) => {
      if (built.idMap[`ev_${i}`]) eventIds[String(i)] = built.idMap[`ev_${i}`];
    });

    return {
      ok: true,
      created: elements.map((el) => el.id),
      groupId,
      refId: elements[0]?.id,
      eventIds,
      placedAt: origin,
      size: { width, height },
    };
  },
});

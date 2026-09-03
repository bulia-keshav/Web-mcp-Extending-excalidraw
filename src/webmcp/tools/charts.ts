import { defineTool, z, placementSchema } from "../defineTool";
import { buildFromSkeletons, groupElements, type SkeletonSpec } from "../../excalidraw/skeleton";
import { appendElements } from "../../excalidraw/sceneOps";
import { resolvePlacement, type Placement } from "../../excalidraw/placement";
import { colorFor, fillFor, INK, MUTED } from "../../excalidraw/palette";
import { noteCreated } from "../registry";

const PAD = { left: 64, right: 28, top: 56, bottom: 56 };
/** Extra bottom room so a legend cannot sit on top of the x-axis labels. */
const LEGEND_ROOM = 34;

/**
 * Round the axis maximum up to something a human would choose.
 *
 * The ladder is deliberately fine-grained: a coarse 1/2/5 ladder sends a max
 * of 2.4M all the way up to 5M, so the tallest bar only reaches half the plot
 * and the chart reads as mostly empty.
 */
const NICE_STEPS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const n = value / base;
  const step = NICE_STEPS.find((s) => n <= s) ?? 10;
  return step * base;
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export const drawChart = defineTool({
  name: "draw_chart",
  description: `Draw a bar or line chart from data. Use this whenever the user gives you numbers — a CSV, a table, a list of figures — and wants them visualised. Axes, ticks, labels and a legend are computed for you; you only supply the data.

Returns an id for every bar or point, keyed as "<seriesIndex>:<labelIndex>", so you can follow up with annotate to call out a specific one (e.g. the tallest bar).

Example: {"kind":"bar","title":"Revenue by quarter","labels":["Q1","Q2","Q3","Q4"],"series":[{"name":"2025","values":[12,19,3,17]}]}`,
  schema: z.object({
    kind: z.enum(["bar", "line"]).default("bar"),
    title: z.string().optional(),
    labels: z.array(z.string()).min(1).max(30).describe("Category labels along the x axis."),
    series: z.array(
      z.object({
        name: z.string().optional().describe("Series name, shown in the legend when there is more than one."),
        values: z.array(z.number()).min(1),
      }),
    ).min(1).max(6),
    width: z.number().min(200).max(2000).default(620),
    height: z.number().min(150).max(1400).default(400),
    placement: placementSchema,
  }),
  annotations: { readOnlyHint: false },
  execute: ({ kind, title, labels, series, width, height, placement }) => {
    for (const s of series) {
      if (s.values.length !== labels.length) {
        return {
          ok: false,
          error: "length_mismatch",
          hint: `Series "${s.name ?? "unnamed"}" has ${s.values.length} values but there are ${labels.length} labels. They must match.`,
        };
      }
    }

    const bottomPad = PAD.bottom + (series.length > 1 ? LEGEND_ROOM : 0);
    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - bottomPad;
    const originX = PAD.left;
    const originY = PAD.top + plotH; // baseline (y grows downward)

    const allValues = series.flatMap((s) => s.values);
    const rawMax = Math.max(...allValues, 0);
    const rawMin = Math.min(...allValues, 0);
    const max = niceMax(rawMax);
    const min = rawMin < 0 ? -niceMax(-rawMin) : 0;
    const span = max - min || 1;
    const yOf = (v: number) => originY - ((v - min) / span) * plotH;

    const specs: SkeletonSpec[] = [];
    const dataIds: Record<string, string> = {};

    if (title) {
      specs.push({ tempId: "title", type: "text", text: title, x: originX, y: 12, fontSize: 20, strokeColor: INK });
    }

    // Axes
    specs.push({ tempId: "axis_y", type: "line", x: originX, y: PAD.top, width: 0, height: plotH, strokeColor: MUTED });
    specs.push({ tempId: "axis_x", type: "line", x: originX, y: yOf(Math.max(min, 0)), width: plotW, height: 0, strokeColor: MUTED });

    // Y ticks
    // 5 gridlines divide 1.25/2.5/7.5-style maxima without ugly remainders.
    const TICKS = 5;
    for (let t = 0; t <= TICKS; t++) {
      const v = min + (span * t) / TICKS;
      specs.push({
        tempId: `ytick_${t}`,
        type: "text",
        text: formatTick(v),
        x: originX - 52,
        y: yOf(v) - 9,
        fontSize: 12,
        strokeColor: MUTED,
      });
    }

    const slot = plotW / labels.length;

    // X labels
    labels.forEach((label, i) => {
      specs.push({
        tempId: `xlab_${i}`,
        type: "text",
        text: label.length > 12 ? `${label.slice(0, 11)}…` : label,
        x: originX + slot * i + 6,
        y: originY + 12,
        fontSize: 12,
        strokeColor: MUTED,
      });
    });

    if (kind === "bar") {
      const groupPad = slot * 0.18;
      const barW = Math.max(6, (slot - groupPad * 2) / series.length);
      series.forEach((s, si) => {
        s.values.forEach((v, i) => {
          const x = originX + slot * i + groupPad + barW * si;
          const top = yOf(Math.max(v, 0));
          const bottom = yOf(Math.min(v, 0));
          const tempId = `bar_${si}_${i}`;
          specs.push({
            tempId,
            type: "rectangle",
            x,
            y: top,
            width: barW * 0.88,
            height: Math.max(1, bottom - top),
            strokeColor: colorFor(si),
            backgroundColor: fillFor(si),
            fillStyle: "solid",
          });
          dataIds[`${si}:${i}`] = tempId;
        });
      });
    } else {
      // Line: a segment between consecutive points, plus a dot at each point.
      series.forEach((s, si) => {
        for (let i = 0; i < s.values.length - 1; i++) {
          const x1 = originX + slot * i + slot / 2;
          const y1 = yOf(s.values[i]);
          const x2 = originX + slot * (i + 1) + slot / 2;
          const y2 = yOf(s.values[i + 1]);
          specs.push({
            tempId: `seg_${si}_${i}`,
            type: "line",
            x: x1, y: y1, width: x2 - x1, height: y2 - y1,
            strokeColor: colorFor(si), strokeWidth: 2,
          });
        }
        s.values.forEach((v, i) => {
          const tempId = `pt_${si}_${i}`;
          specs.push({
            tempId,
            type: "ellipse",
            x: originX + slot * i + slot / 2 - 5,
            y: yOf(v) - 5,
            width: 10, height: 10,
            strokeColor: colorFor(si),
            backgroundColor: colorFor(si),
            fillStyle: "solid",
          });
          dataIds[`${si}:${i}`] = tempId;
        });
      });
    }

    // Legend, only when it earns its place
    if (series.length > 1) {
      series.forEach((s, si) => {
        const lx = originX + si * 130;
        const ly = height - 26;
        specs.push({
          tempId: `key_${si}`, type: "rectangle", x: lx, y: ly, width: 14, height: 14,
          strokeColor: colorFor(si), backgroundColor: fillFor(si), fillStyle: "solid",
        });
        specs.push({
          tempId: `keytxt_${si}`, type: "text", text: s.name ?? `Series ${si + 1}`,
          x: lx + 20, y: ly - 2, fontSize: 12, strokeColor: INK,
        });
      });
    }

    const origin = resolvePlacement(placement as Placement | undefined, width, height);
    const positioned = specs.map((s) => ({ ...s, x: (s.x ?? 0) + origin.x, y: (s.y ?? 0) + origin.y }));

    const built = buildFromSkeletons(positioned);
    const { elements, groupId } = groupElements(built.elements);
    const idMap = built.idMap;
    appendElements(elements);
    noteCreated(elements.map((el) => el.id));

    const points: Record<string, string> = {};
    for (const [key, tempId] of Object.entries(dataIds)) {
      if (idMap[tempId]) points[key] = idMap[tempId];
    }

    return {
      ok: true,
      kind,
      created: elements.map((el) => el.id),
      groupId,
      refId: elements[0]?.id,
      points,
      axisMax: max,
      placedAt: origin,
      size: { width, height },
    };
  },
});

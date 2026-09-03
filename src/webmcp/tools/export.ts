import { defineTool, z } from "../defineTool";
import { exportToBlob } from "@excalidraw/excalidraw";
import { requireAPI } from "../../excalidraw/apiRef";
import { getLiveElements } from "../../excalidraw/sceneOps";

export const exportPng = defineTool({
  name: "export_png",
  description: `Export the canvas as a PNG and hand it to the human as a download. Use it when the user asks to save, export, or download what has been drawn.

Pass "ids" to export just part of the canvas, or omit it for everything.

Example: {}`,
  schema: z.object({
    ids: z.array(z.string()).optional().describe("Export only these elements. Omit for the whole canvas."),
    scale: z.number().min(1).max(3).default(2).describe("2 gives a crisp image on high-DPI screens."),
    background: z.boolean().default(true).describe("Include the canvas background colour."),
  }),
  annotations: { readOnlyHint: false },
  execute: async ({ ids, scale, background }) => {
    const api = requireAPI();
    const all = getLiveElements();
    const elements = ids?.length ? all.filter((el) => ids.includes(el.id)) : all;

    if (!elements.length) {
      return { ok: false, error: "nothing_to_export", hint: "The canvas is empty." };
    }

    try {
      const blob = await exportToBlob({
        elements,
        appState: { ...api.getAppState(), exportBackground: background, exportWithDarkMode: false },
        files: api.getFiles(),
        mimeType: "image/png",
        exportPadding: 24,
        getDimensions: (w: number, h: number) => ({ width: w * scale, height: h * scale, scale }),
      });

      // Hand the file to the human via a click-free object URL download.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sketchpad-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);

      return {
        ok: true,
        exported: elements.length,
        bytes: blob.size,
        filename: a.download,
        note: "The download was offered to the human in their browser. Some embedded browsers block downloads; if nothing appeared, they can use the app menu to export instead.",
      };
    } catch (err) {
      return { ok: false, error: "export_failed", hint: err instanceof Error ? err.message : String(err) };
    }
  },
});

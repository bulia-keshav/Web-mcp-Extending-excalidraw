import { defineTool, z, placementSchema } from "../defineTool";
import { addImage } from "../../excalidraw/files";
import { requestPicker } from "../../ui/pickerBridge";
import { buildFromSkeletons } from "../../excalidraw/skeleton";
import { appendElements } from "../../excalidraw/sceneOps";
import { resolvePlacement, type Placement } from "../../excalidraw/placement";
import { noteCreated } from "../registry";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { newId } from "../../excalidraw/skeleton";

async function placeDataURL(
  dataURL: string,
  placement: Placement | undefined,
  opacity: number,
  maxWidth: number,
) {
  const img = await addImage(dataURL, maxWidth);
  const origin = resolvePlacement(placement, img.width, img.height);

  const [element] = convertToExcalidrawElements(
    [{
      type: "image",
      id: newId("img"),
      x: origin.x,
      y: origin.y,
      width: img.width,
      height: img.height,
      fileId: img.fileId,
      status: "saved",
      opacity,
    } as never],
    { regenerateIds: false },
  ) as unknown as ExcalidrawElement[];

  appendElements([element]);
  noteCreated([element.id]);

  return {
    ok: true as const,
    elementId: element.id,
    fileId: img.fileId,
    size: { width: img.width, height: img.height },
    natural: { width: img.naturalWidth, height: img.naturalHeight },
    placedAt: origin,
  };
}

export const placeImage = defineTool({
  name: "place_image",
  description: `Put an image on the canvas. Use "upload" to ask the human to pick a file, or "dataURL" if you already have the image bytes.

The common use is tracing: place a photo of a hand-drawn sketch faded in the background, then redraw it cleanly beside it with draw_flowchart or add_elements. Default opacity is 40 for exactly that.

Note: you cannot see the image this returns. Read the picture from the user's chat attachment and use this tool only to put a reference copy on the canvas.

Example: {"source":"upload","opacity":40}`,
  schema: z.object({
    source: z.enum(["upload", "camera", "dataURL"]).default("upload")
      .describe('"upload" opens a file chooser, "camera" opens the webcam, "dataURL" uses the string you pass.'),
    dataURL: z.string().optional().describe('Required when source is "dataURL". Must start with "data:image/".'),
    opacity: z.number().min(0).max(100).default(40)
      .describe("40 makes it a faint tracing reference. Use 100 for a normal image."),
    maxWidth: z.number().min(50).max(2000).default(600)
      .describe("Longest edge in canvas units; aspect ratio is preserved."),
    placement: placementSchema,
  }),
  annotations: { readOnlyHint: false },
  execute: async ({ source, dataURL, opacity, maxWidth, placement }) => {
    try {
      let data = dataURL;

      if (source === "dataURL") {
        if (!data) return { ok: false, error: "missing_dataURL", hint: 'source "dataURL" requires a dataURL string.' };
      } else {
        data = await requestPicker(source === "camera" ? "camera" : "file");
      }

      return await placeDataURL(data!, placement as Placement | undefined, opacity, maxWidth);
    } catch (err) {
      return {
        ok: false,
        error: "image_failed",
        hint: err instanceof Error ? err.message : String(err),
      };
    }
  },
});

export const capturePhoto = defineTool({
  name: "capture_photo",
  description: `Open the camera so the human can photograph something — typically a sketch on paper — and place the photo on the canvas as a faded reference.

You cannot see the resulting photo. To redraw a paper sketch, ask the user to attach it in the chat where you can actually look at it; use this tool only to get a reference copy onto the canvas beside your clean version.

Example: {}`,
  schema: z.object({
    opacity: z.number().min(0).max(100).default(40),
    maxWidth: z.number().min(50).max(2000).default(600),
    placement: placementSchema,
  }),
  annotations: { readOnlyHint: false },
  execute: async ({ opacity, maxWidth, placement }) => {
    try {
      const data = await requestPicker("camera");
      return await placeDataURL(data, placement as Placement | undefined, opacity, maxWidth);
    } catch (err) {
      return { ok: false, error: "capture_failed", hint: err instanceof Error ? err.message : String(err) };
    }
  },
});

export { buildFromSkeletons };

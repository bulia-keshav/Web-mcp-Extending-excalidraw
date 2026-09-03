import type { BinaryFileData, DataURL } from "@excalidraw/excalidraw/types";
import type { FileId } from "@excalidraw/excalidraw/element/types";
import { requireAPI } from "./apiRef";
import { newId } from "./skeleton";

export type PlacedImage = {
  fileId: string;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  mimeType: string;
};

/** Read the intrinsic size of a data URL so we can preserve aspect ratio. */
export function measureDataURL(dataURL: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not decode that image data."));
    img.src = dataURL;
  });
}

function mimeFromDataURL(dataURL: string): string {
  const m = /^data:([^;,]+)[;,]/.exec(dataURL);
  return m?.[1] ?? "image/png";
}

/**
 * Register an image with Excalidraw's file store. This MUST happen before the
 * image element referencing the fileId is added to the scene, or the element
 * renders as a broken placeholder.
 */
export async function addImage(dataURL: string, maxWidth = 600): Promise<PlacedImage> {
  if (!/^data:image\//.test(dataURL)) {
    throw new Error('Expected a data URL beginning with "data:image/".');
  }

  const mimeType = mimeFromDataURL(dataURL);
  const natural = await measureDataURL(dataURL);
  const fileId = newId("file") as FileId;

  const file: BinaryFileData = {
    id: fileId,
    dataURL: dataURL as DataURL,
    mimeType: mimeType as BinaryFileData["mimeType"],
    created: Date.now(),
  };

  requireAPI().addFiles([file]);

  const scale = natural.width > maxWidth ? maxWidth / natural.width : 1;

  return {
    fileId,
    width: Math.round(natural.width * scale),
    height: Math.round(natural.height * scale),
    naturalWidth: natural.width,
    naturalHeight: natural.height,
    mimeType,
  };
}

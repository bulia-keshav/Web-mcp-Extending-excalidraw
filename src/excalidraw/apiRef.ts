import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

let api: ExcalidrawImperativeAPI | null = null;
const waiters: Array<(api: ExcalidrawImperativeAPI) => void> = [];

export function setExcalidrawAPI(next: ExcalidrawImperativeAPI) {
  api = next;
  while (waiters.length) waiters.shift()!(next);
}

/** Throws if called before mount. Tools should prefer `requireAPI()`. */
export function getAPI(): ExcalidrawImperativeAPI | null {
  return api;
}

export function requireAPI(): ExcalidrawImperativeAPI {
  if (!api) throw new Error("Excalidraw API not ready yet");
  return api;
}

export function isReady() {
  return api !== null;
}

/** Resolves once Excalidraw has mounted. Used by the registration lifecycle. */
export function whenReady(): Promise<ExcalidrawImperativeAPI> {
  if (api) return Promise.resolve(api);
  return new Promise((resolve) => waiters.push(resolve));
}

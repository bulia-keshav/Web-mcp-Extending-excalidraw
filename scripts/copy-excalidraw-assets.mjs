/**
 * Excalidraw loads its fonts at runtime from `window.EXCALIDRAW_ASSET_PATH`,
 * which defaults to a CDN. On a static host that is the single most common
 * cause of "worked locally, broken in production". We vendor the fonts into
 * public/ so the deployed build is fully self-contained and offline-capable.
 *
 * Runs on postinstall AND is safe to re-run (idempotent).
 */
import { cp, mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const from = resolve(root, "node_modules/@excalidraw/excalidraw/dist/prod/fonts");
const to = resolve(root, "public/fonts");

try {
  await access(from, constants.R_OK);
} catch {
  console.warn("[assets] Excalidraw fonts not found at", from, "- skipping.");
  process.exit(0);
}

await mkdir(dirname(to), { recursive: true });
await cp(from, to, { recursive: true });
console.log("[assets] Copied Excalidraw fonts -> public/fonts");

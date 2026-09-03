import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { requireAPI } from "./apiRef";

/**
 * Append-only scene model.
 *
 * Every mutation reads the CURRENT scene at execution time, never a cached
 * array. This keeps the race window against a human editing the canvas down
 * to milliseconds (risk R4 in the plan).
 */

/** Live = not soft-deleted. This is what the agent is allowed to see. */
export function getLiveElements(): readonly ExcalidrawElement[] {
  return requireAPI().getSceneElements();
}

/** Includes tombstones — needed for undo, never exposed to the agent. */
export function getAllElements(): readonly ExcalidrawElement[] {
  return requireAPI().getSceneElementsIncludingDeleted();
}

export function getElementById(id: string): ExcalidrawElement | undefined {
  return getAllElements().find((el) => el.id === id);
}

/**
 * Push a full element array. Excalidraw requires bound elements to be present
 * in the same payload, so callers must always pass the complete scene.
 */
export function commit(elements: readonly ExcalidrawElement[]) {
  requireAPI().updateScene({
    elements: elements as ExcalidrawElement[],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
}

/** Non-destructive: existing elements are preserved, new ones appended. */
export function appendElements(newElements: readonly ExcalidrawElement[]) {
  commit([...getAllElements(), ...newElements]);
}

/** Patch by id. Unknown ids are reported back rather than silently ignored. */
export function patchElements(
  updates: Array<{ id: string; patch: Record<string, unknown> }>,
): { patched: string[]; missing: string[] } {
  const byId = new Map(updates.map((u) => [u.id, u.patch]));
  const patched: string[] = [];

  const next = getAllElements().map((el) => {
    const patch = byId.get(el.id);
    if (!patch) return el;
    patched.push(el.id);
    // version/versionNonce bumps tell Excalidraw the element actually changed.
    return {
      ...el,
      ...patch,
      version: el.version + 1,
      versionNonce: Math.floor(Math.random() * 2 ** 31),
      updated: Date.now(),
    } as ExcalidrawElement;
  });

  commit(next);
  const missing = updates.map((u) => u.id).filter((id) => !patched.includes(id));
  return { patched, missing };
}

/** Soft delete — keeps Excalidraw's own history coherent and undo cheap. */
export function softDelete(ids: string[]): { deleted: string[]; missing: string[] } {
  const set = new Set(ids);
  const deleted: string[] = [];

  const next = getAllElements().map((el) => {
    if (!set.has(el.id) || el.isDeleted) return el;
    deleted.push(el.id);
    return {
      ...el,
      isDeleted: true,
      version: el.version + 1,
      versionNonce: Math.floor(Math.random() * 2 ** 31),
      updated: Date.now(),
    } as ExcalidrawElement;
  });

  commit(next);
  return { deleted, missing: ids.filter((id) => !deleted.includes(id)) };
}

/** Restore soft-deleted elements. Backs `undo_agent_step`. */
export function undelete(ids: string[]) {
  const set = new Set(ids);
  commit(
    getAllElements().map((el) =>
      set.has(el.id)
        ? ({ ...el, isDeleted: false, version: el.version + 1, updated: Date.now() } as ExcalidrawElement)
        : el,
    ),
  );
}

export function getSelectedElements(): ExcalidrawElement[] {
  const selected = requireAPI().getAppState().selectedElementIds;
  return getLiveElements().filter((el) => selected[el.id]);
}

import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { softDelete, undelete, patchElements, getElementById } from "../excalidraw/sceneOps";

export type AgentAction = {
  id: string;
  tool: string;
  at: number;
  summary: string;
  ok: boolean;
  /** ids this call brought into existence — undo soft-deletes them */
  created: string[];
  /** prior state of anything this call modified — undo restores it */
  patched: Array<{ id: string; before: Record<string, unknown> }>;
  /** ids this call soft-deleted — undo restores them */
  removed: string[];
  undone?: boolean;
};

const stack: AgentAction[] = [];
const listeners = new Set<(actions: AgentAction[]) => void>();
const MAX = 100;

export function snapshotFor(ids: string[]): Array<{ id: string; before: Record<string, unknown> }> {
  const out: Array<{ id: string; before: Record<string, unknown> }> = [];
  for (const id of ids) {
    const el = getElementById(id);
    if (el) out.push({ id, before: { ...(el as unknown as Record<string, unknown>) } });
  }
  return out;
}

export function push(action: Omit<AgentAction, "id" | "at">) {
  stack.push({ ...action, id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, at: Date.now() });
  while (stack.length > MAX) stack.shift();
  emit();
}

export function list(): AgentAction[] {
  return [...stack];
}

export function subscribe(fn: (actions: AgentAction[]) => void) {
  listeners.add(fn);
  fn(list());
  return () => {
    listeners.delete(fn);
  };
}

function emit() {
  const snap = list();
  listeners.forEach((fn) => fn(snap));
}

function revert(action: AgentAction) {
  if (action.created.length) softDelete(action.created);
  if (action.removed.length) undelete(action.removed);
  if (action.patched.length) {
    patchElements(
      action.patched.map(({ id, before }) => ({
        id,
        patch: {
          x: before.x, y: before.y,
          width: before.width, height: before.height,
          strokeColor: before.strokeColor,
          backgroundColor: before.backgroundColor,
          opacity: before.opacity,
          angle: before.angle,
          fillStyle: before.fillStyle,
          strokeWidth: before.strokeWidth,
          roughness: before.roughness,
          fontSize: (before as { fontSize?: number }).fontSize,
          text: (before as { text?: string }).text,
        },
      })),
    );
  }
  action.undone = true;
}

/** Undo the most recent N agent actions that have not already been undone. */
export function undo(steps = 1): { undone: string[] } {
  const undone: string[] = [];
  for (let i = stack.length - 1; i >= 0 && undone.length < steps; i--) {
    const a = stack[i];
    if (a.undone || !a.ok) continue;
    revert(a);
    undone.push(a.tool);
  }
  emit();
  return { undone };
}

/** Undo one specific action by id — powers the per-call button in the panel. */
export function undoById(id: string): boolean {
  const a = stack.find((x) => x.id === id);
  if (!a || a.undone || !a.ok) return false;
  revert(a);
  emit();
  return true;
}

export function clear() {
  stack.length = 0;
  emit();
}

export type { ExcalidrawElement };

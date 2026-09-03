import type { ToolDef, ToolResult } from "./types";
import { resolveHosts, currentMode, hostLabels } from "./detect";
import { whenReady, isReady } from "../excalidraw/apiRef";
import * as actionStack from "./actionStack";

const registered = new Map<string, ToolDef>();

/**
 * Excalidraw measures text with whatever font is available at the moment the
 * element is created. On a cold visit its hand-drawn fonts are still loading,
 * so labels get measured against a fallback, come out too narrow, and render
 * visibly clipped ("Quarterly revenue" -> "Quarterly reven").
 *
 * Gate writes on the fonts actually being ready. Resolved once, then cached.
 */
let fontsReady: Promise<void> | null = null;

function ensureFontsReady(): Promise<void> {
  if (fontsReady) return fontsReady;
  fontsReady = (async () => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts) return;
    try {
      // Ask for the faces Excalidraw actually draws with, then wait for the
      // whole set — `ready` alone resolves early if nothing is pending yet.
      await Promise.all([
        fonts.load('20px Excalifont').catch(() => undefined),
        fonts.load('20px Assistant').catch(() => undefined),
      ]);
      await fonts.ready;
    } catch {
      // Never block drawing because font loading misbehaved.
    }
  })();
  return fontsReady;
}

type Capture = {
  created: string[];
  patched: Array<{ id: string; before: Record<string, unknown> }>;
  removed: string[];
};

/**
 * Undo capture is a STACK, not a single slot: draw_board executes other tools
 * through invoke(), so captures nest. With one shared slot the inner call
 * cleared it and the outer call crashed reading its own results.
 *
 * Popping merges a child's changes into its parent, so undoing a board undoes
 * every panel it drew, while each panel also remains individually undoable.
 */
const captureStack: Capture[] = [];

const top = () => captureStack[captureStack.length - 1];

function beginCapture() {
  captureStack.push({ created: [], patched: [], removed: [] });
}

function endCapture(): Capture {
  const frame = captureStack.pop() ?? { created: [], patched: [], removed: [] };
  const parent = top();
  if (parent) {
    parent.created.push(...frame.created);
    parent.patched.push(...frame.patched);
    parent.removed.push(...frame.removed);
  }
  return frame;
}

export function noteCreated(ids: string[]) { top()?.created.push(...ids); }
export function noteRemoved(ids: string[]) { top()?.removed.push(...ids); }
export function noteBeforePatch(ids: string[]) {
  const frame = top();
  if (frame) frame.patched.push(...actionStack.snapshotFor(ids));
}

function summarize(result: ToolResult): string {
  if (!result.ok) return `error: ${result.error}`;
  const r = result as Record<string, unknown>;
  const bits: string[] = [];
  for (const key of ["created", "ids", "patched", "deleted", "undone", "nodeIds", "count"]) {
    const v = r[key];
    if (Array.isArray(v)) bits.push(`${key}: ${v.length}`);
    else if (v && typeof v === "object") bits.push(`${key}: ${Object.keys(v).length}`);
    else if (typeof v === "number") bits.push(`${key}: ${v}`);
  }
  return bits.join(", ") || "ok";
}

/**
 * Wraps every tool with: zod validation -> undo snapshot -> try/catch ->
 * action stack + activity panel. A tool body never has to think about any
 * of this, and a malformed agent call can never crash the page.
 */
function wrap(tool: ToolDef) {
  return async (rawArgs: unknown): Promise<ToolResult> => {
    const parsed = tool.schema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      const hint = parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      const result: ToolResult = { ok: false, error: "invalid_input", hint };
      actionStack.push({ tool: tool.name, summary: hint, ok: false, created: [], patched: [], removed: [] });
      return result;
    }

    // Registration happens at page load so a host that enumerates tools early
    // still sees them; the canvas may not exist yet when a call arrives.
    if (!isReady()) {
      const ready = await Promise.race([
        whenReady().then(() => true),
        new Promise<false>((r) => setTimeout(() => r(false), 15_000)),
      ]);
      if (!ready) {
        return { ok: false, error: "canvas_not_ready", hint: "The whiteboard is still loading. Try again in a moment." };
      }
    }

    // Reads do not create text, so they never need to wait.
    if (tool.annotations?.readOnlyHint !== true) await ensureFontsReady();

    beginCapture();
    let result: ToolResult;
    try {
      result = await tool.execute(parsed.data);
    } catch (err) {
      result = {
        ok: false,
        error: "execution_failed",
        hint: err instanceof Error ? err.message : String(err),
      };
    }

    const taken = endCapture();

    actionStack.push({
      tool: tool.name,
      summary: summarize(result),
      ok: result.ok,
      created: taken.created,
      patched: taken.patched,
      removed: taken.removed,
    });

    return result;
  };
}

export function getTool(name: string) {
  return registered.get(name);
}

export function toolNames() {
  return [...registered.keys()];
}

/** Direct invocation path shared by the WebMCP host and the dev harness. */
export async function invoke(name: string, args: unknown): Promise<ToolResult> {
  const tool = registered.get(name);
  if (!tool) return { ok: false, error: "unknown_tool", hint: `Known tools: ${toolNames().join(", ")}` };
  return wrap(tool)(args);
}

export function registerAll(tools: ToolDef[], signal?: AbortSignal) {
  const hosts = resolveHosts();
  const disposers: Array<() => void> = [];

  for (const tool of tools) {
    registered.set(tool.name, tool);
    const handler = wrap(tool);
    for (const host of hosts) {
      try {
        const dispose = host.registerTool({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
          execute: (args: unknown) => handler(args),
        });
        if (typeof dispose === "function") disposers.push(dispose);
      } catch (err) {
        console.error(`[webmcp] Failed to register "${tool.name}":`, err);
      }
    }
  }

  console.info(
    `[webmcp] Registered ${tools.length} tools on [${hostLabels().join(", ")}] (mode: ${currentMode()})`,
  );

  signal?.addEventListener("abort", () => {
    disposers.forEach((d) => { try { d(); } catch { /* ignore */ } });
    registered.clear();
  });

  return () => disposers.forEach((d) => { try { d(); } catch { /* ignore */ } });
}

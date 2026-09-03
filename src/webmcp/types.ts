import type { z } from "zod";

export type ToolResult =
  | ({ ok: true } & Record<string, unknown>)
  | { ok: false; error: string; hint?: string };

export type ToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
  destructiveHint?: boolean;
};

export type ToolDef<S extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  /** Written for the LLM: what it's for, when to prefer it, one tiny example. */
  description: string;
  schema: S;
  /** JSON Schema mirrored from `schema`, handed to the WebMCP host. */
  inputSchema: Record<string, unknown>;
  annotations?: ToolAnnotations;
  execute: (args: z.infer<S>) => Promise<ToolResult> | ToolResult;
};

/** Minimal shape of the WebMCP host we rely on. */
export type ModelContextLike = {
  registerTool: (tool: {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    annotations?: ToolAnnotations;
    execute: (args: unknown) => Promise<unknown>;
  }) => void | (() => void);
  __isShim?: boolean;
};

declare global {
  interface Document {
    modelContext?: ModelContextLike;
  }
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[];
    __agent?: {
      list: () => string[];
      describe: (name?: string) => unknown;
      call: (name: string, args?: unknown) => Promise<ToolResult>;
      mode: () => "native" | "shim" | "none";
    };
  }
}

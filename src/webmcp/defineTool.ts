import { z, toJSONSchema } from "zod/v4";
import type { ToolDef, ToolAnnotations, ToolResult } from "./types";

/**
 * One source of truth per tool: the zod schema both validates the agent's
 * input at runtime AND generates the JSON Schema handed to the WebMCP host,
 * so the two can never drift apart.
 */
export function defineTool<S extends z.ZodType>(spec: {
  name: string;
  description: string;
  schema: S;
  annotations?: ToolAnnotations;
  execute: (args: z.infer<S>) => Promise<ToolResult> | ToolResult;
}): ToolDef {
  let inputSchema: Record<string, unknown>;
  try {
    inputSchema = toJSONSchema(spec.schema, { io: "input" }) as Record<string, unknown>;
  } catch {
    // A schema JSON Schema can't express should not take down registration.
    inputSchema = { type: "object", additionalProperties: true };
  }

  return {
    name: spec.name,
    description: spec.description,
    schema: spec.schema as unknown as ToolDef["schema"],
    inputSchema,
    annotations: spec.annotations,
    execute: spec.execute as ToolDef["execute"],
  };
}

export { z };

/** Shared placement schema — every drawing tool accepts the same shape. */
export const placementSchema = z
  .union([
    z.object({ mode: z.literal("viewport") }),
    z.object({
      mode: z.literal("next_to"),
      refId: z.string(),
      side: z.enum(["right", "below", "left", "above"]).optional(),
      gap: z.number().optional(),
    }),
    z.object({ mode: z.literal("free_space") }),
    z.object({ mode: z.literal("absolute"), x: z.number(), y: z.number() }),
  ])
  .optional()
  .describe(
    'Where to put it. Omit for the centre of the human\'s current view. ' +
      '{"mode":"next_to","refId":"<id>","side":"right"} places it beside an existing element; ' +
      '{"mode":"free_space"} puts it clear of everything already drawn.',
  );

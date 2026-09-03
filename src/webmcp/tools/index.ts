import type { ToolDef } from "../types";

/**
 * Phase 1 registers no tools. The registration path, validation wrapper,
 * action stack and harness are all live and exercised — adding a tool is
 * appending to this array.
 */
export const allTools: ToolDef[] = [];

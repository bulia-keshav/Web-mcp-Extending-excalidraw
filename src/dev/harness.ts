import { invoke, toolNames, getTool } from "../webmcp/registry";
import { currentMode } from "../webmcp/detect";
import { getAPI } from "../excalidraw/apiRef";

/**
 * Ships in production ON PURPOSE.
 *
 * The point of this project is that the DEPLOYED build is the one that works.
 * If the harness were dev-only, the artifact we test would not be the artifact
 * we ship. `window.__agent` lets the deployed URL be exercised end-to-end
 * without ChatGPT in the loop.
 */
export function installHarness() {
  window.__agent = {
    mode: () => currentMode(),
    list: () => toolNames(),
    describe: (name?: string) => {
      if (!name) {
        return toolNames().map((n) => {
          const t = getTool(n)!;
          return { name: n, description: t.description.split("\n")[0], annotations: t.annotations };
        });
      }
      const t = getTool(name);
      if (!t) return { error: "unknown_tool", known: toolNames() };
      return { name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations };
    },
    call: (name: string, args?: unknown) => invoke(name, args ?? {}),
    // Escape hatch for debugging against the real canvas.
    raw: () => getAPI(),
  };

  console.info(
    `%c[sketchpad] window.__agent ready — mode: ${currentMode()}. Try __agent.list()`,
    "color:#6965db;font-weight:bold",
  );
}

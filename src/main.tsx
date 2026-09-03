import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { registerAll } from "./webmcp/registry";
import { allTools } from "./webmcp/tools";
import { installHarness } from "./dev/harness";
import "@excalidraw/excalidraw/index.css";
import "./index.css";

// NOTE: window.EXCALIDRAW_ASSET_PATH is set by an inline script in index.html.
// It cannot be set here — ES imports are hoisted above module body statements,
// so Excalidraw would already have resolved its font base URL.

// Register BEFORE React mounts. Excalidraw mounts asynchronously, and a host
// that enumerates tools at page load would otherwise find none — the tools
// themselves wait for the canvas when a call actually arrives.
registerAll(allTools);
installHarness();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

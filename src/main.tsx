import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@excalidraw/excalidraw/index.css";
import "./index.css";

// NOTE: window.EXCALIDRAW_ASSET_PATH is set by an inline script in index.html.
// It cannot be set here — ES imports are hoisted above module body statements,
// so Excalidraw would already have resolved its font base URL.

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

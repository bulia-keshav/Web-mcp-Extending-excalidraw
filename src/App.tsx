import { useCallback, useEffect, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

import { setExcalidrawAPI } from "./excalidraw/apiRef";
import { loadScene, scheduleSave } from "./excalidraw/persistence";
import { registerAll } from "./webmcp/registry";
import { currentMode } from "./webmcp/detect";
import { installHarness } from "./dev/harness";
import { allTools } from "./webmcp/tools";
import AgentActivityPanel from "./ui/AgentActivityPanel";

const initialData = loadScene();

export default function App() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [mode, setMode] = useState(currentMode());
  const [panelOpen, setPanelOpen] = useState(false);
  const registered = useRef(false);

  const onApi = useCallback((next: ExcalidrawImperativeAPI) => {
    setExcalidrawAPI(next);
    setApi(next);
  }, []);

  useEffect(() => {
    if (!api || registered.current) return;
    registered.current = true;

    const controller = new AbortController();
    registerAll(allTools, controller.signal);
    installHarness();
    setMode(currentMode());

    return () => controller.abort();
  }, [api]);

  const onChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      scheduleSave(elements, appState, files);
    },
    [],
  );

  return (
    <div className="excalidraw-host">
      <Excalidraw
        excalidrawAPI={onApi}
        initialData={initialData}
        onChange={onChange}
        renderTopRightUI={() => (
          <button
            className="agent-panel-toggle"
            onClick={() => setPanelOpen((v) => !v)}
            title="Show what the agent has done"
          >
            <span className={`agent-dot agent-dot--${mode}`} />
            Agent
          </button>
        )}
      />
      <AgentActivityPanel open={panelOpen} onClose={() => setPanelOpen(false)} mode={mode} />
    </div>
  );
}

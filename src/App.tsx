import { useCallback, useEffect, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

import { setExcalidrawAPI } from "./excalidraw/apiRef";
import { loadScene, scheduleSave } from "./excalidraw/persistence";
import { currentMode } from "./webmcp/detect";
import AgentActivityPanel from "./ui/AgentActivityPanel";
import PickerHost from "./ui/PickerHost";

const initialData = loadScene();

export default function App() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [mode, setMode] = useState(currentMode());
  const [panelOpen, setPanelOpen] = useState(false);

  const onApi = useCallback((next: ExcalidrawImperativeAPI) => {
    setExcalidrawAPI(next);
    setApi(next);
  }, []);

  // Tools are registered in main.tsx before React mounts, so a host that
  // enumerates at page load sees all of them. Here we only reflect the host
  // status once the canvas is up.
  useEffect(() => {
    if (!api) return;
    setMode(currentMode());
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
      <PickerHost />
    </div>
  );
}

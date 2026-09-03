import type { ToolDef } from "../types";
import { getScene, getSelection, getViewport, findElements } from "./inspect";
import { addElements, updateElements, deleteElements, restyle, focusOn } from "./elements";
import { undoAgentStep, clearCanvas } from "./session";
import { drawFlowchart } from "./flowchart";

export const allTools: ToolDef[] = [
  // read
  getScene,
  getSelection,
  getViewport,
  findElements,
  // write
  addElements,
  updateElements,
  deleteElements,
  restyle,
  focusOn,
  // diagrams
  drawFlowchart,
  // session
  undoAgentStep,
  clearCanvas,
];

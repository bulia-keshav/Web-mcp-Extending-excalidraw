import type { ToolDef } from "../types";
import { getScene, getSelection, getViewport, findElements } from "./inspect";
import { addElements, updateElements, deleteElements, restyle, focusOn } from "./elements";
import { undoAgentStep, clearCanvas } from "./session";

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
  // session
  undoAgentStep,
  clearCanvas,
];

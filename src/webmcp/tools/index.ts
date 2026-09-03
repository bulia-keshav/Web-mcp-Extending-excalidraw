import type { ToolDef } from "../types";
import { getScene, getSelection, getViewport, findElements } from "./inspect";
import { addElements, updateElements, deleteElements, restyle, focusOn } from "./elements";
import { undoAgentStep, clearCanvas } from "./session";
import { drawFlowchart } from "./flowchart";
import { drawChart } from "./charts";
import { drawTable } from "./tables";
import { arrange } from "./layout";
import { annotate } from "./annotate";
import { drawHierarchy } from "./hierarchy";
import { drawGraph } from "./graph";
import { drawTimeline } from "./timeline";
import { drawBoard } from "./board";
import { placeImage, capturePhoto } from "./images";
import { exportPng } from "./export";

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
  drawChart,
  drawTable,
  drawHierarchy,
  drawGraph,
  drawTimeline,
  drawBoard,
  // images
  placeImage,
  capturePhoto,
  // layout & emphasis
  arrange,
  annotate,
  // session
  exportPng,
  undoAgentStep,
  clearCanvas,
];

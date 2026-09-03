/** Excalidraw's own accent colours, so agent output looks native to the app. */
export const SERIES_COLORS = [
  "#1971c2", // blue
  "#e03131", // red
  "#2f9e44", // green
  "#f08c00", // orange
  "#9c36b5", // violet
  "#0c8599", // teal
];

export const SERIES_FILLS = [
  "#a5d8ff",
  "#ffc9c9",
  "#b2f2bb",
  "#ffec99",
  "#eebefa",
  "#99e9f2",
];

export const INK = "#1e1e1e";
export const MUTED = "#868e96";

export const colorFor = (i: number) => SERIES_COLORS[i % SERIES_COLORS.length];
export const fillFor = (i: number) => SERIES_FILLS[i % SERIES_FILLS.length];

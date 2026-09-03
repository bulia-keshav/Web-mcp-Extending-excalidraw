/**
 * Diagrams past this size stop being readable, so we refuse rather than
 * render a hairball. The error tells the agent to split into a board — that
 * constraint is what makes long-document output usable instead of a mess.
 */
export const NODE_CAP = 40;
export const PANEL_NODE_CAP = 25;

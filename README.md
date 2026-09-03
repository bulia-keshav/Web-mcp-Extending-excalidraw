# Sketchpad Agent

**A whiteboard that gets better when a human and an agent draw on it together.**

An [Excalidraw](https://excalidraw.com) canvas that exposes **24 WebMCP tools**, so an agent
in a WebMCP-capable browser can co-draw with you: redraw a paper sketch, turn a CSV into a
chart, build a flowchart from a description, map a whole thesis chapter, or tidy up what you
already drew.

**Live:** https://web-mcp-extending-excalidraw.vercel.app

The agent never sends pixels or coordinates. It describes *intent* — nodes and edges, rows and
series, events in order — and this app computes the geometry. That division is the whole design:
LLMs are unreliable at absolute x/y, and layout is a solved problem.

---

## What makes it a collaboration rather than a rendering service

Three things, and they are the reason this is not just "an LLM that draws":

**It can see what you selected.** `get_selection` reads your live selection, so "make *these*
a horizontal pipeline" works without you describing which boxes you mean.

**It never overwrites your work.** Every scene write is append-only and reads fresh state at
execution time. Deletes are soft. The agent cannot clobber a shape you are mid-way through
dragging.

**Everything it does is visible and reversible.** The Agent Activity panel lists every tool
call as it happens, with a per-call undo button — and `undo_agent_step` undoes only the
*agent's* actions, never yours.

Bound arrows are real Excalidraw bindings, so when you drag a box the agent drew, the arrows
follow.

---

## Tools

### Orientation
| Tool | What it does |
|---|---|
| `how_to_draw_here` | The agent's briefing: which tool to reach for, how placement works, the node caps, and that it cannot see the canvas |

### Reading the canvas
| Tool | What it does |
|---|---|
| `get_scene` | Compact list of everything drawn; capped so it stays small in context |
| `get_selection` | What the human currently has selected, with labels resolved |
| `get_viewport` | The region the human is looking at |
| `find_elements` | Substring search over text and labels, to extend a diagram instead of redrawing it |

### Drawing
| Tool | What it does |
|---|---|
| `add_elements` | Shapes, text and bound arrows from a semantic skeleton with `tempId` references |
| `draw_flowchart` | Processes and decision trees, laid out by `mermaid-to-excalidraw` |
| `draw_chart` | Bar and line charts with computed axes, ticks and legend |
| `draw_table` | Grid with a shaded header row |
| `draw_hierarchy` | Trees: section outlines, org charts, taxonomies |
| `draw_graph` | Relationship graphs with optional clustered groups |
| `draw_timeline` | Ordered events on an axis, labels alternating to avoid collisions |
| `draw_board` | **Several diagrams at once in a grid** — how a long document becomes one readable board |
| `place_image` / `capture_photo` | Put a photo on the canvas, faded, as a tracing reference |

### Editing and emphasis
| Tool | What it does |
|---|---|
| `update_elements` | Move, resize, recolour, retext by id |
| `restyle` | Bulk style change across many elements |
| `arrange` | Reflow elements into a row, column or grid |
| `annotate` | Callout text plus an arrow bound to a target |
| `delete_elements` | Soft delete, so undo can restore |
| `focus_on` | Scroll and zoom the human's view to given elements |

### Session
| Tool | What it does |
|---|---|
| `undo_agent_step` | Reverse the agent's own recent changes only |
| `clear_canvas` | Wipe everything (requires explicit confirmation) |
| `export_png` | Export the canvas as a PNG download |

Every tool validates its input with a zod schema, which also generates the JSON Schema handed
to the WebMCP host — one source of truth, so the two cannot drift. Malformed input returns
`{ ok: false, error, hint }` and never throws.

---

## Handling long documents

Asking for one diagram of a 30-page chapter produces an unreadable hairball. So the drawing
tools **refuse** to: every diagram enforces a 40-node cap and returns

```json
{ "ok": false, "error": "too_many_nodes", "hint": "split into a draw_board with multiple panels" }
```

which pushes the agent toward `draw_board` — 3 to 6 panels, one per section or theme. The
constraint is the feature.

---

## Architecture

```
src/
  excalidraw/     apiRef, sceneOps (append-only), placement, skeleton, mermaid, files, persistence
  webmcp/         detect (+ honest shim), registry (validation + undo capture), actionStack
    tools/        one module per tool family
  ui/             AgentActivityPanel, PickerHost (camera + file)
  dev/            harness — window.__agent, shipped in production on purpose
```

**Placement.** The agent passes intent, not coordinates:

```ts
{ mode: "viewport" }                                    // where the human is looking (default)
{ mode: "next_to", refId, side: "right" | "below" }      // beside an existing diagram
{ mode: "free_space" }                                   // clear of everything already drawn
{ mode: "absolute", x, y }                               // escape hatch
```

Composite diagrams share a `groupId`, so `next_to` resolves the whole diagram's extent and
the human can drag a chart as a single unit.

**Registration.** Tools register once Excalidraw has mounted, in the top-level document —
never an iframe, since tools registered inside iframes are not discovered. When no WebMCP
host is present, an inert shim stands in so the real registration path still runs, and the
UI reports honestly which mode it is in: *Connected to an agent* / *No agent host*.

---

## Running it

```bash
npm install
npm run dev
```

Then open the app and try it without an agent at all:

```js
__agent.list()                       // every registered tool
__agent.describe("draw_chart")       // its full schema
__agent.call("draw_chart", { kind: "bar", labels: ["Q1","Q2"], series: [{ values: [12, 19] }] })
```

`window.__agent` **ships in production deliberately.** If the harness were dev-only, the build
under test would not be the build that gets deployed.

### Using it with an agent

Open the deployed URL in a WebMCP-capable browser (ChatGPT's built-in browser, or Chrome with
`chrome://flags/#enable-webmcp-testing`). The Agent badge turns green when a real host is
connected.

---

## Notes on deployment

The deployed build is the one that gets tested, not just localhost. Three things that break
only in production, handled here:

- **Fonts.** Excalidraw fetches fonts from a CDN unless `window.EXCALIDRAW_ASSET_PATH` is set.
  They are vendored into `public/fonts` on `postinstall`, and the path is set from an inline
  script in `index.html` — it cannot live in `main.tsx`, because ES import hoisting would run
  Excalidraw's modules first.
- **`process.env.IS_PREACT`.** Excalidraw's bundle references it; without a Vite `define` the
  production build throws at runtime while dev works fine.
- **Pinned dependencies.** Exact versions, so the deployed build cannot resolve different
  packages than the local one.

Deployment must not send `Permissions-Policy: tools=()`, which would disable WebMCP. Verify with:

```bash
curl -sSI https://web-mcp-extending-excalidraw.vercel.app | grep -i permissions-policy
```

(no output = good)

---

## Licence

MIT — see [LICENSE](LICENSE).

# Excalidraw + WebMCP: Build Plan

Working name: **Sketchpad Agent** (rename later). An Excalidraw canvas that exposes WebMCP tools so an agent (ChatGPT desktop built-in browser) can co-draw with a human: redraw paper sketches, turn data into charts, build flowcharts from a description, and tidy up whatever the human already drew.

This document is the spec. Hand it to Claude Code phase by phase. Do not let it skip a phase or merge phases.

---

## 0. Decisions already made (do not re-litigate)

| Decision | Choice | Why |
|---|---|---|
| Fork Excalidraw repo? | **No.** Fresh Vite + React + TS app using the `@excalidraw/excalidraw` npm package | The monorepo is a yarn-workspaces beast. Everything we need (`updateScene`, `getSceneElements`, `addFiles`, `scrollToContent`, `getAppState`, `convertToExcalidrawElements`) is exported from the package. Forking only makes sense if you need to change rendering internals. We don't. |
| WebMCP API style | **Imperative only** (`document.modelContext.registerTool`) | ChatGPT site tools do not support the declarative form-attribute API |
| Where Excalidraw mounts | **Top-level document**, never an iframe | Tools registered inside iframes are not discovered |
| Who computes coordinates | **Our code, not the LLM** | LLMs are bad at absolute x/y. Agent gives semantic structure (nodes, edges, rows, series); layout helpers produce coordinates |
| Who does the vision | **The agent (ChatGPT is multimodal)** | The user attaches the paper-sketch photo in the ChatGPT chat. The agent reads it and calls our drawing tools. Our app never runs a vision model |
| Scene writes | **Append-only, non-destructive** | Never overwrite the human's in-progress elements. Read scene, filter deleted, append, push back |
| Flowchart layout engine | `@excalidraw/mermaid-to-excalidraw` for flowcharts (agent emits Mermaid, we convert) | Layout, bindings, and labels are solved and battle-tested. Custom dagre layout is a stretch goal only if time remains |
| Charts and tables | **Built from primitives ourselves** | Excalidraw's internal chart renderer is not cleanly exported. Bars are rectangles, axes are lines, labels are text. Simple and fully controlled |
| Hosting | Vercel (Netlify fallback) | Both are challenge sponsors. Must verify response headers do not contain `Permissions-Policy: tools=()` |
| Validation | `zod` schemas mirrored to JSON Schema for `inputSchema` | One source of truth per tool; malformed agent input returns a structured error, never a crash |

---

## 1. Product framing (for the README and the 3-minute video)

Tagline: "A whiteboard that gets better when a human and an agent draw on it together."

Three demo moments, in this order:

1. **Paper to canvas.** User photographs a hand-drawn flowchart, attaches it in ChatGPT, says "redraw this cleanly." Agent calls `place_image` (faded reference on the left) then `draw_flowchart` (clean version on the right). Human drags a box; arrows follow.
2. **Human selects, agent acts.** User rubber-band selects four boxes, says "make these a horizontal pipeline, color the decision one yellow, and label the flow." Agent calls `get_selection`, `arrange`, `restyle`, `add_elements` (arrows with bindings), `annotate`.
3. **Data to chart.** User pastes a small CSV in chat, says "bar chart this and call out the biggest one." Agent calls `draw_chart` then `annotate` pointing at the tallest bar. Then `undo_agent_step` to show safety.

The **Agent Activity panel** (a small sidebar listing every tool call as it happens, with a per-call undo button) is what makes the human-in-the-loop story visible in the video. Build it. It is cheap and it is the thing judges will remember.

---

## 2. Tool catalogue

Every tool has: `name`, `description` (written for the LLM, with examples), `inputSchema` (JSON Schema), `annotations` (`readOnlyHint`, `untrustedContentHint`), and an `execute` that returns either `{ ok: true, ...data }` or `{ ok: false, error, hint }`.

Every mutating tool returns the **real Excalidraw ids** of what it created, keyed by the temporary ids the agent supplied, so the agent can reference them in later calls.

### Tier A: Core (must ship)

| Tool | Read/Write | Input (semantic) | What it does | Feasibility |
|---|---|---|---|---|
| `get_scene` | read, untrusted | `{ detail: "summary" \| "full", limit? }` | Returns compact list of live elements: `id, type, text/label, x, y, width, height, strokeColor, backgroundColor, boundTo (for arrows)`. Summary mode groups by type and caps at ~80 elements so context stays small | Light |
| `get_selection` | read, untrusted | none | Returns the elements the human currently has selected (from `appState.selectedElementIds`) plus their bounding box. This is the "we share the same page" superpower | Light |
| `get_viewport` | read | none | Returns visible scene rect (scrollX, scrollY, zoom, width, height) so placement helpers can put new things where the human is looking | Light |
| `add_elements` | write | `{ elements: Skeleton[], placement? }` | Skeleton = `{ tempId, type: rectangle\|ellipse\|diamond\|text\|arrow\|line, label?, text?, x?, y?, width?, height?, start?: {tempId}, end?: {tempId}, strokeColor?, backgroundColor? }`. Runs `convertToExcalidrawElements`, resolves bindings, appends. If x/y omitted, placement helper positions it | Light/Medium |
| `update_elements` | write | `{ updates: [{ id, patch: { text?, label?, x?, y?, width?, height?, strokeColor?, backgroundColor?, opacity? } }] }` | Patches existing elements by real id. Text changes go through `convertToExcalidrawElements` for bound-text containers so the label re-measures | Medium |
| `delete_elements` | write | `{ ids: string[] }` | Marks `isDeleted: true` (never hard-removes, keeps Excalidraw history sane) | Light |
| `draw_flowchart` | write | `{ mermaid: string, placement? }` or `{ nodes: [{ id, label, shape? }], edges: [{ from, to, label? }], direction? }` | Accept both. If `nodes/edges` given, generate Mermaid text internally, then run `mermaid-to-excalidraw`, offset to placement, append. Returns node id map | Medium |
| `place_image` | write | `{ source: "upload" \| "camera" \| "dataURL", dataURL?, placement?, opacity?: 0..100, maxWidth? }` | `upload` opens a file picker; `camera` opens the camera modal; `dataURL` uses provided string. Calls `excalidrawAPI.addFiles` with a generated `fileId` and appends an `image` skeleton element sized to aspect ratio. Default opacity 40 when used as a tracing reference | Medium |
| `focus_on` | write (view only) | `{ ids: string[] }` | `scrollToContent(elements, { fitToContent: true, animate: true })` and selects them | Light |
| `undo_agent_step` | write | `{ steps?: number }` | Pops the agent action stack (each tool call records the ids it created/changed and their previous state) and reverts | Medium |
| `clear_canvas` | write, readOnlyHint false | `{ confirm: true }` | Deletes all elements. The annotation makes ChatGPT ask the human first | Light |

### Tier B: Differentiators (target for the submission)

| Tool | Input (semantic) | What it does | Feasibility |
|---|---|---|---|
| `draw_chart` | `{ kind: "bar" \| "line", title?, labels: string[], series: [{ name?, values: number[] }], placement?, width?, height? }` | Computes axes (two `line` elements), bars (rectangles) or points+lines, tick labels (text), title, legend if >1 series. Returns ids for each bar/point so the agent can annotate specific ones | Medium |
| `draw_table` | `{ headers: string[], rows: string[][], placement?, columnWidth? }` | Grid of rectangles with bound text, header row shaded. Returns cell ids as `[row][col]` | Medium |
| `arrange` | `{ ids: string[], mode: "row" \| "column" \| "grid", gap?, align?: "left" \| "center" \| "top" }` | Repositions the given elements (usually from `get_selection`). Moves bound text and re-routes bound arrows by moving containers only (Excalidraw handles the rest on `updateScene`) | Medium |
| `restyle` | `{ ids: string[], strokeColor?, backgroundColor?, fillStyle?, strokeWidth?, roughness?, fontSize? }` | Bulk style patch. Separate from `update_elements` so the description can be short and the agent uses it confidently | Light |
| `annotate` | `{ targetId, text, side?: "top" \| "right" \| "bottom" \| "left", color? }` | Creates a text callout offset from the target plus an arrow bound from the callout to the target | Medium |
| `capture_photo` | none | Opens camera modal (`getUserMedia`, `facingMode: environment`), human clicks Capture, frame drawn to offscreen canvas, JPEG dataURL produced, placed on canvas via the same path as `place_image`. Returns `{ elementId, fileId, width, height }` | Medium, see risk R1 |
| `draw_hierarchy` | `{ title?, root: { label, children?: [...recursive] }, direction?: "TD" \| "LR", placement? }` | Tree layout for outlines: chapter to sections to key points, org charts, taxonomies. Generates Mermaid `flowchart TD` internally (or simple recursive tree layout if Mermaid spacing looks bad), wraps in a titled frame. Returns node id map | Medium |
| `draw_timeline` | `{ title?, events: [{ label, detail?, marker? }], orientation?: "horizontal" \| "vertical", placement? }` | Ordered events on an axis line with alternating labels above/below. Novel plots, methodology steps, historical background sections. Built from primitives | Medium |
| `draw_graph` | `{ title?, nodes: [{ id, label, group? }], edges: [{ from, to, label?, directed?: boolean }], placement? }` | Relationship graphs: characters in a novel, concepts in a lit review, components in a system. Undirected edges use Mermaid `---`, directed use `-->`. Groups become colored clusters via `subgraph` | Medium |
| `draw_board` | `{ title?, panels: [{ title, kind: "flowchart" \| "hierarchy" \| "timeline" \| "graph" \| "table" \| "chart", spec: <that tool's input> }], columns?: number }` | Renders several diagrams at once, each inside an Excalidraw `frame` element with its title, laid out in a grid with gaps. This is how a whole chapter becomes one readable board. Returns per-panel frame ids and node maps | Medium (composes the others) |
| `find_elements` | `{ query: string, type? }` | Case-insensitive substring match over text and labels. Returns ids and positions. Needed so the agent can extend an existing diagram ("add the section 3.2 branch to the methodology chart") instead of redrawing | Light |

### Tier C: Stretch (only if A and B are done and tested in ChatGPT)

| Tool | Notes |
|---|---|
| `export_png` | `exportToBlob` from the package, offer download. Nice closing beat for the video |
| `group_elements` / `ungroup` | Assign shared `groupIds` |
| `draw_mindmap` | Radial layout from `{ center, branches: [{ label, children }] }`. Custom layout, so only if time |
| `find_elements` | `{ query }` substring match over text/labels; returns ids. Useful for "delete the box that says Login" |

---

## 2b. Long documents to diagrams (thesis chapter, novel, paper)

**Where the work happens:** the user attaches the chapter (PDF, DOCX, or pasted text) in the ChatGPT chat. The agent already has the full text in context. Our app never receives the document. Our job is to make the drawing side handle what a long document produces.

**What a chapter or novel turns into (the agent decides, our tools render):**

| Source content | Diagram | Tool |
|---|---|---|
| Section structure, argument outline | Tree | `draw_hierarchy` |
| Process, methodology, algorithm, plot causality | Flowchart | `draw_flowchart` |
| Plot events, experiment stages, historical background | Timeline | `draw_timeline` |
| Characters, concepts, cited works, system components | Relationship graph | `draw_graph` |
| Results, comparisons | Table or chart | `draw_table`, `draw_chart` |
| All of the above for one chapter | Multi-panel board | `draw_board` |

**Rules baked into tool descriptions (this is where "functional" lives):**

- Tell the agent explicitly: "For documents longer than a few pages, do not produce one diagram. Produce a `draw_board` with 3 to 6 panels, one per major section or theme. Keep each panel under 25 nodes. Prefer short labels (under 6 words) and put detail in `detail` fields, not in node labels."
- Every drawing tool enforces a **node cap** (default 40). If the agent exceeds it, return `{ ok: false, error: "too_many_nodes", hint: "split into a draw_board with multiple panels" }`. This forces good output instead of producing an unreadable diagram.
- `draw_board` places panels in a grid using the placement helper and wraps each in a **frame** element (Excalidraw skeleton `{ type: "frame", name, children: [ids] }`). Frames give the human a draggable, named unit per section and keep the board readable when it has 150 elements.
- After a board is drawn, the tool returns a compact map (`{ panelTitle: { frameId, nodeIds: {...} } }`) so follow-up requests like "expand the Results panel" call `find_elements` or use the map, then `add_elements` with `placement: { mode: "next_to", refId }`, rather than redrawing everything.
- Excalidraw persists the scene to localStorage on its own when `initialData` is wired through `restore` (see section 5). So a board built over several agent turns survives a page refresh. Build this in Phase 1, it is what separates functional from prototype.

**Demo moment 4 for the video:** drop a thesis chapter PDF into ChatGPT, say "map this chapter." The agent produces a board: hierarchy of sections, methodology flowchart, results table, and a graph of the cited approaches. Then you say "the human dragged the results panel to the top, add a timeline of the experiments below it" and the agent uses `get_scene` plus `draw_timeline` with `next_to`.

---

## 3. Placement helper (shared by every drawing tool)

Agent never needs absolute coordinates. `placement` is:

```ts
type Placement =
  | { mode: "viewport" }                       // center of what the human sees (default)
  | { mode: "next_to", refId: string, side: "right" | "below" | "left" | "above", gap?: number }
  | { mode: "free_space" }                     // scan scene bbox, put it to the right of everything
  | { mode: "absolute", x: number, y: number } // escape hatch
```

`resolvePlacement(placement, contentWidth, contentHeight) -> { x, y }`. All composite tools build their content at origin (0,0) then translate by this result.

---

## 4. Architecture

```
src/
  main.tsx
  App.tsx                       # <Excalidraw excalidrawAPI={setApi}/> + <CameraModal/> + <AgentActivityPanel/>
  excalidraw/
    apiRef.ts                   # module-level ref to excalidrawAPI, set once on mount
    sceneOps.ts                 # appendElements, patchElements, softDelete, getLiveElements (append-only, filters isDeleted)
    skeleton.ts                 # buildFromSkeleton(): tempId -> realId map, convertToExcalidrawElements wrapper, binding resolution
    placement.ts                # resolvePlacement(), sceneBounds(), viewportRect()
    files.ts                    # addImage(dataURL) -> { fileId, elementSkeleton } with aspect-ratio sizing
  webmcp/
    detect.ts                   # hasWebMCP(), plus dev shim (see section 6)
    registry.ts                 # registerAll(tools, signal): loops, wraps execute with validation + logging + action stack
    actionStack.ts              # push({ tool, created: ids[], patched: [{id, before}] }), undo(n)
    types.ts                    # ToolDef, ToolResult
    tools/
      inspect.ts                # get_scene, get_selection, get_viewport
      elements.ts               # add_elements, update_elements, delete_elements, restyle, focus_on
      flowchart.ts              # draw_flowchart (mermaid path + nodes/edges -> mermaid generator)
      charts.ts                 # draw_chart
      tables.ts                 # draw_table
      layout.ts                 # arrange
      annotate.ts               # annotate
      images.ts                 # place_image, capture_photo
      session.ts                # undo_agent_step, clear_canvas
  ui/
    CameraModal.tsx             # video preview, Capture/Cancel, resolves a Promise held by images.ts
    FilePicker.tsx              # hidden <input type=file>, same Promise pattern
    AgentActivityPanel.tsx      # live log of tool calls (name, summary, ok/error, undo button)
  dev/
    harness.ts                  # window.__agent.call(name, args) for testing without ChatGPT
```

**Registration lifecycle:** `App.tsx` has a `useEffect` that waits for `excalidrawAPI`, checks `hasWebMCP()`, creates an `AbortController`, calls `registerAll(allTools, controller.signal)`, and aborts on unmount.

**Wrapper around every execute** (in `registry.ts`):

1. Validate args with zod. On failure return `{ ok: false, error: "invalid_input", hint: <zod message> }`.
2. Snapshot affected element state for undo.
3. Run the tool inside try/catch. Any throw becomes `{ ok: false, error: "execution_failed", hint }`.
4. Push to action stack and to the Activity panel.
5. Return result. Never return raw Excalidraw element objects (too big); return ids and compact summaries.

---

## 5. Key implementation notes (things Claude Code will get wrong without being told)

- **Bound text on shapes:** use the skeleton `label: { text }` property, not a separate text element, so text stays centered and moves with the container.
- **Arrow bindings:** skeleton arrows take `start: { id }` and `end: { id }` where id is the tempId of another skeleton in the same call, or `start: { id: realId }` for an existing element. Resolve tempIds before calling `convertToExcalidrawElements`. Excalidraw needs the bound elements present in the same `updateScene` payload, so always push the full live array plus new elements.
- **Append-only:** `updateScene({ elements: [...getLiveElements(), ...newElements] })`. Read fresh every call. Never cache the element array across calls.
- **Images:** `addFiles([{ id, dataURL, mimeType, created: Date.now() }])` must happen before `updateScene` with the `image` element whose `fileId` matches. Set `status: "saved"`. Size to aspect ratio, cap at `maxWidth` (default 600 scene units).
- **Selection:** `getAppState().selectedElementIds` is a `{ [id]: true }` map. Filter live elements by it.
- **Mermaid:** `parseMermaidToExcalidraw(text)` returns `{ elements, files }`; run through `convertToExcalidrawElements` then translate all x/y by placement offset. Feed both elements and files in.
- **Scene reads for the agent must be small:** summary mode returns `{ count, byType, elements: [{ id, type, text, x, y, w, h }] }` capped at 80 with `truncated: true` if more.
- **Security annotations:** every read tool gets `untrustedContentHint: true` (canvas text is user content). Every write tool gets `readOnlyHint: false`. Reads get `readOnlyHint: true`.
- **Feature detection:** `typeof document.modelContext?.registerTool === "function"`. App must work as normal Excalidraw when absent.
- **Persistence (required for "functional"):** on `onChange`, debounce 500ms and write `{ elements, appState (whitelisted keys), files }` to localStorage. On mount, pass it as `initialData` after running it through `restoreElements`/`restoreAppState` from the package. Also persist the agent action stack so undo survives refresh.
- **Customizing Excalidraw's UI without forking:** the package accepts `renderTopRightUI`, `UIOptions`, and child components `MainMenu`, `WelcomeScreen`, `Footer`. Put the Agent Activity panel toggle in `renderTopRightUI`. Do not patch package internals.
- **Frames:** skeleton `{ type: "frame", name: "Methodology", children: [tempIds] }`. Children must be in the same `convertToExcalidrawElements` call. The frame auto-sizes to its children; add padding by placing children with a margin.
- **Descriptions matter more than schemas.** Each `description` should say what the tool is for, when to prefer it over a sibling (e.g. "use draw_flowchart instead of add_elements when the user describes a process with steps and connections"), and include one tiny JSON example.

---

## 6. Testing strategy

**Layer 1: dev harness (no agent).** `dev/harness.ts` exposes `window.__agent.call("draw_chart", {...})` and a `window.__agent.list()`. Also install a **dev shim**: if `document.modelContext` is missing and `import.meta.env.DEV`, define a minimal object with `registerTool` that stores tools in a map, so the registration code path runs in plain Chrome. Every tool gets a smoke test through the harness before touching ChatGPT.

**Layer 2: Chrome origin trial.** Enable `chrome://flags/#enable-webmcp-testing`, load the deployed URL, confirm tools appear.

**Layer 3: ChatGPT desktop app.** Update to latest, open the site in its built-in browser, run the three demo scripts from section 1. Do this the moment Tier A is done, before building Tier B. If discovery fails here, nothing else matters.

**Deployment check:** `curl -I <deployed-url>` and confirm no `Permissions-Policy: tools=()` header.

---

## 7. Risks and fallbacks

| ID | Risk | Fallback |
|---|---|---|
| R1 | Tool results are JSON. It is unverified whether ChatGPT treats a base64 image inside a tool result as an image it can "see." So `capture_photo` may put the photo on the canvas but the agent may not be able to read it | The primary "paper to canvas" flow does not depend on this: the user attaches the photo in the ChatGPT chat, where vision definitely works. `capture_photo` is then a convenience that places a reference image; the agent redraws from the chat attachment. Test R1 early; if it does work, mention it in the video as a bonus |
| R2 | ChatGPT site tools may not discover tools registered after a delay (Excalidraw mounts async) | Register a tiny `ping` tool synchronously at page load, then register the rest once the API is ready. Verify in Layer 3 whether late registration is picked up |
| R3 | `mermaid-to-excalidraw` bundle size / ESM issues in Vite | It is officially supported in Vite. If it fights, dynamic-import it inside `draw_flowchart` only |
| R4 | Human edits while agent writes (race) | Append-only reads fresh state at execution time, so the window is milliseconds. Acceptable |
| R5 | Agent floods the canvas with a bad call | Every call is on the action stack; `undo_agent_step` and the panel's per-call undo button recover |

---

## 8. Build order (give Claude Code one phase at a time)

**Phase 1: Skeleton app** (~1 hour)
Vite + React + TS. Install `@excalidraw/excalidraw`, `zod`, `@excalidraw/mermaid-to-excalidraw`. Mount Excalidraw full-screen. `apiRef.ts`, `sceneOps.ts`, `placement.ts`. localStorage persistence via `initialData` + debounced `onChange`. Dev shim + harness. Verify: `window.__agent.list()` returns `[]` and the canvas works.

**Phase 2: Tier A tools** (~3 hours)
`inspect.ts`, `elements.ts`, `session.ts`, `registry.ts`, `actionStack.ts`, `AgentActivityPanel.tsx`. Verify through the harness: add three boxes with two bound arrows, select two in the UI, `get_selection` returns them, `undo_agent_step` removes the boxes.

**Phase 3: Deploy and validate with ChatGPT** (~1 hour)
Push to GitHub (public), deploy to Vercel, header check, Layer 2 and Layer 3 tests. Fix discovery issues now.

**Phase 4: Flowchart and images** (~2 hours)
`flowchart.ts`, `images.ts`, `CameraModal.tsx`, `FilePicker.tsx`. Verify: demo moment 1 end to end in ChatGPT.

**Phase 5: Charts, tables, arrange, restyle, annotate** (~3 hours)
`charts.ts`, `tables.ts`, `layout.ts`, `annotate.ts`, `find_elements`. Verify: demo moments 2 and 3.

**Phase 5b: Document diagrams** (~3 hours)
`hierarchy.ts`, `timeline.ts`, `graph.ts`, `board.ts` (frames + grid), node caps in every drawing tool. Verify: demo moment 4 with a real chapter PDF in ChatGPT.

**Phase 6: Polish and submission** (~2 hours)
README with tool table and architecture diagram (draw it in the app itself, export, embed). Record 3-minute video. MIT license. Submit.

Stretch tools only after Phase 6 is fully done.

---

## 9. Prompt to start Claude Code with

```
Read excalidraw-webmcp-plan.md fully. We are building Phase 1 only.
Do not implement any tools from Tier A/B/C yet. Set up the Vite + React + TS
app, mount @excalidraw/excalidraw at the top level (no iframe), create the
excalidraw/ helpers listed in section 4 (apiRef, sceneOps, placement), the
webmcp/detect.ts feature detection with the dev shim, and the dev/harness.ts.
Before writing code, list any assumptions or deviations from the plan and
wait for my confirmation. When done, tell me exactly how to verify Phase 1
in the browser.
```

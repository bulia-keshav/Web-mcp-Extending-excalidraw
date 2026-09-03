# Devpost submission pack — Sketchpad Agent

Deadline: **3 Sep 2026, 1:00 PM PDT** (= 1:30 AM IST, 4 Sep).

## Checklist

| Requirement | Status |
|---|---|
| Public repo, GitHub | done — github.com/bulia-keshav/Web-mcp-Extending-excalidraw |
| Open source licence, visible at top of repo page | done — MIT `LICENSE` at repo root |
| Working live URL | done — https://web-mcp-extending-excalidraw.vercel.app |
| Newly created during submission period | yes — first commit 3 Sep 2026, nothing pre-existing |
| Text description (4 required points) | below — paste into Devpost |
| Video < 3 min, public YouTube, with audio | **TO RECORD** — script below |

Note on the video rule "must not include third party trademarks or copyrighted
music": use **no background music**. ChatGPT's and Excalidraw's interfaces
appearing on screen is unavoidable — the demo is required to run inside
ChatGPT's browser — so just don't add music or unrelated logos.

---

## TEXT DESCRIPTION (paste into Devpost)

### Sketchpad Agent — a whiteboard that gets better when a human and an agent draw on it together

**Why this is a strong fit for WebMCP**

A whiteboard is the clearest case I can think of where an agent should act
*inside* an app rather than beside it. Drawing is not a conversation — it is a
shared surface. A chatbot that returns an image gives you something to look at;
WebMCP lets the agent reach into the canvas you are already working on, see what
you have selected, and add to it while you keep drawing.

It also plays to WebMCP's real strength: the tools run in the page, with the
page's own logic. Layout, coordinates, arrow routing and text measurement all
stay in my code, where they are deterministic. The agent supplies structure —
nodes and edges, rows and series, events in order — and never has to guess an
x/y coordinate, which is exactly the thing language models are worst at.

**What people and agents can do together that was difficult before**

- **The agent can see what you selected.** `get_selection` reads your live
  selection, so "make *these* a horizontal pipeline and colour the decision one
  yellow" works without you describing which boxes you mean. That single tool is
  the difference between collaborating and dictating.
- **You can keep working while it works.** Every write is append-only and reads
  fresh scene state at execution time, so the agent cannot overwrite a shape you
  are mid-way through dragging. Deletes are soft.
- **You can drag what it drew and it stays correct.** Arrows are real Excalidraw
  bindings, so moving a box the agent created re-routes its arrows.
- **You can undo the agent without undoing yourself.** An Agent Activity panel
  lists every tool call as it happens with a per-call undo button, and
  `undo_agent_step` reverses only the agent's actions.
- **A 30-page chapter becomes a readable board.** Hand it a thesis chapter and
  `draw_board` lays out 3–6 panels — section hierarchy, methodology flowchart,
  results table, experiment timeline — each drawn by its own tool.

**How I implemented WebMCP**

23 tools registered imperatively with `document.modelContext.registerTool`, in
the top-level document. They are registered *before* React mounts, because
Excalidraw mounts asynchronously and a host that enumerates tools at page load
would otherwise find none; each tool waits for the canvas when a call actually
arrives. I also register on `navigator.modelContext` where present, since
Chrome's surface is a different object from ChatGPT's — registering on only one
silently exposes nothing in the other.

Each tool is defined once as a zod schema, which both validates the agent's
input at runtime and generates the JSON Schema handed to the host, so the two
cannot drift apart. Every call goes through one wrapper that validates, snapshots
affected elements for undo, catches throws, and logs to the activity panel — a
malformed call returns `{ok:false, error, hint}` and never crashes the page.
Reads are annotated `readOnlyHint` + `untrustedContentHint`, since canvas text is
user content.

The tools are layered: primitives (`add_elements` with `tempId` arrow bindings),
whole diagrams in one call (`draw_flowchart`, `draw_chart`, `draw_table`,
`draw_hierarchy`, `draw_graph`, `draw_timeline`), and `draw_board`, which composes
the others. Flowcharts go through `mermaid-to-excalidraw`; charts and tables are
built from primitives.

One design decision I am happy with: every drawing tool enforces a 40-node cap
and returns `{"error":"too_many_nodes","hint":"split into a draw_board with
multiple panels"}`. Asking for one diagram of a whole chapter produces an
unreadable hairball, so the tools refuse and push the agent toward a board. The
constraint is the feature.

**Built for this hackathon**, from an empty directory. Excalidraw is used as an
npm package; no fork.

---

## VIDEO SCRIPT — target 2:50

Record at 1280x720 or larger, ChatGPT desktop app with the built-in browser open
on the live URL. No music. Speak over it. Rehearse once, then record.

### 0:00–0:18 — Hook (spoken over the canvas with one box already drawn)

> "This is Sketchpad Agent. It's an Excalidraw whiteboard that exposes
> twenty-three WebMCP tools, so ChatGPT can draw on the same canvas I'm drawing
> on. Not generate a picture for me — actually work on my board, while I'm on it."

### 0:18–0:52 — Demo 1: data to chart (paste the CSV, then ask)

Type into ChatGPT: paste the 4-row CSV, then
*"Bar chart this and point out the best quarter."*

> "It calls draw_chart. I give it labels and series — no coordinates. The page
> computes the axes, the ticks, the legend. Then annotate, pointing an arrow at
> the bar it picked out. Notice the tool returned an id for every bar, so the
> agent can refer to one specific bar afterwards."

### 0:52–1:34 — Demo 2: the collaboration beat (THE important one)

Rubber-band select 3–4 boxes **yourself**, on camera. Then ask:
*"Make these a horizontal pipeline and colour the decision one yellow."*

> "This is the part a chatbot can't do. I selected those with my mouse. The agent
> calls get_selection and reads my actual selection out of the app's state — I
> never told it which boxes I meant. Then arrange and restyle."

Now **drag one box** with the mouse.

> "And the arrows follow, because these are real Excalidraw bindings, not drawn
> lines."

### 1:34–2:12 — Demo 3: a chapter becomes a board

Attach a PDF / paste a couple of pages. Ask: *"Map this chapter."*

> "One call to draw_board. Section hierarchy, the methodology as a flowchart,
> results as a table, experiments on a timeline — four panels, laid out in a grid,
> each drawn by its own tool. And every tool caps at forty nodes: ask for one
> giant diagram and it refuses and tells the agent to split it into panels
> instead. That's what keeps the output readable."

### 2:12–2:40 — Safety and how it's wired

Open the **Agent Activity panel**.

> "Every tool call the agent made is listed here, and each one has its own undo
> button. Undo agent step reverses only what the agent did — never my own
> drawing. Writes are append-only, so it can't overwrite a shape I'm working on."

Click **undo** on one entry.

> "Twenty-three tools, registered with document dot modelContext dot registerTool
> in the top-level page. Each one is a zod schema that both validates the input
> and generates the JSON schema ChatGPT sees, so they can't drift apart."

### 2:40–2:50 — Close

> "The agent brings the reading and the judgement. The page keeps the geometry.
> That split is the whole design. Repo's open source, link's in the description."

---

## Filming notes

- Draw 3–4 boxes by hand **before** recording so demo 2 has something to select.
- Have the CSV and the chapter text in your clipboard history, ready to paste —
  do not type them on camera.
- Before recording: confirm the Agent badge top-right is **green**. Amber means
  no WebMCP host and the demo won't work.
- If Vercel shows a "Security Checkpoint" page, turn off Attack Challenge Mode in
  Vercel → Project → Firewall first.
- Record one continuous take if you can. Cuts cost more time than they save.

## CSV to paste in demo 1

```
Quarter,Revenue
Q1,120
Q2,190
Q3,90
Q4,170
```

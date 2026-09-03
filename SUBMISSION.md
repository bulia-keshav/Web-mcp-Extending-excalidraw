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

## VIDEO SCRIPT — target 2:52, hard ceiling 3:00

Setup: ChatGPT desktop app, in-app browser on the live URL, **tool-call section
expanded** so every call is visible on screen. Agent badge green. No music.

**Before you hit record:** draw 4 boxes by hand on the canvas — three rectangles
and one diamond, scattered, unaligned, labelled `Ingest`, `Validate`,
`Retry?` (diamond), `Store`. Demo 2 needs something of *yours* to select.
Have the CSV and the chapter text already in your clipboard manager.

---

### 0:00 – 0:18 · Opening (18s)
*On screen: your four hand-drawn boxes, nothing else.*

> "Most AI drawing tools hand you a finished picture and step back.
> This one doesn't step back.
> Sketchpad Agent is a whiteboard where a human and an agent work the same
> canvas at the same time. It can see what I've selected. I can move what it
> drew. And I can undo it without undoing myself.
> Twenty-five WebMCP tools, running in the page."

---

### 0:18 – 0:50 · Numbers become a chart (32s)

**Prompt** (paste the CSV, then this):
```
Bar chart this, and call out the best quarter.
```

> "It calls draw_chart — you can see the call there. I give it labels and
> numbers. No coordinates: the page computes the axes, the ticks, the scale.
> Then annotate. The chart tool returned an id for every single bar, so the
> agent can point at one specific bar rather than describing it."

---

### 0:50 – 1:28 · The collaboration beat (38s) — THE important one

**Do this on camera first:** rubber-band select your four hand-drawn boxes with
the mouse. Pause a beat so it's obvious *you* did it.

**Prompt:**
```
Make these a horizontal pipeline, colour the decision one yellow, and connect them with arrows.
```

> "Watch the first call — get_selection. I selected those boxes with my mouse,
> and it read my selection straight out of the app's state. I never told it
> which boxes I meant. Then arrange, restyle, add_elements."

**Now drag one box across the canvas with the mouse.**

> "And the arrows follow. Those are real Excalidraw bindings, not lines it drew
> at coordinates. It handed me back something I can actually keep working on."

---

### 1:28 – 1:54 · Duplicate and diverge (26s)

**Prompt:**
```
Duplicate that pipeline below it, and make the copy blue so I can tell them apart.
```

> "duplicate_elements. It brings the labels and the arrows, mints new ids, and
> re-binds the arrows to the copy — so the two are independent. I can now take
> that second one in a different direction without touching the first."

*(Optional, only if you're ahead of time: drag a box in the copy to show the
original doesn't move.)*

---

### 1:54 – 2:26 · A chapter becomes a board (32s)

**Prompt** (attach the PDF or paste a few pages, then):
```
Map this chapter onto the canvas.
```

> "One call to draw_board. Section hierarchy, the methodology as a flowchart,
> results as a table, the experiments on a timeline — four panels, laid out in a
> grid, each drawn by its own tool.
> And every tool caps at forty nodes. Ask for one giant diagram of a whole
> chapter and it refuses, and tells the agent to split it into panels instead.
> That constraint is what keeps the output readable."

---

### 2:26 – 2:44 · Safety and how it's built (18s)

**Click the Agent button, top-right.**

> "Every call it made is listed here, each with its own undo button.
> undo_agent_step reverses only the agent's work, never mine. Writes are
> append-only, so it can't overwrite a shape I'm in the middle of drawing."

**Click undo on one entry.**

> "Twenty-five tools registered with document.modelContext.registerTool in the
> top-level page. Each one is a single zod schema that both validates the input
> and generates the JSON schema ChatGPT sees — so the two can't drift apart."

---

### 2:44 – 2:52 · Close (8s)

> "The agent brings the reading and the judgement. The page keeps the geometry.
> That split is the whole design. It's open source — link's below."

---

### If you're running long
Cut in this order, they're the least load-bearing:
1. The second half of the board narration (the node-cap sentence) — saves 8s.
2. The optional drag in the duplicate section.
3. The "append-only" sentence in the safety beat — saves 5s.

**Never cut** the get_selection beat at 0:50. That is the entire argument for
why this is a WebMCP project and not a chatbot with a render button.

## Paste-ready assets

**CSV for the chart demo:**

```
Quarter,Revenue
Q1,120
Q2,190
Q3,90
Q4,170
```

**If you have no chapter PDF handy**, paste this instead — it exercises all four
panel types:

```
Chapter 3: Method. We recruited 120 participants through university mailing
lists, excluding anyone with prior exposure to the task. Participants completed
a baseline measure, then a twelve-week intervention, then a follow-up. Primary
outcome was task accuracy; secondary outcomes were completion time and reported
confidence. Analysis used a mixed-effects model. Baseline accuracy was 71%;
post-intervention accuracy was 88%.
```

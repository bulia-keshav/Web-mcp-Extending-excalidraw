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

## VIDEO SCRIPT

Your script. I only filled the two gaps you asked for (the low/high level
examples, and the no-coordinates line) and fixed a few words. Everything else
is as you wrote it.

**Before recording:** paste `demo-assets/chatgpt-priming-message.txt`, wait for
"ready", then record. Hand-draw five messy boxes first: `Idle`, `Request`,
`Grant`, `Busy`, `Release`.

---

**Open**

> Excalidraw is a drawing board. That's all it is — it doesn't know what a chart
> is, or a state machine, or a report.
> So I built twenty-five WebMCP tools on top of it. Low level ones — draw a box,
> bind an arrow to it, restyle it, duplicate it. And high level ones that build a
> whole thing in one call — charts, tables, timelines, hierarchies, relationship
> graphs, and multi-panel boards.
> Now let's see how it will help an engineering student like me.

---

**Bar chart** — *[SPEAK]*

> Hey ChatGPT, can you please take this data and make it into a bar chart?

> That's the draw_chart tool. One call. Four labels, four numbers, no
> coordinates anywhere. And Scheduler's off the scale — six times the next
> worst, and it never even finished.

---

**Line chart** — *[SPEAK]*

> Hey ChatGPT, can you please add a second plot, a line chart, beside the
> current one?

> Same tool, line mode. And don't forget these are all editable — real shapes on
> my canvas, not a flat image.

---

**Found the culprit** — *[SPEAK]*

> Can you please increase the width of the selected bar and make it red?

> The tools mark every block and every point with an id, so it can be referred
> to easily.

---

**Flow diagram**

Next, I have a few blocks that I'd like to turn into a flow diagram.
*Select the five boxes with the cursor.* — *[SPEAK]*

> These are the states I sketched for Scheduler. Turn them into a proper state
> machine, left to right, with the transitions labelled — and add a 'Timeout?'
> branch after Busy that goes back to Request.

> Notice how I didn't refer to which blocks. I only selected them using my
> cursor, and it used the get_selection tool — it read my selection straight out
> of the app's state.
> That's the whole idea. Me and my agent working and looking at the same thing.

---

**Duplicate** — *[SPEAK]*

> Can you please duplicate the selected diagram below, and add two more states
> vertically below Busy named Merged retry and Backoff, and colour them green?

> It's doing the drawing I'd otherwise be doing by hand. This is my canvas, and
> the agent is a tool on it, not the architect of it.

---

**Board**

Next, I have some notes I'd like to turn into diagrams on my canvas. — *[SPEAK]*

> Here are my notes from the run. Map them onto the canvas as a board.

> That's the draw_board tool, and it uses the other tools underneath —
> hierarchy, table, chart, flow chart.

---

**Safety** — *click the Agent button*

> Every call is logged here with its own undo button, and undo only reverses the
> agent's work, never mine.
> Twenty-five tools, open source, link's below.

---

### Notes
- If you'd rather say the no-coordinates point later instead of on the bar
  chart, move it to the line chart: "Still no coordinates from the agent — just
  data."
- Confirm the Agent badge is green before you start.
- No background music — the rules forbid copyrighted audio.
- Your face doesn't need to be on screen.

## Paste-ready assets

All three live in `demo-assets/` as real files, so you can open them on camera
rather than pasting raw text:

| File | Used in |
|---|---|
| `demo-assets/states-per-module.csv` | the bar chart |
| `demo-assets/state-growth-by-depth.csv` | the line chart |
| `demo-assets/run-notes.txt` | the board |
| `demo-assets/chatgpt-priming-message.txt` | paste BEFORE recording |

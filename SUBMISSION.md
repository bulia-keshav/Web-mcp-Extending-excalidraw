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

## VIDEO SCRIPT — one story, voice-driven, target 2:55

**The story:** I'm model-checking four modules of a bus protocol. One blows up.
I find it, look at its state machine, build the abstraction that will tame it,
and write the whole run up. Every beat uses what the last one produced.

**Rhythm per beat** — you speak the prompt, then talk over the tool calls while
they land. Never talk over your own prompt.

> **[SPEAK]** the prompt → **[NARRATE]** while it works → next beat

Keep the tool-call section expanded so every call is visible.

**Before recording:**
- Paste `demo-assets/chatgpt-priming-message.txt` as your first message and wait
  for "ready". Then start recording.
- Hand-draw five rough boxes, unaligned and messy: `Idle`, `Request`, `Grant`,
  `Busy`, `Release`. They have to look like yours.
- Have both CSVs and `run-notes.txt` open or in your clipboard manager.

---

### 0:00 – 0:24 · Open — what this is, and what I added

*On screen: your five messy hand-drawn boxes.*

> "Excalidraw is a great drawing board. But that's all it is — it has no idea
> what a chart is, or a state machine, or a report.
> So I built twenty-five WebMCP tools on top of it.
> Low-level ones: draw a box, bind an arrow to it, restyle it, duplicate it.
> And high-level ones that build a whole thing in a single call — charts,
> tables, timelines, hierarchies, relationship graphs, and multi-panel boards.
> Let's see what that does for an engineering student like me."

---

### 0:24 – 0:50 · The simple chart

**[SPEAK]** *(paste CSV 1)*
> "Here's my data — peak states explored per module. Can you make this a bar chart, and flag the outlier?"

**[NARRATE while draw_chart and annotate land]**
> "That's draw_chart. And notice I never told it where to put anything — it sent
> four labels and four numbers. The page worked out how tall each bar is, where
> the gridlines go, and that two point four million should read as 2.5M.
> Scheduler. Fifty times every other module. That's a state explosion."

---

### 0:50 – 1:12 · The harder chart, and these are real objects

**[SPEAK]** *(paste CSV 2)*
> "Now plot how the state count grew with search depth — one line per module — and put it beside the first chart."

**[NARRATE]**
> "Same tool, line mode, three series with a legend. And there's the curve:
> flat for two modules, exponential for Scheduler."

**[SPEAK]**
> "Increase the width of the Scheduler bar and make it red."

**[NARRATE]**
> "These aren't flat images. They're real Excalidraw shapes I can grab and edit
> myself. And every tool tags what it draws with an id — every bar, every point,
> every state — so it can come back and change the exact one I mean."

---

### 1:12 – 1:50 · My sketch becomes the state machine  ← the beat that matters

**Do this on camera:** rubber-band select your five hand-drawn boxes. Pause so
it's obvious *you* did it.

**[SPEAK]**
> "These are the states I sketched for Scheduler. Turn them into a proper state machine, left to right, with the transitions labelled — and add a 'Timeout?' branch after Busy that goes back to Request."

**[NARRATE while it works]**
> "Notice I never said which boxes. I just selected them with my cursor, and it
> called get_selection and read my selection straight out of the app's state.
> That's the whole idea — me and the agent working on the same thing, looking at
> the same thing."

**Now drag one state across the canvas.**

> "And the transitions follow it. Real bindings, not lines drawn at coordinates."

---

### 1:50 – 2:16 · The abstraction — my design, its hands

**[SPEAK]**
> "Duplicate the selected diagram below it, and add two more states vertically below Busy — 'Backoff' and 'Merged retry' — and colour them green."

**[NARRATE]**
> "duplicate_elements brings the labels and transitions across, mints fresh ids,
> and re-binds the arrows to the copy, so the two are independent.
> And I'm not asking it to design the abstraction. I decided what merges and
> what doesn't — that's the part that needs a person. It's doing the drawing I'd
> otherwise be doing by hand. This is my canvas, and the agent is a tool on it,
> not the architect of it."

---

### 2:16 – 2:38 · Notes become a board

**[SPEAK]** *(paste the run notes)*
> "Here are my notes from the run. Map them onto the canvas as a board."

**[NARRATE]**
> "draw_board is the one that composes the others — it splits the notes into
> panels and draws each one with the right tool underneath: a timeline for the
> runs, a flow for the model, a table for the results."

---

### 2:38 – 2:55 · Safety, and how it's built

**Click the Agent button, top-right.**

> "Every call it made is logged here, each with its own undo button — and undo
> reverses only the agent's work, never mine. Writes are append-only, so it
> can't overwrite something I'm halfway through drawing.
> Twenty-five tools on document.modelContext.registerTool, in the top-level
> page. The agent brings the drawing. The judgement stays mine.
> Open source — link's below."

---

### If you run long
Cut in this order — least load-bearing first:
1. "a timeline for the runs, a flow for the model, a table for the results" (−6s)
2. The state-drag at the end of the state-machine beat (−6s)
3. The "append-only" line in the close (−5s)

**Never cut** the get_selection beat at 1:12, or the "my canvas, not the
architect" line at 1:50. Those two are the argument.

### Filming notes
- One continuous take if you can. Cuts cost more time than they save.
- Confirm the Agent badge is **green** before you start.
- If Vercel shows a "Security Checkpoint", turn off Attack Challenge Mode in
  Vercel → Project → Firewall first.
- No background music — the rules forbid copyrighted audio.
- Your face does not need to be on screen. Screen recording plus voice is fine.

## Paste-ready assets

All three live in `demo-assets/` as real files, so you can open them on camera
rather than pasting raw text:

| File | Used in |
|---|---|
| `demo-assets/states-per-module.csv` | the bar chart |
| `demo-assets/state-growth-by-depth.csv` | the line chart |
| `demo-assets/run-notes.txt` | the board |
| `demo-assets/chatgpt-priming-message.txt` | paste BEFORE recording |

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

**The story:** I'm model-checking four modules of a bus protocol. One of them
blows up. I find it, look at its state machine, build the abstraction that will
tame it, and write the whole thing up. Every beat uses what the last produced.

**Why voice changes the structure:** you speak the prompts with ChatGPT's mic,
so the prompt itself costs airtime. The narration below fills the gap *while the
agent is working* — never over your own prompt. Rhythm per beat:

> **[SPEAK]** the prompt → **[NARRATE]** over the tool calls landing → next beat

Keep the tool-call section expanded so every call is visible.

**Before recording:** hand-draw five rough boxes, unaligned and messy —
`Idle`, `Request`, `Grant`, `Busy`, `Release`. They must look like yours.
Have both CSVs and the report notes in your clipboard manager.

---

### 0:00 – 0:13 · Open

*On screen: your five messy hand-drawn boxes.*

> "Most AI drawing tools hand you a finished picture and step back.
> This one doesn't step back — it works on my canvas, while I'm on it.
> I'm model-checking a bus protocol. One module is blowing up. Let me find it."

---

### 0:13 – 0:40 · The simple chart

**[SPEAK]** *(paste CSV 1 first)*
> "Peak states explored per module. Bar chart it and flag the outlier."

**[NARRATE while draw_chart and annotate land]**
> "draw_chart. Labels and numbers, no coordinates — the page picks the axes and
> the scale, and formats two point four million as 2.5M on the axis.
> Scheduler. Fifty times every other module. That's a state explosion."

---

### 0:40 – 1:00 · The harder chart, and it's still editable

**[SPEAK]** *(paste CSV 2)*
> "Now plot how the state count grew with search depth, one line per module, and put it beside the bar chart."

**[NARRATE]**
> "Same tool, line mode, three series with a legend. And there's the curve —
> flat for two modules, exponential for Scheduler."

**[SPEAK]**
> "Make the Scheduler bar wider and turn it red."

> "It handed back an id for every bar and every point, so it can reach the exact
> one I mean. That chart is still an object on my canvas — not a picture of one."

---

### 1:00 – 1:40 · My sketch becomes the state machine  ← the beat that matters

**Do this on camera:** rubber-band select your five hand-drawn boxes. Pause so
it's obvious *you* did it.

**[SPEAK]**
> "These are the states I sketched for Scheduler. Turn them into a proper state machine, left to right, with the transitions labelled — and add a 'Timeout?' branch after Busy that goes back to Request."

**[NARRATE while it works]**
> "Watch the first call — get_selection. I picked those boxes with my mouse and
> it read my selection straight out of the app's state. I never told it which
> boxes I meant. That's the whole idea: we're looking at the same thing."

**Now drag one state across the canvas.**

> "And the transitions follow. Real bindings, not lines drawn at coordinates."

---

### 1:40 – 2:12 · The abstraction — my design, its hands

**[SPEAK]**
> "Duplicate that state machine below it."

**[NARRATE]**
> "duplicate_elements — labels, transitions, fresh ids, and the arrows re-bound
> to the copy, so the two are independent."

**[SPEAK]**
> "In the copy, add two more states vertically below Busy — 'Backoff' and 'Merged retry' — and colour them green."

**[NARRATE — this is the line that matters]**
> "I'm not asking it to design the abstraction. I've decided what merges and
> what doesn't — that's the part that needs a person. It's doing the drawing I'd
> otherwise be doing by hand. This is my canvas, and the agent is a tool on it,
> not the architect of it."

---

### 2:12 – 2:36 · Writing it up

**[SPEAK]** *(paste the report notes)*
> "Here are my notes from the run. Map them onto the canvas as a board."

**[NARRATE]**
> "One call to draw_board — the run timeline, the state machine, the results
> table, each panel drawn by its own tool. And every tool caps at forty nodes:
> ask for one giant diagram of a whole document and it refuses, and tells the
> agent to split it into panels. That's what keeps it readable."

---

### 2:36 – 2:55 · Safety, and how it's built

**Click the Agent button, top-right.**

> "Every call it made is listed here, each with its own undo button — and it
> reverses only the agent's work, never mine. Writes are append-only, so it
> can't overwrite something I'm halfway through drawing.
> Twenty-five tools, registered with document.modelContext.registerTool in the
> top-level page. Each is one zod schema that both validates the input and
> generates the schema ChatGPT sees, so the two can't drift apart.
> The agent brings the drawing. The judgement stays mine. Open source, link's
> below."

---

### If you run long
Cut in this order — least load-bearing first:
1. The node-cap sentence in the board beat (−8s)
2. The state-drag at the end of the state-machine beat (−6s)
3. The "append-only" line in the close (−5s)

**Never cut** the get_selection beat at 1:00, or the "my canvas, not the
architect" line at 1:40. Those two are the argument.

### Filming notes
- One continuous take if you can. Cuts cost more time than they save.
- Confirm the Agent badge is **green** before you start.
- If Vercel shows a "Security Checkpoint", turn off Attack Challenge Mode in
  Vercel → Project → Firewall first.
- No background music — the rules forbid copyrighted audio.
- Your face does not need to be on screen. Screen recording plus voice is fine.

## Paste-ready assets

**CSV 1 — the bar chart.** One module is ~50x the others, and 2,411,930 lands
on a 2.5M axis so the bar fills the plot:

```
Module,States
Arbiter,12480
Cache,48120
Bus,31004
Scheduler,2411930
```

**CSV 2 — the line chart.** Three series, and Scheduler's curve goes exponential
while the others stay flat. This is what state explosion looks like:

```
Depth,Arbiter,Cache,Scheduler
2,120,300,900
4,460,1400,8200
6,1100,5200,61000
8,3200,14000,340000
10,7400,31000,1120000
12,12480,48120,2411930
```

**Report notes for the board beat** — written so the agent has a timeline, a
state machine and a results table to split across panels:

```
Verification run, bus protocol, week 3.

Runs. Arbiter and Cache were checked on 18 August and both completed in under
a minute. Bus completed on 19 August. Scheduler was started on 19 August, hit
the memory ceiling after eleven hours, and was killed on 20 August at depth 12.

Model. Scheduler cycles Idle, Request, Grant, Busy, Release. On timeout it
returns to Request and retries, and each retry carries its own counter, so the
retry counters multiply out across the state space.

Results. Peak states explored: Arbiter 12,480, Cache 48,120, Bus 31,004,
Scheduler 2,411,930. All safety properties held on the three modules that
completed. Scheduler is inconclusive.

Next. Merge the retry states behind a single backoff state so the counters
collapse, then re-run Scheduler at depth 12 and check the safety properties.
```

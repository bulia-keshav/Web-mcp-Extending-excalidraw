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

## VIDEO SCRIPT — one story, voice-driven, target 2:50

**The story:** I sampled four points on the water network for lead. One is over
the limit. I find it, diagram the sampling protocol, plan the re-test, and write
it up. Every beat uses what the last one produced.

**Why voice changes the structure:** you speak the prompts with ChatGPT's mic,
so the prompt itself costs airtime. The narration below fills the gap *while the
agent is working* — never over your own prompt. Rhythm per beat:

> **[SPEAK]** the prompt → **[NARRATE]** over the tool calls landing → next beat

Keep the tool-call section expanded so every call is visible.

**Before recording:** hand-draw four rough boxes on the canvas, unaligned and
messy — `Collect`, `Filter`, `Digest`, `Measure`. They have to look like yours.
Have the CSV and the lab notes in your clipboard manager.

---

### 0:00 – 0:13 · Open

*On screen: your four messy hand-drawn boxes.*

> "Most AI drawing tools hand you a finished picture and step back.
> This one doesn't step back — it works on my canvas, while I'm on it.
> I tested four points on the water network for lead. Let me find the problem."

---

### 0:13 – 0:42 · The numbers

**[SPEAK]** *(paste the CSV first)*
> "Here's lead in micrograms per litre at four sampling points. The safe limit is ten. Bar chart it and flag anything over."

**[NARRATE while draw_chart and annotate land]**
> "draw_chart. I give it labels and numbers — no coordinates. The page works out
> the axes and the scale. Then annotate, pointing at the one that matters.
> Zone 7. Thirty-four, against a limit of ten."

---

### 0:42 – 1:02 · A chart I can still edit

**[SPEAK]**
> "That's the one I care about. Make that bar wider, and turn it red."

**[NARRATE]**
> "This is what an AI-generated image can't do. The chart tool gave back an id
> for every bar, so it can reach into the exact one I mean. It's still an object
> on my canvas — not a picture of a chart."

---

### 1:02 – 1:42 · My sketch becomes the real protocol  ← the beat that matters

**Do this on camera:** rubber-band select your four hand-drawn boxes. Pause so
it's obvious *you* did it.

**[SPEAK]**
> "These are my sampling steps. Turn them into a proper left-to-right protocol with arrows, and add an 'Over limit?' check after Measure that loops back to Collect for a re-sample."

**[NARRATE while it works]**
> "Watch the first call — get_selection. I picked those boxes with my mouse, and
> it read my selection straight out of the app's state. I never told it which
> boxes I meant. That's the whole idea: we're looking at the same thing."

**Now drag one box across the canvas.**

> "And the arrows follow. Real bindings, not lines drawn at coordinates."

---

### 1:42 – 2:08 · Planning the re-test

**[SPEAK]**
> "Duplicate that protocol underneath. The copy is the re-sampling run for Zone 7 — add a field blank and a duplicate sample. Colour the new steps green."

**[NARRATE]**
> "duplicate_elements. It brings the labels and the arrows across, mints fresh
> ids, and re-binds the arrows to the copy — so the two are independent. Now
> I've got the standard protocol and the re-test protocol side by side, and I
> can change one without touching the other."

*Fallback: if it only duplicates and stops, follow up with "now add a field
blank and a duplicate sample step to the copy, and colour them green."
Much cheaper than a re-take.*

---

### 2:08 – 2:32 · Writing it up

**[SPEAK]** *(paste the lab notes)*
> "Here are my notes from the run. Map them onto the canvas as a board."

**[NARRATE]**
> "One call to draw_board — the sampling timeline, the protocol, the results
> table, each panel drawn by its own tool. And every tool caps at forty nodes:
> ask for one giant diagram of a whole document and it refuses, and tells the
> agent to split it into panels instead. That's what keeps it readable."

---

### 2:32 – 2:50 · Safety, and how it's built

**Click the Agent button, top-right.**

> "Every call it made is listed here, each with its own undo button — and it
> reverses only the agent's work, never mine. Writes are append-only, so it
> can't overwrite something I'm halfway through drawing.
> Twenty-five tools, registered with document.modelContext.registerTool in the
> top-level page. Each is one zod schema that both validates the input and
> generates the schema ChatGPT sees, so the two can't drift apart.
> The agent brings the judgement. The page keeps the geometry. Open source,
> link's below."

---

### If you run long
Cut in this order — least load-bearing first:
1. The node-cap sentence in the board beat (−8s)
2. The box-drag at the end of the protocol beat (−6s)
3. The "append-only" line in the close (−5s)

**Never cut** the get_selection beat at 1:02. It is the entire argument for why
this is a WebMCP project and not a chatbot with a render button.

### Filming notes
- One continuous take if you can. Cuts cost more time than they save.
- Confirm the Agent badge is **green** before you start.
- If Vercel shows a "Security Checkpoint", turn off Attack Challenge Mode in
  Vercel → Project → Firewall first.
- No background music — the rules forbid copyrighted audio.
- Your face does not need to be on screen. Screen recording plus voice is fine.

## Paste-ready assets

**CSV for the chart demo** — one site is far over the limit, so "make that bar
wider and red" is unmistakable, and red actually means *danger* rather than just
*highlighted*:

```
Site,Lead
Intake,3
Reservoir,4
Zone 3,7
Zone 7,34
```

Safe limit is 10 ug/L, so Zone 7 is over three times it.

**Lab notes for the board beat** — written so the agent has a timeline, a
protocol and a results table to split across panels:

```
Lead sampling, network survey, week 3.

Sampling. Intake and Reservoir were sampled on 18 August, Zone 3 and Zone 7 on
19 August. All samples were filtered on site and acid-preserved. Digestion was
done on 20 August, ICP-MS measurement on 21 August.

Protocol. Collect 500 mL at the tap after a two-minute flush, filter to 0.45
micron, acid digest, then measure by ICP-MS. Anything over the 10 ug/L limit is
re-sampled with a field blank before it is reported.

Results. Lead in ug/L: Intake 3, Reservoir 4, Zone 3 gave 7, Zone 7 gave 34.
Zone 7 is over three times the limit. Zone 3 is within limit but has risen from
4 in the previous survey.

Next. Re-sample Zone 7 with a field blank and a duplicate, and pull the pipe
material records for that zone before reporting.
```

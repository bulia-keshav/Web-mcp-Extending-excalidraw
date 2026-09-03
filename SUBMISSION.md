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

**The story:** I annealed four samples at four temperatures and measured
hardness. Which one won, why, and what do I run next week. Every beat uses what
the last one produced.

**Why voice changes the structure:** you speak the prompts with ChatGPT's mic,
so the prompt itself costs airtime. The narration below fills the gap *while the
agent is working* — never over your own prompt. Rhythm per beat:

> **[SPEAK]** the prompt → **[NARRATE]** over the tool calls landing → next beat

Keep the tool-call section expanded so every call is visible.

**Before recording:** hand-draw four rough boxes on the canvas, unaligned and
messy — `Weigh`, `Mix`, `Anneal`, `Test`. They have to look like yours. Have the
CSV and the lab notes in your clipboard manager.

---

### 0:00 – 0:13 · Open

*On screen: your four messy hand-drawn boxes.*

> "Most AI drawing tools hand you a finished picture and step back.
> This one doesn't step back — it works on my canvas, while I'm on it.
> I annealed four samples last week. Let me work out which one won."

---

### 0:13 – 0:42 · The numbers

**[SPEAK]** *(paste the CSV first)*
> "Here's hardness for my four samples. Bar chart it, and call out the best one."

**[NARRATE while draw_chart and annotate land]**
> "draw_chart. I give it labels and numbers — no coordinates. The page works out
> the axes and the scale. Then annotate, pointing at the winner.
> Six hundred degrees. That's the one."

---

### 0:42 – 1:02 · A chart I can still edit

**[SPEAK]**
> "That's the one I care about. Make that bar wider, and turn it green."

**[NARRATE]**
> "This is what an AI-generated image can't do. The chart tool gave back an id
> for every bar, so it can reach into the exact one I mean. It's still an object
> on my canvas — not a picture of a chart."

---

### 1:02 – 1:42 · My sketch becomes the real protocol  ← the beat that matters

**Do this on camera:** rubber-band select your four hand-drawn boxes. Pause so
it's obvious *you* did it.

**[SPEAK]**
> "These are my protocol steps. Turn them into a proper left-to-right flow with arrows, and add a 'Cracked?' check after Anneal."

**[NARRATE while it works]**
> "Watch the first call — get_selection. I picked those boxes with my mouse, and
> it read my selection straight out of the app's state. I never told it which
> boxes I meant. That's the whole idea: we're looking at the same thing."

**Now drag one box across the canvas.**

> "And the arrows follow. Real bindings, not lines drawn at coordinates."

---

### 1:42 – 2:08 · Planning next week's run

**[SPEAK]**
> "Duplicate that protocol underneath. The copy is next week's run — six hundred degrees with a slow cool. Colour the changed steps green."

**[NARRATE]**
> "duplicate_elements. It brings the labels and the arrows across, mints fresh
> ids, and re-binds the arrows to the copy — so the two are independent. Now
> I've got this week's protocol and next week's side by side, and I can change
> one without touching the other."

*Fallback: if it only duplicates and stops, follow up with "now change the
Anneal step in the copy to 600 degrees, slow cool, and colour it green."
Much cheaper than a re-take.*

---

### 2:08 – 2:32 · Writing it up

**[SPEAK]** *(paste the lab notes)*
> "Here are my lab notes. Map them onto the canvas as a board."

**[NARRATE]**
> "One call to draw_board — the run timeline, the protocol, the results table,
> each panel drawn by its own tool. And every tool caps at forty nodes: ask for
> one giant diagram of a whole document and it refuses, and tells the agent to
> split it into panels instead. That's what keeps it readable."

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

**CSV for the chart demo** — one sample clearly peaks, so "make that bar wider
and green" is visually unmistakable:

```
Sample,Hardness
A-400C,210
B-500C,265
C-600C,340
D-700C,190
```

**Lab notes for the board beat** — written so the agent has a timeline, a
protocol and a results table to split across panels:

```
Annealing study, week 3.

Runs. Samples were weighed and mixed on 18 August. A-400 and B-500 were
annealed on 19 August, C-600 and D-700 on 20 August. Hardness testing was
done on 21 August, after all samples had cooled overnight.

Procedure. Weigh, mix, anneal for two hours at the target temperature, air
cool, then check for surface cracking before testing. Cracked samples are
remixed and re-run.

Results. Hardness in HV: A-400 gave 210, B-500 gave 265, C-600 gave 340,
D-700 gave 190. D-700 showed visible cracking on two of three samples.

Next. Repeat C-600 with a slow furnace cool instead of air cooling, to see
whether hardness holds without the cracking seen at 700.
```

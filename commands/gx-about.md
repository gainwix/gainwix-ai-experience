---
name: gx-about
description: Product discovery — interview whoever owns the product (a founder, business owner, or developer) to fill in ABOUT.md (the product source-of-truth), verify it, then seed ACTION-ITEMS.md with a prioritized feature list generated from it. Run after /gx-init, before the dev-workflow commands. Planning and docs only — building and deploying come later.
disable-model-invocation: true
---

# /gx-about — fill in ABOUT.md, then seed ACTION-ITEMS.md from it

`/gx-about` is the bridge between `/gx-init` (which scaffolds the **empty**
templates) and the dev-workflow commands (`/gx-next` → `/gx-go`). It does two
things, each followed by a human verification gate:

1. **Interview you** to fill in `ABOUT.md` — the single source of truth for what
   your product is and why it exists.
2. **Seed `ACTION-ITEMS.md`** — turn that approved `ABOUT.md` into a prioritized,
   dependency-ordered list of raw feature ideas the rest of the workflow chomps
   through.

Run it **in this conversation** — do NOT dispatch it as a background subagent (a
subagent can't interview you). It writes **only** `ABOUT.md` and `ACTION-ITEMS.md`:
pure discovery and planning that gets you ready to build and ship. Building is
`/gx-next`/`/gx-go`; deploying is `/gx-gcp-deploy`.

**Present every discrete choice as an interactive question using the
`AskUserQuestion` tool** (recommended option first/default) — never a "reply with
a number" list. For open-ended product narrative (the abstract, the "why"), ask
in plain prose and let me answer freely; reserve `AskUserQuestion` for genuine
multiple-choice decisions and the verification gates.

**On every technical choice — the tech stack, architecture, datastore, hosting,
tenancy — LEAD WITH A RECOMMENDATION; don't make me pick cold.** Most people
running `/gx-about` are describing a product, not choosing frameworks, and won't
know the options. So propose a sensible default (an `AskUserQuestion` with your
recommended option **first and pre-selected**, in one plain line with the
trade-off) and **also ask whether I have anything in mind** — give me an "I have a
preference" / "you choose" path. Invite my input, but never block on it: a good
default I can override beats a question I can't answer.

## Step 0 — Pre-flight

- **Require the scaffold.** Read `ABOUT.md` and `ACTION-ITEMS.md` at the repo
  root. If either is missing, STOP and tell me to run `/gx-init` first — it
  scaffolds them; `/gx-about` fills them in, it doesn't create them.
- **Detect prior state (never clobber silently):**
  - If `ABOUT.md` is still the **untouched template** (it still contains
    `<placeholder>` text and the scaffold guidance blockquote), go fill it in
    (Step 2).
  - If `ABOUT.md` is **already filled in** (no placeholders left), ask via
    `AskUserQuestion` whether to **Refine** it (re-interview, using the current
    content as the starting point) or **Skip to seeding** (jump to Step 4).
  - If `ACTION-ITEMS.md` **already has `- ` items** below the
    `<!-- Add action items below this line -->` marker, ask whether to **Append**
    the generated features after them or **Replace** them — default **Append**;
    never silently discard items I already wrote.

## Step 1 — Inspect the repo (so the interview is specific, not generic)

Read the codebase to infer what you can **before** asking — language, frameworks,
the apps/services that make up the product, datastore, how it's packaged, the
top-level domain models, and any obvious roles/auth. Code reveals the **how**;
you'll ask me the **why**. Draft as much of `ABOUT.md` as the repo justifies, then
ask me only for the gaps and for confirmation. Ground your questions in what you
found, but phrase them in plain product terms (what the app seems to do, the main
"things" it manages) — I may be non-technical (a founder or business owner), so
don't assume I can read code or know framework jargon.

If the repo is **empty or just scaffolding** (no real product yet — common when
the idea is new and there's nothing to inspect), don't ask me to supply a stack:
**propose one** that fits what I'm describing and runs cheaply on Cloud Run, and
let me accept it or name my own.

## Step 2 — Interview, section by section

Walk the `ABOUT.md` template
(`${CLAUDE_PLUGIN_ROOT}/templates/scaffold/ABOUT.md`) top to bottom. For each
section, **draft from your Step 1 inspection first**, then ask me to confirm or
correct. Cover:

- **Abstract** — what the product is + the single outcome it delivers (open prose).
- **Background** — the problem, who has it, why the status quo is broken, the gaps
  it fills (open prose — this is the "why" only I can give you).
- **Business Context** — top-level entities, tenancy/structure, categorization,
  and any status **lifecycles** (e.g. `DRAFT → REVIEW → PUBLISHED`). For a discrete
  technical choice (e.g. single- vs multi-tenant), explain the options in plain
  terms and **recommend a default** via `AskUserQuestion` — don't assume I know
  the term.
- **Roles** — who uses it and what each does (fill the roles table).
- **Components** — the cooperating pieces (web app / backend / API / client …).
  Draft these from the repo; if it's greenfield, **suggest a minimal architecture**
  and ask me to confirm — don't ask me to design it.
- **Deployment** — how each component is packaged + where it runs. **Recommend a
  default** (Cloud Run fits most things) and ask if I have a preference, rather
  than asking me to specify it.
- **Explanation of Work** — the per-role, end-to-end workflows.

**Batch your questions** (4 at a time max — don't death-by-a-thousand-prompts).
Where the repo already answers something, state your draft and ask me only to
confirm/adjust rather than asking from scratch.

## Step 3 — Write ABOUT.md, then 🚦 GATE 1 (verify)

- Write the filled-in `ABOUT.md`: replace **every** `<placeholder>`, fill every
  table and section, and **remove the scaffold guidance blockquote and the
  `<!-- … -->` guidance notes**. Keep the section structure intact, and keep the
  closing **"Prompt — Generate Features From This Document"** section (Step 4 runs
  it, and it documents how to re-seed later).
- **Show me the result and get explicit approval** via `AskUserQuestion`
  (**Approve** / **Revise**). If I pick Revise, capture exactly what to change,
  rewrite `ABOUT.md`, and ask again. **Do not proceed to seeding until I approve.**

## Step 4 — Seed ACTION-ITEMS.md from the approved ABOUT.md

Run `ABOUT.md`'s own **"Prompt — Generate Features From This Document"** section
against the approved document to derive a **comprehensive, prioritized feature
set**: for each role and workflow, the concrete capabilities needed end-to-end,
covering every lifecycle stage, every component, and the cross-cutting concerns
(auth, roles/permissions, the core entities + relationships, notifications,
delivery, progress/state tracking, analytics, administration).

Then **distill** that into `ACTION-ITEMS.md` as **raw `- ` items below the
`<!-- Add action items below this line -->` marker** (Append or Replace per
Step 0). This is the important part:

- `ACTION-ITEMS.md` is the **raw inbox**, not the planned queue. Write each item
  as a **concise one-line idea** (a title + a short phrase) — **not** the full
  user-story / acceptance-criteria detail. `/gx-next` expands each into a detailed
  `BACKLOG.md` task later; the rich feature spec is the *source material* you
  reason from, not what you paste in here.
- **One self-contained, one-PR-sized idea per `- ` line.**
- **Order by dependency, foundational first** — auth, core entities/roles, the
  central data model before the workflows that build on them — so a single
  `/gx-sing` / `/gx-ping` run can chomp the list top-to-bottom.
- **Never** touch the marker line or anything above it.

## Step 5 — 🚦 GATE 2 (verify) + report

- **Show me the seeded `ACTION-ITEMS.md`** and get approval via `AskUserQuestion`
  (**Approve** / **Revise** — e.g. reorder, add, drop, split an item). Loop until
  I approve.
- Report what you wrote: which `ABOUT.md` sections you filled and how many action
  items you seeded. Note that **both files are written but NOT committed** —
  they're mine to review and commit.

## Step 6 — Hand off to the dev workflow

Close with the next steps, plain-spoken:

- **Plan + ship one item:** `/gx-next` (plan the top idea into `BACKLOG.md`) →
  `/gx-go` (execute it end-to-end).
- **Automate the whole queue:** `/gx-sing` (serial) or `/gx-ping` (parallel).
- **Prefer GitHub-tracked intake?** Capture ideas as issues with `/gx-issue-add`
  and pull them in with `/gx-issue-pick`, alongside (or instead of) the seeded list.
- **When you're ready to ship to the cloud:** `/gx-sim` then `/gx-gcp-deploy`.

## Notes

- **Scope: discovery only.** `/gx-about` writes `ABOUT.md` + `ACTION-ITEMS.md` and
  nothing else. These are doc/queue edits, not a code change, so there's no PR and
  no `changes/*.md` record (see `/gx-go`'s queue-edit exception); building and
  deploying come later.
- **`ABOUT.md` is yours to own.** It's the product source-of-truth on purpose; this
  command just makes filling it fast and turns it into a backlog. Re-run
  `/gx-about` anytime to refine the doc and re-seed.
- **Re-run-safe.** Re-running offers Refine/Skip for `ABOUT.md` and Append/Replace
  for `ACTION-ITEMS.md`, so a second run never silently overwrites your work.

Keep it plain-spoken and jargon-free. I'm whoever owns this product — a founder, a
business owner, or a developer — describing it in plain language, not writing a
technical spec; don't assume I can read code.

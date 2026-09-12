---
description: Sequential driver — take the ONE wave that can start now and work its items one at a time, each merged before the next begins, then stop. The next wave waits for this one to have merged.
disable-model-invocation: true
---

> ⛔ **Paths changed on 12 Sept.** The queue no longer lives in the repo root.
> **Read `${CLAUDE_PLUGIN_ROOT}/docs/where-things-live.md` before acting on any
> file named below** — `BACKLOG.md` is now `.gainwix/<component>/backlog.html`,
> `CHANGELOG.md` and `changes/` are per component, and every read or write goes
> through `node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs`.

# /gx-sing — one wave, worked one item at a time

`/gx-sing` ("**S**equential **I**nteractive **N**ext and **G**o") chains the
inverted `/gx-next` and the `/gx-go` workflow: it plans from the inbox, then
works the wave that can start now, item by item, each one merged before the next
begins. It asks for **no confirmation between stages** — `.gainwix/autonomy.md`
is binding for the run.

## ⛔ The contract — one wave per execution

> *"run only one wave per execution but that one wave will kickoff parallel
> execution paths"*

`/gx-sing` is the serial half of that rule: **the same one wave as `/gx-ping`,
worked one at a time instead of together.**

**The wave behind this one depends on this one having MERGED.** Running on into
it means building on a foundation that is still being written. ⛔ **Being picked
up is not being done.**

⛔ **So `/gx-sing` does not loop until the queues are empty.** It finishes its
wave and **stops**, however much is left. Run it again for the next one.

⚠ **This replaced a loop that ran until both queues were empty.** That behaviour
was wrong, and the paragraph above is why.

**Pipeline reminder:** `.gainwix/<component>/inbox.md` (raw ideas, below the
`<!-- Add action items below this line -->` marker) → **`/gx-next`** (plan a raw
item into `.gainwix/<component>/backlog.html`) → **`/gx-go`** (build one item →
PR → `.gainwix/<component>/changes/<ts>-change.md` → linked in `.gainwix/<component>/CHANGELOG.md`).

## The execution

There is one. It is not called an iteration, because nothing repeats.

### 0 · Bind the component, and check nothing is stranded

```bash
GX="node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs"
$GX components
```

⛔ **Do this before anything else.** One component and it is chosen for you.
⚠ **With more than one, `components` just lists them and exits 0** — the refusal
comes on the *next* `$GX` call, which is one command later than you might expect.
So **read the list**: if it holds more than one name, ask which, then
`$GX use --component <name>`. Every later `$GX` call and `/gx-next` resolve the
component independently, so an unbound choice means planning into one component
and building from another.

```bash
$GX show --stage in-progress
```

⚠ **Anything already sitting in `in-progress` is a stranded item from a crashed
run** — a second driver against the same trunk is forbidden, so there is no other
explanation. It blocks everything behind it and **nothing else will say so.**
⛔ **STOP and say so.** Do not plan, do not read the wave, do not start on top of
it: a stranded item is excluded from what `ready` treats as open **while still
blocking its dependents**, so the wave you would take is computed as if it did not
exist. The operator finishes it or returns it with
`$GX move --id <SERIAL> --to backlog`, then runs `/gx-sing` again.

### 1 · Plan — top up the backlog from the inbox

For each raw `- ` item below the `<!-- Add action items below this line -->`
marker in `.gainwix/<component>/inbox.md`, top-down and **up to 5 this run**, run
the `/gx-next` planning (`${CLAUDE_PLUGIN_ROOT}/commands/gx-next.md`) — **the
whole of it, unmodified, including its own commit and push.** ⚠ **Do not batch
those into one commit:** `/gx-next` commits per invocation, and overriding that
here leaves it unsaid which of its other steps still apply.

⭐ **Planning ships no code**, which is why it is not bounded by the wave — but a
newly planned item with no dependencies lands in **wave 0** and is built in this
same run, because the wave is read after this step, never before.

⚠ **Planning can DISPLACE the wave that was ready, and you should say so when it
does.** `ready` returns the **lowest wave number** among the items that can
start. A newly planned item with no dependencies is **wave 0** — so on a backlog
that has already worked past wave 0, planning one inbox idea makes wave 0 the
lowest again, and that idea is the whole run. **Priority does not save you:** a
P2 typed into the inbox this morning outranks a P0 that was ready, because
priority only orders items *within* a wave.

⭐ **It is not unsafe** — both were startable, so neither waits on the other — and
the closing report's `next` line names what got pushed back. But if this run's
wave is a brand-new item and something older was ready, **say that out loud in
the report.** ⚠ To avoid it entirely, run the drivers with an empty inbox and
plan separately with `/gx-next`.

### 2 · ⭐ Read the wave — once, here, after planning

```bash
$GX ready
```

```json
{ "wave": 0, "count": 3, "items": [ … ], "next": { "wave": 1, "count": 5 } }
```

**Hold `items` for the whole run.** Once an item moves to `in-progress` it counts
as *taken*, so a second `$GX ready` mid-run describes a different state and not
this wave — **the captured list is not re-derivable after you start it.** `next` is the wave standing behind this
one; say both out loud now, so the size of the run is known before it begins.

If `count` is `0`: say what is in progress and what it is holding up, and
**STOP** — nothing can legally start.

### 3 · Work the wave, one item at a time

For each item in the captured list, in the order the tool gave them (priority,
then serial):

```bash
$GX move --id <SERIAL> --to in-progress [--issue <issue-url>]
```

⚠ **`--issue` is optional and usually absent.** Pass it only when the item
already tracks an issue; `/gx-go` does not open one until after its tests are
green, so at pick-up there is normally no URL.

Then follow the `/gx-go` workflow (`${CLAUDE_PLUGIN_ROOT}/commands/gx-go.md`) in
**driven mode** on that item — worktree → build → test → commit → push → issue →
PR — writing `.gainwix/<component>/changes/<ts>-change.md` as it goes.

⭐ **Run it inline, in this session** — read the file and follow it yourself.
There is one item in flight, so there is nothing to parallelise and no reason to
delegate. `${CLAUDE_PLUGIN_ROOT}` expands normally here, which is the whole
awkwardness `/gx-ping` has to work around.

⚠ **If you do delegate it to a subagent, `/gx-ping`'s rules apply in full:**
resolve the path and tell the team to READ the file (`/gx-go` is
`disable-model-invocation: true`), and pass the **resolved `$GX` command line**
and the **component name** — neither `${CLAUDE_PLUGIN_ROOT}` nor `COMPONENT`
survives into a prompt, and without them the records land in `.gainwix//changes`.

⛔ **Hand over the whole item, not its title.** `$GX ready` returns `detail`,
`spec`, `deps` and `lane` beside `id` and `title`. A title is a headline; the
detail is the brief. Work given only the headline builds whatever the headline
suggests, and reports success.

⛔ **Then YOU merge**, and only then: rebase on the latest `origin/develop`,
**remove the worktree**, then squash-merge with `--delete-branch`. ⚠ **That order
matters** — deleting a branch a worktree still holds fails, and the leftover
collides with a later run reaching for the same name. ⭐ **Driven mode never merges and never touches
`CHANGELOG.md`, in either driver** — one rule, so nothing has to work out which
driver it is under.

**Then, as the driver:**
⛔ **Get onto an updated `develop` first — the merge happened on the server.**

```bash
git -C <the main checkout> checkout develop && git -C <the main checkout> pull --ff-only
```

⚠ **Without this the finalize fails and the push is rejected.** The squash-merge
is server-side, so the change record you are about to edit **by path** is on
`origin/develop` and not in your tree; and `git push` from a stale `develop` is
non-fast-forward — which both this file and `/gx-go` classify as a **Hard STOP
that ends the run.** ⚠ `git checkout develop` also **errors outright while a
worktree holds that branch**, which is why the worktree goes first.

Now finalize the change record (issue/PR links, timing) and link it in
`.gainwix/<component>/CHANGELOG.md`. ⛔ **If the item tracks a kanban issue
`#<N>`, append `- [ ] #<the new issue>` under its `## Sub-issues (opened by
/gx-go)` heading** (create the heading if absent) — nobody else does, and
`/gx-qa` only advances the card once it can see every subordinate. **Commit and
push those writes**; nothing else commits them, and the next item branches off
`develop`.

**Require back from the run:** the branch name, its **worktree path**, the issue
URL and number, the PR URL, and the change-record path — the driver needs every
one of them to merge, tidy up and report.

```bash
$GX move --id <SERIAL> --to completed --pr-link <pr-url>
```

⛔ **The driver names the item; it does not let `/gx-go` choose.** `/gx-go`'s
backlog mode picks the first thing `$GX ready` offers, which is right when a
person runs it alone and **wrong inside a driver**: an item that failed and went
back to the backlog is offered again immediately, so the run would re-pick the
failure it just had.

⛔ **Finish each one before starting the next.** One item in flight at a time is
the whole difference between this and `/gx-ping`.

### 4 · STOP, and say what is next

Run `$GX ready` once more *after* the last move — that is the honest answer, and
it accounts for anything that came back. Print the report and end the run.

⛔ **Start nothing else.** Not the next wave, **and not an item from this wave
that came back after failing** — that one will be sitting in the closing
`$GX ready` at the same wave number, looking startable. It is not. It failed
minutes ago for a reason nobody has looked at yet. Retrying it is the next run's
job.

## Failure handling

**Two different failures, with different debris. Do not run one procedure for
both.**

- **It never went green** — the tests or the build failed, nothing was pushed, no
  issue and no PR exist. ⭐ **Save the change record before you touch the
  worktree**: `/gx-go` appends to `.gainwix/<component>/changes/<ts>-change.md` as it goes, and that
  partial file is the only account of what failed. Copy it out and commit it to
  `develop`, *then* remove the worktree.
- **It went green but would not merge** — rebase conflict, or the re-test failed
  on the rebased branch. A branch and a PR do exist: close or clearly park the
  PR, and delete the pushed branch. Leaving it costs the next run a name
  collision if `/gx-go` reaches for the same one.

Both then:

1. `$GX move --id <SERIAL> --to backlog`
2. Record the error **verbatim** in the report — plus which of the two failures
   it was.
3. **Continue with the rest of the wave.**

⛔ **The driver owns that move — `/gx-go` must not also make it.** `/gx-go`'s own
"if the run fails, put it back" step is for a person running `/gx-go` alone.

⚠ **The rule on `$GX` exit codes, because it is load-bearing:** a non-zero `$GX`
is a Hard STOP — **except `"already in <stage>"`, which is benign and must be
ignored.** That one only happens when two parties both made the same move, which
the ownership rule above is there to prevent.

⭐ **Continuing is a change, and the captured list is what makes it safe.** The
old loop stopped dead on the first failure because it re-read the *top* of a flat
list and would have hit the same item forever. The list is fixed up front now, so
that spin is impossible.

⚠ **What continuing does NOT protect you from.** A wave guarantees the items have
no declared dependency on each other. It guarantees nothing about **files or
assumptions**. If item 2 quietly assumed item 1's schema and item 1 just failed,
item 2 branches off a `develop` that does not have it, and nothing here catches
that. It shows up as a test failure, which is the best available outcome.

- **The whole wave fails — NOT ONE item merged:** stop and surface why, **and say
  so in the `Next:` line** (see the table). ⛔ Do not move on to the next wave to
  salvage the run. ⭐ It is the count of merges that decides this, not the size of
  the wave: a wave of one whose only item fails ends this way too.

- **Hard STOP** that cannot be auto-recovered (push rejected, GitHub outage,
  genuinely operator-owned dirty queue files): surface the error verbatim and
  stop the chain. Don't retry blindly.

### ⛔ The one that wedges the queue

An item that fails **goes back into its wave, and `$GX ready` will not spill past
that wave.** So **every later run picks it up, fails the same way, and merges
nothing** — and everything behind it never starts. In a six-item graph, one stuck
item can hold four.

⚠ **Priority has nothing to do with this.** `ready` returns the lowest *wave*
that can start; priority only orders items **inside** it. A stuck **P2** wedges
the queue exactly as hard as a stuck P0 — do not wait to recognise a "P0
problem".

⚠ **Nothing in the tool prevents this**: there is no attempt counter, no backoff
and no note on the item. **Say it in the report, in these terms** — "this item
has now failed and is blocking N others" — rather than letting a repeated
one-line failure look like bad luck. It needs a person.

## Report

```
/gx-sing — wave <N>:

  Planned (inbox → backlog):
    • <title>                 <SERIAL>

  Wave <N> — <size> item(s), in order:
    ✓ <SERIAL>  <title>       PR #<n>  merged @ <sha>
                              .gainwix/<component>/changes/<ts>-change.md
    ✗ <SERIAL>  <title>       never went green | would not merge
                              <reason verbatim>
                              returned to the backlog; blocking <M> item(s)

  Next:  <see the table — one line, plus the "and behind it" line if both apply>
```

**Choosing the `Next:` line — check these in order and take the first that fits:**

| Condition | Print |
|---|---|
| **Nothing merged this run** | `wave <N> failed entirely — nothing merged. Fix <the failed SERIALs> before running again.` |
| Closing `$GX ready` gives the **same** wave number | `wave <N> is unfinished — <its count> item(s) came back. Run /gx-sing again to retry.` |
| Closing `$GX ready` gives a **higher** number | `wave <the number it returned> — <its count> item(s) ready. Run /gx-sing again.` |
| `count` is `0`, something is in progress | `Nothing can start: <SERIALs> in progress, holding <SERIALs>.` |
| `count` is `0`, nothing in progress | `The queue is empty.` |

⭐ **When items came back AND a later wave is otherwise clear, print both** — the
retry line, then `and behind it: wave <the `next` field's wave> — <its count>
item(s), once <SERIALs> land.` ⚠ **`next` is `null` when nothing follows** — then
there is no second line to print, not a line saying "null".
The closing call's `next` field is where that second number comes from. One
number without the other is a half-truth.

⭐ **"Stopped at the wave boundary", "the whole wave failed" and "finished the
queue" must never print the same line.** They are three different states and the
operator acts on each differently.

## Notes

- **`/gx-sing` vs `/gx-ping`.** Same scope — one wave, and both plan up to 5
  inbox items first. Two real differences: `/gx-sing` works the items one at a
  time, `/gx-ping` builds them together — and in both, **the driver merges.** For a wave of one they do the same work.
  Use `/gx-sing` when the wave's items all touch the same files anyway, or to
  avoid the token cost of parallel teams.
- **No inbox clearing dance.** `/gx-go` never touches
  `.gainwix/<component>/inbox.md`; `/gx-next` consumes from it and commits the
  result. ⚠ **The tree is not clean by itself, though** — the driver's own
  finalize and `CHANGELOG.md` writes are what make it dirty, which is why step 3
  ends by committing them.
- **Every shipped item gets its own `.gainwix/<component>/changes/<ts>-change.md`** via `/gx-go`,
  linked from `.gainwix/<component>/CHANGELOG.md`.
- **One driver at a time.** Don't run a second `/gx-sing`/`/gx-ping` against the
  same `develop` concurrently — they would race the queue files and the tip.
- ⚠ **An item that ships more than one PR has no home in the report or in
  `$GX move --to completed`,** which takes a single `--pr-link`. `/gx-go` permits
  it; this does not represent it. Say so in the report if it happens.
- `/gx-sing` itself asks for no confirmation; `.gainwix/autonomy.md` authorizes
  the branch → test → PR → squash-merge → cleanup loop **for one wave.**
- **Formerly `/ang`.**

// Setting a repo up: finding its components, and making room for them.
//
// ⛔ **The bug this exists to kill.** The old scaffold step ran
//
//     [ -e "$f" ] || cp "$SCAFFOLD/$f" "$f"
//
// for ABOUT.md / ACTION-ITEMS.md / BACKLOG.md at the repo root. It asks *"does
// a file of this exact name exist?"* — not *"do you already have somewhere for
// this?"* On 10 Sept, in front of a customer, it met a repo with `about/` and
// `active/` **directories**, passed every check, and offered to scaffold on top
// of a structure the person had built on purpose.
//
// ⭐ So detection here does not decide anything. **It gives the command
// something specific to ask about**, which is the step that was missing.

import fs from "node:fs";
import path from "node:path";

/** Files that mark a directory as a buildable component. */
const MARKERS = [
  "package.json",
  "Gemfile",
  "go.mod",
  "Cargo.toml",
  "pyproject.toml",
  "composer.json",
  "pom.xml",
  "build.gradle",
];

/** Directories never worth walking into. */
const SKIP = new Set([
  ".git",
  ".gainwix",
  "node_modules",
  "vendor",
  "target",
  "dist",
  "build",
  "tmp",
  ".next",
  ".venv",
  "__pycache__",
]);

/** Places people already keep specs and backlogs. */
const EXISTING_HOMES = [
  { path: "about", why: "specs and prompts" },
  { path: "active", why: "the backlog" },
  { path: "specs", why: "specs" },
  { path: "docs/specs", why: "specs" },
  { path: "BACKLOG.md", why: "the backlog" },
  { path: "ACTION-ITEMS.md", why: "the inbox" },
  { path: "ABOUT.md", why: "the project overview" },
  { path: ".gainwix", why: "GainWix's own files" },
];

const exists = (p) => {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
};

/**
 * What this repo looks like — **a suggestion to ask about, never an answer.**
 *
 * `components` are directories that build something. `alreadyHas` is the half
 * that matters: somewhere the person already keeps this kind of thing.
 */
export function detect(root = ".") {
  const components = [];
  const rootMarkers = MARKERS.filter((m) => exists(path.join(root, m)));
  if (rootMarkers.length) {
    components.push({ name: path.basename(path.resolve(root)), dir: ".", markers: rootMarkers });
  }

  const walk = (dir, depth) => {
    if (depth > 2) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory() || SKIP.has(e.name) || e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      const found = MARKERS.filter((m) => exists(path.join(full, m)));
      if (found.length) {
        components.push({
          name: e.name,
          dir: path.relative(root, full) || ".",
          markers: found,
        });
      } else {
        walk(full, depth + 1);
      }
    }
  };
  walk(root, 0);

  return {
    components,
    alreadyHas: EXISTING_HOMES.filter((h) => exists(path.join(root, h.path))),
    /** ⚠ True when this repo clearly builds more than one thing. */
    multiple: components.length > 1,
  };
}

/** Every component this repo has set up, by folder. */
export function components(root = ".") {
  const base = path.join(root, ".gainwix");
  if (!exists(base)) return [];
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter(
      (e) =>
        e.isDirectory() && exists(path.join(base, e.name, "backlog.html")),
    )
    .map((e) => e.name)
    .sort();
}

/** Where the chosen component is remembered between commands. */
const CURRENT = (root) => path.join(root, ".gainwix", "current");

/**
 * Which component a command should act on.
 *
 * ⭐ **One component means never being asked.** Most repos build one thing, and
 * a question with one possible answer is a tax on every command. More than one
 * and the choice is remembered, so it is asked once rather than every time.
 *
 * Returns `{ component }`, or `{ choices }` when a person has to decide.
 */
export function currentComponent(root = ".") {
  const all = components(root);
  if (all.length === 0) return { choices: [], none: true };
  if (all.length === 1) return { component: all[0] };
  if (exists(CURRENT(root))) {
    const saved = fs.readFileSync(CURRENT(root), "utf8").trim();
    if (all.includes(saved)) return { component: saved };
  }
  return { choices: all };
}

/** Remember the choice. ⚠ Refuses a component that does not exist. */
export function setCurrent(root, component) {
  const all = components(root);
  if (!all.includes(component)) {
    throw new Error(
      `${component} is not set up in this repo. Components here: ${all.join(", ") || "(none)"}`,
    );
  }
  fs.writeFileSync(CURRENT(root), `${component}\n`);
  return component;
}

/**
 * The standing permission `/gx-go` treats as binding.
 *
 * ⛔ **This used to live inside `BACKLOG.md`**, above the items — so the queue
 * file held both the work and the policy about the work, and moving one moved
 * the other. It is a repo-wide statement of what the operator has pre-approved;
 * it belongs beside the queues, not inside one of them.
 */
export const AUTONOMY = `# Autonomy — what you have pre-approved

Read this before running a task. **It is binding for that run.**

By invoking \`/gx-go\`, \`/gx-sing\` or \`/gx-ping\`, the operator has given explicit
pre-approval to run the whole workflow end to end without asking again. That
includes:

- Branching from \`origin/develop\` — this workflow's trunk. **Create a \`develop\`
  branch if the repo has none**; the workflow standardises on that name.
- Running the project's build and setup steps — dependency installs, database
  migrations, code generation — autonomously.
- Running the test suite, fixing failures, and re-running until green.
- Committing, pushing, opening the issue and the PR, and squash-merging it.

**Proceed without asking for approval and make reasonable assumptions.**

## ⛔ What is never pre-approved

- **Anything that reaches production.** The production gate asks every time, on
  every path, in every mode.
- **Deleting or rewriting somebody's data**, in the repo or anywhere else.
- **Editing files under \`.gainwix/\` by hand.** Use the tool; it recomputes the
  dependency order with the change.

## The one rule about finishing

A task is done when it has **merged**, not when it compiles and not when the
tests pass. Until then it is in progress, and it unblocks nothing that depends
on it.
`;

/** The notice that makes "do not edit this by hand" a fact and not a hope. */
export const README = `# .gainwix

**This directory is managed by the GainWix tools. Do not edit anything in it by
hand.** The tools read these files, recompute what depends on what, and write
the whole file back — an edit made here is either overwritten on the next run or,
worse, kept alongside a stale dependency order that no longer matches it.

This is state, the way \`.git\` is state.

## What is in here

| | |
|---|---|
| \`deploy-context.json\` | ⛔ **written by the deploy flow and read by the production gate on every command.** Do not move, rename or nest it |
| \`<component>/\` | one folder per component this repo builds |

Inside a component:

| | |
|---|---|
| \`backlog.html\` | everything still to do, ordered by what depends on what |
| \`in-progress.html\` | only what is being worked on right now — transient |
| \`completed.html\` | work that landed, with the PR that landed it |
| \`changes/\` | one record per executed task |
| \`CHANGELOG.md\` | the index of those records |

## How the order is decided

Sequence comes only from **Depends on**. A wave number is the length of the
longest dependency chain behind an item, so items in one wave never depend on
each other and can be worked at the same time — by different people, or
different Claude sessions. **Serials are permanent and never reused.**

## Want to change something?

Use the \`/gx-*\` commands. If a backlog item is wrong, say so in the session and
let the tool rewrite the file — that way the waves, the critical path and the
day estimates are recomputed with it.
`;

/**
 * Make room for a component. Idempotent — an existing file is never touched.
 *
 * ⛔ Nothing goes in the repo root, and `deploy-context.json` is never moved.
 */
export function create(root, component, prefix, { render, computeWaves }) {
  const base = path.join(root, ".gainwix");
  const dir = path.join(base, component);
  const made = [];

  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "changes"), { recursive: true });

  const readme = path.join(base, "README.md");
  if (!exists(readme)) {
    fs.writeFileSync(readme, README);
    made.push(".gainwix/README.md");
  }

  const autonomy = path.join(base, "autonomy.md");
  if (!exists(autonomy)) {
    fs.writeFileSync(autonomy, AUTONOMY);
    made.push(".gainwix/autonomy.md");
  }

  for (const stage of ["backlog", "in-progress", "completed"]) {
    const file = path.join(dir, `${stage}.html`);
    if (exists(file)) continue;
    fs.writeFileSync(
      file,
      render(computeWaves([]), {
        component,
        prefix,
        stage,
        source: "",
        generated: new Date().toISOString().slice(0, 10),
      }),
    );
    made.push(`.gainwix/${component}/${stage}.html`);
  }

  const inbox = path.join(dir, "inbox.md");
  if (!exists(inbox)) {
    fs.writeFileSync(
      inbox,
      `# Inbox — ${component}

Raw ideas, one per \`- \` line, newest at the bottom. Nothing here is planned
yet: no dependencies, no size, no serial.

\`/gx-next\` takes the top one, plans it, and adds it to the backlog with the
dependencies that decide when it can start. It is removed from here as it goes.

⚠ **This is the one file under \`.gainwix/\` that is yours to type in.**
Everything else is written by the tools and recomputed on every run.

<!-- Add ideas below this line -->
`,
    );
    made.push(`.gainwix/${component}/inbox.md`);
  }

  const changelog = path.join(dir, "CHANGELOG.md");
  if (!exists(changelog)) {
    fs.writeFileSync(
      changelog,
      `# Changelog — ${component}\n\nOne line per executed task, newest first. Each links its record in \`changes/\`.\n\n`,
    );
    made.push(`.gainwix/${component}/CHANGELOG.md`);
  }
  const keep = path.join(dir, "changes", ".gitkeep");
  if (!exists(keep)) {
    fs.writeFileSync(keep, "");
    made.push(`.gainwix/${component}/changes/`);
  }
  return made;
}

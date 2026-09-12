#!/usr/bin/env node
// The one entry point the /gx-* commands call.
//
// ⭐ **Everything mechanical lives behind this.** A command's job is to hold a
// conversation and decide; the maths, the file writing and the ordering happen
// here, the same way every time. Prose that describes a longest-path
// computation is prose that will eventually get it wrong and not say so.
//
// Usage:
//   gx-backlog detect [--root .]
//   gx-backlog create --component admin --prefix AB [--root .]
//   gx-backlog show    --component admin [--stage backlog]
//   gx-backlog ready   --component admin
//   gx-backlog add     --component admin --title "…" [--detail …] [--deps "AB-001 AB-002"]
//                      [--pri P0] [--size M] [--lane auth] [--pr A] [--spec "Spec §4"]
//   gx-backlog move    --component admin --id AB-003 --to in-progress [--issue URL] [--pr-link URL]
//   gx-backlog rebuild --component admin        (re-render every stage from its own contents)

import fs from "node:fs";
import path from "node:path";

import { computeWaves, kpis, nextSerial, ordered, readyWave } from "./graph.mjs";
import { parseItems, parseMeta } from "./parse.mjs";
import { render, STAGES } from "./render.mjs";
import {
  components,
  create,
  currentComponent,
  detect,
  setCurrent,
} from "./init.mjs";

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) out[a.slice(2)] = argv[++i] ?? true;
    else out._.push(a);
  }
  return out;
}

const die = (msg) => {
  console.error(msg);
  process.exit(1);
};

const stageFile = (root, component, stage) =>
  path.join(root, ".gainwix", component, `${stage}.html`);

function load(root, component, stage) {
  const file = stageFile(root, component, stage);
  if (!fs.existsSync(file)) {
    die(
      `no ${stage} for ${component} at ${path.relative(root, file)}. Run /gx-init first.`,
    );
  }
  const html = fs.readFileSync(file, "utf8");
  return { file, html, items: parseItems(html), meta: parseMeta(html) };
}

/**
 * Load all three stages at once.
 *
 * ⛔⛔ **The graph spans the stages; it does not live inside one file.** Found
 * by running it: the moment AB-001 was picked up, AB-002 — still in the backlog
 * — depended on an item that file no longer contained, and the wave computation
 * refused. Correctly: what it was actually told was a dependency on something
 * that does not exist.
 *
 * ⭐ A stage file is a **view of a subset**. Waves are a property of the whole
 * component, so they are computed over the union and each file is rendered from
 * that. Otherwise a wave number would change meaning the moment work started,
 * which is the opposite of what a wave is for.
 */
function loadComponent(root, comp) {
  const stages = {};
  for (const stage of Object.keys(STAGES)) stages[stage] = load(root, comp, stage);
  return stages;
}

/** Recompute across every stage, then write all three back. */
function saveComponent(stages) {
  const all = Object.values(stages).flatMap((s) => s.items);
  computeWaves(all); // throws on a cycle or a genuinely unknown dependency
  for (const s of Object.values(stages)) {
    fs.writeFileSync(s.file, render(s.items, s.meta));
  }
}

const a = args(process.argv.slice(2));
const cmd = a._[0];
const root = a.root ?? ".";
const need = (k) => a[k] ?? die(`--${k} is required`);

/**
 * The component to act on: the flag, else the only one, else the remembered
 * choice — and a clear refusal when a person has to decide.
 *
 * ⛔ It never guesses between components. Writing one component's task into
 * another's backlog is silent and expensive to unpick.
 */
function component() {
  if (a.component) return a.component;
  const r = currentComponent(root);
  if (r.component) return r.component;
  if (r.none) die("no components are set up here yet. Run /gx-init first.");
  die(
    `this repo has more than one component — say which: ${r.choices.join(", ")}\n` +
      `  gx-backlog use --component <name>     (remembers it)\n` +
      `  …or pass --component <name> each time`,
  );
}

switch (cmd) {
  case "detect":
    console.log(JSON.stringify(detect(root), null, 2));
    break;

  case "create": {
    const made = create(root, need("component"), need("prefix"), {
      render,
      computeWaves,
    });
    console.log(
      made.length ? made.map((m) => `created ${m}`).join("\n") : "already set up — nothing created",
    );
    break;
  }

  case "components":
    console.log(JSON.stringify(components(root), null, 2));
    break;

  case "use":
    try {
      console.log(`now working on ${setCurrent(root, need("component"))}`);
    } catch (e) {
      die(e.message);
    }
    break;

  case "show": {
    const comp = component();
    const stage = a.stage ?? "backlog";
    const stages = loadComponent(root, comp);
    computeWaves(Object.values(stages).flatMap((s) => s.items));
    const { items, meta } = stages[stage] ?? die(`no stage ${stage}`);
    const withWaves = items;
    const k = kpis(withWaves.length ? withWaves : []);
    console.log(
      `${meta.component} — ${STAGES[meta.stage]?.title ?? meta.stage}: ${k.items} items, ${k.waves} waves, ≈${k.days} days`,
    );
    for (const i of ordered(withWaves)) {
      console.log(
        `  w${i.wave} ${i.pri} ${i.size} ${i.id.padEnd(9)} ${i.title}${i.deps.length ? `  ← ${i.deps.join(" ")}` : ""}`,
      );
    }
    break;
  }

  case "ready": {
    // ⛔ ONE wave. "run only one wave per execution but that one wave will
    // kickoff parallel execution paths."
    const comp = component();
    const stages = loadComponent(root, comp);
    const all = computeWaves(Object.values(stages).flatMap((s) => s.items));
    // ⛔ Merged unblocks. Picked up does not — it only means "already taken".
    const { wave, items } = readyWave(
      all,
      stages.completed.items.map((i) => i.id),
      stages["in-progress"].items.map((i) => i.id),
    );
    console.log(
      JSON.stringify(
        { wave, count: items.length, items: items.map((i) => ({ id: i.id, title: i.title, pri: i.pri, size: i.size })) },
        null,
        2,
      ),
    );
    break;
  }

  case "add": {
    const comp = component();
    const { items, meta } = load(root, comp, "backlog");
    const deps = String(a.deps ?? "").trim();
    const item = {
      id: a.id ?? nextSerial(items, meta.prefix || "GX"),
      title: need("title"),
      detail: a.detail ?? "",
      spec: a.spec ?? "",
      deps: deps ? deps.split(/\s+/) : [],
      pri: a.pri ?? "P1",
      size: a.size ?? "M",
      lane: a.lane ?? "",
      pr: a.pr ?? "",
      status: "backlog",
      issue: a.issue ?? "",
      prLink: a["pr-link"] ?? "",
    };
    const stages = loadComponent(root, comp);
    const everywhere = Object.values(stages).flatMap((s) => s.items);
    if (everywhere.some((i) => i.id === item.id)) die(`${item.id} already exists`);
    stages.backlog.items.push(item);
    saveComponent(stages);
    console.log(`added ${item.id} — ${item.title}`);
    break;
  }

  case "move": {
    // backlog → in-progress when picked up; → completed when it merges.
    const comp = component();
    const id = need("id");
    const to = need("to");
    if (!STAGES[to]) die(`--to must be one of ${Object.keys(STAGES).join(", ")}`);

    const stages = loadComponent(root, comp);
    const from = Object.keys(stages).find((st) =>
      stages[st].items.some((i) => i.id === id),
    );
    if (!from) die(`${id} is not in any stage of ${comp}`);
    if (from === to) die(`${id} is already in ${to}`);

    const item = stages[from].items.find((i) => i.id === id);
    // ⛔ Links are written on the way through, because "make sure to link
    // Issues and PRs to backlog and in progress html".
    if (a.issue) item.issue = a.issue;
    if (a["pr-link"]) item.prLink = a["pr-link"];
    item.status = to;

    stages[from].items = stages[from].items.filter((i) => i.id !== id);
    stages[to].items.push(item);
    saveComponent(stages);
    console.log(`${id}: ${from} → ${to}`);
    break;
  }

  case "rebuild": {
    // Recompute every stage from its own contents — after a hand-edit, or a
    // merge that left the waves stale.
    const comp = component();
    const stages = loadComponent(root, comp);
    saveComponent(stages);
    for (const [stage, s] of Object.entries(stages)) {
      console.log(`rebuilt ${stage}: ${s.items.length} items`);
    }
    break;
  }

  default:
    die(
      `unknown command ${cmd ?? "(none)"}. One of: detect, create, components, use, show, ready, add, move, rebuild`,
    );
}

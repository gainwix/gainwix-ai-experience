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

import {
  computeWaves,
  DAYS,
  kpis,
  nextSerial,
  ordered,
  PRIORITIES,
  readyWave,
  Refusal,
} from "./graph.mjs";
import { parseItems, parseMeta } from "./parse.mjs";
import { render, STAGES } from "./render.mjs";
import {
  checkComponent,
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
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }
    // ⚠ A flag with no value is `true` — never the NEXT flag's name. Reading
    // the next token unconditionally turned `--title --pri P0` into a task
    // titled "--pri".
    const next = argv[i + 1];
    out[a.slice(2)] = next === undefined || next.startsWith("--") ? true : argv[++i];
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

/**
 * A flag's value, or `fallback` when it was not passed.
 *
 * ⛔ A flag given with no value is refused, not stored. It used to become the
 * string "true": `--deps` alone made an item depend on a serial called "true",
 * `--issue` alone linked it to a page called "true".
 */
const opt = (k, fallback) => {
  if (a[k] === true) die(`--${k} needs a value`);
  return a[k] ?? fallback;
};
const need = (k) => {
  const v = opt(k);
  if (v === undefined || !String(v).trim()) die(`--${k} is required`);
  return v;
};
/** A flag that must be one of a fixed set. */
const oneOf = (k, allowed, fallback) => {
  const v = opt(k, fallback);
  if (v === undefined) die(`--${k} is required`);
  if (!allowed.includes(v)) die(`--${k} must be one of ${allowed.join(", ")} — got "${v}"`);
  return v;
};

const root = opt("root", ".");

/**
 * The component to act on: the flag, else the only one, else the remembered
 * choice — and a clear refusal when a person has to decide.
 *
 * ⛔ It never guesses between components. Writing one component's task into
 * another's backlog is silent and expensive to unpick.
 */
function component() {
  const named = opt("component");
  if (named !== undefined) return checkComponent(named);
  const r = currentComponent(root);
  if (r.component) return r.component;
  if (r.none) die("no components are set up here yet. Run /gx-init first.");
  die(
    `this repo has more than one component — say which: ${r.choices.join(", ")}\n` +
      `  gx-backlog use --component <name>     (remembers it)\n` +
      `  …or pass --component <name> each time`,
  );
}

// ⭐ A Refusal is the person's to fix — a cycle, an unknown dependency, a bad
// name — so it prints as one line. Anything else is a bug in this tool and
// keeps its stack trace.
try {
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
      console.log(`now working on ${setCurrent(root, need("component"))}`);
      break;

    case "show": {
      const comp = component();
      const stage = oneOf("stage", Object.keys(STAGES), "backlog");
      const stages = loadComponent(root, comp);
      computeWaves(Object.values(stages).flatMap((s) => s.items));
      const { items, meta } = stages[stage];
      const k = kpis(items);
      console.log(
        `${meta.component} — ${STAGES[meta.stage]?.title ?? meta.stage}: ${k.items} items, ${k.waves} waves, ≈${k.days} days`,
      );
      for (const i of ordered(items)) {
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
      const merged = stages.completed.items.map((i) => i.id);
      const picked = stages["in-progress"].items.map((i) => i.id);
      // ⛔ Merged unblocks. Picked up does not — it only means "already taken".
      const { wave, items } = readyWave(all, merged, picked);
      // ⭐ What the driver stops in FRONT of. A driver that runs one wave and
      // halts has to say what a second run would pick up — otherwise "stopped"
      // and "finished" print the same and the operator cannot tell them apart.
      const after = readyWave(all, [...merged, ...items.map((i) => i.id)], picked);
      console.log(
        JSON.stringify(
          {
            wave,
            count: items.length,
            // ⛔ detail and spec travel with the item. A driver that names the
            // item to /gx-go and passes only a title has handed over a headline
            // and kept the brief — the run then builds whatever the title
            // suggests. Nothing errors; it just builds the wrong thing.
            items: items.map((i) => ({
              id: i.id,
              title: i.title,
              detail: i.detail,
              spec: i.spec,
              deps: i.deps,
              pri: i.pri,
              size: i.size,
              lane: i.lane,
            })),
            next: after.wave === null ? null : { wave: after.wave, count: after.items.length },
          },
          null,
          2,
        ),
      );
      break;
    }

    case "add": {
      const comp = component();
      // ⛔ The next serial is counted across EVERY stage, not just the backlog.
      // Counting the backlog alone re-issued a serial the moment its holder moved
      // on: AB-001 completed, the backlog was empty, the next add was handed
      // AB-001 again and then refused it as a duplicate — so /gx-next could add
      // nothing more to that component.
      const stages = loadComponent(root, comp);
      const { meta } = stages.backlog;
      const everywhere = Object.values(stages).flatMap((s) => s.items);
      const deps = String(opt("deps", "")).trim();
      const item = {
        id: opt("id") ?? nextSerial(everywhere, meta.prefix || "GX"),
        title: need("title"),
        detail: opt("detail", ""),
        spec: opt("spec", ""),
        deps: deps ? deps.split(/\s+/) : [],
        // ⛔ Only values the page and the ordering understand. "p0" or "XL"
        // used to be written straight in — unranked, and costed at zero days.
        pri: oneOf("pri", PRIORITIES, "P1"),
        size: oneOf("size", Object.keys(DAYS), "M"),
        lane: opt("lane", ""),
        pr: opt("pr", ""),
        status: "backlog",
        issue: opt("issue", ""),
        prLink: opt("pr-link", ""),
      };
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
      const to = oneOf("to", Object.keys(STAGES));
      const issue = opt("issue");
      const prLink = opt("pr-link");

      const stages = loadComponent(root, comp);
      const from = Object.keys(stages).find((st) =>
        stages[st].items.some((i) => i.id === id),
      );
      if (!from) die(`${id} is not in any stage of ${comp}`);
      if (from === to) die(`${id} is already in ${to}`);

      const item = stages[from].items.find((i) => i.id === id);
      // ⛔ Links are written on the way through, because "make sure to link
      // Issues and PRs to backlog and in progress html".
      if (issue) item.issue = issue;
      if (prLink) item.prLink = prLink;
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
} catch (e) {
  if (e instanceof Refusal) die(e.message);
  throw e;
}

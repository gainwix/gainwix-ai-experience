// Detecting components, and making room for them.
//
// ⛔ The case these exist for is the one that happened in front of a customer
// on 10 Sept: a repo that already had `about/` and `active/`, and a scaffold
// step that created files beside them because no file of that exact NAME
// existed.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { computeWaves } from "../graph.mjs";
import { parseItems, parseMeta } from "../parse.mjs";
import { render } from "../render.mjs";
import { create, detect } from "../init.mjs";

function tmpRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gx-init-"));
  for (const [p, body] of Object.entries(files)) {
    const full = path.join(root, p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body ?? "");
  }
  return root;
}

test("⛔ a repo that already keeps specs and a backlog is NOT quietly scaffolded over", () => {
  // Dr. A's shape: about/prompts, about/specs, active/ — none of which is a
  // file called ABOUT.md or BACKLOG.md, which is exactly why the old
  // `[ -e "$f" ]` guard let the scaffold through.
  const root = tmpRepo({
    "about/specs/001-spec-admin-portal.html": "<html></html>",
    "about/prompts/2026-09-10.md": "",
    "active/admin-backlog.html": "<html></html>",
    "admin/Gemfile": "",
  });

  const found = detect(root);
  const homes = found.alreadyHas.map((h) => h.path);
  assert.ok(homes.includes("about"), `about/ must be noticed: ${homes}`);
  assert.ok(homes.includes("active"), `active/ must be noticed: ${homes}`);
});

test("one repo, several components — each is found by what it builds", () => {
  // Vivek's own example: a Rails admin portal, an API, a React front end and a
  // deployment directory, all in one repo.
  const root = tmpRepo({
    "admin/Gemfile": "",
    "api/Gemfile": "",
    "web/package.json": "{}",
    "deployment/main.tf": "",
  });
  const found = detect(root);
  const names = found.components.map((c) => c.name).sort();
  assert.deepEqual(names, ["admin", "api", "web"]);
  assert.equal(found.multiple, true, "and it must know there is more than one");
});

test("a single-component repo says so, so the command need not ask", () => {
  const root = tmpRepo({ "package.json": "{}" });
  const found = detect(root);
  assert.equal(found.components.length, 1);
  assert.equal(found.multiple, false);
});

test("node_modules and vendor are not components", () => {
  const root = tmpRepo({
    "package.json": "{}",
    "node_modules/left-pad/package.json": "{}",
    "vendor/bundle/Gemfile": "",
  });
  assert.deepEqual(
    detect(root).components.map((c) => c.name),
    [path.basename(root)],
  );
});

test("creating a component puts everything under .gainwix and nothing in the root", () => {
  const root = tmpRepo({ "package.json": "{}" });
  const made = create(root, "admin", "AB", { render, computeWaves });

  for (const f of [
    ".gainwix/README.md",
    ".gainwix/autonomy.md",
    ".gainwix/admin/backlog.html",
    ".gainwix/admin/in-progress.html",
    ".gainwix/admin/completed.html",
    ".gainwix/admin/CHANGELOG.md",
    ".gainwix/admin/changes/.gitkeep",
  ]) {
    assert.ok(fs.existsSync(path.join(root, f)), `${f} was not created`);
  }
  assert.ok(made.length >= 6);

  // ⛔ Nothing in the repo root but what was already there.
  assert.deepEqual(
    fs.readdirSync(root).sort(),
    [".gainwix", "package.json"],
    "the root must be left alone",
  );
});

test("the three files are real, readable backlogs from the moment they exist", () => {
  const root = tmpRepo({});
  create(root, "admin", "AB", { render, computeWaves });
  for (const stage of ["backlog", "in-progress", "completed"]) {
    const html = fs.readFileSync(
      path.join(root, ".gainwix/admin", `${stage}.html`),
      "utf8",
    );
    assert.deepEqual(parseItems(html), [], "empty, but parseable");
    assert.deepEqual(parseMeta(html), {
      component: "admin",
      prefix: "AB",
      stage,
      source: "",
      generated: new Date().toISOString().slice(0, 10),
    });
  }
});

test("running it twice changes nothing — and never overwrites work", () => {
  const root = tmpRepo({});
  create(root, "admin", "AB", { render, computeWaves });
  const file = path.join(root, ".gainwix/admin/backlog.html");
  fs.writeFileSync(file, "REAL WORK");

  const second = create(root, "admin", "AB", { render, computeWaves });
  assert.deepEqual(second, [], "nothing was created the second time");
  assert.equal(
    fs.readFileSync(file, "utf8"),
    "REAL WORK",
    "⛔ an existing backlog must never be replaced by an empty one",
  );
});

test("⛔ deploy-context.json is never touched", () => {
  // The production gate reads <cwd>/.gainwix/deploy-context.json on every Bash
  // call. Move or nest it and every deploy is silently treated as production.
  const root = tmpRepo({
    ".gainwix/deploy-context.json": '{"target":"cloud-run","kind":"staging"}',
  });
  create(root, "admin", "AB", { render, computeWaves });
  assert.equal(
    fs.readFileSync(path.join(root, ".gainwix/deploy-context.json"), "utf8"),
    '{"target":"cloud-run","kind":"staging"}',
  );
});

test("a second component sits beside the first, not on top of it", () => {
  const root = tmpRepo({});
  create(root, "admin", "AB", { render, computeWaves });
  create(root, "api", "API", { render, computeWaves });
  assert.deepEqual(
    fs.readdirSync(path.join(root, ".gainwix")).sort(),
    ["README.md", "admin", "api", "autonomy.md"],
    "components sit beside each other, under the repo-wide notice and policy",
  );
  assert.equal(
    parseMeta(
      fs.readFileSync(path.join(root, ".gainwix/api/backlog.html"), "utf8"),
    ).prefix,
    "API",
  );
});

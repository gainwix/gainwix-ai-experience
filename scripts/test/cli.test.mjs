// The CLI, driven the way a command drives it.
//
// ⭐ These exist because a rename broke `load()` and no unit test noticed: the
// parameter became `comp` while the body still said `component`, which silently
// resolved to the module-level function of that name. Everything below runs the
// real binary against a real directory, which is the only thing that would have
// caught it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../gx-backlog.mjs", import.meta.url));

function repo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "gx-cli-"));
}

function gx(cwd, ...args) {
  return execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8" });
}

function fails(cwd, ...args) {
  try {
    execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8", stdio: "pipe" });
    return null;
  } catch (e) {
    return `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
}

test("every subcommand runs against a real directory", () => {
  const root = repo();
  gx(root, "create", "--component", "admin", "--prefix", "AB");

  assert.match(gx(root, "add", "--title", "One", "--pri", "P0", "--size", "S"), /AB-001/);
  assert.match(gx(root, "add", "--title", "Two", "--deps", "AB-001"), /AB-002/);
  assert.match(gx(root, "show"), /AB-001/);
  assert.match(gx(root, "ready"), /"AB-001"/);
  assert.match(gx(root, "move", "--id", "AB-001", "--to", "in-progress"), /backlog → in-progress/);
  assert.match(gx(root, "rebuild"), /rebuilt backlog/);
  assert.match(gx(root, "components"), /admin/);
});

test("one component is never asked about; two are never guessed between", () => {
  const root = repo();
  gx(root, "create", "--component", "admin", "--prefix", "AB");
  assert.match(gx(root, "add", "--title", "Solo"), /AB-001/, "one → no flag needed");

  gx(root, "create", "--component", "api", "--prefix", "API");
  const refusal = fails(root, "add", "--title", "Ambiguous");
  assert.match(refusal, /more than one component/);
  assert.match(refusal, /admin, api/, "and it says which");

  assert.match(gx(root, "use", "--component", "api"), /now working on api/);
  assert.match(gx(root, "add", "--title", "Now it knows"), /API-001/);
});

test("⛔ a serial belongs to its component — the prefixes do not collide", () => {
  const root = repo();
  gx(root, "create", "--component", "admin", "--prefix", "AB");
  gx(root, "create", "--component", "api", "--prefix", "API");
  gx(root, "add", "--component", "admin", "--title", "A");
  gx(root, "add", "--component", "api", "--title", "B");
  assert.match(gx(root, "show", "--component", "admin"), /AB-001/);
  assert.match(gx(root, "show", "--component", "api"), /API-001/);
});

test("a bad component is refused rather than silently created", () => {
  const root = repo();
  gx(root, "create", "--component", "admin", "--prefix", "AB");
  assert.match(fails(root, "use", "--component", "ghost"), /not set up in this repo/);
  assert.match(fails(root, "show", "--component", "ghost"), /Run \/gx-init first/);
});

test("an unknown dependency is refused, and says which", () => {
  const root = repo();
  gx(root, "create", "--component", "admin", "--prefix", "AB");
  assert.match(
    fails(root, "add", "--title", "Orphan", "--deps", "AB-999"),
    /depends on AB-999/,
  );
});

test("⛔ the full lifecycle: merged unblocks, picked up does not", () => {
  const root = repo();
  gx(root, "create", "--component", "admin", "--prefix", "AB");
  gx(root, "add", "--title", "A", "--size", "S");
  gx(root, "add", "--title", "B", "--size", "S");
  gx(root, "add", "--title", "C", "--deps", "AB-001 AB-002");

  const first = JSON.parse(gx(root, "ready"));
  assert.deepEqual(first.items.map((i) => i.id), ["AB-001", "AB-002"], "the wave, in parallel");

  gx(root, "move", "--id", "AB-001", "--to", "in-progress");
  gx(root, "move", "--id", "AB-002", "--to", "in-progress");
  assert.equal(JSON.parse(gx(root, "ready")).count, 0, "picked up is not merged");

  gx(root, "move", "--id", "AB-001", "--to", "completed");
  assert.equal(JSON.parse(gx(root, "ready")).count, 0, "one of two is not enough");

  gx(root, "move", "--id", "AB-002", "--to", "completed");
  assert.deepEqual(JSON.parse(gx(root, "ready")).items.map((i) => i.id), ["AB-003"]);
});

test("issue and PR links are written into the file they land in", () => {
  // ⛔ "make sure to link Issues and PRs to backlog and in progress html"
  const root = repo();
  gx(root, "create", "--component", "admin", "--prefix", "AB");
  gx(root, "add", "--title", "A");
  gx(root, "move", "--id", "AB-001", "--to", "in-progress", "--issue", "https://github.com/x/y/issues/7");
  assert.match(
    fs.readFileSync(path.join(root, ".gainwix/admin/in-progress.html"), "utf8"),
    /issues\/7/,
  );
  gx(root, "move", "--id", "AB-001", "--to", "completed", "--pr-link", "https://github.com/x/y/pull/9");
  assert.match(
    fs.readFileSync(path.join(root, ".gainwix/admin/completed.html"), "utf8"),
    /pull\/9/,
  );
});

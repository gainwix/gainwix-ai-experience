#!/usr/bin/env node
/**
 * qa/runner/run.mjs — GainWix QA runner (stack-agnostic).
 *
 * Parses qa/QA.md, drives chromium (Playwright) through each browser workflow's
 * steps, screenshots every meaningful step, and emits a self-contained HTML
 * report + JSON sidecar + RUN-LOG.md. No-browser `Mode: api` workflows are driven
 * with fetch + a Bearer token. The runner knows nothing about your stack — you
 * hand it a frontend URL (and optionally an API origin); it just executes the
 * steps qa/QA.md declares.
 *
 * Prerequisites (the runner does NOT boot your app):
 *   - From qa/runner/:  npm install  &&  npx playwright install chromium
 *   - Your stack already running at --base (and --api-base for api workflows),
 *     against an isolated, seeded test DB (see qa/QA.md "Environment / setup").
 *
 * Usage:
 *   node qa/runner/run.mjs --base http://localhost:5173 [--api-base http://localhost:3000]
 *
 * Env: QA_CONCURRENCY (default 2), QA_TIMEOUT ms (default 35000), QA_API_BASE,
 *      QA_API_TOKEN, QA_TOKEN_MINT_CMD, QA_LEARNER_EMAIL, plus any ${VAR} your
 *      workflows reference.
 *
 * Exit: 0 = every workflow passed; 1 = any failed, or none found.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHtml, renderJson, renderRunLogEntry } from './report.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- helpers ----
const log = (m) => process.stderr.write(`[gx-qa] ${m}\n`);
const die = (m) => { log(m); process.exit(1); };
const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'workflow';

function tsNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}
const human = (ms) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

function parseArgs(argv) {
  const a = { base: '', apiBase: process.env.QA_API_BASE || '', qaFile: 'qa/QA.md', outDir: 'qa', timeout: Number(process.env.QA_TIMEOUT) || 35000, concurrency: Number(process.env.QA_CONCURRENCY) || 2 };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--base') a.base = argv[++i];
    else if (v === '--api-base') a.apiBase = argv[++i];
    else if (v === '--qa-file') a.qaFile = argv[++i];
    else if (v === '--out') a.outDir = argv[++i];
    else if (v === '--timeout') a.timeout = Number(argv[++i]);
    else if (v === '--concurrency') a.concurrency = Number(argv[++i]);
  }
  return a;
}

// Secret-safe ${VAR}/${RUN_TS} substitution. Resolved values are passed only to
// the browser/fetch — never returned to the report. Unset vars warn by NAME only.
const warned = new Set();
function resolveVars(str, runTs) {
  return String(str).replace(/\$\{([A-Z0-9_]+|RUN_TS)\}/gi, (_, name) => {
    if (name === 'RUN_TS') return runTs;
    const val = process.env[name];
    if (val == null) {
      if (!warned.has(name)) { warned.add(name); log(`warning: \${${name}} is unset — resolving to ""`); }
      return '';
    }
    return val;
  });
}

// ----------------------------------------------------------------- parse -----
function splitSelVal(rest) {
  const q = rest.indexOf('"');
  if (q !== -1) {
    const lastQ = rest.lastIndexOf('"');
    return { selector: rest.slice(0, q).trim(), value: rest.slice(q + 1, lastQ) };
  }
  const parts = rest.trim().split(/\s+/);
  const value = parts.pop() ?? '';
  return { selector: parts.join(' '), value };
}

function parseStep(raw) {
  const m = raw.match(/^([A-Za-z]+)\b\s*(.*)$/);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  const rest = m[2].trim();
  switch (kind) {
    case 'goto': return { kind, arg: rest, raw };
    case 'click': case 'assertvisible': return { kind, selector: rest, raw };
    case 'fill': case 'asserttext': { const { selector, value } = splitSelVal(rest); return { kind, selector, value, raw }; }
    case 'asserturl': return { kind, arg: rest.replace(/^"|"$/g, ''), raw };
    case 'wait': return { kind, ms: parseInt(rest, 10) || 1000, raw };
    case 'screenshot': return { kind, label: rest || 'step', raw };
    // api verbs
    case 'get': return { kind, arg: rest, raw };
    case 'post': { const { selector, value } = splitSelVal(rest); return { kind, arg: selector, body: value, raw }; }
    case 'assertstatus': return { kind, code: parseInt(rest, 10), raw };
    case 'assertjson': { const { selector, value } = splitSelVal(rest); return { kind, dotpath: selector, expected: value, raw }; }
    case 'snapshot': return { kind, label: rest || 'response', raw };
    default: return { kind: 'unknown', raw };
  }
}

function parseQaMd(md) {
  const lines = md.split(/\r?\n/);
  let i = lines.findIndex((l) => /^##\s+QA Workflows\s*$/i.test(l));
  if (i === -1) return [];
  const workflows = [];
  let cur = null, inSteps = false;
  for (i += 1; i < lines.length; i++) {
    const line = lines[i];
    const h3 = line.match(/^###\s+(.+?)\s*$/);
    if (h3) {
      if (cur) workflows.push(cur);
      cur = { name: h3[1], slug: slugify(h3[1]), route: '/', mode: 'serial', surfaces: [], steps: [] };
      inSteps = false;
      continue;
    }
    if (/^##\s+/.test(line)) break; // a new top-level section ends the suite
    if (!cur) continue;
    const meta = line.match(/^\s*-\s+\*\*(Route|Mode|Surfaces)\s*:\*\*\s*(.*)$/i);
    if (meta) {
      const k = meta[1].toLowerCase(), val = meta[2].trim();
      if (k === 'route') cur.route = val;
      else if (k === 'mode') cur.mode = /parallel/i.test(val) ? 'parallel' : /api/i.test(val) ? 'api' : 'serial';
      else if (k === 'surfaces') cur.surfaces = val.split(',').map((s) => s.trim()).filter(Boolean);
      inSteps = false;
      continue;
    }
    if (/^\s*-\s+\*\*Steps\s*:\*\*/i.test(line)) { inSteps = true; continue; }
    if (inSteps) {
      const step = line.match(/^\s+-\s+(.+)$/);
      if (step) { const p = parseStep(step[1].trim()); if (p) cur.steps.push(p); }
      else if (line.trim() !== '') inSteps = false;
    }
  }
  if (cur) workflows.push(cur);
  return workflows.filter((w) => w.steps.length);
}

// --------------------------------------------------------- browser runner ----
let _chromium;
async function getChromium() {
  if (_chromium === undefined) {
    try { ({ chromium: _chromium } = await import('playwright')); }
    catch { die("Playwright isn't installed. From qa/runner/: `npm install && npx playwright install chromium`."); }
  }
  return _chromium;
}

async function runBrowserWorkflow(browser, wf, ctx) {
  const { base, timeout, runTs, shotDir, shotRel } = ctx;
  const result = { name: wf.name, slug: wf.slug, route: wf.route, mode: wf.mode, surfaces: wf.surfaces, status: 'passed', tested: [], screenshots: [], steps: [] };
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const failedReqs = [];
  page.on('response', (res) => { if (res.status() >= 400) failedReqs.push({ url: res.url(), status: res.status() }); });

  let n = 0;
  const shoot = async (label) => {
    n++;
    const file = `${wf.slug}-${String(n).padStart(2, '0')}-${slugify(label)}.png`;
    try { await page.screenshot({ path: path.join(shotDir, file) }); result.screenshots.push({ path: `${shotRel}/${file}`, label }); }
    catch { /* page may be gone on hard failure */ }
  };

  try {
    for (let si = 0; si < wf.steps.length; si++) {
      const s = wf.steps[si];
      const before = failedReqs.length;
      try {
        if (s.kind === 'goto') { const u = /^https?:/.test(s.arg) ? s.arg : base + s.arg; await page.goto(u, { waitUntil: 'load', timeout }); }
        else if (s.kind === 'click') await page.locator(s.selector).first().click({ timeout });
        else if (s.kind === 'fill') await page.locator(s.selector).first().fill(resolveVars(s.value, runTs), { timeout });
        else if (s.kind === 'assertvisible') await page.locator(s.selector).first().waitFor({ state: 'visible', timeout });
        else if (s.kind === 'asserttext') {
          const want = resolveVars(s.value, runTs);
          const got = (await page.locator(s.selector).first().textContent({ timeout })) || '';
          if (!got.includes(want)) throw new Error(`assertText: ${JSON.stringify(s.selector)} did not contain ${JSON.stringify(want)}`);
        }
        else if (s.kind === 'asserturl') { if (!page.url().includes(s.arg)) throw new Error(`assertUrl: ${page.url()} did not contain ${JSON.stringify(s.arg)}`); }
        else if (s.kind === 'wait') await page.waitForTimeout(s.ms);
        else if (s.kind === 'screenshot') await shoot(s.label);
        else if (s.kind === 'unknown') throw new Error(`unknown step: ${s.raw}`);
        result.tested.push(maskLabel(s));
        result.steps.push({ idx: si, kind: s.kind, status: 'passed' });
      } catch (e) {
        const reqErr = failedReqs.slice(before).pop();
        result.status = 'failed';
        result.error = {
          message: e.message,
          where: { step: si + 1, route: wf.route, surface: reqErr ? 'backend' : 'frontend', endpoint: reqErr?.url, httpStatus: reqErr?.status },
        };
        await shoot(`FAIL-${s.kind}`);
        if (result.screenshots.length) result.error.screenshot = result.screenshots.at(-1).path;
        result.steps.push({ idx: si, kind: s.kind, status: 'failed' });
        break;
      }
    }
  } finally {
    await context.close();
  }
  return result;
}

function maskLabel(s) {
  if (s.kind === 'fill') return `fill ${s.selector} «value»`; // never echo the value
  if (s.kind === 'asserttext') return `assertText ${s.selector} ${JSON.stringify(s.value)}`;
  return s.raw;
}

// ------------------------------------------------------------- api runner ----
function apiToken() {
  if (process.env.QA_API_TOKEN) return process.env.QA_API_TOKEN;
  if (process.env.QA_TOKEN_MINT_CMD) {
    try { return execSync(process.env.QA_TOKEN_MINT_CMD, { encoding: 'utf8' }).trim(); }
    catch (e) { die(`QA_TOKEN_MINT_CMD failed: ${e.message}`); }
  }
  return '';
}
const dig = (obj, dotpath) => dotpath.split('.').reduce((o, k) => (o == null ? o : o[/^\d+$/.test(k) ? Number(k) : k]), obj);

async function runApiWorkflow(wf, ctx) {
  const { apiBase, runTs, token } = ctx;
  const result = { name: wf.name, slug: wf.slug, route: wf.route, mode: 'api', surfaces: wf.surfaces, status: 'passed', tested: [], screenshots: [], steps: [] };
  if (!apiBase) { result.status = 'failed'; result.error = { message: 'api workflow but no --api-base / QA_API_BASE set', where: { route: wf.route, surface: 'backend' } }; return result; }
  let last = null;
  for (let si = 0; si < wf.steps.length; si++) {
    const s = wf.steps[si];
    try {
      if (s.kind === 'get' || s.kind === 'post') {
        const url = apiBase.replace(/\/$/, '') + (s.arg.startsWith('/') ? s.arg : '/' + s.arg);
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(url, { method: s.kind === 'post' ? 'POST' : 'GET', headers, body: s.kind === 'post' ? resolveVars(s.body || '', runTs) : undefined });
        let json = null; try { json = await res.clone().json(); } catch { /* non-json */ }
        last = { status: res.status, url, json };
        result.tested.push(`${s.kind.toUpperCase()} ${s.arg} → ${res.status}`);
      } else if (s.kind === 'assertstatus') {
        if (!last || last.status !== s.code) throw new Error(`assertStatus: expected ${s.code}, got ${last?.status}`);
        result.tested.push(`status == ${s.code}`);
      } else if (s.kind === 'assertjson') {
        const got = dig(last?.json, s.dotpath);
        const want = resolveVars(s.expected, runTs);
        if (String(got) !== want) throw new Error(`assertJson ${s.dotpath}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
        result.tested.push(`json ${s.dotpath} == ${JSON.stringify(want)}`);
      } else if (s.kind === 'snapshot') {
        result.tested.push(`snapshot ${s.label}: ${JSON.stringify(last?.json ?? null).slice(0, 200)}`);
      }
      result.steps.push({ idx: si, kind: s.kind, status: 'passed' });
    } catch (e) {
      result.status = 'failed';
      result.error = { message: e.message, where: { step: si + 1, route: wf.route, surface: 'backend', endpoint: last?.url, httpStatus: last?.status } };
      result.steps.push({ idx: si, kind: s.kind, status: 'failed' });
      break;
    }
  }
  return result;
}

// ------------------------------------------------------------ concurrency ----
async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(size, items.length)) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

// --------------------------------------------------------------- artifacts ---
function writeArtifacts(outDir, results) {
  fs.writeFileSync(path.join(outDir, `RUN-REPORT-${results.ts}.html`), renderHtml(results));
  fs.writeFileSync(path.join(outDir, `RUN-REPORT-${results.ts}.json`), renderJson(results));
}
function prependRunLog(outDir, results) {
  const p = path.join(outDir, 'RUN-LOG.md');
  const header = '# QA Run Log\n\nNewest first. Each links its `RUN-REPORT-<ts>.html`.\n\n';
  const prev = fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/^# QA Run Log\n\n[^\n]*\n\n/, '') : '';
  fs.writeFileSync(p, header + renderRunLogEntry(results) + prev);
}

// --------------------------------------------------------------------- main --
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.base) die('missing --base <frontend-url> (the URL your stack is serving)');

  const qaPath = path.resolve(args.qaFile);
  if (!fs.existsSync(qaPath)) die(`qa file not found: ${args.qaFile}`);
  const workflows = parseQaMd(fs.readFileSync(qaPath, 'utf8'));
  if (workflows.length === 0) die('qa/QA.md has no QA workflows — nothing to run.');

  const ts = tsNow();
  const outDir = path.resolve(args.outDir);
  const shotDir = path.join(outDir, `RUN-REPORT-${ts}`);
  fs.mkdirSync(shotDir, { recursive: true });

  const results = {
    ts, baseUrl: args.base, apiBase: args.apiBase, screenshotDir: `RUN-REPORT-${ts}`,
    startedAt: new Date().toISOString(), elapsedHuman: '0s',
    counts: { total: workflows.length, passed: 0, failed: 0, parallel: 0, serial: 0, api: 0 },
    workflows: new Array(workflows.length),
  };
  const t0 = Date.now();
  const ctx = { base: args.base.replace(/\/$/, ''), apiBase: args.apiBase, timeout: args.timeout, runTs: ts, shotDir, shotRel: `RUN-REPORT-${ts}`, token: '' };

  const parallel = [], serial = [], api = [];
  workflows.forEach((w, i) => (w.mode === 'parallel' ? parallel : w.mode === 'api' ? api : serial).push({ w, i }));
  results.counts.parallel = parallel.length; results.counts.serial = serial.length; results.counts.api = api.length;

  const browserNeeded = parallel.length + serial.length > 0;
  const browser = browserNeeded ? await (await getChromium()).launch() : null;
  if (api.length) ctx.token = apiToken();

  const place = (slot, res) => {
    results.workflows[slot] = res;
    results.counts.passed = results.workflows.filter((x) => x && x.status === 'passed').length;
    results.counts.failed = results.workflows.filter((x) => x && x.status === 'failed').length;
    results.elapsedHuman = human(Date.now() - t0);
    writeArtifacts(outDir, results); // append-as-you-go
    log(`${res.status === 'passed' ? '✓' : '✗'} ${res.name}`);
  };

  try {
    // parallel group first (bounded), each its own context
    await pool(parallel, args.concurrency, async ({ w, i }) => { place(i, await runBrowserWorkflow(browser, w, ctx)); });
    // serial group, document order
    for (const { w, i } of serial) place(i, await runBrowserWorkflow(browser, w, ctx));
    // api group, no browser
    for (const { w, i } of api) place(i, await runApiWorkflow(w, ctx));
  } finally {
    if (browser) await browser.close();
  }

  results.endedAt = new Date().toISOString();
  results.elapsedHuman = human(Date.now() - t0);
  writeArtifacts(outDir, results);
  prependRunLog(outDir, results);

  log(`done — ${results.counts.passed}/${results.counts.total} passed → qa/RUN-REPORT-${ts}.html`);
  process.exit(results.counts.failed === 0 ? 0 : 1);
}

// Run only when invoked directly, so the parser + report stay importable/testable.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main().catch((e) => die(e.stack || e.message));

export { parseQaMd, parseStep, resolveVars, splitSelVal };

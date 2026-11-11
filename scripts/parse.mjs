// Reading a backlog back out of its own HTML.
//
// ⛔ **The HTML is the source of truth.** Siva's call, 12 Sept: one file per
// component, self-contained, the way the reference sample is — rather than a
// JSON beside it and two things to drift apart.
//
// So the cycle is parse → model → render the whole file. Never mutate in place:
// a regex that edits one row and leaves the computed waves stale is exactly the
// kind of silently-wrong this feature exists to avoid.

/** Unescape the small set of entities the renderer writes. */
const unesc = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

/** The text inside the first element with this class, tags stripped. */
function spanText(html, cls) {
  const m = new RegExp(
    `<span class="${cls}"[^>]*>([\\s\\S]*?)</span>`,
    "i",
  ).exec(html);
  return m ? unesc(m[1].replace(/<[^>]+>/g, "").trim()) : "";
}

/** An href whose text matches, for the issue and PR links. */
function linkHref(html, label) {
  const m = new RegExp(
    `<a[^>]*href="([^"]+)"[^>]*data-link="${label}"`,
    "i",
  ).exec(html);
  return m ? m[1] : "";
}

/**
 * Every item in a backlog file.
 *
 * ⚠ Reads `data-deps`, never `data-wave` — the wave in the file is **output**,
 * recomputed on every render. Trusting it would let a hand-edit set an order
 * the dependencies do not support.
 */
export function parseItems(html) {
  const rows = html.match(/<tr\b[^>]*data-id="[^"]*"[\s\S]*?<\/tr>/gi) ?? [];
  return rows.map((row) => {
    const attr = (name) => {
      const m = new RegExp(`data-${name}="([^"]*)"`, "i").exec(row);
      return m ? unesc(m[1]) : "";
    };
    const deps = attr("deps").trim();
    return {
      id: attr("id"),
      title: spanText(row, "t"),
      detail: spanText(row, "d"),
      spec: spanText(row, "s"),
      deps: deps ? deps.split(/\s+/) : [],
      pri: attr("pri") || "P1",
      size: attr("size") || "M",
      lane: attr("lane") || "",
      pr: attr("pr") || "",
      status: attr("status") || "backlog",
      issue: linkHref(row, "issue"),
      prLink: linkHref(row, "pr"),
    };
  });
}

/** The header facts, so a re-render does not lose them. */
export function parseMeta(html) {
  const one = (name, fallback = "") => {
    const m = new RegExp(`<meta name="gx-${name}" content="([^"]*)"`, "i").exec(
      html,
    );
    return m ? unesc(m[1]) : fallback;
  };
  return {
    component: one("component"),
    prefix: one("prefix"),
    stage: one("stage", "backlog"),
    source: one("source"),
    generated: one("generated"),
  };
}

/**
 * Analysis report: the "results" page for collected data, as one standalone HTML file.
 *
 *   cd frontend
 *   npm run report -- ../data/export/trials.json                # experiment sessions only
 *   npm run report -- ../data/export/trials.json --mode pilot   # pilot sessions only
 *   npm run report -- ../data/export/trials.json --mode all     # everything
 *   npm run report -- <trials.json> --out <file.html>           # choose the output file
 *   npm run report -- <trials.json> --study <study.json>        # another stimulus set
 *
 * Input: trials.json from `uv run python cli.py export` (backend). Output (default:
 * report.html next to the input): all participants pooled, a table per participant, and each
 * participant's own results page. It uses the same code as the in-experiment results page
 * (src/ui/bias-report.ts), loaded through Vite so the TypeScript runs as is. Frame count,
 * end labels (e.g. Sad/Happy) and group order come from stimuli/study.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MODES = { experiment: ["Intermixed"], pilot: ["pilot"], debug: ["debug"], all: null };

function parseArgs(argv) {
  const args = {
    input: null,
    mode: "experiment",
    out: null,
    study: resolve(FRONTEND, "../stimuli/study.json"),
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--mode") args.mode = argv[++i];
    else if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--study") args.study = resolve(argv[++i]);
    else args.input = argv[i];
  }
  if (!args.input)
    throw new Error(
      "Usage: npm run report -- <trials.json> [--mode experiment|pilot|debug|all] [--out file.html] [--study study.json]",
    );
  if (!(args.mode in MODES))
    throw new Error(`--mode must be one of ${Object.keys(MODES).join(", ")}`);
  return args;
}

/** experiment / pilot / debug, from the participant's condition (or the data's session_mode). */
function sessionKind(row) {
  if (row.condition === "pilot" || row.session_mode === "pilot") return "pilot";
  if (row.condition === "debug" || row.session_mode === "debug") return "debug";
  return "experiment";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = JSON.parse(readFileSync(resolve(args.input), "utf8"));
  const raw = JSON.parse(readFileSync(args.study, "utf8"));
  const study = {
    frames: raw.frames,
    ends: raw.ends ?? ["start", "end"],
    groups: Object.keys(raw.groups ?? {}),
    studied_frames: raw.studied_frames,
  };
  const kinds = args.mode === "all" ? null : new Set([args.mode]);
  const trials = rows.filter(
    (r) => r.experiment_phase === "main" && (kinds === null || kinds.has(sessionKind(r))),
  );

  const vite = await createServer({
    root: FRONTEND,
    logLevel: "error",
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
  });
  let html;
  try {
    const { biasReportFromTrials } = await vite.ssrLoadModule("/src/ui/bias-report.ts");
    const { summarizeBias } = await vite.ssrLoadModule("/src/design/bias.ts");
    const { escapeHtml } = await vite.ssrLoadModule("/src/ui/template.ts");
    html = buildPage({
      trials,
      args,
      rows,
      study,
      biasReportFromTrials,
      summarizeBias,
      escapeHtml,
    });
  } finally {
    await vite.close();
  }

  const out = resolve(args.out ?? resolve(dirname(resolve(args.input)), "report.html"));
  writeFileSync(out, html);
  const people = new Set(trials.map((t) => t.worker_id)).size;
  console.log(`${trials.length} trials from ${people} participants (${args.mode}) → ${out}`);
}

function buildPage({ trials, args, rows, study, biasReportFromTrials, summarizeBias, escapeHtml }) {
  const byWorker = new Map();
  for (const t of trials) byWorker.set(t.worker_id, [...(byWorker.get(t.worker_id) ?? []), t]);

  const signed = (v) => (v > 0 ? `+${v.toFixed(2)}` : v < 0 ? `−${(-v).toFixed(2)}` : "0.00");
  const groupNames = [...new Set([...study.groups, ...trials.map((t) => t.group)])].filter((g) =>
    trials.some((t) => t.group === g),
  );
  const groupCell = (groups, name) => {
    const g = groups.find((x) => x.group === name);
    return g ? signed(g.error) : "–";
  };
  const participantRows = [...byWorker.entries()]
    .map(([worker, ts]) => {
      const { groups } = summarizeBias(ts, study.ends, study.groups);
      const all = groups.find((g) => g.group === "all");
      return `<tr>
        <td><a href="#p-${escapeHtml(worker)}">${escapeHtml(worker)}</a></td>
        <td>${escapeHtml(sessionKind(ts[0]))}</td>
        <td class="num">${ts.length}</td>
        ${groupNames.map((g) => `<td class="num">${groupCell(groups, g)}</td>`).join("")}
        <td class="num">${all ? all.abs_error.toFixed(2) : "–"}</td>
        <td>${escapeHtml(String(ts[0].end_time ?? ""))}</td>
      </tr>`;
    })
    .join("");

  const perParticipant = [...byWorker.entries()]
    .map(
      ([worker, ts]) => `
      <details class="participant" id="p-${escapeHtml(worker)}">
        <summary><strong>${escapeHtml(worker)}</strong> · ${ts.length} trials</summary>
        ${biasReportFromTrials(ts, study)}
      </details>`,
    )
    .join("");

  const css = [
    readFileSync(
      resolve(FRONTEND, "node_modules/bootswatch/dist/flatly/bootstrap.min.css"),
      "utf8",
    ),
    readFileSync(resolve(FRONTEND, "src/styles/main.css"), "utf8"),
  ].join("\n");

  const body = trials.length
    ? `
      <h2 class="h3 mt-4">All participants pooled</h2>
      ${biasReportFromTrials(trials, study)}
      <h2 class="h3 mt-5">Per participant</h2>
      <p class="bias-report__note">Mean shift per group in frames (+ toward
        ${escapeHtml(study.ends[1])}, − toward ${escapeHtml(study.ends[0])}); error size = mean
        distance between viewed and reproduced frame. Click a name for that participant's plots.</p>
      <table class="table table-sm bias-report__table">
        <thead><tr><th>Participant</th><th>Mode</th><th class="num">Trials</th>
          ${groupNames.map((g) => `<th class="num">${escapeHtml(g)}</th>`).join("")}
          <th class="num">Error size</th><th>Finished</th></tr></thead>
        <tbody>${participantRows}</tbody>
      </table>
      ${perParticipant}`
    : `<p>No memory trials for mode "${escapeHtml(args.mode)}" in this file.</p>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Memory-bias report (${escapeHtml(args.mode)})</title>
  <style>${css}
    .participant { margin: 1.5rem 0; border-top: 1px solid #dee2e6; padding-top: 0.75rem; }
    .participant > summary { cursor: pointer; font-size: 1.1rem; }
  </style>
</head>
<body>
  <main class="container my-4">
    <h1 class="h2">Memory-bias report</h1>
    <p class="text-muted">Mode: <strong>${escapeHtml(args.mode)}</strong> ·
      ${trials.length} trials from ${byWorker.size} participants ·
      source: ${escapeHtml(args.input)} (${rows.length} data rows) ·
      made ${escapeHtml(new Date().toISOString().slice(0, 16).replace("T", " "))} UTC</p>
    ${body}
  </main>
</body>
</html>`;
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});

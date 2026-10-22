/**
 * The memory-bias report: shown on the results page (pilot / debug), and used by the dev
 * preview page and `npm run report` for collected data.
 */
import { summarizeBias, type BiasTrialRow, type GroupBias, type TrialBias } from "../design/bias";
import { conditionPlotsHtml, groupStyles, type GroupStyle } from "./bias-plots";
import { escapeHtml } from "./template";

/** The study the trials come from (normally `session.design`, i.e. stimuli/study.json). */
export interface ReportStudy {
  frames: number;
  ends: readonly [string, string];
  /** Group order (and colours); groups not listed come after, alphabetically. */
  groups?: readonly string[];
  /** Range the studied faces were drawn from, shaded in the "viewed" plots. */
  studied_frames?: readonly [number, number];
}

const signed = (v: number) => (v > 0 ? `+${v.toFixed(2)}` : v < 0 ? `−${(-v).toFixed(2)}` : "0.00");
const signedInt = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");

/** HTML for the report, or "" if the rows contain no memory trials. */
export function biasReportHtml(
  rows: readonly Record<string, unknown>[],
  study: ReportStudy,
): string {
  const trials = rows.filter((r) => r.experiment_phase === "main") as unknown as BiasTrialRow[];
  return biasReportFromTrials(trials, study);
}

/** The same, from memory-trial rows directly. */
export function biasReportFromTrials(trials: readonly BiasTrialRow[], study: ReportStudy): string {
  if (trials.length === 0) return "";
  const { groups, trials: perTrial } = summarizeBias(trials, study.ends, study.groups);
  const styles = groupStyles(groups.filter((g) => g.group !== "all").map((g) => g.group));
  const scale = { frames: study.frames, ends: study.ends };
  const [low, high] = study.ends;

  const groupRows = groups
    .map(
      (g) => `<tr class="${g.group === "all" ? "table-light fw-semibold" : ""}">
        <td>${escapeHtml(g.group)}</td>
        <td class="num">${g.n}</td>
        <td class="num">${signed(g.error)}</td>
        <td>${escapeHtml(g.direction)}</td>
        <td class="num">${g.abs_error.toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  const trialRows = perTrial
    .map(
      (t) => `<tr>
        <td class="num">${t.trial_number ?? ""}</td>
        <td>${escapeHtml(t.group)}</td>
        <td>${escapeHtml(t.identity)}</td>
        <td class="num">${t.target_frame}</td>
        <td class="num">${t.response_frame}</td>
        <td class="num">${signedInt(t.error)}</td>
        <td>${escapeHtml(t.direction)}</td>
      </tr>`,
    )
    .join("");

  return `
    <section class="bias-report">
      <h2 class="h4">Memory bias</h2>
      <p class="bias-report__note">Frames run from ${escapeHtml(low)} (0) to ${escapeHtml(high)}
        (${study.frames - 1}). Hover a dot or arrow for the identity and exact frames; the
        number next to an arrow is the identity (WM_ omitted).</p>
      ${conditionPlotsHtml(perTrial, scale, styles, study.studied_frames)}
      <h3 class="h5 mt-4">Average: mean memory bias per group</h3>
      <p class="bias-report__note">Reproduced frame − viewed frame, averaged: + toward
        ${escapeHtml(high)}, − toward ${escapeHtml(low)}.</p>
      <div class="bias-report__overview">
      ${biasLanesSvg(groups, perTrial, styles, scale.ends)}
      <table class="table table-sm bias-report__table">
        <thead><tr>
          <th>Group</th><th class="num">Trials</th><th class="num">Mean shift (frames)</th>
          <th>Direction of the mean</th><th class="num">Mean error size</th>
        </tr></thead>
        <tbody>${groupRows}</tbody>
      </table>
      </div>
      <p class="bias-report__note">Opposite shifts cancel out in the mean, so "mean error
        size" (average distance between viewed and reproduced frame) shows overall accuracy.</p>
      <details>
        <summary>Per trial (${perTrial.length})</summary>
        <table class="table table-sm bias-report__table">
          <thead><tr>
            <th class="num">#</th><th>Group</th><th>Identity</th><th class="num">Viewed</th>
            <th class="num">Reproduced</th><th class="num">Shift</th><th>Direction</th>
          </tr></thead>
          <tbody>${trialRows}</tbody>
        </table>
      </details>
    </section>`;
}

/**
 * One lane per group (and "all"): every trial's shift as a faint dot and the group's mean
 * shift as an arrow from 0. The axis zooms to fit the shifts (at least ±5 frames).
 */
function biasLanesSvg(
  groups: readonly GroupBias[],
  trials: readonly TrialBias[],
  styles: Record<string, GroupStyle>,
  ends: readonly [string, string],
): string {
  const series = (g: string): GroupStyle | undefined =>
    g === "all" ? { color: "#3d3d3a", label: "All" } : styles[g];
  const largest = Math.max(5, ...trials.map((t) => Math.abs(t.error)));
  const half = Math.ceil(largest / 5) * 5;
  const W = 360;
  const M = 24;
  const LANE = 40;
  const top = 10;
  const lanes = groups.filter((g) => g.n > 0 && series(g.group));
  const base = top + lanes.length * LANE;
  const H = base + 40;
  const x = (v: number) => M + ((v + half) / (2 * half)) * (W - 2 * M);
  const ticks = [-half, -half / 2, 0, half / 2, half];

  const body = lanes
    .map((g, i) => {
      const s = series(g.group)!;
      const y = top + i * LANE + LANE / 2;
      const members = g.group === "all" ? trials : trials.filter((t) => t.group === g.group);
      const dots =
        g.group === "all"
          ? ""
          : members
              .map(
                (t, k) =>
                  `<circle cx="${x(t.error)}" cy="${y - 8 + ((k * 7) % 16)}" r="3.5" fill="${s.color}" class="bias-board__dot"><title>${escapeHtml(`${t.identity}: ${t.target_frame} → ${t.response_frame} (${signedInt(t.error)})`)}</title></circle>`,
              )
              .join("");
      const id = `lane-head-${i}`;
      const dash = g.group === "all" ? ` stroke-dasharray="6 4"` : "";
      const arrow =
        g.error === 0
          ? `<circle cx="${x(0)}" cy="${y}" r="5" fill="none" stroke="${s.color}" stroke-width="2.5"/>`
          : `<defs><marker id="${id}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${s.color}"/></marker></defs>
             <line x1="${x(0)}" y1="${y}" x2="${x(g.error)}" y2="${y}" stroke="${s.color}" stroke-width="3.5" stroke-linecap="round"${dash} marker-end="url(#${id})"/>`;
      return `<g class="bias-board__mean"><title>${escapeHtml(`${s.label} mean: ${signed(g.error)} frames · ${g.direction} · ${g.n} trials`)}</title>
        <text x="${M}" y="${y - 12}" class="bias-board__label">${escapeHtml(s.label)}</text>
        ${dots}${arrow}</g>`;
    })
    .join("");

  return `
    <figure class="bias-board">
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"
        aria-label="Mean memory bias per group, in frames">
        <line x1="${x(0)}" y1="${top}" x2="${x(0)}" y2="${base}" class="bias-board__axis"/>
        <line x1="${M}" y1="${base}" x2="${W - M}" y2="${base}" class="bias-board__axis"/>
        ${ticks.map((v) => `<text x="${x(v)}" y="${base + 14}" text-anchor="middle" class="cond-plots__label">${signedInt(v)}</text>`).join("")}
        <text x="${M}" y="${base + 32}" class="bias-board__corner">← ${escapeHtml(ends[0])}</text>
        <text x="${W - M}" y="${base + 32}" text-anchor="end" class="bias-board__corner">${escapeHtml(ends[1])} →</text>
        ${body}
      </svg>
      <figcaption class="bias-report__note">0 = the viewed face. Arrows: each group's mean
        shift (dashed: all trials); dots: single trials. In frames, ±${half} shown.</figcaption>
    </figure>`;
}

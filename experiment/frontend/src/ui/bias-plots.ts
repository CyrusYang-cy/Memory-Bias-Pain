/**
 * Per-group plots for the results page, all on the same morph axis (frame 0 = `ends[0]`
 * on the left … last frame = `ends[1]` on the right):
 *
 *   1. Viewed faces       which frames were studied (one dot per trial, stacked)
 *   2. Reproduced faces   where the participant ended up
 *   3. Shift              one arrow per trial from the viewed to the reproduced frame,
 *                         sorted by viewed frame and labelled with the identity
 *
 * One column per group, so the rows line up for comparison.
 */
import type { MorphScale, TrialBias } from "../design/bias";
import { escapeHtml } from "./template";

/** Series colours by group position in study.json (validated categorical slots). */
const PALETTE = ["#2a78d6", "#eb6834", "#1baa7d", "#8a5cd8", "#c7417b", "#7a7a7a"];

export interface GroupStyle {
  color: string;
  label: string;
}

/** Colour and label of each group, in the given order. */
export function groupStyles(groups: readonly string[]): Record<string, GroupStyle> {
  return Object.fromEntries(
    groups.map((g, i) => [g, { color: PALETTE[i % PALETTE.length]!, label: g }]),
  );
}

const WIDTH = 340; // plot width in px
const MARGIN = 20; // left/right room for the end labels
const AXIS_W = WIDTH - 2 * MARGIN;

/** Frame → x position. */
const xOf = (frame: number, scale: MorphScale) => MARGIN + (frame / (scale.frames - 1)) * AXIS_W;

/** HTML for the 3 × groups grid of plots. */
export function conditionPlotsHtml(
  trials: readonly TrialBias[],
  scale: MorphScale,
  styles: Record<string, GroupStyle>,
  studied?: readonly [number, number],
): string {
  const groups = Object.keys(styles).filter((g) => trials.some((t) => t.group === g));
  if (groups.length === 0) return "";
  const byGroup = (g: string) => trials.filter((t) => t.group === g);

  const rows: Array<[string, string, (ts: TrialBias[], color: string) => string]> = [
    [
      "Viewed faces",
      studied
        ? `Which frames were studied (shaded: the studied range ${studied[0]}–${studied[1]}).`
        : "Which frames were studied.",
      (ts, color) => dotPlot(ts, (t) => t.target_frame, color, scale, studied, "viewed"),
    ],
    [
      "Reproduced faces",
      `Where the participant ended up (anywhere from 0 to ${scale.frames - 1}).`,
      (ts, color) => dotPlot(ts, (t) => t.response_frame, color, scale, studied, "reproduced"),
    ],
    [
      "Shift: viewed → reproduced",
      "One arrow per trial, sorted by viewed frame; a ring means no shift.",
      (ts, color) => shiftPlot(ts, color, scale),
    ],
  ];

  const header = groups
    .map(
      (g) => `<div class="cond-plots__head" style="--group:${styles[g]!.color}">
        ${escapeHtml(styles[g]!.label)} <span>(${byGroup(g).length} trials)</span></div>`,
    )
    .join("");

  const body = rows
    .map(
      ([title, note, draw]) => `
      <div class="cond-plots__row-title"><strong>${title}</strong> <span>${note}</span></div>
      ${groups
        .map(
          (g) => `<figure class="cond-plots__cell">${draw(byGroup(g), styles[g]!.color)}</figure>`,
        )
        .join("")}`,
    )
    .join("");

  return `
    <div class="cond-plots" style="--cols:${groups.length}">
      ${header}
      ${body}
    </div>`;
}

/** The morph axis at height `y`: line, ticks every 10 frames, end labels below. */
function axis(y: number, scale: MorphScale): string {
  const last = scale.frames - 1;
  const ticks = [];
  for (let f = 0; f <= last; f += 10) ticks.push(f);
  if (ticks.at(-1) !== last) ticks.push(last);
  return `
    <line x1="${MARGIN}" y1="${y}" x2="${WIDTH - MARGIN}" y2="${y}" class="bias-board__axis"/>
    ${ticks
      .map(
        (
          f,
        ) => `<line x1="${xOf(f, scale)}" y1="${y}" x2="${xOf(f, scale)}" y2="${y + 4}" class="bias-board__axis"/>
        <text x="${xOf(f, scale)}" y="${y + 15}" text-anchor="middle" class="cond-plots__label">${f}</text>`,
      )
      .join("")}
    <text x="${MARGIN}" y="${y + 30}" text-anchor="start" class="bias-board__corner">${escapeHtml(scale.ends[0])}</text>
    <text x="${WIDTH - MARGIN}" y="${y + 30}" text-anchor="end" class="bias-board__corner">${escapeHtml(scale.ends[1])}</text>`;
}

/** One dot per trial at `frameOf(trial)`; trials on the same frame stack upward. */
function dotPlot(
  trials: readonly TrialBias[],
  frameOf: (t: TrialBias) => number,
  color: string,
  scale: MorphScale,
  studied: readonly [number, number] | undefined,
  what: string,
): string {
  const R = 4.5;
  const stack = new Map<number, number>();
  const placed = trials.map((t) => {
    const f = frameOf(t);
    const k = stack.get(f) ?? 0;
    stack.set(f, k + 1);
    return { t, f, k };
  });
  const tallest = Math.max(1, ...stack.values());
  const base = 12 + tallest * (2 * R + 1);
  const height = base + 36;
  const band = studied
    ? `<rect x="${xOf(studied[0], scale) - 2}" y="4" width="${xOf(studied[1], scale) - xOf(studied[0], scale) + 4}" height="${base - 4}" class="cond-plots__band"/>`
    : "";
  const dots = placed
    .map(
      ({ t, f, k }) => `<g class="cond-plots__point">
        <title>${escapeHtml(`${t.identity} · ${what} frame ${f}` + (what === "reproduced" ? ` (viewed ${t.target_frame}, ${t.error > 0 ? "+" : ""}${t.error})` : ""))}</title>
        <circle cx="${xOf(f, scale)}" cy="${base - R - 2 - k * (2 * R + 1)}" r="${R}" fill="${color}" stroke="#fff" stroke-width="1"/>
      </g>`,
    )
    .join("");
  return svg(height, `${band}${axis(base, scale)}${dots}`, `${what} frames`);
}

/** One row per trial (sorted by viewed frame): identity, then an arrow viewed → reproduced. */
function shiftPlot(trials: readonly TrialBias[], color: string, scale: MorphScale): string {
  const ROW = 11;
  const sorted = [...trials].sort(
    (a, b) => a.target_frame - b.target_frame || a.response_frame - b.response_frame,
  );
  const top = 6;
  const base = top + sorted.length * ROW + 6;
  const id = `shift-head-${color.slice(1)}`;
  const head = `<defs><marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${color}"/></marker></defs>`;
  const rows = sorted
    .map((t, i) => {
      const y = top + i * ROW + ROW / 2;
      const a = xOf(t.target_frame, scale);
      const b = xOf(t.response_frame, scale);
      const tip = `${t.identity} · viewed ${t.target_frame} → reproduced ${t.response_frame} (${t.error > 0 ? "+" : ""}${t.error}) · ${t.direction}`;
      const label = `<text x="${MARGIN - 4}" y="${y + 3}" text-anchor="end" class="cond-plots__label">${escapeHtml(t.identity.replace("WM_", ""))}</text>`;
      const mark =
        t.error === 0
          ? `<circle cx="${a}" cy="${y}" r="4" fill="none" stroke="${color}" stroke-width="2"/>`
          : `<circle cx="${a}" cy="${y}" r="2.5" fill="${color}"/>
             <line x1="${a}" y1="${y}" x2="${b}" y2="${y}" stroke="${color}" stroke-width="2" stroke-linecap="round" marker-end="url(#${id})"/>`;
      return `<g class="cond-plots__vector"><title>${escapeHtml(tip)}</title>${label}${mark}</g>`;
    })
    .join("");
  return svg(base + 36, `${head}${axis(base, scale)}${rows}`, "shift per trial");
}

function svg(height: number, inner: string, label: string): string {
  return `<svg viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" role="img" aria-label="${escapeHtml(label)}">${inner}</svg>`;
}

/**
 * Memory bias summary for the results page.
 *
 * Bias = reproduced frame − viewed frame, along the morph (frame 0 = `ends[0]`, the last
 * frame = `ends[1]`; e.g. Sad … Happy). Positive = shifted toward `ends[1]`.
 */

/** The fields of a memory-trial data row that the summary needs. */
export interface BiasTrialRow {
  trial_number?: number;
  group: string;
  identity: string;
  target_frame: number;
  /** The reproduced frame. */
  response: number;
}

/** The morph the frames live on: how many frames, and what the two ends look like. */
export interface MorphScale {
  frames: number;
  ends: readonly [string, string];
}

export interface TrialBias {
  trial_number: number | null;
  group: string;
  identity: string;
  target_frame: number;
  response_frame: number;
  /** response − target, in frames. */
  error: number;
  direction: string;
}

export interface GroupBias {
  group: string;
  n: number;
  /** Mean signed error (the bias), in frames. */
  error: number;
  /** Mean absolute error (accuracy, regardless of direction), in frames. */
  abs_error: number;
  direction: string;
}

/** Mean shifts smaller than this many frames are reported as "no clear shift". */
export const NO_SHIFT_BELOW = 0.5;

/** Which end of the morph a shift points toward, in words. */
export function biasDirection(error: number, ends: readonly [string, string]): string {
  if (Math.abs(error) < NO_SHIFT_BELOW) return "no clear shift";
  return `toward ${error > 0 ? ends[1] : ends[0]}`;
}

export function trialBias(row: BiasTrialRow, ends: readonly [string, string]): TrialBias {
  const error = row.response - row.target_frame;
  return {
    trial_number: row.trial_number ?? null,
    group: row.group,
    identity: row.identity,
    target_frame: row.target_frame,
    response_frame: row.response,
    error,
    direction: biasDirection(error, ends),
  };
}

/** Group names in `order` first (e.g. study.json order), then any others alphabetically. */
export function orderGroups(names: Iterable<string>, order: readonly string[] = []): string[] {
  const present = new Set(names);
  const rest = [...present].filter((g) => !order.includes(g)).sort();
  return [...order.filter((g) => present.has(g)), ...rest];
}

/** Per-group means, followed by all trials together ("all"). */
export function summarizeBias(
  rows: readonly BiasTrialRow[],
  ends: readonly [string, string],
  groupOrder: readonly string[] = [],
): { groups: GroupBias[]; trials: TrialBias[] } {
  const trials = rows.map((r) => trialBias(r, ends));
  const summarize = (group: string, members: TrialBias[]): GroupBias => {
    const n = members.length;
    const mean = (pick: (t: TrialBias) => number) =>
      n === 0 ? 0 : round(members.reduce((sum, t) => sum + pick(t), 0) / n);
    const error = mean((t) => t.error);
    return {
      group,
      n,
      error,
      abs_error: mean((t) => Math.abs(t.error)),
      direction: biasDirection(error, ends),
    };
  };
  const groups = orderGroups(
    trials.map((t) => t.group),
    groupOrder,
  );
  return {
    groups: [
      ...groups.map((g) =>
        summarize(
          g,
          trials.filter((t) => t.group === g),
        ),
      ),
      summarize("all", trials),
    ],
    trials,
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100 + 0; // + 0 turns -0 into 0
}

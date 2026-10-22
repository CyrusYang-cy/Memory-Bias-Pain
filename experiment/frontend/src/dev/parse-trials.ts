/**
 * Dev tool: turn pasted results back into memory-trial rows, so the results page can be
 * drawn from data copied out of an earlier session. Accepts either
 *
 *   - the "Per trial" table from the results page (tab-separated:
 *     trial, group, identity, viewed, reproduced, shift, direction), or
 *   - the raw jsPsych data (a JSON array, as shown under "All data").
 */
import type { BiasTrialRow } from "../design/bias";

export function parseTrials(text: string): BiasTrialRow[] {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) {
    const rows = JSON.parse(trimmed) as Array<Record<string, unknown>>;
    return rows.filter((r) => r.experiment_phase === "main") as unknown as BiasTrialRow[];
  }
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.split("\t").map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 5 && /^\d+$/.test(cells[3] ?? ""))
    .map(([trial, group, identity, viewed, reproduced]) => ({
      trial_number: Number(trial),
      group: group!,
      identity: identity!,
      target_frame: Number(viewed),
      response: Number(reproduced),
    }));
}

/**
 * Developer shortcuts for debug mode (`?mode=debug`, the dev server's default; see
 * config/mode.ts), controlled with URL parameters. Ignored in experiment and pilot mode.
 *
 *   ?phases=intro,task     run exactly these phases (default: fullscreen, task, results)
 *   ?skip=fullscreen       leave phases out of whichever set is running
 *                          (phase names: see PHASES; groups: intro, outro)
 *   ?trials=4              run only the first N memory trials
 *   ?simulate=visual       let jsPsych click through the experiment by itself
 *   ?simulate=data-only    same, but instantly and without drawing anything
 *   ?seed=abc              reproducible randomization (trial order, start angles, ...)
 *   ?save=0                show the data at the end instead of sending it to the server
 *   ?labels=0              no "Reveal" button (frame numbers, answer) on memory trials
 *   ?offline=1             run without a backend (dev server only)
 */

export const PHASES = [
  "consent",
  "fullscreen",
  "attrition",
  "instructions",
  "task",
  "results", // debug only: the memory-bias report
  "survey",
  "debriefing",
] as const;
export type Phase = (typeof PHASES)[number];

/** Names that stand for several phases in ?phases= and ?skip=. */
export const PHASE_GROUPS: Readonly<Record<string, readonly Phase[]>> = {
  intro: ["consent", "fullscreen", "attrition", "instructions"],
  outro: ["survey", "debriefing"],
};

export interface DebugOptions {
  enabled: boolean;
  /** Exactly these phases (in study order), or null for the mode's default set. */
  phases: readonly Phase[] | null;
  skip: ReadonlySet<Phase>;
  maxTrials: number | null;
  simulate: "visual" | "data-only" | null;
  seed: string | null;
  save: boolean;
  offline: boolean;
  /** Offer the "Reveal" button on memory trials (on by default when debugging). */
  labels: boolean;
}

export const NO_DEBUG: DebugOptions = {
  enabled: false,
  phases: null,
  skip: new Set(),
  maxTrials: null,
  simulate: null,
  seed: null,
  save: true,
  offline: false,
  labels: false,
};

/** Phase names / group names, comma-separated → phases in study order. */
function parsePhaseList(value: string, parameter: string): Phase[] {
  const chosen = new Set<Phase>();
  for (const name of value.split(",").map((s) => s.trim())) {
    if (!name) continue;
    const phases = PHASE_GROUPS[name] ?? (PHASES.includes(name as Phase) ? [name as Phase] : null);
    if (!phases) {
      throw new Error(
        `Unknown phase in ?${parameter}=: "${name}". Use ${Object.keys(PHASE_GROUPS).join(", ")}, ` +
          `or one of: ${PHASES.join(", ")}`,
      );
    }
    phases.forEach((p) => chosen.add(p));
  }
  return PHASES.filter((p) => chosen.has(p));
}

export function parseDebugOptions(params: URLSearchParams): DebugOptions {
  const phasesParam = params.get("phases");
  const phases = phasesParam ? parsePhaseList(phasesParam, "phases") : null;
  const skip = new Set(parsePhaseList(params.get("skip") ?? "", "skip"));

  const trials = params.get("trials");
  const maxTrials = trials === null ? null : Number(trials);
  if (maxTrials !== null && !(Number.isInteger(maxTrials) && maxTrials >= 1)) {
    throw new Error(`?trials= must be a whole number of at least 1, got "${trials}"`);
  }
  const simulate = params.get("simulate");
  if (simulate && simulate !== "visual" && simulate !== "data-only") {
    throw new Error(`?simulate= must be "visual" or "data-only", got "${simulate}"`);
  }

  return {
    enabled: true,
    phases,
    skip,
    maxTrials,
    simulate: simulate as DebugOptions["simulate"],
    seed: params.get("seed"),
    save: params.get("save") !== "0",
    offline: params.get("offline") === "1",
    labels: params.get("labels") !== "0",
  };
}

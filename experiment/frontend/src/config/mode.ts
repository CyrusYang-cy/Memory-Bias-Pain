/**
 * The three ways to run the study, chosen with `?mode=` in the URL:
 *
 *   experiment  what participants get: every participant-facing phase, nothing extra
 *   pilot       like experiment, but the face's identity is written under it, the
 *               survey/debriefing are replaced by the results report, ?trials= works, and
 *               the session is marked "pilot" (saved, balanced in its own pool)
 *   debug       developer view: a short default session plus all debug tools
 *               (debug bar, Reveal button, ?skip=, ?phases=, ?simulate=, ?save=0, …)
 *
 * Without `?mode=`, the dev server runs in debug mode and a deployed site in experiment mode
 * (or debug mode if the server has DEBUG_MODE=1). Debug mode is refused on a deployed site
 * without DEBUG_MODE=1, so participants can't switch it on.
 */
import type { Phase } from "./debug";

export const MODES = ["experiment", "pilot", "debug"] as const;
export type Mode = (typeof MODES)[number];

/** Phases each mode runs, in order (debug mode: the default; change with ?phases= / ?skip=). */
export const MODE_PHASES: Readonly<Record<Mode, readonly Phase[]>> = {
  experiment: [
    "consent",
    "fullscreen",
    "attrition",
    "instructions",
    "task",
    "survey",
    "debriefing",
  ],
  pilot: ["consent", "fullscreen", "attrition", "instructions", "task", "results"],
  debug: ["fullscreen", "task", "results"],
};

/** Saved in the `condition` column; pilot and debug sessions are left out of balancing. */
export const MODE_CONDITION: Readonly<Record<Mode, string>> = {
  experiment: "Intermixed",
  pilot: "pilot",
  debug: "debug",
};

/** The mode asked for in the URL, or null if none. */
export function requestedMode(params: URLSearchParams): Mode | null {
  const value = params.get("mode");
  if (value === null || value === "") return null;
  if (!MODES.includes(value as Mode)) {
    throw new Error(`?mode= must be one of ${MODES.join(", ")}; got "${value}"`);
  }
  return value as Mode;
}

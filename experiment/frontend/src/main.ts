/**
 * Entry point: identify the participant, fetch the session configuration, build the
 * timeline and run it. Each step lives in its own module; see README for the map.
 */
import "bootswatch/dist/flatly/bootstrap.min.css";
import "jspsych/css/jspsych.css";
import "./styles/main.css";

import { initJsPsych } from "jspsych";

import { ApiError, HttpApi, OfflineApi } from "./api/client";
import type { RecruitmentInfo } from "./api/types";
import { NO_DEBUG, parseDebugOptions, type DebugOptions } from "./config/debug";
import { requestedMode, type Mode } from "./config/mode";
import { parseRecruitmentInfo } from "./participant/recruitment";
import { DevOverlay } from "./session/devtools";
import { exposeForDebugging, finishSession } from "./session/finish";
import { buildTimeline, sessionPhases } from "./timeline";
import type { ExperimentContext } from "./timeline/context";
import { unsupportedBrowserReason } from "./ui/browser-check";
import { log } from "./ui/log";
import { showError } from "./ui/screens";

async function main(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  // ?mode= (experiment / pilot / debug); default: debug in the dev server, experiment when
  // deployed. A deployed server may also force debug with DEBUG_MODE=1 (checked after /init).
  const asked = requestedMode(params);
  let mode: Mode = asked ?? (import.meta.env.DEV ? "debug" : "experiment");
  let debug: DebugOptions =
    mode === "debug" && import.meta.env.DEV ? parseDebugOptions(params) : NO_DEBUG;

  const browserProblem = unsupportedBrowserReason();
  if (browserProblem && !debug.simulate) return showError(browserProblem);

  const recruitment =
    parseRecruitmentInfo(params) ?? (import.meta.env.DEV ? devParticipant() : null);
  if (!recruitment) {
    return showError(
      "We couldn't find your participant ID. Please open the study using the exact link " +
        "from the recruitment website.",
    );
  }

  const api = debug.offline ? new OfflineApi() : new HttpApi();
  let session;
  try {
    session = await api.init(recruitment, mode);
  } catch (error) {
    log.error("init failed", error);
    return showError(
      error instanceof ApiError
        ? error.message
        : "We could not reach the study server. Please check your connection and reload the page.",
    );
  }
  if (session.experiment.debug_mode && asked === null) mode = "debug";
  if (mode === "debug" && !import.meta.env.DEV && !session.experiment.debug_mode) {
    return showError("Debug mode is not available on this server.");
  }
  if (mode === "debug" && !debug.enabled) debug = parseDebugOptions(params);
  // Pilots may shorten the task with ?trials= (split evenly by group); nothing else applies.
  if (mode === "pilot") debug = { ...NO_DEBUG, maxTrials: parseDebugOptions(params).maxTrials };
  document.title = session.experiment.title;

  const meta = {
    startTime: new Date().toISOString(),
    refreshCount: countPageLoads(session.experiment.name, recruitment.worker_id),
  };
  let overlay: DevOverlay | null = null;
  const jsPsych = initJsPsych({
    show_progress_bar: true,
    message_progress_bar: "Progress",
    on_trial_start: (trial: Parameters<DevOverlay["onTrialStart"]>[0]) =>
      overlay?.onTrialStart(trial),
    on_data_update: (data: Record<string, unknown>) => overlay?.onData(data),
    on_finish: () => finishSession(ctx, meta),
  });

  const seed = jsPsych.randomization.setSeed(debug.seed ?? undefined);
  const ctx: ExperimentContext = {
    mode,
    jsPsych,
    api,
    session,
    recruitment,
    debug,
    seed,
    completionCode: `${jsPsych.randomization.randomID(8).toUpperCase()}-MB`,
  };
  const timeline = buildTimeline(ctx);

  if (debug.enabled) {
    overlay = new DevOverlay(debug, seed);
    exposeForDebugging({ jsPsych, ctx, timeline });
    log.info("Debug options", debug, "— inspect window.__exp in the console");
  }
  if (mode !== "experiment") {
    log.info(`Mode: ${mode} · phases: ${sessionPhases(ctx).join(", ")}`);
  }

  // jsPsych does not export its timeline types; our TimelineNode is structurally the same.
  const jsPsychTimeline = timeline as Parameters<typeof jsPsych.run>[0];
  if (debug.simulate) await jsPsych.simulate(jsPsychTimeline as unknown[], debug.simulate);
  else await jsPsych.run(jsPsychTimeline);
}

/** In the dev server, a missing ID gets a fresh fake one so every reload is a new participant. */
function devParticipant(): RecruitmentInfo {
  const workerId = `dev-${Date.now().toString(36)}`;
  log.info(`No participant ID in the URL; using ${workerId}`);
  return { worker_id: workerId, hit_id: null, assignment_id: null, platform: "turk" };
}

/** How many times this participant has (re)loaded the page before; saved as `refresh_count`. */
function countPageLoads(experimentName: string, workerId: string): number {
  const key = `${experimentName}:${workerId}:page_loads`;
  try {
    const previous = Number(localStorage.getItem(key) ?? 0);
    localStorage.setItem(key, String(previous + 1));
    return previous;
  } catch {
    return 0; // storage disabled
  }
}

main().catch((error: unknown) => {
  log.error(error);
  // Developers see the real reason (e.g. a mistyped ?skip= value); participants a generic one.
  showError(
    import.meta.env.DEV && error instanceof Error
      ? error.message
      : "Something went wrong while loading the study. Please reload the page.",
  );
});

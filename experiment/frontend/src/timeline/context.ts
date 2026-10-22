import type { JsPsych } from "jspsych";

import type { ExperimentApi } from "../api/client";
import type { ParticipantStatus, RecruitmentInfo, SessionConfig } from "../api/types";
import type { DebugOptions } from "../config/debug";
import type { Mode } from "../config/mode";
import { log } from "../ui/log";

/** A jsPsych trial or timeline description. */
export type TimelineNode = Record<string, unknown>;

/** Everything the timeline builders need, passed explicitly instead of via globals. */
export interface ExperimentContext {
  /** experiment, pilot or debug (see config/mode.ts). */
  mode: Mode;
  jsPsych: JsPsych;
  api: ExperimentApi;
  session: SessionConfig;
  recruitment: RecruitmentInfo;
  debug: DebugOptions;
  /** Seed used for all randomization in this session (saved with the data). */
  seed: string;
  completionCode: string;
}

/** Record the participant's progress on the server, without blocking the experiment. */
export function reportStatus(ctx: ExperimentContext, status: ParticipantStatus): void {
  if (!ctx.debug.save) return;
  ctx.api
    .updateStatus(ctx.recruitment.worker_id, status)
    .catch((error) => log.error(`Could not record status ${status}`, error));
}

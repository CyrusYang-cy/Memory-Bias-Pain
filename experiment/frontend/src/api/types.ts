/**
 * Shapes of the backend API. Keep in sync with `backend/app/schemas.py`.
 */

export type Platform = "prolific" | "turk" | "connect" | "sona";

/** Participant progress markers, in the order they are reached. */
export type ParticipantStatus =
  | "started"
  | "working_finished_consent"
  | "working_finished_attrition"
  | "working_finished_instructions"
  | "working_finished_task"
  | "working_finished_survey"
  | "complete"
  | "timeout"
  | "failed";

/** Who the participant is, as read from the recruitment link. */
export interface RecruitmentInfo {
  worker_id: string;
  hit_id: string | null;
  assignment_id: string | null;
  platform: Platform;
}

/** One planned memory trial: which identity, and which of its morph frames to study. */
export interface TrialAssignment {
  group: string;
  identity: string;
  /** The studied frame (within the study's `studied_frames`). */
  target_index: number;
}

/** The stimulus set, from `stimuli/study.json` (see `backend/app/study.py`). */
export interface DesignInfo {
  /** Identities per group used in this deployment. */
  num_identities: number;
  /** Group names, in study.json order (also the folder names). */
  groups: string[];
  /** Images are at `<faces_url>/<group>/<identity>/<frame><extension>`. */
  faces_url: string;
  extension: string;
  /** Frames per identity (0 … frames-1); participants reproduce on this whole range. */
  frames: number;
  /** What frame 0 and the last frame look like, e.g. ["Sad", "Happy"]. */
  ends: [string, string];
  /** Studied faces come from this range (inclusive). */
  studied_frames: [number, number];
  /** Practice morph (`<practice_url>/<frame><extension>`), or null for none. */
  practice_url: string | null;
  practice_frames: number;
}

/** Response of `POST /api/participants/init`. */
export interface SessionConfig {
  participant: {
    worker_id: string;
    anon_id: string;
    status: ParticipantStatus;
    platform: Platform;
  };
  experiment: {
    name: string;
    title: string;
    version_date: string;
    estimated_task_duration: string;
    compensation: string;
    contact_email: string;
    /** When true the data is shown on screen at the end instead of being saved. */
    debug_mode: boolean;
  };
  design: DesignInfo;
  /** This participant's memory trials, balanced across participants by the server. */
  trials: TrialAssignment[];
  /** Where to send the participant at the end; null shows a completion code instead. */
  completion_redirect_url: string | null;
}

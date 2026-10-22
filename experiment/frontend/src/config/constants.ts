/**
 * Fixed parameters of the experiment. Values that differ between deployments
 * (number of identities, compensation, ...) come from the server instead; see
 * `backend/app/config.py`.
 */

/** Timing of one memory trial, in milliseconds. */
export const TRIAL_TIMING = {
  /** Countdown before the target face ("2", "1"). */
  countdownSteps: 2,
  countdownStepMs: 1000,
  /** How long the target face is shown. */
  stimulusMs: 1000,
  /** Blank interval between the target disappearing and the slider appearing. */
  retentionMs: 1500,
  /** Gap after every trial. */
  interTrialMs: 100,
} as const;

/** Geometry and behavior of the circular reproduction slider. */
export const SLIDER = {
  /** Full size of the slider (shrinks to fit small screens). */
  diameterPx: 500,
  /** The response may only be submitted after viewing this many different frames. */
  minFramesViewed: 2,
  /** The face shown when the slider appears is at least this many frames from the target. */
  minStartDistanceFrames: 10,
  /** Practice page: "Next" appears only after this many different faces have been shown. */
  practiceMinFacesViewed: 5,
} as const;

// Which faces, how many frames, which groups: stimuli/study.json (sent by the server as
// `session.design`), not here.

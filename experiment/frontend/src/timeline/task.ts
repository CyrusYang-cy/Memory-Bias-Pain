/** The main memory task: one reproduction trial per planned face. */
import { SLIDER, TRIAL_TIMING } from "../config/constants";
import { frameUrls } from "../design/morph";
import { buildMemoryTrials, limitTrials, type MemoryTrialSpec } from "../design/trials";
import MorphReproductionPlugin from "../plugins/morph-reproduction";
import { imageCache } from "../ui/image-cache";
import type { ExperimentContext, TimelineNode } from "./context";

export function memoryTask(ctx: ExperimentContext): TimelineNode {
  const design = ctx.session.design;
  const { randomization } = ctx.jsPsych;
  let specs = buildMemoryTrials(ctx.session.trials, design.frames, (items) =>
    randomization.shuffle(items),
  );
  if (ctx.debug.maxTrials !== null) {
    // Same number from each group (10 → 5 + 5).
    specs = limitTrials(specs, ctx.debug.maxTrials, (min, max) =>
      randomization.randomInt(min, max),
    );
  }

  const urls = specs.map((spec) => frameUrls(design, spec.group, spec.identity));
  // Load the first trial's faces during the instructions, and each next trial's faces
  // while the current trial is running.
  if (urls[0]) imageCache.prefetch(urls[0]);

  return {
    timeline: specs.map((spec, i) => ({
      ...memoryTrial(spec, urls[i]!),
      debug_labels: ctx.debug.enabled && ctx.debug.labels,
      ends: design.ends,
      studied_frames: design.studied_frames,
      // Pilot: name the face so problems with a stimulus can be noted right away.
      identity_label: ctx.mode === "pilot" ? spec.identity : "",
      on_start: () => {
        const next = urls[i + 1];
        if (next) imageCache.prefetch(next);
      },
    })),
  };
}

function memoryTrial(spec: MemoryTrialSpec, stimuli: string[]): TimelineNode {
  return {
    type: MorphReproductionPlugin,
    stimuli,
    target_frame: spec.target_frame,
    identity: spec.identity,
    memorization_prompt: `<h1 class="h2">Remember this face!</h1>`,
    reproduction_prompt: `<h1 class="h2">Reproduce the face you just saw</h1>`,
    countdown_steps: TRIAL_TIMING.countdownSteps,
    countdown_step_duration: TRIAL_TIMING.countdownStepMs,
    stimulus_duration: TRIAL_TIMING.stimulusMs,
    retention_interval: TRIAL_TIMING.retentionMs,
    slider_diameter: SLIDER.diameterPx,
    min_frames_viewed: SLIDER.minFramesViewed,
    min_start_distance: SLIDER.minStartDistanceFrames,
    post_trial_gap: TRIAL_TIMING.interTrialMs,
    data: {
      experiment_phase: "main",
      trial_number: spec.trial_number,
      identity: spec.identity,
      group: spec.group,
    },
  };
}

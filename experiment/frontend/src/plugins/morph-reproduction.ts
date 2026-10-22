import { ParameterType, type JsPsych, type JsPsychPlugin, type TrialType } from "jspsych";

import { biasDirection } from "../design/bias";
import { normalizeAngle, pickStartValue, valueToFrame } from "../design/morph";
import { CircularSlider } from "../ui/circular-slider";
import { imageCache } from "../ui/image-cache";
import { log } from "../ui/log";
import { MorphLine } from "../ui/morph-line";
import { escapeHtml } from "../ui/template";

const info = <const>{
  name: "morph-reproduction",
  version: "3.0.0",
  parameters: {
    /** URLs of the morph frames, in order. */
    stimuli: { type: ParameterType.IMAGE, array: true, default: undefined, preload: false },
    /** Index into `stimuli` of the face to remember. */
    target_frame: { type: ParameterType.INT, default: undefined },
    memorization_prompt: { type: ParameterType.HTML_STRING, default: "" },
    reproduction_prompt: { type: ParameterType.HTML_STRING, default: "" },
    button_label: { type: ParameterType.STRING, default: "Next" },
    countdown_steps: { type: ParameterType.INT, default: 2 },
    countdown_step_duration: { type: ParameterType.INT, default: 1000 },
    stimulus_duration: { type: ParameterType.INT, default: 1000 },
    /** Blank interval between the target disappearing and the slider appearing. */
    retention_interval: { type: ParameterType.INT, default: 1500 },
    slider_diameter: { type: ParameterType.INT, default: 500 },
    /** Number of different frames that must be viewed before the response can be submitted. */
    min_frames_viewed: { type: ParameterType.INT, default: 2 },
    /** Minimum distance (frames) between the target and the face shown when the slider appears. */
    min_start_distance: { type: ParameterType.INT, default: 10 },
    /** Vertical shift in px; zero keeps the pain PNG canvas centered in the disk. */
    image_offset_y: { type: ParameterType.INT, default: 0 },
    /**
     * Debug only: add a "Reveal" button under the slider that shows frame numbers around the
     * ring, the correct answer and which frame is on screen. Hidden until clicked.
     */
    debug_labels: { type: ParameterType.BOOL, default: false },
    /** What frame 0 and the last frame look like (debug "Reveal" text), e.g. Sad, Happy. */
    ends: { type: ParameterType.STRING, array: true, default: ["start", "end"] },
    /** Range the studied faces come from (shaded in the debug "Reveal" map). */
    studied_frames: { type: ParameterType.INT, array: true, default: [] },
    /** Pilot mode: text shown under the slider while viewing and reproducing (e.g. identity). */
    identity_label: { type: ParameterType.STRING, default: "" },
    /** Identity name, used in the debug "Reveal" text. */
    identity: { type: ParameterType.STRING, default: "" },
  },
  data: {
    /** Reproduced frame (index into `stimuli`). */
    response: { type: ParameterType.INT },
    target_frame: { type: ParameterType.INT },
    /** Memory bias: response − target_frame, in frames (+ toward the last frame). */
    error: { type: ParameterType.INT },
    /** Screen angle of the handle at submission, degrees clockwise from west. */
    response_angle: { type: ParameterType.INT },
    /** ms from trial start (incl. countdown, target and blank) to submission; as in v1. */
    rt: { type: ParameterType.INT },
    /** ms from the slider appearing to submission. */
    response_rt: { type: ParameterType.INT },
    /** Frame shown when the slider appeared. */
    start_frame: { type: ParameterType.INT },
    /** Screen angle (clockwise from west) of slider value 0, randomized per trial. */
    slider_start_angle: { type: ParameterType.INT },
    /** Slider value when the slider appeared. */
    slider_start_value: { type: ParameterType.INT },
    /** Every frame displayed during the response phase, in order (first = start_frame). */
    stimuli_seen: { type: ParameterType.INT, array: true },
    /** performance.now() timestamps matching `stimuli_seen`. */
    stimuli_seen_times: { type: ParameterType.FLOAT, array: true },
  },
};

type Info = typeof info;
/** Trial parameters after jsPsych has filled in the defaults. */
type Trial = Required<TrialType<Info>>;

/**
 * One memory trial: countdown → target face (inside the slider's disk) → blank → reproduce
 * the face by turning the circular slider through the morph frames → "Next".
 *
 * The slider hides the scale: value 0 sits at a random angle on every trial, and half a turn
 * sweeps frame 0 → last frame, the other half back, so the whole range is reachable.
 */
class MorphReproductionPlugin implements JsPsychPlugin<Info> {
  static info = info;

  /** The live slider of the running trial (used by visual simulation). */
  private slider: CircularSlider | null = null;

  constructor(private readonly jsPsych: JsPsych) {}

  async trial(display: HTMLElement, trial: Trial, onLoad?: () => void) {
    const numFrames = trial.stimuli.length;
    const { randomInt } = this.jsPsych.randomization;
    const startAngle = randomInt(0, 359);
    const startValue = pickStartValue(
      trial.target_frame,
      numFrames,
      trial.min_start_distance,
      randomInt,
    );
    const ends = endsOf(trial);

    display.innerHTML = `
      <div class="morph-trial">
        <div class="morph-trial__prompt"></div>
        <div class="morph-trial__stage">
          <div class="morph-trial__slider"></div>
          ${trial.identity_label ? `<div class="identity-label">${escapeHtml(trial.identity_label)}</div>` : ""}
          ${
            trial.debug_labels
              ? `<div class="debug-panel">
                  <button type="button" class="btn btn-sm btn-outline-danger debug-reveal" hidden>Reveal</button>
                  <div class="debug-caption" hidden></div>
                </div>`
              : ""
          }
        </div>
        <div class="morph-trial__countdown h2" aria-live="polite"></div>
        <button type="button" class="btn btn-lg btn-primary morph-trial__next is-invisible" disabled>
          ${trial.button_label}
        </button>
      </div>`;
    const prompt = display.querySelector<HTMLElement>(".morph-trial__prompt")!;
    const countdown = display.querySelector<HTMLElement>(".morph-trial__countdown")!;
    const nextButton = display.querySelector<HTMLButtonElement>(".morph-trial__next")!;
    const revealButton = display.querySelector<HTMLButtonElement>(".debug-reveal");
    const caption = display.querySelector<HTMLElement>(".debug-caption");

    prompt.innerHTML = "Loading&hellip;";
    const frames = await imageCache.loadAll(trial.stimuli);

    // Debug "Reveal": text plus a fixed map of the morph (the slider's layout changes per trial).
    const studied = trial.studied_frames.length === 2 ? trial.studied_frames : undefined;
    const line = new MorphLine(numFrames, ends, studied as [number, number] | undefined);
    line.setAnswer(trial.target_frame);
    const captionText = document.createElement("div");
    caption?.append(captionText, line.element);

    const seen: number[] = [];
    const seenTimes: number[] = [];
    const distinctSeen = new Set<number>();
    let lastFrame = -1;
    let revealed = false;
    const updateCaption = () => {
      if (!caption) return;
      caption.hidden = !revealed;
      if (!revealed || lastFrame < 0) return;
      const shift = lastFrame - trial.target_frame;
      captionText.innerHTML =
        (trial.identity ? `identity: ${escapeHtml(trial.identity)} · ` : "") +
        `now: frame ${lastFrame} · answer: frame ${trial.target_frame}<br>` +
        `shift: ${shift > 0 ? "+" : ""}${shift} · ${escapeHtml(biasDirection(shift, ends))}`;
      line.setCurrent(lastFrame);
    };
    const showFrameForValue = (value: number) => {
      const frame = valueToFrame(value, numFrames);
      if (frame === lastFrame) return;
      lastFrame = frame;
      slider.showImage(frames[frame]!);
      seen.push(frame);
      seenTimes.push(performance.now());
      distinctSeen.add(frame);
      updateCaption();
      if (distinctSeen.size >= trial.min_frames_viewed) {
        // Space was reserved from the start, so showing it doesn't shift the layout.
        nextButton.classList.remove("is-invisible");
        nextButton.disabled = false;
      }
    };

    const slider = new CircularSlider({
      diameter: trial.slider_diameter,
      startAngle,
      initialValue: startValue,
      imageOffsetY: trial.image_offset_y,
      onChange: showFrameForValue,
    });
    this.slider = slider;
    display.querySelector(".morph-trial__slider")!.append(slider.element);
    revealButton?.addEventListener("click", () => {
      revealed = !revealed;
      revealButton.textContent = revealed ? "Hide" : "Reveal";
      // Frame numbers every 30° around the ring (each frame appears twice: there and back).
      slider.setTickLabels(
        revealed
          ? Array.from({ length: 12 }, (_, i) => ({
              value: i * 30,
              text: String(valueToFrame(i * 30, numFrames)),
            }))
          : null,
      );
      updateCaption();
      slider.element.focus({ preventScroll: true }); // keep arrow keys working
    });
    onLoad?.();

    const trialStart = performance.now();

    // 1. Memorization: countdown, then the target face.
    const trialElement = display.querySelector<HTMLElement>(".morph-trial")!;
    trialElement.classList.add("is-observing");
    prompt.innerHTML = trial.memorization_prompt;
    for (let step = trial.countdown_steps; step > 0; step--) {
      countdown.textContent = String(step);
      await this.wait(trial.countdown_step_duration);
    }
    countdown.textContent = "";
    slider.showImage(frames[trial.target_frame]!);
    await this.wait(trial.stimulus_duration);

    // 2. Retention: blank disk, no prompt.
    slider.showImage(null);
    prompt.innerHTML = "";
    await this.wait(trial.retention_interval);

    // 3. Reproduction.
    trialElement.classList.remove("is-observing");
    prompt.innerHTML = trial.reproduction_prompt;
    showFrameForValue(startValue);
    slider.setInteractive(true);
    slider.element.focus({ preventScroll: true });
    if (revealButton) revealButton.hidden = false; // nothing to reveal while viewing
    const responseStart = performance.now();
    log.debug(`target ${trial.target_frame}, start frame ${lastFrame}, start angle ${startAngle}`);

    await new Promise<void>((resolve) =>
      nextButton.addEventListener("click", () => resolve(), { once: true }),
    );

    const end = performance.now();
    this.slider = null;
    display.innerHTML = "";
    const response = valueToFrame(slider.value, numFrames);
    this.jsPsych.finishTrial({
      response,
      target_frame: trial.target_frame,
      error: response - trial.target_frame,
      response_angle: slider.screenAngle,
      rt: Math.round(end - trialStart),
      response_rt: Math.round(end - responseStart),
      start_frame: valueToFrame(startValue, numFrames),
      slider_start_angle: startAngle,
      slider_start_value: startValue,
      stimuli_seen: seen,
      stimuli_seen_times: seenTimes,
    });
  }

  simulate(
    trial: Trial,
    mode: "data-only" | "visual",
    options: { data?: Record<string, unknown> },
    onLoad?: () => void,
  ) {
    if (mode === "data-only") {
      onLoad?.();
      this.jsPsych.finishTrial(this.simulatedData(trial, options));
      return;
    }
    // Visual: run the real trial and drive the slider like a participant would.
    const display = this.jsPsych.getDisplayElement();
    void this.trial(display, trial, onLoad);
    void this.driveSlider(trial);
  }

  private async driveSlider(trial: Trial) {
    await this.wait(fixedDuration(trial) + 300);
    // Images may still be loading; wait until the slider exists and is interactive.
    while (!this.slider?.element.classList.contains("is-interactive")) await this.wait(50);
    const slider = this.slider;
    const numFrames = trial.stimuli.length;
    const targetValue = (trial.target_frame / (numFrames - 1)) * 180 + this.noise(8);
    const steps = 12;
    const from = slider.value;
    const delta = ((normalizeAngle(targetValue - from) + 180) % 360) - 180; // shortest way round
    for (let i = 1; i <= steps; i++) {
      slider.setValue(from + (delta * i) / steps);
      await this.wait(40);
    }
    await this.wait(300);
    const next = this.jsPsych.getDisplayElement().querySelector(".morph-trial__next");
    if (next) this.jsPsych.pluginAPI.clickTarget(next);
  }

  private simulatedData(trial: Trial, options: { data?: Record<string, unknown> }) {
    const { randomInt, sampleExGaussian } = this.jsPsych.randomization;
    const numFrames = trial.stimuli.length;
    const startAngle = randomInt(0, 359);
    const startValue = pickStartValue(
      trial.target_frame,
      numFrames,
      trial.min_start_distance,
      randomInt,
    );
    const responseFrame = Math.min(
      numFrames - 1,
      Math.max(0, trial.target_frame + Math.round(this.noise(4))),
    );
    const responseValue = (responseFrame / (numFrames - 1)) * 180;
    const responseRt = Math.round(sampleExGaussian(3000, 500, 1 / 1000, true));
    const defaults = {
      response: responseFrame,
      target_frame: trial.target_frame,
      error: responseFrame - trial.target_frame,
      response_angle: Math.round(normalizeAngle(startAngle + responseValue)),
      rt: fixedDuration(trial) + responseRt,
      response_rt: responseRt,
      start_frame: valueToFrame(startValue, numFrames),
      slider_start_angle: startAngle,
      slider_start_value: startValue,
      stimuli_seen: [valueToFrame(startValue, numFrames), responseFrame],
      stimuli_seen_times: [0, responseRt],
    };
    return this.jsPsych.pluginAPI.mergeSimulationData(defaults, options);
  }

  private noise(sd: number): number {
    return this.jsPsych.randomization.sampleNormal(0, sd);
  }

  /** setTimeout that jsPsych cancels automatically if the experiment ends early. */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.jsPsych.pluginAPI.setTimeout(resolve, ms));
  }
}

function endsOf(trial: Trial): [string, string] {
  return [trial.ends[0] ?? "start", trial.ends[1] ?? "end"];
}

function fixedDuration(trial: Trial): number {
  return (
    trial.countdown_steps * trial.countdown_step_duration +
    trial.stimulus_duration +
    trial.retention_interval
  );
}

export default MorphReproductionPlugin;

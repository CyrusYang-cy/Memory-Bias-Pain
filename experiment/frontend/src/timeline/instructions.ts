import InstructionsPlugin from "@jspsych/plugin-instructions";

import { SLIDER, TRIAL_TIMING } from "../config/constants";
import { practiceUrls, valueToFrame } from "../design/morph";
import MorphReproductionPlugin from "../plugins/morph-reproduction";
import FormPagePlugin from "../plugins/form-page";
import { CircularSlider } from "../ui/circular-slider";
import { imageCache } from "../ui/image-cache";
import { log } from "../ui/log";
import { reportStatus, type ExperimentContext, type TimelineNode } from "./context";

const page = (html: string) => `<div class="page">${html}</div>`;

const BEFORE_PRACTICE = [
  page(`<p>In this study, you will perform a face memory task. Your job is to view a given face
    and then reproduce it from memory as best as you can.</p>`),
  page(`<p>Each trial follows these steps:</p>
    <ul>
      <li>A countdown will help you focus your attention.</li>
      <li>A single face will appear briefly. Try your best to remember it.</li>
      <li>After a brief blank delay, a circular slider will appear with a face in the middle.</li>
      <li>Move the blue slider around the circle to change the face until it matches the best of your memory.</li>
      <li>Click the <strong>Next</strong> button below to continue.</li>
    </ul>
    <p>To help you understand the nature of this task, let's do a practice trial first!</p>`),
];

const AFTER_PRACTICE = [
  page(`<p>That's it for the instructions! To recap, simply try your best to remember and then
    reproduce each <strong>face</strong> using the circular slider.</p>
    <p>Press the <strong>Next</strong> button when you are ready to start.</p>`),
];

function instructionPages(pages: string[]): TimelineNode {
  return {
    type: InstructionsPlugin,
    pages,
    show_clickable_nav: true,
    allow_backward: false,
    post_trial_gap: TRIAL_TIMING.interTrialMs,
    data: { experiment_phase: "instructions" },
  };
}

/** A page where participants try the slider on a square-to-circle shape continuum. */
function sliderPractice(urls: string[], ctx: ExperimentContext): TimelineNode {
  return {
    type: FormPagePlugin,
    html:
      page(`<p>In the practice trial, you will try to remember a shape instead of a face. After viewing the shape, you are going to use a slider (like the one below) to report what you just saw as accurately as possible.</p>
      <ul>
        <li>Drag the blue circular slider around the ring and watch how the shape changes.</li>
        <li>Try going all the way around the ring.</li>
        <li>When you are ready, click <strong>Next</strong> for a shape memory-practice trial.</li>
      </ul>`) +
      `<div class="practice-slider my-4">
        <div class="practice-slider__mount"></div>
      </div>`,
    post_trial_gap: TRIAL_TIMING.interTrialMs,
    data: { experiment_phase: "instructions" },
    on_load: () => {
      const stage = document.querySelector<HTMLElement>(".practice-slider");
      if (!stage) return; // data-only simulation renders nothing
      // "Next" stays hidden until the participant has explored the slider.
      const nextButton = stage.closest("form")?.querySelector<HTMLElement>('button[type="submit"]');
      // Invisible but still taking its space, so the page doesn't jump when it appears.
      nextButton?.classList.add("is-invisible");
      nextButton?.setAttribute("disabled", "");
      const { randomInt } = ctx.jsPsych.randomization;
      const startValue = randomInt(0, 359);

      imageCache.loadAll(urls).then(
        (frames) => {
          const viewed = new Set<number>();
          const show = (value: number) => {
            const frame = valueToFrame(value, frames.length);
            slider.showImage(frames[frame]!);
            const before = viewed.size;
            viewed.add(frame);
            if (viewed.size === before) return;
            if (viewed.size > 1) stage.classList.remove("is-prompting");
            if (viewed.size === SLIDER.practiceMinFacesViewed && nextButton) {
              nextButton.classList.remove("is-invisible");
              nextButton.removeAttribute("disabled");
            }
          };
          const slider = new CircularSlider({
            diameter: SLIDER.diameterPx,
            startAngle: randomInt(0, 359),
            initialValue: startValue,
            onChange: show,
          });
          show(startValue);
          slider.setInteractive(true);
          stage.querySelector(".practice-slider__mount")!.append(slider.element);
          // Arrows flank the initial knob and indicate movement in either direction.
          // They do not reveal the randomized locations of the continuum endpoints.
          const point = (offset: number) => {
            const a = (slider.screenAngle - 180 + offset) * Math.PI / 180;
            return `${50 + 44 * Math.cos(a)},${50 + 44 * Math.sin(a)}`;
          };
          slider.element.insertAdjacentHTML("beforeend", `
            <svg class="practice-slider__arrows" viewBox="0 0 100 100" aria-hidden="true">
              <defs><marker id="practice-direction-arrow" viewBox="0 0 10 10"
                refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 Z" fill="currentColor" />
              </marker></defs>
              <path d="M ${point(10)} A 44 44 0 0 1 ${point(42)}" />
              <path d="M ${point(-10)} A 44 44 0 0 0 ${point(-42)}" />
            </svg>`);
          stage.classList.add("is-prompting");
        },
        (error: unknown) => {
          log.error("Practice shapes could not be loaded", error);
          stage.textContent = "The practice shapes could not be loaded. Please reload the page to try again.";

        },
      );
    },
  };
}

/** Practice uses exactly the task's countdown, delay, random start and wheel mapping. */
function memoryPractice(urls: string[], ctx: ExperimentContext): TimelineNode {
  return {
    type: MorphReproductionPlugin,
    stimuli: urls,
    target_frame: ctx.jsPsych.randomization.randomInt(15, 45),
    memorization_prompt: `<h1 class="h2">Remember this shape!</h1>`,
    reproduction_prompt: `<h1 class="h2">Reproduce the shape you just saw</h1>`,
    countdown_steps: TRIAL_TIMING.countdownSteps,
    countdown_step_duration: TRIAL_TIMING.countdownStepMs,
    stimulus_duration: TRIAL_TIMING.stimulusMs,
    retention_interval: TRIAL_TIMING.retentionMs,
    slider_diameter: SLIDER.diameterPx,
    min_frames_viewed: SLIDER.minFramesViewed,
    min_start_distance: SLIDER.minStartDistanceFrames,
    ends: ["Square", "Circle"],
    studied_frames: [15, 45],
    data: { experiment_phase: "practice", stimulus_kind: "shape" },
  };
}

function practiceFeedback(urls: string[], ctx: ExperimentContext): TimelineNode {
  return {
    type: FormPagePlugin,
    html: () => {
      const trial = ctx.jsPsych.data.get().filter({ experiment_phase: "practice" }).last(1).values()[0];
      if (!trial) return page("<p>No practice response was recorded.</p>");
      const target = Number(trial.target_frame);
      const response = Number(trial.response);
      const distance = Math.abs(response - target);
      // "Close" means within 10% of the shape continuum, not wheel-angle distance.
      const verdict = distance === 0
        ? "You matched the shape exactly!"
        : distance <= (urls.length - 1) * 0.1
          ? "You are pretty close with your response!"
          : "You did a decent job!";
      return page(`<section class="pain-practice-feedback">
        <h2>Here is how you did:</h2>
        <div class="pain-practice-feedback__shapes">
          <figure class="pain-practice-feedback__target"><img src="${urls[target]}" width="240" height="240" alt="The shape you saw"><figcaption>The shape you saw</figcaption></figure>
          <figure class="pain-practice-feedback__response"><img src="${urls[response]}" width="240" height="240" alt="The shape you chose"><figcaption>The shape you chose</figcaption></figure>
        </div>
        <div class="pain-practice-feedback__message" aria-live="polite">
          <p><strong>${verdict}</strong></p>
          <p>In the main task, use the same slider to reproduce a <strong>face</strong> from memory as accurately as possible.</p>
        </div>
      </section>`);
    },
    data: { experiment_phase: "practice_feedback" },
    on_load: () => {
      const stage = document.querySelector<HTMLElement>(".pain-practice-feedback");
      if (!stage) return;
      const next = stage.closest("form")?.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (next) next.disabled = true;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const images = [...stage.querySelectorAll<HTMLImageElement>("img")];
      Promise.all(images.map((img) => img.decode().catch(() => undefined))).then(() => {
        if (!stage.isConnected) return;
        stage.classList.add("is-revealing");
        ctx.jsPsych.pluginAPI.setTimeout(() => {
          if (stage.isConnected && next) next.disabled = false;
        }, reducedMotion ? 0 : 2000);
      });
    },
  };
}

export function instructions(ctx: ExperimentContext): TimelineNode {
  // Shape-first tutorial and memory practice precede the pain trials.
  const urls = practiceUrls(ctx.session.design);
  if (urls.length > 0) imageCache.prefetch(urls);
  return {
    timeline: [
      instructionPages(BEFORE_PRACTICE),
      ...(urls.length > 0 ? [sliderPractice(urls, ctx), instructionPages([page(`<p>Now, let's do the practice!</p><ul><li>You will be prompted to remember a shape.</li><li>After a short delay, you will need to reproduce it using the slider you just saw.</li></ul>`)]), memoryPractice(urls, ctx), practiceFeedback(urls, ctx)] : []),
      instructionPages(AFTER_PRACTICE),
    ],
    on_timeline_finish: () => reportStatus(ctx, "working_finished_instructions"),
  };
}

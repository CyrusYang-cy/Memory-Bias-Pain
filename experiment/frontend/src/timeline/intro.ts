/** Consent, fullscreen and the attrition check. */
import FullscreenPlugin from "@jspsych/plugin-fullscreen";

import { TRIAL_TIMING } from "../config/constants";
import attritionHtml from "../pages/attrition.html?raw";
import consentHtml from "../pages/consent.html?raw";
import FormPagePlugin from "../plugins/form-page";
import { renderTemplate } from "../ui/template";
import { reportStatus, type ExperimentContext, type TimelineNode } from "./context";

const DECLINED_REDIRECT_URL = "https://www.google.com";

export function consent(ctx: ExperimentContext): TimelineNode {
  const { experiment } = ctx.session;
  return {
    type: FormPagePlugin,
    html: renderTemplate(consentHtml, {
      duration: experiment.estimated_task_duration,
      compensation: experiment.compensation,
      contact_email: experiment.contact_email,
    }),
    post_trial_gap: TRIAL_TIMING.interTrialMs,
    data: { experiment_phase: "consent" },
    on_finish: (data: { response: { consent?: string } }) => {
      if (data.response.consent === "reject") {
        window.location.assign(DECLINED_REDIRECT_URL);
        return;
      }
      reportStatus(ctx, "working_finished_consent");
    },
  };
}

export function enterFullscreen(): TimelineNode {
  return {
    type: FullscreenPlugin,
    fullscreen_mode: true,
    button_label: "Continue",
    message: `
      <div class="page">
        <p>Thanks for agreeing to participate. Welcome! Before we begin, please close any other
          browser windows or tabs you currently have open, and set your mobile devices to silent,
          so that you can more easily pay attention to the task.</p>
        <p>This experiment needs to be conducted in full screen mode. It will switch to full
          screen mode when you press the button below. Don't worry; we'll turn full screen off
          automatically for you at the end of the experiment.</p>
      </div>`,
    delay_after: TRIAL_TIMING.interTrialMs,
    data: { experiment_phase: "fullscreen" },
    on_finish: (data: Record<string, unknown>) => {
      Object.assign(data, {
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        window_width: window.innerWidth,
        window_height: window.innerHeight,
      });
    },
  };
}

export function exitFullscreen(): TimelineNode {
  return {
    type: FullscreenPlugin,
    fullscreen_mode: false,
    delay_after: 0,
    data: { experiment_phase: "fullscreen_exit" },
  };
}

export function attritionCheck(ctx: ExperimentContext): TimelineNode {
  return {
    type: FormPagePlugin,
    html: attritionHtml,
    post_trial_gap: TRIAL_TIMING.interTrialMs,
    data: { experiment_phase: "attrition" },
    on_finish: () => reportStatus(ctx, "working_finished_attrition"),
  };
}

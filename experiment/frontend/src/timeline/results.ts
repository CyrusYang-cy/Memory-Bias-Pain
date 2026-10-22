/**
 * Pilot/debug phase: the memory-bias report (viewed / reproduced / shift plots per group,
 * and the mean bias), right after the task. Never part of a participant's session.
 */
import { TRIAL_TIMING } from "../config/constants";
import FormPagePlugin from "../plugins/form-page";
import { biasReportHtml } from "../ui/bias-report";
import type { ExperimentContext, TimelineNode } from "./context";

export function results(ctx: ExperimentContext): TimelineNode {
  return {
    type: FormPagePlugin,
    // Built when the page starts, from the trials completed so far.
    html: () =>
      `<div class="results-page">
        <div class="alert alert-warning">Pilot and debug modes only: participants never see this page.</div>
        ${biasReportHtml(ctx.jsPsych.data.get().values(), ctx.session.design) || "<p>No memory trials in this session.</p>"}
      </div>`,
    button_label: "Continue",
    post_trial_gap: TRIAL_TIMING.interTrialMs,
    data: { experiment_phase: "results" },
  };
}

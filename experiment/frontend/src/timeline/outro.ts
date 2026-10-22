/** Post-task survey and debriefing. */
import { TRIAL_TIMING } from "../config/constants";
import debriefingHtml from "../pages/debriefing.html?raw";
import surveyHtml from "../pages/survey.html?raw";
import FormPagePlugin from "../plugins/form-page";
import { renderTemplate } from "../ui/template";
import { reportStatus, type ExperimentContext, type TimelineNode } from "./context";

export function survey(ctx: ExperimentContext): TimelineNode {
  return {
    type: FormPagePlugin,
    html: surveyHtml,
    post_trial_gap: TRIAL_TIMING.interTrialMs,
    data: { experiment_phase: "survey" },
    on_start: () => reportStatus(ctx, "working_finished_task"),
    on_finish: () => reportStatus(ctx, "working_finished_survey"),
  };
}

export function debriefing(ctx: ExperimentContext): TimelineNode {
  return {
    type: FormPagePlugin,
    html: renderTemplate(debriefingHtml, { contact_email: ctx.session.experiment.contact_email }),
    post_trial_gap: TRIAL_TIMING.interTrialMs,
    data: { experiment_phase: "debriefing" },
  };
}

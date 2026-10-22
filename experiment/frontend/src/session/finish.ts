import { MODE_CONDITION } from "../config/mode";
import { sessionPhases } from "../timeline";
import type { ExperimentContext } from "../timeline/context";
import { biasReportHtml } from "../ui/bias-report";
import { log } from "../ui/log";
import {
  showCompletionCode,
  showData,
  showPilotSaved,
  showRedirect,
  showSaveFailed,
  showSaving,
} from "../ui/screens";

export interface SessionMeta {
  startTime: string;
  refreshCount: number;
}

/** Runs when the timeline ends: annotate, save (or show) the data, then send the participant on. */
export async function finishSession(ctx: ExperimentContext, meta: SessionMeta): Promise<void> {
  const { jsPsych, session, recruitment } = ctx;
  jsPsych.data.addProperties({
    experiment_name: session.experiment.name,
    version_date: session.experiment.version_date,
    stimuli_faces_url: session.design.faces_url,
    worker_id: recruitment.worker_id,
    hit_id: recruitment.hit_id,
    assignment_id: recruitment.assignment_id,
    platform: recruitment.platform,
    session_mode: ctx.mode,
    anon_id: session.participant.anon_id,
    seed: ctx.seed,
    start_time: meta.startTime,
    end_time: new Date().toISOString(),
    total_time: jsPsych.getTotalTime(),
    refresh_count: meta.refreshCount,
    completion_code: ctx.completionCode,
    ip_address: await ctx.api.clientIp(),
    user_agent: navigator.userAgent,
  });
  const rows = withBrowserEvents(ctx);
  exposeForDebugging({ data: rows });

  // The report was already shown as the "results" phase if that phase ran.
  const report = sessionPhases(ctx).includes("results")
    ? ""
    : biasReportHtml(rows, ctx.session.design);
  if (!ctx.debug.save || session.experiment.debug_mode) {
    showData(rows, report, false);
    return;
  }

  showSaving();
  try {
    await ctx.api.saveData(recruitment.worker_id, MODE_CONDITION[ctx.mode], rows);
  } catch (error) {
    log.error("Saving failed", error);
    showSaveFailed(session.experiment.contact_email, ctx.completionCode);
    return;
  }

  // Pilot and debug sessions end here, without sending anyone to Prolific/SONA.
  if (ctx.mode === "pilot") return showPilotSaved(recruitment.worker_id);
  if (ctx.mode === "debug") return showData(rows, report, true);
  if (session.completion_redirect_url) showRedirect(session.completion_redirect_url);
  else showCompletionCode(ctx.completionCode);
}

/**
 * Attach focus/blur/fullscreen events to the trial they happened in, as `browser_events`
 * (same format as v1).
 */
function withBrowserEvents(ctx: ExperimentContext): Record<string, unknown>[] {
  const events = ctx.jsPsych.data.getInteractionData().values() as Array<{ trial: number }>;
  return (ctx.jsPsych.data.get().values() as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    browser_events: events
      .filter((e) => e.trial === row.trial_index)
      .map(({ trial: _trial, ...event }) => event),
  }));
}

/** Debug handle in the browser console: `window.__exp`. */
export function exposeForDebugging(values: Record<string, unknown>): void {
  const target = window as unknown as { __exp?: Record<string, unknown> };
  target.__exp = { ...target.__exp, ...values };
}

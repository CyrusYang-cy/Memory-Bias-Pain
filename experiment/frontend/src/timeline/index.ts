import type { Phase } from "../config/debug";
import { MODE_PHASES } from "../config/mode";
import type { ExperimentContext, TimelineNode } from "./context";
import { instructions } from "./instructions";
import { attritionCheck, consent, enterFullscreen, exitFullscreen } from "./intro";
import { debriefing, survey } from "./outro";
import { results } from "./results";
import { memoryTask } from "./task";

const BUILDERS: Record<Phase, (ctx: ExperimentContext) => TimelineNode> = {
  consent: (ctx) => consent(ctx),
  fullscreen: () => enterFullscreen(),
  attrition: (ctx) => attritionCheck(ctx),
  instructions: (ctx) => instructions(ctx),
  task: (ctx) => memoryTask(ctx),
  results: (ctx) => results(ctx),
  survey: (ctx) => survey(ctx),
  debriefing: (ctx) => debriefing(ctx),
};

/** Which phases this session runs: the mode's set, adjusted by ?phases= / ?skip= in debug mode. */
export function sessionPhases(ctx: ExperimentContext): Phase[] {
  const base = (ctx.debug.enabled && ctx.debug.phases) || MODE_PHASES[ctx.mode];
  return base.filter((phase) => !ctx.debug.skip.has(phase));
}

/** The whole session, in order. */
export function buildTimeline(ctx: ExperimentContext): TimelineNode[] {
  const phases = sessionPhases(ctx);
  const timeline = phases.map((phase) => BUILDERS[phase](ctx));
  if (phases.includes("fullscreen")) timeline.push(exitFullscreen());
  return timeline;
}

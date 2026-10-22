import type { DebugOptions } from "../config/debug";
import { log } from "../ui/log";

/**
 * A small overlay in the corner showing the current phase/trial and the seed, plus a
 * console line for every finished trial. Only shown when debug options are enabled.
 */
export class DevOverlay {
  private readonly element = document.createElement("div");

  constructor(
    private readonly debug: DebugOptions,
    private readonly seed: string,
  ) {
    this.element.className = "dev-overlay";
    document.documentElement.append(this.element);
    this.update("starting");
  }

  onTrialStart = (trial: {
    type?: { info?: { name?: string } };
    data?: Record<string, unknown>;
  }) => {
    const phase = String(trial.data?.experiment_phase ?? trial.type?.info?.name ?? "");
    const number = trial.data?.trial_number;
    this.update(number === undefined ? phase : `${phase} #${number}`);
  };

  onData = (data: Record<string, unknown>) => {
    log.debug(`trial ${data.trial_index} (${data.trial_type})`, data);
  };

  private update(label: string) {
    const flags = [
      this.debug.simulate && `simulate=${this.debug.simulate}`,
      !this.debug.save && "not saving",
      this.debug.offline && "offline",
    ].filter(Boolean);
    this.element.textContent = `DEBUG · ${label} · seed ${this.seed}${flags.length ? " · " + flags.join(" · ") : ""}`;
  }
}

import type { Mode } from "../config/mode";
import type { DesignInfo, ParticipantStatus, RecruitmentInfo, SessionConfig } from "./types";
import { log } from "../ui/log";

/** Everything the experiment needs from the server. */
export interface ExperimentApi {
  /** Register the participant; `mode` decides whether the session counts for balancing. */
  init(info: RecruitmentInfo, mode: Mode): Promise<SessionConfig>;
  updateStatus(workerId: string, status: ParticipantStatus): Promise<void>;
  saveData(workerId: string, condition: string, trials: object[]): Promise<void>;
  clientIp(): Promise<string>;
}

/** An HTTP error whose message is safe to show to the participant. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RetryOptions {
  retries: number;
  delayMs: number;
  /** Called before each retry, e.g. to show "saving..." to the participant. */
  onRetry?: (attempt: number, error: unknown) => void;
}

const NO_RETRY: RetryOptions = { retries: 0, delayMs: 0 };

/** Talks to the FastAPI backend on the same origin. */
export class HttpApi implements ExperimentApi {
  constructor(private readonly baseUrl = "/api") {}

  init(info: RecruitmentInfo, mode: Mode): Promise<SessionConfig> {
    return this.request<SessionConfig>("POST", "/participants/init", { ...info, mode }, NO_RETRY);
  }

  async updateStatus(workerId: string, status: ParticipantStatus): Promise<void> {
    await this.request(
      "PATCH",
      `/participants/${encodeURIComponent(workerId)}/status`,
      { status },
      {
        retries: 5,
        delayMs: 2000,
      },
    );
    log.info(`status → ${status}`);
  }

  async saveData(workerId: string, condition: string, trials: object[]): Promise<void> {
    await this.request(
      "POST",
      `/participants/${encodeURIComponent(workerId)}/data`,
      { condition, json_data: trials },
      { retries: 10, delayMs: 2000 },
    );
    log.info(`saved ${trials.length} rows`);
  }

  clientIp(): Promise<string> {
    return this.request<string>("GET", "/ip", undefined, NO_RETRY).catch(() => "");
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    retry: RetryOptions,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch(this.baseUrl + path, {
          method,
          headers: body === undefined ? undefined : { "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!response.ok) {
          throw new ApiError(response.status, await errorMessage(response));
        }
        return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
      } catch (error) {
        // Client errors (4xx) will not fix themselves; retrying only helps for network/5xx.
        const retriable = !(error instanceof ApiError && error.status < 500);
        if (!retriable || attempt >= retry.retries) throw error;
        log.warn(`${method} ${path} failed (attempt ${attempt + 1}), retrying`, error);
        retry.onRetry?.(attempt + 1, error);
        await new Promise((resolve) => setTimeout(resolve, retry.delayMs));
      }
    }
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // not JSON
  }
  return `Server error (${response.status})`;
}

/**
 * Stand-in for the backend, for working on the frontend alone (`?offline=1`, dev only).
 * Nothing is saved; data is printed to the console instead.
 */
export class OfflineApi implements ExperimentApi {
  async init(info: RecruitmentInfo, _mode: Mode): Promise<SessionConfig> {
    // No server to balance assignments: one trial per identity; within each group every
    // identity gets a different random frame from the studied range (as on the server).
    const { design, identities } = await offlineStudy();
    const [low, high] = design.studied_frames;
    const trials = design.groups.flatMap((group) => {
      const frames = Array.from({ length: high - low + 1 }, (_, i) => low + i);
      for (let i = frames.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [frames[i], frames[j]] = [frames[j]!, frames[i]!];
      }
      return identities[group]!.slice(0, Math.min(design.num_identities, frames.length)).map(
        (identity, i) => ({ group, identity, target_index: frames[i]! }),
      );
    });
    return {
      participant: {
        worker_id: info.worker_id,
        anon_id: "offline",
        status: "started",
        platform: info.platform,
      },
      experiment: {
        name: "offline",
        title: "Face memory study (offline)",
        version_date: "offline",
        estimated_task_duration: "15 minutes",
        compensation: "$3.00",
        contact_email: "cy36@illinois.edu",
        debug_mode: true,
      },
      design,
      trials,
      completion_redirect_url: null,
    };
  }

  async updateStatus(_workerId: string, status: ParticipantStatus): Promise<void> {
    log.info(`[offline] status → ${status}`);
  }

  async saveData(_workerId: string, _condition: string, trials: object[]): Promise<void> {
    log.info(`[offline] would save ${trials.length} rows`, trials);
  }

  async clientIp(): Promise<string> {
    return "";
  }
}

/** What the server would send, read from stimuli/study.json directly. */
async function offlineStudy(): Promise<{
  design: DesignInfo;
  identities: Record<string, string[]>;
}> {
  const response = await fetch("/stimuli/study.json");
  if (!response.ok) throw new Error("Offline mode: stimuli/study.json not found");
  const study = (await response.json()) as {
    faces_folder?: string;
    extension?: string;
    frames: number;
    ends?: [string, string];
    studied_frames: [number, number];
    groups: Record<string, string[]>;
    practice?: { folder: string; frames: number } | null;
  };
  const design: DesignInfo = {
    num_identities: Math.max(...Object.values(study.groups).map((names) => names.length)),
    groups: Object.keys(study.groups),
    faces_url: `/stimuli/${study.faces_folder ?? "faces"}`,
    extension: study.extension ?? ".png",
    frames: study.frames,
    ends: study.ends ?? ["Start", "End"],
    studied_frames: study.studied_frames,
    practice_url: study.practice ? `/stimuli/${study.practice.folder}` : null,
    practice_frames: study.practice?.frames ?? 0,
  };
  return { design, identities: study.groups };
}

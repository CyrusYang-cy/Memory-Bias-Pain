import type { Platform, RecruitmentInfo } from "../api/types";

/**
 * URL parameters each recruitment platform appends to the study link.
 * Checked in order; the first platform whose id parameter is present wins.
 */
const PLATFORM_PARAMS: ReadonlyArray<{
  platform: Platform;
  id: string;
  hit?: string;
  assignment?: string;
}> = [
  { platform: "prolific", id: "PROLIFIC_PID", hit: "STUDY_ID", assignment: "SESSION_ID" },
  { platform: "sona", id: "sona_id" },
  { platform: "connect", id: "participantId", hit: "projectId", assignment: "assignmentId" },
  { platform: "turk", id: "workerId", hit: "hitId", assignment: "assignmentId" },
];

/** Reads who the participant is from the link they arrived with, or null if unknown. */
export function parseRecruitmentInfo(params: URLSearchParams): RecruitmentInfo | null {
  for (const { platform, id, hit, assignment } of PLATFORM_PARAMS) {
    const workerId = params.get(id)?.trim();
    if (workerId) {
      return {
        worker_id: workerId,
        hit_id: (hit && params.get(hit)) || null,
        assignment_id: (assignment && params.get(assignment)) || null,
        platform,
      };
    }
  }
  return null;
}

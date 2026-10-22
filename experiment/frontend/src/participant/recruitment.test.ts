import { describe, expect, it } from "vitest";

import { parseRecruitmentInfo } from "./recruitment";

const parse = (query: string) => parseRecruitmentInfo(new URLSearchParams(query));

describe("parseRecruitmentInfo", () => {
  it("reads Prolific links", () => {
    expect(parse("?PROLIFIC_PID=p1&STUDY_ID=s1&SESSION_ID=x1")).toEqual({
      worker_id: "p1",
      hit_id: "s1",
      assignment_id: "x1",
      platform: "prolific",
    });
  });

  it("reads SONA links", () => {
    expect(parse("?sona_id=12345")).toEqual({
      worker_id: "12345",
      hit_id: null,
      assignment_id: null,
      platform: "sona",
    });
  });

  it("reads MTurk and CloudResearch Connect links", () => {
    expect(parse("?workerId=w&hitId=h&assignmentId=a")?.platform).toBe("turk");
    expect(parse("?participantId=c&projectId=p&assignmentId=a")?.platform).toBe("connect");
  });

  it("returns null without an id", () => {
    expect(parse("")).toBeNull();
    expect(parse("?PROLIFIC_PID=%20")).toBeNull();
  });
});

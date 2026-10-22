import { describe, expect, it } from "vitest";

import type { TrialAssignment } from "../api/types";
import { buildMemoryTrials } from "./trials";

const plan: TrialAssignment[] = [
  { group: "Dominant", identity: "WM_144", target_index: 15 },
  { group: "Dominant", identity: "WM_149", target_index: 30 },
  { group: "Submissive", identity: "WM_131", target_index: 45 },
];
const reverse = <T>(items: T[]) => [...items].reverse();

describe("buildMemoryTrials", () => {
  it("keeps every planned face, in shuffled order, numbered from 1", () => {
    const trials = buildMemoryTrials(plan, 61, reverse);
    expect(trials.map((t) => t.identity)).toEqual(["WM_131", "WM_149", "WM_144"]);
    expect(trials.map((t) => t.trial_number)).toEqual([1, 2, 3]);
    expect(trials.map((t) => t.target_frame)).toEqual([45, 30, 15]);
  });

  it("rejects targets outside the morph", () => {
    const bad = [{ group: "Dominant", identity: "WM_1", target_index: 61 }];
    expect(() => buildMemoryTrials(bad, 61, (x) => x)).toThrow();
  });
});

describe("limitTrials", () => {
  const groups = (specs: { group: string }[]) => ({
    Dominant: specs.filter((s) => s.group === "Dominant").length,
    Submissive: specs.filter((s) => s.group === "Submissive").length,
  });
  // 30 + 30 trials, shuffled so one group comes first by chance.
  const full = buildMemoryTrials(
    Array.from({ length: 60 }, (_, i) => ({
      group: i < 30 ? "Dominant" : "Submissive",
      identity: `WM_${i}`,
      target_index: 30,
    })),
    61,
    (x) => x,
  );

  it("splits an even number equally between the groups", async () => {
    const { limitTrials } = await import("./trials");
    const ten = limitTrials(full, 10, () => 0);
    expect(groups(ten)).toEqual({ Dominant: 5, Submissive: 5 });
    expect(ten.map((t) => t.trial_number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("gives an odd remainder to a randomly chosen group", async () => {
    const { limitTrials } = await import("./trials");
    expect(groups(limitTrials(full, 5, () => 0))).toEqual({ Dominant: 3, Submissive: 2 });
    expect(groups(limitTrials(full, 5, () => 1))).toEqual({ Dominant: 2, Submissive: 3 });
  });

  it("keeps everything when asked for more trials than there are", async () => {
    const { limitTrials } = await import("./trials");
    expect(limitTrials(full, 100, () => 0)).toHaveLength(60);
  });
});

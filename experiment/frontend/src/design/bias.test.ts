import { describe, expect, it } from "vitest";

import { biasDirection, orderGroups, summarizeBias, type BiasTrialRow } from "./bias";

const ENDS = ["Sad", "Happy"] as const;
const row = (group: string, target: number, response: number): BiasTrialRow => ({
  group,
  identity: "WM_1",
  target_frame: target,
  response,
});

describe("biasDirection", () => {
  it.each([
    [3, "toward Happy"],
    [-2, "toward Sad"],
    [0.4, "no clear shift"],
    [-0.4, "no clear shift"],
    [0, "no clear shift"],
  ])("%s frames → %s", (error, expected) => {
    expect(biasDirection(error, ENDS)).toBe(expected);
  });
});

describe("summarizeBias", () => {
  it("averages the signed and absolute error per group and overall", () => {
    const { groups, trials } = summarizeBias(
      [row("Dominant", 20, 26), row("Dominant", 30, 28), row("Submissive", 40, 35)],
      ENDS,
      ["Submissive", "Dominant"],
    );
    expect(trials.map((t) => t.error)).toEqual([6, -2, -5]);
    expect(groups).toEqual([
      { group: "Submissive", n: 1, error: -5, abs_error: 5, direction: "toward Sad" },
      { group: "Dominant", n: 2, error: 2, abs_error: 4, direction: "toward Happy" },
      { group: "all", n: 3, error: -0.33, abs_error: 4.33, direction: "no clear shift" },
    ]);
  });
});

describe("orderGroups", () => {
  it("puts the given order first and the rest alphabetically", () => {
    expect(orderGroups(["b", "z", "a", "b"], ["z"])).toEqual(["z", "a", "b"]);
  });
});

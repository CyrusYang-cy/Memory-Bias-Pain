import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { summarizeBias } from "../design/bias";
import { parseTrials } from "./parse-trials";

const sample = readFileSync(resolve(import.meta.dirname, "sample-trials.tsv"), "utf8");

/** "+3" / "−2" / "0" → number */
const num = (s: string) => Number(s.replace("−", "-"));

describe("parseTrials on a pasted per-trial table", () => {
  const trials = parseTrials(sample);

  it("reads all 60 trials", () => {
    expect(trials).toHaveLength(60);
    expect(trials.filter((t) => t.group === "Dominant")).toHaveLength(30);
  });

  it("recomputes the same shifts as the pasted table (from the frame numbers alone)", () => {
    const pasted = sample
      .trim()
      .split("\n")
      .map((l) => l.split("\t"));
    const { trials: computed } = summarizeBias(trials, ["Sad", "Happy"]);
    computed.forEach((t, i) => {
      const row = pasted[i]!;
      expect(t.error).toBe(num(row[5]!));
      expect(t.direction).toBe(row[6]);
    });
  });
});

describe("parseTrials on raw jsPsych data", () => {
  it("keeps only the memory trials", () => {
    const json = JSON.stringify([
      { experiment_phase: "consent" },
      { experiment_phase: "main", group: "Dominant", identity: "WM_1", target_frame: 30 },
    ]);
    expect(parseTrials(json)).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";

import type { DesignInfo } from "../api/types";
import { frameUrls, practiceUrls, pickStartValue, valueToFrame } from "./morph";

const DESIGN: DesignInfo = {
  num_identities: 30,
  groups: ["Dominant", "Submissive"],
  faces_url: "/stimuli/faces",
  extension: ".png",
  frames: 61,
  ends: ["Sad", "Happy"],
  studied_frames: [15, 45],
  practice_url: "/stimuli/examples/practice",
  practice_frames: 3,
};

describe("valueToFrame", () => {
  it("sweeps 0 → N-1 over the first half turn and back over the second", () => {
    expect(valueToFrame(0, 61)).toBe(0);
    expect(valueToFrame(90, 61)).toBe(30);
    expect(valueToFrame(180, 61)).toBe(60);
    expect(valueToFrame(270, 61)).toBe(30);
    expect(valueToFrame(359, 61)).toBe(0);
    expect(valueToFrame(360, 61)).toBe(0);
  });

  it("matches the v1 implementation for every integer angle", () => {
    // Copied from v1 (circular-slider-image-morpher.js, angleToImage).
    const v1 = (angle: number, n: number) => {
      const a = angle > 180 ? 180 - (angle - 180) : angle;
      return Math.min(n - 1, Math.max(0, Math.round((a * (n - 1)) / 180)));
    };
    for (let angle = 0; angle <= 360; angle++) {
      expect(valueToFrame(angle, 61)).toBe(v1(angle, 61));
    }
  });
});

describe("pickStartValue", () => {
  it("only returns values at least minDistance frames from the target", () => {
    for (let draw = 0; draw < 360; draw++) {
      const value = pickStartValue(30, 61, 10, (min, max) => Math.min(max, min + draw));
      expect(Math.abs(valueToFrame(value, 61) - 30)).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("frameUrls", () => {
  it("lists every frame of an identity", () => {
    const urls = frameUrls(DESIGN, "Dominant", "WM_475");
    expect(urls).toHaveLength(61);
    expect(urls[0]).toBe("/stimuli/faces/Dominant/WM_475/0.png");
    expect(urls[60]).toBe("/stimuli/faces/Dominant/WM_475/60.png");
  });
});

describe("practiceUrls", () => {
  it("lists the practice frames, or none without a practice face", () => {
    expect(practiceUrls(DESIGN)).toEqual([
      "/stimuli/examples/practice/0.png",
      "/stimuli/examples/practice/1.png",
      "/stimuli/examples/practice/2.png",
    ]);
    expect(practiceUrls({ ...DESIGN, practice_url: null })).toEqual([]);
  });
});

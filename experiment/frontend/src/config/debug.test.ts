import { describe, expect, it } from "vitest";

import { parseDebugOptions } from "./debug";

const parse = (query: string) => parseDebugOptions(new URLSearchParams(query));

describe("parseDebugOptions", () => {
  it("has safe defaults", () => {
    const options = parse("");
    expect(options.skip.size).toBe(0);
    expect(options.save).toBe(true);
    expect(options.simulate).toBeNull();
  });

  it("expands ?skip=intro", () => {
    expect([...parse("?skip=intro,survey").skip]).toEqual([
      "consent",
      "fullscreen",
      "attrition",
      "instructions",
      "survey",
    ]);
  });

  it("reads ?phases= in study order, with groups", () => {
    expect(parse("?phases=task,intro").phases).toEqual([
      "consent",
      "fullscreen",
      "attrition",
      "instructions",
      "task",
    ]);
    expect(parse("?phases=outro").phases).toEqual(["survey", "debriefing"]);
    expect(parse("").phases).toBeNull();
  });

  it("rejects unknown phases and simulation modes", () => {
    expect(() => parse("?skip=consnet")).toThrow(/consnet/);
    expect(() => parse("?simulate=fast")).toThrow();
    expect(() => parse("?trials=abc")).toThrow(/trials/);
    expect(() => parse("?trials=0")).toThrow(/trials/);
  });

  it("parses trials, seed and save", () => {
    const options = parse("?trials=4&seed=abc&save=0");
    expect(options.maxTrials).toBe(4);
    expect(options.seed).toBe("abc");
    expect(options.save).toBe(false);
  });
});

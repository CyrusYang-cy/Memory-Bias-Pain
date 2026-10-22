// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { sessionPhases } from "../timeline";
import type { ExperimentContext } from "../timeline/context";
import { NO_DEBUG, parseDebugOptions } from "./debug";
import { requestedMode, type Mode } from "./mode";

const params = (query: string) => new URLSearchParams(query);
const phasesFor = (mode: Mode, query = "") =>
  sessionPhases({
    mode,
    debug: mode === "debug" ? parseDebugOptions(params(query)) : NO_DEBUG,
  } as ExperimentContext);

describe("requestedMode", () => {
  it("reads ?mode=", () => {
    expect(requestedMode(params("?mode=pilot"))).toBe("pilot");
    expect(requestedMode(params(""))).toBeNull();
    expect(() => requestedMode(params("?mode=demo"))).toThrow(/demo/);
  });
});

describe("phases per mode", () => {
  it("experiment runs every participant-facing phase, never the results page", () => {
    expect(phasesFor("experiment")).toEqual([
      "consent",
      "fullscreen",
      "attrition",
      "instructions",
      "task",
      "survey",
      "debriefing",
    ]);
  });

  it("pilot replaces survey and debriefing with the results page", () => {
    expect(phasesFor("pilot")).toEqual([
      "consent",
      "fullscreen",
      "attrition",
      "instructions",
      "task",
      "results",
    ]);
  });

  it("debug defaults to fullscreen, task, results and can be customised", () => {
    expect(phasesFor("debug")).toEqual(["fullscreen", "task", "results"]);
    expect(phasesFor("debug", "?skip=fullscreen")).toEqual(["task", "results"]);
    expect(phasesFor("debug", "?phases=intro,task")).toEqual([
      "consent",
      "fullscreen",
      "attrition",
      "instructions",
      "task",
    ]);
  });

  it("lets pilots shorten the task but ignores other debug parameters", () => {
    // main.ts gives pilot sessions only maxTrials from the URL.
    const pilotDebug = {
      ...NO_DEBUG,
      maxTrials: parseDebugOptions(params("?trials=10")).maxTrials,
    };
    expect(pilotDebug.maxTrials).toBe(10);
    expect(pilotDebug.enabled).toBe(false);
  });

  it("ignores debug parameters outside debug mode", () => {
    expect(phasesFor("pilot", "?skip=consent")).toContain("consent");
  });
});

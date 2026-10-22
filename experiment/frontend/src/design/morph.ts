/**
 * Mapping between the circular slider and the morph frames.
 *
 * Slider values are degrees (0–360) measured clockwise from the slider's (random) start
 * angle. Half a turn sweeps through all frames and the other half sweeps back, so going
 * around the circle runs frame 0 → N-1 → 0 without a jump:
 *
 *   value   0° → frame 0      value 180° → frame N-1      value 360° → frame 0
 */

import type { DesignInfo } from "../api/types";

export function normalizeAngle(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function valueToFrame(value: number, numFrames: number): number {
  const v = normalizeAngle(value);
  const folded = v > 180 ? 360 - v : v;
  const frame = Math.round((folded * (numFrames - 1)) / 180);
  return Math.min(numFrames - 1, Math.max(0, frame));
}

/**
 * A random slider value whose frame is at least `minDistance` frames from the target,
 * so the participant cannot submit without moving the slider. Uniform over all valid
 * integer values (equivalent to rejection sampling, without the loop).
 */
export function pickStartValue(
  targetFrame: number,
  numFrames: number,
  minDistance: number,
  randomInt: (min: number, max: number) => number,
): number {
  const allValues = Array.from({ length: 360 }, (_, v) => v);
  const valid = allValues.filter(
    (v) => Math.abs(valueToFrame(v, numFrames) - targetFrame) >= minDistance,
  );
  const pool = valid.length > 0 ? valid : allValues;
  return pool[randomInt(0, pool.length - 1)]!;
}

/** URLs of all frames of one identity's morph, in order. */
export function frameUrls(design: DesignInfo, group: string, identity: string): string[] {
  return Array.from(
    { length: design.frames },
    (_, i) => `${design.faces_url}/${group}/${identity}/${i}${design.extension}`,
  );
}

/** URLs of the practice morph's frames (none if the study has no practice face). */
export function practiceUrls(design: DesignInfo): string[] {
  const base = design.practice_url;
  if (!base) return [];
  return Array.from(
    { length: design.practice_frames },
    (_, i) => `${base}/${i}${design.extension}`,
  );
}

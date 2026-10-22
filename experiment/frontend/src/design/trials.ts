import type { TrialAssignment } from "../api/types";

/** Everything that defines one memory trial, independent of how it is displayed. */
export interface MemoryTrialSpec {
  /** 1-based position in the session. */
  trial_number: number;
  group: string;
  identity: string;
  /** The morph frame the participant must remember and reproduce. */
  target_frame: number;
}

/**
 * The server decides which face (and which frame of it) each trial shows, balanced across
 * participants. Here the trials are put in random order.
 */
export function buildMemoryTrials(
  plan: readonly TrialAssignment[],
  numFrames: number,
  shuffle: <T>(items: T[]) => T[],
): MemoryTrialSpec[] {
  for (const t of plan) {
    if (!Number.isInteger(t.target_index) || t.target_index < 0 || t.target_index >= numFrames) {
      throw new Error(`Invalid target frame ${t.target_index} for ${t.group}/${t.identity}`);
    }
  }
  return shuffle([...plan]).map((t, i) => ({
    trial_number: i + 1,
    group: t.group,
    identity: t.identity,
    target_frame: t.target_index,
  }));
}

/**
 * Keep only `n` trials (debug `?trials=`), split as evenly as possible between the trait
 * groups: 10 → 5 + 5; an odd remainder goes to randomly chosen groups. Keeps the shuffled
 * order and renumbers the kept trials from 1.
 */
export function limitTrials(
  specs: readonly MemoryTrialSpec[],
  n: number,
  randomInt: (min: number, max: number) => number,
): MemoryTrialSpec[] {
  if (n >= specs.length) return [...specs];
  const groups = [...new Set(specs.map((s) => s.group))];
  const quota = new Map(groups.map((g) => [g, Math.floor(n / groups.length)]));
  const extra = [...groups];
  for (let left = n % groups.length; left > 0; left--) {
    const [g] = extra.splice(randomInt(0, extra.length - 1), 1);
    quota.set(g!, quota.get(g!)! + 1);
  }
  // A group with fewer trials than its quota passes the rest to the others.
  let shortfall = 0;
  for (const g of groups) {
    const available = specs.filter((s) => s.group === g).length;
    shortfall += Math.max(0, quota.get(g)! - available);
    quota.set(g, Math.min(quota.get(g)!, available));
  }
  for (const g of groups) {
    const room = specs.filter((s) => s.group === g).length - quota.get(g)!;
    const add = Math.min(room, shortfall);
    quota.set(g, quota.get(g)! + add);
    shortfall -= add;
  }
  const kept = specs.filter((s) => {
    const left = quota.get(s.group)!;
    if (left === 0) return false;
    quota.set(s.group, left - 1);
    return true;
  });
  return kept.map((s, i) => ({ ...s, trial_number: i + 1 }));
}

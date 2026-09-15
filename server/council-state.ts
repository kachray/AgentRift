/**
 * The council latch. Active while the unresolved count is at or above the
 * threshold; re-arms only once the count drops below it again.
 */
export interface CouncilState {
  /** Feed the current unresolved count; returns the latch's new state. */
  notify(unresolvedCount: number): { active: boolean; changed: boolean };
  isActive(): boolean;
}

export function createCouncilState(threshold: number): CouncilState {
  let active = false;
  return {
    notify(unresolvedCount) {
      const activeNow = unresolvedCount >= threshold;
      const changed = activeNow !== active;
      active = activeNow;
      return { active, changed };
    },
    isActive: () => active,
  };
}

/**
 * The council latch. Active while the unresolved count is at or above the
 * threshold; re-arms only once the count drops below it again.
 */
export interface CouncilState {
  /** Feed the current unresolved count; returns the latch's new state. */
  notify(unresolvedCount: number): { active: boolean; changed: boolean };
  isActive(): boolean;
  /**
   * True exactly once per active session, for whoever needs a one-shot per
   * session. Re-armed by notify()'s falling edge, so it shares the latch's
   * lifecycle instead of keeping a second notion of "a session" in sync.
   */
  claimDebate(): boolean;
}

export function createCouncilState(threshold: number): CouncilState {
  let active = false;
  let debateClaimed = false;
  return {
    notify(unresolvedCount) {
      const activeNow = unresolvedCount >= threshold;
      const changed = activeNow !== active;
      active = activeNow;
      // The one clearing path: whatever the latch re-arms on, the claim re-arms on.
      if (changed && !active) debateClaimed = false;
      return { active, changed };
    },
    isActive: () => active,
    // Synchronous on purpose: two arrivals in the same tick both see "all here",
    // and the first to claim flips the bit before the second asks.
    claimDebate() {
      if (!active || debateClaimed) return false;
      debateClaimed = true;
      return true;
    },
  };
}

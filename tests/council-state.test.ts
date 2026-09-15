import { describe, expect, it } from "vitest";
import { createCouncilState } from "../server/council-state";

describe("council-state", () => {
  it("crosses into active once the count reaches the threshold", () => {
    const council = createCouncilState(3);
    expect(council.notify(2)).toEqual({ active: false, changed: false });
    expect(council.notify(3)).toEqual({ active: true, changed: true });
  });

  it("does not re-trigger while already active", () => {
    const council = createCouncilState(3);
    council.notify(3);
    expect(council.notify(4)).toEqual({ active: true, changed: false });
    expect(council.notify(3)).toEqual({ active: true, changed: false });
  });

  it("clears when the count drops below the threshold", () => {
    const council = createCouncilState(3);
    council.notify(3);
    expect(council.notify(2)).toEqual({ active: false, changed: true });
  });

  it("does not clear on a resolve that stays at or above the threshold", () => {
    const council = createCouncilState(3);
    council.notify(4);
    expect(council.notify(3)).toEqual({ active: true, changed: false });
  });

  it("re-arms after clearing, so the next crossing triggers again", () => {
    const council = createCouncilState(3);
    council.notify(3);
    council.notify(2);
    expect(council.notify(3)).toEqual({ active: true, changed: true });
  });

  it("reports active state without notifying", () => {
    const council = createCouncilState(3);
    expect(council.isActive()).toBe(false);
    council.notify(3);
    expect(council.isActive()).toBe(true);
    council.notify(0);
    expect(council.isActive()).toBe(false);
  });
});

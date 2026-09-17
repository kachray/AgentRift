import Phaser from "phaser";
import type { DebateMessage } from "../../shared/types";
import { Config } from "../../shared/config";

/** Calibration knob, not a constant of nature — reveal pacing is the client's job. */
const REVEAL_INTERVAL_MS = 2500;
/** Down-right of the meeting point, clear of the marker and the agent sprites. */
const OFFSET_X = 56;
const OFFSET_Y = 56;
const WRAP_WIDTH = 660;

export interface CouncilPanel {
  show(messages: DebateMessage[]): void;
}

/**
 * The debate transcript, appended one persona at a time. Deliberately not over
 * the sprites: the four personas are their own cast, not the five walking agents.
 */
export function createCouncilPanel(scene: Phaser.Scene): CouncilPanel {
  const originX = Config.meetingPoint.x + OFFSET_X;
  const originY = Config.meetingPoint.y - OFFSET_Y;
  const lines: Phaser.GameObjects.Text[] = [];
  let pending: Phaser.Time.TimerEvent[] = [];

  function clear(): void {
    for (const timer of pending) timer.remove();
    pending = [];
    for (const line of lines) line.destroy();
    lines.length = 0;
  }

  /** Wrap width is not fixed, so a long message needs to know where it ended. */
  function nextY(): number {
    const last = lines[lines.length - 1];
    return last ? last.y + last.height + 4 : originY;
  }

  return {
    show(messages) {
      // A second debate mid-reveal replaces the first rather than interleaving.
      clear();
      for (const [i, entry] of messages.entries()) {
        pending.push(
          scene.time.delayedCall(i * REVEAL_INTERVAL_MS, () => {
            lines.push(
              scene.add.text(originX, nextY(), `${entry.persona}: ${entry.message}`, {
                fontFamily: "monospace",
                fontSize: "14px",
                color: "#ffffff",
                backgroundColor: "#00000088",
                padding: { x: 4, y: 2 },
                wordWrap: { width: WRAP_WIDTH },
              }),
            );
          }),
        );
      }
    },
  };
}

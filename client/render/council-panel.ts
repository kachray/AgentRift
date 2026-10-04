import Phaser from "phaser";
import type { DebateMessage } from "../../shared/types";
import { Config } from "../../shared/config";

/** Calibration knob, not a constant of nature — reveal pacing is the client's job. */
const REVEAL_INTERVAL_MS = 2500;
const DOT_INTERVAL_MS = 400;
const PANEL_WIDTH = 400;
const MARGIN = 16;
const MAX_HEIGHT = Config.canvasHeight - MARGIN * 2;

export interface CouncilPanel {
  show(messages: DebateMessage[]): void;
  /**
   * One non-debate line in the same spot. With animateDots, trailing dots cycle
   * (1-2-3) every DOT_INTERVAL_MS — activity during the "Council convening"
   * gap until debate messages arrive.
   */
  showStatus(text: string, opts?: { animateDots?: boolean }): void;
  /** Drop all lines and pending reveals — e.g. on reconnect resync. */
  clear(): void;
}

/**
 * The debate transcript: a fixed screen-space panel, top-right, trimmed to fit —
 * newest lines always on-screen, oldest destroyed. Deliberately not over the
 * sprites: the four personas are their own cast, not the five walking agents.
 *
 * ponytail: trim has no scrollback — add mask + wheel scroll if reading
 * history matters. A single message taller than the panel still spills past
 * the trim (it keeps >=1 line); server-side length cap or mask+scroll if that
 * bites.
 */
export function createCouncilPanel(scene: Phaser.Scene): CouncilPanel {
  const originX = Config.canvasWidth - PANEL_WIDTH - MARGIN;
  const originY = MARGIN;
  const lines: Phaser.GameObjects.Text[] = [];
  let pending: Phaser.Time.TimerEvent[] = [];
  // Removed by clear() — debate arrival, a new status, and reconnect resync all
  // route through it, so the dots can never tick behind a replaced panel. Scene
  // shutdown tears down the scene clock, so no explicit shutdown hook is needed.
  let statusTimer: Phaser.Time.TimerEvent | undefined;

  function clear(): void {
    statusTimer?.remove();
    statusTimer = undefined;
    for (const timer of pending) timer.remove();
    pending = [];
    for (const line of lines) line.destroy();
    lines.length = 0;
  }

  /** Destroy oldest lines until the stack fits, then restack from the top. */
  function layout(): void {
    const height = () => lines.reduce((sum, l) => sum + l.height, 0) + (lines.length - 1) * 4;
    while (lines.length > 1 && height() > MAX_HEIGHT) {
      lines[0].destroy();
      lines.shift();
    }
    let y = originY;
    for (const line of lines) {
      line.y = y;
      y += line.height + 4;
    }
  }

  /** One panel line: created at the origin, then re-fit into the stack. */
  function addLine(content: string): Phaser.GameObjects.Text {
    const line = scene.add
      .text(originX, originY, content, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#00000088",
        padding: { x: 4, y: 2 },
        wordWrap: { width: PANEL_WIDTH - 8 },
      })
      .setScrollFactor(0);
    lines.push(line);
    layout();
    return line;
  }

  return {
    clear,
    show(messages) {
      // A second debate mid-reveal replaces the first rather than interleaving.
      clear();
      for (const [i, entry] of messages.entries()) {
        pending.push(
          scene.time.delayedCall(i * REVEAL_INTERVAL_MS, () => {
            addLine(`${entry.persona}: ${entry.message}`);
          }),
        );
      }
    },
    showStatus(text, opts) {
      clear();
      const line = addLine(text);
      if (!opts?.animateDots) return;
      let dots = 0;
      statusTimer = scene.time.addEvent({
        delay: DOT_INTERVAL_MS,
        loop: true,
        callback: () => {
          dots = (dots % 3) + 1;
          line.setText(`${text}${".".repeat(dots)}`);
        },
      });
    },
  };
}

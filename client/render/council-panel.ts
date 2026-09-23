import Phaser from "phaser";
import type { DebateMessage } from "../../shared/types";
import { Config } from "../../shared/config";

/** Calibration knob, not a constant of nature — reveal pacing is the client's job. */
const REVEAL_INTERVAL_MS = 2500;
const PANEL_WIDTH = 400;
const MARGIN = 16;
const MAX_HEIGHT = Config.canvasHeight - MARGIN * 2;

export interface CouncilPanel {
  show(messages: DebateMessage[]): void;
  /** One non-debate line in the same spot — e.g. "Council convening…" until debate messages arrive. */
  showStatus(text: string): void;
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

  function clear(): void {
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
  function addLine(content: string): void {
    lines.push(
      scene.add
        .text(originX, originY, content, {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#ffffff",
          backgroundColor: "#00000088",
          padding: { x: 4, y: 2 },
          wordWrap: { width: PANEL_WIDTH - 8 },
        })
        .setScrollFactor(0),
    );
    layout();
  }

  return {
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
    showStatus(text) {
      clear();
      addLine(text);
    },
  };
}

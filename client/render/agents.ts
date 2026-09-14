import Phaser from "phaser";
import type { Agent } from "../../shared/types";
import { FALLBACK_COLOR, STATION_COLORS } from "./stations";

const RADIUS = 14;
const STROKE_COLOR = 0x101828;
const TEXTURE_PREFIX = "agent-body-";

/** Sprite creation and lookup only — movement lives in WorldScene. */
export function createAgentViews(
  scene: Phaser.Scene,
  agents: Agent[],
): Map<string, Phaser.GameObjects.Container> {
  const views = new Map<string, Phaser.GameObjects.Container>();

  for (const agent of agents) {
    ensureBodyTexture(scene, agent.stationId);
    const body = scene.add.image(0, 0, TEXTURE_PREFIX + agent.stationId);
    const name = scene.add
      .text(0, -RADIUS - 4, agent.name, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "#00000088",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1);

    // Container so the label follows the body through a tween with no per-frame work.
    views.set(
      agent.id,
      scene.add.container(agent.position.x, agent.position.y, [body, name]),
    );
  }

  return views;
}

function ensureBodyTexture(scene: Phaser.Scene, stationId: string): void {
  const key = TEXTURE_PREFIX + stationId;
  if (scene.textures.exists(key)) return;

  const color = STATION_COLORS[stationId] ?? FALLBACK_COLOR;
  const g = scene.make.graphics();
  g.fillStyle(color, 1);
  g.fillCircle(RADIUS, RADIUS, RADIUS);
  g.lineStyle(2, STROKE_COLOR, 1);
  g.strokeCircle(RADIUS, RADIUS, RADIUS);
  g.generateTexture(key, RADIUS * 2, RADIUS * 2);
  g.destroy();
}

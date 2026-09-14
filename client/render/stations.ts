import Phaser from "phaser";
import { Config } from "../../shared/config";

export const STATION_COLORS: Record<string, number> = {
  lab: 0x4f8ef7,
  forge: 0xf78f4f,
  garden: 0x5fd07a,
  library: 0xb06ff5,
  commons: 0xf5d24f,
};
export const FALLBACK_COLOR = 0x9aa4b8;
const MEETING_COLOR = 0xf75f8f;
const STROKE_COLOR = 0x101828;

export function createStations(scene: Phaser.Scene): void {
  const size = Config.tileSize;
  const half = size / 2;

  for (const station of Config.stations) {
    scene.add
      .rectangle(station.x, station.y, size, size, STATION_COLORS[station.id] ?? FALLBACK_COLOR)
      .setStrokeStyle(2, STROKE_COLOR, 1);
    addLabel(scene, station.x, station.y - half - 4, station.id);
  }

  const { x, y } = Config.meetingPoint;
  scene.add
    .rectangle(x, y, size * 0.7, size * 0.7, MEETING_COLOR)
    .setAngle(45)
    .setStrokeStyle(2, STROKE_COLOR, 1);
  addLabel(scene, x, y - half - 4, "Meeting Point");
}

function addLabel(scene: Phaser.Scene, x: number, y: number, label: string): void {
  scene.add
    .text(x, y, label, {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#ffffff",
      backgroundColor: "#00000088",
      padding: { x: 4, y: 2 },
    })
    .setOrigin(0.5, 1);
}

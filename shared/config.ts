import type { Config as AppConfig } from "./types";

export const Config: AppConfig = {
  tileSize: 48,
  canvasWidth: 1280,
  canvasHeight: 720,
  issueThreshold: 3,
  stations: [
    { id: "lab", x: 240, y: 168 },
    { id: "forge", x: 792, y: 168 },
    { id: "garden", x: 168, y: 504 },
    { id: "library", x: 840, y: 504 },
    { id: "commons", x: 504, y: 336 },
  ],
  meetingPoint: { id: "meeting", x: 504, y: 624 },
};

/**
 * Each agent's council seat, in Config.stations order. A pentagon, radius
 * ~40-50: same-height pairs sit ~88px apart, and pairs closer than that differ
 * in height by >= 24px (agent-name labels are ~17px tall), so 12px labels never
 * collide. Read through councilPointFor — never inline the values.
 */
const COUNCIL_OFFSETS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: -40 }, // lab — top
  { x: 36, y: -16 }, // forge — upper right
  { x: 44, y: 24 }, // garden — lower right
  { x: -44, y: 24 }, // library — lower left
  { x: -36, y: -16 }, // commons — upper left
];

/** meetingPoint plus the station's offset. undefined when stationId matches nothing. */
export function councilPointFor(stationId: string): { x: number; y: number } | undefined {
  const i = Config.stations.findIndex((s) => s.id === stationId);
  if (i < 0) return undefined;
  const off = COUNCIL_OFFSETS[i];
  return { x: Config.meetingPoint.x + off.x, y: Config.meetingPoint.y + off.y };
}

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
 * "Already standing there" slack, one value for both sides of the wire.
 * Semantics: Euclidean distance <= ARRIVAL_EPSILON pixels, compared squared
 * (no sqrt). Read through withinEpsilon — never re-implement the compare.
 */
export const ARRIVAL_EPSILON = 1;

export function withinEpsilon(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy <= ARRIVAL_EPSILON * ARRIVAL_EPSILON;
}

/**
 * Each agent's council seat, keyed by station id — inserting a station
 * anywhere in Config.stations can't shift anyone's seat. A pentagon, radius
 * ~40-50: same-height pairs sit ~88px apart, and pairs closer than that differ
 * in height by >= 24px (agent-name labels are ~17px tall), so 12px labels never
 * collide. Read through councilPointFor — never inline the values.
 */
const COUNCIL_OFFSETS: Readonly<Record<string, { x: number; y: number }>> = {
  lab: { x: 0, y: -40 }, // top
  forge: { x: 36, y: -16 }, // upper right
  garden: { x: 44, y: 24 }, // lower right
  library: { x: -44, y: 24 }, // lower left
  commons: { x: -36, y: -16 }, // upper left
};

/** meetingPoint plus the station's offset. undefined when stationId matches nothing. */
export function councilPointFor(stationId: string): { x: number; y: number } | undefined {
  const off = COUNCIL_OFFSETS[stationId];
  if (!off) return undefined;
  return { x: Config.meetingPoint.x + off.x, y: Config.meetingPoint.y + off.y };
}

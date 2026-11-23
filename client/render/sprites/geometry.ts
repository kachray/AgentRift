import { Config, councilPointFor } from "../../../shared/config";

/**
 * Every number shared between the renderer and the preview script.
 *
 * Deliberately Phaser-free (it imports only shared/config, which is itself
 * Phaser-free) so the preview can be rendered under plain Node from the same
 * values the game uses. If an anchor lived in a Phaser module, the preview would
 * have to duplicate it and could silently disagree with the real scene.
 */

/** Art pixels across one source tile: the pack convention, 16px art. */
export const SOURCE_TILE = 16;

/** World px per art px, derived — never a literal 3. */
export const PIXEL_SCALE = Config.tileSize / SOURCE_TILE;

/** Landmark sprites are square, in art px. 24 art px -> 72 world px. */
export const LANDMARK_SIZE = 24;

/**
 * Meeting plaza is square, in art px. 48 art px is exactly 3 world tiles, so the
 * paved rim lands on the floor grid. The size is forced by the council seats:
 * the outermost sit 16.71 art px from centre and their agent circles reach
 * 21.37 art px, which needs an apothem of >= 20.5 art px (~41 art px sprite).
 * 32 art px reaches only 17.3 and would leave two agents standing on the grass
 * beside the paving.
 */
export const MEETING_SIZE = 48;

/**
 * Agent body radius in world px. world/agents.ts draws a filled circle of this
 * radius centred on the agent position — it is NOT the agent's feet, so the area
 * this circle covers around a station point is exactly the area a landmark must
 * keep clear of detail.
 */
export const AGENT_BODY_RADIUS = 14;

/** The same radius in art px, for reasoning about sprite rows. */
export const AGENT_ART_RADIUS = AGENT_BODY_RADIUS / PIXEL_SCALE;

/**
 * Landmark anchor. The station point is where the agent stands, and the agent
 * circle covers 2 * AGENT_ART_RADIUS = 9.33 art px around it, which at this
 * anchor is art rows 17-23. So: the object lives in rows 0-16, and rows 17-23
 * carry only a narrow footprint (bench legs, post bases, shelf feet) with
 * transparency either side, so the agent covers ground rather than art.
 *
 * 0.9 rather than 0.8: at 0.8 the circle would swallow rows 15-23 and cost two
 * rows of visible object.
 */
export const LANDMARK_ORIGIN = { x: 0.5, y: 0.9 } as const;

/** Plaza is centred on the meeting point, so the five seats sit symmetric on it. */
export const MEETING_ORIGIN = { x: 0.5, y: 0.5 } as const;

/** Clear space between a sprite edge and the label that sits against it. */
export const LABEL_GAP = 4;

/**
 * World px from the station point up to the id label's baseline. Sits above the
 * sprite's top edge, which at LANDMARK_ORIGIN.y is 0.9 * 72 = 64.8 world px up.
 * The agent's name label spans 18-35 world px up at rest (agents.ts), so the two
 * labels clear each other by ~34px.
 */
export const LANDMARK_LABEL_OFFSET = LANDMARK_SIZE * PIXEL_SCALE * LANDMARK_ORIGIN.y + LABEL_GAP;

/**
 * World px from the meeting point DOWN to the plaza label. Below, not above: the
 * seats occupy the space above the centre, and the lab seat's agent name label
 * would land at 58-75px up — right where a label above the plaza would sit.
 */
export const MEETING_LABEL_OFFSET = (MEETING_SIZE * PIXEL_SCALE) / 2 + LABEL_GAP;

/**
 * A council seat in the plaza sprite's own art coordinates — used by the preview
 * to draw where each agent will stand.
 *
 * Derived from councilPointFor, so seat markers come from the same source of
 * truth the game uses to walk agents there, rather than a copied table.
 */
export function seatArtPoint(stationId: string): { x: number; y: number } | undefined {
  const seat = councilPointFor(stationId);
  if (!seat) return undefined;
  return {
    x: MEETING_SIZE / 2 + (seat.x - Config.meetingPoint.x) / PIXEL_SCALE,
    y: MEETING_SIZE / 2 + (seat.y - Config.meetingPoint.y) / PIXEL_SCALE,
  };
}

/** The station point in a landmark sprite's own art coordinates. */
export const LANDMARK_ANCHOR_ART = {
  x: LANDMARK_SIZE * LANDMARK_ORIGIN.x,
  y: LANDMARK_SIZE * LANDMARK_ORIGIN.y,
};

import { LANDMARK_SIZE, MEETING_SIZE } from "./geometry";
import { FLOOR_HEIGHT, FLOOR_VARIANTS, FLOOR_WIDTH } from "./floor";
import { LAB } from "./lab";
import { FORGE } from "./forge";
import { GARDEN } from "./garden";
import { LIBRARY } from "./library";
import { COMMONS } from "./commons";
import { MEETING } from "./meeting";

/**
 * The sprite registry: every pixel the game draws, keyed by texture key.
 *
 * This module and everything it imports are pure data — no Phaser import — so
 * the sprite-data test and the scratch preview script can both read them under
 * plain Node. The Phaser-facing half lives in ../art.ts.
 */

export interface Sprite {
  width: number;
  height: number;
  data: readonly string[];
}

export const floorTextureKey = (variant: number): string => `floor-${variant}`;
export const stationTextureKey = (stationId: string): string => `station-${stationId}`;
export const MEETING_TEXTURE_KEY = "meeting";

/** Which sprite is which station. Keyed by station id, matching shared/config. */
const LANDMARKS: Readonly<Record<string, readonly string[]>> = {
  lab: LAB,
  forge: FORGE,
  garden: GARDEN,
  library: LIBRARY,
  commons: COMMONS,
};

const floorSprites: Record<string, Sprite> = {};
FLOOR_VARIANTS.forEach((data, i) => {
  floorSprites[floorTextureKey(i)] = { width: FLOOR_WIDTH, height: FLOOR_HEIGHT, data };
});

const landmarkSprites: Record<string, Sprite> = {};
for (const [stationId, data] of Object.entries(LANDMARKS)) {
  landmarkSprites[stationTextureKey(stationId)] = {
    width: LANDMARK_SIZE,
    height: LANDMARK_SIZE,
    data,
  };
}

export const SPRITES: Readonly<Record<string, Sprite>> = {
  ...floorSprites,
  ...landmarkSprites,
  [MEETING_TEXTURE_KEY]: { width: MEETING_SIZE, height: MEETING_SIZE, data: MEETING },
};

/** In variant order, so index i is what floorVariantAt returns for i. */
export const FLOOR_TEXTURE_KEYS: readonly string[] = FLOOR_VARIANTS.map((_, i) =>
  floorTextureKey(i),
);

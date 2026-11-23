import { SOURCE_TILE } from "./geometry";

/**
 * Four grass tiles. All four are built on the same "2" base with no directional
 * shading — any light/dark gradient would make the tile seams visible where the
 * floor repeats. Variation is sparse speckle only, so the tiles read as one lawn
 * while still breaking up the repetition.
 *
 * Which variant a grid cell gets is decided by the tile's grid coordinates
 * (see floorVariantAt in ../tiles.ts) — never Math.random, so the map is
 * identical on every load.
 */
export const FLOOR_WIDTH = SOURCE_TILE;
export const FLOOR_HEIGHT = SOURCE_TILE;

/** Plain grass with a few darker specks. */
const FLOOR_A: readonly string[] = [
  "2222222222222222",
  "2222222222222222",
  "2212222222222222",
  "2222222222122222",
  "2222222222222222",
  "2222212222222222",
  "2222222222222222",
  "2212222222222212",
  "2222222222222222",
  "2222222222222222",
  "2222212222222222",
  "2222222222222122",
  "2222222222222222",
  "2212222222222222",
  "2222222222222222",
  "2222222222222222",
];

/** Lighter tufts. */
const FLOOR_B: readonly string[] = [
  "2222222222222222",
  "2223222222222222",
  "2233222222222222",
  "2222222222322222",
  "2222222223322222",
  "2222222222222222",
  "2222222222222232",
  "2222222222222332",
  "2222222222222222",
  "2322222222222222",
  "3322222222222222",
  "2222222222222222",
  "2222322222222222",
  "2223322222222222",
  "2222222222222222",
  "2222222222222222",
];

/** Two small flowers — white petals, yellow centres. */
const FLOOR_C: readonly string[] = [
  "2222222222222222",
  "2222222222222222",
  "2222422222222222",
  "22224E4222222222",
  "2222422222222222",
  "2222222222222222",
  "2222222222222222",
  "2222222222222222",
  "2222222222222422",
  "22222222222224E4",
  "2222222222222422",
  "2222222222222222",
  "2422222222222222",
  "4E42222222222222",
  "2422222222222222",
  "2222222222222222",
];

/** A small pebble. */
const FLOOR_D: readonly string[] = [
  "2222222222222222",
  "2222222222222222",
  "2212222222222222",
  "2222222222222222",
  "2222222222222222",
  "2222222222221222",
  "2222222222222222",
  "2222222222222222",
  "2222222222222222",
  "2222255222222222",
  "2222556622222222",
  "2222255222222222",
  "2222222222222222",
  "2212222222222222",
  "2222222222222222",
  "2222222222222222",
];

/**
 * Index is the variant id handed out by floorVariantAt. Order is the contract
 * with the caller: tiles.ts reaches for this list by index, so append rather
 * than reorder.
 */
export const FLOOR_VARIANTS: readonly (readonly string[])[] = [FLOOR_A, FLOOR_B, FLOOR_C, FLOOR_D];

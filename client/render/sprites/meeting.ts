import { MEETING_SIZE } from "./geometry";

/**
 * Meeting point — a flat paved octagon with a small fountain at its centre.
 *
 * Unlike the landmarks this one is generated rather than hand-listed: an
 * octagon inscribed in the square and a circular basin are geometry, and writing
 * 48 rows of rim arithmetic by hand is how off-by-one edges get in. It still
 * exports the same `readonly string[]` the registry and the preview expect.
 *
 * Two constraints drive the shape, both from the council seats:
 *
 *   1. The paving must reach the seats. The outermost sit 16.71 art px from
 *      centre (see geometry.ts); a 48px full-bleed octagon reaches 21.6-24 art px
 *      on every bearing, so all five agent circles land on stone.
 *   2. Nothing tall near them. The basin is kept inside BASIN_R = 7 art px, so
 *      the nearest agent (13.13 art px out, 4.67 art px radius) still stops at
 *      8.46 art px — never overlapping the fountain.
 *
 * Everything between the basin and the rim is deliberately plain paving, because
 * that is exactly where five agents will be standing.
 */
const SIZE = MEETING_SIZE;
/** The sprite's true centre in art px — pixel centres land on SIZE/2 exactly. */
const CENTRE = SIZE / 2;
/** Corner cut for an octagon inscribed in the square, giving a 20px flat edge. */
const CORNER_CUT = 14;
/** Fountain stays within this many art px of centre. */
const BASIN_R = 7;
/** Paving slab pitch, in art px. */
const SLAB = 8;

function isPaved(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return false;
  const last = SIZE - 1;
  return (
    x + y >= CORNER_CUT &&
    last - x + y >= CORNER_CUT &&
    x + last - y >= CORNER_CUT &&
    last - x + last - y >= CORNER_CUT
  );
}

function charAt(x: number, y: number): string {
  // +0.5 so distance is measured to the pixel's centre and the result is
  // symmetric about the sprite centre.
  const d = Math.hypot(x + 0.5 - CENTRE, y + 0.5 - CENTRE);

  if (d <= BASIN_R) {
    if (d > 6.4) return "0"; // basin outline
    if (d > 5.4) return "6"; // basin wall, in shadow
    if (d > 4.6) return "5"; // basin rim, catching the light
    if (d > 3.4) return "4"; // foam ring where the water meets the rim
    if (d > 1.6) return "F"; // water
    return "4"; // splash at the spout
  }

  if (!isPaved(x, y)) return ".";

  // Rim: any paved pixel with an unpaved neighbour.
  if (!isPaved(x - 1, y) || !isPaved(x + 1, y) || !isPaved(x, y - 1) || !isPaved(x, y + 1)) {
    return "0";
  }

  // Slab joints, clipped by the octagon.
  if (x % SLAB === 0 || y % SLAB === 0) return "6";
  return "5";
}

export const MEETING: readonly string[] = Array.from({ length: SIZE }, (_, y) =>
  Array.from({ length: SIZE }, (_, x) => charAt(x, y)).join(""),
);

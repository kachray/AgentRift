/**
 * Lab — a round-bottomed flask of blue liquid standing on a wooden bench.
 *
 * Rows 0-16 carry the object (bench top at 15-16). Rows 17-20 carry only the two
 * bench legs at x3-4 and x19-20, which sit outside the agent circle's x-range
 * (7.3-16.7), so an agent at the station point covers transparent ground between
 * the legs rather than the bench itself.
 */
export const LAB: readonly string[] = [
  "........................",
  "........................",
  "........................",
  "..........0000..........",
  "..........0440..........",
  "..........0440..........",
  "..........0440..........",
  "..........0440..........",
  ".........044440.........",
  "........04444440........",
  ".......0444444440.......",
  "......04AAAAAAAA40......",
  ".....04AAAAAAAAAA40.....",
  ".....0AAAAAAAAAAAA0.....",
  "......0AAAAAAAAAA0......",
  "..00000000000000000000..",
  "..07777777777777777770..",
  "...88..............88...",
  "...88..............88...",
  "...88..............88...",
  "...88..............88...",
  "........................",
  "........................",
  "........................",
];

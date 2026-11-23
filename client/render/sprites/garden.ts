/**
 * Garden — four flowering plants rising from a wooden raised bed.
 *
 * Flower centres sit at x4, x8, x15 and x19, so the sprite is mirror-symmetric
 * about the axis between x11 and x12: 4 + 19 = 8 + 15 = 23. Each plant is the
 * same three-row head (top pixel, "4E4", bottom pixel) over five stem rows.
 *
 * Object in rows 4-16 (flowers 4-6, stems 7-11, soil 12, bed 13-16). Rows 17-19
 * are the bed's two corner legs at x2-3 and x20-21 — outside the agent circle's
 * x-range, so the agent stands on open ground between them and the bed front
 * stays visible above its head.
 */
export const GARDEN: readonly string[] = [
  "........................",
  "........................",
  "........................",
  "........................",
  "....4...4......4...4....",
  "...4E4.4E4....4E4.4E4...",
  "....4...4......4...4....",
  "....C...C......C...C....",
  "....C...C......C...C....",
  "....C...C......C...C....",
  "....C...C......C...C....",
  "....C...C......C...C....",
  "...999999999999999999...",
  "..00000000000000000000..",
  "..07777777777777777770..",
  "..07777777777777777770..",
  "..08888888888888888880..",
  "..88................88..",
  "..88................88..",
  "..88................88..",
  "........................",
  "........................",
  "........................",
  "........................",
];

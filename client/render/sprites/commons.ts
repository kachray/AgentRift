/**
 * Commons — a gazebo: yellow pitched roof on four wooden posts, with a bench
 * underneath.
 *
 * Object in rows 2-16 (roof 2-8, posts 9-15, base 16). Rows 17-19 are the post
 * bases at x4-5 and x18-19, outside the agent circle's x-range, so the agent
 * stands in the open middle of the gazebo.
 *
 * Post/bench rows are 24 wide as: 4 dots | "88" posts | 12 bench | "88" posts |
 * 4 dots. The bench 12 is "0" + 10 wood + "0" at the seat, "0" + 10 dots + "0"
 * at the legs.
 */
export const COMMONS: readonly string[] = [
  "........................",
  "........................",
  "..........0000..........",
  "........0EEEEEE0........",
  "......0EEEEEEEEEE0......",
  "....0EEEEEEEEEEEEEE0....",
  "..0EEEEEEEEEEEEEEEEEE0..",
  "..0EEEEEEEEEEEEEEEEEE0..",
  "..00000000000000000000..",
  "....88............88....",
  "....88............88....",
  "....8807777777777088....",
  "....8807777777777088....",
  "....880..........088....",
  "....880..........088....",
  "....88............88....",
  "..00000000000000000000..",
  "....88............88....",
  "....88............88....",
  "....88............88....",
  "........................",
  "........................",
  "........................",
  "........................",
];

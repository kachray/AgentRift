export interface Point {
  x: number;
  y: number;
}

/**
 * Waypoints from `from` to `to`.
 *
 * ponytail: straight line — nothing in this world is solid yet, so A* would
 * explore a grid and hand back these same two points. Replace this body with a
 * real search (same signature, same array shape) when stations gain collision
 * bodies; the caller already walks every waypoint, so only this changes.
 */
export function findPath(from: Point, to: Point): Point[] {
  return [from, to];
}

import { DEFAULT_WANDER, type WanderConfig } from "./balance.js";
import type { Vec2 } from "./maps.js";

/** A point on a path plus the direction of travel at that point. */
export interface PathSample {
  x: number;
  y: number;
  /**
   * Heading in radians (`Math.atan2` convention), pointing toward increasing
   * `t`. A sprite whose art faces +X can be rotated by this value directly.
   */
  angle: number;
}

/** Distinct salts so one seed yields independent lane/amplitude/cycles/phase. */
const LANE_SALT = 0x1b56c4e9;
const AMP_SALT = 0x27d4eb2f;
const CYCLES_SALT = 0x165667b1;
const PHASE_SALT = 0x9e3779b1;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Deterministic integer hash in `[0, 1)` for a `(seed, salt)` pair.
 *
 * @remarks Pure and platform-stable (32-bit integer ops only), which is what
 * lets the server and client derive identical mob drift from the same seed
 * without ever syncing positions.
 */
function hashUnit(seed: number, salt: number): number {
  let h = (Math.imul(seed | 0, 0x9e3779b1) ^ salt) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return h / 4294967296;
}

/**
 * Total arc length of a polyline, in world pixels.
 *
 * @param points - Ordered waypoints. Fewer than two points yield `0`.
 * @returns Sum of the segment lengths.
 */
export function pathLength(points: Vec2[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  return total;
}

/**
 * Samples the centreline at a normalised arc-length position.
 *
 * @remarks Parametrised by distance, not waypoint index, so equal `t` steps
 * cover equal pixel distance regardless of segment lengths (constant speed).
 * `t` is clamped to `[0, 1]`; the empty/degenerate cases return a zero heading.
 *
 * @param points - Ordered waypoints.
 * @param t - Position along the path, `0` (start) to `1` (base).
 * @returns The interpolated point and its heading.
 */
export function samplePath(points: Vec2[], t: number): PathSample {
  if (points.length === 0) return { x: 0, y: 0, angle: 0 };
  if (points.length === 1) return { x: points[0].x, y: points[0].y, angle: 0 };

  const total = pathLength(points);
  if (total <= 0) return { x: points[0].x, y: points[0].y, angle: 0 };

  let remaining = clamp(t, 0, 1) * total;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen <= 0) continue;

    if (remaining <= segLen) {
      const f = remaining / segLen;
      return { x: a.x + dx * f, y: a.y + dy * f, angle: Math.atan2(dy, dx) };
    }
    remaining -= segLen;
  }

  // t === 1 (or float overshoot): land on the final point, keeping its heading.
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return {
    x: last.x,
    y: last.y,
    angle: Math.atan2(last.y - prev.y, last.x - prev.x),
  };
}

/**
 * Per-mob lateral drift, normalised to `[-1, 1]` (multiply by a map's
 * `pathHalfWidth` for pixels).
 *
 * @remarks Deterministic in `(seed, t)`: the same mob always wobbles the same
 * way on server and client. Combines a fixed lane offset (spread within the
 * wave) with a slow sine wobble (organic drift), then clamps inside the
 * corridor. `t` is the mob's `progress`.
 *
 * @param seed - Stable per-mob random seed, assigned once at spawn.
 * @param t - Position along the path, `0` to `1`.
 * @param wander - Tuning; defaults to {@link DEFAULT_WANDER}.
 * @returns Signed offset in `[-1, 1]`, where `0` is the centreline.
 */
export function lateralOffset(
  seed: number,
  t: number,
  wander: WanderConfig = DEFAULT_WANDER,
): number {
  const lane = (hashUnit(seed, LANE_SALT) * 2 - 1) * wander.laneSpread;
  const amp =
    wander.wobbleMin + hashUnit(seed, AMP_SALT) * (wander.wobbleMax - wander.wobbleMin);
  const cycles =
    wander.cyclesMin + hashUnit(seed, CYCLES_SALT) * (wander.cyclesMax - wander.cyclesMin);
  const phase = hashUnit(seed, PHASE_SALT) * Math.PI * 2;

  return clamp(lane + amp * Math.sin(cycles * t * Math.PI * 2 + phase), -1, 1);
}

/**
 * Samples the path, then pushes the point sideways along the path normal by this
 * mob's drift. This is the position a tower should target and the client should
 * draw.
 *
 * @remarks The returned `angle` remains the centreline heading, not the
 * (wobbling) tangent of the drifted point — units keep facing down the corridor.
 *
 * @param points - Ordered waypoints.
 * @param t - Position along the path, `0` to `1`.
 * @param seed - Stable per-mob seed.
 * @param halfWidth - Corridor half-width in px (map's `pathHalfWidth`).
 * @param wander - Tuning; defaults to {@link DEFAULT_WANDER}.
 * @returns The drifted point and the centreline heading.
 */
export function samplePathWithLateral(
  points: Vec2[],
  t: number,
  seed: number,
  halfWidth: number,
  wander: WanderConfig = DEFAULT_WANDER,
): PathSample {
  const base = samplePath(points, t);
  const offset = lateralOffset(seed, t, wander) * halfWidth;

  // Left-hand normal of the heading: rotate the tangent +90°.
  const nx = -Math.sin(base.angle);
  const ny = Math.cos(base.angle);

  return { x: base.x + nx * offset, y: base.y + ny * offset, angle: base.angle };
}

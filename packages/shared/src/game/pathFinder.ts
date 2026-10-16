import type { Vec2, MapDefinition } from "./maps.js";
import { pathLength, samplePath, samplePathWithLateral } from "./path.js";

export interface LaneInfo {
  id: string;
  points: Vec2[];
  totalLength: number;
}

/**
 * PathFinder utility providing path analysis, waypoint progression,
 * multi-lane resolution, and corridor validation across all battlefields.
 */
export class PathFinder {
  /**
   * Extracts all playable lanes for a map definition with their lengths.
   */
  static getLanes(map: MapDefinition): LaneInfo[] {
    const lanes: LaneInfo[] = [];

    if (map.paths) {
      for (const [id, points] of Object.entries(map.paths)) {
        if (points && points.length >= 2) {
          lanes.push({
            id,
            points,
            totalLength: pathLength(points),
          });
        }
      }
    }

    if (lanes.length === 0 && map.path && map.path.length >= 2) {
      lanes.push({
        id: "main",
        points: map.path,
        totalLength: pathLength(map.path),
      });
    }

    return lanes;
  }

  /**
   * Resolves the coordinate point on a specific lane for progress `t` [0..1]
   * including seed-based organic lateral drift within corridor `halfWidth`.
   */
  static sampleLanePoint(
    map: MapDefinition,
    laneId: string,
    progress: number,
    seed: number = 0,
  ): Vec2 | undefined {
    const lane = this.getLanes(map).find((l) => l.id === laneId);
    if (!lane || lane.points.length < 2) return undefined;

    const halfWidth = map.pathHalfWidth ?? 0;
    return samplePathWithLateral(lane.points, progress, seed, halfWidth);
  }

  /**
   * Validates map path coordinates to ensure there are no zero-length segments
   * and all points fit inside the virtual arena space.
   */
  static validateMapPaths(map: MapDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const lanes = this.getLanes(map);

    if (lanes.length === 0) {
      errors.push(`Map ${map.id} has no valid paths with at least 2 points.`);
    }

    const maxX = map.width ?? 1280;
    const maxY = map.height ?? 720;

    for (const lane of lanes) {
      if (lane.totalLength <= 0) {
        errors.push(`Lane ${lane.id} on map ${map.id} has zero length.`);
      }
      for (let i = 0; i < lane.points.length; i++) {
        const pt = lane.points[i];
        if (pt.x < -100 || pt.x > maxX + 100 || pt.y < -100 || pt.y > maxY + 100) {
          errors.push(
            `Point ${i} in lane ${lane.id} (${pt.x}, ${pt.y}) is far outside arena bounds (${maxX}x${maxY}).`,
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

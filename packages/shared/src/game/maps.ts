/** 2D point in world space. */
export interface Vec2 {
  x: number;
  y: number;
}

/** A buildable tower slot fixed to the map. */
export interface TowerSlot {
  slotIndex: number;
  x: number;
  y: number;
}

/** A 2.5D isometric scenery prop placed on the battlefield. */
export interface MapProp {
  id: string;
  typeId: string;
  x: number;
  y: number;
  scale?: number;
  flipX?: boolean;
}

/**
 * Static map layout. Pure data shared by client (rendering) and server (sim).
 *
 * @remarks
 * `path` is the ordered list of waypoints for a single-track map; `checkpoints`
 * are indices into it that mark progression milestones. `slots` are the only
 * legal tower positions. `base` is the defender's core location.
 *
 * `paths` (optional) supports any number of named tracks, each a *complete*
 * polyline from its own spawn point to the base. Tracks may share geometry —
 * a fork (one spawn, two branches) duplicates the leading waypoints, a merge
 * (two spawns, one corridor) duplicates the trailing waypoints. Mobs keep
 * independent `pathId` routing even while overlapping on shared geometry, so
 * no explicit junction data is needed.
 *
 * `pathLabels` (optional) overrides the display name of each track in the
 * attacker's staging UI; unknown ids fall back to `"Path N"`.
 *
 * `width`/`height` (optional) define the virtual coordinate system size.
 */
export interface MapDefinition {
  id: string;
  /** Human-readable name shown in the reveal screen and map selector. */
  name?: string;
  /** Flavour text shown in the map selector. */
  description?: string;
  /** Number of lanes/corridors, shown in the map selector. */
  lanes?: number;
  /** Preview image path shown in the map selector and reveal. */
  thumbnail?: string;
  path: Vec2[];
  paths?: Record<string, Vec2[]>;
  pathLabels?: Record<string, string>;
  /** When true, spawned wave mobs randomly divide between fork paths. */
  randomFork?: boolean;
  /**
   * Per-portal deploy-charge overrides, keyed by portal id (`portal-0`, …).
   *
   * @remarks Lets a map tune a risky portal without touching global rules — e.g.
   * a portal sitting right next to the core can get a single charge and a much
   * longer refill so it stays strong without being free. Missing entries fall
   * back to {@link DEFAULT_DEPLOY_RULES}.
   */
  portalOverrides?: Record<string, { maxCharges?: number; chargeSec?: number; flipX?: boolean }>;
  slots: TowerSlot[];
  checkpoints: number[];
  base: Vec2;
  /** Custom base sprite image path. Defaults to /assets/maps/<folder>/base.png or fallback base_castle. */
  baseImage?: string;
  /** Optional custom base display size in pixels. */
  baseDisplaySize?: { width: number; height: number };
  /** Optional custom base origin. */
  baseOrigin?: Vec2;
  /** Vertical offset for floating base HP bar in pixels. Defaults to -150. */
  baseHpOffsetY?: number;
  /**
   * Explicit portal spawn locations, as exported by the map editor.
   *
   * @remarks This is the standard way to place portals: the editor writes the
   * exact points, and {@link mapPortals} attaches each track to the nearest
   * portal. Omitting it falls back to deriving portals from track spawn points,
   * which only exists for fixtures and legacy maps.
   */
  portals?: Vec2[];
  width?: number;
  height?: number;
  pathHalfWidth?: number;
  holderScale?: number;
  /** Placed 2.5D atmospheric scenery props and ambient NPCs. */
  props?: MapProp[];
}

/**
 * Ordered ids of the walkable tracks on a map.
 *
 * @param map - The map to inspect.
 * @returns One id per track long enough to walk; `["main"]` for a single-path
 * map, otherwise the keys of `paths` in insertion order.
 *
 * @remarks The order is the authoring order of `paths`, which also fixes the
 * order of the attacker's path tabs.
 */
export function mapPathIds(map: MapDefinition): string[] {
  if (map.paths) {
    return Object.entries(map.paths)
      .filter(([, points]) => points && points.length >= 2)
      .map(([pathId]) => pathId);
  }
  return map.path.length >= 2 ? ["main"] : [];
}

/**
 * Resolves a track id to its waypoints.
 *
 * @param map - The map to inspect.
 * @param pathId - A id from {@link mapPathIds} (`"main"` for single-path maps).
 * @returns The track's waypoints, or `undefined` when the id is unknown.
 */
export function mapPath(map: MapDefinition, pathId: string): Vec2[] | undefined {
  const named = map.paths?.[pathId];
  if (named) return named;
  return pathId === "main" ? map.path : undefined;
}

/** One attacker deploy portal, derived from the map's track spawn points. */
export interface MapPortal {
  /** Stable per-map id: `portal-0`, `portal-1`, … in path authoring order. */
  id: string;
  x: number;
  y: number;
  /** Track ids whose spawn point this portal sits on. */
  pathIds: string[];
  /** Charges this portal starts with; `undefined` falls back to the shared default. */
  maxCharges?: number;
  /** Seconds to regen one charge; `undefined` falls back to the shared default. */
  chargeSec?: number;
  /** Whether the portal sprite should be mirrored horizontally. */
  flipX?: boolean;
}

/**
 * Derives the attacker's deploy portals for a map.
 *
 * @param map - The map to inspect.
 * @returns One portal per deploy point, `portal-0`, `portal-1`, … in order.
 *
 * @remarks When the map editor has exported explicit {@link MapDefinition.portals},
 * those points are authoritative: they give the portal positions, and every
 * track is attached to the portal nearest its spawn. Tracks left without a
 * portal are unreachable, so the server must reject deploys for them — which is
 * exactly what falls out of both sides calling this helper. Without explicit
 * portals the deployment falls back to the track spawn points: tracks that
 * share a start (a fork) collapse into a single portal carrying both track
 * ids, while tracks with different starts (a merge) get one portal each.
 * Keyed by rounded coordinates so duplicated heads collapse together — the same
 * rule the client uses to draw portal sprites, so the server's portal ids
 * always line up with what players see. No map JSON change is ever needed to
 * add a portal.
 */
export function mapPortals(map: MapDefinition): MapPortal[] {
  const explicit = map.portals && map.portals.length > 0 ? map.portals : undefined;
  const byPoint = new Map<string, MapPortal>();
  const portals: MapPortal[] = [];

  if (explicit) {
    for (let index = 0; index < explicit.length; index++) {
      const point = explicit[index];
      const override = map.portalOverrides?.[`portal-${index}`];
      portals.push({
        id: `portal-${index}`,
        x: point.x,
        y: point.y,
        pathIds: [],
        ...override,
      });
    }
  }

  for (const pathId of mapPathIds(map)) {
    const path = mapPath(map, pathId);
    if (!path || path.length === 0) continue;

    const start = path[0];

    if (explicit) {
      // Attach the track to whichever portal sits closest to its spawn, so a
      // portal drawn where the editor put it still routes real units.
      let nearest: MapPortal | undefined;
      let nearestDistance = Infinity;
      for (const portal of portals) {
        const dx = portal.x - start.x;
        const dy = portal.y - start.y;
        const distance = dx * dx + dy * dy;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = portal;
        }
      }
      nearest?.pathIds.push(pathId);
      continue;
    }

    const key = `${Math.round(start.x)},${Math.round(start.y)}`;
    let portal = byPoint.get(key);
    if (!portal) {
      const id = `portal-${byPoint.size}`;
      const override = map.portalOverrides?.[id];
      portal = { id, x: start.x, y: start.y, pathIds: [], ...override };
      byPoint.set(key, portal);
      portals.push(portal);
    }
    portal.pathIds.push(pathId);
  }

  // An explicit portal with no track attached could never be deployed through,
  // so it never reaches the client either.
  return explicit ? portals.filter((portal) => portal.pathIds.length > 0) : portals;
}

/**
 * Determines whether a portal should be flipped horizontally based on its path direction.
 * Returns true if the path heads to the left (dx < 0), false if it heads to the right (dx >= 0).
 *
 * @param map - The map containing the path definitions.
 * @param portal - The portal to evaluate.
 */
export function portalShouldFlipX(map: MapDefinition, portal: MapPortal): boolean {
  if (portal.flipX !== undefined) {
    return portal.flipX;
  }
  for (const pathId of portal.pathIds) {
    const path = mapPath(map, pathId);
    if (!path || path.length < 2) continue;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - portal.x;
      if (Math.abs(dx) > 1) {
        return dx < 0;
      }
    }
  }
  return portal.x > 640;
}

/**
 * Sentinel map id meaning "draw one at random when the draft begins".
 *
 * @remarks Stored verbatim in room metadata and the lobby's map selector so the
 * picker can render a *Random* option; {@link pickRandomMapId} resolves it to a
 * concrete map just before the reveal.
 */
export const RANDOM_MAP_ID = "random";

export const SAMPLE_MAP: MapDefinition = {
  id: "sample",
  name: "Sample Field",
  path: [
    { x: 0, y: 100 },
    { x: 300, y: 100 },
    { x: 300, y: 300 },
    { x: 600, y: 300 },
    { x: 600, y: 500 },
    { x: 780, y: 500 },
  ],
  slots: [
    { slotIndex: 0, x: 220, y: 60 },
    { slotIndex: 1, x: 220, y: 180 },
    { slotIndex: 2, x: 360, y: 240 },
    { slotIndex: 3, x: 480, y: 240 },
    { slotIndex: 4, x: 540, y: 380 },
    { slotIndex: 5, x: 660, y: 440 },
  ],
  checkpoints: [1, 3],
  base: { x: 780, y: 500 },
  pathHalfWidth: 20,
};

export const KONBAUNG_MAP: MapDefinition = {
  id: "konbaung",
  name: "Konbaung (Palace Front)",
  description: "Custom tactical layout with precision waypoints and strategic tower pads.",
  lanes: 2,
  thumbnail: "/assets/maps/map_1_konbaung/preview.png",
  pathHalfWidth: 26,
  holderScale: 1,
  path: [],
  portals: [
    { x: 20, y: 108 },
    { x: 26, y: 586 },
  ],
  paths: {
    top: [
      { x: 20, y: 108 },
      { x: 291, y: 114 },
      { x: 317, y: 158 },
      { x: 338, y: 266 },
      { x: 403, y: 278 },
      { x: 509, y: 276 },
      { x: 584, y: 274 },
      { x: 674, y: 214 },
      { x: 714, y: 161 },
      { x: 786, y: 151 },
      { x: 815, y: 168 },
      { x: 829, y: 188 },
      { x: 835, y: 232 },
      { x: 835, y: 257 },
      { x: 838, y: 283 },
      { x: 841, y: 321 },
      { x: 854, y: 343 },
      { x: 874, y: 353 },
      { x: 914, y: 360 },
      { x: 946, y: 359 },
      { x: 974, y: 359 },
      { x: 994, y: 360 },
    ],
    bottom: [
      { x: 26, y: 586 },
      { x: 252, y: 587 },
      { x: 286, y: 517 },
      { x: 297, y: 451 },
      { x: 474, y: 443 },
      { x: 520, y: 532 },
      { x: 605, y: 602 },
      { x: 730, y: 623 },
      { x: 1062, y: 623 },
      { x: 1114, y: 562 },
      { x: 1110, y: 477 },
    ],
  },
  pathLabels: {
    top: "Top",
    bottom: "Bottom",
  },
  slots: [
    { slotIndex: 0, x: 246, y: 184 },
    { slotIndex: 1, x: 394, y: 218 },
    { slotIndex: 2, x: 758, y: 219 },
    { slotIndex: 3, x: 394, y: 509 },
    { slotIndex: 4, x: 1035, y: 550 },
    { slotIndex: 5, x: 145, y: 633 },
    { slotIndex: 6, x: 394, y: 386 },
    { slotIndex: 7, x: 191, y: 484 },
    { slotIndex: 8, x: 913, y: 310 },
    { slotIndex: 9, x: 800, y: 374 },
    { slotIndex: 10, x: 843, y: 666 },
    { slotIndex: 11, x: 639, y: 562 },
    { slotIndex: 12, x: 204, y: 632 },
  ],
  props: [

  ],
  checkpoints: [1, 3],
  base: { x: 1119, y: 370 },
  baseDisplaySize: { width: 231, height: 210 },
};

export const BAGAN_MAP: MapDefinition = {
  id: "bagan",
  name: "Bagan (Ancient Plains)",
  description: "Custom tactical layout with precision waypoints and strategic tower pads.",
  lanes: 4,
  thumbnail: "/assets/maps/map_2_bagan/preview.png",
  pathHalfWidth: 26,
  holderScale: 1.5,
  path: [],
  portals: [
    { x: 20, y: 437 },
    { x: 33, y: 148 },
    { x: 1155, y: 23 },
  ],
  paths: {
    top_north: [
      { x: 33, y: 148 },
      { x: 71, y: 153 },
      { x: 110, y: 151 },
      { x: 148, y: 150 },
      { x: 186, y: 147 },
      { x: 226, y: 151 },
      { x: 265, y: 154 },
      { x: 298, y: 147 },
      { x: 316, y: 111 },
      { x: 347, y: 85 },
      { x: 383, y: 75 },
      { x: 421, y: 74 },
      { x: 458, y: 81 },
      { x: 494, y: 88 },
      { x: 531, y: 100 },
      { x: 564, y: 121 },
      { x: 599, y: 136 },
      { x: 637, y: 139 },
      { x: 674, y: 137 },
      { x: 712, y: 123 },
      { x: 750, y: 109 },
      { x: 787, y: 101 },
      { x: 825, y: 103 },
      { x: 859, y: 124 },
      { x: 883, y: 153 },
      { x: 891, y: 190 },
      { x: 896, y: 228 },
      { x: 878, y: 262 },
      { x: 869, y: 275 },
      { x: 810, y: 360 },
    ],
    top_south: [
      { x: 33, y: 148 },
      { x: 71, y: 153 },
      { x: 110, y: 151 },
      { x: 148, y: 150 },
      { x: 186, y: 147 },
      { x: 226, y: 151 },
      { x: 265, y: 154 },
      { x: 302, y: 164 },
      { x: 310, y: 203 },
      { x: 338, y: 228 },
      { x: 376, y: 239 },
      { x: 415, y: 244 },
      { x: 444, y: 215 },
      { x: 462, y: 179 },
      { x: 460, y: 140 },
      { x: 457, y: 100 },
      { x: 491, y: 87 },
      { x: 527, y: 98 },
      { x: 562, y: 120 },
      { x: 598, y: 136 },
      { x: 636, y: 139 },
      { x: 674, y: 137 },
      { x: 712, y: 123 },
      { x: 750, y: 109 },
      { x: 787, y: 101 },
      { x: 825, y: 103 },
      { x: 859, y: 124 },
      { x: 883, y: 153 },
      { x: 891, y: 190 },
      { x: 896, y: 228 },
      { x: 878, y: 262 },
      { x: 869, y: 275 },
      { x: 810, y: 360 },
    ],
    bottom: [
      { x: 20, y: 437 },
      { x: 61, y: 443 },
      { x: 99, y: 443 },
      { x: 139, y: 449 },
      { x: 168, y: 472 },
      { x: 171, y: 510 },
      { x: 158, y: 548 },
      { x: 165, y: 585 },
      { x: 198, y: 607 },
      { x: 230, y: 628 },
      { x: 267, y: 635 },
      { x: 303, y: 622 },
      { x: 331, y: 595 },
      { x: 349, y: 560 },
      { x: 357, y: 523 },
      { x: 365, y: 486 },
      { x: 380, y: 450 },
      { x: 410, y: 427 },
      { x: 447, y: 422 },
      { x: 482, y: 436 },
      { x: 502, y: 467 },
      { x: 508, y: 507 },
      { x: 520, y: 546 },
      { x: 534, y: 582 },
      { x: 552, y: 618 },
      { x: 583, y: 639 },
      { x: 621, y: 643 },
      { x: 659, y: 646 },
      { x: 697, y: 637 },
      { x: 733, y: 627 },
      { x: 769, y: 615 },
      { x: 797, y: 589 },
      { x: 831, y: 574 },
      { x: 870, y: 574 },
      { x: 907, y: 582 },
      { x: 945, y: 591 },
      { x: 983, y: 606 },
      { x: 1020, y: 618 },
      { x: 1058, y: 624 },
      { x: 1093, y: 611 },
      { x: 1123, y: 587 },
      { x: 1139, y: 551 },
      { x: 1140, y: 511 },
      { x: 1136, y: 473 },
      { x: 1123, y: 437 },
      { x: 1104, y: 401 },
      { x: 1072, y: 377 },
      { x: 1035, y: 368 },
      { x: 996, y: 371 },
      { x: 958, y: 372 },
      { x: 940, y: 374 },
      { x: 810, y: 360 },
    ],
    bridge: [
      { x: 1155, y: 23 },
      { x: 1143, y: 62 },
      { x: 1122, y: 94 },
      { x: 1091, y: 115 },
      { x: 1059, y: 129 },
      { x: 1027, y: 152 },
      { x: 1016, y: 189 },
      { x: 1038, y: 219 },
      { x: 1067, y: 243 },
      { x: 1084, y: 276 },
      { x: 1084, y: 316 },
      { x: 1073, y: 353 },
      { x: 1041, y: 368 },
      { x: 1003, y: 369 },
      { x: 963, y: 372 },
      { x: 940, y: 374 },
      { x: 810, y: 360 },
    ],
  },
  pathLabels: {
    top_north: "Top North",
    top_south: "Top South",
    bottom: "Bottom",
    bridge: "Bridge",
  },
  slots: [
    { slotIndex: 0, x: 118, y: 639 },
    { slotIndex: 1, x: 90, y: 363 },
    { slotIndex: 2, x: 389, y: 168 },
    { slotIndex: 3, x: 440, y: 506 },
    { slotIndex: 4, x: 634, y: 79 },
    { slotIndex: 5, x: 686, y: 563 },
    { slotIndex: 6, x: 809, y: 177 },
    { slotIndex: 7, x: 1013, y: 297 },
    { slotIndex: 8, x: 874, y: 642 },
    { slotIndex: 9, x: 1214, y: 566 },
    { slotIndex: 10, x: 1226, y: 54 },
    { slotIndex: 11, x: 195, y: 397 },
    { slotIndex: 12, x: 1159, y: 178 },
    { slotIndex: 13, x: 1013, y: 82 },
    { slotIndex: 14, x: 954, y: 228 },
  ],
  checkpoints: [1, 3],
  base: { x: 810, y: 360 },
  baseDisplaySize: { width: 235, height: 235 },
};

export const INLE_MAP: MapDefinition = {
  id: "inle",
  name: "Inle (Floating Lake)",
  description: "Custom tactical layout with precision waypoints and strategic tower pads.",
  lanes: 1,
  thumbnail: "/assets/maps/map_3_inle/preview.png",
  pathHalfWidth: 26,
  path: [],
  portals: [
    { x: 65, y: 359 },
  ],
  paths: {
    top: [
      { x: 65, y: 359 },
      { x: 120, y: 356 },
      { x: 154, y: 326 },
      { x: 178, y: 261 },
      { x: 181, y: 196 },
      { x: 199, y: 131 },
      { x: 260, y: 93 },
      { x: 329, y: 105 },
      { x: 383, y: 160 },
      { x: 382, y: 224 },
      { x: 336, y: 282 },
      { x: 279, y: 336 },
      { x: 305, y: 414 },
      { x: 379, y: 450 },
      { x: 463, y: 444 },
      { x: 523, y: 379 },
      { x: 561, y: 302 },
      { x: 614, y: 250 },
      { x: 674, y: 190 },
      { x: 723, y: 145 },
      { x: 784, y: 107 },
      { x: 855, y: 84 },
      { x: 926, y: 116 },
      { x: 960, y: 190 },
      { x: 960, y: 210 },
      { x: 962, y: 234 },
      { x: 961, y: 258 },
    ],
    bottom: [
      { x: 65, y: 359 },
      { x: 116, y: 364 },
      { x: 157, y: 356 },
      { x: 164, y: 379 },
      { x: 174, y: 432 },
      { x: 166, y: 486 },
      { x: 168, y: 540 },
      { x: 211, y: 588 },
      { x: 265, y: 602 },
      { x: 319, y: 609 },
      { x: 372, y: 596 },
      { x: 418, y: 561 },
      { x: 468, y: 534 },
      { x: 521, y: 506 },
      { x: 575, y: 500 },
      { x: 629, y: 515 },
      { x: 682, y: 544 },
      { x: 730, y: 589 },
      { x: 784, y: 614 },
      { x: 838, y: 619 },
      { x: 891, y: 612 },
      { x: 931, y: 564 },
      { x: 960, y: 525 },
      { x: 961, y: 491 },
      { x: 961, y: 466 },
    ],
  },
  pathLabels: {
    top: "Top",
    bottom: "Bottom",
  },
  slots: [
    { slotIndex: 0, x: 283, y: 196 },
    { slotIndex: 1, x: 285, y: 532 },
    { slotIndex: 2, x: 409, y: 356 },
    { slotIndex: 3, x: 502, y: 203 },
    { slotIndex: 4, x: 617, y: 613 },
    { slotIndex: 5, x: 622, y: 399 },
    { slotIndex: 6, x: 693, y: 56 },
    { slotIndex: 7, x: 1071, y: 125 },
    { slotIndex: 8, x: 1115, y: 594 },
  ],
  checkpoints: [1, 3],
  base: { x: 970, y: 362 },
  baseDisplaySize: { width: 231, height: 210 },
};

export const MANDALAY_MAP: MapDefinition = {
  id: "mandalay",
  name: "Mandalay (Royal Citadel)",
  description: "Custom tactical layout with precision waypoints and strategic tower pads.",
  lanes: 3,
  thumbnail: "/assets/maps/map_4_mandalay/preview.png",
  pathHalfWidth: 26,
  path: [],
  portals: [
    { x: 468, y: 38 },
    { x: 1258, y: 179 },
    { x: 927, y: 708 },
  ],
  paths: {
    north_bridge: [
      { x: 468, y: 38 },
      { x: 470, y: 164 },
      { x: 707, y: 173 },
      { x: 708, y: 268 },
      { x: 806, y: 273 },
      { x: 798, y: 458 },
      { x: 593, y: 454 },
      { x: 594, y: 369 },
      { x: 496, y: 362 },
      { x: 403, y: 364 },
      { x: 342, y: 360 },
    ],
    east_bridge: [
      { x: 1258, y: 179 },
      { x: 980, y: 180 },
      { x: 973, y: 360 },
      { x: 799, y: 356 },
      { x: 798, y: 457 },
      { x: 592, y: 454 },
      { x: 593, y: 368 },
      { x: 345, y: 359 },
    ],
    bottom: [
      { x: 927, y: 708 },
      { x: 927, y: 591 },
      { x: 399, y: 589 },
      { x: 397, y: 625 },
      { x: 232, y: 625 },
      { x: 230, y: 468 },
    ],
  },
  pathLabels: {
    north_bridge: "North Bridge",
    east_bridge: "East Bridge",
    bottom: "Bottom",
  },
  slots: [
    { slotIndex: 0, x: 437, y: 308 },
    { slotIndex: 1, x: 286, y: 573 },
    { slotIndex: 2, x: 650, y: 218 },
    { slotIndex: 3, x: 702, y: 363 },
    { slotIndex: 4, x: 586, y: 633 },
    { slotIndex: 5, x: 1034, y: 233 },
    { slotIndex: 6, x: 989, y: 682 },
    { slotIndex: 7, x: 519, y: 114 },
    { slotIndex: 8, x: 859, y: 312 },
    { slotIndex: 9, x: 856, y: 408 },
    { slotIndex: 10, x: 521, y: 310 },
    { slotIndex: 11, x: 522, y: 412 },
    { slotIndex: 12, x: 698, y: 511 },
  ],
  checkpoints: [1, 3],
  base: { x: 230, y: 356 },
  baseDisplaySize: { width: 231, height: 210 },
};

export const INNWA_MAP: MapDefinition = {
  id: "innwa",
  name: "Innwa (Golden Kingdom)",
  description: "Custom tactical layout with precision waypoints and strategic tower pads.",
  lanes: 2,
  thumbnail: "/assets/maps/map_5_innwa/preview.png",
  pathHalfWidth: 26,
  path: [],
  portals: [
    { x: 191, y: 160 },
    { x: 1252, y: 26 },
  ],
  paths: {
    top: [
      { x: 191, y: 160 },
      { x: 222, y: 274 },
      { x: 336, y: 314 },
      { x: 437, y: 246 },
      { x: 490, y: 162 },
      { x: 614, y: 170 },
      { x: 668, y: 226 },
      { x: 663, y: 291 },
      { x: 641, y: 351 },
      { x: 628, y: 411 },
      { x: 630, y: 453 },
      { x: 630, y: 474 },
    ],
    top_left: [
      { x: 191, y: 160 },
      { x: 217, y: 247 },
      { x: 246, y: 286 },
      { x: 309, y: 303 },
      { x: 334, y: 318 },
      { x: 308, y: 359 },
      { x: 270, y: 393 },
      { x: 221, y: 425 },
      { x: 179, y: 467 },
      { x: 162, y: 501 },
      { x: 173, y: 533 },
      { x: 217, y: 567 },
      { x: 273, y: 578 },
      { x: 342, y: 576 },
      { x: 366, y: 559 },
      { x: 414, y: 564 },
      { x: 447, y: 559 },
      { x: 478, y: 561 },
      { x: 507, y: 565 },
      { x: 519, y: 567 },
    ],
    top_right: [
      { x: 1252, y: 26 },
      { x: 1202, y: 65 },
      { x: 1160, y: 99 },
      { x: 1132, y: 140 },
      { x: 1086, y: 169 },
      { x: 1047, y: 178 },
      { x: 984, y: 184 },
      { x: 933, y: 197 },
      { x: 893, y: 233 },
      { x: 878, y: 279 },
      { x: 883, y: 322 },
      { x: 918, y: 364 },
      { x: 983, y: 375 },
      { x: 1030, y: 386 },
      { x: 1075, y: 404 },
      { x: 1111, y: 427 },
      { x: 1141, y: 464 },
      { x: 1142, y: 495 },
      { x: 1146, y: 533 },
      { x: 1085, y: 589 },
      { x: 1017, y: 597 },
      { x: 966, y: 570 },
      { x: 917, y: 536 },
      { x: 868, y: 528 },
      { x: 813, y: 531 },
      { x: 789, y: 554 },
      { x: 756, y: 564 },
    ],
  },
  pathLabels: {
    top: "Top",
    top_left: "Top Left",
    top_right: "Top Right",
  },
  slots: [
    { slotIndex: 0, x: 248, y: 500 },
    { slotIndex: 1, x: 360, y: 180 },
    { slotIndex: 2, x: 379, y: 494 },
    { slotIndex: 3, x: 568, y: 298 },
    { slotIndex: 4, x: 163, y: 363 },
    { slotIndex: 5, x: 535, y: 389 },
    { slotIndex: 6, x: 721, y: 368 },
    { slotIndex: 7, x: 904, y: 594 },
    { slotIndex: 8, x: 118, y: 633 },
    { slotIndex: 9, x: 378, y: 620 },
    { slotIndex: 10, x: 1060, y: 522 },
    { slotIndex: 11, x: 1182, y: 625 },
    { slotIndex: 12, x: 966, y: 302 },
    { slotIndex: 13, x: 984, y: 114 },
    { slotIndex: 14, x: 728, y: 136 },
  ],
  checkpoints: [1, 3],
  base: { x: 634, y: 591 },
  baseDisplaySize: { width: 235, height: 235 },
};

export const RAKHINE_MAP: MapDefinition = INNWA_MAP;

export const BAGO_MAP: MapDefinition = {
  id: "bago",
  name: "Bago (Hanthawaddy Fortress)",
  description: "Custom tactical layout with precision waypoints and strategic tower pads.",
  lanes: 3,
  thumbnail: "/assets/maps/map_6_bago/preview.png",
  pathHalfWidth: 26,
  path: [],
  portals: [
    { x: 20, y: 343 },
    { x: 664, y: 23 },
    { x: 1198, y: 312 },
  ],
  paths: {
    bottom: [
      { x: 20, y: 343 },
      { x: 163, y: 344 },
      { x: 309, y: 342 },
      { x: 384, y: 352 },
      { x: 458, y: 386 },
      { x: 537, y: 428 },
      { x: 627, y: 442 },
      { x: 645, y: 574 },
    ],
    top: [
      { x: 664, y: 23 },
      { x: 660, y: 136 },
      { x: 638, y: 252 },
      { x: 628, y: 360 },
      { x: 628, y: 431 },
      { x: 656, y: 573 },
    ],
    side: [
      { x: 1198, y: 312 },
      { x: 1070, y: 374 },
      { x: 1016, y: 388 },
      { x: 902, y: 410 },
      { x: 758, y: 408 },
      { x: 696, y: 416 },
      { x: 627, y: 431 },
      { x: 664, y: 572 },
    ],
  },
  pathLabels: {
    bottom: "Bottom",
    top: "Top",
    side: "Side",
  },
  slots: [
    { slotIndex: 0, x: 316, y: 440 },
    { slotIndex: 1, x: 275, y: 197 },
    { slotIndex: 2, x: 729, y: 325 },
    { slotIndex: 3, x: 573, y: 104 },
    { slotIndex: 4, x: 839, y: 519 },
    { slotIndex: 5, x: 1075, y: 512 },
    { slotIndex: 6, x: 750, y: 121 },
    { slotIndex: 7, x: 1207, y: 548 },
    { slotIndex: 8, x: 973, y: 294 },
  ],
  checkpoints: [1, 3],
  base: { x: 654, y: 641 },
  baseDisplaySize: { width: 223, height: 135 },
};

/**
 * Placeholder map exercising a merge: three spawns, two of which fuse into a
 * shared corridor so only two routes reach the base.
 *
 * @remarks `upper` and `middle` share an identical trailing section
 * (`{800,300}` onward); `lower` keeps its own approach. Purely a test fixture
 * until real art exists.
 */
export const DESERTED_MAP: MapDefinition = {
  id: "deserted",
  name: "Sri Ksetra (Ancient Sands)",
  description: "Custom tactical layout with precision waypoints and strategic tower pads.",
  lanes: 5,
  thumbnail: "/assets/maps/map_7_deserted/preview.png",
  pathHalfWidth: 26,
  holderScale: 1,
  path: [],
  portals: [
    { x: 20, y: 696 },
    { x: 22, y: 30 },
    { x: 610, y: 19 },
    { x: 1252, y: 37 },
    { x: 1248, y: 704 },
  ],
  paths: {
    path_1: [
      { x: 13, y: 709 },
      { x: 43, y: 690 },
      { x: 70, y: 667 },
      { x: 118, y: 639 },
      { x: 158, y: 621 },
      { x: 189, y: 603 },
      { x: 230, y: 610 },
      { x: 276, y: 608 },
      { x: 316, y: 592 },
      { x: 349, y: 574 },
      { x: 376, y: 560 },
      { x: 418, y: 561 },
      { x: 454, y: 566 },
      { x: 487, y: 573 },
      { x: 528, y: 599 },
      { x: 558, y: 609 },
    ],
    path_2: [
      { x: 16, y: 24 },
      { x: 43, y: 44 },
      { x: 78, y: 59 },
      { x: 113, y: 83 },
      { x: 145, y: 101 },
      { x: 164, y: 121 },
      { x: 140, y: 156 },
      { x: 118, y: 169 },
      { x: 144, y: 207 },
      { x: 185, y: 230 },
      { x: 222, y: 223 },
      { x: 265, y: 208 },
      { x: 296, y: 199 },
      { x: 333, y: 201 },
      { x: 363, y: 210 },
      { x: 389, y: 241 },
      { x: 366, y: 266 },
      { x: 316, y: 288 },
      { x: 278, y: 309 },
      { x: 234, y: 337 },
      { x: 208, y: 363 },
      { x: 180, y: 379 },
      { x: 148, y: 401 },
      { x: 148, y: 432 },
      { x: 183, y: 448 },
      { x: 222, y: 474 },
      { x: 243, y: 493 },
      { x: 246, y: 524 },
      { x: 208, y: 549 },
      { x: 177, y: 572 },
      { x: 189, y: 590 },
      { x: 214, y: 603 },
      { x: 256, y: 611 },
      { x: 296, y: 591 },
      { x: 335, y: 578 },
      { x: 369, y: 566 },
      { x: 404, y: 563 },
      { x: 447, y: 568 },
      { x: 474, y: 573 },
      { x: 500, y: 583 },
      { x: 525, y: 592 },
      { x: 548, y: 606 },
      { x: 567, y: 614 },
    ],
    path_3: [
      { x: 616, y: 6 },
      { x: 606, y: 28 },
      { x: 569, y: 48 },
      { x: 542, y: 59 },
      { x: 518, y: 77 },
      { x: 495, y: 101 },
      { x: 520, y: 131 },
      { x: 572, y: 152 },
      { x: 607, y: 167 },
      { x: 636, y: 187 },
      { x: 667, y: 210 },
      { x: 634, y: 232 },
      { x: 590, y: 259 },
      { x: 560, y: 280 },
      { x: 536, y: 302 },
      { x: 542, y: 326 },
      { x: 578, y: 348 },
      { x: 608, y: 371 },
      { x: 638, y: 391 },
      { x: 660, y: 419 },
      { x: 685, y: 440 },
      { x: 669, y: 472 },
      { x: 626, y: 493 },
      { x: 597, y: 518 },
      { x: 584, y: 538 },
      { x: 580, y: 560 },
      { x: 580, y: 578 },
      { x: 585, y: 594 },
    ],
    path_4: [
      { x: 1259, y: 707 },
      { x: 1229, y: 698 },
      { x: 1179, y: 670 },
      { x: 1144, y: 638 },
      { x: 1126, y: 610 },
      { x: 1139, y: 590 },
      { x: 1175, y: 568 },
      { x: 1195, y: 546 },
      { x: 1198, y: 524 },
      { x: 1202, y: 503 },
      { x: 1189, y: 486 },
      { x: 1155, y: 472 },
      { x: 1104, y: 472 },
      { x: 1076, y: 484 },
      { x: 1042, y: 497 },
      { x: 1007, y: 517 },
      { x: 998, y: 536 },
      { x: 1006, y: 559 },
      { x: 998, y: 574 },
      { x: 980, y: 586 },
      { x: 957, y: 589 },
      { x: 933, y: 594 },
      { x: 918, y: 596 },
      { x: 899, y: 591 },
      { x: 887, y: 587 },
      { x: 876, y: 579 },
      { x: 874, y: 566 },
      { x: 874, y: 553 },
      { x: 887, y: 528 },
      { x: 896, y: 519 },
      { x: 914, y: 508 },
      { x: 927, y: 498 },
      { x: 934, y: 462 },
      { x: 892, y: 442 },
      { x: 858, y: 419 },
      { x: 843, y: 397 },
      { x: 863, y: 371 },
      { x: 905, y: 360 },
      { x: 936, y: 338 },
      { x: 966, y: 313 },
      { x: 987, y: 290 },
      { x: 976, y: 270 },
      { x: 943, y: 248 },
      { x: 916, y: 230 },
      { x: 877, y: 207 },
      { x: 834, y: 188 },
      { x: 809, y: 179 },
      { x: 769, y: 172 },
      { x: 745, y: 171 },
      { x: 709, y: 174 },
      { x: 689, y: 197 },
      { x: 652, y: 220 },
      { x: 616, y: 237 },
      { x: 600, y: 256 },
      { x: 576, y: 270 },
      { x: 554, y: 286 },
      { x: 547, y: 304 },
      { x: 550, y: 331 },
      { x: 576, y: 354 },
      { x: 607, y: 370 },
      { x: 636, y: 393 },
      { x: 652, y: 406 },
      { x: 669, y: 426 },
      { x: 678, y: 447 },
      { x: 685, y: 459 },
      { x: 662, y: 473 },
      { x: 633, y: 499 },
      { x: 610, y: 510 },
      { x: 585, y: 540 },
      { x: 583, y: 571 },
      { x: 585, y: 591 },
    ],
    path_5: [
      { x: 1265, y: 29 },
      { x: 1229, y: 40 },
      { x: 1188, y: 59 },
      { x: 1158, y: 86 },
      { x: 1138, y: 100 },
      { x: 1143, y: 130 },
      { x: 1169, y: 148 },
      { x: 1190, y: 174 },
      { x: 1196, y: 206 },
      { x: 1160, y: 228 },
      { x: 1110, y: 238 },
      { x: 1056, y: 250 },
      { x: 1029, y: 263 },
      { x: 987, y: 269 },
      { x: 960, y: 259 },
      { x: 936, y: 238 },
      { x: 912, y: 232 },
      { x: 895, y: 214 },
      { x: 860, y: 201 },
      { x: 824, y: 189 },
      { x: 789, y: 177 },
      { x: 760, y: 174 },
      { x: 743, y: 166 },
      { x: 723, y: 174 },
      { x: 549, y: 282 },
      { x: 536, y: 313 },
      { x: 552, y: 330 },
      { x: 680, y: 432 },
      { x: 687, y: 462 },
      { x: 574, y: 530 },
      { x: 589, y: 591 },
    ],
  },
  pathLabels: {
    path_1: "Path 1",
    path_2: "Path 2",
    path_3: "Path 3",
    path_4: "Path 4",
    path_5: "Path 5",
  },
  slots: [
    { slotIndex: 0, x: 488, y: 633 },
    { slotIndex: 1, x: 490, y: 524 },
    { slotIndex: 2, x: 389, y: 510 },
    { slotIndex: 3, x: 394, y: 609 },
    { slotIndex: 4, x: 205, y: 654 },
    { slotIndex: 5, x: 309, y: 643 },
    { slotIndex: 6, x: 257, y: 567 },
    { slotIndex: 7, x: 323, y: 534 },
    { slotIndex: 8, x: 629, y: 548 },
    { slotIndex: 9, x: 683, y: 516 },
    { slotIndex: 10, x: 747, y: 457 },
    { slotIndex: 11, x: 722, y: 398 },
    { slotIndex: 12, x: 604, y: 442 },
    { slotIndex: 13, x: 283, y: 454 },
    { slotIndex: 14, x: 225, y: 420 },
    { slotIndex: 15, x: 324, y: 240 },
    { slotIndex: 16, x: 40, y: 206 },
    { slotIndex: 17, x: 93, y: 240 },
    { slotIndex: 18, x: 79, y: 126 },
    { slotIndex: 19, x: 589, y: 212 },
    { slotIndex: 20, x: 528, y: 184 },
    { slotIndex: 21, x: 590, y: 119 },
    { slotIndex: 22, x: 660, y: 151 },
    { slotIndex: 23, x: 437, y: 98 },
    { slotIndex: 24, x: 643, y: 56 },
    { slotIndex: 25, x: 870, y: 481 },
    { slotIndex: 26, x: 923, y: 397 },
    { slotIndex: 27, x: 1025, y: 343 },
    { slotIndex: 28, x: 94, y: 598 },
    { slotIndex: 29, x: 137, y: 697 },
    { slotIndex: 30, x: 1094, y: 289 },
    { slotIndex: 31, x: 998, y: 220 },
    { slotIndex: 32, x: 910, y: 294 },
    { slotIndex: 33, x: 1058, y: 441 },
    { slotIndex: 34, x: 1136, y: 512 },
    { slotIndex: 35, x: 1230, y: 463 },
    { slotIndex: 36, x: 1209, y: 619 },
    { slotIndex: 37, x: 1125, y: 693 },
    { slotIndex: 38, x: 1058, y: 618 },
    { slotIndex: 39, x: 1090, y: 561 },
    { slotIndex: 40, x: 940, y: 641 },
    { slotIndex: 41, x: 1134, y: 191 },
    { slotIndex: 42, x: 1127, y: 41 },
    { slotIndex: 43, x: 806, y: 579 },
  ],
  checkpoints: [1, 3],
  base: { x: 645, y: 632 },
  baseDisplaySize: { width: 180, height: 120 },
};

export const TWISTER_MAP: MapDefinition = {
  id: "twister",
  name: "Taungoo (Mountain Pass)",
  description: "Custom tactical layout with precision waypoints and strategic tower pads.",
  lanes: 7,
  thumbnail: "/assets/maps/map_8_twister/preview.png",
  pathHalfWidth: 26,
  holderScale: 1,
  path: [],
  portals: [
    { x: 71, y: 34 },
    { x: 39, y: 692 },
    { x: 1238, y: 674 },
    { x: 1205, y: 39 },
  ],
  paths: {
    p_0: [
      { x: 71, y: 34 },
      { x: 73, y: 39 },
      { x: 106, y: 61 },
      { x: 144, y: 72 },
      { x: 165, y: 90 },
      { x: 177, y: 117 },
      { x: 154, y: 140 },
      { x: 130, y: 176 },
      { x: 129, y: 198 },
      { x: 155, y: 213 },
      { x: 176, y: 213 },
      { x: 218, y: 204 },
      { x: 246, y: 187 },
      { x: 276, y: 166 },
      { x: 305, y: 142 },
      { x: 340, y: 124 },
      { x: 379, y: 103 },
      { x: 414, y: 90 },
      { x: 446, y: 92 },
      { x: 475, y: 106 },
      { x: 500, y: 121 },
      { x: 518, y: 143 },
      { x: 523, y: 162 },
      { x: 498, y: 183 },
      { x: 472, y: 204 },
      { x: 444, y: 213 },
      { x: 429, y: 238 },
      { x: 472, y: 258 },
      { x: 509, y: 288 },
      { x: 549, y: 304 },
      { x: 578, y: 322 },
      { x: 593, y: 332 },
    ],
    p_1: [
      { x: 39, y: 690 },
      { x: 98, y: 663 },
      { x: 129, y: 651 },
      { x: 157, y: 612 },
      { x: 160, y: 583 },
      { x: 137, y: 551 },
      { x: 136, y: 512 },
      { x: 173, y: 492 },
      { x: 234, y: 473 },
      { x: 267, y: 486 },
      { x: 304, y: 498 },
      { x: 340, y: 516 },
      { x: 367, y: 524 },
      { x: 407, y: 536 },
      { x: 458, y: 517 },
      { x: 460, y: 481 },
      { x: 427, y: 470 },
      { x: 468, y: 456 },
      { x: 488, y: 441 },
      { x: 525, y: 428 },
      { x: 550, y: 409 },
      { x: 576, y: 393 },
    ],
    p_3: [
      { x: 1197, y: 48 },
      { x: 1172, y: 63 },
      { x: 1140, y: 81 },
      { x: 1118, y: 99 },
      { x: 1127, y: 133 },
      { x: 1154, y: 158 },
      { x: 1155, y: 193 },
      { x: 1130, y: 221 },
      { x: 1070, y: 238 },
      { x: 1014, y: 232 },
      { x: 974, y: 237 },
      { x: 964, y: 259 },
      { x: 967, y: 291 },
      { x: 1005, y: 321 },
      { x: 1069, y: 352 },
      { x: 1092, y: 379 },
      { x: 1100, y: 403 },
      { x: 1078, y: 440 },
      { x: 1034, y: 451 },
      { x: 1029, y: 410 },
      { x: 1013, y: 392 },
      { x: 982, y: 383 },
      { x: 953, y: 397 },
      { x: 938, y: 416 },
      { x: 912, y: 448 },
      { x: 868, y: 470 },
      { x: 824, y: 463 },
      { x: 787, y: 431 },
      { x: 742, y: 411 },
      { x: 710, y: 404 },
    ],
    p_4: [
      { x: 1222, y: 680 },
      { x: 1204, y: 663 },
      { x: 1162, y: 648 },
      { x: 1127, y: 619 },
      { x: 1103, y: 597 },
      { x: 1108, y: 558 },
      { x: 1145, y: 533 },
      { x: 1154, y: 510 },
      { x: 1118, y: 494 },
      { x: 1078, y: 494 },
      { x: 1047, y: 512 },
      { x: 1029, y: 551 },
      { x: 1008, y: 590 },
      { x: 978, y: 623 },
      { x: 953, y: 647 },
      { x: 900, y: 641 },
      { x: 862, y: 609 },
      { x: 836, y: 579 },
      { x: 832, y: 548 },
      { x: 868, y: 527 },
      { x: 920, y: 507 },
      { x: 962, y: 489 },
      { x: 1012, y: 463 },
      { x: 1032, y: 427 },
      { x: 1029, y: 392 },
      { x: 985, y: 387 },
      { x: 937, y: 410 },
      { x: 914, y: 446 },
      { x: 874, y: 468 },
      { x: 838, y: 454 },
      { x: 803, y: 438 },
      { x: 752, y: 418 },
      { x: 729, y: 404 },
      { x: 706, y: 392 },
    ],
    pa_5: [
      { x: 1117, y: 226 },
      { x: 1062, y: 194 },
      { x: 1038, y: 181 },
      { x: 1000, y: 172 },
      { x: 969, y: 179 },
      { x: 916, y: 202 },
      { x: 874, y: 223 },
      { x: 826, y: 249 },
      { x: 785, y: 276 },
      { x: 746, y: 294 },
      { x: 712, y: 312 },
    ],
    pa_6: [
      { x: 434, y: 232 },
      { x: 380, y: 232 },
      { x: 330, y: 228 },
      { x: 282, y: 250 },
      { x: 234, y: 277 },
      { x: 194, y: 311 },
      { x: 167, y: 342 },
      { x: 196, y: 374 },
      { x: 234, y: 398 },
      { x: 278, y: 417 },
      { x: 306, y: 438 },
      { x: 354, y: 462 },
      { x: 388, y: 468 },
      { x: 443, y: 473 },
      { x: 462, y: 448 },
      { x: 500, y: 434 },
      { x: 537, y: 419 },
      { x: 572, y: 393 },
    ],
    pa_7: [
      { x: 453, y: 477 },
      { x: 392, y: 477 },
      { x: 349, y: 468 },
      { x: 296, y: 441 },
      { x: 250, y: 411 },
      { x: 205, y: 381 },
      { x: 176, y: 354 },
      { x: 173, y: 321 },
      { x: 214, y: 298 },
      { x: 246, y: 271 },
      { x: 277, y: 251 },
      { x: 316, y: 239 },
      { x: 360, y: 227 },
      { x: 427, y: 237 },
      { x: 472, y: 261 },
      { x: 509, y: 284 },
      { x: 542, y: 303 },
      { x: 563, y: 311 },
    ],
  },
  pathLabels: {
    p_0: "P 0",
    p_1: "P 1",
    p_3: "P 3",
    p_4: "P 4",
    pa_5: "Pa 5",
    pa_6: "Pa 6",
    pa_7: "Pa 7",
  },
  slots: [
    { slotIndex: 0, x: 394, y: 279 },
    { slotIndex: 1, x: 491, y: 333 },
    { slotIndex: 2, x: 430, y: 143 },
    { slotIndex: 3, x: 109, y: 114 },
    { slotIndex: 4, x: 215, y: 59 },
    { slotIndex: 5, x: 94, y: 241 },
    { slotIndex: 6, x: 198, y: 659 },
    { slotIndex: 7, x: 105, y: 602 },
    { slotIndex: 8, x: 196, y: 532 },
    { slotIndex: 9, x: 126, y: 467 },
    { slotIndex: 10, x: 525, y: 477 },
    { slotIndex: 11, x: 596, y: 447 },
    { slotIndex: 12, x: 380, y: 426 },
    { slotIndex: 13, x: 269, y: 371 },
    { slotIndex: 14, x: 907, y: 153 },
    { slotIndex: 15, x: 996, y: 106 },
    { slotIndex: 16, x: 1109, y: 167 },
    { slotIndex: 17, x: 1057, y: 292 },
    { slotIndex: 18, x: 1091, y: 667 },
    { slotIndex: 19, x: 1176, y: 596 },
    { slotIndex: 20, x: 926, y: 591 },
    { slotIndex: 21, x: 853, y: 666 },
    { slotIndex: 22, x: 791, y: 506 },
    { slotIndex: 23, x: 727, y: 250 },
    { slotIndex: 24, x: 1195, y: 238 },
    { slotIndex: 25, x: 425, y: 586 },
    { slotIndex: 26, x: 104, y: 351 },
    { slotIndex: 27, x: 338, y: 181 },
    { slotIndex: 28, x: 578, y: 229 },
    { slotIndex: 29, x: 396, y: 52 },
    { slotIndex: 30, x: 307, y: 88 },
  ],
  props: [
    { id: "prop_1792990221212_b19e", typeId: "tree_banyan", x: 633, y: 704 },
  ],
  checkpoints: [1, 3],
  base: { x: 638, y: 354 },
  baseDisplaySize: { width: 180, height: 120 },
};

export const RIVER_MAP: MapDefinition = {
  id: "river",
  name: "Ayeyarwady (River Delta)",
  description: "Custom tactical layout with precision waypoints and strategic tower pads.",
  lanes: 2,
  thumbnail: "/assets/maps/map_9_river/preview.png",
  pathHalfWidth: 26,
  holderScale: 1,
  path: [],
  portals: [
    { x: 118, y: 64 },
    { x: 1185, y: 52 },
  ],
  paths: {
    p_1: [
      { x: 127, y: 68 },
      { x: 161, y: 90 },
      { x: 185, y: 100 },
      { x: 207, y: 114 },
      { x: 229, y: 130 },
      { x: 253, y: 147 },
      { x: 228, y: 166 },
      { x: 204, y: 180 },
      { x: 176, y: 192 },
      { x: 164, y: 212 },
      { x: 174, y: 223 },
      { x: 194, y: 237 },
      { x: 219, y: 243 },
      { x: 250, y: 247 },
      { x: 278, y: 244 },
      { x: 319, y: 227 },
      { x: 349, y: 197 },
      { x: 363, y: 178 },
      { x: 397, y: 160 },
      { x: 437, y: 151 },
      { x: 476, y: 159 },
      { x: 496, y: 179 },
      { x: 477, y: 209 },
      { x: 445, y: 221 },
      { x: 427, y: 233 },
      { x: 446, y: 249 },
      { x: 469, y: 266 },
      { x: 483, y: 274 },
      { x: 503, y: 286 },
      { x: 517, y: 297 },
      { x: 517, y: 316 },
      { x: 480, y: 333 },
      { x: 464, y: 360 },
      { x: 476, y: 379 },
      { x: 516, y: 383 },
      { x: 566, y: 389 },
      { x: 590, y: 407 },
      { x: 571, y: 430 },
      { x: 525, y: 451 },
      { x: 478, y: 474 },
      { x: 444, y: 492 },
      { x: 403, y: 484 },
      { x: 371, y: 467 },
      { x: 344, y: 441 },
      { x: 296, y: 441 },
      { x: 259, y: 460 },
      { x: 278, y: 492 },
      { x: 290, y: 509 },
      { x: 268, y: 531 },
      { x: 265, y: 559 },
      { x: 295, y: 577 },
      { x: 330, y: 583 },
      { x: 375, y: 563 },
      { x: 408, y: 547 },
      { x: 434, y: 554 },
      { x: 474, y: 568 },
      { x: 498, y: 579 },
      { x: 523, y: 593 },
      { x: 543, y: 602 },
      { x: 566, y: 613 },
    ],
    p_2: [
      { x: 1175, y: 58 },
      { x: 1131, y: 79 },
      { x: 1093, y: 101 },
      { x: 1057, y: 123 },
      { x: 1028, y: 144 },
      { x: 1068, y: 169 },
      { x: 1096, y: 193 },
      { x: 1081, y: 228 },
      { x: 1034, y: 240 },
      { x: 981, y: 231 },
      { x: 933, y: 208 },
      { x: 900, y: 186 },
      { x: 869, y: 159 },
      { x: 833, y: 138 },
      { x: 809, y: 128 },
      { x: 776, y: 124 },
      { x: 723, y: 141 },
      { x: 708, y: 168 },
      { x: 723, y: 190 },
      { x: 699, y: 213 },
      { x: 666, y: 230 },
      { x: 639, y: 251 },
      { x: 624, y: 280 },
      { x: 638, y: 303 },
      { x: 667, y: 314 },
      { x: 686, y: 310 },
      { x: 724, y: 322 },
      { x: 756, y: 337 },
      { x: 786, y: 354 },
      { x: 821, y: 376 },
      { x: 856, y: 404 },
      { x: 885, y: 411 },
      { x: 927, y: 417 },
      { x: 964, y: 404 },
      { x: 999, y: 394 },
      { x: 1030, y: 381 },
      { x: 1063, y: 379 },
      { x: 1083, y: 399 },
      { x: 1081, y: 426 },
      { x: 1050, y: 446 },
      { x: 1013, y: 463 },
      { x: 1013, y: 482 },
      { x: 1050, y: 507 },
      { x: 1076, y: 530 },
      { x: 1088, y: 553 },
      { x: 1067, y: 583 },
      { x: 1030, y: 600 },
      { x: 986, y: 609 },
      { x: 936, y: 583 },
      { x: 904, y: 568 },
      { x: 859, y: 553 },
      { x: 824, y: 556 },
      { x: 786, y: 577 },
      { x: 763, y: 593 },
      { x: 737, y: 606 },
      { x: 724, y: 616 },
    ],
  },
  pathLabels: {
    p_1: "P 1",
    p_2: "P 2",
  },
  slots: [
    { slotIndex: 0, x: 269, y: 191 },
    { slotIndex: 1, x: 431, y: 189 },
    { slotIndex: 2, x: 324, y: 474 },
    { slotIndex: 3, x: 367, y: 236 },
    { slotIndex: 4, x: 326, y: 540 },
    { slotIndex: 5, x: 530, y: 357 },
    { slotIndex: 6, x: 1036, y: 203 },
    { slotIndex: 7, x: 1034, y: 417 },
    { slotIndex: 8, x: 761, y: 166 },
    { slotIndex: 9, x: 684, y: 349 },
    { slotIndex: 10, x: 600, y: 337 },
    { slotIndex: 11, x: 746, y: 541 },
    { slotIndex: 12, x: 538, y: 552 },
    { slotIndex: 13, x: 1157, y: 594 },
    { slotIndex: 14, x: 1047, y: 667 },
    { slotIndex: 15, x: 910, y: 666 },
    { slotIndex: 16, x: 929, y: 157 },
  ],
  props: [

  ],
  checkpoints: [1, 3],
  base: { x: 636, y: 637 },
  baseDisplaySize: { width: 180, height: 120 },
};

export const MERGE_MAP: MapDefinition = {
  id: "merge",
  name: "Threefold Merge",
  width: 1280,
  height: 720,
  path: [],
  paths: {
    upper: [
      { x: 60, y: 120 },
      { x: 360, y: 120 },
      { x: 560, y: 200 },
      { x: 800, y: 300 },
      { x: 980, y: 300 },
      { x: 1160, y: 360 },
    ],
    middle: [
      { x: 60, y: 360 },
      { x: 360, y: 360 },
      { x: 600, y: 330 },
      { x: 800, y: 300 },
      { x: 980, y: 300 },
      { x: 1160, y: 360 },
    ],
    lower: [
      { x: 60, y: 600 },
      { x: 360, y: 600 },
      { x: 560, y: 540 },
      { x: 800, y: 600 },
      { x: 980, y: 600 },
      { x: 1160, y: 360 },
    ],
  },
  pathLabels: {
    upper: "Upper Gate",
    middle: "Middle Gate",
    lower: "Lower Gate",
  },
  slots: [
    { slotIndex: 0, x: 700, y: 200 },
    { slotIndex: 1, x: 700, y: 470 },
    { slotIndex: 2, x: 620, y: 350 },
    { slotIndex: 3, x: 940, y: 230 },
    { slotIndex: 4, x: 940, y: 520 },
  ],
  checkpoints: [1, 3],
  base: { x: 1160, y: 360 },
  pathHalfWidth: 22,
};

/**
 * Placeholder map exercising a fork: two registered tracks sharing one spawn
 * corridor before splitting.
 *
 * @remarks `left` and `right` share an identical leading section (through
 * `{600,360}`), so both spawn from the same portal and diverge. Purely a test
 * fixture until real art exists.
 */
export const FORK_MAP: MapDefinition = {
  id: "fork",
  name: "Twin Fork",
  width: 1280,
  height: 720,
  path: [],
  paths: {
    left: [
      { x: 60, y: 360 },
      { x: 360, y: 360 },
      { x: 600, y: 360 },
      { x: 800, y: 180 },
      { x: 1000, y: 180 },
      { x: 1160, y: 360 },
    ],
    right: [
      { x: 60, y: 360 },
      { x: 360, y: 360 },
      { x: 600, y: 360 },
      { x: 800, y: 540 },
      { x: 1000, y: 540 },
      { x: 1160, y: 360 },
    ],
  },
  pathLabels: {
    left: "Left Split",
    right: "Right Split",
  },
  slots: [
    { slotIndex: 0, x: 300, y: 240 },
    { slotIndex: 1, x: 300, y: 480 },
    { slotIndex: 2, x: 700, y: 260 },
    { slotIndex: 3, x: 700, y: 460 },
    { slotIndex: 4, x: 1000, y: 360 },
  ],
  checkpoints: [1, 3],
  base: { x: 1160, y: 360 },
  pathHalfWidth: 22,
};

/**
 * Canonical 6 historical royal battlefields playable in matches.
 */
export const CANONICAL_MAPS: readonly MapDefinition[] = [
  KONBAUNG_MAP,
  BAGAN_MAP,
  INLE_MAP,
  MANDALAY_MAP,
  INNWA_MAP,
  BAGO_MAP,
  DESERTED_MAP,
  TWISTER_MAP,
  RIVER_MAP,
];

export const CANONICAL_MAP_IDS: readonly string[] = CANONICAL_MAPS.map((m) => m.id);

export const MAPS: Record<string, MapDefinition> = {
  [SAMPLE_MAP.id]: SAMPLE_MAP,
  [KONBAUNG_MAP.id]: KONBAUNG_MAP,
  [BAGAN_MAP.id]: BAGAN_MAP,
  [INLE_MAP.id]: INLE_MAP,
  [MANDALAY_MAP.id]: MANDALAY_MAP,
  [INNWA_MAP.id]: INNWA_MAP,
  [BAGO_MAP.id]: BAGO_MAP,
  [DESERTED_MAP.id]: DESERTED_MAP,
  [TWISTER_MAP.id]: TWISTER_MAP,
  [RIVER_MAP.id]: RIVER_MAP,
  // Dev & test fixtures for backend multi-path integration tests
  [MERGE_MAP.id]: MERGE_MAP,
  [FORK_MAP.id]: FORK_MAP,
};

/**
 * Map ids eligible for random selection each match. Exactly the 6 canonical battlefields.
 */
export const MAP_POOL: readonly string[] = [...CANONICAL_MAP_IDS];

/**
 * Picks a map for a fresh match.
 *
 * @param exclude - A map id to avoid when the pool has another option, e.g. the
 * one already on the room, so a rematch does not repeat the last map.
 * @returns A map id from {@link MAP_POOL}, or `""` when the pool is empty.
 *
 * @remarks When the pool holds a single id (or `exclude` leaves no candidate)
 * that id is returned; callers can treat `""` as "leave the current map alone".
 */
export function pickRandomMapId(exclude?: string): string {
  if (MAP_POOL.length === 0) return "";
  const candidates = MAP_POOL.filter((id) => id !== exclude);
  const pool = candidates.length > 0 ? candidates : MAP_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Human-readable label for a map selection, including the random sentinel.
 *
 * @param mapId - A map id, {@link RANDOM_MAP_ID}, or `undefined`/`""` for an
 * unset legacy room.
 * @returns The map's `name`, `"Random"` for the sentinel/empty case, or the raw
 * id when it is unknown to {@link MAPS}.
 *
 * @remarks Keeps the lobby list and the map selector from having to special-case
 * the random option or old rooms created before the field existed.
 */
export function mapDisplayName(mapId: string | undefined | null): string {
  if (!mapId || mapId === RANDOM_MAP_ID) return "Random";
  return MAPS[mapId]?.name ?? mapId;
}

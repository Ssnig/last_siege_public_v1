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
  /** Explicit portal spawn locations. If omitted, falls back to path starts. */
  portals?: Vec2[];
  width?: number;
  height?: number;
  pathHalfWidth?: number;
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
  name: "Konbaung Royal Palace",
  description: "Two sweeping royal road corridors encircling ancient pagodas into the central stone courtyard.",
  lanes: 2,
  thumbnail: "/assets/maps/map_1_konbaung/preview.png",
  width: 1280,
  height: 720,
  path: [],
  paths: {
    top: [
      { x: 52, y: 112 },
      { x: 256, y: 112 },
      { x: 317, y: 158 },
      { x: 342, y: 274 },
      { x: 602, y: 274 },
      { x: 688, y: 194 },
      { x: 749, y: 158 },
      { x: 816, y: 184 },
      { x: 842, y: 266 },
      { x: 858, y: 349 },
      { x: 1005, y: 375 },
    ],
    bottom: [
      { x: 52, y: 583 },
      { x: 243, y: 583 },
      { x: 288, y: 518 },
      { x: 317, y: 443 },
      { x: 474, y: 443 },
      { x: 525, y: 526 },
      { x: 614, y: 590 },
      { x: 730, y: 623 },
      { x: 1062, y: 623 },
      { x: 1114, y: 562 },
      { x: 1095, y: 485 },
    ],
  },
  slots: [
    { slotIndex: 0, x: 246, y: 184 },
    { slotIndex: 1, x: 394, y: 218 },
    { slotIndex: 2, x: 756, y: 218 },
    { slotIndex: 3, x: 394, y: 500 },
    { slotIndex: 4, x: 1034, y: 539 },
  ],
  checkpoints: [1, 3],
  base: { x: 1120, y: 340 },
  baseImage: "/assets/maps/map_1_konbaung/base.png",
  pathHalfWidth: 20,
};

export const BAGAN_MAP: MapDefinition = {
  id: "bagan",
  name: "Bagan Temple Plains",
  description: "Ancient red brick pagodas dotting golden plains with choke points through stupa courtyards.",
  lanes: 3,
  thumbnail: "/assets/maps/map_2_bagan/preview.png",
  width: 1280,
  height: 720,
  path: [],
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
    top_north: "North Stupa Loop (Upper)",
    top_south: "North Stupa Loop (Lower)",
    bottom: "Banyan Plains & South Road",
    bridge: "Stone River Bridge",
  },
  randomFork: true,
  portals: [
    { x: 20, y: 437 },
    { x: 33, y: 148 },
    { x: 1155, y: 23 },
  ],
  slots: [
    { slotIndex: 0, x: 115, y: 635 },
    { slotIndex: 1, x: 85, y: 360 },
    { slotIndex: 2, x: 384, y: 163 },
    { slotIndex: 3, x: 438, y: 497 },
    { slotIndex: 4, x: 631, y: 68 },
    { slotIndex: 5, x: 683, y: 559 },
    { slotIndex: 6, x: 805, y: 170 },
    { slotIndex: 7, x: 1012, y: 292 },
    { slotIndex: 8, x: 870, y: 641 },
    { slotIndex: 9, x: 1210, y: 556 },
    { slotIndex: 10, x: 1223, y: 47 },
  ],
  checkpoints: [1, 3],
  base: { x: 810, y: 360 },
  baseImage: "/assets/maps/map_2_bagan/base.png",
  baseDisplaySize: { width: 235, height: 235 },
  baseHpOffsetY: -100,
  pathHalfWidth: 20,
};

export const INLE_MAP: MapDefinition = {
  id: "inle",
  name: "Inle Lake Waterways",
  description: "Serpentine elevated viaduct over floating gardens and lotus pools into the sanctuary base.",
  lanes: 2,
  thumbnail: "/assets/maps/map_3_inle/preview.png",
  width: 1280,
  height: 720,
  path: [],
  paths: {
    top: [
      { x: 57, y: 357 },
      { x: 115, y: 335 },
      { x: 154, y: 326 },
      { x: 178, y: 261 },
      { x: 181, y: 196 },
      { x: 199, y: 131 },
      { x: 264, y: 102 },
      { x: 329, y: 105 },
      { x: 376, y: 162 },
      { x: 366, y: 228 },
      { x: 348, y: 292 },
      { x: 292, y: 346 },
      { x: 320, y: 411 },
      { x: 386, y: 431 },
      { x: 451, y: 422 },
      { x: 515, y: 378 },
      { x: 571, y: 318 },
      { x: 615, y: 252 },
      { x: 666, y: 188 },
      { x: 731, y: 149 },
      { x: 796, y: 114 },
      { x: 861, y: 94 },
      { x: 926, y: 116 },
      { x: 960, y: 190 },
    ],
    bottom: [
      { x: 57, y: 357 },
      { x: 115, y: 335 },
      { x: 154, y: 326 },
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
    ],
  },
  pathLabels: {
    top: "Top Viaduct Loop",
    bottom: "Lower Viaduct Arches",
  },
  randomFork: true,
  slots: [
    { slotIndex: 0, x: 283, y: 196 },
    { slotIndex: 1, x: 285, y: 532 },
    { slotIndex: 2, x: 400, y: 359 },
    { slotIndex: 3, x: 502, y: 203 },
    { slotIndex: 4, x: 619, y: 624 },
    { slotIndex: 5, x: 627, y: 406 },
    { slotIndex: 6, x: 687, y: 61 },
    { slotIndex: 7, x: 1071, y: 125 },
    { slotIndex: 8, x: 1127, y: 602 },
  ],
  checkpoints: [3, 12],
  base: { x: 970, y: 360 },
  baseImage: "/assets/maps/map_3_inle/base.png",
  baseHpOffsetY: -110,
  pathHalfWidth: 20,
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
    { x: 1084, y: 180 },
    { x: 927, y: 708 },
  ],
  paths: {
    north_bridge: [
      { x: 468, y: 59 },
      { x: 470, y: 164 },
      { x: 707, y: 173 },
      { x: 708, y: 268 },
      { x: 594, y: 270 },
      { x: 593, y: 364 },
      { x: 456, y: 358 },
      { x: 344, y: 360 },
    ],
    east_bridge: [
      { x: 1260, y: 180 },
      { x: 980, y: 180 },
      { x: 973, y: 360 },
      { x: 799, y: 356 },
      { x: 798, y: 457 },
      { x: 592, y: 454 },
      { x: 593, y: 368 },
      { x: 345, y: 359 },
    ],
    bottom: [
      { x: 929, y: 677 },
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
  name: "Innwa Ancient Kingdom",
  description: "Ancient brick monastery ruins and river crossings through the historic imperial city.",
  lanes: 2,
  thumbnail: "/assets/maps/map_5_innwa/preview.png",
  width: 1280,
  height: 720,
  path: [],
  paths: {
    top: [
      { x: 50, y: 180 },
      { x: 160, y: 140 },
      { x: 320, y: 140 },
      { x: 450, y: 230 },
      { x: 600, y: 140 },
      { x: 710, y: 140 },
      { x: 810, y: 260 },
      { x: 810, y: 370 },
    ],
    bottom: [
      { x: 50, y: 580 },
      { x: 180, y: 580 },
      { x: 270, y: 470 },
      { x: 430, y: 470 },
      { x: 540, y: 580 },
      { x: 700, y: 580 },
      { x: 810, y: 470 },
      { x: 810, y: 370 },
    ],
  },
  slots: [
    { slotIndex: 0, x: 75, y: 360 },
    { slotIndex: 1, x: 360, y: 180 },
    { slotIndex: 2, x: 380, y: 510 },
    { slotIndex: 3, x: 610, y: 80 },
    { slotIndex: 4, x: 640, y: 560 },
    { slotIndex: 5, x: 780, y: 150 },
    { slotIndex: 6, x: 880, y: 620 },
    { slotIndex: 7, x: 1220, y: 560 },
  ],
  checkpoints: [1, 3],
  base: { x: 810, y: 370 },
  baseImage: "/assets/maps/map_5_innwa/base.png",
  pathHalfWidth: 20,
};

export const RAKHINE_MAP: MapDefinition = INNWA_MAP;

export const BAGO_MAP: MapDefinition = {
  id: "bago",
  name: "Hanthawaddy Golden Gate",
  description: "A wide river crossing into the monumental golden gateway of the southern kingdom.",
  lanes: 2,
  thumbnail: "/assets/maps/map_6_bago/preview.png",
  width: 1280,
  height: 720,
  path: [],
  paths: {
    top: [
      { x: 50, y: 200 },
      { x: 140, y: 150 },
      { x: 300, y: 150 },
      { x: 450, y: 240 },
      { x: 620, y: 170 },
      { x: 720, y: 240 },
      { x: 820, y: 370 },
    ],
    bottom: [
      { x: 50, y: 580 },
      { x: 180, y: 580 },
      { x: 260, y: 620 },
      { x: 380, y: 620 },
      { x: 500, y: 500 },
      { x: 640, y: 470 },
      { x: 730, y: 430 },
      { x: 820, y: 370 },
    ],
  },
  slots: [
    { slotIndex: 0, x: 75, y: 370 },
    { slotIndex: 1, x: 280, y: 190 },
    { slotIndex: 2, x: 370, y: 500 },
    { slotIndex: 3, x: 580, y: 110 },
    { slotIndex: 4, x: 650, y: 550 },
    { slotIndex: 5, x: 880, y: 630 },
    { slotIndex: 6, x: 1220, y: 70 },
    { slotIndex: 7, x: 1220, y: 540 },
  ],
  checkpoints: [1, 3],
  base: { x: 820, y: 370 },
  baseImage: "/assets/maps/map_6_bago/base.png",
  pathHalfWidth: 20,
};

/**
 * Placeholder map exercising a merge: three spawns, two of which fuse into a
 * shared corridor so only two routes reach the base.
 *
 * @remarks `upper` and `middle` share an identical trailing section
 * (`{800,300}` onward); `lower` keeps its own approach. Purely a test fixture
 * until real art exists.
 */
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

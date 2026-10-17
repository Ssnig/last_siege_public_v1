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
  /** Human-readable name shown on the pre-draft reveal screen. */
  name?: string;
  path: Vec2[];
  paths?: Record<string, Vec2[]>;
  pathLabels?: Record<string, string>;
  slots: TowerSlot[];
  checkpoints: number[];
  base: Vec2;
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
  name: "Konbaung",
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
      { x: 1005, y: 375 }
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
      { x: 1095, y: 485 }
    ]
  },
  slots: [
    { slotIndex: 0, x: 246, y: 184 },
    { slotIndex: 1, x: 394, y: 218 },
    { slotIndex: 2, x: 756, y: 218 },
    { slotIndex: 3, x: 394, y: 500 },
    { slotIndex: 4, x: 1034, y: 539 }
  ],
  checkpoints: [1, 3],
  base: { x: 1108, y: 360 }
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

export const MAPS: Record<string, MapDefinition> = {
  [SAMPLE_MAP.id]: SAMPLE_MAP,
  [KONBAUNG_MAP.id]: KONBAUNG_MAP,
  [MERGE_MAP.id]: MERGE_MAP,
  [FORK_MAP.id]: FORK_MAP,
};

/**
 * Map ids eligible for random selection each match.
 *
 * @remarks `sample` is a dev fixture and deliberately excluded. Order is
 * irrelevant: {@link pickRandomMapId} samples uniformly.
 */
export const MAP_POOL: readonly string[] = [
  KONBAUNG_MAP.id,
  MERGE_MAP.id,
  FORK_MAP.id,
];

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

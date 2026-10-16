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
 * `path` is the ordered list of waypoints mobs walk; `checkpoints` are indices
 * into it that mark progression milestones. `slots` are the only legal tower
 * positions. `base` is the defender's core location.
 * `paths` (optional) supports multiple named paths for advanced maps.
 * `width`/`height` (optional) define the virtual coordinate system size.
 * `pathHalfWidth` is how far (px) a mob may drift either side of the centreline
 * to give the wavy, crowd-like movement; see `lateralOffset`.
 */
export interface MapDefinition {
  id: string;
  path: Vec2[];
  paths?: {
    top?: Vec2[];
    bottom?: Vec2[];
  };
  slots: TowerSlot[];
  checkpoints: number[];
  base: Vec2;
  width?: number;
  height?: number;
  pathHalfWidth?: number;
}

export const SAMPLE_MAP: MapDefinition = {
  id: "sample",
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
  base: { x: 1108, y: 360 },
  pathHalfWidth: 20,
};

export const MAPS: Record<string, MapDefinition> = {
  [SAMPLE_MAP.id]: SAMPLE_MAP,
  [KONBAUNG_MAP.id]: KONBAUNG_MAP,
};

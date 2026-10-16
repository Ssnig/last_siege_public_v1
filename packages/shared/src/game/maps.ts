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
 */
export interface MapDefinition {
  id: string;
  name?: string;
  description?: string;
  lanes?: number;
  thumbnail?: string;
  path: Vec2[];
  paths?: Record<string, Vec2[] | undefined> & {
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
  pathHalfWidth: 20,
};

export const BAGAN_MAP: MapDefinition = {
  id: "bagan",
  name: "Bagan Temple Plains",
  description: "Ancient red brick pagodas dotting golden plains with choke points through stupa courtyards.",
  lanes: 2,
  thumbnail: "/assets/maps/map_2_bagan/preview.png",
  width: 1280,
  height: 720,
  path: [],
  paths: {
    top: [
      { x: 50, y: 150 },
      { x: 350, y: 150 },
      { x: 450, y: 240 },
      { x: 700, y: 240 },
      { x: 850, y: 340 },
      { x: 1050, y: 350 },
    ],
    bottom: [
      { x: 50, y: 550 },
      { x: 350, y: 550 },
      { x: 450, y: 460 },
      { x: 700, y: 460 },
      { x: 850, y: 380 },
      { x: 1050, y: 370 },
    ],
  },
  slots: [
    { slotIndex: 0, x: 250, y: 220 },
    { slotIndex: 1, x: 550, y: 160 },
    { slotIndex: 2, x: 550, y: 540 },
    { slotIndex: 3, x: 780, y: 350 },
    { slotIndex: 4, x: 950, y: 260 },
  ],
  checkpoints: [1, 3],
  base: { x: 1120, y: 360 },
  pathHalfWidth: 20,
};

export const INLE_MAP: MapDefinition = {
  id: "inle",
  name: "Inle Lake Waterways",
  description: "Trident canal waterways between floating tomato gardens and stilt wooden houses.",
  lanes: 2,
  thumbnail: "/assets/maps/map_3_inle/preview.png",
  width: 1280,
  height: 720,
  path: [],
  paths: {
    top: [
      { x: 50, y: 130 },
      { x: 320, y: 130 },
      { x: 500, y: 220 },
      { x: 800, y: 220 },
      { x: 1050, y: 340 },
    ],
    bottom: [
      { x: 50, y: 590 },
      { x: 320, y: 590 },
      { x: 500, y: 480 },
      { x: 800, y: 480 },
      { x: 1050, y: 380 },
    ],
  },
  slots: [
    { slotIndex: 0, x: 280, y: 200 },
    { slotIndex: 1, x: 420, y: 350 },
    { slotIndex: 2, x: 650, y: 150 },
    { slotIndex: 3, x: 650, y: 550 },
    { slotIndex: 4, x: 920, y: 350 },
  ],
  checkpoints: [1, 3],
  base: { x: 1120, y: 360 },
  pathHalfWidth: 20,
};

export const MANDALAY_MAP: MapDefinition = {
  id: "mandalay",
  name: "Mandalay Fortress Moat",
  description: "Grand square water moat flanked by fortified red brick ramparts and gate bridges.",
  lanes: 2,
  thumbnail: "/assets/maps/map_4_mandalay/preview.png",
  width: 1280,
  height: 720,
  path: [],
  paths: {
    top: [
      { x: 60, y: 120 },
      { x: 400, y: 120 },
      { x: 520, y: 260 },
      { x: 780, y: 260 },
      { x: 1050, y: 350 },
    ],
    bottom: [
      { x: 60, y: 600 },
      { x: 400, y: 600 },
      { x: 520, y: 460 },
      { x: 780, y: 460 },
      { x: 1050, y: 370 },
    ],
  },
  slots: [
    { slotIndex: 0, x: 260, y: 200 },
    { slotIndex: 1, x: 450, y: 360 },
    { slotIndex: 2, x: 660, y: 180 },
    { slotIndex: 3, x: 660, y: 540 },
    { slotIndex: 4, x: 920, y: 260 },
  ],
  checkpoints: [1, 3],
  base: { x: 1120, y: 360 },
  pathHalfWidth: 20,
};

export const RAKHINE_MAP: MapDefinition = {
  id: "rakhine",
  name: "Mrauk-U Stone Bastion",
  description: "Misty hill paths carving through thick monolithic stone walls and jungle temples.",
  lanes: 2,
  thumbnail: "/assets/maps/map_5_rakhine/preview.png",
  width: 1280,
  height: 720,
  path: [],
  paths: {
    top: [
      { x: 50, y: 140 },
      { x: 280, y: 140 },
      { x: 420, y: 250 },
      { x: 720, y: 210 },
      { x: 1050, y: 350 },
    ],
    bottom: [
      { x: 50, y: 580 },
      { x: 280, y: 580 },
      { x: 420, y: 470 },
      { x: 720, y: 510 },
      { x: 1050, y: 370 },
    ],
  },
  slots: [
    { slotIndex: 0, x: 220, y: 220 },
    { slotIndex: 1, x: 380, y: 360 },
    { slotIndex: 2, x: 580, y: 150 },
    { slotIndex: 3, x: 580, y: 570 },
    { slotIndex: 4, x: 880, y: 360 },
  ],
  checkpoints: [1, 3],
  base: { x: 1120, y: 360 },
  pathHalfWidth: 20,
};

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
      { x: 50, y: 130 },
      { x: 300, y: 130 },
      { x: 460, y: 250 },
      { x: 750, y: 250 },
      { x: 1050, y: 350 },
    ],
    bottom: [
      { x: 50, y: 590 },
      { x: 300, y: 590 },
      { x: 460, y: 470 },
      { x: 750, y: 470 },
      { x: 1050, y: 370 },
    ],
  },
  slots: [
    { slotIndex: 0, x: 240, y: 210 },
    { slotIndex: 1, x: 400, y: 360 },
    { slotIndex: 2, x: 620, y: 160 },
    { slotIndex: 3, x: 620, y: 560 },
    { slotIndex: 4, x: 900, y: 280 },
  ],
  checkpoints: [1, 3],
  base: { x: 1120, y: 360 },
  pathHalfWidth: 20,
};

export const MAPS: Record<string, MapDefinition> = {
  [SAMPLE_MAP.id]: SAMPLE_MAP,
  [KONBAUNG_MAP.id]: KONBAUNG_MAP,
  [BAGAN_MAP.id]: BAGAN_MAP,
  [INLE_MAP.id]: INLE_MAP,
  [MANDALAY_MAP.id]: MANDALAY_MAP,
  [RAKHINE_MAP.id]: RAKHINE_MAP,
  [BAGO_MAP.id]: BAGO_MAP,
};


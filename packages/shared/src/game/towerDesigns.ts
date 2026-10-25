export interface TowerDesignConfig {
  id: string;
  folder: string;
  name: string;
  shortName: string;
  aliases: string[];
  textureKey: string;
  texturePath: string;
  projectileKey: string;
  projectilePath: string;
  iconPath: string;
  displaySize: { width: number; height: number };
  origin: { x: number; y: number };
  tactical: {
    title: string;
    weakness: string;
    stacks: string;
  };
}

export const TOWER_DESIGNS: Record<string, TowerDesignConfig> = {
  archer: {
    id: "archer",
    folder: "01_archer_tower",
    name: "Archer Tower",
    shortName: "Arc",
    aliases: ["basic", "arrow"],
    textureKey: "tower_archer",
    texturePath: "/assets/towers/01_archer_tower/tower.png",
    projectileKey: "proj_archer",
    projectilePath: "/assets/towers/01_archer_tower/projectile.png",
    iconPath: "/assets/towers/01_archer_tower/icon.png",
    displaySize: { width: 92, height: 92 },
    origin: { x: 0.5, y: 0.82 },
    tactical: {
      title: "ARCHER TOWER",
      weakness: "Armored Swarms",
      stacks: "Max 8",
    },
  },
  cannon: {
    id: "cannon",
    folder: "02_cannon",
    name: "Cannon",
    shortName: "Can",
    aliases: [],
    textureKey: "tower_cannon",
    texturePath: "/assets/towers/02_cannon/tower.png",
    projectileKey: "proj_cannon",
    projectilePath: "/assets/towers/02_cannon/projectile.png",
    iconPath: "/assets/towers/02_cannon/icon.png",
    displaySize: { width: 92, height: 92 },
    origin: { x: 0.5, y: 0.78 },
    tactical: {
      title: "ROYAL CANNON",
      weakness: "Quick Units",
      stacks: "Max 5",
    },
  },
  bomb: {
    id: "bomb",
    folder: "03_bomb_throwing_tower",
    name: "Bomb Throwing Tower",
    shortName: "Bmb",
    aliases: ["bomb_throwing"],
    textureKey: "tower_bomb",
    texturePath: "/assets/towers/03_bomb_throwing_tower/tower.png",
    projectileKey: "proj_bomb",
    projectilePath: "/assets/towers/03_bomb_throwing_tower/projectile.png",
    iconPath: "/assets/towers/03_bomb_throwing_tower/icon.png",
    displaySize: { width: 92, height: 92 },
    origin: { x: 0.5, y: 0.78 },
    tactical: {
      title: "BOMB THROWING TOWER",
      weakness: "Fast Runners",
      stacks: "Max 4",
    },
  },
  bell: {
    id: "bell",
    folder: "04_bell_tower",
    name: "Bell Tower",
    shortName: "Bel",
    aliases: [],
    textureKey: "tower_bell",
    texturePath: "/assets/towers/04_bell_tower/bell_tower.png",
    projectileKey: "proj_bell",
    projectilePath: "/assets/towers/04_bell_tower/attack_vfx.png",
    iconPath: "/assets/towers/04_bell_tower/icon.jpg",
    displaySize: { width: 92, height: 92 },
    origin: { x: 0.5, y: 0.82 },
    tactical: {
      title: "SACRED BELL TOWER",
      weakness: "Stealth Spirits",
      stacks: "Max 6",
    },
  },
  spear: {
    id: "spear",
    folder: "05_spear_tower",
    name: "Spear Tower",
    shortName: "Spr",
    aliases: ["pitchfork"],
    textureKey: "tower_spear",
    texturePath: "/assets/towers/05_spear_tower/tower.png",
    projectileKey: "proj_spear",
    projectilePath: "/assets/towers/05_spear_tower/projectile.png",
    iconPath: "/assets/towers/05_spear_tower/icon.png",
    displaySize: { width: 92, height: 92 },
    origin: { x: 0.5, y: 0.78 },
    tactical: {
      title: "SPEAR TOWER",
      weakness: "Heavy Cavalry",
      stacks: "Max 8",
    },
  },
  gun: {
    id: "gun",
    folder: "06_gun_tower",
    name: "Gun Tower",
    shortName: "Gun",
    aliases: ["sniper"],
    textureKey: "tower_gun",
    texturePath: "/assets/towers/06_gun_tower/tower.png",
    projectileKey: "proj_gun",
    projectilePath: "/assets/towers/06_gun_tower/projectile.png",
    iconPath: "/assets/towers/06_gun_tower/icon.png",
    displaySize: { width: 92, height: 92 },
    origin: { x: 0.5, y: 0.82 },
    tactical: {
      title: "ROYAL GUN TOWER",
      weakness: "Dense Swarms",
      stacks: "Max 4",
    },
  },
  water_cannon: {
    id: "water_cannon",
    folder: "07_water_cannon",
    name: "Water Cannon",
    shortName: "Wat",
    aliases: [],
    textureKey: "tower_water_cannon",
    texturePath: "/assets/towers/07_water_cannon/tower.png",
    projectileKey: "proj_water_cannon",
    projectilePath: "/assets/towers/07_water_cannon/projectile.png",
    iconPath: "/assets/towers/07_water_cannon/icon.jpg",
    displaySize: { width: 110, height: 110 },
    origin: { x: 0.5, y: 0.82 },
    tactical: {
      title: "WATER CANNON",
      weakness: "Fast Units",
      stacks: "Max 6",
    },
  },
  chinthe: {
    id: "chinthe",
    folder: "08_chinthe_statue",
    name: "Chinthe Guardian",
    shortName: "Chn",
    aliases: [],
    textureKey: "tower_chinthe",
    texturePath: "/assets/towers/08_chinthe_statue/tower.png",
    projectileKey: "proj_chinthe",
    projectilePath: "/assets/towers/08_chinthe_statue/projectile.png",
    iconPath: "/assets/towers/08_chinthe_statue/icon.jpg",
    displaySize: { width: 92, height: 92 },
    origin: { x: 0.5, y: 0.82 },
    tactical: {
      title: "CHINTHE GUARDIAN",
      weakness: "Armored Swarms",
      stacks: "Max 4",
    },
  },
  dragon: {
    id: "dragon",
    folder: "09_dragon_tower",
    name: "Dragon Tower",
    shortName: "Drg",
    aliases: [],
    textureKey: "tower_dragon",
    texturePath: "/assets/towers/09_dragon_tower/tower.png",
    projectileKey: "proj_dragon",
    projectilePath: "/assets/towers/09_dragon_tower/projectile.png",
    iconPath: "/assets/towers/09_dragon_tower/icon.jpg",
    displaySize: { width: 92, height: 92 },
    origin: { x: 0.5, y: 0.82 },
    tactical: {
      title: "DRAGON TOWER",
      weakness: "Resistant Hordes",
      stacks: "Max 4",
    },
  },
  sein_pyaung: {
    id: "sein_pyaung",
    folder: "10_sein_pyaung",
    name: "Sein Pyaung",
    shortName: "SPy",
    aliases: [],
    textureKey: "tower_sein_pyaung",
    texturePath: "/assets/towers/10_sein_pyaung/sein_pyaung.png",
    projectileKey: "proj_sein_pyaung",
    projectilePath: "/assets/towers/10_sein_pyaung/vfx.png",
    iconPath: "/assets/towers/10_sein_pyaung/icon.jpg",
    displaySize: { width: 92, height: 92 },
    origin: { x: 0.5, y: 0.82 },
    tactical: {
      title: "SEIN PYAUNG",
      weakness: "Heavy Armor & Swarms",
      stacks: "Max 4",
    },
  },
};

/** Default active towers in order for Defender tray and decks */
export const ACTIVE_TOWER_IDS: string[] = [
  "archer",
  "cannon",
  "bomb",
  "bell",
  "spear",
  "gun",
  "water_cannon",
  "chinthe",
  "dragon",
  "sein_pyaung",
];

/**
 * Resolves a tower design configuration by ID or legacy alias (e.g. 'basic' -> 'archer').
 */
export function getTowerDesign(typeId: string | undefined): TowerDesignConfig {
  if (!typeId) return TOWER_DESIGNS.archer;

  const direct = TOWER_DESIGNS[typeId];
  if (direct) return direct;

  const normalized = typeId.toLowerCase();
  for (const design of Object.values(TOWER_DESIGNS)) {
    if (design.id === normalized || design.aliases.includes(normalized)) {
      return design;
    }
  }

  return TOWER_DESIGNS.archer;
}

/**
 * Vertical offset from the ground slot anchor (`slot.y`) to the visual barrel/head
 * pivot of directional towers (`origin.y = 0.82`).
 */
export const TOWER_AIM_PIVOT_Y_OFFSET = -38;

/**
 * Returns the pixel offset `{ x, y }` from a tower's ground slot `(slotX, slotY)`
 * to its muzzle or mouth for a shot aimed at `(targetX, targetY)`.
 */
export function getTowerMuzzleOffset(
  typeId: string | undefined,
  slotX: number,
  slotY: number,
  targetX: number,
  targetY: number,
): { x: number; y: number } {
  const design = getTowerDesign(typeId);
  const dx = targetX - slotX;
  const dy = targetY - (slotY + TOWER_AIM_PIVOT_Y_OFFSET);
  const onRight = dx >= 0;
  const above = dy < 0;
  const signX = onRight ? 1 : -1;

  switch (design.id) {
    case "water_cannon":
      return above
        ? { x: signX * 38, y: -67 }
        : { x: signX * 44, y: -45 };
    case "chinthe":
      return above
        ? { x: signX * 18, y: -55 }
        : { x: signX * 18, y: -53 };
    case "dragon":
      return above
        ? { x: signX * 22, y: -53 }
        : { x: signX * 22, y: -48 };
    case "sein_pyaung":
      return above
        ? { x: signX * 34, y: -56 }
        : { x: signX * 37, y: -32 };
    case "cannon":
    case "bomb":
      return { x: signX * 18, y: -32 };
    default:
      return { x: 0, y: -36 };
  }
}

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
    texturePath: "/assets/towers/04_bell_tower/tower.png",
    projectileKey: "proj_bell",
    projectilePath: "/assets/towers/04_bell_tower/projectile.png",
    iconPath: "/assets/towers/04_bell_tower/icon.png",
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
};

/** Default active towers in order for Defender tray and decks */
export const ACTIVE_TOWER_IDS: string[] = [
  "archer",
  "cannon",
  "bomb",
  "bell",
  "spear",
  "gun",
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


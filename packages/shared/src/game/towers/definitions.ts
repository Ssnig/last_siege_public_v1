import type { TowerType, TowerDesignConfig } from "./types.js";
import towersJson from "../../data/towers.json" with { type: "json" };

/**
 * Authoritative Defender Tower Archetypes.
 *
 * Specific firing speeds per user balance specifications:
 * - Archer Tower: 1 per 0.5s (fireRate = 2.0)
 * - Gun Tower: 1 per 1.0s (fireRate = 1.0)
 * - Bomb Tower: 1 per 2.0s (fireRate = 0.5)
 * - Spear Tower: 1 per 1.0s (fireRate = 1.0)
 * - Cannon Tower: 1 per 3.0s (fireRate = 0.333333), applies 25% slow for 1.5s
 * - Bell Tower: 1 per 0.83s (fireRate = 1.2, mental damage)
 */
export const CORE_TOWER_TYPES: Record<string, TowerType> = {
  archer: {
    id: "archer",
    name: "Archer Tower",
    damageType: "physical",
    tiers: [
      {
        cost: 55,
        damage: 10,
        damageMax: 14,
        range: 140,
        fireRate: 2.0, // 1 shot per 0.5s
        projectileSpeed: 400,
      },
      {
        cost: 105,
        damage: 18,
        damageMax: 26,
        range: 160,
        fireRate: 2.15,
        projectileSpeed: 430,
      },
      {
        cost: 185,
        damage: 32,
        damageMax: 48,
        range: 185,
        fireRate: 2.3,
        projectileSpeed: 460,
      },
    ],
  },

  gun: {
    id: "gun",
    name: "Gun Tower",
    damageType: "physical",
    tiers: [
      {
        cost: 130,
        damage: 30,
        damageMax: 46,
        range: 210,
        fireRate: 1.0, // 1 shot per 1.0s
        projectileSpeed: 520,
      },
      {
        cost: 225,
        damage: 58,
        damageMax: 86,
        range: 240,
        fireRate: 1.1,
        projectileSpeed: 550,
      },
      {
        cost: 385,
        damage: 124,
        damageMax: 186,
        range: 275,
        fireRate: 1.2,
        projectileSpeed: 580,
      },
    ],
  },

  bomb: {
    id: "bomb",
    name: "Bomb Throwing Tower",
    damageType: "physical",
    splashRadius: 75,
    tiers: [
      {
        cost: 110,
        damage: 24,
        damageMax: 36,
        range: 130,
        fireRate: 0.5, // 1 shot per 2.0s
        projectileSpeed: 280,
      },
      {
        cost: 190,
        damage: 48,
        damageMax: 72,
        range: 145,
        fireRate: 0.55,
        projectileSpeed: 300,
      },
      {
        cost: 320,
        damage: 96,
        damageMax: 144,
        range: 165,
        fireRate: 0.6,
        projectileSpeed: 320,
      },
    ],
  },

  spear: {
    id: "spear",
    name: "Spear Tower",
    damageType: "physical",
    tiers: [
      {
        cost: 45,
        damage: 8,
        damageMax: 12,
        range: 125,
        fireRate: 1.0, // 1 shot per 1.0s
        projectileSpeed: 350,
      },
      {
        cost: 85,
        damage: 16,
        damageMax: 24,
        range: 140,
        fireRate: 1.1,
        projectileSpeed: 375,
      },
      {
        cost: 150,
        damage: 30,
        damageMax: 46,
        range: 160,
        fireRate: 1.2,
        projectileSpeed: 400,
      },
    ],
  },

  cannon: {
    id: "cannon",
    name: "Cannon",
    damageType: "physical",
    splashRadius: 60,
    onHitEffect: {
      type: "slow",
      magnitude: 0.25, // reduces unit speed by 0.25x (unit keeps 75% speed)
      durationSec: 1.5, // lasts 1.5 seconds
    },
    tiers: [
      {
        cost: 140,
        damage: 32,
        damageMax: 48,
        range: 110,
        fireRate: 0.333333, // 1 shot per 3.0s
        projectileSpeed: 300,
      },
      {
        cost: 230,
        damage: 60,
        damageMax: 90,
        range: 120,
        fireRate: 0.36,
        projectileSpeed: 320,
      },
      {
        cost: 390,
        damage: 120,
        damageMax: 180,
        range: 135,
        fireRate: 0.4,
        projectileSpeed: 340,
      },
    ],
  },

  bell: {
    id: "bell",
    name: "Bell Tower",
    damageType: "mental",
    attackMode: "aoe_pulse",
    tiers: [
      {
        cost: 95,
        damage: 12,
        damageMax: 18,
        range: 135,
        fireRate: 0.45,
        projectileSpeed: 320,
      },
      {
        cost: 165,
        damage: 24,
        damageMax: 36,
        range: 150,
        fireRate: 0.5,
        projectileSpeed: 350,
      },
      {
        cost: 280,
        damage: 48,
        damageMax: 72,
        range: 170,
        fireRate: 0.55,
        projectileSpeed: 380,
      },
    ],
  },
};

/** Legacy tower aliases for backward compatibility with earlier tests and maps. */
export const LEGACY_TOWER_ALIASES: Record<string, TowerType> = {
  basic: {
    ...CORE_TOWER_TYPES.archer,
    id: "basic",
    name: "Arrow Tower (Basic)",
  },
  bertha: {
    ...CORE_TOWER_TYPES.cannon,
    id: "bertha",
    name: "Royal Cannon (Bertha)",
  },
  pitchfork: {
    id: "pitchfork",
    name: "Pitchfork Turret",
    damageType: "physical",
    tiers: [
      { cost: 35, damage: 5, damageMax: 7, range: 110, fireRate: 0.9, projectileSpeed: 300 },
      { cost: 65, damage: 10, damageMax: 14, range: 125, fireRate: 0.99, projectileSpeed: 325 },
      { cost: 110, damage: 19, damageMax: 29, range: 140, fireRate: 1.08, projectileSpeed: 350 },
    ],
  },
  sniper: {
    ...CORE_TOWER_TYPES.gun,
    id: "sniper",
    name: "Gun Tower (Sniper)",
  },
  arcanist: {
    ...CORE_TOWER_TYPES.bell,
    id: "arcanist",
    name: "Arcanist Tower",
    damageType: "mental",
  },
  archmage: {
    ...CORE_TOWER_TYPES.bell,
    id: "archmage",
    name: "Archmage Tower",
    damageType: "mental",
  },
  tesla: {
    ...CORE_TOWER_TYPES.bell,
    id: "tesla",
    name: "Tesla Tower",
    damageType: "mental",
  },
};

/** Full catalog combining towers.json, balanced CORE_TOWER_TYPES, and legacy aliases. */
export const TOWER_TYPES: Record<string, TowerType> = {
  basic: LEGACY_TOWER_ALIASES.basic,
  pitchfork: LEGACY_TOWER_ALIASES.pitchfork,
  ...(towersJson as unknown as Record<string, TowerType>),
  ...CORE_TOWER_TYPES,
  ...LEGACY_TOWER_ALIASES,
};

/** Visual and presentation configuration for each tower. */
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
    aliases: ["bertha"],
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

/** Default active towers in order for Defender tray and decks. */
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

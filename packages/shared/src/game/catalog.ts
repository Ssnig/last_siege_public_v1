/** Attacker unit archetype. */
export interface MobType {
  id: string;
  name: string;
  maxHp: number;
  speed: number;
  bounty: number;
}

/** Defender tower archetype. */
export interface TowerType {
  id: string;
  name: string;
  cost: number;
  range: number;
  damage: number;
  fireRate: number;
  projectileSpeed: number;
}

export const MOB_TYPES: Record<string, MobType> = {
  grunt: { id: "grunt", name: "Grunt", maxHp: 100, speed: 60, bounty: 5 },
  runner: { id: "runner", name: "Runner", maxHp: 60, speed: 110, bounty: 7 },
  brute: { id: "brute", name: "Brute", maxHp: 400, speed: 40, bounty: 25 },
};

export const TOWER_TYPES: Record<string, TowerType> = {
  basic: {
    id: "basic",
    name: "Arrow Tower",
    cost: 50,
    range: 140,
    damage: 12,
    fireRate: 1.2,
    projectileSpeed: 400,
  },
  cannon: {
    id: "cannon",
    name: "Cannon",
    cost: 120,
    range: 110,
    damage: 40,
    fireRate: 0.6,
    projectileSpeed: 300,
  },
};

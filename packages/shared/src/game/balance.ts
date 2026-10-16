/**
 * All tunable game numbers in one place.
 *
 * @remarks
 * v1 (first pass) — placeholder values from classic tower-defense archetypes
 * (Kingdom Rush-style) for testing. Tune freely: git is the version history,
 * `test/game/balance.test.ts` guards the shape so edits can't silently break it.
 */

/** Attacker unit archetype. */
export interface MobType {
  id: string;
  name: string;
  maxHp: number;
  /** Movement speed along the path, in px/s. */
  speed: number;
  /** Gold the defender earns when this mob dies. */
  bounty: number;
  /** Core HP the defender loses when this mob reaches the base. */
  leakDamage: number;
}

/** One level of a tower: full stats *and* the gold cost to reach it. */
export interface TowerTier {
  /** Gold to reach this level. `tiers[0].cost` is the build cost. */
  cost: number;
  damage: number;
  /** Targeting range, in px. */
  range: number;
  /** Shots per second. */
  fireRate: number;
  /** Projectile speed, in px/s. */
  projectileSpeed: number;
}

/**
 * Defender tower archetype.
 *
 * @remarks
 * `tiers[level-1]` is the effective stats at `level`. Costs are tower-specific:
 * there is no cross-tower upgrade formula (Kingdom-Rush-style).
 */
export interface TowerType {
  id: string;
  name: string;
  tiers: TowerTier[];
}

/** Economy tuning for both sides. */
export interface EconomyConfig {
  defenderStartingGold: number;
  attackerStartingGold: number;
  goldPerSecond: number;
  /** Total big waves the attacker has for the whole match. */
  bigWaveCount: number;
  bigWaveCost: number;
  miniWaveCost: number;
}

/** Draft rules: how many cards each side picks before the match. */
export interface DeckRules {
  deckSize: number;
}

/**
 * Tuning for the wavy, Kingdom-Rush-style lateral drift of mobs.
 *
 * @remarks All values are fractions of a path's half-width so the same numbers
 * look consistent on corridors of different sizes. The asymmetry between
 * `laneSpread` (large, fixed per mob) and the `wobble*` band (small, animated)
 * is what produces a loose column that gently drifts rather than a random walk.
 */
export interface WanderConfig {
  /** Fixed per-mob lane offset as a fraction of half-width (0..1). Spreads a wave across the corridor. */
  laneSpread: number;
  /** Minimum animated wobble amplitude as a fraction of half-width. */
  wobbleMin: number;
  /** Maximum animated wobble amplitude as a fraction of half-width. */
  wobbleMax: number;
  /** Minimum wobble cycles completed across the full path length. */
  cyclesMin: number;
  /** Maximum wobble cycles completed across the full path length. */
  cyclesMax: number;
}

export const DEFAULT_WANDER: WanderConfig = {
  laneSpread: 0.65,
  wobbleMin: 0.08,
  wobbleMax: 0.22,
  cyclesMin: 1.5,
  cyclesMax: 3.5,
};

/** Server simulation rate, in steps per second. */
export const SIM_TICK_HZ = 20;

/**
 * Duration of a single simulation step, in seconds.
 *
 * @remarks Derived from {@link SIM_TICK_HZ}; the server advances mob `progress`
 * by `speed / pathLength * SIM_STEP_SEC` each step.
 */
export const SIM_STEP_SEC = 1 / SIM_TICK_HZ;

/**
 * Per-mob speed variation as a fraction (0.1 = ±10%).
 *
 * @remarks Applied once at spawn so otherwise-identical mobs spread out and
 * bunch over time, which reads as an organic crowd.
 */
export const MOB_SPEED_JITTER = 0.1;

/**
 * Extra slack, in px, added to a projectile's per-tick travel distance when
 * deciding whether it has reached its target.
 *
 * @remarks Keeps fast projectiles from overshooting a mob between ticks; a
 * larger value lands hits slightly "early" but never misses.
 */
export const PROJECTILE_HIT_RADIUS = 12;

/** Match-wide rules driven by the server tick. */
export interface MatchRules {
  /** Core HP before the defender loses. */
  coreHp: number;
  /** Seconds allocated to the draft phase. */
  draftDurationSec: number;
  /** Seconds allocated to the building phase. */
  buildingDurationSec: number;
  /** Seconds before an unfinished combat round ends. */
  roundDurationSec: number;
}

export const MOB_TYPES: Record<string, MobType> = {
  grunt:      { id: "grunt", name: "Grunt",       maxHp: 100, speed: 60,  bounty: 5,  leakDamage: 1 },
  runner:     { id: "runner", name: "Runner",     maxHp: 60,  speed: 110, bounty: 7,  leakDamage: 1 },
  brute:      { id: "brute", name: "Brute",       maxHp: 400, speed: 40,  bounty: 25, leakDamage: 3 },
  shade:      { id: "shade", name: "Shade",       maxHp: 130, speed: 95,  bounty: 9,  leakDamage: 1 },
  spider:     { id: "spider", name: "Spider",     maxHp: 45,  speed: 130, bounty: 6,  leakDamage: 1 },
  orc:        { id: "orc", name: "Orc",           maxHp: 160, speed: 55,  bounty: 10, leakDamage: 1 },
  gargoyle:   { id: "gargoyle", name: "Gargoyle", maxHp: 220, speed: 85,  bounty: 14, leakDamage: 2 },
  sapper:     { id: "sapper", name: "Sapper",     maxHp: 180, speed: 75,  bounty: 12, leakDamage: 2 },
  necromancer:{ id: "necromancer", name: "Necromancer", maxHp: 320, speed: 70, bounty: 22, leakDamage: 2 },
  ogre:       { id: "ogre", name: "Ogre",         maxHp: 700, speed: 30,  bounty: 60, leakDamage: 5 },
};

export const TOWER_TYPES: Record<string, TowerType> = {
  basic: {
    id: "basic", name: "Arrow Tower",
    tiers: [
      { cost: 50,  damage: 12, range: 140, fireRate: 1.2, projectileSpeed: 400 },
      { cost: 90,  damage: 22, range: 160, fireRate: 1.3, projectileSpeed: 430 },
      { cost: 160, damage: 40, range: 185, fireRate: 1.4, projectileSpeed: 460 },
    ],
  },
  pitchfork: {
    id: "pitchfork", name: "Pitchfork Turret",
    tiers: [
      { cost: 30,  damage: 6,  range: 110, fireRate: 1.0, projectileSpeed: 300 },
      { cost: 55,  damage: 12, range: 125, fireRate: 1.1, projectileSpeed: 325 },
      { cost: 95,  damage: 24, range: 140, fireRate: 1.2, projectileSpeed: 350 },
    ],
  },
  poison: {
    id: "poison", name: "Poison Dart",
    tiers: [
      { cost: 70,  damage: 6,  range: 120, fireRate: 1.6, projectileSpeed: 340 },
      { cost: 125, damage: 12, range: 135, fireRate: 1.8, projectileSpeed: 370 },
      { cost: 210, damage: 26, range: 150, fireRate: 2.0, projectileSpeed: 400 },
    ],
  },
  crossbow: {
    id: "crossbow", name: "Crossbow",
    tiers: [
      { cost: 80,  damage: 8,  range: 130, fireRate: 2.2, projectileSpeed: 380 },
      { cost: 140, damage: 15, range: 145, fireRate: 2.4, projectileSpeed: 410 },
      { cost: 240, damage: 30, range: 165, fireRate: 2.6, projectileSpeed: 440 },
    ],
  },
  cannon: {
    id: "cannon", name: "Cannon",
    tiers: [
      { cost: 120, damage: 40, range: 110, fireRate: 0.6, projectileSpeed: 300 },
      { cost: 200, damage: 75, range: 120, fireRate: 0.65, projectileSpeed: 320 },
      { cost: 340, damage: 150, range: 135, fireRate: 0.7, projectileSpeed: 340 },
    ],
  },
  sniper: {
    id: "sniper", name: "Sniper",
    tiers: [
      { cost: 110, damage: 35, range: 220, fireRate: 0.4, projectileSpeed: 500 },
      { cost: 190, damage: 70, range: 250, fireRate: 0.45, projectileSpeed: 540 },
      { cost: 330, damage: 160, range: 285, fireRate: 0.5, projectileSpeed: 580 },
    ],
  },
  arcanist: {
    id: "arcanist", name: "Arcanist",
    tiers: [
      { cost: 150, damage: 30, range: 120, fireRate: 0.5, projectileSpeed: 260 },
      { cost: 260, damage: 60, range: 135, fireRate: 0.55, projectileSpeed: 280 },
      { cost: 430, damage: 140, range: 155, fireRate: 0.6, projectileSpeed: 300 },
    ],
  },
  tesla: {
    id: "tesla", name: "Tesla",
    tiers: [
      { cost: 180, damage: 20, range: 100, fireRate: 1.8, projectileSpeed: 320 },
      { cost: 300, damage: 40, range: 115, fireRate: 2.0, projectileSpeed: 350 },
      { cost: 520, damage: 90, range: 135, fireRate: 2.2, projectileSpeed: 380 },
    ],
  },
  archmage: {
    id: "archmage", name: "Archmage",
    tiers: [
      { cost: 200, damage: 55, range: 150, fireRate: 0.5, projectileSpeed: 340 },
      { cost: 340, damage: 110, range: 170, fireRate: 0.55, projectileSpeed: 360 },
      { cost: 580, damage: 240, range: 195, fireRate: 0.6, projectileSpeed: 380 },
    ],
  },
  bertha: {
    id: "bertha", name: "Big Bertha",
    tiers: [
      { cost: 260, damage: 120, range: 140, fireRate: 0.35, projectileSpeed: 280 },
      { cost: 450, damage: 240, range: 155, fireRate: 0.4, projectileSpeed: 300 },
      { cost: 780, damage: 500, range: 175, fireRate: 0.45, projectileSpeed: 320 },
    ],
  },
};

export const DEFAULT_ECONOMY: EconomyConfig = {
  defenderStartingGold: 200,
  attackerStartingGold: 150,
  goldPerSecond: 5,
  bigWaveCount: 5,
  bigWaveCost: 40,
  miniWaveCost: 10,
};

export const DEFAULT_DECK_RULES: DeckRules = {
  deckSize: 6,
};

export const MATCH_RULES: MatchRules = {
  coreHp: 10,
  draftDurationSec: -1,
  buildingDurationSec: 30, // 30-second building countdown
  roundDurationSec: 90,
};

export const MATCH_PHASES = {
  waiting: "waiting",
  drafting: "drafting",
  building: "building",
  combat: "combat",
  gameover: "gameover",
} as const;

export type MatchPhase = (typeof MATCH_PHASES)[keyof typeof MATCH_PHASES]


/** Effective stats at the given level (1-based); `null` past max level. */
export function tierAt(type: TowerType, level: number): TowerTier | null {
  return type.tiers[level - 1] ?? null;
}

/** Gold to build the tower at level 1. */
export function buildCost(type: TowerType): number {
  return type.tiers[0]?.cost ?? 0;
}

/** Gold to upgrade from `fromLevel` to `fromLevel + 1`. `null` at max level. */
export function upgradeCost(type: TowerType, fromLevel: number): number | null {
  const tier = type.tiers[fromLevel];
  return tier ? tier.cost : null;
}

/** Fraction of a tower's total invested gold refunded when it is sold (70%). */
export const SELL_REFUND_RATE = 0.7;

/** Total gold invested into a tower at `level`: build cost plus every upgrade. */
export function totalInvested(type: TowerType, level: number): number {
  let total = 0;
  for (let i = 0; i < level && i < type.tiers.length; i++) {
    total += type.tiers[i].cost;
  }
  return total;
}

/**
 * Gold refunded for a tower whose total invested gold is `invested`.
 *
 * @remarks Floored to a whole number so the client's predicted refund always
 * matches the server's, and never exceeds what was invested.
 */
export function sellRefund(invested: number): number {
  return Math.floor(invested * SELL_REFUND_RATE);
}

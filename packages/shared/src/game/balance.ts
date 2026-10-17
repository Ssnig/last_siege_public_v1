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
  /** Gold the attacker spends to field one of these in a wave. */
  cost: number;
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
  /**
   * Passive base gold per second the attacker accrues during building and combat.
   *
   * @remarks Stops once the round timer (`roundDurationSec`) expires.
   */
  attackerBaseIncome: number;
  /**
   * Passive base gold per second the defender accrues during building and combat.
   */
  defenderBaseIncome: number;
  /**
   * Fraction of released units' gold cost permanently converted to attacker passive income rate.
   */
  attackerIncomeGainRate: number;
  /**
   * Fallback / legacy passive income rate.
   */
  goldPerSecond: number;
  /** Total big waves the attacker has for the whole match. */
  bigWaveCount: number;
  /** Fraction of mob bounty refunded to defender when a mob leaks into the core. */
  leakPityRate: number;
}

/**
 * Which size of wave the attacker is staging. `big` waves allow more units per
 * batch/wave but cost a larger flat fee and consume the limited big-wave pool.
 */
export type WaveSize = "big" | "small";

/** Per-size caps and flat fee for a staged wave. */
export interface WaveSizeRules {
  /** Maximum units in a single batch. */
  batchLimit: number;
  /** Maximum total units across every batch in one wave. */
  waveLimit: number;
  /** Maximum number of batches in one wave. */
  maxBatches: number;
  /** Flat gold fee added on top of the sum of the units' costs. */
  fee: number;
}

/**
 * Rules for staging and releasing attacker waves.
 *
 * @remarks Grouped here so all wave tunables live with the rest of the balance
 * numbers; the client reuses these exact values to preview cost/limits.
 */
export interface WaveRules {
  /** Seconds between consecutive batches when a wave (or several) is released. */
  batchIntervalSec: number;
  /** Caps and fees keyed by wave size. */
  sizes: Record<WaveSize, WaveSizeRules>;
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
  /**
   * Seconds the random map is revealed before the draft opens.
   *
   * @remarks A non-positive value skips the reveal entirely and drops straight
   * into `drafting`; used by tests to keep the boot path deterministic.
   */
  mapRevealDurationSec: number;
  /** Seconds allocated to the draft phase. */
  draftDurationSec: number;
  /** Seconds allocated to the building phase. */
  buildingDurationSec: number;
  /**
   * Seconds of attacker passive income in combat.
   *
   * @remarks Reaching zero does **not** end the match: the attacker simply stops
   * earning. The defender then wins once the attacker has no units left on the
   * field and none queued to spawn.
   */
  roundDurationSec: number;
}


export const MOB_TYPES: Record<string, MobType> = {
  grunt: { id: "grunt", name: "Grunt", maxHp: 125, speed: 25, bounty: 5, leakDamage: 1, cost: 12 },
  runner: { id: "runner", name: "Runner", maxHp: 75, speed: 40, bounty: 7, leakDamage: 1, cost: 14 },
  brute: { id: "brute", name: "Brute", maxHp: 500, speed: 15, bounty: 26, leakDamage: 2, cost: 46 },
  shade: { id: "shade", name: "Shade", maxHp: 160, speed: 40, bounty: 9, leakDamage: 1, cost: 16 },
  spider: { id: "spider", name: "Spider", maxHp: 55, speed: 50, bounty: 6, leakDamage: 1, cost: 10 },
  orc: { id: "orc", name: "Orc", maxHp: 200, speed: 20, bounty: 10, leakDamage: 1, cost: 18 },
  gargoyle: { id: "gargoyle", name: "Gargoyle", maxHp: 275, speed: 30, bounty: 15, leakDamage: 1, cost: 26 },
  sapper: { id: "sapper", name: "Sapper", maxHp: 225, speed: 25, bounty: 13, leakDamage: 1, cost: 20 },
  necromancer: { id: "necromancer", name: "Necromancer", maxHp: 400, speed: 30, bounty: 23, leakDamage: 1, cost: 34 },
  ogre: { id: "ogre", name: "Ogre", maxHp: 875, speed: 10, bounty: 63, leakDamage: 4, cost: 68 },
};

export const TOWER_TYPES: Record<string, TowerType> = {
  basic: {
    id: "basic", name: "Arrow Tower",
    tiers: [
      { cost: 55, damage: 12, range: 140, fireRate: 1.08, projectileSpeed: 400 },
      { cost: 105, damage: 22, range: 160, fireRate: 1.17, projectileSpeed: 430 },
      { cost: 185, damage: 40, range: 185, fireRate: 1.26, projectileSpeed: 460 },
    ],
  },
  pitchfork: {
    id: "pitchfork", name: "Pitchfork Turret",
    tiers: [
      { cost: 35, damage: 6, range: 110, fireRate: 0.9, projectileSpeed: 300 },
      { cost: 65, damage: 12, range: 125, fireRate: 0.99, projectileSpeed: 325 },
      { cost: 110, damage: 24, range: 140, fireRate: 1.08, projectileSpeed: 350 },
    ],
  },
  poison: {
    id: "poison", name: "Poison Dart",
    tiers: [
      { cost: 80, damage: 6, range: 120, fireRate: 1.44, projectileSpeed: 340 },
      { cost: 145, damage: 12, range: 135, fireRate: 1.62, projectileSpeed: 370 },
      { cost: 240, damage: 26, range: 150, fireRate: 1.8, projectileSpeed: 400 },
    ],
  },
  crossbow: {
    id: "crossbow", name: "Crossbow",
    tiers: [
      { cost: 90, damage: 8, range: 130, fireRate: 1.98, projectileSpeed: 380 },
      { cost: 160, damage: 15, range: 145, fireRate: 2.16, projectileSpeed: 410 },
      { cost: 275, damage: 30, range: 165, fireRate: 2.34, projectileSpeed: 440 },
    ],
  },
  cannon: {
    id: "cannon", name: "Cannon",
    tiers: [
      { cost: 140, damage: 40, range: 110, fireRate: 0.54, projectileSpeed: 300 },
      { cost: 230, damage: 75, range: 120, fireRate: 0.59, projectileSpeed: 320 },
      { cost: 390, damage: 150, range: 135, fireRate: 0.63, projectileSpeed: 340 },
    ],
  },
  sniper: {
    id: "sniper", name: "Sniper",
    tiers: [
      { cost: 125, damage: 35, range: 220, fireRate: 0.36, projectileSpeed: 500 },
      { cost: 220, damage: 70, range: 250, fireRate: 0.41, projectileSpeed: 540 },
      { cost: 380, damage: 160, range: 285, fireRate: 0.45, projectileSpeed: 580 },
    ],
  },
  arcanist: {
    id: "arcanist", name: "Arcanist",
    tiers: [
      { cost: 170, damage: 30, range: 120, fireRate: 0.45, projectileSpeed: 260 },
      { cost: 300, damage: 60, range: 135, fireRate: 0.5, projectileSpeed: 280 },
      { cost: 495, damage: 140, range: 155, fireRate: 0.54, projectileSpeed: 300 },
    ],
  },
  tesla: {
    id: "tesla", name: "Tesla",
    tiers: [
      { cost: 205, damage: 20, range: 100, fireRate: 1.62, projectileSpeed: 320 },
      { cost: 345, damage: 40, range: 115, fireRate: 1.8, projectileSpeed: 350 },
      { cost: 600, damage: 90, range: 135, fireRate: 1.98, projectileSpeed: 380 },
    ],
  },
  archmage: {
    id: "archmage", name: "Archmage",
    tiers: [
      { cost: 230, damage: 55, range: 150, fireRate: 0.45, projectileSpeed: 340 },
      { cost: 390, damage: 110, range: 170, fireRate: 0.5, projectileSpeed: 360 },
      { cost: 665, damage: 240, range: 195, fireRate: 0.54, projectileSpeed: 380 },
    ],
  },
  bertha: {
    id: "bertha", name: "Big Bertha",
    tiers: [
      { cost: 300, damage: 120, range: 140, fireRate: 0.32, projectileSpeed: 280 },
      { cost: 520, damage: 240, range: 155, fireRate: 0.36, projectileSpeed: 300 },
      { cost: 895, damage: 500, range: 175, fireRate: 0.41, projectileSpeed: 320 },
    ],
  },
};

export const DEFAULT_ECONOMY: EconomyConfig = {
  defenderStartingGold: 160,
  attackerStartingGold: 120,
  attackerBaseIncome: 2.5,
  defenderBaseIncome: 5.0,
  attackerIncomeGainRate: 0.035,
  goldPerSecond: 5,
  bigWaveCount: 3,
  leakPityRate: 0.21,
};

export const DEFAULT_WAVE_RULES: WaveRules = {
  batchIntervalSec: 2.5,
  sizes: {
    small: { batchLimit: 10, waveLimit: 30, maxBatches: 5, fee: 15 },
    big: { batchLimit: 15, waveLimit: 45, maxBatches: 8, fee: 55 },
  },
};

export const DEFAULT_DECK_RULES: DeckRules = {
  deckSize: 6,
};

export const MATCH_RULES: MatchRules = {
  coreHp: 45,
  mapRevealDurationSec: 5,
  draftDurationSec: -1,
  buildingDurationSec: 45, // 45-second building countdown
  roundDurationSec: 135,
};

export const MATCH_PHASES = {
  waiting: "waiting",
  mapReveal: "mapReveal",
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
export const SELL_REFUND_RATE = 0.55;

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
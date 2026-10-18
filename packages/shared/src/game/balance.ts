/**
 * Tunable game numbers: types, derived values and typed re-exports of the raw
 * data.
 *
 * @remarks
 * The values themselves live next door in `../data/` — `mobs.json`,
 * `towers.json` and `rules.json` — so a balancing pass edits JSON rather than
 * code. Every re-export below is annotated with its interface, so a
 * shape-breaking edit fails `tsc` as soon as shared is rebuilt, and
 * `app/server/test/balance.test.ts` guards the values themselves at runtime.
 * `rules.json` keeps the rarely-touched knobs in its `constants` section, away
 * from the sections rebalanced often.
 */
import mobsData from "../data/mobs.json" with { type: "json" };
import towersData from "../data/towers.json" with { type: "json" };
import rulesData from "../data/rules.json" with { type: "json" };

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

/** Attacker unit archetypes, keyed by id — `../data/mobs.json`. */
export const MOB_TYPES: Record<string, MobType> = mobsData;

/** Defender tower archetypes, keyed by id — `../data/towers.json`. */
export const TOWER_TYPES: Record<string, TowerType> = towersData;

/** Economy tuning for both sides — `../data/rules.json`, section `economy`. */
export const DEFAULT_ECONOMY: EconomyConfig = rulesData.economy;

/** Wave staging caps and fees — `../data/rules.json`, section `waves`. */
export const DEFAULT_WAVE_RULES: WaveRules = rulesData.waves;

/** Draft deck size — `../data/rules.json`, section `deck`. */
export const DEFAULT_DECK_RULES: DeckRules = rulesData.deck;

/** Phase durations and core HP — `../data/rules.json`, section `match`. */
export const MATCH_RULES: MatchRules = rulesData.match;

/** Mob wander/drift tuning — `../data/rules.json`, section `wander`. */
export const DEFAULT_WANDER: WanderConfig = rulesData.wander;

/** Server simulation rate, in steps per second. */
export const SIM_TICK_HZ: number = rulesData.constants.simTickHz;

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
export const MOB_SPEED_JITTER: number = rulesData.constants.mobSpeedJitter;

/**
 * Extra slack, in px, added to a projectile's per-tick travel distance when
 * deciding whether it has reached its target.
 *
 * @remarks Keeps fast projectiles from overshooting a mob between ticks; a
 * larger value lands hits slightly "early" but never misses.
 */
export const PROJECTILE_HIT_RADIUS: number = rulesData.constants.projectileHitRadius;

/** Fraction of a tower's total invested gold refunded when it is sold. */
export const SELL_REFUND_RATE: number = rulesData.constants.sellRefundRate;

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

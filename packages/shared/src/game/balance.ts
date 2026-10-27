/**
 * Tunable game numbers: types, derived values and typed re-exports of the raw
 * data.
 *
 * @remarks
 * Modularized into:
 * - `./towers/` for all defender tower definitions, tiers, designs and calculations.
 * - `./units/` for all attacker unit (mob) definitions, stats, and speed calculations.
 *
 * Everything is re-exported here for full backward compatibility across the codebase.
 */
import rulesData from "../data/rules.json" with { type: "json" };

// Re-export all Tower and Unit types and functions
export * from "./towers/index.js";
export * from "./units/index.js";

import { MOB_TYPES, mobCost } from "./units/index.js";

/** Economy tuning for both sides. */
export interface EconomyConfig {
  defenderStartingGold: number;
  attackerStartingGold: number;
  /** Maximum gold a player can hold; income and bounties clamp at this cap. */
  maxGold: number;
  /**
   * Passive base gold per second the attacker accrues during combat.
   */
  attackerBaseIncome: number;
  /** Passive base gold per second the defender accrues during combat. */
  defenderBaseIncome: number;
  /**
   * Fraction of deployed unit gold cost added permanently to attacker income rate.
   */
  attackerIncomeGainRate: number;
  /**
   * Gold per second each deployed unit pays the attacker while it is still on
   * the field, scaled by that unit's gold cost (deprecated).
   */
  attackerUnitIncomeRate?: number;
  /** Path progress (0..1) a unit must pass before it starts paying income (deprecated). */
  attackerUnitIncomeThreshold?: number;
  /** Fraction of mob bounty refunded to defender when a mob leaks into the core. */
  leakPityRate: number;
  /**
   * Multiplier applied to both players' passive income near the end of the siege.
   */
  siegeEndIncomeMultiplier: number;
  /**
   * Length of the closing window, in seconds, before the siege timer runs out.
   */
  siegeEndIncomeWindowSec: number;
}

/**
 * Rules for building and deploying the attacker's buffer.
 */
export interface DeployRules {
  /** Maximum units the deploy buffer can hold at once. */
  maxBufferUnits: number;
  /** Charges a portal can regen back up to. */
  portalMaxCharges: number;
  /** Initial charges a portal has when unlocked. */
  portalInitialCharges: number;
  /** Seconds to regen one portal charge. */
  portalChargeSec: number;
  /** Seconds elapsed into combat before each portal index unlocks ([0, 50, 100]). */
  portalUnlockScheduleSec: number[];
  /** Seconds between consecutive units streaming out of a portal on deploy. */
  staggerSec: number;
}

/** Draft rules: how many cards each side picks before the match. */
export interface DeckRules {
  deckSize: number;
}

/**
 * Tuning for the wavy, Kingdom-Rush-style lateral drift of mobs.
 */
export interface WanderConfig {
  laneSpread: number;
  wobbleMin: number;
  wobbleMax: number;
  cyclesMin: number;
  cyclesMax: number;
}

/** Match-wide rules driven by the server tick. */
export interface MatchRules {
  coreHp: number;
  mapRevealDurationSec: number;
  draftDurationSec: number;
  buildingDurationSec: number;
  siegeDurationSec: number;
}

/** Status effect tuning. */
export interface CombatRules {
  debuffDurationSec: number;
  slowDurationSec: number;
  mentalBreakSlowFactor: number;
}

/** Economy tuning for both sides — `../data/rules.json`, section `economy`. */
export const DEFAULT_ECONOMY: EconomyConfig = rulesData.economy;

/** Draft deck size — `../data/rules.json`, section `deck`. */
export const DEFAULT_DECK_RULES: DeckRules = rulesData.deck;

/** Deploy buffer, portal charge and deploy stagger tuning — `../data/rules.json`, section `deploy`. */
export const DEFAULT_DEPLOY_RULES: DeployRules = rulesData.deploy;

/** Phase durations and core HP — `../data/rules.json`, section `match`. */
export const MATCH_RULES: MatchRules = rulesData.match;

/** Mob wander/drift tuning — `../data/rules.json`, section `wander`. */
export const DEFAULT_WANDER: WanderConfig = rulesData.wander;

/** Status effect tuning — `../data/rules.json`, section `combat`. */
export const DEFAULT_COMBAT_RULES: CombatRules = rulesData.combat;

/** Server simulation rate, in steps per second. */
export const SIM_TICK_HZ: number = rulesData.constants.simTickHz;

/** Duration of a single simulation step, in seconds. */
export const SIM_STEP_SEC = 1 / SIM_TICK_HZ;

/** Per-mob speed variation as a fraction (0.1 = ±10%). */
export const MOB_SPEED_JITTER: number = rulesData.constants.mobSpeedJitter;

/** Extra slack, in px, added to projectile hit radius. */
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

export type MatchPhase = (typeof MATCH_PHASES)[keyof typeof MATCH_PHASES];

/**
 * Resolves a portal's charge rules, honouring any per-portal override on the map.
 */
export function portalChargeRules(portal: { maxCharges?: number; chargeSec?: number }): {
  maxCharges: number;
  chargeSec: number;
} {
  return {
    maxCharges: portal.maxCharges ?? DEFAULT_DEPLOY_RULES.portalMaxCharges,
    chargeSec: portal.chargeSec ?? DEFAULT_DEPLOY_RULES.portalChargeSec,
  };
}

/**
 * Validates adding one unit of `typeId` to the attacker's deploy buffer.
 */
export function validateBufferAdd(
  typeId: string,
  buffer: readonly string[],
  availableTroops: readonly string[],
  gold: number,
  rules: DeployRules = DEFAULT_DEPLOY_RULES,
): string | null {
  if (!MOB_TYPES[typeId]) return "Unknown unit.";
  if (!availableTroops.includes(typeId)) return `${typeId} is not in your deck.`;
  if (buffer.length >= rules.maxBufferUnits) {
    return `The deploy queue holds at most ${rules.maxBufferUnits} units.`;
  }
  if (gold < mobCost(typeId)) return "Not enough gold.";
  return null;
}

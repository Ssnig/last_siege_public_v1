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
  /** Gold the attacker spends to queue one of these in the deploy buffer. */
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
  /**
   * Impact blast radius, in px, for artillery-style towers.
   *
   * @remarks Omitted (or `0`) means a single-target shot: its projectile only
   * damages the mob it was aimed at. A positive value turns the tower into
   * artillery — the projectile still flies to its destination even if the aim
   * target dies and, on landing, damages **every** mob inside this radius.
   */
  splashRadius?: number;
}

/** Economy tuning for both sides. */
export interface EconomyConfig {
  defenderStartingGold: number;
  attackerStartingGold: number;
  /**
   * Passive base gold per second the attacker accrues during combat.
   *
   * @remarks No gold accrues during building; the income window
   * (`incomeDurationSec`) stops this income once it expires.
   */
  attackerBaseIncome: number;
  /** Passive base gold per second the defender accrues during combat. */
  defenderBaseIncome: number;
  /**
   * Gold per second each deployed unit pays the attacker while it is still on
   * the field, scaled by that unit's gold cost.
   *
   * @remarks Replaces the old permanent deploy-time income boost, which snowballed
   * without bound. Rewarding a *live, deep* push means the attacker only earns it
   * while actually threatening the core, so a defender who cleans up an attack
   * also cuts off its income.
   */
  attackerUnitIncomeRate: number;
  /** Path progress (0..1) a unit must pass before it starts paying income. */
  attackerUnitIncomeThreshold: number;
  /** Fraction of mob bounty refunded to defender when a mob leaks into the core. */
  leakPityRate: number;
}

/**
 * Rules for building and deploying the attacker's buffer.
 *
 * @remarks Grouped here so all deploy tunables live with the rest of the
 * balance numbers; the client reuses these exact values to preview costs and
 * limits. Portals are derived from the map's path spawn points, so a map never
 * needs portal data of its own.
 */
export interface DeployRules {
  /** Maximum units the deploy buffer can hold at once. */
  maxBufferUnits: number;
  /** Charges a portal starts combat with and can regen back up to. */
  portalMaxCharges: number;
  /** Seconds to regen one portal charge. */
  portalChargeSec: number;
  /** Seconds between consecutive units streaming out of a portal on deploy. */
  staggerSec: number;
}

/**
 * Resolves a portal's charge rules, honouring any per-portal override on the map.
 *
 * @param portal - Portal whose charges are being configured.
 * @returns That portal's `maxCharges`/`chargeSec`, or the shared defaults.
 *
 * @remarks Lets a map tune a risky portal (e.g. one sitting right next to the
 * core) down to a single slow charge without touching the global rules.
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
   * @remarks Reaching zero stops attacker income only; it does not end the
   * match. The siege timer keeps running, so the attacker can still spend the
   * gold they banked before the window closed.
   */
  incomeDurationSec: number;
  /**
   * Seconds the defender must hold out before the attacker's siege fails.
   *
   * @remarks Drives the combat countdown shown in the HUD. When it expires the
   * attacker either wins on the spot (troops still on the field enter sudden
   * death) or the defender wins outright.
   */
  siegeDurationSec: number;
}

/** Attacker unit archetypes, keyed by id — `../data/mobs.json`. */
export const MOB_TYPES: Record<string, MobType> = mobsData;

/** Defender tower archetypes, keyed by id — `../data/towers.json`. */
export const TOWER_TYPES: Record<string, TowerType> = towersData;

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

/** Gold cost to queue one unit of `typeId` (0 for an unknown id). */
export function mobCost(typeId: string): number {
  return MOB_TYPES[typeId]?.cost ?? 0;
}

/**
 * Seconds to wait before the *next* unit of `typeId` streams out on a deploy.
 *
 * @param typeId - Unit being released.
 * @param base - Base stagger from {@link DEFAULT_DEPLOY_RULES}.
 * @returns The stagger gap, clamped to `[0.8, 2.0]` of the base.
 *
 * @remarks Fast units leave a bigger gap than slow ones so a mixed push fans out
 * instead of arriving as one clump. Without this, a tight cluster walks into
 * every splash tower and single-target towers have nothing to shoot at.
 */
export function deployStaggerSec(typeId: string, base: number = DEFAULT_DEPLOY_RULES.staggerSec): number {
  const speed = MOB_TYPES[typeId]?.speed ?? 60;
  return base * Math.min(2, Math.max(0.8, speed / 60));
}

/**
 * Validates adding one unit of `typeId` to the attacker's deploy buffer.
 *
 * @param typeId - Unit id the attacker wants to queue.
 * @param buffer - The buffer's current contents, as one type id per slot.
 * @param availableTroops - Unit ids the attacker is allowed to pick (their deck).
 * @param gold - The attacker's current gold.
 * @returns `null` when the request is valid, otherwise a human-readable reason.
 *
 * @remarks Pure and side-effect free so the server can gate the intent and the
 * client can grey out the button with identical rules.
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

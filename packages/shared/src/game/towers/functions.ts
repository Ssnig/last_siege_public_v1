import type { TowerType, TowerTier, TowerDesignConfig } from "./types.js";
import { TOWER_DESIGNS } from "./definitions.js";

/** Default fraction of a tower's total invested gold refunded when sold (70%). */
export const DEFAULT_SELL_REFUND_RATE = 0.7;

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
  if (fromLevel < 1 || fromLevel >= type.tiers.length) return null;
  return type.tiers[fromLevel]?.cost ?? null;
}

/**
 * Total gold sunk into a tower at the given level: its build cost plus every
 * upgrade bought so far.
 */
export function totalInvested(type: TowerType, level: number): number {
  let total = 0;
  for (let i = 0; i < level && i < type.tiers.length; i++) {
    total += type.tiers[i].cost;
  }
  return total;
}

/**
 * Gold returned to the defender when a tower with `invested` gold is sold.
 * Floored to a whole number so client and server remain identical.
 */
export function sellRefund(invested: number, refundRate: number = DEFAULT_SELL_REFUND_RATE): number {
  return Math.floor(invested * refundRate);
}

/** Resolves visual configuration for a tower id, falling back to Archer tower. */
export function getTowerDesign(typeId?: string): TowerDesignConfig {
  if (!typeId) return TOWER_DESIGNS.archer;

  const direct = TOWER_DESIGNS[typeId];
  if (direct) return direct;

  for (const design of Object.values(TOWER_DESIGNS)) {
    if (design.aliases.includes(typeId)) {
      return design;
    }
  }

  return TOWER_DESIGNS.archer;
}

/** Attack cooldown in seconds for a tower at the specified level (1 / fireRate). */
export function getTowerCooldown(type: TowerType, level: number = 1): number {
  const tier = tierAt(type, level);
  if (!tier || tier.fireRate <= 0) return 1.0;
  return 1 / tier.fireRate;
}

/** Firing rate (shots per second) for a tower at the specified level. */
export function getTowerFireRate(type: TowerType, level: number = 1): number {
  const tier = tierAt(type, level);
  return tier?.fireRate ?? 1.0;
}

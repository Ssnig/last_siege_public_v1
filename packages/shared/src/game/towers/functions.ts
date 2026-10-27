import type { TowerType, TowerTier, TowerDesignConfig } from "./types.js";
import { TOWER_DESIGNS, TOWER_TYPES } from "./definitions.js";
import rulesData from "../../data/rules.json" with { type: "json" };

/** Default fraction of a tower's total invested gold refunded when sold. */
export const DEFAULT_SELL_REFUND_RATE: number = rulesData.constants.sellRefundRate;

/** Effective stats at the given level (1-based); `null` past max level. */
export function tierAt(type: TowerType, level: number): TowerTier | null {
  return type?.tiers?.[level - 1] ?? null;
}

/** Gold to build the tower at level 1. */
export function buildCost(type: TowerType): number {
  return type?.tiers?.[0]?.cost ?? 0;
}

/** Gold to upgrade from `fromLevel` to `fromLevel + 1`. `null` at max level. */
export function upgradeCost(type: TowerType, fromLevel: number): number | null {
  if (!type || fromLevel < 1 || fromLevel >= type.tiers.length) return null;
  return type.tiers[fromLevel]?.cost ?? null;
}

/**
 * Total gold sunk into a tower at the given level: its build cost plus every
 * upgrade bought so far.
 */
export function totalInvested(type: TowerType, level: number): number {
  let total = 0;
  if (!type) return total;
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
export function getTowerCooldown(typeOrId: TowerType | string, level: number = 1): number {
  const type = typeof typeOrId === "string" ? TOWER_TYPES[typeOrId] : typeOrId;
  const tier = type ? tierAt(type, level) : null;
  if (!tier || tier.fireRate <= 0) return 1.0;
  return 1 / tier.fireRate;
}

/** Firing rate (shots per second) for a tower at the specified level. */
export function getTowerFireRate(typeOrId: TowerType | string, level: number = 1): number {
  const type = typeof typeOrId === "string" ? TOWER_TYPES[typeOrId] : typeOrId;
  const tier = type ? tierAt(type, level) : null;
  return tier?.fireRate ?? 1.0;
}

/**
 * Vertical offset from the ground slot anchor (`slot.y`) to the visual barrel/head
 * pivot of directional towers (`origin.y = 0.82`).
 */
export const TOWER_AIM_PIVOT_Y_OFFSET = -45;

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
        ? { x: signX * 46, y: -80 }
        : { x: signX * 53, y: -54 };
    case "chinthe":
      return above
        ? { x: signX * 22, y: -66 }
        : { x: signX * 22, y: -64 };
    case "dragon":
      return above
        ? { x: signX * 26, y: -64 }
        : { x: signX * 26, y: -58 };
    case "sein_pyaung":
      return above
        ? { x: signX * 41, y: -67 }
        : { x: signX * 44, y: -38 };
    case "crossbow":
    case "cannon":
    case "bomb":
      return { x: signX * 24, y: -45 };
    default:
      return { x: 0, y: -43 };
  }
}

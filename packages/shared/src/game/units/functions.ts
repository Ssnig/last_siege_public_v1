import rulesData from "../../data/rules.json" with { type: "json" };
import { MOB_TYPES } from "./definitions.js";
import type { MobTierDefinition } from "./types.js";

/** Retrieves the specific tier definition for a mob type (defaulting to Tier 1). */
export function getMobTier(typeId: string, level: number = 1): MobTierDefinition {
  const mob = MOB_TYPES[typeId];
  if (!mob) {
    return {
      level: 1,
      upgradeCost: 0,
      deployCost: 0,
      maxHp: 100,
      leakDamage: 1,
    };
  }
  const tier = mob.tiers?.find((t) => t.level === level);
  if (tier) return tier;
  return {
    level: 1,
    upgradeCost: 0,
    deployCost: mob.cost,
    maxHp: mob.maxHp,
    armor: mob.armor,
    leakDamage: mob.leakDamage,
    speed: mob.speed,
    ability: mob.ability,
    speedRamp: mob.speedRamp,
    adaptiveDefense: mob.adaptiveDefense,
    onDeathTowerStunSec: mob.onDeathTowerStunSec,
  };
}

/** Gold cost to deploy one unit of this archetype at the given tier. */
export function unitCost(typeId: string, tierLevel: number = 1): number {
  const mob = MOB_TYPES[typeId];
  if (!mob) return 0;
  if (tierLevel > 1 && mob.tiers) {
    const tier = mob.tiers.find((t) => t.level === tierLevel);
    if (tier) return tier.deployCost;
  }
  return mob.cost;
}

/** Legacy alias for unitCost. */
export const mobCost = unitCost;

/** Bounty gold awarded to the defender on slaying this unit. */
export function unitBounty(typeId: string): number {
  return MOB_TYPES[typeId]?.bounty ?? 0;
}

/** Flat physical damage absorbed from every physical hit. */
export function unitArmor(typeId: string): number {
  return MOB_TYPES[typeId]?.armor ?? 0;
}

/** Mental resolve fraction (0 = shattered, 1 = unshaken). */
export function unitMentalStrength(typeId: string): number {
  return MOB_TYPES[typeId]?.mentalStrength ?? 0.5;
}

/** Movement speed in px/s. */
export function unitSpeed(typeId: string): number {
  return MOB_TYPES[typeId]?.speed ?? 60;
}

/**
 * Seconds between consecutive units of this type streaming out of a portal.
 *
 * @remarks Fast units leave a bigger gap than slow ones so a mixed push fans out
 * instead of arriving as one clump. Clamped to `[0.8, 2.0]` of the base stagger.
 */
export function deployStaggerSec(typeId: string, base: number = rulesData.deploy.staggerSec): number {
  const speed = unitSpeed(typeId);
  return base * Math.min(2, Math.max(0.8, speed / 60));
}

/**
 * Quick, human-readable tactical summary of a unit's profile for tooltips.
 */
export function unitDescription(typeId: string): string {
  const mob = MOB_TYPES[typeId];
  if (!mob) return "Unknown unit.";

  const tags: string[] = [];
  if ((mob.armor ?? 0) > 0) tags.push(`Armor ${mob.armor}`);
  if (mob.mentalStrength === 0) tags.push("Broken Will");
  else if (mob.mentalStrength === 1) tags.push("Unshaken");
  tags.push(`${mob.speed}px/s`);
  return tags.join(" • ");
}

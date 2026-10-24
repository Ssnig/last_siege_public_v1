import { MOB_TYPES } from "./definitions.js";

/** Gold cost to deploy one unit of this archetype. */
export function unitCost(typeId: string): number {
  return MOB_TYPES[typeId]?.cost ?? 0;
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
export function deployStaggerSec(typeId: string, base: number = 0.6): number {
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

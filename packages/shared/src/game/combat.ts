/**
 * Combat vocabulary: damage channels, mob defenses and status effects.
 *
 * @remarks
 * The game has two damage channels. **Physical** damage is blunted by a mob's
 * armor, so a heavily armored troop shrugs off arrows and needs a bigger
 * caliber to hurt. **Mental** damage works the other way round: it leaves no
 * wound, but every mental hit cracks a mob's resolve, and a cracked mob takes
 * *more* mental damage from every later source.
 *
 * All the math lives here as pure functions so the server (which applies the
 * damage) and the client (which previews it) can never disagree.
 */
import { MOB_TYPES } from "./balance.js";

/** The two damage channels a tower can deal. */
export const DAMAGE_TYPES = {
  /** Blunted by the mob's armor. */
  physical: "physical",
  /** Amplified by the mob's mental debuff, and never blocked by armor. */
  mental: "mental",
} as const;

/** A damage channel. */
export type DamageType = (typeof DAMAGE_TYPES)[keyof typeof DAMAGE_TYPES];

/**
 * The status effects a mob can carry.
 *
 * @remarks Deliberately open: `slow`, `debuff`, `stun` and `heal` are the
 * effects the game ships with, and the list is the extension point for the
 * next ones (poison, silence, fear, …). The server stores one active effect
 * per type per mob, so a new effect only needs a magnitude convention and an
 * expiry rule.
 *
 * `slow`, `debuff` and `stun` are wired into the simulation today; `heal` is
 * declared but nothing in the game heals a mob yet.
 */
export const EFFECT_TYPES = {
  /** Slows the mob down. Magnitude is the fraction of speed removed (`0.2` = 20% slower). */
  slow: "slow",
  /** Mental debuff. Magnitude is the extra damage multiplier it grants. */
  debuff: "debuff",
  /** Stops the mob in its tracks. Magnitude is the stun duration in seconds. */
  stun: "stun",
  /** Restores the mob's HP. Magnitude is the amount healed per second. */
  heal: "heal",
  /** Boosts the mob's movement speed. Magnitude is the bonus speed fraction (`0.4` = 40% faster). */
  haste: "haste",
} as const;

/** A status effect type. */
export type EffectType = (typeof EFFECT_TYPES)[keyof typeof EFFECT_TYPES];

/** Default lifetime of each effect, in seconds. */
export const EFFECT_DURATION_SEC: Record<EffectType, number> = {
  slow: 6,
  debuff: 6,
  stun: 1.5,
  heal: 3,
  haste: 4,
};

/** Armor of a mob type: flat physical damage absorbed per hit. */
export function mobArmor(typeId: string): number {
  return MOB_TYPES[typeId]?.armor ?? 0;
}

/**
 * Mental strength of a mob type, as a fraction (`0` = shattered, `1` = unshaken).
 *
 * @remarks Drives how much extra mental damage a mob takes once it has been
 * cracked: `1` negates the debuff entirely, `0.5` means 1.5x mental damage,
 * and `0` means 2x mental damage plus a heavy slow.
 */
export function mobMentalStrength(typeId: string): number {
  const strength = MOB_TYPES[typeId]?.mentalStrength;
  return strength === undefined ? 0.5 : strength;
}

/**
 * Physical damage a mob actually takes.
 *
 * @param damage - Raw damage the tower dealt.
 * @param armor - The mob's armor value.
 * @returns The damage after armor, never below zero.
 *
 * @remarks Armor is flat: a value of 8 absorbs 8 damage from every physical
 * hit, whatever the hit's size. An un-armored mob (`armor` 0) takes the full
 * amount, and a hit fully absorbed by armor deals nothing.
 */
export function physicalDamageTaken(
  damage: number,
  armor: number,
  armorPenetrationRatio: number = 0,
): number {
  const effectiveArmor = Math.max(0, armor * (1 - Math.min(1, Math.max(0, armorPenetrationRatio))));
  return Math.max(0, damage - effectiveArmor);
}

/**
 * Extra damage multiplier a mental debuff grants.
 *
 * @param mentalStrength - The mob's mental strength, `0`..`1`.
 * @returns `0` for a mob that fully negates the debuff, up to `1` (doubling).
 *
 * @remarks A strength of `1` yields `0` (no amplification at all), `0.5`
 * yields `0.5` (1.5x damage) and `0` yields `1` (2x damage).
 */
export function mentalDebuffMagnitude(mentalStrength: number): number {
  return 1 - Math.min(1, Math.max(0, mentalStrength));
}

/**
 * Mental damage a mob actually takes.
 *
 * @param damage - Raw damage the tower dealt.
 * @param debuffMagnitude - Magnitude of the mob's active mental debuff (`0` = none).
 * @returns The amplified damage.
 *
 * @remarks The debuff is applied *after* a hit lands, so the first mental hit
 * always deals its listed damage; every later mental hit is amplified.
 */
export function mentalDamageTaken(damage: number, debuffMagnitude: number): number {
  return damage * (1 + Math.max(0, debuffMagnitude));
}

/**
 * Combines the magnitude of an active effect with a newly applied one.
 *
 * @param current - Magnitude of the effect already on the mob.
 * @param incoming - Magnitude of the effect being applied.
 * @returns The magnitude the mob keeps.
 *
 * @remarks Every effect type here reads "bigger is stronger", so the stronger
 * of the two wins and the weaker one never dilutes it.
 */
export function combineEffectMagnitude(current: number, incoming: number): number {
  return Math.max(current, incoming);
}

/**
 * A mob's current speed, after every active slow and haste is applied.
 *
 * @param baseSpeed - The mob's unmodified speed, in px/s.
 * @param slowAmounts - Magnitude of every active slow, as a fraction of speed removed.
 * @param hasteAmounts - Magnitude of every active haste, as a bonus fraction of speed added.
 * @returns The effective speed, never below zero.
 *
 * @remarks The strongest slow and strongest haste each win rather than stacking
 * additively with weaker copies of themselves.
 */
export function effectiveSpeed(
  baseSpeed: number,
  slowAmounts: number[],
  hasteAmounts: number[] = [],
): number {
  let strongestSlow = 0;
  for (const amount of slowAmounts) {
    if (amount > strongestSlow) strongestSlow = amount;
  }
  let strongestHaste = 0;
  for (const amount of hasteAmounts) {
    if (amount > strongestHaste) strongestHaste = amount;
  }
  return Math.max(
    0,
    baseSpeed * (1 - Math.min(1, strongestSlow)) * (1 + Math.max(0, strongestHaste)),
  );
}

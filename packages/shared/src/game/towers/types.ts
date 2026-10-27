import type { DamageType, EffectType } from "../combat.js";

/** Status effect applied on hit (e.g. Cannon 25% slow for 1.5s). */
export interface TowerOnHitEffect {
  type: EffectType;
  /** Strength of the effect (e.g. 0.25 = 25% slow). */
  magnitude: number;
  /** Duration in seconds. */
  durationSec: number;
}

/** Scaling special effect attributes for a tower tier (Levels 1 -> 2 -> 3). */
export interface TowerTierSpecial {
  /** Archer: Maximum simultaneous targets engaged in multi-shot volley (e.g. 1 -> 2 -> 3). */
  multiTargets?: number;
  /** Crossbow: Number of rapid bolts released per salvo magazine. */
  salvoCount?: number;
  /** Crossbow: Seconds between consecutive bolts in a salvo burst. */
  salvoStaggerSec?: number;
  /** Crossbow: Flat bonus damage dealt by the final bolt if it connects. */
  salvoFinisherBonus?: number;
  /** Crossbow: Seconds the target is stunned if the final bolt connects. */
  salvoFinisherStunSec?: number;
  /** Archer (deprecated): Maximum bonus fire rate fraction reached through consecutive shots. */
  windupMaxBonus?: number;
  /** Cannon / Crossbow: Fraction of target armor ignored (0.25 = 25% armor ignore). */
  armorPierceRatio?: number;
  /** Bomb / Chinthe: Distance in px the target is knocked back along the path on hit. */
  knockbackPx?: number;
  /** Bell: Movement speed slow fraction applied to all mobs in the AoE pulse (e.g. 0.15 = 15%). */
  pulseSlow?: number;
  /** Spear: Total physical bleed damage dealt over 3 seconds. */
  bleedTotalDamage?: number;
  /** Gun: Bonus gold awarded to defender when this tower scores the killing blow. */
  bonusGoldOnKill?: number;
  /** Gun: Whether this tower prioritizes high-value support casters (Healers, Drummers). */
  prioritizeSupport?: boolean;
  /** Water Cannon: Slow fraction applied by drench (e.g. 0.15 = 15%). */
  drenchSlow?: number;
  /** Water Cannon: Extra multiplier on incoming mental damage while drenched (e.g. 0.15 = +15%). */
  drenchVulnerability?: number;
  /** Chinthe: Duration in seconds mob abilities and auras are silenced. */
  silenceSec?: number;
  /** Dragon: Damage dealt in spiritual explosion when an enemy is slain by dragon fire. */
  deathExplosionDamage?: number;
  /** Dragon: Radius in px of the on-death spiritual explosion. */
  deathExplosionRadius?: number;
  /** Sein Pyaung: Flat physical armor permanently stripped from the target on hit. */
  armorStripPermanent?: number;
}

/** One level of a tower: full stats, scaling special effects, and the gold cost to reach it. */
export interface TowerTier {
  /** Gold to reach this level. `tiers[0].cost` is the build cost. */
  cost: number;
  /** Base damage (or minimum of damage range). */
  damage: number;
  /** Maximum damage if using a damage range; falls back to `damage` if omitted. */
  damageMax?: number;
  /** Targeting range, in px. */
  range: number;
  /** Shots per second (= 1 / cooldownSec). */
  fireRate: number;
  /** Projectile speed, in px/s. */
  projectileSpeed: number;
  /** Scaling special passive or on-hit modifier for this tier. */
  special?: TowerTierSpecial;
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
  nickname?: string;
  strongAgainst?: string[];
  weakAgainst?: string[];
  notes?: string;
  armorPenetration?: number;
  tiers: TowerTier[];
  /**
   * Which damage channel this tower deals.
   *
   * @remarks `"physical"` (the default) is blunted by a mob's armor; `"mental"`
   * ignores armor but cracks the mob's resolve.
   */
  damageType?: DamageType;
  /**
   * Impact blast radius, in px, for artillery-style towers.
   */
  splashRadius?: number;
  /**
   * Optional status effect applied to units hit by this tower's projectiles.
   */
  onHitEffect?: TowerOnHitEffect;
  /**
   * How the tower delivers its damage ("projectile" default or "aoe_pulse").
   */
  attackMode?: "projectile" | "aoe_pulse";
}

/** Visual and presentation configuration for a tower on the client. */
export interface TowerDesignConfig {
  id: string;
  folder: string;
  name: string;
  shortName: string;
  aliases: string[];
  textureKey: string;
  texturePath: string;
  projectileKey: string;
  projectilePath: string;
  iconPath: string;
  displaySize: { width: number; height: number };
  origin: { x: number; y: number };
  tactical: {
    title: string;
    weakness: string;
    stacks: string;
  };
}


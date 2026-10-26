import type { DamageType, EffectType } from "../combat.js";

/** Status effect applied on hit (e.g. Cannon 25% slow for 1.5s). */
export interface TowerOnHitEffect {
  type: EffectType;
  /** Strength of the effect (e.g. 0.25 = 25% slow). */
  magnitude: number;
  /** Duration in seconds. */
  durationSec: number;
}

/** One level of a tower: full stats and the gold cost to reach it. */
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


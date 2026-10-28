/** Supported mob support/buff ability archetypes. */
export type MobAbilityType = "heal_aura" | "speed_aura" | "self_heal";

/** Active ability configuration for a support/caster mob. */
export interface MobAbilityConfig {
  /** Ability archetype (e.g. "heal_aura", "speed_aura", or "self_heal"). */
  type: MobAbilityType;
  /** Radius in world px within which allied mobs are checked and affected. */
  radius: number;
  /** Cooldown in seconds between casts. */
  cooldownSec: number;
  /** HP ratio threshold (0..1) below which an ally in radius triggers the cast (for "heal_aura"). */
  triggerHpThreshold?: number;
  /** Flat HP restored to each damaged ally in radius (capped at maxHp, for "heal_aura"). */
  healAmount?: number;
  /** Fraction of maxHp restored on cast (e.g. 0.1 = 10% maxHp, for "self_heal"). */
  healFraction?: number;
  /** Fractional movement speed bonus granted to allies in radius (e.g. 0.4 = +40%, for "speed_aura"). */
  speedBoost?: number;
  /** Duration in seconds of the applied speed buff (for "speed_aura"; < 0.5 * cooldownSec). */
  durationSec?: number;
  /**
   * Optional speed-matching factor (0..1) when a significantly slower ally is within `radius`.
   * Lets a fast support unit slow down to pace slower allies in its aura range.
   */
  paceSlowFactor?: number;
  /** Seconds the caster pauses movement while playing its cast animation. */
  castDurationSec?: number;
}

/** Progressive movement speed ramp configuration for long-lane scaling units. */
export interface MobSpeedRampConfig {
  /** Maximum fractional speed bonus reached at `rampDurationSec` (`1.0` = +100% = 2x speed). */
  maxBonusFraction: number;
  /** Seconds of lane travel required to reach `maxBonusFraction`. */
  rampDurationSec: number;
}

/** Reactive defense stacking when taking physical or mental hits (e.g. Belu Ogre). */
export interface MobAdaptiveDefenseConfig {
  /** Maximum total stacks combined across physical and mental hits (e.g. 5). */
  maxStacks: number;
  /** Flat physical armor gained per physical damage stack (e.g. 2.4 -> 12 armor at 5 stacks). */
  armorPerStack: number;
  /** Mental strength gained per mental damage stack (e.g. 0.2 -> 1.0 at 5 stacks). */
  mentalStrengthPerStack: number;
}

/** Attacker unit (mob) archetype definition. */
export interface MobType {
  id: string;
  name: string;
  nickname?: string;
  strongAgainst?: string[];
  weakAgainst?: string[];
  notes?: string;
  maxHp: number;
  /** Movement speed along the path, in px/s. */
  speed: number;
  /** Gold the defender earns when this mob dies. */
  bounty: number;
  /** Core HP the defender loses when this mob reaches the base. */
  leakDamage: number;
  /** Gold the attacker spends to queue one of these in the deploy buffer. */
  cost: number;
  /**
   * Flat physical damage absorbed from every physical hit.
   *
   * @remarks `0` (the default) means the mob takes full damage. Armor only
   * blunts physical damage — mental damage ignores it entirely.
   */
  armor?: number;
  /**
   * Mental resolve, as a fraction (`0` = shattered, `1` = unshaken).
   *
   * @remarks Decides how a mob reacts to mental damage. The first mental hit
   * lands at face value; it also cracks the mob, and every later mental hit is
   * amplified by the crack: a strength of `1` shrugs it off (`1x`), `0.5` takes
   * `1.5x`, and `0` takes `2x` and is slowed to 80% speed. Defaults to `0.5`.
   */
  mentalStrength?: number;
  /**
   * When `true`, this mob pulls tower aggro whenever it is inside a tower's
   * targeting range, overriding normal nearest-to-base priority.
   */
  taunt?: boolean;
  /** Optional active support/buff/self ability triggered along the lane. */
  ability?: MobAbilityConfig;
  /** Optional progressive speed acceleration over time alive on the lane. */
  speedRamp?: MobSpeedRampConfig;
  /** Optional reactive armor / mental strength stacking upon taking hits. */
  adaptiveDefense?: MobAdaptiveDefenseConfig;
  /** Optional movement speed (in px/s) the mob drops to after taking its first hit. */
  damagedSpeed?: number;
  /** Optional duration (in seconds) to stun the tower that lands the killing blow on this mob. */
  onDeathTowerStunSec?: number;
  /**
   * Weight category: 'light' or 'heavy'.
   *
   * @remarks 'light' mobs are vulnerable to displacement effects (such as Bomb Throwing
   * Tower concussion knockback). 'heavy' units have immovable mass and ignore knockback.
   */
  weight?: "light" | "heavy";
  /** 3-tier upgrade progression (Tiers 1, 2, 3). */
  tiers?: MobTierDefinition[];
}

/** Definition for a specific upgrade tier of an attacker unit. */
export interface MobTierDefinition {
  /** Tier level: 1, 2, or 3. */
  level: number;
  /** One-time gold cost for attacker to upgrade to this tier (0 for tier 1). */
  upgradeCost: number;
  /** Gold cost to deploy one unit of this tier in the buffer. */
  deployCost: number;
  /** Max health pool of this tier. */
  maxHp: number;
  /** Flat physical damage absorbed. */
  armor?: number;
  /** Core HP deducted if this mob leaks into the citadel. */
  leakDamage: number;
  /** Movement speed along the path in px/s. */
  speed?: number;
  /** Optional active support/buff/self ability triggered along the lane. */
  ability?: MobAbilityConfig;
  /** Optional progressive speed acceleration over time alive on the lane. */
  speedRamp?: MobSpeedRampConfig;
  /** Optional reactive armor / mental strength stacking upon taking hits. */
  adaptiveDefense?: MobAdaptiveDefenseConfig;
  /** Optional duration (in seconds) to stun the tower that lands the killing blow on this mob. */
  onDeathTowerStunSec?: number;
}


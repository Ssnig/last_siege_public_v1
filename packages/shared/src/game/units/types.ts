/** Attacker unit (mob) archetype definition. */
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
}


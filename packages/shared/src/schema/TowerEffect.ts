import { schema, t, type SchemaType } from "@colyseus/schema";

/**
 * A status effect (positive buff or negative debuff) currently riding on a tower.
 *
 * @remarks
 * Mirrors {@link MobEffect} for defender structures so the game can represent
 * both negative status effects (such as Sone Ma's on-death 5s stun or future
 * attack-speed slows) and positive buffs (such as aura haste or damage boosts).
 *
 * - `stun`: disables the tower from targeting or firing while active.
 * - `haste`: fractional attack speed bonus (`0.25` = +25% fire rate).
 * - `slow`: fractional attack speed reduction (`0.25` = -25% fire rate).
 *
 * `remaining` counts down in seconds and is removed by the server when it hits 0.
 */
export const TowerEffect = schema({
  /** Effect type, see `TOWER_EFFECT_TYPES` in the shared combat module. */
  type: t.string(),
  /** How strong the effect is; interpreted per effect type. */
  magnitude: t.float32().default(0),
  /** Seconds left before the effect expires. */
  remaining: t.float32().default(0),
  /** Id of whoever applied it (mob id, tower id, or empty for map effects). */
  sourceId: t.string().default(""),
}, "TowerEffect");

export type TowerEffect = SchemaType<typeof TowerEffect>;

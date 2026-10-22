import { schema, t, type SchemaType } from "@colyseus/schema";

/**
 * A status effect currently riding on a mob.
 *
 * @remarks
 * The mob's effect list is the extension point for every non-damage status
 * the game will ever have: slows, debuffs, stuns, healing, and whatever comes
 * next. `type` names the effect and `magnitude` says how strong it is, with
 * the meaning defined per effect type:
 *
 * - `slow`: fraction of speed removed (`0.2` = 20% slower).
 * - `debuff`: extra damage multiplier granted (`0.5` = 1.5x mental damage).
 * - `stun`: seconds the mob stays stopped.
 * - `heal`: HP restored per second.
 *
 * `remaining` counts the effect down in seconds; the server drops the effect
 * when it reaches zero, so a mob never carries a stale status.
 */
export const MobEffect = schema({
  /** Effect type, see `EFFECT_TYPES` in the shared combat module. */
  type: t.string(),
  /** How strong the effect is; interpreted per effect type. */
  magnitude: t.float32().default(0),
  /** Seconds left before the effect expires. */
  remaining: t.float32().default(0),
  /** Id of whoever applied it (tower id, or empty for map effects). */
  sourceId: t.string().default(""),
}, "MobEffect");

export type MobEffect = SchemaType<typeof MobEffect>;

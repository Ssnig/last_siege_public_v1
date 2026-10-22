import { schema, t, type SchemaType } from "@colyseus/schema";
import { MobEffect } from "./MobEffect.js";

/**
 * An attacker-owned mob travelling the map path.
 *
 * @remarks
 * Only `progress` (normalised distance along the path, 0..1) is synced; the
 * client derives `x`/`y` with `samplePathWithLateral`, using `pathId` to pick
 * the track and `seed` to reproduce the server's wavy lane drift. This keeps
 * per-tick bandwidth to a single float per mob. Mobs never attack towers —
 * towers shoot them.
 *
 * `progress` is a plain reliable field on purpose: the project currently ships
 * on a WebSocket transport, which has no datagram channel, so `@unreliable`
 * fields are skipped for every client and would freeze at their join-time value.
 */
export const Mob = schema({
  ownerId: t.string(),
  typeId: t.string(),
  batchId: t.uint32(),
  progress: t.float32().default(0),
  hp: t.int32(),
  maxHp: t.int32(),
  speed: t.float32(),
  bounty: t.uint16().default(0),
  checkpoint: t.uint8().default(0),
  state: t.string().default("moving"),
  /** Stable per-mob RNG seed; drives deterministic lateral drift on both sides. */
  seed: t.uint32().default(0),
  /** Which track of the map this mob follows (e.g. "top"/"bottom"/"main"). */
  pathId: t.string().default("main"),
  /**
   * Status effects currently riding on the mob, keyed by effect type.
   *
   * @remarks One entry per effect type at a time, so a mob cannot stack two
   * of the same status; a re-applied effect refreshes the stronger one. The
   * map is synced so the client can show the mob's state (a slowed troop, a
   * cracked one) without simulating combat itself.
   */
  effects: t.map(MobEffect),
}, "Mob");

export type Mob = SchemaType<typeof Mob>;

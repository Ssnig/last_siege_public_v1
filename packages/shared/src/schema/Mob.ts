import { schema, t, type SchemaType } from "@colyseus/schema";

/**
 * An attacker-owned mob travelling the map path.
 *
 * @remarks
 * Only `progress` (normalised distance along the path, 0..1) is synced on the
 * unreliable channel; the client derives `x`/`y` with `samplePathWithLateral`,
 * using `pathId` to pick the track and `seed` to reproduce the server's wavy
 * lane drift. This keeps per-tick bandwidth to a single float per mob. Mobs
 * never attack towers — towers shoot them.
 */
export const Mob = schema({
  ownerId: t.string(),
  typeId: t.string(),
  batchId: t.uint32(),
  progress: t.float32().default(0).unreliable(),
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
}, "Mob");

export type Mob = SchemaType<typeof Mob>;

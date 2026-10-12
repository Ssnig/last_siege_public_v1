import { schema, t, type SchemaType } from "@colyseus/schema";

/**
 * An attacker-owned mob travelling the map path.
 *
 * @remarks
 * Only `progress` (distance along the path) is synced on the unreliable channel;
 * the client derives `x`/`y` from `progress` + `MapDefinition.path`. Mobs never
 * attack towers — towers shoot them.
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
}, "Mob");

export type Mob = SchemaType<typeof Mob>;

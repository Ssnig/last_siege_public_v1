import { schema, t, type SchemaType } from "@colyseus/schema";

/**
 * A tower-fired projectile homing on a mob.
 *
 * @remarks
 * Position stays a plain reliable field: the project ships on a WebSocket
 * transport, which has no datagram channel, so `@unreliable` fields would be
 * skipped for every client and freeze at their join-time value. Damage/speed
 * are reliable too.
 */
export const Projectile = schema({
  ownerId: t.string(),
  typeId: t.string(),
  x: t.float32().default(0),
  y: t.float32().default(0),
  targetId: t.string(),
  damage: t.int32(),
  speed: t.float32(),
  isEmpowered: t.boolean().default(false),
}, "Projectile");

export type Projectile = SchemaType<typeof Projectile>;

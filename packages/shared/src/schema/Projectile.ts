import { schema, t, type SchemaType } from "@colyseus/schema";

/**
 * A tower-fired projectile homing on a mob.
 *
 * @remarks
 * Position is unreliable (interpolated client-side); damage/speed stay reliable.
 */
export const Projectile = schema({
  ownerId: t.string(),
  typeId: t.string(),
  x: t.float32().default(0).unreliable(),
  y: t.float32().default(0).unreliable(),
  targetId: t.string(),
  damage: t.int32(),
  speed: t.float32(),
}, "Projectile");

export type Projectile = SchemaType<typeof Projectile>;

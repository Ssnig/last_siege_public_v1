import { schema, t, type SchemaType } from "@colyseus/schema";
import { TowerEffect } from "./TowerEffect.js";

/**
 * A defender tower occupying a fixed slot from `MapDefinition.slots`.
 *
 * @remarks
 * Towers are placed by slot index, not free coordinates, so the client and
 * server always agree on placement. `typeId` keys into the `TowerType` catalog.
 * `invested` is the total gold spent on the tower so far (build plus upgrades);
 * the sale refund is a fraction of this, so it must not be recomputed from the
 * catalog once discounts or partial upgrades exist.
 */
export const Tower = schema({
  ownerId: t.string(),
  typeId: t.string(),
  slotIndex: t.uint16(),
  level: t.uint8().default(1),
  invested: t.uint16().default(0),
  cooldown: t.float32().default(0),
  targetId: t.string().optional(),
  /** Active status effects (e.g. stun, haste, slow) currently riding on the tower. */
  effects: t.map(TowerEffect),
}, "Tower");

export type Tower = SchemaType<typeof Tower>;

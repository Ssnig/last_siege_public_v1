import { schema, t, type SchemaType } from "@colyseus/schema";

/**
 * A defender tower occupying a fixed slot from `MapDefinition.slots`.
 *
 * @remarks
 * Towers are placed by slot index, not free coordinates, so the client and
 * server always agree on placement. `typeId` keys into the `TowerType` catalog.
 */
export const Tower = schema({
  ownerId: t.string(),
  typeId: t.string(),
  slotIndex: t.uint16(),
  level: t.uint8().default(1),
  cooldown: t.float32().default(0),
  targetId: t.string().optional(),
}, "Tower");

export type Tower = SchemaType<typeof Tower>;

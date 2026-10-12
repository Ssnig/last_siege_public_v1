import { schema, t, type SchemaType } from "@colyseus/schema";
import { Player } from "./Player.js";
import { Tower } from "./Tower.js";
import { Mob } from "./Mob.js";
import { Projectile } from "./Projectile.js";

/**
 * Room-wide networked state; the single synced root attached to `GameRoom`.
 *
 * @remarks
 * Entity collections are keyed by a generated id (players by `sessionId`). Hidden
 * per-player economy lives in private messages, never here.
 */
export const RoomState = schema({
  phase: t.string().default("drafting"),
  mapId: t.string().default(""),
  winner: t.string().optional(),
  phaseEndsAt: t.float64().default(0),
  serverTick: t.uint32().default(0),
  waveIndex: t.uint16().default(0),
  players: t.map(Player),
  towers: t.map(Tower),
  mobs: t.map(Mob),
  projectiles: t.map(Projectile),
}, "RoomState");

export type RoomState = SchemaType<typeof RoomState>;

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
  /**
   * Why the match ended (`surrender` | `core` | `time` | `suddenDeath` |
   * `disconnect`); empty while live.
   *
   * @remarks Mirrored out of the private `game_over` message so a client that
   * never saw the message (a rejoin after the match closed, or a message that
   * arrived before its handler) still renders the correct game-over copy from
   * the same authoritative patch that carries `phase`.
   */
  gameOverReason: t.string().default(""),
  phaseEndsAt: t.float64().default(0),
  serverTick: t.uint32().default(0),
  /**
   * `true` once the siege timer expired with attacker units still on the
   * field. The match then resolves solely on whether the defender's core
   * stands: a leak of zero HP ends it for the attacker, all troops dying ends
   * it for the defender.
   */
  suddenDeath: t.boolean().default(false),
  /**
   * Defender core HP. Each mob that reaches the base subtracts its
   * `leakDamage`; reaching zero ends the match with the attacker winning.
   */
  coreHp: t.uint16().default(0),
  draftMobPool: t.array('string'),
  players: t.map(Player),
  towers: t.map(Tower),
  mobs: t.map(Mob),
  projectiles: t.map(Projectile),
}, "RoomState");

export type RoomState = SchemaType<typeof RoomState>;

import { schema, t, type SchemaType } from "@colyseus/schema";

/**
 * Per-player networked state, keyed by Colyseus `sessionId` in `RoomState.players`.
 *
 * @remarks
 * Hidden economy values (`gold`, drafted `deck`, deploy buffer and portal
 * charges) are deliberately absent here — they are pushed to the owning client
 * via private messages so opponents can't read them off the wire.
 */
export const Player = schema({
  name: t.string(),
  role: t.string(),
  connected: t.boolean().default(true),
  hp: t.int32().default(0),
  draftReady: t.boolean().default(false),
}, "Player");

export type Player = SchemaType<typeof Player>;

import { schema, SchemaType, t } from "@colyseus/schema";
import { Player } from "./Player.js";


/**
 * Room-wide networked state. `players` is keyed by the Colyseus `sessionId`.
 */
export const MyRoomState = schema({

  players: t.map(Player),

});
export type MyRoomState = SchemaType<typeof MyRoomState>;

import { schema, SchemaType, t } from "@colyseus/schema";
import { Player } from "./Player.js";


export const MyRoomState = schema({

  players: t.map(Player),

});
export type MyRoomState = SchemaType<typeof MyRoomState>;

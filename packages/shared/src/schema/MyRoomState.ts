// packages/shared/src/schema/MyRoomState.ts (or your state file)
import { Schema, type, MapSchema } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") name: string = "";
  @type("string") role: string = "";
  @type("number") x: number = 100;
  @type("number") y: number = 100;
}

export class MyRoomState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}

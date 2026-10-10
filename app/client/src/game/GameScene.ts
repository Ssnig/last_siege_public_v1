// apps/client/src/game/GameScene.ts
import Phaser from "phaser";
import { Room } from "@colyseus/sdk";

export class GameScene extends Phaser.Scene {
  private room!: Room;

  constructor() {
    super("GameScene");
  }

  create() {
    // ONLY retrieve the existing room passed from React via the registry
    this.room = this.registry.get("room");

    if (!this.room) {
      console.error("No active Colyseus room found in registry!");
      return;
    }

    console.log("Phaser connected to room:", this.room.id);

    // Listen for role assignment from the server
    this.room.onMessage("role_assigned", (data: { myRole: string; opponentName: string; opponentRole: string }) => {
      console.log("Assigned role in Phaser:", data);
    });
  }
}

// apps/client/src/game/GameScene.ts
import Phaser from "phaser";
import { Room } from "@colyseus/sdk";
import { MESSAGES } from "@root/shared";
import { AttackerDraftStage } from "./stages/AttackerDraftStage";

/**
 * Bare-bones game scene: grabs the shared room and listens for role assignment.
 *
 * @remarks
 * The room isn't injected as a prop — it's pulled from the Phaser registry that
 * `GameContainer` populates. Only read it in `create()`, never the constructor.
 */

export class GameScene extends Phaser.Scene {
  private room!: Room;
  private attackerDraft?: AttackerDraftStage;

  constructor() {
    super("GameScene");
  }

  create() {
    this.room = this.registry.get("room");

    if (!this.room) {
      console.error("No active Colyseus room found in registry!");
      return;
    }

    console.log("Phaser connected to room:", this.room.sessionId);

    this.room.onMessage(MESSAGES.roleAssigned, (data) => {
      console.log("Role assigned:", data);
    });

    // Client-only prototype: open the draft immediately.
    this.attackerDraft = new AttackerDraftStage(this);
    this.attackerDraft.create();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.attackerDraft?.destroy();
      this.attackerDraft = undefined;
    });
  }
}

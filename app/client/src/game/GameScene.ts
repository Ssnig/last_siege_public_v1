import Phaser from "phaser";
import { Room, Callbacks } from "@colyseus/sdk";
import {
  MESSAGES,
  type RoleAssignedPayload,
} from "@root/shared";
import { AttackerDraftStage } from "./stages/AttackerDraftStage";
import { DefenderDraftStage } from "./stages/DefenderDraftStage";

type PlayerRole = "attacker" | "defender";

/**
 * Client-side game scene connected to an authoritative Colyseus room.
 *
 * @remarks
 * The server owns roles, draft validation, and game phase transitions.
 * GameContainer owns the room connection and its lifecycle.
 */
export class GameScene extends Phaser.Scene {
  private room!: Room;
  private attackerDraft?: AttackerDraftStage;
  private defenderDraft?: DefenderDraftStage;

  private currentPhase?: string;
  private assignedRole?: PlayerRole;
  private buildingPlaceholder?: Phaser.GameObjects.Text;

  private unsubscribeRoomListeners: Array<() => void> = [];

  constructor() {
    super("GameScene");
  }

  create(): void {
    const room = this.registry.get("room") as Room | undefined;

    if (!room) {
      console.error("[GameScene] No Colyseus room in registry.");
      return;
    }

    this.room = room;

    console.log("[GameScene] Connected:", room.sessionId);

    /**
     * Room messages are independent of Phaser's scene lifecycle.
     * Retain unsubscribe callbacks to prevent stale scene handlers.
     */
    this.unsubscribeRoomListeners.push(
      room.onMessage(
        MESSAGES.roleAssigned,
        (payload: RoleAssignedPayload) => {
          this.assignedRole = payload.myRole;
          this.syncPhase();
        },
      ),
    );

    this.unsubscribeRoomListeners.push(
      room.onMessage(
        MESSAGES.draftRejected,
        (payload: { reason: string }) => {
          this.attackerDraft?.rejectDraft(payload.reason);
          this.defenderDraft?.rejectDraft(payload.reason);
        },
      ),
    );

const callbacks = Callbacks.get(room);

this.unsubscribeRoomListeners.push(
  callbacks.listen("phase", (phase: string) => {
    this.currentPhase = phase;
    this.syncPhase();
  }),
);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanup();
    });

    /**
     * State can already be initialized when this scene starts.
     * Use the current value rather than relying only on future updates.
     */
    this.currentPhase = room.state.phase;

    // Recover the role from authoritative state if role_assigned
    // was delivered before this scene registered its listener.
    const player = room.state.players.get(room.sessionId);
    if (player?.role === "attacker" || player?.role === "defender") {
      this.assignedRole = player.role;
    }

    this.syncPhase();
  }

  /**
   * Reconciles visible UI with the latest authoritative phase.
   *
   * @remarks
   * Safe to call from both network callbacks and scene initialization.
   */
  private syncPhase(): void {
    switch (this.currentPhase) {
      case "drafting":
        if (this.assignedRole) {
          this.startDraft(this.assignedRole);
        }
        break;

      case "building":
        this.destroyDraftStages();
        this.showBlankBuildingPhase();
        break;

      case "gameover":
        this.destroyDraftStages();
        this.buildingPlaceholder?.destroy();
        this.buildingPlaceholder = undefined;
        break;

      default:
        break;
    }
  }

  /**
   * Creates the draft UI for the assigned role.
   *
   * @remarks
   * Existing draft instances are retained to preserve local selections.
   * The server validates every submitted deck.
   */
  private startDraft(role: PlayerRole): void {
    if (role === "attacker" && this.attackerDraft) return;
    if (role === "defender" && this.defenderDraft) return;

    this.destroyDraftStages();
    this.buildingPlaceholder?.destroy();
    this.buildingPlaceholder = undefined;

    const onConfirm = (deck: string[]): void => {
      if (this.currentPhase !== "drafting") return;

      this.room.send(MESSAGES.draftReady, { deck });
    };

    if (role === "attacker") {
      this.attackerDraft = new AttackerDraftStage(this, onConfirm);
      this.attackerDraft.create();
    } else {
      this.defenderDraft = new DefenderDraftStage(this, onConfirm);
      this.defenderDraft.create();
    }
  }

  /** Destroys the active draft UI and its resize subscriptions. */
  private destroyDraftStages(): void {
    this.attackerDraft?.destroy();
    this.attackerDraft = undefined;

    this.defenderDraft?.destroy();
    this.defenderDraft = undefined;
  }

  /**
   * Displays the temporary building-phase screen.
   *
   * @remarks
   * Reuses the existing placeholder to avoid duplicate text objects.
   */
  private showBlankBuildingPhase(): void {
    if (this.buildingPlaceholder) return;

    this.buildingPlaceholder = this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2,
        "Preparing battlefield...",
        {
          fontSize: "24px",
          color: "#ffffff",
        },
      )
      .setOrigin(0.5);

    console.log("[GameScene] Entered building phase.");
  }

  /**
   * Releases scene-owned resources without disconnecting Colyseus.
   */
  private cleanup(): void {
    this.destroyDraftStages();

    this.buildingPlaceholder?.destroy();
    this.buildingPlaceholder = undefined;

    for (const unsubscribe of this.unsubscribeRoomListeners) {
      unsubscribe();
    }

    this.unsubscribeRoomListeners = [];
    this.currentPhase = undefined;
    this.assignedRole = undefined;
  }
}
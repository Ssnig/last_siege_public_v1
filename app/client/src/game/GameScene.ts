import Phaser from "phaser";
import { Room, Callbacks } from "@colyseus/sdk";
import {
  MESSAGES,
  MAPS,
  KONBAUNG_MAP,
  type RoleAssignedPayload,
  type YouEconomyPayload,
} from "@root/shared";
import { AttackerDraftStage } from "./stages/AttackerDraftStage";
import { DefenderDraftStage } from "./stages/DefenderDraftStage";
import { GameplayStage } from "./stages/GameplayStage";

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
  private gameplayStage?: GameplayStage;

  private currentPhase?: string;
  private assignedRole?: PlayerRole;
  private buildingPlaceholder?: Phaser.GameObjects.Text;
  private defenderDeck?: string[];
  private gold?: number;
  private myEconomy?: YouEconomyPayload;

  private unsubscribeRoomListeners: Array<() => void> = [];

  constructor() {
    super("GameScene");
  }

  preload(): void {
    this.load.image("konbaung", "/assets/maps/konbaung.jpg");
    this.load.image("base_castle", "/assets/sprites/base_castle.png");
    this.load.image("tower_archer", "/assets/sprites/tower_archer.png");
    this.load.image("unit_warrior", "/assets/sprites/unit_warrior.png");
    this.load.image("arrow_proj", "/assets/sprites/arrow.png");
    this.load.image("spawn_1", "/assets/sprites/spawn1.png");
    this.load.image("spawn_2", "/assets/sprites/spawn2.png");
    this.load.image("spawn_3", "/assets/sprites/spawn3.png");
    this.load.image("spawn_4", "/assets/sprites/spawn4.png");
    this.load.image("spawn_5", "/assets/sprites/spawn5.png");
    this.load.image("spawn_6", "/assets/sprites/spawn6.png");
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
          this.assignedRole = payload.myRole as PlayerRole;
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

    this.unsubscribeRoomListeners.push(
      room.onMessage(
        MESSAGES.youEconomy,
        (payload: YouEconomyPayload) => {
          console.log("Economy received:", payload);
          this.defenderDeck = payload.deck;
          this.gold = payload.gold;
          this.myEconomy = payload;
          if (this.gameplayStage) {
            this.gameplayStage.applyEconomy(payload);
          }
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
    // was delivered before this scene registered its listener. The Phaser
    // registry seed (assignments sent together with role_assigned) is
    // preferred because the schema patch may arrive a tick later.
    const registryRole = this.registry.get("assignedRole") as PlayerRole | undefined;
    if (registryRole === "attacker" || registryRole === "defender") {
      this.assignedRole = registryRole;
    } else {
      const player = room.state.players.get(room.sessionId);
      if (player?.role === "attacker" || player?.role === "defender") {
        this.assignedRole = player.role;
      }
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
        this.startGameplay();
        break;

      case "combat":
        this.destroyDraftStages();
        if (!this.gameplayStage) {
          this.startGameplay();
        }
        this.startCombat();
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

  private startGameplay(): void {
    if (this.gameplayStage) return;

    const map = MAPS[this.room.state.mapId] ?? KONBAUNG_MAP;
    this.gameplayStage = new GameplayStage(this, {
      room: this.room,
      map,
      role: this.assignedRole ?? "defender",
      economy: this.myEconomy,
      gold: this.gold,
      deck: this.defenderDeck,
    });
    this.gameplayStage.create();
  }

  private startCombat(): void {
    if (!this.gameplayStage) return;
    this.gameplayStage.startCombat();
  }

  /**
   * Releases scene-owned resources without disconnecting Colyseus.
   */
  private cleanup(): void {
    this.destroyDraftStages();
    this.gameplayStage?.destroy();
    this.gameplayStage = undefined;

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
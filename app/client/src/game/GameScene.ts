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
import {
  registerUIFrames,
  registerUIBgFrames,
  UI_TEXTURE_KEY,
  UI_TEXTURE_URL,
  UI_BG_TEXTURE_KEY,
  UI_BG_ATLAS_URL,
} from "./ui/uiAtlas";

import { UnitAnimationManager } from "./animation/UnitAnimationManager";

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
    const centerX = 640;
    const centerY = 360;

    const progressBox = this.add.graphics();
    const progressBar = this.add.graphics();

    progressBox.fillStyle(0x1e1b18, 0.85);
    progressBox.lineStyle(2, 0xc59b27, 1);
    progressBox.strokeRect(centerX - 180, centerY - 14, 360, 28);
    progressBox.fillRect(centerX - 180, centerY - 14, 360, 28);

    const titleText = this.make.text({
      x: centerX,
      y: centerY - 45,
      text: "Entering Royal Battlefield...",
      style: {
        font: "18px 'MedievalSharp', serif",
        color: "#fbbf24",
      },
    }).setOrigin(0.5, 0.5);

    const percentText = this.make.text({
      x: centerX,
      y: centerY + 36,
      text: "0%",
      style: {
        font: "13px 'Almendra', serif",
        color: "#fef3c7",
      },
    }).setOrigin(0.5, 0.5);

    this.load.on("progress", (value: number) => {
      percentText.setText(`${Math.round(value * 100)}%`);
      progressBar.clear();
      progressBar.fillStyle(0x10b981, 1);
      progressBar.fillRect(centerX - 176, centerY - 10, 352 * value, 20);
    });

    this.load.on("complete", () => {
      progressBar.destroy();
      progressBox.destroy();
      titleText.destroy();
      percentText.destroy();
    });

    // 6 Maps
    this.load.image("konbaung", "/assets/maps/map_1_konbaung/map.jpg");
    this.load.image("bagan", "/assets/maps/map_2_bagan/map.jpg");
    this.load.image("inle", "/assets/maps/map_3_inle/map.jpg");
    this.load.image("mandalay", "/assets/maps/map_4_mandalay/map.jpg");
    this.load.image("rakhine", "/assets/maps/map_5_rakhine/map.jpg");
    this.load.image("bago", "/assets/maps/map_6_bago/map.jpg");

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
    this.load.image(UI_TEXTURE_KEY, UI_TEXTURE_URL);
    // UI_bg.json is a TexturePacker multi-pack ("textures" array format);
    // multiatlas() handles that format and resolves the spritesheet from the base path.
    this.load.multiatlas(UI_BG_TEXTURE_KEY, UI_BG_ATLAS_URL, "/assets/ui");

    // Preload unit spritesheets and face icons
    UnitAnimationManager.preload(this);
  }


  create(): void {
    registerUIFrames(this);
    registerUIBgFrames(this);
    UnitAnimationManager.createAnimations(this);

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
      case "mapReveal":
        // The map is shown by a React overlay; clear any draft UI a joiner may
        // have started before the server rolled the reveal into place.
        this.destroyDraftStages();
        break;

      case "drafting":
        // Drafting UI is presented by the React DraftOverlay; keep Phaser canvas clean.
        this.destroyDraftStages();
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

  override update(time: number, delta: number): void {
    this.gameplayStage?.update(time, delta);
  }
}
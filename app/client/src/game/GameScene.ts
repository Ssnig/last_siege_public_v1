import Phaser from "phaser";
import { Room, Callbacks } from "@colyseus/sdk";
import {
  MESSAGES,
  MAPS,
  PROP_CATALOG,
  KONBAUNG_MAP,
  TOWER_DESIGNS,
  type RoleAssignedPayload,
  type YouEconomyPayload,
  type AttackerBufferPayload,
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
import { TowerAnimationManager } from "./animation/TowerAnimationManager";
import { DEFAULT_MAP_ID, MAP_IMAGE_URLS } from "./assetManifest";

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

      const r = (this.registry?.get("room") as Room | undefined) ?? this.room;
      if (r) {
        r.send(MESSAGES.clientAssetsLoaded, {});
      }
    });

    // Default Map (Konbaung) is always loaded and pre-cached
    this.load.image("konbaung", MAP_IMAGE_URLS.konbaung.map);
    this.load.image("base_konbaung", MAP_IMAGE_URLS.konbaung.base);
    this.load.image("base_castle", "/assets/sprites/base_castle.png");

    // Preload match's specific map if it differs from the default map
    const roomRef = (this.registry?.get("room") as Room | undefined) ?? this.room;
    const currentMapId = roomRef?.state?.mapId;
    if (currentMapId && currentMapId !== DEFAULT_MAP_ID && MAP_IMAGE_URLS[currentMapId]) {
      this.load.image(currentMapId, MAP_IMAGE_URLS[currentMapId].map);
      this.load.image(`base_${currentMapId}`, MAP_IMAGE_URLS[currentMapId].base);
    }
    this.load.image("tower_placeholder_1", "/assets/tower_placeholder/tower_placeholder_1.png");
    this.load.image("npc_monk", "/assets/sprites/npc_monk.png");
    this.load.image("unit_warrior", "/assets/sprites/unit_warrior.png");
    this.load.image("arrow_proj", "/assets/sprites/arrow.png");

    // Preload 2.5D isometric scenery props and ambient NPCs
    for (const prop of Object.values(PROP_CATALOG)) {
      this.load.image(`prop_${prop.typeId}`, prop.imageSrc);
    }

    // Preload all 6 custom towers and their projectiles
    for (const design of Object.values(TOWER_DESIGNS)) {
      this.load.image(design.textureKey, design.texturePath);
      this.load.image(design.projectileKey, design.projectilePath);
      // Load tower icon for UI cards
      if ((design as any).iconPath) {
        this.load.image(`tower-${design.id}`, (design as any).iconPath);
      }
    }
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
    TowerAnimationManager.preload(this);
    // Archer projectile & hit VFX - 2 rows x 4 cols (688x768)
    this.load.spritesheet("archer_vfx_sheet", "/assets/towers/01_archer_tower/projectile_vfx.png", { frameWidth: 688, frameHeight: 768 });
    // Bomb projectile & hit VFX - 2 rows x 4 cols (688x768)
    this.load.spritesheet("bomb_vfx_sheet", "/assets/towers/03_bomb_throwing_tower/projectile_vfx.png", { frameWidth: 688, frameHeight: 768 });
    // Spear projectile & hit VFX - 2 rows x 4 cols (688x768)
    this.load.spritesheet("spear_vfx_sheet", "/assets/towers/05_spear_tower/projectile_vfx.png", { frameWidth: 688, frameHeight: 768 });
    // Water cannon projectile/splash
    this.load.spritesheet("water_splash_sheet", "/assets/towers/07_water_cannon/water_splash.png", { frameWidth: 688, frameHeight: 768 });
    // Chinthe attack (whole 8 frames is projectile animation)
    this.load.spritesheet("chinthe_attack_sheet", "/assets/towers/08_chinthe_statue/chinthe_attack.png", { frameWidth: 688, frameHeight: 768 });
    // Dragon attack - 3 rows x 4 cols
    this.load.spritesheet("dragon_attack_sheet", "/assets/towers/09_dragon_tower/dragon_attack.png", { frameWidth: 600, frameHeight: 597 });
    // Sein Pyaung projectile & hit VFX - 2 rows x 4 cols (688x768)
    this.load.spritesheet("sein_pyaung_vfx_sheet", "/assets/towers/10_sein_pyaung/vfx.png", { frameWidth: 688, frameHeight: 768 });
  }


  create(): void {
    registerUIFrames(this);
    registerUIBgFrames(this);
    UnitAnimationManager.createAnimations(this);
    TowerAnimationManager.createAnimations(this);
    // Archer projectile (top row 0..3) and hit VFX (bottom row 4..7)
    if (this.textures.exists("archer_vfx_sheet")) {
      if (!this.anims.exists("archer_proj_anim")) {
        this.anims.create({ key: "archer_proj_anim", frames: this.anims.generateFrameNumbers("archer_vfx_sheet", { start: 0, end: 3 }), frameRate: 12, repeat: -1 });
      }
      if (!this.anims.exists("archer_splash_anim")) {
        this.anims.create({ key: "archer_splash_anim", frames: this.anims.generateFrameNumbers("archer_vfx_sheet", { start: 4, end: 7 }), frameRate: 15, repeat: 0 });
      }
    }
    // Bomb projectile (top row 0..3) and hit VFX (bottom row 4..7)
    if (this.textures.exists("bomb_vfx_sheet")) {
      if (!this.anims.exists("bomb_proj_anim")) {
        this.anims.create({ key: "bomb_proj_anim", frames: this.anims.generateFrameNumbers("bomb_vfx_sheet", { start: 0, end: 3 }), frameRate: 12, repeat: -1 });
      }
      if (!this.anims.exists("bomb_splash_anim")) {
        this.anims.create({ key: "bomb_splash_anim", frames: this.anims.generateFrameNumbers("bomb_vfx_sheet", { start: 4, end: 7 }), frameRate: 15, repeat: 0 });
      }
    }
    // Spear projectile (top row 0..3) and hit VFX (bottom row 4..7)
    if (this.textures.exists("spear_vfx_sheet")) {
      if (!this.anims.exists("spear_proj_anim")) {
        this.anims.create({ key: "spear_proj_anim", frames: this.anims.generateFrameNumbers("spear_vfx_sheet", { start: 0, end: 3 }), frameRate: 12, repeat: -1 });
      }
      if (!this.anims.exists("spear_splash_anim")) {
        this.anims.create({ key: "spear_splash_anim", frames: this.anims.generateFrameNumbers("spear_vfx_sheet", { start: 4, end: 7 }), frameRate: 15, repeat: 0 });
      }
    }
    // Create water splash anims
    if (this.textures.exists("water_splash_sheet")) {
      if (!this.anims.exists("water_proj_anim")) {
        this.anims.create({ key: "water_proj_anim", frames: this.anims.generateFrameNumbers("water_splash_sheet", { start: 0, end: 3 }), frameRate: 12, repeat: -1 });
      }
      if (!this.anims.exists("water_splash_anim")) {
        this.anims.create({ key: "water_splash_anim", frames: this.anims.generateFrameNumbers("water_splash_sheet", { start: 4, end: 7 }), frameRate: 15, repeat: 0 });
      }
    }
    // Chinthe projectile anim - whole 8 frames, slow (half speed)
    if (this.textures.exists("chinthe_attack_sheet")) {
      if (!this.anims.exists("chinthe_proj_anim")) {
        this.anims.create({ key: "chinthe_proj_anim", frames: this.anims.generateFrameNumbers("chinthe_attack_sheet", { start: 0, end: 7 }), frameRate: 6, repeat: -1 });
      }
    }
    // Dragon projectile anim - first row, splash from second/third row
    if (this.textures.exists("dragon_attack_sheet")) {
      if (!this.anims.exists("dragon_proj_anim")) {
        this.anims.create({ key: "dragon_proj_anim", frames: this.anims.generateFrameNumbers("dragon_attack_sheet", { start: 0, end: 3 }), frameRate: 12, repeat: -1 });
      }
      if (!this.anims.exists("dragon_splash_anim")) {
        // second row starts at index 4 (row 1, col 0)
        this.anims.create({ key: "dragon_splash_anim", frames: this.anims.generateFrameNumbers("dragon_attack_sheet", { start: 4, end: 7 }), frameRate: 15, repeat: 0 });
      }
    }
    // Sein Pyaung projectile (top row 0..3) and hit VFX (bottom row 4..7)
    if (this.textures.exists("sein_pyaung_vfx_sheet")) {
      if (!this.anims.exists("sein_pyaung_proj_anim")) {
        this.anims.create({ key: "sein_pyaung_proj_anim", frames: this.anims.generateFrameNumbers("sein_pyaung_vfx_sheet", { start: 0, end: 3 }), frameRate: 12, repeat: -1 });
      }
      if (!this.anims.exists("sein_pyaung_splash_anim")) {
        this.anims.create({ key: "sein_pyaung_splash_anim", frames: this.anims.generateFrameNumbers("sein_pyaung_vfx_sheet", { start: 4, end: 7 }), frameRate: 15, repeat: 0 });
      }
    }

    const room = this.registry.get("room") as Room | undefined;

    if (!room) {
      console.error("[GameScene] No Colyseus room in registry.");
      return;
    }

    this.room = room;
    try {
      this.room.send(MESSAGES.clientAssetsLoaded, {});
    } catch {
      // Room socket may still be handshaking
    }

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
          if (this.gameplayStage) {
            this.gameplayStage.setRole(this.assignedRole);
          }
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

    // Attacker-only: the deploy buffer + portal charges, used to light the
    // portals so a push can be launched straight from the map.
    this.unsubscribeRoomListeners.push(
      room.onMessage(
        MESSAGES.attackerBuffer,
        (payload: AttackerBufferPayload) => {
          this.gameplayStage?.applyAttackerBuffer(payload);
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
      this.game?.events.emit("scene-shutdown");
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
    this.game?.events.emit("scene-ready");
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
        this.destroyGameplayStage();
        break;

      case "drafting":
        // Drafting UI is presented by the React DraftOverlay; keep Phaser canvas clean.
        this.destroyDraftStages();
        this.destroyGameplayStage();
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

  /** Destroys the active gameplay stage when returning to draft or reveal. */
  private destroyGameplayStage(): void {
    this.gameplayStage?.destroy();
    this.gameplayStage = undefined;
  }

  /** Externally updates or synchronizes the player's role with GameplayStage. */
  public setAssignedRole(role: PlayerRole): void {
    this.assignedRole = role;
    if (this.gameplayStage) {
      this.gameplayStage.setRole(role);
    }
  }

  private startGameplay(): void {
    if (this.gameplayStage) return;

    const stateRole = this.room?.state?.players?.get(this.room?.sessionId)?.role as PlayerRole | undefined;
    const effectiveRole =
      this.assignedRole ||
      (stateRole === "attacker" || stateRole === "defender" ? stateRole : undefined) ||
      "defender";

    const map = MAPS[this.room.state.mapId] ?? KONBAUNG_MAP;
    this.gameplayStage = new GameplayStage(this, {
      room: this.room,
      map,
      role: effectiveRole,
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

  /**
   * Hit-tests the on-map portals against a page-space point.
   *
   * @remarks Called from the React deploy bar while dragging a unit: the drag
   * captures the pointer, so Phaser's own input never sees it. Converts the
   * page coordinate back into the game's 1280x720 space, then to world space
   * through the live camera (which may be panned or zoomed).
   *
   * @param pageX - Pointer x in CSS pixels, relative to the page.
   * @param pageY - Pointer y in CSS pixels, relative to the page.
   * @returns The portal id under the point, or `null`.
   */
  portalAtPage(pageX: number, pageY: number): string | null {
    if (!this.gameplayStage) return null;

    const rect = this.game.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const gameX = (pageX - rect.left) * (this.scale.width / rect.width);
    const gameY = (pageY - rect.top) * (this.scale.height / rect.height);
    const world = this.cameras.main.getWorldPoint(gameX, gameY);

    return this.gameplayStage.portalAtWorld(world.x, world.y);
  }

  /** Highlights (or clears) an on-map portal for the deploy drag. */
  setPortalHover(portalId: string | null): void {
    this.gameplayStage?.setPortalHover(portalId);
  }

  override update(time: number, delta: number): void {
    this.gameplayStage?.update(time, delta);
  }
}
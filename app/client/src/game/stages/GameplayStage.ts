import Phaser from "phaser";
import { Callbacks, Room } from "@colyseus/sdk";
import {
  MESSAGES,
  samplePath,
  samplePathWithLateral,
  type MapDefinition,
  type Mob,
  type Tower,
  type Vec2,
  type YouEconomyPayload,
  TOWER_TYPES,
} from "@root/shared";
import { UIButton } from "../ui/UIButton";
import { TowerCard } from "../ui/TowerCard";
import {
  UI_ASPECT,
  UI_BG_ASPECT,
  UI_BG_FRAMES,
  UI_BG_TEXTURE_KEY,
  UI_TEXTURE_KEY,
} from "../ui/uiAtlas";

/** Render order for the gameplay layers. */
export const DEPTH = {
  MAP_BG: 0,
  PATH_LAYER: 1,
  SLOTS_LAYER: 2,
  PORTAL_LAYER: 4,
  BASE_LAYER: 5,
  UNITS_LAYER: 10,
  TOWERS_LAYER: 15,
  PROJECTILES_LAYER: 20,
  UI_LAYER: 30,
} as const;

export interface GameplayStageOptions {
  room: Room;
  map: MapDefinition;
  role: "attacker" | "defender";
  economy?: YouEconomyPayload;
  gold?: number;
  deck?: string[];
}

type TowerSlot = { slotIndex: number; x: number; y: number };

/**
 * Renders the map (background, mob paths, tower slots, base, portals) once the draft
 * ends, plus the defender's build UI. `RoomState.towers` is the single source
 * of truth: placements round-trip through the server and render on `onAdd`.
 */
export class GameplayStage {
  private scene: Phaser.Scene;
  private room: Room;
  private map: MapDefinition;
  private role: "attacker" | "defender";

  private root?: Phaser.GameObjects.Container;
  private uiRoot?: Phaser.GameObjects.Container;
  private paths: Phaser.Curves.Path[] = [];
  private topPath?: Phaser.Curves.Path;
  private bottomPath?: Phaser.Curves.Path;
  private towers: Map<number, Phaser.GameObjects.Sprite> = new Map();
  private mobSprites: Map<Mob, Phaser.GameObjects.Sprite> = new Map();

  private gold = 200;
  private deck: string[] = [];
  private selectedTowerType?: string;

  private deckCards: Map<string, TowerCard> = new Map();
  private deckObjects: Phaser.GameObjects.GameObject[] = [];
  private deckLayoutWidth = 0;
  private ghostTower?: Phaser.GameObjects.Sprite;
  private phaseBanner?: Phaser.GameObjects.Container;
  private goldText?: Phaser.GameObjects.Text;
  private goldFrame?: Phaser.GameObjects.Image;
  private startButton?: UIButton;
  private topPortal?: Phaser.GameObjects.Sprite;
  private bottomPortal?: Phaser.GameObjects.Sprite;

  private debugGraphics?: Phaser.GameObjects.Graphics;
  private showDebug = false;
  private onKeyDown?: (event: KeyboardEvent) => void;
  private onPointerDown?: (pointer: Phaser.Input.Pointer) => void;

  private unsubscribers: Array<() => void> = [];
  private combatStarted = false;
  private destroyed = false;

  /** Re-positions every mob sprite from authoritative `progress` each frame. */
  private onSceneUpdate = (): void => {
    this.updateMobs();
  };

  constructor(
    scene: Phaser.Scene,
    optionsOrMap: GameplayStageOptions | MapDefinition,
    defenderDeck?: string[],
    room?: any,
    gold?: number,
    myRole?: "attacker" | "defender",
  ) {
    this.scene = scene;

    if ("room" in optionsOrMap) {
      this.room = optionsOrMap.room;
      this.map = optionsOrMap.map;
      this.role = optionsOrMap.role;
      if (optionsOrMap.economy) {
        this.gold = optionsOrMap.economy.gold;
        this.deck = optionsOrMap.economy.deck;
      } else {
        this.gold = optionsOrMap.gold ?? 200;
        this.deck = optionsOrMap.deck ?? [];
      }
    } else {
      this.map = optionsOrMap;
      this.deck = defenderDeck ?? [];
      this.room = room;
      this.gold = gold ?? 200;
      this.role = myRole ?? "defender";
    }

    if (this.deck.length > 0) {
      this.selectedTowerType = this.deck[0];
    }
  }

  create(): void {
    this.render();

    // A dedicated top-level container keeps every HUD element above the world
    // (map, units, towers). Child depth inside a single container is ignored,
    // so a separate container with a higher scene depth is required.
    this.uiRoot = this.scene.add.container(0, 0).setDepth(DEPTH.UI_LAYER);

    this.setupPortals();
    this.setupDebugControls();

    if (this.role === "defender") {
      this.renderTowerDeck();
      this.renderStartButton();
      this.renderGoldIndicator();
    }
    this.renderPhaseBanner();
    this.setupTowerSync();
    this.setupMobSync();
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.onSceneUpdate);
  }

  /**
   * Applies an economy push from the server.
   */
  applyEconomy(payload: YouEconomyPayload): void {
    this.gold = payload.gold;
    if (payload.deck && payload.deck.length > 0) {
      this.deck = payload.deck;
      if (!this.selectedTowerType) {
        this.selectedTowerType = this.deck[0];
      }
    }

    this.refreshGold();

    if (
      this.role === "defender" &&
      this.deckCards.size === 0 &&
      this.deck.length > 0
    ) {
      this.renderTowerDeck();
    }
  }

  updateEconomy(gold: number, deck?: string[]): void {
    this.applyEconomy({
      gold,
      deck: deck ?? this.deck,
      bigWavesRemaining: 0,
    });
  }

  private refreshGold(): void {
    if (this.goldText) {
      this.goldText.setText(`${this.gold}`);
    }
  }

  private setupPortals(): void {
    if (!this.scene.anims.exists("portal_spin")) {
      this.scene.anims.create({
        key: "portal_spin",
        frames: [
          { key: "spawn_2" },
          { key: "spawn_3" },
          { key: "spawn_4" },
          { key: "spawn_5" },
          { key: "spawn_6" },
        ],
        frameRate: 6,
        repeat: -1,
        yoyo: true,
      });
    }

    // Top path portal at { x: 52, y: 112 }
    this.topPortal = this.scene.add
      .sprite(52, 112, "spawn_2")
      .setOrigin(0.5, 0.72)
      .setDisplaySize(130, 130)
      .setDepth(DEPTH.PORTAL_LAYER + 112 * 0.001)
      .play("portal_spin");
    this.root?.add(this.topPortal);

    // Bottom path portal at { x: 52, y: 583 }
    this.bottomPortal = this.scene.add
      .sprite(52, 583, "spawn_2")
      .setOrigin(0.5, 0.72)
      .setDisplaySize(130, 130)
      .setDepth(DEPTH.PORTAL_LAYER + 583 * 0.001)
      .play("portal_spin");
    this.root?.add(this.bottomPortal);
  }

  private render(): void {
    this.root?.destroy(true);
    this.root = this.scene.add.container(0, 0);

    // Load and render map background
    if (this.map.id === "konbaung") {
      const bg = this.scene.add
        .image(0, 0, "konbaung")
        .setOrigin(0, 0)
        .setDisplaySize(this.map.width || 1280, this.map.height || 720)
        .setDepth(DEPTH.MAP_BG);
      this.root.add(bg);
    }

    // Create path curves
    this.paths = [];
    if (this.map.paths?.top && this.map.paths.top.length > 0) {
      this.topPath = new Phaser.Curves.Path(
        this.map.paths.top[0].x,
        this.map.paths.top[0].y,
      );
      for (let i = 1; i < this.map.paths.top.length; i++) {
        this.topPath.lineTo(this.map.paths.top[i].x, this.map.paths.top[i].y);
      }
      this.paths.push(this.topPath);
    }
    if (this.map.paths?.bottom && this.map.paths.bottom.length > 0) {
      this.bottomPath = new Phaser.Curves.Path(
        this.map.paths.bottom[0].x,
        this.map.paths.bottom[0].y,
      );
      for (let i = 1; i < this.map.paths.bottom.length; i++) {
        this.bottomPath.lineTo(
          this.map.paths.bottom[i].x,
          this.map.paths.bottom[i].y,
        );
      }
      this.paths.push(this.bottomPath);
    }
    if (this.paths.length === 0 && this.map.path && this.map.path.length > 0) {
      const singlePath = new Phaser.Curves.Path(
        this.map.path[0].x,
        this.map.path[0].y,
      );
      for (let i = 1; i < this.map.path.length; i++) {
        singlePath.lineTo(this.map.path[i].x, this.map.path[i].y);
      }
      this.paths.push(singlePath);
    }

    // Render interactive tower slots (radius 36)
    this.map.slots.forEach((slot) => {
      const placeholder = this.scene.add
        .circle(slot.x, slot.y, 36, 0x8b4513, 0.5)
        .setDepth(DEPTH.SLOTS_LAYER);

      if (this.role === "defender") {
        placeholder.setInteractive({ useHandCursor: true });

        placeholder.on("pointerover", () => {
          if (!this.towers.has(slot.slotIndex)) {
            placeholder.setFillStyle(0xd2691e, 0.7);
            this.showGhostTower(slot);
          }
        });
        placeholder.on("pointerout", () => {
          placeholder.setFillStyle(0x8b4513, 0.5);
          this.hideGhostTower();
        });
        placeholder.on("pointerdown", () => this.handleSlotClick(slot));
      }

      this.root?.add(placeholder);
    });

    // Render base castle and floating HP bar
    if (this.map.base && this.map.id === "konbaung") {
      const baseCastle = this.scene.add
        .sprite(this.map.base.x, this.map.base.y, "base_castle")
        .setOrigin(0.5, 0.5)
        .setDisplaySize(280, 280)
        .setDepth(DEPTH.BASE_LAYER);
      this.root.add(baseCastle);

      // Floating HP bar above castle
      const hpBarWidth = 120;
      const hpBarHeight = 10;
      const hpBarX = this.map.base.x;
      const hpBarY = this.map.base.y - 150;

      const hpBarBorder = this.scene.add
        .rectangle(hpBarX, hpBarY, hpBarWidth + 4, hpBarHeight + 4, 0x0f172a, 0.8)
        .setOrigin(0.5)
        .setStrokeStyle(1, 0x334155)
        .setDepth(DEPTH.BASE_LAYER + 0.1);

      const hpBarBg = this.scene.add
        .rectangle(hpBarX, hpBarY, hpBarWidth, hpBarHeight, 0x1e293b)
        .setOrigin(0.5)
        .setDepth(DEPTH.BASE_LAYER + 0.2);

      const hpBarFill = this.scene.add
        .rectangle(hpBarX - hpBarWidth / 2, hpBarY, hpBarWidth, hpBarHeight, 0x22c55e)
        .setOrigin(0, 0.5)
        .setDepth(DEPTH.BASE_LAYER + 0.3);

      const hpText = this.scene.add
        .text(hpBarX, hpBarY - 14, "BASE CASTLE: 10/10 HP", {
          fontSize: "11px",
          color: "#f8fafc",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.BASE_LAYER + 0.4);

      this.root.add([hpBarBorder, hpBarBg, hpBarFill, hpText]);
    } else if (this.map.base) {
      const base = this.scene.add
        .circle(this.map.base.x, this.map.base.y, 50, 0xff0000, 0.3)
        .setDepth(DEPTH.BASE_LAYER);
      this.root.add(base);
    }
  }

  private setupDebugControls(): void {
    this.onKeyDown = () => {
      this.showDebug = !this.showDebug;
      this.toggleDebugGraphics();
    };
    this.scene.input.keyboard?.on("keydown-D", this.onKeyDown);

    this.onPointerDown = (pointer: Phaser.Input.Pointer) => {
      if (this.showDebug) {
        console.log(
          `{ x: ${Math.round(pointer.worldX)}, y: ${Math.round(pointer.worldY)} }`,
        );
      }
    };
    this.scene.input.on("pointerdown", this.onPointerDown);
  }

  private toggleDebugGraphics(): void {
    this.debugGraphics?.destroy();
    this.debugGraphics = undefined;

    if (!this.showDebug) return;

    this.debugGraphics = this.scene.add.graphics();
    this.debugGraphics.setDepth(DEPTH.PATH_LAYER);

    for (const path of this.paths) {
      this.debugGraphics.lineStyle(3, 0x22c55e, 0.7);
      path.draw(this.debugGraphics);
    }
  }

  private handleSlotClick(slot: TowerSlot): void {
    if (this.towers.has(slot.slotIndex)) {
      console.log(`Slot ${slot.slotIndex} already occupied`);
      return;
    }
    if (!this.selectedTowerType) {
      console.log("No tower type selected");
      return;
    }

    const towerType = TOWER_TYPES[this.selectedTowerType];
    const cost = towerType?.tiers[0]?.cost ?? 0;
    if (this.gold < cost) {
      console.log(`Not enough gold: need ${cost}, have ${this.gold}`);
      return;
    }

    this.hideGhostTower();

    console.log(
      `Sending place_tower for slot ${slot.slotIndex}, type: ${this.selectedTowerType}`,
    );
    this.room.send(MESSAGES.placeTower, {
      typeId: this.selectedTowerType,
      slotIndex: slot.slotIndex,
    });
  }

  private renderTowerDeck(): void {
    if (!this.deck || this.deck.length === 0) return;

    for (const obj of this.deckObjects) obj.destroy();
    this.deckObjects = [];
    this.deckCards.clear();

    const deckX = 24;
    const cardWidth = 64;
    const cardHeight = cardWidth / 0.72;
    const gap = 12;
    const topY = 616;

    if (!this.selectedTowerType && this.deck.length > 0) {
      this.selectedTowerType = this.deck[0];
    }

    let placed = 0;
    this.deck.forEach((towerId) => {
      const tower = TOWER_TYPES[towerId];
      if (!tower) return;

      const x = deckX + placed * (cardWidth + gap);

      const tierCost = tower.tiers[0]?.cost ?? 0;
      const card = new TowerCard(
        this.scene,
        x,
        topY,
        cardWidth,
        cardHeight,
        tower,
        (selected) => this.selectDeckTower(selected.id),
        undefined,
        { label: `${tierCost}g` },
      );

      this.deckCards.set(towerId, card);
      this.deckObjects.push(card.container);
      this.uiRoot?.add(card.container);

      placed += 1;
    });

    this.deckLayoutWidth = placed * cardWidth + Math.max(0, placed - 1) * gap;
    this.updateDeckCardStyles();
    this.layoutGoldIndicator();
  }

  private selectDeckTower(towerId: string): void {
    this.selectedTowerType = towerId;
    this.updateDeckCardStyles();
  }

  private renderStartButton(): void {
    const buttonWidth = 150;
    const buttonHeight = buttonWidth / UI_ASPECT.button;

    this.startButton = new UIButton({
      scene: this.scene,
      x: 1150,
      y: 48,
      width: buttonWidth,
      height: buttonHeight,
      label: "START GAME",
      fontSize: 15,
      onClick: () => this.room.send(MESSAGES.startCombat, {}),
    });

    this.startButton.container.setDepth(DEPTH.UI_LAYER);
    this.uiRoot?.add(this.startButton.container);
  }

  /**
   * Renders the defender's gold readout, placed beside the tower deck.
   *
   * @remarks The coin emblem sits on the left of the frame, so the numeric
   * label is centered on the remaining width.
   */
  private renderGoldIndicator(): void {
    const width = 190;
    const height = width / UI_ASPECT.gold;

    this.goldFrame = this.scene.add
      .image(0, 0, UI_TEXTURE_KEY, "gold")
      .setDisplaySize(width, height)
      .setDepth(DEPTH.UI_LAYER);

    this.goldText = this.scene.add
      .text(0, 0, `${this.gold}`, {
        fontSize: "15px",
        color: "#fde68a",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI_LAYER);

    this.uiRoot?.add([this.goldFrame, this.goldText]);
    this.layoutGoldIndicator();
  }

  /**
   * Anchors the gold readout to the right of the tower deck.
   *
   * @remarks Called again whenever the deck is (re)built so the indicator
   * tracks a deck that arrives after creation.
   */
  private layoutGoldIndicator(): void {
    if (!this.goldFrame || !this.goldText) return;

    const width = this.goldFrame.displayWidth;
    const x = 24 + this.deckLayoutWidth + 24 + width / 2;
    const y = 660;

    this.goldFrame.setPosition(x, y);
    this.goldText.setPosition(x + width * 0.08, y);
  }

  private updateDeckCardStyles(): void {
    this.deckCards.forEach((card, towerId) => {
      card.setSelected(this.selectedTowerType === towerId);
    });
  }

  private showGhostTower(slot: TowerSlot): void {
    if (!this.selectedTowerType) return;
    this.hideGhostTower();

    this.ghostTower = this.scene.add
      .sprite(slot.x, slot.y, "tower_archer")
      .setOrigin(0.5, 0.82)
      .setDisplaySize(135, 135)
      .setAlpha(0.5)
      .setDepth(DEPTH.TOWERS_LAYER + slot.y * 0.001);

    this.root?.add(this.ghostTower);
  }

  private hideGhostTower(): void {
    this.ghostTower?.destroy();
    this.ghostTower = undefined;
  }

  private renderPhaseBanner(): void {
    const bannerX = 640;
    const bannerY = 108;
    const bannerWidth = 360;
    const bannerHeight = bannerWidth / UI_BG_ASPECT.notification1;

    const bannerText =
      this.role === "defender"
        ? "BUILDING PHASE — Place Your Towers"
        : "BUILDING PHASE — Defender is setting up defenses";

    this.phaseBanner = this.scene.add.container(bannerX, bannerY);

    const bg = this.scene.add
      .image(0, 0, UI_BG_TEXTURE_KEY, UI_BG_FRAMES.notification1)
      .setDisplaySize(bannerWidth, bannerHeight);

    const text = this.scene.add
      .text(0, 4, bannerText, {
        fontSize: "14px",
        color: "#3a2412",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: bannerWidth * 0.72 },
      })
      .setOrigin(0.5);

    this.phaseBanner.add([bg, text]);
    this.phaseBanner.setDepth(DEPTH.UI_LAYER);
    this.uiRoot?.add(this.phaseBanner);
  }

  /**
   * Mirrors `RoomState.towers` into sprites for both players using Colyseus Callbacks.
   */
  private setupTowerSync(): void {
    if (!this.room) return;

    const callbacks = Callbacks.get(this.room);

    const onAdd = (value: unknown): void => {
      const tower = value as Tower;
      const slot = this.map.slots.find((s) => s.slotIndex === tower.slotIndex);
      if (slot) {
        this.renderTower(slot);
      }
    };

    const onRemove = (value: unknown): void => {
      const tower = value as Tower;
      const slot = this.map.slots.find((s) => s.slotIndex === tower.slotIndex);
      if (!slot) return;
      this.towers.get(slot.slotIndex)?.destroy();
      this.towers.delete(slot.slotIndex);
    };

    // Third parameter `true` immediately calls onAdd for all existing towers in state
    this.unsubscribers.push(callbacks.onAdd("towers", onAdd, true));
    this.unsubscribers.push(callbacks.onRemove("towers", onRemove));
  }

  private renderTower(slot: TowerSlot): void {
    if (this.towers.has(slot.slotIndex)) return;

    const sprite = this.scene.add
      .sprite(slot.x, slot.y, "tower_archer")
      .setOrigin(0.5, 0.82)
      .setDisplaySize(135, 135)
      .setDepth(DEPTH.TOWERS_LAYER + slot.y * 0.001);

    this.towers.set(slot.slotIndex, sprite);
    this.root?.add(sprite);
  }

  startCombat(): void {
    if (this.combatStarted || this.destroyed) return;
    this.combatStarted = true;

    this.phaseBanner?.destroy();
    this.phaseBanner = undefined;
    this.startButton?.destroy();
    this.startButton = undefined;

    // Show combat alert banner
    const bannerWidth = 400;
    const bannerHeight = bannerWidth / UI_BG_ASPECT.notification2;
    const banner = this.scene.add.container(640, 108);
    const bg = this.scene.add
      .image(0, 0, UI_BG_TEXTURE_KEY, UI_BG_FRAMES.notification2)
      .setDisplaySize(bannerWidth, bannerHeight);
    const txt = this.scene.add
      .text(0, 4, "⚔️ COMBAT PHASE — Units Advancing!", {
        fontSize: "14px",
        color: "#f8fafc",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: bannerWidth * 0.72 },
      })
      .setOrigin(0.5);
    banner.add([bg, txt]);
    banner.setDepth(DEPTH.UI_LAYER);
    this.uiRoot?.add(banner);

    this.scene.time.delayedCall(4000, () => {
      banner.destroy();
    });
  }

  /**
   * Mirrors `RoomState.mobs` into sprites using Colyseus Callbacks.
   *
   * @remarks Positions are not synced; each frame the sprite is placed from the
   * mob's authoritative `progress` via {@link updateMobSprite}, so the server
   * stays the single source of truth for movement.
   */
  private setupMobSync(): void {
    if (!this.room) return;

    const callbacks = Callbacks.get(this.room);

    const onAdd = (value: unknown): void => {
      const mob = value as Mob;
      const sprite = this.scene.add
        .sprite(0, 0, "unit_warrior")
        .setOrigin(0.5, 0.78)
        .setDisplaySize(64, 64)
        .setDepth(DEPTH.UNITS_LAYER);

      this.mobSprites.set(mob, sprite);
      this.root?.add(sprite);
      this.updateMobSprite(mob, sprite);
    };

    const onRemove = (value: unknown): void => {
      const sprite = this.mobSprites.get(value as Mob);
      if (!sprite) return;
      sprite.destroy();
      this.mobSprites.delete(value as Mob);
    };

    // Third parameter `true` immediately renders mobs already present in state.
    this.unsubscribers.push(callbacks.onAdd("mobs", onAdd, true));
    this.unsubscribers.push(callbacks.onRemove("mobs", onRemove));
  }

  /** Per-frame pass repositioning every tracked mob sprite. */
  private updateMobs(): void {
    if (this.destroyed || this.mobSprites.size === 0) return;
    this.mobSprites.forEach((sprite, mob) => this.updateMobSprite(mob, sprite));
  }

  /** Places one sprite on the wavy path position derived from its progress. */
  private updateMobSprite(mob: Mob, sprite: Phaser.GameObjects.Sprite): void {
    const path = this.pathFor(mob.pathId);
    if (!path || path.length < 2) return;

    const halfWidth = this.map.pathHalfWidth ?? 0;
    const point = samplePathWithLateral(path, mob.progress, mob.seed, halfWidth);

    sprite.setPosition(point.x, point.y);
    sprite.setDepth(DEPTH.UNITS_LAYER + point.y * 0.001);

    // Face the direction of travel (art is a side-view sprite, so flip, not rotate).
    const ahead = samplePath(path, Math.min(1, mob.progress + 0.02));
    const dx = ahead.x - point.x;
    if (Math.abs(dx) > 0.5) sprite.setFlipX(dx < 0);
  }

  /** Resolves a mob's `pathId` against the map's tracks. */
  private pathFor(pathId: string): Vec2[] | undefined {
    if (pathId === "top") return this.map.paths?.top;
    if (pathId === "bottom") return this.map.paths?.bottom;
    return this.map.path;
  }

  destroy(): void {
    this.destroyed = true;
    this.combatStarted = false;

    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onSceneUpdate);

    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];

    for (const sprite of this.mobSprites.values()) sprite.destroy();
    this.mobSprites.clear();

    if (this.onKeyDown) {
      this.scene.input.keyboard?.off("keydown-D", this.onKeyDown);
    }
    if (this.onPointerDown) {
      this.scene.input.off("pointerdown", this.onPointerDown);
    }
    this.onKeyDown = undefined;
    this.onPointerDown = undefined;

    this.debugGraphics?.destroy();
    this.debugGraphics = undefined;

    this.topPortal?.destroy();
    this.bottomPortal?.destroy();
    this.phaseBanner?.destroy();
    this.startButton?.destroy();
    this.goldFrame = undefined;
    this.goldText = undefined;

    for (const obj of this.deckObjects) obj.destroy();
    this.deckObjects = [];

    this.uiRoot?.destroy(true);
    this.uiRoot = undefined;

    this.root?.destroy(true);
    this.root = undefined;

    this.towers.clear();
    this.deckCards.clear();
  }
}

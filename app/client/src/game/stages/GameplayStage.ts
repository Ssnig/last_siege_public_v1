import Phaser from "phaser";
import { Callbacks, Room } from "@colyseus/sdk";
import {
  MESSAGES,
  samplePath,
  samplePathWithLateral,
  type MapDefinition,
  type Mob,
  type Projectile,
  type Tower,
  type Vec2,
  type YouEconomyPayload,
  TOWER_TYPES,
  MATCH_RULES,
  sellRefund,
  upgradeCost,
  tierAt,
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

export const MIN_CAMERA_ZOOM = 1.0;
export const MAX_CAMERA_ZOOM = 1.6;

export interface GameplayStageOptions {
  room: Room;
  map: MapDefinition;
  role: "attacker" | "defender";
  economy?: YouEconomyPayload;
  gold?: number;
  deck?: string[];
}

type TowerSlot = { slotIndex: number; x: number; y: number };

/** A placed tower: its server id, schema record, and rendered sprite. */
type TowerRecord = {
  id: string;
  tower: Tower;
  sprite: Phaser.GameObjects.Sprite;
  levelBadge?: Phaser.GameObjects.Container;
};

/** A mob and the sprites that render it: body plus its health bar. */
type MobRecord = {
  sprite: Phaser.GameObjects.Sprite;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
};

/** Mob health-bar geometry, in world px. */
const MOB_HP_BAR = {
  width: 44,
  height: 6,
  offsetY: -46,
} as const;

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
  private towers: Map<number, TowerRecord> = new Map();
  private mobSprites: Map<Mob, MobRecord> = new Map();
  private projectileSprites: Map<Projectile, Phaser.GameObjects.Sprite> = new Map();

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
  private combatBanner?: Phaser.GameObjects.Container;

  private baseHpFill?: Phaser.GameObjects.Rectangle;
  private baseHpText?: Phaser.GameObjects.Text;
  private baseHpBarWidth = 120;

  private selectedSlotIndex?: number;
  private rangeCircle?: Phaser.GameObjects.Arc;
  private actionButton?: UIButton;
  private upgradeButton?: UIButton;
  private sellButton?: UIButton;
  private towerInfoPanel?: Phaser.GameObjects.Container;
  private pendingBuild?: TowerSlot;
  private buildHighlight?: Phaser.GameObjects.Arc;

  private debugGraphics?: Phaser.GameObjects.Graphics;
  private showDebug = false;
  private onKeyDown?: (event: KeyboardEvent) => void;
  private onPointerDown?: (pointer: Phaser.Input.Pointer) => void;

  // Camera Drag, Pinch-to-Zoom & Momentum Properties
  private isDragging = false;
  private isPinching = false;
  private initialPinchDistance = 0;
  private initialZoom = 1;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private cameraVelocityX = 0;
  private cameraVelocityY = 0;
  private isTouchingSlot = false;
  private onCameraPointerDown?: (pointer: Phaser.Input.Pointer) => void;
  private onCameraPointerMove?: (pointer: Phaser.Input.Pointer) => void;
  private onCameraPointerUp?: () => void;
  private onCameraWheel?: (pointer: any, gameObjects: any, deltaX: number, deltaY: number) => void;

  private unsubscribers: Array<() => void> = [];
  private combatStarted = false;
  private destroyed = false;

  /** Re-positions every mob and projectile sprite from authoritative state. */
  private onSceneUpdate = (): void => {
    this.updateMobs();
    this.updateProjectiles();
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
    } else {
      this.selectedTowerType = "basic";
    }
  }

  create(): void {
    this.render();

    // A dedicated top-level container keeps every HUD element above the world
    // (map, units, towers). Child depth inside a single container is ignored,
    // so a separate container with a higher scene depth is required.
    this.uiRoot = this.scene.add.container(0, 0).setDepth(DEPTH.UI_LAYER);

    this.setupPortals();
    this.setupCameraControls();
    this.setupDebugControls();

    if (this.role === "defender") {
      this.renderTowerDeck();
      this.renderStartButton();
      this.renderGoldIndicator();
    }
    this.renderPhaseBanner();
    this.setupTowerSync();
    this.setupMobSync();
    this.setupProjectileSync();
    this.setupBaseHpSync();
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.onSceneUpdate);

    // Canvas UI is kept for fallback, but hidden while React GameHUD is mounted
    this.uiRoot.setVisible(false);
  }

  /**
   * Applies an economy push from the server.
   */
  applyEconomy(payload: YouEconomyPayload): void {
    this.gold = payload.gold;
    this.refreshGold();
    if (payload.deck && payload.deck.length > 0) {
      this.deck = payload.deck;
      if (!this.selectedTowerType) {
        this.selectedTowerType = this.deck[0];
      }
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
    if (this.selectedSlotIndex !== undefined) {
      const record = this.towers.get(this.selectedSlotIndex);
      const slot = this.map.slots.find((s) => s.slotIndex === this.selectedSlotIndex);
      if (record && slot) {
        this.refreshTowerSelection(slot, record);
      }
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

    // A full-map hit area behind everything clears the current selection and
    // cancels any pending build/sale when the defender clicks empty ground.
    // Interactive objects added later (slots, towers, HUD) sit above it and win
    // Phaser's top-only hit test.
    if (this.role === "defender") {
      const zoneWidth = this.map.width || 1280;
      const zoneHeight = this.map.height || 720;
      const deselectZone = this.scene.add
        .zone(0, 0, zoneWidth, zoneHeight)
        .setOrigin(0, 0)
        .setInteractive(
          new Phaser.Geom.Rectangle(0, 0, zoneWidth, zoneHeight),
          Phaser.Geom.Rectangle.Contains,
        );
      deselectZone.on("pointerdown", () => this.clearSelection());
      this.root.add(deselectZone);
    }

    // Load and render map background
    // Load and render map background (1280x720 at 0,0 aligning with slots, paths, portals, and base)
    if (this.map.id === "konbaung") {
      const bg = this.scene.add
        .image(0, 0, "konbaung")
        .setOrigin(0, 0)
        .setDisplaySize(1280, 720)
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
        placeholder.on(
          "pointerdown",
          (
            _pointer: Phaser.Input.Pointer,
            _localX: number,
            _localY: number,
            event: Phaser.Types.Input.EventData,
          ) => {
            event?.stopPropagation();
            this.isTouchingSlot = true;
            this.handleSlotClick(slot);
          },
        );
        placeholder.on("pointerup", () => {
          this.isTouchingSlot = false;
        });
      }

      this.root?.add(placeholder);
    });

    // Render base castle sprite (HP is integrated into React HUD)
    if (this.map.base && this.map.id === "konbaung") {
      const baseCastle = this.scene.add
        .sprite(this.map.base.x, this.map.base.y, "base_castle")
        .setOrigin(0.5, 0.5)
        .setDisplaySize(260, 260)
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
        .text(hpBarX, hpBarY - 14, `BASE CASTLE: ${MATCH_RULES.coreHp}/${MATCH_RULES.coreHp} HP`, {
          fontSize: "11px",
          color: "#f8fafc",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.BASE_LAYER + 0.4);

      this.baseHpFill = hpBarFill;
      this.baseHpText = hpText;
      this.baseHpBarWidth = hpBarWidth;

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

  private getActiveTowerType(): string | undefined {
    return (
      (this.scene.game.registry.get("selectedTowerType") as string | undefined) ||
      this.selectedTowerType ||
      (this.deck.length > 0 ? this.deck[0] : "basic")
    );
  }

  private handleSlotClick(slot: TowerSlot): void {
    const existing = this.towers.get(slot.slotIndex);
    if (existing) {
      this.selectTower(slot, existing);
      return;
    }

    // Tapping the already highlighted/pending slot confirms build directly
    if (this.pendingBuild?.slotIndex === slot.slotIndex) {
      this.confirmBuild();
      return;
    }

    const typeId = this.getActiveTowerType();
    if (!typeId) {
      console.log("No tower type selected");
      return;
    }

    const towerType = TOWER_TYPES[typeId];
    const cost = towerType?.tiers[0]?.cost ?? 0;
    if (!towerType || this.gold < cost) {
      console.log(`Not enough gold: need ${cost}, have ${this.gold}`);
      return;
    }

    this.requestBuild(slot);
  }

  /**
   * Arms a pending build on an empty slot and shows a confirm button.
   *
   * @remarks Tapping the ✓ BUILD button or tapping the slot a second time confirms.
   * Clicking elsewhere deselects via clearSelection.
   */
  private requestBuild(slot: TowerSlot): void {
    this.clearSelection();
    this.hideGhostTower();
    this.pendingBuild = slot;

    this.buildHighlight = this.scene.add
      .circle(slot.x, slot.y, 40, 0x22c55e, 0.15)
      .setStrokeStyle(3, 0x22c55e, 0.9);
    this.root?.add(this.buildHighlight);

    const typeId = this.getActiveTowerType();
    const towerType = typeId ? TOWER_TYPES[typeId] : undefined;
    const cost = towerType?.tiers[0]?.cost ?? 50;

    this.actionButton = this.createActionButton(
      slot,
      `✓ BUILD ${cost}g`,
      true,
      () => this.confirmBuild(),
    );
  }

  /** Sends the pending placement once the defender confirms it. */
  private confirmBuild(): void {
    const slot = this.pendingBuild;
    const typeId =
      this.getActiveTowerType() || this.selectedTowerType || "basic";
    if (!slot || !typeId) {
      this.clearSelection();
      return;
    }

    const towerType = TOWER_TYPES[typeId];
    const cost = towerType?.tiers[0]?.cost ?? 0;
    if (!towerType || this.gold < cost) {
      console.log("Build cancelled: type unavailable or insufficient gold");
      this.clearSelection();
      return;
    }

    console.log(
      `Sending place_tower for slot ${slot.slotIndex}, type: ${typeId}`,
    );
    this.room.send(MESSAGES.placeTower, {
      typeId,
      slotIndex: slot.slotIndex,
    });
    this.clearSelection();
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
    const typeId = this.getActiveTowerType();
    if (!typeId) return;
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

  /**
   * Selects a placed tower: draws its range, shows tier stats status, and
   * presents both UPGRADE and SELL action buttons alongside each other.
   */
  private selectTower(slot: TowerSlot, record: TowerRecord): void {
    if (this.selectedSlotIndex === slot.slotIndex) {
      this.clearSelection();
      return;
    }

    this.clearSelection();
    this.selectedSlotIndex = slot.slotIndex;

    this.renderTowerSelection(slot, record);
  }

  /**
   * Renders the floating status panel and the upgrade/sell action buttons.
   */
  private renderTowerSelection(slot: TowerSlot, record: TowerRecord): void {
    const towerType = TOWER_TYPES[record.tower.typeId];
    const currentTier = towerType ? tierAt(towerType, record.tower.level) : null;
    const maxLevel = towerType?.tiers.length ?? 1;
    const isMax = record.tower.level >= maxLevel;
    const nextTier = towerType && !isMax ? towerType.tiers[record.tower.level] : null;
    const upgradePrice = towerType ? upgradeCost(towerType, record.tower.level) : null;
    const refund = towerType ? sellRefund(record.tower.invested) : 0;

    // Draw range ring matching current tier range
    const range = currentTier?.range ?? 0;
    if (range > 0) {
      this.rangeCircle = this.scene.add
        .circle(slot.x, slot.y, range, 0x38bdf8, 0.12)
        .setStrokeStyle(2, 0x38bdf8, 0.6);
      this.root?.add(this.rangeCircle);
    }

    // Geometry layout: clamp horizontally and anchor above tower
    const clampedX = Phaser.Math.Clamp(slot.x, 140, 1280 - 140);
    const buttonY = Math.max(88, slot.y - 88);
    const panelY = buttonY - 54;
    const panelW = 246;
    const panelH = 50;

    // --- Status Panel ---
    this.towerInfoPanel = this.scene.add.container(clampedX, panelY);
    this.towerInfoPanel.setDepth(DEPTH.UI_LAYER);
    this.root?.add(this.towerInfoPanel);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0f1d, 0.94);
    bg.lineStyle(1.5, 0xca8a04, 0.95);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 8);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 8);

    const nameText = this.scene.add
      .text(-panelW / 2 + 10, -12, towerType?.name ?? record.tower.typeId, {
        fontSize: "12px",
        fontStyle: "bold",
        color: "#f8fafc",
      })
      .setOrigin(0, 0.5);

    const tierBadgeText = this.scene.add
      .text(
        panelW / 2 - 10,
        -12,
        isMax ? "TIER MAX" : `TIER ${record.tower.level}/${maxLevel}`,
        {
          fontSize: "11px",
          fontStyle: "bold",
          color: isMax ? "#fbbf24" : "#38bdf8",
        },
      )
      .setOrigin(1, 0.5);

    bg.lineStyle(1, 0x334155, 0.7);
    bg.lineBetween(-panelW / 2 + 8, 0, panelW / 2 - 8, 0);

    let statsText: Phaser.GameObjects.Text;
    if (!isMax && nextTier && currentTier) {
      statsText = this.scene.add
        .text(
          0,
          12,
          `DMG ${currentTier.damage}➔${nextTier.damage}   RNG ${currentTier.range}➔${nextTier.range}   SPD ${currentTier.fireRate}➔${nextTier.fireRate}/s`,
          {
            fontSize: "10.5px",
            fontStyle: "bold",
            color: "#cbd5e1",
          },
        )
        .setOrigin(0.5, 0.5);
    } else if (currentTier) {
      statsText = this.scene.add
        .text(
          0,
          12,
          `DMG ${currentTier.damage}   RNG ${currentTier.range}   SPD ${currentTier.fireRate}/s`,
          {
            fontSize: "11px",
            fontStyle: "bold",
            color: "#94a3b8",
          },
        )
        .setOrigin(0.5, 0.5);
    } else {
      statsText = this.scene.add
        .text(0, 12, "NO STATS", {
          fontSize: "11px",
          color: "#94a3b8",
        })
        .setOrigin(0.5, 0.5);
    }

    this.towerInfoPanel.add([bg, nameText, tierBadgeText, statsText]);

    // --- Action Buttons (UPGRADE on left, SELL on right) ---
    const btnWidth = 116;
    const btnHeight = btnWidth / UI_ASPECT.button;

    // Upgrade Button
    if (!isMax && upgradePrice !== null) {
      const canAfford = this.gold >= upgradePrice;
      this.upgradeButton = new UIButton({
        scene: this.scene,
        x: clampedX - 63,
        y: buttonY,
        width: btnWidth,
        height: btnHeight,
        label: `UPG -${upgradePrice}g`,
        fontSize: 13,
        labelColor: canAfford ? "#ffffff" : "#94a3b8",
        onClick: () => {
          this.isTouchingSlot = true;
          this.requestUpgrade(record);
        },
      });
      if (!canAfford) {
        this.upgradeButton.setEnabled(false);
      }
    } else {
      this.upgradeButton = new UIButton({
        scene: this.scene,
        x: clampedX - 63,
        y: buttonY,
        width: btnWidth,
        height: btnHeight,
        label: "MAX TIER",
        fontSize: 12,
        labelColor: "#94a3b8",
        onClick: () => {
          this.isTouchingSlot = true;
        },
      });
      this.upgradeButton.setEnabled(false);
    }
    this.upgradeButton.container.setDepth(DEPTH.UI_LAYER);
    this.root?.add(this.upgradeButton.container);

    // Sell Button
    this.sellButton = new UIButton({
      scene: this.scene,
      x: clampedX + 63,
      y: buttonY,
      width: btnWidth,
      height: btnHeight,
      label: `SELL +${refund}g`,
      fontSize: 13,
      labelColor: "#ffffff",
      onClick: () => {
        this.isTouchingSlot = true;
        this.requestSell(record);
      },
    });
    this.sellButton.container.setDepth(DEPTH.UI_LAYER);
    this.root?.add(this.sellButton.container);
  }

  /**
   * Arms a pending upgrade confirmation on the upgrade button.
   */
  private requestUpgrade(record: TowerRecord): void {
    if (!this.upgradeButton) return;
    this.resetSellButton(record);

    this.upgradeButton.setLabel("✓ UPGRADE");
    this.upgradeButton.setLabelColor("#4ade80");
    this.upgradeButton.setFontSize(14);
    this.upgradeButton.setOnClick(() => this.confirmUpgrade(record));
  }

  /** Sends the upgrade request to the server. */
  private confirmUpgrade(record: TowerRecord): void {
    this.room.send(MESSAGES.upgradeTower, { towerId: record.id });
    if (this.upgradeButton) {
      this.upgradeButton.setEnabled(false);
      this.upgradeButton.setLabel("UPGRADING...");
      this.upgradeButton.setLabelColor("#94a3b8");
    }
  }

  /** Resets the upgrade button to its unconfirmed state. */
  private resetUpgradeButton(record: TowerRecord): void {
    if (!this.upgradeButton) return;
    const towerType = TOWER_TYPES[record.tower.typeId];
    const isMax = towerType ? record.tower.level >= towerType.tiers.length : true;
    const upgradePrice = towerType ? upgradeCost(towerType, record.tower.level) : null;
    if (!isMax && upgradePrice !== null) {
      const canAfford = this.gold >= upgradePrice;
      this.upgradeButton.setLabel(`UPG -${upgradePrice}g`);
      this.upgradeButton.setLabelColor(canAfford ? "#ffffff" : "#94a3b8");
      this.upgradeButton.setFontSize(13);
      this.upgradeButton.setEnabled(canAfford);
      this.upgradeButton.setOnClick(() => {
        this.isTouchingSlot = true;
        this.requestUpgrade(record);
      });
    } else {
      this.upgradeButton.setLabel("MAX TIER");
      this.upgradeButton.setLabelColor("#94a3b8");
      this.upgradeButton.setFontSize(12);
      this.upgradeButton.setEnabled(false);
    }
  }

  /**
   * Creates the floating action button above a slot (used by build confirmation).
   */
  private createActionButton(
    slot: TowerSlot,
    label: string,
    confirm: boolean,
    onClick: () => void,
  ): UIButton {
    const buttonWidth = 130;

    const button = new UIButton({
      scene: this.scene,
      x: slot.x,
      y: slot.y - 90,
      width: buttonWidth,
      height: buttonWidth / UI_ASPECT.button,
      label,
      fontSize: confirm ? 16 : 14,
      labelColor: confirm ? "#4ade80" : "#ffffff",
      onClick: () => {
        this.isTouchingSlot = true;
        onClick();
      },
    });
    button.container.setDepth(DEPTH.UI_LAYER);
    this.root?.add(button.container);

    return button;
  }

  /** Turns the sell button into a tick awaiting a second click to confirm. */
  private requestSell(record: TowerRecord): void {
    if (!this.sellButton) return;
    this.resetUpgradeButton(record);

    this.sellButton.setLabel("✓ SELL");
    this.sellButton.setLabelColor("#4ade80");
    this.sellButton.setFontSize(14);
    this.sellButton.setOnClick(() => this.confirmSell(record));
  }

  /** Sends the sale once the defender confirms it with the tick. */
  private confirmSell(record: TowerRecord): void {
    this.room.send(MESSAGES.sellTower, { towerId: record.id });
    this.clearSelection();
  }

  /** Resets the sell button to its unconfirmed state. */
  private resetSellButton(record: TowerRecord): void {
    if (!this.sellButton) return;
    const towerType = TOWER_TYPES[record.tower.typeId];
    const refund = towerType ? sellRefund(record.tower.invested) : 0;
    this.sellButton.setLabel(`SELL +${refund}g`);
    this.sellButton.setLabelColor("#ffffff");
    this.sellButton.setFontSize(13);
    this.sellButton.setOnClick(() => {
      this.isTouchingSlot = true;
      this.requestSell(record);
    });
  }

  /**
   * Refreshes the currently active selection UI (e.g. after an upgrade or gold change).
   */
  private refreshTowerSelection(slot: TowerSlot, record: TowerRecord): void {
    if (this.selectedSlotIndex !== slot.slotIndex) return;
    this.rangeCircle?.destroy();
    this.rangeCircle = undefined;
    this.upgradeButton?.destroy();
    this.upgradeButton = undefined;
    this.sellButton?.destroy();
    this.sellButton = undefined;
    this.towerInfoPanel?.destroy();
    this.towerInfoPanel = undefined;

    this.renderTowerSelection(slot, record);
  }

  /**
   * Clears the selected tower, its range, and any pending build or sale/upgrade.
   */
  private clearSelection(): void {
    this.selectedSlotIndex = undefined;
    this.pendingBuild = undefined;
    this.rangeCircle?.destroy();
    this.rangeCircle = undefined;
    this.buildHighlight?.destroy();
    this.buildHighlight = undefined;
    this.actionButton?.destroy();
    this.actionButton = undefined;
    this.upgradeButton?.destroy();
    this.upgradeButton = undefined;
    this.sellButton?.destroy();
    this.sellButton = undefined;
    this.towerInfoPanel?.destroy();
    this.towerInfoPanel = undefined;
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

    const onAdd = (value: unknown, key: unknown): void => {
      const tower = value as Tower;
      const slot = this.map.slots.find((s) => s.slotIndex === tower.slotIndex);
      if (slot) {
        this.renderTower(slot, tower, String(key));

        this.unsubscribers.push(
          callbacks.listen(tower, "level", () => {
            const record = this.towers.get(slot.slotIndex);
            if (record) {
              this.updateTowerLevelBadge(record);
              if (this.selectedSlotIndex === slot.slotIndex) {
                this.refreshTowerSelection(slot, record);
              }
            }
          }),
        );
        this.unsubscribers.push(
          callbacks.listen(tower, "invested", () => {
            const record = this.towers.get(slot.slotIndex);
            if (record && this.selectedSlotIndex === slot.slotIndex) {
              this.refreshTowerSelection(slot, record);
            }
          }),
        );
      }
    };

    const onChange = (value: unknown): void => {
      const tower = value as Tower;
      const slot = this.map.slots.find((s) => s.slotIndex === tower.slotIndex);
      if (!slot) return;
      const record = this.towers.get(slot.slotIndex);
      if (record) {
        record.tower = tower;
        this.updateTowerLevelBadge(record);
        if (this.selectedSlotIndex === slot.slotIndex) {
          this.refreshTowerSelection(slot, record);
        }
      }
    };

    const onRemove = (value: unknown): void => {
      const tower = value as Tower;
      const slot = this.map.slots.find((s) => s.slotIndex === tower.slotIndex);
      if (!slot) return;
      const record = this.towers.get(slot.slotIndex);
      record?.sprite.destroy();
      record?.levelBadge?.destroy();
      this.towers.delete(slot.slotIndex);
      if (this.selectedSlotIndex === slot.slotIndex) {
        this.clearSelection();
      }
    };

    // Third parameter `true` immediately calls onAdd for all existing towers in state
    this.unsubscribers.push(callbacks.onAdd("towers", onAdd, true));
    this.unsubscribers.push(callbacks.onChange("towers", onChange));
    this.unsubscribers.push(callbacks.onRemove("towers", onRemove));
  }

  private createTowerLevelBadge(slot: TowerSlot, level: number): Phaser.GameObjects.Container {
    const badge = this.scene.add.container(slot.x, slot.y - 116);
    badge.setDepth(DEPTH.TOWERS_LAYER + slot.y * 0.001 + 0.0002);

    const w = 44;
    const h = 18;
    const bg = this.scene.add.graphics();
    bg.name = "bg";
    this.drawBadgeBg(bg, level, w, h);

    const label = this.scene.add
      .text(0, 0, `Lv.${level}`, {
        fontSize: "11px",
        fontStyle: "bold",
        color: level > 1 ? "#fbbf24" : "#e2e8f0",
      })
      .setOrigin(0.5);
    label.name = "label";

    badge.add([bg, label]);
    return badge;
  }

  private drawBadgeBg(bg: Phaser.GameObjects.Graphics, level: number, w: number, h: number): void {
    bg.clear();
    bg.fillStyle(0x090d16, 0.88);
    bg.lineStyle(1.2, level > 1 ? 0xf59e0b : 0x475569, 0.9);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
  }

  private updateTowerLevelBadge(record: TowerRecord): void {
    if (!record.levelBadge) return;
    const label = record.levelBadge.getByName("label") as Phaser.GameObjects.Text | null;
    const bg = record.levelBadge.getByName("bg") as Phaser.GameObjects.Graphics | null;
    if (label) {
      label.setText(`Lv.${record.tower.level}`);
      label.setColor(record.tower.level > 1 ? "#fbbf24" : "#e2e8f0");
    }
    if (bg) {
      this.drawBadgeBg(bg, record.tower.level, 44, 18);
    }
    this.scene.tweens.add({
      targets: record.levelBadge,
      scaleX: 1.25,
      scaleY: 1.25,
      yoyo: true,
      duration: 120,
    });
  }

  private renderTower(slot: TowerSlot, tower: Tower, id: string): void {
    if (this.towers.has(slot.slotIndex)) return;

    const sprite = this.scene.add
      .sprite(slot.x, slot.y, "tower_archer")
      .setOrigin(0.5, 0.82)
      .setDisplaySize(135, 135)
      .setDepth(DEPTH.TOWERS_LAYER + slot.y * 0.001);

    const levelBadge = this.createTowerLevelBadge(slot, tower.level);

    if (this.role === "defender") {
      sprite.setInteractive({ useHandCursor: true });
      sprite.on(
        "pointerdown",
        (
          _pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData,
        ) => {
          event?.stopPropagation();
          this.isTouchingSlot = true;
          const record = this.towers.get(slot.slotIndex);
          if (record) this.selectTower(slot, record);
        },
      );
      sprite.on("pointerup", () => {
        this.isTouchingSlot = false;
      });
    }

    this.towers.set(slot.slotIndex, { id, tower, sprite, levelBadge });
    this.root?.add(sprite);
    if (levelBadge) this.root?.add(levelBadge);
  }

  startCombat(): void {
    if (this.combatStarted || this.destroyed) return;
    this.combatStarted = true;

    this.phaseBanner?.destroy();
    this.phaseBanner = undefined;
    this.startButton?.destroy();
    this.startButton = undefined;

    // Show combat alert banner fixed to camera screen space
    const bannerWidth = 400;
    const bannerHeight = bannerWidth / UI_BG_ASPECT.notification2;
    this.combatBanner = this.scene.add.container(640, 45).setScrollFactor(0);
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
    this.combatBanner.add([bg, txt]);
    this.combatBanner.setDepth(DEPTH.UI_LAYER);

    this.scene.time.delayedCall(4000, () => {
      this.combatBanner?.destroy();
      this.combatBanner = undefined;
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

      // Classic green-on-red bar; the green fill shrinks from its left edge.
      const hpBg = this.scene.add
        .rectangle(0, 0, MOB_HP_BAR.width, MOB_HP_BAR.height, 0x7f1d1d)
        .setOrigin(0.5)
        .setDepth(DEPTH.UNITS_LAYER + 1);
      const hpFill = this.scene.add
        .rectangle(0, 0, MOB_HP_BAR.width, MOB_HP_BAR.height, 0x22c55e)
        .setOrigin(0, 0.5)
        .setDepth(DEPTH.UNITS_LAYER + 2);

      const record: MobRecord = { sprite, hpBg, hpFill };
      this.mobSprites.set(mob, record);
      this.root?.add([sprite, hpBg, hpFill]);
      this.updateMobSprite(mob, record);
    };

    const onRemove = (value: unknown): void => {
      const record = this.mobSprites.get(value as Mob);
      if (!record) return;
      record.sprite.destroy();
      record.hpBg.destroy();
      record.hpFill.destroy();
      this.mobSprites.delete(value as Mob);
    };

    // Third parameter `true` immediately renders mobs already present in state.
    this.unsubscribers.push(callbacks.onAdd("mobs", onAdd, true));
    this.unsubscribers.push(callbacks.onRemove("mobs", onRemove));
  }

  /** Per-frame pass repositioning every tracked mob sprite and its health bar. */
  private updateMobs(): void {
    if (this.destroyed || this.mobSprites.size === 0) return;
    this.mobSprites.forEach((record, mob) => this.updateMobSprite(mob, record));
  }

  /** Places one mob (body + health bar) at the path position for its progress. */
  private updateMobSprite(mob: Mob, record: MobRecord): void {
    const path = this.pathFor(mob.pathId);
    if (!path || path.length < 2) return;

    const halfWidth = this.map.pathHalfWidth ?? 0;
    const point = samplePathWithLateral(path, mob.progress, mob.seed, halfWidth);

    record.sprite.setPosition(point.x, point.y);
    record.sprite.setDepth(DEPTH.UNITS_LAYER + point.y * 0.001);

    // Face the direction of travel (art is a side-view sprite, so flip, not rotate).
    const ahead = samplePath(path, Math.min(1, mob.progress + 0.02));
    const dx = ahead.x - point.x;
    if (Math.abs(dx) > 0.5) record.sprite.setFlipX(dx < 0);

    this.updateMobHealthBar(mob, record, point.x, point.y);
  }

  /**
   * Redraws a mob's health bar above it.
   *
   * @remarks The bar is hidden at full health (classic look, less clutter) and
   * scaled so the green fill tracks `hp / maxHp` from the left edge.
   */
  private updateMobHealthBar(
    mob: Mob,
    record: MobRecord,
    x: number,
    y: number,
  ): void {
    const maxHp = mob.maxHp > 0 ? mob.maxHp : 1;
    const ratio = Phaser.Math.Clamp(mob.hp / maxHp, 0, 1);
    const damaged = ratio < 1;

    const barY = y + MOB_HP_BAR.offsetY;
    record.hpBg.setPosition(x, barY).setVisible(damaged);
    record.hpFill
      .setPosition(x - MOB_HP_BAR.width / 2, barY)
      .setDisplaySize(MOB_HP_BAR.width * ratio, MOB_HP_BAR.height)
      .setVisible(damaged);
  }

  /**
   * Mirrors `RoomState.projectiles` into sprites using Colyseus Callbacks.
   *
   * @remarks
   * Unlike mobs, projectiles carry their own synced `x`/`y`; the sprite is only
   * re-pointed each frame (see {@link updateProjectiles}) so travel stays smooth
   * between server patches.
   */
  private setupProjectileSync(): void {
    if (!this.room) return;

    const callbacks = Callbacks.get(this.room);

    const onAdd = (value: unknown): void => {
      const projectile = value as Projectile;
      const sprite = this.scene.add
        .sprite(projectile.x, projectile.y, "arrow_proj")
        .setOrigin(0.5, 0.5)
        .setDisplaySize(28, 28)
        .setDepth(DEPTH.PROJECTILES_LAYER);

      this.projectileSprites.set(projectile, sprite);
      this.root?.add(sprite);
    };

    const onRemove = (value: unknown): void => {
      const sprite = this.projectileSprites.get(value as Projectile);
      if (!sprite) return;
      sprite.destroy();
      this.projectileSprites.delete(value as Projectile);
    };

    // Third parameter `true` immediately renders projectiles already in state.
    this.unsubscribers.push(callbacks.onAdd("projectiles", onAdd, true));
    this.unsubscribers.push(callbacks.onRemove("projectiles", onRemove));
  }

  /** Per-frame pass moving each projectile sprite to its synced position. */
  private updateProjectiles(): void {
    if (this.destroyed || this.projectileSprites.size === 0) return;

    this.projectileSprites.forEach((sprite, projectile) => {
      const dx = projectile.x - sprite.x;
      const dy = projectile.y - sprite.y;
      if (dx * dx + dy * dy > 0.01) sprite.setRotation(Math.atan2(dy, dx));
      sprite.setPosition(projectile.x, projectile.y);
    });
  }

  /**
   * Keeps the base's floating HP bar in sync with the defender's core.
   *
   * @remarks `coreHp` is authoritative; the bar just reflects it. The max comes
   * from {@link MATCH_RULES} since it never changes mid-match.
   */
  private setupBaseHpSync(): void {
    if (!this.room) return;

    const callbacks = Callbacks.get(this.room);
    this.unsubscribers.push(
      callbacks.listen("coreHp", (value: number) => this.updateBaseHp(value), true),
    );
  }

  /** Redraws the base HP bar (width + colour) and its label. */
  private updateBaseHp(coreHp: number): void {
    const max = MATCH_RULES.coreHp;
    const ratio = max > 0 ? Phaser.Math.Clamp(coreHp / max, 0, 1) : 0;

    this.baseHpFill?.setDisplaySize(this.baseHpBarWidth * ratio, 10);
    this.baseHpFill?.setFillStyle(
      ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xf59e0b : 0xef4444,
    );
    this.baseHpText?.setText(`BASE CASTLE: ${coreHp}/${max} HP`);
  }

  /** Resolves a mob's `pathId` against the map's tracks. */
  private pathFor(pathId: string): Vec2[] | undefined {
    if (pathId === "top") return this.map.paths?.top;
    if (pathId === "bottom") return this.map.paths?.bottom;
    return this.map.path;
  }

  /**
   * Clamps camera scroll position so visible bounds remain within the 1280x720 map.
   */
  private clampCameraScroll(): void {
    const cam = this.scene.cameras.main;
    const halfW = (cam.width / 2) / cam.zoom;
    const halfH = (cam.height / 2) / cam.zoom;

    const minX = Math.min(0, halfW - cam.width / 2);
    const maxX = Math.max(0, 1280 - halfW - cam.width / 2);
    const minY = Math.min(0, halfH - cam.height / 2);
    const maxY = Math.max(0, 720 - halfH - cam.height / 2);

    if (minX <= maxX) {
      cam.scrollX = Phaser.Math.Clamp(cam.scrollX, minX, maxX);
    } else {
      cam.scrollX = 0;
    }

    if (minY <= maxY) {
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY, minY, maxY);
    } else {
      cam.scrollY = 0;
    }
  }

  /**
   * Initializes drag & pan camera controls with pinch-to-zoom, boundary clamping, and momentum friction.
   */
  private setupCameraControls(): void {
    const cam = this.scene.cameras.main;
    this.scene.input.addPointer(2);

    this.onCameraPointerDown = (pointer: Phaser.Input.Pointer) => {
      const p1 = this.scene.input.pointer1;
      const p2 = this.scene.input.pointer2;

      // Two fingers down: initiate pinch-to-zoom gesture
      if (p1.isDown && p2.isDown) {
        this.isPinching = true;
        this.isDragging = false;
        this.initialPinchDistance = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        this.initialZoom = cam.zoom;
        this.cameraVelocityX = 0;
        this.cameraVelocityY = 0;
        return;
      }

      if (this.isTouchingSlot) return;

      this.isDragging = true;
      this.lastPointerX = pointer.x;
      this.lastPointerY = pointer.y;
      this.cameraVelocityX = 0;
      this.cameraVelocityY = 0;
    };

    this.onCameraPointerMove = (pointer: Phaser.Input.Pointer) => {
      const p1 = this.scene.input.pointer1;
      const p2 = this.scene.input.pointer2;

      // Handle two-finger pinch-to-zoom
      if (p1.isDown && p2.isDown) {
        this.isPinching = true;
        this.isDragging = false;
        const currentDist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this.initialPinchDistance > 10) {
          const factor = currentDist / this.initialPinchDistance;
          const targetZoom = Phaser.Math.Clamp(this.initialZoom * factor, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);
          cam.setZoom(targetZoom);
          this.clampCameraScroll();
        }
        return;
      }

      // Handle single-finger map dragging / panning
      if (!this.isDragging || this.isPinching || !pointer.isDown || this.isTouchingSlot) return;

      const dx = pointer.x - this.lastPointerX;
      const dy = pointer.y - this.lastPointerY;

      cam.scrollX -= dx / cam.zoom;
      cam.scrollY -= dy / cam.zoom;
      this.clampCameraScroll();

      this.cameraVelocityX = -dx / cam.zoom;
      this.cameraVelocityY = -dy / cam.zoom;
      this.lastPointerX = pointer.x;
      this.lastPointerY = pointer.y;
    };

    this.onCameraPointerUp = () => {
      const p1 = this.scene.input.pointer1;
      const p2 = this.scene.input.pointer2;

      if (!p1.isDown || !p2.isDown) {
        this.isPinching = false;
        this.initialPinchDistance = 0;
      }

      this.isDragging = false;
      this.isTouchingSlot = false;
    };

    this.onCameraWheel = (_pointer: any, _gameObjects: any, _deltaX: number, deltaY: number) => {
      const newZoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.001, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);
      cam.setZoom(newZoom);
      this.clampCameraScroll();
    };

    this.scene.input.on("pointerdown", this.onCameraPointerDown);
    this.scene.input.on("pointermove", this.onCameraPointerMove);
    this.scene.input.on("pointerup", this.onCameraPointerUp);
    this.scene.input.on("wheel", this.onCameraWheel);
  }

  /**
   * Per-frame update for camera glide physics (friction: 0.1 decay).
   */
  update(_time: number, _delta: number): void {
    if (!this.isDragging && !this.isPinching && (Math.abs(this.cameraVelocityX) > 0.05 || Math.abs(this.cameraVelocityY) > 0.05)) {
      const cam = this.scene.cameras.main;
      cam.scrollX += this.cameraVelocityX;
      cam.scrollY += this.cameraVelocityY;
      this.clampCameraScroll();
      this.cameraVelocityX *= 0.9; // friction 0.1 decay factor
      this.cameraVelocityY *= 0.9;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.combatStarted = false;

    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onSceneUpdate);

    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];

    for (const record of this.mobSprites.values()) {
      record.sprite.destroy();
      record.hpBg.destroy();
      record.hpFill.destroy();
    }
    this.mobSprites.clear();

    for (const sprite of this.projectileSprites.values()) sprite.destroy();
    this.projectileSprites.clear();

    if (this.onKeyDown) {
      this.scene.input.keyboard?.off("keydown-D", this.onKeyDown);
    }
    if (this.onPointerDown) {
      this.scene.input.off("pointerdown", this.onPointerDown);
    }
    this.onKeyDown = undefined;
    this.onPointerDown = undefined;

    if (this.onCameraPointerDown) {
      this.scene.input.off("pointerdown", this.onCameraPointerDown);
    }
    if (this.onCameraPointerMove) {
      this.scene.input.off("pointermove", this.onCameraPointerMove);
    }
    if (this.onCameraPointerUp) {
      this.scene.input.off("pointerup", this.onCameraPointerUp);
    }
    if (this.onCameraWheel) {
      this.scene.input.off("wheel", this.onCameraWheel);
    }
    this.onCameraPointerDown = undefined;
    this.onCameraPointerMove = undefined;
    this.onCameraPointerUp = undefined;
    this.onCameraWheel = undefined;

    this.debugGraphics?.destroy();
    this.debugGraphics = undefined;

    this.clearSelection();

    this.topPortal?.destroy();
    this.bottomPortal?.destroy();
    this.phaseBanner?.destroy();
    this.startButton?.destroy();
    this.goldFrame = undefined;
    this.goldText = undefined;
    this.baseHpFill = undefined;
    this.baseHpText = undefined;

    for (const obj of this.deckObjects) obj.destroy();
    this.deckObjects = [];
    this.combatBanner?.destroy();
    this.combatBanner = undefined;

    this.uiRoot?.destroy(true);
    this.uiRoot = undefined;

    this.root?.destroy(true);
    this.root = undefined;

    this.towers.clear();
    this.deckCards.clear();
  }
}

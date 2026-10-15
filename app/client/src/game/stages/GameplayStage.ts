import Phaser from "phaser";
import { Callbacks, Room } from "@colyseus/sdk";
import {
  MESSAGES,
  type MapDefinition,
  type Tower,
  type YouEconomyPayload,
  TOWER_TYPES,
} from "@root/shared";

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
  private paths: Phaser.Curves.Path[] = [];
  private topPath?: Phaser.Curves.Path;
  private bottomPath?: Phaser.Curves.Path;
  private towers: Map<number, Phaser.GameObjects.Sprite> = new Map();
  private units: Phaser.GameObjects.Sprite[] = [];
  private unitTweenTargets: Array<{ t: number }> = [];
  private spawnEvents: Phaser.Time.TimerEvent[] = [];
  private spawnTimeouts: Phaser.Time.TimerEvent[] = [];

  private gold = 200;
  private deck: string[] = [];
  private selectedTowerType?: string;

  private deckCards: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private deckObjects: Phaser.GameObjects.GameObject[] = [];
  private ghostTower?: Phaser.GameObjects.Sprite;
  private phaseBanner?: Phaser.GameObjects.Container;
  private goldText?: Phaser.GameObjects.Text;
  private startButton?: Phaser.GameObjects.Container;
  private topPortal?: Phaser.GameObjects.Sprite;
  private bottomPortal?: Phaser.GameObjects.Sprite;

  private debugGraphics?: Phaser.GameObjects.Graphics;
  private showDebug = false;
  private onKeyDown?: (event: KeyboardEvent) => void;
  private onPointerDown?: (pointer: Phaser.Input.Pointer) => void;

  private unsubscribers: Array<() => void> = [];
  private combatStarted = false;
  private destroyed = false;

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
    this.setupPortals();
    this.setupDebugControls();

    if (this.role === "defender") {
      this.renderTowerDeck();
      this.renderStartButton();
    }
    this.renderPhaseBanner();
    this.setupTowerSync();
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
      this.goldText.setText(`GOLD: ${this.gold}g`);
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
    const deckY = 665;
    const cardWidth = 84;
    const cardHeight = 84;
    const gap = 12;

    this.goldText?.destroy();
    this.goldText = this.scene.add
      .text(deckX, deckY - 50, `GOLD: ${this.gold}g`, {
        fontSize: "15px",
        color: "#fbbf24",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.UI_LAYER);
    this.root?.add(this.goldText);
    this.deckObjects.push(this.goldText);

    if (!this.selectedTowerType && this.deck.length > 0) {
      this.selectedTowerType = this.deck[0];
    }

    this.deck.forEach((towerId, index) => {
      const tower = TOWER_TYPES[towerId];
      if (!tower) return;

      const x = deckX + index * (cardWidth + gap);
      const isSelected = this.selectedTowerType === towerId;

      const card = this.scene.add
        .rectangle(x, deckY, cardWidth, cardHeight, 0x1e293b)
        .setStrokeStyle(2, isSelected ? 0x4ade80 : 0x475569)
        .setInteractive({ useHandCursor: true })
        .setDepth(DEPTH.UI_LAYER);

      this.deckCards.set(towerId, card);
      this.deckObjects.push(card);

      card.on("pointerover", () => {
        if (this.selectedTowerType !== towerId) {
          card.setStrokeStyle(2, 0x6366f1);
        }
      });
      card.on("pointerout", () => {
        card.setStrokeStyle(
          2,
          this.selectedTowerType === towerId ? 0x4ade80 : 0x475569,
        );
      });
      card.on("pointerdown", () => {
        this.selectedTowerType = towerId;
        this.updateDeckCardStyles();
      });

      const label = this.scene.add
        .text(x, deckY - 26, tower.name.substring(0, 10), {
          fontSize: "11px",
          color: "#f8fafc",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.UI_LAYER);

      const tierCost = tower.tiers[0]?.cost ?? 0;
      const costLabel = this.scene.add
        .text(x, deckY + 28, `${tierCost}g`, {
          fontSize: "12px",
          color: "#fbbf24",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.UI_LAYER);

      this.deckObjects.push(label, costLabel);
      this.root?.add([card, label, costLabel]);
    });
  }

  private renderStartButton(): void {
    const buttonX = 1150;
    const buttonY = 35;
    const buttonWidth = 140;
    const buttonHeight = 44;

    this.startButton = this.scene.add.container(buttonX, buttonY);

    const bg = this.scene.add
      .rectangle(0, 0, buttonWidth, buttonHeight, 0x10b981)
      .setStrokeStyle(2, 0x34d399)
      .setInteractive({ useHandCursor: true });

    const text = this.scene.add
      .text(0, 0, "START GAME ▶", {
        fontSize: "14px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    bg.on("pointerover", () => bg.setFillStyle(0x059669));
    bg.on("pointerout", () => bg.setFillStyle(0x10b981));
    bg.on("pointerdown", () => {
      this.room.send(MESSAGES.startCombat, {});
    });

    this.startButton.add([bg, text]);
    this.startButton.setDepth(DEPTH.UI_LAYER);
    this.root?.add(this.startButton);
  }

  private updateDeckCardStyles(): void {
    this.deckCards.forEach((card, towerId) => {
      card.setStrokeStyle(
        2,
        this.selectedTowerType === towerId ? 0x4ade80 : 0x475569,
      );
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
    const bannerY = 35;

    this.phaseBanner = this.scene.add.container(bannerX, bannerY);

    const bg = this.scene.add
      .rectangle(0, 0, 460, 46, 0x1e293b, 0.9)
      .setStrokeStyle(2, 0x6366f1);

    const bannerText =
      this.role === "defender"
        ? "BUILDING PHASE — Place Your Towers"
        : "BUILDING PHASE — Defender is setting up defenses";

    const text = this.scene.add
      .text(0, 0, bannerText, {
        fontSize: "15px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.phaseBanner.add([bg, text]);
    this.phaseBanner.setDepth(DEPTH.UI_LAYER);
    this.root?.add(this.phaseBanner);
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
    const banner = this.scene.add.container(640, 35);
    const bg = this.scene.add
      .rectangle(0, 0, 420, 46, 0x7f1d1d, 0.9)
      .setStrokeStyle(2, 0xef4444);
    const txt = this.scene.add
      .text(0, 0, "⚔️ COMBAT PHASE — Units Advancing!", {
        fontSize: "15px",
        color: "#fef2f2",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    banner.add([bg, txt]);
    banner.setDepth(DEPTH.UI_LAYER);
    this.root?.add(banner);

    this.scene.time.delayedCall(4000, () => {
      banner.destroy();
    });

    this.startSpawner();
  }

  private startSpawner(): void {
    const spawnUnitOnPath = (path: Phaser.Curves.Path, delay: number): void => {
      const timer = this.scene.time.delayedCall(delay, () => {
        if (this.destroyed || !this.combatStarted || !this.root) return;
        this.spawnUnit(path);
      });
      this.spawnTimeouts.push(timer);
    };

    // Spawn initial waves from both portals
    if (this.topPath) {
      spawnUnitOnPath(this.topPath, 400);
      spawnUnitOnPath(this.topPath, 1800);
    }
    if (this.bottomPath) {
      spawnUnitOnPath(this.bottomPath, 1100);
      spawnUnitOnPath(this.bottomPath, 2500);
    }
    if (this.paths.length === 1) {
      spawnUnitOnPath(this.paths[0], 500);
    }

    // Continuously spawn units every 3.5 seconds
    const loopEvent = this.scene.time.addEvent({
      delay: 3500,
      loop: true,
      callback: () => {
        if (this.destroyed || !this.combatStarted) return;
        if (this.topPath) this.spawnUnit(this.topPath);
        if (this.bottomPath) {
          const t = this.scene.time.delayedCall(1200, () => {
            if (this.destroyed || !this.combatStarted || !this.bottomPath) return;
            this.spawnUnit(this.bottomPath);
          });
          this.spawnTimeouts.push(t);
        }
        if (this.paths.length === 1) {
          this.spawnUnit(this.paths[0]);
        }
      },
    });
    this.spawnEvents.push(loopEvent);
  }

  private spawnUnit(path: Phaser.Curves.Path): void {
    const startPoint = path.getPoint(0);
    const unit = this.scene.add
      .sprite(startPoint.x, startPoint.y, "unit_warrior")
      .setOrigin(0.5, 0.78)
      .setDisplaySize(0, 0)
      .setDepth(DEPTH.UNITS_LAYER + startPoint.y * 0.001);

    this.units.push(unit);
    this.root?.add(unit);

    // Quick scale-in tween as unit emerges from portal wormhole
    this.scene.tweens.add({
      targets: unit,
      displayWidth: 64,
      displayHeight: 64,
      duration: 350,
      ease: "Back.easeOut",
    });

    const progress = { t: 0 };
    this.unitTweenTargets.push(progress);

    const tween = this.scene.tweens.add({
      targets: progress,
      t: 1,
      duration: 10000,
      onUpdate: () => {
        if (this.destroyed || !unit.active) return;
        const currentPoint = path.getPoint(progress.t);
        const bob = Math.sin(progress.t * Math.PI * 16) * 1.5;
        unit.setPosition(currentPoint.x, currentPoint.y + bob);
        unit.setDepth(DEPTH.UNITS_LAYER + currentPoint.y * 0.001);

        const prevPoint = path.getPoint(Math.max(0, progress.t - 0.005));
        if (Math.abs(currentPoint.x - prevPoint.x) > 0.05) {
          unit.setFlipX(currentPoint.x < prevPoint.x);
        }
      },
      onComplete: () => {
        unit.destroy();
        this.units = this.units.filter((u) => u !== unit);
        this.unitTweenTargets = this.unitTweenTargets.filter(
          (target) => target !== progress,
        );
        tween.remove();
      },
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.combatStarted = false;

    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];

    for (const event of this.spawnEvents) event.remove(false);
    this.spawnEvents = [];

    for (const timeout of this.spawnTimeouts) timeout.remove(false);
    this.spawnTimeouts = [];

    for (const target of this.unitTweenTargets) {
      this.scene.tweens.killTweensOf(target);
    }
    this.unitTweenTargets = [];

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

    for (const obj of this.deckObjects) obj.destroy();
    this.deckObjects = [];

    this.root?.destroy(true);
    this.root = undefined;

    this.towers.clear();
    this.units = [];
    this.deckCards.clear();
  }
}

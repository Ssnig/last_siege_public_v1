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
}

type TowerSlot = { slotIndex: number; x: number; y: number };

/**
 * Renders the map (background, mob paths, tower slots, base) once the draft
 * ends, plus the defender's build UI. `RoomState.towers` is the single source
 * of truth: placements round-trip through the server and render on `onAdd`.
 *
 * @remarks
 * Owned by `GameScene`; call `destroy()` on scene shutdown to release listeners,
 * timers and tweens.
 */
export class GameplayStage {
  private scene: Phaser.Scene;
  private room: Room;
  private map: MapDefinition;
  private role: "attacker" | "defender";

  private root?: Phaser.GameObjects.Container;
  private paths: Phaser.Curves.Path[] = [];
  private towers: Map<number, Phaser.GameObjects.Sprite> = new Map();
  private units: Phaser.GameObjects.Sprite[] = [];
  private unitTweenTargets: Array<{ t: number }> = [];

  private gold = 0;
  private deck: string[] = [];
  private selectedTowerType?: string;

  private deckCards: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private deckObjects: Phaser.GameObjects.GameObject[] = [];
  private ghostTower?: Phaser.GameObjects.Sprite;
  private phaseBanner?: Phaser.GameObjects.Container;
  private startButton?: Phaser.GameObjects.Container;
  private goldText?: Phaser.GameObjects.Text;

  private spawnTimer?: Phaser.Time.TimerEvent;
  private combatStarted = false;
  private destroyed = false;

  private unsubscribers: Array<() => void> = [];
  private debugGraphics?: Phaser.GameObjects.Graphics;
  private showDebug = false;
  private onKeyDown?: (event: KeyboardEvent) => void;
  private onPointerDown?: (pointer: Phaser.Input.Pointer) => void;

  constructor(scene: Phaser.Scene, options: GameplayStageOptions) {
    this.scene = scene;
    this.room = options.room;
    this.map = options.map;
    this.role = options.role;

    if (options.economy) {
      this.gold = options.economy.gold;
      this.deck = options.economy.deck;
    }
  }

  create(): void {
    this.render();

    if (import.meta.env.DEV) {
      this.setupDebugControls();
    }

    if (this.role === "defender") {
      this.renderGoldText();
      this.renderTowerDeck();
      this.renderStartButton();
    }

    this.renderPhaseBanner();
    this.setupTowerSync();
    // Units only spawn once the server advances to combat.
  }

  /** Applies a server economy push (gold + deck), even if it arrives late. */
  applyEconomy(economy: YouEconomyPayload): void {
    if (this.destroyed) return;

    const deckChanged = economy.deck.join(",") !== this.deck.join(",");
    this.gold = economy.gold;
    this.deck = economy.deck;

    this.goldText?.setText(`Gold: ${this.gold}`);

    if (deckChanged && this.role === "defender") {
      this.renderTowerDeck();
    }
  }

  private render(): void {
    this.root?.destroy(true);
    this.root = this.scene.add.container(0, 0);

    const width = this.map.width ?? 1280;
    const height = this.map.height ?? 720;

    // Background image (only maps that ship one).
    if (this.scene.textures.exists(this.map.id)) {
      const bg = this.scene
        .add.image(0, 0, this.map.id)
        .setOrigin(0, 0)
        .setDisplaySize(width, height)
        .setDepth(DEPTH.MAP_BG);
      this.root.add(bg);
    } else {
      this.root.add(
        this.scene.add
          .rectangle(0, 0, width, height, 0x0f172a)
          .setOrigin(0, 0)
          .setDepth(DEPTH.MAP_BG),
      );
    }

    this.buildPaths();

    this.map.slots.forEach((slot) => {
      const placeholder = this.scene
        .add.circle(slot.x, slot.y, 36, 0x8b4513, 0.5)
        .setDepth(DEPTH.SLOTS_LAYER);

      if (this.role === "defender") {
        placeholder.setInteractive();
        placeholder.on("pointerover", () => {
          placeholder.setFillStyle(0xd2691e, 0.7);
          this.showGhostTower(slot);
        });
        placeholder.on("pointerout", () => {
          placeholder.setFillStyle(0x8b4513, 0.5);
          this.hideGhostTower();
        });
        placeholder.on("pointerdown", () => this.handleSlotClick(slot));
      }

      this.root?.add(placeholder);
    });

    this.renderBase();
  }

  /** Builds walkable curves from either the single `path` or named `paths`. */
  private buildPaths(): void {
    this.paths = [];

    const named = this.map.paths;
    if (named?.top?.length) this.paths.push(this.curveFrom(named.top));
    if (named?.bottom?.length) this.paths.push(this.curveFrom(named.bottom));

    if (this.paths.length === 0 && this.map.path.length > 0) {
      this.paths.push(this.curveFrom(this.map.path));
    }
  }

  private curveFrom(points: { x: number; y: number }[]): Phaser.Curves.Path {
    const path = new Phaser.Curves.Path(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      path.lineTo(points[i].x, points[i].y);
    }
    return path;
  }

  private renderBase(): void {
    if (!this.map.base) return;

    if (this.scene.textures.exists("base_castle")) {
      const baseCastle = this.scene
        .add.sprite(this.map.base.x, this.map.base.y, "base_castle")
        .setOrigin(0.5, 0.62)
        .setDisplaySize(310, 310)
        .setDepth(DEPTH.BASE_LAYER);
      this.root?.add(baseCastle);

      const hpBarWidth = 100;
      const hpBarHeight = 8;
      const barX = this.map.base.x;
      const barY = this.map.base.y - 175;

      this.root?.add(
        this.scene.add
          .rectangle(barX, barY, hpBarWidth, hpBarHeight, 0x1e293b)
          .setOrigin(0.5)
          .setDepth(DEPTH.BASE_LAYER),
      );
      this.root?.add(
        this.scene.add
          .rectangle(barX - hpBarWidth / 2, barY, hpBarWidth, hpBarHeight, 0x4ade80)
          .setOrigin(0, 0.5)
          .setDepth(DEPTH.BASE_LAYER),
      );
      this.root?.add(
        this.scene.add
          .text(barX, barY - 12, "10/10 HP", { fontSize: "12px", color: "#ffffff" })
          .setOrigin(0.5)
          .setDepth(DEPTH.BASE_LAYER),
      );
    } else {
      this.root?.add(
        this.scene.add
          .circle(this.map.base.x, this.map.base.y, 50, 0xff0000, 0.3)
          .setDepth(DEPTH.BASE_LAYER),
      );
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
        console.log(`{ x: ${Math.round(pointer.worldX)}, y: ${Math.round(pointer.worldY)} }`);
      }
    };
    this.scene.input.on("pointerdown", this.onPointerDown);
  }

  private toggleDebugGraphics(): void {
    this.debugGraphics?.destroy();
    this.debugGraphics = undefined;

    if (!this.showDebug) return;

    this.debugGraphics = this.scene.add.graphics().setDepth(DEPTH.PATH_LAYER);
    this.debugGraphics.lineStyle(3, 0x00ff00, 0.5);
    for (const path of this.paths) {
      path.draw(this.debugGraphics);
    }
  }

  private handleSlotClick(slot: TowerSlot): void {
    // Occupied slots are reserved for a future upgrade flow.
    if (this.towers.has(slot.slotIndex)) return;

    if (!this.selectedTowerType) {
      console.log("No tower type selected");
      return;
    }

    this.hideGhostTower();
    this.room.send(MESSAGES.placeTower, {
      typeId: this.selectedTowerType,
      slotIndex: slot.slotIndex,
    });
  }

  private renderGoldText(): void {
    this.goldText = this.scene.add
      .text(20, 640, `Gold: ${this.gold}`, {
        fontSize: "14px",
        color: "#fbbf24",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.UI_LAYER);
    this.root?.add(this.goldText);
  }

  private renderTowerDeck(): void {
    for (const obj of this.deckObjects) obj.destroy();
    this.deckObjects = [];
    this.deckCards.clear();

    if (this.deck.length === 0) return;

    // Clean up previous deck elements if any
    this.deckCards.clear();

    const deckX = 24;
    const deckY = 665;
    const cardWidth = 84;
    const cardHeight = 84;
    const gap = 12;

    this.deck.forEach((towerId, index) => {
      const tower = TOWER_TYPES[towerId];
      if (!tower) return;

      const x = deckX + index * (cardWidth + gap);
      const card = this.scene.add
        .rectangle(x, deckY, cardWidth, cardHeight, 0x1e293b)
        .setStrokeStyle(2, this.selectedTowerType === towerId ? 0x4ade80 : 0x475569)
        .setInteractive()
        .setDepth(DEPTH.UI_LAYER);

      this.deckCards.set(towerId, card);

      card.on("pointerover", () => {
        if (this.selectedTowerType !== towerId) {
          card.setStrokeStyle(2, 0x6366f1);
        }
      });
      card.on("pointerout", () => {
        card.setStrokeStyle(2, this.selectedTowerType === towerId ? 0x4ade80 : 0x475569);
      });
      card.on("pointerdown", () => {
        this.selectedTowerType = towerId;
        this.updateDeckCardStyles();
      });

      const label = this.scene.add
        .text(x, deckY - 30, tower.name.substring(0, 8), {
          fontSize: "10px",
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.UI_LAYER);

      const costLabel = this.scene.add
        .text(x, deckY + 35, `${tower.tiers[0].cost}g`, {
          fontSize: "10px",
          color: "#fbbf24",
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.UI_LAYER);

      this.deckObjects.push(card, label, costLabel);
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
      .rectangle(0, 0, buttonWidth, buttonHeight, 0x4ade80)
      .setStrokeStyle(2, 0x6366f1)
      .setInteractive();

    const text = this.scene.add
      .text(0, 0, "START GAME", {
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
      card.setStrokeStyle(2, this.selectedTowerType === towerId ? 0x4ade80 : 0x475569);
    });
  }

  private showGhostTower(slot: TowerSlot): void {
    if (!this.selectedTowerType || this.towers.has(slot.slotIndex)) return;

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
      .rectangle(0, 0, 400, 50, 0x1e293b, 0.9)
      .setStrokeStyle(2, 0x6366f1);

    const bannerText =
      this.role === "defender"
        ? "BUILDING PHASE — Place Your Towers"
        : "BUILDING PHASE — Defender is setting up defenses";

    const text = this.scene.add
      .text(0, 0, bannerText, {
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.phaseBanner.add([bg, text]);
    this.phaseBanner.setDepth(DEPTH.UI_LAYER);
    this.root?.add(this.phaseBanner);
  }

  /**
   * Mirrors `RoomState.towers` into sprites for both players. The server is the
   * only writer, so the client never renders an optimistic local tower.
   */
  private setupTowerSync(): void {
    const callbacks = Callbacks.get(this.room);

    const onAdd = (value: unknown): void => {
      const tower = value as Tower;
      const slot = this.map.slots.find((s) => s.slotIndex === tower.slotIndex);
      if (slot) this.renderTower(slot);
    };

    const onRemove = (value: unknown): void => {
      const tower = value as Tower;
      const slot = this.map.slots.find((s) => s.slotIndex === tower.slotIndex);
      if (!slot) return;
      this.towers.get(slot.slotIndex)?.destroy();
      this.towers.delete(slot.slotIndex);
    };

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

    this.startSpawner();
  }

  private startSpawner(): void {
    const spawnAll = (): void => {
      if (this.destroyed) return;
      for (const path of this.paths) this.spawnUnit(path);
    };

    this.scene.time.delayedCall(500, spawnAll);
    this.spawnTimer = this.scene.time.addEvent({
      delay: 3000,
      loop: true,
      callback: spawnAll,
    });
  }

  private spawnUnit(path: Phaser.Curves.Path): void {
    const start = path.getPoint(0);
    const unit = this.scene.add
      .sprite(start.x, start.y, "unit_warrior")
      .setOrigin(0.5, 0.78)
      .setDisplaySize(64, 64)
      .setDepth(DEPTH.UNITS_LAYER + start.y * 0.001);

    this.units.push(unit);
    this.root?.add(unit);

    const progress = { t: 0 };
    this.unitTweenTargets.push(progress);
    const tween = this.scene.tweens.add({
      targets: progress,
      t: 1,
      duration: 8000,
      onUpdate: () => {
        if (this.destroyed || !unit.active) return;

        const point = path.getPoint(progress.t);
        // Bob is recomputed from the curve each frame, never accumulated.
        const bob = Math.sin(progress.t * Math.PI * 10) * 2;
        unit.setPosition(point.x, point.y + bob);
        unit.setDepth(DEPTH.UNITS_LAYER + point.y * 0.001);

        const prev = path.getPoint(Math.max(0, progress.t - 0.01));
        unit.setFlipX(point.x < prev.x);
      },
      onComplete: () => {
        unit.destroy();
        this.units = this.units.filter((u) => u !== unit);
        this.unitTweenTargets = this.unitTweenTargets.filter((target) => target !== progress);
        tween.remove();
      },
    });
    this.spawnEvents.push(loopEvent);
  }

  destroy(): void {
    this.destroyed = true;

    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];

    this.spawnTimer?.remove();
    this.spawnTimer = undefined;

    for (const target of this.unitTweenTargets) {
      this.scene.tweens.killTweensOf(target);
    }
    this.unitTweenTargets = [];

    if (this.onKeyDown) this.scene.input.keyboard?.off("keydown-D", this.onKeyDown);
    if (this.onPointerDown) this.scene.input.off("pointerdown", this.onPointerDown);
    this.onKeyDown = undefined;
    this.onPointerDown = undefined;

    this.debugGraphics?.destroy();
    this.debugGraphics = undefined;

    this.root?.destroy(true);
    this.root = undefined;

    this.towers.clear();
    this.units = [];
    this.deckCards.clear();
    this.deckObjects = [];
  }
}

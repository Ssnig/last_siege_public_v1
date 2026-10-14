import Phaser from "phaser";
import { type MapDefinition, TOWER_TYPES } from "@root/shared";

export const DEPTH = {
  MAP_BG: 0,
  PATH_LAYER: 1,
  SLOTS_LAYER: 2,
  BASE_LAYER: 5,
  UNITS_LAYER: 10,
  TOWERS_LAYER: 15,
  UI_LAYER: 30,
} as const;

export class GameplayStage {
  private scene: Phaser.Scene;
  private map: MapDefinition;
  private root?: Phaser.GameObjects.Container;
  private debugGraphics?: Phaser.GameObjects.Graphics;
  private showDebug = false;
  private towers: Map<number, Phaser.GameObjects.Sprite> = new Map();
  private units: Phaser.GameObjects.Sprite[] = [];
  private topPath?: Phaser.Curves.Path;
  private bottomPath?: Phaser.Curves.Path;
  private defenderDeck?: string[];
  private selectedTowerType?: string;
  private room?: any; // Colyseus Room
  private deckCards: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private ghostTower?: Phaser.GameObjects.Sprite;
  private phaseBanner?: Phaser.GameObjects.Container;
  private gold?: number;
  private myRole?: "attacker" | "defender";
  private startButton?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, map: MapDefinition, defenderDeck?: string[], room?: any, gold?: number, myRole?: "attacker" | "defender") {
    this.scene = scene;
    this.map = map;
    this.defenderDeck = defenderDeck;
    this.room = room;
    this.gold = gold;
    this.myRole = myRole;
  }

  create(): void {
    this.render();
    this.setupDebugControls();
    if (this.myRole === "defender") {
      this.renderTowerDeck();
      this.renderStartButton();
    }
    this.renderPhaseBanner();
    this.setupTowerSync();
    // Don't auto-spawn units - wait for combat phase
  }

  private render(): void {
    this.root?.destroy(true);
    this.root = this.scene.add.container(0, 0);

    // Load and render map background
    if (this.map.id === "konbaung") {
      const bg = this.scene.add.image(0, 0, "konbaung")
        .setOrigin(0, 0)
        .setDisplaySize(this.map.width || 1280, this.map.height || 720)
        .setDepth(DEPTH.MAP_BG);
      this.root.add(bg);
    }

    // Create path curves
    if (this.map.paths?.top && this.map.paths.top.length > 0) {
      this.topPath = new Phaser.Curves.Path(this.map.paths.top[0].x, this.map.paths.top[0].y);
      for (let i = 1; i < this.map.paths.top.length; i++) {
        this.topPath.lineTo(this.map.paths.top[i].x, this.map.paths.top[i].y);
      }
    }
    if (this.map.paths?.bottom && this.map.paths.bottom.length > 0) {
      this.bottomPath = new Phaser.Curves.Path(this.map.paths.bottom[0].x, this.map.paths.bottom[0].y);
      for (let i = 1; i < this.map.paths.bottom.length; i++) {
        this.bottomPath.lineTo(this.map.paths.bottom[i].x, this.map.paths.bottom[i].y);
      }
    }

    // Render tower slots
    this.map.slots.forEach(slot => {
      const placeholder = this.scene.add.circle(
        slot.x, slot.y, 36, 0x8B4513, 0.5
      ).setDepth(DEPTH.SLOTS_LAYER);

      // Only make interactive for defender
      if (this.myRole === "defender") {
        placeholder.setInteractive();

        if (placeholder) {
          placeholder.on("pointerover", () => {
            placeholder.setFillStyle(0xD2691E, 0.7);
            this.showGhostTower(slot);
          });
          placeholder.on("pointerout", () => {
            placeholder.setFillStyle(0x8B4513, 0.5);
            this.hideGhostTower();
          });
          placeholder.on("pointerdown", () => this.handleSlotClick(slot));
        }
      }

      this.root.add(placeholder);
    });

    // Render base castle
    if (this.map.base && this.map.id === "konbaung") {
      const baseCastle = this.scene.add.sprite(
        this.map.base.x,
        this.map.base.y,
        "base_castle"
      )
        .setOrigin(0.5, 0.62)
        .setDisplaySize(310, 310)
        .setDepth(DEPTH.BASE_LAYER);
      this.root.add(baseCastle);

      // Render base HP bar
      const hpBarWidth = 100;
      const hpBarHeight = 8;
      const hpBarX = this.map.base.x;
      const hpBarY = this.map.base.y - 175;

      const hpBarBg = this.scene.add.rectangle(
        hpBarX, hpBarY, hpBarWidth, hpBarHeight, 0x1e293b
      ).setOrigin(0.5).setDepth(DEPTH.BASE_LAYER);
      this.root.add(hpBarBg);

      const hpBarFill = this.scene.add.rectangle(
        hpBarX - hpBarWidth / 2, hpBarY, hpBarWidth, hpBarHeight, 0x4ade80
      ).setOrigin(0, 0.5).setDepth(DEPTH.BASE_LAYER);
      this.root.add(hpBarFill);

      const hpText = this.scene.add.text(
        hpBarX, hpBarY - 12, "10/10 HP",
        { fontSize: "12px", color: "#ffffff" }
      ).setOrigin(0.5).setDepth(DEPTH.BASE_LAYER);
      this.root.add(hpText);
    } else if (this.map.base) {
      // Fallback red circle for other maps
      const base = this.scene.add.circle(
        this.map.base.x, this.map.base.y, 50, 0xFF0000, 0.3
      ).setDepth(DEPTH.BASE_LAYER);
      this.root.add(base);
    }
  }

  private setupDebugControls(): void {
    this.scene.input.keyboard!.on("keydown-D", () => {
      this.showDebug = !this.showDebug;
      this.toggleDebugGraphics();
    });

    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.showDebug) {
        console.log(`{ x: ${Math.round(pointer.worldX)}, y: ${Math.round(pointer.worldY)} }`);
      }
    });
  }

  private toggleDebugGraphics(): void {
    this.debugGraphics?.destroy();
    this.debugGraphics = undefined;

    if (!this.showDebug) return;

    this.debugGraphics = this.scene.add.graphics();
    this.debugGraphics.setDepth(DEPTH.PATH_LAYER);

    // Draw top path
    if (this.topPath) {
      this.debugGraphics.lineStyle(3, 0x00FF00, 0.5);
      this.topPath.draw(this.debugGraphics);
    }

    // Draw bottom path
    if (this.bottomPath) {
      this.debugGraphics.lineStyle(3, 0x00FF00, 0.5);
      this.bottomPath.draw(this.debugGraphics);
    }
  }

  private handleSlotClick(slot: { slotIndex: number; x: number; y: number }): void {
    if (this.towers.has(slot.slotIndex)) {
      // Remove tower
      this.towers.get(slot.slotIndex)?.destroy();
      this.towers.delete(slot.slotIndex);
    } else if (this.selectedTowerType) {
      // Place selected tower type
      this.placeTower(slot, this.selectedTowerType);
    } else {
      console.log("No tower type selected");
    }
  }

  private placeTower(slot: { slotIndex: number; x: number; y: number }, towerType: string = "basic"): void {
    const tower = this.scene.add.sprite(slot.x, slot.y, "tower_archer")
      .setOrigin(0.5, 0.82)
      .setDisplaySize(135, 135)
      .setDepth(DEPTH.TOWERS_LAYER + slot.y * 0.001);

    this.towers.set(slot.slotIndex, tower);
    this.root?.add(tower);

    // Send placement to server
    if (this.room) {
      this.room.send("place_tower", { typeId: towerType, slotIndex: slot.slotIndex });
    }
  }

  private spawnTestTowers(): void {
    // No pre-spawned towers - all slots start empty
  }

  private renderTowerDeck(): void {
    if (!this.defenderDeck || this.defenderDeck.length === 0) return;

    const deckX = 20;
    const deckY = 680;
    const cardWidth = 80;
    const cardHeight = 80;
    const gap = 10;

    // Render gold display
    const goldText = this.scene.add.text(
      20, 640, `Gold: ${this.gold || 200}`,
      { fontSize: "14px", color: "#fbbf24", fontStyle: "bold" }
    ).setOrigin(0, 0.5).setDepth(DEPTH.UI_LAYER);
    this.root?.add(goldText);

    this.defenderDeck.forEach((towerId, index) => {
      const tower = TOWER_TYPES[towerId];
      if (!tower) return;

      const x = deckX + index * (cardWidth + gap);
      const card = this.scene.add.rectangle(
        x, deckY, cardWidth, cardHeight, 0x1e293b
      ).setStrokeStyle(2, this.selectedTowerType === towerId ? 0x4ade80 : 0x475569)
        .setInteractive().setDepth(DEPTH.UI_LAYER);

      this.deckCards.set(towerId, card);

      card.on("pointerover", () => card.setStrokeStyle(2, 0x6366f1));
      card.on("pointerout", () => {
        card.setStrokeStyle(2, this.selectedTowerType === towerId ? 0x4ade80 : 0x475569);
      });
      card.on("pointerdown", () => {
        this.selectedTowerType = towerId;
        this.updateDeckCardStyles();
      });

      const label = this.scene.add.text(
        x, deckY - 30, tower.name.substring(0, 8),
        { fontSize: "10px", color: "#ffffff" }
      ).setOrigin(0.5).setDepth(DEPTH.UI_LAYER);

      const costLabel = this.scene.add.text(
        x, deckY + 35, `${tower.tiers[0].cost}g`,
        { fontSize: "10px", color: "#fbbf24" }
      ).setOrigin(0.5).setDepth(DEPTH.UI_LAYER);

      this.root?.add([card, label, costLabel]);
    });
  }

  private renderStartButton(): void {
    const buttonX = 1150;
    const buttonY = 30;
    const buttonWidth = 120;
    const buttonHeight = 40;

    this.startButton = this.scene.add.container(buttonX, buttonY);

    const bg = this.scene.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x4ade80)
      .setStrokeStyle(2, 0x6366f1)
      .setInteractive();

    const text = this.scene.add.text(0, 0, "START GAME", {
      fontSize: "14px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    bg.on("pointerover", () => bg.setFillStyle(0x6366f1));
    bg.on("pointerout", () => bg.setFillStyle(0x4ade80));
    bg.on("pointerdown", () => {
      if (this.room) {
        this.room.send("start_combat", {});
      }
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

  private showGhostTower(slot: { slotIndex: number; x: number; y: number }): void {
    if (!this.selectedTowerType) return;

    this.hideGhostTower();

    this.ghostTower = this.scene.add.sprite(slot.x, slot.y, "tower_archer")
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
    const bannerY = 30;

    this.phaseBanner = this.scene.add.container(bannerX, bannerY);

    const bg = this.scene.add.rectangle(0, 0, 400, 50, 0x1e293b, 0.9)
      .setStrokeStyle(2, 0x6366f1);

    const bannerText = this.myRole === "defender"
      ? "BUILDING PHASE — Place Your Towers"
      : "BUILDING PHASE — Defender is setting up defenses";

    const text = this.scene.add.text(0, 0, bannerText, {
      fontSize: "16px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    this.phaseBanner.add([bg, text]);
    this.phaseBanner.setDepth(DEPTH.UI_LAYER);
    this.root?.add(this.phaseBanner);
  }

  private setupTowerSync(): void {
    if (!this.room) return;

    // Listen to tower additions from server state (syncs to both players)
    this.room.state.towers.onAdd((tower: any) => {
      console.log("Tower added to state:", tower);
      const slot = this.map.slots.find(s => s.slotIndex === tower.slotIndex);
      if (slot) {
        this.renderServerTower(tower, slot);
      }
    });

    // Listen to tower removals
    this.room.state.towers.onRemove((tower: any) => {
      console.log("Tower removed from state:", tower);
      const slot = this.map.slots.find(s => s.slotIndex === tower.slotIndex);
      if (slot) {
        const existingTower = this.towers.get(slot.slotIndex);
        if (existingTower) {
          existingTower.destroy();
          this.towers.delete(slot.slotIndex);
        }
      }
    });

    // Listen to phase changes to start combat
    // This needs to be handled by the room connection in GameScene
    // For now, we'll check phase periodically or add a listener if available
  }

  private renderServerTower(tower: any, slot: { slotIndex: number; x: number; y: number }): void {
    const sprite = this.scene.add.sprite(slot.x, slot.y, "tower_archer")
      .setOrigin(0.5, 0.82)
      .setDisplaySize(135, 135)
      .setDepth(DEPTH.TOWERS_LAYER + slot.y * 0.001);

    this.towers.set(slot.slotIndex, sprite);
    this.root?.add(sprite);
  }

  startCombat(): void {
    this.phaseBanner?.destroy();
    this.phaseBanner = undefined;
    this.startButton?.destroy();
    this.startButton = undefined;
    this.startUnitSpawner();
  }

  private startUnitSpawner(): void {
    const spawnUnit = (path: Phaser.Curves.Path, delay: number) => {
      this.scene.time.delayedCall(delay, () => {
        const point = path.getPoint(0);
        const unit = this.scene.add.sprite(point.x, point.y, "unit_warrior")
          .setOrigin(0.5, 0.78)
          .setDisplaySize(64, 64)
          .setDepth(DEPTH.UNITS_LAYER + point.y * 0.001);

        this.units.push(unit);
        this.root?.add(unit);

        // Animate along path
        const tween = this.scene.tweens.add({
          targets: { t: 0 },
          t: 1,
          duration: 8000,
          onUpdate: () => {
            const progress = (tween as any).targets[0].t;
            const newPoint = path.getPoint(progress);
            unit.setPosition(newPoint.x, newPoint.y);
            unit.setDepth(DEPTH.UNITS_LAYER + newPoint.y * 0.001);

            // Flip based on direction
            const prevPoint = path.getPoint(Math.max(0, progress - 0.01));
            unit.setFlipX(newPoint.x < prevPoint.x);

            // Walking bob
            unit.y += Math.sin(progress * Math.PI * 10) * 2;
          },
          onComplete: () => {
            unit.destroy();
            this.units = this.units.filter(u => u !== unit);
          }
        });
      });
    };

    // Spawn units on both paths
    if (this.topPath) spawnUnit(this.topPath, 500);
    if (this.bottomPath) spawnUnit(this.bottomPath, 1500);

    // Continuously spawn units
    this.scene.time.addEvent({
      delay: 3000,
      callback: () => {
        if (this.topPath) spawnUnit(this.topPath, 0);
        if (this.bottomPath) spawnUnit(this.bottomPath, 1000);
      },
      loop: true
    });
  }

  destroy(): void {
    this.root?.destroy(true);
    this.debugGraphics?.destroy();
    this.towers.clear();
    this.units.forEach(u => u.destroy());
    this.units = [];
    this.deckCards.clear();
  }
}

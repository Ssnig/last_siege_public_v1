import Phaser from "phaser";
import { type MapDefinition, TOWER_TYPES, MESSAGES } from "@root/shared";

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

export class GameplayStage {
  private scene: Phaser.Scene;
  private map: MapDefinition;
  private root?: Phaser.GameObjects.Container;
  private debugGraphics?: Phaser.GameObjects.Graphics;
  private showDebug = false;
  private towers: Map<number, Phaser.GameObjects.Sprite> = new Map();
  private units: Phaser.GameObjects.Sprite[] = [];
  private spawnEvents: Phaser.Time.TimerEvent[] = [];
  private spawnTimeouts: Phaser.Time.TimerEvent[] = [];
  private topPath?: Phaser.Curves.Path;
  private bottomPath?: Phaser.Curves.Path;
  private defenderDeck?: string[];
  private selectedTowerType?: string;
  private room?: any; // Colyseus Room
  private deckCards: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private ghostTower?: Phaser.GameObjects.Sprite;
  private phaseBanner?: Phaser.GameObjects.Container;
  private goldText?: Phaser.GameObjects.Text;
  private gold: number;
  private myRole?: "attacker" | "defender";
  private startButton?: Phaser.GameObjects.Container;
  private topPortal?: Phaser.GameObjects.Sprite;
  private bottomPortal?: Phaser.GameObjects.Sprite;
  private isCombat = false;

  constructor(
    scene: Phaser.Scene,
    map: MapDefinition,
    defenderDeck?: string[],
    room?: any,
    gold: number = 200,
    myRole?: "attacker" | "defender"
  ) {
    this.scene = scene;
    this.map = map;
    this.defenderDeck = defenderDeck;
    this.room = room;
    this.gold = gold;
    this.myRole = myRole;

    if (this.defenderDeck && this.defenderDeck.length > 0) {
      this.selectedTowerType = this.defenderDeck[0];
    }
  }

  create(): void {
    this.render();
    this.setupPortals();
    this.setupDebugControls();

    if (this.myRole === "defender") {
      this.renderTowerDeck();
      this.renderStartButton();
    }
    this.renderPhaseBanner();
    this.setupTowerSync();
  }

  updateEconomy(gold: number, deck?: string[]): void {
    this.gold = gold;
    if (deck && deck.length > 0) {
      this.defenderDeck = deck;
      if (!this.selectedTowerType) {
        this.selectedTowerType = deck[0];
      }
    }

    if (this.goldText) {
      this.goldText.setText(`GOLD: ${this.gold}g`);
    }

    // If deck was received after stage creation, render deck
    if (this.myRole === "defender" && this.deckCards.size === 0 && this.defenderDeck && this.defenderDeck.length > 0) {
      this.renderTowerDeck();
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
    this.topPortal = this.scene.add.sprite(52, 112, "spawn_2")
      .setOrigin(0.5, 0.72)
      .setDisplaySize(130, 130)
      .setDepth(DEPTH.PORTAL_LAYER + 112 * 0.001)
      .play("portal_spin");
    this.root?.add(this.topPortal);

    // Bottom path portal at { x: 52, y: 583 }
    this.bottomPortal = this.scene.add.sprite(52, 583, "spawn_2")
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
      const bg = this.scene.add.image(0, 0, "konbaung")
        .setOrigin(0, 0)
        .setDisplaySize(this.map.width || 1280, this.map.height || 720)
        .setDepth(DEPTH.MAP_BG);
      this.root.add(bg);
    }

    // Create path curves from map data
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

    // Render interactive tower slots (radius 36)
    this.map.slots.forEach(slot => {
      const placeholder = this.scene.add.circle(
        slot.x, slot.y, 36, 0x8b4513, 0.5
      ).setDepth(DEPTH.SLOTS_LAYER);

      if (this.myRole === "defender") {
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
      const baseCastle = this.scene.add.sprite(
        this.map.base.x,
        this.map.base.y,
        "base_castle"
      )
        .setOrigin(0.5, 0.62)
        .setDisplaySize(310, 310)
        .setDepth(DEPTH.BASE_LAYER);
      this.root.add(baseCastle);

      // Render floating base HP bar above castle
      const hpBarWidth = 120;
      const hpBarHeight = 10;
      const hpBarX = this.map.base.x;
      const hpBarY = this.map.base.y - 170;

      const hpBarBorder = this.scene.add.rectangle(
        hpBarX, hpBarY, hpBarWidth + 4, hpBarHeight + 4, 0x0f172a, 0.8
      ).setOrigin(0.5).setStrokeStyle(1, 0x334155).setDepth(DEPTH.BASE_LAYER + 0.1);

      const hpBarBg = this.scene.add.rectangle(
        hpBarX, hpBarY, hpBarWidth, hpBarHeight, 0x1e293b
      ).setOrigin(0.5).setDepth(DEPTH.BASE_LAYER + 0.2);

      const hpBarFill = this.scene.add.rectangle(
        hpBarX - hpBarWidth / 2, hpBarY, hpBarWidth, hpBarHeight, 0x22c55e
      ).setOrigin(0, 0.5).setDepth(DEPTH.BASE_LAYER + 0.3);

      const hpText = this.scene.add.text(
        hpBarX, hpBarY - 14, "BASE CASTLE: 10/10 HP",
        { fontSize: "11px", color: "#f8fafc", fontStyle: "bold" }
      ).setOrigin(0.5).setDepth(DEPTH.BASE_LAYER + 0.4);

      this.root.add([hpBarBorder, hpBarBg, hpBarFill, hpText]);
    } else if (this.map.base) {
      const base = this.scene.add.circle(
        this.map.base.x, this.map.base.y, 50, 0xff0000, 0.3
      ).setDepth(DEPTH.BASE_LAYER);
      this.root.add(base);
    }
  }

  private setupDebugControls(): void {
    this.scene.input.keyboard?.on("keydown-D", () => {
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
      this.debugGraphics.lineStyle(3, 0x22c55e, 0.7);
      this.topPath.draw(this.debugGraphics);
    }

    // Draw bottom path
    if (this.bottomPath) {
      this.debugGraphics.lineStyle(3, 0x22c55e, 0.7);
      this.bottomPath.draw(this.debugGraphics);
    }
  }

  private handleSlotClick(slot: { slotIndex: number; x: number; y: number }): void {
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

    // Send placement intent to server - authoritative sync creates the tower sprite
    if (this.room) {
      this.room.send(MESSAGES.placeTower, {
        typeId: this.selectedTowerType,
        slotIndex: slot.slotIndex,
      });
    }
  }

  private renderTowerDeck(): void {
    if (!this.defenderDeck || this.defenderDeck.length === 0) return;

    // Clean up previous deck elements if any
    this.deckCards.clear();

    const deckX = 24;
    const deckY = 665;
    const cardWidth = 84;
    const cardHeight = 84;
    const gap = 12;

    // Render gold display
    this.goldText?.destroy();
    this.goldText = this.scene.add.text(
      deckX, deckY - 50, `GOLD: ${this.gold}g`,
      { fontSize: "15px", color: "#fbbf24", fontStyle: "bold" }
    ).setOrigin(0, 0.5).setDepth(DEPTH.UI_LAYER);
    this.root?.add(this.goldText);

    this.defenderDeck.forEach((towerId, index) => {
      const tower = TOWER_TYPES[towerId];
      if (!tower) return;

      const x = deckX + index * (cardWidth + gap);
      const isSelected = this.selectedTowerType === towerId;

      const card = this.scene.add.rectangle(
        x, deckY, cardWidth, cardHeight, 0x1e293b
      ).setStrokeStyle(2, isSelected ? 0x4ade80 : 0x475569)
        .setInteractive({ useHandCursor: true })
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

      const label = this.scene.add.text(
        x, deckY - 26, tower.name.substring(0, 10),
        { fontSize: "11px", color: "#f8fafc", fontStyle: "bold" }
      ).setOrigin(0.5).setDepth(DEPTH.UI_LAYER);

      const tierCost = tower.tiers[0]?.cost ?? 0;
      const costLabel = this.scene.add.text(
        x, deckY + 28, `${tierCost}g`,
        { fontSize: "12px", color: "#fbbf24", fontStyle: "bold" }
      ).setOrigin(0.5).setDepth(DEPTH.UI_LAYER);

      this.root?.add([card, label, costLabel]);
    });
  }

  private renderStartButton(): void {
    const buttonX = 1150;
    const buttonY = 35;
    const buttonWidth = 140;
    const buttonHeight = 44;

    this.startButton = this.scene.add.container(buttonX, buttonY);

    const bg = this.scene.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x10b981)
      .setStrokeStyle(2, 0x34d399)
      .setInteractive({ useHandCursor: true });

    const text = this.scene.add.text(0, 0, "START GAME ▶", {
      fontSize: "14px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    bg.on("pointerover", () => bg.setFillStyle(0x059669));
    bg.on("pointerout", () => bg.setFillStyle(0x10b981));
    bg.on("pointerdown", () => {
      if (this.room) {
        this.room.send(MESSAGES.startCombat, {});
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
    const bannerY = 35;

    this.phaseBanner = this.scene.add.container(bannerX, bannerY);

    const bg = this.scene.add.rectangle(0, 0, 460, 46, 0x1e293b, 0.9)
      .setStrokeStyle(2, 0x6366f1);

    const bannerText = this.myRole === "defender"
      ? "BUILDING PHASE — Place Your Towers"
      : "BUILDING PHASE — Defender is setting up defenses";

    const text = this.scene.add.text(0, 0, bannerText, {
      fontSize: "15px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    this.phaseBanner.add([bg, text]);
    this.phaseBanner.setDepth(DEPTH.UI_LAYER);
    this.root?.add(this.phaseBanner);
  }

  private setupTowerSync(): void {
    if (!this.room?.state?.towers) return;

    // Sync any pre-existing towers in state
    this.room.state.towers.forEach((tower: any) => {
      const slot = this.map.slots.find(s => s.slotIndex === tower.slotIndex);
      if (slot && !this.towers.has(slot.slotIndex)) {
        this.renderServerTower(tower, slot);
      }
    });

    // Listen to tower additions (syncs to both players)
    this.room.state.towers.onAdd((tower: any) => {
      console.log("Tower added to state:", tower);
      const slot = this.map.slots.find(s => s.slotIndex === tower.slotIndex);
      if (slot && !this.towers.has(slot.slotIndex)) {
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
  }

  private renderServerTower(_tower: any, slot: { slotIndex: number; x: number; y: number }): void {
    if (this.towers.has(slot.slotIndex)) return;

    const sprite = this.scene.add.sprite(slot.x, slot.y, "tower_archer")
      .setOrigin(0.5, 0.82)
      .setDisplaySize(135, 135)
      .setDepth(DEPTH.TOWERS_LAYER + slot.y * 0.001);

    this.towers.set(slot.slotIndex, sprite);
    this.root?.add(sprite);
  }

  startCombat(): void {
    if (this.isCombat) return;
    this.isCombat = true;

    this.phaseBanner?.destroy();
    this.phaseBanner = undefined;
    this.startButton?.destroy();
    this.startButton = undefined;

    // Show combat alert banner
    const banner = this.scene.add.container(640, 35);
    const bg = this.scene.add.rectangle(0, 0, 420, 46, 0x7f1d1d, 0.9)
      .setStrokeStyle(2, 0xef4444);
    const txt = this.scene.add.text(0, 0, "⚔️ COMBAT PHASE — Units Advancing!", {
      fontSize: "15px",
      color: "#fef2f2",
      fontStyle: "bold",
    }).setOrigin(0.5);
    banner.add([bg, txt]);
    banner.setDepth(DEPTH.UI_LAYER);
    this.root?.add(banner);

    this.scene.time.delayedCall(4000, () => {
      banner.destroy();
    });

    this.startUnitSpawner();
  }

  private startUnitSpawner(): void {
    const spawnUnit = (path: Phaser.Curves.Path, delay: number) => {
      const timer = this.scene.time.delayedCall(delay, () => {
        if (!this.root || !this.isCombat) return;
        const startPoint = path.getPoint(0);
        const unit = this.scene.add.sprite(startPoint.x, startPoint.y, "unit_warrior")
          .setOrigin(0.5, 0.78)
          .setDisplaySize(0, 0)
          .setDepth(DEPTH.UNITS_LAYER + startPoint.y * 0.001);

        this.units.push(unit);
        this.root?.add(unit);

        // Quick scale-in tween as unit emerges from portal
        this.scene.tweens.add({
          targets: unit,
          displayWidth: 64,
          displayHeight: 64,
          duration: 350,
          ease: "Back.easeOut",
        });

        // Animate along path
        const pathTween = this.scene.tweens.add({
          targets: { t: 0 },
          t: 1,
          duration: 10000,
          onUpdate: () => {
            if (!unit.active) return;
            const progress = (pathTween as any).targets[0].t;
            const newPoint = path.getPoint(progress);
            unit.setPosition(newPoint.x, newPoint.y);
            unit.setDepth(DEPTH.UNITS_LAYER + newPoint.y * 0.001);

            // Flip based on direction
            const prevPoint = path.getPoint(Math.max(0, progress - 0.005));
            if (Math.abs(newPoint.x - prevPoint.x) > 0.05) {
              unit.setFlipX(newPoint.x < prevPoint.x);
            }

            // Walking bob
            unit.y += Math.sin(progress * Math.PI * 16) * 1.5;
          },
          onComplete: () => {
            unit.destroy();
            this.units = this.units.filter(u => u !== unit);
          }
        });
      });
      this.spawnTimeouts.push(timer);
    };

    // Spawn initial waves from both portals
    if (this.topPath) {
      spawnUnit(this.topPath, 400);
      spawnUnit(this.topPath, 1800);
    }
    if (this.bottomPath) {
      spawnUnit(this.bottomPath, 1100);
      spawnUnit(this.bottomPath, 2500);
    }

    // Continuously spawn units every 3.5 seconds
    const loopEvent = this.scene.time.addEvent({
      delay: 3500,
      callback: () => {
        if (!this.isCombat) return;
        if (this.topPath) spawnUnit(this.topPath, 0);
        if (this.bottomPath) spawnUnit(this.bottomPath, 1200);
      },
      loop: true,
    });
    this.spawnEvents.push(loopEvent);
  }

  destroy(): void {
    this.isCombat = false;
    this.spawnEvents.forEach(e => e.remove(false));
    this.spawnEvents = [];
    this.spawnTimeouts.forEach(t => t.remove(false));
    this.spawnTimeouts = [];

    this.root?.destroy(true);
    this.debugGraphics?.destroy();
    this.towers.clear();
    this.units.forEach(u => u.destroy());
    this.units = [];
    this.deckCards.clear();
    this.topPortal?.destroy();
    this.bottomPortal?.destroy();
    this.phaseBanner?.destroy();
    this.startButton?.destroy();
  }
}

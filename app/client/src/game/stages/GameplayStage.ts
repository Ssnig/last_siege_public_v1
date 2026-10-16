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

  private ghostTower?: Phaser.GameObjects.Sprite;
  private topPortal?: Phaser.GameObjects.Sprite;
  private bottomPortal?: Phaser.GameObjects.Sprite;
  private combatBanner?: Phaser.GameObjects.Container;

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
    this.setupCameraControls();
    this.setupDebugControls();
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
  }

  updateEconomy(gold: number, deck?: string[]): void {
    this.applyEconomy({
      gold,
      deck: deck ?? this.deck,
      bigWavesRemaining: 0,
    });
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
        placeholder.on("pointerdown", () => {
          this.isTouchingSlot = true;
          this.handleSlotClick(slot);
        });
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
      this.selectedTowerType
    );
  }

  private handleSlotClick(slot: TowerSlot): void {
    if (this.towers.has(slot.slotIndex)) {
      console.log(`Slot ${slot.slotIndex} already occupied`);
      return;
    }
    const typeId = this.getActiveTowerType();
    if (!typeId) {
      console.log("No tower type selected");
      return;
    }

    const towerType = TOWER_TYPES[typeId];
    const cost = towerType?.tiers[0]?.cost ?? 0;
    if (this.gold < cost) {
      console.log(`Not enough gold: need ${cost}, have ${this.gold}`);
      return;
    }

    this.hideGhostTower();

    console.log(
      `Sending place_tower for slot ${slot.slotIndex}, type: ${typeId}`,
    );
    this.room.send(MESSAGES.placeTower, {
      typeId,
      slotIndex: slot.slotIndex,
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

    // Show combat alert banner fixed to camera screen space
    this.combatBanner = this.scene.add.container(640, 35).setScrollFactor(0);
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
    this.combatBanner.add([bg, txt]);
    this.combatBanner.setDepth(DEPTH.UI_LAYER);

    this.scene.time.delayedCall(4000, () => {
      this.combatBanner?.destroy();
      this.combatBanner = undefined;
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

    this.topPortal?.destroy();
    this.bottomPortal?.destroy();
    this.combatBanner?.destroy();
    this.combatBanner = undefined;

    this.root?.destroy(true);
    this.root = undefined;

    this.towers.clear();
    this.units = [];
  }
}

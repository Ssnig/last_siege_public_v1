import Phaser from "phaser";
import {
  type Tower,
  type TowerSlot,
  getTowerDesign,
  type TowerDesignConfig,
} from "@root/shared";

export const DEPTH = {
  SLOTS_LAYER: 2,
  ACTORS_LAYER: 10,
} as const;

export const actorDepth = (y: number): number => DEPTH.ACTORS_LAYER + y * 0.001;

export interface TowerRecord {
  id: string;
  tower: Tower;
  sprite: Phaser.GameObjects.Sprite;
  levelBadge?: Phaser.GameObjects.Container;
}

export interface TowerHolderOptions {
  scene: Phaser.Scene;
  slot: TowerSlot;
  parentContainer?: Phaser.GameObjects.Container;
  actorsContainer?: Phaser.GameObjects.Container;
  getActorsContainer?: () => Phaser.GameObjects.Container | undefined;
  role: "attacker" | "defender";
  getActiveTowerType: () => string | undefined;
  onClick: (holder: TowerHolder) => void;
  onHover?: (holder: TowerHolder, over: boolean) => void;
}

/**
 * First-class physical Tower Holder (Placeholder Dais) on the battlefield.
 *
 * @remarks
 * Encapsulates the authentic Burmese stone lotus dais foundation,
 * interactive hitbox, ghost preview on hover, and directly holds the
 * mounted tower entity (sprite, level badge, range indicator).
 * Moving or transforming the holder automatically moves the mounted tower.
 */
export class TowerHolder {
  readonly scene: Phaser.Scene;
  readonly slotIndex: number;
  x: number;
  y: number;

  private parentContainer?: Phaser.GameObjects.Container;
  private actorsContainer?: Phaser.GameObjects.Container;
  private getActorsContainer?: () => Phaser.GameObjects.Container | undefined;
  private role: "attacker" | "defender";
  private getActiveTowerType: () => string | undefined;
  private onClickCallback: (holder: TowerHolder) => void;
  private onHoverCallback?: (holder: TowerHolder, over: boolean) => void;

  private daisSprite?: Phaser.GameObjects.Image;
  private hitbox: Phaser.GameObjects.Arc;
  private mountedRecord?: TowerRecord;
  private ghostSprite?: Phaser.GameObjects.Sprite;
  private rangeCircle?: Phaser.GameObjects.Arc;

  constructor(options: TowerHolderOptions) {
    this.scene = options.scene;
    this.slotIndex = options.slot.slotIndex;
    this.x = options.slot.x;
    this.y = options.slot.y;
    this.parentContainer = options.parentContainer;
    this.actorsContainer = options.actorsContainer;
    this.getActorsContainer = options.getActorsContainer;
    this.role = options.role;
    this.getActiveTowerType = options.getActiveTowerType;
    this.onClickCallback = options.onClick;
    this.onHoverCallback = options.onHover;

    // 1. Foundation Dais: High-fidelity Burmese lotus stone dais (52x40px)
    if (this.scene.textures.exists("tower_placeholder_1")) {
      this.daisSprite = this.scene.add
        .image(this.x, this.y, "tower_placeholder_1")
        .setDisplaySize(52, 40)
        .setDepth(DEPTH.SLOTS_LAYER)
        .setName(`tower-holder-dais-${this.slotIndex}`);
      this.parentContainer?.add(this.daisSprite);
    }

    // 2. Interactive Hitbox: radius 24 circle
    this.hitbox = this.scene.add
      .circle(this.x, this.y, 24, 0x000000, 0.001)
      .setDepth(DEPTH.SLOTS_LAYER + 0.01)
      .setName(`tower-holder-hitbox-${this.slotIndex}`);
    this.hitbox.setData("slotIndex", this.slotIndex);
    this.parentContainer?.add(this.hitbox);

    this.setupInteractivity();
  }

  private setupInteractivity(): void {
    this.hitbox.setInteractive({ useHandCursor: this.role === "defender" });

    this.hitbox.on("pointerover", () => {
      this.scene.registry.set("ui:overTowerSlot", true);
      this.onHoverCallback?.(this, true);

      if (this.role === "defender" && !this.mountedRecord) {
        this.daisSprite?.setTint(0xffe082);
        const activeType = this.getActiveTowerType();
        if (activeType) {
          this.showGhost(activeType);
        }
      }
    });

    this.hitbox.on("pointerout", () => {
      this.scene.registry.set("ui:overTowerSlot", false);
      this.onHoverCallback?.(this, false);
      this.daisSprite?.clearTint();
      this.hideGhost();
    });

    this.hitbox.on(
      "pointerdown",
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData
      ) => {
        this.scene.registry.set("ui:overTowerSlot", true);
        event?.stopPropagation();
        this.onClickCallback(this);
      }
    );
  }

  /** Mounts a tower directly into this holder */
  mount(id: string, tower: Tower): TowerRecord {
    if (this.mountedRecord) {
      this.unmount();
    }
    this.hideGhost();

    const design = getTowerDesign(tower.typeId);

    // Tower sprite seated atop the foundation dais
    const sprite = this.scene.add
      .sprite(this.x, this.y, design.textureKey)
      .setOrigin(design.origin.x, design.origin.y)
      .setDisplaySize(design.displaySize.width, design.displaySize.height)
      .setDepth(actorDepth(this.y));

    // Dynamic level badge placed cleanly right above tower roof
    const levelBadge = this.createTowerLevelBadge(tower.level, design);

    // Clicking the tower sprite delegates to the holder click
    sprite.setInteractive({ useHandCursor: true });
    sprite.on(
      "pointerdown",
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation();
        this.onClickCallback(this);
      }
    );

    const record: TowerRecord = { id, tower, sprite, levelBadge };
    this.mountedRecord = record;

    const actors = this.getActorsContainer?.() ?? this.actorsContainer ?? this.parentContainer;
    actors?.add(sprite);
    if (levelBadge) {
      actors?.add(levelBadge);
    }

    return record;
  }

  /** Unmounts the held tower and restores empty dais foundation */
  unmount(): void {
    if (!this.mountedRecord) return;
    this.mountedRecord.sprite.destroy();
    this.mountedRecord.levelBadge?.destroy();
    this.mountedRecord = undefined;
    this.hideRangeCircle();
  }

  /** Updates the level badge on the held tower */
  updateLevel(level: number): void {
    if (!this.mountedRecord || !this.mountedRecord.levelBadge) return;
    const badge = this.mountedRecord.levelBadge;
    const label = badge.getByName("label") as Phaser.GameObjects.Text | null;
    const bg = badge.getByName("bg") as Phaser.GameObjects.Graphics | null;
    if (label) {
      label.setText(`Lv.${level}`);
      label.setColor(level > 1 ? "#fbbf24" : "#e2e8f0");
    }
    if (bg) {
      this.drawBadgeBg(bg, level, 44, 18);
    }

    // Level-up pop animation
    this.scene.tweens.add({
      targets: badge,
      scaleX: 1.25,
      scaleY: 1.25,
      yoyo: true,
      duration: 120,
    });
  }

  /** Shows a ghost preview of a tower type atop the dais */
  showGhost(typeId: string): void {
    if (this.mountedRecord) return;
    const design = getTowerDesign(typeId);

    if (this.ghostSprite) {
      this.ghostSprite
        .setTexture(design.textureKey)
        .setOrigin(design.origin.x, design.origin.y)
        .setDisplaySize(design.displaySize.width, design.displaySize.height)
        .setPosition(this.x, this.y)
        .setVisible(true);
      return;
    }

    this.ghostSprite = this.scene.add
      .sprite(this.x, this.y, design.textureKey)
      .setOrigin(design.origin.x, design.origin.y)
      .setDisplaySize(design.displaySize.width, design.displaySize.height)
      .setAlpha(0.55)
      .setDepth(actorDepth(this.y));

    const actors = this.getActorsContainer?.() ?? this.actorsContainer ?? this.parentContainer;
    actors?.add(this.ghostSprite);
  }

  /** Hides ghost preview */
  hideGhost(): void {
    if (this.ghostSprite) {
      this.ghostSprite.destroy();
      this.ghostSprite = undefined;
    }
  }

  /** Highlights or unhighlights dais */
  setHighlight(enabled: boolean, tint = 0xffe082): void {
    if (enabled) {
      this.daisSprite?.setTint(tint);
    } else {
      this.daisSprite?.clearTint();
    }
  }

  /** Displays selection attack range circle centered on the holder */
  showRangeCircle(range: number): void {
    this.hideRangeCircle();
    this.rangeCircle = this.scene.add
      .circle(this.x, this.y, range, 0x38bdf8, 0.12)
      .setStrokeStyle(2, 0x38bdf8, 0.85);
    this.parentContainer?.add(this.rangeCircle);
  }

  /** Hides selection attack range circle */
  hideRangeCircle(): void {
    if (this.rangeCircle) {
      this.rangeCircle.destroy();
      this.rangeCircle = undefined;
    }
  }

  /** Relocates the entire holder and all held entities */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;

    this.daisSprite?.setPosition(x, y);
    this.hitbox.setPosition(x, y);

    if (this.mountedRecord) {
      const design = getTowerDesign(this.mountedRecord.tower.typeId);
      this.mountedRecord.sprite.setPosition(x, y).setDepth(actorDepth(y));

      if (this.mountedRecord.levelBadge) {
        const topY = y - design.displaySize.height * design.origin.y;
        this.mountedRecord.levelBadge
          .setPosition(x, topY - 12)
          .setDepth(actorDepth(y) + 0.0002);
      }
    }

    if (this.ghostSprite) {
      this.ghostSprite.setPosition(x, y).setDepth(actorDepth(y));
    }

    if (this.rangeCircle) {
      this.rangeCircle.setPosition(x, y);
    }
  }

  isOccupied(): boolean {
    return !!this.mountedRecord;
  }

  getMounted(): TowerRecord | undefined {
    return this.mountedRecord;
  }

  getTower(): Tower | undefined {
    return this.mountedRecord?.tower;
  }

  getTowerSprite(): Phaser.GameObjects.Sprite | undefined {
    return this.mountedRecord?.sprite;
  }

  toSlot(): TowerSlot {
    return { slotIndex: this.slotIndex, x: this.x, y: this.y };
  }

  private createTowerLevelBadge(
    level: number,
    design: TowerDesignConfig
  ): Phaser.GameObjects.Container {
    const topY = this.y - design.displaySize.height * design.origin.y;
    const badge = this.scene.add.container(this.x, topY - 12);
    badge.setDepth(actorDepth(this.y) + 0.0002);

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

  private drawBadgeBg(
    bg: Phaser.GameObjects.Graphics,
    level: number,
    w: number,
    h: number
  ): void {
    bg.clear();
    bg.fillStyle(0x090d16, 0.88);
    bg.lineStyle(1.2, level > 1 ? 0xf59e0b : 0x475569, 0.9);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
  }

  destroy(): void {
    this.unmount();
    this.hideGhost();
    this.hideRangeCircle();
    this.daisSprite?.destroy();
    this.hitbox.destroy();
  }
}

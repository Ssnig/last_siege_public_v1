
import Phaser from "phaser";
import { getTowerDesign, type TowerType } from "@root/shared";
import { UI_TEXTURE_KEY } from "./uiAtlas";
import { createDamageBadge } from "./damageBadge";

/**
 * Selectable portrait card for one defender tower archetype.
 *
 * @remarks
 * Selection is owned by the draft stage. The card only renders that state.
 * The card body and info button use independent hit areas to prevent an info
 * click from accidentally selecting the tower.
 *
 * The background art comes from the shared UI atlas: `card` normally and
 * `cardSelected` (gold border) while selected. A texture named
 * `tower-${tower.id}` is used as the portrait when loaded; otherwise, a
 * colored placeholder keeps the card usable while artwork is being created.
 */
export interface TowerCardOptions {
  /**
   * Replaces the tower name with this text and hides the available/selected
   * status line. Used by the gameplay deck to show only the gold cost.
   */
  label?: string;
}

export class TowerCard {
  readonly container: Phaser.GameObjects.Container;
  readonly tower: TowerType;

  private readonly background: Phaser.GameObjects.Image;
  private readonly hitArea: Phaser.GameObjects.Zone;
  private readonly statusText?: Phaser.GameObjects.Text;
  private readonly cardWidth: number;
  private readonly cardHeight: number;
  private selected = false;

  /**
   * @param scene - Scene that owns the card's display objects.
   * @param x - Card left edge in scene coordinates.
   * @param y - Card top edge in scene coordinates.
   * @param width - Card width in pixels.
   * @param height - Card height in pixels.
   * @param tower - Immutable tower catalog entry.
   * @param onSelect - Called when the card body is clicked.
   * @param onInfo - Called when its info button is clicked. When omitted, the
   * info button is not rendered (for read-only card strips).
   * @param options - Optional label override (see {@link TowerCardOptions}).
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    tower: TowerType,
    onSelect: (tower: TowerType) => void,
    onInfo?: (tower: TowerType) => void,
    options?: TowerCardOptions,
  ) {
    this.tower = tower;
    this.cardWidth = width;
    this.cardHeight = height;
    this.container = scene.add.container(x, y);

    this.background = scene.add
      .image(0, 0, UI_TEXTURE_KEY, "card")
      .setOrigin(0, 0)
      .setDisplaySize(width, height);

    this.hitArea = scene.add
      .zone(0, 0, width, height)
      .setOrigin(0, 0)
      .setInteractive(
        new Phaser.Geom.Rectangle(0, 0, width, height),
        Phaser.Geom.Rectangle.Contains,
      );

    this.hitArea.on("pointerover", () => {
      if (!this.selected) this.background.setTint(0xdfe6ff);
    });
    this.hitArea.on("pointerout", () => this.refresh());
    this.hitArea.on("pointerdown", () => onSelect(this.tower));

    this.container.add([this.background, this.hitArea]);

    if (onInfo) {
      const infoRadius = Math.max(11, Math.min(15, width * 0.09));
      const infoX = width - infoRadius - 10;
      const infoY = infoRadius + 10;

      const infoCircle = scene.add
        .circle(infoX, infoY, infoRadius, 0x334155)
        .setStrokeStyle(1, 0x94a3b8)
        .setInteractive();

      const infoLabel = scene.add
        .text(infoX, infoY - 1, "i", {
          fontSize: `${Math.max(13, infoRadius + 3)}px`,
          fontStyle: "bold",
          color: "#ffffff",
        })
        .setOrigin(0.5);

      infoCircle.on("pointerover", () => infoCircle.setFillStyle(0x6366f1));
      infoCircle.on("pointerout", () => infoCircle.setFillStyle(0x334155));
      infoCircle.on("pointerdown", () => onInfo(this.tower));

      this.container.add([infoCircle, infoLabel]);
    }

    const portraitHeight = Math.max(30, height * 0.46);
    const portraitWidth = Math.min(width * 0.66, portraitHeight * 0.9);
    const portraitX = width / 2;
    const portraitY = Math.max(12, height * 0.1) + portraitHeight / 2;

    const design = getTowerDesign(tower.id);
    const textureKey = scene.textures.exists(`tower-${tower.id}`)
      ? `tower-${tower.id}`
      : `tower-${design.id}`;

    if (scene.textures.exists(textureKey)) {
      const sprite = scene.add
        .image(portraitX, portraitY, textureKey)
        .setDisplaySize(portraitWidth * 0.86, portraitHeight * 0.86);

      this.container.add(sprite);
    } else {
      // Temporary tower silhouette until the real artwork is loaded.
      const color = this.getColor(tower.id);
      const base = scene.add.rectangle(
        portraitX,
        portraitY + portraitHeight * 0.2,
        portraitWidth * 0.66,
        portraitHeight * 0.16,
        color,
      );
      const body = scene.add.rectangle(
        portraitX,
        portraitY,
        portraitWidth * 0.44,
        portraitHeight * 0.42,
        color,
      );
      const roof = scene.add.triangle(
        portraitX,
        portraitY - portraitHeight * 0.2,
        0,
        -portraitHeight * 0.18,
        portraitWidth * 0.3,
        portraitHeight * 0.12,
        -portraitWidth * 0.3,
        portraitHeight * 0.12,
        color,
      );

      this.container.add([base, body, roof]);
    }

    const showStatus = options?.label === undefined;
    const nameText = scene.add
      .text(width / 2, height * (showStatus ? 0.72 : 0.76), options?.label ?? tower.name, {
        fontSize: `${Math.max(12, Math.min(18, width * 0.11))}px`,
        fontStyle: "bold",
        color: "#2b1a08",
        align: "center",
        wordWrap: { width: width - 12 },
      })
      .setOrigin(0.5);

    this.container.add(nameText);

    // Damage-type badge on the card border, top-left (the info button owns the
    // top-right corner).
    const badgeSize = Math.max(12, Math.min(20, width * 0.16));
    const badge = createDamageBadge(
      scene,
      tower.damageType ?? "physical",
      badgeSize,
    );
    badge.setPosition(badgeSize / 2 - 2, badgeSize / 2 - 2);
    this.container.add(badge);

    if (showStatus) {
      this.statusText = scene.add
        .text(width / 2, height * 0.84, "AVAILABLE", {
          fontSize: `${Math.max(9, Math.min(11, width * 0.07))}px`,
          fontStyle: "bold",
          color: "#5f3f22",
          align: "center",
        })
        .setOrigin(0.5);

      this.container.add(this.statusText);
    }
  }

  /**
   * Updates visual selection state without changing draft data.
   *
   * @param selected - Whether this tower is in the selected deck.
   */
  setSelected(selected: boolean): void {
    this.selected = selected;
    this.refresh();
  }

  /** Synchronizes card colors and label with the current selection state. */
  private refresh(): void {
    this.background
      .setTexture(UI_TEXTURE_KEY, this.selected ? "cardSelected" : "card")
      .setDisplaySize(this.cardWidth, this.cardHeight)
      .clearTint();

    this.statusText
      ?.setText(this.selected ? "SELECTED" : "AVAILABLE")
      .setColor(this.selected ? "#14532d" : "#5f3f22");
  }

  /**
   * Provides a placeholder color until real tower art is available.
   *
   * @param id - Stable tower catalog ID.
   * @returns Hexadecimal presentation color.
   */
  private getColor(id: string): number {
    const colors: Record<string, number> = {
      basic: 0x60a5fa,
      cannon: 0xf97316,
    };

    return colors[id] ?? 0xa78bfa;
  }

  /** Releases the card and its child objects. Do not reuse afterward. */
  destroy(): void {
    this.container.destroy(true);
  }
}

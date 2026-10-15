
import Phaser from "phaser";
import type { TowerType } from "@root/shared";

/**
 * Selectable portrait card for one defender tower archetype.
 *
 * @remarks
 * Selection is owned by the draft stage. The card only renders that state.
 * The card body and info button use independent hit areas to prevent an info
 * click from accidentally selecting the tower.
 *
 * A texture named `tower-${tower.id}` is used when loaded; otherwise, a
 * colored placeholder keeps the card usable while artwork is being created.
 */
export class TowerCard {
  readonly container: Phaser.GameObjects.Container;
  readonly tower: TowerType;

  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly statusText: Phaser.GameObjects.Text;
  private selected = false;

  /**
   * @param scene - Scene that owns the card's display objects.
   * @param x - Card left edge in scene coordinates.
   * @param y - Card top edge in scene coordinates.
   * @param width - Card width in pixels.
   * @param height - Card height in pixels.
   * @param tower - Immutable tower catalog entry.
   * @param onSelect - Called when the card body is clicked.
   * @param onInfo - Called when its info button is clicked.
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    tower: TowerType,
    onSelect: (tower: TowerType) => void,
    onInfo: (tower: TowerType) => void,
  ) {
    this.tower = tower;
    this.container = scene.add.container(x, y);

    this.background = scene.add
      .rectangle(0, 0, width, height, 0x172033)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x334155)
      .setInteractive(
        new Phaser.Geom.Rectangle(0, 0, width, height),
        Phaser.Geom.Rectangle.Contains,
      );

    this.background.on("pointerover", () => {
      if (!this.selected) this.background.setStrokeStyle(2, 0x818cf8);
    });
    this.background.on("pointerout", () => this.refresh());
    this.background.on("pointerdown", () => onSelect(this.tower));

    this.container.add(this.background);

    const infoRadius = Math.max(11, Math.min(15, width * 0.09));
    const infoX = width - infoRadius - 10;
    const infoY = infoRadius + 10;

    const infoCircle = scene.add
      .circle(infoX, infoY, infoRadius, 0x334155)
      .setStrokeStyle(1, 0x94a3b8)
      .setInteractive(
        new Phaser.Geom.Circle(0, 0, infoRadius + 5),
        Phaser.Geom.Circle.Contains,
      );

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

    const portraitHeight = Math.max(30, height * 0.58);
    const portraitWidth = Math.min(width * 0.72, portraitHeight * 0.9);
    const portraitX = width / 2;
    const portraitY = Math.max(12, height * 0.08) + portraitHeight / 2;

    const frame = scene.add
      .rectangle(
        portraitX,
        portraitY,
        portraitWidth,
        portraitHeight,
        0x222f45,
      )
      .setStrokeStyle(1, 0x3b4b65);

    this.container.add(frame);

    const textureKey = `tower-${tower.id}`;

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

    const nameText = scene.add
      .text(width / 2, height - 36, tower.name, {
        fontSize: `${Math.max(12, Math.min(18, width * 0.11))}px`,
        fontStyle: "bold",
        color: "#f8fafc",
        align: "center",
        wordWrap: { width: width - 12 },
      })
      .setOrigin(0.5);

    this.statusText = scene.add
      .text(width / 2, height - 14, "AVAILABLE", {
        fontSize: `${Math.max(9, Math.min(11, width * 0.07))}px`,
        fontStyle: "bold",
        color: "#94a3b8",
        align: "center",
      })
      .setOrigin(0.5);

    this.container.add([nameText, this.statusText]);
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
      .setFillStyle(this.selected ? 0x173b35 : 0x172033)
      .setStrokeStyle(
        this.selected ? 3 : 2,
        this.selected ? 0x4ade80 : 0x334155,
      );

    this.statusText
      .setText(this.selected ? "SELECTED" : "AVAILABLE")
      .setColor(this.selected ? "#4ade80" : "#94a3b8");
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

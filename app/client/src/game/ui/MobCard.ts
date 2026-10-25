
import Phaser from "phaser";
import type { MobType } from "@root/shared";
import { UI_TEXTURE_KEY } from "./uiAtlas";

/**
 * Portrait card for one attacker archetype.
 *
 * @remarks
 * The parent stage owns selection state; this card only renders it.
 * The card body and info button have separate hit areas so inspecting
 * a mob never accidentally selects or deselects it.
 *
 * The background art comes from the shared UI atlas: `card` normally and
 * `cardSelected` (gold border) while selected. If a texture named
 * `mob-${mob.id}` has been loaded, it is displayed as the portrait. Until
 * then, a simple colored placeholder is used.
 */
export class MobCard {
  readonly container: Phaser.GameObjects.Container;
  readonly mob: MobType;

  private readonly background: Phaser.GameObjects.Image;
  private readonly hitArea: Phaser.GameObjects.Zone;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly cardWidth: number;
  private readonly cardHeight: number;
  private selected = false;

  /**
   * Creates a card and attaches its input handlers.
   *
   * @param scene - Scene that owns the card's game objects.
   * @param x - Card's left edge in scene coordinates.
   * @param y - Card's top edge in scene coordinates.
   * @param width - Card width in pixels.
   * @param height - Card height in pixels.
   * @param mob - Immutable catalog entry represented by this card.
   * @param onSelect - Called when the card body is clicked.
   * @param onInfo - Called when the separate info button is clicked. When
   * omitted, the info button is not rendered (for read-only card strips).
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    mob: MobType,
    onSelect: (mob: MobType) => void,
    onInfo?: (mob: MobType) => void,
  ) {
    this.mob = mob;
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
      if (!this.selected) {
        this.background.setTint(0xdfe6ff);
      }
    });

    this.hitArea.on("pointerout", () => this.refresh());

    this.hitArea.on("pointerdown", () => {
      onSelect(this.mob);
    });

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
      infoCircle.on("pointerdown", () => onInfo(this.mob));

      this.container.add([infoCircle, infoLabel]);
    }

    const portraitTop = Math.max(12, height * 0.1);
    const portraitHeight = Math.max(30, height * 0.46);
    const portraitWidth = Math.min(width * 0.66, portraitHeight * 0.9);
    const portraitX = width / 2;
    const portraitY = portraitTop + portraitHeight / 2;

    const textureKey = scene.textures.exists(`unit-face-${mob.id}`)
      ? `unit-face-${mob.id}`
      : `mob-${mob.id}`;

    if (scene.textures.exists(textureKey)) {
      const sprite = scene.add
        .image(portraitX, portraitY, textureKey)
        .setDisplaySize(portraitWidth * 0.86, portraitHeight * 0.86);

      this.container.add(sprite);
    } else {
      // Placeholder artwork; replace with the loaded mob texture when ready.
      const color = this.getColor(mob.id);
      const headRadius = Math.min(portraitWidth, portraitHeight) * 0.16;

      const head = scene.add.circle(
        portraitX,
        portraitY - portraitHeight * 0.12,
        headRadius,
        color,
      );

      const body = scene.add.ellipse(
        portraitX,
        portraitY + portraitHeight * 0.18,
        headRadius * 3,
        headRadius * 3.2,
        color,
      );

      this.container.add([body, head]);
    }

    const nameText = scene.add
      .text(width / 2, height * 0.72, mob.name, {
        fontSize: `${Math.max(12, Math.min(18, width * 0.11))}px`,
        fontStyle: "bold",
        color: "#2b1a08",
        align: "center",
        wordWrap: { width: width - 16 },
      })
      .setOrigin(0.5);

    this.statusText = scene.add
      .text(width / 2, height * 0.84, "AVAILABLE", {
        fontSize: `${Math.max(9, Math.min(11, width * 0.07))}px`,
        fontStyle: "bold",
        color: "#5f3f22",
        align: "center",
      })
      .setOrigin(0.5);

    this.container.add([nameText, this.statusText]);
  }

  /**
   * Updates the card visuals when the stage changes its selection set.
   *
   * @param selected - Whether this mob is currently in the player's draft.
   */
  setSelected(selected: boolean): void {
    this.selected = selected;
    this.refresh();
  }

  /** Applies selection styling without changing the parent's selection data. */
  private refresh(): void {
    this.background
      .setTexture(UI_TEXTURE_KEY, this.selected ? "cardSelected" : "card")
      .setDisplaySize(this.cardWidth, this.cardHeight)
      .clearTint();

    this.statusText
      .setText(this.selected ? "SELECTED" : "AVAILABLE")
      .setColor(this.selected ? "#14532d" : "#5f3f22");
  }

  /**
   * Returns a stable placeholder color for each current catalog entry.
   *
   * @param id - Mob catalog ID.
   * @returns Hexadecimal color used only for placeholder artwork.
   */
  private getColor(id: string): number {
    const colors: Record<string, number> = {
      monkey: 0xfbbf24,
      shield_guy: 0xf87171,
      elephant_rider: 0xd97706,
      doe_pat: 0x38bdf8,
    };

    return colors[id] ?? 0xa78bfa;
  }

  /** Destroys the card and its child game objects. Do not reuse afterward. */
  destroy(): void {
    this.container.destroy(true);
  }
}

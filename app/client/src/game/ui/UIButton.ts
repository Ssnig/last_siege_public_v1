import Phaser from "phaser";
import { UI_TEXTURE_KEY } from "./uiAtlas";

export interface UIButtonConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  onClick: () => void;
  fontSize?: number;
}

/**
 * Themed button backed by the shared UI atlas.
 *
 * @remarks
 * Input uses a transparent rectangle so the backing image can be freely
 * scaled without the hit-area/scale mismatch that custom hit areas on scaled
 * images would cause. Disabled buttons dim and stop receiving clicks.
 */
export class UIButton {
  readonly container: Phaser.GameObjects.Container;

  private readonly image: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private enabled = true;

  constructor(config: UIButtonConfig) {
    const { scene, x, y, width, height, label, onClick, fontSize } = config;

    this.container = scene.add.container(x, y);

    this.image = scene.add
      .image(0, 0, UI_TEXTURE_KEY, "button")
      .setDisplaySize(width, height);

    const hit = scene.add
      .rectangle(0, 0, width, height, 0x000000, 0)
      .setInteractive(
        new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
        Phaser.Geom.Rectangle.Contains,
      );

    this.label = scene.add
      .text(0, 0, label, {
        fontSize: `${fontSize ?? 14}px`,
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    hit.on("pointerover", () => {
      if (this.enabled) this.image.setTint(0xcfe0ff);
    });
    hit.on("pointerout", () => this.applyState());
    hit.on("pointerdown", () => {
      if (this.enabled) onClick();
    });

    this.container.add([this.image, hit, this.label]);
  }

  /** Sets the button caption. */
  setLabel(text: string): void {
    this.label.setText(text);
  }

  /** Enables or disables interaction and updates the dimmed appearance. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.applyState();
  }

  private applyState(): void {
    this.image.clearTint().setAlpha(this.enabled ? 1 : 0.55);
    this.label.setAlpha(this.enabled ? 1 : 0.6);
  }

  /** Destroys the button and its children. Do not reuse afterward. */
  destroy(): void {
    this.container.destroy(true);
  }
}

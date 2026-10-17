import Phaser from "phaser";

/** Texture key for the combined UI atlas (`public/assets/ui/UI.png`). */
export const UI_TEXTURE_KEY = "ui";

/** Load path for the UI atlas. */
export const UI_TEXTURE_URL = "/assets/ui/UI.png";

/** Texture key for the background/notification atlas (`public/assets/ui/UI_bg.png`). */
export const UI_BG_TEXTURE_KEY = "ui_bg";

/** Load path for the background/notification atlas image. */
export const UI_BG_TEXTURE_URL = "/assets/ui/UI_bg.png";

/** Load path for the background/notification atlas descriptor. */
export const UI_BG_ATLAS_URL = "/assets/ui/UI_bg.json";

/**
 * Named frames inside the background/notification atlas.
 *
 * @remarks Described by `UI_bg.json`, so no manual slicing is required.
 */
export const UI_BG_FRAMES = {
  bg1: "bg_1",
  bg2: "bg_2",
  notification1: "notification_1",
  notification2: "notification_2",
} as const;

/** Aspect ratios (width / height) for the background/notification frames. */
export const UI_BG_ASPECT = {
  bg1: 736 / 464,
  bg2: 784 / 736,
  notification1: 768 / 416,
  notification2: 784 / 384,
} as const;

export interface UIFrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Frame rectangles sliced out of `UI.png`.
 *
 * @remarks
 * The source atlas ships without a descriptor, so each region is declared
 * explicitly. Coordinates come from the opaque bounding boxes of the atlas and
 * must be updated if the art is repacked. Map:
 * - `wave`         — wave counter (e.g. "9/10"). Not wired into the UI yet.
 * - `button`       — generic button backing.
 * - `card`         — unselected draft card.
 * - `cardSelected` — selected draft card (gold border).
 * - `panel`        — two-section info popup background.
 * - `gold`         — gold indicator banner (coin emblem on the left).
 *
 * Each card and the panel share the same vertical structure, which the
 * layout code targets with percentage offsets: dark header (0-7.5%), light
 * content (7.5-57.5%), dark divider (~57.5-65%), light footer (65-90%),
 * dark/gold border (90-100%). All light regions are pale parchment, so text
 * drawn over them must be dark.
 */
export const UI_FRAMES = {
  wave: { x: 82, y: 81, width: 1280, height: 561 },
  button: { x: 693, y: 687, width: 698, height: 316 },
  card: { x: 1371, y: 5, width: 470, height: 672 },
  cardSelected: { x: 1399, y: 685, width: 359, height: 513 },
  panel: { x: 5, y: 651, width: 679, height: 574 },
  gold: { x: 693, y: 1013, width: 682, height: 300 },
} as const;

export type UIFrameName = keyof typeof UI_FRAMES;

/** Aspect ratios (width / height) for frames stretched across variable sizes. */
export const UI_ASPECT = {
  button: UI_FRAMES.button.width / UI_FRAMES.button.height,
  card: UI_FRAMES.card.width / UI_FRAMES.card.height,
  cardSelected: UI_FRAMES.cardSelected.width / UI_FRAMES.cardSelected.height,
  panel: UI_FRAMES.panel.width / UI_FRAMES.panel.height,
  wave: UI_FRAMES.wave.width / UI_FRAMES.wave.height,
  gold: UI_FRAMES.gold.width / UI_FRAMES.gold.height,
} as const;

/**
 * Slices the loaded UI atlas into the named frames above.
 *
 * @remarks
 * Call once after the atlas finishes loading. Idempotent: existing frames are
 * left untouched. Uses linear filtering because the atlas is high-resolution
 * smooth art, whereas the game's `pixelArt` default would alias it when scaled.
 */
export function registerUIFrames(scene: Phaser.Scene): void {
  if (!scene.textures.exists(UI_TEXTURE_KEY)) return;

  const texture = scene.textures.get(UI_TEXTURE_KEY);

  (Object.keys(UI_FRAMES) as UIFrameName[]).forEach((name) => {
    if (!texture.has(name)) {
      const rect = UI_FRAMES[name];
      texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
    }
  });

  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/**
 * Applies smooth (linear) filtering to the background/notification atlas.
 *
 * @remarks
 * The frame data comes from `UI_bg.json`, so unlike {@link registerUIFrames}
 * there is nothing to slice — only the `pixelArt` default filter needs
 * overriding for the high-resolution smooth art.
 */
export function registerUIBgFrames(scene: Phaser.Scene): void {
  if (!scene.textures.exists(UI_BG_TEXTURE_KEY)) return;

  scene.textures
    .get(UI_BG_TEXTURE_KEY)
    .setFilter(Phaser.Textures.FilterMode.LINEAR);
}

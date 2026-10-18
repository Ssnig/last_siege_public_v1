
import Phaser from "phaser";

export interface UnitManifest {
  id: string;
  name: string;
  frames: number;
  cols: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
  frameRate: number;
  scale: number;
  origin: { x: number; y: number };
}

export const UNIT_FOLDER_MAP: Record<string, string> = {
  horse_rider: "horse_rider",
  sar_bal_gyi: "sar_bal_gyi",
  gya_pu: "gya_pu",
  a_ba: "a_ba",
  chon_toe: "chon_toe",
  runner: "horse_rider",
  brute: "sar_bal_gyi",
  gargoyle: "gya_pu",
  necromancer: "a_ba",
  ogre: "chon_toe",
};

export const UNIT_MANIFESTS: Record<string, UnitManifest> = {
  horse_rider: {
    id: "horse_rider",
    name: "Konbaung Cavalry",
    frames: 6,
    cols: 3,
    rows: 2,
    frameWidth: 341,
    frameHeight: 286,
    frameRate: 8,
    scale: 0.175,
    origin: { x: 0.5, y: 0.8 },
  },
  sar_bal_gyi: {
    id: "sar_bal_gyi",
    name: "Palace Royal Guard",
    frames: 6,
    cols: 3,
    rows: 2,
    frameWidth: 800,
    frameHeight: 670,
    frameRate: 6,
    scale: 0.08,
    origin: { x: 0.5, y: 0.85 },
  },
  gya_pu: {
    id: "gya_pu",
    name: "Winged Nat",
    frames: 6,
    cols: 3,
    rows: 2,
    frameWidth: 341,
    frameHeight: 286,
    frameRate: 8,
    scale: 0.16,
    origin: { x: 0.5, y: 0.8 },
  },
  a_ba: {
    id: "a_ba",
    name: "Nat Spirit Medium",
    frames: 6,
    cols: 3,
    rows: 2,
    frameWidth: 341,
    frameHeight: 286,
    frameRate: 7,
    scale: 0.175,
    origin: { x: 0.5, y: 0.85 },
  },
  chon_toe: {
    id: "chon_toe",
    name: "Bush Sneak",
    frames: 6,
    cols: 3,
    rows: 2,
    frameWidth: 800,
    frameHeight: 670,
    frameRate: 6,
    scale: 0.075,
    origin: { x: 0.5, y: 0.85 },
  },
  runner: {
    id: "runner",
    name: "Konbaung Cavalry",
    frames: 6,
    cols: 3,
    rows: 2,
    frameWidth: 341,
    frameHeight: 286,
    frameRate: 8,
    scale: 0.175,
    origin: { x: 0.5, y: 0.8 },
  },
  grunt: {
    id: "grunt",
    name: "Konbaung Infantry",
    frames: 6,
    cols: 6,
    rows: 1,
    frameWidth: 128,
    frameHeight: 128,
    frameRate: 8,
    scale: 0.275,
    origin: { x: 0.5, y: 0.8 },
  },
  brute: {
    id: "brute",
    name: "Palace Royal Guard",
    frames: 6,
    cols: 3,
    rows: 2,
    frameWidth: 800,
    frameHeight: 670,
    frameRate: 6,
    scale: 0.08,
    origin: { x: 0.5, y: 0.85 },
  },
  shade: {
    id: "shade",
    name: "Shadow Assassin",
    frames: 6,
    cols: 6,
    rows: 1,
    frameWidth: 128,
    frameHeight: 128,
    frameRate: 10,
    scale: 0.25,
    origin: { x: 0.5, y: 0.8 },
  },
  spider: {
    id: "spider",
    name: "War Hound",
    frames: 6,
    cols: 6,
    rows: 1,
    frameWidth: 96,
    frameHeight: 96,
    frameRate: 12,
    scale: 0.275,
    origin: { x: 0.5, y: 0.8 },
  },
  orc: {
    id: "orc",
    name: "Invader Marauder",
    frames: 6,
    cols: 6,
    rows: 1,
    frameWidth: 128,
    frameHeight: 128,
    frameRate: 8,
    scale: 0.275,
    origin: { x: 0.5, y: 0.8 },
  },
  gargoyle: {
    id: "gargoyle",
    name: "Winged Nat",
    frames: 6,
    cols: 3,
    rows: 2,
    frameWidth: 341,
    frameHeight: 286,
    frameRate: 8,
    scale: 0.16,
    origin: { x: 0.5, y: 0.8 },
  },
  sapper: {
    id: "sapper",
    name: "Fire Bombardier",
    frames: 6,
    cols: 6,
    rows: 1,
    frameWidth: 128,
    frameHeight: 128,
    frameRate: 8,
    scale: 0.275,
    origin: { x: 0.5, y: 0.8 },
  },
  necromancer: {
    id: "necromancer",
    name: "Nat Spirit Medium",
    frames: 6,
    cols: 3,
    rows: 2,
    frameWidth: 341,
    frameHeight: 286,
    frameRate: 7,
    scale: 0.175,
    origin: { x: 0.5, y: 0.85 },
  },
  ogre: {
    id: "ogre",
    name: "Bush Sneak",
    frames: 6,
    cols: 3,
    rows: 2,
    frameWidth: 800,
    frameHeight: 670,
    frameRate: 6,
    scale: 0.075,
    origin: { x: 0.5, y: 0.85 },
  },
};

/**
 * Manages loading, pinpointing, slicing, and animating unit spritesheets.
 */
export class UnitAnimationManager {
  /**
   * Preloads spritesheets and face icons for all configured units.
   */
  static preload(scene: Phaser.Scene): void {
    for (const [unitId, manifest] of Object.entries(UNIT_MANIFESTS)) {
      const folder = UNIT_FOLDER_MAP[unitId] || unitId;

      // Spritesheet (6 frames)
      const sheetKey = `unit_${unitId}_sheet`;
      if (!scene.textures.exists(sheetKey)) {
        scene.load.spritesheet(sheetKey, `/assets/units/${folder}/spritesheet.png`, {
          frameWidth: manifest.frameWidth,
          frameHeight: manifest.frameHeight,
        });
      }

      // Face icon for draft and HUD
      const faceKey = `unit-face-${unitId}`;
      if (!scene.textures.exists(faceKey)) {
        scene.load.image(faceKey, `/assets/units/${folder}/face.png`);
      }
    }
  }

  /**
   * Registers Phaser animation cycles for loaded unit spritesheets.
   */
  static createAnimations(scene: Phaser.Scene): void {
    for (const [unitId, manifest] of Object.entries(UNIT_MANIFESTS)) {
      const sheetKey = `unit_${unitId}_sheet`;
      const animKey = `unit_${unitId}_run`;

      if (scene.textures.exists(sheetKey) && !scene.anims.exists(animKey)) {
        const texture = scene.textures.get(sheetKey);
        // Ensure texture was successfully loaded and has frames
        if (texture && texture.frameTotal > 1) {
          scene.anims.create({
            key: animKey,
            frames: scene.anims.generateFrameNumbers(sheetKey, {
              start: 0,
              end: Math.min(manifest.frames - 1, texture.frameTotal - 1),
            }),
            frameRate: manifest.frameRate,
            repeat: -1,
          });
        }
      }
    }
  }

  /**
   * Spawns an animated mob sprite on the map configured with its scale and origin.
   */
  static spawnMobSprite(
    scene: Phaser.Scene,
    typeId: string,
  ): Phaser.GameObjects.Sprite {
    const manifest = UNIT_MANIFESTS[typeId] || UNIT_MANIFESTS.grunt;
    const sheetKey = `unit_${typeId}_sheet`;
    const animKey = `unit_${typeId}_run`;

    let sprite: Phaser.GameObjects.Sprite;

    if (scene.anims.exists(animKey)) {
      sprite = scene.add.sprite(0, 0, sheetKey);
      sprite.play(animKey);
      sprite.setScale(manifest.scale);
      sprite.setOrigin(manifest.origin.x, manifest.origin.y);
    } else {
      // Fallback: check if face or unit_warrior exists
      const fallbackKey = scene.textures.exists(`unit-face-${typeId}`)
        ? `unit-face-${typeId}`
        : "unit_warrior";
      sprite = scene.add.sprite(0, 0, fallbackKey);
      sprite.setOrigin(0.5, 0.78);
      sprite.setDisplaySize(64, 64);
    }

    return sprite;
  }
}

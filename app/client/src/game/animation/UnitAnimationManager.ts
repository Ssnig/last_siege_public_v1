
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
  spritesheetFile?: string;
  faceFile?: string;
  walkFrames?: { start: number; end: number };
  castFrames?: { start: number; end: number; frameRate?: number };
}

export const UNIT_FOLDER_MAP: Record<string, string> = {
  horse_rider: "horse_rider",
  sar_bal_gyi: "sar_bal_gyi",
  gya_pu: "gya_pu",
  a_ba: "a_ba",
  chon_toe: "chon_toe",
  elephant_rider: "elephant_rider",
  monkey: "monkey",
  say_sayar: "say_sayar",
  shield_guy: "shield_guy",
  doe_pat: "doe_pat",
  bandit: "Bandit",
  belu: "Belu",
  brute: "Brute",
  general: "General",
  sone_ma: "SoneMa",
};

export const UNITS_WITH_SPRITESHEET = new Set([
  "a_ba",
  "chon_toe",
  "gya_pu",
  "horse_rider",
  "sar_bal_gyi",
  "elephant_rider",
  "monkey",
  "say_sayar",
  "shield_guy",
  "doe_pat",
  "bandit",
  "belu",
  "brute",
  "general",
  "sone_ma",
]);

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
  elephant_rider: {
    id: "elephant_rider",
    name: "War Elephant",
    frames: 8,
    cols: 4,
    rows: 2,
    frameWidth: 688,
    frameHeight: 768,
    frameRate: 7,
    scale: 0.15,
    origin: { x: 0.5, y: 0.85 },
    spritesheetFile: "elephant_rider.png",
    faceFile: "face.jpg",
  },
  monkey: {
    id: "monkey",
    name: "Monkey",
    frames: 8,
    cols: 4,
    rows: 2,
    frameWidth: 688,
    frameHeight: 768,
    frameRate: 10,
    scale: 0.05,
    origin: { x: 0.5, y: 0.85 },
    spritesheetFile: "spritesheet.png",
    faceFile: "face.jpg",
  },
  say_sayar: {
    id: "say_sayar",
    name: "Say Sayar",
    frames: 8,
    cols: 4,
    rows: 2,
    frameWidth: 688,
    frameHeight: 768,
    frameRate: 7,
    scale: 0.085,
    origin: { x: 0.5, y: 0.85 },
    spritesheetFile: "say_sayar.png",
    faceFile: "face.jpg",
    walkFrames: { start: 0, end: 3 },
    castFrames: { start: 4, end: 7, frameRate: 8 },
  },
  shield_guy: {
    id: "shield_guy",
    name: "Shield Bearer",
    frames: 8,
    cols: 4,
    rows: 2,
    frameWidth: 688,
    frameHeight: 768,
    frameRate: 7,
    scale: 0.085,
    origin: { x: 0.5, y: 0.85 },
    spritesheetFile: "shield_guy.png",
    faceFile: "face.jpg",
  },
  doe_pat: {
    id: "doe_pat",
    name: "Doe Pat",
    frames: 8,
    cols: 4,
    rows: 2,
    frameWidth: 688,
    frameHeight: 768,
    frameRate: 8,
    scale: 0.085,
    origin: { x: 0.5, y: 0.85 },
    spritesheetFile: "sheet.png",
    faceFile: "face.jpg",
  },
  bandit: {
    id: "bandit",
    name: "Bandit Raider",
    frames: 4,
    cols: 4,
    rows: 1,
    frameWidth: 800,
    frameHeight: 1200,
    frameRate: 8,
    scale: 0.061,
    origin: { x: 0.5, y: 0.917 },
    spritesheetFile: "spritesheet.png",
    faceFile: "face.png",
    walkFrames: { start: 0, end: 3 },
  },
  belu: {
    id: "belu",
    name: "Belu Ogre",
    frames: 4,
    cols: 4,
    rows: 1,
    frameWidth: 800,
    frameHeight: 1200,
    frameRate: 7,
    scale: 0.108,
    origin: { x: 0.5, y: 0.917 },
    spritesheetFile: "spritesheet.png",
    faceFile: "face.png",
    walkFrames: { start: 0, end: 3 },
  },
  brute: {
    id: "brute",
    name: "Heavy Brute",
    frames: 4,
    cols: 4,
    rows: 1,
    frameWidth: 800,
    frameHeight: 1200,
    frameRate: 7,
    scale: 0.096,
    origin: { x: 0.5, y: 0.917 },
    spritesheetFile: "spritesheet.png",
    faceFile: "face.png",
    walkFrames: { start: 0, end: 3 },
  },
  general: {
    id: "general",
    name: "Royal Bo General",
    frames: 4,
    cols: 4,
    rows: 1,
    frameWidth: 800,
    frameHeight: 1200,
    frameRate: 7,
    scale: 0.061,
    origin: { x: 0.5, y: 0.917 },
    spritesheetFile: "spritesheet.png",
    faceFile: "face.png",
    walkFrames: { start: 0, end: 3 },
  },
  sone_ma: {
    id: "sone_ma",
    name: "Sone Ma Sorceress",
    frames: 4,
    cols: 4,
    rows: 1,
    frameWidth: 800,
    frameHeight: 1200,
    frameRate: 7,
    scale: 0.051,
    origin: { x: 0.5, y: 0.917 },
    spritesheetFile: "spritesheet.png",
    faceFile: "face.png",
    walkFrames: { start: 0, end: 3 },
  },
};

export const HEAL_VFX_SHEET_KEY = "vfx_heal_aura_sheet";
export const HEAL_VFX_ANIM_KEY = "vfx_heal_aura";
export const SPEED_BOOST_VFX_SHEET_KEY = "vfx_speed_boost_sheet";
export const SPEED_BOOST_VFX_ANIM_KEY = "vfx_speed_boost";

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

      // Spritesheet (only for units with physical spritesheets on disk)
      const sheetKey = `unit_${unitId}_sheet`;
      if (UNITS_WITH_SPRITESHEET.has(unitId) && !scene.textures.exists(sheetKey)) {
        const sheetFile = manifest.spritesheetFile ?? "spritesheet.png";
        scene.load.spritesheet(sheetKey, `/assets/units/${folder}/${sheetFile}`, {
          frameWidth: manifest.frameWidth,
          frameHeight: manifest.frameHeight,
        });
      }

      // Face icon for draft and HUD
      const faceKey = `unit-face-${unitId}`;
      if (!scene.textures.exists(faceKey)) {
        const faceFile = manifest.faceFile ?? "face.png";
        scene.load.image(faceKey, `/assets/units/${folder}/${faceFile}`);
      }
    }

    // Preload heal aura VFX spritesheet (2 rows x 4 cols = 8 frames, 688x768 each)
    if (!scene.textures.exists(HEAL_VFX_SHEET_KEY)) {
      scene.load.spritesheet(
        HEAL_VFX_SHEET_KEY,
        "/assets/units/say_sayar/heal_vfx.png",
        {
          frameWidth: 688,
          frameHeight: 768,
        },
      );
    }

    // Preload speed boost VFX spritesheet (2 rows x 4 cols = 8 frames, 688x768 each)
    if (!scene.textures.exists(SPEED_BOOST_VFX_SHEET_KEY)) {
      scene.load.spritesheet(
        SPEED_BOOST_VFX_SHEET_KEY,
        "/assets/units/doe_pat/speed_boost_vfx.png",
        {
          frameWidth: 688,
          frameHeight: 768,
        },
      );
    }
  }

  /**
   * Registers Phaser animation cycles for loaded unit spritesheets.
   */
  static createAnimations(scene: Phaser.Scene): void {
    for (const [unitId, manifest] of Object.entries(UNIT_MANIFESTS)) {
      const sheetKey = `unit_${unitId}_sheet`;
      const runAnimKey = `unit_${unitId}_run`;
      const castAnimKey = `unit_${unitId}_cast`;

      if (scene.textures.exists(sheetKey)) {
        const texture = scene.textures.get(sheetKey);
        if (texture && texture.frameTotal > 1) {
          if (!scene.anims.exists(runAnimKey)) {
            const walkStart = manifest.walkFrames?.start ?? 0;
            const walkEnd = Math.min(
              manifest.walkFrames?.end ?? manifest.frames - 1,
              texture.frameTotal - 1,
            );
            scene.anims.create({
              key: runAnimKey,
              frames: scene.anims.generateFrameNumbers(sheetKey, {
                start: walkStart,
                end: walkEnd,
              }),
              frameRate: manifest.frameRate,
              repeat: -1,
            });
          }

          if (manifest.castFrames && !scene.anims.exists(castAnimKey)) {
            const castStart = manifest.castFrames.start;
            const castEnd = Math.min(
              manifest.castFrames.end,
              texture.frameTotal - 1,
            );
            scene.anims.create({
              key: castAnimKey,
              frames: scene.anims.generateFrameNumbers(sheetKey, {
                start: castStart,
                end: castEnd,
              }),
              frameRate: manifest.castFrames.frameRate ?? manifest.frameRate,
              repeat: 0,
            });
          }
        }
      }
    }

    if (
      scene.textures.exists(HEAL_VFX_SHEET_KEY) &&
      !scene.anims.exists(HEAL_VFX_ANIM_KEY)
    ) {
      const vfxTexture = scene.textures.get(HEAL_VFX_SHEET_KEY);
      if (vfxTexture && vfxTexture.frameTotal > 1) {
        scene.anims.create({
          key: HEAL_VFX_ANIM_KEY,
          frames: scene.anims.generateFrameNumbers(HEAL_VFX_SHEET_KEY, {
            start: 0,
            end: Math.min(7, vfxTexture.frameTotal - 1),
          }),
          frameRate: 12,
          repeat: 0,
        });
      }
    }

    if (
      scene.textures.exists(SPEED_BOOST_VFX_SHEET_KEY) &&
      !scene.anims.exists(SPEED_BOOST_VFX_ANIM_KEY)
    ) {
      const vfxTexture = scene.textures.get(SPEED_BOOST_VFX_SHEET_KEY);
      if (vfxTexture && vfxTexture.frameTotal > 1) {
        scene.anims.create({
          key: SPEED_BOOST_VFX_ANIM_KEY,
          frames: scene.anims.generateFrameNumbers(SPEED_BOOST_VFX_SHEET_KEY, {
            start: 0,
            end: Math.min(7, vfxTexture.frameTotal - 1),
          }),
          frameRate: 12,
          repeat: 0,
        });
      }
    }
  }

  /**
   * Plays a unit's one-shot cast animation (if defined) and returns to its walk cycle on completion.
   */
  static playCastAnimation(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    typeId: string,
  ): void {
    const castAnimKey = `unit_${typeId}_cast`;
    const runAnimKey = `unit_${typeId}_run`;
    if (!scene.anims.exists(castAnimKey)) return;

    sprite.play(castAnimKey);
    sprite.once(`animationcomplete-${castAnimKey}`, () => {
      if (sprite.active && scene.anims.exists(runAnimKey)) {
        sprite.play(runAnimKey);
      }
    });
  }

  /**
   * Spawns a one-shot heal VFX sprite at `(x, y)` that destroys itself when finished.
   */
  static spawnHealVfx(
    scene: Phaser.Scene,
    x: number,
    y: number,
  ): Phaser.GameObjects.Sprite | undefined {
    if (
      !scene.textures.exists(HEAL_VFX_SHEET_KEY) ||
      !scene.anims.exists(HEAL_VFX_ANIM_KEY)
    ) {
      return undefined;
    }

    const vfx = scene.add
      .sprite(x, y, HEAL_VFX_SHEET_KEY)
      .setOrigin(0.5, 0.85)
      .setScale(0.11);

    vfx.play(HEAL_VFX_ANIM_KEY);
    vfx.once(`animationcomplete-${HEAL_VFX_ANIM_KEY}`, () => {
      vfx.destroy();
    });

    return vfx;
  }

  /**
   * Spawns a one-shot speed boost VFX sprite at `(x, y)` that destroys itself when finished.
   */
  static spawnSpeedBoostVfx(
    scene: Phaser.Scene,
    x: number,
    y: number,
  ): Phaser.GameObjects.Sprite | undefined {
    if (
      !scene.textures.exists(SPEED_BOOST_VFX_SHEET_KEY) ||
      !scene.anims.exists(SPEED_BOOST_VFX_ANIM_KEY)
    ) {
      return undefined;
    }

    const vfx = scene.add
      .sprite(x, y, SPEED_BOOST_VFX_SHEET_KEY)
      .setOrigin(0.5, 0.85)
      .setScale(0.11);

    vfx.play(SPEED_BOOST_VFX_ANIM_KEY);
    vfx.once(`animationcomplete-${SPEED_BOOST_VFX_ANIM_KEY}`, () => {
      vfx.destroy();
    });

    return vfx;
  }

  /**
   * Spawns an animated mob sprite on the map configured with its scale and origin.
   */
  static spawnMobSprite(
    scene: Phaser.Scene,
    typeId: string,
  ): Phaser.GameObjects.Sprite {
    const manifest = UNIT_MANIFESTS[typeId] || UNIT_MANIFESTS.horse_rider;
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

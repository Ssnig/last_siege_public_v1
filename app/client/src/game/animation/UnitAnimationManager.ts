
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
    faceFile: "face.jpg",
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
    faceFile: "face.jpg",
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
    faceFile: "face.jpg",
    walkFrames: { start: 0, end: 3 },
  },
};

export const HEAL_VFX_SHEET_KEY = "vfx_heal_aura_sheet";
export const HEAL_VFX_ANIM_KEY = "vfx_heal_aura";
export const BRUTE_HEAL_VFX_SHEET_KEY = "vfx_brute_heal_sheet";
export const BRUTE_HEAL_VFX_ANIM_KEY = "vfx_brute_heal";
export const SPEED_BOOST_VFX_SHEET_KEY = "vfx_speed_boost_sheet";
export const SPEED_BOOST_VFX_ANIM_KEY = "vfx_speed_boost";
export const BELU_SKILL_VFX_SHEET_KEY = "vfx_belu_skill_sheet";
export const BELU_ARMOR_VFX_ANIM_KEY = "vfx_belu_armor";
export const BELU_MENTAL_VFX_ANIM_KEY = "vfx_belu_mental";
export const SONE_MA_SKILL_VFX_SHEET_KEY = "vfx_sone_ma_skill_sheet";
export const SONE_MA_TRIGGER_VFX_ANIM_KEY = "vfx_sone_ma_trigger";
export const SONE_MA_STUN_VFX_ANIM_KEY = "vfx_sone_ma_stun_loop";
export const MOB_DEATH_VFX_SHEET_KEY = "vfx_mob_death_sheet";
export const MOB_DEATH_VFX_ANIM_KEY = "vfx_mob_death";
export const BASE_BREACH_VFX_SHEET_KEY = "vfx_base_breach_sheet";
export const BASE_BREACH_VFX_ANIM_KEY = "vfx_base_breach";

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

    // Preload Brute self-heal VFX spritesheet (2 rows x 4 cols = 8 frames, 688x768 each)
    if (!scene.textures.exists(BRUTE_HEAL_VFX_SHEET_KEY)) {
      scene.load.spritesheet(
        BRUTE_HEAL_VFX_SHEET_KEY,
        "/assets/units/Brute/heal_vfx.png",
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

    // Preload Belu skill VFX spritesheet (2 rows x 4 cols = 8 frames, 688x768 each)
    if (!scene.textures.exists(BELU_SKILL_VFX_SHEET_KEY)) {
      scene.load.spritesheet(
        BELU_SKILL_VFX_SHEET_KEY,
        "/assets/units/Belu/skill_vfx.png",
        {
          frameWidth: 688,
          frameHeight: 768,
        },
      );
    }

    // Preload Sone Ma curse/stun VFX spritesheet (2 rows x 4 cols = 8 frames, 688x768 each)
    if (!scene.textures.exists(SONE_MA_SKILL_VFX_SHEET_KEY)) {
      scene.load.spritesheet(
        SONE_MA_SKILL_VFX_SHEET_KEY,
        "/assets/units/SoneMa/skill_vfx.png",
        {
          frameWidth: 688,
          frameHeight: 768,
        },
      );
    }

    // Preload mob death VFX spritesheet (2 rows x 4 cols = 8 frames, 688x768 each)
    if (!scene.textures.exists(MOB_DEATH_VFX_SHEET_KEY)) {
      scene.load.spritesheet(
        MOB_DEATH_VFX_SHEET_KEY,
        "/assets/vfx/mob_death.png",
        {
          frameWidth: 688,
          frameHeight: 768,
        },
      );
    }

    // Preload base breach VFX spritesheet (2 rows x 4 cols = 8 frames, 688x768 each)
    if (!scene.textures.exists(BASE_BREACH_VFX_SHEET_KEY)) {
      scene.load.spritesheet(
        BASE_BREACH_VFX_SHEET_KEY,
        "/assets/vfx/base_breach.png",
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
      scene.textures.exists(BRUTE_HEAL_VFX_SHEET_KEY) &&
      !scene.anims.exists(BRUTE_HEAL_VFX_ANIM_KEY)
    ) {
      const vfxTexture = scene.textures.get(BRUTE_HEAL_VFX_SHEET_KEY);
      if (vfxTexture && vfxTexture.frameTotal > 1) {
        scene.anims.create({
          key: BRUTE_HEAL_VFX_ANIM_KEY,
          frames: scene.anims.generateFrameNumbers(BRUTE_HEAL_VFX_SHEET_KEY, {
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

    if (
      scene.textures.exists(BELU_SKILL_VFX_SHEET_KEY) &&
      !scene.anims.exists(BELU_ARMOR_VFX_ANIM_KEY)
    ) {
      const vfxTexture = scene.textures.get(BELU_SKILL_VFX_SHEET_KEY);
      if (vfxTexture && vfxTexture.frameTotal > 1) {
        // Top row (frames 0..3): physical armor stack gained
        scene.anims.create({
          key: BELU_ARMOR_VFX_ANIM_KEY,
          frames: scene.anims.generateFrameNumbers(BELU_SKILL_VFX_SHEET_KEY, {
            start: 0,
            end: Math.min(3, vfxTexture.frameTotal - 1),
          }),
          frameRate: 10,
          repeat: 0,
        });
      }
    }

    if (
      scene.textures.exists(BELU_SKILL_VFX_SHEET_KEY) &&
      !scene.anims.exists(BELU_MENTAL_VFX_ANIM_KEY)
    ) {
      const vfxTexture = scene.textures.get(BELU_SKILL_VFX_SHEET_KEY);
      if (vfxTexture && vfxTexture.frameTotal > 4) {
        // Bottom row (frames 4..7): mental strength stack gained
        scene.anims.create({
          key: BELU_MENTAL_VFX_ANIM_KEY,
          frames: scene.anims.generateFrameNumbers(BELU_SKILL_VFX_SHEET_KEY, {
            start: 4,
            end: Math.min(7, vfxTexture.frameTotal - 1),
          }),
          frameRate: 10,
          repeat: 0,
        });
      }
    }

    if (
      scene.textures.exists(SONE_MA_SKILL_VFX_SHEET_KEY) &&
      !scene.anims.exists(SONE_MA_TRIGGER_VFX_ANIM_KEY)
    ) {
      const vfxTexture = scene.textures.get(SONE_MA_SKILL_VFX_SHEET_KEY);
      if (vfxTexture && vfxTexture.frameTotal > 1) {
        // Top row (frames 0..3): trigger curse animation on tower, played once
        scene.anims.create({
          key: SONE_MA_TRIGGER_VFX_ANIM_KEY,
          frames: scene.anims.generateFrameNumbers(SONE_MA_SKILL_VFX_SHEET_KEY, {
            start: 0,
            end: Math.min(3, vfxTexture.frameTotal - 1),
          }),
          frameRate: 10,
          repeat: 0,
        });
      }
    }

    if (
      scene.textures.exists(SONE_MA_SKILL_VFX_SHEET_KEY) &&
      !scene.anims.exists(SONE_MA_STUN_VFX_ANIM_KEY)
    ) {
      const vfxTexture = scene.textures.get(SONE_MA_SKILL_VFX_SHEET_KEY);
      if (vfxTexture && vfxTexture.frameTotal > 4) {
        // Bottom row (frames 4..7): special stun effect on tower, looped
        scene.anims.create({
          key: SONE_MA_STUN_VFX_ANIM_KEY,
          frames: scene.anims.generateFrameNumbers(SONE_MA_SKILL_VFX_SHEET_KEY, {
            start: 4,
            end: Math.min(7, vfxTexture.frameTotal - 1),
          }),
          frameRate: 8,
          repeat: -1,
        });
      }
    }

    if (
      scene.textures.exists(MOB_DEATH_VFX_SHEET_KEY) &&
      !scene.anims.exists(MOB_DEATH_VFX_ANIM_KEY)
    ) {
      const vfxTexture = scene.textures.get(MOB_DEATH_VFX_SHEET_KEY);
      if (vfxTexture && vfxTexture.frameTotal > 1) {
        scene.anims.create({
          key: MOB_DEATH_VFX_ANIM_KEY,
          frames: scene.anims.generateFrameNumbers(MOB_DEATH_VFX_SHEET_KEY, {
            start: 0,
            end: Math.min(7, vfxTexture.frameTotal - 1),
          }),
          frameRate: 14,
          repeat: 0,
        });
      }
    }

    if (
      scene.textures.exists(BASE_BREACH_VFX_SHEET_KEY) &&
      !scene.anims.exists(BASE_BREACH_VFX_ANIM_KEY)
    ) {
      const vfxTexture = scene.textures.get(BASE_BREACH_VFX_SHEET_KEY);
      if (vfxTexture && vfxTexture.frameTotal > 1) {
        scene.anims.create({
          key: BASE_BREACH_VFX_ANIM_KEY,
          frames: scene.anims.generateFrameNumbers(BASE_BREACH_VFX_SHEET_KEY, {
            start: 0,
            end: Math.min(6, vfxTexture.frameTotal - 1),
          }),
          frameRate: 14,
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
   * Spawns a one-shot Brute self-heal VFX sprite at `(x, y)` from `/assets/units/Brute/heal_vfx.png`.
   */
  static spawnBruteHealVfx(
    scene: Phaser.Scene,
    x: number,
    y: number,
  ): Phaser.GameObjects.Sprite | undefined {
    const sheetKey = scene.textures.exists(BRUTE_HEAL_VFX_SHEET_KEY)
      ? BRUTE_HEAL_VFX_SHEET_KEY
      : HEAL_VFX_SHEET_KEY;
    const animKey = scene.anims.exists(BRUTE_HEAL_VFX_ANIM_KEY)
      ? BRUTE_HEAL_VFX_ANIM_KEY
      : HEAL_VFX_ANIM_KEY;

    if (!scene.textures.exists(sheetKey) || !scene.anims.exists(animKey)) {
      return undefined;
    }

    const vfx = scene.add
      .sprite(x, y, sheetKey)
      .setOrigin(0.5, 0.85)
      .setScale(0.12);

    vfx.play(animKey);
    vfx.once(`animationcomplete-${animKey}`, () => {
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
   * Spawns a one-shot Belu physical armor stack VFX sprite at `(x, y)` that destroys itself when finished.
   */
  static spawnBeluArmorVfx(
    scene: Phaser.Scene,
    x: number,
    y: number,
  ): Phaser.GameObjects.Sprite | undefined {
    if (
      !scene.textures.exists(BELU_SKILL_VFX_SHEET_KEY) ||
      !scene.anims.exists(BELU_ARMOR_VFX_ANIM_KEY)
    ) {
      return undefined;
    }

    const vfx = scene.add
      .sprite(x, y, BELU_SKILL_VFX_SHEET_KEY)
      .setOrigin(0.5, 0.85)
      .setScale(0.15);

    vfx.play(BELU_ARMOR_VFX_ANIM_KEY);
    vfx.once(`animationcomplete-${BELU_ARMOR_VFX_ANIM_KEY}`, () => {
      vfx.destroy();
    });

    return vfx;
  }

  /**
   * Spawns a one-shot Belu mental strength stack VFX sprite at `(x, y)` that destroys itself when finished.
   */
  static spawnBeluMentalVfx(
    scene: Phaser.Scene,
    x: number,
    y: number,
  ): Phaser.GameObjects.Sprite | undefined {
    if (
      !scene.textures.exists(BELU_SKILL_VFX_SHEET_KEY) ||
      !scene.anims.exists(BELU_MENTAL_VFX_ANIM_KEY)
    ) {
      return undefined;
    }

    const vfx = scene.add
      .sprite(x, y, BELU_SKILL_VFX_SHEET_KEY)
      .setOrigin(0.5, 0.85)
      .setScale(0.15);

    vfx.play(BELU_MENTAL_VFX_ANIM_KEY);
    vfx.once(`animationcomplete-${BELU_MENTAL_VFX_ANIM_KEY}`, () => {
      vfx.destroy();
    });

    return vfx;
  }

  /**
   * Spawns Sone Ma curse/stun VFX on a tower at `(x, y)`.
   * Plays the top row trigger animation once, then transitions into the bottom row stun loop until destroyed.
   */
  static spawnSoneMaStunVfx(
    scene: Phaser.Scene,
    x: number,
    y: number,
  ): Phaser.GameObjects.Sprite | undefined {
    if (
      !scene.textures.exists(SONE_MA_SKILL_VFX_SHEET_KEY) ||
      !scene.anims.exists(SONE_MA_TRIGGER_VFX_ANIM_KEY)
    ) {
      return undefined;
    }

    const vfx = scene.add
      .sprite(x, y, SONE_MA_SKILL_VFX_SHEET_KEY)
      .setOrigin(0.5, 0.8)
      .setScale(0.14);

    vfx.play(SONE_MA_TRIGGER_VFX_ANIM_KEY);
    vfx.once(`animationcomplete-${SONE_MA_TRIGGER_VFX_ANIM_KEY}`, () => {
      if (vfx.active && scene.anims.exists(SONE_MA_STUN_VFX_ANIM_KEY)) {
        vfx.play(SONE_MA_STUN_VFX_ANIM_KEY);
      }
    });

    return vfx;
  }

  /**
   * Spawns Sone Ma stun loop VFX directly on a tower at `(x, y)`.
   */
  static spawnSoneMaStunLoopVfx(
    scene: Phaser.Scene,
    x: number,
    y: number,
  ): Phaser.GameObjects.Sprite | undefined {
    if (
      !scene.textures.exists(SONE_MA_SKILL_VFX_SHEET_KEY) ||
      !scene.anims.exists(SONE_MA_STUN_VFX_ANIM_KEY)
    ) {
      return undefined;
    }

    const vfx = scene.add
      .sprite(x, y, SONE_MA_SKILL_VFX_SHEET_KEY)
      .setOrigin(0.5, 0.8)
      .setScale(0.14);

    vfx.play(SONE_MA_STUN_VFX_ANIM_KEY);
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

  /**
   * Spawns a one-shot mob death VFX sprite at (x, y) that destroys itself when finished.
   */
  static spawnMobDeathVfx(
    scene: Phaser.Scene,
    x: number,
    y: number,
    typeId?: string,
  ): Phaser.GameObjects.Sprite | undefined {
    if (!scene.textures.exists(MOB_DEATH_VFX_SHEET_KEY)) {
      scene.load.spritesheet(
        MOB_DEATH_VFX_SHEET_KEY,
        "/assets/vfx/mob_death.png",
        { frameWidth: 688, frameHeight: 768 },
      );
      scene.load.start();
    }
    if (!scene.textures.exists(MOB_DEATH_VFX_SHEET_KEY)) return undefined;

    if (!scene.anims.exists(MOB_DEATH_VFX_ANIM_KEY)) {
      scene.anims.create({
        key: MOB_DEATH_VFX_ANIM_KEY,
        frames: scene.anims.generateFrameNumbers(MOB_DEATH_VFX_SHEET_KEY, {
          start: 0,
          end: 7,
        }),
        frameRate: 14,
        repeat: 0,
      });
    }

    const isHeavy =
      typeId === "elephant_rider" ||
      typeId === "belu" ||
      typeId === "brute" ||
      typeId === "general";
    const scale = isHeavy ? 0.16 : 0.12;

    const vfx = scene.add
      .sprite(x, y, MOB_DEATH_VFX_SHEET_KEY)
      .setOrigin(0.5, 0.72)
      .setScale(scale);

    vfx.play(MOB_DEATH_VFX_ANIM_KEY);
    vfx.once(`animationcomplete-${MOB_DEATH_VFX_ANIM_KEY}`, () => {
      vfx.destroy();
    });

    return vfx;
  }

  /**
   * Spawns a one-shot base breach impact VFX sprite on the citadel base at (x, y).
   */
  static spawnBaseBreachVfx(
    scene: Phaser.Scene,
    x: number,
    y: number,
  ): Phaser.GameObjects.Sprite | undefined {
    if (!scene.textures.exists(BASE_BREACH_VFX_SHEET_KEY)) {
      scene.load.spritesheet(
        BASE_BREACH_VFX_SHEET_KEY,
        "/assets/vfx/base_breach.png",
        { frameWidth: 688, frameHeight: 768 },
      );
      scene.load.start();
    }
    if (!scene.textures.exists(BASE_BREACH_VFX_SHEET_KEY)) return undefined;

    if (!scene.anims.exists(BASE_BREACH_VFX_ANIM_KEY)) {
      scene.anims.create({
        key: BASE_BREACH_VFX_ANIM_KEY,
        frames: scene.anims.generateFrameNumbers(BASE_BREACH_VFX_SHEET_KEY, {
          start: 0,
          end: 6,
        }),
        frameRate: 14,
        repeat: 0,
      });
    }

    const vfx = scene.add
      .sprite(x, y, BASE_BREACH_VFX_SHEET_KEY)
      .setOrigin(0.5, 0.55)
      .setScale(0.14);

    vfx.play(BASE_BREACH_VFX_ANIM_KEY);
    vfx.once(`animationcomplete-${BASE_BREACH_VFX_ANIM_KEY}`, () => {
      vfx.destroy();
    });

    return vfx;
  }
}

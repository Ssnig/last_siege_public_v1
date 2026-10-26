import Phaser from "phaser";

export interface TowerAnimManifest {
  id: string;
  sheetKey: string;
  sheetPath: string;
  frameWidth: number;
  frameHeight: number;
  cols: number;
  rows: number;
  // Frame layout description
  // water_cannon: 4 cols x 2 rows, 688x768 per frame
  // Original: top row = SE (idle frames 0,1; firing frames 2,3), bottom row = NE (idle 0,1; firing 2,3)
  // Mirrored: gives NW and SW
  idleSE: number[]; // frame indices for idle facing SE
  fireSE: number[]; // frame indices for firing facing SE
  idleNE: number[]; // frame indices for idle facing NE
  fireNE: number[]; // frame indices for firing facing NE
  frameRate: number;
  scale: number;
}

export const TOWER_ANIM_MANIFESTS: Record<string, TowerAnimManifest> = {
  archer: {
    id: "archer",
    sheetKey: "tower_archer_sheet",
    sheetPath: "/assets/towers/01_archer_tower/sheet.png",
    frameWidth: 688,
    frameHeight: 768,
    cols: 4,
    rows: 2,
    idleSE: [0, 1, 2, 3],
    fireSE: [4, 5, 6, 7],
    idleNE: [0, 1, 2, 3],
    fireNE: [4, 5, 6, 7],
    frameRate: 8,
    scale: 0.12,
  },
  bomb: {
    id: "bomb",
    sheetKey: "tower_bomb_sheet",
    sheetPath: "/assets/towers/03_bomb_throwing_tower/sheet.png",
    frameWidth: 688,
    frameHeight: 768,
    cols: 4,
    rows: 2,
    idleSE: [0, 1, 2, 3],
    fireSE: [4, 5, 6, 7],
    idleNE: [0, 1, 2, 3],
    fireNE: [4, 5, 6, 7],
    frameRate: 8,
    scale: 0.12,
  },
  spear: {
    id: "spear",
    sheetKey: "tower_spear_sheet",
    sheetPath: "/assets/towers/05_spear_tower/sheet.png",
    frameWidth: 688,
    frameHeight: 768,
    cols: 4,
    rows: 2,
    idleSE: [0, 1, 2, 3],
    fireSE: [4, 5, 6, 7],
    idleNE: [0, 1, 2, 3],
    fireNE: [4, 5, 6, 7],
    frameRate: 8,
    scale: 0.12,
  },
  water_cannon: {
    id: "water_cannon",
    sheetKey: "tower_water_cannon_sheet",
    sheetPath: "/assets/towers/07_water_cannon/water_gun.png",
    frameWidth: 688,
    frameHeight: 768,
    cols: 4,
    rows: 2,
    idleSE: [0, 1],
    fireSE: [2, 3],
    idleNE: [4, 5],
    fireNE: [6, 7],
    frameRate: 10,
    scale: 0.12,
  },
  chinthe: {
    id: "chinthe",
    sheetKey: "tower_chinthe_sheet",
    sheetPath: "/assets/towers/08_chinthe_statue/lion_gurdian.png",
    frameWidth: 688,
    frameHeight: 768,
    cols: 4,
    rows: 2,
    idleSE: [0, 1],
    fireSE: [2, 3],
    idleNE: [4, 5],
    fireNE: [6, 7],
    frameRate: 10,
    scale: 0.12,
  },
  dragon: {
    id: "dragon",
    sheetKey: "tower_dragon_sheet",
    sheetPath: "/assets/towers/09_dragon_tower/dragon_tower.png",
    frameWidth: 600,
    frameHeight: 896,
    cols: 4,
    rows: 2,
    idleSE: [0, 1],
    fireSE: [2, 3],
    idleNE: [4, 5],
    fireNE: [6, 7],
    frameRate: 10,
    scale: 0.12,
  },
  bell: {
    id: "bell",
    sheetKey: "tower_bell_sheet",
    sheetPath: "/assets/towers/04_bell_tower/bell_tower.png",
    frameWidth: 688,
    frameHeight: 768,
    cols: 4,
    rows: 2,
    idleSE: [0, 1, 2, 3],
    fireSE: [4, 5, 6, 7],
    idleNE: [0, 1, 2, 3],
    fireNE: [4, 5, 6, 7],
    frameRate: 7,
    scale: 0.12,
  },
  sein_pyaung: {
    id: "sein_pyaung",
    sheetKey: "tower_sein_pyaung_sheet",
    sheetPath: "/assets/towers/10_sein_pyaung/sein_pyaung.png",
    frameWidth: 688,
    frameHeight: 768,
    cols: 4,
    rows: 2,
    idleSE: [0, 1],
    fireSE: [2, 3],
    idleNE: [4, 5],
    fireNE: [6, 7],
    frameRate: 10,
    scale: 0.12,
  },
};

export const BELL_ATTACK_VFX_SHEET_KEY = "vfx_bell_attack_sheet";
export const BELL_ATTACK_VFX_ANIM_KEY = "vfx_bell_attack";

export class TowerAnimationManager {
  static preload(scene: Phaser.Scene): void {
    for (const manifest of Object.values(TOWER_ANIM_MANIFESTS)) {
      if (!scene.textures.exists(manifest.sheetKey)) {
        scene.load.spritesheet(manifest.sheetKey, manifest.sheetPath, {
          frameWidth: manifest.frameWidth,
          frameHeight: manifest.frameHeight,
        });
      }
      if (manifest.id === "water_cannon") {
        if (!scene.textures.exists("tower_water_cannon_sheet_mirrored")) {
          scene.load.spritesheet("tower_water_cannon_sheet_mirrored", "/assets/towers/07_water_cannon/water_gun_mirrored.png", {
            frameWidth: manifest.frameWidth,
            frameHeight: manifest.frameHeight,
          });
        }
      }
      if (manifest.id === "chinthe") {
        if (!scene.textures.exists("tower_chinthe_sheet_mirrored")) {
          scene.load.spritesheet("tower_chinthe_sheet_mirrored", "/assets/towers/08_chinthe_statue/lion_gurdian_mirrored.png", {
            frameWidth: manifest.frameWidth,
            frameHeight: manifest.frameHeight,
          });
        }
      }
      if (manifest.id === "dragon") {
        if (!scene.textures.exists("tower_dragon_sheet_mirrored")) {
          scene.load.spritesheet("tower_dragon_sheet_mirrored", "/assets/towers/09_dragon_tower/dragon_tower_mirrored.png", {
            frameWidth: manifest.frameWidth,
            frameHeight: manifest.frameHeight,
          });
        }
      }
      if (manifest.id === "sein_pyaung") {
        if (!scene.textures.exists("tower_sein_pyaung_sheet_mirrored")) {
          scene.load.spritesheet("tower_sein_pyaung_sheet_mirrored", "/assets/towers/10_sein_pyaung/sein_pyaung_mirrored.png", {
            frameWidth: manifest.frameWidth,
            frameHeight: manifest.frameHeight,
          });
        }
      }
    }

    if (!scene.textures.exists(BELL_ATTACK_VFX_SHEET_KEY)) {
      scene.load.spritesheet(
        BELL_ATTACK_VFX_SHEET_KEY,
        "/assets/towers/04_bell_tower/attack_vfx.png",
        {
          frameWidth: 688,
          frameHeight: 768,
        },
      );
    }
  }

  static createAnimations(scene: Phaser.Scene): void {
    for (const manifest of Object.values(TOWER_ANIM_MANIFESTS)) {
      if (manifest.id === "archer" || manifest.id === "bomb" || manifest.id === "spear") {
        if (scene.textures.exists(manifest.sheetKey)) {
          const idleKey = `${manifest.id}_idle`;
          const fireKey = `${manifest.id}_fire`;
          if (!scene.anims.exists(idleKey)) {
            scene.anims.create({
              key: idleKey,
              frames: scene.anims.generateFrameNumbers(manifest.sheetKey, {
                start: 0,
                end: 3,
              }),
              frameRate: manifest.frameRate,
              repeat: -1,
            });
          }
          if (!scene.anims.exists(fireKey)) {
            scene.anims.create({
              key: fireKey,
              frames: scene.anims.generateFrameNumbers(manifest.sheetKey, {
                start: 4,
                end: 7,
              }),
              frameRate: manifest.frameRate * 1.5,
              repeat: 0,
            });
          }
        }
      } else if (manifest.id === "water_cannon") {
        if (scene.textures.exists(manifest.sheetKey)) {
          if (!scene.anims.exists("water_cannon_idle_se")) scene.anims.create({ key: "water_cannon_idle_se", frames: scene.anims.generateFrameNumbers(manifest.sheetKey, { frames: manifest.idleSE }), frameRate: manifest.frameRate, repeat: -1 });
          if (!scene.anims.exists("water_cannon_fire_se")) scene.anims.create({ key: "water_cannon_fire_se", frames: scene.anims.generateFrameNumbers(manifest.sheetKey, { frames: manifest.fireSE }), frameRate: manifest.frameRate * 1.2, repeat: 0 });
          if (!scene.anims.exists("water_cannon_idle_ne")) scene.anims.create({ key: "water_cannon_idle_ne", frames: scene.anims.generateFrameNumbers(manifest.sheetKey, { frames: manifest.idleNE }), frameRate: manifest.frameRate, repeat: -1 });
          if (!scene.anims.exists("water_cannon_fire_ne")) scene.anims.create({ key: "water_cannon_fire_ne", frames: scene.anims.generateFrameNumbers(manifest.sheetKey, { frames: manifest.fireNE }), frameRate: manifest.frameRate * 1.2, repeat: 0 });
        }
        if (scene.textures.exists("tower_water_cannon_sheet_mirrored")) {
          if (!scene.anims.exists("water_cannon_idle_nw")) scene.anims.create({ key: "water_cannon_idle_nw", frames: scene.anims.generateFrameNumbers("tower_water_cannon_sheet_mirrored", { frames: manifest.idleNE }), frameRate: manifest.frameRate, repeat: -1 });
          if (!scene.anims.exists("water_cannon_fire_nw")) scene.anims.create({ key: "water_cannon_fire_nw", frames: scene.anims.generateFrameNumbers("tower_water_cannon_sheet_mirrored", { frames: manifest.fireNE }), frameRate: manifest.frameRate * 1.2, repeat: 0 });
          if (!scene.anims.exists("water_cannon_idle_sw")) scene.anims.create({ key: "water_cannon_idle_sw", frames: scene.anims.generateFrameNumbers("tower_water_cannon_sheet_mirrored", { frames: manifest.idleSE }), frameRate: manifest.frameRate, repeat: -1 });
          if (!scene.anims.exists("water_cannon_fire_sw")) scene.anims.create({ key: "water_cannon_fire_sw", frames: scene.anims.generateFrameNumbers("tower_water_cannon_sheet_mirrored", { frames: manifest.fireSE }), frameRate: manifest.frameRate * 1.2, repeat: 0 });
        }
      } else if (manifest.id === "chinthe") {
        if (scene.textures.exists(manifest.sheetKey)) {
          if (!scene.anims.exists("chinthe_idle_se")) scene.anims.create({ key: "chinthe_idle_se", frames: scene.anims.generateFrameNumbers(manifest.sheetKey, { frames: manifest.idleSE }), frameRate: manifest.frameRate, repeat: -1 });
          if (!scene.anims.exists("chinthe_fire_se")) scene.anims.create({ key: "chinthe_fire_se", frames: scene.anims.generateFrameNumbers(manifest.sheetKey, { frames: manifest.fireSE }), frameRate: manifest.frameRate * 1.2, repeat: 0 });
          if (!scene.anims.exists("chinthe_idle_ne")) scene.anims.create({ key: "chinthe_idle_ne", frames: scene.anims.generateFrameNumbers(manifest.sheetKey, { frames: manifest.idleNE }), frameRate: manifest.frameRate, repeat: -1 });
          if (!scene.anims.exists("chinthe_fire_ne")) scene.anims.create({ key: "chinthe_fire_ne", frames: scene.anims.generateFrameNumbers(manifest.sheetKey, { frames: manifest.fireNE }), frameRate: manifest.frameRate * 1.2, repeat: 0 });
        }
        if (scene.textures.exists("tower_chinthe_sheet_mirrored")) {
          if (!scene.anims.exists("chinthe_idle_nw")) scene.anims.create({ key: "chinthe_idle_nw", frames: scene.anims.generateFrameNumbers("tower_chinthe_sheet_mirrored", { frames: manifest.idleNE }), frameRate: manifest.frameRate, repeat: -1 });
          if (!scene.anims.exists("chinthe_fire_nw")) scene.anims.create({ key: "chinthe_fire_nw", frames: scene.anims.generateFrameNumbers("tower_chinthe_sheet_mirrored", { frames: manifest.fireNE }), frameRate: manifest.frameRate * 1.2, repeat: 0 });
          if (!scene.anims.exists("chinthe_idle_sw")) scene.anims.create({ key: "chinthe_idle_sw", frames: scene.anims.generateFrameNumbers("tower_chinthe_sheet_mirrored", { frames: manifest.idleSE }), frameRate: manifest.frameRate, repeat: -1 });
          if (!scene.anims.exists("chinthe_fire_sw")) scene.anims.create({ key: "chinthe_fire_sw", frames: scene.anims.generateFrameNumbers("tower_chinthe_sheet_mirrored", { frames: manifest.fireSE }), frameRate: manifest.frameRate * 1.2, repeat: 0 });
        }
      } else if (manifest.id === "dragon") {
        if (scene.textures.exists(manifest.sheetKey)) {
          if (!scene.anims.exists("dragon_idle_se")) scene.anims.create({ key: "dragon_idle_se", frames: scene.anims.generateFrameNumbers(manifest.sheetKey, { frames: manifest.idleSE }), frameRate: manifest.frameRate, repeat: -1 });
          if (!scene.anims.exists("dragon_fire_se")) scene.anims.create({ key: "dragon_fire_se", frames: scene.anims.generateFrameNumbers(manifest.sheetKey, { frames: manifest.fireSE }), frameRate: manifest.frameRate * 1.2, repeat: 0 });
          if (!scene.anims.exists("dragon_idle_ne")) scene.anims.create({ key: "dragon_idle_ne", frames: scene.anims.generateFrameNumbers(manifest.sheetKey, { frames: manifest.idleNE }), frameRate: manifest.frameRate, repeat: -1 });
          if (!scene.anims.exists("dragon_fire_ne")) scene.anims.create({ key: "dragon_fire_ne", frames: scene.anims.generateFrameNumbers(manifest.sheetKey, { frames: manifest.fireNE }), frameRate: manifest.frameRate * 1.2, repeat: 0 });
        }
        if (scene.textures.exists("tower_dragon_sheet_mirrored")) {
          if (!scene.anims.exists("dragon_idle_nw")) scene.anims.create({ key: "dragon_idle_nw", frames: scene.anims.generateFrameNumbers("tower_dragon_sheet_mirrored", { frames: manifest.idleNE }), frameRate: manifest.frameRate, repeat: -1 });
          if (!scene.anims.exists("dragon_fire_nw")) scene.anims.create({ key: "dragon_fire_nw", frames: scene.anims.generateFrameNumbers("tower_dragon_sheet_mirrored", { frames: manifest.fireNE }), frameRate: manifest.frameRate * 1.2, repeat: 0 });
          if (!scene.anims.exists("dragon_idle_sw")) scene.anims.create({ key: "dragon_idle_sw", frames: scene.anims.generateFrameNumbers("tower_dragon_sheet_mirrored", { frames: manifest.idleSE }), frameRate: manifest.frameRate, repeat: -1 });
          if (!scene.anims.exists("dragon_fire_sw")) scene.anims.create({ key: "dragon_fire_sw", frames: scene.anims.generateFrameNumbers("tower_dragon_sheet_mirrored", { frames: manifest.fireSE }), frameRate: manifest.frameRate * 1.2, repeat: 0 });
        }
      } else if (manifest.id === "sein_pyaung") {
        if (scene.textures.exists(manifest.sheetKey)) {
          if (!scene.anims.exists("sein_pyaung_idle_se")) scene.anims.create({ key: "sein_pyaung_idle_se", frames: scene.anims.generateFrameNumbers(manifest.sheetKey, { frames: manifest.idleSE }), frameRate: manifest.frameRate, repeat: -1 });
          if (!scene.anims.exists("sein_pyaung_fire_se")) scene.anims.create({ key: "sein_pyaung_fire_se", frames: scene.anims.generateFrameNumbers(manifest.sheetKey, { frames: manifest.fireSE }), frameRate: manifest.frameRate * 1.2, repeat: 0 });
          if (!scene.anims.exists("sein_pyaung_idle_ne")) scene.anims.create({ key: "sein_pyaung_idle_ne", frames: scene.anims.generateFrameNumbers(manifest.sheetKey, { frames: manifest.idleNE }), frameRate: manifest.frameRate, repeat: -1 });
          if (!scene.anims.exists("sein_pyaung_fire_ne")) scene.anims.create({ key: "sein_pyaung_fire_ne", frames: scene.anims.generateFrameNumbers(manifest.sheetKey, { frames: manifest.fireNE }), frameRate: manifest.frameRate * 1.2, repeat: 0 });
        }
        if (scene.textures.exists("tower_sein_pyaung_sheet_mirrored")) {
          if (!scene.anims.exists("sein_pyaung_idle_nw")) scene.anims.create({ key: "sein_pyaung_idle_nw", frames: scene.anims.generateFrameNumbers("tower_sein_pyaung_sheet_mirrored", { frames: manifest.idleNE }), frameRate: manifest.frameRate, repeat: -1 });
          if (!scene.anims.exists("sein_pyaung_fire_nw")) scene.anims.create({ key: "sein_pyaung_fire_nw", frames: scene.anims.generateFrameNumbers("tower_sein_pyaung_sheet_mirrored", { frames: manifest.fireNE }), frameRate: manifest.frameRate * 1.2, repeat: 0 });
          if (!scene.anims.exists("sein_pyaung_idle_sw")) scene.anims.create({ key: "sein_pyaung_idle_sw", frames: scene.anims.generateFrameNumbers("tower_sein_pyaung_sheet_mirrored", { frames: manifest.idleSE }), frameRate: manifest.frameRate, repeat: -1 });
          if (!scene.anims.exists("sein_pyaung_fire_sw")) scene.anims.create({ key: "sein_pyaung_fire_sw", frames: scene.anims.generateFrameNumbers("tower_sein_pyaung_sheet_mirrored", { frames: manifest.fireSE }), frameRate: manifest.frameRate * 1.2, repeat: 0 });
        }
      } else if (manifest.id === "bell") {
        if (scene.textures.exists(manifest.sheetKey)) {
          if (!scene.anims.exists("bell_idle")) {
            scene.anims.create({
              key: "bell_idle",
              frames: scene.anims.generateFrameNumbers(manifest.sheetKey, {
                frames: manifest.idleSE,
              }),
              frameRate: manifest.frameRate,
              repeat: -1,
            });
          }
          if (!scene.anims.exists("bell_attack")) {
            scene.anims.create({
              key: "bell_attack",
              frames: scene.anims.generateFrameNumbers(manifest.sheetKey, {
                frames: manifest.fireSE,
              }),
              frameRate: manifest.frameRate * 1.2,
              repeat: 0,
            });
          }
        }
      }
    }

    if (
      scene.textures.exists(BELL_ATTACK_VFX_SHEET_KEY) &&
      !scene.anims.exists(BELL_ATTACK_VFX_ANIM_KEY)
    ) {
      const vfxTexture = scene.textures.get(BELL_ATTACK_VFX_SHEET_KEY);
      if (vfxTexture && vfxTexture.frameTotal > 1) {
        scene.anims.create({
          key: BELL_ATTACK_VFX_ANIM_KEY,
          frames: scene.anims.generateFrameNumbers(BELL_ATTACK_VFX_SHEET_KEY, {
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
   * Spawns a one-shot bell attack VFX sprite at `(x, y)` that destroys itself when finished.
   */
  static spawnBellAttackVfx(
    scene: Phaser.Scene,
    x: number,
    y: number,
  ): Phaser.GameObjects.Sprite | undefined {
    if (
      !scene.textures.exists(BELL_ATTACK_VFX_SHEET_KEY) ||
      !scene.anims.exists(BELL_ATTACK_VFX_ANIM_KEY)
    ) {
      return undefined;
    }

    const vfx = scene.add
      .sprite(x, y, BELL_ATTACK_VFX_SHEET_KEY)
      .setOrigin(0.5, 0.75)
      .setScale(0.11);

    vfx.play(BELL_ATTACK_VFX_ANIM_KEY);
    vfx.once(`animationcomplete-${BELL_ATTACK_VFX_ANIM_KEY}`, () => {
      vfx.destroy();
    });

    return vfx;
  }
}

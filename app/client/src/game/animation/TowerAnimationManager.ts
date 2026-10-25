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
};

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
    }
  }

  static createAnimations(scene: Phaser.Scene): void {
    for (const manifest of Object.values(TOWER_ANIM_MANIFESTS)) {
      if (manifest.id === "water_cannon") {
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
      }
    }
  }
}

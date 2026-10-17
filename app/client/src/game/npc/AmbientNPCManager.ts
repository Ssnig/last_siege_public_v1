import Phaser from "phaser";
import { DEPTH } from "../stages/GameplayStage";

export interface AmbientSpawnConfig {
  id: string;
  type: "character" | "object";
  textureKey: string;
  x: number;
  y: number;
  scale?: number;
  flipX?: boolean;
  alpha?: number;
}

/**
 * Manages un-interactable ambient NPCs, villagers, animals, and decorative scenery
 * to bring the historical battlefield to life without obstructing towers or pathing.
 */
export class AmbientNPCManager {
  private readonly scene: Phaser.Scene;
  private readonly rootContainer: Phaser.GameObjects.Container;
  private readonly ambientObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly tweens: Phaser.Tweens.Tween[] = [];

  constructor(scene: Phaser.Scene, rootContainer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.rootContainer = rootContainer;
  }

  /**
   * Spawns map-specific ambient characters and scenic props.
   */
  spawnForMap(mapId: string): void {
    const spawns = this.getSpawnsForMap(mapId);

    for (const config of spawns) {
      // Skip any NPC whose art hasn't been bundled/registered yet. An earlier
      // version fell back to the `spawn_1` mob-portal texture, which scattered
      // spinning portals over the battlefield wherever a villager was meant to
      // be. Nothing is drawn until the real texture loads.
      if (!this.scene.textures.exists(config.textureKey)) continue;

      const sprite = this.scene.add
        .sprite(config.x, config.y, config.textureKey)
        .setOrigin(0.5, 0.8)
        .setScale(config.scale ?? 0.35)
        .setAlpha(config.alpha ?? 0.95)
        .setDepth(DEPTH.BASE_LAYER + config.y * 0.001);

      if (config.flipX) {
        sprite.setFlipX(true);
      }

      // Gentle ambient breathing / idle bobbing animation
      const tween = this.scene.tweens.add({
        targets: sprite,
        y: config.y - (config.type === "character" ? 3 : 1),
        duration: 1200 + Math.random() * 600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      this.tweens.push(tween);
      this.ambientObjects.push(sprite);
      this.rootContainer.add(sprite);
    }
  }

  /**
   * Designated scenic coordinates for ambient elements across maps.
   */
  private getSpawnsForMap(mapId: string): AmbientSpawnConfig[] {
    switch (mapId) {
      case "konbaung":
      default:
        return [
          // Monk praying near the northern royal shrine
          {
            id: "monk_north",
            type: "character",
            textureKey: "npc_monk",
            x: 95,
            y: 165,
            scale: 0.3,
            flipX: false,
          },
          // Peacock roaming in the central temple gardens
          {
            id: "peacock_garden",
            type: "character",
            textureKey: "npc_peacock",
            x: 640,
            y: 360,
            scale: 0.28,
            flipX: true,
          },
          // Decorative palace banner near base gate
          {
            id: "palace_banner",
            type: "object",
            textureKey: "object_banner",
            x: 980,
            y: 330,
            scale: 0.35,
          },
          // Water pot / offerings shrine in the south road curve
          {
            id: "shrine_south",
            type: "object",
            textureKey: "object_shrine",
            x: 480,
            y: 580,
            scale: 0.32,
          },
        ];
    }
  }

  destroy(): void {
    for (const tween of this.tweens) {
      tween.stop();
      tween.remove();
    }
    this.tweens.length = 0;

    for (const obj of this.ambientObjects) {
      obj.destroy();
    }
    this.ambientObjects.length = 0;
  }
}

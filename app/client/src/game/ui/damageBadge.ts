import Phaser from "phaser";
import { DAMAGE_TYPES, type DamageType } from "@root/shared";
import { DAMAGE_BADGE_STYLE } from "../damageTypes";

/**
 * Draws the damage-type badge shown on a tower card.
 *
 * @remarks Painted with plain vector shapes (a steel blade for physical
 * damage, a violet spark for mental damage) so the badge needs no art files
 * and scales with the card.
 *
 * @param scene - Scene that owns the badge's display objects.
 * @param damageType - Damage channel to show.
 * @param size - Badge diameter in pixels.
 * @returns A container holding the badge, centred on its own origin.
 */
export function createDamageBadge(
  scene: Phaser.Scene,
  damageType: DamageType,
  size: number,
): Phaser.GameObjects.Container {
  const style = DAMAGE_BADGE_STYLE[damageType];
  const container = scene.add.container(0, 0);

  container.add(
    scene.add
      .circle(0, 0, size / 2, 0x020617, 0.88)
      .setStrokeStyle(1, style.accentHex, 0.8),
  );

  if (damageType === DAMAGE_TYPES.mental) {
    container.add(
      scene.add.star(0, 0, 4, size * 0.16, size * 0.34, style.accentHex),
    );
  } else {
    container.add([
      scene.add.triangle(
        0,
        -size * 0.06,
        0,
        -size * 0.34,
        size * 0.14,
        size * 0.12,
        -size * 0.14,
        size * 0.12,
        style.accentHex,
      ),
      scene.add.rectangle(0, size * 0.16, size * 0.44, size * 0.1, 0xfbbf24),
      scene.add.rectangle(0, size * 0.3, size * 0.1, size * 0.16, 0x94a3b8),
    ]);
  }

  return container;
}

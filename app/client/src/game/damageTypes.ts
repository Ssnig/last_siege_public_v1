import { DAMAGE_TYPES, TOWER_TYPES, type DamageType } from "@root/shared";

/**
 * Presentation palette for the damage-type badges drawn on tower cards.
 *
 * @remarks Kept free of any renderer so the Phaser card, the React HUD and
 * the draft overlay all paint the same badge: a steel blade for physical
 * damage and a violet spark for mental damage.
 */
export const DAMAGE_BADGE_STYLE: Record<
  DamageType,
  { accent: string; accentHex: number; label: string }
> = {
  physical: {
    accent: "#cbd5e1",
    accentHex: 0xcbd5e1,
    label: "Physical damage",
  },
  mental: {
    accent: "#c084fc",
    accentHex: 0xc084fc,
    label: "Mental damage",
  },
};

/**
 * Damage channel of a tower.
 *
 * @param towerId - Tower catalog id.
 * @returns The tower's damage channel, defaulting to physical.
 */
export function damageTypeOfTower(towerId: string | undefined): DamageType {
  if (!towerId) return DAMAGE_TYPES.physical;
  return TOWER_TYPES[towerId]?.damageType ?? DAMAGE_TYPES.physical;
}

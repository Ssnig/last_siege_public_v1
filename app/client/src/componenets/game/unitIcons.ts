/**
 * Mapped unit artwork, shared by the draft and the attacker deploy bar.
 *
 * @remarks Mirrors the icon choices in the draft's tactical catalog so a unit
 * reads identically wherever it appears. Missing ids fall back to the draft's
 * generic banner glyph at the call site.
 */
export const MOB_ICONS: Record<string, string> = {
  grunt: '/assets/sprites/unit_warrior.png',
  runner: '/assets/units/horse_rider/face.png',
  horse_rider: '/assets/units/horse_rider/face.png',
  sar_bal_gyi: '/assets/units/sar_bal_gyi/face.png',
  gya_pu: '/assets/units/gya_pu/face.png',
  a_ba: '/assets/units/a_ba/face.png',
  chon_toe: '/assets/units/chon_toe/face.png',
  brute: '/assets/units/sar_bal_gyi/face.png',
  shade: '/assets/units/shade/face.png',
  spider: '/assets/units/spider/face.png',
};

/** Portal sprites, indexed by portal order (portal 1 uses `spawn1.png`). */
export const PORTAL_ICONS: string[] = [
  '/assets/sprites/spawn1.png',
  '/assets/sprites/spawn2.png',
  '/assets/sprites/spawn3.png',
  '/assets/sprites/spawn4.png',
  '/assets/sprites/spawn5.png',
  '/assets/sprites/spawn6.png',
];

/** Resolve a unit id to its artwork path, if one is mapped. */
export function mobIcon(typeId: string): string | undefined {
  return MOB_ICONS[typeId];
}

/** Resolve a portal's artwork by its position in the map, wrapping past six. */
export function portalIcon(index: number): string {
  return PORTAL_ICONS[index % PORTAL_ICONS.length];
}

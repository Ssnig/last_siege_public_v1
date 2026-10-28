/**
 * Mapped unit artwork, shared by the draft and the attacker deploy bar.
 *
 * @remarks Mirrors the icon choices in the draft's tactical catalog so a unit
 * reads identically wherever it appears. Missing ids fall back to the draft's
 * generic banner glyph at the call site.
 */
export const MOB_ICONS: Record<string, string> = {
  horse_rider: '/assets/units/horse_rider/face.webp',
  sar_bal_gyi: '/assets/units/sar_bal_gyi/face.webp',
  gya_pu: '/assets/units/gya_pu/face.webp',
  a_ba: '/assets/units/a_ba/face.webp',
  chon_toe: '/assets/units/chon_toe/face.webp',
  elephant_rider: '/assets/units/elephant_rider/face.webp',
  monkey: '/assets/units/monkey/face.webp',
  say_sayar: '/assets/units/say_sayar/face.webp',
  shield_guy: '/assets/units/shield_guy/face.webp',
  doe_pat: '/assets/units/doe_pat/face.webp',
  bandit: '/assets/units/Bandit/face.webp',
  belu: '/assets/units/Belu/face.webp',
  brute: '/assets/units/Brute/face.webp',
  general: '/assets/units/General/face.webp',
  sone_ma: '/assets/units/SoneMa/face.webp',
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

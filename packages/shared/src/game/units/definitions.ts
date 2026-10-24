import type { MobType } from "./types.js";
import mobsJson from "../../data/mobs.json" with { type: "json" };

/** Authoritative Attacker Unit Archetypes keyed by id. */
export const MOB_TYPES: Record<string, MobType> = mobsJson as Record<string, MobType>;

/** Default core units used in draft and attacker previews. */
export const CORE_UNIT_IDS: string[] = [
  "grunt",
  "runner",
  "horse_rider",
  "sar_bal_gyi",
  "gya_pu",
  "a_ba",
  "chon_toe",
  "sapper",
  "shade",
  "spider",
  "orc",
  "necromancer",
];


import type { MobType } from "./types.js";
import mobsJson from "../../data/mobs.json" with { type: "json" };

/** Authoritative Attacker Unit Archetypes keyed by id. */
export const MOB_TYPES: Record<string, MobType> = mobsJson as Record<string, MobType>;

/** Default core units used in draft and attacker previews (all 15 catalog mobs). */
export const CORE_UNIT_IDS: string[] = Object.keys(MOB_TYPES);

/** All available mob ids across the full catalog (15 units). */
export const ALL_MOB_IDS: string[] = Object.keys(MOB_TYPES);

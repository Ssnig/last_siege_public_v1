/**
 * Wire contract for room messages.
 *
 * @remarks
 * `role_assigned` and `you_economy` are one-off/private pushes to a single
 * client; the intent keys are client → server. Keeping the keys here prevents
 * typos drifting between the two apps.
 */
import type { WaveSize, WaveSizeRules } from "./balance.js";
import type { StagedBatch } from "./waves.js";

export const MESSAGES = {
  /** Client → server: this client's HUD is listening for its role payload. */
  ready: "ready",
  /** Server → client (private): role/name handshake once both are ready. */
  roleAssigned: "role_assigned",
  /** Server → client (private): the other player left; `youAreHost` when promoted. */
  opponentLeft: "opponent_left",
  /** Server → client (private): the match ended and who won, with the reason. */
  gameOver: "game_over",
  /** Client → server: this client concedes; the opponent wins. */
  surrender: "surrender",
  /** Server → client (private): hidden economy snapshot for this player. */
  youEconomy: "you_economy",
  /** Server → client (private): the attacker's staged army + wave rules. */
  attackerArmy: "attacker_army",
  /** Server → client (private): a wave intent was refused, with a reason. */
  waveRejected: "wave_rejected",
  /** Client → server: defender places a tower in a slot. */
  placeTower: "place_tower",
  /** Client → server: defender upgrades a tower. */
  upgradeTower: "upgrade_tower",
  /** Client → server: defender sells a tower. */
  sellTower: "sell_tower",
  /** Client → server: attacker stages one batch of units on a path. */
  waveAddBatch: "wave_add_batch",
  /** Client → server: attacker changes a staged batch's unit count. */
  waveSetCount: "wave_set_count",
  /** Client → server: attacker removes a staged batch. */
  waveRemoveBatch: "wave_remove_batch",
  /** Client → server: attacker reorders a staged batch within its path. */
  waveReorder: "wave_reorder",
  /** Client → server: attacker switches a path's wave between big and small. */
  waveSetSize: "wave_set_size",
  /** Client → server: attacker clears all staged batches on a path. */
  waveClear: "wave_clear",
  /** Client → server: attacker releases staged waves (all, or the listed paths). */
  waveRelease: "wave_release",
  /** Client → server: this side finished its deck draft. */
  draftReady: "draft_ready",
  /** Client → server: this side submitted picks for the current draft round. */
  draftPick: "draft_pick",
  /** Server → client (broadcast): draft round update, revealed picks, and timer. */
  draftRoundUpdate: "draft_round_update",
  /** Client → server: start combat phase manually. */
  startCombat: "start_combat",

  draftRejected: "draft_rejected",

  /** Client → server: this client requests/votes for a rematch. */
  rematch: "rematch",
  /** Server → client (broadcast): rematch vote count and requester info. */
  rematchUpdate: "rematch_update",
} as const;

/** Payload of the `role_assigned` private message. */
export interface RoleAssignedPayload {
  myName: string;
  myRole: string;
  opponentName: string;
  opponentRole: string;
}

/** Payload of the opponent_left message */
export interface OpponentLeftPayload {
  opponentName: string;
  youAreHost : boolean
}

/**
 * Why a match ended.
 *
 * @remarks `core` = the defender's base was destroyed; `surrender` = a
 * concession; `time` = the round timer expired and the attacker had no units
 * left. Also mirrored into `RoomState.gameOverReason`.
 */
export type GameOverReason = "surrender" | "core" | "time";

/** Payload of the `game_over` private message. */
export interface GameOverPayload {
  winner: "attacker" | "defender";
  reason: GameOverReason;
}

/** Payload of the `you_economy` private message (hidden from the opponent). */
export interface YouEconomyPayload {
  gold: number;
  deck: string[];
  bigWavesRemaining: number;
  /** Current passive gold earned per second. */
  incomeRate?: number;
}

/** One path's staged army inside an `attacker_army` push. */
export interface AttackerArmyPath {
  pathId: string;
  /** Display name from the map's `pathLabels`; UI falls back to `Path N`. */
  label?: string;
  size: WaveSize;
  batches: StagedBatch[];
  /** Total gold to send this wave (units + fee). */
  goldCost: number;
  troopCount: number;
}

/**
 * Payload of the `attacker_army` private message.
 *
 * @remarks Carries everything the attacker's army-management UI needs: their
 * current gold, the per-size limits, per-unit costs and the staged composition
 * per path. Sent only to the attacker; the defender sees none of it.
 */
export interface AttackerArmyPayload {
  gold: number;
  goldPerSecond: number;
  /** `true` once the round timer expired and passive income stopped. */
  incomeExpired: boolean;
  bigWavesRemaining: number;
  /** The attacker's drafted unit ids (their legal choices). */
  availableTroops: string[];
  limits: Record<WaveSize, WaveSizeRules>;
  /** Gold cost per unit id, mirroring `MOB_TYPES`. */
  mobCosts: Record<string, number>;
  paths: AttackerArmyPath[];
}

/** Payload of the `wave_rejected` private message. */
export interface WaveRejectedPayload {
  reason: string;
}

export interface PlaceTowerIntent {
  typeId: string;
  slotIndex: number;
}

export interface UpgradeTowerIntent {
  towerId: string;
}

export interface SellTowerIntent {
  towerId: string;
}

export interface WaveAddBatchIntent {
  pathId: string;
  typeId: string;
  count: number;
}

export interface WaveSetCountIntent {
  pathId: string;
  batchId: string;
  count: number;
}

export interface WaveRemoveBatchIntent {
  pathId: string;
  batchId: string;
}

export interface WaveReorderIntent {
  pathId: string;
  batchId: string;
  toIndex: number;
}

export interface WaveSetSizeIntent {
  pathId: string;
  size: WaveSize;
}

export interface WaveClearIntent {
  pathId: string;
}

export interface WaveReleaseIntent {
  /** Paths to release; omit to release every non-empty staged path. */
  pathIds?: string[];
}

export interface DraftReadyIntent {
  deck: string[];
}

export interface DraftPickIntent {
  round: number;
  picks: string[];
}

export interface DraftRoundUpdatePayload {
  round: number;
  phaseEndsAt: number;
  attackerPicks: string[];
  defenderPicks: string[];
  attackerReady: boolean;
  defenderReady: boolean;
  isFinalReveal?: boolean;
}

export interface StartCombatIntent {
  // No payload needed for now
}

export interface RematchUpdatePayload {
  votes: number;
  total: number;
  requesterSessionId: string;
}

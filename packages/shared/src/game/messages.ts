/**
 * Wire contract for room messages.
 *
 * @remarks
 * `role_assigned` and `you_economy` are one-off/private pushes to a single
 * client; the intent keys are client → server. Keeping the keys here prevents
 * typos drifting between the two apps.
 */
export const MESSAGES = {
  /** Client → server: this client's HUD is listening for its role payload. */
  ready: "ready",
  /** Server → client (private): role/name handshake once both are ready. */
  roleAssigned: "role_assigned",
  /** Server → client (private): the other player left; `youAreHost` when promoted. */
  opponentLeft: "opponent_left",
  /** Server → client (private): the opponent's socket dropped; they may return. */
  opponentReconnecting: "opponent_reconnecting",
  /** Server → client (private): the dropped opponent came back. */
  opponentReconnected: "opponent_reconnected",
  /** Server → client (private): the match ended and who won, with the reason. */
  gameOver: "game_over",
  /** Client → server: this client concedes; the opponent wins. */
  surrender: "surrender",
  /** Server → client (private): hidden economy snapshot for this player. */
  youEconomy: "you_economy",
  /** Server → client (private): the attacker's deploy buffer + portal charges. */
  attackerBuffer: "attacker_buffer",
  /** Server → client (private): a deploy intent was refused, with a reason. */
  deployRejected: "deploy_rejected",
  /** Client → server: defender places a tower in a slot. */
  placeTower: "place_tower",
  /** Client → server: defender upgrades a tower. */
  upgradeTower: "upgrade_tower",
  /** Client → server: defender sells a tower. */
  sellTower: "sell_tower",
  /** Client → server: attacker queues one unit into the deploy buffer. */
  bufferAdd: "buffer_add",
  /** Client → server: attacker empties the deploy buffer (gold is refunded). */
  bufferClear: "buffer_clear",
  /** Client → server: attacker deploys the buffer through a portal. */
  deploy: "deploy",
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
  /** Server → client (broadcast): a mob triggered an active ability (e.g. heal aura). */
  mobAbility: "mob_ability",
  /** Server → client (broadcast): a non-projectile AoE tower (e.g. Bell Tower) pulsed. */
  towerAttack: "tower_attack",
  /** Server -> client (broadcast): a mob detonated / exploded on death (e.g. Dragon Tower cataclysmic detonation). */
  mobDeathExplosion: "mob_death_explosion",
  /** Server -> client (broadcast): Gun tower extra bounty proc on kill. */
  gunBountyProc: "gun_bounty_proc",
  /** Server -> client (broadcast): damage dealt to a mob. */
  combatDamage: "combat_damage",
  /** Client → server: this client has finished loading game assets. */
  clientAssetsLoaded: "client_assets_loaded",
  /** Server → client (broadcast): asset loading status update while waiting. */
  assetLoadingStatus: "asset_loading_status",
} as const;

/** Payload of the `role_assigned` private message. */
export interface RoleAssignedPayload {
  myName: string;
  myRole: string;
  opponentName: string;
  opponentRole: string;
  /** Authoritative phase at assignment time (usually `mapReveal`). */
  phase: string;
  /** Authoritative seconds left in that phase. */
  phaseEndsAt: number;
  /** Concrete map id rolled for this match. */
  mapId: string;
}

/** Payload of the opponent_left message */
export interface OpponentLeftPayload {
  opponentName: string;
  youAreHost : boolean
}

/**
 * Payload of the `opponent_reconnecting` private message.
 *
 * @remarks Sent to the player who is still connected when their opponent's
 * socket drops. The game keeps running; if the opponent is not back within
 * `secondsRemaining`, the remaining player is declared the winner.
 */
export interface OpponentReconnectingPayload {
  opponentName: string;
  /** Whole seconds before the seat is forfeited and the match is awarded. */
  secondsRemaining: number;
}

/** Payload of the `opponent_reconnected` private message. */
export interface OpponentReconnectedPayload {
  opponentName: string;
}

/**
 * Why a match ended.
 *
 * @remarks `core` = the defender's base was destroyed; `surrender` = a
 * concession; `time` = the siege timer expired with no attacker units on the
 * field; `suddenDeath` = the siege timer expired with units still on the field
 * and the defender outlasted them; `disconnect` = the opponent did not return
 * inside the reconnection window. Also mirrored into `RoomState.gameOverReason`.
 */
export type GameOverReason =
  | "surrender"
  | "core"
  | "time"
  | "suddenDeath"
  | "disconnect";

/** Rating shift and rank progression delivered upon game over. */
export interface RatingUpdateInfo {
  oldElo: number;
  newElo: number;
  delta: number;
  rank: {
    id: string;
    tier: number;
    name: string;
    badgeAsset: string;
    promotionVideo?: string;
    color: string;
  };
  nextRank: {
    id: string;
    tier: number;
    name: string;
    minElo: number;
  } | null;
  progressPercent: number;
}

/** Payload of the `game_over` private message. */
export interface GameOverPayload {
  winner: "attacker" | "defender";
  reason: GameOverReason;
  ratingUpdate?: RatingUpdateInfo;
}

/** Payload of the `you_economy` private message (hidden from the opponent). */
export interface YouEconomyPayload {
  gold: number;
  deck: string[];
  /** Current passive gold earned per second. */
  incomeRate?: number;
}

/**
 * One portal's deploy readiness inside an `attacker_buffer` push.
 *
 * @remarks Charge countdown is fractional so the UI can fill a pip smoothly;
 * `charges` itself stays whole.
 */
/** One track a deploy portal can send units down, for the path chooser. */
export interface AttackerPortalPath {
  /** Track id validated against the map's paths. */
  id: string;
  /** Display name from the map's `pathLabels`, falling back to `"Path N"`. */
  label: string;
}

export interface AttackerPortalStatus {
  /** Stable per-map portal id (see {@link mapPortals}). */
  id: string;
  charges: number;
  maxCharges: number;
  /** Seconds until the next charge restores; `0` while already full. */
  rechargeIn: number;
  /** Seconds this portal takes to restore one charge. */
  chargeSec: number;
  /** Tracks leaving this portal; more than one means a fork worth choosing. */
  paths: AttackerPortalPath[];
  /** `true` if this portal is currently locked pending progressive unlock schedule. */
  locked?: boolean;
  /** Seconds until this portal unlocks; `0` if already unlocked. */
  unlocksInSec?: number;
}

/**
 * Payload of the `attacker_buffer` private message.
 *
 * @remarks Carries everything the attacker's deploy UI needs: their current
 * gold, the buffer contents (one type id per queued unit, in spawn order), the
 * per-portal charge state, and the unit costs. Sent only to the attacker; the
 * defender sees none of it.
 */
export interface AttackerBufferPayload {
  gold: number;
  goldPerSecond: number;
  /** `true` once sudden death stopped the attacker's passive income. */
  incomeExpired: boolean;
  /** The attacker's drafted unit ids (their legal choices). */
  availableTroops: string[];
  /** Queued units in deploy order; one type id per buffer slot. */
  buffer: string[];
  maxBufferUnits: number;
  /** Gold cost per unit id, mirroring `MOB_TYPES`. */
  mobCosts: Record<string, number>;
  portals: AttackerPortalStatus[];
  /** `true` when the buffer could be deployed right now (combat, charges left). */
  canDeploy: boolean;
}

/** Payload of the `deploy_rejected` private message. */
export interface DeployRejectedPayload {
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

export interface BufferAddIntent {
  typeId: string;
}

export interface BufferClearIntent {
  // No payload: clears the whole buffer.
}

export interface DeployIntent {
  /** Portal to stream the buffer out of. */
  portalId: string;
  /** Optional track override; defaults to the portal's first path. */
  pathId?: string;
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
  waitingForAssets?: boolean;
  availableMobPool?: string[];
}

export interface AssetLoadingStatusPayload {
  waitingForAssets: boolean;
  loadedCount: number;
  totalCount: number;
}

export interface StartCombatIntent {
  // No payload needed for now
}

export interface RematchUpdatePayload {
  votes: number;
  total: number;
  requesterSessionId: string;
}

/** Payload of the `mob_ability` broadcast message. */
export interface MobAbilityPayload {
  /** Server mob id of the caster (e.g. "mob-1-top-0"). */
  casterId: string;
  /** Ability archetype that fired. */
  abilityType: "heal_aura" | "speed_aura" | "self_heal";
  /** Server mob ids of all allied mobs affected by this ability cast. */
  targetIds: string[];
  /** Amount healed for heal_aura or self_heal casts. */
  healAmount?: number;
  /** Specific amount healed per target mob, reflecting heal exhaustion stacks. */
  healedAmounts?: Record<string, number>;
}

/** Payload of the `combat_damage` broadcast message. */
export interface CombatDamagePayload {
  /** Server mob id that took damage. */
  mobId: string;
  /** Actual damage applied to the mob. */
  damage: number;
  /** Damage type channel. */
  damageType: "physical" | "mental";
  /** World x position of the target mob. */
  x: number;
  /** World y position of the target mob. */
  y: number;
  /** True if the attack was heavy / critical. */
  isCrit?: boolean;
}

/** Payload of the `tower_attack` broadcast message for AoE pulse towers. */
export interface TowerAttackPayload {
  /** Slot index of the attacking tower. */
  slotIndex: number;
  /** Tower archetype id (e.g. "bell"). */
  typeId: string;
  /** Server mob ids of all mobs hit by this AoE pulse. */
  targetIds: string[];
  /** World positions of hit mobs (used as fallback if a mob died on the same tick). */
  targets: Array<{ id: string; x: number; y: number }>;
}

/** Payload of the `mob_death_explosion` broadcast message. */
export interface MobDeathExplosionPayload {
  /** Server mob id of the exploded mob. */
  mobId: string;
  /** World x position of the explosion. */
  x: number;
  /** World y position of the explosion. */
  y: number;
  /** Radius of the explosion in world px. */
  radius: number;
  /** Archetype id of the tower that caused the detonation (e.g. "dragon"). */
  sourceTowerTypeId: string;
}

/** Payload of the `gun_bounty_proc` broadcast message. */
export interface GunBountyProcPayload {
  /** Server mob id of the killed mob. */
  mobId: string;
  /** World x position of the killed mob. */
  x: number;
  /** World y position of the killed mob. */
  y: number;
  /** Extra bonus gold awarded on kill. */
  bonusGold: number;
}

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
  /** Server → client (private): hidden economy snapshot for this player. */
  youEconomy: "you_economy",
  /** Client → server: defender places a tower in a slot. */
  placeTower: "place_tower",
  /** Client → server: defender upgrades a tower. */
  upgradeTower: "upgrade_tower",
  /** Client → server: defender sells a tower. */
  sellTower: "sell_tower",
  /** Client → server: attacker commits one big wave. */
  sendBigWave: "send_big_wave",
  /** Client → server: attacker sends a cheap mini wave. */
  sendMiniWave: "send_mini_wave",
  /** Client → server: this side finished its deck draft. */
  draftReady: "draft_ready",

  draftRejected: "draft_rejected",

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

/** Payload of the `you_economy` private message (hidden from the opponent). */
export interface YouEconomyPayload {
  gold: number;
  deck: string[];
  bigWavesRemaining: number;
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

export interface SendBigWaveIntent {
  mobTypeIds: string[];
}

export interface SendMiniWaveIntent {
  mobTypeIds: string[];
}

export interface DraftReadyIntent {
  deck: string[];
}

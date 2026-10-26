
import { Room, Client, CloseCode, definePlugins } from "colyseus";
import { IdleKickPlugin } from "colyseus/plugins/idle-kick";
import {
  RoomState,
  Player,
  Tower,
  TowerEffect,
  Mob,
  MobEffect,
  Projectile,
  MESSAGES,
  MAPS,
  SAMPLE_MAP,
  MOB_TYPES,
  ALL_MOB_IDS,
  TOWER_TYPES,
  DEFAULT_DECK_RULES,
  DEFAULT_ECONOMY,
  DEFAULT_DEPLOY_RULES,
  DEFAULT_COMBAT_RULES,
  MATCH_RULES,
  MOB_SPEED_JITTER,
  PROJECTILE_HIT_RADIUS,
  pathLength,
  samplePathWithLateral,
  mapPath,
  mapPathIds,
  mapPortals,
  pickRandomMapId,
  RANDOM_MAP_ID,
  tierAt,
  validateBufferAdd,
  deployStaggerSec,
  portalChargeRules,
  DAMAGE_TYPES,
  EFFECT_TYPES,
  EFFECT_DURATION_SEC,
  TOWER_EFFECT_TYPES,
  combineEffectMagnitude,
  effectiveSpeed,
  mentalDamageTaken,
  mentalDebuffMagnitude,
  physicalDamageTaken,
  getTowerMuzzleOffset,
  type AttackerBufferPayload,
  type AttackerPortalPath,
  type AttackerPortalStatus,
  type BufferAddIntent,
  type DamageType,
  type DeployIntent,
  type DraftPickIntent,
  type DraftReadyIntent,
  type DraftRoundUpdatePayload,
  type EffectType,
  type TowerEffectType,
  type GameOverPayload,
  type GameOverReason,
  type MapDefinition,
  type MapPortal,
  type MobAbilityPayload,
  type MobType,
  type PlaceTowerIntent,
  type RoomStatus,
  type SellTowerIntent,
  type TowerAttackPayload,
  type UpgradeTowerIntent,
  type TowerTier,
  type TowerTierSpecial,
  type Vec2,
  type YouEconomyPayload,
  type RatingUpdateInfo,
  RANKING_CONFIG,
  getRankForElo,
  getNextRank,
  getRankProgress,
  calculateEloChange,
  buildCost,
  sellRefund,
  upgradeCost,
} from "@root/shared";
import mongoose from "mongoose";
import { UserModel } from "../models/User.js";
import { GuestUserModel } from "../models/GuestUser.js";
import { verifyAuthToken } from "../auth/tokens.js";
import { Phases } from "../game/phases.js";
import { selectTarget, type TargetCandidate } from "../game/targeting.js";

export type RoleChoice = "attacker" | "defender" | "random";
export type PlayerRole = "attacker" | "defender";

/**
 * Seconds a dropped client's seat is held open for reconnection.
 *
 * @remarks Must comfortably exceed the client SDK's own retry budget (default
 * backoff tops out at 5s and gives up after ~56s). A background tab throttles
 * the SDK's retry timers, so a short window here strands the player even when
 * they come back. When it lapses the opponent is declared the winner.
 */
const RECONNECT_WINDOW_SEC = 120;

export interface GameRoomMetadata {
  creatorName: string;
  roleChoice: RoleChoice;
  /**
   * The battlefield shown in the lobby browser: a concrete map id, or
   * {@link RANDOM_MAP_ID} while the host has opted into a random draw. Once the
   * reveal runs it is replaced with the map actually drawn.
   */
  mapId: string;
  /**
   * Lobby-browser status. Set to `"available"` on creation and promoted to
   * `"playing"` once a second player joins; never reverted, so a room whose
   * opponent left still reads as in-progress.
   */
  status: RoomStatus;
}

const DEFAULT_ATTACKER_DECK = [
  "horse_rider",
  "sar_bal_gyi",
  "gya_pu",
  "a_ba",
  "chon_toe",
  "elephant_rider",
  "shield_guy",
];

/** One batch waiting to spawn, scheduled against {@link GameRoom.matchTime}. */
interface ScheduledBatch {
  atMatchTime: number;
  pathId: string;
  typeId: string;
  count: number;
}

/**
 * Owns a 1v1 tower-defense match and its authoritative phase transitions.
 *
 * @remarks
 * Drafts remain server-private. Clients submit IDs; the server validates them
 * and changes the shared phase only after both players confirm valid drafts.
 */
export class GameRoom extends Room<{ state: RoomState }> {
  maxClients = 2;
  state = new RoomState();

  private creatorSessionId?: string;
  private readyClients = new Set<string>();
  private matchStarted = false;
  private matchRatingResolved = false;

  /**
   * Whether the host pinned a map via the lobby selector.
   *
   * @remarks When set, {@link handleReady} keeps that choice and only the reveal
   * screen is shown. When `false` (e.g. tests or quick-match) it falls back to a
   * random pick from the shared pool.
   */
  private mapChosen = false;

  /**
   * Validated draft IDs keyed by session ID.
   * Kept outside RoomState so one player cannot inspect the opponent's deck.
   */
  /** 10 units randomized for the current match from ALL_MOB_IDS. */
  private draftMobPool: string[] = [];
  private acceptedDecks = new Map<string, string[]>();

  /** Current 2-2-2 draft round (1, 2, or 3). */
  private draftRound = 1;

  /** Seconds remaining in current draft round (15.0s). */
  private draftRoundTimer = 15.0;

  /** 5-second post-draft countdown after round 3 concludes before entering building. */
  private draftFinalCountdown: number | null = null;

  /** Session IDs of clients who have confirmed their assets are loaded. */
  private loadedAssetsClients = new Set<string>();

  /** Whether the room is waiting for clients to finish loading assets after draft. */
  private waitingForAssets = false;

  /** Safety timeout (in seconds) while waiting for clients to load assets. */
  private assetWaitTimeout = 0;

  /** Picks submitted per player in the current round. */
  private draftRoundPicks = new Map<string, string[]>();

  /** Track player sessionIds that have voted for a rematch. */
  private rematchVotes = new Set<string>();

  /**
   * Hidden gold per session ID. Mirrors `acceptedDecks`: kept off `RoomState`
   * and pushed to the owner via private `you_economy` messages only.
   */
  private economies = new Map<string, number>();

  /** Dynamic passive income rate per player session ID, in gold per second. */
  private incomeRates = new Map<string, number>();

  /**
   * Attacker-only deploy buffers, keyed by session id.
   *
   * @remarks Deliberately off `RoomState`: the defender must never be able to
   * read what is queued against them before it spawns. One entry per queued
   * unit, in spawn order, so deploying streams them out front-to-back.
   */
  private attackerBuffers = new Map<string, string[]>();

  /**
   * Portal charge state per attacker session id, then per portal id.
   *
   * @remarks Charges gate how often the attacker can push a buffer through a
   * given portal. Regen is tracked as a fractional accumulator so a charge
   * restored mid-tick is never lost.
   */
  private portalCharges = new Map<string, Map<string, { charges: number; regenAcc: number }>>();

  /** Spawn schedule for deployed units, kept ordered by `atMatchTime`. */
  private releaseQueue: ScheduledBatch[] = [];

  /** Monotonic source of spawn batch ids, unique for the room's whole lifetime. */
  private spawnSeq = 0;

  /** Seconds elapsed since combat began; the deploy schedule is keyed to it. */
  private matchTime = 0;

  /** `true` once the income window expired, so attacker passive income stops. */
  private incomeExpired = false;

  /**
   * Session ids whose socket dropped and are inside their reconnection window.
   *
   * @remarks Distinguishes a timed-out drop (declare the opponent the winner)
   * from a deliberate `leave()` (reopen the room for a replacement) inside
   * {@link onLeave}, since both arrive through the same hook.
   */
  private pendingReconnect = new Set<string>();

  /**
   * Seconds a dropped client's seat is held open, defaulting to
   * {@link RECONNECT_WINDOW_SEC}.
   *
   * @remarks Overridable through room options so tests can exercise the
   * timeout path without waiting the full production window.
   */
  private reconnectWindowSec = RECONNECT_WINDOW_SEC;

  /** Dt accumulator that throttles passive-income pushes to roughly 1 Hz. */
  private incomePushAccumulator = 0;

  /** Authoritative phase + timer state machine. */
  private phases!: Phases;

  /** Previous tick's phase, used to detect the exact tick combat begins. */
  private lastPhase = "";

  /** Monotonic source of projectile ids, unique for the room's whole lifetime. */
  private projectileSeq = 0;

  /**
   * Ground point each in-flight projectile is flying toward, keyed by its id.
   *
   * @remarks Kept server-side (not synced) and refreshed from the living target
   * every tick while it lives. When the target dies the last aim is retained so
   * the shot still travels to where the mob was and lands instead of blinking
   * out mid-air.
   */
  private projectileAim = new Map<string, Vec2>();

  /**
   * Blast radius each in-flight projectile applies on impact, keyed by its id.
   *
   * @remarks `0` is a single-target arrow; a positive value is artillery, whose
   * landing still damages every mob inside the radius even if its aim target
   * died en route. Captured at spawn from the tower's `splashRadius` in
   * {@link TOWER_TYPES}.
   */
  private projectileSplash = new Map<string, number>();

  /** Remaining cooldown in seconds per active ability caster mob id. */
  private mobAbilityCooldowns = new Map<string, number>();

  /** Remaining cast-animation movement pause in seconds per caster mob id. */
  private mobCastPause = new Map<string, number>();

  /** Slot index of the tower that spawned each in-flight projectile, keyed by projectile id. */
  private projectileSourceSlot = new Map<string, number>();

  /** Scaling special tier configuration of the tower that fired each in-flight projectile. */
  private projectileSpecial = new Map<string, TowerTierSpecial>();

  /** Current consecutive shot wind-up stacks for ramping fire-rate towers (Archer), keyed by `${ownerId}-${slotIndex}`. */
  private towerWindupStacks = new Map<string, number>();

  /** Match time in seconds when a tower last fired, keyed by `${ownerId}-${slotIndex}`. */
  private towerLastFireTime = new Map<string, number>();

  /** Elapsed time in seconds each living mob has spent on the lane, keyed by mob id. */
  private mobAliveSec = new Map<string, number>();

  /** Initial spawn speed of each living mob (before progressive speed ramps), keyed by mob id. */
  private mobInitialSpeed = new Map<string, number>();

  plugins = definePlugins({
    /**
     * Drops clients that stop sending messages (e.g. a host who queued and
     * walked away before the match). An active match is exempt: the defender
     * legitimately sends nothing while watching combat, and kicking them here
     * closed the socket with code 1000 — a final leave the SDK will not
     * reconnect from — stranding them on a frozen, unresponsive board.
     */
    idle: new IdleKickPlugin({
      timeoutMs: 60_000,
      isExempt: () => this.matchStarted,
    }),
  });

  messages = {
    [MESSAGES.ready]: (client: Client) => this.handleReady(client),

    [MESSAGES.draftReady]: (
      client: Client,
      payload: DraftReadyIntent,
    ) => this.handleDraftReady(client, payload),

    [MESSAGES.draftPick]: (
      client: Client,
      payload: DraftPickIntent,
    ) => this.handleDraftPick(client, payload),

    [MESSAGES.surrender]: (client: Client) => this.handleSurrender(client),

    [MESSAGES.placeTower]: (
      client: Client,
      payload: PlaceTowerIntent,
    ) => this.handlePlaceTower(client, payload),

    [MESSAGES.sellTower]: (
      client: Client,
      payload: SellTowerIntent,
    ) => this.handleSellTower(client, payload),

    [MESSAGES.upgradeTower]: (
      client: Client,
      payload: UpgradeTowerIntent,
    ) => this.handleUpgradeTower(client, payload),

    [MESSAGES.startCombat]: (client: Client) => this.handleStartCombat(client),

    [MESSAGES.bufferAdd]: (
      client: Client,
      payload: BufferAddIntent,
    ) => this.handleBufferAdd(client, payload),

    [MESSAGES.bufferClear]: (client: Client) => this.handleBufferClear(client),

    [MESSAGES.deploy]: (
      client: Client,
      payload: DeployIntent,
    ) => this.handleDeploy(client, payload),

    [MESSAGES.rematch]: (client: Client) => this.handleRematch(client),
    [MESSAGES.clientAssetsLoaded]: (client: Client) =>
      this.handleClientAssetsLoaded(client),
  };

  /**
   * Resolves the host's role choice and assigns the opposite role to the joiner.
   * On a reopened room, preserves the surviving player's role.
   */
  private assignRoles(): void {
    const creatorClient = this.clients[0];
    const joinerClient = this.clients[1];

    let creatorRole = creatorClient.userData?.role as
      | PlayerRole
      | undefined;

    if (!creatorRole) {
      const metadata = this.metadata as GameRoomMetadata;
      const choice = metadata?.roleChoice || "random";

      creatorRole =
        choice === "attacker"
          ? "attacker"
          : choice === "defender"
            ? "defender"
            : Math.random() < 0.5
              ? "attacker"
              : "defender";
    }

    const joinerRole: PlayerRole =
      creatorRole === "attacker" ? "defender" : "attacker";

    creatorClient.userData = {
      ...creatorClient.userData,
      role: creatorRole,
    };
    joinerClient.userData = {
      ...joinerClient.userData,
      role: joinerRole,
    };

    const creatorState = this.state.players.get(creatorClient.sessionId);
    const joinerState = this.state.players.get(joinerClient.sessionId);

    if (creatorState) creatorState.role = creatorRole;
    if (joinerState) joinerState.role = joinerRole;

    this.economies.set(creatorClient.sessionId, this.startingGold(creatorRole));
    this.economies.set(joinerClient.sessionId, this.startingGold(joinerRole));
    this.incomeRates.set(
      creatorClient.sessionId,
      creatorRole === "attacker"
        ? DEFAULT_ECONOMY.attackerBaseIncome
        : DEFAULT_ECONOMY.defenderBaseIncome,
    );
    this.incomeRates.set(
      joinerClient.sessionId,
      joinerRole === "attacker"
        ? DEFAULT_ECONOMY.attackerBaseIncome
        : DEFAULT_ECONOMY.defenderBaseIncome,
    );

    console.log(
      `Roles assigned: Creator = ${creatorRole}, Joiner = ${joinerRole}`,
    );
  }

  private startingGold(role: PlayerRole): number {
    return role === "defender"
      ? DEFAULT_ECONOMY.defenderStartingGold
      : DEFAULT_ECONOMY.attackerStartingGold;
  }

  /**
   * Pushes a player's private economy snapshot. Safe to call at any time; the
   * deck may be empty before the draft is confirmed.
   */
  private sendEconomy(client: Client): void {
    const role = client.userData?.role as PlayerRole | undefined;
    let deck = this.acceptedDecks.get(client.sessionId);
    if (!deck || deck.length === 0) {
      if (role === "defender") {
        deck = Object.keys(TOWER_TYPES).slice(0, 6);
      } else if (role === "attacker") {
        deck = DEFAULT_ATTACKER_DECK;
      }
    }
    const incomeRate =
      Math.round(this.effectiveIncomeRate(client.sessionId, role) * 10) / 10;

    const economy: YouEconomyPayload = {
      gold: Math.floor(this.economies.get(client.sessionId) ?? 0),
      deck: deck ?? [],
      incomeRate,
    };
    client.send(MESSAGES.youEconomy, economy);
  }

  /**
   * Pushes the attacker's deploy buffer plus the portal charges their HUD needs
   * to decide what to queue and where to push it. No-op for the defender, who
   * must not see the staging.
   */
  private sendAttackerBuffer(client: Client): void {
    const sessionId = client.sessionId;
    if (client.userData?.role !== "attacker") return;

    const deck = this.acceptedDecks.get(sessionId) ?? [];
    const availableTroops =
      deck.length > 0
        ? deck
        : (this.draftMobPool.length >= 6 ? this.draftMobPool.slice(0, 6) : DEFAULT_ATTACKER_DECK);
    const buffer = this.attackerBuffers.get(sessionId) ?? [];

    const currentIncome = this.effectiveIncomeRate(sessionId, "attacker");

    const payload: AttackerBufferPayload = {
      gold: Math.floor(this.economies.get(sessionId) ?? 0),
      goldPerSecond: Math.round(currentIncome * 10) / 10,
      incomeExpired: this.incomeExpired,
      availableTroops: [...availableTroops],
      buffer: [...buffer],
      maxBufferUnits: DEFAULT_DEPLOY_RULES.maxBufferUnits,
      mobCosts: Object.fromEntries(
        Object.entries(MOB_TYPES).map(([id, type]) => [id, type.cost]),
      ),
      portals: this.portalStatusFor(sessionId),
      canDeploy: this.canDeploy(sessionId),
    };

    client.send(MESSAGES.attackerBuffer, payload);
  }

  /** Convenience: push both private snapshots a player needs. */
  private sendPlayerState(client: Client): void {
    this.sendEconomy(client);
    this.sendAttackerBuffer(client);
  }

  /** Sends a private explanation for a refused deploy intent. */
  private rejectDeploy(client: Client, reason: string): void {
    console.log(`Deploy intent from ${client.sessionId} rejected: ${reason}`);
    client.send(MESSAGES.deployRejected, { reason });
  }

  /**
   * Sends one client the role snapshot its HUD needs to leave the waiting
   * screen: its own role plus the opponent's name and role.
   */
  private sendRoleAssigned(client: Client): void {
    const opponent = this.clients.find(
      (other) => other.sessionId !== client.sessionId,
    );

    client.send(MESSAGES.roleAssigned, {
      myName: client.userData.playerName,
      myRole: client.userData.role,
      opponentName: opponent?.userData.playerName,
      opponentRole: opponent?.userData.role,
      phase: this.state.phase,
      phaseEndsAt: this.state.phaseEndsAt,
      mapId: this.state.mapId,
    });
  }

  /**
   * Sends role details after both clients have registered their message
   * handlers.
   *
   * @remarks
   * A client that rejoins an already-started match — e.g. via the lobby's
   * resume prompt after a hard refresh — re-sends `ready` from a freshly
   * mounted component. That handshake must re-announce roles to that client
   * rather than being ignored, otherwise it is stranded on the waiting screen.
   */
  private handleReady(client: Client): void {
    this.readyClients.add(client.sessionId);

    if (this.matchStarted) {
      this.sendRoleAssigned(client);
      // The reconnect-time push can land before the fresh component subscribes,
      // so re-send the private snapshots now that its handlers exist.
      this.sendPlayerState(client);
      return;
    }
    if (this.readyClients.size < 2) return;
    this.matchStarted = true;

    // Both players are now listening: reveal the map before the draft opens so
    // they can plan around it. If the host picked one in the lobby, honour that
    // choice; otherwise draw a random map from the pool. Reconnects take the
    // branch above and never re-roll the map mid-match.
    if (!this.mapChosen) {
      const nextMapId = pickRandomMapId();
      if (nextMapId) this.state.mapId = nextMapId;
    }
    // Promote the lobby's "random" placeholder to the concrete map that was
    // drawn, so the browser list reflects the real battlefield.
    const metadata = this.metadata as GameRoomMetadata | undefined;
    if (metadata && metadata.mapId !== this.state.mapId) {
      this.setMetadata({ ...metadata, mapId: this.state.mapId });
    }
    this.phases.beginMapReveal();

    for (const c of this.clients) {
      this.sendRoleAssigned(c);
    }
  }

  /**
   * Validates and accepts a player's deck, then advances the phase if both
   * players have confirmed.
   *
   * @remarks
   * Only the role-appropriate catalog is accepted. Invalid submissions do not
   * mark the player ready. The client cannot choose the next phase.
   */
  private handleDraftReady(
    client: Client,
    payload: DraftReadyIntent,
  ): void {
    if (this.state.phase !== "drafting") return;

    const player = this.state.players.get(client.sessionId);
    const role = client.userData?.role as PlayerRole | undefined;

    if (
      !player ||
      (role !== "attacker" && role !== "defender")
    ) {
      this.rejectDraft(client, "Player role is not assigned.");
      return;
    }

    if (player.draftReady) {
      this.rejectDraft(client, "Your draft is already confirmed.");
      return;
    }

    if (
      !payload ||
      !Array.isArray(payload.deck) ||
      !payload.deck.every((id) => typeof id === "string")
    ) {
      this.rejectDraft(client, "Invalid deck payload.");
      return;
    }

    const catalog = role === "attacker" ? MOB_TYPES : TOWER_TYPES;
    const deck = payload.deck;
    const maxDeckSize = Math.min(
      DEFAULT_DECK_RULES.deckSize,
      Object.keys(catalog).length,
    );

    if (deck.length === 0 || deck.length > maxDeckSize) {
      this.rejectDraft(
        client,
        `Choose between 1 and ${maxDeckSize} units.`,
      );
      return;
    }

    if (new Set(deck).size !== deck.length) {
      this.rejectDraft(client, "Duplicate selections are not allowed.");
      return;
    }

    if (!deck.every((id) => Object.hasOwn(catalog, id))) {
      this.rejectDraft(client, "The deck contains an unknown unit.");
      return;
    }

    this.acceptedDecks.set(client.sessionId, [...deck]);
    player.draftReady = true;

    console.log(
      `${player.name} confirmed ${role} draft: ${deck.join(", ")}`,
    );

    const bothReady =
      this.clients.length === 2 &&
      this.clients.every((c) => {
        const currentPlayer = this.state.players.get(c.sessionId);

        return (
          currentPlayer?.draftReady === true &&
          this.acceptedDecks.has(c.sessionId)
        );
      });

    if (bothReady) {
      if (this.draftFinalCountdown !== null) {
        console.log(`Room ${this.roomId}: both confirmed draft ready; waiting for final reveal countdown (${this.draftFinalCountdown.toFixed(1)}s remaining)`);
        return;
      }
      this.phases.beginBuilding([]);
      console.log(`Room ${this.roomId}: drafting -> building`);

      // Push each player their own (now populated) economy snapshot.
      for (const c of this.clients) {
        this.sendPlayerState(c);
      }
    }
  }

  /** Sends a private explanation for a rejected draft submission. */
  private rejectDraft(client: Client, reason: string): void {
    client.send(MESSAGES.draftRejected, { reason });
  }

  /**
   * Handles round-based (2, 2, 2) draft pick submissions.
   */
  private handleDraftPick(client: Client, payload: DraftPickIntent): void {
    if (this.state.phase !== "drafting") return;

    const role = (this.state.players.get(client.sessionId)?.role || client.userData?.role) as PlayerRole | undefined;
    if (!role) return;

    if (!payload || typeof payload.round !== "number" || !Array.isArray(payload.picks)) {
      this.rejectDraft(client, "Invalid draft pick payload.");
      return;
    }

    if (payload.round !== this.draftRound) {
      console.log(`Room ${this.roomId}: Client ${client.sessionId} sent pick for round ${payload.round}, but room is in round ${this.draftRound}. Ignoring stale submission.`);
      return;
    }

    const catalog = role === "attacker" ? MOB_TYPES : TOWER_TYPES;
    const currentDeck = this.acceptedDecks.get(client.sessionId) ?? [];

    // Deduplicate picks and ensure they are valid catalog members not already in currentDeck
    const uniquePicks = Array.from(new Set(payload.picks));
    const validPicks = uniquePicks.filter(
      (id) => typeof id === "string" && Object.hasOwn(catalog, id) && !currentDeck.includes(id),
    );

    // If fewer than 2 valid picks, auto-fill the rest from unpicked pool entries
    const pool = role === "attacker" && this.draftMobPool.length > 0 ? this.draftMobPool : Object.keys(catalog);
    const available = pool.filter(
      (id) => !currentDeck.includes(id) && !validPicks.includes(id),
    );
    while (validPicks.length < 2 && available.length > 0) {
      const idx = Math.floor(Math.random() * available.length);
      validPicks.push(available.splice(idx, 1)[0]);
    }

    this.draftRoundPicks.set(client.sessionId, validPicks);

    // Check if both players have submitted picks for this round
    const bothSubmitted =
      this.clients.length === 2 &&
      this.clients.every((c) => this.draftRoundPicks.has(c.sessionId));

    if (bothSubmitted) {
      this.advanceDraftRound();
    }
  }

  /**
   * Commits the current draft round's picks, broadcasts revealed picks to both players,
   * and advances to the next round or triggers the 5-second final reveal countdown.
   */
  private advanceDraftRound(): void {
    // Commit the round picks to acceptedDecks (deduplicated and capped at deckSize)
    for (const client of this.clients) {
      const current = this.acceptedDecks.get(client.sessionId) ?? [];
      const picks = this.draftRoundPicks.get(client.sessionId) ?? [];
      const merged = Array.from(new Set([...current, ...picks])).slice(
        0,
        DEFAULT_DECK_RULES.deckSize,
      );
      this.acceptedDecks.set(client.sessionId, merged);
    }
    this.draftRoundPicks.clear();

    const attackerClient = this.clients.find(
      (c) => this.state.players.get(c.sessionId)?.role === "attacker" || c.userData?.role === "attacker",
    );
    const defenderClient = this.clients.find(
      (c) => this.state.players.get(c.sessionId)?.role === "defender" || c.userData?.role === "defender",
    );

    const attackerPicks = attackerClient ? (this.acceptedDecks.get(attackerClient.sessionId) ?? []) : [];
    const defenderPicks = defenderClient ? (this.acceptedDecks.get(defenderClient.sessionId) ?? []) : [];

    if (this.draftRound < 3) {
      // Broadcast mutual reveal for rounds 1 and 2
      this.broadcast(MESSAGES.draftRoundUpdate, {
        round: this.draftRound,
        phaseEndsAt: 15,
        attackerPicks,
        defenderPicks,
        attackerReady: true,
        defenderReady: true,
        availableMobPool: [...this.draftMobPool],
      });

      this.draftRound++;
      this.draftRoundTimer = 15.0;
      this.state.phaseEndsAt = 15.0;
    } else {
      // Round 3 complete! All 6 cards picked.
      if (this.areAllClientsAssetsLoaded()) {
        this.startPostDraftCountdown(attackerPicks, defenderPicks);
      } else {
        console.log(
          `Room ${this.roomId}: 2-2-2 draft finished; waiting for all clients to finish loading assets (${this.loadedAssetsClients.size}/${this.clients.length})`,
        );
        this.waitingForAssets = true;
        this.assetWaitTimeout = 45.0;
        this.state.phaseEndsAt = 0;
        this.broadcast(MESSAGES.draftRoundUpdate, {
          round: 3,
          phaseEndsAt: 0,
          attackerPicks,
          defenderPicks,
          attackerReady: true,
          defenderReady: true,
          isFinalReveal: true,
          waitingForAssets: true,
        });
        this.broadcast(MESSAGES.assetLoadingStatus, {
          waitingForAssets: true,
          loadedCount: this.loadedAssetsClients.size,
          totalCount: this.clients.length,
        });
      }
    }
  }

  private areAllClientsAssetsLoaded(): boolean {
    if (process.env.NODE_ENV === "test") return true;
    if (this.clients.length < 2) return true;
    return this.clients.every((c) => this.loadedAssetsClients.has(c.sessionId));
  }

  private handleClientAssetsLoaded(client: Client): void {
    this.loadedAssetsClients.add(client.sessionId);
    console.log(
      `Room ${this.roomId}: Client ${client.sessionId} loaded assets (${this.loadedAssetsClients.size}/${this.clients.length})`,
    );
    if (this.waitingForAssets) {
      this.checkAssetsAndProceed();
    }
  }

  private startPostDraftCountdown(
    attackerPicks?: string[],
    defenderPicks?: string[],
  ): void {
    this.waitingForAssets = false;
    this.draftFinalCountdown = 5.0;
    this.state.phaseEndsAt = 5.0;
    console.log(
      `Room ${this.roomId}: All players loaded assets. Starting 5-second post-draft countdown`,
    );

    const aPicks =
      attackerPicks ??
      (() => {
        const aClient = this.clients.find(
          (c) =>
            this.state.players.get(c.sessionId)?.role === "attacker" ||
            c.userData?.role === "attacker",
        );
        return aClient ? this.acceptedDecks.get(aClient.sessionId) ?? [] : [];
      })();

    const dPicks =
      defenderPicks ??
      (() => {
        const dClient = this.clients.find(
          (c) =>
            this.state.players.get(c.sessionId)?.role === "defender" ||
            c.userData?.role === "defender",
        );
        return dClient ? this.acceptedDecks.get(dClient.sessionId) ?? [] : [];
      })();

    this.broadcast(MESSAGES.draftRoundUpdate, {
      round: 3,
      phaseEndsAt: 5,
      attackerPicks: aPicks,
      defenderPicks: dPicks,
      attackerReady: true,
      defenderReady: true,
      isFinalReveal: true,
      waitingForAssets: false,
    });
  }

  private checkAssetsAndProceed(): void {
    if (!this.waitingForAssets) return;
    if (this.areAllClientsAssetsLoaded()) {
      this.startPostDraftCountdown();
    } else {
      this.broadcast(MESSAGES.assetLoadingStatus, {
        waitingForAssets: true,
        loadedCount: this.loadedAssetsClients.size,
        totalCount: this.clients.length,
      });
    }
  }

  /**
   * Handles tower placement during the building or combat phase.
   *
   * @remarks
   * Only the defender can place towers. The tower type must be in their deck
   * and they must have enough gold. Building is allowed throughout combat so
   * the defender can react to what is on the field.
   */
  private handlePlaceTower(client: Client, payload: PlaceTowerIntent): void {
    if (this.state.phase !== "building" && this.state.phase !== "combat") return;

    const role = client.userData?.role as PlayerRole | undefined;
    if (role !== "defender") {
      console.log(`Only defender can place towers. Client role: ${role}`);
      return;
    }

    const towerType = TOWER_TYPES[payload.typeId];
    if (!towerType) return;

    const deck = this.acceptedDecks.get(client.sessionId);
    const allowedDeck =
      deck && deck.length > 0 ? deck : Object.keys(TOWER_TYPES).slice(0, 6);
    const TOWER_ALIASES: Record<string, string[]> = {
      archer: ["basic", "arrow"],
      basic: ["archer", "arrow"],
      spear: ["pitchfork"],
      pitchfork: ["spear"],
      gun: ["sniper"],
      sniper: ["gun"],
      cannon: ["bertha"],
      bertha: ["cannon"],
    };
    const isAllowed = allowedDeck.some(
      (id) => id === payload.typeId || TOWER_ALIASES[payload.typeId]?.includes(id),
    );
    if (!isAllowed) {
      console.log(`Tower ${payload.typeId} not in defender's deck`);
      return;
    }

    // The slot must exist on this room's map.
    const map = MAPS[this.state.mapId] ?? SAMPLE_MAP;
    const slot = map.slots.find((s) => s.slotIndex === payload.slotIndex);
    if (!slot) {
      console.log(`Slot ${payload.slotIndex} does not exist on map ${map.id}`);
      return;
    }

    const slotOccupied = Array.from(this.state.towers.values()).some(
      (t) => t.slotIndex === payload.slotIndex,
    );
    if (slotOccupied) {
      console.log(`Slot ${payload.slotIndex} is already occupied`);
      return;
    }

    const cost = buildCost(towerType);
    const gold = this.economies.get(client.sessionId) ?? 0;
    if (gold < cost) {
      console.log(
        `Not enough gold to build ${payload.typeId} (${gold}/${cost})`,
      );
      return;
    }

    this.economies.set(client.sessionId, gold - cost);

    const towerId = `${client.sessionId}-${payload.slotIndex}`;
    this.state.towers.set(
      towerId,
      new Tower({
        ownerId: client.sessionId,
        typeId: payload.typeId,
        slotIndex: payload.slotIndex,
        level: 1,
        invested: cost,
        cooldown: 0,
      }),
    );

    this.sendEconomy(client);

    console.log(
      `Defender placed tower ${payload.typeId} at slot ${payload.slotIndex} (-${cost}g)`,
    );
  }

  /**
   * Sells one of the defender's towers for a partial refund.
   *
   * @remarks
   * Only the tower's owner may sell it, and only while the match is in the
   * building or combat phase. The refund is `sellRefund` of the tower's own
   * `invested` gold, so the client reads the same field to predict the price.
   * During the building phase selling is 100% to discourage accidental builds.
   */
  private handleSellTower(client: Client, payload: SellTowerIntent): void {
    if (this.state.phase !== "building" && this.state.phase !== "combat") return;

    const role = client.userData?.role as PlayerRole | undefined;
    if (role !== "defender") {
      console.log(`Only defender can sell towers. Client role: ${role}`);
      return;
    }

    const tower = this.state.towers.get(payload.towerId);
    if (!tower || tower.ownerId !== client.sessionId) {
      console.log(`Defender has no sellable tower ${payload.towerId}`);
      return;
    }

    const refund =
      this.state.phase === "building"
        ? Math.floor(tower.invested)
        : sellRefund(tower.invested);

    this.state.towers.delete(payload.towerId);
    const towerKey = `${client.sessionId}-${tower.slotIndex}`;
    this.towerWindupStacks.delete(towerKey);
    this.towerLastFireTime.delete(towerKey);
    this.economies.set(
      client.sessionId,
      (this.economies.get(client.sessionId) ?? 0) + refund,
    );
    this.sendEconomy(client);

    console.log(
      `Defender sold tower ${payload.towerId} (${tower.typeId} lvl ${tower.level}) (+${refund}g)`,
    );
  }

  /**
   * Upgrades one of the defender's towers to the next tier.
   *
   * @remarks
   * Only the tower's owner may upgrade it, and only while the match is in the
   * building or combat phase. Deducts the tier cost from the defender's economy,
   * advances the tower's level, and adds the cost to its invested gold so future
   * sales refund the upgraded value.
   */
  private handleUpgradeTower(client: Client, payload: UpgradeTowerIntent): void {
    if (this.state.phase !== "building" && this.state.phase !== "combat") return;

    const role = client.userData?.role as PlayerRole | undefined;
    if (role !== "defender") {
      console.log(`Only defender can upgrade towers. Client role: ${role}`);
      return;
    }

    const tower = this.state.towers.get(payload.towerId);
    if (!tower || tower.ownerId !== client.sessionId) {
      console.log(`Defender has no upgradable tower ${payload.towerId}`);
      return;
    }

    const towerType = TOWER_TYPES[tower.typeId];
    if (!towerType) {
      console.log(`Unknown tower type ${tower.typeId}`);
      return;
    }

    const cost = upgradeCost(towerType, tower.level);
    if (cost === null || tower.level >= towerType.tiers.length) {
      console.log(`Tower ${payload.towerId} is already at max level (${tower.level})`);
      return;
    }

    const gold = this.economies.get(client.sessionId) ?? 0;
    if (gold < cost) {
      console.log(
        `Not enough gold to upgrade tower ${payload.towerId} (${gold}/${cost})`,
      );
      return;
    }

    this.economies.set(client.sessionId, gold - cost);
    tower.level += 1;
    tower.invested += cost;

    this.sendEconomy(client);

    console.log(
      `Defender upgraded tower ${payload.towerId} (${tower.typeId}) to lvl ${tower.level} (-${cost}g)`,
    );
  }

  /**
   * Handles manual start of combat phase.
   *
   * @remarks
   * Allows the defender to manually start combat instead of waiting for timer.
   */
  private handleStartCombat(client: Client): void {
    if (this.state.phase !== "building") return;

    const role = client.userData?.role as PlayerRole | undefined;
    if (role !== "defender") {
      console.log(`Only defender can manually start combat. Client role: ${role}`);
      return;
    }

    if (!this.phases.beginCombat([])) {
      console.log("Failed to start combat");
      return;
    }

    console.log(`Room ${this.roomId}: building -> combat (manual start by defender ${client.sessionId})`);
  }

  /**
   * Shared gate for every buffer intent (queue / clear).
   *
   * @returns `null` when the request may proceed, otherwise a refusal reason.
   *
   * @remarks Buffering is open during `building` so the attacker can compose
   * the opening push while the defender is still laying towers, but only the
   * attacker may ever touch it. Deploying (see `handleDeploy`) is combat-only.
   * Buffer edits are frozen in sudden death, where nothing may reinforce the
   * troops already on the field.
   */
  private canBuffer(client: Client): string | null {
    if (client.userData?.role !== "attacker") {
      return "Only the attacker can use the deploy queue.";
    }
    if (this.state.phase !== "building" && this.state.phase !== "combat") {
      return "You cannot queue units right now.";
    }
    if (this.state.suddenDeath) {
      return "Sudden death: no more units can be queued.";
    }
    return null;
  }

  /**
   * Whether the attacker could legally deploy their buffer right now.
   *
   * @remarks Cheap predicate reused by the payload so the client can grey out
   * the deploy controls without recomputing the phase and charge rules.
   */
  private canDeploy(sessionId: string): boolean {
    if (this.state.phase !== "combat") return false;
    if (this.state.suddenDeath) return false;
    const buffer = this.attackerBuffers.get(sessionId);
    if (!buffer || buffer.length === 0) return false;

    const charges = this.portalCharges.get(sessionId);
    if (!charges) return false;
    for (const status of charges.values()) {
      if (status.charges > 0) return true;
    }
    return false;
  }

  /** The current map's deploy portals, resolved once per call site. */
  private currentPortals() {
    return mapPortals(MAPS[this.state.mapId] ?? SAMPLE_MAP);
  }

  /** Lazily creates (or fetches) an attacker's per-portal charge table. */
  private ensurePortalCharges(sessionId: string): Map<string, { charges: number; regenAcc: number }> {
    let table = this.portalCharges.get(sessionId);
    if (!table) {
      table = new Map();
      for (const portal of this.currentPortals()) {
        table.set(portal.id, {
          charges: portalChargeRules(portal).maxCharges,
          regenAcc: 0,
        });
      }
      this.portalCharges.set(sessionId, table);
    }
    return table;
  }

  /** Display labels for the tracks leaving a portal, for the path chooser. */
  private portalPathsFor(portal: MapPortal): AttackerPortalPath[] {
    const map = MAPS[this.state.mapId] ?? SAMPLE_MAP;
    return portal.pathIds.map((id, index) => ({
      id,
      label: map.pathLabels?.[id] ?? `Path ${index + 1}`,
    }));
  }

  /** Snapshot of one attacker's portal charges for their private payload. */
  private portalStatusFor(sessionId: string): AttackerPortalStatus[] {
    const table = this.ensurePortalCharges(sessionId);
    const portals = this.currentPortals();

    return [...table.entries()].map(([id, status]) => {
      const portal = portals.find((candidate) => candidate.id === id);
      const { maxCharges, chargeSec } = portalChargeRules(portal ?? {});
      return {
        id,
        charges: status.charges,
        maxCharges,
        chargeSec,
        rechargeIn:
          status.charges >= maxCharges
            ? 0
            : Math.max(0, chargeSec - status.regenAcc),
        paths: portal ? this.portalPathsFor(portal) : [],
      };
    });
  }

  /**
   * Refills one portal charge per its own `chargeSec`, capped at its own
   * `maxCharges`. Both come from the map's per-portal override when present.
   */
  private regenPortalCharges(dt: number): void {
    const portals = this.currentPortals();
    let changed = false;

    for (const table of this.portalCharges.values()) {
      for (const [portalId, status] of table) {
        const portal = portals.find((candidate) => candidate.id === portalId);
        const { maxCharges, chargeSec } = portalChargeRules(portal ?? {});

        if (status.charges >= maxCharges) {
          status.regenAcc = 0;
          continue;
        }
        status.regenAcc += dt;
        if (status.regenAcc < chargeSec) continue;
        status.regenAcc -= chargeSec;
        status.charges += 1;
        changed = true;
      }
    }

    // ~1 Hz is enough for a smooth pip fill without a per-tick push.
    if (changed) {
      for (const client of this.clients) {
        this.sendAttackerBuffer(client);
      }
    }
  }

  /** Resolves a portal id against the current map; `undefined` when unknown. */
  private portalFor(portalId: string) {
    return this.currentPortals().find((portal) => portal.id === portalId);
  }

  /** Validates that `pathId` exists on this room's map. */
  private pathIdIsValid(pathId: string): boolean {
    const map = MAPS[this.state.mapId] ?? SAMPLE_MAP;
    return this.pathIdsFor(map).includes(pathId);
  }

  /**
   * Queues one unit into the attacker's deploy buffer.
   *
   * @remarks Gold is charged here rather than on deploy, so a full buffer is
   * always paid for and the old "park an unaffordable army forever" stall
   * cannot exist. Clearing the buffer refunds it in full.
   */
  private handleBufferAdd(client: Client, payload: BufferAddIntent): void {
    const guard = this.canBuffer(client);
    if (guard) return void this.rejectDeploy(client, guard);

    const sessionId = client.sessionId;
    const deck = this.acceptedDecks.get(sessionId) ?? [];
    const allowedDeck =
      deck.length > 0 ? deck : DEFAULT_ATTACKER_DECK;
    const typeId = payload?.typeId;
    if (typeof typeId !== "string") {
      return void this.rejectDeploy(client, "Malformed queue request.");
    }

    const buffer = this.attackerBuffers.get(sessionId) ?? [];
    const gold = Math.floor(this.economies.get(sessionId) ?? 0);
    const error = validateBufferAdd(typeId, buffer, allowedDeck, gold);
    if (error) return void this.rejectDeploy(client, error);

    const cost = MOB_TYPES[typeId]?.cost ?? 0;
    this.economies.set(sessionId, gold - cost);
    this.attackerBuffers.set(sessionId, [...buffer, typeId]);

    this.sendEconomy(client);
    this.sendAttackerBuffer(client);
  }

  /** Empties the attacker's deploy buffer, refunding every queued unit. */
  private handleBufferClear(client: Client): void {
    const guard = this.canBuffer(client);
    if (guard) return void this.rejectDeploy(client, guard);

    const sessionId = client.sessionId;
    const buffer = this.attackerBuffers.get(sessionId) ?? [];
    if (buffer.length === 0) {
      return void this.rejectDeploy(client, "The deploy queue is already empty.");
    }

    const refund = buffer.reduce(
      (total, typeId) => total + (MOB_TYPES[typeId]?.cost ?? 0),
      0,
    );
    this.attackerBuffers.set(sessionId, []);
    this.economies.set(
      sessionId,
      (this.economies.get(sessionId) ?? 0) + refund,
    );

    this.sendEconomy(client);
    this.sendAttackerBuffer(client);
  }

  /**
   * Streams the whole deploy buffer out of one portal.
   *
   * @remarks Units leave a fraction of a second apart so a push reads as a
   * column pouring out of the portal rather than a single clump. Deploying is
   * combat-only (mobs do not advance outside combat) and frozen in sudden
   * death, so nothing can reinforce the troops already deciding the match.
   */
  private handleDeploy(client: Client, payload: DeployIntent): void {
    if (client.userData?.role !== "attacker") {
      return void this.rejectDeploy(client, "Only the attacker can deploy.");
    }
    if (this.state.phase !== "combat") {
      return void this.rejectDeploy(client, "Units can only be deployed during combat.");
    }
    if (this.state.suddenDeath) {
      return void this.rejectDeploy(client, "Sudden death: no more deploys.");
    }

    const sessionId = client.sessionId;
    const buffer = this.attackerBuffers.get(sessionId) ?? [];
    if (buffer.length === 0) {
      return void this.rejectDeploy(client, "The deploy queue is empty.");
    }

    const portal = this.portalFor(payload?.portalId);
    if (!portal) {
      return void this.rejectDeploy(client, "No such portal on this map.");
    }

    const charges = this.ensurePortalCharges(sessionId).get(portal.id);
    if (!charges || charges.charges <= 0) {
      return void this.rejectDeploy(client, "That portal has no charges left.");
    }

    let pathId = payload?.pathId;
    if (pathId !== undefined && !portal.pathIds.includes(pathId)) {
      return void this.rejectDeploy(client, "That path does not lead from this portal.");
    }
    if (pathId === undefined) pathId = portal.pathIds[0];
    if (!this.pathIdIsValid(pathId)) {
      return void this.rejectDeploy(client, `No such path: ${pathId}.`);
    }

    // Commit: spend the charge, schedule the spawns, empty the buffer. Units
    // leave apart by their own stagger so a mixed push fans out instead of
    // walking into every splash tower as one clump.
    charges.charges -= 1;
    charges.regenAcc = 0;

    let atMatchTime = this.matchTime;
    for (const typeId of buffer) {
      this.releaseQueue.push({ atMatchTime, pathId, typeId, count: 1 });
      atMatchTime += deployStaggerSec(typeId);
    }

    console.log(
      `Room ${this.roomId}: attacker deploying ${buffer.length} unit(s) through ${portal.id} on ${pathId}`,
    );

    this.attackerBuffers.set(sessionId, []);
    this.sendEconomy(client);
    this.sendAttackerBuffer(client);
  }

  /**
   * Gives a player who ran out of draft time a valid random deck, matching the
   * shape the normal confirm path produces. Only reachable when a draft clock
   * is armed (a non-positive duration never fires).
   */
  private autoFillDecks(sessionIds: string[]): void {
    for (const sessionId of sessionIds) {
      const role = this.clients.find((c) => c.sessionId === sessionId)
        ?.userData?.role as PlayerRole | undefined;
      const catalog =
        role === "attacker"
          ? MOB_TYPES
          : role === "defender"
            ? TOWER_TYPES
            : null;

      if (!catalog) continue;

      const ids = Object.keys(catalog);
      const maxDeckSize = Math.min(DEFAULT_DECK_RULES.deckSize, ids.length);
      const deck = [...ids].sort(() => Math.random() - 0.5).slice(0, maxDeckSize);

      this.acceptedDecks.set(sessionId, deck);
      console.log(
        `Room ${this.roomId}: auto-filled ${role} draft for ${sessionId}: ${deck.join(", ")}`,
      );
    }
  }

  /**
   * Handles an intentional concession. Once both players are present, any
   * surrender ends the match immediately: the other player wins and both
   * clients get a `game_over` push. Clients stay connected and leave via the
   * game-over screen, so `onLeave` must not reopen the room at this phase.
   */
  private handleSurrender(client: Client): void {
    if (this.state.players.size < 2) return;

    const opponent = this.clients.find(
      (c) => c.sessionId !== client.sessionId,
    );
    const winner = opponent?.userData?.role as PlayerRole | undefined;
    const loser = client.userData?.role as PlayerRole | undefined;

    if (!winner) return;

    if (!this.phases.declareGameOver(winner, "surrender")) return;

    console.log(
      `Room ${this.roomId}: ${client.sessionId} (${loser}) surrendered; ${winner} wins`,
    );

    this.finishMatch(winner, "surrender").catch((e) =>
      console.error(`Room ${this.roomId}: error finishing match:`, e),
    );
  }

  /**
   * Calculates Elo shifts, persists updated ratings to MongoDB (for users and guests),
   * updates Player state, and dispatches private game over payloads with rating summaries.
   */
  private async finishMatch(
    winner: PlayerRole,
    reason: GameOverReason,
  ): Promise<void> {
    const ratingUpdates = await this.resolveMatchRatings(winner);
    for (const client of this.clients) {
      const payload: GameOverPayload = {
        winner,
        reason,
        ratingUpdate: ratingUpdates.get(client.sessionId),
      };
      client.send(MESSAGES.gameOver, payload);
    }
  }

  private async resolveMatchRatings(
    winner: PlayerRole,
  ): Promise<Map<string, RatingUpdateInfo>> {
    const updates = new Map<string, RatingUpdateInfo>();
    if (this.matchRatingResolved) return updates;
    this.matchRatingResolved = true;

    const attackerClient = this.clients.find(
      (c) => c.userData?.role === "attacker",
    );
    const defenderClient = this.clients.find(
      (c) => c.userData?.role === "defender",
    );

    if (!attackerClient || !defenderClient) {
      return updates;
    }

    const attackerElo = attackerClient.userData?.elo ?? RANKING_CONFIG.defaultElo;
    const defenderElo = defenderClient.userData?.elo ?? RANKING_CONFIG.defaultElo;

    const attackerScore: 1 | 0 = winner === "attacker" ? 1 : 0;
    const defenderScore: 1 | 0 = winner === "defender" ? 1 : 0;

    const attackerCalc = calculateEloChange(
      attackerElo,
      defenderElo,
      attackerScore,
      RANKING_CONFIG.kFactor,
    );
    const defenderCalc = calculateEloChange(
      defenderElo,
      attackerElo,
      defenderScore,
      RANKING_CONFIG.kFactor,
    );

    attackerClient.userData.elo = attackerCalc.newElo;
    defenderClient.userData.elo = defenderCalc.newElo;

    const attackerPlayer = this.state.players.get(attackerClient.sessionId);
    if (attackerPlayer) {
      attackerPlayer.elo = attackerCalc.newElo;
      attackerPlayer.rankId = getRankForElo(attackerCalc.newElo).id;
    }

    const defenderPlayer = this.state.players.get(defenderClient.sessionId);
    if (defenderPlayer) {
      defenderPlayer.elo = defenderCalc.newElo;
      defenderPlayer.rankId = getRankForElo(defenderCalc.newElo).id;
    }

    const attackerRank = getRankForElo(attackerCalc.newElo);
    const attackerNextRank = getNextRank(attackerCalc.newElo);
    const attackerProgress = getRankProgress(attackerCalc.newElo);

    const defenderRank = getRankForElo(defenderCalc.newElo);
    const defenderNextRank = getNextRank(defenderCalc.newElo);
    const defenderProgress = getRankProgress(defenderCalc.newElo);

    updates.set(attackerClient.sessionId, {
      oldElo: attackerCalc.oldElo,
      newElo: attackerCalc.newElo,
      delta: attackerCalc.delta,
      rank: {
        id: attackerRank.id,
        tier: attackerRank.tier,
        name: attackerRank.name,
        badgeAsset: attackerRank.badgeAsset,
        promotionVideo: attackerRank.promotionVideo,
        color: attackerRank.color,
      },
      nextRank: attackerNextRank
        ? {
            id: attackerNextRank.id,
            tier: attackerNextRank.tier,
            name: attackerNextRank.name,
            minElo: attackerNextRank.minElo,
          }
        : null,
      progressPercent: attackerProgress.progressPercent,
    });

    updates.set(defenderClient.sessionId, {
      oldElo: defenderCalc.oldElo,
      newElo: defenderCalc.newElo,
      delta: defenderCalc.delta,
      rank: {
        id: defenderRank.id,
        tier: defenderRank.tier,
        name: defenderRank.name,
        badgeAsset: defenderRank.badgeAsset,
        promotionVideo: defenderRank.promotionVideo,
        color: defenderRank.color,
      },
      nextRank: defenderNextRank
        ? {
            id: defenderNextRank.id,
            tier: defenderNextRank.tier,
            name: defenderNextRank.name,
            minElo: defenderNextRank.minElo,
          }
        : null,
      progressPercent: defenderProgress.progressPercent,
    });

    if (mongoose.connection?.readyState === 1) {
      try {
        // Persist attacker rating
        if (attackerClient.userData?.accountType === "user") {
          await UserModel.findByIdAndUpdate(attackerClient.userData.accountId, {
            $set: { elo: attackerCalc.newElo },
            $inc: {
              matchesPlayed: 1,
              wins: attackerScore === 1 ? 1 : 0,
              losses: attackerScore === 0 ? 1 : 0,
            },
          });
        } else if (attackerClient.userData?.accountType === "guest") {
          await GuestUserModel.findOneAndUpdate(
            { guestId: attackerClient.userData.accountId },
            {
              $set: { elo: attackerCalc.newElo, lastActiveAt: new Date() },
              $inc: {
                matchesPlayed: 1,
                wins: attackerScore === 1 ? 1 : 0,
                losses: attackerScore === 0 ? 1 : 0,
              },
            },
            { upsert: true },
          );
        }

        // Persist defender rating
        if (defenderClient.userData?.accountType === "user") {
          await UserModel.findByIdAndUpdate(defenderClient.userData.accountId, {
            $set: { elo: defenderCalc.newElo },
            $inc: {
              matchesPlayed: 1,
              wins: defenderScore === 1 ? 1 : 0,
              losses: defenderScore === 0 ? 1 : 0,
            },
          });
        } else if (defenderClient.userData?.accountType === "guest") {
          await GuestUserModel.findOneAndUpdate(
            { guestId: defenderClient.userData.accountId },
            {
              $set: { elo: defenderCalc.newElo, lastActiveAt: new Date() },
              $inc: {
                matchesPlayed: 1,
                wins: defenderScore === 1 ? 1 : 0,
                losses: defenderScore === 0 ? 1 : 0,
              },
            },
            { upsert: true },
          );
        }
      } catch (err) {
        console.error(`Room ${this.roomId}: Failed to persist ratings to database:`, err);
      }
    }

    return updates;
  }

  /**
   * Handles player vote for a rematch. If both players agree, resets the game
   * and restarts a fresh match at the drafting phase.
   */
  private handleRematch(client: Client): void {
    if (this.state.phase !== "gameover") return;

    this.rematchVotes.add(client.sessionId);
    console.log(
      `Room ${this.roomId}: Client ${client.sessionId} voted for rematch (${this.rematchVotes.size}/2)`,
    );

    this.broadcast(MESSAGES.rematchUpdate, {
      votes: this.rematchVotes.size,
      total: 2,
      requesterSessionId: client.sessionId,
    });

    if (this.rematchVotes.size >= 2 && this.clients.length === 2) {
      console.log(
        `Room ${this.roomId}: Both players agreed to rematch! Restarting match...`,
      );
      this.restartMatchForRematch();
    }
  }

  /**
   * Fully resets entities, economy, core HP, and drafts, transitioning
   * both players cleanly into a new drafting round 1.
   */
  private restartMatchForRematch(): void {
    this.rematchVotes.clear();
    this.matchRatingResolved = false;
    this.clearMobs();
    this.clearProjectiles();
    this.resetCombatRuntime();
    this.state.towers.clear();
    this.towerWindupStacks.clear();
    this.towerLastFireTime.clear();
    this.attackerBuffers.clear();
    this.acceptedDecks.clear();
    this.state.coreHp = MATCH_RULES.coreHp;
    this.initDraftMobPool();

    for (const player of this.state.players.values()) {
      player.draftReady = false;
    }

    this.phases.reset();

    this.draftRound = 1;
    this.draftRoundTimer = 15.0;
    this.state.phaseEndsAt = 15;
    this.draftFinalCountdown = null;
    this.draftRoundPicks.clear();

    for (const c of this.clients) {
      const role = (this.state.players.get(c.sessionId)?.role || c.userData?.role) as PlayerRole | undefined;
      this.economies.set(c.sessionId, this.startingGold(role ?? "defender"));
      this.incomeRates.set(
        c.sessionId,
        (role ?? "defender") === "attacker"
          ? DEFAULT_ECONOMY.attackerBaseIncome
          : DEFAULT_ECONOMY.defenderBaseIncome,
      );
    }

    this.initDraftMobPool();
    this.phases.beginDraft();
    this.state.phase = "drafting";

    for (const c of this.clients) {
      this.sendPlayerState(c);
    }
  }

  /**
   * Promotes the room's lobby listing to `"playing"` once a match is under way.
   *
   * @remarks
   * Idempotent and one-way: the status is never reset to `"available"`, so a
   * room that has started a match keeps showing as in-progress even after a
   * player leaves. `setMetadata` replaces the whole metadata object, so the
   * existing fields are spread through.
   */
  private markPlaying(): void {
    const metadata = this.metadata as GameRoomMetadata | undefined;
    if (!metadata || metadata.status === "playing") return;
    this.setMetadata({ ...metadata, status: "playing" });
  }

  /**
   * Initializes the draft pool for this match from ALL_MOB_IDS (all catalog mobs available).
   */
  private initDraftMobPool(): void {
    const all = [...ALL_MOB_IDS];
    this.draftMobPool = all;
    this.state.draftMobPool.clear();
    for (const id of this.draftMobPool) {
      this.state.draftMobPool.push(id);
    }
  }

  onCreate(options: any): void {
    // Resolve the host's battlefield pick: a real map id is honoured as-is, the
    // "random" sentinel (or a missing/unknown id) defers to a draw at reveal
    // time. Metadata keeps the sentinel until the draw promotes it.
    const requestedMapId =
      typeof options.mapId === "string" && options.mapId.length > 0
        ? options.mapId
        : RANDOM_MAP_ID;
    const pickedMap = requestedMapId !== RANDOM_MAP_ID && MAPS[requestedMapId];
    this.mapChosen = !!pickedMap;
    this.state.mapId = pickedMap ? requestedMapId : "konbaung";

    this.setMetadata({
      creatorName: options.playerName || "Anonymous",
      roleChoice: options.roleChoice || "random",
      mapId: pickedMap ? requestedMapId : RANDOM_MAP_ID,
      status: "available",
    });

    this.state.phase = "drafting";
    this.state.coreHp = MATCH_RULES.coreHp;
    this.initDraftMobPool();

    // Room-level override of the reveal window keeps tests deterministic while
    // production uses the balance default from MATCH_RULES.
    const mapRevealDurationSec =
      typeof options.mapRevealDurationSec === "number"
        ? options.mapRevealDurationSec
        : MATCH_RULES.mapRevealDurationSec;

    this.phases = new Phases(
      { state: this.state },
      { ...MATCH_RULES, mapRevealDurationSec },
    );
    this.lastPhase = this.state.phase;

    // Same idea for the reconnection seat window: production uses the default,
    // tests shorten it to exercise the timeout path quickly.
    if (typeof options.reconnectWindowSec === "number") {
      this.reconnectWindowSec = options.reconnectWindowSec;
    }

    this.setTimestep((deltaTime) => this.update(deltaTime / 1000));
  }

  async onJoin(client: Client, options: any): Promise<void> {
    let accountType: "user" | "guest" | "anonymous" = "anonymous";
    let accountId = "";
    let playerElo = typeof options?.playerElo === "number" ? options.playerElo : RANKING_CONFIG.defaultElo;
    let playerName = (typeof options?.playerName === "string" && options.playerName.trim())
      ? options.playerName.trim()
      : "Anonymous";

    if (mongoose.connection?.readyState === 1) {
      try {
        if (options?.token && typeof options.token === "string") {
          const decoded = verifyAuthToken(options.token);
          const user = await UserModel.findById(decoded.id);
          if (user) {
            accountType = "user";
            accountId = user._id.toString();
            playerElo = user.elo ?? RANKING_CONFIG.defaultElo;
            playerName = user.name || playerName;
          }
        } else if (options?.guestId && typeof options.guestId === "string") {
          const guestId = options.guestId.trim();
          if (guestId) {
            accountType = "guest";
            accountId = guestId;
            let guest = await GuestUserModel.findOne({ guestId });
            if (!guest) {
              guest = await GuestUserModel.create({
                guestId,
                name: playerName !== "Anonymous" ? playerName : "Guest",
                elo: playerElo,
              });
            } else {
              playerElo = guest.elo ?? RANKING_CONFIG.defaultElo;
            }
          }
        }
      } catch (err) {
        console.warn(`Room ${this.roomId}: Could not load account for player in onJoin:`, err);
      }
    }

    client.userData = {
      playerName,
      role: null,
      accountType,
      accountId,
      elo: playerElo,
    };

    if (!this.creatorSessionId) {
      this.creatorSessionId = client.sessionId;
    }

    this.state.players.set(
      client.sessionId,
      new Player({
        name: client.userData.playerName,
        role: "",
        elo: client.userData.elo,
        rankId: getRankForElo(client.userData.elo).id,
      }),
    );

    console.log(
      `Player ${client.sessionId} (${client.userData.playerName}, Elo: ${client.userData.elo}) joined room ${this.roomId}`,
    );

    if (this.clients.length === 2) {
      this.rematchVotes.clear();
      this.draftRound = 1;
      this.draftRoundTimer = 15.0;
      this.state.phaseEndsAt = 15.0;
      this.draftFinalCountdown = null;
      this.draftRoundPicks.clear();
      this.assignRoles();
      await this.lock();
      this.phases.beginDraft();
      this.markPlaying();

      this.broadcast(MESSAGES.draftRoundUpdate, {
        round: 1,
        phaseEndsAt: 15,
        attackerPicks: [],
        defenderPicks: [],
        attackerReady: false,
        defenderReady: false,
        availableMobPool: [...this.draftMobPool],
      });

      // Seed each client with its private economy so the HUD is correct even
      // before the draft is confirmed (deck arrives in a later push).
      for (const c of this.clients) {
        this.sendPlayerState(c);
      }
    }
  }

  /**
   * Holds a dropped client's seat so they can rejoin the same match.
   *
   * @remarks Called on an unexpected socket close (backgrounded tab, network
   * blip, proxy stall). The client SDK reconnects automatically within
   * {@link RECONNECT_WINDOW_SEC}; the opponent is told to hold on and the match
   * keeps running in the meantime. Only if the dropped client never returns
   * does `onLeave` run, awarding the match to the player who stayed.
   */
  onDrop(client: Client, code: CloseCode): void {
    console.log(
      `Client ${client.sessionId} dropped (code ${code}); holding seat for ${this.reconnectWindowSec}s`,
    );
    this.pendingReconnect.add(client.sessionId);

    const opponent = this.clients.find(
      (c) => c.sessionId !== client.sessionId,
    );
    opponent?.send(MESSAGES.opponentReconnecting, {
      opponentName: client.userData?.playerName ?? "Your opponent",
      secondsRemaining: this.reconnectWindowSec,
    });

    this.allowReconnection(client, this.reconnectWindowSec).catch(() => {});
  }

  onReconnect(client: Client): void {
    console.log(`Client ${client.sessionId} reconnected!`);
    this.pendingReconnect.delete(client.sessionId);
    this.sendPlayerState(client);
    // Re-seed the attacker's private deploy panel (no-op for the defender).
    this.sendAttackerBuffer(client);

    const opponent = this.clients.find(
      (c) => c.sessionId !== client.sessionId,
    );
    opponent?.send(MESSAGES.opponentReconnected, {
      opponentName: client.userData?.playerName ?? "Your opponent",
    });
  }

  /**
   * Ends the match in favour of the player whose opponent's reconnection
   * window lapsed.
   *
   * @remarks A no-op once the match is already over or when nobody is left to
   * award (the room disposes when empty). The winner stays connected and
   * leaves from the game-over screen, which is why the room is not reopened
   * here.
   */
  private awardDisconnectWin(leaver: Client): void {
    if (this.state.phase === "gameover") return;

    const remaining = this.clients[0];
    const winner = remaining?.userData?.role as PlayerRole | undefined;
    if (!remaining || !winner) return;

    if (!this.phases.declareGameOver(winner, "disconnect")) return;

    console.log(
      `Room ${this.roomId}: ${leaver.sessionId} did not reconnect; ${winner} wins by disconnect`,
    );

    this.finishMatch(winner, "disconnect").catch((e) =>
      console.error(`Room ${this.roomId}: error finishing match:`, e),
    );
  }

  /**
   * Removes a departed player. A deliberate leave reopens the room for a
   * replacement opponent; a drop whose reconnection window lapsed instead
   * awards the match to the player who stayed.
   */
  onLeave(client: Client, code: CloseCode): void {
    console.log(`Client ${client.sessionId} left! Code: ${code}`);

    const wasDropped = this.pendingReconnect.delete(client.sessionId);

    this.state.players.delete(client.sessionId);
    this.acceptedDecks.delete(client.sessionId);
    this.economies.delete(client.sessionId);
    this.incomeRates.delete(client.sessionId);
    this.attackerBuffers.delete(client.sessionId);
    this.portalCharges.delete(client.sessionId);
    this.rematchVotes.delete(client.sessionId);
    this.loadedAssetsClients.delete(client.sessionId);
    if (this.waitingForAssets) {
      this.checkAssetsAndProceed();
    }

    const wasCreator = client.sessionId === this.creatorSessionId;

    if (wasDropped) {
      this.awardDisconnectWin(client);
      return;
    }

    if (
      this.clients.length === 1 &&
      this.state.phase !== "gameover"
    ) {
      const host = this.clients[0];

      this.unlock();
      this.readyClients.clear();
      this.matchStarted = false;
      this.acceptedDecks.clear();
      this.state.phase = "drafting";
      this.draftRound = 1;
      this.draftRoundTimer = 15.0;
      this.state.phaseEndsAt = 15.0;
      this.draftFinalCountdown = null;
      this.draftRoundPicks.clear();
      this.clearMobs();
      this.clearProjectiles();
      this.resetCombatRuntime();
      this.state.coreHp = MATCH_RULES.coreHp;
    this.initDraftMobPool();

      for (const player of this.state.players.values()) {
        player.draftReady = false;
      }

      this.phases.reset();

      const hostRole = host.userData?.role as PlayerRole | undefined;
      this.economies.set(host.sessionId, this.startingGold(hostRole ?? "defender"));
      this.incomeRates.set(
        host.sessionId,
        (hostRole ?? "defender") === "attacker"
          ? DEFAULT_ECONOMY.attackerBaseIncome
          : DEFAULT_ECONOMY.defenderBaseIncome,
      );
      this.sendPlayerState(host);

      if (wasCreator) {
        this.creatorSessionId = host.sessionId;
        this.setMetadata({
          ...this.metadata,
          creatorName: host.userData.playerName,
        });
      }

      host.send(MESSAGES.opponentLeft, {
        opponentName: client.userData.playerName,
        youAreHost: wasCreator,
      });
    }
  }

  onDispose(): void {
    console.log(`Room ${this.roomId} disposing...`);
  }

  /**
   * Server tick: drives the phase/timer machine and the mob simulation.
   *
   * @remarks
   * Combat is detected by an edge (previous tick was not `combat`), so it fires
   * for both the manual START button and the optional build timer without either
   * path needing to remember to spawn.
   */
  update(dt: number): void {
    const event = this.phases.update(dt);

    if (event?.type === "building-started" && event.autoCompleted.length > 0) {
      this.autoFillDecks(event.autoCompleted);
    }

    if (event?.type === "siege-expired") {
      this.onSiegeExpired();
    }

    // Handle asset loading gate and 5-second post-draft countdown before advancing to building
    if (this.state.phase === "drafting" && this.waitingForAssets) {
      this.assetWaitTimeout -= dt;
      if (this.assetWaitTimeout <= 0) {
        console.warn(
          `Room ${this.roomId}: Asset loading timeout reached. Proceeding to post-draft countdown`,
        );
        this.startPostDraftCountdown();
      }
    } else if (this.state.phase === "drafting" && this.draftFinalCountdown !== null) {
      this.draftFinalCountdown -= dt;
      this.state.phaseEndsAt = Math.max(0, this.draftFinalCountdown);

      if (this.draftFinalCountdown <= 0) {
        this.draftFinalCountdown = null;
        console.log(`Room ${this.roomId}: Post-draft countdown elapsed, advancing to building`);
        for (const client of this.clients) {
          const player = this.state.players.get(client.sessionId);
          if (player) player.draftReady = true;
        }
        this.phases.beginBuilding([]);
        for (const c of this.clients) {
          this.sendPlayerState(c);
        }
      }
    } else if (this.state.phase === "drafting" && this.clients.length === 2) {
      // Tick 2-2-2 draft round countdown and auto-advance on timeout
      this.draftRoundTimer -= dt;
      this.state.phaseEndsAt = Math.max(0, this.draftRoundTimer);

      if (this.draftRoundTimer <= 0) {
        // Auto-fill random picks for any player who hasn't submitted
        for (const client of this.clients) {
          if (!this.draftRoundPicks.has(client.sessionId)) {
            const role = (this.state.players.get(client.sessionId)?.role || client.userData?.role) as PlayerRole | undefined;
            const catalog = role === "attacker" ? MOB_TYPES : TOWER_TYPES;
            const currentDeck = this.acceptedDecks.get(client.sessionId) ?? [];
            const available = Object.keys(catalog).filter((id) => !currentDeck.includes(id));
            const randomPicks: string[] = [];
            while (randomPicks.length < 2 && available.length > 0) {
              const idx = Math.floor(Math.random() * available.length);
              randomPicks.push(available.splice(idx, 1)[0]);
            }
            this.draftRoundPicks.set(client.sessionId, randomPicks);
          }
        }
        this.advanceDraftRound();
      }
    }

    const phase = this.state.phase;

    if (phase === "combat" && this.lastPhase !== "combat") {
      this.beginCombatSim();
    }

    if (phase === "combat") {
      this.matchTime += dt;
      this.accrueIncome(dt);
      this.regenPortalCharges(dt);
      this.drainReleaseQueue();
      this.simulateMobs(dt);

      // A breach may have ended the match; skip combat so no shots fire after.
      if (this.state.phase === "combat") this.simulateCombat(dt);

      if (this.state.phase === "combat") {
        this.pushIncomeIfDue(dt);

        // Sudden death resolves the moment the last troop on the field dies.
        if (this.state.suddenDeath) this.checkSuddenDeath();
      }
    } else if (this.lastPhase === "combat") {
      this.clearMobs();
      this.clearProjectiles();
      this.towerWindupStacks.clear();
      this.towerLastFireTime.clear();
      this.releaseQueue = [];
    }

    this.lastPhase = phase;
  }

  /**
   * Resets per-match combat state the moment combat begins.
   *
   * @remarks Portal charges refill to full so a previous round's (or a
   * reconnected) attacker never starts a push short of charges.
   */
  private beginCombatSim(): void {
    this.incomeExpired = false;
    this.incomePushAccumulator = 0;
    this.towerWindupStacks.clear();
    this.towerLastFireTime.clear();
    this.state.suddenDeath = false;
    this.portalCharges.clear();

    for (const client of this.clients) {
      this.sendPlayerState(client);
    }
  }

  /**
   * Stops the attacker's passive income.
   *
   * @remarks Called when sudden death begins: nothing may reinforce once the
   * troops already on the field decide the match, so the gold that buys more
   * troops stops flowing. The siege timer keeps running, so gold already banked
   * stays spendable.
   */
  private closeIncomeWindow(): void {
    if (this.incomeExpired) return;
    this.incomeExpired = true;

    for (const client of this.clients) {
      this.sendEconomy(client);
      this.sendAttackerBuffer(client);
    }

    console.log(`Room ${this.roomId}: income window closed`);
  }

  /**
   * Reacts to the siege timer hitting zero.
   *
   * @remarks The defender held out, so the attacker only survives this if they
   * still have troops on the field. With none left the defender wins outright;
   * otherwise the match enters sudden death and resolves on the field state
   * alone (see {@link checkSuddenDeath}).
   */
  private onSiegeExpired(): void {
    if (this.state.phase !== "combat") return;
    if (this.state.suddenDeath) return;

    const hasTroops = this.state.mobs.size > 0 || this.releaseQueue.length > 0;
    if (!hasTroops) {
      this.declareWinner("defender", "time", "siege timer expired with no attacker units");
      return;
    }

    this.state.suddenDeath = true;

    // Nothing may reinforce once sudden death decides the match, so drain any
    // still-staggered deploys onto the field right now rather than dropping the
    // gold the attacker already paid for them.
    while (this.releaseQueue.length > 0) {
      this.spawnScheduledBatch(this.releaseQueue.shift()!);
    }

    // No more gold for reinforcements once the field decides the match.
    this.closeIncomeWindow();

    for (const client of this.clients) {
      this.sendEconomy(client);
      this.sendAttackerBuffer(client);
    }
  }

  /**
   * Ends sudden death once the last troop on the field dies.
   *
   * @remarks Guaranteed to resolve: mobs never stall (their `progress` always
   * advances) and they always leave the field by leaking or dying, so an empty
   * field is reachable from any sudden-death state.
   */
  private checkSuddenDeath(): void {
    if (this.state.phase !== "combat") return;
    if (this.state.mobs.size > 0 || this.releaseQueue.length > 0) return;

    this.declareWinner("defender", "suddenDeath", "all attacker units were repelled");
  }

  /**
   * Ends the match with `winner` and mirrors the reason into both the private
   * `game_over` push and `RoomState.gameOverReason`.
   */
  private declareWinner(
    winner: PlayerRole,
    reason: GameOverPayload["reason"],
    detail: string,
  ): void {
    if (!this.phases.declareGameOver(winner, reason)) return;

    console.log(`Room ${this.roomId}: ${winner} wins (${detail})`);

    this.finishMatch(winner, reason).catch((e) =>
      console.error(`Room ${this.roomId}: error finishing match:`, e),
    );
  }

  /**
   * Extra passive income the attacker earns from units deep in the push.
   *
   * @returns Gold per second from every attacker unit past the configured
   * progress threshold, scaled by that unit's cost.
   *
   * @remarks This is a bonus to passive income, not a separate payout: it only
   * runs while the attacker's income is live (that is, until sudden death), and
   * it vanishes the moment those units are killed or leak. Halfway down the
   * track is where a push starts threatening the core, so that is where the
   * attacker starts earning.
   */
  private deepIncomeRate(): number {
    const threshold = DEFAULT_ECONOMY.attackerUnitIncomeThreshold ?? 0.5;
    const unitRate = DEFAULT_ECONOMY.attackerUnitIncomeRate ?? 0;
    if (unitRate <= 0) return 0;

    let rate = 0;
    for (const mob of this.state.mobs.values()) {
      if (mob.progress > threshold) {
        rate += (MOB_TYPES[mob.typeId]?.cost ?? 0) * unitRate;
      }
    }
    return rate;
  }

  /**
   * The income rate a player is actually earning right now.
   *
   * @param sessionId - Player whose economy is being read.
   * @param role - That player's match role.
   * @returns Gold per second, including the attacker's deep-unit bonus.
   *
   * @remarks The client shows this so the deep bonus is visible as a rise in
   * passive income instead of silently credited gold. In sudden death the
   * attacker's reported rate is zero, matching the ledger, and the closing
   * stretch of the siege pays both sides at a multiplier.
   */
  private effectiveIncomeRate(
    sessionId: string,
    role: PlayerRole | undefined,
  ): number {
    if (role === "attacker") {
      if (this.incomeExpired) return 0;
      const base =
        this.incomeRates.get(sessionId) ?? DEFAULT_ECONOMY.attackerBaseIncome;
      return (base + this.deepIncomeRate()) * this.siegeEndIncomeMultiplier();
    }
    const base = this.incomeRates.get(sessionId) ?? DEFAULT_ECONOMY.defenderBaseIncome;
    return base * this.siegeEndIncomeMultiplier();
  }

  /**
   * Multiplier applied to passive income in the closing stretch of the siege.
   *
   * @returns `siegeEndIncomeMultiplier` while the siege clock is inside the
   * closing window, `1` for the rest of the match.
   *
   * @remarks Measured against the siege clock (`phaseEndsAt` counts the siege
   * down during combat), so the last minute of a 180s siege pays double. Sudden
   * death sits outside that window: by then the match is decided by the field.
   */
  private siegeEndIncomeMultiplier(): number {
    if (this.state.suddenDeath) return 1;
    if (this.state.phase !== "combat") return 1;

    const remaining = this.state.phaseEndsAt;
    if (remaining <= 0) return 1;
    if (remaining > DEFAULT_ECONOMY.siegeEndIncomeWindowSec) return 1;
    return DEFAULT_ECONOMY.siegeEndIncomeMultiplier;
  }

  /**
   * Credits both players their passive income during combat.
   *
   * @remarks The defender is funded by tower bounties. The gold is accumulated
   * as a float and floored on push so the HUD shows whole numbers. The
   * attacker's rate includes any deep-unit bonus for the current tick, and both
   * sides pay at the closing multiplier near the end of the siege.
   */
  private accrueIncome(dt: number): void {
    for (const client of this.clients) {
      const sessionId = client.sessionId;
      const role = client.userData?.role as PlayerRole | undefined;

      if (role === "attacker") {
        if (this.incomeExpired) continue;
        const rate = this.effectiveIncomeRate(sessionId, role);
        this.economies.set(
          sessionId,
          (this.economies.get(sessionId) ?? 0) + rate * dt,
        );
      } else if (role === "defender") {
        const rate = this.effectiveIncomeRate(sessionId, role);
        this.economies.set(
          sessionId,
          (this.economies.get(sessionId) ?? 0) + rate * dt,
        );
      }
    }
  }

  /** Throttles income pushes to roughly once per second during combat. */
  private pushIncomeIfDue(dt: number): void {
    this.incomePushAccumulator += dt;
    if (this.incomePushAccumulator < 1) return;
    this.incomePushAccumulator = 0;

    for (const client of this.clients) {
      this.sendEconomy(client);
    }
  }

  /** Spawns every batch whose scheduled match time has arrived. */
  private drainReleaseQueue(): void {
    while (
      this.releaseQueue.length > 0 &&
      this.releaseQueue[0].atMatchTime <= this.matchTime
    ) {
      const scheduled = this.releaseQueue.shift()!;
      this.spawnScheduledBatch(scheduled);
    }
  }

  /** Spawns one scheduled batch of `count` mobs at the start of its path. */
  private spawnScheduledBatch(scheduled: ScheduledBatch): void {
    const map = MAPS[this.state.mapId] ?? SAMPLE_MAP;
    const path = this.pathFor(map, scheduled.pathId);
    const type = MOB_TYPES[scheduled.typeId];
    if (!path || path.length < 2 || !type) return;

    const batchId = ++this.spawnSeq;
    const spawned = this.spawnMobsOnPath(
      path,
      scheduled.pathId,
      type,
      scheduled.count,
      batchId,
    );

    if (spawned > 0) {
      console.log(
        `Room ${this.roomId}: spawned batch ${batchId} (${scheduled.count}x ${type.id} on ${scheduled.pathId})`,
      );
    }
  }

  /** Clears all transient combat state for a fresh match. */
  private resetCombatRuntime(): void {
    this.attackerBuffers.clear();
    this.portalCharges.clear();
    this.releaseQueue = [];
    this.matchTime = 0;
    this.incomeExpired = false;
    this.incomePushAccumulator = 0;
    this.spawnSeq = 0;
    this.state.suddenDeath = false;
    this.projectileAim.clear();
    this.projectileSplash.clear();
    this.projectileSourceSlot.clear();
    this.mobAbilityCooldowns.clear();
    this.mobCastPause.clear();
    this.mobAliveSec.clear();
    this.mobInitialSpeed.clear();
  }

  /** Named path ids on a map that are long enough to actually walk. */
  private pathIdsFor(map: MapDefinition): string[] {
    return mapPathIds(map);
  }

  /**
   * Creates `count` mobs of one type at the start of a path.
   *
   * @returns The number of mobs spawned.
   */
  private spawnMobsOnPath(
    path: Vec2[],
    pathId: string,
    type: MobType,
    count: number,
    batchId: number,
  ): number {
    const map = MAPS[this.state.mapId] ?? SAMPLE_MAP;
    const forkPaths = map.randomFork ? this.pathIdsFor(map) : null;

    for (let i = 0; i < count; i++) {
      const assignedPathId =
        forkPaths && forkPaths.length > 0
          ? forkPaths[Math.floor(Math.random() * forkPaths.length)]
          : pathId;
      const seed = (Math.random() * 0xffffffff) >>> 0;
      const jitter = 1 + (Math.random() * 2 - 1) * MOB_SPEED_JITTER;
      const id = `mob-${batchId}-${assignedPathId}-${i}`;

      const speed = type.speed * jitter;
      this.mobInitialSpeed.set(id, speed);

      this.state.mobs.set(
        id,
        new Mob({
          ownerId: "",
          typeId: type.id,
          batchId,
          progress: 0,
          hp: type.maxHp,
          maxHp: type.maxHp,
          speed,
          bounty: type.bounty,
          checkpoint: 0,
          state: "moving",
          seed,
          pathId: assignedPathId,
        }),
      );
    }

    return count;
  }

  /**
   * Advances every mob along its path; breaches damage the defender's core.
   *
   * @remarks The attacker's deep-unit income is handled by
   * {@link accrueIncome} as a bonus to passive income, so this only moves mobs
   * and resolves leaks.
   */
  private simulateMobs(dt: number): void {
    if (this.state.mobs.size === 0) return;

    const map = MAPS[this.state.mapId] ?? SAMPLE_MAP;
    const halfWidth = map.pathHalfWidth ?? 0;
    const finished: string[] = [];

    let positions: Map<string, Vec2> | undefined;
    const ensurePositions = (): Map<string, Vec2> => {
      if (!positions) {
        positions = new Map<string, Vec2>();
        for (const [mId, m] of this.state.mobs) {
          const p = this.pathFor(map, m.pathId);
          if (p && p.length >= 2) {
            positions.set(
              mId,
              samplePathWithLateral(p, m.progress, m.seed, halfWidth),
            );
          }
        }
      }
      return positions;
    };

    for (const [id, mob] of this.state.mobs) {
      const path = this.pathFor(map, mob.pathId);
      const total = path ? pathLength(path) : 0;

      if (!path || total <= 0) {
        finished.push(id);
        continue;
      }

      this.tickMobEffects(mob, dt);
      if (mob.hp <= 0) {
        const bleed = mob.effects.get(EFFECT_TYPES.bleed);
        const killerOwnerId = bleed?.sourceId || "";
        this.killMob(id, mob, killerOwnerId);
        continue;
      }
      const aliveSec = (this.mobAliveSec.get(id) ?? 0) + dt;
      this.mobAliveSec.set(id, aliveSec);

      const mobType = MOB_TYPES[mob.typeId];
      if (mobType?.speedRamp) {
        const initialSpeed = this.mobInitialSpeed.get(id) ?? mob.speed;
        const ratio =
          mobType.speedRamp.rampDurationSec > 0
            ? Math.min(1, aliveSec / mobType.speedRamp.rampDurationSec)
            : 1;
        mob.speed = initialSpeed * (1 + mobType.speedRamp.maxBonusFraction * ratio);
      }

      // Pause movement while playing an ability cast animation.
      const castPause = this.mobCastPause.get(id);
      if (castPause !== undefined) {
        const remainingPause = castPause - dt;
        if (remainingPause > 0) {
          this.mobCastPause.set(id, remainingPause);
          mob.state = "casting";
          continue;
        }
        this.mobCastPause.delete(id);
        mob.state = "moving";
      }

      const hasPaceSlow =
        mobType?.ability?.paceSlowFactor !== undefined;
      const speed = this.mobSpeed(
        mob,
        id,
        hasPaceSlow ? ensurePositions() : undefined,
      );
      mob.progress += (speed / total) * dt;

      if (mob.progress >= 1) {
        this.leakToCore(mobType?.leakDamage ?? 0);

        // Leak pity refund: defender receives a portion of bounty so leaks don't cause starvation
        if (mobType && mobType.bounty > 0) {
          const pityBounty = Math.floor(
            mobType.bounty * (DEFAULT_ECONOMY.leakPityRate ?? 0.3),
          );
          if (pityBounty > 0) {
            const defender = this.clients.find(
              (c) => c.userData?.role === "defender",
            );
            if (defender) {
              this.awardBounty(defender.sessionId, pityBounty);
            }
          }
        }

        finished.push(id);
      }
    }

    for (const id of finished) {
      this.state.mobs.delete(id);
      this.mobAbilityCooldowns.delete(id);
      this.mobCastPause.delete(id);
      this.mobAliveSec.delete(id);
      this.mobInitialSpeed.delete(id);
    }
  }

  /**
   * Subtracts leaked damage from the defender's core.
   *
   * @remarks
   * Reaching zero ends the match immediately with the attacker winning, announced
   * to both clients like a surrender. Later breaches in the same tick are harmless
   * (`declareGameOver` refuses a second call).
   */
  private leakToCore(damage: number): void {
    if (damage <= 0) return;

    this.state.coreHp = Math.max(0, this.state.coreHp - damage);
    if (this.state.coreHp > 0) return;

    if (!this.phases.declareGameOver("attacker", "core")) return;

    console.log(
      `Room ${this.roomId}: defender core destroyed; attacker wins`,
    );

    this.finishMatch("attacker", "core").catch((e) =>
      console.error(`Room ${this.roomId}: error finishing match:`, e),
    );
  }

  /** Resolves a mob's `pathId` against the map's tracks. */
  private pathFor(map: MapDefinition, pathId: string): Vec2[] | undefined {
    return mapPath(map, pathId);
  }

  private clearMobs(): void {
    if (this.state.mobs.size > 0) this.state.mobs.clear();
    this.mobAbilityCooldowns.clear();
    this.mobCastPause.clear();
    this.mobAliveSec.clear();
    this.mobInitialSpeed.clear();
  }

  /**
   * Advances tower targeting/firing and in-flight projectiles for one tick.
   *
   * @remarks
   * Mob world positions are resolved once per tick from authoritative
   * `progress` via the same `samplePathWithLateral` the client renders with, so
   * range checks and projectile homing agree with what players see. Mobs are
   * never damaged directly: a tower spawns a homing projectile (see
   * {@link Projectile}), which applies its damage on arrival and pays the
   * defender the mob's bounty on a kill.
   */
  private simulateCombat(dt: number): void {
    const map = MAPS[this.state.mapId] ?? SAMPLE_MAP;
    const halfWidth = map.pathHalfWidth ?? 0;

    const positions = new Map<string, Vec2>();
    const candidates: TargetCandidate[] = [];

    for (const [id, mob] of this.state.mobs) {
      const path = this.pathFor(map, mob.pathId);
      if (!path || path.length < 2) continue;

      const point = samplePathWithLateral(
        path,
        mob.progress,
        mob.seed,
        halfWidth,
      );
      positions.set(id, point);
      const remaining = Math.max(0, 1 - mob.progress) * pathLength(path);
      const mobType = MOB_TYPES[mob.typeId];
      const taunt = mobType?.taunt;
      const isSupport =
        mob.typeId === "say_sayar" ||
        mob.typeId === "doe_pat" ||
        mobType?.ability?.type === "heal_aura" ||
        mobType?.ability?.type === "speed_aura";
      candidates.push({
        id,
        x: point.x,
        y: point.y,
        remaining,
        taunt,
        support: isSupport,
      });
    }

    this.simulateProjectiles(dt, positions);
    this.simulateTowers(dt, map, candidates);
    this.simulateMobAbilities(dt, positions);
  }

  /**
   * Evaluates active abilities for mobs on the field (e.g. Say Sayar's heal aura).
   *
   * @remarks
   * A caster checks all living allied mobs within `ability.radius` (including
   * itself). When its cooldown is ready and at least one mob in radius is below
   * `ability.triggerHpThreshold` (e.g. 50% HP), it heals every damaged mob in
   * radius, pauses briefly for its cast animation, enters cooldown, and
   * broadcasts `MESSAGES.mobAbility` so clients play the cast and heal VFX.
   */
  private simulateMobAbilities(
    dt: number,
    positions: ReadonlyMap<string, Vec2>,
  ): void {
    if (this.state.mobs.size === 0) return;

    for (const [casterId, caster] of this.state.mobs) {
      if (caster.hp <= 0) continue;
      // Silenced mobs cannot cast abilities
      if (caster.effects.has(EFFECT_TYPES.silence)) continue;
      const type = MOB_TYPES[caster.typeId];
      const ability = type?.ability;
      if (!ability) continue;

      const prevCd = this.mobAbilityCooldowns.get(casterId) ?? 0;
      const nextCd = Math.max(0, prevCd - dt);
      if (nextCd > 0) {
        this.mobAbilityCooldowns.set(casterId, nextCd);
        continue;
      }
      this.mobAbilityCooldowns.delete(casterId);

      const casterPos = positions.get(casterId);
      if (!casterPos) continue;

      if (ability.type === "heal_aura") {
        const threshold = ability.triggerHpThreshold ?? 0.5;
        const healAmount = ability.healAmount ?? 80;
        let hasCriticalAlly = false;
        const damagedInRadius: Array<[string, Mob]> = [];

        for (const [targetId, target] of this.state.mobs) {
          if (target.hp <= 0) continue;
          const targetPos = positions.get(targetId);
          if (!targetPos) continue;

          const dist = Math.hypot(
            targetPos.x - casterPos.x,
            targetPos.y - casterPos.y,
          );
          if (dist <= ability.radius) {
            if (target.hp < target.maxHp * threshold) {
              hasCriticalAlly = true;
            }
            if (target.hp < target.maxHp) {
              damagedInRadius.push([targetId, target]);
            }
          }
        }

        if (!hasCriticalAlly || damagedInRadius.length === 0) {
          continue;
        }

        const healedIds: string[] = [];
        for (const [targetId, target] of damagedInRadius) {
          target.hp = Math.min(target.maxHp, target.hp + healAmount);
          healedIds.push(targetId);
        }

        this.mobAbilityCooldowns.set(casterId, ability.cooldownSec);
        const castDuration = ability.castDurationSec ?? 0.5;
        if (castDuration > 0) {
          this.mobCastPause.set(casterId, castDuration);
          caster.state = "casting";
        }

        const payload: MobAbilityPayload = {
          casterId,
          abilityType: "heal_aura",
          targetIds: healedIds,
        };
        this.broadcast(MESSAGES.mobAbility, payload);
      } else if (ability.type === "speed_aura") {
        const alliesInRadius: Array<[string, Mob]> = [];
        let hasOtherAlly = false;

        for (const [targetId, target] of this.state.mobs) {
          if (target.hp <= 0) continue;
          const targetPos = positions.get(targetId);
          if (!targetPos) continue;

          const dist = Math.hypot(
            targetPos.x - casterPos.x,
            targetPos.y - casterPos.y,
          );
          if (dist <= ability.radius) {
            alliesInRadius.push([targetId, target]);
            if (targetId !== casterId) {
              hasOtherAlly = true;
            }
          }
        }

        if (!hasOtherAlly) {
          continue;
        }

        const boost = ability.speedBoost ?? 0.4;
        const duration = ability.durationSec ?? 4;
        const boostedIds: string[] = [];

        for (const [targetId, target] of alliesInRadius) {
          this.applyMobEffect(
            target,
            EFFECT_TYPES.haste,
            boost,
            duration,
            casterId,
          );
          boostedIds.push(targetId);
        }

        this.mobAbilityCooldowns.set(casterId, ability.cooldownSec);
        const castDuration = ability.castDurationSec ?? 0;
        if (castDuration > 0) {
          this.mobCastPause.set(casterId, castDuration);
          caster.state = "casting";
        }

        const payload: MobAbilityPayload = {
          casterId,
          abilityType: "speed_aura",
          targetIds: boostedIds,
        };
        this.broadcast(MESSAGES.mobAbility, payload);
      } else if (ability.type === "self_heal") {
        if (caster.hp >= caster.maxHp) {
          continue;
        }
        const healAmount = Math.max(
          1,
          Math.round(caster.maxHp * (ability.healFraction ?? 0.1)),
        );
        caster.hp = Math.min(caster.maxHp, caster.hp + healAmount);

        this.mobAbilityCooldowns.set(casterId, ability.cooldownSec);
        const castDuration = ability.castDurationSec ?? 0.4;
        if (castDuration > 0) {
          this.mobCastPause.set(casterId, castDuration);
          caster.state = "casting";
        }

        const payload: MobAbilityPayload = {
          casterId,
          abilityType: "self_heal",
          targetIds: [casterId],
        };
        this.broadcast(MESSAGES.mobAbility, payload);
      }
    }
  }

  /** Fires each ready tower at the in-range mob nearest the base. */
  private simulateTowers(
    dt: number,
    map: MapDefinition,
    candidates: readonly TargetCandidate[],
  ): void {
    for (const tower of this.state.towers.values()) {
      this.tickTowerEffects(tower, dt);

      // Stunned towers cannot acquire targets, count down cooldown, or fire.
      if (tower.effects.has(TOWER_EFFECT_TYPES.stun)) {
        tower.targetId = undefined;
        continue;
      }

      const type = TOWER_TYPES[tower.typeId];
      const tier = type ? tierAt(type, tower.level) : null;
      const slot = map.slots.find((s) => s.slotIndex === tower.slotIndex);
      if (!tier || !slot) continue;

      // Apply tower haste / slow status effects to cooldown recovery rate.
      const towerHaste =
        tower.effects.get(TOWER_EFFECT_TYPES.haste)?.magnitude ?? 0;
      const towerSlow =
        tower.effects.get(TOWER_EFFECT_TYPES.slow)?.magnitude ?? 0;
      const cdRate = Math.max(
        0.1,
        (1 - Math.min(0.9, towerSlow)) * (1 + Math.max(0, towerHaste)),
      );

      // Clamp so a long idle period never stockpiles "negative" cooldown.
      tower.cooldown = Math.max(0, tower.cooldown - dt * cdRate);

      // Archer wind-up: consecutive shots build +10% fire rate stacks up to windupMaxBonus.
      // If idle > 2.0s without firing, stacks decay to 0.
      const towerKey = `${tower.ownerId}-${tower.slotIndex}`;
      const lastFire = this.towerLastFireTime.get(towerKey) ?? 0;
      if (this.matchTime - lastFire > 2.0) {
        this.towerWindupStacks.set(towerKey, 0);
      }
      const windupStacks = this.towerWindupStacks.get(towerKey) ?? 0;
      const windupBonus = tier.special?.windupMaxBonus
        ? Math.min(tier.special.windupMaxBonus, windupStacks * 0.10)
        : 0;
      const effectiveFireRate = tier.fireRate * (1 + windupBonus);

      if (type?.attackMode === "aoe_pulse") {
        const inRange = candidates.filter(
          (c) => Math.hypot(c.x - slot.x, c.y - slot.y) <= tier.range,
        );
        tower.targetId = inRange[0]?.id;
        if (inRange.length === 0 || tower.cooldown > 0) continue;

        tower.cooldown = 1 / effectiveFireRate;
        this.towerWindupStacks.set(towerKey, windupStacks + 1);
        this.towerLastFireTime.set(towerKey, this.matchTime);

        const damageType = type.damageType ?? DAMAGE_TYPES.mental;
        const targetIds: string[] = [];
        const targets: Array<{ id: string; x: number; y: number }> = [];
        for (const c of inRange) {
          targetIds.push(c.id);
          targets.push({ id: c.id, x: c.x, y: c.y });
          this.damageMob(
            c.id,
            this.towerDamage(tier),
            tower.ownerId,
            damageType,
            tower.typeId,
            tower.slotIndex,
            tier.special,
          );
        }

        const payload: TowerAttackPayload = {
          slotIndex: tower.slotIndex,
          typeId: tower.typeId,
          targetIds,
          targets,
        };
        this.broadcast(MESSAGES.towerAttack, payload);
        continue;
      }

      const target = selectTarget(
        candidates,
        slot,
        tier.range,
        !!tier.special?.prioritizeSupport,
      );
      tower.targetId = target?.id;

      if (!target || tower.cooldown > 0) continue;

      tower.cooldown = 1 / effectiveFireRate;
      this.towerWindupStacks.set(towerKey, windupStacks + 1);
      this.towerLastFireTime.set(towerKey, this.matchTime);
      this.spawnProjectile(tower, slot, target, tier);
    }
  }

  /** Picks a random damage value for a tower shot within its tier range. */
  private towerDamage(tier: TowerTier): number {
    const min = Math.max(1, tier.damage);
    const max = Math.max(min, tier.damageMax ?? tier.damage);
    if (max === min) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /** Spawns a homing projectile from a tower's muzzle/mouth toward `target`. */
  private spawnProjectile(
    tower: Tower,
    slot: Vec2,
    target: TargetCandidate,
    tier: TowerTier,
  ): void {
    const id = `proj-${this.projectileSeq++}`;
    const muzzle = getTowerMuzzleOffset(
      tower.typeId,
      slot.x,
      slot.y,
      target.x,
      target.y,
    );

    this.state.projectiles.set(
      id,
      new Projectile({
        ownerId: tower.ownerId,
        typeId: tower.typeId,
        x: slot.x + muzzle.x,
        y: slot.y + muzzle.y,
        targetId: target.id,
        damage: this.towerDamage(tier),
        speed: tier.projectileSpeed,
      }),
    );

    // Remember where the shot is headed and how wide it bursts, so it can still
    // land (and artillery can still splash) after its target dies.
    this.projectileAim.set(id, { x: target.x, y: target.y });
    this.projectileSplash.set(id, TOWER_TYPES[tower.typeId]?.splashRadius ?? 0);
    this.projectileSourceSlot.set(id, tower.slotIndex);
    if (tier.special) {
      this.projectileSpecial.set(id, tier.special);
    }
  }

  /** Homes every projectile toward its aim and resolves the shot on arrival. */
  private simulateProjectiles(
    dt: number,
    positions: ReadonlyMap<string, Vec2>,
  ): void {
    if (this.state.projectiles.size === 0) return;

    const finished: string[] = [];

    for (const [id, projectile] of this.state.projectiles) {
      // While the target lives, keep the aim glued to it (homing). Once it is
      // gone the last aim is frozen and reused, so the shot still flies out and
      // lands rather than being deleted the instant its target dies.
      const target = positions.get(projectile.targetId);
      const aim = this.projectileAim.get(id);
      if (target && aim) {
        aim.x = target.x;
        aim.y = target.y;
      }
      const destination = aim ?? { x: projectile.x, y: projectile.y };

      const dx = destination.x - projectile.x;
      const dy = destination.y - projectile.y;
      const distance = Math.hypot(dx, dy);
      const step = projectile.speed * dt;

      if (distance <= step + PROJECTILE_HIT_RADIUS) {
        this.resolveProjectileImpact(id, projectile, destination, positions);
        finished.push(id);
        continue;
      }

      projectile.x += (dx / distance) * step;
      projectile.y += (dy / distance) * step;
    }

    for (const id of finished) {
      this.state.projectiles.delete(id);
      this.projectileAim.delete(id);
      this.projectileSplash.delete(id);
      this.projectileSourceSlot.delete(id);
      this.projectileSpecial.delete(id);
    }
  }

  /**
   * Applies a projectile's damage where it landed.
   *
   * @remarks A single-target arrow only damages the mob it was aimed at, so if
   * that mob died en route the shot is a harmless miss. An artillery shell
   * (`splashRadius > 0`) still bursts, damaging every mob within the blast
   * radius of the impact point.
   */
  private resolveProjectileImpact(
    id: string,
    projectile: Projectile,
    impact: Vec2,
    positions: ReadonlyMap<string, Vec2>,
  ): void {
    const ownerId = projectile.ownerId;
    const hit = new Set<string>();

    // A still-living target is always hit (the shot was homing on it).
    if (positions.has(projectile.targetId)) {
      hit.add(projectile.targetId);
    }

    const splash = this.projectileSplash.get(id) ?? 0;
    if (splash > 0) {
      for (const [mobId, pos] of positions) {
        if (Math.hypot(pos.x - impact.x, pos.y - impact.y) <= splash) {
          hit.add(mobId);
        }
      }
    }

    const sourceSlotIndex = this.projectileSourceSlot.get(id);
    const special = this.projectileSpecial.get(id);
    for (const mobId of hit) {
      const damageType =
        TOWER_TYPES[projectile.typeId]?.damageType ?? DAMAGE_TYPES.physical;
      this.damageMob(
        mobId,
        projectile.damage,
        ownerId,
        damageType,
        projectile.typeId,
        sourceSlotIndex,
        special,
      );
    }
  }

  /**
   * Applies projectile damage and, on a kill, pays the defender the bounty.
   *
   * @remarks Damage is typed. Physical damage is blunted by the mob's armor,
   * so a heavily armored troop shrugs off arrows. Mental damage ignores armor
   * but cracks the mob: the hit lands at face value and every later mental
   * hit from any source hits harder (see {@link applyMentalDebuff}).
   */
  private damageMob(
    mobId: string,
    damage: number,
    ownerId: string,
    damageType: DamageType,
    sourceTowerTypeId?: string,
    sourceSlotIndex?: number,
    special?: TowerTierSpecial,
  ): void {
    const mob = this.state.mobs.get(mobId);
    if (!mob) return;

    const type = MOB_TYPES[mob.typeId];
    const adaptive = type?.adaptiveDefense;
    const physStacks =
      mob.effects.get(EFFECT_TYPES.armor_stack)?.magnitude ?? 0;
    const mentalStacks =
      mob.effects.get(EFFECT_TYPES.mental_stack)?.magnitude ?? 0;

    // Flat armor stripped by Sein Pyaung armor_crush
    const armorCrush =
      mob.effects.get(EFFECT_TYPES.armor_crush)?.magnitude ?? 0;
    const rawArmor =
      (type?.armor ?? 0) + (adaptive ? physStacks * adaptive.armorPerStack : 0);
    const baseEffectiveArmor = Math.max(0, rawArmor - armorCrush);

    // Cannon armor pierce ignores a fraction of effective armor
    const effectiveArmor =
      special?.armorPierceRatio !== undefined && special.armorPierceRatio > 0
        ? Math.max(0, baseEffectiveArmor * (1 - special.armorPierceRatio))
        : baseEffectiveArmor;

    // Water Cannon drench status amplifies incoming mental damage
    const drenchMag =
      mob.effects.get(EFFECT_TYPES.drench)?.magnitude ?? 0;

    const applied =
      damageType === DAMAGE_TYPES.mental
        ? mentalDamageTaken(damage, this.debuffMagnitude(mob)) * (1 + drenchMag)
        : physicalDamageTaken(damage, effectiveArmor);

    const roundedDamage = Math.round(applied);
    mob.hp = Math.max(0, mob.hp - roundedDamage);

    // Monkey Burst of Speed: drops from very fast initial speed to average speed upon first taking damage
    if (
      roundedDamage > 0 &&
      type?.damagedSpeed !== undefined &&
      mob.speed > type.damagedSpeed
    ) {
      mob.speed = type.damagedSpeed;
      this.mobInitialSpeed.set(mobId, type.damagedSpeed);
    }

    // Belu Ogre Adaptive Defense: gains physical armor stack on physical hit or mental strength stack on mental hit (max 5 combined)
    if (adaptive && damage > 0) {
      const totalStacks = physStacks + mentalStacks;
      if (totalStacks < adaptive.maxStacks) {
        if (damageType === DAMAGE_TYPES.physical) {
          mob.effects.set(
            EFFECT_TYPES.armor_stack,
            new MobEffect({
              type: EFFECT_TYPES.armor_stack,
              magnitude: physStacks + 1,
              remaining: EFFECT_DURATION_SEC.armor_stack,
              sourceId: ownerId,
            }),
          );
        } else if (damageType === DAMAGE_TYPES.mental) {
          mob.effects.set(
            EFFECT_TYPES.mental_stack,
            new MobEffect({
              type: EFFECT_TYPES.mental_stack,
              magnitude: mentalStacks + 1,
              remaining: EFFECT_DURATION_SEC.mental_stack,
              sourceId: ownerId,
            }),
          );
        }
      }
    }

    if (damageType === DAMAGE_TYPES.mental) {
      this.applyMentalDebuff(mob, type, ownerId);
    }

    // Sein Pyaung: Permanently strips physical armor from the target per hit
    if (special?.armorStripPermanent !== undefined && special.armorStripPermanent > 0) {
      const existingCrush =
        mob.effects.get(EFFECT_TYPES.armor_crush)?.magnitude ?? 0;
      mob.effects.set(
        EFFECT_TYPES.armor_crush,
        new MobEffect({
          type: EFFECT_TYPES.armor_crush,
          magnitude: existingCrush + special.armorStripPermanent,
          remaining: EFFECT_DURATION_SEC.armor_crush,
          sourceId: ownerId,
        }),
      );
    }

    // Water Cannon: Drench and slow status
    if (special?.drenchSlow !== undefined && special.drenchSlow > 0) {
      this.applyMobEffect(
        mob,
        EFFECT_TYPES.slow,
        special.drenchSlow,
        EFFECT_DURATION_SEC.drench,
        ownerId,
      );
    }
    if (special?.drenchVulnerability !== undefined && special.drenchVulnerability > 0) {
      this.applyMobEffect(
        mob,
        EFFECT_TYPES.drench,
        special.drenchVulnerability,
        EFFECT_DURATION_SEC.drench,
        ownerId,
      );
    }

    // Bell Tower: Echoing terror AoE pulse slow
    if (special?.pulseSlow !== undefined && special.pulseSlow > 0) {
      this.applyMobEffect(
        mob,
        EFFECT_TYPES.slow,
        special.pulseSlow,
        1.5,
        ownerId,
      );
    }

    // Spear Tower: Lacerating bleed
    if (special?.bleedTotalDamage !== undefined && special.bleedTotalDamage > 0) {
      this.applyMobEffect(
        mob,
        EFFECT_TYPES.bleed,
        special.bleedTotalDamage,
        EFFECT_DURATION_SEC.bleed,
        ownerId,
      );
    }

    // Chinthe Guardian: Sacred roar silence
    if (special?.silenceSec !== undefined && special.silenceSec > 0) {
      this.applyMobEffect(
        mob,
        EFFECT_TYPES.silence,
        1,
        special.silenceSec,
        ownerId,
      );
    }

    // Bomb Throwing Tower / Chinthe Guardian: Knockback along path
    if (special?.knockbackPx !== undefined && special.knockbackPx > 0) {
      const map = MAPS[this.state.mapId] ?? SAMPLE_MAP;
      const path = this.pathFor(map, mob.pathId);
      const total = path ? pathLength(path) : 0;
      if (total > 0) {
        mob.progress = Math.max(0, mob.progress - special.knockbackPx / total);
      }
    }

    // Apply any general tower-specific on-hit status effects
    if (sourceTowerTypeId) {
      const towerDef = TOWER_TYPES[sourceTowerTypeId];
      if (towerDef?.onHitEffect) {
        this.applyMobEffect(
          mob,
          towerDef.onHitEffect.type,
          towerDef.onHitEffect.magnitude,
          towerDef.onHitEffect.durationSec,
          ownerId,
        );
      }
    }

    if (mob.hp > 0) return;

    this.killMob(mobId, mob, ownerId, sourceSlotIndex, sourceTowerTypeId, special);
  }

  /**
   * Resolves on-death mechanics (Sone Ma stun, Dragon detonation, Gun bounty bonus),
   * removes the mob from the field, and awards the defender their bounty.
   */
  private killMob(
    mobId: string,
    mob: Mob,
    ownerId: string,
    sourceSlotIndex?: number,
    sourceTowerTypeId?: string,
    special?: TowerTierSpecial,
  ): void {
    const type = MOB_TYPES[mob.typeId];

    // Sone Ma On-Death Curse: stuns the tower that killed her for 5 seconds
    if (
      type?.onDeathTowerStunSec &&
      type.onDeathTowerStunSec > 0 &&
      sourceSlotIndex !== undefined
    ) {
      const killerTower = [...this.state.towers.values()].find(
        (t) => t.slotIndex === sourceSlotIndex,
      );
      if (killerTower) {
        this.applyTowerEffect(
          killerTower,
          TOWER_EFFECT_TYPES.stun,
          type.onDeathTowerStunSec,
          type.onDeathTowerStunSec,
          mobId,
        );
      }
    }

    // Dragon Tower: Cataclysmic detonation on kill
    if (
      sourceTowerTypeId === "dragon" &&
      special?.deathExplosionDamage !== undefined &&
      special.deathExplosionDamage > 0
    ) {
      const map = MAPS[this.state.mapId] ?? SAMPLE_MAP;
      const path = this.pathFor(map, mob.pathId);
      if (path && path.length >= 2) {
        const halfWidth = map.pathHalfWidth ?? 0;
        const deathPos = samplePathWithLateral(
          path,
          mob.progress,
          mob.seed,
          halfWidth,
        );
        const radius = special.deathExplosionRadius ?? 50;
        const explosionDamage = special.deathExplosionDamage;

        this.broadcast(MESSAGES.mobDeathExplosion, {
          mobId,
          x: deathPos.x,
          y: deathPos.y,
          radius,
          sourceTowerTypeId: "dragon",
        });

        // Damage all other living mobs within explosion radius
        for (const [otherId, otherMob] of this.state.mobs) {
          if (otherId === mobId || otherMob.hp <= 0) continue;
          const otherPath = this.pathFor(map, otherMob.pathId);
          if (!otherPath || otherPath.length < 2) continue;
          const otherPos = samplePathWithLateral(
            otherPath,
            otherMob.progress,
            otherMob.seed,
            halfWidth,
          );
          if (Math.hypot(otherPos.x - deathPos.x, otherPos.y - deathPos.y) <= radius) {
            this.damageMob(
              otherId,
              explosionDamage,
              ownerId,
              DAMAGE_TYPES.mental,
              "dragon",
              sourceSlotIndex,
              special,
            );
          }
        }
      }
    }

    this.state.mobs.delete(mobId);
    this.mobAbilityCooldowns.delete(mobId);
    this.mobCastPause.delete(mobId);
    this.mobAliveSec.delete(mobId);
    this.mobInitialSpeed.delete(mobId);

    // Bounty: Base bounty + bonus gold on kill if Gun Tower
    const bonusGold = special?.bonusGoldOnKill ?? 0;
    this.awardBounty(ownerId, mob.bounty + bonusGold);
  }

  /**
   * Magnitude of the mental debuff riding on a mob.
   *
   * @remarks `0` means the mob is untouched: mental damage lands at face
   * value. Anything higher multiplies incoming mental damage.
   */
  private debuffMagnitude(mob: Mob): number {
    return mob.effects.get(EFFECT_TYPES.debuff)?.magnitude ?? 0;
  }

  /**
   * Cracks a mob that just took mental damage.
   *
   * @remarks The debuff is based on the mob's mental strength: a mob with full
   * resolve negates it completely, a half-resolute mob takes 1.5x mental
   * damage from then on, and a shattered one takes 2x — and is dragged down to
   * {@link DEFAULT_COMBAT_RULES.mentalBreakSlowFactor} of its speed.
   */
  private applyMentalDebuff(
    mob: Mob,
    type: MobType | undefined,
    sourceId: string,
  ): void {
    const adaptive = type?.adaptiveDefense;
    const mentalStacks =
      mob.effects.get(EFFECT_TYPES.mental_stack)?.magnitude ?? 0;
    const strength = Math.min(
      1,
      (type?.mentalStrength ?? 0.5) +
        (adaptive ? mentalStacks * adaptive.mentalStrengthPerStack : 0),
    );
    const magnitude = mentalDebuffMagnitude(strength);

    // A mob with full mental strength shrugs the crack off completely.
    if (magnitude <= 0) {
      mob.effects.delete(EFFECT_TYPES.debuff);
      return;
    }

    // For adaptive defense mobs whose mental strength grows per mental hit,
    // update any existing debuff downward to reflect their increased resolve.
    const existingDebuff = mob.effects.get(EFFECT_TYPES.debuff);
    if (existingDebuff && adaptive) {
      existingDebuff.magnitude = magnitude;
      existingDebuff.remaining = Math.max(
        existingDebuff.remaining,
        DEFAULT_COMBAT_RULES.debuffDurationSec,
      );
      if (sourceId) existingDebuff.sourceId = sourceId;
    } else {
      this.applyMobEffect(
        mob,
        EFFECT_TYPES.debuff,
        magnitude,
        DEFAULT_COMBAT_RULES.debuffDurationSec,
        sourceId,
      );
    }

    // A fully broken mob also loses its footing.
    if (strength <= 0) {
      this.applyMobEffect(
        mob,
        EFFECT_TYPES.slow,
        1 - DEFAULT_COMBAT_RULES.mentalBreakSlowFactor,
        DEFAULT_COMBAT_RULES.slowDurationSec,
        sourceId,
      );
    }
  }

  /**
   * Puts a status effect on a mob.
   *
   * @remarks One effect per type at a time: re-applying refreshes the
   * remaining time and keeps the stronger magnitude, so a weak slow can never
   * dilute a heavy one.
   */
  private applyMobEffect(
    mob: Mob,
    type: EffectType,
    magnitude: number,
    durationSec: number,
    sourceId: string,
  ): void {
    const existing = mob.effects.get(type);

    if (existing) {
      existing.magnitude = combineEffectMagnitude(existing.magnitude, magnitude);
      existing.remaining = Math.max(existing.remaining, durationSec);
      if (sourceId) existing.sourceId = sourceId;
      return;
    }

    mob.effects.set(
      type,
      new MobEffect({ type, magnitude, remaining: durationSec, sourceId }),
    );
  }

  /** Counts a mob's effects down and drops the ones that ran out. */
  private tickMobEffects(mob: Mob, dt: number): void {
    if (mob.effects.size === 0) return;

    for (const [key, effect] of [...mob.effects]) {
      // Spear bleed: deals physical damage continuously over duration
      if (key === EFFECT_TYPES.bleed && effect.remaining > 0) {
        const totalDuration = EFFECT_DURATION_SEC.bleed || 3.0;
        const damageThisTick = (effect.magnitude / totalDuration) * dt;
        mob.hp = Math.max(0, mob.hp - damageThisTick);
      }

      effect.remaining -= dt;
      if (effect.remaining <= 0) mob.effects.delete(key);
    }
  }

  /** Puts a status effect (e.g. stun, haste, slow) on a tower. */
  private applyTowerEffect(
    tower: Tower,
    type: TowerEffectType,
    magnitude: number,
    durationSec: number,
    sourceId: string,
  ): void {
    const existing = tower.effects.get(type);

    if (existing) {
      existing.magnitude = combineEffectMagnitude(existing.magnitude, magnitude);
      existing.remaining = Math.max(existing.remaining, durationSec);
      if (sourceId) existing.sourceId = sourceId;
      return;
    }

    tower.effects.set(
      type,
      new TowerEffect({ type, magnitude, remaining: durationSec, sourceId }),
    );
  }

  /** Counts a tower's status effects down and drops expired ones. */
  private tickTowerEffects(tower: Tower, dt: number): void {
    if (tower.effects.size === 0) return;

    for (const [key, effect] of [...tower.effects]) {
      effect.remaining -= dt;
      if (effect.remaining <= 0) tower.effects.delete(key);
    }
  }

  /** A mob's speed right now, after flexible pacing, slows, hastes, and stuns. */
  private mobSpeed(
    mob: Mob,
    mobId?: string,
    positions?: ReadonlyMap<string, Vec2>,
  ): number {
    if (mob.effects.has(EFFECT_TYPES.stun)) return 0;

    let baseSpeed = mob.speed;
    const mobType = MOB_TYPES[mob.typeId];
    const ability = mobType?.ability;
    if (
      ability?.paceSlowFactor !== undefined &&
      mobId !== undefined &&
      positions &&
      !mob.effects.has(EFFECT_TYPES.silence)
    ) {
      const selfPos = positions.get(mobId);
      if (selfPos) {
        let slowestAllySpeed = Infinity;
        for (const [otherId, other] of this.state.mobs) {
          if (otherId === mobId || other.hp <= 0) continue;
          const otherPos = positions.get(otherId);
          if (!otherPos) continue;
          const dist = Math.hypot(
            otherPos.x - selfPos.x,
            otherPos.y - selfPos.y,
          );
          if (dist <= ability.radius && other.speed < slowestAllySpeed) {
            slowestAllySpeed = other.speed;
          }
        }
        // If a nearby ally in aura range is significantly slower, slow down to pace them.
        if (slowestAllySpeed < baseSpeed * 0.8) {
          baseSpeed = Math.max(
            slowestAllySpeed,
            baseSpeed * ability.paceSlowFactor,
          );
        }
      }
    }

    const slow = mob.effects.get(EFFECT_TYPES.slow);
    const haste = mob.effects.get(EFFECT_TYPES.haste);
    return effectiveSpeed(
      baseSpeed,
      slow ? [slow.magnitude] : [],
      haste ? [haste.magnitude] : [],
    );
  }

  /** Credits a defender's hidden gold and pushes them a fresh snapshot. */
  private awardBounty(sessionId: string, amount: number): void {
    if (!sessionId || amount <= 0) return;

    this.economies.set(sessionId, (this.economies.get(sessionId) ?? 0) + amount);

    const client = this.clients.find((c) => c.sessionId === sessionId);
    if (client) this.sendEconomy(client);
  }

  private clearProjectiles(): void {
    if (this.state.projectiles.size > 0) this.state.projectiles.clear();
    this.projectileAim.clear();
    this.projectileSplash.clear();
    this.projectileSourceSlot.clear();
    this.projectileSpecial.clear();
  }
}

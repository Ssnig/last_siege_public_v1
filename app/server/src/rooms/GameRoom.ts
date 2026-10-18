
import { Room, Client, CloseCode, definePlugins } from "colyseus";
import { IdleKickPlugin } from "colyseus/plugins/idle-kick";
import {
  RoomState,
  Player,
  Tower,
  Mob,
  Projectile,
  MESSAGES,
  MAPS,
  SAMPLE_MAP,
  MOB_TYPES,
  TOWER_TYPES,
  DEFAULT_DECK_RULES,
  DEFAULT_ECONOMY,
  DEFAULT_WAVE_RULES,
  MATCH_RULES,
  MOB_SPEED_JITTER,
  PROJECTILE_HIT_RADIUS,
  pathLength,
  samplePathWithLateral,
  mapPath,
  mapPathIds,
  pickRandomMapId,
  RANDOM_MAP_ID,
  tierAt,
  waveGoldCost,
  waveTroopCount,
  stageLimits,
  validateWave,
  type AttackerArmyPath,
  type AttackerArmyPayload,
  type DraftReadyIntent,
  type GameOverPayload,
  type MapDefinition,
  type MobType,
  type PlaceTowerIntent,
  type RoomStatus,
  type SellTowerIntent,
  type UpgradeTowerIntent,
  type StagedWave,
  type TowerTier,
  type Vec2,
  type WaveAddBatchIntent,
  type WaveClearIntent,
  type WaveReleaseIntent,
  type WaveRemoveBatchIntent,
  type WaveReorderIntent,
  type WaveSetCountIntent,
  type WaveSetSizeIntent,
  type YouEconomyPayload,
  buildCost,
  sellRefund,
  upgradeCost,
} from "@root/shared";
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
  "grunt",
  "runner",
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
  private acceptedDecks = new Map<string, string[]>();

  /**
   * Hidden gold per session ID. Mirrors `acceptedDecks`: kept off `RoomState`
   * and pushed to the owner via private `you_economy` messages only.
   */
  private economies = new Map<string, number>();

  /** Dynamic passive income rate per player session ID, in gold per second. */
  private incomeRates = new Map<string, number>();

  /**
   * Attacker-only staged armies, keyed by session id then by path id.
   *
   * @remarks Deliberately off `RoomState`: the defender must never be able to
   * read what is staged against them before it spawns.
   */
  private stagedWaves = new Map<string, Map<string, StagedWave>>();

  /** Spawn schedule for released batches, kept ordered by `atMatchTime`. */
  private releaseQueue: ScheduledBatch[] = [];

  /** Monotonic source of staged-batch handles (`batch-<n>`). */
  private batchSeq = 0;

  /** Seconds elapsed since combat began; the release schedule is keyed to it. */
  private matchTime = 0;

  /** `true` once the round timer expired, so attacker passive income stops. */
  private incomeExpired = false;

  /** Big-wave pool left per attacker session id. */
  private bigWavesRemaining = new Map<string, number>();

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

    [MESSAGES.waveAddBatch]: (
      client: Client,
      payload: WaveAddBatchIntent,
    ) => this.handleWaveAddBatch(client, payload),

    [MESSAGES.waveSetCount]: (
      client: Client,
      payload: WaveSetCountIntent,
    ) => this.handleWaveSetCount(client, payload),

    [MESSAGES.waveRemoveBatch]: (
      client: Client,
      payload: WaveRemoveBatchIntent,
    ) => this.handleWaveRemoveBatch(client, payload),

    [MESSAGES.waveReorder]: (
      client: Client,
      payload: WaveReorderIntent,
    ) => this.handleWaveReorder(client, payload),

    [MESSAGES.waveSetSize]: (
      client: Client,
      payload: WaveSetSizeIntent,
    ) => this.handleWaveSetSize(client, payload),

    [MESSAGES.waveClear]: (
      client: Client,
      payload: WaveClearIntent,
    ) => this.handleWaveClear(client, payload),

    [MESSAGES.waveRelease]: (
      client: Client,
      payload: WaveReleaseIntent,
    ) => this.handleWaveRelease(client, payload),
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
    this.bigWavesRemaining.set(
      creatorClient.sessionId,
      creatorRole === "attacker" ? DEFAULT_ECONOMY.bigWaveCount : 0,
    );
    this.bigWavesRemaining.set(
      joinerClient.sessionId,
      joinerRole === "attacker" ? DEFAULT_ECONOMY.bigWaveCount : 0,
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
    const defaultIncome =
      role === "attacker"
        ? DEFAULT_ECONOMY.attackerBaseIncome
        : DEFAULT_ECONOMY.defenderBaseIncome;
    const incomeRate =
      Math.round((this.incomeRates.get(client.sessionId) ?? defaultIncome) * 10) / 10;

    const economy: YouEconomyPayload = {
      gold: Math.floor(this.economies.get(client.sessionId) ?? 0),
      deck: deck ?? [],
      bigWavesRemaining: this.bigWavesRemaining.get(client.sessionId) ?? 0,
      incomeRate,
    };
    client.send(MESSAGES.youEconomy, economy);
  }

  /**
   * Pushes the attacker's staged army plus the rules their HUD needs to price
   * and validate a wave. No-op for the defender, who must not see the staging.
   */
  private sendAttackerArmy(client: Client): void {
    const sessionId = client.sessionId;
    if (client.userData?.role !== "attacker") return;

    const map = MAPS[this.state.mapId] ?? SAMPLE_MAP;
    const deck = this.acceptedDecks.get(sessionId) ?? [];
    const availableTroops =
      deck.length > 0 ? deck : DEFAULT_ATTACKER_DECK;
    const staged = this.stagedWaves.get(sessionId) ?? new Map<string, StagedWave>();

    const paths: AttackerArmyPath[] = this.pathIdsFor(map).map((pathId) => {
      const wave =
        staged.get(pathId) ?? ({ pathId, size: "small", batches: [] } as StagedWave);
      return {
        pathId: wave.pathId,
        label: map.pathLabels?.[pathId],
        size: wave.size,
        batches: wave.batches.map((batch) => ({ ...batch })),
        goldCost: waveGoldCost(wave.batches, wave.size),
        troopCount: waveTroopCount(wave.batches),
      };
    });

    const currentIncome =
      this.incomeRates.get(sessionId) ?? DEFAULT_ECONOMY.attackerBaseIncome;

    const payload: AttackerArmyPayload = {
      gold: Math.floor(this.economies.get(sessionId) ?? 0),
      goldPerSecond: Math.round(currentIncome * 10) / 10,
      incomeExpired: this.incomeExpired,
      bigWavesRemaining: this.bigWavesRemaining.get(sessionId) ?? 0,
      availableTroops: [...availableTroops],
      limits: DEFAULT_WAVE_RULES.sizes,
      mobCosts: Object.fromEntries(
        Object.entries(MOB_TYPES).map(([id, type]) => [id, type.cost]),
      ),
      paths,
    };

    client.send(MESSAGES.attackerArmy, payload);
  }

  /** Convenience: push both private snapshots a player needs. */
  private sendPlayerState(client: Client): void {
    this.sendEconomy(client);
    this.sendAttackerArmy(client);
  }

  /** Sends a private explanation for a refused wave intent. */
  private rejectWave(client: Client, reason: string): void {
    console.log(`Wave intent from ${client.sessionId} rejected: ${reason}`);
    client.send(MESSAGES.waveRejected, { reason });
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
    if (!allowedDeck.includes(payload.typeId)) {
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

    const refund = sellRefund(tower.invested);

    this.state.towers.delete(payload.towerId);
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
   * Shared gate for every wave-staging intent.
   *
   * @returns `null` when the request may proceed, otherwise a refusal reason.
   *
   * @remarks Staging is open during `building` so the attacker can compose the
   * first wave while the defender is still laying towers, but only the attacker
   * may ever touch it. Releasing (see `handleWaveRelease`) is combat-only.
   */
  private canStage(client: Client): string | null {
    if (client.userData?.role !== "attacker") {
      return "Only the attacker can stage a wave.";
    }
    if (this.state.phase !== "building" && this.state.phase !== "combat") {
      return "You cannot stage units right now.";
    }
    if (this.incomeExpired) {
      return "Your income has stopped; no more units can be staged.";
    }
    return null;
  }

  /** Fetches (or creates empty) staged wave for one of the attacker's paths. */
  private ensureStagedWave(sessionId: string, pathId: string): StagedWave {
    let staged = this.stagedWaves.get(sessionId);
    if (!staged) {
      staged = new Map<string, StagedWave>();
      this.stagedWaves.set(sessionId, staged);
    }

    const existing = staged.get(pathId);
    if (existing) return existing;

    const created: StagedWave = { pathId, size: "small", batches: [] };
    staged.set(pathId, created);
    return created;
  }

  /** Validates that `pathId` exists on this room's map. */
  private pathIdIsValid(pathId: string): boolean {
    const map = MAPS[this.state.mapId] ?? SAMPLE_MAP;
    return this.pathIdsFor(map).includes(pathId);
  }

  /** Rejects the intent when invalid, otherwise pushes a fresh army snapshot. */
  private stageOutcome(client: Client, error: string | null): void {
    if (error) {
      this.rejectWave(client, error);
      return;
    }
    this.sendAttackerArmy(client);
  }

  /** Stages one new batch of `count` units at the end of a path's wave. */
  private handleWaveAddBatch(client: Client, payload: WaveAddBatchIntent): void {
    const guard = this.canStage(client);
    if (guard) return void this.rejectWave(client, guard);

    if (!payload || !this.pathIdIsValid(payload.pathId)) {
      return void this.rejectWave(client, "No such path on this map.");
    }

    const sessionId = client.sessionId;
    const deck = this.acceptedDecks.get(sessionId) ?? [];
    const allowedDeck =
      deck.length > 0 ? deck : DEFAULT_ATTACKER_DECK;
    if (!allowedDeck.includes(payload.typeId)) {
      return void this.rejectWave(client, `${payload.typeId} is not in your deck.`);
    }

    const wave = this.ensureStagedWave(sessionId, payload.pathId);
    const limits = stageLimits(wave.size);
    const count = payload.count;

    if (!Number.isInteger(count) || count < 1 || count > limits.batchLimit) {
      return void this.stageOutcome(
        client,
        `A ${wave.size} wave allows between 1 and ${limits.batchLimit} units per batch.`,
      );
    }
    if (wave.batches.length >= limits.maxBatches) {
      return void this.stageOutcome(
        client,
        `A ${wave.size} wave allows at most ${limits.maxBatches} batches.`,
      );
    }
    if (waveTroopCount(wave.batches) + count > limits.waveLimit) {
      return void this.stageOutcome(
        client,
        `A ${wave.size} wave allows at most ${limits.waveLimit} units.`,
      );
    }

    wave.batches.push({
      batchId: `batch-${++this.batchSeq}`,
      typeId: payload.typeId,
      count,
    });
    this.stageOutcome(client, null);
  }

  /** Changes a staged batch's unit count within the size's limits. */
  private handleWaveSetCount(client: Client, payload: WaveSetCountIntent): void {
    const guard = this.canStage(client);
    if (guard) return void this.rejectWave(client, guard);

    const wave = this.stagedWaves.get(client.sessionId)?.get(payload.pathId);
    const batch = wave?.batches.find((b) => b.batchId === payload.batchId);
    if (!wave || !batch) {
      return void this.rejectWave(client, "That batch is no longer staged.");
    }

    const limits = stageLimits(wave.size);
    const count = payload.count;
    if (!Number.isInteger(count) || count < 1 || count > limits.batchLimit) {
      return void this.stageOutcome(
        client,
        `A ${wave.size} wave allows between 1 and ${limits.batchLimit} units per batch.`,
      );
    }

    const otherTroops = waveTroopCount(wave.batches) - batch.count;
    if (otherTroops + count > limits.waveLimit) {
      return void this.stageOutcome(
        client,
        `A ${wave.size} wave allows at most ${limits.waveLimit} units.`,
      );
    }

    batch.count = count;
    this.stageOutcome(client, null);
  }

  /** Removes one staged batch from a path's wave. */
  private handleWaveRemoveBatch(
    client: Client,
    payload: WaveRemoveBatchIntent,
  ): void {
    const guard = this.canStage(client);
    if (guard) return void this.rejectWave(client, guard);

    const wave = this.stagedWaves.get(client.sessionId)?.get(payload.pathId);
    if (!wave) return void this.rejectWave(client, "Nothing is staged on that path.");

    const before = wave.batches.length;
    wave.batches = wave.batches.filter((b) => b.batchId !== payload.batchId);
    if (wave.batches.length === before) {
      return void this.rejectWave(client, "That batch is no longer staged.");
    }

    this.stageOutcome(client, null);
  }

  /** Moves a staged batch to a new position (drag reorder in the UI). */
  private handleWaveReorder(client: Client, payload: WaveReorderIntent): void {
    const guard = this.canStage(client);
    if (guard) return void this.rejectWave(client, guard);

    const wave = this.stagedWaves.get(client.sessionId)?.get(payload.pathId);
    if (!wave) return void this.rejectWave(client, "Nothing is staged on that path.");

    const from = wave.batches.findIndex((b) => b.batchId === payload.batchId);
    if (from === -1) return void this.rejectWave(client, "That batch is no longer staged.");

    const to = Math.max(0, Math.min(wave.batches.length - 1, Math.floor(payload.toIndex)));
    const [moved] = wave.batches.splice(from, 1);
    wave.batches.splice(to, 0, moved);

    this.stageOutcome(client, null);
  }

  /** Switches a path's wave between big and small, re-checking its contents. */
  private handleWaveSetSize(client: Client, payload: WaveSetSizeIntent): void {
    const guard = this.canStage(client);
    if (guard) return void this.rejectWave(client, guard);

    if (payload.size !== "big" && payload.size !== "small") {
      return void this.rejectWave(client, "Unknown wave size.");
    }

    const sessionId = client.sessionId;
    if (!this.pathIdIsValid(payload.pathId)) {
      return void this.rejectWave(client, "No such path on this map.");
    }

    const wave = this.ensureStagedWave(sessionId, payload.pathId);
    if (wave.batches.length > 0) {
      // Downgrading a big wave must keep its contents legal for the new size.
      const deck = this.acceptedDecks.get(sessionId) ?? [];
      const error = validateWave({ ...wave, size: payload.size }, deck);
      if (error) return void this.rejectWave(client, error);
    }

    wave.size = payload.size;
    this.stageOutcome(client, null);
  }

  /** Drops every staged batch on one path. */
  private handleWaveClear(client: Client, payload: WaveClearIntent): void {
    const guard = this.canStage(client);
    if (guard) return void this.rejectWave(client, guard);

    const staged = this.stagedWaves.get(client.sessionId);
    if (!staged || !staged.has(payload.pathId)) {
      return void this.rejectWave(client, "Nothing is staged on that path.");
    }

    staged.delete(payload.pathId);
    this.stageOutcome(client, null);
  }

  /**
   * Releases staged waves: validates cost and budget, deducts gold, then queues
   * every batch to spawn in sequence.
   *
   * @remarks Batches launch `batchIntervalSec` apart in path order, so waves
   * staged on several paths come out one after another rather than as one blob.
   */
  /**
   * Core logic to release staged waves for an attacker client.
   * Returns true if waves were successfully scheduled, or an error message if failed.
   */
  private executeWaveRelease(
    client: Client,
    pathIds?: string[],
  ): { success: boolean; error?: string } {
    const sessionId = client.sessionId;
    const staged = this.stagedWaves.get(sessionId);
    const deck = this.acceptedDecks.get(sessionId) ?? [];
    const allowedDeck =
      deck.length > 0 ? deck : DEFAULT_ATTACKER_DECK;

    const requested =
      pathIds && pathIds.length > 0
        ? pathIds
        : [...(staged?.keys() ?? [])];

    if (requested.length === 0) {
      return { success: false, error: "Nothing staged to send." };
    }

    const toRelease: StagedWave[] = [];
    for (const pathId of requested) {
      if (!this.pathIdIsValid(pathId)) {
        return { success: false, error: `No such path: ${pathId}.` };
      }
      const wave = staged?.get(pathId);
      if (!wave || wave.batches.length === 0) {
        continue;
      }
      const error = validateWave(wave, allowedDeck);
      if (error) return { success: false, error };
      toRelease.push(wave);
    }

    if (toRelease.length === 0) {
      return { success: false, error: "No army staged on requested paths." };
    }

    const totalCost = toRelease.reduce(
      (total, wave) => total + waveGoldCost(wave.batches, wave.size),
      0,
    );
    const gold = this.economies.get(sessionId) ?? 0;
    if (gold < totalCost) {
      return { success: false, error: "Not enough gold." };
    }

    const bigWaves = toRelease.filter((wave) => wave.size === "big").length;
    const budget = this.bigWavesRemaining.get(sessionId) ?? 0;
    if (bigWaves > budget) {
      return {
        success: false,
        error: `Only ${budget} big wave(s) left this match.`,
      };
    }

    // Commit: charge gold, spend big-wave budget, then schedule the spawns.
    this.economies.set(sessionId, gold - totalCost);
    this.bigWavesRemaining.set(sessionId, budget - bigWaves);

    // Boost attacker passive income based on units' cost
    const unitCostTotal = toRelease.reduce(
      (total, wave) =>
        total +
        wave.batches.reduce(
          (bTotal, b) => bTotal + (MOB_TYPES[b.typeId]?.cost ?? 0) * b.count,
          0,
        ),
      0,
    );
    const incomeBoost = unitCostTotal * DEFAULT_ECONOMY.attackerIncomeGainRate;
    if (incomeBoost > 0) {
      const currentRate =
        this.incomeRates.get(sessionId) ?? DEFAULT_ECONOMY.attackerBaseIncome;
      this.incomeRates.set(sessionId, currentRate + incomeBoost);
      console.log(
        `Room ${this.roomId}: attacker income boosted by +${incomeBoost.toFixed(1)}g/s to ${(currentRate + incomeBoost).toFixed(1)}g/s`,
      );
    }

    const interval = DEFAULT_WAVE_RULES.batchIntervalSec;
    let offset = 0;
    for (const wave of toRelease) {
      for (const batch of wave.batches) {
        this.releaseQueue.push({
          atMatchTime: this.matchTime + offset * interval,
          pathId: wave.pathId,
          typeId: batch.typeId,
          count: batch.count,
        });
        offset++;
      }
      staged?.delete(wave.pathId);
    }

    console.log(
      `Room ${this.roomId}: attacker releasing ${toRelease.length} path wave(s) (-${totalCost}g)`,
    );

    this.sendEconomy(client);
    this.sendAttackerArmy(client);
    return { success: true };
  }

  /**
   * Releases staged waves: validates cost and budget, deducts gold, then queues
   * every batch to spawn in sequence.
   */
  private handleWaveRelease(client: Client, payload: WaveReleaseIntent): void {
    if (client.userData?.role !== "attacker") {
      return void this.rejectWave(client, "Only the attacker can release a wave.");
    }
    if (this.state.phase !== "combat") {
      return void this.rejectWave(client, "Waves can only be released during combat.");
    }

    const outcome = this.executeWaveRelease(client, payload?.pathIds);
    if (!outcome.success && outcome.error) {
      return void this.rejectWave(client, outcome.error);
    }
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

    const payload: GameOverPayload = { winner, reason: "surrender" };
    for (const c of this.clients) {
      c.send(MESSAGES.gameOver, payload);
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
    client.userData = {
      playerName: options.playerName || "Anonymous",
      role: null,
    };

    if (!this.creatorSessionId) {
      this.creatorSessionId = client.sessionId;
    }

    this.state.players.set(
      client.sessionId,
      new Player({
        name: client.userData.playerName,
        role: "",
      }),
    );

    console.log(
      `Player ${client.sessionId} (${client.userData.playerName}) joined room ${this.roomId}`,
    );

    if (this.clients.length === 2) {
      this.assignRoles();
      await this.lock();
      this.phases.beginDraft();
      this.markPlaying();

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
    // Re-seed the attacker's private wave panel (no-op for the defender).
    this.sendAttackerArmy(client);

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

    const payload: GameOverPayload = { winner, reason: "disconnect" };
    for (const c of this.clients) {
      c.send(MESSAGES.gameOver, payload);
    }
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
    this.stagedWaves.delete(client.sessionId);
    this.bigWavesRemaining.delete(client.sessionId);

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
      this.clearMobs();
      this.clearProjectiles();
      this.resetWaveRuntime();
      this.state.coreHp = MATCH_RULES.coreHp;

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
      this.bigWavesRemaining.set(
        host.sessionId,
        (hostRole ?? "defender") === "attacker" ? DEFAULT_ECONOMY.bigWaveCount : 0,
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

    if (event?.type === "round-expired") {
      this.onRoundExpired();
    }

    const phase = this.state.phase;

    if (phase === "combat" && this.lastPhase !== "combat") {
      this.beginCombatSim();
    }

    if (phase === "combat") {
      this.matchTime += dt;
      this.accrueIncome(dt);
      this.drainReleaseQueue();
      this.simulateMobs(dt);

      // A breach may have ended the match; skip combat so no shots fire after.
      if (this.state.phase === "combat") this.simulateCombat(dt);

      if (this.state.phase === "combat") {
        this.pushIncomeIfDue(dt);

        // Once the income window closed, a silent field with an empty schedule
        // means the attacker has nothing left: the defender outlasted them.
        if (this.incomeExpired) this.checkAttackerExhausted();
      }
    } else if (this.lastPhase === "combat") {
      this.clearMobs();
      this.clearProjectiles();
      this.releaseQueue = [];
    }

    this.lastPhase = phase;
  }

  /**
   * Resets per-match income state the moment combat begins.
   */
  private beginCombatSim(): void {
    this.incomeExpired = false;
    this.incomePushAccumulator = 0;

    for (const client of this.clients) {
      this.sendPlayerState(client);
    }
  }

  /**
   * Reacts to the round timer hitting zero: attacker passive income stops, but
   * the match itself carries on until someone is out.
   *
   * @remarks Any army still staged is flushed here (see {@link flushStagedArmy})
   * so a player cannot park an unaffordable wave and stall the match forever.
   */
  private onRoundExpired(): void {
    if (this.incomeExpired) return;
    this.incomeExpired = true;

    for (const client of this.clients) {
      if (client.userData?.role === "attacker") {
        this.flushStagedArmy(client);
      }
      this.sendEconomy(client);
      this.sendAttackerArmy(client);
    }

    console.log(`Room ${this.roomId}: income window closed`);
  }

  /**
   * Releases whatever the attacker still has staged when their income stops.
   *
   * @remarks Staging never charges gold — only a send does — so a player could
   * stage an army they can never afford and leave it parked, which keeps
   * {@link hasStagedArmy} `true` and stalls the match. To resolve that without
   * handing out a free army, batches are discarded newest-first until the
   * remaining army fits the attacker's current gold, then the survivors are
   * released through {@link executeWaveRelease} (so gold, big-wave budget and
   * the income boost all match a normal send). Big waves beyond the leftover
   * budget are dropped whole before that.
   */
  private flushStagedArmy(client: Client): void {
    const sessionId = client.sessionId;
    const staged = this.stagedWaves.get(sessionId);
    if (!staged || staged.size === 0) return;

    // Big waves are gated by a match budget that staging never checked, so any
    // wave past the leftover budget can never legally release: drop it whole.
    const budget = this.bigWavesRemaining.get(sessionId) ?? 0;
    let bigKept = 0;
    for (const pathId of [...staged.keys()].reverse()) {
      const wave = staged.get(pathId);
      if (!wave || wave.size !== "big" || wave.batches.length === 0) continue;
      if (bigKept >= budget) {
        wave.batches = [];
      } else {
        bigKept++;
      }
    }

    // Discard newest batches across paths until the army fits the gold on hand.
    const gold = this.economies.get(sessionId) ?? 0;
    let dropped = 0;
    for (const pathId of [...staged.keys()].reverse()) {
      const wave = staged.get(pathId);
      if (!wave) continue;
      while (wave.batches.length > 0 && this.stagedTotalCost(staged) > gold) {
        wave.batches.pop();
        dropped++;
      }
    }

    for (const [pathId, wave] of [...staged.entries()]) {
      if (wave.batches.length === 0) staged.delete(pathId);
    }

    const pathIds = [...staged.keys()];
    if (pathIds.length === 0) {
      console.log(
        `Room ${this.roomId}: flushed ${dropped} staged batch(es); nothing affordable to send`,
      );
      return;
    }

    const outcome = this.executeWaveRelease(client, pathIds);
    if (!outcome.success) {
      // Should not happen once affordability/budget are settled, but never let a
      // stuck staged army soft-lock the match: drop it and let exhaustion fire.
      console.warn(
        `Room ${this.roomId}: staged flush release failed (${outcome.error}); discarding staged army`,
      );
      staged.clear();
    } else {
      console.log(
        `Room ${this.roomId}: flushed staged army on ${pathIds.join(", ")} (-${dropped} batch(es))`,
      );
    }
  }

  /** Total gold to send every non-empty staged wave for one attacker. */
  private stagedTotalCost(staged: Map<string, StagedWave>): number {
    let total = 0;
    for (const wave of staged.values()) {
      if (wave.batches.length > 0) {
        total += waveGoldCost(wave.batches, wave.size);
      }
    }
    return total;
  }

  /**
   * Ends the match once the income window has closed and the attacker has
   * neither units on the field, queued to spawn, nor staged to send.
   */
  private checkAttackerExhausted(): void {
    if (this.state.phase !== "combat") return;
    if (this.state.mobs.size > 0 || this.releaseQueue.length > 0) return;
    if (this.hasStagedArmy()) return;

    if (!this.phases.declareGameOver("defender", "time")) return;

    console.log(`Room ${this.roomId}: attacker exhausted; defender wins`);

    const payload: GameOverPayload = { winner: "defender", reason: "time" };
    for (const client of this.clients) {
      client.send(MESSAGES.gameOver, payload);
    }
  }

  /** Whether any path still holds an unsent, non-empty wave. */
  private hasStagedArmy(): boolean {
    for (const paths of this.stagedWaves.values()) {
      for (const wave of paths.values()) {
        if (wave.batches.length > 0) return true;
      }
    }
    return false;
  }

  /**
   * Credits the attacker their passive income while the round timer runs.
   *
   * @remarks Attacker-only: the defender is funded by tower bounties. The gold
   * is accumulated as a float and floored on push so the HUD shows whole numbers.
   */
  private accrueIncome(dt: number): void {
    for (const client of this.clients) {
      const sessionId = client.sessionId;
      const role = client.userData?.role as PlayerRole | undefined;

      if (role === "attacker") {
        if (!this.incomeExpired) {
          const rate =
            this.incomeRates.get(sessionId) ?? DEFAULT_ECONOMY.attackerBaseIncome;
          this.economies.set(
            sessionId,
            (this.economies.get(sessionId) ?? 0) + rate * dt,
          );
        }
      } else if (role === "defender") {
        const rate =
          this.incomeRates.get(sessionId) ?? DEFAULT_ECONOMY.defenderBaseIncome;
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

    const batchId = this.state.waveIndex + 1;
    const spawned = this.spawnMobsOnPath(
      path,
      scheduled.pathId,
      type,
      scheduled.count,
      batchId,
    );
    this.state.waveIndex = batchId;

    if (spawned > 0) {
    console.log(
        `Room ${this.roomId}: released batch ${batchId} (${scheduled.count}x ${type.id} on ${scheduled.pathId})`,
      );
    }
  }

  /** Clears all transient wave state for a fresh match. */
  private resetWaveRuntime(): void {
    this.stagedWaves.clear();
    this.releaseQueue = [];
    this.matchTime = 0;
    this.incomeExpired = false;
    this.incomePushAccumulator = 0;
    this.batchSeq = 0;
    this.state.waveIndex = 0;
    this.projectileAim.clear();
    this.projectileSplash.clear();
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
    for (let i = 0; i < count; i++) {
      const seed = (Math.random() * 0xffffffff) >>> 0;
      const jitter = 1 + (Math.random() * 2 - 1) * MOB_SPEED_JITTER;
      const id = `mob-${batchId}-${pathId}-${i}`;

      this.state.mobs.set(
        id,
        new Mob({
          ownerId: "",
          typeId: type.id,
          batchId,
          progress: 0,
          hp: type.maxHp,
          maxHp: type.maxHp,
          speed: type.speed * jitter,
          bounty: type.bounty,
          checkpoint: 0,
          state: "moving",
          seed,
          pathId,
        }),
      );
    }

    return count;
  }

  /** Advances every mob along its path; breaches damage the defender's core. */
  private simulateMobs(dt: number): void {
    if (this.state.mobs.size === 0) return;

    const map = MAPS[this.state.mapId] ?? SAMPLE_MAP;
    const finished: string[] = [];

    for (const [id, mob] of this.state.mobs) {
      const path = this.pathFor(map, mob.pathId);
      const total = path ? pathLength(path) : 0;

      if (!path || total <= 0) {
        finished.push(id);
        continue;
      }

      mob.progress += (mob.speed / total) * dt;

      if (mob.progress >= 1) {
        const mobType = MOB_TYPES[mob.typeId];
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

    const payload: GameOverPayload = { winner: "attacker", reason: "core" };
    for (const client of this.clients) {
      client.send(MESSAGES.gameOver, payload);
    }
  }

  /** Resolves a mob's `pathId` against the map's tracks. */
  private pathFor(map: MapDefinition, pathId: string): Vec2[] | undefined {
    return mapPath(map, pathId);
  }

  private clearMobs(): void {
    if (this.state.mobs.size > 0) this.state.mobs.clear();
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
      candidates.push({ id, x: point.x, y: point.y, remaining });
    }

    this.simulateTowers(dt, map, candidates);
    this.simulateProjectiles(dt, positions);
  }

  /** Fires each ready tower at the in-range mob nearest the base. */
  private simulateTowers(
    dt: number,
    map: MapDefinition,
    candidates: readonly TargetCandidate[],
  ): void {
    for (const tower of this.state.towers.values()) {
      const type = TOWER_TYPES[tower.typeId];
      const tier = type ? tierAt(type, tower.level) : null;
      const slot = map.slots.find((s) => s.slotIndex === tower.slotIndex);
      if (!tier || !slot) continue;

      // Clamp so a long idle period never stockpiles "negative" cooldown.
      tower.cooldown = Math.max(0, tower.cooldown - dt);

      const target = selectTarget(candidates, slot, tier.range);
      tower.targetId = target?.id;

      if (!target || tower.cooldown > 0) continue;

      tower.cooldown = 1 / tier.fireRate;
      this.spawnProjectile(tower, slot, target, tier);
    }
  }

  /** Spawns a homing projectile from a tower's slot toward `target`. */
  private spawnProjectile(
    tower: Tower,
    slot: Vec2,
    target: TargetCandidate,
    tier: TowerTier,
  ): void {
    const id = `proj-${this.projectileSeq++}`;

    this.state.projectiles.set(
      id,
      new Projectile({
        ownerId: tower.ownerId,
        typeId: tower.typeId,
        x: slot.x,
        y: slot.y,
        targetId: target.id,
        damage: tier.damage,
        speed: tier.projectileSpeed,
      }),
    );

    // Remember where the shot is headed and how wide it bursts, so it can still
    // land (and artillery can still splash) after its target dies.
    this.projectileAim.set(id, { x: target.x, y: target.y });
    this.projectileSplash.set(id, TOWER_TYPES[tower.typeId]?.splashRadius ?? 0);
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

    for (const mobId of hit) {
      this.damageMob(mobId, projectile.damage, ownerId);
    }
  }

  /** Applies projectile damage and, on a kill, pays the defender the bounty. */
  private damageMob(mobId: string, damage: number, ownerId: string): void {
    const mob = this.state.mobs.get(mobId);
    if (!mob) return;

    mob.hp -= damage;
    if (mob.hp > 0) return;

    this.state.mobs.delete(mobId);
    this.awardBounty(ownerId, mob.bounty);
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
  }
}

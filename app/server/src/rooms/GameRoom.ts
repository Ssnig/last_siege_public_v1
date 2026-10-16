
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
  MATCH_RULES,
  MOB_SPEED_JITTER,
  PROJECTILE_HIT_RADIUS,
  pathLength,
  samplePathWithLateral,
  tierAt,
  type DraftReadyIntent,
  type GameOverPayload,
  type MapDefinition,
  type MobType,
  type PlaceTowerIntent,
  type SellTowerIntent,
  type TowerTier,
  type Vec2,
  type YouEconomyPayload,
  buildCost,
  sellRefund,
} from "@root/shared";
import { Phases } from "../game/phases.js";
import { selectTarget, type TargetCandidate } from "../game/targeting.js";

export type RoleChoice = "attacker" | "defender" | "random";
export type PlayerRole = "attacker" | "defender";

export interface GameRoomMetadata {
  creatorName: string;
  roleChoice: RoleChoice;
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
   * Validated draft IDs keyed by session ID.
   * Kept outside RoomState so one player cannot inspect the opponent's deck.
   */
  private acceptedDecks = new Map<string, string[]>();

  /**
   * Hidden gold per session ID. Mirrors `acceptedDecks`: kept off `RoomState`
   * and pushed to the owner via private `you_economy` messages only.
   */
  private economies = new Map<string, number>();

  /** Authoritative phase + timer state machine. */
  private phases!: Phases;

  /** Previous tick's phase, used to detect the exact tick combat begins. */
  private lastPhase = "";

  /** Monotonic source of projectile ids, unique for the room's whole lifetime. */
  private projectileSeq = 0;

  plugins = definePlugins({
    idle: new IdleKickPlugin({ timeoutMs: 60_000 }),
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

    [MESSAGES.startCombat]: (client: Client) => this.handleStartCombat(client),
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
    const economy: YouEconomyPayload = {
      gold: this.economies.get(client.sessionId) ?? 0,
      deck: this.acceptedDecks.get(client.sessionId) ?? [],
      bigWavesRemaining: role === "attacker" ? DEFAULT_ECONOMY.bigWaveCount : 0,
    };
    client.send(MESSAGES.youEconomy, economy);
  }

  /**
   * Sends role details after both clients have registered their message handlers.
   */
  private handleReady(client: Client): void {
    this.readyClients.add(client.sessionId);

    if (this.matchStarted || this.readyClients.size < 2) return;
    this.matchStarted = true;

    for (const c of this.clients) {
      const opponent = this.clients.find(
        (other) => other.sessionId !== c.sessionId,
      );

      c.send(MESSAGES.roleAssigned, {
        myName: c.userData.playerName,
        myRole: c.userData.role,
        opponentName: opponent?.userData.playerName,
        opponentRole: opponent?.userData.role,
      });
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
        this.sendEconomy(c);
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
    if (!deck || !deck.includes(payload.typeId)) {
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
   * Handles manual start of combat phase.
   *
   * @remarks
   * Allows either player (attacker or defender) to start combat instead of waiting for timer.
   */
  private handleStartCombat(client: Client): void {
    if (this.state.phase !== "building") return;

    if (!this.phases.beginCombat([])) {
      console.log("Failed to start combat");
      return;
    }

    console.log(`Room ${this.roomId}: building -> combat (manual start by ${client.sessionId})`);
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

    if (!this.phases.declareGameOver(winner)) return;

    console.log(
      `Room ${this.roomId}: ${client.sessionId} (${loser}) surrendered; ${winner} wins`,
    );

    const payload: GameOverPayload = { winner, reason: "surrender" };
    for (const c of this.clients) {
      c.send(MESSAGES.gameOver, payload);
    }
  }

  onCreate(options: any): void {
    this.setMetadata({
      creatorName: options.playerName || "Anonymous",
      roleChoice: options.roleChoice || "random",
    });

    this.state.mapId = options.mapId || "konbaung";
    this.state.phase = "drafting";
    this.state.coreHp = MATCH_RULES.coreHp;

    this.phases = new Phases({ state: this.state });
    this.lastPhase = this.state.phase;

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

      // Seed each client with its private economy so the HUD is correct even
      // before the draft is confirmed (deck arrives in a later push).
      for (const c of this.clients) {
        this.sendEconomy(c);
      }
    }
  }

  /** Allows a dropped client to reconnect for up to 60 seconds. */
  onDrop(client: Client, code: CloseCode): void {
    this.allowReconnection(client, 60).catch(() => {});
  }

  onReconnect(client: Client): void {
    console.log(`Client ${client.sessionId} reconnected!`);
    this.sendEconomy(client);
  }

  /**
   * Removes a departed player and resets the remaining player's match draft
   * when the room reopens for a replacement opponent.
   */
  onLeave(client: Client, code: CloseCode): void {
    console.log(`Client ${client.sessionId} left! Code: ${code}`);

    this.state.players.delete(client.sessionId);
    this.acceptedDecks.delete(client.sessionId);
    this.economies.delete(client.sessionId);

    const wasCreator = client.sessionId === this.creatorSessionId;

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
      this.state.coreHp = MATCH_RULES.coreHp;

      for (const player of this.state.players.values()) {
        player.draftReady = false;
      }

      this.phases.reset();

      const hostRole = host.userData?.role as PlayerRole | undefined;
      this.economies.set(host.sessionId, this.startingGold(hostRole ?? "defender"));
      this.sendEconomy(host);

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

    const phase = this.state.phase;

    if (phase === "combat" && this.lastPhase !== "combat") {
      this.spawnTestWave();
    }

    if (phase === "combat") {
      this.simulateMobs(dt);
      // A breach may have ended the match; skip combat so no shots fire after.
      if (this.state.phase === "combat") this.simulateCombat(dt);
    } else if (this.lastPhase === "combat") {
      this.clearMobs();
      this.clearProjectiles();
    }

    this.lastPhase = phase;
  }

  /**
   * Spawns the placeholder combat wave used to validate mob movement.
   *
   * @remarks Temporary stand-in for the real attacker wave economy. It splits
   * evenly across the map's named paths (so both tracks can be eyeballed) and
   * falls back to the single `path` for maps without `paths`.
   */
  private spawnTestWave(): void {
    const map = MAPS[this.state.mapId] ?? SAMPLE_MAP;
    const type = MOB_TYPES["grunt"];
    if (!type) return;

    const batchId = this.state.waveIndex + 1;
    const perPath = 4;

    let spawned = 0;
    const top = map.paths?.top;
    const bottom = map.paths?.bottom;

    if (top && top.length >= 2) {
      spawned += this.spawnMobsOnPath(top, "top", type, perPath, batchId);
    }
    if (bottom && bottom.length >= 2) {
      spawned += this.spawnMobsOnPath(bottom, "bottom", type, perPath, batchId);
    }
    if (spawned === 0 && map.path.length >= 2) {
      spawned += this.spawnMobsOnPath(map.path, "main", type, perPath * 2, batchId);
    }

    this.state.waveIndex = batchId;
    console.log(
      `Room ${this.roomId}: spawned test wave ${batchId} (${spawned} mobs, type ${type.id})`,
    );
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
        this.leakToCore(MOB_TYPES[mob.typeId]?.leakDamage ?? 0);
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

    if (!this.phases.declareGameOver("attacker")) return;

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
    if (pathId === "top") return map.paths?.top;
    if (pathId === "bottom") return map.paths?.bottom;
    return map.path;
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
      candidates.push({ id, x: point.x, y: point.y, progress: mob.progress });
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
  }

  /** Homes every projectile toward its target and resolves hits. */
  private simulateProjectiles(
    dt: number,
    positions: ReadonlyMap<string, Vec2>,
  ): void {
    if (this.state.projectiles.size === 0) return;

    const finished: string[] = [];

    for (const [id, projectile] of this.state.projectiles) {
      const target = positions.get(projectile.targetId);
      const ownerId = projectile.ownerId;

      // Target died or left the field before the shot landed; drop it.
      if (!target) {
        finished.push(id);
        continue;
      }

      const dx = target.x - projectile.x;
      const dy = target.y - projectile.y;
      const distance = Math.hypot(dx, dy);
      const step = projectile.speed * dt;

      if (distance <= step + PROJECTILE_HIT_RADIUS) {
        this.damageMob(projectile.targetId, projectile.damage, ownerId);
        finished.push(id);
        continue;
      }

      projectile.x += (dx / distance) * step;
      projectile.y += (dy / distance) * step;
    }

    for (const id of finished) {
      this.state.projectiles.delete(id);
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
  }
}

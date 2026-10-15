
import { Room, Client, CloseCode, definePlugins } from "colyseus";
import { IdleKickPlugin } from "colyseus/plugins/idle-kick";
import {
  RoomState,
  Player,
  MESSAGES,
  MOB_TYPES,
  TOWER_TYPES,
  DEFAULT_DECK_RULES,
  type DraftReadyIntent,
  type GameOverPayload,
  type PlaceTowerIntent,
  type YouEconomyPayload,
  type StartCombatIntent,
  buildCost,
} from "@root/shared";
import { Phases } from "../game/phases.js";

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

  /** Authoritative phase + timer state machine. */
  private phases!: Phases;

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

    [MESSAGES.startCombat]: (
      client: Client,
      payload: StartCombatIntent,
    ) => this.handleStartCombat(client),
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

    console.log(
      `Roles assigned: Creator = ${creatorRole}, Joiner = ${joinerRole}`,
    );
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
      this.state.phase = "building";
      console.log(`Room ${this.roomId}: drafting -> building`);

      // Send defender's deck to the defender player
      for (const c of this.clients) {
        const role = c.userData?.role as PlayerRole | undefined;
        if (role === "defender") {
          const deck = this.acceptedDecks.get(c.sessionId);
          if (deck) {
            const economy: YouEconomyPayload = {
              gold: 200, // Starting gold for defender
              deck,
              bigWavesRemaining: 0, // Defender doesn't have waves
            };
            c.send(MESSAGES.youEconomy, economy);
          }
        }
      }
    }
  }

  /** Sends a private explanation for a rejected draft submission. */
  private rejectDraft(client: Client, reason: string): void {
    client.send(MESSAGES.draftRejected, { reason });
  }

  /**
   * Handles tower placement during the building phase.
   *
   * @remarks
   * Only the defender can place towers. The tower type must be in their deck
   * and they must have enough gold.
   */
  private handlePlaceTower(client: Client, payload: PlaceTowerIntent): void {
    if (this.state.phase !== "building" && this.state.phase !== "combat") return;

    const role = client.userData?.role as PlayerRole | undefined;
    if (role !== "defender") {
      console.log(`Only defender can place towers. Client role: ${role}`);
      return;
    }

    const deck = this.acceptedDecks.get(client.sessionId);
    if (!deck || !deck.includes(payload.typeId)) {
      console.log(`Tower ${payload.typeId} not in defender's deck`);
      return;
    }

    // Check if slot is already occupied
    const slotOccupied = Array.from(this.state.towers.values()).some(
      t => t.slotIndex === payload.slotIndex
    );
    if (slotOccupied) {
      console.log(`Slot ${payload.slotIndex} is already occupied`);
      return;
    }

    // Check gold (for now, use a simple counter - full economy system later)
    const towerType = TOWER_TYPES[payload.typeId];
    if (!towerType) return;

    const cost = buildCost(towerType);
    // For now, just place the tower without gold deduction
    // Full economy system will be implemented separately

    // Create tower in state
    const towerId = `${client.sessionId}-${payload.slotIndex}`;
    this.state.towers.set(towerId, {
      ownerId: client.sessionId,
      typeId: payload.typeId,
      slotIndex: payload.slotIndex,
      level: 1,
      cooldown: 0,
    });

    console.log(`Defender placed tower ${payload.typeId} at slot ${payload.slotIndex}`);
  }

  /**
   * Handles manual start of combat phase.
   *
   * @remarks
   * Allows the defender to manually start combat instead of waiting for timer.
   */
  private handleStartCombat(client: Client, payload: StartCombatIntent): void {
    if (this.state.phase !== "building") return;

    const role = client.userData?.role as PlayerRole | undefined;
    if (role !== "defender") {
      console.log(`Only defender can start combat. Client role: ${role}`);
      return;
    }

    if (!this.phases.beginCombat([])) {
      console.log("Failed to start combat");
      return;
    }

    console.log(`Room ${this.roomId}: building -> combat (manual start)`);
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

    this.state.mapId = options.mapId || "sample";
    this.state.phase = "drafting";

    this.phases = new Phases({ state: this.state });

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
    }
  }

  /** Allows a dropped client to reconnect for up to 60 seconds. */
  onDrop(client: Client, code: CloseCode): void {
    this.allowReconnection(client, 60).catch(() => {});
  }

  onReconnect(client: Client): void {
    console.log(`Client ${client.sessionId} reconnected!`);
  }

  /**
   * Removes a departed player and resets the remaining player's match draft
   * when the room reopens for a replacement opponent.
   */
  onLeave(client: Client, code: CloseCode): void {
    console.log(`Client ${client.sessionId} left! Code: ${code}`);

    this.state.players.delete(client.sessionId);
    this.acceptedDecks.delete(client.sessionId);

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

      for (const player of this.state.players.values()) {
        player.draftReady = false;
      }

      this.phases.reset();

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

  /** Server tick: drives the phase/timer machine; no gameplay simulation yet. */
  update(dt: number): void {
    const event = this.phases.update(dt);

    if (event?.type === "building-started" && event.autoCompleted.length > 0) {
      this.autoFillDecks(event.autoCompleted);
    }

    if (event?.type === "combat-started") {
      console.log(`Room ${this.roomId}: combat started`);
    }
  }
}

import { Room, Client, CloseCode, definePlugins } from "colyseus";
import { RoomState, Player, MESSAGES, MATCH_PHASES } from "@root/shared";
import { IdleKickPlugin } from "colyseus/plugins/idle-kick";
import { Phases } from "../game/phases.js";


export type RoleChoice = "attacker" | "defender" | "random";
export type PlayerRole = "attacker" | "defender";

export interface GameRoomMetadata {
  creatorName: string;
  roleChoice: RoleChoice;
}

/**
 * 1v1 tower-defense match room. Roles are only decided once both seats fill.
 *
 * @remarks
 * - `maxClients = 2`; the room locks on the second join, so late joiners bounce.
 * - `IdleKickPlugin` drops clients idle for 60s.
 * - `update()` is driven by `setTimestep`, not a manual interval.
 */
export class GameRoom extends Room<{ state: RoomState }> {
  // Enforce 1v1 matches
  maxClients = 2;
  state = new RoomState();

  private creatorSessionId?: string;
  // Role payload is only sent once both HUDs are listening (see handleReady)
  private readyClients = new Set<string>();
  // Both players must click "Enter Game" before the draft starts (see handleEnterGame)
  private enterClients = new Set<string>();
  private matchStarted = false;
  private phases!: Phases;

  plugins = definePlugins({
    idle: new IdleKickPlugin({ timeoutMs: 60_000 }),
  });

  messages = {
    // Client signals its HUD is listening; roles go out only when both did.
    [MESSAGES.ready]: (client: Client) => this.handleReady(client),
    // Both clients clicked "Enter Game": roles were already handed out, so
    // this only transitions the phase from waiting to a fresh draft.
    [MESSAGES.enterGame]: (client: Client) => this.handleEnterGame(client),
  };

  /**
   * Resolves the host's `roleChoice` into concrete roles and stores them on each
   * client. Assignment only — notification is deferred until both players are
   * `ready` (see {@link handleReady}) so no client misses the one-shot message.
   *
   * @remarks
   * `"attacker"`/`"defender"` force the host's role; `"random"` coin-flips.
   */
  private assignRoles() {
    const creatorClient = this.clients[0];
    const joinerClient = this.clients[1];

    // Reopened room after a leave: the surviving host keeps the role they
    // already hold and the fresh joiner takes the opposite. The stale
    // `roleChoice` metadata is only trusted for the very first assignment.
    let creatorRole = creatorClient.userData?.role as PlayerRole | undefined;
    if (!creatorRole) {
      const metadata = this.metadata as GameRoomMetadata;
      const choice = metadata?.roleChoice || "random";

      if (choice === "attacker") {
        creatorRole = "attacker";
      } else if (choice === "defender") {
        creatorRole = "defender";
      } else {
        // "random" (or an unknown value): coin-flip the host's role
        creatorRole = Math.random() < 0.5 ? "attacker" : "defender";
      }
    }
    const joinerRole: PlayerRole = creatorRole === "attacker" ? "defender" : "attacker";

    // Preserve playerName set on join, attach the resolved role
    creatorClient.userData = { ...creatorClient.userData, role: creatorRole };
    joinerClient.userData = { ...joinerClient.userData, role: joinerRole };

    // Keep the synced state in step with the authoritative userData roles
    const creatorState = this.state.players.get(creatorClient.sessionId);
    const joinerState = this.state.players.get(joinerClient.sessionId);
    if (creatorState) creatorState.role = creatorRole;
    if (joinerState) joinerState.role = joinerRole;

    console.log(`Roles assigned: Creator = ${creatorRole}, Joiner = ${joinerRole}`);
  }

  /**
   * Tracks HUD readiness and, once both players are in, sends each the full
   * `{ myName, myRole, opponentName, opponentRole }` payload.
   *
   * @remarks
   * A `client.send` inside `onJoin` is flushed *before* the `JOIN_ROOM`
   * handshake, so a client that registers `onMessage` after joining would drop
   * it. Waiting for both `ready` signals guarantees the handlers exist first.
   * Roles here are *notified only* — the phase stays `waiting` until both
   * players send {@link MESSAGES.enterGame}.
   */
  private handleReady(client: Client) {
    this.readyClients.add(client.sessionId);
    if (this.matchStarted || this.readyClients.size < 2) return;
    this.matchStarted = true;

    for (const c of this.clients) {
      const opponent = this.clients.find((o) => o.sessionId !== c.sessionId);
      c.send(MESSAGES.roleAssigned, {
        myName: c.userData.playerName,
        myRole: c.userData.role,
        opponentName: opponent?.userData.playerName,
        opponentRole: opponent?.userData.role,
      });
    }
  }

  /**
   * Both players clicked "Enter Game" after seeing their roles — starts the
   * draft with a full, fresh timer via `Phases.beginDraft()`.
   *
   * @remarks
   * Gated on `matchStarted` so an enter click can't fire before the role
   * handshake (`ready`) had a chance to run. `Phases` enforces the rest
   * (2 players present, phase still `waiting`).
   */
  private handleEnterGame(client: Client) {
    if (!this.matchStarted) return;
    this.enterClients.add(client.sessionId);
    if (this.enterClients.size >= 2) {
      this.phases.beginDraft();
    }
  }

  // Room LifeCycle Events

  onCreate(options: any) {
    // 1. Set initial metadata so the LobbyRoom can display host info immediately
    this.setMetadata({
      creatorName: options.playerName || "Anonymous",
      roleChoice: options.roleChoice || "random",
    });

    // 2. Seed the synced match state
    this.state.mapId = options.mapId || "sample";
    this.state.phase = MATCH_PHASES.waiting;

    // 3. Phase state machine drives draft/combat/gameover timers
    this.phases = new Phases({ state: this.state });

    // 4. Server-side tick loop
    this.setTimestep((deltaTime) => this.update(deltaTime / 1000));
  }

  async onJoin(client: Client, options: any) {
    // Store player name in client userData
    client.userData = {
      playerName: options.playerName || "Anonymous",
      role: null
    };

    if (!this.creatorSessionId) {
      this.creatorSessionId = client.sessionId;
    }

    // Mirror the player into synced state; roles are filled in once both seats are taken.
    this.state.players.set(
      client.sessionId,
      new Player({ name: client.userData.playerName, role: "" })
    );

    console.log(`Player ${client.sessionId} (${client.userData.playerName}) joined room ${this.roomId}`);

    if (this.clients.length === 2) {
      this.assignRoles();
      await this.lock();
    }
  }

  /**
   * Holds a dropped player's seat for 60s so flaky/mobile clients can reconnect.
   *
   * @remarks
   * Returning without calling `allowReconnection` would drop them immediately.
   * If the window lapses, Colyseus fires `onLeave`.
   */
  onDrop(client: Client, code: CloseCode) {
    // Allow up to 60 seconds for mobile reconnect drops
    this.allowReconnection(client, 60).catch(() => {});
  }

  onReconnect(client: Client) {
    console.log(`Client ${client.sessionId} reconnected!`);
  }

  /**
   * Permanent leave for a client: explicit `room.leave()`, or `onDrop`'s
   * reconnection window elapsed. Removes them from synced state and, while one
   * seat remains, reopens the room so the surviving host can find a new opponent.
   *
   * @remarks
   * - If the **creator** left, the survivor is promoted to host: `creatorName`
   *   metadata is transferred and the survivor is sent `opponent_left` with
   *   `youAreHost: true` so its HUD can toast the promotion. A plain joiner
   *   leaving does not promote anyone.
   * - `readyClients` / `enterClients` / `matchStarted` reset so the next
   *   two-player role/enter handshake runs again for the incoming joiner.
   * - With zero clients left the room disposes itself (Colyseus default); we
   *   don't dispose early while a host is waiting.
   * - Complements {@link onDrop} (grace window) and {@link onReconnect}.
   */
  onLeave(client: Client, code: CloseCode) {
    console.log(`Client ${client.sessionId} left! Code: ${code}`);
    // Reconnection window elapsed (or refused): drop them from synced state.
    this.state.players.delete(client.sessionId);

    const wasCreator = client.sessionId === this.creatorSessionId;

    // Both gone -> room disposes on its own. One remains -> reopen for a new player
    if (this.clients.length === 1) {
      const host = this.clients[0];

      this.unlock();
      this.readyClients.clear();
      this.enterClients.clear();
      this.matchStarted = false;
      this.phases.reset();

      if (wasCreator) {
        this.setMetadata({ ...this.metadata, creatorName: host.userData.playerName });
      }

      host.send(MESSAGES.opponentLeft, {
        opponentName: client.userData.playerName,
        youAreHost: wasCreator,
      });
    }
  }

  onDispose() {
    console.log(`Room ${this.roomId} disposing...`);
  }

  update(dt: number) {
    // Game loop tick: phase countdowns and forced transitions
    this.phases.update(dt);
  }
}

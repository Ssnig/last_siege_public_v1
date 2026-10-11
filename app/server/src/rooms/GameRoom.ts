import { Room, Client, CloseCode, definePlugins } from "colyseus";
import { MyRoomState } from "./schema/MyRoomState.js";
import { IdleKickPlugin } from "colyseus/plugins/idle-kick";


export type RoleChoice = "attacker" | "defender" | "any" | "random";
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
export class GameRoom extends Room<{ state: MyRoomState }> {
  // Enforce 1v1 matches
  maxClients = 2;
  state = new MyRoomState();

  // Role payload is only sent once both HUDs are listening (see handleReady)
  private readyClients = new Set<string>();
  private matchStarted = false;

  plugins = definePlugins({
    idle: new IdleKickPlugin({ timeoutMs: 60_000 }),
  });

  messages = {
    // Client signals its HUD is listening; roles go out only when both did.
    ready: (client: Client) => this.handleReady(client),
  };

  onCreate(options: any) {
    // 1. Set initial metadata so the LobbyRoom can display host info immediately
    this.setMetadata({
      creatorName: options.playerName || "Anonymous",
      roleChoice: options.roleChoice || "any",
    });

    // 2. Server-side tick loop
    this.setTimestep((deltaTime) => this.update(deltaTime / 1000));
  }

  async onJoin(client: Client, options: any) {
    // Store player name in client userData
    client.userData = {
      playerName: options.playerName || "Anonymous",
      role: null
    };

    console.log(`Player ${client.sessionId} (${client.userData.playerName}) joined room ${this.roomId}`);

    if (this.clients.length === 2) {
      this.assignRoles();
      await this.lock();
    }
  }

  /**
   * Resolves the host's `roleChoice` into concrete roles and stores them on each
   * client. Assignment only — notification is deferred until both players are
   * `ready` (see {@link handleReady}) so no client misses the one-shot message.
   *
   * @remarks
   * `"any"` = host defends, joiner attacks; `"random"` coin-flips.
   */
  private assignRoles() {
    const creatorClient = this.clients[0];
    const joinerClient = this.clients[1];

    const metadata = this.metadata as GameRoomMetadata;
    const choice = metadata?.roleChoice || "any";

    let creatorRole: PlayerRole;
    let joinerRole: PlayerRole;

    if (choice === "attacker") {
      creatorRole = "attacker";
      joinerRole = "defender";
    } else if (choice === "defender") {
      creatorRole = "defender";
      joinerRole = "attacker";
    } else if (choice === "random") {
      const isCreatorAttacker = Math.random() < 0.5;
      creatorRole = isCreatorAttacker ? "attacker" : "defender";
      joinerRole = isCreatorAttacker ? "defender" : "attacker";
    } else {
      // "any": Creator defaults to defender, Joiner gets attacker
      creatorRole = "defender";
      joinerRole = "attacker";
    }

    // Preserve playerName set on join, attach the resolved role
    creatorClient.userData = { ...creatorClient.userData, role: creatorRole };
    joinerClient.userData = { ...joinerClient.userData, role: joinerRole };

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
   */
  private handleReady(client: Client) {
    this.readyClients.add(client.sessionId);
    if (this.matchStarted || this.readyClients.size < 2) return;
    this.matchStarted = true;

    for (const c of this.clients) {
      const opponent = this.clients.find((o) => o.sessionId !== c.sessionId);
      c.send("role_assigned", {
        myName: c.userData.playerName,
        myRole: c.userData.role,
        opponentName: opponent?.userData.playerName,
        opponentRole: opponent?.userData.role,
      });
    }
  }

  /**
   * Holds a dropped player's seat for 30s so flaky/mobile clients can reconnect.
   *
   * @remarks
   * Returning without calling `allowReconnection` would drop them immediately.
   * If the window lapses, Colyseus fires `onLeave`.
   */
  onDrop(client: Client, code: CloseCode) {
    // Allow up to 30 seconds for mobile reconnect drops
    this.allowReconnection(client, 30).catch(() => {});
  }
  onReconnect(client: Client) {
    console.log(`Client ${client.sessionId} reconnected!`);
  }

  onLeave(client: Client, code: CloseCode) {
    console.log(`Client ${client.sessionId} left! Code: ${code}`);
    // Handle cleanup if game was in progress
  }

  onDispose() {
    console.log(`Room ${this.roomId} disposing...`);
  }

  update(dt: number) {
    // Game loop tick simulation (updates unit positions, tower cooldowns, etc.)
  }
}

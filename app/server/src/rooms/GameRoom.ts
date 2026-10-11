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

  plugins = definePlugins({
    idle: new IdleKickPlugin({ timeoutMs: 60_000 }),
  });

  messages = {
    // Message handlers for game actions (placement, spawning waves, etc.)
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
      this.assignRolesAndStart();
      await this.lock();
    }
  }

  /**
   * Turns the host's `roleChoice` into concrete roles and tells each player privately.
   *
   * @remarks
   * Uses `client.send` (not `broadcast`) since the two players get different roles.
   * `"any"` = host defends, joiner attacks; `"random"` coin-flips.
   */
  private assignRolesAndStart() {
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

    // Save roles to client instances so they can be referenced easily
    creatorClient.userData = { role: creatorRole };
    joinerClient.userData = { role: joinerRole };

    // Notify each client of their assigned role via direct WebSocket messages
    creatorClient.send("role_assigned", { role: creatorRole });
    joinerClient.send("role_assigned", { role: joinerRole });

    console.log(`Roles assigned: Creator = ${creatorRole}, Joiner = ${joinerRole}`);
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

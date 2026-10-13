import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";

import appConfig from "../src/app.config.js";
import {
  type RoomState,
  MESSAGES,
  MOB_TYPES,
  TOWER_TYPES,
} from "@root/shared";

function waitForPhase(room: { state: RoomState }, phase: string, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(() => {
      if (room.state.phase === phase) {
        clearInterval(iv);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(iv);
        reject(new Error(`phase "${phase}" not reached (still "${room.state.phase}")`));
      }
    }, 10);
  });
}

describe("testing your Colyseus app", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => colyseus = await boot(appConfig));
  after(async () => colyseus.shutdown());

  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("creates a synced Player on join", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {});
    const client1 = await colyseus.connectTo(room);

    const player = room.state.players.get(client1.sessionId);
    assert.ok(player, "a Player is created on join");
    assert.strictEqual(player.name, "Anonymous", "name falls back when none is provided");
    assert.strictEqual(room.state.phase, "drafting", "the room opens drafting immediately");
  });

  it("moves to building when both players confirm a valid draft", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    assert.strictEqual(
      room.state.players.get(attacker.sessionId).role,
      "attacker",
      "creator gets the attacker role",
    );
    assert.strictEqual(
      room.state.players.get(defender.sessionId).role,
      "defender",
      "joiner gets the defender role",
    );

    const mobIds = Object.keys(MOB_TYPES).slice(0, 2);
    const towerIds = Object.keys(TOWER_TYPES).slice(0, 2);

    attacker.send(MESSAGES.draftReady, { deck: mobIds });
    defender.send(MESSAGES.draftReady, { deck: towerIds });

    await waitForPhase(room, "building");
  });

  it("rejects an invalid draft and keeps the room in drafting", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    const rejected = attacker.waitForMessage(MESSAGES.draftRejected);
    attacker.send(MESSAGES.draftReady, { deck: ["not-a-real-unit"] });

    const msg = await rejected;
    assert.match(msg.reason, /unknown unit/);
    assert.strictEqual(room.state.phase, "drafting");
    assert.strictEqual(
      room.state.players.get(attacker.sessionId).draftReady,
      false,
      "a rejected draft must not mark the player ready",
    );
  });

  it("surrender after the draft declares the opponent the winner", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    const mobIds = Object.keys(MOB_TYPES).slice(0, 2);
    const towerIds = Object.keys(TOWER_TYPES).slice(0, 2);

    attacker.send(MESSAGES.draftReady, { deck: mobIds });
    defender.send(MESSAGES.draftReady, { deck: towerIds });
    await waitForPhase(room, "building");

    const loserAck = attacker.waitForMessage(MESSAGES.gameOver);
    const winnerAck = defender.waitForMessage(MESSAGES.gameOver);
    attacker.send(MESSAGES.surrender);

    const loserPayload = await loserAck;
    const winnerPayload = await winnerAck;
    assert.deepStrictEqual(loserPayload, { winner: "defender", reason: "surrender" });
    assert.deepStrictEqual(winnerPayload, { winner: "defender", reason: "surrender" });

    await waitForPhase(room, "gameover");
    assert.strictEqual(room.state.winner, "defender");
  });

  it("a lone player cannot surrender (no opponent to win)", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
    });
    const host = await colyseus.connectTo(room);

    host.send(MESSAGES.surrender);
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.strictEqual(room.state.phase, "drafting");
    assert.ok(!room.state.winner, "no winner should be declared in a solo lobby");
  });

  it("a surrender is not rolled back when the loser leaves", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    const mobIds = Object.keys(MOB_TYPES).slice(0, 2);
    const towerIds = Object.keys(TOWER_TYPES).slice(0, 2);

    attacker.send(MESSAGES.draftReady, { deck: mobIds });
    defender.send(MESSAGES.draftReady, { deck: towerIds });
    await waitForPhase(room, "building");

    attacker.send(MESSAGES.surrender);
    await waitForPhase(room, "gameover");

    await attacker.leave();
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.strictEqual(room.state.phase, "gameover", "onLeave must not reopen the room");
    assert.strictEqual(room.state.winner, "defender");
  });
});
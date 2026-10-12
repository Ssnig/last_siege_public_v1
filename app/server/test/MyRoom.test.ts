import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";

import appConfig from "../src/app.config.js";
import type { RoomState } from "@root/shared";
import { MESSAGES } from "@root/shared";

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
  });

  it("stays in waiting until both players send ready AND enter_game", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {});
    const c1 = await colyseus.connectTo(room, { playerName: "A" });
    const c2 = await colyseus.connectTo(room, { playerName: "B" });
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    assert.strictEqual(room.state.phase, "waiting");

    // Role handshake only: both auto-ready, phase must NOT flip yet.
    c1.send(MESSAGES.ready);
    c2.send(MESSAGES.ready);
    await sleep(50);
    assert.strictEqual(room.state.phase, "waiting");

    // One "Enter Game" is not enough.
    c1.send(MESSAGES.enterGame);
    await sleep(50);
    assert.strictEqual(room.state.phase, "waiting");

    // Both entered -> draft starts with the full timer.
    c2.send(MESSAGES.enterGame);
    await sleep(50);
    assert.strictEqual(room.state.phase, "drafting");
    assert.ok(room.state.phaseEndsAt > 0, "draft countdown is armed");
  });
});

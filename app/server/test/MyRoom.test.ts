import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";

import appConfig from "../src/app.config.js";
import {
  type RoomState,
  type YouEconomyPayload,
  MESSAGES,
  MOB_TYPES,
  TOWER_TYPES,
  MAPS,
  DEFAULT_ECONOMY,
  MATCH_RULES,
  buildCost,
  sellRefund,
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

async function waitFor(predicate: () => boolean, timeoutMs = 2000, intervalMs = 20): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("condition not met within timeout");
}

/**
 * Resolves the first `you_economy` push whose gold satisfies `predicate`.
 *
 * @remarks A room can push economy several times (seed on join, draft ready,
 * placements), so tests filter by the value they expect rather than trusting
 * the next message to be the one under test.
 */
function waitForEconomy(
  client: { onMessage: (type: string, cb: (payload: YouEconomyPayload) => void) => () => void },
  predicate: (gold: number) => boolean,
  timeoutMs = 2000,
): Promise<YouEconomyPayload> {
  return new Promise((resolve, reject) => {
    const unsubscribe = client.onMessage(MESSAGES.youEconomy, (payload) => {
      if (predicate(payload.gold)) {
        clearInterval(timer);
        unsubscribe();
        resolve(payload);
      }
    });
    const timer = setInterval(() => {
      clearInterval(timer);
      unsubscribe();
      reject(new Error("economy condition not met within timeout"));
    }, timeoutMs);
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

  it("spawns a test wave split across both paths when combat begins", async () => {
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

    attacker.send(MESSAGES.startCombat);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(room.state.phase, "building", "only the defender may start combat");

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");
    await waitFor(() => room.state.mobs.size > 0);

    assert.strictEqual(room.state.mobs.size, 8, "four mobs on each of the two paths");

    const pathIds = new Set<string>();
    for (const mob of room.state.mobs.values()) {
      pathIds.add(mob.pathId);
      assert.strictEqual(mob.typeId, "grunt");
      assert.ok(mob.speed > 0, "each mob carries a jittered speed");
    }
    assert.deepStrictEqual([...pathIds].sort(), ["bottom", "top"], "both tracks are used");
  });

  it("advances spawned mobs along their path", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: Object.keys(MOB_TYPES).slice(0, 2) });
    defender.send(MESSAGES.draftReady, { deck: Object.keys(TOWER_TYPES).slice(0, 2) });
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");
    await waitFor(() => room.state.mobs.size > 0);

    await waitFor(() => {
      for (const mob of room.state.mobs.values()) {
        if (mob.progress > 0) return true;
      }
      return false;
    });

    // Progress must stay in the normalised 0..1 range while advancing.
    for (const mob of room.state.mobs.values()) {
      assert.ok(mob.progress > 0 && mob.progress < 1, `progress ${mob.progress} in range`);
    }
  });

  it("sells a defender tower for a partial refund", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: Object.keys(MOB_TYPES).slice(0, 2) });
    defender.send(MESSAGES.draftReady, { deck: Object.keys(TOWER_TYPES).slice(0, 2) });
    await waitForPhase(room, "building");

    const towerTypeId = Object.keys(TOWER_TYPES)[0];
    const towerType = TOWER_TYPES[towerTypeId];
    const slotIndex = MAPS[room.state.mapId].slots[0].slotIndex;
    const startGold = DEFAULT_ECONOMY.defenderStartingGold;
    const afterBuild = startGold - buildCost(towerType);
    const afterSell = afterBuild + sellRefund(buildCost(towerType));

    const built = waitForEconomy(defender, (gold) => gold === afterBuild);
    defender.send(MESSAGES.placeTower, { typeId: towerTypeId, slotIndex });
    await built;

    const towerId = `${defender.sessionId}-${slotIndex}`;
    await waitFor(() => room.state.towers.has(towerId));
    assert.strictEqual(
      room.state.towers.get(towerId).invested,
      buildCost(towerType),
      "a fresh tower records its build cost as invested gold",
    );

    const sold = waitForEconomy(defender, (gold) => gold === afterSell);
    defender.send(MESSAGES.sellTower, { towerId });
    await sold;

    await waitFor(() => !room.state.towers.has(towerId));
    assert.ok(!room.state.towers.has(towerId), "the sold tower leaves the shared state");
  });

  it("towers fire at mobs in range, damage them, and pay a bounty on kill", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: Object.keys(MOB_TYPES).slice(0, 2) });
    defender.send(MESSAGES.draftReady, { deck: Object.keys(TOWER_TYPES).slice(0, 2) });
    await waitForPhase(room, "building");

    // Spend the whole defence budget on four basic towers so their combined DPS
    // is enough to kill a grunt well within the timeout. Two cover each path.
    const slots = MAPS[room.state.mapId].slots;
    const buildSlots = [slots[0], slots[1], slots[3], slots[4]].map(
      (slot) => slot.slotIndex,
    );

    const drained = waitForEconomy(defender, (gold) => gold === 0);
    for (const slotIndex of buildSlots) {
      defender.send(MESSAGES.placeTower, { typeId: "basic", slotIndex });
    }
    await drained;
    await waitFor(() => room.state.towers.size === buildSlots.length);

    // Gold is zero now, so the next positive push can only be a kill bounty.
    const bounty = waitForEconomy(defender, (gold) => gold > 0, 13000);

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");
    await waitFor(() => room.state.mobs.size > 0);

    await waitFor(() => room.state.projectiles.size > 0, 6000);

    const payload = await bounty;
    assert.ok(payload.gold >= 5, `kill bounty credited (gold ${payload.gold})`);

    // A kill removes a mob; within the window none can have reached the base.
    assert.ok(
      room.state.mobs.size < 8,
      "at least one mob was killed by tower fire",
    );
  });

  it("subtracts core HP when mobs breach the base", async function () {
    // Slow by nature: with no towers the wave must walk the whole path (~20s).
    this.timeout(35000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: Object.keys(MOB_TYPES).slice(0, 2) });
    defender.send(MESSAGES.draftReady, { deck: Object.keys(TOWER_TYPES).slice(0, 2) });
    await waitForPhase(room, "building");

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");
    await waitFor(() => room.state.mobs.size > 0);
    assert.strictEqual(room.state.coreHp, MATCH_RULES.coreHp, "core starts full");

    // No towers are built, so all eight grunts eventually reach the base and
    // leak exactly 1 each.
    await waitFor(() => room.state.mobs.size === 0, 30000, 100);
    assert.strictEqual(
      room.state.coreHp,
      MATCH_RULES.coreHp - 8,
      "each breaching grunt subtracts its leakDamage",
    );
  });

  it("lets the defender build towers during the combat phase", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: Object.keys(MOB_TYPES).slice(0, 2) });
    defender.send(MESSAGES.draftReady, { deck: Object.keys(TOWER_TYPES).slice(0, 2) });
    await waitForPhase(room, "building");

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    const towerTypeId = Object.keys(TOWER_TYPES)[0];
    const slotIndex = MAPS[room.state.mapId].slots[0].slotIndex;
    const towerId = `${defender.sessionId}-${slotIndex}`;

    defender.send(MESSAGES.placeTower, { typeId: towerTypeId, slotIndex });
    await waitFor(() => room.state.towers.has(towerId));

    assert.ok(
      room.state.towers.has(towerId),
      "towers can be placed after combat begins",
    );
  });
});

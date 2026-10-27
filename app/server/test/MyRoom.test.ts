process.env.NODE_ENV = "test";
import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { Callbacks } from "@colyseus/sdk";

import appConfig from "../src/app.config.js";
import {
  type RoomState,
  type YouEconomyPayload,
  type AttackerBufferPayload,
  Mob,
  MESSAGES,
  MOB_TYPES,
  ALL_MOB_IDS,
  TOWER_TYPES,
  MAPS,
  MAP_POOL,
  RANDOM_MAP_ID,
  DEFAULT_ECONOMY,
  DEFAULT_DEPLOY_RULES,
  MATCH_RULES,
  EFFECT_TYPES,
  TOWER_EFFECT_TYPES,
  buildCost,
  sellRefund,
  upgradeCost,
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

/**
 * Resolves the first `attacker_buffer` push satisfying `predicate`.
 *
 * @remarks The deploy-buffer snapshot is private to the attacker and re-sent
 * after every queue mutation, a deploy, a charge regen and the income window
 * closing, so tests match on the specific shape they expect rather than "the
 * next message".
 */
function waitForBuffer(
  client: {
    onMessage: (type: string, cb: (payload: AttackerBufferPayload) => void) => () => void;
  },
  predicate: (payload: AttackerBufferPayload) => boolean,
  timeoutMs = 2000,
): Promise<AttackerBufferPayload> {
  return new Promise((resolve, reject) => {
    const unsubscribe = client.onMessage(MESSAGES.attackerBuffer, (payload) => {
      if (predicate(payload)) {
        clearInterval(timer);
        unsubscribe();
        resolve(payload);
      }
    });
    const timer = setInterval(() => {
      clearInterval(timer);
      unsubscribe();
      reject(new Error("buffer condition not met within timeout"));
    }, timeoutMs);
  });
}

/**
 * Waits until the defender's gold outruns the passive income accrued so far.
 *
 * @remarks The defender earns `incomeRate` every second, so a plain "gold went
 * up" check cannot tell a kill bounty from the passive tick. Bounties are small
 * (one grunt is `incomeRate`), so a single push rarely shows a clean surplus;
 * instead the surplus is measured cumulatively against a baseline push, which
 * sums spread-out kills until they clear the threshold.
 */
function waitForBountyPush(
  client: {
    onMessage: (type: string, cb: (payload: YouEconomyPayload) => void) => () => void;
  },
  incomeRate: number,
  timeoutMs = 25000,
): Promise<YouEconomyPayload> {
  return new Promise((resolve, reject) => {
    let base: { gold: number; at: number } | null = null;
    const unsubscribe = client.onMessage(MESSAGES.youEconomy, (payload) => {
      const at = Date.now();
      if (!base) {
        base = { gold: payload.gold, at };
        return;
      }
      const passive = incomeRate * Math.max((at - base.at) / 1000, 0);
      if (payload.gold - base.gold - passive >= 3) {
        clearInterval(timer);
        unsubscribe();
        resolve(payload);
      }
    });
    const timer = setInterval(() => {
      clearInterval(timer);
      unsubscribe();
      reject(new Error("kill bounty not observed within timeout"));
    }, timeoutMs);
  });
}

/** Drafts both sides, then brings the room to the `building` phase. */
async function draftToBuilding(
  attacker: { send: (type: string, payload?: unknown) => void },
  defender: { send: (type: string, payload?: unknown) => void },
): Promise<void> {
  attacker.send(MESSAGES.draftReady, { deck: Object.keys(MOB_TYPES).slice(0, 2) });
  defender.send(MESSAGES.draftReady, { deck: Object.keys(TOWER_TYPES).slice(0, 2) });
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

  it("advertises 'available' until a second player makes it 'playing'", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      playerName: "Host",
    });
    assert.strictEqual(room.metadata.status, "available", "a fresh room is available");

    await colyseus.connectTo(room, { playerName: "Host" });
    assert.strictEqual(
      room.metadata.status,
      "available",
      "a lone host leaves the room available",
    );

    await colyseus.connectTo(room, { playerName: "Joiner" });
    assert.strictEqual(
      room.metadata.status,
      "playing",
      "the second player promotes the listing to playing",
    );
  });

  it("keeps a started room 'playing' after a player leaves", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {});
    await colyseus.connectTo(room);
    const joiner = await colyseus.connectTo(room);
    assert.strictEqual(room.metadata.status, "playing");

    await joiner.leave();
    await waitFor(() => room.state.players.size === 1);

    assert.strictEqual(
      room.metadata.status,
      "playing",
      "status never reverts to available once a match has begun",
    );
  });

  it("initializes a synchronized draft pool on room creation containing all catalog mobs", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
    });
    assert.strictEqual(room.state.draftMobPool.length, ALL_MOB_IDS.length, "draftMobPool must have all catalog units");
    const uniquePool = new Set(Array.from(room.state.draftMobPool));
    assert.strictEqual(uniquePool.size, ALL_MOB_IDS.length, "all pool entries must be unique");

    for (const unitId of room.state.draftMobPool) {
      assert.ok(ALL_MOB_IDS.includes(unitId), `${unitId} must be in ALL_MOB_IDS`);
    }

    const room2 = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "defender",
    });
    assert.strictEqual(room2.state.draftMobPool.length, ALL_MOB_IDS.length);
  });

  it("reveals a random map from the pool before drafting once both players are ready", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
    });
    assert.strictEqual(
      room.metadata.mapId,
      RANDOM_MAP_ID,
      "an unpinned room advertises the random sentinel in the lobby",
    );
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.ready);
    defender.send(MESSAGES.ready);

    await waitForPhase(room, "mapReveal");
    assert.ok(
      MAP_POOL.includes(room.state.mapId),
      `revealed map "${room.state.mapId}" should come from the pool`,
    );
    assert.notStrictEqual(room.state.mapId, "sample", "the fixture map is never revealed");
    assert.strictEqual(
      room.metadata.mapId,
      room.state.mapId,
      "the drawn map replaces the random sentinel in the lobby metadata",
    );

    // Shorten the reveal rather than wait the full balance window.
    room.state.phaseEndsAt = 0.05;
    await waitForPhase(room, "drafting");
  });

  it("keeps a map explicitly chosen in the lobby instead of rolling one", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "bagan",
    });
    assert.strictEqual(
      room.metadata.mapId,
      "bagan",
      "the lobby advertises the host's picked battlefield",
    );
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.ready);
    defender.send(MESSAGES.ready);

    await waitForPhase(room, "mapReveal");
    assert.strictEqual(
      room.state.mapId,
      "bagan",
      "the host's picked map must survive the reveal",
    );
    assert.strictEqual(room.metadata.mapId, "bagan");

    room.state.phaseEndsAt = 0.05;
    await waitForPhase(room, "drafting");
  });

  it("moves to building when both players confirm a valid draft", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
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

  it("runs the round-based 2-2-2 pick draft through to combat and a deploy", async function () {
    this.timeout(30000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await waitForPhase(room, "drafting", 5000);

    // Both clients report their assets as loaded so the final reveal does not
    // stall waiting on the asset-load gate.
    attacker.send(MESSAGES.clientAssetsLoaded);
    defender.send(MESSAGES.clientAssetsLoaded);

    // Three rounds of two picks each; the server reveals each round and runs a
    // short final countdown before opening the building phase.
    const attackerDeck = Object.keys(MOB_TYPES).slice(0, 6);
    const defenderDeck = Object.keys(TOWER_TYPES).slice(0, 6);
    for (let round = 1; round <= 3; round++) {
      attacker.send(MESSAGES.draftPick, {
        round,
        picks: attackerDeck.slice((round - 1) * 2, round * 2),
      });
      defender.send(MESSAGES.draftPick, {
        round,
        picks: defenderDeck.slice((round - 1) * 2, round * 2),
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await waitForPhase(room, "building", 15000);

    const slots = MAPS[room.state.mapId].slots;
    defender.send(MESSAGES.placeTower, {
      typeId: defenderDeck[0],
      slotIndex: slots[0].slotIndex,
    });
    await waitFor(() => room.state.towers.size === 1);

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    // The picked deck is what the attacker may deploy, so the push is drawn
    // from the same six units the draft handed out.
    attacker.send(MESSAGES.bufferAdd, { typeId: attackerDeck[0] });
    attacker.send(MESSAGES.bufferAdd, { typeId: attackerDeck[0] });
    attacker.send(MESSAGES.bufferAdd, { typeId: attackerDeck[0] });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0, 6000);
    await waitFor(() => room.state.projectiles.size > 0, 6000);
  });

  it("rejects an invalid draft and keeps the room in drafting", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
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
      mapId: "konbaung",
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
    assert.strictEqual(loserPayload.winner, "defender");
    assert.strictEqual(loserPayload.reason, "surrender");
    assert.strictEqual(winnerPayload.winner, "defender");
    assert.strictEqual(winnerPayload.reason, "surrender");

    await waitForPhase(room, "gameover");
    assert.strictEqual(room.state.winner, "defender");
    assert.strictEqual(room.state.gameOverReason, "surrender");
  });

  it("announces a destroyed core to both players as reason 'core'", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");

    // Actually breaching the base means walking the whole path (~60s); the
    // breach handler itself is what is under test, so trigger it directly.
    const loserAck = defender.waitForMessage(MESSAGES.gameOver);
    const winnerAck = attacker.waitForMessage(MESSAGES.gameOver);
    (room as unknown as { leakToCore: (damage: number) => void }).leakToCore(
      MATCH_RULES.coreHp,
    );

    const loser = await loserAck;
    const winner = await winnerAck;
    assert.strictEqual(loser.winner, "attacker");
    assert.strictEqual(loser.reason, "core");
    assert.strictEqual(winner.winner, "attacker");
    assert.strictEqual(winner.reason, "core");


    await waitForPhase(room, "gameover");
    assert.strictEqual(room.state.winner, "attacker");
    assert.strictEqual(room.state.gameOverReason, "core");
  });

  it("a lone player cannot surrender (no opponent to win)", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
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
      mapId: "konbaung",
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

  it("streams a buffered push out of a portal onto its track", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");

    attacker.send(MESSAGES.startCombat);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(room.state.phase, "building", "only the defender may start combat");

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    // Nothing is spawned on the combat edge any more: the attacker opts in.
    assert.strictEqual(room.state.mobs.size, 0, "no mobs appear without a deploy");

    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    // portal-0 is the Konbaung top track's spawn; the buffer pours out there.
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });

    // Units leave `staggerSec` apart, so they arrive one after another.
    await waitFor(() => room.state.mobs.size === 3, 6000);

    for (const mob of room.state.mobs.values()) {
      assert.strictEqual(mob.pathId, "top", "units follow the portal's track");
      assert.strictEqual(mob.typeId, "monkey");
      assert.ok(mob.speed > 0, "each mob carries a jittered speed");
    }
  });

  it("sends no attacker troops when combat begins without an explicit deploy", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");

    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.strictEqual(
      room.state.mobs.size,
      0,
      "buffered units wait for an explicit deploy instead of launching on the combat edge",
    );
  });

  it("advances spawned mobs along their path", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
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
      mapId: "konbaung",
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
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");
    defender.send(MESSAGES.sellTower, { towerId });
    await sold;

    await waitFor(() => !room.state.towers.has(towerId));
    assert.ok(!room.state.towers.has(towerId), "the sold tower leaves the shared state");
  });

  it("upgrades a defender tower, deducts gold, increases level and invested amount", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: Object.keys(MOB_TYPES).slice(0, 2) });
    defender.send(MESSAGES.draftReady, { deck: Object.keys(TOWER_TYPES).slice(0, 2) });
    await waitForPhase(room, "building");

    const towerType = Object.values(TOWER_TYPES).find(
      (tower) =>
        buildCost(tower) + (upgradeCost(tower, 1) ?? Infinity) <=
        DEFAULT_ECONOMY.defenderStartingGold,
    )!;
    const towerTypeId = towerType.id;
    const slotIndex = MAPS[room.state.mapId].slots[0].slotIndex;
    const startGold = DEFAULT_ECONOMY.defenderStartingGold;
    const costBuild = buildCost(towerType);
    const costUpgrade = upgradeCost(towerType, 1)!;
    const afterBuild = startGold - costBuild;
    const afterUpgrade = afterBuild - costUpgrade;

    const built = waitForEconomy(defender, (gold) => gold === afterBuild);
    defender.send(MESSAGES.placeTower, { typeId: towerTypeId, slotIndex });
    await built;

    const towerId = `${defender.sessionId}-${slotIndex}`;
    await waitFor(() => room.state.towers.has(towerId));
    assert.strictEqual(room.state.towers.get(towerId).level, 1);
    assert.strictEqual(room.state.towers.get(towerId).invested, costBuild);

    const upgraded = waitForEconomy(defender, (gold) => gold === afterUpgrade);
    defender.send(MESSAGES.upgradeTower, { towerId });
    await upgraded;

    await waitFor(() => room.state.towers.get(towerId).level === 2);
    const tower = room.state.towers.get(towerId);
    assert.strictEqual(tower.level, 2);
    assert.strictEqual(tower.invested, costBuild + costUpgrade);

    // Verify sell refund is based on the updated invested amount
    const afterSell = afterUpgrade + sellRefund(costBuild + costUpgrade);
    const sold = waitForEconomy(defender, (gold) => gold === afterSell);
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");
    defender.send(MESSAGES.sellTower, { towerId });
    await sold;
  });

  it("towers fire at mobs in range, damage them, and pay a bounty on kill", async function () {
    // A grunt needs a long stretch of tower fire to die, so give it room.
    this.timeout(30000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: Object.keys(MOB_TYPES).slice(0, 2) });
    defender.send(MESSAGES.draftReady, { deck: Object.keys(TOWER_TYPES).slice(0, 2) });
    await waitForPhase(room, "building");

    // Stack both affordable archer towers over the top path: one tower alone
    // cannot out-damage a monkey during a single pass, two comfortably can.
    const slots = MAPS[room.state.mapId].slots;
    const buildSlots = [slots[0], slots[1]].map((slot) => slot.slotIndex);

    for (const slotIndex of buildSlots) {
      defender.send(MESSAGES.placeTower, { typeId: "archer", slotIndex });
    }
    await waitFor(() => room.state.towers.size === buildSlots.length);

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    // The defender now earns passive income, so the bounty is detected as the
    // surplus over passive income accrued since a baseline push.
    const bounty = waitForBountyPush(defender, DEFAULT_ECONOMY.defenderBaseIncome);

    // Only the defended path is attacked, so any HP lost is tower damage and any
    // missing mob is a kill (not a leak).
    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0);

    await waitFor(() => room.state.projectiles.size > 0, 6000);
    await waitFor(
      () => [...room.state.mobs.values()].some((mob) => mob.hp < mob.maxHp),
      6000,
    );

    const payload = await bounty;
    assert.ok(payload.gold > 0, `kill bounty credited (gold ${payload.gold})`);
    assert.strictEqual(
      room.state.coreHp,
      MATCH_RULES.coreHp,
      "the push died to tower fire instead of reaching the base",
    );
  });

  it("removes a killed mob mid-combat, short of the core and with its bounty intact", async function () {
    this.timeout(30000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: Object.keys(MOB_TYPES).slice(0, 2) });
    defender.send(MESSAGES.draftReady, { deck: Object.keys(TOWER_TYPES).slice(0, 2) });
    await waitForPhase(room, "building");

    const slots = MAPS[room.state.mapId].slots;
    for (const slot of [slots[0], slots[1]]) {
      defender.send(MESSAGES.placeTower, { typeId: "archer", slotIndex: slot.slotIndex });
    }
    await waitFor(() => room.state.towers.size === 2);

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0);

    // The bounty floater reads these two fields straight off the removed mob
    // record. The server mutates HP and deletes in the same tick, so the
    // decoder ships the DELETE and drops the field update — the client can
    // never see a non-positive HP, and has to tell a kill from a leak by
    // progress instead. Both fields must therefore survive to onRemove.
    const callbacks = Callbacks.get(attacker);
    const removals: Array<{ progress: number; bounty: number }> = [];
    callbacks.onRemove("mobs", (mob) => {
      removals.push({ progress: mob.progress, bounty: mob.bounty });
    });

    await waitFor(() => removals.length > 0, 25000);

    assert.ok(
      removals.some((r) => r.progress < 1),
      `a kill removes the mob short of the core (${JSON.stringify(removals)})`,
    );
    assert.ok(
      removals.every((r) => r.bounty > 0),
      `the removed record still carries its bounty (${JSON.stringify(removals)})`,
    );
    assert.strictEqual(room.state.phase, "combat", "kills are removed mid-combat");
  });

  it("subtracts core HP when mobs breach the base", async function () {
    // Slow by nature: with no towers the push must walk the whole ~1300px path.
    // Grunts now crawl at 25px/s, so a full walk is close to a minute.
    this.timeout(95000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: Object.keys(MOB_TYPES).slice(0, 2) });
    defender.send(MESSAGES.draftReady, { deck: Object.keys(TOWER_TYPES).slice(0, 2) });
    await waitForPhase(room, "building");

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    for (let i = 0; i < 6; i++) {
      attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    }
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });

    await waitFor(() => room.state.mobs.size === 6, 6000);
    assert.strictEqual(room.state.coreHp, MATCH_RULES.coreHp, "core starts full");

    // No towers are built, so all six grunts eventually reach the base and
    // leak exactly 1 each.
    await waitFor(() => room.state.mobs.size === 0, 75000, 100);
    assert.strictEqual(
      room.state.coreHp,
      MATCH_RULES.coreHp - 6,
      "each breaching grunt subtracts its leakDamage",
    );
  });

  it("queues units during building but refuses to deploy before combat", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");

    // Queueing is allowed while the defender is still placing towers.
    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    const buffer = await waitForBuffer(attacker, (payload) => payload.buffer.length === 1);
    assert.strictEqual(buffer.goldPerSecond, DEFAULT_ECONOMY.attackerBaseIncome);
    assert.deepStrictEqual(buffer.buffer, ["monkey"], "the queued unit is held in order");
    assert.strictEqual(buffer.maxBufferUnits, DEFAULT_DEPLOY_RULES.maxBufferUnits);
    assert.strictEqual(buffer.canDeploy, false, "deploying is combat-only");
    assert.ok(buffer.availableTroops.includes("monkey"), "the deck is exposed as choices");

    // But deploying is combat-only.
    const rejected = attacker.waitForMessage(MESSAGES.deployRejected);
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    const msg = await rejected;
    assert.match(msg.reason, /combat/i);
  });

  it("rejects queueing a unit the attacker cannot afford", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    // A deck of expensive units: a chon_toe costs 55g against the attacker's
    // 200g, so only three fit before the purse runs dry.
    attacker.send(MESSAGES.draftReady, { deck: ["chon_toe"] });
    defender.send(MESSAGES.draftReady, { deck: Object.keys(TOWER_TYPES).slice(0, 2) });
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    const rejected = attacker.waitForMessage(MESSAGES.deployRejected);
    const affordable = Math.floor(DEFAULT_ECONOMY.attackerStartingGold / MOB_TYPES.chon_toe.cost);
    for (let i = 0; i <= affordable; i++) {
      attacker.send(MESSAGES.bufferAdd, { typeId: "chon_toe" });
    }
    const msg = await rejected;
    assert.match(msg.reason, /gold/i);
  });

  it("refuses to queue past the buffer cap", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");

    const rejected = attacker.waitForMessage(MESSAGES.deployRejected);
    for (let i = 0; i <= DEFAULT_DEPLOY_RULES.maxBufferUnits; i++) {
      attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    }
    const msg = await rejected;
    assert.match(msg.reason, /most \d+ units/i);
  });

  it("empties the queue and refunds the queued gold on clear", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");

    const start = DEFAULT_ECONOMY.attackerStartingGold;
    const queued = waitForEconomy(attacker, (gold) => gold === start - MOB_TYPES["monkey"].cost);
    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    await queued;

    const cleared = waitForEconomy(attacker, (gold) => gold === start);
    const bufferCleared = waitForBuffer(attacker, (payload) => payload.buffer.length === 0);
    attacker.send(MESSAGES.bufferClear, {});
    await cleared;

    const buffer = await bufferCleared;
    assert.deepStrictEqual(buffer.buffer, []);
    assert.strictEqual(buffer.gold, start, "clearing refunds every queued unit");
  });

  it("credits the attacker passive income during combat", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    const start = DEFAULT_ECONOMY.attackerStartingGold;
    const grown = await waitForEconomy(attacker, (gold) => gold > start, 5000);
    assert.ok(
      grown.gold > start,
      `attacker gold should grow from income (got ${grown.gold})`,
    );
  });

  it("consumes one portal charge per deploy", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    // Queue a unit to force a fresh snapshot, proving the initial charges.
    const queued = waitForBuffer(attacker, (payload) => payload.buffer.length === 1);
    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    const full = await queued;
    const portal = full.portals.find((p) => p.id === "portal-0")!;
    assert.strictEqual(portal.charges, DEFAULT_DEPLOY_RULES.portalInitialCharges);

    const spent = waitForBuffer(
      attacker,
      (payload) => payload.portals.find((p) => p.id === "portal-0")?.charges === portal.charges - 1,
    );
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });

    const after = await spent;
    assert.strictEqual(
      after.portals.find((p) => p.id === "portal-0")!.charges,
      portal.charges - 1,
    );
  });

  it("adds permanent income to the attacker on deploying units", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    const internals = room as unknown as {
      economies: Map<string, number>;
      incomeRates: Map<string, number>;
      effectiveIncomeRate: (sessionId: string, role: string) => number;
      accrueIncome: (dt: number) => void;
    };

    const initialRate = internals.effectiveIncomeRate(attacker.sessionId, "attacker");
    assert.strictEqual(initialRate, DEFAULT_ECONOMY.attackerBaseIncome);

    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0, 3000);

    const expectedBoost =
      (MOB_TYPES["monkey"]?.cost ?? 0) * DEFAULT_ECONOMY.attackerIncomeGainRate;
    assert.ok(expectedBoost > 0, "the fixture unit has a cost and a positive income gain rate");

    const updatedRate = internals.effectiveIncomeRate(attacker.sessionId, "attacker");
    assert.ok(
      Math.abs(updatedRate - (DEFAULT_ECONOMY.attackerBaseIncome + expectedBoost)) < 1e-9,
      "the reported passive rate includes the permanent deploy boost",
    );

    const before = internals.economies.get(attacker.sessionId) ?? 0;
    internals.accrueIncome(1);
    const after = internals.economies.get(attacker.sessionId) ?? 0;
    assert.ok(
      after - before >= (DEFAULT_ECONOMY.attackerBaseIncome + expectedBoost) * 0.99,
      "a tick credits base income plus the permanent deploy boost",
    );
  });

  it("the defender wins when the siege expires with no attacker units", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    // Nothing was deployed, so the moment the siege clock runs out the attacker
    // has no units left and loses. Shorten the clock rather than wait 180s.
    room.state.phaseEndsAt = 0.05;

    const over = defender.waitForMessage(MESSAGES.gameOver);
    const payload = await over;
    assert.strictEqual(payload.winner, "defender");
    assert.strictEqual(payload.reason, "time");
    await waitForPhase(room, "gameover");
    assert.strictEqual(room.state.gameOverReason, "time");
  });

  it("keeps the attacker's income running through the siege and stops it in sudden death", async function () {
    this.timeout(30000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    // A runner keeps the field alive, so the siege can expire into sudden death.
    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0, 3000);

    // Jump most of the way through the siege: the attacker's income must still
    // be running there, so their gold keeps climbing.
    room.state.phaseEndsAt = 90;
    const purse =
      DEFAULT_ECONOMY.attackerStartingGold - MOB_TYPES.monkey.cost;
    await waitForEconomy(attacker, (gold) => gold > purse, 8000);

    assert.strictEqual(
      (room as unknown as { incomeExpired: boolean }).incomeExpired,
      false,
    );

    // Sudden death is what closes the income window.
    room.state.phaseEndsAt = 0.05;
    await waitFor(
      () =>
        (room as unknown as { incomeExpired: boolean }).incomeExpired === true,
      5000,
    );

    // Give the update loop a few ticks to (wrongly) declare game over.
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.strictEqual(room.state.phase, "combat", "income expiry never ends the match");
    assert.strictEqual(room.state.winner, "");
  });

  it("pays both sides double in the closing minute of the siege", async function () {
    this.timeout(30000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    const base = await waitForEconomy(attacker, (gold) => gold > 0, 5000);
    assert.strictEqual(
      base.incomeRate,
      DEFAULT_ECONOMY.attackerBaseIncome,
      "the siege opens at the plain base rate",
    );

    // Move the siege clock into the closing window: both sides pay double.
    room.state.phaseEndsAt = DEFAULT_ECONOMY.siegeEndIncomeWindowSec - 1;
    const doubled = await new Promise<YouEconomyPayload>((resolve, reject) => {
      const unsubscribe = attacker.onMessage(MESSAGES.youEconomy, (payload) => {
        if (
          Math.abs(
            payload.incomeRate -
              DEFAULT_ECONOMY.attackerBaseIncome *
                DEFAULT_ECONOMY.siegeEndIncomeMultiplier,
          ) < 1e-6
        ) {
          clearInterval(timer);
          unsubscribe();
          resolve(payload);
        }
      });
      const timer = setInterval(() => {
        clearInterval(timer);
        unsubscribe();
        reject(new Error("doubled economy not received"));
      }, 5000);
    });
    assert.strictEqual(
      doubled.incomeRate,
      DEFAULT_ECONOMY.attackerBaseIncome * DEFAULT_ECONOMY.siegeEndIncomeMultiplier,
    );

    const defenderDoubled = await new Promise<YouEconomyPayload>((resolve, reject) => {
      const unsubscribe = defender.onMessage(MESSAGES.youEconomy, (payload) => {
        if (
          Math.abs(
            payload.incomeRate -
              DEFAULT_ECONOMY.defenderBaseIncome *
                DEFAULT_ECONOMY.siegeEndIncomeMultiplier,
          ) < 1e-6
        ) {
          clearInterval(timer);
          unsubscribe();
          resolve(payload);
        }
      });
      const timer = setInterval(() => {
        clearInterval(timer);
        unsubscribe();
        reject(new Error("defender doubled economy not received"));
      }, 5000);
    });
    assert.strictEqual(
      defenderDoubled.incomeRate,
      DEFAULT_ECONOMY.defenderBaseIncome * DEFAULT_ECONOMY.siegeEndIncomeMultiplier,
    );
  });

  it("clamps player gold at maxGold (750) when earning passive income or bounties", async function () {
    this.timeout(10000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    const gameRoom = room as any;
    // Set both players close to the maxGold cap
    gameRoom.economies.set(attacker.sessionId, DEFAULT_ECONOMY.maxGold - 5);
    gameRoom.economies.set(defender.sessionId, DEFAULT_ECONOMY.maxGold - 5);

    // Accrue income for 10 seconds (effective rate >= 5g/s -> would give 50g without cap)
    gameRoom.accrueIncome(10);

    assert.strictEqual(
      gameRoom.economies.get(attacker.sessionId),
      DEFAULT_ECONOMY.maxGold,
      "attacker gold must be clamped at maxGold",
    );
    assert.strictEqual(
      gameRoom.economies.get(defender.sessionId),
      DEFAULT_ECONOMY.maxGold,
      "defender gold must be clamped at maxGold",
    );

    // Also verify awardBounty clamps at maxGold
    gameRoom.awardBounty(defender.sessionId, 100);
    assert.strictEqual(
      gameRoom.economies.get(defender.sessionId),
      DEFAULT_ECONOMY.maxGold,
      "defender bounty must clamp at maxGold",
    );
  });

  it("enters sudden death when the siege expires with troops on the field", async function () {
    this.timeout(30000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    // A runner is the fastest unit, so the field clears soonest.
    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0, 3000);

    room.state.phaseEndsAt = 0.05;
    await waitFor(() => room.state.suddenDeath, 4000);
    assert.strictEqual(room.state.phase, "combat", "sudden death keeps the match live");

    // The lone runner leaks into the core; once the field is empty the defender
    // wins sudden death.
    const over = defender.waitForMessage(MESSAGES.gameOver, 20000);
    const payload = await over;
    assert.strictEqual(payload.winner, "defender");
    assert.strictEqual(payload.reason, "suddenDeath");
    await waitForPhase(room, "gameover");
    assert.strictEqual(room.state.gameOverReason, "suddenDeath");
  });

  it("freezes the deploy queue in sudden death", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0, 3000);

    room.state.phaseEndsAt = 0.05;
    await waitFor(() => room.state.suddenDeath, 4000);

    const rejected = attacker.waitForMessage(MESSAGES.deployRejected);
    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    const msg = await rejected;
    assert.match(msg.reason, /sudden death/i);
  });

  it("lets the defender build towers during the combat phase", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
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

  it("exposes one portal per merge spawn and routes deploys by portal", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "merge",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    // Any buffer mutation re-pushes the private snapshot; read the portals from it.
    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    const buffer = await waitForBuffer(attacker, (payload) => payload.portals.length === 3);
    assert.deepStrictEqual(
      buffer.portals.map((portal) => portal.id),
      ["portal-0", "portal-1", "portal-2"],
      "the merge map exposes one portal per distinct spawn",
    );

    // Verify portal-2 is locked at match start (unlocks at 100s).
    const portal2 = buffer.portals.find((p) => p.id === "portal-2");
    assert.ok(portal2?.locked, "portal-2 starts locked at combat start");
    assert.strictEqual(portal2?.unlocksInSec, 100, "portal-2 unlocks at 100s");

    // Advance matchTime to 100s to unlock portal-2
    (room as any).matchTime = 100;

    // portal-2 sits on the `lower` spawn, so the deploy walks that track.
    attacker.send(MESSAGES.deploy, { portalId: "portal-2" });
    await waitFor(() => room.state.mobs.size > 0, 3000);
    assert.ok(
      [...room.state.mobs.values()].every((mob) => mob.pathId === "lower"),
      "units follow the portal's track",
    );
  });

  it("honours an explicit path override on a forked portal", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "fork",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    // The fork's single portal carries both branches; pick the right one.
    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0", pathId: "right" });
    await waitFor(() => room.state.mobs.size > 0, 3000);
    assert.ok(
      [...room.state.mobs.values()].every((mob) => mob.pathId === "right"),
      "the explicit path override wins over the portal default",
    );
  });

  it("describes a forked portal's tracks and charge clock to the client", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "fork",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    const buffer = await waitForBuffer(attacker, (payload) => payload.buffer.length === 1);
    const portal = buffer.portals[0];

    assert.deepStrictEqual(
      portal.paths.map((path) => path.id),
      ["left", "right"],
      "the fork's branches are listed so the client can offer a chooser",
    );
    assert.ok(
      portal.paths.every((path) => path.label.length > 0),
      "every track carries a human-readable label",
    );
    assert.strictEqual(portal.maxCharges, DEFAULT_DEPLOY_RULES.portalMaxCharges);
    assert.strictEqual(portal.chargeSec, DEFAULT_DEPLOY_RULES.portalChargeSec);
  });

  it("awards the match to the staying player when a dropped opponent never returns", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
      // Short seat window so the timeout path runs without a 2-minute wait.
      reconnectWindowSec: 0.3,
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    const remainingRole = room.state.players.get(defender.sessionId)?.role;

    const notice = defender.waitForMessage(MESSAGES.opponentReconnecting);
    // Drop the attacker's socket without consenting. Disable the SDK's own
    // auto-reconnect so the seat genuinely laps; the game keeps running.
    attacker.reconnection.enabled = false;
    const left = attacker.leave(false);
    const reconnecting = await notice;
    assert.strictEqual(reconnecting.secondsRemaining, 0.3);

    const over = defender.waitForMessage(MESSAGES.gameOver, 5000);
    const payload = await over;
    await left;
    assert.strictEqual(payload.winner, remainingRole);
    assert.strictEqual(payload.reason, "disconnect");
    await waitForPhase(room, "gameover");
    assert.strictEqual(room.state.gameOverReason, "disconnect");
  });

  it("armor blunts a physical shot", async function () {
    // The palace guard's armor (8) soaks a flat slice out of every archer shot
    // (10-14), so a hit can only take 2-6 HP off the mob.
    this.timeout(40000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: ["monkey", "sar_bal_gyi"] });
    defender.send(MESSAGES.draftReady, { deck: ["archer"] });
    await waitForPhase(room, "building");

    const slots = MAPS[room.state.mapId].slots;
    defender.send(MESSAGES.placeTower, { typeId: "archer", slotIndex: slots[0].slotIndex });
    await waitFor(() => room.state.towers.size === 1);

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.bufferAdd, { typeId: "sar_bal_gyi" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0);

    await waitFor(
      () => [...room.state.mobs.values()].some((mob) => mob.hp < mob.maxHp),
      15000,
    );

    const mob = [...room.state.mobs.values()].find((m) => m.hp < m.maxHp);
    assert.ok(mob, "the tower hit the mob");
    assert.strictEqual(mob.typeId, "sar_bal_gyi");
    const loss = mob.maxHp - mob.hp;
    const archer = TOWER_TYPES["archer"];
    const maxShot = archer.tiers[0].damageMax ?? archer.tiers[0].damage;
    assert.ok(
      loss > 0 && loss <= maxShot - 8,
      `armor (8) blunts the archer's ${maxShot}-damage shot, so the loss stays at most ${maxShot - 8} (was ${loss})`,
    );
  });

  it("a mental hit ignores armor and cracks the mob it lands on", async function () {
    // The bell tower is a mental tower: the palace guard's armor (8) does not
    // blunt its 12-18 shot, and the hit cracks a mob with no mental strength.
    this.timeout(40000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: ["monkey", "sar_bal_gyi"] });
    defender.send(MESSAGES.draftReady, { deck: ["bell"] });
    await waitForPhase(room, "building");

    // The bell tower is a mental tower, so the palace guard's armor (8) does
    // not blunt its shot, keeping the health loss inside its damage band.
    const slots = MAPS[room.state.mapId].slots;
    defender.send(MESSAGES.placeTower, { typeId: "bell", slotIndex: slots[0].slotIndex });
    await waitFor(() => room.state.towers.size === 1);

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.bufferAdd, { typeId: "sar_bal_gyi" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0);

    await waitFor(
      () => [...room.state.mobs.values()].some((mob) => mob.hp < mob.maxHp),
      15000,
    );

    const mob = [...room.state.mobs.values()].find((m) => m.hp < m.maxHp);
    assert.ok(mob, "the mob took a hit");
    const loss = mob.maxHp - mob.hp;
    const bellT1 = TOWER_TYPES["bell"]!.tiers[0];
    const minDmg = bellT1.damage;
    const maxDmg = bellT1.damageMax ?? bellT1.damage;
    assert.ok(
      loss >= minDmg && loss <= maxDmg,
      `a mental hit ignores armor, so the loss stays in the bell's ${minDmg}-${maxDmg} band (was ${loss})`,
    );

    const debuff = mob.effects.get("debuff");
    assert.ok(debuff, "the mob carries a mental debuff");
    assert.strictEqual(debuff.magnitude, 1, "a mob with no mental strength is fully cracked");

    const slow = mob.effects.get("slow");
    assert.ok(slow, "a fully broken mob is slowed as well");
    assert.ok(
      Math.abs(slow.magnitude - 0.2) < 1e-6,
      `the slow keeps 80% of the speed (magnitude ${slow.magnitude})`,
    );
  });

  it("monkey starts at 130 speed and drops to 65 upon taking damage", async function () {
    this.timeout(40000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: ["monkey", "sar_bal_gyi"] });
    defender.send(MESSAGES.draftReady, { deck: ["archer"] });
    await waitForPhase(room, "building");

    const slots = MAPS[room.state.mapId].slots;
    defender.send(MESSAGES.placeTower, { typeId: "archer", slotIndex: slots[0].slotIndex });
    await waitFor(() => room.state.towers.size === 1);

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0);

    const mob = [...room.state.mobs.values()][0];
    assert.ok(mob.speed > 115, `monkey starts with burst speed (was ${mob.speed})`);

    await waitFor(() => mob.hp < mob.maxHp, 15000);
    assert.strictEqual(mob.speed, 65, "monkey drops permanently to 65 speed upon taking damage");
  });

  it("a_ba accelerates steadily from 45 toward 90 speed as time elapses", async function () {
    this.timeout(40000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "bagan",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: ["a_ba", "sar_bal_gyi"] });
    defender.send(MESSAGES.draftReady, { deck: ["archer"] });
    await waitForPhase(room, "building");

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.bufferAdd, { typeId: "a_ba" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0);

    const mob = [...room.state.mobs.values()][0];
    const initialSpeed = mob.speed;
    assert.ok(initialSpeed >= 40 && initialSpeed <= 50, `a_ba starts around 45 speed (was ${initialSpeed})`);

    await new Promise((r) => setTimeout(r, 2500));
    assert.ok(mob.speed > initialSpeed, `a_ba accelerates over time (${initialSpeed} -> ${mob.speed})`);
  });

  it("brute has 460 HP, 4 armor, and self_heal ability", async function () {
    this.timeout(40000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: ["brute", "sar_bal_gyi"] });
    defender.send(MESSAGES.draftReady, { deck: ["archer"] });
    await waitForPhase(room, "building");

    const slots = MAPS[room.state.mapId].slots;
    defender.send(MESSAGES.placeTower, { typeId: "archer", slotIndex: slots[0].slotIndex });
    await waitFor(() => room.state.towers.size === 1);

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.bufferAdd, { typeId: "brute" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0);

    const mob = [...room.state.mobs.values()][0];
    const bruteType = MOB_TYPES["brute"];
    assert.strictEqual(mob.maxHp, 460, "brute has 460 maxHp");
    assert.strictEqual(bruteType.armor, 4, "brute has 4 base armor in config");
    assert.strictEqual(bruteType.ability?.type, "self_heal", "brute has self_heal ability");
    assert.strictEqual(bruteType.ability?.healFraction, 0.1, "brute heals 10% maxHp");

    await waitFor(() => mob.hp < mob.maxHp, 15000);
    assert.ok(mob.hp < mob.maxHp, "brute takes damage");
  });

  it("belu gains adaptive armor stacks up to 5 when taking physical damage", async function () {
    this.timeout(40000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: ["belu", "sar_bal_gyi"] });
    defender.send(MESSAGES.draftReady, { deck: ["archer"] });
    await waitForPhase(room, "building");

    const slots = MAPS[room.state.mapId].slots;
    defender.send(MESSAGES.placeTower, { typeId: "archer", slotIndex: slots[0].slotIndex });
    await waitFor(() => room.state.towers.size === 1);

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.bufferAdd, { typeId: "belu" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0);

    const mob = [...room.state.mobs.values()][0];
    const beluType = MOB_TYPES["belu"];
    assert.strictEqual(beluType.armor, 0, "belu starts with 0 armor in config");
    assert.strictEqual(beluType.mentalStrength, 0, "belu starts with 0 mental strength in config");

    await waitFor(() => mob.effects.has(EFFECT_TYPES.armor_stack), 15000);
    const stack = mob.effects.get(EFFECT_TYPES.armor_stack);
    assert.ok(stack, "armor_stack effect tracked");
    assert.ok(stack.magnitude >= 1, `belu gained armor stack (stacks: ${stack.magnitude})`);
  });

  it("sone_ma stuns the tower that killed her for 5 seconds", async function () {
    this.timeout(40000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: ["sone_ma", "sar_bal_gyi"] });
    defender.send(MESSAGES.draftReady, { deck: ["archer"] });
    await waitForPhase(room, "building");

    const slots = MAPS[room.state.mapId].slots;
    defender.send(MESSAGES.placeTower, { typeId: "archer", slotIndex: slots[0].slotIndex });
    await waitFor(() => room.state.towers.size === 1);

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.bufferAdd, { typeId: "sone_ma" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0);

    const mob = [...room.state.mobs.values()][0];
    mob.hp = 10; // Prime with low HP so the archer's arrow is lethal

    await waitFor(() => {
      return [...room.state.towers.values()].some((t) =>
        t.effects.has(TOWER_EFFECT_TYPES.stun),
      );
    }, 15000);

    const stunnedTower = [...room.state.towers.values()].find((t) =>
      t.effects.has(TOWER_EFFECT_TYPES.stun),
    );
    assert.ok(stunnedTower, "a tower was stunned by killing sone_ma");
    const stun = stunnedTower.effects.get(TOWER_EFFECT_TYPES.stun);
    assert.ok(stun, "killing tower has stun effect");
    assert.ok(stun.remaining > 0 && stun.remaining <= 5, `stun duration is initialized to 5s (remaining: ${stun.remaining})`);
  });

  it("spear tower inflicts physical bleed status effect on hit", async function () {
    this.timeout(40000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: ["bandit"] });
    defender.send(MESSAGES.draftReady, { deck: ["spear"] });
    await waitForPhase(room, "building");

    const slots = MAPS[room.state.mapId].slots;
    defender.send(MESSAGES.placeTower, { typeId: "spear", slotIndex: slots[0].slotIndex });
    await waitFor(() => room.state.towers.size === 1);

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.bufferAdd, { typeId: "bandit" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0);

    const mob = [...room.state.mobs.values()][0];
    await waitFor(() => mob.effects.has(EFFECT_TYPES.bleed), 15000);
    const bleed = mob.effects.get(EFFECT_TYPES.bleed);
    assert.ok(bleed, "target has bleed status effect");
    assert.strictEqual(bleed.magnitude, 5, "Lv1 spear inflicts 5 bleed damage");
    assert.ok(bleed.remaining > 0 && bleed.remaining <= 3.0, "bleed duration within 3.0s");
  });

  it("water_cannon drenches and slows target mob", async function () {
    this.timeout(40000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: ["gya_pu"] });
    defender.send(MESSAGES.draftReady, { deck: ["water_cannon"] });
    await waitForPhase(room, "building");

    const slots = MAPS[room.state.mapId].slots;
    defender.send(MESSAGES.placeTower, { typeId: "water_cannon", slotIndex: slots[0].slotIndex });
    await waitFor(() => room.state.towers.size === 1);

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.bufferAdd, { typeId: "gya_pu" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0);

    const mob = [...room.state.mobs.values()][0];
    await waitFor(() => mob.effects.has(EFFECT_TYPES.drench), 15000);
    const drench = mob.effects.get(EFFECT_TYPES.drench);
    const slow = mob.effects.get(EFFECT_TYPES.slow);
    assert.ok(drench, "target has drench effect");
    assert.ok(slow, "target has slow effect");
    assert.strictEqual(drench.magnitude, 0.15, "Lv1 drench vulnerability is 15%");
    assert.strictEqual(slow.magnitude, 0.15, "Lv1 drench slow is 15%");
  });

  it("chinthe guardian silences mob on hit", async function () {
    this.timeout(40000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: ["sar_bal_gyi"] });
    defender.send(MESSAGES.draftReady, { deck: ["chinthe"] });
    await waitForPhase(room, "building");

    const slots = MAPS[room.state.mapId].slots;
    defender.send(MESSAGES.placeTower, { typeId: "chinthe", slotIndex: slots[0].slotIndex });
    await waitFor(() => room.state.towers.size === 1);

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.bufferAdd, { typeId: "sar_bal_gyi" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0);

    const mob = [...room.state.mobs.values()][0];
    await waitFor(() => mob.effects.has(EFFECT_TYPES.silence), 15000);
    const silence = mob.effects.get(EFFECT_TYPES.silence);
    assert.ok(silence, "target has silence effect");
    assert.ok(silence.remaining > 0 && silence.remaining <= 1.5, "Lv1 silence duration is 1.5s");
  });

  it("sein_pyaung strips physical armor via armor_crush on hit", async function () {
    this.timeout(40000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: ["sar_bal_gyi"] });
    defender.send(MESSAGES.draftReady, { deck: ["sein_pyaung"] });
    await waitForPhase(room, "building");

    const slots = MAPS[room.state.mapId].slots;
    defender.send(MESSAGES.placeTower, { typeId: "sein_pyaung", slotIndex: slots[0].slotIndex });
    await waitFor(() => room.state.towers.size === 1);

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.bufferAdd, { typeId: "sar_bal_gyi" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0);

    const mob = [...room.state.mobs.values()][0];
    await waitFor(() => mob.effects.has(EFFECT_TYPES.armor_crush), 15000);
    const crush = mob.effects.get(EFFECT_TYPES.armor_crush);
    assert.ok(crush, "target has armor_crush effect");
    assert.ok(crush.magnitude >= 1, "Lv1 strips at least 1 armor per hit");
  });

  it("gun tower awards bonus gold on kill", async function () {
    this.timeout(40000);

    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    attacker.send(MESSAGES.draftReady, { deck: ["monkey"] });
    defender.send(MESSAGES.draftReady, { deck: ["gun"] });
    await waitForPhase(room, "building");

    const slots = MAPS[room.state.mapId].slots;
    defender.send(MESSAGES.placeTower, { typeId: "gun", slotIndex: slots[0].slotIndex });
    await waitFor(() => room.state.towers.size === 1);

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    attacker.send(MESSAGES.deploy, { portalId: "portal-0" });
    await waitFor(() => room.state.mobs.size > 0);

    const mob = [...room.state.mobs.values()][0];
    mob.hp = 1; // Prime low HP so the gun tower shot kills instantly

    const bounty = MOB_TYPES["monkey"]?.bounty ?? 3;
    const initialDefenderGold = (room as any).economies.get(defender.sessionId) ?? 0;
    await waitFor(() => {
      const currentGold = (room as any).economies.get(defender.sessionId) ?? 0;
      return currentGold >= initialDefenderGold + bounty + 1;
    }, 15000);

    const finalGold = (room as any).economies.get(defender.sessionId) ?? 0;
    assert.ok(finalGold >= initialDefenderGold + bounty + 1, "gun tower kill awarded base bounty + bonus gold 1");
  });

  it("rejects deploy through locked portal-1 at match start and unlocks at 50s", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.bufferAdd, { typeId: "monkey" });
    const rejected = attacker.waitForMessage(MESSAGES.deployRejected);
    attacker.send(MESSAGES.deploy, { portalId: "portal-1" });
    const refusal = await rejected;
    assert.match(refusal.reason, /locked/i, "deploy through portal-1 is rejected at combat start");

    // Advance matchTime to 50s
    (room as any).matchTime = 50;

    // Now deploying through portal-1 succeeds
    attacker.send(MESSAGES.deploy, { portalId: "portal-1" });
    await waitFor(() => room.state.mobs.size > 0, 3000);
    assert.strictEqual(room.state.mobs.size, 1, "unit deployed through unlocked portal-1");
  });

  it("say_sayar heal aura applies diminishing returns stacks (90%, 70%, 40%, 20%, 0%)", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });

    const target = new Mob({
      ownerId: "attacker",
      typeId: "elephant_rider",
      batchId: 1,
      hp: 300,
      maxHp: 1300,
      speed: 30,
    });
    const caster = new Mob({
      ownerId: "attacker",
      typeId: "say_sayar",
      batchId: 1,
      hp: 220,
      maxHp: 220,
      speed: 30,
    });

    room.state.mobs.set("target-1", target);
    room.state.mobs.set("caster-1", caster);

    const positions = new Map<string, { x: number; y: number }>([
      ["target-1", { x: 100, y: 100 }],
      ["caster-1", { x: 105, y: 100 }],
    ]);

    // Heal 1: 0 stacks -> 100% healing (80 HP). Stacks become 1.
    (room as any).simulateMobAbilities(0.1, positions);
    assert.strictEqual(target.hp, 380, "first heal restores full 80 HP");
    assert.strictEqual(
      target.effects.get(EFFECT_TYPES.heal_exhaustion)?.magnitude,
      1,
      "target gains 1 heal exhaustion stack",
    );

    // Heal 2: 1 stack -> 90% healing (72 HP). Stacks become 2.
    (room as any).mobAbilityCooldowns.delete("caster-1");
    (room as any).simulateMobAbilities(0.1, positions);
    assert.strictEqual(target.hp, 380 + 72, "second heal restores 90% (72 HP)");
    assert.strictEqual(
      target.effects.get(EFFECT_TYPES.heal_exhaustion)?.magnitude,
      2,
      "target reaches 2 heal exhaustion stacks",
    );

    // Heal 3: 2 stacks -> 70% healing (56 HP). Stacks become 3.
    (room as any).mobAbilityCooldowns.delete("caster-1");
    (room as any).simulateMobAbilities(0.1, positions);
    assert.strictEqual(target.hp, 452 + 56, "third heal restores 70% (56 HP)");
    assert.strictEqual(
      target.effects.get(EFFECT_TYPES.heal_exhaustion)?.magnitude,
      3,
      "target reaches 3 heal exhaustion stacks",
    );

    // Heal 4: 3 stacks -> 40% healing (32 HP). Stacks become 4.
    (room as any).mobAbilityCooldowns.delete("caster-1");
    (room as any).simulateMobAbilities(0.1, positions);
    assert.strictEqual(target.hp, 508 + 32, "fourth heal restores 40% (32 HP)");
    assert.strictEqual(
      target.effects.get(EFFECT_TYPES.heal_exhaustion)?.magnitude,
      4,
      "target reaches 4 heal exhaustion stacks",
    );

    // Heal 5: 4 stacks -> 20% healing (16 HP). Stacks become 5.
    (room as any).mobAbilityCooldowns.delete("caster-1");
    (room as any).simulateMobAbilities(0.1, positions);
    assert.strictEqual(target.hp, 540 + 16, "fifth heal restores 20% (16 HP)");
    assert.strictEqual(
      target.effects.get(EFFECT_TYPES.heal_exhaustion)?.magnitude,
      5,
      "target reaches 5 heal exhaustion stacks (cap)",
    );

    // Heal 6: 5 stacks -> 0% healing (0 HP). Stacks stay at 5.
    (room as any).mobAbilityCooldowns.delete("caster-1");
    (room as any).simulateMobAbilities(0.1, positions);
    assert.strictEqual(target.hp, 556, "sixth heal restores 0 HP (immune/exhausted)");
    assert.strictEqual(
      target.effects.get(EFFECT_TYPES.heal_exhaustion)?.magnitude,
      5,
      "stacks remain capped at 5",
    );
  });

  it("doe_pat speed boost does not stack from multiple casters", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });

    const caster1 = new Mob({ ownerId: "attacker", typeId: "doe_pat", batchId: 1, hp: 200, maxHp: 200, speed: 30 });
    const caster2 = new Mob({ ownerId: "attacker", typeId: "doe_pat", batchId: 1, hp: 200, maxHp: 200, speed: 30 });
    const ally = new Mob({ ownerId: "attacker", typeId: "monkey", batchId: 1, hp: 100, maxHp: 100, speed: 130 });

    room.state.mobs.set("caster-1", caster1);
    room.state.mobs.set("caster-2", caster2);
    room.state.mobs.set("ally-1", ally);

    const positions = new Map<string, { x: number; y: number }>([
      ["caster-1", { x: 100, y: 100 }],
      ["caster-2", { x: 102, y: 100 }],
      ["ally-1", { x: 105, y: 100 }],
    ]);

    (room as any).simulateMobAbilities(0.1, positions);

    // Ally has haste from Doe Pat 1 and Doe Pat 2
    const haste = ally.effects.get(EFFECT_TYPES.haste);
    assert.ok(haste, "ally received haste effect");
    assert.strictEqual(haste.magnitude, 0.40, "haste magnitude is 0.40, not stacked additively to 0.80");

    const effectiveSpeedVal = (room as any).mobSpeed(ally, "ally-1");
    assert.strictEqual(effectiveSpeedVal, 130 * 1.40, "effective speed reflects single +40% boost");
  });

  it("multiple bell towers apply non-stacking slow and respect 40% speed floor", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
      mapId: "konbaung",
    });

    const mob = new Mob({ ownerId: "attacker", typeId: "monkey", batchId: 1, hp: 100, maxHp: 100, speed: 130 });
    room.state.mobs.set("mob-1", mob);

    // Apply pulse slow from 3 separate Tier 3 Bell Towers (0.40 each)
    (room as any).applyMobEffect(mob, EFFECT_TYPES.slow, 0.40, 1.5, "bell-1");
    (room as any).applyMobEffect(mob, EFFECT_TYPES.slow, 0.40, 1.5, "bell-2");
    (room as any).applyMobEffect(mob, EFFECT_TYPES.slow, 0.40, 1.5, "bell-3");

    const slow = mob.effects.get(EFFECT_TYPES.slow);
    assert.ok(slow, "mob has slow effect");
    assert.strictEqual(slow.magnitude, 0.40, "slow magnitude does not stack additively to 1.20");

    const speed = (room as any).mobSpeed(mob, "mob-1");
    assert.strictEqual(speed, 130 * (1 - 0.40), "mob moves at 60% base speed under 3 bell towers, never stun locked");
  });
});
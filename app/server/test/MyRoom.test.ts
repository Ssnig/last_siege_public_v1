import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";

import appConfig from "../src/app.config.js";
import {
  type RoomState,
  type YouEconomyPayload,
  type AttackerArmyPayload,
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

/**
 * Resolves the first `attacker_army` push satisfying `predicate`.
 *
 * @remarks The army snapshot is private to the attacker and re-sent after every
 * staging mutation, a release and the income window closing, so tests match on
 * the specific shape they expect rather than "the next message".
 */
function waitForArmy(
  client: {
    onMessage: (type: string, cb: (payload: AttackerArmyPayload) => void) => () => void;
  },
  predicate: (payload: AttackerArmyPayload) => boolean,
  timeoutMs = 2000,
): Promise<AttackerArmyPayload> {
  return new Promise((resolve, reject) => {
    const unsubscribe = client.onMessage(MESSAGES.attackerArmy, (payload) => {
      if (predicate(payload)) {
        clearInterval(timer);
        unsubscribe();
        resolve(payload);
      }
    });
    const timer = setInterval(() => {
      clearInterval(timer);
      unsubscribe();
      reject(new Error("army condition not met within timeout"));
    }, timeoutMs);
  });
}

/**
 * Waits until the defender's gold jumps by more than passive income explains.
 *
 * @remarks The defender now earns `incomeRate` every second, so a plain "gold
 * went up" check can no longer tell a kill bounty from the passive tick. Each
 * push carries `incomeRate`, so a bounty is whatever is left after subtracting
 * the income earned between two consecutive pushes.
 */
function waitForBountyPush(
  client: {
    onMessage: (type: string, cb: (payload: YouEconomyPayload) => void) => () => void;
  },
  incomeRate: number,
  timeoutMs = 20000,
): Promise<YouEconomyPayload> {
  return new Promise((resolve, reject) => {
    let prev: { gold: number; at: number } | null = null;
    const unsubscribe = client.onMessage(MESSAGES.youEconomy, (payload) => {
      const at = Date.now();
      if (prev) {
        const elapsed = Math.max((at - prev.at) / 1000, 0);
        const passive = incomeRate * elapsed;
        if (payload.gold - prev.gold - passive >= 3) {
          clearInterval(timer);
          unsubscribe();
          resolve(payload);
        }
      }
      prev = { gold: payload.gold, at };
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

  it("releases a staged wave split across both paths when combat begins", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
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
    assert.strictEqual(room.state.mobs.size, 0, "no mobs appear without a release");

    attacker.send(MESSAGES.waveAddBatch, { pathId: "top", typeId: "grunt", count: 3 });
    attacker.send(MESSAGES.waveAddBatch, { pathId: "bottom", typeId: "grunt", count: 3 });
    attacker.send(MESSAGES.waveRelease, {});

    // Batches go out `batchIntervalSec` apart, so the second path lags a moment.
    await waitFor(() => room.state.mobs.size === 6, 6000);

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

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.waveAddBatch, { pathId: "top", typeId: "grunt", count: 2 });
    attacker.send(MESSAGES.waveRelease, {});
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

    // Stack both affordable basic towers over the top path: one tower alone
    // cannot out-damage a grunt during a single pass, two comfortably can.
    const slots = MAPS[room.state.mapId].slots;
    const buildSlots = [slots[0], slots[1]].map((slot) => slot.slotIndex);

    for (const slotIndex of buildSlots) {
      defender.send(MESSAGES.placeTower, { typeId: "basic", slotIndex });
    }
    await waitFor(() => room.state.towers.size === buildSlots.length);

    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    // The defender now earns passive income, so the bounty is detected as the
    // leftover after that income is subtracted from each push.
    const bounty = waitForBountyPush(defender, DEFAULT_ECONOMY.defenderBaseIncome);

    // Only the defended path is attacked, so any HP lost is tower damage and any
    // missing mob is a kill (not a leak).
    attacker.send(MESSAGES.waveAddBatch, { pathId: "top", typeId: "grunt", count: 3 });
    attacker.send(MESSAGES.waveRelease, {});
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
      "the wave died to tower fire instead of reaching the base",
    );
  });

  it("subtracts core HP when mobs breach the base", async function () {
    // Slow by nature: with no towers the wave must walk the whole ~1300px path.
    // Grunts now crawl at 25px/s, so a full walk is close to a minute.
    this.timeout(95000);

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

    attacker.send(MESSAGES.waveAddBatch, { pathId: "top", typeId: "grunt", count: 3 });
    attacker.send(MESSAGES.waveAddBatch, { pathId: "bottom", typeId: "grunt", count: 3 });
    attacker.send(MESSAGES.waveRelease, {});

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

  it("stages a wave during building but refuses to release before combat", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");

    // Staging is allowed while the defender is still placing towers.
    attacker.send(MESSAGES.waveAddBatch, { pathId: "top", typeId: "grunt", count: 3 });
    const army = await waitForArmy(attacker, (payload) =>
      payload.paths.some((path) => path.pathId === "top" && path.troopCount === 3),
    );
    assert.strictEqual(army.goldPerSecond, DEFAULT_ECONOMY.attackerBaseIncome);
    assert.ok(army.availableTroops.includes("grunt"), "the deck is exposed as choices");

    // But releasing is combat-only.
    const rejected = attacker.waitForMessage(MESSAGES.waveRejected);
    attacker.send(MESSAGES.waveRelease, {});
    const msg = await rejected;
    assert.match(msg.reason, /combat/i);
  });

  it("rejects a release the attacker cannot afford", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    // 20 grunts cost 200g + 10g fee, past the 150g the attacker starts with.
    attacker.send(MESSAGES.waveAddBatch, { pathId: "top", typeId: "grunt", count: 10 });
    attacker.send(MESSAGES.waveAddBatch, { pathId: "top", typeId: "grunt", count: 10 });

    const rejected = attacker.waitForMessage(MESSAGES.waveRejected);
    attacker.send(MESSAGES.waveRelease, {});
    const msg = await rejected;
    assert.match(msg.reason, /gold/i);
  });

  it("credits the attacker passive income during combat", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
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

  it("charges a big wave against the limited big-wave pool", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    attacker.send(MESSAGES.waveSetSize, { pathId: "top", size: "big" });
    attacker.send(MESSAGES.waveAddBatch, { pathId: "top", typeId: "grunt", count: 4 });
    attacker.send(MESSAGES.waveRelease, {});

    const expected = DEFAULT_ECONOMY.bigWaveCount - 1;
    const army = await waitForArmy(attacker, (payload) => payload.bigWavesRemaining === expected);
    assert.strictEqual(army.bigWavesRemaining, expected);
  });

  it("expiring the income window ends the match once the attacker is out", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    // Nothing was sent, so the moment the income clock runs out the attacker has
    // no units left and loses. Shorten the clock rather than wait 90s.
    room.state.phaseEndsAt = 0.05;

    const over = defender.waitForMessage(MESSAGES.gameOver);
    const payload = await over;
    assert.deepStrictEqual(payload, { winner: "defender", reason: "time" });
    await waitForPhase(room, "gameover");
  });

  it("stays live after the income window if the attacker still has staged troops", async () => {
    const room = await colyseus.createRoom<RoomState>("game_room", {
      roleChoice: "attacker",
    });
    const attacker = await colyseus.connectTo(room);
    const defender = await colyseus.connectTo(room);

    await draftToBuilding(attacker, defender);
    await waitForPhase(room, "building");
    defender.send(MESSAGES.startCombat);
    await waitForPhase(room, "combat");

    // Stage but never release, then close the income window.
    attacker.send(MESSAGES.waveAddBatch, { pathId: "top", typeId: "grunt", count: 2 });
    await waitForArmy(attacker, (payload) =>
      payload.paths.some((path) => path.pathId === "top" && path.troopCount === 2),
    );
    room.state.phaseEndsAt = 0.05;

    const army = await waitForArmy(attacker, (payload) => payload.incomeExpired, 5000);
    assert.strictEqual(army.incomeExpired, true);
    // Give the update loop a few ticks to (wrongly) declare game over.
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.strictEqual(room.state.phase, "combat", "staged troops keep the match alive");
    assert.strictEqual(room.state.winner, "");
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

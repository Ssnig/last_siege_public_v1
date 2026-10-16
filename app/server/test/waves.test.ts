import assert from "assert";
import {
  DEFAULT_WAVE_RULES,
  MOB_TYPES,
  mobCost,
  stageLimits,
  validateWave,
  waveGoldCost,
  waveTroopCount,
  type StagedBatch,
  type StagedWave,
} from "@root/shared";

/**
 * Unit tests for the pure wave helpers in `@root/shared`.
 *
 * @remarks No room or network: these pin the cost and limit maths both the
 * server and the future client UI depend on to enable the send button.
 */
describe("waves pure helpers", () => {
  const grunt = MOB_TYPES["grunt"];
  const deck = ["grunt", "runner"];

  function batch(count: number, typeId = "grunt"): StagedBatch {
    return { batchId: `b-${Math.random()}`, typeId, count };
  }

  function wave(batches: StagedBatch[], size: StagedWave["size"] = "small"): StagedWave {
    return { pathId: "top", size, batches };
  }

  it("reports a unit's gold cost from MOB_TYPES", () => {
    assert.strictEqual(mobCost("grunt"), grunt.cost);
    assert.strictEqual(mobCost("not-a-unit"), 0);
  });

  it("sums troop counts across batches", () => {
    assert.strictEqual(waveTroopCount([batch(3), batch(4)]), 7);
    assert.strictEqual(waveTroopCount([]), 0);
  });

  it("prices a wave as unit costs plus the size's flat fee", () => {
    const batches = [batch(2), batch(3)]; // 5 grunts
    const expected = 5 * grunt.cost + DEFAULT_WAVE_RULES.sizes.small.fee;
    assert.strictEqual(waveGoldCost(batches, "small"), expected);
  });

  it("accepts a well-formed, affordable wave", () => {
    const gold = waveGoldCost([batch(2)], "small") + 1;
    assert.strictEqual(validateWave(wave([batch(2)]), deck, gold), null);
  });

  it("rejects an empty wave", () => {
    assert.match(validateWave(wave([]), deck)!, /empty/i);
  });

  it("rejects units outside the attacker's deck", () => {
    assert.match(validateWave(wave([batch(2, "ogre")]), deck)!, /not in your deck/i);
  });

  it("rejects a batch count above the size's batch limit", () => {
    const over = stageLimits("small").batchLimit + 1;
    assert.match(validateWave(wave([batch(over)]), deck)!, /per batch/i);
  });

  it("rejects a wave whose total troops exceed the wave limit", () => {
    const { batchLimit, waveLimit, maxBatches } = stageLimits("small");
    // Fill several legal batches until the total blows past the wave cap.
    const perBatch = batchLimit;
    const needed = Math.ceil(waveLimit / perBatch) + 1;
    assert.ok(needed <= maxBatches, "test needs enough legal batches to overshoot");
    const batches = Array.from({ length: needed }, () => batch(perBatch));
    assert.match(validateWave(wave(batches), deck)!, /at most .* units/i);
  });

  it("rejects a wave that costs more than the available gold", () => {
    assert.match(validateWave(wave([batch(4)]), deck, 0)!, /not enough gold/i);
  });

  it("gives big waves more headroom than small ones", () => {
    assert.ok(stageLimits("big").waveLimit > stageLimits("small").waveLimit);
    assert.ok(stageLimits("big").batchLimit >= stageLimits("small").batchLimit);
  });
});

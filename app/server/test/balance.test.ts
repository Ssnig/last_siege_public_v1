import assert from "assert";
import {
  MOB_TYPES,
  TOWER_TYPES,
  DEFAULT_ECONOMY,
  DEFAULT_DECK_RULES,
  MATCH_RULES,
  buildCost,
  upgradeCost,
  tierAt,
} from "@root/shared";

/**
 * Shape guards for `@root/shared`'s `balance.ts`.
 *
 * @remarks
 * A non-dev editor tunes numbers there; these tests keep a typo-editing of the
 * data from silently breaking the server or client. They say nothing about
 * "good" balance, only about a valid shape.
 */
describe("balance.ts shape guards", () => {
  it("defines records keyed by each entity's id", () => {
    for (const [id, mob] of Object.entries(MOB_TYPES)) {
      assert.strictEqual(mob.id, id, `MOB_TYPES key ${id} must match mob.id`);
    }
    for (const [id, tower] of Object.entries(TOWER_TYPES)) {
      assert.strictEqual(tower.id, id, `TOWER_TYPES key ${id} must match tower.id`);
    }
  });

  it("every tower has at least two tiers and strictly increasing costs/damage", () => {
    for (const tower of Object.values(TOWER_TYPES)) {
      assert.ok(tower.tiers.length >= 2, `${tower.id} needs >= 2 tiers`);
      for (let i = 1; i < tower.tiers.length; i++) {
        const prev = tower.tiers[i - 1];
        const cur = tower.tiers[i];
        assert.ok(cur.cost > prev.cost, `${tower.id}: tier ${i + 1} cost must exceed tier ${i}`);
        assert.ok(cur.damage > prev.damage, `${tower.id}: tier ${i + 1} damage must exceed tier ${i}`);
        for (const key of ["range", "fireRate", "projectileSpeed"]) {
          assert.ok(
            (cur as any)[key] >= (prev as any)[key],
            `${tower.id}: tier ${i + 1} ${key} must not fall below tier ${i}`
          );
        }
      }
    }
  });

  it("build cost is the level-1 tier cost and upgradeCost is tower-specific", () => {
    for (const tower of Object.values(TOWER_TYPES)) {
      assert.strictEqual(buildCost(tower), tower.tiers[0].cost);
      const maxLevel = tower.tiers.length;
      assert.strictEqual(upgradeCost(tower, maxLevel), null, "no cost past max level");
      for (let from = 1; from < maxLevel; from++) {
        assert.strictEqual(upgradeCost(tower, from), tower.tiers[from].cost);
      }
      assert.deepStrictEqual(tierAt(tower, 1), tower.tiers[0]);
      assert.strictEqual(tierAt(tower, maxLevel + 1), null);
    }
    // Tower-specific upgrade costs prove no cross-tower formula: two towers at
    // the same level must not be forced to share a cost.
    const basic = TOWER_TYPES["basic"];
    const bertha = TOWER_TYPES["bertha"];
    assert.ok(basic && bertha && basic.tiers[1].cost !== bertha.tiers[1].cost);
  });

  it("economy, deck and match rules are positive and present", () => {
    const { defenderStartingGold, attackerStartingGold, goldPerSecond, bigWaveCost, miniWaveCost } =
      DEFAULT_ECONOMY;
    for (const n of [defenderStartingGold, attackerStartingGold, goldPerSecond, bigWaveCost, miniWaveCost]) {
      assert.ok(n > 0, `economy value must be > 0, got ${n}`);
    }
    assert.ok(DEFAULT_ECONOMY.bigWaveCount > 0);
    assert.ok(DEFAULT_DECK_RULES.deckSize > 0);
    for (const n of [MATCH_RULES.coreHp, MATCH_RULES.draftDurationSec, MATCH_RULES.roundDurationSec]) {
      assert.ok(n > 0, `match rule must be > 0, got ${n}`);
    }
  });

  it("every mob has a defined leakDamage greater than 0", () => {
    for (const mob of Object.values(MOB_TYPES)) {
      assert.ok(mob.leakDamage > 0, `${mob.id} needs leakDamage > 0`);
      assert.ok(mob.bounty >= 0, `${mob.id} bounty must be >= 0`);
      assert.ok(mob.maxHp > 0 && mob.speed > 0, `${mob.id} maxHp/speed must be > 0`);
    }
  });
});
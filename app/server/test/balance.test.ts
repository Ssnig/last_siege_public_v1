import assert from "assert";
import {
  MOB_TYPES,
  TOWER_TYPES,
  DEFAULT_ECONOMY,
  DEFAULT_DECK_RULES,
  DEFAULT_DEPLOY_RULES,
  MATCH_RULES,
  buildCost,
  upgradeCost,
  tierAt,
  totalInvested,
  sellRefund,
  SELL_REFUND_RATE,
  deployStaggerSec,
  portalChargeRules,
} from "@root/shared";

/**
 * Shape guards for `@root/shared`'s balance data (`src/data/*.json`).
 *
 * @remarks
 * A non-dev editor tunes those JSON files; these tests keep a typo-editing of
 * the data from silently breaking the server or client. They say nothing about
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
    const { defenderStartingGold, attackerStartingGold } = DEFAULT_ECONOMY;
    for (const n of [defenderStartingGold, attackerStartingGold]) {
      assert.ok(n > 0, `economy value must be > 0, got ${n}`);
    }
    assert.ok(DEFAULT_DECK_RULES.deckSize > 0);
    // A -1 draft duration is the "no countdown" sentinel, so only reject > 0.
    assert.ok(
      MATCH_RULES.draftDurationSec === -1 || MATCH_RULES.draftDurationSec > 0,
      `draftDurationSec must be -1 (no countdown) or > 0, got ${MATCH_RULES.draftDurationSec}`,
    );
    for (const n of [
      MATCH_RULES.coreHp,
      MATCH_RULES.incomeDurationSec,
      MATCH_RULES.siegeDurationSec,
    ]) {
      assert.ok(n > 0, `match rule must be > 0, got ${n}`);
    }
  });

  it("deploy rules define sane caps, charges and staggering", () => {
    assert.ok(DEFAULT_DEPLOY_RULES.maxBufferUnits > 0, "the queue must hold at least one unit");
    assert.ok(DEFAULT_DEPLOY_RULES.portalMaxCharges > 0, "portals need at least one charge");
    assert.ok(DEFAULT_DEPLOY_RULES.portalChargeSec > 0, "charges must take time to regen");
    assert.ok(DEFAULT_DEPLOY_RULES.staggerSec > 0, "deployed units must leave apart");
  });

  it("economy rules gate the attacker's unit income on a progress threshold", () => {
    assert.ok(
      DEFAULT_ECONOMY.attackerUnitIncomeRate > 0,
      "deep units must pay the attacker something",
    );
    assert.ok(
      DEFAULT_ECONOMY.attackerUnitIncomeThreshold > 0
        && DEFAULT_ECONOMY.attackerUnitIncomeThreshold < 1,
      "the deep threshold must sit between spawn and the core",
    );
  });

  it("deployStaggerSec scales with unit speed and stays inside a clamp band", () => {
    for (const mob of Object.values(MOB_TYPES)) {
      const stagger = deployStaggerSec(mob.id);
      assert.ok(stagger > 0, `${mob.id} must still leave apart`);

      // The band keeps fast/CC units from never forming an AOE clump and slow
      // ones from straggling too far apart.
      assert.ok(
        stagger >= 0.8 * DEFAULT_DEPLOY_RULES.staggerSec,
        `${mob.id} stagger at least the floor`,
      );
      assert.ok(
        stagger <= 2.0 * DEFAULT_DEPLOY_RULES.staggerSec,
        `${mob.id} stagger under the ceiling`,
      );
    }

    // Faster units spread out further than slower ones on the same base.
    const fast = Object.values(MOB_TYPES).sort((a, b) => b.speed - a.speed)[0];
    const slow = Object.values(MOB_TYPES).sort((a, b) => a.speed - b.speed)[0];
    if (fast.speed > slow.speed) {
      assert.ok(
        deployStaggerSec(fast.id) >= deployStaggerSec(slow.id),
        "faster units leave further apart",
      );
    }
  });

  it("portalChargeRules falls back to the global deploy defaults", () => {
    assert.deepStrictEqual(portalChargeRules({}), {
      maxCharges: DEFAULT_DEPLOY_RULES.portalMaxCharges,
      chargeSec: DEFAULT_DEPLOY_RULES.portalChargeSec,
    });

    // A map-authored override wins, including a deliberately slower near-base portal.
    assert.deepStrictEqual(portalChargeRules({ maxCharges: 1, chargeSec: 45 }), {
      maxCharges: 1,
      chargeSec: 45,
    });

    // Partial overrides fill the rest from the defaults.
    assert.deepStrictEqual(portalChargeRules({ maxCharges: 5 }), {
      maxCharges: 5,
      chargeSec: DEFAULT_DEPLOY_RULES.portalChargeSec,
    });
  });

  it("totalInvested sums build plus upgrades and sellRefund refunds a fraction", () => {
    for (const tower of Object.values(TOWER_TYPES)) {
      assert.strictEqual(totalInvested(tower, 1), tower.tiers[0].cost);
      for (let level = 1; level <= tower.tiers.length; level++) {
        let expected = 0;
        for (let i = 0; i < level; i++) expected += tower.tiers[i].cost;
        assert.strictEqual(totalInvested(tower, level), expected);
        assert.strictEqual(sellRefund(expected), Math.floor(expected * SELL_REFUND_RATE));
        assert.ok(
          sellRefund(expected) <= expected,
          "refund never exceeds investment",
        );
      }
    }
  });

  it("every mob has a defined leakDamage and cost greater than 0", () => {
    for (const mob of Object.values(MOB_TYPES)) {
      assert.ok(mob.leakDamage > 0, `${mob.id} needs leakDamage > 0`);
      assert.ok(mob.bounty >= 0, `${mob.id} bounty must be >= 0`);
      assert.ok(mob.cost > 0, `${mob.id} needs cost > 0`);
      assert.ok(mob.maxHp > 0 && mob.speed > 0, `${mob.id} maxHp/speed must be > 0`);
    }
  });
});
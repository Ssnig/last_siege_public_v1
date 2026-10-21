import assert from "assert";
import {
  MOB_TYPES,
  TOWER_TYPES,
  DAMAGE_TYPES,
  EFFECT_TYPES,
  physicalDamageTaken,
  mentalDamageTaken,
  mentalDebuffMagnitude,
  effectiveSpeed,
  combineEffectMagnitude,
  mobArmor,
  mobMentalStrength,
  DEFAULT_COMBAT_RULES,
} from "@root/shared";

/**
 * Rules of the two damage channels and of the mob status effects.
 *
 * @remarks
 * These are the numbers a whole class of bugs would hide behind: armor eating
 * the wrong damage, a mental hit amplifying itself, a slow that stacks into
 * a standstill. The server applies exactly these functions, so keeping them
 * pure and pinned here is what makes the combat readable.
 */
describe("combat.ts damage channels", () => {
  it("physical damage is blunted by armor and never goes below zero", () => {
    assert.strictEqual(physicalDamageTaken(12, 0), 12, "un-armored mobs take the full hit");
    assert.strictEqual(physicalDamageTaken(12, 8), 4, "armor soaks a flat slice of every hit");
    assert.strictEqual(physicalDamageTaken(6, 8), 0, "armor heavier than the hit stops it dead");
    assert.strictEqual(physicalDamageTaken(0, 5), 0, "a zero-damage hit stays zero");
  });

  it("mental strength decides how much extra mental damage a cracked mob takes", () => {
    assert.strictEqual(mentalDebuffMagnitude(1), 0, "full resolve negates the crack entirely");
    assert.strictEqual(mentalDebuffMagnitude(0.5), 0.5, "half resolve means 1.5x mental damage");
    assert.strictEqual(mentalDebuffMagnitude(0), 1, "no resolve means double mental damage");
  });

  it("mental damage is amplified by the crack already on the mob", () => {
    assert.strictEqual(mentalDamageTaken(15, 0), 15, "an un-cracked mob takes the listed damage");
    assert.strictEqual(mentalDamageTaken(15, 0.5), 22.5, "half resolve means 1.5x");
    assert.strictEqual(mentalDamageTaken(15, 1), 30, "no resolve means 2x");
  });

  it("the strongest slow wins instead of stacking", () => {
    assert.strictEqual(effectiveSpeed(100, []), 100, "no slow means the base speed");
    assert.strictEqual(effectiveSpeed(100, [0.2]), 80, "a 20% slow keeps 80% of the speed");
    assert.strictEqual(effectiveSpeed(100, [0.2, 0.5]), 50, "the heaviest slow wins");
    assert.strictEqual(effectiveSpeed(100, [1.5]), 0, "a slow beyond 100% cannot invert the speed");
  });

  it("a stronger effect never gets diluted by a weaker one", () => {
    assert.strictEqual(
      combineEffectMagnitude(0.5, 0.2),
      0.5,
      "the heavy slow survives",
    );
    assert.strictEqual(
      combineEffectMagnitude(0.2, 0.5),
      0.5,
      "the heavy debuff survives",
    );
  });
});

describe("combat data", () => {
  it("every mob has a sane armor and mental strength", () => {
    for (const mob of Object.values(MOB_TYPES)) {
      assert.ok(mob.armor === undefined || mob.armor >= 0, `${mob.id} armor must not be negative`);
      assert.ok(
        mob.mentalStrength === undefined ||
          (mob.mentalStrength >= 0 && mob.mentalStrength <= 1),
        `${mob.id} mental strength must be a fraction between 0 and 1`,
      );
    }
  });

  it("reads armor and mental strength straight off the mob catalog", () => {
    assert.strictEqual(mobArmor("grunt"), 0, "a grunt is unarmored");
    assert.strictEqual(mobArmor("sar_bal_gyi"), 8, "the palace guard is heavily armored");
    assert.strictEqual(mobMentalStrength("grunt"), 0.5, "a grunt has half resolve");
    assert.strictEqual(mobMentalStrength("gya_pu"), 1, "a winged nat is unshaken");
    assert.strictEqual(mobMentalStrength("sar_bal_gyi"), 0, "the palace guard breaks completely");
  });

  it("gives the classic mobs half resolve and the spirits full resolve", () => {
    for (const id of ["grunt", "runner", "horse_rider", "spider", "orc"]) {
      assert.strictEqual(mobMentalStrength(id), 0.5, `${id} should have half resolve`);
    }
    for (const id of ["gya_pu", "a_ba", "shade", "necromancer"]) {
      assert.strictEqual(mobMentalStrength(id), 1, `${id} should be unshaken`);
    }
  });

  it("tags every tower with a damage channel and makes the casters mental", () => {
    for (const tower of Object.values(TOWER_TYPES)) {
      assert.ok(
        tower.damageType === DAMAGE_TYPES.physical || tower.damageType === DAMAGE_TYPES.mental,
        `${tower.id} needs a damage channel`,
      );
    }

    for (const id of ["bell", "arcanist", "archmage", "tesla"]) {
      assert.strictEqual(
        TOWER_TYPES[id].damageType,
        DAMAGE_TYPES.mental,
        `${id} should deal mental damage`,
      );
    }

    for (const id of ["basic", "archer", "cannon", "bomb", "sniper", "gun", "spear"]) {
      assert.strictEqual(
        TOWER_TYPES[id].damageType,
        DAMAGE_TYPES.physical,
        `${id} should deal physical damage`,
      );
    }
  });

  it("keeps the mental break slow inside the configured bounds", () => {
    const factor = DEFAULT_COMBAT_RULES.mentalBreakSlowFactor;
    assert.ok(factor > 0 && factor <= 1, "a broken mob keeps some speed");
    assert.ok(
      DEFAULT_COMBAT_RULES.debuffDurationSec > 0,
      "a crack needs time to matter",
    );
  });
});

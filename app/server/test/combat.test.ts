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
  MIN_SPEED_FRACTION,
  mobArmor,
  mobMentalStrength,
  DEFAULT_COMBAT_RULES,
  getTowerCooldown,
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
    assert.strictEqual(physicalDamageTaken(8, 8, 0.5), 4, "50% pen allows hit to pierce equal armor");
    assert.strictEqual(physicalDamageTaken(8, 8, 1.0), 8, "100% pen ignores armor completely");
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

  it("the strongest slow wins instead of stacking and respects the speed floor", () => {
    assert.strictEqual(effectiveSpeed(100, []), 100, "no slow means the base speed");
    assert.strictEqual(effectiveSpeed(100, [0.2]), 80, "a 20% slow keeps 80% of the speed");
    assert.strictEqual(effectiveSpeed(100, [0.2, 0.5]), 50, "the heaviest slow wins");
    assert.strictEqual(
      effectiveSpeed(100, [1.5]),
      100 * MIN_SPEED_FRACTION,
      "a slow beyond 100% clamps to the 35% speed floor",
    );
  });

  it("haste boosts effective speed and the strongest haste wins", () => {
    assert.strictEqual(effectiveSpeed(100, [], [0.4]), 140, "a 40% haste boosts 100 to 140");
    assert.strictEqual(effectiveSpeed(100, [], [0.2, 0.4]), 140, "the strongest haste wins");
    assert.strictEqual(effectiveSpeed(100, [0.5], [0.4]), 70, "slow and haste combine multiplicatively");
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
    assert.strictEqual(mobArmor("monkey"), 0, "a monkey is unarmored");
    assert.strictEqual(mobArmor("shield_guy"), 6, "the shield bearer has heavy armor");
    assert.strictEqual(mobArmor("sar_bal_gyi"), 8, "the palace guard is heavily armored");
    assert.strictEqual(mobArmor("elephant_rider"), 10, "the war elephant is heavily armored");
    assert.strictEqual(mobMentalStrength("monkey"), 0.5, "a monkey has half resolve");
    assert.strictEqual(mobMentalStrength("gya_pu"), 1, "a winged nat is unshaken");
    assert.strictEqual(mobMentalStrength("sar_bal_gyi"), 0, "the palace guard breaks completely");
    const doePat = MOB_TYPES["doe_pat"];
    assert.ok(doePat?.ability, "doe_pat defines a support ability");
    assert.strictEqual(doePat.ability?.type, "speed_aura");
    assert.ok(
      (doePat.ability?.durationSec ?? 0) < (doePat.ability?.cooldownSec ?? 0) * 0.5,
      "doe_pat speed_aura uptime is less than half of its cooldown",
    );
  });

  it("gives the classic mobs half resolve and the spirits full resolve", () => {
    for (const id of ["monkey", "horse_rider"]) {
      assert.strictEqual(mobMentalStrength(id), 0.5, `${id} should have half resolve`);
    }
    for (const id of ["gya_pu", "a_ba"]) {
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

    for (const id of ["bell", "water_cannon", "chinthe", "dragon"]) {
      assert.strictEqual(
        TOWER_TYPES[id].damageType,
        DAMAGE_TYPES.mental,
        `${id} should deal mental damage`,
      );
    }

    for (const id of ["cannon", "archer", "bomb", "spear", "gun", "sein_pyaung"]) {
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

describe("tower shooting speeds and cannon on-hit slow effect", () => {
  it("archer, gun, bomb, spear, and cannon match the specified attack rates", () => {
    // Archer: 1 per 0.5s -> 2.0 shots/sec
    assert.strictEqual(TOWER_TYPES.archer.tiers[0].fireRate, 2.0);
    assert.strictEqual(getTowerCooldown("archer", 1), 0.5);

    // Gun: 1 per 1.0s -> 1.0 shots/sec
    assert.strictEqual(TOWER_TYPES.gun.tiers[0].fireRate, 1.0);
    assert.strictEqual(getTowerCooldown("gun", 1), 1.0);

    // Bomb: 1 per 2.0s -> 0.5 shots/sec
    assert.strictEqual(TOWER_TYPES.bomb.tiers[0].fireRate, 0.5);
    assert.strictEqual(getTowerCooldown("bomb", 1), 2.0);

    // Spear: 1 per 1.0s -> 1.0 shots/sec
    assert.strictEqual(TOWER_TYPES.spear.tiers[0].fireRate, 1.0);
    assert.strictEqual(getTowerCooldown("spear", 1), 1.0);

    // Cannon: 1 per 3.0s -> 0.333333 shots/sec
    assert.ok(Math.abs(TOWER_TYPES.cannon.tiers[0].fireRate - (1 / 3)) < 0.001);
    assert.ok(Math.abs(getTowerCooldown("cannon", 1) - 3.0) < 0.01);
  });

  it("cannon has armor pierce scaling special effect", () => {
    const cannon = TOWER_TYPES.cannon;
    assert.strictEqual(cannon.tiers[0].special?.armorPierceRatio, 0.25);
    assert.strictEqual(cannon.tiers[1].special?.armorPierceRatio, 0.50);
    assert.strictEqual(cannon.tiers[2].special?.armorPierceRatio, 0.75);
  });

  it("effectiveSpeed reduces speed by 25% when hit by 25% slow", () => {
    const baseSpeed = 100;
    const slowed = effectiveSpeed(baseSpeed, [0.25]);
    assert.strictEqual(slowed, 75, "100 base speed with 0.25 slow factor leaves 75 speed (25% reduction)");
  });
});

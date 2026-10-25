import assert from "assert";
import { selectTarget, type TargetCandidate } from "../src/game/targeting.js";

/**
 * Unit tests for tower target selection.
 *
 * @remarks
 * Pure geometry + remaining-distance comparison; no room or network involved.
 * The priority rule is the important part: the target closest to the base
 * (smallest remaining px) wins, but only among mobs inside the tower's range.
 */
describe("selectTarget", () => {
  const tower = { x: 0, y: 0 };

  function candidate(
    id: string,
    x: number,
    y: number,
    remaining: number,
  ): TargetCandidate {
    return { id, x, y, remaining };
  }

  it("returns undefined when no candidate is in range", () => {
    const result = selectTarget([candidate("far", 500, 0, 10)], tower, 140);
    assert.strictEqual(result, undefined);
  });

  it("picks the in-range candidate closest to the base", () => {
    const result = selectTarget(
      [
        candidate("early", 10, 0, 800),
        candidate("late", -10, 0, 200),
        candidate("mid", 0, 10, 500),
      ],
      tower,
      140,
    );
    assert.strictEqual(result?.id, "late");
  });

  it("ignores nearer mobs that are further from the base", () => {
    const result = selectTarget(
      [
        candidate("close-but-early", 5, 0, 900),
        candidate("far-but-late", 100, 0, 100),
      ],
      tower,
      140,
    );
    assert.strictEqual(result?.id, "far-but-late");
  });

  it("only considers candidates within range", () => {
    const result = selectTarget(
      [
        candidate("out-of-range", 500, 0, 1),
        candidate("in-range", 20, 0, 900),
      ],
      tower,
      140,
    );
    assert.strictEqual(result?.id, "in-range");
  });

  it("treats the range boundary as inclusive", () => {
    const result = selectTarget([candidate("edge", 140, 0, 500)], tower, 140);
    assert.strictEqual(result?.id, "edge");
  });

  it("compares by remaining distance across tracks of different length", () => {
    // Both mobs sit on shared geometry at the same spot, but the shorter track
    // leaves less distance to the base. Remaining distance must break the tie.
    const result = selectTarget(
      [
        candidate("long-track", 30, 0, 420),
        candidate("short-track", 30, 0, 120),
      ],
      tower,
      140,
    );
    assert.strictEqual(result?.id, "short-track");
  });

  it("prioritizes an in-range taunting unit over a closer-to-base normal unit", () => {
    const result = selectTarget(
      [
        candidate("fast-front-runner", 20, 0, 100),
        { ...candidate("shield-guy-behind", 60, 0, 600), taunt: true },
      ],
      tower,
      140,
    );
    assert.strictEqual(result?.id, "shield-guy-behind");
  });

  it("picks the taunting unit closest to the base when multiple taunters are in range", () => {
    const result = selectTarget(
      [
        { ...candidate("shield-early", 40, 0, 700), taunt: true },
        { ...candidate("shield-late", 50, 0, 350), taunt: true },
        candidate("runner-ahead", 10, 0, 100),
      ],
      tower,
      140,
    );
    assert.strictEqual(result?.id, "shield-late");
  });

  it("ignores an out-of-range taunting unit", () => {
    const result = selectTarget(
      [
        { ...candidate("shield-out-of-range", 200, 0, 50), taunt: true },
        candidate("normal-in-range", 40, 0, 500),
      ],
      tower,
      140,
    );
    assert.strictEqual(result?.id, "normal-in-range");
  });
});

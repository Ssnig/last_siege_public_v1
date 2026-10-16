import assert from "assert";
import { selectTarget, type TargetCandidate } from "../src/game/targeting.js";

/**
 * Unit tests for tower target selection.
 *
 * @remarks
 * Pure geometry + progress comparison; no room or network involved. The
 * priority rule is the important part: the target closest to the base (highest
 * progress) wins, but only among mobs inside the tower's range.
 */
describe("selectTarget", () => {
  const tower = { x: 0, y: 0 };

  function candidate(
    id: string,
    x: number,
    y: number,
    progress: number,
  ): TargetCandidate {
    return { id, x, y, progress };
  }

  it("returns undefined when no candidate is in range", () => {
    const result = selectTarget([candidate("far", 500, 0, 0.9)], tower, 140);
    assert.strictEqual(result, undefined);
  });

  it("picks the in-range candidate with the highest progress", () => {
    const result = selectTarget(
      [
        candidate("early", 10, 0, 0.2),
        candidate("late", -10, 0, 0.8),
        candidate("mid", 0, 10, 0.5),
      ],
      tower,
      140,
    );
    assert.strictEqual(result?.id, "late");
  });

  it("ignores nearer mobs that are further from the base", () => {
    const result = selectTarget(
      [
        candidate("close-but-early", 5, 0, 0.1),
        candidate("far-but-late", 100, 0, 0.9),
      ],
      tower,
      140,
    );
    assert.strictEqual(result?.id, "far-but-late");
  });

  it("only considers candidates within range", () => {
    const result = selectTarget(
      [
        candidate("out-of-range", 500, 0, 0.99),
        candidate("in-range", 20, 0, 0.1),
      ],
      tower,
      140,
    );
    assert.strictEqual(result?.id, "in-range");
  });

  it("treats the range boundary as inclusive", () => {
    const result = selectTarget([candidate("edge", 140, 0, 0.5)], tower, 140);
    assert.strictEqual(result?.id, "edge");
  });
});

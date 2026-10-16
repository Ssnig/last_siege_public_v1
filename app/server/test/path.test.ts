import assert from "assert";
import {
  DEFAULT_WANDER,
  MOB_SPEED_JITTER,
  SAMPLE_MAP,
  SIM_STEP_SEC,
  SIM_TICK_HZ,
  lateralOffset,
  pathLength,
  samplePath,
  samplePathWithLateral,
  type Vec2,
} from "@root/shared";

/**
 * Guards `@root/shared`'s `path.ts`, the geometry both the server sim and the
 * client renderer depend on.
 *
 * @remarks
 * These pin the *contract* (arc-length parametrisation, determinism, corridor
 * clamping) rather than exact art tuning, so balance edits to
 * `DEFAULT_WANDER` don't break them.
 */
describe("path.ts", () => {
  const assertClose = (actual: number, expected: number, eps = 1e-9) =>
    assert.ok(
      Math.abs(actual - expected) <= eps,
      `expected ${actual} to be within ${eps} of ${expected}`,
    );

  describe("pathLength", () => {
    it("sums segment lengths", () => {
      // SAMPLE_MAP: 300 + 200 + 300 + 200 + 180 = 1180
      assert.strictEqual(pathLength(SAMPLE_MAP.path), 1180);
    });

    it("is zero for empty, single-point and zero-length paths", () => {
      assert.strictEqual(pathLength([]), 0);
      assert.strictEqual(pathLength([{ x: 5, y: 5 }]), 0);
      assert.strictEqual(pathLength([{ x: 5, y: 5 }, { x: 5, y: 5 }]), 0);
    });
  });

  describe("samplePath", () => {
    const path = SAMPLE_MAP.path;

    it("returns the endpoints at t = 0 and t = 1", () => {
      const start = samplePath(path, 0);
      assertClose(start.x, 0);
      assertClose(start.y, 100);

      const end = samplePath(path, 1);
      assertClose(end.x, 780);
      assertClose(end.y, 500);
    });

    it("clamps t outside [0, 1]", () => {
      const below = samplePath(path, -3);
      assertClose(below.x, 0);
      const above = samplePath(path, 4);
      assertClose(above.x, 780);
    });

    it("is parametrised by distance, not waypoint index", () => {
      // Cumulative distances: v0=0, v1=300, v2=500, v3=800, v4=1000, v5=1180.
      // Hitting each cumulative distance must land exactly on that waypoint.
      const v1 = samplePath(path, 300 / 1180);
      assertClose(v1.x, 300);
      assertClose(v1.y, 100);

      const v2 = samplePath(path, 500 / 1180);
      assertClose(v2.x, 300);
      assertClose(v2.y, 300);

      const v3 = samplePath(path, 800 / 1180);
      assertClose(v3.x, 600);
      assertClose(v3.y, 300);
    });

    it("reports the heading of the current segment", () => {
      const horizontal = samplePath(path, 0.1); // on (0,100)->(300,100)
      assertClose(horizontal.angle, 0);

      const downward = samplePath(path, 0.4); // on (300,100)->(300,300)
      assertClose(downward.angle, Math.PI / 2);
    });

    it("handles empty and single-point paths without throwing", () => {
      assert.deepStrictEqual(samplePath([], 0.5), { x: 0, y: 0, angle: 0 });
      const one = samplePath([{ x: 7, y: 9 }], 0.5);
      assertClose(one.x, 7);
      assertClose(one.y, 9);
      assertClose(one.angle, 0);
    });
  });

  describe("lateralOffset", () => {
    it("is deterministic for the same seed and t", () => {
      for (const seed of [0, 1, 42, 99999]) {
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
          assert.strictEqual(lateralOffset(seed, t), lateralOffset(seed, t));
        }
      }
    });

    it("always stays within [-1, 1]", () => {
      for (let seed = 0; seed < 500; seed++) {
        for (let i = 0; i <= 20; i++) {
          const v = lateralOffset(seed, i / 20);
          assert.ok(v >= -1 && v <= 1, `offset ${v} out of range for seed ${seed}`);
        }
      }
    });

    it("varies across seeds", () => {
      const values = new Set<number>();
      for (let seed = 0; seed < 50; seed++) values.add(lateralOffset(seed, 0.5));
      assert.ok(values.size > 1, "different seeds should produce different drift");
    });

    it("stays within the configured lane spread band", () => {
      // |offset| can never exceed laneSpread + wobbleMax before clamping.
      const bound = DEFAULT_WANDER.laneSpread + DEFAULT_WANDER.wobbleMax;
      for (let seed = 0; seed < 500; seed++) {
        assert.ok(Math.abs(lateralOffset(seed, 0.5)) <= bound);
      }
    });
  });

  describe("samplePathWithLateral", () => {
    const path = SAMPLE_MAP.path;
    const halfWidth = SAMPLE_MAP.pathHalfWidth ?? 0;

    it("offsets perpendicular by exactly lateralOffset * halfWidth", () => {
      for (const seed of [3, 17, 256]) {
        for (const t of [0.1, 0.5, 0.9]) {
          const base = samplePath(path, t);
          const drifted = samplePathWithLateral(path, t, seed, halfWidth);
          const distance = Math.hypot(drifted.x - base.x, drifted.y - base.y);
          const expected = Math.abs(lateralOffset(seed, t)) * halfWidth;
          assertClose(distance, expected);
        }
      }
    });

    it("keeps the centreline heading rather than the wobble tangent", () => {
      const base = samplePath(path, 0.4);
      const drifted = samplePathWithLateral(path, 0.4, 123, halfWidth);
      assertClose(drifted.angle, base.angle);
    });

    it("respects the corridor half-width", () => {
      for (let seed = 0; seed < 200; seed++) {
        const base = samplePath(path, 0.5);
        const drifted = samplePathWithLateral(path, 0.5, seed, halfWidth);
        const distance = Math.hypot(drifted.x - base.x, drifted.y - base.y);
        assert.ok(distance <= halfWidth + 1e-9, `drifted ${distance} beyond half-width`);
      }
    });

    it("is a no-op when halfWidth is zero", () => {
      const base = samplePath(path, 0.33);
      const drifted = samplePathWithLateral(path, 0.33, 7, 0);
      assertClose(drifted.x, base.x);
      assertClose(drifted.y, base.y);
    });
  });

  describe("simulation constants", () => {
    it("exposes a positive tick rate with a consistent derived step", () => {
      assert.ok(SIM_TICK_HZ > 0);
      assertClose(SIM_STEP_SEC, 1 / SIM_TICK_HZ);
    });

    it("keeps speed jitter a small positive fraction", () => {
      assert.ok(MOB_SPEED_JITTER > 0 && MOB_SPEED_JITTER < 1);
    });

    it("defines a geometrically valid wander config", () => {
      assert.ok(DEFAULT_WANDER.laneSpread >= 0 && DEFAULT_WANDER.laneSpread <= 1);
      assert.ok(DEFAULT_WANDER.wobbleMin >= 0);
      assert.ok(DEFAULT_WANDER.wobbleMax >= DEFAULT_WANDER.wobbleMin);
      assert.ok(DEFAULT_WANDER.cyclesMin > 0);
      assert.ok(DEFAULT_WANDER.cyclesMax >= DEFAULT_WANDER.cyclesMin);
    });
  });

  it("exports no surprises for the map path shape", () => {
    const isVec2 = (p: Vec2) => Number.isFinite(p.x) && Number.isFinite(p.y);
    for (const map of [SAMPLE_MAP]) {
      assert.ok(map.path.every(isVec2));
      assert.ok((map.pathHalfWidth ?? 0) > 0);
    }
  });
});

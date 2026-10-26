import assert from "assert";
import {
  SAMPLE_MAP,
  KONBAUNG_MAP,
  MERGE_MAP,
  FORK_MAP,
  mapPathIds,
  mapPath,
  mapPortals,
  portalShouldFlipX,
  INNWA_MAP,
  BAGAN_MAP,
  MANDALAY_MAP,
  type MapDefinition,
} from "@root/shared";

/** Serialises a point for easy set/equality assertions. */
function pt(p: { x: number; y: number }): string {
  return `${p.x},${p.y}`;
}

/**
 * Unit tests for the multi-track map helpers.
 *
 * @remarks
 * Shared geometry is authored by duplicating waypoints, so a fork shares its
 * leading points and a merge shares its trailing ones. These tests pin that
 * contract down without booting a room.
 */
describe("map path helpers", () => {
  it("reports a single 'main' track for a single-path map", () => {
    assert.deepStrictEqual(mapPathIds(SAMPLE_MAP), ["main"]);
    assert.strictEqual(mapPath(SAMPLE_MAP, "main"), SAMPLE_MAP.path);
  });

  it("lists named tracks in authoring order", () => {
    assert.deepStrictEqual(mapPathIds(KONBAUNG_MAP), ["top", "bottom"]);
    assert.deepStrictEqual(mapPathIds(MERGE_MAP), ["upper", "middle", "lower"]);
    assert.deepStrictEqual(mapPathIds(FORK_MAP), ["left", "right"]);
  });

  it("resolves named tracks and rejects unknown ids", () => {
    assert.strictEqual(mapPath(KONBAUNG_MAP, "top"), KONBAUNG_MAP.paths?.top);
    assert.strictEqual(mapPath(MERGE_MAP, "lower"), MERGE_MAP.paths?.lower);
    assert.strictEqual(mapPath(SAMPLE_MAP, "nope"), undefined);
  });

  it("ignores tracks shorter than two points", () => {
    const map: MapDefinition = {
      id: "degenerate",
      path: [],
      paths: { good: [{ x: 0, y: 0 }, { x: 10, y: 0 }], bad: [{ x: 0, y: 0 }] },
      slots: [],
      checkpoints: [],
      base: { x: 0, y: 0 },
    };
    assert.deepStrictEqual(mapPathIds(map), ["good"]);
    assert.strictEqual(mapPath(map, "bad")?.length, 1);
  });

  it("models a merge: three spawns, two of which share a tail", () => {
    const ids = mapPathIds(MERGE_MAP);
    assert.strictEqual(ids.length, 3, "three registered tracks");

    const starts = new Set(
      ids.map((id) => pt(mapPath(MERGE_MAP, id)![0])),
    );
    assert.strictEqual(starts.size, 3, "each merge track has its own spawn");

    const tail = (id: string) => mapPath(MERGE_MAP, id)!.slice(-2).map(pt).join("|");
    assert.strictEqual(tail("upper"), tail("middle"), "upper and middle fuse");
    assert.notStrictEqual(tail("upper"), tail("lower"), "lower stays separate");
  });

  it("models a fork: two tracks sharing one spawn head", () => {
    const ids = mapPathIds(FORK_MAP);
    assert.strictEqual(ids.length, 2);

    const starts = new Set(ids.map((id) => pt(mapPath(FORK_MAP, id)![0])));
    assert.strictEqual(starts.size, 1, "both branches spawn from one portal");

    const head = (id: string) => mapPath(FORK_MAP, id)!.slice(0, 3).map(pt).join("|");
    assert.strictEqual(head("left"), head("right"), "shared head");

    const headEnd = (id: string) => pt(mapPath(FORK_MAP, id)![2]);
    assert.strictEqual(headEnd("left"), headEnd("right"));

    const afterFork = (id: string) => pt(mapPath(FORK_MAP, id)![3]);
    assert.notStrictEqual(afterFork("left"), afterFork("right"), "diverges after the head");
  });
});

/**
 * Unit tests for deploy portals derived from track spawn points.
 *
 * @remarks Portals are never authored in map JSON: they are the distinct spawn
 * points, so the ids the server validates against always match what the client
 * draws.
 */
describe("map portals", () => {
  it("derives one portal per distinct spawn point in authoring order", () => {
    const portals = mapPortals(MERGE_MAP);
    assert.deepStrictEqual(
      portals.map((portal) => portal.id),
      ["portal-0", "portal-1", "portal-2"],
    );
    assert.deepStrictEqual(
      portals.map((portal) => portal.pathIds),
      [["upper"], ["middle"], ["lower"]],
    );
    assert.deepStrictEqual(pt(portals[0]), pt(mapPath(MERGE_MAP, "upper")![0]));
  });

  it("collapses fork branches sharing a spawn into a single portal", () => {
    const portals = mapPortals(FORK_MAP);
    assert.strictEqual(portals.length, 1, "a fork has one shared portal");
    assert.deepStrictEqual(portals[0].pathIds, ["left", "right"]);
  });

  it("gives a single-path map one 'main' portal", () => {
    const portals = mapPortals(SAMPLE_MAP);
    assert.strictEqual(portals.length, 1);
    assert.deepStrictEqual(portals[0].pathIds, ["main"]);
    assert.deepStrictEqual(pt(portals[0]), pt(SAMPLE_MAP.path[0]));
  });

  it("ignores tracks shorter than two points", () => {
    const map: MapDefinition = {
      id: "degenerate",
      path: [],
      paths: { good: [{ x: 0, y: 0 }, { x: 10, y: 0 }], bad: [{ x: 0, y: 0 }] },
      slots: [],
      checkpoints: [],
      base: { x: 0, y: 0 },
    };
    const portals = mapPortals(map);
    assert.strictEqual(portals.length, 1);
    assert.deepStrictEqual(portals[0].pathIds, ["good"]);
  });

  it("applies per-portal charge overrides from portalOverrides", () => {
    const map: MapDefinition = {
      id: "overridden",
      path: [],
      paths: {
        near: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        far: [{ x: 5, y: 5 }, { x: 5, y: 20 }],
      },
      slots: [],
      checkpoints: [],
      base: { x: 0, y: 0 },
      portalOverrides: { "portal-1": { maxCharges: 1, chargeSec: 45 } },
    };
    const portals = mapPortals(map);
    assert.strictEqual(portals.length, 2);

    // The near portal keeps the global defaults.
    assert.strictEqual(portals[0].maxCharges, undefined);
    assert.strictEqual(portals[0].chargeSec, undefined);

    // The far portal is the slower, single-charge one the map author configured.
    assert.strictEqual(portals[1].maxCharges, 1);
    assert.strictEqual(portals[1].chargeSec, 45);
  });

  it("uses editor-exported portal positions and attaches each track to the nearest", () => {
    const map: MapDefinition = {
      id: "editor",
      path: [],
      paths: {
        // Spawns sit a little off the authored portal positions, as the editor exports.
        north: [{ x: 468, y: 59 }, { x: 468, y: 200 }],
        east: [{ x: 1260, y: 180 }, { x: 900, y: 180 }],
        south: [{ x: 929, y: 677 }, { x: 929, y: 400 }],
      },
      portals: [
        { x: 468, y: 38 },
        { x: 1084, y: 180 },
        { x: 927, y: 708 },
      ],
      slots: [],
      checkpoints: [],
      base: { x: 0, y: 0 },
    };
    const portals = mapPortals(map);

    // Positions come from the explicit list, not the path spawns.
    assert.deepStrictEqual(
      portals.map((portal) => [portal.x, portal.y]),
      [[468, 38], [1084, 180], [927, 708]],
    );

    // Every track lands on the portal nearest its spawn, so all are deployable.
    assert.strictEqual(portals.length, 3);
    assert.deepStrictEqual(portals[0].pathIds, ["north"]);
    assert.deepStrictEqual(portals[1].pathIds, ["east"]);
    assert.deepStrictEqual(portals[2].pathIds, ["south"]);
  });

  it("drops an explicit portal no track can reach", () => {
    const map: MapDefinition = {
      id: "stray",
      path: [],
      paths: { main: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
      portals: [
        { x: 0, y: 0 },
        { x: 9000, y: 9000 },
      ],
      slots: [],
      checkpoints: [],
      base: { x: 0, y: 0 },
    };
    const portals = mapPortals(map);
    assert.strictEqual(portals.length, 1, "the unreachable portal is not offered");
    // Ids stay tied to the editor's list order, so overrides keep lining up.
    assert.strictEqual(portals[0].id, "portal-0");
  });

  describe("portalShouldFlipX", () => {
    it("returns false for tracks heading right (dx > 0)", () => {
      const map: MapDefinition = {
        id: "right_track",
        path: [],
        paths: { main: [{ x: 50, y: 100 }, { x: 300, y: 100 }] },
        slots: [],
        checkpoints: [],
        base: { x: 600, y: 100 },
      };
      const portal = mapPortals(map)[0];
      assert.strictEqual(portalShouldFlipX(map, portal), false);
    });

    it("returns true for tracks heading left (dx < 0)", () => {
      const map: MapDefinition = {
        id: "left_track",
        path: [],
        paths: { main: [{ x: 1200, y: 100 }, { x: 900, y: 100 }] },
        slots: [],
        checkpoints: [],
        base: { x: 200, y: 100 },
      };
      const portal = mapPortals(map)[0];
      assert.strictEqual(portalShouldFlipX(map, portal), true);
    });

    it("respects explicit flipX override in portalOverrides", () => {
      const map: MapDefinition = {
        id: "override_flip",
        path: [],
        paths: { main: [{ x: 50, y: 100 }, { x: 300, y: 100 }] },
        slots: [],
        checkpoints: [],
        base: { x: 600, y: 100 },
        portalOverrides: { "portal-0": { flipX: true } },
      };
      const portal = mapPortals(map)[0];
      assert.strictEqual(portalShouldFlipX(map, portal), true);
    });

    it("evaluates real canonical battlefields accurately", () => {
      // Innwa: portal-0 heads right (false), portal-1 heads left (true)
      const innwaPortals = mapPortals(INNWA_MAP);
      assert.strictEqual(portalShouldFlipX(INNWA_MAP, innwaPortals[0]), false);
      assert.strictEqual(portalShouldFlipX(INNWA_MAP, innwaPortals[1]), true);

      // Bagan: portal-0 and portal-1 head right (false), portal-2 heads left (true)
      const baganPortals = mapPortals(BAGAN_MAP);
      assert.strictEqual(portalShouldFlipX(BAGAN_MAP, baganPortals[0]), false);
      assert.strictEqual(portalShouldFlipX(BAGAN_MAP, baganPortals[1]), false);
      assert.strictEqual(portalShouldFlipX(BAGAN_MAP, baganPortals[2]), true);

      // Mandalay: east bridge portal heads left (true)
      const mandalayPortals = mapPortals(MANDALAY_MAP);
      assert.strictEqual(portalShouldFlipX(MANDALAY_MAP, mandalayPortals[1]), true);
    });
  });
});

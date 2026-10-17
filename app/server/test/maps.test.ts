import assert from "assert";
import {
  SAMPLE_MAP,
  KONBAUNG_MAP,
  MERGE_MAP,
  FORK_MAP,
  mapPathIds,
  mapPath,
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

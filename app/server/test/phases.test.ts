import assert from "assert";
import { RoomState, Player, MATCH_PHASES, MATCH_RULES, type MatchRules } from "@root/shared";
import { Phases } from "../src/game/phases.js";

/**
 * Unit tests for the drafting/building phase machine.
 *
 * @remarks
 * Pure logic over a constructible `RoomState` — no room or network needed.
 * Combat/gameover stay dormant until a building → combat trigger exists.
 */
describe("Phases", () => {
  function makeRoom(ids: string[] = ["a", "b"], rules: MatchRules = MATCH_RULES) {
    const state = new RoomState();
    for (const [index, id] of ids.entries()) {
      const role = index % 2 === 0 ? "attacker" : "defender";
      state.players.set(id, new Player({ name: id, role }));
    }
    return { state, phases: new Phases({ state }, rules) };
  }

  it("defaults to drafting with no countdown armed (draftDurationSec: -1)", () => {
    const { phases, state } = makeRoom();
    assert.strictEqual(phases.phase, MATCH_PHASES.drafting);
    assert.strictEqual(state.phaseEndsAt, 0);
    assert.ok(phases.is(MATCH_PHASES.drafting));
    assert.strictEqual(phases.update(5), null);
    assert.strictEqual(state.phaseEndsAt, 0);
  });

  it("beginDraft needs two players", () => {
    const { phases } = makeRoom(["a"]);
    assert.strictEqual(phases.beginDraft(), null);
    assert.strictEqual(phases.phase, MATCH_PHASES.drafting);
  });

  it("beginDraft clears stale readiness and opens a fresh, disarmed window", () => {
    const { phases, state } = makeRoom();
    state.players.get("a").draftReady = true;

    const event = phases.beginDraft();
    assert.deepStrictEqual(event, { type: "draft-started" });
    assert.strictEqual(phases.phase, MATCH_PHASES.drafting);
    assert.strictEqual(state.phaseEndsAt, 0);
    for (const p of state.players.values()) assert.strictEqual(p.draftReady, false);
  });

  it("beginMapReveal needs two players", () => {
    const { phases } = makeRoom(["a"]);
    assert.strictEqual(phases.beginMapReveal(), null);
    assert.strictEqual(phases.phase, MATCH_PHASES.drafting);
  });

  it("beginMapReveal opens an armed reveal window and clears readiness", () => {
    const { phases, state } = makeRoom();
    state.players.get("a").draftReady = true;

    const event = phases.beginMapReveal();
    assert.deepStrictEqual(event, { type: "map-reveal-started" });
    assert.strictEqual(phases.phase, MATCH_PHASES.mapReveal);
    assert.strictEqual(state.phaseEndsAt, MATCH_RULES.mapRevealDurationSec);
    for (const p of state.players.values()) assert.strictEqual(p.draftReady, false);
  });

  it("a reveal countdown elapses into an unarmed drafting", () => {
    const { phases, state } = makeRoom();
    phases.beginMapReveal();

    assert.strictEqual(phases.update(1), null);
    assert.strictEqual(phases.phase, MATCH_PHASES.mapReveal);
    assert.strictEqual(state.phaseEndsAt, MATCH_RULES.mapRevealDurationSec - 1);

    state.phaseEndsAt = 0.1;
    assert.deepStrictEqual(phases.update(0.5), { type: "draft-started" });
    assert.strictEqual(phases.phase, MATCH_PHASES.drafting);
    assert.strictEqual(state.phaseEndsAt, 0);
  });

  it("a disabled reveal falls straight through to drafting", () => {
    const { phases } = makeRoom(["a", "b"], { ...MATCH_RULES, mapRevealDurationSec: 0 });
    phases.beginMapReveal();
    assert.strictEqual(phases.phase, MATCH_PHASES.mapReveal);

    assert.deepStrictEqual(phases.update(0.02), { type: "draft-started" });
    assert.strictEqual(phases.phase, MATCH_PHASES.drafting);
  });

  it("a -1 (or 0) duration never times out, even with a huge dt", () => {
    const { phases, state } = makeRoom();
    phases.beginDraft();
    phases.onDraftReady("a");

    assert.strictEqual(phases.update(60_000), null);
    assert.strictEqual(phases.phase, MATCH_PHASES.drafting);
    assert.strictEqual(state.phaseEndsAt, 0);
    assert.strictEqual(state.players.get("b").draftReady, false);
  });

  it("onDraftReady moves to building once both have confirmed", () => {
    const { phases, state } = makeRoom();
    phases.beginDraft();

    assert.strictEqual(phases.onDraftReady("a"), null);
    assert.strictEqual(phases.phase, MATCH_PHASES.drafting);

    const event = phases.onDraftReady("b");
    assert.deepStrictEqual(event, { type: "building-started", autoCompleted: [] });
    assert.strictEqual(phases.phase, MATCH_PHASES.building);
    assert.strictEqual(state.phaseEndsAt, MATCH_RULES.buildingDurationSec);
  });

  it("building has countdown: clock runs and updates phaseEndsAt while open", () => {
    const { phases, state } = makeRoom();
    phases.beginDraft();
    phases.onDraftReady("a");
    phases.onDraftReady("b");

    assert.strictEqual(state.phaseEndsAt, MATCH_RULES.buildingDurationSec);
    assert.strictEqual(phases.update(5), null);
    assert.strictEqual(state.phaseEndsAt, MATCH_RULES.buildingDurationSec - 5);
  });

  it("when armed, a draft timeout auto-completes the laggard into building", () => {
    const { phases, state } = makeRoom(["a", "b"], {
      ...MATCH_RULES,
      draftDurationSec: 3,
    });
    phases.beginDraft();
    assert.strictEqual(state.phaseEndsAt, 3);

    phases.onDraftReady("a");
    assert.strictEqual(phases.update(1), null);
    assert.strictEqual(state.phaseEndsAt, 2);

    state.phaseEndsAt = 0.1;
    const event = phases.update(0.5);
    assert.deepStrictEqual(event, { type: "building-started", autoCompleted: ["b"] });
    assert.strictEqual(phases.phase, MATCH_PHASES.building);
    assert.strictEqual(state.players.get("b").draftReady, true);
    assert.strictEqual(state.players.get("a").draftReady, true);
  });

  it("re-syncs with an external phase change (GameRoom advances directly)", () => {
    const { phases, state } = makeRoom();
    phases.beginDraft();

    state.phase = MATCH_PHASES.building;
    assert.ok(phases.is(MATCH_PHASES.building));
    assert.strictEqual(phases.update(5), null);
  });

  it("reset() returns to an unarmed drafting for the next opponent", () => {
    const { phases, state } = makeRoom();
    phases.beginDraft();
    phases.onDraftReady("a");
    phases.onDraftReady("b");
    assert.strictEqual(phases.phase, MATCH_PHASES.building);

    phases.reset();
    assert.strictEqual(phases.phase, MATCH_PHASES.drafting);
    assert.strictEqual(state.phaseEndsAt, 0);
    assert.strictEqual(state.winner, "");
    for (const p of state.players.values()) assert.strictEqual(p.draftReady, false);
  });

  it("the siege timer expires without ending the match", () => {
    const { phases, state } = makeRoom(["a", "b"], {
      ...MATCH_RULES,
      siegeDurationSec: 3,
    });
    phases.beginDraft();
    phases.onDraftReady("a");
    phases.onDraftReady("b");
    phases.beginCombat([]);
    assert.strictEqual(state.phaseEndsAt, 3);

    assert.strictEqual(phases.update(1), null);
    assert.strictEqual(state.phaseEndsAt, 2);

    state.phaseEndsAt = 0.1;
    assert.deepStrictEqual(phases.update(0.5), { type: "siege-expired" });
    assert.strictEqual(phases.phase, MATCH_PHASES.combat, "the timer does not end the match");
    assert.strictEqual(state.winner, "", "the timer declares no winner");
    assert.strictEqual(state.phaseEndsAt, 0);

    // Once spent, the clock stays silent and the phase machine is inert.
    assert.strictEqual(phases.update(5), null);
    assert.strictEqual(phases.phase, MATCH_PHASES.combat);
  });

  it("declareGameOver fires from drafting/building/combat but never waiting or gameover", () => {
    const { phases, state } = makeRoom();

    state.phase = MATCH_PHASES.waiting;
    assert.ok(phases.is(MATCH_PHASES.waiting));
    assert.strictEqual(phases.declareGameOver("attacker"), null);
    assert.strictEqual(phases.phase, MATCH_PHASES.waiting);

    state.phase = MATCH_PHASES.drafting;
    assert.ok(phases.is(MATCH_PHASES.drafting));
    const event = phases.declareGameOver("defender");
    assert.deepStrictEqual(event, { type: "gameover", winner: "defender" });
    assert.strictEqual(phases.phase, MATCH_PHASES.gameover);
    assert.strictEqual(state.winner, "defender");

    assert.strictEqual(phases.declareGameOver("attacker"), null);
    assert.strictEqual(state.winner, "defender");
  });
});
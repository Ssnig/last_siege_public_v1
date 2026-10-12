import assert from "assert";
import { RoomState, Player, MATCH_PHASES, MATCH_RULES } from "@root/shared";
import { Phases } from "../src/game/phases.js";

/**
 * Unit tests for the waiting/draft/combat/gameover state machine.
 *
 * @remarks
 * Pure logic over a constructible `RoomState` — no room or network needed.
 */
describe("Phases", () => {
  function makeRoom(roles: Array<[string, "attacker" | "defender"]>) {
    const state = new RoomState();
    for (const [id, role] of roles) {
      state.players.set(id, new Player({ name: id, role }));
    }
    return { state, phases: new Phases({ state }) };
  }

  it("starts in waiting with no countdown armed", () => {
    const { phases, state } = makeRoom([["a", "attacker"], ["b", "defender"]]);
    assert.strictEqual(phases.phase, MATCH_PHASES.waiting);
    assert.strictEqual(state.phaseEndsAt, 0);
    assert.ok(phases.is("waiting"));
    assert.strictEqual(phases.update(5), null);
    assert.strictEqual(state.phaseEndsAt, 0);
  });

  it("waiting needs two players before beginDraft can start a draft", () => {
    const { phases, state } = makeRoom([["a", "attacker"]]);
    assert.strictEqual(phases.beginDraft(), null);
    assert.strictEqual(phases.phase, MATCH_PHASES.waiting);
    assert.strictEqual(state.phaseEndsAt, 0);
  });

  it("beginDraft grants the full draft window and clears stale readiness", () => {
    const { phases, state } = makeRoom([["a", "attacker"], ["b", "defender"]]);
    state.players.get("a").draftReady = true;

    const event = phases.beginDraft();
    assert.deepStrictEqual(event, { type: "draft-started" });
    assert.strictEqual(phases.phase, MATCH_PHASES.drafting);
    assert.strictEqual(state.phaseEndsAt, MATCH_RULES.draftDurationSec);
    for (const p of state.players.values()) assert.strictEqual(p.draftReady, false);
  });

  it("starts combat only when both players draftReady", () => {
    const { phases, state } = makeRoom([["a", "attacker"], ["b", "defender"]]);
    phases.beginDraft();

    assert.strictEqual(phases.onDraftReady("a"), null);
    assert.strictEqual(phases.phase, MATCH_PHASES.drafting);

    const event = phases.onDraftReady("b");
    assert.deepStrictEqual(event, { type: "combat-started", autoCompleted: [] });
    assert.strictEqual(phases.phase, MATCH_PHASES.combat);

    const defender = state.players.get("b");
    assert.strictEqual(defender.hp, MATCH_RULES.coreHp);
    assert.strictEqual(state.players.get("a").hp, 0); // attacker has no core
    assert.strictEqual(state.phaseEndsAt, MATCH_RULES.roundDurationSec);
  });

  it("draft timeout auto-completes the laggard and reports them", () => {
    const { phases, state } = makeRoom([["a", "attacker"], ["b", "defender"]]);
    phases.beginDraft();
    phases.onDraftReady("a");

    state.phaseEndsAt = 0.1;
    const event = phases.update(0.5);
    assert.deepStrictEqual(event, { type: "combat-started", autoCompleted: ["b"] });
    assert.strictEqual(state.players.get("b").draftReady, true);
  });

  it("combat countdown ticks down and a timeout means the defender survived", () => {
    const { phases, state } = makeRoom([["a", "attacker"], ["b", "defender"]]);
    phases.beginDraft();
    phases.onDraftReady("a");
    phases.onDraftReady("b");

    assert.strictEqual(phases.update(0.5), null);
    assert.strictEqual(state.phaseEndsAt, MATCH_RULES.roundDurationSec - 0.5);

    state.phaseEndsAt = 0.1;
    const event = phases.update(0.5);
    assert.deepStrictEqual(event, { type: "gameover", winner: "defender" });
    assert.strictEqual(state.winner, "defender");
  });

  it("declareGameOver records an attacker win and becomes terminal", () => {
    const { phases, state } = makeRoom([["a", "attacker"], ["b", "defender"]]);
    phases.beginDraft();
    phases.onDraftReady("a");
    phases.onDraftReady("b");

    const before = state.phaseEndsAt;
    const event = phases.declareGameOver("attacker");
    assert.deepStrictEqual(event, { type: "gameover", winner: "attacker" });
    assert.strictEqual(phases.phase, MATCH_PHASES.gameover);

    assert.strictEqual(phases.update(1), null); // no drift, no events
    assert.strictEqual(state.phaseEndsAt, before);
    assert.strictEqual(phases.declareGameOver("defender"), null);
  });

  it("reset() returns to waiting with timers disarmed for the next opponent", () => {
    const { phases, state } = makeRoom([["a", "attacker"], ["b", "defender"]]);
    phases.beginDraft();
    phases.onDraftReady("a");
    phases.onDraftReady("b");
    phases.declareGameOver("attacker");

    phases.reset();
    assert.strictEqual(phases.phase, MATCH_PHASES.waiting);
    assert.strictEqual(state.winner, "");
    assert.strictEqual(state.phaseEndsAt, 0);
    for (const p of state.players.values()) assert.strictEqual(p.draftReady, false);
  });
});
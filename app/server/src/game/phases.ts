import { RoomState, MATCH_PHASES, MATCH_RULES, type MatchPhase, type MatchRules } from "@root/shared";
import type { PlayerRole } from "../rooms/GameRoom.js";

/** One-shot result of a `Phases` call; `null` means "nothing changed". */
export type PhaseEvent =
  | { type: "draft-started" }
  | { type: "combat-started"; autoCompleted: string[] }
  | { type: "gameover"; winner: PlayerRole };

/**
 * Owns the waiting → drafting → combat → gameover state machine.
 *
 * @remarks
 * Drives `RoomState.phase`/`phaseEndsAt`/`winner` and returns one-shot events so
 * the caller (GameRoom tick, future `actions.ts`) can react without Phases
 * knowing about decks, economy, or waves. `waiting` runs no timers: both players
 * must signal `ready` (via `beginDraft`) before the draft clock is armed *in
 * full*, so a late joiner never inherits another player's leftover time. A draft
 * timeout auto-completes a laggard's `draftReady`; the actual fallback deck is
 * the caller's job. In this asymmetric game only the defender has a core, so
 * "survive the round" wins.
 */
export class Phases {
  phase: MatchPhase;

  private state: RoomState;
  private draftDurationSec: number;
  private roundDurationSec: number;
  private coreHp: number;

  constructor(env: { state: RoomState }, rules: MatchRules = MATCH_RULES) {
    this.state = env.state;
    this.draftDurationSec = rules.draftDurationSec;
    this.roundDurationSec = rules.roundDurationSec;
    this.coreHp = rules.coreHp;

    const current = this.state.phase;
    const known: string[] = [
      MATCH_PHASES.waiting,
      MATCH_PHASES.drafting,
      MATCH_PHASES.combat,
      MATCH_PHASES.gameover,
    ];
    this.phase = known.includes(current) ? (current as MatchPhase) : MATCH_PHASES.waiting;
    this.state.phase = this.phase;

    // Defensive: a restored mid-draft room resumes its countdown.
    if (this.phase === MATCH_PHASES.drafting && this.state.phaseEndsAt <= 0) {
      this.state.phaseEndsAt = this.draftDurationSec;
    }
  }

  /**
   * Both players are `ready` — grants the *full* draft window and starts it.
   *
   * @remarks
   * No-op before two players exist or once past drafting (e.g. rematch). Clears
   * any stale `draftReady` flags so a re-draft starts clean.
   */
  beginDraft(): PhaseEvent | null {
    if (this.state.players.size < 2) return null;
    if (this.phase === MATCH_PHASES.combat || this.phase === MATCH_PHASES.gameover) return null;

    this.phase = MATCH_PHASES.drafting;
    this.state.phase = this.phase;
    this.state.phaseEndsAt = this.draftDurationSec;
    for (const p of this.state.players.values()) {
      p.draftReady = false;
    }
    return { type: "draft-started" };
  }

  /**
   * Marks a player's draft ready; once both are in, starts combat.
   *
   * @remarks
   * Returns `null` outside drafting (including `waiting`) or if the opponent
   * hasn't readied yet.
   */
  onDraftReady(sessionId: string): PhaseEvent | null {
    if (this.phase !== MATCH_PHASES.drafting) return null;

    const player = this.state.players.get(sessionId);
    if (!player) return null;
    player.draftReady = true;

    const players = [...this.state.players.values()];
    if (players.length >= 2 && players.every((p) => p.draftReady)) {
      return this.beginCombat([]);
    }
    return null;
  }

  /**
   * Advances the active countdown: `waiting`/`gameover` are static.
   *
   * @remarks
   * Draft timeout auto-readies any laggard (event carries their sessionIds);
   * combat timeout means the defender survived and wins.
   */
  update(dt: number): PhaseEvent | null {
    if (this.phase === MATCH_PHASES.waiting || this.phase === MATCH_PHASES.gameover) return null;

    this.state.phaseEndsAt = Math.max(0, this.state.phaseEndsAt - dt);

    if (this.phase === MATCH_PHASES.drafting) {
      if (this.state.phaseEndsAt > 0) return null;
      const autoCompleted: string[] = [];
      for (const [sessionId, player] of this.state.players) {
        if (!player.draftReady) {
          player.draftReady = true;
          autoCompleted.push(sessionId);
        }
      }
      return this.beginCombat(autoCompleted);
    }

    if (this.state.phaseEndsAt <= 0) {
      return this.declareGameOver("defender");
    }
    return null;
  }

  /**
   * Immediately ends combat with the given winner (e.g. core HP hit zero).
   *
   * @remarks
   * Only meaningful from combat; elsewhere returns `null`.
   */
  declareGameOver(winner: PlayerRole): PhaseEvent | null {
    if (this.phase !== MATCH_PHASES.combat) return null;

    this.phase = MATCH_PHASES.gameover;
    this.state.phase = this.phase;
    this.state.winner = winner;
    return { type: "gameover", winner };
  }

  /**
   * Returns to `waiting` (a player left, or a rematch): timers disarmed.
   *
   * @remarks
   * `winner` is cleared via `""` — how Colyseus encodes a removed optional
   * string on this schema. `phaseEndsAt = 0` keeps the room clock stopped until
   * `beginDraft()` arms it fresh, so any newcomer gets the full draft window.
   */
  reset(): void {
    this.phase = MATCH_PHASES.waiting;
    this.state.phase = this.phase;
    this.state.winner = "";
    this.state.phaseEndsAt = 0;
    for (const player of this.state.players.values()) {
      player.draftReady = false;
    }
  }

  /** True when the current phase is one of the given ones (guard for actions). */
  is(...phases: MatchPhase[]): boolean {
    return phases.includes(this.phase);
  }

  private beginCombat(autoCompleted: string[]): PhaseEvent {
    this.phase = MATCH_PHASES.combat;
    this.state.phase = this.phase;
    this.state.phaseEndsAt = this.roundDurationSec;
    for (const player of this.state.players.values()) {
      if (player.role === "defender") player.hp = this.coreHp;
    }
    return { type: "combat-started", autoCompleted };
  }
}
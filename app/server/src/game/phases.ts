import { RoomState, MATCH_PHASES, MATCH_RULES, type GameOverReason, type MatchPhase, type MatchRules } from "@root/shared";
import type { PlayerRole } from "../rooms/GameRoom.js";

/**
 * One-shot events emitted when the phase machine decides to advance. Seams in
 * GameRoom consume these to keep the authoritative mutations in one place.
 */
export type PhaseEvent =
  | { type: "map-reveal-started" }
  | { type: "draft-started" }
  | { type: "building-started"; autoCompleted: string[] }
  | { type: "combat-started"; autoCompleted: string[] }
  | { type: "siege-expired" }
  | { type: "gameover"; winner: PlayerRole };

/**
 * Owns the map-reveal → drafting → building → combat → gameover phase machine
 * plus the optional countdown timers. Drives
 * `RoomState.phase`/`phaseEndsAt`/`winner` and returns one-shot events so hooks
 * in GameRoom can react (e.g. auto-fill a laggard's deck when a team's time runs
 * out).
 *
 * Timers: a `mapRevealDurationSec`/`draftDurationSec`/`siegeDurationSec` of `-1`
 * (or any non-positive value) disables that countdown entirely — the phase sits
 * statically until something else advances it. This is the default draft
 * behaviour for now; a disabled reveal falls straight through to `drafting`.
 *
 * The combat countdown is the **siege** timer: the defender must hold out that
 * long. Its expiry does not end the match by itself — GameRoom decides between
 * an attacker win, sudden death and a defender win from the `siege-expired`
 * event. Attacker income uses a separate clock (`MATCH_RULES.incomeDurationSec`)
 * owned by GameRoom, so the two windows can differ.
 */
export class Phases {
  phase: MatchPhase;
  private state: RoomState;
  private mapRevealDurationSec: number;
  private draftDurationSec: number;
  private buildingDurationSec: number;
  private siegeDurationSec: number;

  constructor(env: { state: RoomState }, rules: MatchRules = MATCH_RULES) {
    this.state = env.state;
    this.mapRevealDurationSec = rules.mapRevealDurationSec;
    this.draftDurationSec = rules.draftDurationSec;
    this.buildingDurationSec = rules.buildingDurationSec;
    this.siegeDurationSec = rules.siegeDurationSec;

    const current = this.state.phase as MatchPhase;
    this.phase = this.isKnown(current) ? current : MATCH_PHASES.drafting;
    this.state.phase = this.phase;

    // Defensive: a restored mid-draft room resumes its countdown when armed.
    if (this.phase === MATCH_PHASES.drafting && this.isDraftArmed() && this.state.phaseEndsAt <= 0) {
      this.state.phaseEndsAt = this.draftDurationSec;
    }
  }

  private isKnown(phase: MatchPhase): boolean {
    return [
      MATCH_PHASES.waiting,
      MATCH_PHASES.mapReveal,
      MATCH_PHASES.drafting,
      MATCH_PHASES.building,
      MATCH_PHASES.combat,
      MATCH_PHASES.gameover,
    ].includes(phase);
  }

  /**
   * `true` only when a real, positive reveal window is configured. A disabled
   * window makes {@link beginMapReveal} fall through to `drafting` on the next
   * tick (and immediately when armed with no time left).
   */
  private isMapRevealArmed(): boolean {
    return this.mapRevealDurationSec > 0;
  }

  /**
   * `true` only when a real, positive countdown is configured. `-1` (default)
   * means the phase never auto-advances from a timer.
   */
  private isDraftArmed(): boolean {
    return this.draftDurationSec > 0;
  }

  private isBuildingArmed(): boolean {
    return this.buildingDurationSec > 0;
  }

  private isSiegeArmed(): boolean {
    return this.siegeDurationSec > 0;
  }

  /**
   * Re-syncs the internal phase from `RoomState.phase`, so a transition done
   * elsewhere (e.g. the build-ahead short-circuit in GameRoom) is honoured.
   */
  private syncPhase(): void {
    const current = this.state.phase as MatchPhase;
    if (this.isKnown(current)) this.phase = current;
  }

  /**
   * Reveals a (already-selected) map before the draft opens. Sets `phase` to
   * `mapReveal` with a fresh countdown and every player unready; a disabled
   * window resolves to `drafting` on the next tick. No-op before two players
   * exist or after combat/gameover.
   *
   * @remarks The caller owns map selection — this only gates the timing, so the
   * reveal and the `RoomState.mapId` it displays can never disagree.
   */
  beginMapReveal(): PhaseEvent | null {
    if (this.phase === MATCH_PHASES.combat || this.phase === MATCH_PHASES.gameover) return null;
    if (this.state.players.size < 2) return null;

    this.phase = MATCH_PHASES.mapReveal;
    this.state.phase = this.phase;
    this.state.phaseEndsAt = this.isMapRevealArmed() ? this.mapRevealDurationSec : 0;
    this.state.winner = "";
    this.state.gameOverReason = "";
    for (const player of this.state.players.values()) {
      player.draftReady = false;
    }
    return { type: "map-reveal-started" };
  }

  /**
   * Arms the draft round: phase becomes `drafting` with a fresh (or, when
   * disabled, static) window and every player unready. No-op before two players
   * exist or after combat/gameover.
   */
  beginDraft(): PhaseEvent | null {
    if (this.phase === MATCH_PHASES.combat || this.phase === MATCH_PHASES.gameover) return null;
    if (this.state.players.size < 2) return null;

    this.phase = MATCH_PHASES.drafting;
    this.state.phase = this.phase;
    this.state.phaseEndsAt = this.isDraftArmed() ? this.draftDurationSec : 0;
    this.state.winner = "";
    this.state.gameOverReason = "";
    for (const player of this.state.players.values()) {
      player.draftReady = false;
    }
    return { type: "draft-started" };
  }

  /**
   * Marks a player's draft ready; once every player has confirmed, moves to the
   * build phase. The normal confirm path in GameRoom advances directly; this
   * utility exists so the machine itself stays the single source of truth.
   */
  onDraftReady(sessionId: string): PhaseEvent | null {
    if (this.phase !== MATCH_PHASES.drafting) return null;

    const player = this.state.players.get(sessionId);
    if (!player) return null;
    player.draftReady = true;

    const players = [...this.state.players.values()];
    if (players.length >= 2 && players.every((p) => p.draftReady)) {
      return this.beginBuilding([]);
    }
    return null;
  }

  /** Advances to `building`; `autoCompleted` lists players ready'd by timeout. */
  beginBuilding(autoCompleted: string[]): PhaseEvent | null {
    if (this.phase === MATCH_PHASES.gameover) return null;

    this.phase = MATCH_PHASES.building;
    this.state.phase = this.phase;
    this.state.phaseEndsAt = this.isBuildingArmed() ? this.buildingDurationSec : 0;
    return { type: "building-started", autoCompleted };
  }

  /** Advances to `combat`; `autoCompleted` is for future use. */
  beginCombat(autoCompleted: string[]): PhaseEvent | null {
    if (this.phase === MATCH_PHASES.gameover) return null;

    this.phase = MATCH_PHASES.combat;
    this.state.phase = this.phase;
    this.state.phaseEndsAt = this.isSiegeArmed() ? this.siegeDurationSec : 0;
    return { type: "combat-started", autoCompleted };
  }

  /**
   * Advances the active countdown. `waiting` and `gameover` are static; the
   * reveal, building and combat phases can have optional timers. A reveal that
   * elapses (or is disabled) falls through to `drafting`.
   */
  update(dt: number): PhaseEvent | null {
    this.syncPhase();

    if (this.phase === MATCH_PHASES.waiting || this.phase === MATCH_PHASES.gameover) {
      return null;
    }

    if (this.phase === MATCH_PHASES.mapReveal) {
      if (!this.isMapRevealArmed() || this.state.phaseEndsAt <= 0) {
        return this.beginDraft();
      }
      this.state.phaseEndsAt = Math.max(0, this.state.phaseEndsAt - dt);
      if (this.state.phaseEndsAt > 0) return null;
      return this.beginDraft();
    }

    if (this.phase === MATCH_PHASES.drafting) {
      if (!this.isDraftArmed() || this.state.phaseEndsAt <= 0) return null;
      this.state.phaseEndsAt = Math.max(0, this.state.phaseEndsAt - dt);
      if (this.state.phaseEndsAt > 0) return null;

      const autoCompleted: string[] = [];
      for (const [sessionId, player] of this.state.players) {
        if (!player.draftReady) {
          player.draftReady = true;
          autoCompleted.push(sessionId);
        }
      }
      return this.beginBuilding(autoCompleted);
    }

    if (this.phase === MATCH_PHASES.building) {
      if (!this.isBuildingArmed() || this.state.phaseEndsAt <= 0) return null;
      this.state.phaseEndsAt = Math.max(0, this.state.phaseEndsAt - dt);
      if (this.state.phaseEndsAt > 0) return null;
      return this.beginCombat([]);
    }

    if (this.phase === MATCH_PHASES.combat) {
      if (!this.isSiegeArmed() || this.state.phaseEndsAt <= 0) return null;
      this.state.phaseEndsAt = Math.max(0, this.state.phaseEndsAt - dt);
      if (this.state.phaseEndsAt > 0) return null;
      // The siege timer only ends the defender's hold-out window; GameRoom
      // decides from the field state whether that is an attacker win, sudden
      // death, or a defender win.
      return { type: "siege-expired" };
    }

    return null;
  }

  /**
   * Immediately ends the match with the given winner, e.g. core HP hit zero or
   * a surrender. Allowed from any in-match phase (map reveal, drafting,
   * building, combat); refused while still waiting for opponents or after the
   * match is already over.
   *
   * @param winner - Role that wins the match.
   * @param reason - Why it ended, mirrored into `RoomState.gameOverReason` so
   * the client can recover the copy without the private `game_over` message.
   * @returns The `gameover` event, or `null` when the match was already over.
   */
  declareGameOver(winner: PlayerRole, reason: GameOverReason = "surrender"): PhaseEvent | null {
    this.syncPhase();

    if (this.phase === MATCH_PHASES.waiting || this.phase === MATCH_PHASES.gameover) {
      return null;
    }

    // Written before `phase`: both travel in the same patch, and clients react
    // to the phase change, so the reason must already be readable when that
    // listener fires (see `RoomState.gameOverReason`).
    this.state.gameOverReason = reason;
    this.phase = MATCH_PHASES.gameover;
    this.state.phase = this.phase;
    this.state.phaseEndsAt = 0;
    this.state.winner = winner;
    return { type: "gameover", winner };
  }

  /**
   * Rolls the room back to a disarmed `drafting`, so a rematch (or a leaver)
   * starts with a clean clock and fresh ready flags.
   */
  reset(): void {
    this.phase = MATCH_PHASES.drafting;
    this.state.phase = this.phase;
    this.state.phaseEndsAt = 0;
    this.state.winner = "";
    this.state.gameOverReason = "";
    for (const player of this.state.players.values()) {
      player.draftReady = false;
    }
  }

  /** Checks the current effective phase (after any external advance). */
  is(...phases: MatchPhase[]): boolean {
    this.syncPhase();
    return phases.includes(this.phase);
  }
}
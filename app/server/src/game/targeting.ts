/** A potential tower target: a mob with its world position for this tick. */
export interface TargetCandidate {
  id: string;
  x: number;
  y: number;
  /**
   * Pixels still to travel before this mob reaches the base; lower is closer.
   *
   * @remarks Absolute remaining distance, not normalised progress. Two mobs on
   * tracks of different length (or on shared fork/merge geometry) can sit at the
   * same physical point with different `progress`, so progress is not comparable
   * across tracks; remaining distance is.
   */
  remaining: number;
  /**
   * When `true`, this mob pulls tower aggro whenever it is in range, taking
   * priority over non-taunting mobs even if they are closer to the base.
   */
  taunt?: boolean;
}

/**
 * Chooses a tower's next target: the in-range candidate nearest the base, with
 * priority given to any in-range taunting unit (e.g. `shield_guy`).
 *
 * @remarks
 * "Nearest the base" is the candidate with the smallest `remaining` (px to the
 * base). If one or more in-range candidates have `taunt: true`, towers always
 * focus the taunting candidate nearest the base before considering non-taunt
 * mobs. Distance is a plain Euclidean check against the tower's slot, so a
 * tower can cover any track passing through its radius. Ties fall to iteration
 * order.
 *
 * @param candidates - Mobs with resolved world positions for the current tick.
 * @param tower - The tower's world position (its slot).
 * @param range - Targeting radius in px.
 * @returns The chosen candidate, or `undefined` when none are in range.
 */
export function selectTarget(
  candidates: readonly TargetCandidate[],
  tower: { x: number; y: number },
  range: number,
): TargetCandidate | undefined {
  const rangeSq = range * range;

  let best: TargetCandidate | undefined;

  for (const candidate of candidates) {
    const dx = candidate.x - tower.x;
    const dy = candidate.y - tower.y;
    if (dx * dx + dy * dy > rangeSq) continue;

    const candidateTaunts = !!candidate.taunt;
    const bestTaunts = !!best?.taunt;

    if (
      !best ||
      (candidateTaunts && !bestTaunts) ||
      (candidateTaunts === bestTaunts && candidate.remaining < best.remaining)
    ) {
      best = candidate;
    }
  }

  return best;
}

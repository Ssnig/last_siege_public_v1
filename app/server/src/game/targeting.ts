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
  /**
   * When `true`, marks this mob as a high-value support caster (e.g. Healer, Drummer),
   * prioritized by towers configured with support-hunting targeting.
   */
  support?: boolean;
}

/**
 * Chooses a tower's next target: the in-range candidate nearest the base, with
 * priority given to any in-range taunting unit (e.g. `shield_guy`) and optionally
 * support casters (e.g. `say_sayar`, `doe_pat`) if `prioritizeSupport` is enabled.
 *
 * @remarks
 * "Nearest the base" is the candidate with the smallest `remaining` (px to the
 * base). If one or more in-range candidates have `taunt: true`, towers always
 * focus the taunting candidate nearest the base before considering non-taunt
 * mobs. When `prioritizeSupport` is set, in-range support mobs take priority over
 * ordinary non-taunting mobs. Distance is a plain Euclidean check against the
 * tower's slot, so a tower can cover any track passing through its radius. Ties
 * fall to iteration order.
 *
 * @param candidates - Mobs with resolved world positions for the current tick.
 * @param tower - The tower's world position (its slot).
 * @param range - Targeting radius in px.
 * @param prioritizeSupport - Whether to prioritize support units (e.g. Gun Tower).
 * @returns The chosen candidate, or `undefined` when none are in range.
 */
export function selectTarget(
  candidates: readonly TargetCandidate[],
  tower: { x: number; y: number },
  range: number,
  prioritizeSupport = false,
): TargetCandidate | undefined {
  const rangeSq = range * range;

  let best: TargetCandidate | undefined;

  for (const candidate of candidates) {
    const dx = candidate.x - tower.x;
    const dy = candidate.y - tower.y;
    if (dx * dx + dy * dy > rangeSq) continue;

    const candidateTaunts = !!candidate.taunt;
    const bestTaunts = !!best?.taunt;

    if (!best) {
      best = candidate;
      continue;
    }

    if (candidateTaunts && !bestTaunts) {
      best = candidate;
      continue;
    }
    if (!candidateTaunts && bestTaunts) {
      continue;
    }

    // Both taunt or neither taunt.
    // If prioritizeSupport is active: support units have next priority.
    if (prioritizeSupport && !candidateTaunts) {
      const candidateSupport = !!candidate.support;
      const bestSupport = !!best.support;
      if (candidateSupport && !bestSupport) {
        best = candidate;
        continue;
      }
      if (!candidateSupport && bestSupport) {
        continue;
      }
    }

    if (candidate.remaining < best.remaining) {
      best = candidate;
    }
  }

  return best;
}

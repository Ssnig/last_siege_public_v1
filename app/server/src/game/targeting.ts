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
/**
 * Chooses up to `maxCount` tower targets in priority order:
 * 1. Taunting mobs take highest priority.
 * 2. If `prioritizeSupport` is enabled, support mobs take second priority.
 * 3. Mobs nearest the base (smallest `remaining` px) are prioritized.
 *
 * @param candidates - Mobs with resolved world positions for the current tick.
 * @param tower - The tower's world position (its slot).
 * @param range - Targeting radius in px.
 * @param maxCount - Maximum number of targets to return.
 * @param prioritizeSupport - Whether to prioritize support units (e.g. Gun Tower).
 * @returns Array of target candidates in priority order (up to maxCount).
 */
export function selectTargets(
  candidates: readonly TargetCandidate[],
  tower: { x: number; y: number },
  range: number,
  maxCount = 1,
  prioritizeSupport = false,
): TargetCandidate[] {
  if (maxCount <= 0) return [];
  const rangeSq = range * range;
  const inRange: TargetCandidate[] = [];

  for (const candidate of candidates) {
    const dx = candidate.x - tower.x;
    const dy = candidate.y - tower.y;
    if (dx * dx + dy * dy <= rangeSq) {
      inRange.push(candidate);
    }
  }

  if (inRange.length === 0) return [];

  inRange.sort((a, b) => {
    if (prioritizeSupport) {
      const aSupp = !!a.support;
      const bSupp = !!b.support;
      if (aSupp !== bSupp) return aSupp ? -1 : 1;
    }

    const aTaunt = !!a.taunt;
    const bTaunt = !!b.taunt;
    if (aTaunt !== bTaunt) return aTaunt ? -1 : 1;

    return a.remaining - b.remaining;
  });

  return inRange.slice(0, maxCount);
}

/**
 * Chooses a tower's next target: the in-range candidate nearest the base, with
 * priority given to any in-range taunting unit (e.g. `shield_guy`) and optionally
 * support casters (e.g. `say_sayar`, `doe_pat`) if `prioritizeSupport` is enabled.
 */
export function selectTarget(
  candidates: readonly TargetCandidate[],
  tower: { x: number; y: number },
  range: number,
  prioritizeSupport = false,
): TargetCandidate | undefined {
  return selectTargets(candidates, tower, range, 1, prioritizeSupport)[0];
}

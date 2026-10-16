import {
  DEFAULT_WAVE_RULES,
  MOB_TYPES,
  type WaveRules,
  type WaveSize,
  type WaveSizeRules,
} from "./balance.js";

/**
 * One ordered group of identical units inside a staged wave.
 *
 * @remarks `batchId` is a server-issued stable handle so the client can reorder
 * and delete a specific row without relying on list position.
 */
export interface StagedBatch {
  batchId: string;
  typeId: string;
  count: number;
}

/**
 * The attacker's staged army for a single map path.
 *
 * @remarks Batches release in array order, spaced by
 * {@link WaveRules.batchIntervalSec}. At most one wave is staged per path.
 */
export interface StagedWave {
  pathId: string;
  size: WaveSize;
  batches: StagedBatch[];
}

/** Gold cost to field one unit of `typeId` (0 for an unknown id). */
export function mobCost(typeId: string): number {
  return MOB_TYPES[typeId]?.cost ?? 0;
}

/** Total units across every batch. */
export function waveTroopCount(batches: readonly StagedBatch[]): number {
  return batches.reduce((total, batch) => total + batch.count, 0);
}

/** The flat fee for a wave of the given size. */
export function waveFee(
  size: WaveSize,
  rules: WaveRules = DEFAULT_WAVE_RULES,
): number {
  return rules.sizes[size].fee;
}

/** Total gold to send a wave: sum of unit costs plus the size's flat fee. */
export function waveGoldCost(
  batches: readonly StagedBatch[],
  size: WaveSize,
  rules: WaveRules = DEFAULT_WAVE_RULES,
): number {
  const units = batches.reduce(
    (total, batch) => total + mobCost(batch.typeId) * batch.count,
    0,
  );
  return units + waveFee(size, rules);
}

/** Caps and fee for one wave size. */
export function stageLimits(
  size: WaveSize,
  rules: WaveRules = DEFAULT_WAVE_RULES,
): WaveSizeRules {
  return rules.sizes[size];
}

/**
 * Validates a staged wave's shape and, optionally, affordability.
 *
 * @param availableTroops Unit ids the attacker is allowed to pick (their deck).
 * @param gold When provided, the wave must cost no more than this.
 * @returns `null` when the wave is valid, otherwise a human-readable reason.
 *
 * @remarks Pure and side-effect free so both the server and the future client
 * UI can gate the send button with identical rules.
 */
export function validateWave(
  wave: StagedWave,
  availableTroops: readonly string[],
  gold?: number,
  rules: WaveRules = DEFAULT_WAVE_RULES,
): string | null {
  const limits = rules.sizes[wave.size];
  if (!limits) return "Unknown wave size.";
  if (wave.batches.length === 0) return "The wave is empty.";

  if (wave.batches.length > limits.maxBatches) {
    return `A ${wave.size} wave allows at most ${limits.maxBatches} batches.`;
  }

  let total = 0;
  for (const batch of wave.batches) {
    if (!availableTroops.includes(batch.typeId)) {
      return `${batch.typeId} is not in your deck.`;
    }
    if (
      !Number.isInteger(batch.count) ||
      batch.count < 1 ||
      batch.count > limits.batchLimit
    ) {
      return `A ${wave.size} wave allows between 1 and ${limits.batchLimit} of a unit per batch.`;
    }
    total += batch.count;
  }

  if (total > limits.waveLimit) {
    return `A ${wave.size} wave allows at most ${limits.waveLimit} units.`;
  }

  if (gold !== undefined && waveGoldCost(wave.batches, wave.size, rules) > gold) {
    return "Not enough gold.";
  }

  return null;
}

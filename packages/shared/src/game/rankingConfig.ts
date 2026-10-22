/**
 * Configuration and logic for the Elo rating and ranking system.
 *
 * @remarks
 * All knobs controlling the ranking tiers, Elo calculations, starting ratings,
 * and K-factors are centralized here so balancing or adding new ranks/assets
 * only requires updating this file.
 */

export interface RankTier {
  /** Unique rank identifier, e.g. "rank_1", "rank_2", "rank_3". */
  id: string;
  /** Numerical tier (1-indexed). */
  tier: number;
  /** Display name of the rank (placeholder name for now). */
  name: string;
  /** Minimum Elo rating required to attain this rank. */
  minElo: number;
  /** Maximum Elo rating for this rank (exclusive or Infinity for top rank). */
  maxElo: number;
  /** Path to the rank badge / sprite asset (placeholder SVG for now). */
  badgeAsset: string;
  /** Primary accent color for UI borders, glows, and text. */
  color: string;
  /** Short description / flavor text for this rank. */
  description: string;
}

export interface RankingConfig {
  /** Default starting Elo rating assigned to fresh accounts and guests. */
  defaultElo: number;
  /** Elo K-factor determining the sensitivity/magnitude of rating shifts per match. */
  kFactor: number;
  /** Minimum possible Elo rating (rating floor). */
  minElo: number;
  /** Maximum theoretical Elo rating (rating ceiling). */
  maxElo: number;
  /**
   * The list of rank tiers in ascending order of `minElo`.
   * Currently configured for three ranks (placeholders).
   */
  ranks: RankTier[];
}

/**
 * System ranking configuration.
 * Adjust rank names, required Elo thresholds, and asset paths here.
 */
export const RANKING_CONFIG: RankingConfig = {
  defaultElo: 1000,
  kFactor: 32,
  minElo: 100,
  maxElo: 3500,
  ranks: [
    {
      id: "rank_1",
      tier: 1,
      name: "Rank 1 (Bronze)",
      minElo: 0,
      maxElo: 1199,
      badgeAsset: "/assets/ranks/rank_1.svg",
      color: "#cd7f32",
      description: "Recruit Commander - Initial Rank Tier",
    },
    {
      id: "rank_2",
      tier: 2,
      name: "Rank 2 (Silver)",
      minElo: 1200,
      maxElo: 1499,
      badgeAsset: "/assets/ranks/rank_2.svg",
      color: "#c0c0c0",
      description: "Veteran Strategist - Intermediate Rank Tier",
    },
    {
      id: "rank_3",
      tier: 3,
      name: "Rank 3 (Gold)",
      minElo: 1500,
      maxElo: Infinity,
      badgeAsset: "/assets/ranks/rank_3.svg",
      color: "#ffd700",
      description: "Master General - Elite Rank Tier",
    },
  ],
};

/**
 * Finds the corresponding rank definition for a given Elo score.
 */
export function getRankForElo(elo: number, config: RankingConfig = RANKING_CONFIG): RankTier {
  const safeElo = Math.max(0, Math.round(elo));
  // Iterate from highest to lowest rank tier
  for (let i = config.ranks.length - 1; i >= 0; i--) {
    const rank = config.ranks[i];
    if (safeElo >= rank.minElo) {
      return rank;
    }
  }
  return config.ranks[0];
}

/**
 * Gets the next rank tier if one exists above the given Elo score.
 */
export function getNextRank(elo: number, config: RankingConfig = RANKING_CONFIG): RankTier | null {
  const currentRank = getRankForElo(elo, config);
  const nextRank = config.ranks.find((r) => r.tier === currentRank.tier + 1);
  return nextRank ?? null;
}

export interface RankProgress {
  currentRank: RankTier;
  nextRank: RankTier | null;
  /** Percentage of progress towards the next rank (0 - 100). 100 if top rank. */
  progressPercent: number;
  /** Elo earned within the current rank tier. */
  eloInCurrentTier: number;
  /** Total Elo span required to graduate to the next tier. */
  eloSpanToNext: number;
  /** Elo points needed to reach next rank. 0 if top rank. */
  eloNeededForNext: number;
}

/**
 * Computes progress information towards the next rank.
 */
export function getRankProgress(elo: number, config: RankingConfig = RANKING_CONFIG): RankProgress {
  const currentRank = getRankForElo(elo, config);
  const nextRank = getNextRank(elo, config);

  if (!nextRank) {
    return {
      currentRank,
      nextRank: null,
      progressPercent: 100,
      eloInCurrentTier: Math.max(0, elo - currentRank.minElo),
      eloSpanToNext: 0,
      eloNeededForNext: 0,
    };
  }

  const span = nextRank.minElo - currentRank.minElo;
  const current = Math.max(0, elo - currentRank.minElo);
  const progressPercent = Math.min(100, Math.max(0, Math.round((current / span) * 100)));
  const eloNeededForNext = Math.max(0, nextRank.minElo - elo);

  return {
    currentRank,
    nextRank,
    progressPercent,
    eloInCurrentTier: current,
    eloSpanToNext: span,
    eloNeededForNext,
  };
}

export interface EloCalculationResult {
  /** Previous Elo rating. */
  oldElo: number;
  /** New Elo rating after the match. */
  newElo: number;
  /** Signed change in rating (+/-). */
  delta: number;
  /** Expected match outcome probability according to Elo formula (0.0 to 1.0). */
  expectedScore: number;
}

/**
 * Calculates standard Elo rating adjustments following a match outcome.
 *
 * @param playerElo The rating of the player being evaluated.
 * @param opponentElo The rating of the opposing player.
 * @param actualScore 1 for win, 0 for loss, 0.5 for draw.
 * @param kFactor Sensitivity factor (defaults to config.kFactor).
 * @param config Ranking configuration.
 */
export function calculateEloChange(
  playerElo: number,
  opponentElo: number,
  actualScore: 1 | 0 | 0.5,
  kFactor: number = RANKING_CONFIG.kFactor,
  config: RankingConfig = RANKING_CONFIG,
): EloCalculationResult {
  const pElo = Math.max(config.minElo, playerElo);
  const oElo = Math.max(config.minElo, opponentElo);

  // Elo expected probability: E = 1 / (1 + 10^((opponentElo - playerElo) / 400))
  const exponent = (oElo - pElo) / 400;
  const expectedScore = 1 / (1 + Math.pow(10, exponent));

  // Raw delta calculation: K * (Actual - Expected)
  let delta = Math.round(kFactor * (actualScore - expectedScore));

  // Ensure winning always gives at least +1 Elo, and losing loses at least -1 Elo
  if (actualScore === 1 && delta <= 0) {
    delta = 1;
  } else if (actualScore === 0 && delta >= 0) {
    delta = -1;
  }

  const unclampedNewElo = pElo + delta;
  const newElo = Math.min(config.maxElo, Math.max(config.minElo, unclampedNewElo));
  const effectiveDelta = newElo - pElo;

  return {
    oldElo: pElo,
    newElo,
    delta: effectiveDelta,
    expectedScore,
  };
}

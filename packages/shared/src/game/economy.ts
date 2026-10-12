/**
 * Economy tuning for both sides.
 *
 * @remarks
 * Each player has their own gold pool. Attackers additionally have a finite
 * pool of `bigWaveCount` big waves; mini waves are effectively unlimited but
 * cost `miniWaveCost` each.
 */
export interface EconomyConfig {
  defenderStartingGold: number;
  attackerStartingGold: number;
  goldPerSecond: number;
  bigWaveCount: number;
  bigWaveCost: number;
  miniWaveCost: number;
}

export const DEFAULT_ECONOMY: EconomyConfig = {
  defenderStartingGold: 200,
  attackerStartingGold: 150,
  goldPerSecond: 5,
  bigWaveCount: 5,
  bigWaveCost: 40,
  miniWaveCost: 10,
};

/** Draft rules: how many cards each side picks from before the match. */
export interface DeckRules {
  deckSize: number;
}

export const DEFAULT_DECK_RULES: DeckRules = {
  deckSize: 6,
};

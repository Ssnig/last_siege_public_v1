import assert from "assert";
import {
  RANKING_CONFIG,
  getRankForElo,
  getNextRank,
  getRankProgress,
  calculateEloChange,
} from "@root/shared";

describe("Ranking and Elo Rating System", () => {
  it("defines exactly three rank tiers in the config", () => {
    assert.strictEqual(RANKING_CONFIG.ranks.length, 3);
    assert.strictEqual(RANKING_CONFIG.ranks[0].id, "rank_1");
    assert.strictEqual(RANKING_CONFIG.ranks[1].id, "rank_2");
    assert.strictEqual(RANKING_CONFIG.ranks[2].id, "rank_3");
  });

  it("has ascending Elo requirements for the three ranks", () => {
    const [rank1, rank2, rank3] = RANKING_CONFIG.ranks;
    assert.strictEqual(rank1.minElo, 0);
    assert.strictEqual(rank2.minElo, 1200);
    assert.strictEqual(rank3.minElo, 1500);
    assert(rank1.minElo < rank2.minElo);
    assert(rank2.minElo < rank3.minElo);
  });

  it("resolves the correct rank for a given Elo score", () => {
    assert.strictEqual(getRankForElo(0).id, "rank_1");
    assert.strictEqual(getRankForElo(500).id, "rank_1");
    assert.strictEqual(getRankForElo(1000).id, "rank_1");
    assert.strictEqual(getRankForElo(1199).id, "rank_1");
    assert.strictEqual(getRankForElo(1200).id, "rank_2");
    assert.strictEqual(getRankForElo(1400).id, "rank_2");
    assert.strictEqual(getRankForElo(1499).id, "rank_2");
    assert.strictEqual(getRankForElo(1500).id, "rank_3");
    assert.strictEqual(getRankForElo(2500).id, "rank_3");
  });

  it("gets the next rank tier if available", () => {
    const nextFrom1 = getNextRank(1000);
    assert(nextFrom1 !== null);
    assert.strictEqual(nextFrom1?.id, "rank_2");

    const nextFrom2 = getNextRank(1300);
    assert(nextFrom2 !== null);
    assert.strictEqual(nextFrom2?.id, "rank_3");

    const nextFrom3 = getNextRank(1800);
    assert.strictEqual(nextFrom3, null);
  });

  it("computes rank progress percentage and needed Elo correctly", () => {
    const progressAtBase = getRankProgress(0);
    assert.strictEqual(progressAtBase.currentRank.id, "rank_1");
    assert.strictEqual(progressAtBase.progressPercent, 0);
    assert.strictEqual(progressAtBase.eloNeededForNext, 1200);

    const progressMidTier1 = getRankProgress(600);
    assert.strictEqual(progressMidTier1.progressPercent, 50);
    assert.strictEqual(progressMidTier1.eloNeededForNext, 600);

    const progressAtTier2 = getRankProgress(1200);
    assert.strictEqual(progressAtTier2.currentRank.id, "rank_2");
    assert.strictEqual(progressAtTier2.progressPercent, 0);
    assert.strictEqual(progressAtTier2.eloNeededForNext, 300);

    const progressMidTier2 = getRankProgress(1350);
    assert.strictEqual(progressMidTier2.progressPercent, 50);
    assert.strictEqual(progressMidTier2.eloNeededForNext, 150);

    const progressAtMax = getRankProgress(2000);
    assert.strictEqual(progressAtMax.currentRank.id, "rank_3");
    assert.strictEqual(progressAtMax.nextRank, null);
    assert.strictEqual(progressAtMax.progressPercent, 100);
    assert.strictEqual(progressAtMax.eloNeededForNext, 0);
  });

  it("calculates Elo adjustments for equal opponents (win and loss)", () => {
    // When both are 1000, expected score is 0.5. With K=32, winner gains 16, loser drops 16.
    const winResult = calculateEloChange(1000, 1000, 1, 32);
    assert.strictEqual(winResult.oldElo, 1000);
    assert.strictEqual(winResult.delta, 16);
    assert.strictEqual(winResult.newElo, 1016);

    const lossResult = calculateEloChange(1000, 1000, 0, 32);
    assert.strictEqual(lossResult.oldElo, 1000);
    assert.strictEqual(lossResult.delta, -16);
    assert.strictEqual(lossResult.newElo, 984);
  });

  it("gives higher gains when beating an opponent with higher Elo", () => {
    // Underdog (1000) beats favorite (1400)
    const underdogWin = calculateEloChange(1000, 1400, 1, 32);
    // Favorite (1400) beats underdog (1000)
    const favoriteWin = calculateEloChange(1400, 1000, 1, 32);

    assert(underdogWin.delta > favoriteWin.delta);
    assert(underdogWin.delta > 25);
    assert(favoriteWin.delta < 10);
  });

  it("guarantees at least +1 on win and -1 on loss even with extreme Elo difference", () => {
    const extremeWin = calculateEloChange(2800, 200, 1, 32);
    assert(extremeWin.delta >= 1);

    const extremeLoss = calculateEloChange(200, 2800, 0, 32);
    assert(extremeLoss.delta <= -1);
  });
});

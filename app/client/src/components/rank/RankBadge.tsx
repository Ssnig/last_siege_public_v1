import React from 'react';
import { getRankForElo, getRankProgress, type RankTier } from '@root/shared';

export interface RankBadgeProps {
  elo: number;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
}

export const RankBadge: React.FC<RankBadgeProps> = ({
  elo,
  showProgress = false,
  size = 'md',
  showDetails = true,
  className = '',
}) => {
  const rank: RankTier = getRankForElo(elo);
  const progress = getRankProgress(elo);

  const sizeClasses = {
    sm: {
      badge: 'w-7 h-7',
      name: 'text-[11px]',
      elo: 'text-[10px]',
      container: 'gap-1.5',
    },
    md: {
      badge: 'w-10 h-10',
      name: 'text-xs sm:text-sm',
      elo: 'text-[11px]',
      container: 'gap-2.5',
    },
    lg: {
      badge: 'w-16 h-16 sm:w-20 sm:h-20',
      name: 'text-base sm:text-lg',
      elo: 'text-xs sm:text-sm',
      container: 'gap-3',
    },
  }[size];

  return (
    <div className={`flex items-center ${sizeClasses.container} select-none ${className}`}>
      {/* Badge Image with Tier Glow */}
      <div className={`relative ${sizeClasses.badge} shrink-0 flex items-center justify-center`}>
        <div
          className="absolute inset-0 rounded-full blur-[6px] opacity-60 pointer-events-none"
          style={{ backgroundColor: rank.color }}
        />
        <img
          src={rank.badgeAsset}
          alt={rank.name}
          className="relative z-10 w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
          onError={(e) => {
            // Graceful fallback if asset cannot be loaded
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      </div>

      {/* Details & Rank Name */}
      {showDetails && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-black tracking-wide leading-tight truncate ${sizeClasses.name}`}
              style={{
                color: rank.color,
                textShadow: '1px 1px 2px rgba(0,0,0,0.9)',
                fontFamily: "'MedievalSharp', 'Cinzel', serif",
              }}
            >
              {rank.name}
            </span>
            <span className={`font-mono font-bold text-amber-200/90 ${sizeClasses.elo}`}>
              {Math.round(elo)} Elo
            </span>
          </div>

          {/* Mini Progress Bar towards Next Rank */}
          {showProgress && (
            <div className="w-full mt-1">
              <div className="flex items-center justify-between text-[9px] text-amber-200/60 mb-0.5">
                <span>{progress.nextRank ? `Next: ${progress.nextRank.name}` : 'Max Tier'}</span>
                <span>{progress.nextRank ? `${progress.eloNeededForNext} pts` : 'Top'}</span>
              </div>
              <div className="w-full h-1.5 bg-black/50 border border-amber-900/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${progress.progressPercent}%`,
                    backgroundColor: rank.color,
                    boxShadow: `0 0 6px ${rank.color}`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

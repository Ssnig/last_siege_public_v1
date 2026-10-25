import React, { useRef, useState } from 'react';

export interface RankUpCelebrationProps {
  rankName: string;
  rankColor: string;
  badgeAsset: string;
  videoSrc: string;
  onClose: () => void;
}

/**
 * Full-screen promotion celebration shown once the player climbs into a new
 * rank. The video autoplays muted (browsers block audible autoplay) and the
 * player can unmute it or skip straight back to the results screen.
 */
export const RankUpCelebration: React.FC<RankUpCelebrationProps> = ({
  rankName,
  rankColor,
  badgeAsset,
  videoSrc,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    void video.play().catch(() => undefined);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label={`Promoted to ${rankName}`}
    >
      <div className="relative w-full max-w-5xl px-4 flex flex-col items-center gap-4">
        <div className="text-center">
          <p
            className="text-xs sm:text-sm font-black tracking-[0.35em] uppercase"
            style={{ color: rankColor }}
          >
            Rank Up
          </p>
          <h2
            className="text-3xl sm:text-5xl font-black tracking-wide"
            style={{
              color: rankColor,
              fontFamily: "'MedievalSharp', 'Cinzel', serif",
              textShadow: '0 0 24px rgba(0,0,0,0.9)',
            }}
          >
            {rankName}
          </h2>
        </div>

        <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-amber-500/60 shadow-[0_0_60px_rgba(212,175,55,0.35)] bg-black">
          {videoFailed ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={badgeAsset}
                alt={rankName}
                className="w-48 h-48 sm:w-64 sm:h-64 object-contain drop-shadow-[0_0_30px_rgba(212,175,55,0.6)]"
              />
            </div>
          ) : (
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full object-contain"
              autoPlay
              muted={muted}
              playsInline
              preload="auto"
              onEnded={onClose}
              onError={() => setVideoFailed(true)}
            />
          )}

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-3 bg-gradient-to-t from-black/90 to-transparent">
            {!videoFailed && (
              <button
                type="button"
                onClick={toggleSound}
                className="px-3 py-1.5 rounded-full bg-black/70 border border-amber-600/60 text-amber-100 text-xs font-bold hover:bg-black/90 transition"
              >
                {muted ? 'Enable Sound' : 'Mute'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="ml-auto px-4 py-1.5 rounded-full bg-amber-600/90 border border-amber-300 text-black text-xs font-black tracking-wide hover:bg-amber-500 transition"
            >
              CONTINUE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

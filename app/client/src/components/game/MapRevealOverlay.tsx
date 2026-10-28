import React from 'react';
import type { MapDefinition } from '@root/shared';
import { useSmoothCountdown } from './useSmoothCountdown';

export const MAP_IMAGE_URLS: Record<string, string> = {
  konbaung: '/assets/maps/map_1_konbaung/map.webp',
  bagan: '/assets/maps/map_2_bagan/map.webp',
  inle: '/assets/maps/map_3_inle/map.webp',
  mandalay: '/assets/maps/map_4_mandalay/map.webp',
  innwa: '/assets/maps/map_5_innwa/map.webp',
  bago: '/assets/maps/map_6_bago/map.webp',
  deserted: '/assets/maps/map_7_deserted/map.webp',
  twister: '/assets/maps/map_8_twister/map.webp',
  river: '/assets/maps/map_9_river/map.webp',
};

interface MapRevealOverlayProps {
  /** The map the server rolled for this match (`RoomState.mapId`). */
  map: MapDefinition;
  /** Authoritative seconds left in the reveal, as streamed by the server. */
  serverSeconds: number;
}

/** SVG corner filigree for royal panels */
const CornerFlourish: React.FC<{ position: 'tl' | 'tr' | 'bl' | 'br' }> = ({ position }) => {
  const transform =
    position === 'tr'
      ? 'scaleX(-1)'
      : position === 'bl'
        ? 'scaleY(-1)'
        : position === 'br'
          ? 'scale(-1, -1)'
          : undefined;

  return (
    <div
      className={`absolute pointer-events-none z-20 ${
        position.startsWith('t') ? 'top-1' : 'bottom-1'
      } ${position.endsWith('l') ? 'left-1' : 'right-1'}`}
      style={{ transform }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M2 22 L2 6 C2 3.8 3.8 2 6 2 L22 2"
          stroke="#fce38a"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M6 16 L6 8 C6 6.9 6.9 6 8 6 L16 6"
          stroke="#d4af37"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="4" cy="4" r="2" fill="#ffe066" />
      </svg>
    </div>
  );
};

/**
 * Pre-draft screen announcing the selected battlefield.
 *
 * @remarks
 * Displays the high-resolution authentic map artwork framed in royal Burmese
 * antique gold and lacquer crimson. The countdown elapses before the server
 * transitions into drafting.
 */
export const MapRevealOverlay: React.FC<MapRevealOverlayProps> = ({
  map,
  serverSeconds,
}) => {
  const secondsLeft = useSmoothCountdown(serverSeconds, true);
  const mapImageUrl =
    MAP_IMAGE_URLS[map.id] || map.thumbnail || '/assets/maps/map_1_konbaung/map.webp';

  return (
    <div className="absolute inset-0 z-40 h-full w-full overflow-y-auto bg-[#0a0304]/90 backdrop-blur-md animate-fadeIn">
      <div className="min-h-full w-full flex flex-col items-center justify-center gap-3 sm:gap-4 px-4 py-6 text-center">
        {/* Royal header subtitle */}
        <div className="flex items-center gap-2 text-[11px] sm:text-xs font-bold tracking-[0.35em] text-[#d4af37] uppercase animate-slideDown">
          <span className="w-8 h-[1px] bg-gradient-to-r from-transparent to-[#d4af37]" />
          <span>⚔ Battlefield Chosen ⚔</span>
          <span className="w-8 h-[1px] bg-gradient-to-l from-transparent to-[#d4af37]" />
        </div>

        {/* Map Name */}
        <h2
          className="text-2xl sm:text-4xl md:text-5xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-b from-[#fff3b0] via-[#fce38a] to-[#d4af37] animate-scaleIn drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]"
          style={{ fontFamily: "'Cinzel', 'MedievalSharp', serif" }}
        >
          {map.name ?? map.id}
        </h2>

        {/* Map Lore / Lanes badge */}
        {(map.lanes || map.description) && (
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#fce38a]/80 bg-[#2b0b0e]/80 border border-[#d4af37]/40 px-3.5 py-1 rounded-full shadow-inner animate-fadeIn">
            {map.lanes && (
              <span className="text-[#ffe066]">
                {map.lanes} Combat {map.lanes > 1 ? 'Lanes' : 'Lane'}
              </span>
            )}
            {map.lanes && map.description && <span className="opacity-40">•</span>}
            {map.description && (
              <span className="truncate max-w-[280px] sm:max-w-md text-amber-200/80 font-normal">
                {map.description}
              </span>
            )}
          </div>
        )}

        {/* Showcase of the Real Map Artwork */}
        <div className="relative mx-auto w-fit max-w-full rounded-2xl border-2 border-[#d4af37]/80 bg-[#140608] overflow-hidden shadow-[0_12px_45px_rgba(0,0,0,0.85),0_0_25px_rgba(212,175,55,0.25)] animate-modalPop">
          <CornerFlourish position="tl" />
          <CornerFlourish position="tr" />
          <CornerFlourish position="bl" />
          <CornerFlourish position="br" />

          {/* Real Map Image (16:9) */}
          <div className="relative aspect-[16/9] h-[48vh] max-h-[48vh] min-h-[220px] overflow-hidden">
            <img
              src={mapImageUrl}
              alt={map.name ?? map.id}
              className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-1000 scale-[1.01]"
            />
            {/* Soft inner vignette border */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/40 via-transparent to-black/25 shadow-[inset_0_0_35px_rgba(0,0,0,0.7)]" />
          </div>
        </div>

        {/* Countdown Footer */}
        <div className="flex items-center gap-3 text-amber-100/90 font-medium pt-1">
          <span
            className="text-xs sm:text-sm tracking-wider uppercase text-[#d4af37] font-semibold"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Drafting begins in
          </span>
          <span className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-gradient-to-b from-[#3d1216] to-[#1a0507] border-2 border-[#d4af37] text-[#ffe066] font-black text-lg sm:text-xl shadow-[0_0_15px_rgba(212,175,55,0.3)]">
            {secondsLeft}
          </span>
        </div>
      </div>
    </div>
  );
};

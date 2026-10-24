import React from 'react';
import { mapPath, mapPathIds, type MapDefinition, type Vec2 } from '@root/shared';
import { useSmoothCountdown } from './useSmoothCountdown';

interface MapRevealOverlayProps {
  /** The map the server rolled for this match (`RoomState.mapId`). */
  map: MapDefinition;
  /** Authoritative seconds left in the reveal, as streamed by the server. */
  serverSeconds: number;
}

/** Formats waypoints for an SVG `polyline` `points` attribute. */
function polylinePoints(points: Vec2[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

/**
 * Pre-draft screen announcing the randomly selected map.
 *
 * @remarks
 * Purely presentational: it draws a schematic from the same shared
 * {@link MapDefinition} the simulation uses, so it always matches the real
 * geometry without needing per-map art. The countdown is informational — the
 * server owns the phase transition into `drafting`.
 */
export const MapRevealOverlay: React.FC<MapRevealOverlayProps> = ({
  map,
  serverSeconds,
}) => {
  const secondsLeft = useSmoothCountdown(serverSeconds, true);
  const width = map.width ?? 1280;
  const height = map.height ?? 720;

  const tracks = mapPathIds(map)
    .map((id) => mapPath(map, id))
    .filter((points): points is Vec2[] => !!points && points.length >= 2);

  // Multiple tracks may share a spawn (a fork); collapse duplicates so shared
  // portals render as a single marker.
  const spawns = new Map<string, Vec2>();
  for (const points of tracks) {
    const [first] = points;
    spawns.set(`${first.x},${first.y}`, first);
  }

  return (
    <div className="absolute inset-0 z-40 h-full w-full overflow-y-auto bg-slate-950/90 backdrop-blur-md animate-fadeIn">
      <div className="min-h-full w-full flex flex-col items-center justify-center gap-3 sm:gap-4 px-4 py-6 text-center">
        <p className="text-[11px] font-bold tracking-[0.4em] text-sky-400/80 uppercase animate-slideDown">
          Battlefield Chosen
        </p>
        <h2
          className="text-2xl sm:text-4xl font-black text-white tracking-tight animate-scaleIn"
          style={{ fontFamily: "'MedievalSharp', 'Cinzel', serif" }}
        >
          {map.name ?? map.id}
        </h2>

        <div className="mx-auto w-fit max-w-full rounded-2xl border border-slate-700 bg-slate-900/80 overflow-hidden shadow-2xl animate-modalPop">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            className="block h-[46vh] max-h-[46vh] w-auto max-w-full"
            role="img"
            aria-label={`Layout of ${map.name ?? map.id}`}
          >
            {tracks.map((points, i) => (
              <React.Fragment key={`track-${i}`}>
                <polyline
                  points={polylinePoints(points)}
                  fill="none"
                  stroke="#0ea5e9"
                  strokeOpacity={0.3}
                  strokeWidth={18}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={polylinePoints(points)}
                  fill="none"
                  stroke="#7dd3fc"
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </React.Fragment>
            ))}

            {[...spawns.values()].map((spawn, i) => (
              <circle
                key={`spawn-${i}`}
                cx={spawn.x}
                cy={spawn.y}
                r={12}
                fill="#f43f5e"
                stroke="#fecdd3"
                strokeWidth={2}
              />
            ))}

            {map.slots.map((slot) => (
              <circle
                key={`slot-${slot.slotIndex}`}
                cx={slot.x}
                cy={slot.y}
                r={9}
                fill="#1e293b"
                stroke="#94a3b8"
                strokeWidth={2}
              />
            ))}

            <g transform={`translate(${map.base.x} ${map.base.y})`}>
              <path
                d="M0 -14 L14 0 L0 14 L-14 0 Z"
                fill="#f59e0b"
                stroke="#fde68a"
                strokeWidth={2}
              />
            </g>
          </svg>
        </div>

        <div className="flex items-center gap-3 text-slate-300">
          <span className="text-sm">Drafting begins in</span>
          <span className="w-10 h-10 flex items-center justify-center rounded-full bg-sky-500/20 border border-sky-400/50 text-sky-200 font-black text-lg">
            {secondsLeft}
          </span>
        </div>
      </div>
    </div>
  );
};

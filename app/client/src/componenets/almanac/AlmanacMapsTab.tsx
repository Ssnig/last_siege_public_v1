import React, { useState, useEffect, useRef } from 'react';
import { CANONICAL_MAPS, MAPS, type MapDefinition, type Vec2 } from '@root/shared';
import { MAP_IMAGE_URLS } from '../../game/assetManifest';
import { soundEffects } from '../../audio/soundEffects';

interface MapTacticalNote {
  title: string;
  lanesSummary: string;
  chokePoint: string;
  defenderAdvice: string;
  attackerAdvice: string;
}

const MAP_TACTICAL_NOTES: Record<string, MapTacticalNote> = {
  konbaung: {
    title: 'The Royal Konbaung Citadel',
    lanesSummary: 'Two distinct mountain corridors (North & South) converging at the palace gate.',
    chokePoint: 'The southern approach narrow bend and the convergence zone directly before the palace.',
    defenderAdvice: 'Place an AoE Cannon or Bell Tower at slot 2/3 to hit mobs traveling from both converging passes.',
    attackerAdvice: 'Split forces across both portals or time a fast Doe Pat rush along the shorter southern track.',
  },
  bagan: {
    title: 'Ancient Bagan Pagoda Plain',
    lanesSummary: 'Wide desert valley threading between thousand-year-old terracotta stupas.',
    chokePoint: 'Central pagoda plaza where tracks bend at 90 degrees.',
    defenderAdvice: 'Exploit the sharp turns with Bomb and Cannon towers to inflict maximum splash damage.',
    attackerAdvice: 'Armored Sar Bal Gyi vanguards excel here due to long open straightaways between bends.',
  },
  inle: {
    title: 'Inle Lake Waterways',
    lanesSummary: 'Serene marshland channels flanked by stilt villages and floating gardens.',
    chokePoint: 'The wooden bridge bottleneck entering the central temple island.',
    defenderAdvice: 'Water Cannon and Gun Towers dominate the long unobstructed water avenues.',
    attackerAdvice: 'Winged Nats ignore water hazards and bypass ground congestion with ease.',
  },
  mandalay: {
    title: 'Mandalay Royal Moat & Walls',
    lanesSummary: 'A grand fortified stronghold bordered by an expansive protective moat.',
    chokePoint: 'Fortress gatehouse threshold where attackers are compressed into single file.',
    defenderAdvice: 'Front-load heavy physical artillery at the moat crossing pads.',
    attackerAdvice: 'Use Shield Bearer taunt to draw long-range sniper fire while cavalry charges the gate.',
  },
  innwa: {
    title: 'Old Innwa Kingdom Canals',
    lanesSummary: 'Labyrinthine river network connecting ancient pagodas and teak bridges.',
    chokePoint: 'Twisting canal junctions where units are vulnerable to prolonged tower fire.',
    defenderAdvice: 'The winding path increases mob travel time; stack fast-firing archers and snipers.',
    attackerAdvice: 'Doe Pat drum beats can break through the long path before towers can accumulate damage.',
  },
  bago: {
    title: 'Sacred Bago Mon Sanctuary',
    lanesSummary: 'Spiritual grounds surrounded by reclining Buddhas and guardian lions.',
    chokePoint: 'Sacred terrace staircase leading up to the main stupa.',
    defenderAdvice: 'Bell Towers thrive on this sacred ground, tearing through heavily armored tanks.',
    attackerAdvice: 'Deploy Gya Pu and A-Ba spirit mediums with high mental resolve to withstand bells.',
  },
  deserted: {
    title: 'Sri Ksetra Sunken Ruins',
    lanesSummary: 'Arid canyon pass cutting through forgotten sandstone monoliths.',
    chokePoint: 'Deep gorge corridor with zero lateral room for attackers to disperse.',
    defenderAdvice: 'Perfect setup for Dragon and Bomb towers to scorch packed corridors.',
    attackerAdvice: 'Stagger unit spawns so splash damage doesn’t hit multiple squads simultaneously.',
  },
  twister: {
    title: 'Taungoo Mountain Gorge',
    lanesSummary: 'Violently winding switchback trails ascending treacherous mountain terraces.',
    chokePoint: 'Multiple tight hairpin turns where towers have overlapping lines of sight.',
    defenderAdvice: 'Central tower pads can shoot into 3 separate bends from a single position.',
    attackerAdvice: 'Speed is king; avoid slow units that will be exposed to continuous fire for too long.',
  },
  river: {
    title: 'Ayeyarwady River Crossing',
    lanesSummary: 'Vast riverbank crossing with muddy shoals slowing movement.',
    chokePoint: 'River sandbar ford directly in front of the defenders’ forward battery.',
    defenderAdvice: 'Anchor with Sein Pyaung mortars to obliterate attackers while they struggle through water.',
    attackerAdvice: 'Colossal War Elephants and healers push through the river crossing with raw fortitude.',
  },
};

const PATH_COLORS = ['#38bdf8', '#f59e0b', '#a855f7', '#10b981', '#ec4899'];

export const AlmanacMapsTab: React.FC = () => {
  const [selectedMapId, setSelectedMapId] = useState<string>(CANONICAL_MAPS[0]?.id || 'konbaung');
  const [showPaths, setShowPaths] = useState<boolean>(true);
  const [showSlots, setShowSlots] = useState<boolean>(true);
  const [showPortals, setShowPortals] = useState<boolean>(true);
  const [showBase, setShowBase] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeMap: MapDefinition = MAPS[selectedMapId] || CANONICAL_MAPS[0];
  const tactical = MAP_TACTICAL_NOTES[selectedMapId] || {
    title: activeMap.name || selectedMapId,
    lanesSummary: `${activeMap.lanes || 2} primary lane(s)`,
    chokePoint: 'Central corridor approaches',
    defenderAdvice: 'Balance AoE and single-target towers across pad locations.',
    attackerAdvice: 'Time your waves with supporting auras and taunts.',
  };

  const mapBgUrl = MAP_IMAGE_URLS[selectedMapId]?.map || `/assets/maps/map_1_konbaung/map.jpg`;

  // Draw Tactical Canvas overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = mapBgUrl;

    img.onload = () => {
      if (!active) return;
      ctx.clearRect(0, 0, 1280, 720);

      // 1. Draw base landscape map
      ctx.drawImage(img, 0, 0, 1280, 720);

      // Subtle dimming so tactical indicators pop
      ctx.fillStyle = 'rgba(2, 6, 23, 0.25)';
      ctx.fillRect(0, 0, 1280, 720);

      // 2. Draw Paths & Directional Arrows
      if (showPaths) {
        const pathEntries: Array<[string, Vec2[]]> = activeMap.paths
          ? Object.entries(activeMap.paths)
          : [['default', activeMap.path || []]];

        pathEntries.forEach(([_pathKey, waypoints], pathIdx) => {
          if (!waypoints || waypoints.length === 0) return;
          const color = PATH_COLORS[pathIdx % PATH_COLORS.length];

          // Glow outline
          ctx.beginPath();
          ctx.moveTo(waypoints[0].x, waypoints[0].y);
          for (let i = 1; i < waypoints.length; i++) {
            ctx.lineTo(waypoints[i].x, waypoints[i].y);
          }
          ctx.strokeStyle = color;
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Directional arrows along path segments
          for (let i = 0; i < waypoints.length - 1; i++) {
            const p1 = waypoints[i];
            const p2 = waypoints[i + 1];
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

            ctx.save();
            ctx.translate(midX, midY);
            ctx.rotate(angle);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(-5, -5);
            ctx.lineTo(-2, 0);
            ctx.lineTo(-5, 5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }

          // Waypoint dots
          waypoints.forEach((wp: Vec2) => {
            ctx.beginPath();
            ctx.arc(wp.x, wp.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          });
        });
      }

      // 3. Draw Portals
      if (showPortals && activeMap.portals) {
        activeMap.portals.forEach((p, idx) => {
          ctx.save();
          // Portal outer glow halo
          ctx.beginPath();
          ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(168, 85, 247, 0.35)';
          ctx.fill();
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#c084fc';
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Portal center badge
          ctx.beginPath();
          ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
          ctx.fillStyle = '#e879f9';
          ctx.fill();

          // Label
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`P${idx + 1}`, p.x, p.y);
          ctx.restore();
        });
      }

      // 4. Draw Tower Slots (Defenders)
      if (showSlots && activeMap.slots) {
        activeMap.slots.forEach((s) => {
          ctx.save();
          // Tower pad foundation ring
          ctx.beginPath();
          ctx.ellipse(s.x, s.y, 28, 20, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(180, 83, 9, 0.45)';
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Slot Label Pill
          const labelY = s.y - 24;
          ctx.beginPath();
          ctx.roundRect(s.x - 20, labelY - 10, 40, 20, 6);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`H${s.slotIndex}`, s.x, labelY);
          ctx.restore();
        });
      }

      // 5. Draw Royal Base Citadel
      if (showBase && activeMap.base) {
        ctx.save();
        const baseWidth = activeMap.baseDisplaySize?.width ?? 120;
        const baseHeight = activeMap.baseDisplaySize?.height ?? 120;
        const bx = activeMap.base.x;
        const by = activeMap.base.y;

        // Base zone highlight
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx - baseWidth / 2, by - baseHeight / 2, baseWidth, baseHeight);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.fillRect(bx - baseWidth / 2, by - baseHeight / 2, baseWidth, baseHeight);

        // Core Citadel Marker
        ctx.beginPath();
        ctx.arc(bx, by, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Royal Palace', bx, by - baseHeight / 2 - 8);
        ctx.restore();
      }
    };

    return () => {
      active = false;
    };
  }, [selectedMapId, showPaths, showSlots, showPortals, showBase, mapBgUrl, activeMap]);

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-4 h-full min-h-0 overflow-hidden">
      {/* ──── Left Column: Battlefields List ──── */}
      <div className="w-full md:w-80 lg:w-88 flex flex-col shrink-0 bg-slate-950/80 rounded-xl border border-amber-600/40 overflow-hidden shadow-lg">
        <div className="p-3 border-b border-amber-600/30 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-200 font-['Almendra',serif]">
              Realm Battlefields ({CANONICAL_MAPS.length} Maps)
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
          {CANONICAL_MAPS.map((m) => {
            const isSelected = m.id === selectedMapId;
            const note = MAP_TACTICAL_NOTES[m.id];
            const thumb = MAP_IMAGE_URLS[m.id]?.map || `/assets/maps/map_1_konbaung/map.jpg`;

            return (
              <div
                key={m.id}
                onClick={() => {
                  soundEffects.playClick();
                  setSelectedMapId(m.id);
                }}
                onMouseEnter={() => soundEffects.playHover()}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-gradient-to-r from-amber-950/80 via-amber-900/40 to-slate-900 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.35)] scale-[1.01]'
                    : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 hover:border-amber-600/40'
                }`}
              >
                {/* Map Mini Thumbnail */}
                <div className="relative w-14 h-11 rounded-md overflow-hidden bg-slate-950 border border-amber-500/50 shrink-0">
                  <img
                    src={thumb}
                    alt={m.name}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-0 right-0 bg-slate-950/90 px-1 text-[8px] font-bold text-amber-300 rounded-tl">
                    {m.lanes || 2}L
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-amber-200' : 'text-slate-200'}`}>
                      {m.name || m.id}
                    </h4>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-950 border border-indigo-500/50 text-indigo-300">
                      {m.slots?.length || 5} Pads
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {note?.title || 'Royal Arena'}
                  </p>

                  <div className="flex items-center gap-2 mt-0.5 text-[9px] text-amber-300/70 font-mono">
                    <span>{m.portals?.length || 2} Spawn Portals</span>
                    <span>•</span>
                    <span>{m.lanes || 2} Lanes</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ──── Right Column: Map Showcase & Tactical Canvas ──── */}
      <div className="flex-1 flex flex-col bg-slate-950/90 rounded-xl border border-amber-600/50 overflow-hidden shadow-2xl min-h-0">
        {/* Showcase Header & Controls */}
        <div className="p-3 sm:p-4 border-b border-amber-600/30 bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-xl font-black text-amber-200 font-['Almendra',serif] tracking-wide">
                {activeMap.name || selectedMapId}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-950/40 text-amber-300">
                {activeMap.lanes || 2} Attack Lanes
              </span>
            </div>
            <p className="text-xs text-amber-400/80 font-serif italic mt-0.5">
              {tactical.title}
            </p>
          </div>

          {/* Tactical Overlay Toggles */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setShowPaths((prev) => !prev)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold border transition cursor-pointer ${
                showPaths
                  ? 'bg-sky-950 border-sky-400 text-sky-200 shadow-[0_0_8px_rgba(56,189,248,0.4)]'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              Paths: {showPaths ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setShowSlots((prev) => !prev)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold border transition cursor-pointer ${
                showSlots
                  ? 'bg-amber-950 border-amber-400 text-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              Slots: {showSlots ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setShowPortals((prev) => !prev)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold border transition cursor-pointer ${
                showPortals
                  ? 'bg-purple-950 border-purple-400 text-purple-200 shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              Portals: {showPortals ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setShowBase((prev) => !prev)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold border transition cursor-pointer ${
                showBase
                  ? 'bg-blue-950 border-blue-400 text-blue-200 shadow-[0_0_8px_rgba(59,130,246,0.4)]'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              Palace: {showBase ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Showcase Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {/* Tactical Canvas Stage (16:9 aspect) */}
          <div className="w-full relative rounded-xl overflow-hidden border border-amber-600/40 bg-slate-950 shadow-2xl aspect-[16/9] max-h-[360px] flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={1280}
              height={720}
              className="w-full h-full object-contain block"
            />
          </div>

          {/* Tactical Stats Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Lanes Count</span>
              <span className="text-base font-black text-amber-300 font-mono">{activeMap.lanes || 2} Lanes</span>
              <span className="text-[9px] text-slate-500 block">Attacking routes</span>
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Tower Foundations</span>
              <span className="text-base font-black text-amber-200 font-mono">{activeMap.slots?.length || 5} Pads</span>
              <span className="text-[9px] text-slate-500 block">Defender slots</span>
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Spawn Portals</span>
              <span className="text-base font-black text-purple-300 font-mono">{activeMap.portals?.length || 2} Gates</span>
              <span className="text-[9px] text-slate-500 block">Wave deploy points</span>
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Convergence</span>
              <span className="text-base font-black text-emerald-400 font-mono">Royal Citadel</span>
              <span className="text-[9px] text-slate-500 block">Final destination</span>
            </div>
          </div>

          {/* Choke Point & Terrain Analysis */}
          <div className="bg-slate-900/70 p-3.5 rounded-lg border border-amber-600/30">
            <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1 font-['Almendra',serif] flex items-center gap-1.5">
              Strategic Choke Points & Terrain
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed font-serif">
              {tactical.chokePoint}
            </p>
          </div>

          {/* Commander Briefing: Defender vs Attacker */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-blue-950/20 p-3 rounded-lg border border-blue-800/40">
              <div className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-1.5">
                Defender Citadel Strategy
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {tactical.defenderAdvice}
              </p>
            </div>

            <div className="bg-amber-950/20 p-3 rounded-lg border border-amber-800/40">
              <div className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5">
                Attacker Invasion Strategy
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {tactical.attackerAdvice}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

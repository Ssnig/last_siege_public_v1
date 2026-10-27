import React from "react";
import { CANONICAL_MAPS, RANDOM_MAP_ID, type MapDefinition } from "@root/shared";

interface MapSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMapId: string;
  onSelectMap: (mapId: string) => void;
}

export const MapSelectorModal: React.FC<MapSelectorModalProps> = ({
  isOpen,
  onClose,
  selectedMapId,
  onSelectMap,
}) => {
  if (!isOpen) return null;

  // Strict 6 canonical battlefields
  const playableMaps = CANONICAL_MAPS;
  const isRandom = selectedMapId === RANDOM_MAP_ID;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 select-none animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] bg-gradient-to-b from-slate-900 via-[#131b2e] to-slate-950 border-2 border-amber-500/80 rounded-2xl shadow-[0_0_40px_rgba(245,158,11,0.4)] flex flex-col overflow-hidden animate-modalPop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3.5 border-b border-amber-600/40 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🗺️</span>
            <div>
              <h2 className="text-lg md:text-xl font-black text-amber-300 uppercase tracking-wider font-['Almendra',serif]">
                Select Royal Battlefield
              </h2>
              <p className="text-xs text-amber-200/60">
                Choose the strategic arena for your match
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-200 hover:text-white flex items-center justify-center text-lg transition cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-3 sm:p-4 md:p-6 overflow-y-auto flex-1 flex flex-col gap-2.5 sm:gap-3.5">
          {/* Quick Pick: Random Option Banner */}
          <div
            onClick={() => onSelectMap(RANDOM_MAP_ID)}
            className={`relative rounded-xl p-3 px-4 flex items-center justify-between border-2 transition-all cursor-pointer bg-slate-950/80 ${
              isRandom
                ? "border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.45)] bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 scale-[1.005]"
                : "border-slate-700/80 hover:border-amber-500/60 hover:bg-slate-900/70"
            }`}
          >
            <div className="flex items-center gap-3.5">
              <span className="text-3xl filter drop-shadow">🎲</span>
              <div>
                <div className="flex items-center gap-2">
                  <h3
                    className={`text-sm md:text-base font-bold ${
                      isRandom
                        ? "text-amber-300 font-['Almendra',serif]"
                        : "text-slate-100 group-hover:text-amber-200"
                    }`}
                  >
                    Random Battlefield
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-500/40 text-indigo-300 font-bold uppercase tracking-wider">
                    Quick Pick
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Let fate decide — a map is drawn from the royal battlefields the moment the match begins.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 ml-2">
              <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                Full Battlefield Pool
              </span>
              <div
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  isRandom
                    ? "bg-amber-500 text-slate-950 font-black shadow-md"
                    : "bg-slate-800 text-slate-300 hover:text-white"
                }`}
              >
                {isRandom && <span>✓</span>}
                <span>{isRandom ? "Selected" : "Tap to Select"}</span>
              </div>
            </div>
          </div>

          {/* Symmetrical 3 × 3 Grid of 9 Maps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {playableMaps.map((map: MapDefinition) => {
              const isSelected = selectedMapId === map.id;
              const thumbSrc =
                map.thumbnail || `/assets/maps/map_1_konbaung/preview.png`;

              return (
                <div
                  key={map.id}
                  onClick={() => onSelectMap(map.id)}
                  className={`group relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer flex flex-col bg-slate-950/70 ${
                    isSelected
                      ? "border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.5)] scale-[1.02]"
                      : "border-slate-700/80 hover:border-amber-600/60 hover:scale-[1.01]"
                  }`}
                >
                  {/* Thumbnail Preview */}
                  <div className="relative h-24 sm:h-32 w-full overflow-hidden bg-slate-900">
                    <img
                      src={thumbSrc}
                      alt={map.name || map.id}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          "/assets/maps/map_1_konbaung/preview.png";
                      }}
                    />
                    {/* Lanes Badge */}
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/80 border border-amber-500/60 text-[10px] font-bold text-amber-300 uppercase tracking-wide">
                      {(map.lanes || 2) === 1 ? "1 Lane" : `${map.lanes || 2} Lanes`}
                    </div>

                    {/* Selected Tick Indicator */}
                    {isSelected && (
                      <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs shadow-md">
                        ✓
                      </div>
                    )}
                  </div>

                  {/* Map Info */}
                  <div className="p-3 flex flex-col gap-1 flex-1 justify-between">
                    <div>
                      <h3
                        className={`text-sm md:text-base font-bold transition-colors ${
                          isSelected
                            ? "text-amber-300 font-['Almendra',serif]"
                            : "text-slate-100 group-hover:text-amber-200"
                        }`}
                      >
                        {map.name || map.id}
                      </h3>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                        {map.description || "A storied historical battleground."}
                      </p>
                    </div>

                    <div className="pt-2 mt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                      <span>{map.slots?.length || 5} Tower Slots</span>
                      <span
                        className={`font-semibold ${
                          isSelected ? "text-amber-400" : "text-slate-400"
                        }`}
                      >
                        {isSelected ? "Selected" : "Tap to Select"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-t border-amber-600/40 bg-slate-950/80 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-lg"
          >
            Confirm Battlefield
          </button>
        </div>
      </div>
    </div>
  );
};


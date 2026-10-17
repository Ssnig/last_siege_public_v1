import React from "react";
import { MAPS, type MapDefinition } from "@root/shared";

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

  // Filter out sample test map, show canonical 6 battlefields
  const playableMaps = Object.values(MAPS).filter((m) => m.id !== "sample");

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-gradient-to-b from-slate-900 via-[#131b2e] to-slate-950 border-2 border-amber-500/80 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.3)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-600/40 bg-slate-950/60">
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

        {/* Maps Grid */}
        <div className="p-4 md:p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                <div className="relative h-32 md:h-36 w-full overflow-hidden bg-slate-900">
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
                    {map.lanes || 2} Lanes
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
                    <span>5 Tower Slots</span>
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

        {/* Footer */}
        <div className="px-6 py-3 border-t border-amber-600/40 bg-slate-950/80 flex items-center justify-end gap-3">
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

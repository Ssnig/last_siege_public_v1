import React, { useState } from "react";
import type { Vec2, TowerSlot } from "@root/shared";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapId: string;
  mapName: string;
  paths: Record<string, Vec2[]>;
  slots: TowerSlot[];
  portals: Vec2[];
  base: Vec2;
  baseDisplaySize: { width: number; height: number };
  holderScale?: number;
  gridMatrix: number[][];
  gridCols: number;
  gridRows: number;
  cellSize: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  mapId,
  mapName,
  paths,
  slots,
  portals,
  base,
  baseDisplaySize,
  holderScale = 1.0,
  gridMatrix,
  gridCols,
  gridRows,
  cellSize,
}) => {
  const [activeTab, setActiveTab] = useState<"ts" | "matrix" | "json">("ts");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1. Generate TypeScript MapDefinition code
  const generateTypeScript = () => {
    const formattedPaths = Object.entries(paths)
      .map(([name, pts]) => {
        const ptsStr = pts
          .map((p) => `      { x: ${p.x}, y: ${p.y} },`)
          .join("\n");
        return `    ${name}: [\n${ptsStr}\n    ],`;
      })
      .join("\n");

    const formattedSlots = slots
      .map((s) => `    { slotIndex: ${s.slotIndex}, x: ${s.x}, y: ${s.y} },`)
      .join("\n");

    const formattedPortals = portals
      .map((p) => `    { x: ${p.x}, y: ${p.y} },`)
      .join("\n");

    const formattedPathLabels = Object.keys(paths)
      .map(
        (k) =>
          `    ${k}: "${k
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")}",`
      )
      .join("\n");

    const varName = `${mapId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_MAP`;

    return `export const ${varName}: MapDefinition = {
  id: "${mapId}",
  name: "${mapName}",
  description: "Custom tactical layout with precision waypoints and strategic tower pads.",
  lanes: ${Object.keys(paths).length},
  thumbnail: "/assets/maps/map_${mapId === 'bagan' ? '2_bagan' : mapId === 'mandalay' ? '4_mandalay' : mapId === 'inle' ? '3_inle' : mapId === 'innwa' ? '5_innwa' : mapId === 'bago' ? '6_bago' : mapId === 'deserted' ? '7_deserted' : mapId === 'twister' ? '8_twister' : mapId === 'river' ? '9_river' : '1_konbaung'}/preview.png",
  pathHalfWidth: 26,
  holderScale: ${holderScale},
  path: [],
  portals: [
${formattedPortals}
  ],
  paths: {
${formattedPaths}
  },
  pathLabels: {
${formattedPathLabels}
  },
  slots: [
${formattedSlots}
  ],
  checkpoints: [1, 3],
  base: { x: ${base.x}, y: ${base.y} },
  baseDisplaySize: { width: ${baseDisplaySize.width}, height: ${baseDisplaySize.height} },
};`;
  };

  // 2. Generate 2D Grid Matrix JSON
  const generateMatrixJson = () => {
    return JSON.stringify(
      {
        mapId,
        cols: gridCols,
        rows: gridRows,
        cellSize,
        legend: {
          0: "Scenery / Obstacle",
          1: "Walkway / Road",
          2: "Tower Slot Pad",
          3: "Spawner Portal",
          4: "Defender Base",
        },
        matrix: gridMatrix,
      },
      null,
      2
    );
  };

  // 3. Generate Raw Coordinates JSON
  const generateRawJson = () => {
    return JSON.stringify(
      {
        mapId,
        holderScale,
        base,
        baseDisplaySize,
        portals,
        slots,
        paths,
      },
      null,
      2
    );
  };

  const currentContent =
    activeTab === "ts"
      ? generateTypeScript()
      : activeTab === "matrix"
      ? generateMatrixJson()
      : generateRawJson();

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = activeTab === "ts" ? "ts" : "json";
    const filename = `${mapId}_layout_${activeTab}.${ext}`;
    const blob = new Blob([currentContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveToProject = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch("/api/dev/save-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapId,
          mapCode: generateTypeScript(),
          gridMatrix,
          mapData: {
            id: mapId,
            name: mapName,
            width: 1280,
            height: 720,
            description: "Custom tactical layout with precision waypoints and strategic tower pads.",
            pathHalfWidth: 26,
            lanes: Object.keys(paths).length,
            holderScale,
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveStatus("✓ Successfully saved to project!");
        setTimeout(() => setSaveStatus(null), 3500);
      } else {
        setSaveStatus(`❌ Error: ${data.error || "Failed to save"}`);
      }
    } catch (err: any) {
      setSaveStatus(`❌ Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[92vh] bg-slate-900 border-2 border-amber-500/80 rounded-2xl shadow-[0_0_40px_rgba(245,158,11,0.35)] flex flex-col overflow-hidden animate-modalPop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3.5 border-b border-amber-600/40 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">💾</span>
            <h2 className="text-base font-black text-amber-300 uppercase tracking-wider font-['Almendra',serif]">
              Export Map Layout Data
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-200 hover:text-white flex items-center justify-center text-sm transition cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-4 sm:px-6 pt-2.5 pb-2 bg-slate-950/40 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("ts")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === "ts"
                  ? "bg-amber-500 text-slate-950 shadow-md font-black"
                  : "bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
              }`}
            >
              TypeScript (MapDefinition)
            </button>
            <button
              onClick={() => setActiveTab("matrix")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === "matrix"
                  ? "bg-amber-500 text-slate-950 shadow-md font-black"
                  : "bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
              }`}
            >
              2D Grid Matrix (JSON)
            </button>
            <button
              onClick={() => setActiveTab("json")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === "json"
                  ? "bg-amber-500 text-slate-950 shadow-md font-black"
                  : "bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
              }`}
            >
              Raw Coordinates (JSON)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveToProject}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
              title="Save directly to packages/shared/src/game/maps.ts"
            >
              <span>💾</span>
              <span>{saving ? "Saving..." : "Save to Project"}</span>
            </button>
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
            >
              {copied ? "✓ Copied!" : "📋 Copy Code"}
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
            >
              📥 Download File
            </button>
          </div>
        </div>

        {/* Code Content View */}
        <div className="p-4 flex-1 overflow-auto bg-slate-950/90 font-mono text-xs">
          <pre className="text-amber-200/90 leading-relaxed whitespace-pre-wrap select-text">
            {currentContent}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-2 sm:py-2.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            {saveStatus ? (
              <span
                className={`font-bold ${
                  saveStatus.startsWith("✓")
                    ? "text-emerald-400 animate-pulse"
                    : "text-red-400"
                }`}
              >
                {saveStatus}
              </span>
            ) : (
              <span>
                {activeTab === "ts"
                  ? "Click 'Save to Project' to write directly to packages/shared/src/game/maps.ts"
                  : activeTab === "matrix"
                  ? `Exported matrix: ${gridCols} cols × ${gridRows} rows (${cellSize}px grid)`
                  : `Total: ${slots.length} Slots, ${portals.length} Portals, ${Object.keys(paths).length} Tracks`}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
export default ExportModal;


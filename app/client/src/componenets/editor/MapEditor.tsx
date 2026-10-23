import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MAPS,
  type MapDefinition,
  type Vec2,
  type TowerSlot,
} from "@root/shared";
import { EditorCanvas, type EditorTool } from "./EditorCanvas";
import { ExportModal } from "./ExportModal";

interface MapPreset {
  id: string;
  name: string;
  imageSrc: string;
  definition?: MapDefinition;
}

const MAP_PRESETS: MapPreset[] = [
  {
    id: "bagan",
    name: "Bagan (Ancient Plains)",
    imageSrc: "/assets/maps/map_2_bagan/map.jpg",
    definition: MAPS["bagan"],
  },
  {
    id: "konbaung",
    name: "Konbaung (Royal Capital)",
    imageSrc: "/assets/maps/map_1_konbaung/map.jpg",
    definition: MAPS["konbaung"],
  },
  {
    id: "inle",
    name: "Inle (Floating Sanctuary)",
    imageSrc: "/assets/maps/map_3_inle/map.jpg",
    definition: MAPS["inle"],
  },
  {
    id: "mandalay",
    name: "Mandalay (Golden Fortress)",
    imageSrc: "/assets/maps/map_4_mandalay/map.jpg",
    definition: MAPS["mandalay"],
  },
  {
    id: "innwa",
    name: "Innwa (Ava Ruins)",
    imageSrc: "/assets/maps/map_5_innwa/map.jpg",
    definition: MAPS["innwa"],
  },
  {
    id: "bago",
    name: "Bago (Hanthawaddy Fortress)",
    imageSrc: "/assets/maps/map_6_bago/map.jpg",
    definition: MAPS["bago"],
  },
  {
    id: "deserted",
    name: "Map 7: Deserted Sands",
    imageSrc: "/assets/maps/map_7_deserted/map.jpg",
    definition: MAPS["deserted"],
  },
  {
    id: "twister",
    name: "Map 8: Twister Valley",
    imageSrc: "/assets/maps/map_8_twister/map.jpg",
    definition: MAPS["twister"],
  },
  {
    id: "river",
    name: "Map 9: River Crossing",
    imageSrc: "/assets/maps/map_9_river/map.jpg",
    definition: MAPS["river"],
  },
];

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

export const MapEditor: React.FC = () => {
  const navigate = useNavigate();

  // Map & Visual Settings
  const [selectedMapId, setSelectedMapId] = useState<string>("bagan");
  const [customImageSrc, setCustomImageSrc] = useState<string | null>(null);
  const [cellSize, setCellSize] = useState<number>(20);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [gridOpacity, setGridOpacity] = useState<number>(0.35);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [previewTowers, setPreviewTowers] = useState<boolean>(false);

  // Tower Holder Scale (Per-Map)
  const [holderScale, setHolderScale] = useState<number>(1.0);

  // Unsaved Changes Tracking & Save Reminder Modal
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [showSaveReminder, setShowSaveReminder] = useState<boolean>(false);
  const [pendingNavigation, setPendingNavigation] = useState<
    | { type: "map"; targetId: string }
    | { type: "upload" }
    | { type: "lobby" }
    | null
  >(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // UI Scaling (default 90% view)
  const [uiScale, setUiScale] = useState<number>(() => {
    const saved = localStorage.getItem("map_editor_ui_scale");
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0.7 && parsed <= 1.2) {
        return parsed;
      }
    }
    return 0.9;
  });

  const handleSetUiScale = (scale: number) => {
    setUiScale(scale);
    localStorage.setItem("map_editor_ui_scale", scale.toString());
  };

  // Active Tool
  const [activeTool, setActiveTool] = useState<EditorTool>("brush_path");

  // Grid Dimensions & 2D Matrix
  const gridCols = Math.ceil(CANVAS_WIDTH / cellSize);
  const gridRows = Math.ceil(CANVAS_HEIGHT / cellSize);
  const [gridMatrix, setGridMatrix] = useState<number[][]>(() =>
    Array.from({ length: Math.ceil(CANVAS_HEIGHT / 20) }, () =>
      Array(Math.ceil(CANVAS_WIDTH / 20)).fill(0)
    )
  );

  // Layout Data
  const [paths, setPaths] = useState<Record<string, Vec2[]>>({});
  const [activePathId, setActivePathId] = useState<string>("main");
  const [newTrackName, setNewTrackName] = useState<string>("");
  const [slots, setSlots] = useState<TowerSlot[]>([]);
  const [portals, setPortals] = useState<Vec2[]>([]);
  const [base, setBase] = useState<Vec2>({ x: 1080, y: 360 });
  const [baseDisplaySize, setBaseDisplaySize] = useState<{
    width: number;
    height: number;
  }>({ width: 140, height: 140 });

  // Hover Coordinates
  const [hoverCoord, setHoverCoord] = useState<{
    x: number;
    y: number;
    col: number;
    row: number;
    value: number;
  } | null>(null);

  // Export Modal
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  // History stack for Undo / Redo
  interface HistoryState {
    gridMatrix: number[][];
    paths: Record<string, Vec2[]>;
    slots: TowerSlot[];
    portals: Vec2[];
    base: Vec2;
    holderScale: number;
  }
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Re-initialize or resize grid matrix when cellSize changes
  useEffect(() => {
    setGridMatrix((prev) => {
      const next: number[][] = [];
      for (let r = 0; r < gridRows; r++) {
        const row: number[] = [];
        for (let c = 0; c < gridCols; c++) {
          row.push(prev[r]?.[c] ?? 0);
        }
        next.push(row);
      }
      return next;
    });
  }, [cellSize, gridCols, gridRows]);

  // Load selected preset map data
  const loadPresetMap = useCallback(
    (presetId: string) => {
      setSelectedMapId(presetId);
      setCustomImageSrc(null);
      const preset = MAP_PRESETS.find((p) => p.id === presetId);
      const def = preset?.definition ?? MAPS[presetId];

      if (def) {
        // Paths
        let loadedPaths: Record<string, Vec2[]> = {};
        if (def.paths && Object.keys(def.paths).length > 0) {
          loadedPaths = JSON.parse(JSON.stringify(def.paths));
        } else if (def.path && def.path.length > 0) {
          loadedPaths = { main: JSON.parse(JSON.stringify(def.path)) };
        }
        setPaths(loadedPaths);
        const firstKey = Object.keys(loadedPaths)[0] || "main";
        setActivePathId(firstKey);

        // Slots
        if (def.slots) {
          setSlots(JSON.parse(JSON.stringify(def.slots)));
        } else {
          setSlots([]);
        }

        // Portals
        if (def.portals && def.portals.length > 0) {
          setPortals(JSON.parse(JSON.stringify(def.portals)));
        } else if (def.path && def.path.length > 0) {
          setPortals([{ x: def.path[0].x, y: def.path[0].y }]);
        } else {
          setPortals([]);
        }

        // Base
        if (def.base) {
          setBase({ ...def.base });
        }
        if (def.baseDisplaySize) {
          setBaseDisplaySize({ ...def.baseDisplaySize });
        }

        // Holder Scale (Per-Map)
        setHolderScale(def.holderScale ?? 1.0);
      }

      setHasUnsavedChanges(false);
      setHistory([]);
      setHistoryIndex(-1);
    },
    []
  );

  // Initial load
  useEffect(() => {
    loadPresetMap("bagan");
  }, [loadPresetMap]);

  // Snapshot to history when key states change
  const pushHistory = useCallback(
    (
      newGridMatrix: number[][],
      newPaths: Record<string, Vec2[]>,
      newSlots: TowerSlot[],
      newPortals: Vec2[],
      newBase: Vec2,
      newHolderScale: number = holderScale
    ) => {
      const snapshot: HistoryState = {
        gridMatrix: newGridMatrix.map((r) => [...r]),
        paths: JSON.parse(JSON.stringify(newPaths)),
        slots: JSON.parse(JSON.stringify(newSlots)),
        portals: JSON.parse(JSON.stringify(newPortals)),
        base: { ...newBase },
        holderScale: newHolderScale,
      };

      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIndex + 1);
        return [...trimmed, snapshot].slice(-25);
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 24));
      setHasUnsavedChanges(true);
    },
    [historyIndex, holderScale]
  );

  const handleUpdateGridMatrix = (newMatrix: number[][]) => {
    setGridMatrix(newMatrix);
    pushHistory(newMatrix, paths, slots, portals, base, holderScale);
  };

  const handleUpdatePaths = (newPaths: Record<string, Vec2[]>) => {
    setPaths(newPaths);
    pushHistory(gridMatrix, newPaths, slots, portals, base, holderScale);
  };

  const handleUpdateSlots = (newSlots: TowerSlot[]) => {
    setSlots(newSlots);
    let nextMatrix = gridMatrix;
    // When a slot is newly added, auto-stamp 3x3 footprint in gridMatrix as 2 (Tower Slot Pad)
    if (newSlots.length > slots.length) {
      const added = newSlots[newSlots.length - 1];
      const centerCol = Math.floor(added.x / cellSize);
      const centerRow = Math.floor(added.y / cellSize);
      nextMatrix = gridMatrix.map((row, rIdx) =>
        Math.abs(rIdx - centerRow) <= 1
          ? row.map((val, cIdx) => (Math.abs(cIdx - centerCol) <= 1 ? 2 : val))
          : [...row]
      );
      setGridMatrix(nextMatrix);
    }
    pushHistory(nextMatrix, paths, newSlots, portals, base, holderScale);
  };

  const handleUpdatePortals = (newPortals: Vec2[]) => {
    setPortals(newPortals);
    pushHistory(gridMatrix, paths, slots, newPortals, base, holderScale);
  };

  const handleUpdateBase = (newBase: Vec2) => {
    setBase(newBase);
    pushHistory(gridMatrix, paths, slots, portals, newBase, holderScale);
  };

  const handleUpdateHolderScale = (scale: number) => {
    const clamped = Math.round(Math.max(0.5, Math.min(1.5, scale)) * 100) / 100;
    setHolderScale(clamped);
    pushHistory(gridMatrix, paths, slots, portals, base, clamped);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetState = history[historyIndex - 1];
      setGridMatrix(targetState.gridMatrix.map((r) => [...r]));
      setPaths(JSON.parse(JSON.stringify(targetState.paths)));
      setSlots(JSON.parse(JSON.stringify(targetState.slots)));
      setPortals(JSON.parse(JSON.stringify(targetState.portals)));
      setBase({ ...targetState.base });
      if (targetState.holderScale !== undefined) {
        setHolderScale(targetState.holderScale);
      }
      setHistoryIndex(historyIndex - 1);
      setHasUnsavedChanges(true);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const targetState = history[historyIndex + 1];
      setGridMatrix(targetState.gridMatrix.map((r) => [...r]));
      setPaths(JSON.parse(JSON.stringify(targetState.paths)));
      setSlots(JSON.parse(JSON.stringify(targetState.slots)));
      setPortals(JSON.parse(JSON.stringify(targetState.portals)));
      setBase({ ...targetState.base });
      if (targetState.holderScale !== undefined) {
        setHolderScale(targetState.holderScale);
      }
      setHistoryIndex(historyIndex + 1);
      setHasUnsavedChanges(true);
    }
  };

  // Custom Image Upload handler
  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomImageSrc(url);
      setSelectedMapId("custom");
      setHasUnsavedChanges(true);
    }
  };

  // Add new track
  const handleAddTrack = () => {
    const trimmed = newTrackName.trim().toLowerCase().replace(/\s+/g, "_");
    if (!trimmed) return;
    if (paths[trimmed]) {
      alert(`Track '${trimmed}' already exists!`);
      return;
    }
    const updated = {
      ...paths,
      [trimmed]: [],
    };
    handleUpdatePaths(updated);
    setActivePathId(trimmed);
    setNewTrackName("");
  };

  // Delete current track
  const handleDeleteCurrentTrack = () => {
    if (Object.keys(paths).length <= 1) {
      alert("Cannot delete the only remaining track.");
      return;
    }
    const updated = { ...paths };
    delete updated[activePathId];
    handleUpdatePaths(updated);
    setActivePathId(Object.keys(updated)[0]);
  };

  // Active background image
  const currentPreset = MAP_PRESETS.find((p) => p.id === selectedMapId);
  const activeImageSrc =
    customImageSrc || currentPreset?.imageSrc || "/assets/maps/map_2_bagan/map.jpg";

  // Generate TypeScript MapDefinition code
  const generateTypeScriptCode = () => {
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

    const thumbMap: Record<string, string> = {
      bagan: "2_bagan",
      mandalay: "4_mandalay",
      inle: "3_inle",
      innwa: "5_innwa",
      bago: "6_bago",
      deserted: "7_deserted",
      twister: "8_twister",
      river: "9_river",
    };
    const thumbFolder = thumbMap[selectedMapId] || "1_konbaung";
    const varName = `${selectedMapId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_MAP`;

    return `export const ${varName}: MapDefinition = {
  id: "${selectedMapId}",
  name: "${currentPreset?.name || "Custom Battlefield"}",
  description: "Custom tactical layout with precision waypoints and strategic tower pads.",
  lanes: ${Object.keys(paths).length},
  thumbnail: "/assets/maps/map_${thumbFolder}/preview.png",
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

  // Direct Save to Project API
  const handleDirectSave = async (): Promise<boolean> => {
    setIsSaving(true);
    setSaveNotice(null);
    try {
      const res = await fetch("/api/dev/save-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapId: selectedMapId,
          mapCode: generateTypeScriptCode(),
          gridMatrix,
          mapData: {
            id: selectedMapId,
            name: currentPreset?.name || "Custom Battlefield",
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            description:
              "Custom tactical layout with precision waypoints and strategic tower pads.",
            pathHalfWidth: 26,
            lanes: Object.keys(paths).length,
            holderScale,
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setHasUnsavedChanges(false);
        setSaveNotice("✓ Saved to project successfully!");
        setTimeout(() => setSaveNotice(null), 3500);
        return true;
      } else {
        alert(`Failed to save map: ${data.error || "Unknown error"}`);
        return false;
      }
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Intercept map navigation when unsaved changes exist
  const handleRequestMapChange = (targetId: string) => {
    if (targetId === selectedMapId) return;
    if (hasUnsavedChanges) {
      if (targetId === "upload") {
        setPendingNavigation({ type: "upload" });
      } else {
        setPendingNavigation({ type: "map", targetId });
      }
      setShowSaveReminder(true);
    } else {
      if (targetId === "upload") {
        fileInputRef.current?.click();
      } else {
        loadPresetMap(targetId);
      }
    }
  };

  const handleRequestLobby = () => {
    if (hasUnsavedChanges) {
      setPendingNavigation({ type: "lobby" });
      setShowSaveReminder(true);
    } else {
      navigate("/lobby");
    }
  };

  const executePendingNavigation = (nav: typeof pendingNavigation) => {
    if (!nav) return;
    if (nav.type === "map") {
      loadPresetMap(nav.targetId);
    } else if (nav.type === "upload") {
      fileInputRef.current?.click();
    } else if (nav.type === "lobby") {
      navigate("/lobby");
    }
    setPendingNavigation(null);
  };

  const handleSaveAndNavigate = async () => {
    const success = await handleDirectSave();
    if (success) {
      setShowSaveReminder(false);
      executePendingNavigation(pendingNavigation);
    }
  };

  const handleDiscardAndNavigate = () => {
    setHasUnsavedChanges(false);
    setShowSaveReminder(false);
    executePendingNavigation(pendingNavigation);
  };

  const handleCancelNavigate = () => {
    setShowSaveReminder(false);
    setPendingNavigation(null);
  };

  // Tool definitions
  const TOOL_INFO: Record<
    EditorTool,
    { name: string; icon: string; shortcut: string; hint: string }
  > = {
    brush_path: {
      name: "Paint Walkway",
      icon: "🖌️",
      shortcut: "B",
      hint: "Left-click or drag to paint passable walkway terrain (Grid Value 1).",
    },
    brush_obstacle: {
      name: "Erase Walkway",
      icon: "🧼",
      shortcut: "E",
      hint: "Left-click or drag to erase painted walkways back to scenery (Grid Value 0).",
    },
    waypoint: {
      name: "Waypoint Polyline",
      icon: "📍",
      shortcut: "W",
      hint: "Left-click to add path waypoint. Drag existing points to fine-tune curves.",
    },
    slot: {
      name: "Tower Dais",
      icon: "🛡️",
      shortcut: "S",
      hint: "Click to place authentic stone lotus tower holder (H0..Hn). Drag to reposition.",
    },
    portal: {
      name: "Spawner Portal",
      icon: "🌀",
      shortcut: "P",
      hint: "Click to position attacker spawn portal. Connected to nearest track spawn.",
    },
    base: {
      name: "Defender Base",
      icon: "🏛️",
      shortcut: "K",
      hint: "Click to place defender castle stronghold & goal destination.",
    },
    inspect: {
      name: "Inspector Cursor",
      icon: "🔍",
      shortcut: "I",
      hint: "Inspect waypoint coords, slot positions, and grid matrix cells without painting.",
    },
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "b") setActiveTool("brush_path");
      else if (key === "e") setActiveTool("brush_obstacle");
      else if (key === "w") setActiveTool("waypoint");
      else if (key === "s") setActiveTool("slot");
      else if (key === "p") setActiveTool("portal");
      else if (key === "k") setActiveTool("base");
      else if (key === "i") setActiveTool("inspect");
      else if (key === "z" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div
      className="bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none font-sans"
      style={{
        zoom: uiScale,
        width: `calc(100vw / ${uiScale})`,
        height: `calc(100vh / ${uiScale})`,
      }}
    >
      {/* ═══ 1. Top Control Bar ═══ */}
      <header className="h-14 bg-gradient-to-r from-slate-900 via-[#161f36] to-slate-900 border-b border-amber-500/40 px-3 sm:px-4 flex items-center justify-between z-30 shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Back to Lobby */}
          <button
            onClick={handleRequestLobby}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-amber-300 hover:text-white border border-amber-500/30 text-xs font-bold transition shadow-sm cursor-pointer shrink-0"
            title="Return to Match Lobby"
          >
            <span>◀</span> Lobby
          </button>

          {/* Title & Unsaved Changes Indicator */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl">🛠️</span>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wider font-['Almendra',serif] whitespace-nowrap">
                  Map Layout Editor
                </h1>
                {hasUnsavedChanges && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse whitespace-nowrap">
                    ● Unsaved
                  </span>
                )}
              </div>
              <p className="text-[10px] text-amber-200/50 leading-none whitespace-nowrap hidden lg:block">
                Strategic Walkways & Tower Dais Inspector
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-700 mx-0.5 hidden sm:block" />

          {/* Map Preset Selector */}
          <div className="flex items-center gap-1.5 shrink-0">
            <label className="text-xs text-amber-200/70 font-semibold">Map:</label>
            <select
              value={selectedMapId}
              onChange={(e) => handleRequestMapChange(e.target.value)}
              className="bg-slate-950 text-amber-200 text-xs rounded-lg px-2.5 py-1.5 border border-amber-500/40 focus:outline-none focus:border-amber-400 font-medium cursor-pointer"
            >
              {MAP_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="upload">📁 Upload Custom Artwork...</option>
              {selectedMapId === "custom" && (
                <option value="custom">🖼️ Custom Uploaded Art</option>
              )}
            </select>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUploadImage}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* Grid Size Toggle */}
          <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-700 text-xs shrink-0">
            <span className="text-[10px] text-slate-400 px-1 font-semibold">Grid:</span>
            {[20, 32, 40].map((sz) => (
              <button
                key={sz}
                onClick={() => setCellSize(sz)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                  cellSize === sz
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                {sz}px
              </button>
            ))}
          </div>

          {/* Grid Opacity & Visibility */}
          <div className="flex items-center gap-1.5 text-xs shrink-0">
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`px-2 py-1 rounded text-xs font-bold transition border cursor-pointer ${
                showGrid
                  ? "bg-slate-800 border-amber-500/50 text-amber-300"
                  : "bg-slate-950 border-slate-700 text-slate-500"
              }`}
              title="Toggle Grid Lines Overlay"
            >
              # Grid
            </button>
            {showGrid && (
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={gridOpacity}
                onChange={(e) => setGridOpacity(parseFloat(e.target.value))}
                className="w-14 h-1.5 bg-slate-700 rounded-lg accent-amber-400 cursor-pointer"
                title={`Grid Opacity: ${Math.round(gridOpacity * 100)}%`}
              />
            )}
          </div>

          {/* Snap-to-grid Toggle */}
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`px-2 py-1 rounded text-xs font-bold transition border cursor-pointer shrink-0 ${
              snapToGrid
                ? "bg-indigo-600/80 border-indigo-400 text-white shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                : "bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
            title="Snap Waypoints & Slots to Nearest Grid Cell Center"
          >
            🧲 Snap
          </button>

          {/* Tower Preview Toggle */}
          <button
            onClick={() => setPreviewTowers(!previewTowers)}
            className={`px-2.5 py-1 rounded text-xs font-bold transition border flex items-center gap-1.5 cursor-pointer shrink-0 ${
              previewTowers
                ? "bg-amber-600/80 border-amber-400 text-white shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                : "bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
            title="Toggle Tower Sprite Previews on Placed Bases"
          >
            <span>🏰</span>
            <span>Preview Towers</span>
          </button>

          {/* Top Navbar Tower Holder Size Slider */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 px-2 py-1 rounded-lg border border-amber-500/40 text-xs shrink-0 shadow-inner">
            <span
              className="text-[11px] text-amber-200/90 font-bold whitespace-nowrap"
              title="Scale all tower holders and mounted towers on this map"
            >
              Holder:
            </span>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={holderScale}
              onChange={(e) => handleUpdateHolderScale(parseFloat(e.target.value))}
              className="w-16 h-1.5 bg-slate-700 rounded-lg accent-amber-400 cursor-pointer"
              title={`All Tower Holders Scale: ${Math.round(holderScale * 100)}%`}
            />
            <span className="text-[10px] font-mono font-bold text-amber-300 w-8 text-right">
              {Math.round(holderScale * 100)}%
            </span>
            {holderScale !== 1.0 && (
              <button
                onClick={() => handleUpdateHolderScale(1.0)}
                className="text-[10px] text-slate-400 hover:text-amber-300 px-1 py-0.5 rounded transition cursor-pointer"
                title="Reset to 100%"
              >
                ↺
              </button>
            )}
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-700 text-xs shrink-0">
            <span className="text-[10px] text-slate-400 px-1 font-semibold">Zoom:</span>
            {[1, 1.25, 1.5].map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                  zoom === z
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                {z}x
              </button>
            ))}
          </div>

          {/* UI Scale controls */}
          <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-700 text-xs shrink-0">
            <span className="text-[10px] text-slate-400 px-1 font-semibold">Scale:</span>
            {[0.8, 0.9, 1.0].map((s) => (
              <button
                key={s}
                onClick={() => handleSetUiScale(s)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                  uiScale === s
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
                title={`UI Scale ${Math.round(s * 100)}%`}
              >
                {Math.round(s * 100)}%
              </button>
            ))}
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Undo / Redo */}
          <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-700 text-xs">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="px-2 py-0.5 rounded text-xs font-bold text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 transition cursor-pointer"
              title="Undo (Ctrl+Z)"
            >
              ↩ Undo
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="px-2 py-0.5 rounded text-xs font-bold text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 transition cursor-pointer"
              title="Redo (Ctrl+Shift+Z)"
            >
              ↪ Redo
            </button>
          </div>

          {/* Clear Grid Mask */}
          <button
            onClick={() => {
              if (confirm("Reset Walkway Grid Mask to all 0s?")) {
                handleUpdateGridMatrix(
                  Array.from({ length: gridRows }, () => Array(gridCols).fill(0))
                );
              }
            }}
            className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-700/50 text-red-300 hover:text-white text-xs font-bold transition cursor-pointer"
            title="Reset Paint Layer"
          >
            🧹 Clear
          </button>

          {/* Direct Save Button */}
          <button
            onClick={() => handleDirectSave()}
            disabled={isSaving}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md ${
              hasUnsavedChanges
                ? "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            }`}
            title="Directly save map changes to project files"
          >
            <span>💾</span>
            <span>{isSaving ? "Saving..." : "Save"}</span>
          </button>

          {/* Export Code & Matrix */}
          <button
            onClick={() => setIsExportOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs tracking-wider transition shadow-[0_0_12px_rgba(245,158,11,0.4)] cursor-pointer flex items-center gap-1.5 active:scale-95"
            title="Export TypeScript Definition, 2D Grid Matrix, and JSON"
          >
            <span>📋</span> Export
          </button>
        </div>
      </header>

      {/* Save Success Notice Toast */}
      {saveNotice && (
        <div className="fixed top-16 right-4 z-50 bg-emerald-950/90 border border-emerald-500 text-emerald-300 px-4 py-2 rounded-lg shadow-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <span>{saveNotice}</span>
        </div>
      )}

      {/* ═══ 2. Main Workspace Layout ═══ */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Toolbar */}
        <aside className="w-16 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 gap-2 z-20 shrink-0">
          <div className="text-[10px] text-amber-300/60 font-bold uppercase tracking-wider mb-1 font-mono">
            Tools
          </div>
          {(Object.keys(TOOL_INFO) as EditorTool[]).map((toolKey) => {
            const info = TOOL_INFO[toolKey];
            const isActive = activeTool === toolKey;
            return (
              <button
                key={toolKey}
                onClick={() => setActiveTool(toolKey)}
                className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center transition group relative cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-b from-amber-500 to-amber-600 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)] font-bold scale-105"
                    : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60"
                }`}
                title={`${info.name} (${info.shortcut})`}
              >
                <span className="text-xl leading-none">{info.icon}</span>
                <span className="text-[9px] font-bold uppercase mt-1 leading-none">
                  {info.name.split(" ")[0]}
                </span>
                <div className="absolute left-16 px-2.5 py-1 bg-slate-950 border border-amber-500/50 rounded shadow-xl text-amber-200 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">
                  {info.name} ({info.shortcut})
                </div>
              </button>
            );
          })}
        </aside>

        {/* Center Interactive Canvas Viewport */}
        <main className="flex-1 overflow-auto bg-slate-950 flex items-center justify-center p-4 relative">
          <div className="shadow-2xl rounded-lg overflow-hidden border-2 border-slate-800 bg-black relative">
            <EditorCanvas
              imageSrc={activeImageSrc}
              cellSize={cellSize}
              gridCols={gridCols}
              gridRows={gridRows}
              gridMatrix={gridMatrix}
              onUpdateGridMatrix={handleUpdateGridMatrix}
              activeTool={activeTool}
              paths={paths}
              activePathId={activePathId}
              onUpdatePaths={handleUpdatePaths}
              slots={slots}
              onUpdateSlots={handleUpdateSlots}
              portals={portals}
              onUpdatePortals={handleUpdatePortals}
              base={base}
              onUpdateBase={handleUpdateBase}
              baseDisplaySize={baseDisplaySize}
              previewTowers={previewTowers}
              holderScale={holderScale}
              showGrid={showGrid}
              gridOpacity={gridOpacity}
              snapToGrid={snapToGrid}
              zoom={zoom}
              onHoverCoord={setHoverCoord}
            />
          </div>
        </main>

        {/* Right Properties Inspector */}
        <aside className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col z-20 shrink-0">
          <div className="p-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <h2 className="text-xs font-bold text-amber-300 uppercase tracking-wider font-['Almendra',serif]">
              Layout Inspector
            </h2>
            <span className="text-[10px] text-slate-400 font-mono">
              {CANVAS_WIDTH}×{CANVAS_HEIGHT} px
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
            {/* Multi-Track Polyline Manager */}
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-amber-200/90 uppercase text-[11px] tracking-wide">
                  🛣️ Paths & Tracks ({Object.keys(paths).length})
                </span>
                {Object.keys(paths).length > 1 && (
                  <button
                    onClick={handleDeleteCurrentTrack}
                    className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    Delete Track
                  </button>
                )}
              </div>

              {/* Track Switcher */}
              <div className="space-y-1 mb-2">
                {Object.entries(paths).map(([id, pts]) => {
                  const isSelected = activePathId === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setActivePathId(id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between text-xs font-mono transition cursor-pointer ${
                        isSelected
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold"
                          : "bg-slate-900/60 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 border border-transparent"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            id === "main" || id.includes("top")
                              ? "bg-amber-400"
                              : id.includes("bottom")
                              ? "bg-emerald-400"
                              : "bg-pink-400"
                          }`}
                        />
                        {id}
                      </span>
                      <span className="text-[10px] opacity-70">
                        {pts.length} waypoints
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Add New Track Input */}
              <div className="flex items-center gap-1 pt-1 border-t border-slate-800">
                <input
                  type="text"
                  placeholder="New track name (e.g. flank)..."
                  value={newTrackName}
                  onChange={(e) => setNewTrackName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTrack()}
                  className="flex-1 bg-slate-900 px-2 py-1 rounded text-xs text-amber-200 border border-slate-700 focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={handleAddTrack}
                  className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs cursor-pointer"
                >
                  + Add
                </button>
              </div>

              {/* Waypoint Coordinates for active track */}
              {paths[activePathId] && (
                <div className="mt-3 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-1 text-[11px] text-slate-400">
                    <span>
                      Waypoints on [
                      <span className="text-amber-300 font-bold font-mono">
                        {activePathId}
                      </span>
                      ]:
                    </span>
                    <button
                      onClick={() => {
                        handleUpdatePaths({
                          ...paths,
                          [activePathId]: [],
                        });
                      }}
                      className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer"
                    >
                      Clear Points
                    </button>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-0.5 font-mono text-[11px]">
                    {paths[activePathId].length === 0 ? (
                      <div className="text-slate-500 italic p-1 text-center">
                        No points. Click with Waypoint Tool (W) to add.
                      </div>
                    ) : (
                      paths[activePathId].map((pt, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-slate-900/60 px-2 py-0.5 rounded text-slate-300 hover:bg-slate-800/60"
                        >
                          <span className="text-amber-400/90 font-bold">
                            #{idx}
                          </span>
                          <span>
                            ({pt.x}, {pt.y})
                          </span>
                          <button
                            onClick={() => {
                              const updated = paths[activePathId].filter(
                                (_, i) => i !== idx
                              );
                              handleUpdatePaths({
                                ...paths,
                                [activePathId]: updated,
                              });
                            }}
                            className="text-red-400 hover:text-red-200 text-xs font-bold cursor-pointer"
                            title="Remove Point"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tower Slots */}
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-amber-200/90 uppercase text-[11px] tracking-wide">
                  🛡️ Tower Slots ({slots.length})
                </span>
                {slots.length > 0 && (
                  <button
                    onClick={() => handleUpdateSlots([])}
                    className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Dedicated All Tower Holders Scale Card */}
              <div className="bg-slate-900/90 border border-amber-500/40 rounded-lg p-2.5 mb-2.5 shadow-sm">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-amber-300 flex items-center gap-1">
                    <span>📐</span> All Tower Holders Scale:
                  </span>
                  <span className="font-mono font-black text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40 text-xs">
                    {Math.round(holderScale * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">50%</span>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={holderScale}
                    onChange={(e) => handleUpdateHolderScale(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-slate-800 rounded-lg accent-amber-400 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400">150%</span>
                  {holderScale !== 1.0 && (
                    <button
                      onClick={() => handleUpdateHolderScale(1.0)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] border border-amber-500/30 cursor-pointer"
                      title="Reset to 100%"
                    >
                      ↺ Reset
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  Resizes all {slots.length} tower stone daises & mounted towers on{" "}
                  <span className="text-amber-200/90 font-semibold">
                    {currentPreset?.name || "this map"}
                  </span>
                  .
                </p>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                {slots.length === 0 ? (
                  <div className="text-slate-500 italic p-1 text-center">
                    No slots. Click with Tower Slot Tool (S) to place.
                  </div>
                ) : (
                  slots.map((s, idx) => (
                    <div
                      key={s.slotIndex}
                      className="flex items-center justify-between bg-slate-900/80 px-2 py-1 rounded border border-slate-800/80"
                    >
                      <span className="text-amber-400 font-bold">
                        H{s.slotIndex}
                      </span>
                      <span className="text-slate-300">
                        ({s.x}, {s.y})
                      </span>
                      <button
                        onClick={() => {
                          const updated = slots
                            .filter((_, i) => i !== idx)
                            .map((st, i) => ({ ...st, slotIndex: i }));
                          handleUpdateSlots(updated);
                        }}
                        className="text-red-400 hover:text-red-200 text-xs font-bold cursor-pointer"
                        title="Remove Slot"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Portals */}
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-amber-200/90 uppercase text-[11px] tracking-wide">
                  🌀 Spawner Portals ({portals.length})
                </span>
                {portals.length > 0 && (
                  <button
                    onClick={() => handleUpdatePortals([])}
                    className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                {portals.length === 0 ? (
                  <div className="text-slate-500 italic p-1 text-center">
                    No explicit portals. Falls back to path starting points.
                  </div>
                ) : (
                  portals.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-slate-900/80 px-2 py-1 rounded border border-slate-800/80"
                    >
                      <span className="text-pink-400 font-bold">P{idx}</span>
                      <span className="text-slate-300">
                        ({p.x}, {p.y})
                      </span>
                      <button
                        onClick={() => {
                          const updated = portals.filter((_, i) => i !== idx);
                          handleUpdatePortals(updated);
                        }}
                        className="text-red-400 hover:text-red-200 text-xs font-bold cursor-pointer"
                        title="Remove Portal"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Defender Base */}
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="font-bold text-amber-200/90 uppercase text-[11px] tracking-wide block mb-2">
                🏛️ Defender Base Stronghold
              </span>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800/80 space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Position:</span>
                  <span className="text-amber-300">
                    ({base.x}, {base.y})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Display Size:</span>
                  <span className="text-amber-300">
                    {baseDisplaySize.width}×{baseDisplaySize.height} px
                  </span>
                </div>
                <div className="pt-1 text-[10px] text-slate-500 font-sans italic">
                  Select Base tool (K) and click canvas to relocate stronghold.
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ═══ 3. Bottom Status Bar ═══ */}
      <footer className="h-7 bg-slate-950 border-t border-slate-800 px-4 flex items-center justify-between text-[11px] text-slate-400 font-mono z-30 shrink-0">
        <div className="flex items-center gap-4">
          {hoverCoord ? (
            <div className="flex items-center gap-3">
              <span>
                Pixel:{" "}
                <span className="text-amber-300 font-bold">
                  X: {hoverCoord.x}, Y: {hoverCoord.y}
                </span>
              </span>
              <span>
                Cell:{" "}
                <span className="text-amber-300 font-bold">
                  [{hoverCoord.col}, {hoverCoord.row}]
                </span>
              </span>
              <span>
                Value:{" "}
                <span className="text-amber-400 font-bold">
                  {hoverCoord.value}
                </span>{" "}
                <span className="text-slate-500">
                  (
                  {hoverCoord.value === 0
                    ? "Scenery/Obstacle"
                    : hoverCoord.value === 1
                    ? "Walkway"
                    : hoverCoord.value === 2
                    ? "Tower Pad"
                    : "Special"}
                  )
                </span>
              </span>
            </div>
          ) : (
            <span className="text-slate-500 italic">
              Hover over the map canvas to inspect coordinates & grid values...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold">
            [{TOOL_INFO[activeTool].icon} {TOOL_INFO[activeTool].name}]:
          </span>
          <span className="text-slate-300 font-sans">
            {TOOL_INFO[activeTool].hint}
          </span>
        </div>
      </footer>

      {/* ═══ 4. Save Reminder Modal on Map Switch or Navigation ═══ */}
      {showSaveReminder && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border-2 border-amber-500/80 rounded-2xl shadow-[0_0_35px_rgba(245,158,11,0.3)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-3.5 bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-b border-amber-600/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <h3 className="text-sm font-black text-amber-300 uppercase tracking-wider font-['Almendra',serif]">
                  Unsaved Changes
                </h3>
              </div>
              <button
                onClick={handleCancelNavigate}
                className="text-slate-400 hover:text-white text-base leading-none px-1.5 py-0.5 rounded cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3 text-xs text-slate-300">
              <p className="leading-relaxed">
                You have unsaved changes on{" "}
                <span className="font-bold text-amber-300">
                  {currentPreset?.name || selectedMapId}
                </span>{" "}
                (paths, tower holders, or holder size scale).
              </p>
              <p className="text-slate-400">
                Would you like to save your modifications to the project before switching?
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="px-5 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                onClick={handleCancelNavigate}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDiscardAndNavigate}
                className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-700/60 text-red-300 hover:text-white font-bold transition cursor-pointer text-xs"
              >
                Discard & Switch
              </button>
              <button
                onClick={handleSaveAndNavigate}
                disabled={isSaving}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold transition shadow-md cursor-pointer flex items-center gap-1.5 text-xs"
              >
                <span>💾</span>
                <span>{isSaving ? "Saving..." : "Save & Switch"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 5. Export Modal ═══ */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        mapId={selectedMapId}
        mapName={currentPreset?.name || "Custom Battlefield"}
        paths={paths}
        slots={slots}
        portals={portals}
        base={base}
        baseDisplaySize={baseDisplaySize}
        holderScale={holderScale}
        gridMatrix={gridMatrix}
        gridCols={gridCols}
        gridRows={gridRows}
        cellSize={cellSize}
      />
    </div>
  );
};
export default MapEditor;

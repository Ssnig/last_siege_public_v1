import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MAPS,
  type MapDefinition,
  type Vec2,
  type TowerSlot,
  type MapProp,
  PROP_CATALOG,
  type PropCategory,
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
    name: "Konbaung (Palace Front)",
    imageSrc: "/assets/maps/map_1_konbaung/map.jpg",
    definition: MAPS["konbaung"],
  },
  {
    id: "inle",
    name: "Inle (Floating Lake)",
    imageSrc: "/assets/maps/map_3_inle/map.jpg",
    definition: MAPS["inle"],
  },
  {
    id: "mandalay",
    name: "Mandalay (Royal Citadel)",
    imageSrc: "/assets/maps/map_4_mandalay/map.jpg",
    definition: MAPS["mandalay"],
  },
  {
    id: "innwa",
    name: "Innwa (Golden Kingdom)",
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
    name: "Sri Ksetra (Ancient Sands)",
    imageSrc: "/assets/maps/map_7_deserted/map.jpg",
    definition: MAPS["deserted"],
  },
  {
    id: "twister",
    name: "Taungoo (Mountain Pass)",
    imageSrc: "/assets/maps/map_8_twister/map.jpg",
    definition: MAPS["twister"],
  },
  {
    id: "river",
    name: "Ayeyarwady (River Delta)",
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
  const [holderScale, setHolderScale] = useState<number>(1.0);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [pendingMapSwitchId, setPendingMapSwitchId] = useState<string | null>(null);

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

  // 2.5D Isometric Scenery Props
  const [props, setProps] = useState<MapProp[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);
  const [activePropTypeId, setActivePropTypeId] = useState<string>("tree_banyan");
  const [propCategoryFilter, setPropCategoryFilter] = useState<PropCategory | "all">("all");
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
    props: MapProp[];
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
        if (def.props) {
          setProps(JSON.parse(JSON.stringify(def.props)));
        } else {
          setProps([]);
        }
        if (def.holderScale !== undefined) {
          setHolderScale(def.holderScale);
        } else {
          setHolderScale(1.0);
        }
        setIsDirty(false);
        setSelectedPropId(null);
      }
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
      newProps?: MapProp[]
    ) => {
      const currentProps = newProps ?? props;
      const snapshot: HistoryState = {
        gridMatrix: newGridMatrix.map((r) => [...r]),
        paths: JSON.parse(JSON.stringify(newPaths)),
        slots: JSON.parse(JSON.stringify(newSlots)),
        portals: JSON.parse(JSON.stringify(newPortals)),
        base: { ...newBase },
        props: JSON.parse(JSON.stringify(currentProps)),
      };

      setIsDirty(true);
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIndex + 1);
        return [...trimmed, snapshot].slice(-25);
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 24));
    },
    [historyIndex]
  );


  const handleUpdateProps = (newProps: MapProp[]) => {
    setProps(newProps);
    pushHistory(gridMatrix, paths, slots, portals, base, newProps);
  };
  const handleUpdateGridMatrix = (newMatrix: number[][]) => {
    setGridMatrix(newMatrix);
    pushHistory(newMatrix, paths, slots, portals, base);
  };

  const handleUpdatePaths = (newPaths: Record<string, Vec2[]>) => {
    setPaths(newPaths);
    pushHistory(gridMatrix, newPaths, slots, portals, base);
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
    pushHistory(nextMatrix, paths, newSlots, portals, base);
  };

  const handleUpdatePortals = (newPortals: Vec2[]) => {
    setPortals(newPortals);
    pushHistory(gridMatrix, paths, slots, newPortals, base);
  };

  const handleUpdateBase = (newBase: Vec2) => {
    setBase(newBase);
    pushHistory(gridMatrix, paths, slots, portals, newBase);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetState = history[historyIndex - 1];
      setGridMatrix(targetState.gridMatrix.map((r) => [...r]));
      setPaths(JSON.parse(JSON.stringify(targetState.paths)));
      setSlots(JSON.parse(JSON.stringify(targetState.slots)));
      setPortals(JSON.parse(JSON.stringify(targetState.portals)));
      setBase({ ...targetState.base });
      if (targetState.props) setProps(JSON.parse(JSON.stringify(targetState.props)));
      setHistoryIndex(historyIndex - 1);
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
      if (targetState.props) setProps(JSON.parse(JSON.stringify(targetState.props)));
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Custom Image Upload handler
  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomImageSrc(url);
      setSelectedMapId("custom");
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
    setPaths((prev) => ({
      ...prev,
      [trimmed]: [],
    }));
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
    setPaths(updated);
    setActivePathId(Object.keys(updated)[0]);
  };

  // Active background image
  const currentPreset = MAP_PRESETS.find((p) => p.id === selectedMapId);
  const activeImageSrc =
    customImageSrc || currentPreset?.imageSrc || "/assets/maps/map_2_bagan/map.jpg";

  // Tool definitions
  const TOOL_INFO: Record<
    EditorTool,
    { name: string; icon: string; shortcut: string; hint: string }
  > = {
    brush_path: {
      name: "Walkway Brush",
      icon: "🛣️",
      shortcut: "1",
      hint: "Paint Walkway grid cells (Value 1). Click or drag to draw path corridor masks.",
    },
    brush_obstacle: {
      name: "Scenery Brush",
      icon: "🌲",
      shortcut: "0",
      hint: "Paint Scenery/Obstacle cells (Value 0 / Eraser). Click or drag to clear walkway.",
    },
    waypoint: {
      name: "Waypoints",
      icon: "📍",
      shortcut: "W",
      hint: "Click on map to append waypoint to active track. Click & drag points to adjust.",
    },
    slot: {
      name: "Tower Slot",
      icon: "🛡️",
      shortcut: "S",
      hint: "Click to add a buildable Tower Slot pad (S0..Sn). Drag slots to reposition.",
    },
    portal: {
      name: "Spawn Portal",
      icon: "🌀",
      shortcut: "P",
      hint: "Click to place an enemy spawn Portal (P0..Pn). Drag to adjust.",
    },
    base: {
      name: "Kingdom Base",
      icon: "🏛️",
      shortcut: "B",
      hint: "Click to reposition defender Kingdom Base anchor. Drag to move.",
    },
    prop: {
      name: "Scenery Props",
      icon: "🎨",
      shortcut: "D",
      hint: "Click to place 2.5D isometric trees, rocks, caves, ruins & NPCs. Drag to move, 'F' to flip, Del to delete.",
    },
    inspect: {
      name: "Inspect & Pan",
      icon: "🔍",
      shortcut: "I",
      hint: "Hover over map elements to inspect coordinates and cell values without placing markers.",
    },
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "1") setActiveTool("brush_path");
      else if (e.key === "0") setActiveTool("brush_obstacle");
      else if (e.key === "w" || e.key === "W") setActiveTool("waypoint");
      else if (e.key === "s" || e.key === "S") setActiveTool("slot");
      else if (e.key === "p" || e.key === "P") setActiveTool("portal");
      else if (e.key === "b" || e.key === "B") setActiveTool("base");
      else if (e.key === "i" || e.key === "I") setActiveTool("inspect");
      else if (e.key === "d" || e.key === "D") setActiveTool("prop");
      else if (selectedPropId) {
        if (e.key === "f" || e.key === "F") {
          e.preventDefault();
          handleUpdateProps(
            props.map((p) => (p.id === selectedPropId ? { ...p, flipX: !p.flipX } : p))
          );
        } else if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          handleUpdateProps(
            props.map((p) =>
              p.id === selectedPropId
                ? { ...p, scale: Math.min(2.5, Math.round(((p.scale ?? 1.0) + 0.1) * 10) / 10) }
                : p
            )
          );
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          handleUpdateProps(
            props.map((p) =>
              p.id === selectedPropId
                ? { ...p, scale: Math.max(0.3, Math.round(((p.scale ?? 1.0) - 0.1) * 10) / 10) }
                : p
            )
          );
        } else if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          handleUpdateProps(props.filter((p) => p.id !== selectedPropId));
          setSelectedPropId(null);
        }
      }

      else if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
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
      <header className="h-14 bg-gradient-to-r from-slate-900 via-[#161f36] to-slate-900 border-b border-amber-500/40 px-4 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-4">
          {/* Back to Lobby */}
          <button
            onClick={() => navigate("/lobby")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-amber-300 hover:text-white border border-amber-500/30 text-xs font-bold transition shadow-sm cursor-pointer"
            title="Return to Match Lobby"
          >
            <span>◀</span> Lobby
          </button>

          {/* Title & Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xl">🛠️</span>
            <div>
              <h1 className="text-sm font-black text-amber-300 tracking-wider uppercase font-['Almendra',serif]">
                Grid Layer Map Layout Instructor
              </h1>
              <p className="text-[10px] text-amber-200/50 leading-none">
                Interactive Walkway & Strategic Node Visual Editor
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-700 mx-1" />

          {/* Map Preset Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-amber-200/70 font-semibold">Map:</label>
            <select
              value={selectedMapId}
              onChange={(e) => {
                const nextId = e.target.value;
                if (nextId === selectedMapId) return;
                if (isDirty) {
                  setPendingMapSwitchId(nextId);
                } else {
                  if (nextId === "upload") {
                    fileInputRef.current?.click();
                  } else {
                    loadPresetMap(nextId);
                  }
                }
              }}
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
          <div className="flex items-center gap-1.5 bg-slate-950/70 p-1 rounded-lg border border-slate-700 text-xs">
            <span className="text-[11px] text-slate-400 px-1 font-semibold">Grid:</span>
            {[20, 32, 40].map((sz) => (
              <button
                key={sz}
                onClick={() => setCellSize(sz)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
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
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`px-2.5 py-1 rounded text-xs font-bold transition border cursor-pointer ${
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
                className="w-16 h-1.5 bg-slate-700 rounded-lg accent-amber-400 cursor-pointer"
                title={`Grid Opacity: ${Math.round(gridOpacity * 100)}%`}
              />
            )}
          </div>

          {/* Snap-to-grid Toggle */}
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`px-2.5 py-1 rounded text-xs font-bold transition border cursor-pointer ${
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
            className={`px-2.5 py-1 rounded text-xs font-bold transition border flex items-center gap-1.5 cursor-pointer ${
              previewTowers
                ? "bg-amber-600/80 border-amber-400 text-white shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                : "bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
            title="Toggle Tower Sprite Previews on Placed Bases"
          >
            <span>🏰</span>
            <span>Preview Towers</span>
          </button>

          {/* Dedicated Tower Pad Scale Slider in Toolbar */}
          <div className="flex items-center gap-1.5 bg-slate-950/70 px-2.5 py-1 rounded-lg border border-slate-700 text-xs">
            <span className="text-[11px] text-amber-300 font-bold">Pad Scale:</span>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={holderScale}
              onChange={(e) => {
                setHolderScale(parseFloat(e.target.value));
                setIsDirty(true);
              }}
              className="w-16 h-1.5 bg-slate-700 rounded-lg accent-amber-400 cursor-pointer"
              title={`Tower Pad Scale: ${Math.round(holderScale * 100)}%`}
            />
            <span className="text-[11px] font-mono text-amber-200 min-w-[28px] text-right">
              {Math.round(holderScale * 100)}%
            </span>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-700 text-xs">
            <span className="text-[11px] text-slate-400 px-1 font-semibold">Zoom:</span>
            {[1, 1.25, 1.5].map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
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
          <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-700 text-xs">
            <span className="text-[11px] text-slate-400 px-1 font-semibold">UI Zoom:</span>
            {[0.8, 0.9, 1.0].map((s) => (
              <button
                key={s}
                onClick={() => handleSetUiScale(s)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
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
        <div className="flex items-center gap-2">
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
            🧹 Clear Grid
          </button>

          {/* Export Code & Matrix */}
          <button
            onClick={() => setIsExportOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs tracking-wider transition shadow-[0_0_12px_rgba(245,158,11,0.4)] cursor-pointer flex items-center gap-1.5 active:scale-95"
            title="Export TypeScript Definition, 2D Grid Matrix, and JSON"
          >
            <span>💾</span> Export Data
          </button>
        </div>
      </header>

      {/* ═══ 2. Main Workspace Layout ═══ */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Toolbar */}
        <aside className="w-16 bg-slate-900 border-r border-slate-800 p-2 flex flex-col items-center gap-2 z-20 shrink-0">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 text-center">
            Tools
          </div>
          {(Object.keys(TOOL_INFO) as EditorTool[]).map((tool) => {
            const info = TOOL_INFO[tool];
            const isActive = activeTool === tool;
            return (
              <button
                key={tool}
                onClick={() => setActiveTool(tool)}
                className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer relative group ${
                  isActive
                    ? "bg-amber-500 text-slate-950 shadow-[0_0_14px_rgba(245,158,11,0.5)] font-black scale-105"
                    : "bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800"
                }`}
                title={`${info.name} [${info.shortcut}] - ${info.hint}`}
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
              props={props}
              onUpdateProps={handleUpdateProps}
              selectedPropId={selectedPropId}
              onSelectProp={setSelectedPropId}
              activePropTypeId={activePropTypeId}
              previewTowers={previewTowers}
              showGrid={showGrid}
              gridOpacity={gridOpacity}
              snapToGrid={snapToGrid}
              zoom={zoom}
              holderScale={holderScale}
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
            {/* 🎨 2.5D Isometric Scenery Props & NPCs Palette (Active Tool or Always Available) */}
            <div className={`p-3 rounded-lg border transition-all ${
              activeTool === "prop"
                ? "bg-emerald-950/30 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                : "bg-slate-950/60 border-slate-800"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🎨</span>
                  <span className="font-bold text-emerald-300 uppercase text-[11px] tracking-wide">
                    Scenery Props ({props.length})
                  </span>
                </div>
                <button
                  onClick={() => setActiveTool("prop")}
                  className={`text-[10px] px-2 py-0.5 rounded font-bold cursor-pointer transition ${
                    activeTool === "prop"
                      ? "bg-emerald-500 text-slate-950"
                      : "bg-slate-800 text-slate-300 hover:text-white"
                  }`}
                >
                  {activeTool === "prop" ? "Active [D]" : "Select Tool"}
                </button>
              </div>

              {/* Category Filter Tabs */}
              <div className="flex flex-wrap gap-1 mb-2.5">
                {(["all", "trees", "rocks", "caves", "ruins", "npcs"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setPropCategoryFilter(cat)}
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition cursor-pointer ${
                      propCategoryFilter === cat
                        ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                        : "bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    {cat === "all" ? "All (16)" : cat === "trees" ? "🌲 Trees" : cat === "rocks" ? "🪨 Rocks" : cat === "caves" ? "🕳️ Caves" : cat === "ruins" ? "🏛️ Ruins" : "🧘 NPCs"}
                  </button>
                ))}
              </div>

              {/* Grid of Prop Choices */}
              <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1 mb-3">
                {Object.values(PROP_CATALOG)
                  .filter((p) => propCategoryFilter === "all" || p.category === propCategoryFilter)
                  .map((p) => {
                    const isPicked = activePropTypeId === p.typeId;
                    return (
                      <div
                        key={p.typeId}
                        onClick={() => {
                          setActivePropTypeId(p.typeId);
                          setActiveTool("prop");
                        }}
                        className={`p-1.5 rounded-lg flex flex-col items-center gap-1 cursor-pointer border transition-all text-center relative group ${
                          isPicked
                            ? "bg-amber-950/50 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.35)] scale-[1.02]"
                            : "bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850"
                        }`}
                        title={p.description}
                      >
                        <div className="w-12 h-12 flex items-center justify-center overflow-hidden">
                          <img
                            src={p.imageSrc}
                            alt={p.name}
                            className="max-h-full max-w-full object-contain filter drop-shadow"
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-200 line-clamp-1">
                          {p.name}
                        </span>
                        {isPicked && (
                          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Selected Prop Inspector */}
              {selectedPropId ? (
                (() => {
                  const selectedProp = props.find((p) => p.id === selectedPropId);
                  if (!selectedProp) return null;
                  const def = PROP_CATALOG[selectedProp.typeId];
                  return (
                    <div className="p-2.5 rounded-lg bg-amber-950/25 border border-amber-500/50 space-y-2 mt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img
                            src={def?.imageSrc}
                            alt=""
                            className="w-7 h-7 object-contain"
                          />
                          <div>
                            <span className="font-bold text-amber-300 text-[11px] block">
                              {def?.name || selectedProp.typeId}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono">
                              ({selectedProp.x}, {selectedProp.y})
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            handleUpdateProps(props.filter((p) => p.id !== selectedPropId));
                            setSelectedPropId(null);
                          }}
                          className="px-2 py-0.5 rounded bg-red-950 border border-red-500/40 text-red-300 hover:bg-red-900 text-[10px] cursor-pointer"
                          title="Delete Prop (Del)"
                        >
                          🗑️ Delete
                        </button>
                      </div>

                      {/* Scale & Flip Controls */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-600/30 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 font-semibold">Scale:</span>
                          <button
                            onClick={() => {
                              const cur = selectedProp.scale ?? 1.0;
                              handleUpdateProps(
                                props.map((p) =>
                                  p.id === selectedPropId
                                    ? { ...p, scale: Math.max(0.3, Math.round((cur - 0.1) * 10) / 10) }
                                    : p
                                )
                              );
                            }}
                            className="w-5 h-5 rounded bg-slate-800 text-amber-200 hover:bg-slate-700 flex items-center justify-center font-bold"
                          >
                            -
                          </button>
                          <span className="font-mono text-amber-300 w-8 text-center">
                            {Math.round((selectedProp.scale ?? 1.0) * 100)}%
                          </span>
                          <button
                            onClick={() => {
                              const cur = selectedProp.scale ?? 1.0;
                              handleUpdateProps(
                                props.map((p) =>
                                  p.id === selectedPropId
                                    ? { ...p, scale: Math.min(2.5, Math.round((cur + 0.1) * 10) / 10) }
                                    : p
                                )
                              );
                            }}
                            className="w-5 h-5 rounded bg-slate-800 text-amber-200 hover:bg-slate-700 flex items-center justify-center font-bold"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => {
                            handleUpdateProps(
                              props.map((p) =>
                                p.id === selectedPropId ? { ...p, flipX: !p.flipX } : p
                              )
                            );
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-bold border transition cursor-pointer ${
                            selectedProp.flipX
                              ? "bg-indigo-600 text-white border-indigo-400 shadow-sm"
                              : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                          }`}
                          title="Flip Horizontally (F)"
                        >
                          ⇄ Flip {selectedProp.flipX ? "(On)" : "(Off)"}
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="text-[10px] text-slate-400 italic bg-slate-900/50 p-2 rounded text-center">
                  Click on canvas to place active prop, or click a placed prop to select & transform it.
                </div>
              )}

              {props.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Total Placed: {props.length}</span>
                  <button
                    onClick={() => {
                      if (confirm("Clear all scenery props on this map?")) {
                        handleUpdateProps([]);
                        setSelectedPropId(null);
                      }
                    }}
                    className="text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    Clear All Props
                  </button>
                </div>
              )}
            </div>

            {/* Multi-Track Polyline Manager */}
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-amber-200/90 uppercase text-[11px] tracking-wide">
                  🛤️ Paths & Tracks ({Object.keys(paths).length})
                </span>
                {Object.keys(paths).length > 1 && (
                  <button
                    onClick={handleDeleteCurrentTrack}
                    className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer"
                    title="Delete Active Track"
                  >
                    Delete Track
                  </button>
                )}
              </div>

              {/* Active Track Selector */}
              <div className="space-y-1.5 mb-2.5">
                {Object.entries(paths).map(([trkId, pts]) => (
                  <div
                    key={trkId}
                    onClick={() => setActivePathId(trkId)}
                    className={`p-2 rounded flex items-center justify-between cursor-pointer border transition ${
                      activePathId === trkId
                        ? "bg-amber-950/40 border-amber-500/60 text-amber-200"
                        : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-850"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                      <span className="font-bold font-mono">{trkId}</span>
                    </div>
                    <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                      {pts.length} waypoints
                    </span>
                  </div>
                ))}
              </div>

              {/* Add New Track input */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="New track name (e.g. flank)..."
                  value={newTrackName}
                  onChange={(e) => setNewTrackName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTrack()}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={handleAddTrack}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-xs transition cursor-pointer"
                >
                  + Add
                </button>
              </div>

              {/* Waypoints of active track */}
              {paths[activePathId] && (
                <div className="mt-3 pt-2.5 border-t border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                    <span>Waypoints on [{activePathId}]:</span>
                    <button
                      onClick={() => {
                        handleUpdatePaths({
                          ...paths,
                          [activePathId]: [],
                        });
                      }}
                      className="text-red-400 hover:text-red-300 text-[10px] cursor-pointer"
                    >
                      Clear Points
                    </button>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                    {paths[activePathId].length === 0 ? (
                      <div className="text-slate-500 italic p-1 text-center">
                        No points. Click with Waypoint Tool (W) on map to add.
                      </div>
                    ) : (
                      paths[activePathId].map((pt, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-slate-900/80 px-2 py-1 rounded border border-slate-800/80"
                        >
                          <span className="text-amber-400">#{idx}</span>
                          <span className="text-slate-300">
                            ({pt.x}, {pt.y})
                          </span>
                          <button
                            onClick={() => {
                              const updated = [...paths[activePathId]];
                              updated.splice(idx, 1);
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
              </div>

              {/* Pad Scale Slider in Tower Slots Section */}
              <div className="mb-2.5 p-2 rounded bg-slate-900/80 border border-slate-800 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-semibold">Pad Scale (This Map):</span>
                  <span className="font-mono text-amber-300 font-bold">{Math.round(holderScale * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={holderScale}
                    onChange={(e) => {
                      setHolderScale(parseFloat(e.target.value));
                      setIsDirty(true);
                    }}
                    className="flex-1 h-1.5 bg-slate-700 rounded-lg accent-amber-400 cursor-pointer"
                    title={`Pad Scale: ${Math.round(holderScale * 100)}%`}
                  />
                  <div className="flex gap-1">
                    {[0.75, 1.0, 1.25].map((sc) => (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => {
                          setHolderScale(sc);
                          setIsDirty(true);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                          Math.abs(holderScale - sc) < 0.01
                            ? "bg-amber-500 text-slate-950 border-amber-400"
                            : "bg-slate-950 text-slate-400 border-slate-700 hover:text-white"
                        }`}
                      >
                        {Math.round(sc * 100)}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Placed Coordinates</span>
                {slots.length > 0 && (
                  <button
                    onClick={() => handleUpdateSlots([])}
                    className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
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
                        S{s.slotIndex}
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
                      <span className="text-fuchsia-400 font-bold">P{idx}</span>
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
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
              <span className="font-bold text-amber-200/90 uppercase text-[11px] tracking-wide block">
                🏛️ Defender Base
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <label className="text-slate-400 block mb-0.5">Base X:</label>
                  <input
                    type="number"
                    value={base.x}
                    onChange={(e) =>
                      handleUpdateBase({ ...base, x: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Base Y:</label>
                  <input
                    type="number"
                    value={base.y}
                    onChange={(e) =>
                      handleUpdateBase({ ...base, y: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Width (px):</label>
                  <input
                    type="number"
                    value={baseDisplaySize.width}
                    onChange={(e) =>
                      setBaseDisplaySize({
                        ...baseDisplaySize,
                        width: parseInt(e.target.value) || 100,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Height (px):</label>
                  <input
                    type="number"
                    value={baseDisplaySize.height}
                    onChange={(e) =>
                      setBaseDisplaySize({
                        ...baseDisplaySize,
                        height: parseInt(e.target.value) || 100,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ═══ 3. Bottom Status HUD ═══ */}
      <footer className="h-9 bg-slate-950 border-t border-slate-800 px-4 flex items-center justify-between text-xs z-30 shrink-0 font-mono">
        <div className="flex items-center gap-6">
          {hoverCoord ? (
            <div className="flex items-center gap-4 text-slate-300">
              <span>
                Pixel:{" "}
                <strong className="text-amber-300">
                  X: {hoverCoord.x}, Y: {hoverCoord.y}
                </strong>
              </span>
              <span>
                Cell:{" "}
                <strong className="text-indigo-300">
                  [{hoverCoord.col}, {hoverCoord.row}]
                </strong>
              </span>
              <span>
                Value:{" "}
                <strong
                  className={
                    hoverCoord.value === 1
                      ? "text-emerald-400"
                      : hoverCoord.value === 2
                      ? "text-amber-400"
                      : hoverCoord.value === 3
                      ? "text-fuchsia-400"
                      : hoverCoord.value === 4
                      ? "text-blue-400"
                      : "text-slate-500"
                  }
                >
                  {hoverCoord.value}{" "}
                  {hoverCoord.value === 1
                    ? "(Walkway)"
                    : hoverCoord.value === 2
                    ? "(Tower Slot)"
                    : hoverCoord.value === 3
                    ? "(Portal)"
                    : hoverCoord.value === 4
                    ? "(Base)"
                    : "(Scenery/Obstacle)"}
                </strong>
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

      {/* ═══ 4. Export Modal ═══ */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        mapId={selectedMapId}
        holderScale={holderScale}
        mapName={currentPreset?.name || "Custom Battlefield"}
        paths={paths}
        slots={slots}
        portals={portals}
        base={base}
        baseDisplaySize={baseDisplaySize}
        props={props}
        gridMatrix={gridMatrix}
        gridCols={gridCols}
        gridRows={gridRows}
        cellSize={cellSize}
      />

      {/* Unsaved Changes Confirmation Modal */}
      {pendingMapSwitchId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-xl p-5 max-w-md w-full shadow-2xl flex flex-col gap-3">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-base">
              <span>⚠️</span>
              <span>Unsaved Changes on Current Map</span>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              You have modified the current map. Switching to another map will discard unsaved modifications unless you save first.
            </p>
            <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setPendingMapSwitchId(null)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const targetId = pendingMapSwitchId;
                  setPendingMapSwitchId(null);
                  if (targetId === "upload") {
                    fileInputRef.current?.click();
                  } else {
                    loadPresetMap(targetId);
                  }
                }}
                className="px-3 py-1.5 rounded bg-red-900/80 text-red-200 text-xs font-semibold hover:bg-red-800 transition cursor-pointer"
              >
                Discard & Switch
              </button>
              <button
                onClick={() => {
                  setPendingMapSwitchId(null);
                  setIsExportOpen(true);
                }}
                className="px-3.5 py-1.5 rounded bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 shadow-md transition cursor-pointer"
              >
                Save Map First
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default MapEditor;


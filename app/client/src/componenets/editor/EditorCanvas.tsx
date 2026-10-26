import React, { useRef, useEffect, useState, useCallback } from "react";
import type { Vec2, TowerSlot, MapProp } from "@root/shared";
import { PROP_CATALOG } from "@root/shared";

export type EditorTool =
  | "brush_path"
  | "brush_obstacle"
  | "waypoint"
  | "slot"
  | "portal"
  | "base"
  | "prop"
  | "inspect";

interface EditorCanvasProps {
  imageSrc: string;
  cellSize: number;
  gridCols: number;
  gridRows: number;
  gridMatrix: number[][];
  onUpdateGridMatrix: (newMatrix: number[][]) => void;
  activeTool: EditorTool;
  paths: Record<string, Vec2[]>;
  activePathId: string;
  onUpdatePaths: (paths: Record<string, Vec2[]>) => void;
  slots: TowerSlot[];
  onUpdateSlots: (slots: TowerSlot[]) => void;
  portals: Vec2[];
  onUpdatePortals: (portals: Vec2[]) => void;
  base: Vec2;
  onUpdateBase: (base: Vec2) => void;
  baseDisplaySize: { width: number; height: number };
  props?: MapProp[];
  onUpdateProps?: (props: MapProp[]) => void;
  selectedPropId?: string | null;
  onSelectProp?: (propId: string | null) => void;
  activePropTypeId?: string;
  showGrid: boolean;
  gridOpacity: number;
  snapToGrid: boolean;
  zoom: number;
  previewTowers?: boolean;
  holderScale?: number;
  onHoverCoord: (coord: {
    x: number;
    y: number;
    col: number;
    row: number;
    value: number;
  } | null) => void;
}

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

const PATH_COLORS: Record<string, string> = {
  top_north: "#00e5ff",
  top_south: "#ffb703",
  bottom: "#00f576",
  bridge: "#f72585",
  main: "#3a86ff",
  upper: "#7209b7",
  middle: "#4361ee",
  lower: "#4cc9f0",
};

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  imageSrc,
  cellSize,
  gridCols,
  gridRows,
  gridMatrix,
  onUpdateGridMatrix,
  activeTool,
  paths,
  activePathId,
  onUpdatePaths,
  slots,
  onUpdateSlots,
  portals,
  onUpdatePortals,
  base,
  onUpdateBase,
  baseDisplaySize,
  props = [],
  onUpdateProps,
  selectedPropId = null,
  onSelectProp,
  activePropTypeId = "tree_banyan",
  showGrid,
  gridOpacity,
  snapToGrid,
  zoom,
  previewTowers = false,
  holderScale = 1.0,
  onHoverCoord,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState<boolean>(false);

  // Tower Base & Tower Preview assets
  const towerBaseImgRef = useRef<HTMLImageElement | null>(null);
  const [isTowerBaseLoaded, setIsTowerBaseLoaded] = useState<boolean>(false);
  // Prop sprite images cache
  const propImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [propsImagesLoaded, setPropsImagesLoaded] = useState<number>(0);

  useEffect(() => {
    let loaded = 0;
    Object.entries(PROP_CATALOG).forEach(([typeId, def]) => {
      const img = new Image();
      img.src = def.imageSrc;
      img.onload = () => {
        propImagesRef.current.set(typeId, img);
        loaded++;
        setPropsImagesLoaded(loaded);
      };
    });
  }, []);
  const archerTowerImgRef = useRef<HTMLImageElement | null>(null);
  const [isArcherTowerLoaded, setIsArcherTowerLoaded] = useState<boolean>(false);

  useEffect(() => {
    const baseImg = new Image();
    baseImg.src = "/assets/tower_placeholder/tower_placeholder_1.png";
    baseImg.onload = () => {
      towerBaseImgRef.current = baseImg;
      setIsTowerBaseLoaded(true);
    };

    const towerImg = new Image();
    towerImg.src = "/assets/towers/01_archer_tower/sheet.png";
    towerImg.onload = () => {
      archerTowerImgRef.current = towerImg;
      setIsArcherTowerLoaded(true);
    };
  }, []);

  // Mouse interaction state
  const isMouseDownRef = useRef<boolean>(false);
  const draggedItemRef = useRef<
    | { type: "waypoint"; index: number; pathId: string }
    | { type: "slot"; index: number }
    | { type: "portal"; index: number }
    | { type: "base" }
    | { type: "prop"; id: string }
    | null
  >(null);

  // Load background image
  useEffect(() => {
    setIsImageLoaded(false);
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      bgImageRef.current = img;
      setIsImageLoaded(true);
    };
  }, [imageSrc]);

  // Convert mouse event to 1280x720 canvas virtual coordinates
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): Vec2 => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      let x = Math.round((e.clientX - rect.left) * scaleX);
      let y = Math.round((e.clientY - rect.top) * scaleY);
      x = Math.max(0, Math.min(CANVAS_WIDTH, x));
      y = Math.max(0, Math.min(CANVAS_HEIGHT, y));

      if (snapToGrid) {
        const col = Math.floor(x / cellSize);
        const row = Math.floor(y / cellSize);
        x = Math.min(CANVAS_WIDTH, Math.round(col * cellSize + cellSize / 2));
        y = Math.min(CANVAS_HEIGHT, Math.round(row * cellSize + cellSize / 2));
      }
      return { x, y };
    },
    [cellSize, snapToGrid]
  );

  // Main rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Draw Background Image or Fallback
    if (bgImageRef.current && isImageLoaded) {
      ctx.drawImage(bgImageRef.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // 2. Draw 2D Matrix Grid Masks
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const val = gridMatrix[r]?.[c] ?? 0;
        if (val !== 0) {
          if (val === 1) {
            // Walkway
            ctx.fillStyle = "rgba(16, 185, 129, 0.45)";
          } else if (val === 2) {
            // Tower Slot Pad
            ctx.fillStyle = "rgba(245, 158, 11, 0.45)";
          } else if (val === 3) {
            // Portal
            ctx.fillStyle = "rgba(168, 85, 247, 0.45)";
          } else if (val === 4) {
            // Base
            ctx.fillStyle = "rgba(59, 130, 246, 0.45)";
          }
          ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }
      }
    }

    // 3. Draw Grid Lines
    if (showGrid) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(255, 255, 255, ${gridOpacity * 0.4})`;

      ctx.beginPath();
      for (let x = 0; x <= CANVAS_WIDTH; x += cellSize) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, CANVAS_HEIGHT);
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += cellSize) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(CANVAS_WIDTH, y + 0.5);
      }
      ctx.stroke();
    }

    // 4. Draw Paths & Waypoints with Directional Flow Arrows
    Object.entries(paths).forEach(([trkId, points]) => {
      if (!points || points.length === 0) return;
      const isActive = trkId === activePathId;
      const color = PATH_COLORS[trkId] || "#38bdf8";

      // Draw polyline ribbon
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = isActive ? 5 : 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = color;
      ctx.shadowBlur = isActive ? 12 : 4;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw directional flow arrows
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

        ctx.save();
        ctx.translate(midX, midY);
        ctx.rotate(angle);
        ctx.fillStyle = isActive ? "#ffffff" : color;
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4, -4);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-4, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Draw Waypoint nodes
      points.forEach((pt, idx) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isActive ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? "#ffffff" : color;
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Node index text for active track
        if (isActive && points.length < 50) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px monospace";
          ctx.fillText(`${idx}`, pt.x + 8, pt.y - 6);
        }
      });
    });

    // 5. Draw Tower Holders (H0..Hn) with authentic Burmese Lotus Stone Dais
    slots.forEach((s) => {
      const baseW = 78 * holderScale;
      const baseH = 60 * holderScale;

      if (towerBaseImgRef.current && isTowerBaseLoaded) {
        // Draw authentic Konbaung lotus stone foundation dais
        ctx.drawImage(
          towerBaseImgRef.current,
          s.x - baseW / 2,
          s.y - baseH / 2,
          baseW,
          baseH
        );
      } else {
        // Fallback procedural dais
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, 39 * holderScale, 30 * holderScale, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(180, 83, 9, 0.4)";
        ctx.fill();
        ctx.strokeStyle = "#d97706";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // If dragging this slot, render glowing feedback halo
      const isDraggingThis =
        draggedItemRef.current?.type === "slot" &&
        draggedItemRef.current?.index === s.slotIndex;
      if (isDraggingThis) {
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, 44 * holderScale, 35 * holderScale, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "#fef08a";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Tower model mounted atop holder dais, scaled proportionally
      if (previewTowers && archerTowerImgRef.current && isArcherTowerLoaded) {
        ctx.save();
        ctx.globalAlpha = 0.88;
        const tW = 82 * holderScale;
        const tH = 88 * holderScale;
        ctx.drawImage(
          archerTowerImgRef.current,
          0,
          0,
          688,
          768,
          s.x - tW / 2,
          s.y - tH * 0.82,
          tW,
          tH
        );
        ctx.restore();
      }

      // Tower Holder badge (H0, H1) - Ornate Konbaung pill
      const badgeY = previewTowers ? s.y - 82 * holderScale : s.y - 34 * holderScale;
      const badgeW = Math.max(28, 34 * holderScale);
      const badgeH = Math.max(16, 20 * holderScale);
      ctx.beginPath();
      ctx.roundRect(s.x - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 6);
      ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
      ctx.fill();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#fbbf24";
      ctx.font = `bold ${Math.max(8, Math.round(10 * holderScale))}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`H${s.slotIndex}`, s.x, badgeY);
    });

    // 6. Draw Portals (P0..Pn)
    portals.forEach((p, idx) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(168, 85, 247, 0.35)";
      ctx.fill();
      ctx.strokeStyle = "#c084fc";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#e879f9";
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`P${idx}`, p.x, p.y);
    });

    // 7. Draw Defender Base Citadel
    const bW = baseDisplaySize.width;
    const bH = baseDisplaySize.height;
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.strokeRect(base.x - bW / 2, base.y - bH / 2, bW, bH);
    ctx.fillStyle = "rgba(56, 189, 248, 0.2)";
    ctx.fillRect(base.x - bW / 2, base.y - bH / 2, bW, bH);

    // Anchor center
    ctx.beginPath();
    ctx.arc(base.x, base.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#38bdf8";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🏛️ Base", base.x, base.y - bH / 2 - 8);
    // 8. Draw 2.5D Isometric Scenery Props (sorted by y for accurate depth)
    const sortedProps = [...props].sort((a, b) => a.y - b.y);
    sortedProps.forEach((p) => {
      const def = PROP_CATALOG[p.typeId];
      if (!def) return;
      const img = propImagesRef.current.get(p.typeId);
      const scale = (p.scale ?? 1.0) * (def.defaultScale ?? 1.0);
      const w = def.width * scale;
      const h = def.height * scale;
      const anchorY = def.anchorY ?? 0.9;
      const drawX = p.x - w / 2;
      const drawY = p.y - h * anchorY;

      ctx.save();
      if (p.flipX) {
        ctx.translate(p.x, p.y);
        ctx.scale(-1, 1);
        ctx.translate(-p.x, -p.y);
      }

      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, drawX, drawY, w, h);
      } else {
        ctx.fillStyle = "rgba(16, 185, 129, 0.4)";
        ctx.fillRect(drawX, drawY, w, h);
      }
      ctx.restore();

      // If selected, render golden dashed bounding box and anchor ring
      if (p.id === selectedPropId) {
        ctx.save();
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(drawX - 3, drawY - 3, w + 6, h + 6);
        ctx.setLineDash([]);

        // Ground anchor contact ring
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, Math.max(12, 14 * scale), Math.max(5, 6 * scale), 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(251, 191, 36, 0.35)";
        ctx.fill();
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(def.name, p.x, drawY - 8);
        ctx.restore();
      }
    });

  }, [
    isImageLoaded,
    isTowerBaseLoaded,
    isArcherTowerLoaded,
    previewTowers,
    cellSize,
    gridCols,
    gridRows,
    gridMatrix,
    showGrid,
    gridOpacity,
    paths,
    activePathId,
    slots,
    portals,
    base,
    baseDisplaySize,
    props,
    selectedPropId,
    propsImagesLoaded,
  ]);

  // Paint cell in matrix
  const paintCell = useCallback(
    (coords: Vec2, value: number) => {
      const col = Math.floor(coords.x / cellSize);
      const row = Math.floor(coords.y / cellSize);
      if (col < 0 || col >= gridCols || row < 0 || row >= gridRows) return;
      if (gridMatrix[row]?.[col] === value) return;

      const updated = gridMatrix.map((r, rIdx) =>
        rIdx === row ? r.map((c, cIdx) => (cIdx === col ? value : c)) : [...r]
      );
      onUpdateGridMatrix(updated);
    },
    [cellSize, gridCols, gridRows, gridMatrix, onUpdateGridMatrix]
  );

  // Mouse Down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isMouseDownRef.current = true;
    const coords = getCanvasCoords(e);

    // Handle Prop Tool selection / placement
    if (activeTool === "prop") {
      // Check hit on existing props from front to back
      let hitProp: MapProp | null = null;
      for (let i = props.length - 1; i >= 0; i--) {
        const p = props[i];
        const def = PROP_CATALOG[p.typeId];
        const scale = (p.scale ?? 1.0) * (def?.defaultScale ?? 1.0);
        const w = (def?.width ?? 60) * scale;
        const h = (def?.height ?? 60) * scale;
        const anchorY = def?.anchorY ?? 0.9;
        const left = p.x - w / 2;
        const right = p.x + w / 2;
        const top = p.y - h * anchorY;
        const bottom = p.y + h * (1 - anchorY) + 8;
        if (coords.x >= left && coords.x <= right && coords.y >= top && coords.y <= bottom) {
          hitProp = p;
          break;
        }
      }

      if (hitProp) {
        onSelectProp?.(hitProp.id);
        draggedItemRef.current = { type: "prop", id: hitProp.id };
        return;
      } else {
        // Place new prop
        const newProp: MapProp = {
          id: `prop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          typeId: activePropTypeId || "tree_banyan",
          x: coords.x,
          y: coords.y,
          scale: 1.0,
          flipX: false,
        };
        onUpdateProps?.([...props, newProp]);
        onSelectProp?.(newProp.id);
        draggedItemRef.current = { type: "prop", id: newProp.id };
        return;
      }
    }
    // Check hit on Defender Base Anchor
    const distBase = Math.hypot(coords.x - base.x, coords.y - base.y);
    if (distBase <= 20) {
      draggedItemRef.current = { type: "base" };
      return;
    }

    // Check hit on Portals
    for (let i = 0; i < portals.length; i++) {
      if (Math.hypot(coords.x - portals[i].x, coords.y - portals[i].y) <= 22) {
        draggedItemRef.current = { type: "portal", index: i };
        return;
      }
    }

    // Check hit on Tower Slots
    for (let i = 0; i < slots.length; i++) {
      if (Math.hypot(coords.x - slots[i].x, coords.y - slots[i].y) <= 24 * holderScale) {
        draggedItemRef.current = { type: "slot", index: i };
        return;
      }
    }

    // Check hit on Waypoints of active path
    const activePts = paths[activePathId] || [];
    for (let i = 0; i < activePts.length; i++) {
      if (Math.hypot(coords.x - activePts[i].x, coords.y - activePts[i].y) <= 12) {
        draggedItemRef.current = {
          type: "waypoint",
          index: i,
          pathId: activePathId,
        };
        return;
      }
    }

    // Handle tool specific actions
    if (activeTool === "brush_path") {
      paintCell(coords, 1);
    } else if (activeTool === "brush_obstacle") {
      paintCell(coords, 0);
    } else if (activeTool === "waypoint") {
      // Append waypoint to active path
      const nextPts = [...activePts, coords];
      onUpdatePaths({ ...paths, [activePathId]: nextPts });
    } else if (activeTool === "slot") {
      // Place new Tower Slot
      const nextSlots = [
        ...slots,
        { slotIndex: slots.length, x: coords.x, y: coords.y },
      ];
      onUpdateSlots(nextSlots);
    } else if (activeTool === "portal") {
      // Place new portal
      const nextPortals = [...portals, coords];
      onUpdatePortals(nextPortals);
    } else if (activeTool === "base") {
      // Place or move base
      onUpdateBase(coords);
    }
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    const col = Math.floor(coords.x / cellSize);
    const row = Math.floor(coords.y / cellSize);
    const value = gridMatrix[row]?.[col] ?? 0;

    onHoverCoord({
      x: coords.x,
      y: coords.y,
      col,
      row,
      value,
    });

    if (!isMouseDownRef.current) return;

    // Handle Dragging
    const dragged = draggedItemRef.current;
    if (dragged) {
      if (dragged.type === "base") {
        onUpdateBase(coords);
      } else if (dragged.type === "portal") {
        const nextPortals = [...portals];
        nextPortals[dragged.index] = coords;
        onUpdatePortals(nextPortals);
      } else if (dragged.type === "slot") {
        const nextSlots = [...slots];
        nextSlots[dragged.index] = {
          ...nextSlots[dragged.index],
          x: coords.x,
          y: coords.y,
        };
        onUpdateSlots(nextSlots);
      } else if (dragged.type === "waypoint" && dragged.pathId) {
        const trkPts = [...(paths[dragged.pathId] || [])];
        trkPts[dragged.index] = coords;
        onUpdatePaths({ ...paths, [dragged.pathId]: trkPts });
      } else if (dragged.type === "prop") {
        const nextProps = props.map((p) =>
          p.id === dragged.id ? { ...p, x: coords.x, y: coords.y } : p
        );
        onUpdateProps?.(nextProps);
      }
      return;
    }

    // Handle Drag Painting
    if (activeTool === "brush_path") {
      paintCell(coords, 1);
    } else if (activeTool === "brush_obstacle") {
      paintCell(coords, 0);
    }
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
    draggedItemRef.current = null;
  };

  const handleMouseLeave = () => {
    isMouseDownRef.current = false;
    draggedItemRef.current = null;
    onHoverCoord(null);
  };

  return (
    <div
      className="relative overflow-hidden cursor-crosshair"
      style={{
        width: `${CANVAS_WIDTH * zoom}px`,
        height: `${CANVAS_HEIGHT * zoom}px`,
      }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-full block"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
};
export default EditorCanvas;


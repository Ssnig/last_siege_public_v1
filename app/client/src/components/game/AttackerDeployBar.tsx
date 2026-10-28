import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MESSAGES,
  MOB_TYPES,
  getMobTier,
  type AttackerBufferPayload,
  type AttackerPortalStatus,
} from '@root/shared';

import { mobIcon, portalIcon } from './unitIcons';

interface AttackerDeployBarProps {
  /** Latest `attacker_buffer` snapshot from the server. */
  buffer: AttackerBufferPayload;
  /** Latest refusal reason from the server, if any. */
  error: string | null;
  /** Current match phase (gates the deploy controls). */
  phase: string;
  /** Whether the siege timer has run out and the field is deciding the match. */
  suddenDeath: boolean;
  /** Send a room message (Colyseus `room.send`). */
  send: (type: string, payload?: unknown) => void;
  /** Hit-test the on-map portals for a page-space drag point. */
  findMapPortal?: (pageX: number, pageY: number) => string | null;
  /** Highlight (or clear) the on-map portal under a drag. */
  onMapPortalHover?: (portalId: string | null) => void;
  isUIHidden?: boolean;
  /** Attacker unit upgrade tiers keyed by typeId. */
  unitTiers?: Record<string, number>;
  /** Callback when the player clicks the upgrade button for a unit type. */
  onOpenUpgrade?: (unitTypeId: string) => void;
}

const GOLD_BORDER = 'rgba(212, 175, 55, 0.75)';
const GOLD_SOFT = 'rgba(251, 191, 36, 0.2)';
/** Pixel travel before a press becomes a drag rather than a stray tap. */
const DRAG_THRESHOLD = 6;

/** Deterministic accent hue per unit, used when no artwork is mapped. */
function thumbStyle(typeId: string): React.CSSProperties {
  const name = MOB_TYPES[typeId]?.name ?? typeId;
  const hue = (name.charCodeAt(0) * 37) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue} 55% 32%), hsl(${(hue + 40) % 360} 55% 20%))`,
    borderColor: 'rgba(255,255,255,0.25)',
  };
}

/** A unit's artwork, falling back to a deterministic tinted tile. */
const UnitIcon: React.FC<{ typeId: string; className?: string }> = ({ typeId, className }) => {
  const src = mobIcon(typeId);
  if (src) {
    return (
      <img
        src={src}
        alt={MOB_TYPES[typeId]?.name ?? typeId}
        className={`object-contain pixelated ${className ?? ''}`}
        style={{ imageRendering: 'pixelated' }}
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    );
  }
  return <span className={`rounded ${className ?? ''}`} style={thumbStyle(typeId)} aria-hidden />;
};

/** Small radial progress ring for a portal still charging its next use. */
const ChargeRing: React.FC<{ progress: number }> = ({ progress }) => {
  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));


  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden>
      <circle cx={10} cy={10} r={radius} fill="none" stroke="rgba(120,53,15,0.4)" strokeWidth={2.5} />
      <circle
        cx={10}
        cy={10}
        r={radius}
        fill="none"
        stroke="rgba(245,158,11,0.95)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped)}
        transform="rotate(-90 10 10)"
      />
    </svg>
  );
};

interface DragState {
  typeId: string;
  x: number;
  y: number;
  overBarId: string | null;
}

interface PendingDeploy {
  portalId: string;
  x: number;
  y: number;
}

/**
 * Attacker deploy bar: queue units, then push them through a portal.
 *
 * @remarks
 * Replaces the old wave-staging modal. Units are queued one tap at a time (or
 * held to repeat) and paid for on queueing, so the server never has to chase an
 * unaffordable army. The queue shows only the lead unit's artwork with a count,
 * keeping the portal buttons on screen at the full buffer cap. Units deploy by
 * tapping a portal button or by dragging the queue's lead icon onto a portal —
 * either the bar buttons or the portal drawn on the map itself. A forked portal
 * asks which track to take before committing. The whole bar is disabled in
 * sudden death, where nothing may reinforce the troops already deciding the
 * match.
 */
export const AttackerDeployBar: React.FC<AttackerDeployBarProps> = ({
  buffer,
  error,
  phase,
  suddenDeath,
  send,
  findMapPortal,
  onMapPortalHover,
  isUIHidden = false,
  unitTiers = {},
  onOpenUpgrade,
}) => {
  const repeatRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);
  const portalRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dragPointer = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
    overMapId: string | null;
  } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pendingDeploy, setPendingDeploy] = useState<PendingDeploy | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  function stopHold() {
    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (repeatRef.current !== null) {
      window.clearInterval(repeatRef.current);
      repeatRef.current = null;
    }
  }

  // Stop any in-flight hold-repeat when the bar unmounts or state freezes.
  useEffect(() => () => stopHold(), []);

  const frozen = phase !== 'building' && phase !== 'combat';
  const bufferLocked = frozen || suddenDeath;
  const deployLocked = phase !== 'combat' || suddenDeath;

  const queued = buffer.buffer;
  const capReached = queued.length >= buffer.maxBufferUnits;
  const lead = queued[0];
  const canDrag = !deployLocked && !!lead && buffer.portals.some((portal) => !portal.locked && portal.charges > 0);

  const portalById = (portalId: string): AttackerPortalStatus | undefined =>
    buffer.portals.find((portal) => portal.id === portalId);

  /**
   * Asks a forked portal which track to take, or deploys straight through a
   * single-track one. `x`/`y` anchor the chooser at the drop point.
   */
  const requestDeploy = (portalId: string, x: number, y: number) => {
    if (deployLocked) return;
    const portal = portalById(portalId);
    if (!portal || portal.locked || portal.charges <= 0) return;

    if (portal.paths.length > 1) {
      setPendingDeploy({ portalId, x, y });
      return;
    }

    const pathId = portal.paths[0]?.id;
    send(MESSAGES.deploy, pathId ? { portalId, pathId } : { portalId });
  };

  const choosePath = (pathId: string) => {
    if (!pendingDeploy) return;
    send(MESSAGES.deploy, { portalId: pendingDeploy.portalId, pathId });
    setPendingDeploy(null);
  };

  const startHold = (typeId: string) => {
    if (bufferLocked || capReached) return;
    send(MESSAGES.bufferAdd, { typeId });
    holdTimeoutRef.current = window.setTimeout(() => {
      repeatRef.current = window.setInterval(() => {
        send(MESSAGES.bufferAdd, { typeId });
      }, 220);
    }, 400);
  };


  /** Which charged bar portal button is under a page-space point, if any. */
  const hitBarPortal = (x: number, y: number): string | null => {
    for (let i = 0; i < buffer.portals.length; i += 1) {
      const el = portalRefs.current[i];
      if (!el || buffer.portals[i].locked || buffer.portals[i].charges <= 0) continue;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return buffer.portals[i].id;
      }
    }
    return null;
  };

  /** Which charged on-map portal is under a page-space point, if any. */
  const hitMapPortal = (x: number, y: number): string | null => {
    const id = findMapPortal?.(x, y) ?? null;
    const portal = id ? portalById(id) : undefined;
    return portal && !portal.locked && portal.charges > 0 ? id : null;
  };

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canDrag) return;
    event.preventDefault();
    dragPointer.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      overMapId: null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = dragPointer.current;
    if (!pointer || event.pointerId !== pointer.pointerId) return;

    if (!pointer.moved) {
      const travelled = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
      if (travelled < DRAG_THRESHOLD) return;
      pointer.moved = true;
    }

    if (!lead) return;
    const overBarId = hitBarPortal(event.clientX, event.clientY);
    setDrag({ typeId: lead, x: event.clientX, y: event.clientY, overBarId });

    const overMapId = hitMapPortal(event.clientX, event.clientY);
    if (overMapId !== pointer.overMapId) {
      pointer.overMapId = overMapId;
      onMapPortalHover?.(overMapId);
    }
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = dragPointer.current;
    if (!pointer || event.pointerId !== pointer.pointerId) return;
    dragPointer.current = null;
    onMapPortalHover?.(null);

    if (!pointer.moved) {
      setDrag(null);
      return;
    }

    const target = hitBarPortal(event.clientX, event.clientY)
      ?? hitMapPortal(event.clientX, event.clientY)
      ?? null;
    setDrag(null);

    if (target) requestDeploy(target, event.clientX, event.clientY);
  };

  // Swallow the browser's long-press / drag defaults so holding a unit button
  // never opens a context menu, selects text, or starts a drag on mobile.
  const suppressDefaults: React.HTMLAttributes<HTMLDivElement> = {
    onContextMenu: (e) => e.preventDefault(),
    onDragStart: (e) => e.preventDefault(),
    style: {
      WebkitTouchCallout: 'none',
      WebkitUserSelect: 'none',
      userSelect: 'none',
      touchAction: 'manipulation',
    },
  };

  const pendingPaths = pendingDeploy ? (portalById(pendingDeploy.portalId)?.paths ?? []) : [];

  if (isUIHidden) return null;



  return (
    <>
      <div
        className={`pointer-events-auto fixed bottom-[max(0.5rem,env(safe-area-inset-bottom,0.5rem))] left-1/2 z-40 w-[min(96vw,760px)] -translate-x-1/2 flex flex-col items-center transition-transform duration-200 ${
          isCollapsed ? 'translate-y-[calc(100%-18px)]' : 'translate-y-0'
        }`}
        {...suppressDefaults}
      >
        {/* Collapse / Expand Tab Button */}
        <button
          onClick={() => setIsCollapsed((prev) => !prev)}
          aria-label={isCollapsed ? 'Expand Deploy Controls' : 'Collapse Deploy Controls'}
          className="px-3 py-0.5 rounded-t-md bg-gradient-to-r from-red-950/95 via-[#450a0a]/95 to-red-950/95 border-t border-x border-amber-500/70 text-[10px] text-amber-300 font-bold uppercase tracking-wider shadow-md hover:brightness-110 transition flex items-center gap-1 cursor-pointer select-none"
        >
          <span>{isCollapsed ? '▲' : '▼'}</span>
          <span className="text-[9px]">{isCollapsed ? 'Deploy Army' : 'Hide Bar'}</span>
        </button>

        {error && (
          <div className="mb-1 rounded-lg border border-red-500/60 bg-red-950/90 px-3 py-1 text-center text-[11px] font-bold text-red-200 shadow-lg">
            {error}
          </div>
        )}

        <div
          className="flex items-stretch gap-1.5 rounded-lg px-2 py-1.5 shadow-2xl drop-shadow-[0_8px_20px_rgba(0,0,0,0.9)]"
          style={{
            background: 'linear-gradient(180deg, #2b0b0e 0%, #150608 100%)',
            border: `1.5px solid ${GOLD_BORDER}`,
            boxShadow: `0 0 16px rgba(0,0,0,0.9), inset 0 0 10px ${GOLD_SOFT}`,
          }}
        >
          {/* Unit palette: tap to queue one, hold to queue many. Scrolls so the
              queue and portal controls always stay on screen. */}
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none touch-pan-x pt-2">
            {Array.from(new Set(buffer.availableTroops)).map((typeId) => {
              const cost = buffer.mobCosts[typeId] ?? 0;
              const disabled = bufferLocked || capReached;
              const currentTier = unitTiers[typeId] ?? 1;
              const canUpgrade = currentTier < 3 && phase === 'combat';
              const nextTierDef = canUpgrade ? getMobTier(typeId, currentTier + 1) : null;
              const upgradeCost = nextTierDef?.upgradeCost ?? 0;
              const canAffordUpgrade = canUpgrade && buffer.gold >= upgradeCost;

              return (
                <div key={typeId} className="relative flex flex-shrink-0 flex-col items-center">
                  <button
                    onPointerDown={() => startHold(typeId)}
                    onPointerUp={stopHold}
                    onPointerLeave={stopHold}
                    onPointerCancel={stopHold}
                    disabled={disabled}
                    className="flex w-[44px] sm:w-[52px] flex-col items-center gap-0.5 rounded border border-amber-900/40 hover:border-amber-500/60 hover:bg-[#450a0a]/50 p-0.5 transition active:scale-95 disabled:opacity-40 cursor-pointer"
                    title={`Queue ${MOB_TYPES[typeId]?.name ?? typeId} (${cost}g)`}
                  >
                    <UnitIcon typeId={typeId} className="h-6 w-6 sm:h-7 sm:w-7" />
                    <span className="w-full truncate text-center text-[9px] font-bold leading-none text-white">
                      {MOB_TYPES[typeId]?.name ?? typeId}
                    </span>
                    <span className="text-[9px] font-bold leading-none text-amber-300">{cost}g</span>
                  </button>

                  {/* Upgrade Pill Button */}
                  {canUpgrade && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onOpenUpgrade?.(typeId);
                      }}
                      className={`absolute -top-2 -right-1 z-10 flex items-center justify-center rounded-full px-1 py-0.5 text-[8px] font-black shadow-md border transition cursor-pointer ${
                        canAffordUpgrade
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 animate-pulse'
                          : 'bg-stone-800 text-stone-400 border-stone-600 opacity-80 hover:opacity-100'
                      }`}
                      title={`Upgrade to Tier ${currentTier + 1} (${upgradeCost}g)`}
                    >
                      ▲ {upgradeCost}g
                    </button>
                  )}

                  {/* Current Tier Badge */}
                  {currentTier > 1 && (
                    <span className="absolute -top-1.5 -left-1 z-10 rounded bg-amber-950/95 border border-amber-500/70 px-1 text-[7px] font-black text-amber-300 shadow">
                      {currentTier === 2 ? 'II' : 'III'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mx-0.5 h-8 w-px flex-shrink-0 self-center bg-gradient-to-b from-transparent via-amber-500/50 to-transparent" aria-hidden />

          {/* Queue: only the lead unit's artwork plus a count, so it never grows.
              Dragging this icon deploys the queue onto whatever portal you drop
              it on (in the bar or on the map). */}
          <div className="flex flex-shrink-0 flex-col justify-center gap-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-200">
                Queue {queued.length}/{buffer.maxBufferUnits}
              </span>
              {queued.length > 0 && (
                <button
                  onClick={() => send(MESSAGES.bufferClear)}
                  disabled={bufferLocked}
                  className="h-4 w-4 rounded bg-red-950/90 border border-amber-600/50 text-[11px] font-black leading-none text-amber-200 transition hover:bg-red-800 disabled:opacity-40 cursor-pointer"
                  title="Clear queue (gold refunded)"
                >
                  ×
                </button>
              )}
            </div>
            <div className="flex h-9 w-12 items-center justify-center">
              {lead ? (
                <div
                  onPointerDown={beginDrag}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  className={`relative flex h-8 w-8 items-center justify-center rounded border border-amber-400/60 shadow-[0_0_8px_rgba(212,175,55,0.4)] ${
                    canDrag ? 'cursor-grab touch-none active:cursor-grabbing' : ''
                  }`}
                  style={thumbStyle(lead)}
                  title="Drag onto a portal to deploy"
                >
                  <UnitIcon typeId={lead} className="pointer-events-none h-7 w-7" />
                  {queued.length > 1 && (
                    <span className="pointer-events-none absolute -bottom-1.5 -right-1.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-1 text-[9px] font-black leading-tight text-slate-950 shadow">
                      ×{queued.length}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[9px] italic text-slate-400">Empty</span>
              )}
            </div>
          </div>

          <div className="mx-0.5 h-8 w-px flex-shrink-0 self-center bg-gradient-to-b from-transparent via-amber-500/50 to-transparent" aria-hidden />

          {/* Portal buttons: tap to stream the queue out of that portal, or drop
              the dragged queue icon onto one. A forked portal asks first. */}
          <div className="flex flex-shrink-0 items-center gap-1">
            {buffer.portals.map((portal, index) => {
              const isLocked = !!portal.locked;
              const canPush = !deployLocked && !isLocked && portal.charges > 0 && queued.length > 0;
              const highlighted = !isLocked && drag?.overBarId === portal.id;
              const charging = !isLocked && portal.charges < portal.maxCharges && portal.chargeSec > 0;
              const chargeProgress = charging ? 1 - portal.rechargeIn / portal.chargeSec : 1;
              // Ready to fire but nothing queued: nudge the player.
              const idlePulse = !deployLocked && !isLocked && portal.charges > 0 && queued.length === 0;
              return (
                <button
                  key={portal.id}
                  ref={(el) => {
                    portalRefs.current[index] = el;
                  }}
                  onClick={(event) => {
                    if (isLocked) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    requestDeploy(portal.id, rect.left + rect.width / 2, rect.top);
                  }}
                  disabled={isLocked || (!canPush && !idlePulse)}
                  className={`flex flex-col items-center gap-0.5 rounded border px-2 py-1 transition-all duration-200 ${
                    isLocked ? 'cursor-not-allowed opacity-40 grayscale' : 'hover:scale-105 active:scale-95'
                  } ${
                    idlePulse && !highlighted ? 'animate-pulse' : ''
                  } ${canPush || idlePulse ? 'hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]' : ''}`}
                  style={{
                    borderColor: highlighted ? '#ffe066' : canPush ? GOLD_BORDER : 'rgba(180,83,9,0.35)',
                    background: highlighted
                      ? 'rgba(251,191,36,0.25)'
                      : canPush
                        ? 'rgba(212,175,55,0.12)'
                        : 'rgba(30,10,12,0.6)',
                    boxShadow: highlighted ? '0 0 12px rgba(251,191,36,0.6)' : undefined,
                  }}
                  title={
                    isLocked
                      ? `Portal ${index + 1} locked (opens in ${portal.unlocksInSec ?? 0}s)`
                      : `Deploy through Portal ${index + 1} (${portal.charges}/${portal.maxCharges} charges)`
                  }
                >
                  <img
                    src={portalIcon(index)}
                    alt={`Portal ${index + 1}`}
                    className="h-7 w-7 object-contain pixelated"
                    style={{ imageRendering: 'pixelated' }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <span className="text-[10px] font-black uppercase tracking-wide text-amber-200">
                    P{index + 1}
                  </span>
                  {isLocked ? (
                    <span className="flex items-center gap-0.5 text-[8px] font-bold text-amber-400">
                      <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span>{portal.unlocksInSec ?? 0}s</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-[3px]">
                      {Array.from({ length: portal.maxCharges }, (_, i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            background: i < portal.charges ? '#34d399' : 'rgba(80,40,30,0.5)',
                            boxShadow: i < portal.charges ? '0 0 4px #34d399' : undefined,
                          }}
                        />
                      ))}
                      {charging && <ChargeRing progress={chargeProgress} />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Drag ghost: the buffer's lead unit follows the pointer. Portalled to
          <body> so the bar's centred transform can't shift its coordinates. */}
      {drag &&
        createPortal(
          <div
            className="pointer-events-none fixed left-0 top-0 z-[60]"
            style={{ transform: `translate(${drag.x}px, ${drag.y}px) translate(-50%, -50%)` }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.85)]"
              style={thumbStyle(drag.typeId)}
            >
              <UnitIcon typeId={drag.typeId} className="h-9 w-9" />
            </div>
          </div>,
          document.body,
        )}

      {/* Forked-portal path chooser: appears at the tap/drop point. */}
      {pendingDeploy &&
        createPortal(
          <>
            <div
              className="pointer-events-auto fixed inset-0 z-[65]"
              onClick={() => setPendingDeploy(null)}
            />
            <div
              className="pointer-events-auto fixed left-0 top-0 z-[70]"
              style={{
                transform: `translate(${Math.max(60, Math.min((typeof window !== 'undefined' ? window.innerWidth : 800) - 60, pendingDeploy.x))}px, ${Math.max(50, pendingDeploy.y)}px) translate(-50%, -100%)`,
              }}
            >
              <div
                className="flex flex-col items-stretch gap-1 rounded-lg border px-2 py-1.5 shadow-2xl"
                style={{
                  border: '1.5px solid #d4af37',
                  background: 'linear-gradient(180deg, #2b0b0e 0%, #150608 100%)',
                  boxShadow: '0 0 20px rgba(0,0,0,0.9), inset 0 0 10px rgba(251,191,36,0.15)',
                }}
              >
                <span className="text-center text-[9px] font-black uppercase tracking-wider text-amber-200">
                  Choose path
                </span>
                <div className="flex gap-1">
                  {pendingPaths.map((path) => (
                    <button
                      key={path.id}
                      onClick={() => choosePath(path.id)}
                      className="rounded border px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-100 transition active:scale-95 hover:brightness-110"
                      style={{
                        borderColor: GOLD_BORDER,
                        background: 'rgba(212,175,55,0.15)',
                      }}
                    >
                      {path.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
};

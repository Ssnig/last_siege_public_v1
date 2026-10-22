import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MESSAGES,
  MOB_TYPES,
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
}

const NEON = 'rgba(0, 240, 255, 0.55)';
const NEON_SOFT = 'rgba(0, 240, 255, 0.25)';
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
  const canDrag = !deployLocked && !!lead && buffer.portals.some((portal) => portal.charges > 0);

  const portalById = (portalId: string): AttackerPortalStatus | undefined =>
    buffer.portals.find((portal) => portal.id === portalId);

  /**
   * Asks a forked portal which track to take, or deploys straight through a
   * single-track one. `x`/`y` anchor the chooser at the drop point.
   */
  const requestDeploy = (portalId: string, x: number, y: number) => {
    if (deployLocked) return;
    const portal = portalById(portalId);
    if (!portal || portal.charges <= 0) return;

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

  /** Remaining charges for a portal id, from the latest buffer snapshot. */
  const chargeFor = (portalId: string): number => portalById(portalId)?.charges ?? 0;

  /** Which charged bar portal button is under a page-space point, if any. */
  const hitBarPortal = (x: number, y: number): string | null => {
    for (let i = 0; i < buffer.portals.length; i += 1) {
      const el = portalRefs.current[i];
      if (!el || buffer.portals[i].charges <= 0) continue;
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
    return id && chargeFor(id) > 0 ? id : null;
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

  return (
    <>
      <div
        className={`pointer-events-auto fixed bottom-2 left-1/2 z-40 w-[min(96vw,760px)] -translate-x-1/2 transition-opacity duration-300 ${
          isUIHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        {...suppressDefaults}
      >
        {error && (
          <div className="mb-1 rounded-lg border border-red-500/60 bg-red-950/90 px-3 py-1 text-center text-[11px] font-bold text-red-200 shadow-lg">
            {error}
          </div>
        )}

        <div
          className="flex items-stretch gap-1.5 rounded-lg px-2 py-1.5 shadow-2xl drop-shadow-[0_8px_20px_rgba(0,0,0,0.9)]"
          style={{
            background: 'linear-gradient(180deg, #101b3b 0%, #0a1128 100%)',
            border: `1px solid ${NEON}`,
            boxShadow: `0 0 14px rgba(0,0,0,0.85), inset 0 0 8px ${NEON_SOFT}`,
          }}
        >
          {/* Unit palette: tap to queue one, hold to queue many. Scrolls so the
              queue and portal controls always stay on screen. */}
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none touch-pan-x">
            {buffer.availableTroops.map((typeId) => {
              const cost = buffer.mobCosts[typeId] ?? 0;
              const disabled = bufferLocked || capReached;
              return (
                <button
                  key={typeId}
                  onPointerDown={() => startHold(typeId)}
                  onPointerUp={stopHold}
                  onPointerLeave={stopHold}
                  onPointerCancel={stopHold}
                  disabled={disabled}
                  className="flex w-[52px] flex-shrink-0 flex-col items-center gap-0.5 rounded p-0.5 transition active:scale-95 disabled:opacity-40"
                  title={`Queue ${MOB_TYPES[typeId]?.name ?? typeId} (${cost}g)`}
                >
                  <UnitIcon typeId={typeId} className="h-7 w-7" />
                  <span className="w-full truncate text-center text-[9px] font-bold leading-none text-white">
                    {MOB_TYPES[typeId]?.name ?? typeId}
                  </span>
                  <span className="text-[9px] font-bold leading-none text-amber-300">{cost}g</span>
                </button>
              );
            })}
          </div>

          <div className="mx-0.5 h-8 w-px flex-shrink-0 self-center bg-slate-600/60" aria-hidden />

          {/* Queue: only the lead unit's artwork plus a count, so it never grows.
              Dragging this icon deploys the queue onto whatever portal you drop
              it on (in the bar or on the map). */}
          <div className="flex flex-shrink-0 flex-col justify-center gap-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-cyan-200">
                Queue {queued.length}/{buffer.maxBufferUnits}
              </span>
              {queued.length > 0 && (
                <button
                  onClick={() => send(MESSAGES.bufferClear)}
                  disabled={bufferLocked}
                  className="h-4 w-4 rounded bg-red-900/80 text-[11px] font-black leading-none text-red-100 transition hover:bg-red-800 disabled:opacity-40"
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
                  className={`relative flex h-8 w-8 items-center justify-center rounded border border-white/20 ${
                    canDrag ? 'cursor-grab touch-none active:cursor-grabbing' : ''
                  }`}
                  style={thumbStyle(lead)}
                  title="Drag onto a portal to deploy"
                >
                  <UnitIcon typeId={lead} className="pointer-events-none h-7 w-7" />
                  {queued.length > 1 && (
                    <span className="pointer-events-none absolute -bottom-1.5 -right-1.5 rounded-full bg-cyan-400 px-1 text-[9px] font-black leading-tight text-slate-900">
                      ×{queued.length}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[9px] italic text-slate-400">Empty</span>
              )}
            </div>
          </div>

          <div className="mx-0.5 h-8 w-px flex-shrink-0 self-center bg-slate-600/60" aria-hidden />

          {/* Portal buttons: tap to stream the queue out of that portal, or drop
              the dragged queue icon onto one. A forked portal asks first. */}
          <div className="flex flex-shrink-0 items-center gap-1">
            {buffer.portals.map((portal, index) => {
              const canPush = !deployLocked && portal.charges > 0 && queued.length > 0;
              const highlighted = drag?.overBarId === portal.id;
              const charging = portal.charges < portal.maxCharges && portal.chargeSec > 0;
              const chargeProgress = charging ? 1 - portal.rechargeIn / portal.chargeSec : 1;
              // Ready to fire but nothing queued: nudge the player.
              const idlePulse = !deployLocked && portal.charges > 0 && queued.length === 0;
              return (
                <button
                  key={portal.id}
                  ref={(el) => {
                    portalRefs.current[index] = el;
                  }}
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    requestDeploy(portal.id, rect.left + rect.width / 2, rect.top);
                  }}
                  disabled={!canPush && !idlePulse}
                  className={`flex flex-col items-center gap-0.5 rounded border px-2 py-1 transition active:scale-95 ${
                    idlePulse && !highlighted ? 'animate-pulse' : ''
                  } ${canPush || idlePulse ? '' : 'opacity-40'}`}
                  style={{
                    borderColor: highlighted ? '#67e8f9' : canPush ? NEON : 'rgba(148,163,184,0.35)',
                    background: highlighted
                      ? 'rgba(0,240,255,0.22)'
                      : canPush
                        ? 'rgba(0,240,255,0.08)'
                        : 'rgba(15,23,42,0.6)',
                  }}
                  title={`Deploy through Portal ${index + 1} (${portal.charges}/${portal.maxCharges} charges)`}
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
                  <span className="text-[10px] font-black uppercase tracking-wide text-cyan-100">
                    P{index + 1}
                  </span>
                  <span className="flex items-center gap-[3px]">
                    {Array.from({ length: portal.maxCharges }, (_, i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          background: i < portal.charges ? 'rgba(34,211,238,0.95)' : 'rgba(100,116,139,0.45)',
                        }}
                      />
                    ))}
                  </span>
                  {/* Recharge bar: always drawn (also at full charge) so the button
                      never changes size while a portal is recharging. */}
                  <span
                    className="h-1 w-7 overflow-hidden rounded-full"
                    style={{ background: 'rgba(100,116,139,0.35)' }}
                    title={
                      charging
                        ? `Next charge in ${Math.ceil(portal.rechargeIn)}s`
                        : 'Portal fully charged'
                    }
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.round(chargeProgress * 100)}%`,
                        background: charging
                          ? 'rgba(34,211,238,0.95)'
                          : 'rgba(34,211,238,0.55)',
                      }}
                    />
                  </span>
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
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.85)]"
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
                transform: `translate(${pendingDeploy.x}px, ${pendingDeploy.y}px) translate(-50%, -100%)`,
              }}
            >
              <div
                className="flex flex-col items-stretch gap-1 rounded-lg border px-2 py-1.5 shadow-2xl"
                style={{
                  borderColor: NEON,
                  background: 'linear-gradient(180deg, #101b3b 0%, #0a1128 100%)',
                }}
              >
                <span className="text-center text-[9px] font-black uppercase tracking-wider text-cyan-200">
                  Choose path
                </span>
                <div className="flex gap-1">
                  {pendingPaths.map((path) => (
                    <button
                      key={path.id}
                      onClick={() => choosePath(path.id)}
                      className="rounded border px-2 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-100 transition active:scale-95"
                      style={{
                        borderColor: NEON,
                        background: 'rgba(0,240,255,0.08)',
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

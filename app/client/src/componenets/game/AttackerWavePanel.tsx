import React, { useEffect, useState } from 'react';
import {
  MESSAGES,
  MOB_TYPES,
  type AttackerArmyPayload,
  type AttackerArmyPath,
  type WaveSize,
} from '@root/shared';
import { useSmoothCountdown } from './useSmoothCountdown';

interface AttackerWavePanelProps {
  army: AttackerArmyPayload;
  /** Live gold balance (kept in sync by the per-second economy push). */
  gold: number;
  /** Latest refusal reason from the server, if any. */
  error: string | null;
  /** Current match phase (used to freeze the timer at game over). */
  phase: string;
  /** Seconds left on the current phase clock, from the server. */
  phaseEndsAt: number;
  /** The enemy (defender) base's current HP. */
  coreHp: number;
  /** The enemy base's max HP. */
  maxCoreHp: number;
  /** Hide the modal (the Army button can reopen it). */
  onClose: () => void;
  /** Send a room message (Colyseus `room.send`). */
  send: (type: string, payload?: unknown) => void;
}

const NEON = 'rgba(0, 240, 255, 0.55)';
const NEON_SOFT = 'rgba(0, 240, 255, 0.25)';

function formatTime(seconds: number): string {
  if (!(seconds > 0)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Deterministic accent hue per unit so placeholder thumbnails differ. */
function thumbStyle(typeId: string): React.CSSProperties {
  const name = MOB_TYPES[typeId]?.name ?? typeId;
  const hue = (name.charCodeAt(0) * 37) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue} 55% 32%), hsl(${(hue + 40) % 360} 55% 20%))`,
    borderColor: 'rgba(255,255,255,0.25)',
  };
}

/**
 * Attacker "Army Management" modal.
 *
 * @remarks
 * Placeholder UI built from plain elements/Tailwind only (no art assets). It
 * mirrors the server's `attacker_army` snapshot and sends wave intents; the
 * server stays authoritative and may still reject, in which case `error` shows.
 */
export const AttackerWavePanel: React.FC<AttackerWavePanelProps> = ({
  army,
  gold,
  error,
  phase,
  phaseEndsAt,
  coreHp,
  maxCoreHp,
  onClose,
  send,
}) => {
  const paths = army.paths;
  const [activePathId, setActivePathId] = useState<string>(() => paths[0]?.pathId ?? '');

  // Keep the selected path valid if the server's path list changes.
  useEffect(() => {
    if (paths.length === 0) return;
    if (!paths.some((p) => p.pathId === activePathId)) {
      setActivePathId(paths[0].pathId);
    }
  }, [paths, activePathId]);

  // Smooth countdown driven by the server's phaseEndsAt (see hook docs).
  const secondsLeft = useSmoothCountdown(phaseEndsAt, phase !== 'gameover');

  const activeIndex = Math.max(0, paths.findIndex((p) => p.pathId === activePathId));
  const activePath: AttackerArmyPath | undefined = paths[activeIndex];
  const activePathKey = activePath?.pathId ?? '';
  const batches = activePath?.batches ?? [];
  const otherPath = paths.find((p) => p.pathId !== activePath?.pathId);

  const limits = activePath ? army.limits[activePath.size] : undefined;
  const hpPct = maxCoreHp > 0 ? Math.max(0, Math.min(100, (coreHp / maxCoreHp) * 100)) : 0;

  const capReached =
    !!activePath &&
    !!limits &&
    (activePath.troopCount >= limits.waveLimit || activePath.batches.length >= limits.maxBatches);

  const canSend =
    !!activePath && activePath.troopCount > 0 && activePath.goldCost <= gold;

  const addTroop = (typeId: string) => {
    if (!activePath) return;
    send(MESSAGES.waveAddBatch, { pathId: activePath.pathId, typeId, count: 1 });
  };

  const copyOtherPath = () => {
    if (!activePath || !otherPath || otherPath.batches.length === 0) return;
    send(MESSAGES.waveClear, { pathId: activePath.pathId });
    for (const batch of otherPath.batches) {
      send(MESSAGES.waveAddBatch, {
        pathId: activePath.pathId,
        typeId: batch.typeId,
        count: batch.count,
      });
    }
  };

  const statBox = 'flex items-center gap-2 rounded-lg px-3 py-2 bg-[#0a1128]';
  const statBoxStyle: React.CSSProperties = { border: `1px solid ${NEON}`, boxShadow: `0 0 10px ${NEON_SOFT}` };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="pointer-events-auto flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl text-white"
        style={{
          background: 'linear-gradient(180deg, #101b3b 0%, #0a1128 100%)',
          border: `2px solid ${NEON}`,
          boxShadow: '0 0 34px rgba(0, 240, 255, 0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: title + close */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ background: '#0a1128', borderBottom: `1px solid ${NEON_SOFT}` }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <h2 className="font-['Almendra',serif] text-lg font-black tracking-wide sm:text-xl">
              Army Management
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close army management"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#16244a] text-xl leading-none text-cyan-100 hover:bg-[#1e3163]"
            style={{ border: `1px solid ${NEON}` }}
          >
            ×
          </button>
        </div>

        {/* Mirrored top HUD stats */}
        <div className="flex flex-wrap items-stretch gap-2 px-4 py-3">
          <div className={statBox} style={statBoxStyle}>
            <span className="text-lg">🪙</span>
            <div className="leading-tight">
              <div className="text-sm font-bold text-amber-300">{gold}</div>
              <div className="text-[10px] text-emerald-300">
                {army.incomeExpired ? 'income stopped' : `+${army.goldPerSecond}/s`}
              </div>
            </div>
          </div>

          <div className={statBox} style={statBoxStyle}>
            <span className="text-lg">⏳</span>
            <div className="leading-tight">
              <div className="text-sm font-bold text-cyan-200">{formatTime(secondsLeft)}</div>
              <div className="text-[10px] text-slate-400">Time left</div>
            </div>
          </div>

          <div className={`${statBox} flex-1 min-w-[180px]`} style={statBoxStyle}>
            <span className="text-lg">🏯</span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="flex items-center justify-between text-[10px] text-slate-300">
                <span>Enemy Base HP</span>
                <span className="font-bold text-red-300">
                  {coreHp}/{maxCoreHp}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#0a1128]" style={{ border: `1px solid ${NEON_SOFT}` }}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
                  style={{ width: `${hpPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-4 mb-2 rounded-lg border border-red-500/60 bg-red-950/50 px-3 py-1.5 text-xs text-red-200">
            {error}
          </div>
        )}

        {/* Body: path selector | formation | available troops */}
        <div className="grid flex-1 gap-3 overflow-y-auto p-4 md:grid-cols-[150px_1fr_240px]">
          {/* Left: path selector */}
          <div className="flex gap-2 md:flex-col">
            {paths.map((path, index) => {
              const isActive = path.pathId === activePathId;
              return (
                <button
                  key={path.pathId}
                  onClick={() => setActivePathId(path.pathId)}
                  className={`flex-1 rounded-lg px-3 py-2 text-left text-sm font-bold transition ${
                    isActive ? 'bg-[#16244a] text-white' : 'bg-[#0d1730] text-slate-300 hover:bg-[#142040]'
                  }`}
                  style={{
                    border: `1px solid ${isActive ? NEON : 'rgba(255,255,255,0.12)'}`,
                    boxShadow: isActive ? `0 0 12px ${NEON_SOFT}` : 'none',
                  }}
                >
                  <div>Path {index + 1}</div>
                  <div className="text-[10px] font-normal text-slate-400">
                    {path.troopCount} units · {path.size}
                  </div>
                </button>
              );
            })}
            {paths.length === 0 && (
              <div className="text-xs text-slate-400">No paths on this map.</div>
            )}
          </div>

          {/* Center: active path formation */}
          <div
            className="flex flex-col rounded-xl bg-[#0d1730] p-3"
            style={{ border: `1px solid ${NEON_SOFT}` }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-cyan-200">
                Path {activeIndex + 1} Formation
              </span>
              {activePath && limits && (
                <span className="flex items-center gap-1 text-xs text-slate-300">
                  👥 {activePath.troopCount}/{limits.waveLimit}
                </span>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-2">
              {activePath && batches.length === 0 && (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-600 py-8 text-xs text-slate-500">
                  Add troops from the roster →
                </div>
              )}

              {batches.map((batch, index) => {
                const name = MOB_TYPES[batch.typeId]?.name ?? batch.typeId;
                return (
                  <div
                    key={batch.batchId}
                    className="flex items-center gap-2 rounded-lg bg-[#16244a] px-2 py-1.5"
                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0a1128] text-xs font-bold text-cyan-200">
                      {index + 1}
                    </span>
                    <span
                      className="h-8 w-8 rounded-md border"
                      style={thumbStyle(batch.typeId)}
                      aria-hidden
                    />
                    <span className="flex-1 truncate text-sm font-semibold text-white">{name}</span>

                    {/* unit count stepper */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          send(MESSAGES.waveSetCount, {
                            pathId: activePathKey,
                            batchId: batch.batchId,
                            count: batch.count - 1,
                          })
                        }
                        disabled={batch.count <= 1}
                        className="h-6 w-6 rounded bg-[#0a1128] text-white disabled:opacity-40 hover:bg-[#1e3163]"
                      >
                        −
                      </button>
                      <span className="w-9 text-center text-sm font-bold text-amber-200">
                        ×{batch.count}
                      </span>
                      <button
                        onClick={() =>
                          send(MESSAGES.waveSetCount, {
                            pathId: activePathKey,
                            batchId: batch.batchId,
                            count: batch.count + 1,
                          })
                        }
                        disabled={!limits || batch.count >= limits.batchLimit}
                        className="h-6 w-6 rounded bg-[#0a1128] text-white disabled:opacity-40 hover:bg-[#1e3163]"
                      >
                        +
                      </button>
                    </div>

                    <span className="cursor-grab px-1 text-slate-500" title="Drag handle">
                      ⠿
                    </span>
                    <button
                      onClick={() =>
                        send(MESSAGES.waveReorder, {
                          pathId: activePathKey,
                          batchId: batch.batchId,
                          toIndex: index - 1,
                        })
                      }
                      disabled={index === 0}
                      className="h-6 w-6 rounded bg-[#0a1128] text-white disabled:opacity-40 hover:bg-[#1e3163]"
                      title="Move earlier"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() =>
                        send(MESSAGES.waveReorder, {
                          pathId: activePathKey,
                          batchId: batch.batchId,
                          toIndex: index + 1,
                        })
                      }
                      disabled={index === batches.length - 1}
                      className="h-6 w-6 rounded bg-[#0a1128] text-white disabled:opacity-40 hover:bg-[#1e3163]"
                      title="Move later"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() =>
                        send(MESSAGES.waveRemoveBatch, {
                          pathId: activePathKey,
                          batchId: batch.batchId,
                        })
                      }
                      className="h-6 w-6 rounded bg-red-900/80 text-red-100 hover:bg-red-800"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: available troops */}
          <div className="flex flex-col gap-2">
            <div className="text-sm font-bold text-cyan-200">Available Troops</div>
            <div className="grid grid-cols-3 gap-2">
              {army.availableTroops.map((typeId) => {
                const cost = army.mobCosts[typeId] ?? 0;
                return (
                  <button
                    key={typeId}
                    onClick={() => addTroop(typeId)}
                    disabled={capReached}
                    className="flex flex-col items-center gap-1 rounded-lg bg-[#16244a] p-2 text-center transition hover:bg-[#1e3163] disabled:opacity-40"
                    style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                    title={`Add ${MOB_TYPES[typeId]?.name ?? typeId} (${cost}g)`}
                  >
                    <span className="h-8 w-8 rounded-md border" style={thumbStyle(typeId)} aria-hidden />
                    <span className="w-full truncate text-[11px] font-semibold text-white">
                      {MOB_TYPES[typeId]?.name ?? typeId}
                    </span>
                    <span className="text-[10px] text-amber-300">{cost}g</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={copyOtherPath}
              disabled={!otherPath || otherPath.batches.length === 0}
              className="rounded-lg border px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-[#142040] disabled:opacity-40"
              style={{ borderColor: NEON }}
            >
              {otherPath ? `⧉ Copy from Path ${paths.indexOf(otherPath) + 1}` : '⧉ Copy'}
            </button>
            <button
              onClick={() => activePath && send(MESSAGES.waveClear, { pathId: activePath.pathId })}
              disabled={!activePath || activePath.batches.length === 0}
              className="rounded-lg border px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-950/40 disabled:opacity-40"
              style={{ borderColor: 'rgba(248,113,113,0.6)' }}
            >
              🗑 Clear All
            </button>
          </div>
        </div>

        {/* Bottom action bar: wave size + send */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          style={{ background: '#0a1128', borderTop: `1px solid ${NEON_SOFT}` }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300">Send as:</span>
            {(['small', 'big'] as WaveSize[]).map((size) => {
              const isActive = activePath?.size === size;
              const accent = size === 'small' ? NEON : 'rgba(168, 85, 247, 0.7)';
              return (
                <button
                  key={size}
                  onClick={() => activePath && send(MESSAGES.waveSetSize, { pathId: activePath.pathId, size })}
                  disabled={!activePath}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    isActive ? 'text-white' : 'text-slate-300 hover:text-white'
                  }`}
                  style={{
                    border: `1px solid ${accent}`,
                    background: isActive ? (size === 'small' ? 'rgba(0,240,255,0.15)' : 'rgba(168,85,247,0.2)') : 'transparent',
                    boxShadow: isActive ? `0 0 10px ${accent}` : 'none',
                  }}
                >
                  {size === 'small' ? '✈️ Mini Wave' : '💀 Big Wave'}
                  {size === 'big' && (
                    <span className="ml-1 text-[10px] text-purple-200">
                      {army.bigWavesRemaining} left
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => activePath && send(MESSAGES.waveRelease, { pathIds: [activePath.pathId] })}
            disabled={!canSend}
            className="rounded-xl px-6 py-2.5 text-sm font-black uppercase tracking-wide text-emerald-950 transition disabled:opacity-40"
            style={{
              background: 'linear-gradient(180deg, #34d399, #10b981)',
              boxShadow: '0 0 18px rgba(16,185,129,0.55)',
            }}
          >
            📨 Send{activePath ? ` (${activePath.goldCost}g)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

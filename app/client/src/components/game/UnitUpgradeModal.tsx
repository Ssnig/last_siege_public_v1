import React from 'react';
import { MOB_TYPES, getMobTier } from '@root/shared';
import { MOB_ICONS } from './unitIcons';

interface UnitUpgradeModalProps {
  unitTypeId: string | null;
  currentTier: number;
  playerGold: number;
  onConfirm: (unitTypeId: string) => void;
  onClose: () => void;
}

export const UnitUpgradeModal: React.FC<UnitUpgradeModalProps> = ({
  unitTypeId,
  currentTier,
  playerGold,
  onConfirm,
  onClose,
}) => {
  if (!unitTypeId) return null;

  const mob = MOB_TYPES[unitTypeId];
  if (!mob) return null;

  const nextTier = currentTier + 1;
  const currentTierDef = getMobTier(unitTypeId, currentTier);
  const nextTierDef = getMobTier(unitTypeId, nextTier);
  const upgradeCost = nextTierDef.upgradeCost;
  const canAfford = playerGold >= upgradeCost;

  // Format ability comparison if applicable
  const renderAbilityComparison = () => {
    if (!currentTierDef.ability && !nextTierDef.ability) return null;
    const curAb = currentTierDef.ability;
    const nextAb = nextTierDef.ability;
    if (!curAb || !nextAb) return null;

    if (curAb.type === 'heal_aura') {
      return (
        <div className="flex flex-col gap-0.5 rounded bg-black/40 p-2 border border-amber-900/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
            Ability: Heal Aura
          </span>
          <div className="flex justify-between text-xs text-amber-100/90">
            <span>Heal Amount:</span>
            <span>
              <span className="text-stone-400">{curAb.healAmount}</span>
              <span className="mx-1 text-amber-500">→</span>
              <span className="font-bold text-emerald-400">{nextAb.healAmount}</span>
            </span>
          </div>
          <div className="flex justify-between text-xs text-amber-100/90">
            <span>Cooldown:</span>
            <span>
              <span className="text-stone-400">{curAb.cooldownSec}s</span>
              <span className="mx-1 text-amber-500">→</span>
              <span className="font-bold text-emerald-400">{nextAb.cooldownSec}s</span>
            </span>
          </div>
        </div>
      );
    }

    if (curAb.type === 'speed_aura') {
      return (
        <div className="flex flex-col gap-0.5 rounded bg-black/40 p-2 border border-amber-900/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
            Ability: Speed Aura
          </span>
          <div className="flex justify-between text-xs text-amber-100/90">
            <span>Speed Boost:</span>
            <span>
              <span className="text-stone-400">+{Math.round((curAb.speedBoost ?? 0) * 100)}%</span>
              <span className="mx-1 text-amber-500">→</span>
              <span className="font-bold text-emerald-400">+{Math.round((nextAb.speedBoost ?? 0) * 100)}%</span>
            </span>
          </div>
          <div className="flex justify-between text-xs text-amber-100/90">
            <span>Duration:</span>
            <span>
              <span className="text-stone-400">{curAb.durationSec}s</span>
              <span className="mx-1 text-amber-500">→</span>
              <span className="font-bold text-emerald-400">{nextAb.durationSec}s</span>
            </span>
          </div>
        </div>
      );
    }

    if (curAb.type === 'self_heal') {
      return (
        <div className="flex flex-col gap-0.5 rounded bg-black/40 p-2 border border-amber-900/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
            Ability: Self Heal
          </span>
          <div className="flex justify-between text-xs text-amber-100/90">
            <span>Heal Ratio:</span>
            <span>
              <span className="text-stone-400">{Math.round((curAb.healFraction ?? 0) * 100)}%</span>
              <span className="mx-1 text-amber-500">→</span>
              <span className="font-bold text-emerald-400">{Math.round((nextAb.healFraction ?? 0) * 100)}%</span>
            </span>
          </div>
          <div className="flex justify-between text-xs text-amber-100/90">
            <span>Cooldown:</span>
            <span>
              <span className="text-stone-400">{curAb.cooldownSec}s</span>
              <span className="mx-1 text-amber-500">→</span>
              <span className="font-bold text-emerald-400">{nextAb.cooldownSec}s</span>
            </span>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderSpecialPerkComparison = () => {
    // Sone Ma stun
    if (currentTierDef.onDeathTowerStunSec || nextTierDef.onDeathTowerStunSec) {
      return (
        <div className="flex justify-between text-xs text-amber-100/90">
          <span>Tower Stun on Death:</span>
          <span>
            <span className="text-stone-400">{currentTierDef.onDeathTowerStunSec}s</span>
            <span className="mx-1 text-amber-500">→</span>
            <span className="font-bold text-emerald-400">{nextTierDef.onDeathTowerStunSec}s</span>
          </span>
        </div>
      );
    }

    // Belu adaptive defense
    if (currentTierDef.adaptiveDefense && nextTierDef.adaptiveDefense) {
      return (
        <div className="flex justify-between text-xs text-amber-100/90">
          <span>Max Defense Stacks:</span>
          <span>
            <span className="text-stone-400">{currentTierDef.adaptiveDefense.maxStacks}</span>
            <span className="mx-1 text-amber-500">→</span>
            <span className="font-bold text-emerald-400">{nextTierDef.adaptiveDefense.maxStacks}</span>
          </span>
        </div>
      );
    }

    // A Ba speed ramp
    if (currentTierDef.speedRamp && nextTierDef.speedRamp) {
      return (
        <div className="flex justify-between text-xs text-amber-100/90">
          <span>Ramp Up Time:</span>
          <span>
            <span className="text-stone-400">{currentTierDef.speedRamp.rampDurationSec}s</span>
            <span className="mx-1 text-amber-500">→</span>
            <span className="font-bold text-emerald-400">{nextTierDef.speedRamp.rampDurationSec}s</span>
          </span>
        </div>
      );
    }

    return null;
  };

  const iconUrl = MOB_ICONS[unitTypeId];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div
        className="relative flex w-full max-w-sm flex-col gap-3 rounded-lg border-2 p-5 text-white shadow-2xl"
        style={{
          background: 'linear-gradient(180deg, #1f0709 0%, #0d0304 100%)',
          borderColor: '#c59b27',
          boxShadow: '0 0 24px rgba(0,0,0,0.9), inset 0 0 16px rgba(197,155,39,0.25)',
        }}
      >
        {/* Header with Unit Info and Tier Badges */}
        <div className="flex items-center gap-3 border-b border-amber-900/40 pb-3">
          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded border border-amber-500/60 bg-black/60 shadow">
            {iconUrl ? (
              <img src={iconUrl} alt={mob.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-bold text-amber-400">
                {mob.name[0]}
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col">
            <h3 className="text-base font-black tracking-wide text-amber-200">
              {mob.name}
            </h3>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <span>Tier {currentTier}</span>
              <span className="text-amber-500 font-black">→</span>
              <span className="text-emerald-400 font-black">Tier {nextTier}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded border border-amber-900/40 bg-black/40 text-stone-400 hover:text-white hover:border-amber-500/50 transition cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Stat Comparison Grid */}
        <div className="flex flex-col gap-2 rounded bg-black/30 p-3 border border-amber-900/30">
          <div className="flex justify-between text-xs text-amber-100/90">
            <span>Max Health:</span>
            <span>
              <span className="text-stone-400">{currentTierDef.maxHp}</span>
              <span className="mx-1 text-amber-500">→</span>
              <span className="font-bold text-emerald-400">
                {nextTierDef.maxHp} (+{nextTierDef.maxHp - currentTierDef.maxHp})
              </span>
            </span>
          </div>

          <div className="flex justify-between text-xs text-amber-100/90">
            <span>Armor:</span>
            <span>
              <span className="text-stone-400">{currentTierDef.armor ?? 0}</span>
              <span className="mx-1 text-amber-500">→</span>
              <span className="font-bold text-emerald-400">
                {nextTierDef.armor ?? 0}
              </span>
            </span>
          </div>

          <div className="flex justify-between text-xs text-amber-100/90">
            <span>Deploy Cost (Per Unit):</span>
            <span>
              <span className="text-stone-400">{currentTierDef.deployCost}g</span>
              <span className="mx-1 text-amber-500">→</span>
              <span className="font-bold text-amber-300">
                {nextTierDef.deployCost}g
              </span>
            </span>
          </div>

          <div className="flex justify-between text-xs text-amber-100/90">
            <span>Citadel Leak Damage:</span>
            <span>
              <span className="text-stone-400">{currentTierDef.leakDamage}</span>
              <span className="mx-1 text-amber-500">→</span>
              <span className="font-bold text-emerald-400">
                {nextTierDef.leakDamage} (+{nextTierDef.leakDamage - currentTierDef.leakDamage})
              </span>
            </span>
          </div>

          {renderSpecialPerkComparison()}
        </div>

        {/* Ability boost section */}
        {renderAbilityComparison()}

        {/* Notice about queued buffer refund */}
        <p className="text-[10px] leading-tight text-amber-300/70 italic text-center">
          Confirming will refund and remove any queued instances of this unit currently in your deploy buffer.
        </p>

        {/* Upgrade cost and actions */}
        <div className="mt-1 flex items-center justify-between gap-3 border-t border-amber-900/40 pt-3">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-stone-400">Upgrade Cost</span>
            <span className="text-sm font-black text-amber-300">{upgradeCost} Gold</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded px-3 py-1.5 text-xs font-bold text-stone-300 hover:text-white border border-stone-700 hover:border-stone-500 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm(unitTypeId);
                onClose();
              }}
              disabled={!canAfford}
              className={`rounded px-4 py-1.5 text-xs font-black transition shadow-md cursor-pointer ${
                canAfford
                  ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-slate-950 border border-amber-300'
                  : 'bg-stone-800 text-stone-500 border border-stone-700 cursor-not-allowed opacity-60'
              }`}
            >
              {canAfford ? 'Confirm Upgrade' : 'Not Enough Gold'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from "react";
import { DAMAGE_TYPES, type DamageType } from "@root/shared";
import { DAMAGE_BADGE_STYLE } from "../../game/damageTypes";

/**
 * Small badge showing which damage channel a tower deals.
 *
 * @remarks Drawn as plain vectors (a steel blade for physical damage, a violet
 * spark for mental damage) so it needs no art files and stays crisp at any
 * size. The badge is decorative: the surrounding card carries the meaning for
 * screen readers through its own label.
 */
interface DamageTypeBadgeProps {
  /** Damage channel to show; defaults to physical. */
  type?: DamageType;
  /** Badge diameter in pixels. */
  size?: number;
  /** Extra classes for the wrapper. */
  className?: string;
}

export const DamageTypeBadge: React.FC<DamageTypeBadgeProps> = ({
  type = DAMAGE_TYPES.physical,
  size = 18,
  className = "",
}) => {
  const style = DAMAGE_BADGE_STYLE[type];
  const isMental = type === DAMAGE_TYPES.mental;

  return (
    <span
      className={`pointer-events-none inline-flex items-center justify-center rounded-full bg-slate-950/85 border ${className}`}
      style={{
        borderColor: style.accent,
        width: size,
        height: size,
        boxShadow: `0 0 5px ${style.accent}55`,
      }}
      title={style.label}
      aria-label={style.label}
    >
      <svg
        width={size * 0.72}
        height={size * 0.72}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        {isMental ? (
          <path
            d="M12 2.5 L14.2 9.8 L21.5 12 L14.2 14.2 L12 21.5 L9.8 14.2 L2.5 12 L9.8 9.8 Z"
            fill={style.accent}
          />
        ) : (
          <>
            <path d="M12 2.5 L15 13.4 L9 13.4 Z" fill={style.accent} />
            <rect x="6.4" y="13" width="11.2" height="2.2" rx="1.1" fill="#fbbf24" />
            <rect x="11" y="15.2" width="2" height="5" rx="1" fill="#94a3b8" />
          </>
        )}
      </svg>
    </span>
  );
};

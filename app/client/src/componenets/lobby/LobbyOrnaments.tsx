import React from 'react';

/**
 * Decorative golden filigree corner brackets for royal panels.
 * Renders SVG corner ornaments at all four corners of a container.
 */
export const GoldCorners: React.FC<{ className?: string }> = ({ className = '' }) => {
  const cornerSvg = (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="goldGrad" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="40%" stopColor="#d4af37" />
          <stop offset="100%" stopColor="#92681a" />
        </linearGradient>
      </defs>
      <path
        d="M2 30 L2 8 C2 4.5 4.5 2 8 2 L30 2"
        stroke="url(#goldGrad)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="4" cy="4" r="2.5" fill="#d4af37" />
    </svg>
  );

  return (
    <div className={`pointer-events-none ${className}`}>
      {/* Top-left */}
      <div className="absolute top-0 left-0">{cornerSvg}</div>
      {/* Top-right */}
      <div className="absolute top-0 right-0" style={{ transform: 'scaleX(-1)' }}>{cornerSvg}</div>
      {/* Bottom-left */}
      <div className="absolute bottom-0 left-0" style={{ transform: 'scaleY(-1)' }}>{cornerSvg}</div>
      {/* Bottom-right */}
      <div className="absolute bottom-0 right-0" style={{ transform: 'scale(-1, -1)' }}>{cornerSvg}</div>
    </div>
  );
};

/**
 * Golden divider line with ornate center diamond.
 */
export const GoldDivider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-600/80 to-amber-700/60" />
    <div className="w-2 h-2 rotate-45 bg-amber-600/80 shrink-0" />
    <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-600/80 to-amber-700/60" />
  </div>
);

/**
 * Golden top crest arc that sits atop the header bar.
 */
export const GoldCrest: React.FC = () => (
  <div className="absolute -top-3 left-1/2 -translate-x-1/2 pointer-events-none">
    <svg width="80" height="24" viewBox="0 0 80 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="crestGrad" x1="0" y1="0" x2="0" y2="24">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#d4af37" />
          <stop offset="100%" stopColor="#92681a" />
        </linearGradient>
      </defs>
      <path
        d="M0 24 Q10 24 15 16 Q20 8 30 4 Q40 0 40 0 Q40 0 50 4 Q60 8 65 16 Q70 24 80 24"
        stroke="url(#crestGrad)"
        strokeWidth="2.5"
        fill="none"
      />
      <circle cx="40" cy="3" r="3" fill="#d4af37" />
    </svg>
  </div>
);

/**
 * Royal panel container with crimson gradient, double gold border, and corner ornaments.
 */
export const RoyalPanel: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div
    className={`relative rounded-lg overflow-hidden ${className}`}
    style={{
      background: 'linear-gradient(145deg, #8c2e2c 0%, #7a2323 30%, #6b1e1e 60%, #4a1212 100%)',
      boxShadow: 'inset 0 1px 0 rgba(254,240,138,0.15), inset 0 -1px 0 rgba(0,0,0,0.4), 0 4px 20px rgba(0,0,0,0.5)',
    }}
  >
    {/* Double gold border */}
    <div
      className="absolute inset-0 rounded-lg pointer-events-none"
      style={{
        border: '2px solid #c59b27',
        boxShadow: 'inset 0 0 0 3px rgba(74,19,18,0.8), inset 0 0 0 5px rgba(197,155,39,0.4)',
      }}
    />
    <GoldCorners />
    <div className="relative z-10">{children}</div>
  </div>
);

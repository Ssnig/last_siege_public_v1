import React, { useEffect, useRef, useState } from 'react';

interface EffectsOverlayProps {
  /** Optional manual danger state (low HP or sudden death) */
  dangerActive?: boolean;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  alpha: number;
  maxAlpha: number;
  phase: number;
  color: string;
}

/**
 * Global Cinematic & Tactical Effects Overlay.
 *
 * Provides:
 * 1. Atmospheric Ambient Embers (golden/crimson battlefield sparks drifting gently)
 * 2. Tactical Scanlines (crisp arcade micro-scanlines for cohesive aesthetics)
 * 3. Cinematic Vignette (darkened edges that focus focus on central battlefield)
 * 4. Dynamic Danger Vignette (breathing crimson vignette during low HP or sudden death)
 * 5. Screen Flash & Transition Bloom (triggered on major battle milestones)
 */
export const EffectsOverlay: React.FC<EffectsOverlayProps> = ({ dangerActive = false }) => {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('game:effects_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  const [isDanger, setIsDanger] = useState<boolean>(dangerActive);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync internal danger state with prop
  useEffect(() => {
    setIsDanger(dangerActive);
  }, [dangerActive]);

  // Listen to custom window events for danger state and flash triggers
  useEffect(() => {
    const handleDangerEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ active: boolean }>;
      setIsDanger(!!customEvent.detail?.active);
    };

    const handleFlashEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ color?: string }>;
      setFlashColor(customEvent.detail?.color || 'rgba(254, 240, 138, 0.45)');
      setTimeout(() => {
        setFlashColor(null);
      }, 450);
    };

    const handleToggleEffects = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled: boolean }>;
      setEnabled(customEvent.detail.enabled);
    };

    window.addEventListener('game:danger', handleDangerEvent);
    window.addEventListener('game:flash', handleFlashEvent);
    window.addEventListener('settings:effects_toggle', handleToggleEffects);

    return () => {
      window.removeEventListener('game:danger', handleDangerEvent);
      window.removeEventListener('game:flash', handleFlashEvent);
      window.removeEventListener('settings:effects_toggle', handleToggleEffects);
    };
  }, []);

  // Ambient Ember Particle Engine
  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Warm atmospheric palette
    const colors = [
      'rgba(251, 191, 36,', // amber
      'rgba(245, 158, 11,', // deep gold
      'rgba(234, 88, 12,',  // orange ember
      'rgba(239, 68, 68,',  // crimson spark
    ];

    const particleCount = Math.min(28, Math.max(12, Math.floor(width / 70)));
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 1,
        speedY: Math.random() * 0.45 + 0.15,
        speedX: (Math.random() - 0.5) * 0.35,
        alpha: Math.random() * 0.4 + 0.1,
        maxAlpha: Math.random() * 0.45 + 0.25,
        phase: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.phase += 0.02;
        p.y -= p.speedY;
        p.x += p.speedX + Math.sin(p.phase) * 0.35;

        // Reset if drifted past top or sides
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        const currentAlpha = p.maxAlpha * (0.6 + 0.4 * Math.sin(p.phase));

        ctx.fillStyle = `${p.color} ${currentAlpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Optional tiny glow halo
        ctx.fillStyle = `${p.color} ${(currentAlpha * 0.25).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="fixed inset-0 pointer-events-none select-none overflow-hidden z-30">
      {/* 1. Cinematic Radial Vignette */}
      <div className="absolute inset-0 cinematic-vignette opacity-70 transition-opacity duration-700" />

      {/* 2. Tactical Scanlines Texture */}
      <div className="absolute inset-0 tactical-scanlines opacity-25 mix-blend-overlay" />

      {/* 3. Ambient Ember Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* 4. Danger Low-HP / Sudden Death Vignette */}
      {isDanger && (
        <div className="absolute inset-0 danger-vignette animate-danger-pulse transition-opacity duration-500" />
      )}

      {/* 5. Smooth Flash Bloom Overlay */}
      {flashColor && (
        <div
          className="absolute inset-0 animate-screen-flash"
          style={{
            background: `radial-gradient(circle at center, ${flashColor} 0%, transparent 80%)`,
          }}
        />
      )}
    </div>
  );
};

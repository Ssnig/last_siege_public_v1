import React, { useEffect, useRef } from 'react';

interface AudioWaveformProps {
  active: boolean;
  color?: string;
  height?: number;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  active,
  color = '#f59e0b',
  height = 48,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);
  const energyRef = useRef<number>(0);

  useEffect(() => {
    if (active) {
      energyRef.current = 1.0;
    }
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;
      const midY = h / 2;

      // Decay energy
      energyRef.current = Math.max(0, energyRef.current - 0.035);
      phaseRef.current += 0.18;

      ctx.beginPath();
      ctx.moveTo(0, midY);

      const points = 40;
      const energy = energyRef.current;

      for (let i = 0; i <= points; i++) {
        const x = (i / points) * w;
        // Central bell curve envelope
        const envelope = Math.sin((i / points) * Math.PI);
        // Multi-frequency wave formula
        const wave =
          Math.sin(i * 0.45 + phaseRef.current) * 0.65 +
          Math.sin(i * 0.85 - phaseRef.current * 1.5) * 0.35;
        const amplitude = (h / 2.2) * (0.08 + energy * 0.92) * envelope;
        const y = midY + wave * amplitude;
        ctx.lineTo(x, y);
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = energy > 0.05 ? 2.5 : 1.2;
      ctx.shadowColor = color;
      ctx.shadowBlur = energy > 0.1 ? 12 : 2;
      ctx.stroke();

      // Mirror reflection line
      ctx.beginPath();
      ctx.moveTo(0, midY);
      for (let i = 0; i <= points; i++) {
        const x = (i / points) * w;
        const envelope = Math.sin((i / points) * Math.PI);
        const wave =
          Math.sin(i * 0.45 + phaseRef.current) * 0.65 +
          Math.sin(i * 0.85 - phaseRef.current * 1.5) * 0.35;
        const amplitude = (h / 2.2) * (0.08 + energy * 0.92) * envelope;
        const y = midY - wave * amplitude * 0.55;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `${color}44`;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      ctx.stroke();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={height}
      className="w-full h-12 bg-slate-950/80 rounded-lg border border-slate-800"
    />
  );
};

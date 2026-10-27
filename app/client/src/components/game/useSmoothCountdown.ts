import { useEffect, useRef, useState } from 'react';

/**
 * Renders a smooth per-second countdown from a server-provided remaining time.
 *
 * @remarks
 * The server streams `phaseEndsAt` roughly 20 times a second (a `float64`
 * decremented every sim tick), so rendering that value directly makes the
 * digits jitter between consecutive seconds as patches land. Decrementing a
 * separate `setInterval` counter instead fights those resyncs — the local
 * timer steps to N-1, the next patch snaps back to `ceil(server)` = N, and the
 * display flickers.
 *
 * This hook instead anchors the latest server value to a monotonic client
 * clock (`performance.now()`) and interpolates from that anchor, re-anchoring
 * on every server update. The displayed second advances smoothly, keeps ticking
 * through a delayed patch, and drift stays bounded to the patch interval.
 *
 * Side effects: runs a `requestAnimationFrame` loop while `running`, but only
 * calls `setState` when the whole-second value actually changes (≈1x/sec), so
 * it does not cause per-frame React renders.
 *
 * @param serverSeconds - Seconds remaining as of the last server push.
 * @param running - When false the clock freezes (e.g. at game over).
 * @returns Whole seconds remaining, clamped at zero.
 */
export function useSmoothCountdown(serverSeconds: number, running = true): number {
  // `atMs` is seeded by the mount effect below (kept out of render so we never
  // call the impure `performance.now()` while rendering).
  const anchor = useRef({ seconds: serverSeconds, atMs: 0 });
  const [display, setDisplay] = useState(() => Math.max(0, Math.ceil(serverSeconds)));

  // Re-anchor whenever the authoritative value changes.
  useEffect(() => {
    anchor.current = { seconds: serverSeconds, atMs: performance.now() };
  }, [serverSeconds]);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const tick = () => {
      const { seconds, atMs } = anchor.current;
      const remaining = Math.max(0, seconds - (performance.now() - atMs) / 1000);
      const next = Math.ceil(remaining);
      setDisplay((prev) => (prev === next ? prev : next));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  return display;
}

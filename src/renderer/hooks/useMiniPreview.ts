import { useEffect, useRef } from 'react';
import { renderSnapshot } from '../lib/snapshot-renderer';

const THROTTLE_MS = 300;

export function useMiniPreview(
  sessionId: string,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  width: number,
  height: number
) {
  const rafRef = useRef<number>(0);
  const lastRenderRef = useRef(0);

  useEffect(() => {
    let running = true;

    const tick = () => {
      if (!running) return;

      const now = performance.now();
      if (now - lastRenderRef.current >= THROTTLE_MS && canvasRef.current) {
        renderSnapshot(sessionId, canvasRef.current, width, height);
        lastRenderRef.current = now;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [sessionId, width, height]);
}

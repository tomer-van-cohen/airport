import { useRef, useEffect, useCallback, type RefObject } from 'react';
import { useTerminalStore } from '../store/terminal-store';
import { TerminalSquareGrid } from './TerminalSquareGrid';

interface WorkspaceContainerProps {
  sidebarWidth: number;
  onClose: (sessionId: string) => void;
  sidebarRef: RefObject<HTMLDivElement | null>;
}

const SNAP_DURATION = 300;
const SNAP_EASING = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
const RUBBER_BAND_FACTOR = 0.3;
const VELOCITY_THRESHOLD = 0.3; // px/ms
const DISTANCE_THRESHOLD = 50; // px — immediate commit once exceeded
const LOCK_RELEASE_DELAY = 50; // ms of silence before unlocking (short — macOS cancels momentum on finger placement)
const GESTURE_END_DELAY = 150; // ms — snap back incomplete gesture after pause
const MIN_LOCK_MS = 80; // minimum lock duration — no acceleration detection during initial momentum burst

export function WorkspaceContainer({ sidebarWidth, onClose, sidebarRef }: WorkspaceContainerProps) {
  const { workspaces, activeWorkspaceId, setActiveWorkspace } = useTerminalStore();
  const stripRef = useRef<HTMLDivElement>(null);

  const gestureRef = useRef({
    active: false,
    committed: false,
    locked: false,
    cumDeltaX: 0,
    velocity: 0,
    lastTimestamp: 0,
    endTimer: null as ReturnType<typeof setTimeout> | null,
    committedSign: 0, // sign of cumDeltaX when committed (for direction reversal detection)
    minAbsDeltaDuringLock: Infinity, // tracks momentum deceleration valley
    lockTime: 0, // timestamp when lock was set
  });

  const activeIndex = workspaces.findIndex((w) => w.id === activeWorkspaceId);
  const baseOffset = -(activeIndex * sidebarWidth);

  // Keep latest values accessible in the wheel handler without re-attaching
  const stateRef = useRef({ activeIndex, sidebarWidth, workspaceCount: workspaces.length, baseOffset });
  stateRef.current = { activeIndex, sidebarWidth, workspaceCount: workspaces.length, baseOffset };

  const setActiveWorkspaceRef = useRef(setActiveWorkspace);
  setActiveWorkspaceRef.current = setActiveWorkspace;

  const workspacesRef = useRef(workspaces);
  workspacesRef.current = workspaces;

  // Apply strip position directly via DOM (no re-render)
  const applyTransform = useCallback((offset: number, animate: boolean) => {
    const strip = stripRef.current;
    if (!strip) return;
    const { baseOffset } = stateRef.current;
    strip.style.transition = animate ? `transform ${SNAP_DURATION}ms ${SNAP_EASING}` : 'none';
    strip.style.transform = `translateX(${baseOffset + offset}px)`;
  }, []);

  // Commit gesture: animate to target workspace, lock, sync store immediately
  const commitGesture = useCallback((direction: -1 | 0 | 1) => {
    const g = gestureRef.current;
    const { activeIndex, sidebarWidth, workspaceCount } = stateRef.current;

    g.committed = true;
    g.locked = true;
    g.lockTime = Date.now();
    g.committedSign = Math.sign(g.cumDeltaX);
    g.minAbsDeltaDuringLock = Infinity;

    let targetIndex = activeIndex;
    if (direction === -1 && activeIndex > 0) targetIndex = activeIndex - 1;
    if (direction === 1 && activeIndex < workspaceCount - 1) targetIndex = activeIndex + 1;

    // Animate strip to target position relative to current base
    const targetOffset = (activeIndex - targetIndex) * sidebarWidth;
    applyTransform(targetOffset, true);

    // Sync store immediately — React re-render updates baseOffset to match
    // where the strip already is, so no visual glitch
    if (targetIndex !== activeIndex) {
      setActiveWorkspaceRef.current(workspacesRef.current[targetIndex].id);
    }
  }, [applyTransform]);

  // Snap back (rubber-band or cancelled gesture)
  const snapBack = useCallback(() => {
    applyTransform(0, true);
  }, [applyTransform]);

  // Snap to base position when activeWorkspaceId changes (keyboard, dot click, or commit)
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const g = gestureRef.current;
    // Reset gesture progress but preserve lock — momentum events still need blocking.
    // Lock releases via endTimer or direction reversal detection.
    g.active = false;
    g.committed = false;
    g.cumDeltaX = 0;
    g.velocity = 0;
    // Animate to new position
    applyTransform(0, true);
  }, [activeWorkspaceId, applyTransform]);

  // Wheel listener on sidebar (covers dots + grid + controls)
  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const handleWheel = (e: WheelEvent) => {
      // Only handle horizontal swipes
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 0.5) return;
      if (Math.abs(e.deltaX) < 2) return;

      e.preventDefault();

      const g = gestureRef.current;
      const now = Date.now();

      // If locked, check if this is a new gesture (not momentum)
      if (g.locked) {
        const eventSign = Math.sign(-e.deltaX);
        const absDelta = Math.abs(e.deltaX);
        const lockAge = now - g.lockTime;

        // Track the momentum valley (minimum |deltaX| seen during lock)
        g.minAbsDeltaDuringLock = Math.min(g.minAbsDeltaDuringLock, absDelta);

        // Direction reversal (back-and-forth) — always instant, regardless of lock age
        const directionReversed = eventSign !== 0 && eventSign !== g.committedSign;

        // Acceleration from valley (same-direction new gesture) —
        // only after MIN_LOCK_MS to avoid momentum jitter during the initial burst.
        // Momentum decelerates monotonically; a new gesture accelerates from the valley.
        // *2 threshold is safe: momentum jitter is ±2-5%, never doubles.
        const accelerating = lockAge >= MIN_LOCK_MS && absDelta >= g.minAbsDeltaDuringLock * 2;

        if (directionReversed || accelerating) {
          // New gesture detected — break lock
          g.locked = false;
          g.committed = false;
          g.active = false;
          g.cumDeltaX = 0;
          g.velocity = 0;
          g.committedSign = 0;
          g.minAbsDeltaDuringLock = Infinity;
          if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
          // Fall through to process as new gesture start below
        } else {
          // Momentum — consume silently, reset release timer
          if (g.endTimer) clearTimeout(g.endTimer);
          g.endTimer = setTimeout(() => {
            g.active = false;
            g.committed = false;
            g.locked = false;
            g.cumDeltaX = 0;
            g.velocity = 0;
            g.committedSign = 0;
            g.minAbsDeltaDuringLock = Infinity;
          }, LOCK_RELEASE_DELAY);
          return;
        }
      }

      // Start new gesture
      if (!g.active) {
        g.active = true;
        g.committed = false;
        g.cumDeltaX = 0;
        g.velocity = 0;
        g.lastTimestamp = 0;
      }

      // Track velocity
      if (g.lastTimestamp > 0) {
        const dt = now - g.lastTimestamp;
        if (dt > 0) {
          g.velocity = -e.deltaX / dt;
        }
      }
      g.lastTimestamp = now;
      g.cumDeltaX += -e.deltaX;

      const { activeIndex, workspaceCount } = stateRef.current;

      // Check if we should commit immediately
      const fastFlick = Math.abs(g.velocity) > VELOCITY_THRESHOLD;
      const distanceExceeded = Math.abs(g.cumDeltaX) > DISTANCE_THRESHOLD;

      if (fastFlick || distanceExceeded) {
        const direction = g.cumDeltaX > 0 ? -1 : 1; // positive cumDelta = swiped right = go to previous
        // Only commit if there's actually a workspace in that direction
        const canGo = (direction === -1 && activeIndex > 0) || (direction === 1 && activeIndex < workspaceCount - 1);
        if (canGo) {
          commitGesture(direction as -1 | 1);
        } else {
          // At edge — snap back with rubber-band release
          snapBack();
          g.committed = true;
          g.locked = true;
          g.lockTime = Date.now();
          g.committedSign = Math.sign(g.cumDeltaX);
          g.minAbsDeltaDuringLock = Infinity;
        }
        // Set end timer to release lock after momentum stops
        if (g.endTimer) clearTimeout(g.endTimer);
        g.endTimer = setTimeout(() => {
          g.active = false;
          g.committed = false;
          g.locked = false;
          g.cumDeltaX = 0;
          g.velocity = 0;
          g.committedSign = 0;
          g.minAbsDeltaDuringLock = Infinity;
        }, LOCK_RELEASE_DELAY);
        return;
      }

      // Not committed yet — update strip position via DOM
      let offset = g.cumDeltaX;
      const atStart = activeIndex === 0 && offset > 0;
      const atEnd = activeIndex === workspaceCount - 1 && offset < 0;
      if (atStart || atEnd) {
        offset = offset * RUBBER_BAND_FACTOR;
      }
      applyTransform(offset, false);

      // Debounce gesture end — if user stops before threshold, snap back
      if (g.endTimer) clearTimeout(g.endTimer);
      g.endTimer = setTimeout(() => {
        if (g.active && !g.committed) {
          snapBack();
          g.active = false;
          g.cumDeltaX = 0;
          g.velocity = 0;
        }
      }, GESTURE_END_DELAY);
    };

    sidebar.addEventListener('wheel', handleWheel, { passive: false });
    return () => sidebar.removeEventListener('wheel', handleWheel);
  }, [sidebarRef, applyTransform, commitGesture, snapBack]);

  return (
    <div
      style={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        ref={stripRef}
        style={{
          display: 'flex',
          height: '100%',
          transform: `translateX(${baseOffset}px)`,
          willChange: 'transform',
        }}
      >
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            style={{
              width: sidebarWidth,
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            <TerminalSquareGrid
              onClose={onClose}
              workspaceId={ws.id}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

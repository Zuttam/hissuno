'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseDraggableOptions {
  /** localStorage key for persisting position */
  storageKey: string;
  /** Default Y position as percentage (0-100) */
  defaultY?: number;
  /** Minimum distance in px before a pointerdown is considered a drag */
  dragThreshold?: number;
  /** Padding from top/bottom viewport edges in px */
  edgePadding?: number;
}

interface UseDraggableReturn {
  /** Current Y position as percentage (0-100) */
  yPercent: number;
  /** Whether user is currently dragging */
  isDragging: boolean;
  /** Pointer event handlers to spread onto the element */
  dragHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
  };
  /** Call in onClick handler - returns true if click should be suppressed (was a drag) */
  shouldSuppressClick: () => boolean;
  /** Ref to attach to the draggable element */
  ref: React.RefObject<HTMLElement | null>;
}

function loadPosition(storageKey: string, defaultY: number): number {
  if (typeof window === 'undefined') return defaultY;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        return parsed;
      }
    }
  } catch {
    // localStorage might be disabled
  }
  return defaultY;
}

function savePosition(storageKey: string, yPercent: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, String(yPercent));
  } catch {
    // Storage might be full or disabled
  }
}

function clampYPercent(percent: number, edgePadding: number): number {
  const viewportHeight = window.innerHeight;
  const minPercent = (edgePadding / viewportHeight) * 100;
  const maxPercent = 100 - minPercent;
  return Math.min(Math.max(percent, minPercent), maxPercent);
}

export function useDraggable({
  storageKey,
  defaultY = 50,
  dragThreshold = 5,
  edgePadding = 20,
}: UseDraggableOptions): UseDraggableReturn {
  const [yPercent, setYPercent] = useState(() => loadPosition(storageKey, defaultY));
  const [isDragging, setIsDragging] = useState(false);

  const ref = useRef<HTMLElement | null>(null);
  const startYRef = useRef(0);
  const startPercentRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const yPercentRef = useRef(yPercent);

  // Keep ref in sync with state for use in event handlers
  useEffect(() => {
    yPercentRef.current = yPercent;
  }, [yPercent]);

  // Re-clamp on window resize
  useEffect(() => {
    const handleResize = () => {
      setYPercent((prev) => clampYPercent(prev, edgePadding));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [edgePadding]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current;
      if (!el) return;

      startYRef.current = e.clientY;
      startPercentRef.current = yPercentRef.current;
      hasDraggedRef.current = false;
      pointerIdRef.current = e.pointerId;

      el.setPointerCapture(e.pointerId);

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaY = moveEvent.clientY - startYRef.current;

        if (!hasDraggedRef.current && Math.abs(deltaY) < dragThreshold) {
          return;
        }

        hasDraggedRef.current = true;
        setIsDragging(true);

        const deltaPercent = (deltaY / window.innerHeight) * 100;
        const newPercent = clampYPercent(startPercentRef.current + deltaPercent, edgePadding);
        setYPercent(newPercent);
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        el.removeEventListener('pointermove', onPointerMove);
        el.removeEventListener('pointerup', onPointerUp);

        if (pointerIdRef.current !== null) {
          try {
            el.releasePointerCapture(pointerIdRef.current);
          } catch {
            // Pointer capture may already be released
          }
        }
        pointerIdRef.current = null;

        if (hasDraggedRef.current) {
          suppressClickRef.current = true;
          savePosition(storageKey, yPercentRef.current);
          setIsDragging(false);
        }

        hasDraggedRef.current = false;
      };

      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', onPointerUp);
    },
    [storageKey, dragThreshold, edgePadding]
  );

  const shouldSuppressClick = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return true;
    }
    return false;
  }, []);

  return {
    yPercent,
    isDragging,
    dragHandlers: { onPointerDown },
    shouldSuppressClick,
    ref,
  };
}

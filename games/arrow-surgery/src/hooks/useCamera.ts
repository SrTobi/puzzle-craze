import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Level, Point } from '../game/types';
import { cameraReturnTarget } from '../game/cameraBounds';
import type { Camera } from '../game/cameraBounds';
interface Pointer {
  x: number;
  y: number;
}
export const MAX_ZOOM = 256;
const clampZoom = (zoom: number) => Math.max(0.45, Math.min(MAX_ZOOM, zoom));

export function useCamera(grid: Level['grid'], reducedMotion: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const current = useRef(camera);
  const pointers = useRef(new Map<number, Pointer>());
  const gesture = useRef({ dragged: false, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const returnFrame = useRef<number | undefined>(undefined);
  const returnTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const update = useCallback((next: Camera) => {
    current.current = next;
    setCamera(next);
  }, []);

  const cancelReturn = useCallback(() => {
    if (returnFrame.current !== undefined) cancelAnimationFrame(returnFrame.current);
    clearTimeout(returnTimer.current);
    returnFrame.current = undefined;
    returnTimer.current = undefined;
  }, []);

  const returnToView = useCallback(() => {
    cancelReturn();
    if (pointers.current.size > 0) return;
    const start = current.current;
    const target = cameraReturnTarget(start, grid, size);
    if (target === start) return;
    if (reducedMotion) {
      update(target);
      return;
    }
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 480);
      if (progress === 1) {
        returnFrame.current = undefined;
        update(target);
        return;
      }
      // Ease out with a small overshoot for a soft spring back into the viewport.
      const t = progress - 1;
      const eased = 1 + 2.70158 * t ** 3 + 1.70158 * t ** 2;
      update({
        ...start,
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
      });
      returnFrame.current = requestAnimationFrame(tick);
    };
    returnFrame.current = requestAnimationFrame(tick);
  }, [cancelReturn, grid, size, reducedMotion, update]);

  const scheduleReturn = useCallback(() => {
    cancelReturn();
    returnTimer.current = setTimeout(returnToView, 150);
  }, [cancelReturn, returnToView]);

  // Recheck after a resize, and clean up scheduled work on unmount.
  useEffect(() => {
    scheduleReturn();
    return cancelReturn;
  }, [scheduleReturn, cancelReturn]);

  const reset = useCallback(() => {
    cancelReturn();
    update({ x: 0, y: 0, zoom: 1 });
  }, [cancelReturn, update]);
  const focusPoint = useCallback(
    (point: Point, center: Point, fit: number) => {
      cancelReturn();
      const zoom = clampZoom(Math.max(current.current.zoom, 0.8 / fit));
      update({
        zoom,
        x: (center[0] - point[0]) * fit * zoom,
        y: (center[1] - point[1]) * fit * zoom,
      });
    },
    [cancelReturn, update],
  );

  const zoomAt = useCallback(
    (factor: number, x = 0, y = 0) => {
      cancelReturn();
      const old = current.current;
      const zoom = clampZoom(old.zoom * factor);
      const ratio = zoom / old.zoom;
      update({ zoom, x: x - (x - old.x) * ratio, y: y - (y - old.y) * ratio });
      scheduleReturn();
    },
    [cancelReturn, scheduleReturn, update],
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const delta =
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      zoomAt(
        Math.exp(-Math.max(-100, Math.min(100, delta)) * 0.004),
        event.clientX - rect.left - rect.width / 2,
        event.clientY - rect.top - rect.height / 2,
      );
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [zoomAt]);

  const onPointerDown = (event: ReactPointerEvent<Element>) => {
    if (event.button !== 0) return;
    cancelReturn();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      gesture.current = {
        dragged: false,
        x: event.clientX,
        y: event.clientY,
      };
    } else gesture.current.dragged = true;
  };

  const onPointerMove = (event: ReactPointerEvent<Element>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const next = { x: event.clientX, y: event.clientY };
    if (Math.hypot(next.x - gesture.current.x, next.y - gesture.current.y) > 6)
      gesture.current.dragged = true;
    if (pointers.current.size === 2) {
      const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)![1];
      const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y);
      const newDistance = Math.hypot(next.x - other.x, next.y - other.y);
      const rect = event.currentTarget.getBoundingClientRect();
      const oldX = (previous.x + other.x) / 2 - rect.left - rect.width / 2;
      const oldY = (previous.y + other.y) / 2 - rect.top - rect.height / 2;
      const newX = (next.x + other.x) / 2 - rect.left - rect.width / 2;
      const newY = (next.y + other.y) / 2 - rect.top - rect.height / 2;
      const old = current.current;
      const zoom = clampZoom((old.zoom * newDistance) / Math.max(oldDistance, 1));
      update({
        zoom,
        x: newX - ((oldX - old.x) * zoom) / old.zoom,
        y: newY - ((oldY - old.y) * zoom) / old.zoom,
      });
    } else if (pointers.current.size === 1 && gesture.current.dragged) {
      const old = current.current;
      update({ ...old, x: old.x + next.x - previous.x, y: old.y + next.y - previous.y });
    }
    if (gesture.current.dragged) setDragging(true);
    pointers.current.set(event.pointerId, next);
  };

  const endPointer = (event: ReactPointerEvent<Element>, cancelled = false): Point | undefined => {
    if (!pointers.current.has(event.pointerId)) return;
    const tap =
      pointers.current.size === 1 &&
      !gesture.current.dragged &&
      !cancelled &&
      Math.hypot(event.clientX - gesture.current.x, event.clientY - gesture.current.y) <= 6;
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (pointers.current.size === 0) {
      setDragging(false);
      returnToView();
    }
    if (tap) return [event.clientX, event.clientY];
  };

  return {
    ref,
    camera,
    size,
    dragging,
    reset,
    focusPoint,
    zoomAt,
    pointerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (event: ReactPointerEvent<Element>) => endPointer(event),
      onPointerCancel: (event: ReactPointerEvent<Element>) => endPointer(event, true),
      onLostPointerCapture: (event: ReactPointerEvent<Element>) => endPointer(event, true),
    },
  };
}

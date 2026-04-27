import { useState, useRef, useEffect, useCallback } from 'react';

interface UseResizableOptions {
  axis: 'x' | 'y';
  direction: 1 | -1;
  minSize: number;
  maxSize: number;
  defaultSize: number;
  storageKey: string;
}

export function useResizable(options: UseResizableOptions) {
  const { axis, direction, minSize, maxSize, defaultSize, storageKey } = options;

  const [size, setSize] = useState<number>(() => {
    const saved = localStorage.getItem(`${storageKey}-size`);
    const parsed = saved ? Number(saved) : NaN;
    return Number.isFinite(parsed) ? Math.min(maxSize, Math.max(minSize, parsed)) : defaultSize;
  });

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const startCoordRef = useRef(0);
  const startSizeRef = useRef(0);
  const sizeRef = useRef(size);

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  const handleStart = useCallback((coord: number) => {
    isDraggingRef.current = true;
    startCoordRef.current = coord;
    startSizeRef.current = sizeRef.current;
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const clientCoord = axis === 'x' ? e.clientX : e.clientY;
      const delta = direction * (clientCoord - startCoordRef.current);
      const newSize = Math.min(maxSize, Math.max(minSize, startSizeRef.current + delta));
      setSize(newSize);
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      setSize((current) => {
        localStorage.setItem(`${storageKey}-size`, String(current));
        return current;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, direction, axis, minSize, maxSize, storageKey]);

  return { size, setSize, isDragging, handleStart };
}

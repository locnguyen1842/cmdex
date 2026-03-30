import React, { useRef, useState, useEffect, useCallback } from 'react';

interface ResizablePanelProps {
  side: 'left' | 'right';
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  storageKey: string;
  collapsedIcon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const ResizablePanel: React.FC<ResizablePanelProps> = ({
  side,
  defaultWidth,
  minWidth,
  maxWidth,
  storageKey,
  collapsedIcon,
  children,
  className,
}) => {
  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem(`${storageKey}-width`);
    return saved ? parseInt(saved, 10) : defaultWidth;
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem(`${storageKey}-collapsed`) === 'true';
  });
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const didDragRef = useRef(false);
  const lastClientXRef = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    lastClientXRef.current = e.clientX;
    startWidthRef.current = width;
    didDragRef.current = false;
    setDragging(true);
  }, [width]);

  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e: MouseEvent) => {
      lastClientXRef.current = e.clientX;
      if (Math.abs(e.clientX - startXRef.current) > 3) {
        didDragRef.current = true;
      }
      const delta = side === 'left'
        ? e.clientX - startXRef.current
        : startXRef.current - e.clientX;
      const next = Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + delta));
      setWidth(next);
    };
    const onMouseUp = () => {
      setDragging(false);
      // Check if user dragged well past min — collapse if width would be < minWidth - 40
      const finalDelta = side === 'left'
        ? (lastClientXRef.current - startXRef.current)
        : (startXRef.current - lastClientXRef.current);
      const rawWidth = startWidthRef.current + finalDelta;
      if (rawWidth < minWidth - 40) {
        setCollapsed(true);
        localStorage.setItem(`${storageKey}-collapsed`, 'true');
        // Restore width to previous so expanding goes back to a usable size
        setWidth(startWidthRef.current);
        localStorage.setItem(`${storageKey}-width`, String(startWidthRef.current));
        return;
      }
      setWidth(prev => {
        localStorage.setItem(`${storageKey}-width`, String(prev));
        return prev;
      });
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, side, minWidth, maxWidth, storageKey]);

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(`${storageKey}-collapsed`, String(next));
      return next;
    });
  };

  if (collapsed) {
    return (
      <div className={`resizable-panel-rail ${side} ${className ?? ''}`}>
        {collapsedIcon}
        <button
          className="rail-expand-btn"
          onClick={toggleCollapse}
          title="Expand panel"
        >
          {side === 'left' ? '▶' : '◀'}
        </button>
      </div>
    );
  }

  const handle = (
    <div
      className={`resize-handle ${side} ${dragging ? 'dragging' : ''}`}
      onMouseDown={onMouseDown}
      onClick={() => { if (!didDragRef.current) toggleCollapse(); }}
      title="Drag to resize · Click to collapse"
    />
  );

  return (
    <div
      className={`resizable-panel ${className ?? ''}`}
      style={{ width, minWidth: width, maxWidth: width }}
    >
      {side === 'right' && handle}
      {children}
      {side === 'left' && handle}
    </div>
  );
};

export default ResizablePanel;

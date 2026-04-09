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
  defaultCollapsed?: boolean;
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
  defaultCollapsed,
}) => {
  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem(`${storageKey}-width`);
    return saved ? parseInt(saved, 10) : defaultWidth;
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem(`${storageKey}-collapsed`);
    return stored ? stored === 'true' : !!defaultCollapsed;
  });
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const widthRef = useRef(width);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined as unknown as ReturnType<typeof setTimeout>);
  useEffect(() => { widthRef.current = width; }, [width]);

  const collapse = useCallback(() => {
    setCollapsed(true);
    localStorage.setItem(`${storageKey}-collapsed`, 'true');
  }, [storageKey]);

  const expand = useCallback(() => {
    setCollapsed(false);
    localStorage.setItem(`${storageKey}-collapsed`, 'false');
  }, [storageKey]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = widthRef.current;
    setDragging(true);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        if (window.innerWidth <= 600) {
          collapse();
        }
      }, 100);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(resizeTimerRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [collapse, storageKey]);

  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e: MouseEvent) => {
      const delta = side === 'left'
        ? e.clientX - startXRef.current
        : startXRef.current - e.clientX;
      const next = Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + delta));
      setWidth(next);
    };
    const onMouseUp = () => {
      setDragging(false);
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

  const handle = (
    <div
      className={`resize-handle-wrap ${side} ${dragging ? 'dragging' : ''}`}
      onMouseDown={onMouseDown}
    >
      <button
        className="resize-collapse-btn"
        onMouseDown={e => e.stopPropagation()}
        onClick={collapse}
        aria-label="Collapse panel"
      >
        {side === 'left' ? '◀' : '▶'}
      </button>
    </div>
  );

  const panelStyle: React.CSSProperties = collapsed
    ? { width: 44, minWidth: 44, maxWidth: 44 }
    : { width, minWidth: width, maxWidth: width };

  return (
    <div
      className={`resizable-panel ${side} ${className ?? ''} ${collapsed ? 'is-collapsed' : ''}`}
      style={panelStyle}
    >
      {collapsed ? (
        <button
          className={`resizable-panel-rail-inner ${side}`}
          onClick={expand}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expand(); } }}
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          {collapsedIcon}
        </button>
      ) : (
        <>
          {side === 'right' && handle}
          {children}
          {side === 'left' && handle}
        </>
      )}
    </div>
  );
};

export default ResizablePanel;

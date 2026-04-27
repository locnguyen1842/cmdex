import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useResizable } from '../hooks/useResizable';

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
  const { size: width, isDragging: dragging, handleStart } = useResizable({
    axis: 'x',
    direction: side === 'left' ? 1 : -1,
    minSize: minWidth,
    maxSize: maxWidth,
    defaultSize: defaultWidth,
    storageKey: `${storageKey}-width`,
  });

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem(`${storageKey}-collapsed`);
    return stored ? stored === 'true' : !!defaultCollapsed;
  });
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
    handleStart(e.clientX);
  }, [handleStart]);

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

  return (
    <div
      className={`resizable-panel ${side} ${collapsed ? 'is-collapsed' : ''} ${dragging ? 'is-resizing' : ''} ${className ?? ''}`}
      style={collapsed
        ? { width: 44, minWidth: 44, maxWidth: 44 }
        : { width, minWidth, maxWidth }
      }
    >
      {collapsed ? (
        <button
          className="resizable-panel-rail-inner"
          onClick={expand}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expand(); } }}
          aria-label="Expand panel"
          title="Click to expand"
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

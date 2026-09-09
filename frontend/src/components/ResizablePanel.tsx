import React, { useRef, useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useResizable } from '../hooks/useResizable';

export interface ResizablePanelApi {
  collapse: () => void;
  expand: () => void;
  collapsed: boolean;
}

const ResizablePanelContext = createContext<ResizablePanelApi | null>(null);

/** Lets a panel's children (e.g. Sidebar's header button) trigger collapse/expand
 *  without ResizablePanel needing to know anything about them. Returns null when
 *  not rendered inside a ResizablePanel. */
export function useResizablePanelApi(): ResizablePanelApi | null {
  return useContext(ResizablePanelContext);
}

interface ResizablePanelProps {
  side: 'left' | 'right';
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  storageKey: string;
  collapsedIcon: React.ReactNode;
  /** Full rail UI for the collapsed state. When set it replaces the single
   *  expand button built around `collapsedIcon`; it renders inside the panel
   *  context so it can call `useResizablePanelApi().expand()`. */
  collapsedContent?: React.ReactNode;
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
  collapsedContent,
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

  const panelApi: ResizablePanelApi = { collapse, expand, collapsed };

  return (
    <div
      className={`resizable-panel ${side} ${collapsed ? 'is-collapsed' : ''} ${dragging ? 'is-resizing' : ''} ${className ?? ''}`}
      style={collapsed
        ? { width: 48, minWidth: 48, maxWidth: 48 }
        : { width, minWidth, maxWidth }
      }
    >
      {collapsed && collapsedContent ? (
        <ResizablePanelContext.Provider value={panelApi}>
          {collapsedContent}
        </ResizablePanelContext.Provider>
      ) : collapsed ? (
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
        <ResizablePanelContext.Provider value={panelApi}>
          {side === 'right' && handle}
          {children}
          {side === 'left' && handle}
        </ResizablePanelContext.Provider>
      )}
    </div>
  );
};

export default ResizablePanel;

import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExecutionRecord } from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';

const STDERR_PREFIX = '\x1b[stderr]';
const MAX_DISPLAY_LINES = 100;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 200;
const STORAGE_KEY = 'cmdex-output-height';

interface OutputPaneProps {
  record: ExecutionRecord | null;
  streamLines: string[];
  isExecuting: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

const OutputPane: React.FC<OutputPaneProps> = ({ record, streamLines, isExecuting, isOpen, onToggle }) => {
  const { t } = useTranslation();
  const bodyRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const [height, setHeight] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? Number(saved) : NaN;
    return Number.isFinite(parsed) ? Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, parsed)) : DEFAULT_HEIGHT;
  });
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const heightRef = useRef(height);
  useEffect(() => { heightRef.current = height; }, [height]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = heightRef.current;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = startYRef.current - ev.clientY; // drag up = increase height
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeightRef.current + delta));
      setHeight(newHeight);
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      setHeight((h) => {
        localStorage.setItem(STORAGE_KEY, String(h));
        return h;
      });
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const handleScroll = () => {
    if (!bodyRef.current) return;
    const el = bodyRef.current;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    autoScrollRef.current = atBottom;
  };

  useEffect(() => {
    if (autoScrollRef.current && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [streamLines]);

  const displayLines = useMemo(() => {
    if (streamLines.length > MAX_DISPLAY_LINES) {
      return streamLines.slice(streamLines.length - MAX_DISPLAY_LINES);
    }
    return streamLines;
  }, [streamLines]);

  const isStreaming = isExecuting && streamLines.length > 0;
  const showRecord = record && !isStreaming;

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle} className="output-pane">
      {isOpen && (
        <div className="output-resize-handle" onMouseDown={handleResizeStart} />
      )}
      <div className="output-pane-header" onClick={onToggle}>
        <div className="output-pane-title">
          <span className="terminal-dots">
            <span className="terminal-dot" style={{ background: '#ff5f56' }} />
            <span className="terminal-dot" style={{ background: '#ffbd2e' }} />
            <span className="terminal-dot" style={{ background: '#27c93f' }} />
          </span>
          {t('outputPane.title')}
          {isStreaming && (
            <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4 animate-pulse">
              {t('outputPane.streaming')}
            </Badge>
          )}
          {showRecord && (
            <Badge
              variant={record.exitCode === 0 ? 'success' : 'destructive'}
              className="ml-2 text-[10px] px-1.5 py-0 h-4"
            >
              {t('outputPane.exit', { code: record.exitCode })}
            </Badge>
          )}
          {streamLines.length > MAX_DISPLAY_LINES && (
            <span className="text-[10px] text-muted-foreground ml-2">
              ({t('outputPane.showingLast', { count: MAX_DISPLAY_LINES })})
            </span>
          )}
        </div>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={isOpen ? t("outputPane.collapse") : t("outputPane.expand")}
            aria-expanded={isOpen}
            onClick={(e) => { e.stopPropagation(); }}
          >
            {isOpen ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div
          className="output-pane-body"
          ref={bodyRef}
          onScroll={handleScroll}
          style={{ height: height }}
        >
          {isExecuting && streamLines.length === 0 && !record && (
            <div className="output-line">
              <span className="output-cursor" />
            </div>
          )}

          {(isStreaming || (isExecuting && streamLines.length > 0)) && (
            <>
              {displayLines.map((line, i) => {
                const isErr = line.startsWith(STDERR_PREFIX);
                const text = isErr ? line.slice(STDERR_PREFIX.length) : line;
                return (
                  <div key={i} className={`output-line${isErr ? ' output-error' : ''}`}>
                    {text}
                  </div>
                );
              })}
              {isExecuting && <span className="output-cursor" />}
            </>
          )}

          {showRecord && (
            <>
              <div className="output-cmd">$ {record.finalCmd}</div>
              {record.output && <div className="output-line">{record.output}</div>}
              {record.error && <div className="output-line output-error">{record.error}</div>}
              {record.exitCode !== 0 && (
                <div className="output-line output-error">
                  {t('outputPane.processExited', { code: record.exitCode })}
                </div>
              )}
            </>
          )}

          {!isExecuting && !record && streamLines.length === 0 && (
            <div className="output-empty">{t('outputPane.emptyState')}</div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default OutputPane;

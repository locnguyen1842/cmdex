import React, { useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ExecutionRecord } from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';

const STDERR_PREFIX = '\x1b[stderr]';
const MAX_DISPLAY_LINES = 100;

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
          <Button variant="ghost" size="icon-xs" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
            {isOpen ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="output-pane-body" ref={bodyRef} onScroll={handleScroll}>
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

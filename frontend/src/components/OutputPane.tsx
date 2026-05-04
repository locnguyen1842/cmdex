import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type ExecutionRecord } from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { ShortcutLabel } from './ui/kbd';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { useResizable } from '../hooks/useResizable';

const STDERR_PREFIX = '\x1b[stderr]';
const MAX_DISPLAY_LINES = 100;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 200;
const STORAGE_KEY = 'cmdex-output-height';

function formatTime(isoStr: string, locale?: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString(locale || undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

function shortenDir(dir: string): string {
  if (!dir) return '~';
  const home = dir.match(/^\/Users\/[^/]+|^\/home\/[^/]+|^C:\\Users\\[^\\]+/)?.[0];
  if (home && dir.startsWith(home)) {
    return '~' + dir.slice(home.length);
  }
  return dir;
}

interface OutputPaneProps {
  record: ExecutionRecord | null;
  streamLines: string[];
  isExecuting: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

const OutputPane: React.FC<OutputPaneProps> = ({ record, streamLines, isExecuting, isOpen, onToggle }) => {
  const { t, i18n: i18nInstance } = useTranslation();
  const bodyRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const { copied: copiedOutput, copy: copyOutput } = useCopyToClipboard();
  const { copied: copiedCommand, copy: copyCommand } = useCopyToClipboard();
  const { size: height, handleStart } = useResizable({
    axis: 'y',
    direction: -1,
    minSize: MIN_HEIGHT,
    maxSize: MAX_HEIGHT,
    defaultSize: DEFAULT_HEIGHT,
    storageKey: STORAGE_KEY,
  });

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientY);
  }, [handleStart]);

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

  const allOutputText = useMemo(() => {
    if (isStreaming) {
      return streamLines.map((l) => l.startsWith(STDERR_PREFIX) ? l.slice(STDERR_PREFIX.length) : l).join('');
    }
    if (showRecord) {
      const parts: string[] = [];
      if (record.output) parts.push(record.output);
      if (record.error) parts.push(record.error);
      return parts.join('\n');
    }
    return '';
  }, [streamLines, record, isStreaming, showRecord]);

  const handleCopy = useCallback(() => {
    if (!allOutputText) return;
    copyOutput(allOutputText).catch(() => {
      toast.error(t('outputPane.copyFailed'));
    });
  }, [allOutputText, copyOutput, t]);

  const handleCopyCommand = useCallback(() => {
    if (!record?.finalCmd) return;
    copyCommand(record.finalCmd).catch(() => {
      toast.error(t('outputPane.copyFailed'));
    });
  }, [record, copyCommand, t]);

  const cmdPrefix = useMemo(() => {
    if (!showRecord) return null;
    const time = formatTime(record.executedAt, i18nInstance.language);
    const dir = shortenDir(record.workingDir || '');
    return `[${time}] ${dir} ➤ `;
  }, [showRecord, record, i18nInstance.language]);

  return (
    <Collapsible open={isOpen} className="output-pane" data-testid="output-pane">
      {isOpen && (
        <div className="output-resize-handle" onMouseDown={handleResizeStart} />
      )}
      <div className="output-pane-header">
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="output-collapse-btn"
              aria-label={isOpen ? t("outputPane.collapse") : t("outputPane.expand")}
              aria-expanded={isOpen}
              onClick={onToggle}
            >
              {isOpen ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('outputPane.toggleShortcut')} <ShortcutLabel id="toggleOutput" /></TooltipContent>
        </Tooltip>
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
                const isLast = i === displayLines.length - 1;
                return (
                  <div key={i} className={`output-line${isErr ? ' output-error' : ''}`}>
                    {text}
                    {isLast && (
                      <button type="button" className="output-copy-inline ml-0!" onClick={handleCopy}>
                        {copiedOutput ? <Check className="size-3 text-success mr-2" /> : <Copy className="size-3 mr-2" />}
                        {t('outputPane.copyOutput')}
                      </button>
                    )}
                  </div>
                );
              })}
              {isExecuting && <span className="output-cursor" />}
            </>
          )}

          {showRecord && (
            <>
              <div className="output-cmd">
                <span className="output-cmd-prefix">{cmdPrefix}</span>
                {record.finalCmd}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="output-copy-inline output-copy-cmd"
                      onClick={handleCopyCommand}
                      aria-label={t('outputPane.copyCommand')}
                    >
                      {copiedCommand ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('outputPane.copyCommand')}</TooltipContent>
                </Tooltip>
              </div>
              {/* Show output lines or empty state */}
              {record.output ? (
                record.output.split('\n').map((line, i, arr) => {
                  const isLast = i === arr.length - 1 && !record.error;
                  return (
                    <div key={`o-${i}`} className="output-line">
                      {line}
                      {isLast && (
                        <button type="button" className="output-copy-inline ml-0!" onClick={handleCopy}>
                          {copiedOutput ? <Check className="size-3 text-success mr-2" /> : <Copy className="size-3 mr-2" />}
                          {t('outputPane.copyOutput')}
                        </button>
                      )}
                    </div>
                  );
                })
              ) : !record.error ? (
                <div className="output-empty-response">{t('outputPane.emptyResponse')}</div>
              ) : null}
              {record.error && record.error.split('\n').map((line, i, arr) => {
                const isLast = i === arr.length - 1;
                return (
                  <div key={`e-${i}`} className="output-line output-error">
                    {line}
                    {isLast && (
                      <button type="button" className="output-copy-inline ml-0!" onClick={handleCopy}>
                        {copiedOutput ? <Check className="size-3 text-success mr-2" /> :  <Copy className="size-3 mr-2" />}
                        {t('outputPane.copyOutput')}
                      </button>
                    )}
                  </div>
                );
              })}
              {record.exitCode !== 0 && !record.error && (
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

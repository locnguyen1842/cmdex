import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExecutionRecord } from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Trash2, History } from 'lucide-react';
import ResizablePanel from './ResizablePanel';

interface HistoryPaneProps {
  records: ExecutionRecord[];
  selectedRecordId: string | null;
  onSelectRecord: (record: ExecutionRecord) => void;
  onClearHistory: () => void;
  defaultCollapsed?: boolean;
}

const HistoryPane: React.FC<HistoryPaneProps> = ({
  records,
  selectedRecordId,
  onSelectRecord,
  onClearHistory,
  defaultCollapsed,
}) => {
  const { t } = useTranslation();

  const formatTime = (dateStr: string): string => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return t('historyPane.justNow');
    if (diffMin < 60) return t('historyPane.minutesAgo', { count: diffMin });
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return t('historyPane.hoursAgo', { count: diffHr });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <ResizablePanel
      side="right"
      defaultWidth={220}
      minWidth={160}
      maxWidth={400}
      storageKey="cmdex-history"
      collapsedIcon={<History className="size-5 text-muted-foreground" />}
      defaultCollapsed={defaultCollapsed}
    >
      <div className="history-pane">
        <div className="history-pane-header">
          <span className="history-pane-title">{t('historyPane.title')}</span>
          {records.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-xs" onClick={onClearHistory}>
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('historyPane.clearHistory')}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <ScrollArea className="flex-1">
          {records.length === 0 ? (
            <div className="history-empty">{t('historyPane.noExecutions')}</div>
          ) : (
            records.map((rec) => (
              <div
                key={rec.id}
                className={`history-item ${selectedRecordId === rec.id ? 'active' : ''}`}
                onClick={() => onSelectRecord(rec)}
              >
                <div className="history-item-top">
                  <span className="history-item-cmd">{rec.finalCmd}</span>
                  <Badge variant={rec.exitCode === 0 ? 'success' : 'destructive'} className="text-[10px] px-1.5 py-0 h-4">
                    {rec.exitCode}
                  </Badge>
                </div>
                <div className="history-item-time">{formatTime(rec.executedAt)}</div>
              </div>
            ))
          )}
        </ScrollArea>
      </div>
    </ResizablePanel>
  );
};

export default HistoryPane;

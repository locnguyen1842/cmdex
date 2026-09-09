import React from 'react';
import { useTranslation } from 'react-i18next';
import { PanelLeftOpen, Plus, Search, Settings } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useResizablePanelApi } from './ResizablePanel';
import BrandMark from './BrandMark';

interface SidebarRailProps {
  onNewCommand: () => void;
  onOpenPalette: () => void;
  onOpenSettings: () => void;
}

interface RailButtonProps {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}

function RailButton({ label, onClick, children, testId }: RailButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="sidebar-rail-btn" onClick={onClick} aria-label={label} data-testid={testId}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The collapsed sidebar: a narrow rail that keeps the brand mark and the
 * actions worth reaching without the full list (new command, search,
 * settings), with an expand control at the bottom.
 */
const SidebarRail: React.FC<SidebarRailProps> = ({ onNewCommand, onOpenPalette, onOpenSettings }) => {
  const { t } = useTranslation();
  const panel = useResizablePanelApi();
  const expand = () => panel?.expand();

  return (
    <div className="sidebar-rail" data-testid="sidebar-rail">
      <button
        type="button"
        className="sidebar-rail-brand"
        onClick={expand}
        aria-label={t('sidebar.expandSidebar')}
        title={t('sidebar.expandSidebar')}
      >
        <BrandMark size={22} />
      </button>
      <div className="sidebar-rail-actions">
        <RailButton label={t('sidebar.newCommand')} onClick={onNewCommand} testId="sidebar-rail-add-command">
          <Plus size={16} strokeWidth={1.8} />
        </RailButton>
        <RailButton label={t('sidebar.tabBar.openPalette')} onClick={onOpenPalette}>
          <Search size={15} strokeWidth={1.8} />
        </RailButton>
        <RailButton label={t('sidebar.settings')} onClick={onOpenSettings} testId="sidebar-rail-settings">
          <Settings size={15} strokeWidth={1.8} />
        </RailButton>
      </div>
      <div className="sidebar-rail-foot">
        <RailButton label={t('sidebar.expandSidebar')} onClick={expand}>
          <PanelLeftOpen size={15} strokeWidth={1.8} />
        </RailButton>
      </div>
    </div>
  );
};

export default SidebarRail;

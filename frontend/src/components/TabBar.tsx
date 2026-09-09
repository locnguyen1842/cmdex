import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Home, Plus, Search, PanelBottom } from 'lucide-react';

export interface Tab {
  id: string;
  title: string;
  isDirty?: boolean;
}

/** Matches App.tsx's literal welcome-tab id (see utils/tab.ts). Kept as a local
 *  constant rather than an import so this component has no dependency beyond
 *  the `tabs` prop it's handed. */
const WELCOME_TAB_ID = '__welcome__';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  /** Opens a new blank command tab. Renders the trailing "+" button when set. */
  onNewTab?: () => void;
  /** Opens the command palette (Cmd/Ctrl+P). Renders a search icon-button when set. */
  onOpenPalette?: () => void;
  /** Toggles the terminal panel's collapsed state. Renders a panel icon-button when set. */
  onToggleTerminal?: () => void;
  /** Whether the terminal panel is currently visible — reflected via aria-pressed. */
  terminalVisible?: boolean;
}

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onOpenPalette,
  onToggleTerminal,
  terminalVisible,
}) => {
  const { t } = useTranslation();
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeTabId]);

  if (tabs.length === 0) return null;

  return (
    <div className="tab-bar" data-testid="tab-bar">
      <div className="tab-scroll">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isWelcome = tab.id === WELCOME_TAB_ID;
          return (
            <div
              key={tab.id}
              ref={isActive ? activeRef : null}
              className={`tab-item${isActive ? ' active' : ''}`}
              data-testid={`tab-${tab.id}`}
              onClick={() => onSelectTab(tab.id)}
            >
              {isWelcome ? (
                <Home size={13} className="tab-home-icon" />
              ) : (
                tab.isDirty && (
                  <span className="tab-dirty-dot" title="Unsaved changes" data-testid={`tab-dirty-dot-${tab.id}`} />
                )
              )}
              <span className="tab-title" title={tab.title}>{tab.title}</span>
              <span
                className="tab-close"
                role="button"
                aria-label="Close tab"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
              >
                <X size={12} />
              </span>
            </div>
          );
        })}
        {onNewTab && (
          <button
            type="button"
            className="tab-add"
            onClick={onNewTab}
            aria-label={t('sidebar.tabBar.newTab')}
            title={t('sidebar.tabBar.newTab')}
          >
            <Plus size={13} />
          </button>
        )}
      </div>

      {(onOpenPalette || onToggleTerminal) && (
        <div className="tabbar-actions">
          {onOpenPalette && (
            <button
              type="button"
              className="icon-btn"
              onClick={onOpenPalette}
              aria-label={t('sidebar.tabBar.openPalette')}
              title={t('sidebar.tabBar.openPalette')}
            >
              <Search size={14} />
            </button>
          )}
          {onToggleTerminal && (
            <button
              type="button"
              className="icon-btn"
              onClick={onToggleTerminal}
              aria-label={t('sidebar.tabBar.toggleTerminal')}
              title={t('sidebar.tabBar.toggleTerminal')}
              aria-pressed={terminalVisible}
            >
              <PanelBottom size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TabBar;

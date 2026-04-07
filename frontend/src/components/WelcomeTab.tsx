import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { SHORTCUTS, shortcutLabel } from '@/lib/shortcuts';

interface WelcomeTabProps {
  onNewCommand: () => void;
}

const WelcomeTab: React.FC<WelcomeTabProps> = ({ onNewCommand }) => {
  const { t } = useTranslation();

  const shortcuts = [
    { keys: `${shortcutLabel('newTab')} / ${shortcutLabel('newCommand')}`, descKey: 'welcome.shortcutNewTab' },
    { keys: shortcutLabel('palette'), descKey: 'welcome.shortcutPalette' },
    { keys: shortcutLabel('search'), descKey: 'welcome.shortcutSearch' },
    { keys: shortcutLabel('execute'), descKey: 'welcome.shortcutRun' },
    { keys: shortcutLabel('save'), descKey: 'welcome.shortcutSave' },
    { keys: shortcutLabel('switchTab'), descKey: 'welcome.shortcutSwitchTab' },
    { keys: shortcutLabel('prevOpenedTab'), descKey: 'welcome.shortcutPrevOpenedTab' },
    { keys: shortcutLabel('lastTab'), descKey: 'welcome.shortcutLastTab' },
    { keys: shortcutLabel('settings'), descKey: 'welcome.shortcutSettings' },
    { keys: shortcutLabel('closeTab'), descKey: 'welcome.shortcutCloseTab' },
  ];

  return (
    <div className="welcome-tab">
      <div className="welcome-tab-inner">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="64" height="64" aria-hidden="true" focusable="false">
          <rect width="1024" height="1024" rx="180" ry="180" fill="currentColor" fillOpacity="0.05" />
          <text x="240" y="620" fontFamily="SF Mono, Menlo, Monaco, Consolas, monospace" fontSize="480" fontWeight="800" fill="currentColor" letterSpacing="-20">C</text>
          <text x="530" y="620" fontFamily="SF Mono, Menlo, Monaco, Consolas, monospace" fontSize="320" fontWeight="700" fill="var(--primary)">&gt;_</text>
        </svg>
        <h2 className="welcome-tab-title">{t('welcome.title')}</h2>
        <p className="welcome-tab-subtitle">{t('welcome.subtitle')}</p>

        <div className="welcome-shortcuts-card">
          <div className="welcome-shortcuts-title">{t('common.keyboardShortcuts')}</div>
          {shortcuts.map((s) => (
            <div key={s.descKey} className="welcome-shortcut-row">
              <span className="welcome-shortcut-desc">{t(s.descKey)}</span>
              <Kbd>{s.keys}</Kbd>
            </div>
          ))}
        </div>

        <Button className="mt-4" onClick={onNewCommand}>
          {t('welcome.newCommand')}
        </Button>
      </div>
    </div>
  );
};

export default WelcomeTab;

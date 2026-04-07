import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { isMac, cmdSymbol as cmd } from '../hooks/useKeyboardShortcuts';

interface WelcomeTabProps {
  onNewCommand: () => void;
}

const WelcomeTab: React.FC<WelcomeTabProps> = ({ onNewCommand }) => {
  const { t } = useTranslation();

  const shortcuts = [
    { keys: `${cmd}T / ${cmd}N`, descKey: 'welcome.shortcutNewTab' },
    { keys: `${cmd}P`, descKey: 'welcome.shortcutPalette' },
    { keys: `${cmd}F`, descKey: 'welcome.shortcutSearch' },
    { keys: `${cmd}↩`, descKey: 'welcome.shortcutRun' },
    { keys: `${cmd}S`, descKey: 'welcome.shortcutSave' },
    { keys: `${cmd}1-6`, descKey: 'welcome.shortcutSwitchTab' },
    { keys: `${cmd}0`, descKey: 'welcome.shortcutLastTab' },
    { keys: `${cmd},`, descKey: 'welcome.shortcutSettings' },
    { keys: isMac ? '⌘W' : 'Ctrl+W', descKey: 'welcome.shortcutCloseTab' },
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
          <div className="welcome-shortcuts-title">{t('welcome.shortcutsTitle')}</div>
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

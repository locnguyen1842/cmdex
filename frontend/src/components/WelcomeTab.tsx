import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { SHORTCUTS, shortcutLabel } from '@/lib/shortcuts';
import { MainLogo } from '@/assets/images/main-logo';

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
        <MainLogo width="64" height="64" />
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

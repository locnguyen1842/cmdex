import React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Upload, Keyboard, Terminal } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { shortcutLabel } from '@/lib/shortcuts';
import BrandMark from './BrandMark';
import { ImportCommands } from '../../bindings/cmdex/importexportservice';

interface WelcomeTabProps {
  onNewCommand: () => void;
  /** Refreshes categories/commands after a successful import (same contract as Sidebar's onImport). */
  onImport?: () => void;
  onShowShortcuts?: () => void;
}

const WelcomeTab: React.FC<WelcomeTabProps> = ({ onNewCommand, onImport, onShowShortcuts }) => {
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

  const handleImport = async () => {
    try {
      const imported = await ImportCommands();
      if (imported && imported.length > 0) onImport?.();
    } catch (e) {
      console.error('Import failed:', e);
      toast.error(t('toast.importFailed'));
    }
  };

  return (
    <div className="welcome-tab">
      <div className="welcome-tab-inner">
        <BrandMark size={56} className="welcome-tab-mark" />
        <h2 className="welcome-tab-title">{t('welcome.title')}</h2>
        <p className="welcome-tab-subtitle">{t('welcome.subtitle')}</p>

        <div className="welcome-quick-actions">
          <button type="button" className="welcome-qa" onClick={onNewCommand}>
            <Plus className="welcome-qa-icon" size={20} strokeWidth={1.8} />
            <div className="welcome-qa-title">{t('welcome.qaNewCommandTitle')}</div>
            <div className="welcome-qa-sub">{t('welcome.qaNewCommandSub')}</div>
          </button>
          <button type="button" className="welcome-qa" onClick={handleImport}>
            <Upload className="welcome-qa-icon" size={20} strokeWidth={1.8} />
            <div className="welcome-qa-title">{t('welcome.qaImportTitle')}</div>
            <div className="welcome-qa-sub">{t('welcome.qaImportSub')}</div>
          </button>
          <button
            type="button"
            className="welcome-qa"
            onClick={onShowShortcuts}
            disabled={!onShowShortcuts}
          >
            <Keyboard className="welcome-qa-icon" size={20} strokeWidth={1.8} />
            <div className="welcome-qa-title">{t('welcome.qaShortcutsTitle')}</div>
            <div className="welcome-qa-sub">{t('welcome.qaShortcutsSub')}</div>
          </button>
        </div>

        <div className="welcome-list-label">{t('common.keyboardShortcuts')}</div>
        <div className="welcome-list">
          {shortcuts.map((s) => (
            <div key={s.descKey} className="welcome-list-row">
              <Terminal className="welcome-list-row-icon" size={13} strokeWidth={1.8} />
              <span className="welcome-list-row-desc">{t(s.descKey)}</span>
              <Kbd>{s.keys}</Kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WelcomeTab;

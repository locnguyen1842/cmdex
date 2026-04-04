import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SetSettings, GetSettings, GetAvailableTerminals } from '../../wailsjs/go/main/App';
import { TerminalInfo } from '../types';
import { toast } from 'sonner';
import { THEMES } from '../App';

const LANGUAGES = [
  { code: 'en', label: 'English' },
];

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  theme: string;
  onThemeChange: (theme: string) => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose, theme, onThemeChange }) => {
  const { t, i18n } = useTranslation();
  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [savedLocale, setSavedLocale] = useState('en');
  const [savedTerminal, setSavedTerminal] = useState('');
  const [locale, setLocale] = useState('en');
  const [terminal, setTerminal] = useState('');

  useEffect(() => {
    if (!open) return;
    GetAvailableTerminals()
      .then(t => setTerminals(t || []))
      .catch(() => setTerminals([]));
    GetSettings()
      .then(s => {
        const loc = s?.locale || i18n.language || 'en';
        const term = s?.terminal || '';
        setSavedLocale(loc);
        setSavedTerminal(term);
        setLocale(loc);
        setTerminal(term);
      })
      .catch(() => {});
  }, [open]);

  const isDirty = locale !== savedLocale || terminal !== savedTerminal;

  const handleSave = useCallback(async () => {
    try {
      await i18n.changeLanguage(locale);
      await SetSettings(locale, terminal);
      setSavedLocale(locale);
      setSavedTerminal(terminal);
      toast.success(t('settings.title'));
    } catch (err) {
      console.error('Failed to persist settings:', err);
    }
  }, [locale, terminal, i18n, t]);

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) {
        setLocale(savedLocale);
        setTerminal(savedTerminal);
        onClose();
      }
    }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('settings.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select value={theme} onValueChange={onThemeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEMES.map(th => (
                  <SelectItem key={th.id} value={th.id}>{th.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('settings.language')}</Label>
            <Select value={locale} onValueChange={setLocale}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(lang => (
                  <SelectItem key={lang.code} value={lang.code}>{lang.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('settings.terminal')}</Label>
            <Select value={terminal || '__auto__'} onValueChange={(v) => setTerminal(v === '__auto__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__auto__">
                  <span className="italic opacity-70">{t('settings.terminalAuto')}</span>
                </SelectItem>
                {terminals.map(term => (
                  <SelectItem key={term.id} value={term.id}>{term.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { setLocale(savedLocale); setTerminal(savedTerminal); onClose(); }}>
            {t('settings.close')}
          </Button>
          <Button disabled={!isDirty} onClick={handleSave}>
            {t('settings.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;

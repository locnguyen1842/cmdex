import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Upload, Download, X } from 'lucide-react';
import { SetSettings, GetSettings, GetAvailableTerminals, SaveThemeTemplate } from '../../wailsjs/go/main/App';
import { TerminalInfo } from '../types';
import { toast } from 'sonner';
import { THEMES, CustomTheme } from '../App';

const LANGUAGES = [
  { code: 'en', label: 'English' },
];

const UI_FONTS = [
  { id: 'Inter', label: 'Inter', fontFamily: "'Inter', system-ui, sans-serif" },
  { id: 'Geist', label: 'Geist', fontFamily: "'Geist', system-ui, sans-serif" },
  { id: 'Nunito', label: 'Nunito', fontFamily: "'Nunito', system-ui, sans-serif" },
  { id: 'System Default', label: 'System Default', fontFamily: 'system-ui, -apple-system, sans-serif' },
] as const;

const MONO_FONTS = [
  { id: 'JetBrains Mono', label: 'JetBrains Mono', fontFamily: "'JetBrains Mono', monospace" },
  { id: 'Fira Code', label: 'Fira Code', fontFamily: "'Fira Code', monospace" },
  { id: 'Cascadia Code', label: 'Cascadia Code', fontFamily: "'Cascadia Code', monospace" },
  { id: 'Monaspace Neon', label: 'Monaspace Neon', fontFamily: "'Monaspace Neon', monospace" },
] as const;

// Color dots per built-in theme: [bg, card, primary, fg]
const THEME_DOTS: Record<string, [string, string, string, string]> = {
  'vscode-dark':        ['#1e1e1e', '#252526', '#007acc', '#d4d4d4'],
  'vscode-light':       ['#ffffff', '#f3f3f3', '#0078d4', '#1f1f1f'],
  'monokai':            ['#272822', '#2d2e27', '#a6e22e', '#f8f8f2'],
  'tokyo-night':        ['#1a1b26', '#16161e', '#7aa2f7', '#a9b1d6'],
  'one-dark':           ['#282c34', '#21252b', '#61afef', '#abb2bf'],
  'classic':            ['#0f0f14', '#16161e', '#7c6aef', '#e8e8f0'],
  'catppuccin-mocha':   ['#1e1e2e', '#181825', '#cba6f7', '#cdd6f4'],
  'dracula':            ['#282a36', '#21222c', '#bd93f9', '#f8f8f2'],
};

interface ThemeSwatchProps {
  id: string;
  label: string;
  themeType: 'dark' | 'light';
  dots: [string, string, string, string];
  selected: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}

function ThemeSwatch({ label, themeType, dots, selected, onSelect, onRemove }: ThemeSwatchProps) {
  return (
    <button
      type="button"
      role="button"
      aria-label={`${label} theme, ${themeType}`}
      aria-pressed={selected}
      onClick={onSelect}
      className={[
        'relative flex flex-col p-2 rounded-md border text-left transition-colors duration-150 w-full',
        selected
          ? 'ring-2 ring-primary ring-offset-1 border-primary'
          : 'border-border bg-card hover:border-primary/50 hover:bg-accent/30',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {dots.map((color, i) => (
            <span
              key={i}
              className="w-3 h-3 rounded-full inline-block flex-shrink-0"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <span className="text-[10px] leading-none text-muted-foreground ml-1">
          {themeType === 'dark' ? '🌙' : '☀️'}
        </span>
      </div>
      <span className="text-[11px] mt-1 truncate leading-[1.3] pr-4">{label}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${label} theme`}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute bottom-2 right-2 text-[14px] leading-none text-muted-foreground hover:text-destructive transition-colors"
        >
          <X size={12} />
        </button>
      )}
    </button>
  );
}

interface FontPickerCardProps {
  fontFamily: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}

function FontPickerCard({ fontFamily, label, selected, onSelect }: FontPickerCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={[
        'flex flex-col p-2 rounded-md border text-left transition-colors duration-150 w-full min-h-[56px]',
        selected
          ? 'ring-2 ring-primary ring-offset-1 ring-offset-background border-primary'
          : 'border-border bg-card hover:border-primary/50 hover:bg-accent/30',
      ].join(' ')}
    >
      <span style={{ fontFamily }} className="text-sm font-medium truncate leading-[1.4]">{label}</span>
      <span style={{ fontFamily }} className="text-[11px] text-muted-foreground mt-0.5 leading-[1.3]">
        ABC abc 012
      </span>
    </button>
  );
}

interface CustomFontCardProps {
  value: string;
  onChange: (v: string) => void;
  selected: boolean;
}

function CustomFontCard({ value, onChange, selected }: CustomFontCardProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(v.trim());
    }, 300);
  };

  return (
    <div
      className={[
        'flex flex-col p-2 rounded-md border text-left min-h-[56px]',
        selected && value.trim()
          ? 'ring-2 ring-primary ring-offset-1 ring-offset-background border-primary'
          : 'border-border bg-card',
      ].join(' ')}
    >
      <span className="text-[11px] text-muted-foreground mb-1 leading-[1.3]">Custom</span>
      <input
        type="text"
        defaultValue={value}
        placeholder="Custom font name…"
        onChange={handleChange}
        className="bg-transparent text-sm w-full outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  );
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  theme: string;
  onThemeChange: (theme: string) => void;
  onResetAllData?: () => Promise<void>;
  customThemes?: CustomTheme[];
  onImportTheme?: (theme: CustomTheme) => void;
  onRemoveCustomTheme?: (themeId: string) => void;
  // Phase 4 additions
  uiFont?: string;
  monoFont?: string;
  density?: string;
  onUiFontChange?: (font: string) => void;
  onMonoFontChange?: (font: string) => void;
  onDensityChange?: (density: string) => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onClose,
  theme,
  onThemeChange,
  onResetAllData,
  customThemes,
  onImportTheme,
  onRemoveCustomTheme,
  uiFont = 'Inter',
  monoFont = 'JetBrains Mono',
  density = 'comfortable',
  onUiFontChange,
  onMonoFontChange,
  onDensityChange,
}) => {
  const { t, i18n } = useTranslation();
  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [savedLocale, setSavedLocale] = useState('en');
  const [savedTerminal, setSavedTerminal] = useState('');
  const [locale, setLocale] = useState('en');
  const [terminal, setTerminal] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Draft state for appearance settings (not applied until Save)
  const [draftTheme, setDraftTheme] = useState(theme);
  const [draftUiFont, setDraftUiFont] = useState(uiFont);
  const [draftMonoFont, setDraftMonoFont] = useState(monoFont);
  const [draftDensity, setDraftDensity] = useState(density);

  // Saved/committed counterparts to track what is currently applied
  const [savedTheme, setSavedTheme] = useState(theme);
  const [savedUiFont, setSavedUiFont] = useState(uiFont);
  const [savedMonoFont, setSavedMonoFont] = useState(monoFont);
  const [savedDensity, setSavedDensity] = useState(density);

  const [customFontValue, setCustomFontValue] = useState<string>(() => {
    // If the stored uiFont is not in the curated list, it's a custom value
    const isKnown = UI_FONTS.some(f => f.id === (uiFont || 'Inter'));
    return isKnown ? '' : (uiFont || '');
  });

  // Load terminals + locale/terminal settings when dialog opens
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
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Snapshot appearance props when dialog opens — intentionally NOT re-running when
  // theme/uiFont/monoFont/density change (those are live-preview updates while open)
  useEffect(() => {
    if (!open) return;
    setSavedTheme(theme);
    setDraftTheme(theme);
    setSavedUiFont(uiFont);
    setDraftUiFont(uiFont);
    setSavedMonoFont(monoFont);
    setDraftMonoFont(monoFont);
    setSavedDensity(density);
    setDraftDensity(density);
    const isKnown = UI_FONTS.some(f => f.id === (uiFont || 'Inter'));
    setCustomFontValue(isKnown ? '' : (uiFont || ''));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty =
    locale !== savedLocale ||
    terminal !== savedTerminal ||
    draftTheme !== savedTheme ||
    draftUiFont !== savedUiFont ||
    draftMonoFont !== savedMonoFont ||
    draftDensity !== savedDensity;

  const handleSave = useCallback(async () => {
    try {
      await i18n.changeLanguage(locale);
      // Commit appearance changes by calling parent callbacks
      onThemeChange(draftTheme);
      onUiFontChange?.(draftUiFont);
      onMonoFontChange?.(draftMonoFont);
      onDensityChange?.(draftDensity);
      // Update saved appearance state
      setSavedTheme(draftTheme);
      setSavedUiFont(draftUiFont);
      setSavedMonoFont(draftMonoFont);
      setSavedDensity(draftDensity);
      // Fetch current DB values only for fields not managed by this dialog
      const current = await GetSettings();
      await SetSettings(
        locale, terminal,
        draftTheme,
        current?.lastDarkTheme || 'vscode-dark',
        current?.lastLightTheme || 'vscode-light',
        current?.customThemes || '[]',
        draftUiFont,
        draftMonoFont,
        draftDensity,
      );
      setSavedLocale(locale);
      setSavedTerminal(terminal);
      toast.success(t('settings.title'));
    } catch (err) {
      console.error('Failed to persist settings:', err);
    }
  }, [locale, terminal, draftTheme, draftUiFont, draftMonoFont, draftDensity, i18n, t, onThemeChange, onUiFontChange, onMonoFontChange, onDensityChange]);

  const handleCancel = useCallback(() => {
    setLocale(savedLocale);
    setTerminal(savedTerminal);
    setDraftTheme(savedTheme);
    setDraftUiFont(savedUiFont);
    setDraftMonoFont(savedMonoFont);
    setDraftDensity(savedDensity);
    setConfirmReset(false);
    // Revert live preview to saved values
    onThemeChange(savedTheme);
    onUiFontChange?.(savedUiFont);
    onMonoFontChange?.(savedMonoFont);
    onDensityChange?.(savedDensity);
    onClose();
  }, [savedLocale, savedTerminal, savedTheme, savedUiFont, savedMonoFont, savedDensity, onClose, onThemeChange, onUiFontChange, onMonoFontChange, onDensityChange]);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-imported
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        // Validate required fields
        if (
          typeof data.name !== 'string' ||
          (data.type !== 'dark' && data.type !== 'light') ||
          typeof data.colors?.background !== 'string' ||
          typeof data.colors?.foreground !== 'string' ||
          typeof data.colors?.primary !== 'string'
        ) {
          toast.error(t('settings.themeInvalidFields'));
          return;
        }
        const newTheme: CustomTheme = {
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: data.name,
          type: data.type,
          colors: data.colors,
        };
        onImportTheme?.(newTheme);
        // Import = immediate apply; sync both draft and saved to keep dialog state consistent
        onThemeChange(newTheme.id);
        setDraftTheme(newTheme.id);
        setSavedTheme(newTheme.id);
        toast.success(t('settings.themeApplied', { name: data.name }));
      } catch {
        toast.error(t('settings.themeInvalidJson'));
      }
    };
    reader.readAsText(file);
  }, [onImportTheme, onThemeChange, t]);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      await SaveThemeTemplate();
    } catch (err) {
      toast.error(String(err));
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) {
        handleCancel();
      }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('settings.description')}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="appearance" className="w-full">
          <TabsList className="w-full justify-start rounded-none bg-transparent p-0 border-b border-border h-auto mb-0">
            <TabsTrigger
              value="appearance"
              className="rounded-none border-b-2 border-transparent px-3 py-2 text-sm data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground bg-transparent shadow-none"
            >
              {t('settings.tabs.appearance')}
            </TabsTrigger>
            <TabsTrigger
              value="typography"
              className="rounded-none border-b-2 border-transparent px-3 py-2 text-sm data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground bg-transparent shadow-none"
            >
              {t('settings.tabs.typography')}
            </TabsTrigger>
            <TabsTrigger
              value="general"
              className="rounded-none border-b-2 border-transparent px-3 py-2 text-sm data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground bg-transparent shadow-none"
            >
              {t('settings.tabs.general')}
            </TabsTrigger>
          </TabsList>

          {/* ---- Appearance Tab ---- */}
          <TabsContent value="appearance" className="space-y-4 pt-4">
            {/* Built-in Themes */}
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">{t('settings.builtinThemes')}</p>
              <div
                role="group"
                aria-label="Theme selection"
                className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-0.5"
              >
                {THEMES.map(th => (
                  <ThemeSwatch
                    key={th.id}
                    id={th.id}
                    label={th.label}
                    themeType={th.type}
                    dots={THEME_DOTS[th.id] ?? ['#888', '#666', '#aaa', '#ccc']}
                    selected={draftTheme === th.id}
                    onSelect={() => { setDraftTheme(th.id); onThemeChange(th.id); }}
                  />
                ))}
              </div>
            </div>

            {/* Custom Themes (only if any exist) */}
            {(customThemes?.length ?? 0) > 0 && (
              <div className="pt-3 border-t border-border space-y-2">
                <p className="text-[11px] text-muted-foreground">{t('settings.customThemes')}</p>
                <div role="group" aria-label="Custom themes" className="grid grid-cols-2 gap-2">
                  {customThemes!.map(ct => (
                    <ThemeSwatch
                      key={ct.id}
                      id={ct.id}
                      label={ct.name}
                      themeType={ct.type}
                      dots={[
                        ct.colors.background ?? '#888',
                        ct.colors.card ?? '#666',
                        ct.colors.primary ?? '#aaa',
                        ct.colors.foreground ?? '#ccc',
                      ]}
                      selected={draftTheme === ct.id}
                      onSelect={() => { setDraftTheme(ct.id); onThemeChange(ct.id); }}
                      onRemove={() => onRemoveCustomTheme?.(ct.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Import / Download action row */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} className="mr-1" />
                {t('settings.importTheme')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={handleDownloadTemplate}
              >
                <Download size={14} className="mr-1.5" />
                {t('settings.downloadTemplate')}
              </Button>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              aria-hidden="true"
              className="hidden"
              onChange={handleImportFile}
            />

            {/* Density selector */}
            <div className="pt-3 border-t border-border space-y-2">
              <p className="text-sm font-medium">{t('settings.densityLabel')}</p>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={draftDensity}
                onValueChange={(v) => { if (v) { setDraftDensity(v); onDensityChange?.(v); } }}
                className="w-full"
              >
                <ToggleGroupItem value="compact" className="flex-1">
                  {t('settings.densityCompact')}
                </ToggleGroupItem>
                <ToggleGroupItem value="comfortable" className="flex-1">
                  {t('settings.densityComfortable')}
                </ToggleGroupItem>
                <ToggleGroupItem value="spacious" className="flex-1">
                  {t('settings.densitySpacious')}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </TabsContent>

          {/* ---- Typography Tab ---- */}
          <TabsContent value="typography" className="space-y-5 pt-4">
            {/* UI Font section */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t('settings.uiFontLabel')}</Label>
              <div role="group" aria-label="UI font selection" className="grid grid-cols-2 gap-2">
                {UI_FONTS.map(font => (
                  <FontPickerCard
                    key={font.id}
                    fontFamily={font.fontFamily}
                    label={font.label}
                    selected={draftUiFont === font.id && !customFontValue}
                    onSelect={() => {
                      setCustomFontValue('');
                      setDraftUiFont(font.id);
                      onUiFontChange?.(font.id);
                    }}
                  />
                ))}
                {/* Custom font input card — last in grid per D-02 */}
                <CustomFontCard
                  value={customFontValue}
                  selected={!!customFontValue}
                  onChange={(v) => {
                    setCustomFontValue(v);
                    if (v) { setDraftUiFont(v); onUiFontChange?.(v); }
                  }}
                />
              </div>
            </div>

            {/* Editor (Mono) Font section */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t('settings.monoFontLabel')}</Label>
              <div role="group" aria-label="Editor font selection" className="grid grid-cols-2 gap-2">
                {MONO_FONTS.map(font => (
                  <FontPickerCard
                    key={font.id}
                    fontFamily={font.fontFamily}
                    label={font.label}
                    selected={draftMonoFont === font.id}
                    onSelect={() => { setDraftMonoFont(font.id); onMonoFontChange?.(font.id); }}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ---- General Tab ---- */}
          <TabsContent value="general" className="space-y-4 pt-4">
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

            {onResetAllData && (
              <div className="border-t border-border pt-4 mt-2">
                <Label className="text-destructive text-xs font-semibold uppercase tracking-wide">{t('settings.dangerZone')}</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-destructive border-destructive/40 hover:bg-destructive/10 w-full"
                  onClick={() => setConfirmReset(true)}
                >
                  {t('settings.resetAllData')}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            {t('settings.close')}
          </Button>
          <Button disabled={!isDirty} onClick={handleSave}>
            {t('settings.save')}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmReset} onOpenChange={(o) => { if (!o) setConfirmReset(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.resetConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('settings.resetConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('app.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                setConfirmReset(false);
                if (onResetAllData) await onResetAllData();
              }}
            >
              {t('settings.resetAllData')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default SettingsDialog;

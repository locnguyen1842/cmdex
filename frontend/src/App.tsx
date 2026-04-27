import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './style.css';
import Sidebar from './components/Sidebar';
import CommandDetail from './components/CommandDetail';
import CategoryEditor from './components/CategoryEditor';
import VariablePrompt from './components/VariablePrompt';
import HistoryPane from './components/HistoryPane';
import OutputPane from './components/OutputPane';
import ResizablePanel from './components/ResizablePanel';
import TabBar, { type Tab } from './components/TabBar';
import CommandPalette from './components/CommandPalette';
import WelcomeTab from './components/WelcomeTab';
import FloatingSaveBar from './components/FloatingSaveBar';
import KeyboardShortcutsDialog from './components/KeyboardShortcutsDialog';
import { useKeyboardShortcuts, cmdOrCtrl, SHORTCUTS } from './hooks/useKeyboardShortcuts';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

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
import { Events } from '@wailsio/runtime';
import { eventNames, initEventNames } from './wails/events';
import {
    type Category,
    type Command,
    type VariableDefinition,
    type VariablePrompt as VarPromptType,
    type VariablePreset,
    type ExecutionRecord,
    type TabDraft,
    createNewTabId,
    isNewCommandTabId,
    getCommandDisplayTitle,
    type SettingsPayload,
    type OSPathMap,
    normalizeOS,
    type OSKey,
    type CustomTheme,
} from './types';

import {
    GetCategories,
    CreateCategory,
    UpdateCategory,
    DeleteCategory,
    GetCommands,
    CreateCommand,
    UpdateCommand,
    DeleteCommand,
    GetPresets,
    SavePreset,
    UpdatePreset,
    DeletePreset,
    ReorderCommand,
    GetScriptBody,
    ReorderPresets,
} from '../bindings/cmdex/commandservice';
import {
    GetSettings,
    SetSettings,
} from '../bindings/cmdex/settingsservice';
import {
    ShowSettingsWindow,
    GetOS,
} from '../bindings/cmdex/app';
import {
    GetVariables,
    RunCommand,
    GetExecutionHistory,
    ClearExecutionHistory,
    RunInTerminal,
} from '../bindings/cmdex/executionservice';
import i18n from './i18n';
import {
    emptyDraft,
    draftFromCommand,
    draftsEqual,
    cloneDraft,
    makePlaceholderCommand,
} from './utils/tabDraft';
import { buildVariablesFromScript, variableDefinitionsToPrompts } from './utils/templateVars';
import { MainLogo } from './assets/images/main-logo';

type ModalState =
    | { type: 'none' }
    | { type: 'categoryEditor'; category?: Category }
    | { type: 'managePresets'; variables: VarPromptType[]; commandId: string; presets: VariablePreset[] }
    | { type: 'fillVariables'; variables: VarPromptType[]; commandId: string; initialValues: Record<string, string> }
    | { type: 'confirmDiscard' }
    | { type: 'confirmClearHistory' }
    | { type: 'confirmVarRemoval'; removedVars: string[]; tabId: string };

// Legacy localStorage keys — used only for one-time migration on startup
const THEME_STORAGE_KEY = 'cmdex-theme';
const LAST_DARK_THEME_KEY = 'cmdex-last-dark-theme';
const LAST_LIGHT_THEME_KEY = 'cmdex-last-light-theme';
const CUSTOM_THEMES_KEY = 'cmdex-custom-themes';
const FONT_SANS_KEY = 'cmdex-ui-font';
const FONT_MONO_KEY = 'cmdex-mono-font';
const DENSITY_KEY = 'cmdex-density';

function App() {
    const { t } = useTranslation();
    const [categories, setCategories] = useState<Category[]>([]);
    const [commands, setCommands] = useState<Command[]>([]);
    const allCommandsRef = useRef<Command[]>([]);
    const [selectedCommand, setSelectedCommand] = useState<Command | null>(null);
    const [modal, setModal] = useState<ModalState>({ type: 'none' });
    const [isExecuting, setIsExecuting] = useState(false);

    const [executionHistory, setExecutionHistory] = useState<ExecutionRecord[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<ExecutionRecord | null>(null);
    const [outputPaneOpen, setOutputPaneOpen] = useState(false);
    const [serverVariables, setServerVariables] = useState<VarPromptType[]>([]);
    const [currentResolvedValues, setCurrentResolvedValues] = useState<Record<string, string>>({});
    const [lastSelectedPresetId, setLastSelectedPresetId] = useState<string>('');
    const [streamLines, setStreamLines] = useState<string[]>([]);
    const streamBufferRef = useRef<string[]>([]);
    const streamFlushRef = useRef<number | null>(null);
    const executingTabIdRef = useRef<string | null>(null);
    const [executingTabIdState, setExecutingTabIdState] = useState<string | null>(null);

    // Per-tab output state persistence
    const tabOutputRef = useRef<Record<string, { record: ExecutionRecord | null; streamLines: string[] }>>({});

    // Per-tab pane visibility (history + output); new tabs default to both closed
    const tabPaneStateRef = useRef<Record<string, { outputOpen: boolean; historyOpen: boolean }>>({});
    const [historyPaneOpen, setHistoryPaneOpen] = useState(false);
    const selectedRecordRef = useRef<ExecutionRecord | null>(null);
    const selectedCommandRef = useRef<Command | null>(null);
    const selectedCommandId = selectedCommand?.id;
    const streamLinesRef = useRef<string[]>([]);
    const outputPaneOpenRef = useRef(false);
    const historyPaneOpenRef = useRef(false);

    const [openTabs, setOpenTabs] = useState<Tab[]>([]);
    const openTabsRef = useRef<Tab[]>([]);

    const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
    const scriptFetchGenRef = useRef<Record<string, number>>({});
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const activeTabIdRef = useRef<string | null>(null);
    const prevTabIdRef = useRef<string | null>(null);
    const [tabDrafts, setTabDrafts] = useState<Record<string, TabDraft>>({});
    const [tabBaselines, setTabBaselines] = useState<Record<string, TabDraft>>({});
    const tabDraftsRef = useRef<Record<string, TabDraft>>({});
    const tabBaselinesRef = useRef<Record<string, TabDraft>>({});

    useEffect(() => {
        selectedRecordRef.current = selectedRecord;
        selectedCommandRef.current = selectedCommand;
        streamLinesRef.current = streamLines;
        outputPaneOpenRef.current = outputPaneOpen;
        historyPaneOpenRef.current = historyPaneOpen;
    }, [selectedRecord, selectedCommand, streamLines, outputPaneOpen, historyPaneOpen]);

    useEffect(() => {
        openTabsRef.current = openTabs;
        activeTabIdRef.current = activeTabId;
        tabDraftsRef.current = tabDrafts;
        tabBaselinesRef.current = tabBaselines;
    }, [openTabs, activeTabId, tabDrafts, tabBaselines]);

    const [paletteOpen, setPaletteOpen] = useState(false);
    const [currentOS, setCurrentOS] = useState<OSKey>('unknown');
    const pendingCloseTabIdRef = useRef<string | null>(null);
    const mainContentRef = useRef<HTMLDivElement>(null);

    const [theme, setTheme] = useState<string>('vscode-dark');

    const [uiFont, setUiFont] = useState<string>('Inter');
    const [monoFont, setMonoFont] = useState<string>('JetBrains Mono');
    const [density, setDensity] = useState<string>('comfortable');
    const [defaultWorkingDir, setDefaultWorkingDir] = useState<OSPathMap>({});

    // Tracks whether settings have been loaded from DB (prevents premature saves before load)
    const settingsLoadedRef = useRef(false);
    // Holds latest settings values for use in flushSettings without stale closures
    const settingsRef = useRef({
        locale: 'en',
        terminal: '',
        theme: 'vscode-dark',
        lastDarkTheme: 'vscode-dark',
        lastLightTheme: 'vscode-light',
        customThemes: [] as CustomTheme[],
        uiFont: 'Inter',
        monoFont: 'JetBrains Mono',
        density: 'comfortable',
        defaultWorkingDir: {} as OSPathMap,
        windowX: -1,
        windowY: -1,
        windowWidth: 640,
        windowHeight: 520,
    });

    // Persists all current settings from settingsRef to the DB.
    // Must only be called after settingsLoadedRef.current === true.
    const flushSettings = () => {
        if (!settingsLoadedRef.current) return;
        const r = settingsRef.current;
        SetSettings(JSON.stringify({
            locale: r.locale,
            terminal: r.terminal,
            theme: r.theme,
            lastDarkTheme: r.lastDarkTheme,
            lastLightTheme: r.lastLightTheme,
            customThemes: JSON.stringify(r.customThemes),
            uiFont: r.uiFont,
            monoFont: r.monoFont,
            density: r.density,
            defaultWorkingDir: r.defaultWorkingDir,
            windowX: r.windowX,
            windowY: r.windowY,
            windowWidth: r.windowWidth,
            windowHeight: r.windowHeight,
        })).catch(() => {});
    };

    // Tracks whether event names have been initialized from backend
    const [eventsInitialized, setEventsInitialized] = useState(false);

    useEffect(() => {
        initEventNames().then(() => setEventsInitialized(true));
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        settingsRef.current.theme = theme;
        flushSettings();
    }, [theme]);  

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => {
            const r = settingsRef.current;
            setTheme(e.matches ? r.lastDarkTheme : r.lastLightTheme);
        };
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    useEffect(() => {
        const fontValue = uiFont === 'System Default'
            ? 'system-ui, -apple-system, sans-serif'
            : `'${uiFont}', system-ui, sans-serif`;
        document.documentElement.style.setProperty('--font-sans', fontValue);
        settingsRef.current.uiFont = uiFont;
        flushSettings();
    }, [uiFont]);  

    useEffect(() => {
        document.documentElement.style.setProperty('--font-mono', `'${monoFont}', monospace`);
        settingsRef.current.monoFont = monoFont;
        flushSettings();
    }, [monoFont]);  

    useEffect(() => {
        document.documentElement.setAttribute('data-density', density);
        settingsRef.current.density = density;
        flushSettings();
    }, [density]);  

    // Tab switch fade: trigger opacity fade-in on the main-content area when activeTabId changes.
    // With per-tab mounts, this animates the entire main-content area on tab switch.
    // Inactive shells are display:none so only the active shell is visible during the fade.
    useEffect(() => {
        const el = mainContentRef.current;
        if (!el) return;
        el.classList.remove('tab-content-fade-in');
        // Force reflow so the class removal takes effect before re-adding
        void el.offsetWidth;
        el.classList.add('tab-content-fade-in');
        const timer = setTimeout(() => {
            el.classList.remove('tab-content-fade-in');
        }, 160);
        return () => clearTimeout(timer);
    }, [activeTabId]);

    const resolvedVariables = useMemo(() => {
        if (!selectedCommand) return [];
        if (isNewCommandTabId(selectedCommandId)) {
            const d = tabDrafts[selectedCommandId];
            if (!d) return [];
            return variableDefinitionsToPrompts(d.variables);
        }
        const d = tabDrafts[selectedCommandId];
        if (d) {
            const serverMap = new Map(serverVariables.map(v => [v.name, v]));
            return d.variables.map(dv => {
                const sv = serverMap.get(dv.name);
                if (sv) return sv;
                return {
                    name: dv.name,
                    placeholder: dv.name,
                    description: dv.description,
                    example: dv.example,
                    defaultExpr: dv.default,
                    defaultValue: dv.default ?? '',
                };
            });
        }
        return serverVariables;
    }, [selectedCommand, selectedCommandId, tabDrafts, serverVariables]);

    const variablesRequestIdRef = useRef(0);
    useEffect(() => {
        if (!selectedCommand) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setServerVariables([]);
            return;
        }
        if (isNewCommandTabId(selectedCommandId)) {
            setServerVariables([]);
            return;
        }
        const requestId = ++variablesRequestIdRef.current;
        GetVariables(selectedCommandId)
            .then((v) => {
                if (variablesRequestIdRef.current === requestId) {
                    setServerVariables(v || []);
                }
            })
            .catch(() => {
                if (variablesRequestIdRef.current === requestId) {
                    setServerVariables([]);
                }
            });
    }, [selectedCommand, selectedCommandId]);

    useEffect(() => {
        if (!selectedCommand || isNewCommandTabId(selectedCommandId)) return;
        const d = tabDrafts[selectedCommandId];
        const b = tabBaselines[selectedCommandId];
        if (d && b && !draftsEqual(d, b)) return;
        const fresh = commands.find((c) => c.id === selectedCommandId);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing selected command from fresh data after external reload
        if (fresh) setSelectedCommand(fresh);
    }, [selectedCommand, commands, selectedCommandId, tabDrafts, tabBaselines]);

    const loadData = useCallback(async () => {
        try {
            const [cats, cmds] = await Promise.all([GetCategories(), GetCommands()]);
            setCategories(cats || []);
            setCommands(cmds || []);
            allCommandsRef.current = cmds || [];
            return (cmds as Command[]) || [];
        } catch (err) {
            console.error('Failed to load data:', err);
            return [] as Command[];
        }
    }, []);

    const loadHistory = useCallback(async () => {
        try {
            const records = await GetExecutionHistory();
            setExecutionHistory(records || []);
        } catch (err) {
            console.error('Failed to load history:', err);
        }
    }, []);

    useEffect(() => {
        /* eslint-disable react-hooks/set-state-in-effect -- one-time init data loading */
        GetOS().then((os) => setCurrentOS(normalizeOS(os))).catch(() => setCurrentOS('unknown'));
        loadData();
        loadHistory();
        GetSettings()
            .then((s) => {
                if (!s) return;

                // One-time localStorage migration: if DB has the default value but localStorage
                // has a user-set value, prefer the localStorage value (migrates existing users).
                const migrateField = (dbVal: string, lsKey: string, defaultVal: string): string => {
                    if (dbVal === defaultVal) {
                        return localStorage.getItem(lsKey) || defaultVal;
                    }
                    return dbVal;
                };

                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const osDefaultTheme = prefersDark ? 'vscode-dark' : 'vscode-light';
                const migratedTheme = migrateField(s.theme, THEME_STORAGE_KEY, 'vscode-dark') ||
                    (prefersDark
                        ? (localStorage.getItem(LAST_DARK_THEME_KEY) || 'vscode-dark')
                        : (localStorage.getItem(LAST_LIGHT_THEME_KEY) || 'vscode-light'));
                const migratedLastDark = migrateField(s.lastDarkTheme, LAST_DARK_THEME_KEY, 'vscode-dark');
                const migratedLastLight = migrateField(s.lastLightTheme, LAST_LIGHT_THEME_KEY, 'vscode-light');
                const migratedUiFont = migrateField(s.uiFont, FONT_SANS_KEY, 'Inter');
                const migratedMonoFont = migrateField(s.monoFont, FONT_MONO_KEY, 'JetBrains Mono');
                const migratedDensity = migrateField(s.density, DENSITY_KEY, 'comfortable');

                let migratedCustomThemes: CustomTheme[] = [];
                try {
                    if (s.customThemes && s.customThemes !== '[]') {
                        migratedCustomThemes = JSON.parse(s.customThemes);
                    } else {
                        const lsCustom = localStorage.getItem(CUSTOM_THEMES_KEY);
                        if (lsCustom) migratedCustomThemes = JSON.parse(lsCustom);
                    }
                } catch { /* ignore parse errors */ }

                // Apply locale
                if (s.locale && s.locale !== i18n.language) {
                    i18n.changeLanguage(s.locale);
                }

                // Sync settingsRef before marking loaded (prevents flushSettings no-ops)
                settingsRef.current = {
                    locale: s.locale || 'en',
                    terminal: s.terminal || '',
                    theme: migratedTheme,
                    lastDarkTheme: migratedLastDark,
                    lastLightTheme: migratedLastLight,
                    customThemes: migratedCustomThemes,
                    uiFont: migratedUiFont,
                    monoFont: migratedMonoFont,
                    density: migratedDensity,
                    defaultWorkingDir: s.defaultWorkingDir || {},
                    windowX: s.windowX ?? -1,
                    windowY: s.windowY ?? -1,
                    windowWidth: s.windowWidth ?? 640,
                    windowHeight: s.windowHeight ?? 520,
                };
                settingsLoadedRef.current = true;

                // Apply state — each setter triggers its effect which calls flushSettings
                setTheme(migratedTheme);
                setUiFont(migratedUiFont);
                setMonoFont(migratedMonoFont);
                setDensity(migratedDensity);
                setDefaultWorkingDir(s.defaultWorkingDir || {});

                // Clear legacy localStorage keys after successful migration
                [THEME_STORAGE_KEY, LAST_DARK_THEME_KEY, LAST_LIGHT_THEME_KEY,
                 CUSTOM_THEMES_KEY, FONT_SANS_KEY, FONT_MONO_KEY, DENSITY_KEY].forEach(k =>
                    localStorage.removeItem(k)
                );

                // Persist migrated values to DB (covers the case where migration pulled from localStorage)
                SetSettings(JSON.stringify({
                    locale: settingsRef.current.locale,
                    terminal: settingsRef.current.terminal,
                    theme: migratedTheme,
                    lastDarkTheme: migratedLastDark,
                    lastLightTheme: migratedLastLight,
                    customThemes: JSON.stringify(migratedCustomThemes),
                    uiFont: migratedUiFont,
                    monoFont: migratedMonoFont,
                    density: migratedDensity,
                    defaultWorkingDir: settingsRef.current.defaultWorkingDir,
                    windowX: settingsRef.current.windowX,
                    windowY: settingsRef.current.windowY,
                    windowWidth: settingsRef.current.windowWidth,
                    windowHeight: settingsRef.current.windowHeight,
                })).catch(() => {});

                // Suppress unused variable warning for osDefaultTheme (used in migration logic above)
                void osDefaultTheme;
            })
            .catch(() => {
                // Allow saves even if initial load fails
                settingsLoadedRef.current = true;
            });
        setOpenTabs([]);
        setActiveTabId(null);
    }, [loadData, loadHistory]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const openSettingsWithToast = async () => {
        try {
            await ShowSettingsWindow();
        } catch (err) {
            toast.error('Failed to open settings window');
            console.error('ShowSettingsWindow error:', err);
        }
    };

    useEffect(() => {
        if (!eventsInitialized) return;
        const cleanup = Events.On(eventNames.openSettings, async () => {
            await openSettingsWithToast();
        });
        return cleanup;
    }, [eventsInitialized]);

    useEffect(() => {
        if (!eventsInitialized) return;
        const cleanup = Events.On(eventNames.openShortcuts, () => {
            setShortcutsDialogOpen(true);
        });
        return cleanup;
    }, [eventsInitialized]);

    useEffect(() => {
        if (!eventsInitialized) return;
        // Wails v3 `Events.On` delivers a `WailsEvent` wrapper: { name, data, sender }.
        // The emitted payload is at `event.data`, not on the event object itself.
        // Reading the payload fields directly off `event` returns undefined and would
        // cause `||` fallbacks to kick in, overwriting user's just-saved settings
        // with defaults. Always unwrap `.data`.
        const cleanup = Events.On(eventNames.settingsChanged, (event: { name: string; data: unknown; sender: string }) => {
            const payload = event?.data as Partial<SettingsPayload> | undefined;
            if (!payload) return;
            // Keep settingsRef in sync BEFORE state setters fire their auto-save
            // useEffects — those effects read state and persist, so settingsRef
            // must hold the correct non-theme fields first or a stale value (e.g.
            // lastDarkTheme, locale, terminal) could be written back to the DB.
            const current = settingsRef.current;
            settingsRef.current = {
                ...current,
                locale: payload.locale ?? current.locale,
                terminal: payload.terminal ?? current.terminal,
                theme: payload.theme ?? current.theme,
                lastDarkTheme: payload.lastDarkTheme ?? current.lastDarkTheme,
                lastLightTheme: payload.lastLightTheme ?? current.lastLightTheme,
                uiFont: payload.uiFont ?? current.uiFont,
                monoFont: payload.monoFont ?? current.monoFont,
                density: payload.density ?? current.density,
                defaultWorkingDir: payload.defaultWorkingDir ?? current.defaultWorkingDir,
            };
            if (payload.locale) i18n.changeLanguage(payload.locale);
            if (payload.theme) setTheme(payload.theme);
            if (payload.uiFont) setUiFont(payload.uiFont);
            if (payload.monoFont) setMonoFont(payload.monoFont);
            if (payload.density) setDensity(payload.density);
            if (payload.defaultWorkingDir) setDefaultWorkingDir(payload.defaultWorkingDir);
            if (payload.customThemes !== undefined) {
                try {
                    const parsed = typeof payload.customThemes === 'string'
                        ? JSON.parse(payload.customThemes)
                        : payload.customThemes;
                    if (Array.isArray(parsed)) {
                        settingsRef.current.customThemes = parsed;
                    }
                } catch {
                    // Do not overwrite existing customThemes on parse failure
                }
            }
        });
        return cleanup;
    }, [eventsInitialized]);


    const updateDraft = useCallback((tabId: string, partial: Partial<TabDraft>) => {
        setTabDrafts((prev) => {
            const cur = prev[tabId];
            if (!cur) return prev;
            const next: TabDraft = { ...cur, ...partial };
            return { ...prev, [tabId]: next };
        });
    }, []);

    const handleDiscardTab = useCallback(
        (tabId: string) => {
            const b = tabBaselines[tabId];
            if (b) setTabDrafts((prev) => ({ ...prev, [tabId]: cloneDraft(b) }));
        },
        [tabBaselines],
    );

    const applyPaneState = (tabId: string) => {
        const saved = tabPaneStateRef.current[tabId];
        setOutputPaneOpen(saved?.outputOpen ?? false);
        setHistoryPaneOpen(saved?.historyOpen ?? false);
    };

    const finalizeCloseTab = useCallback(
        (tabId: string) => {
            const prevTabs = openTabsRef.current;
            const newTabs = prevTabs.filter((t) => t.id !== tabId);
            if (activeTabId === tabId) {
                const idx = prevTabs.findIndex((t) => t.id === tabId);
                const nextTab = newTabs[Math.min(idx, newTabs.length - 1)];
                if (nextTab) {
                    const saved = tabOutputRef.current[nextTab.id];
                    if (saved) {
                        setSelectedRecord(saved.record);
                        setStreamLines(saved.streamLines);
                    } else {
                        setSelectedRecord(null);
                        setStreamLines([]);
                    }
                    applyPaneState(nextTab.id);
                    if (isNewCommandTabId(nextTab.id)) {
                        const d = tabDraftsRef.current[nextTab.id];
                        setSelectedCommand(makePlaceholderCommand(nextTab.id, d?.categoryId));
                    } else {
                        const cmd = allCommandsRef.current.find((c) => c.id === nextTab.id);
                        setSelectedCommand(cmd ?? null);
                    }
                    setActiveTabId(nextTab.id);
                } else {
                    setSelectedCommand(null);
                    setActiveTabId(null);
                    setSelectedRecord(null);
                    setStreamLines([]);
                }
            }
            setOpenTabs(newTabs);
            setTabDrafts((prev) => {
                const n = { ...prev };
                delete n[tabId];
                return n;
            });
            setTabBaselines((prev) => {
                const n = { ...prev };
                delete n[tabId];
                return n;
            });
            delete tabPaneStateRef.current[tabId];
            delete tabOutputRef.current[tabId];
            delete scriptFetchGenRef.current[tabId];
        },
        [activeTabId],
    );

    const openNewCommandTab = useCallback(
        (defaultCategoryId?: string) => {
            const prevTabId = activeTabIdRef.current;
            if (prevTabId) {
                prevTabIdRef.current = prevTabId;
                tabOutputRef.current[prevTabId] = {
                    record: selectedRecordRef.current,
                    streamLines: [...streamLinesRef.current],
                };
                tabPaneStateRef.current[prevTabId] = {
                    outputOpen: outputPaneOpenRef.current,
                    historyOpen: historyPaneOpenRef.current,
                };
            }
            const id = createNewTabId();
            const initial = emptyDraft(defaultCategoryId);
            const baseline = cloneDraft(initial);
            setTabDrafts((prev) => ({ ...prev, [id]: initial }));
            setTabBaselines((prev) => ({ ...prev, [id]: baseline }));
            setSelectedCommand(makePlaceholderCommand(id, defaultCategoryId));
            setSelectedRecord(null);
            setStreamLines([]);
            setActiveTabId(id);
            setOpenTabs((prev) => [...prev, { id, title: t('commandEditor.newCommand') }]);
            tabPaneStateRef.current[id] = { outputOpen: false, historyOpen: false };
            applyPaneState(id);
        },
        [t],
    );

    const openTab = useCallback((cmd: Command) => {
        // Save current tab's output + pane state before switching
        const prevTabId = activeTabIdRef.current;
        if (prevTabId && prevTabId !== cmd.id) {
            prevTabIdRef.current = prevTabId;
            tabOutputRef.current[prevTabId] = {
                record: selectedRecordRef.current,
                streamLines: [...streamLinesRef.current],
            };
            tabPaneStateRef.current[prevTabId] = {
                outputOpen: outputPaneOpenRef.current,
                historyOpen: historyPaneOpenRef.current,
            };
        }
        setSelectedCommand(cmd);
        setActiveTabId(cmd.id);
        const isExisting = !!tabBaselinesRef.current[cmd.id];
        setOpenTabs((prev) => {
            const tabTitle = getCommandDisplayTitle(cmd);
            const exists = prev.find((t) => t.id === cmd.id);
            if (exists) {
                return prev.map((t) => (t.id === cmd.id ? { ...t, title: tabTitle } : t));
            }
            return [...prev, { id: cmd.id, title: tabTitle }];
        });
        if (isExisting) {
            const savedOutput = tabOutputRef.current[cmd.id];
            if (savedOutput) {
                setSelectedRecord(savedOutput.record);
                setStreamLines(savedOutput.streamLines);
            } else {
                setSelectedRecord(null);
                setStreamLines([]);
            }
            applyPaneState(cmd.id);
            return;
        }
        setSelectedRecord(null);
        setStreamLines([]);
        tabPaneStateRef.current[cmd.id] = { outputOpen: false, historyOpen: false };
        applyPaneState(cmd.id);
        const g = (scriptFetchGenRef.current[cmd.id] = (scriptFetchGenRef.current[cmd.id] ?? 0) + 1);
        void GetScriptBody(cmd.id)
            .then((body) => {
                if (scriptFetchGenRef.current[cmd.id] !== g) return;
                const d = draftFromCommand(cmd, body);
                setTabDrafts((prev) => prev[cmd.id] ? prev : { ...prev, [cmd.id]: d });
                setTabBaselines((prev) => prev[cmd.id] ? prev : { ...prev, [cmd.id]: cloneDraft(d) });
            })
            .catch(() => {
                if (scriptFetchGenRef.current[cmd.id] !== g) return;
                const d = draftFromCommand(cmd, '');
                setTabDrafts((prev) => prev[cmd.id] ? prev : { ...prev, [cmd.id]: d });
                setTabBaselines((prev) => prev[cmd.id] ? prev : { ...prev, [cmd.id]: cloneDraft(d) });
            });
    }, []);

    const skipVarRemovalCheckRef = useRef(false);
    const pendingDirectSaveBodyRef = useRef<string | null>(null);

    // Cache per-tab handlers so React.memo on CommandDetail is effective.
    // Factories (makeHandle*) and updateDraft are stable, so cached handlers are stable.
    const tabHandlerCacheRef = useRef<Map<string, {
        onExecute: (values: Record<string, string>) => void;
        onRunInTerminal: (values: Record<string, string>) => void;
        onFillVariables: (initialValues: Record<string, string>) => void;
        onDelete: () => void;
        onRenamePreset: (presetId: string, newName: string) => Promise<void>;
        onDeletePreset: (presetId: string) => Promise<void>;
        onAddPreset: (initialValues?: Record<string, string>) => Promise<string>;
        onSavePresetValues: (presetId: string, values: Record<string, string>) => Promise<void>;
        onReorderPresets: (presetIds: string[]) => Promise<void>;
        onSaveScript: (scriptBody: string) => Promise<void>;
        onDraftChange: (partial: Partial<TabDraft>) => void;
    }>>(new Map());

    // Clean up handler cache when tabs close
    useEffect(() => {
        const openIds = new Set(openTabs.map((t) => t.id));
        for (const tabId of tabHandlerCacheRef.current.keys()) {
            if (!openIds.has(tabId)) {
                tabHandlerCacheRef.current.delete(tabId);
            }
        }
    }, [openTabs]);

    const computeRemovedVarsWithPresets = (
        tabId: string,
        newVars: VariableDefinition[],
    ): string[] => {
        const existingCmd = allCommandsRef.current.find((c) => c.id === tabId);
        if (!existingCmd || !existingCmd.presets || existingCmd.presets.length === 0) return [];
        const newVarNames = new Set(newVars.map((v) => v.name));
        const removedVars = existingCmd.variables
            .filter((v) => !newVarNames.has(v.name))
            .map((v) => v.name);
        return removedVars.filter((name) =>
            existingCmd.presets!.some((p) => {
                const val = p.values[name];
                return typeof val === 'string' && val.trim() !== '';
            }),
        );
    };

    const handleSaveTab = useCallback(
        async (tabId: string) => {
            const d = tabDraftsRef.current[tabId];
            if (!d || !d.scriptBody.trim()) return;
            const title = d.title.trim();
            const description = d.description.trim();
            const body = d.scriptBody.replace(/^\s+|\s+$/g, '');
            const tags = d.tags.map((tag) => tag.trim()).filter(Boolean);
            const vars = buildVariablesFromScript(body, d.variables);

            if (!isNewCommandTabId(tabId) && !skipVarRemovalCheckRef.current) {
                const removedWithPresets = computeRemovedVarsWithPresets(tabId, vars);
                if (removedWithPresets.length > 0) {
                    pendingDirectSaveBodyRef.current = null;
                    setModal({ type: 'confirmVarRemoval', removedVars: removedWithPresets, tabId });
                    return;
                }
            }

            try {
                if (isNewCommandTabId(tabId)) {
                    const cmd = await CreateCommand(
                        title,
                        description,
                        body,
                        d.categoryId,
                        tags,
                        vars,
                        d.workingDir,
                    );
                    await loadData();
                    const savedBody = await GetScriptBody(cmd.id);
                    const saved = draftFromCommand(cmd, savedBody);
                    setTabDrafts((prev) => {
                        const next = { ...prev };
                        delete next[tabId];
                        next[cmd.id] = saved;
                        return next;
                    });
                    setTabBaselines((prev) => {
                        const next = { ...prev };
                        delete next[tabId];
                        next[cmd.id] = cloneDraft(saved);
                        return next;
                    });
                    setOpenTabs((prev) =>
                        prev.map((tt) =>
                            tt.id === tabId ? { id: cmd.id, title: getCommandDisplayTitle(cmd) } : tt,
                        ),
                    );
                    // Only switch to the newly created command if the original tab is still active
                    if (activeTabIdRef.current === tabId) {
                        setActiveTabId(cmd.id);
                        setSelectedCommand(cmd);
                    }
                    toast.success(t('toast.commandCreated'));
                } else {
                    await UpdateCommand(
                        tabId,
                        title,
                        description,
                        body,
                        d.categoryId,
                        tags,
                        vars,
                        d.workingDir,
                    );
                    await loadData();
                    const cmd = allCommandsRef.current.find((c) => c.id === tabId);
                    if (cmd) {
                        const body = await GetScriptBody(cmd.id);
                        const saved = draftFromCommand(cmd, body);
                        setTabDrafts((prev) => ({ ...prev, [tabId]: saved }));
                        setTabBaselines((prev) => ({ ...prev, [tabId]: cloneDraft(saved) }));
                        // Only update selectedCommand if this tab is still active
                        if (activeTabIdRef.current === tabId) {
                            setSelectedCommand(cmd);
                        }
                    }
                    toast.success(t('toast.commandSaved'));
                }
            } catch (err) {
                console.error('Failed to save command:', err);
            }
        },
        [loadData, t],
    );

    const closeTab = (tabId: string) => {
        const d = tabDrafts[tabId];
        const b = tabBaselines[tabId];
        const dirty = d && b && !draftsEqual(d, b);
        if (dirty) {
            pendingCloseTabIdRef.current = tabId;
            setModal({ type: 'confirmDiscard' });
            return;
        }
        finalizeCloseTab(tabId);
    };

    const handleSelectTab = (tabId: string) => {
        if (tabId === activeTabId) return;
        // Save current tab's output + pane state
        if (activeTabId) {
            prevTabIdRef.current = activeTabId;
            tabOutputRef.current[activeTabId] = {
                record: selectedRecord,
                streamLines: [...streamLines],
            };
            tabPaneStateRef.current[activeTabId] = {
                outputOpen: outputPaneOpen,
                historyOpen: historyPaneOpen,
            };
        }
        setActiveTabId(tabId);
        // Restore target tab's output state
        const savedOutput = tabOutputRef.current[tabId];
        if (savedOutput) {
            setSelectedRecord(savedOutput.record);
            setStreamLines(savedOutput.streamLines);
        } else {
            setSelectedRecord(null);
            setStreamLines([]);
        }
        applyPaneState(tabId);
        if (isNewCommandTabId(tabId)) {
            const d = tabDraftsRef.current[tabId];
            setSelectedCommand(makePlaceholderCommand(tabId, d?.categoryId));
        } else {
            const cmd = allCommandsRef.current.find((c) => c.id === tabId);
            if (cmd) setSelectedCommand(cmd);
        }
    };

    const tabsForBar = useMemo(
        () =>
            openTabs
                .filter((tab) => tab.id !== '__welcome__')
                .map((tab) => {
                    const d = tabDrafts[tab.id];
                    const b = tabBaselines[tab.id];
                    const dirty = !!(d && b && !draftsEqual(d, b));
                    let title = tab.title;
                    if (d) {
                        const trimmedTitle = d.title.trim();
                        if (trimmedTitle) {
                            title = trimmedTitle;
                        } else {
                            const body = d.scriptBody.replace(/\n/g, ' ').trim();
                            if (body.length > 0) {
                                title = body.length > 50 ? body.slice(0, 50) + '...' : body;
                            } else if (isNewCommandTabId(tab.id)) {
                                title = t('commandEditor.newCommand');
                            } else {
                                title = t('common.untitled');
                            }
                        }
                    }
                    return { ...tab, title, isDirty: dirty };
                }),
        [openTabs, tabDrafts, tabBaselines, t],
    );

    const activeDraft = activeTabId ? tabDrafts[activeTabId] : null;
    const activeDirty =
        activeTabId && activeDraft && tabBaselines[activeTabId]
            ? !draftsEqual(activeDraft, tabBaselines[activeTabId])
            : false;

    const handleCreateCategory = async (data: { name: string; color: string }) => {
        try {
            await CreateCategory(data.name, '', data.color);
            await loadData();
            setModal({ type: 'none' });
            toast.success(t('toast.categoryCreated'));
        } catch (err) {
            console.error('Failed to create category:', err);
        }
    };

    const handleUpdateCategory = async (data: { name: string; color: string }) => {
        if (modal.type !== 'categoryEditor' || !modal.category) return;
        try {
            await UpdateCategory(modal.category.id, data.name, '', data.color);
            await loadData();
            setModal({ type: 'none' });
            toast.success(t('toast.categorySaved'));
        } catch (err) {
            console.error('Failed to update category:', err);
        }
    };

    const handleDeleteCategory = async (catId: string) => {
        try {
            await DeleteCategory(catId);
            if (selectedCommand?.categoryId === catId) {
                setSelectedCommand(null);
            }
            await loadData();
            toast.success(t('toast.categoryDeleted'));
        } catch (err) {
            console.error('Failed to delete category:', err);
        }
    };

    const isSavedCommandDraftDirty = useCallback((commandId: string) => {
        const d = tabDraftsRef.current[commandId];
        const b = tabBaselinesRef.current[commandId];
        return !!(d && b && !draftsEqual(d, b));
    }, []);

    const handleExecute = async (values: Record<string, string>) => {
        if (!selectedCommand || isNewCommandTabId(selectedCommand.id)) return;
        if (isSavedCommandDraftDirty(selectedCommand.id)) {
            toast.message(t('toast.saveBeforeExecute'));
            return;
        }
        runCommandDirect(selectedCommand.id, values);
    };

    const MAX_STREAM_LINES = 5000;

    const flushStreamBuffer = useCallback(() => {
        const execTabId = executingTabIdRef.current;
        const newLines = streamBufferRef.current;
        streamBufferRef.current = [];
        streamFlushRef.current = null;

        if (execTabId) {
            const slot = tabOutputRef.current[execTabId] || { record: null, streamLines: [] };
            const combined = [...slot.streamLines, ...newLines];
            tabOutputRef.current[execTabId] = {
                ...slot,
                streamLines: combined.length > MAX_STREAM_LINES
                    ? combined.slice(combined.length - MAX_STREAM_LINES)
                    : combined,
            };
        }

        if (execTabId === activeTabIdRef.current) {
            setStreamLines((prev) => {
                const combined = [...prev, ...newLines];
                if (combined.length > MAX_STREAM_LINES) {
                    return combined.slice(combined.length - MAX_STREAM_LINES);
                }
                return combined;
            });
        }
    }, []);

    const runCommandDirect = useCallback(async (commandId: string, variables: Record<string, string>) => {
        const execTabId = activeTabIdRef.current;
        executingTabIdRef.current = execTabId;
        setExecutingTabIdState(execTabId);
        setIsExecuting(true);
        setSelectedRecord(null);
        setStreamLines([]);
        streamBufferRef.current = [];
        if (execTabId) {
            tabOutputRef.current[execTabId] = { record: null, streamLines: [] };
        }
        setOutputPaneOpen(true);
        setHistoryPaneOpen(true);

        const cleanup = Events.On(eventNames.cmdOutput, (event) => {
            const chunk = event.data as { stream: string; data: string };
            const prefix = chunk.stream === 'stderr' ? '\x1b[stderr]' : '';
            streamBufferRef.current.push(prefix + chunk.data);
            if (streamFlushRef.current === null) {
                streamFlushRef.current = requestAnimationFrame(flushStreamBuffer);
            }
        });

        try {
            const record = await RunCommand(commandId, variables);
            if (streamFlushRef.current !== null) {
                cancelAnimationFrame(streamFlushRef.current);
                streamFlushRef.current = null;
            }
            if (streamBufferRef.current.length > 0) {
                flushStreamBuffer();
            }
            if (execTabId) {
                const cached = tabOutputRef.current[execTabId];
                tabOutputRef.current[execTabId] = {
                    record,
                    streamLines: cached?.streamLines || [],
                };
            }
            if (execTabId === activeTabIdRef.current) {
                setSelectedRecord(record);
            }
            await loadHistory();
            if (record.exitCode === 0) {
                toast.success(t('toast.commandSuccess'));
            } else {
                toast.error(t('toast.commandFailed', { code: record.exitCode }));
            }
        } catch (err) {
            const errRecord: ExecutionRecord = {
                id: '',
                commandId: commandId,
                scriptContent: '',
                finalCmd: '',
                output: '',
                error: String(err),
                exitCode: -1,
                workingDir: '',
                executedAt: new Date().toISOString(),
            };
            if (execTabId) {
                tabOutputRef.current[execTabId] = { record: errRecord, streamLines: [] };
            }
            if (execTabId === activeTabIdRef.current) {
                setSelectedRecord(errRecord);
            }
            toast.error(t('toast.commandFailed', { code: -1 }));
        } finally {
            cleanup();
            executingTabIdRef.current = null;
            setExecutingTabIdState(null);
            setIsExecuting(false);
        }
    }, [flushStreamBuffer, t, loadHistory]);

    const makeHandleExecute = useCallback((tabId: string) => {
        return async (values: Record<string, string>) => {
            if (isNewCommandTabId(tabId)) return;
            if (isSavedCommandDraftDirty(tabId)) {
                toast.message(t('toast.saveBeforeExecute'));
                return;
            }
            runCommandDirect(tabId, values);
        };
    }, [isSavedCommandDraftDirty, runCommandDirect, t]);

    const makeHandleRunInTerminal = useCallback((tabId: string) => {
        return async (values: Record<string, string>) => {
            if (isNewCommandTabId(tabId)) return;
            if (isSavedCommandDraftDirty(tabId)) {
                toast.message(t('toast.saveBeforeExecute'));
                return;
            }
            try {
                await RunInTerminal(tabId, values);
            } catch (err) {
                toast.error(String(err));
            }
        };
    }, [isSavedCommandDraftDirty, t]);

    const handleDeleteCommand = async (cmd: Command) => {
        try {
            await DeleteCommand(cmd.id);
            if (selectedCommand?.id === cmd.id) {
                closeTab(cmd.id);
            }
            await loadData();
            toast.success(t('toast.commandDeleted'));
        } catch (err) {
            console.error('Failed to delete command:', err);
        }
    };

    const makeHandleDelete = useCallback((tabId: string, closeTabFn: (id: string) => void) => {
        return async () => {
            try {
                await DeleteCommand(tabId);
                closeTabFn(tabId);
                await loadData();
                toast.success(t('toast.commandDeleted'));
            } catch (err) {
                console.error('Failed to delete command:', err);
                toast.error(String(err));
            }
        };
    }, [loadData, t]);

    const handleReorderCommand = async (id: string, newPosition: number, newCategoryId: string) => {
        const prev = commands;
        const prevAll = allCommandsRef.current;
        const optimistic = prev.map(cmd => {
            if (cmd.id === id) {
                return { ...cmd, categoryId: newCategoryId, position: newPosition };
            }
            return cmd;
        });
        allCommandsRef.current = optimistic;
        setCommands(optimistic);
        try {
            const reordered = await ReorderCommand(id, newPosition, newCategoryId);
            if (reordered) {
                allCommandsRef.current = reordered;
                setCommands(reordered);
            }
        } catch (err) {
            console.error('Failed to reorder command:', err);
            allCommandsRef.current = prevAll;
            setCommands(prev);
        }
    };

    const handleFillVariables = async (initialValues: Record<string, string>) => {
        if (!selectedCommand || isNewCommandTabId(selectedCommand.id)) return;
        const vars = await GetVariables(selectedCommand.id);
        setModal({
            type: 'fillVariables',
            variables: vars || [],
            commandId: selectedCommand.id,
            initialValues,
        });
    };

    const makeHandleFillVariables = useCallback((tabId: string) => {
        return async (initialValues: Record<string, string>) => {
            if (isNewCommandTabId(tabId)) return;
            const vars = await GetVariables(tabId);
            setModal({
                type: 'fillVariables',
                variables: vars || [],
                commandId: tabId,
                initialValues,
            });
        };
    }, []);

    const handleVariableSubmit = async (values: Record<string, string>) => {
        if (!selectedCommand || isNewCommandTabId(selectedCommand.id)) return;
        if (isSavedCommandDraftDirty(selectedCommand.id)) {
            toast.message(t('toast.saveBeforeExecute'));
            return;
        }
        setModal({ type: 'none' });
        runCommandDirect(selectedCommand.id, values);
    };

    const handleSavePreset = async (name: string, values: Record<string, string>) => {
        if (modal.type !== 'managePresets') return;
        await SavePreset(modal.commandId, name, values);
        const presets = await GetPresets(modal.commandId);
        setModal({ ...modal, presets: presets || [] });
        toast.success(t('toast.presetCreated'));
    };

    const handleUpdatePreset = async (presetId: string, name: string, values: Record<string, string>) => {
        if (modal.type !== 'managePresets') return;
        await UpdatePreset(modal.commandId, presetId, name, values);
        const presets = await GetPresets(modal.commandId);
        setModal({ ...modal, presets: presets || [] });
        toast.success(t('toast.presetSaved'));
    };

    const handleDeletePreset = async (presetId: string) => {
        if (modal.type !== 'managePresets') return;
        await DeletePreset(modal.commandId, presetId);
        const presets = await GetPresets(modal.commandId);
        setModal({ ...modal, presets: presets || [] });
    };

    const refreshCommand = useCallback(async (commandId: string): Promise<Command | null> => {
        const cmds = await GetCommands();
        allCommandsRef.current = cmds || [];
        setCommands(cmds || []);
        const refreshed = (cmds || []).find((c: Command) => c.id === commandId) ?? null;
        if (refreshed && selectedCommandRef.current?.id === refreshed.id) {
            setSelectedCommand(refreshed);
        }
        return refreshed;
    }, []);

    const makeHandleAddPreset = useCallback((tabId: string) => {
        return async (initialValues?: Record<string, string>): Promise<string> => {
            if (isNewCommandTabId(tabId)) return '';
            try {
                const created = await SavePreset(tabId, t('commandDetail.newPresetName'), initialValues ?? {});
                await refreshCommand(tabId);
                return created.id;
            } catch (err) {
                console.error('Failed to add preset:', err);
                toast.error(t('toast.presetAddFailed'));
                return '';
            }
        };
    }, [t, refreshCommand]);

    const makeHandleRenamePreset = useCallback((tabId: string) => {
        return async (presetId: string, newName: string) => {
            if (isNewCommandTabId(tabId)) return;
            const cmd = allCommandsRef.current.find((c) => c.id === tabId);
            const preset = cmd?.presets.find((p) => p.id === presetId);
            if (!preset) return;
            try {
                await UpdatePreset(tabId, presetId, newName, preset.values);
                await refreshCommand(tabId);
            } catch (err) {
                console.error('Failed to rename preset:', err);
                toast.error(t('toast.presetRenameFailed'));
            }
        };
    }, [refreshCommand, t]);

    const makeHandleDeletePreset = useCallback((tabId: string) => {
        return async (presetId: string) => {
            if (isNewCommandTabId(tabId)) return;
            try {
                await DeletePreset(tabId, presetId);
                await refreshCommand(tabId);
            } catch (err) {
                console.error('Failed to delete preset:', err);
                toast.error(t('toast.presetDeleteFailed'));
            }
        };
    }, [refreshCommand, t]);

    const makeHandleReorderPresets = useCallback((tabId: string) => {
        return async (presetIds: string[]) => {
            if (isNewCommandTabId(tabId)) return;
            const cmd = allCommandsRef.current.find((c) => c.id === tabId);
            if (!cmd) return;
            const reordered = presetIds
                .map((id) => cmd.presets.find((p) => p.id === id))
                .filter(Boolean) as typeof cmd.presets;
            setSelectedCommand((prev) => (prev && prev.id === tabId) ? { ...prev, presets: reordered } : prev);
            try {
                await ReorderPresets(tabId, presetIds);
                await refreshCommand(tabId);
            } catch (err) {
                console.error('Failed to reorder presets:', err);
                toast.error(t('toast.presetReorderFailed'));
                await refreshCommand(tabId);
            }
        };
    }, [refreshCommand, t]);

    const makeHandleSavePresetValues = useCallback((tabId: string) => {
        return async (presetId: string, values: Record<string, string>) => {
            if (isNewCommandTabId(tabId)) return;
            const cmd = allCommandsRef.current.find((c) => c.id === tabId);
            const preset = cmd?.presets.find((p) => p.id === presetId);
            if (!preset) return;
            try {
                await UpdatePreset(tabId, presetId, preset.name, values);
                await refreshCommand(tabId);
                toast.success(t('toast.presetSaved'));
            } catch (err) {
                console.error('Failed to save preset values:', err);
                toast.error(t('toast.presetSaveFailed'));
            }
        };
    }, [t, refreshCommand]);

    const handleCloseManagePresets = async () => {
        setModal({ type: 'none' });
        const cmds = await loadData();
        if (selectedCommand) {
            const refreshed = cmds.find((c: Command) => c.id === selectedCommand.id);
            if (refreshed) setSelectedCommand(refreshed);
        }
    };

    const makeHandleSaveScript = useCallback((tabId: string) => {
        return async (scriptBody: string) => {
            if (isNewCommandTabId(tabId)) return;
            const d = tabDraftsRef.current[tabId];
            if (!d) return;
            const strippedBody = scriptBody.replace(/^\s+|\s+$/g, '');
            const vars = buildVariablesFromScript(strippedBody, d.variables);

            if (!skipVarRemovalCheckRef.current) {
                const removedWithPresets = computeRemovedVarsWithPresets(tabId, vars);
                if (removedWithPresets.length > 0) {
                    pendingDirectSaveBodyRef.current = scriptBody;
                    setModal({ type: 'confirmVarRemoval', removedVars: removedWithPresets, tabId });
                    return;
                }
            }

            try {
                await UpdateCommand(tabId, d.title.trim(), d.description.trim(), strippedBody, d.categoryId, d.tags.map(tag => tag.trim()).filter(Boolean), vars, d.workingDir);
                await loadData();
                const cmd = allCommandsRef.current.find(c => c.id === tabId);
                if (cmd) {
                    const body = await GetScriptBody(cmd.id);
                    const saved = draftFromCommand(cmd, body);
                    setTabDrafts(prev => ({ ...prev, [tabId]: saved }));
                    setTabBaselines(prev => ({ ...prev, [tabId]: cloneDraft(saved) }));
                    // Only update selectedCommand if this tab is still active,
                    // so tab switches during confirm dialogs don't clobber the UI.
                    if (activeTabIdRef.current === tabId) {
                        setSelectedCommand(cmd);
                    }
                }
                toast.success(t('toast.commandSaved'));
            } catch (err) {
                console.error('Failed to save script:', err);
            }
        };
     
    }, [loadData, t]);

    const handleSaveScriptDirect = useCallback(async (tabId: string, scriptBody: string) => {
        if (isNewCommandTabId(tabId)) return;
        const fn = makeHandleSaveScript(tabId);
        await fn(scriptBody);
    }, [makeHandleSaveScript]);

    // Synchronous cache invalidation during render — ensures stale handlers are never
    // returned between a factory-dep change and the post-commit effect firing.
    // We track the previous factory refs and compare during render; if any changed,
    // clear the cache before any component looks up its handlers.
    const factoryNames = [
        'makeHandleExecute',
        'makeHandleRunInTerminal',
        'makeHandleFillVariables',
        'makeHandleDelete',
        'makeHandleRenamePreset',
        'makeHandleDeletePreset',
        'makeHandleAddPreset',
        'makeHandleSavePresetValues',
        'makeHandleReorderPresets',
        'makeHandleSaveScript',
    ] as const;

    const factories: Record<(typeof factoryNames)[number], (...args: unknown[]) => unknown> = {
        makeHandleExecute,
        makeHandleRunInTerminal,
        makeHandleFillVariables,
        makeHandleDelete,
        makeHandleRenamePreset,
        makeHandleDeletePreset,
        makeHandleAddPreset,
        makeHandleSavePresetValues,
        makeHandleReorderPresets,
        makeHandleSaveScript,
    };

    const prevFactoriesRef = useRef<Record<string, ((...args: unknown[]) => unknown) | null>>(
        Object.fromEntries(factoryNames.map((name) => [name, null]))
    );

    useEffect(() => {
        const pf = prevFactoriesRef.current;
        if (factoryNames.some((name) => pf[name] !== factories[name])) {
            tabHandlerCacheRef.current.clear();
            factoryNames.forEach((name) => {
                pf[name] = factories[name];
            });
        }
    });

    const handleSelectCommand = (cmd: Command) => {
        openTab(cmd);
    };

    const handleSelectRecord = (record: ExecutionRecord) => {
        setSelectedRecord(record);
        setStreamLines([]);
        setOutputPaneOpen(true);
        setHistoryPaneOpen(true);
        if (activeTabId) {
            tabOutputRef.current[activeTabId] = { record, streamLines: [] };
        }
    };

    const handleClearHistory = () => {
        setModal({ type: 'confirmClearHistory' });
    };

    const confirmClearHistory = async () => {
        try {
            await ClearExecutionHistory();
            setExecutionHistory([]);
            setSelectedRecord(null);
            setStreamLines([]);
            tabOutputRef.current = {};
            setModal({ type: 'none' });
        } catch (err) {
            console.error('Failed to clear history:', err);
        }
    };

    /* eslint-disable react-hooks/refs -- keyboard shortcuts use ref-based handlers (not called during render) */
    useKeyboardShortcuts({
        [`${cmdOrCtrl}+p`]: () => setPaletteOpen(true),
        'ctrl+p': () => setPaletteOpen(true),

        [`${cmdOrCtrl}+s`]: () => {
            if (modal.type !== 'none' || !activeTabId || !activeDirty) return;
            void handleSaveTab(activeTabId);
        },

        [`${cmdOrCtrl}+enter`]: () => {
            const el = document.activeElement;
            if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) return;
            if (!selectedCommand || modal.type !== 'none' || isNewCommandTabId(selectedCommand.id)) return;
            if (resolvedVariables.length === 0) {
                handleExecute({});
            } else {
                const hasEmpty = resolvedVariables.some((v) => !currentResolvedValues[v.name]);
                if (hasEmpty) {
                    handleFillVariables(currentResolvedValues);
                } else {
                    handleExecute(currentResolvedValues);
                }
            }
        },

        [`${cmdOrCtrl}+n`]: () => openNewCommandTab(),
        [`${cmdOrCtrl}+t`]: () => openNewCommandTab(),

        [`${cmdOrCtrl}+f`]: () => setPaletteOpen(true),

        [`${cmdOrCtrl}+,`]: async () => {
            await openSettingsWithToast();
        },

        'ctrl+w': () => {
            if (activeTabId) closeTab(activeTabId);
        },
        'meta+w': () => {
            if (activeTabId) closeTab(activeTabId);
        },

        'ctrl+tab': () => {
            if (openTabs.length < 2) return;
            const idx = openTabs.findIndex((t) => t.id === activeTabId);
            const next = openTabs[(idx + 1) % openTabs.length];
            if (next) handleSelectTab(next.id);
        },

        'ctrl+shift+tab': () => {
            if (openTabs.length < 2) return;
            const idx = openTabs.findIndex((t) => t.id === activeTabId);
            const prev = openTabs[(idx - 1 + openTabs.length) % openTabs.length];
            if (prev) handleSelectTab(prev.id);
        },

        [`${cmdOrCtrl}+shift+backspace`]: () => {
            if (activeTabId && activeDirty) {
                handleDiscardTab(activeTabId);
            }
        },

        [SHORTCUTS.toggleOutput.keys.join('+')]: () => {
            setOutputPaneOpen((prev) => !prev);
        },

        // Cmd+1-6: jump to nth tab
        ...Object.fromEntries(
            [1, 2, 3, 4, 5, 6].map((n) => [
                `${cmdOrCtrl}+${n}`,
                () => {
                    const tabs = openTabs.filter((tt) => tt.id !== '__welcome__');
                    if (tabs.length >= n) handleSelectTab(tabs[n - 1].id);
                },
            ]),
        ),
        // Cmd+9: toggle between current and previous tab
        [`${cmdOrCtrl}+9`]: () => {
            const prev = prevTabIdRef.current;
            if (prev && openTabs.some((t) => t.id === prev)) {
                handleSelectTab(prev);
            }
        },
        // Cmd+0: jump to last tab
        [`${cmdOrCtrl}+0`]: () => {
            const tabs = openTabs.filter((tt) => tt.id !== '__welcome__');
            if (tabs.length > 0) handleSelectTab(tabs[tabs.length - 1].id);
        },

        ...(paletteOpen ? { escape: () => setPaletteOpen(false) } : {}),
    });

    /* eslint-enable react-hooks/refs */

    const commandHistory = useMemo(
        () =>
            selectedCommand && !isNewCommandTabId(selectedCommandId)
                ? executionHistory.filter((r) => r.commandId === selectedCommandId)
                : executionHistory,
        [selectedCommand, selectedCommandId, executionHistory],
    );

    // Memoize per-tab variable definitions so inactive tabs get stable references
    // (prevents React.memo bypass from new array on every App render).
    const tabVariablesMap = useMemo(() => {
        const map: Record<string, VarPromptType[]> = {};
        for (const tab of openTabs) {
            if (tab.id === '__welcome__') continue;
            const draft = tabDrafts[tab.id];
            if (draft && !isNewCommandTabId(tab.id)) {
                map[tab.id] = variableDefinitionsToPrompts(draft.variables);
            }
        }
        return map;
    }, [tabDrafts, openTabs]);

    const isWelcome = !selectedCommand && !activeDraft;

    // Only the executing tab should receive isExecuting=true (prevents React.memo
    // bypass on all mounted CommandDetail instances when execution state changes).
    // Driven by state so the executing tab remains pinned even if user switches tabs.
    const executingTabId = executingTabIdState;

    return (
        <TooltipProvider disableHoverableContent>
            <div className="app-layout">
                <div className="app-body">
                    <ResizablePanel
                        side="left"
                        defaultWidth={280}
                        minWidth={190}
                        maxWidth={460}
                        storageKey="cmdex-sidebar"
                        collapsedIcon={
                            <div className="logo-icon" style={{ width: 22, height: 22 }}>
                                <MainLogo width="22" height="22" />
                            </div>
                        }
                    >
                        <Sidebar
                            categories={categories}
                            commands={commands}
                            selectedCommandId={selectedCommand?.id || null}
                            onSelectCommand={handleSelectCommand}
                            onAddCategory={() => setModal({ type: 'categoryEditor' })}
                            onEditCategory={(cat) => setModal({ type: 'categoryEditor', category: cat })}
                            onDeleteCategory={handleDeleteCategory}
                            onAddCommand={(catId) => openNewCommandTab(catId)}
                            onDeleteCommand={handleDeleteCommand}
                            onReorderCommand={handleReorderCommand}
                            onOpenSettings={() => openSettingsWithToast()}
                            onImport={async () => {
                                const [cats, cmds] = await Promise.all([GetCategories(), GetCommands()]);
                                setCategories(cats || []);
                                setCommands(cmds || []);
                            }}
                        />
                    </ResizablePanel>

                    <div className="center-area">
                        <TabBar
                            tabs={tabsForBar}
                            activeTabId={activeTabId}
                            onSelectTab={handleSelectTab}
                            onCloseTab={closeTab}
                        />

                        <div className="top-area">
                            <div className="main-content" ref={mainContentRef}>
                                {/* Loading state: selectedCommand exists but draft hasn't hydrated yet */}
                                {selectedCommand && !activeDraft && (
                                    <div className="main-body">
                                        <p className="text-muted-foreground text-sm p-4">{t('common.loading')}</p>
                                    </div>
                                )}

                                {/* Welcome state: no command selected and no active draft */}
                                {!selectedCommand && !activeDraft && (
                                    <div className="main-body">
                                        <WelcomeTab onNewCommand={() => openNewCommandTab()} />
                                    </div>
                                )}

                                {/* Per-tab mounts: one CommandDetail per open command tab.
                                    Inactive tabs are hidden via display:none so their DOM state
                                    (scroll, cursor, textarea undo) survives across tab switches.
                                    Handlers are cached per tab so React.memo can skip re-renders. */}
                                {openTabs
                                    .filter((tab) => tab.id !== '__welcome__')
                                    // eslint-disable-next-line react-hooks/refs -- handler cache ref accessed during render for React.memo optimization
                                    .map((tab) => {
                                        const draft = tabDrafts[tab.id];
                                        const baseline = tabBaselines[tab.id];
                                        const isTabNew = isNewCommandTabId(tab.id);
                                        const command = isTabNew
                                            ? makePlaceholderCommand(tab.id, draft?.categoryId)
                                            : commands.find((c) => c.id === tab.id) ?? null;
                                        const isTabDirty = !!(draft && baseline && !draftsEqual(draft, baseline));
                                        const isTabActive = tab.id === activeTabId;

                                        // Variable resolution per D-08: active tab uses serverVariables-based
                                        // resolution (existing useMemo keyed on selectedCommand); inactive tabs
                                        // fall back to memoized draft-based variable definitions (stable refs).
                                        const tabVariables = isTabActive
                                            ? resolvedVariables
                                            : (tabVariablesMap[tab.id] ?? []);

                                        if (!command || !draft) return null;

                                        // Use cached handlers so React.memo is effective
                                        let handlers = tabHandlerCacheRef.current.get(tab.id);
                                        if (!handlers) {
                                            handlers = {
                                                onExecute: makeHandleExecute(tab.id),
                                                onRunInTerminal: makeHandleRunInTerminal(tab.id),
                                                onFillVariables: makeHandleFillVariables(tab.id),
                                                onDelete: makeHandleDelete(tab.id, closeTab),
                                                onRenamePreset: makeHandleRenamePreset(tab.id),
                                                onDeletePreset: makeHandleDeletePreset(tab.id),
                                                onAddPreset: makeHandleAddPreset(tab.id),
                                                onSavePresetValues: makeHandleSavePresetValues(tab.id),
                                                onReorderPresets: makeHandleReorderPresets(tab.id),
                                                onSaveScript: makeHandleSaveScript(tab.id),
                                                onDraftChange: (partial: Partial<TabDraft>) => updateDraft(tab.id, partial),
                                            };
                                            tabHandlerCacheRef.current.set(tab.id, handlers);
                                        }

                                        return (
                                            <div
                                                key={tab.id}
                                                className="main-body command-tab-shell"
                                                style={{ display: isTabActive ? 'flex' : 'none' }}
                                            >
                                                <CommandDetail
                                                    command={command}
                                                    draft={draft}
                                                    baselineScriptBody={baseline?.scriptBody || ''}
                                                    onDraftChange={handlers.onDraftChange}
                                                    isNewCommand={isTabNew}
                                                     isExecuting={tab.id === executingTabId}
                                                    variables={tabVariables}
                                                    onExecute={handlers.onExecute}
                                                    onRunInTerminal={handlers.onRunInTerminal}
                                                    onFillVariables={handlers.onFillVariables}
                                                    onDelete={handlers.onDelete}
                                                    onRenamePreset={handlers.onRenamePreset}
                                                    onDeletePreset={handlers.onDeletePreset}
                                                    onAddPreset={handlers.onAddPreset}
                                                    onSavePresetValues={handlers.onSavePresetValues}
                                                    onReorderPresets={handlers.onReorderPresets}
                                                    onResolvedValuesChange={isTabActive ? setCurrentResolvedValues : undefined}
                                                    onSaveScript={handlers.onSaveScript}
                                                    currentOS={currentOS}
                                                    defaultWorkingDir={defaultWorkingDir}
                                                />
                                                <FloatingSaveBar
                                                    visible={isTabDirty}
                                                    saveDisabled={!draft || !draft.scriptBody.trim()}
                                                    onSave={() => void handleSaveTab(tab.id)}
                                                    onDiscard={() => handleDiscardTab(tab.id)}
                                                />
                                            </div>
                                        );
                                    })}
                            </div>

                            {!isWelcome && (
                                <HistoryPane
                                    records={commandHistory}
                                    selectedRecordId={selectedRecord?.id || null}
                                    onSelectRecord={handleSelectRecord}
                                    onClearHistory={handleClearHistory}
                                    defaultCollapsed={!historyPaneOpen}
                                />
                            )}
                        </div>

                        {!isWelcome && (
                            <OutputPane
                                record={selectedRecord}
                                streamLines={streamLines}
                                isExecuting={isExecuting}
                                isOpen={outputPaneOpen}
                                onToggle={() => setOutputPaneOpen((prev) => !prev)}
                            />
                        )}
                    </div>
                </div>

                {modal.type === 'categoryEditor' && (
                    <CategoryEditor
                        category={modal.category}
                        onSave={modal.category ? handleUpdateCategory : handleCreateCategory}
                        onCancel={() => setModal({ type: 'none' })}
                    />
                )}

                {modal.type === 'managePresets' && (
                    <VariablePrompt
                        mode="manage"
                        variables={modal.variables}
                        presets={modal.presets}
                        defaultPresetId={lastSelectedPresetId}
                        onPresetChange={setLastSelectedPresetId}
                        onSubmit={handleVariableSubmit}
                        onCancel={handleCloseManagePresets}
                        onSavePreset={handleSavePreset}
                        onUpdatePreset={handleUpdatePreset}
                        onDeletePreset={handleDeletePreset}
                    />
                )}

                {modal.type === 'fillVariables' && (
                    <VariablePrompt
                        mode="fill"
                        variables={modal.variables}
                        presets={[]}
                        initialValues={modal.initialValues}
                        onSubmit={handleVariableSubmit}
                        onCancel={() => setModal({ type: 'none' })}
                        onSavePreset={async () => {}}
                        onUpdatePreset={async () => {}}
                        onDeletePreset={async () => {}}
                    />
                )}

                <AlertDialog
                    open={modal.type === 'confirmDiscard'}
                    onOpenChange={(open) => {
                        if (!open) {
                            pendingCloseTabIdRef.current = null;
                            setModal({ type: 'none' });
                        }
                    }}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('app.discardTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>{t('app.discardDescription')}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t('app.cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                                variant="destructive"
                                onClick={() => {
                                    setModal({ type: 'none' });
                                    const tabId = pendingCloseTabIdRef.current;
                                    pendingCloseTabIdRef.current = null;
                                    if (tabId) finalizeCloseTab(tabId);
                                }}
                            >
                                {t('app.discard')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <AlertDialog open={modal.type === 'confirmClearHistory'} onOpenChange={(open) => { if (!open) setModal({ type: 'none' }); }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('app.clearHistoryTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>{t('app.clearHistoryDescription')}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t('app.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmClearHistory} variant="destructive">
                                {t('app.delete')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <AlertDialog
                    open={modal.type === 'confirmVarRemoval'}
                    onOpenChange={(open) => { if (!open) setModal({ type: 'none' }); }}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('commandDetail.varRemovalTitle')}</AlertDialogTitle>
                            <AlertDialogDescription className="space-y-2">
                                <span>{t('commandDetail.varRemovalDescription')}</span>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {modal.type === 'confirmVarRemoval' && modal.removedVars.map((v) => (
                                        <Badge key={v} variant="destructive" className="font-mono text-xs">
                                            {'{{' + v + '}}'}
                                        </Badge>
                                    ))}
                                </div>
                                <span className="block mt-2 text-xs text-muted-foreground">
                                    {t('commandDetail.varRemovalNote')}
                                </span>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setModal({ type: 'none' })}>
                                {t('commandDetail.cancel')}
                            </AlertDialogCancel>
                            <AlertDialogAction
                                variant="destructive"
                                onClick={async () => {
                                    if (modal.type !== 'confirmVarRemoval') return;
                                    setModal({ type: 'none' });
                                    skipVarRemovalCheckRef.current = true;
                                    if (pendingDirectSaveBodyRef.current) {
                                        await handleSaveScriptDirect(modal.tabId, pendingDirectSaveBodyRef.current);
                                        pendingDirectSaveBodyRef.current = null;
                                    } else {
                                        await handleSaveTab(modal.tabId);
                                    }
                                    skipVarRemovalCheckRef.current = false;
                                }}
                            >
                                {t('commandEditor.save')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <CommandPalette
                    open={paletteOpen}
                    commands={commands}
                    categories={categories}
                    onClose={() => setPaletteOpen(false)}
                    onOpen={handleSelectCommand}
                />
                <Toaster position="bottom-right" richColors closeButton duration={3000} />
                <KeyboardShortcutsDialog open={shortcutsDialogOpen} onOpenChange={setShortcutsDialogOpen} />
            </div>
        </TooltipProvider>
    );
}

export default App;

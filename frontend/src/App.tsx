import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './style.css';
import Sidebar from './components/Sidebar';
import CommandDetail from './components/CommandDetail';
import CategoryEditor from './components/CategoryEditor';
import VariablePrompt from './components/VariablePrompt';
import HistoryPane from './components/HistoryPane';
import OutputPane from './components/OutputPane';
import SettingsDialog from './components/SettingsDialog';
import ResizablePanel from './components/ResizablePanel';
import TabBar, { Tab } from './components/TabBar';
import CommandPalette from './components/CommandPalette';
import CommandEditorTab from './components/CommandEditorTab';
import { useKeyboardShortcuts, isMac } from './hooks/useKeyboardShortcuts';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { EventsOn } from '../wailsjs/runtime/runtime';
import { Category, Command, VariableDefinition, VariablePrompt as VarPromptType, VariablePreset, ExecutionRecord } from './types';

import {
    GetCategories,
    CreateCategory,
    UpdateCategory,
    DeleteCategory,
    GetCommands,
    CreateCommand,
    UpdateCommand,
    DeleteCommand,
    RenameCommand,
    SearchCommands,
    GetVariables,
    RunCommand,
    GetExecutionHistory,
    ClearExecutionHistory,
    GetPresets,
    SavePreset,
    UpdatePreset,
    DeletePreset,
    GetSettings,
    RunInTerminal,
    ReorderCommand,
} from '../wailsjs/go/main/App';
import i18n from './i18n';

type ModalState =
    | { type: 'none' }
    | { type: 'categoryEditor'; category?: Category }
    | { type: 'managePresets'; variables: VarPromptType[]; commandId: string; presets: VariablePreset[] }
    | { type: 'fillVariables'; variables: VarPromptType[]; commandId: string; initialValues: Record<string, string> }
    | { type: 'confirmDelete'; itemType: 'command' | 'category'; id: string; name: string }
    | { type: 'settings' };

const THEME_STORAGE_KEY = 'cmdex-theme';

export const THEMES = [
    { id: 'vscode-dark', label: 'VS Code Dark+' },
    { id: 'vscode-light', label: 'VS Code Light+' },
    { id: 'monokai', label: 'Monokai' },
    { id: 'tokyo-night', label: 'Tokyo Night' },
    { id: 'one-dark', label: 'One Dark Pro' },
    { id: 'classic', label: 'Classic (Purple)' },
] as const;

function App() {
    const { t } = useTranslation();
    const [categories, setCategories] = useState<Category[]>([]);
    const [commands, setCommands] = useState<Command[]>([]);
    const [selectedCommand, setSelectedCommand] = useState<Command | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [modal, setModal] = useState<ModalState>({ type: 'none' });
    const [isExecuting, setIsExecuting] = useState(false);

    const [executionHistory, setExecutionHistory] = useState<ExecutionRecord[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<ExecutionRecord | null>(null);
    const [outputPaneOpen, setOutputPaneOpen] = useState(true);
    const [resolvedVariables, setResolvedVariables] = useState<VarPromptType[]>([]);
    const [lastSelectedPresetId, setLastSelectedPresetId] = useState<string>('');
    const [streamLines, setStreamLines] = useState<string[]>([]);
    const streamBufferRef = useRef<string[]>([]);
    const streamFlushRef = useRef<number | null>(null);

    // Tab management
    const [openTabs, setOpenTabs] = useState<Tab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);

    // Command palette
    const [paletteOpen, setPaletteOpen] = useState(false);

    interface EditorTabData {
        command?: Command;
        defaultCategoryId?: string;
    }
    const [editorTabData, setEditorTabData] = useState<EditorTabData | null>(null);

    // Theme
    const [theme, setTheme] = useState<string>(() => localStorage.getItem(THEME_STORAGE_KEY) || 'vscode-dark');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    }, [theme]);

    // Keep tab titles in sync when commands are renamed
    useEffect(() => {
        if (selectedCommand) {
            setOpenTabs(prev => prev.map(t =>
                t.id === selectedCommand.id ? { ...t, title: selectedCommand.title } : t
            ));
        }
    }, [selectedCommand?.title]);

    const loadData = useCallback(async () => {
        try {
            const cats = await GetCategories();
            const cmds = await GetCommands();
            setCategories(cats || []);
            setCommands(cmds || []);
        } catch (err) {
            console.error('Failed to load data:', err);
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
        loadData();
        loadHistory();
        GetSettings().then(s => {
            if (s?.locale && s.locale !== i18n.language) {
                i18n.changeLanguage(s.locale);
            }
        }).catch(() => {});
    }, [loadData, loadHistory]);

    useEffect(() => {
        const cleanup = EventsOn('open-settings', () => setModal({ type: 'settings' }));
        return cleanup;
    }, []);

    useEffect(() => {
        if (!searchQuery.trim()) {
            GetCommands().then(cmds => setCommands(cmds || []));
        } else {
            SearchCommands(searchQuery).then(cmds => setCommands(cmds || []));
        }
    }, [searchQuery]);

    useEffect(() => {
        if (selectedCommand) {
            GetVariables(selectedCommand.id)
                .then(vars => setResolvedVariables(vars || []))
                .catch(() => setResolvedVariables([]));
        } else {
            setResolvedVariables([]);
        }
    }, [selectedCommand]);

    // ========== Category handlers ==========

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
        const cat = categories.find(c => c.id === catId);
        if (!cat) return;
        setModal({ type: 'confirmDelete', itemType: 'category', id: catId, name: cat.name });
    };

    const confirmDelete = async () => {
        if (modal.type !== 'confirmDelete') return;
        const { itemType } = modal;
        try {
            if (itemType === 'category') {
                await DeleteCategory(modal.id);
                if (selectedCommand?.categoryId === modal.id) {
                    setSelectedCommand(null);
                }
            } else {
                await DeleteCommand(modal.id);
                if (selectedCommand?.id === modal.id) {
                    closeTab(modal.id);
                }
            }
            await loadData();
            setModal({ type: 'none' });
            toast.success(itemType === 'category' ? t('toast.categoryDeleted') : t('toast.commandDeleted'));
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    };

    // ========== Command handlers ==========

    const handleCreateCommand = async (data: {
        title: string; description: string; scriptBody: string; categoryId: string; tags: string[]; variables: VariableDefinition[];
    }) => {
        try {
            const cmd = await CreateCommand(data.title, data.description, data.scriptBody, data.categoryId, data.tags, data.variables);
            await loadData();
            openTab(cmd);
            closeEditorTab();
            toast.success(t('toast.commandCreated'));
        } catch (err) {
            console.error('Failed to create command:', err);
        }
    };

    const handleUpdateCommand = async (data: {
        title: string; description: string; scriptBody: string; categoryId: string; tags: string[]; variables: VariableDefinition[];
    }) => {
        if (!editorTabData?.command) return;
        try {
            const cmd = await UpdateCommand(editorTabData.command.id, data.title, data.description, data.scriptBody, data.categoryId, data.tags, data.variables);
            await loadData();
            openTab(cmd);
            closeEditorTab();
            toast.success(t('toast.commandSaved'));
        } catch (err) {
            console.error('Failed to update command:', err);
        }
    };

    const handleRenameCommand = async (newTitle: string) => {
        if (!selectedCommand) return;
        try {
            const cmd = await RenameCommand(selectedCommand.id, newTitle);
            await loadData();
            openTab(cmd);
        } catch (err) {
            console.error('Failed to rename command:', err);
        }
    };

    // ========== Tab management ==========

    const openTab = (cmd: Command) => {
        setSelectedCommand(cmd);
        setSelectedRecord(null);
        setActiveTabId(cmd.id);
        setOpenTabs(prev => {
            const exists = prev.find(t => t.id === cmd.id);
            if (exists) {
                return prev.map(t => t.id === cmd.id ? { ...t, title: cmd.title, kind: 'command' as const } : t);
            }
            return [...prev, { id: cmd.id, title: cmd.title, kind: 'command' as const }];
        });
    };

    const EDITOR_TAB_ID = '__editor__';

    const openEditorTab = useCallback((data: EditorTabData) => {
        setEditorTabData(data);
        setActiveTabId(EDITOR_TAB_ID);
        setOpenTabs(prev => {
            const exists = prev.find(t => t.id === EDITOR_TAB_ID);
            const title = data.command ? `Edit: ${data.command.title}` : 'New Command';
            if (exists) return prev.map(t => t.id === EDITOR_TAB_ID ? { ...t, title, isDirty: false } : t);
            return [...prev, { id: EDITOR_TAB_ID, title, kind: 'editor' as const, isDirty: false }];
        });
    }, []);

    const closeEditorTab = useCallback(() => {
        setEditorTabData(null);
        setOpenTabs(prev => {
            const newTabs = prev.filter(t => t.id !== EDITOR_TAB_ID);
            if (activeTabId === EDITOR_TAB_ID) {
                const lastCmd = [...newTabs].reverse().find(t => t.kind === 'command');
                if (lastCmd) {
                    const cmd = commands.find(c => c.id === lastCmd.id);
                    if (cmd) { setSelectedCommand(cmd); setActiveTabId(lastCmd.id); }
                } else {
                    setSelectedCommand(null);
                    setActiveTabId(null);
                }
            }
            return newTabs;
        });
    }, [activeTabId, commands]);

    const closeTab = (commandId: string) => {
        if (commandId === EDITOR_TAB_ID) {
            const editorTab = openTabs.find(t => t.id === EDITOR_TAB_ID);
            if (editorTab?.isDirty && !confirm('Discard unsaved changes?')) return;
            closeEditorTab();
            return;
        }
        setOpenTabs(prev => {
            const newTabs = prev.filter(t => t.id !== commandId);
            if (activeTabId === commandId) {
                const idx = prev.findIndex(t => t.id === commandId);
                const nextTab = newTabs[Math.min(idx, newTabs.length - 1)];
                if (nextTab) {
                    const nextCmd = commands.find(c => c.id === nextTab.id);
                    if (nextCmd) {
                        setSelectedCommand(nextCmd);
                        setActiveTabId(nextTab.id);
                    } else {
                        setSelectedCommand(null);
                        setActiveTabId(null);
                    }
                } else {
                    setSelectedCommand(null);
                    setActiveTabId(null);
                }
            }
            return newTabs;
        });
    };

    const handleSelectTab = (commandId: string) => {
        if (commandId === activeTabId) return;
        const cmd = commands.find(c => c.id === commandId);
        if (cmd) {
            setSelectedCommand(cmd);
            setActiveTabId(commandId);
            setSelectedRecord(null);
        }
    };

    // ========== Execution handlers ==========

    const handleExecute = async (values: Record<string, string>) => {
        if (!selectedCommand) return;
        runCommandDirect(selectedCommand.id, values);
    };

    const handleRunInTerminal = async (values: Record<string, string>) => {
        if (!selectedCommand) return;
        try {
            await RunInTerminal(selectedCommand.id, values);
        } catch (err) {
            toast.error(String(err));
        }
    };

    const handleManagePresets = async () => {
        if (!selectedCommand) return;
        const vars = await GetVariables(selectedCommand.id);
        const presets = await GetPresets(selectedCommand.id);
        setModal({
            type: 'managePresets',
            variables: vars || [],
            commandId: selectedCommand.id,
            presets: presets || [],
        });
    };

    const handleManagePresetsForCommand = async (cmd: Command) => {
        const vars = await GetVariables(cmd.id);
        const presets = await GetPresets(cmd.id);
        setModal({
            type: 'managePresets',
            variables: vars || [],
            commandId: cmd.id,
            presets: presets || [],
        });
    };

    const handleDeleteCommand = (cmd: Command) => {
        setModal({
            type: 'confirmDelete',
            itemType: 'command',
            id: cmd.id,
            name: cmd.title,
        });
    };

    const handleReorderCommand = async (id: string, newPosition: number, newCategoryId: string) => {
        try {
            const updated = await ReorderCommand(id, newPosition, newCategoryId);
            if (searchQuery.trim()) {
                const filtered = await SearchCommands(searchQuery);
                setCommands(filtered || []);
            } else {
                setCommands(updated || []);
            }
        } catch (err) {
            console.error('Failed to reorder command:', err);
        }
    };

    const handleFillVariables = async (initialValues: Record<string, string>) => {
        if (!selectedCommand) return;
        const vars = await GetVariables(selectedCommand.id);
        setModal({
            type: 'fillVariables',
            variables: vars || [],
            commandId: selectedCommand.id,
            initialValues,
        });
    };

    const handleVariableSubmit = async (values: Record<string, string>) => {
        if (!selectedCommand) return;
        setModal({ type: 'none' });
        runCommandDirect(selectedCommand.id, values);
    };

    const MAX_STREAM_LINES = 5000;

    const flushStreamBuffer = useCallback(() => {
        setStreamLines(prev => {
            const combined = [...prev, ...streamBufferRef.current];
            streamBufferRef.current = [];
            if (combined.length > MAX_STREAM_LINES) {
                return combined.slice(combined.length - MAX_STREAM_LINES);
            }
            return combined;
        });
        streamFlushRef.current = null;
    }, []);

    const runCommandDirect = async (commandId: string, variables: Record<string, string>) => {
        setIsExecuting(true);
        setSelectedRecord(null);
        setStreamLines([]);
        streamBufferRef.current = [];
        setOutputPaneOpen(true);

        const cleanup = EventsOn('cmd-output', (chunk: { stream: string; data: string }) => {
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
            setSelectedRecord(record);
            await loadHistory();
            if (record.exitCode === 0) {
                toast.success(t('toast.commandSuccess'));
            } else {
                toast.error(t('toast.commandFailed', { code: record.exitCode }));
            }
        } catch (err) {
            setSelectedRecord({
                id: '',
                commandId: commandId,
                scriptContent: '',
                finalCmd: '',
                output: '',
                error: String(err),
                exitCode: -1,
                executedAt: new Date().toISOString(),
            });
            toast.error(t('toast.commandFailed', { code: -1 }));
        } finally {
            cleanup();
            setIsExecuting(false);
        }
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

    const handleAddPresetFromDetail = async (): Promise<string> => {
        if (!selectedCommand) return '';
        await SavePreset(selectedCommand.id, 'New Preset', {});
        const cmds = await GetCommands();
        setCommands(cmds || []);
        const refreshed = (cmds || []).find((c: Command) => c.id === selectedCommand.id);
        if (refreshed) setSelectedCommand(refreshed);
        // Return the ID of the last (newly created) preset
        return refreshed?.presets?.at(-1)?.id ?? '';
    };

    const handleRenamePresetFromDetail = async (presetId: string, newName: string) => {
        if (!selectedCommand) return;
        const preset = selectedCommand.presets.find(p => p.id === presetId);
        if (!preset) return;
        await UpdatePreset(selectedCommand.id, presetId, newName, preset.values);
        const cmds = await GetCommands();
        setCommands(cmds || []);
        const refreshed = (cmds || []).find((c: Command) => c.id === selectedCommand.id);
        if (refreshed) setSelectedCommand(refreshed);
    };

    const handleDeletePresetFromDetail = async (presetId: string) => {
        if (!selectedCommand) return;
        await DeletePreset(selectedCommand.id, presetId);
        const cmds = await GetCommands();
        setCommands(cmds || []);
        const refreshed = (cmds || []).find((c: Command) => c.id === selectedCommand.id);
        if (refreshed) setSelectedCommand(refreshed);
    };

    const handleSavePresetValuesFromDetail = async (presetId: string, values: Record<string, string>) => {
        if (!selectedCommand) return;
        const preset = selectedCommand.presets.find(p => p.id === presetId);
        if (!preset) return;
        await UpdatePreset(selectedCommand.id, presetId, preset.name, values);
        const cmds = await GetCommands();
        setCommands(cmds || []);
        const refreshed = (cmds || []).find((c: Command) => c.id === selectedCommand.id);
        if (refreshed) setSelectedCommand(refreshed);
        toast.success(t('toast.presetSaved'));
    };

    const handleCloseManagePresets = async () => {
        setModal({ type: 'none' });
        await loadData();
        if (selectedCommand) {
            const cmds = await GetCommands();
            const refreshed = (cmds || []).find((c: Command) => c.id === selectedCommand.id);
            if (refreshed) setSelectedCommand(refreshed);
        }
    };

    const handleSelectCommand = (cmd: Command) => {
        openTab(cmd);
    };

    const handleSelectRecord = (record: ExecutionRecord) => {
        setSelectedRecord(record);
        setStreamLines([]);
        setOutputPaneOpen(true);
    };

    const handleClearHistory = async () => {
        try {
            await ClearExecutionHistory();
            setExecutionHistory([]);
            setSelectedRecord(null);
        } catch (err) {
            console.error('Failed to clear history:', err);
        }
    };

    // ========== Keyboard shortcuts ==========

    const cmdOrCtrl = isMac ? 'meta' : 'ctrl';

    useKeyboardShortcuts({
        // Command palette
        [`${cmdOrCtrl}+p`]: () => setPaletteOpen(true),
        'ctrl+p': () => setPaletteOpen(true), // also catch ctrl+p on mac

        // Run active command
        [`${cmdOrCtrl}+enter`]: () => {
            if (!selectedCommand || modal.type !== 'none') return;
            if (resolvedVariables.length === 0) {
                handleExecute({});
            } else {
                const vals: Record<string, string> = {};
                resolvedVariables.forEach(v => { vals[v.name] = v.defaultValue || ''; });
                const hasEmpty = resolvedVariables.some(v => !v.defaultValue);
                if (hasEmpty) {
                    handleFillVariables(vals);
                } else {
                    handleExecute(vals);
                }
            }
        },

        // Edit active command
        [`${cmdOrCtrl}+e`]: () => {
            if (selectedCommand && activeTabId !== EDITOR_TAB_ID) {
                openEditorTab({ command: selectedCommand });
            }
        },

        // New command (Cmd/Ctrl+N or Cmd/Ctrl+T)
        [`${cmdOrCtrl}+n`]: () => {
            if (activeTabId !== EDITOR_TAB_ID) openEditorTab({});
        },
        [`${cmdOrCtrl}+t`]: () => {
            if (activeTabId !== EDITOR_TAB_ID) openEditorTab({});
        },
        'ctrl+t': () => {
            if (activeTabId !== EDITOR_TAB_ID) openEditorTab({});
        },
        'meta+t': () => {
            if (activeTabId !== EDITOR_TAB_ID) openEditorTab({});
        },

        // Settings
        [`${cmdOrCtrl}+,`]: () => {
            if (modal.type === 'none') setModal({ type: 'settings' });
        },

        // Close active tab
        'ctrl+w': () => {
            if (activeTabId) closeTab(activeTabId);
        },
        'meta+w': () => {
            if (activeTabId) closeTab(activeTabId);
        },

        // Next tab
        'ctrl+tab': () => {
            if (openTabs.length < 2) return;
            const idx = openTabs.findIndex(t => t.id === activeTabId);
            const next = openTabs[(idx + 1) % openTabs.length];
            if (next) handleSelectTab(next.id);
        },

        // Previous tab
        'ctrl+shift+tab': () => {
            if (openTabs.length < 2) return;
            const idx = openTabs.findIndex(t => t.id === activeTabId);
            const prev = openTabs[(idx - 1 + openTabs.length) % openTabs.length];
            if (prev) handleSelectTab(prev.id);
        },

        // Close palette / modals
        'escape': () => {
            if (paletteOpen) { setPaletteOpen(false); return; }
        },
    });

    // Filter history to active command
    const commandHistory = selectedCommand
        ? executionHistory.filter(r => r.commandId === selectedCommand.id)
        : executionHistory;

    return (
        <TooltipProvider>
            <div className="app-layout">
                <div className="app-body">
                    <ResizablePanel
                        side="left"
                        defaultWidth={280}
                        minWidth={180}
                        maxWidth={460}
                        storageKey="cmdex-sidebar"
                        collapsedIcon={
                            <div className="logo-icon" style={{ width: 22, height: 22 }}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="22" height="22">
                                  <rect width="1024" height="1024" rx="180" ry="180" fill="currentColor" fillOpacity="0.1"/>
                                  <text x="240" y="620" fontFamily="SF Mono, Menlo, Monaco, Consolas, monospace" fontSize="480" fontWeight="800" fill="currentColor" letterSpacing="-20">C</text>
                                  <text x="530" y="620" fontFamily="SF Mono, Menlo, Monaco, Consolas, monospace" fontSize="320" fontWeight="700" fill="var(--primary)">&gt;_</text>
                                </svg>
                            </div>
                        }
                    >
                        <Sidebar
                            categories={categories}
                            commands={commands}
                            selectedCommandId={selectedCommand?.id || null}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onSelectCommand={handleSelectCommand}
                            onAddCategory={() => setModal({ type: 'categoryEditor' })}
                            onEditCategory={(cat) => setModal({ type: 'categoryEditor', category: cat })}
                            onDeleteCategory={handleDeleteCategory}
                            onAddCommand={(catId) => openEditorTab({ defaultCategoryId: catId })}
                            onEditCommand={(cmd) => openEditorTab({ command: cmd })}
                            onDeleteCommand={handleDeleteCommand}
                            onManagePresets={handleManagePresetsForCommand}
                            onReorderCommand={handleReorderCommand}
                            onOpenSettings={() => setModal({ type: 'settings' })}
                        />
                    </ResizablePanel>

                    <div className="center-area">
                        {/* Tab bar */}
                        <TabBar
                            tabs={openTabs}
                            activeTabId={activeTabId}
                            onSelectTab={handleSelectTab}
                            onCloseTab={closeTab}
                        />

                        <div className="top-area">
                            <div className="main-content">
                                {activeTabId === EDITOR_TAB_ID && editorTabData !== null ? (
                                    <CommandEditorTab
                                        command={editorTabData.command}
                                        categories={categories}
                                        defaultCategoryId={editorTabData.defaultCategoryId}
                                        onSave={editorTabData.command ? handleUpdateCommand : handleCreateCommand}
                                        onDiscard={() => {
                                            const editorTab = openTabs.find(t => t.id === EDITOR_TAB_ID);
                                            if (!editorTab?.isDirty || confirm('Discard unsaved changes?')) {
                                                closeEditorTab();
                                            }
                                        }}
                                        onDirtyChange={(dirty) => {
                                            setOpenTabs(prev => prev.map(t =>
                                                t.id === EDITOR_TAB_ID ? { ...t, isDirty: dirty } : t
                                            ));
                                        }}
                                    />
                                ) : selectedCommand ? (
                                    <div className="main-body">
                                        <CommandDetail
                                            command={selectedCommand}
                                            isExecuting={isExecuting}
                                            variables={resolvedVariables}
                                            onExecute={handleExecute}
                                            onRunInTerminal={handleRunInTerminal}
                                            onManagePresets={handleManagePresets}
                                            onFillVariables={handleFillVariables}
                                            onEdit={() => openEditorTab({ command: selectedCommand })}
                                            onDelete={() =>
                                                setModal({
                                                    type: 'confirmDelete',
                                                    itemType: 'command',
                                                    id: selectedCommand.id,
                                                    name: selectedCommand.title,
                                                })
                                            }
                                            onRename={handleRenameCommand}
                                            onAddPreset={handleAddPresetFromDetail as () => Promise<string>}
                                            onRenamePreset={handleRenamePresetFromDetail}
                                            onDeletePreset={handleDeletePresetFromDetail}
                                            onSavePresetValues={handleSavePresetValuesFromDetail}
                                        />
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <div className="empty-icon">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="64" height="64">
                                              <rect width="1024" height="1024" rx="180" ry="180" fill="currentColor" fillOpacity="0.05"/>
                                              <text x="240" y="620" fontFamily="SF Mono, Menlo, Monaco, Consolas, monospace" fontSize="480" fontWeight="800" fill="currentColor" letterSpacing="-20">C</text>
                                              <text x="530" y="620" fontFamily="SF Mono, Menlo, Monaco, Consolas, monospace" fontSize="320" fontWeight="700" fill="var(--primary)">&gt;_</text>
                                            </svg>
                                        </div>
                                        <h2>{t('app.welcomeTitle')}</h2>
                                        <p>{t('app.welcomeDescription')}</p>
                                        <Button onClick={() => openEditorTab({})}>
                                            {t('app.newCommand')}
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <HistoryPane
                                records={commandHistory}
                                selectedRecordId={selectedRecord?.id || null}
                                onSelectRecord={handleSelectRecord}
                                onClearHistory={handleClearHistory}
                            />
                        </div>

                        <OutputPane
                            record={selectedRecord}
                            streamLines={streamLines}
                            isExecuting={isExecuting}
                            isOpen={outputPaneOpen}
                            onToggle={() => setOutputPaneOpen(prev => !prev)}
                        />
                    </div>
                </div>

                {/* Modals */}
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

                <AlertDialog open={modal.type === 'confirmDelete'} onOpenChange={(open) => { if (!open) setModal({ type: 'none' }); }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('app.confirmDeleteTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {modal.type === 'confirmDelete' && (
                                    <>
                                        {t('app.confirmDeleteMessage', { itemType: modal.itemType, name: modal.name })}
                                        {modal.itemType === 'category' && ` ${t('app.confirmDeleteCategoryWarning')}`}
                                        <br /><br />
                                        {t('app.confirmDeleteUndone')}
                                    </>
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t('app.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">
                                {t('app.delete')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <SettingsDialog
                    open={modal.type === 'settings'}
                    onClose={() => setModal({ type: 'none' })}
                    theme={theme}
                    onThemeChange={setTheme}
                />
                <CommandPalette
                    open={paletteOpen}
                    commands={commands}
                    categories={categories}
                    onClose={() => setPaletteOpen(false)}
                    onOpen={handleSelectCommand}
                />
                <Toaster position="bottom-right" richColors closeButton duration={3000} />
            </div>
        </TooltipProvider>
    );
}

export default App;

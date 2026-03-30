import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './style.css';
import Sidebar from './components/Sidebar';
import CommandDetail from './components/CommandDetail';
import CommandEditor from './components/CommandEditor';
import CategoryEditor from './components/CategoryEditor';
import VariablePrompt from './components/VariablePrompt';
import HistoryPane from './components/HistoryPane';
import OutputPane from './components/OutputPane';
import SettingsDialog from './components/SettingsDialog';
import ResizablePanel from './components/ResizablePanel';
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
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime';
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
    | { type: 'commandEditor'; command?: Command; defaultCategoryId?: string }
    | { type: 'categoryEditor'; category?: Category }
    | { type: 'managePresets'; variables: VarPromptType[]; commandId: string; presets: VariablePreset[] }
    | { type: 'fillVariables'; variables: VarPromptType[]; commandId: string; initialValues: Record<string, string> }
    | { type: 'confirmDelete'; itemType: 'command' | 'category'; id: string; name: string };

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
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [lastSelectedPresetId, setLastSelectedPresetId] = useState<string>('');
    const [streamLines, setStreamLines] = useState<string[]>([]);
    const streamBufferRef = useRef<string[]>([]);
    const streamFlushRef = useRef<number | null>(null);

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
        const cleanup = EventsOn('open-settings', () => setSettingsOpen(true));
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
                    setSelectedCommand(null);
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
            setSelectedCommand(cmd);
            setModal({ type: 'none' });
            toast.success(t('toast.commandCreated'));
        } catch (err) {
            console.error('Failed to create command:', err);
        }
    };

    const handleUpdateCommand = async (data: {
        title: string; description: string; scriptBody: string; categoryId: string; tags: string[]; variables: VariableDefinition[];
    }) => {
        if (modal.type !== 'commandEditor' || !modal.command) return;
        try {
            const cmd = await UpdateCommand(modal.command.id, data.title, data.description, data.scriptBody, data.categoryId, data.tags, data.variables);
            await loadData();
            setSelectedCommand(cmd);
            setModal({ type: 'none' });
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
            setSelectedCommand(cmd);
        } catch (err) {
            console.error('Failed to rename command:', err);
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
            setCommands(updated || []);
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
            // Final flush of any remaining buffered lines
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
        setSelectedCommand(cmd);
        setSelectedRecord(null);
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

    return (
        <TooltipProvider>
            <div className="app-layout">
                <ResizablePanel
                    side="left"
                    defaultWidth={300}
                    minWidth={200}
                    maxWidth={480}
                    storageKey="commamer-sidebar"
                    collapsedIcon={
                        <div className="logo-icon" style={{ width: 24, height: 24, fontSize: 12 }}>⌘</div>
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
                        onAddCommand={(catId) => setModal({ type: 'commandEditor', defaultCategoryId: catId })}
                        onEditCommand={(cmd) => setModal({ type: 'commandEditor', command: cmd })}
                        onDeleteCommand={handleDeleteCommand}
                        onManagePresets={handleManagePresetsForCommand}
                        onReorderCommand={handleReorderCommand}
                        onOpenSettings={() => setSettingsOpen(true)}
                    />
                </ResizablePanel>

                <div className="center-area">
                    <div className="top-area">
                        <div className="main-content">
                            {selectedCommand ? (
                                <>
                                    <div className="main-header">
                                        <div />
                                        <div className="header-actions" />
                                    </div>
                                    <div className="main-body">
                                        <CommandDetail
                                            command={selectedCommand}
                                            isExecuting={isExecuting}
                                            variables={resolvedVariables}
                                            onExecute={handleExecute}
                                            onRunInTerminal={handleRunInTerminal}
                                            onManagePresets={handleManagePresets}
                                            onFillVariables={handleFillVariables}
                                            onEdit={() => setModal({ type: 'commandEditor', command: selectedCommand })}
                                            onDelete={() =>
                                                setModal({
                                                    type: 'confirmDelete',
                                                    itemType: 'command',
                                                    id: selectedCommand.id,
                                                    name: selectedCommand.title,
                                                })
                                            }
                                            onRename={handleRenameCommand}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-icon">⌘</div>
                                    <h2>{t('app.welcomeTitle')}</h2>
                                    <p>{t('app.welcomeDescription')}</p>
                                    <Button onClick={() => setModal({ type: 'commandEditor' })}>
                                        {t('app.newCommand')}
                                    </Button>
                                </div>
                            )}
                        </div>

                        <HistoryPane
                            records={executionHistory}
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

                {/* Modals */}
                {modal.type === 'commandEditor' && (
                    <CommandEditor
                        command={modal.command}
                        categories={categories}
                        defaultCategoryId={modal.defaultCategoryId}
                        onSave={modal.command ? handleUpdateCommand : handleCreateCommand}
                        onCancel={() => setModal({ type: 'none' })}
                    />
                )}

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
                <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
                <Toaster position="bottom-right" richColors closeButton duration={3000} />
            </div>
        </TooltipProvider>
    );
}

export default App;

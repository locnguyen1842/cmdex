import { useState, useEffect, useCallback } from 'react';
import './style.css';
import Sidebar from './components/Sidebar';
import CommandDetail from './components/CommandDetail';
import CommandEditor from './components/CommandEditor';
import CategoryEditor from './components/CategoryEditor';
import VariablePrompt from './components/VariablePrompt';
import { Category, Command, VariablePrompt as VarPromptType, ExecutionResult } from './types';

// Wails bindings — these are auto-generated at build/dev time
import {
    GetCategories,
    CreateCategory,
    UpdateCategory,
    DeleteCategory,
    GetCommands,
    CreateCommand,
    UpdateCommand,
    DeleteCommand,
    SearchCommands,
    GetVariables,
    RunCommand,
} from '../wailsjs/go/main/App';

type ModalState =
    | { type: 'none' }
    | { type: 'commandEditor'; command?: Command; defaultCategoryId?: string }
    | { type: 'categoryEditor'; category?: Category }
    | { type: 'variablePrompt'; variables: VarPromptType[]; commandText: string }
    | { type: 'confirmDelete'; itemType: 'command' | 'category'; id: string; name: string };

function App() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [commands, setCommands] = useState<Command[]>([]);
    const [selectedCommand, setSelectedCommand] = useState<Command | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [modal, setModal] = useState<ModalState>({ type: 'none' });
    const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);

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

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Filter commands when search changes
    useEffect(() => {
        if (!searchQuery.trim()) {
            GetCommands().then(cmds => setCommands(cmds || []));
        } else {
            SearchCommands(searchQuery).then(cmds => setCommands(cmds || []));
        }
    }, [searchQuery]);

    // ========== Category handlers ==========

    const handleCreateCategory = async (data: { name: string; color: string }) => {
        try {
            await CreateCategory(data.name, '', data.color);
            await loadData();
            setModal({ type: 'none' });
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
        try {
            if (modal.itemType === 'category') {
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
            setExecutionResult(null);
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    };

    // ========== Command handlers ==========

    const handleCreateCommand = async (data: {
        title: string; description: string; commandText: string; categoryId: string; tags: string[];
    }) => {
        try {
            const cmd = await CreateCommand(data.title, data.description, data.commandText, data.categoryId, data.tags);
            await loadData();
            setSelectedCommand(cmd);
            setModal({ type: 'none' });
            setExecutionResult(null);
        } catch (err) {
            console.error('Failed to create command:', err);
        }
    };

    const handleUpdateCommand = async (data: {
        title: string; description: string; commandText: string; categoryId: string; tags: string[];
    }) => {
        if (modal.type !== 'commandEditor' || !modal.command) return;
        try {
            const cmd = await UpdateCommand(modal.command.id, data.title, data.description, data.commandText, data.categoryId, data.tags);
            await loadData();
            setSelectedCommand(cmd);
            setModal({ type: 'none' });
        } catch (err) {
            console.error('Failed to update command:', err);
        }
    };

    // ========== Execution handlers ==========

    const handleExecute = async () => {
        if (!selectedCommand) return;

        // Check for variables
        const vars = await GetVariables(selectedCommand.commandText);
        if (vars && vars.length > 0) {
            setModal({
                type: 'variablePrompt',
                variables: vars,
                commandText: selectedCommand.commandText,
            });
            return;
        }

        // No variables — execute directly
        runCommandDirect(selectedCommand.commandText, {});
    };

    const handleVariableSubmit = async (values: Record<string, string>) => {
        if (!selectedCommand) return;
        setModal({ type: 'none' });
        runCommandDirect(selectedCommand.commandText, values);
    };

    const runCommandDirect = async (commandText: string, variables: Record<string, string>) => {
        setIsExecuting(true);
        setExecutionResult(null);
        try {
            const result = await RunCommand(commandText, variables);
            setExecutionResult(result);
        } catch (err) {
            setExecutionResult({
                output: '',
                error: String(err),
                exitCode: -1,
            });
        } finally {
            setIsExecuting(false);
        }
    };

    const handleSelectCommand = (cmd: Command) => {
        setSelectedCommand(cmd);
        setExecutionResult(null);
    };

    return (
        <div className="app-layout">
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
            />

            <div className="main-content">
                {selectedCommand ? (
                    <>
                        <div className="main-header">
                            <div />
                            <div className="header-actions">
                                {/* Header actions can be added here */}
                            </div>
                        </div>
                        <div className="main-body">
                            <CommandDetail
                                command={selectedCommand}
                                executionResult={executionResult}
                                isExecuting={isExecuting}
                                onExecute={handleExecute}
                                onEdit={() => setModal({ type: 'commandEditor', command: selectedCommand })}
                                onDelete={() =>
                                    setModal({
                                        type: 'confirmDelete',
                                        itemType: 'command',
                                        id: selectedCommand.id,
                                        name: selectedCommand.title,
                                    })
                                }
                            />
                        </div>
                    </>
                ) : (
                    <div className="empty-state">
                        <div className="empty-icon">⌘</div>
                        <h2>Welcome to Commamer</h2>
                        <p>Select a command from the sidebar or create a new one to get started.</p>
                        <button
                            className="btn btn-primary"
                            onClick={() => setModal({ type: 'commandEditor' })}
                        >
                            + New Command
                        </button>
                    </div>
                )}
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

            {modal.type === 'variablePrompt' && (
                <VariablePrompt
                    variables={modal.variables}
                    commandText={modal.commandText}
                    onSubmit={handleVariableSubmit}
                    onCancel={() => setModal({ type: 'none' })}
                />
            )}

            {modal.type === 'confirmDelete' && (
                <div className="modal-overlay" onClick={() => setModal({ type: 'none' })}>
                    <div className="modal" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Confirm Delete</h2>
                            <button className="btn-icon" onClick={() => setModal({ type: 'none' })}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                Are you sure you want to delete {modal.itemType} "<strong>{modal.name}</strong>"?
                                {modal.itemType === 'category' && ' All commands in this category will also be deleted.'}
                                <br /><br />
                                This action cannot be undone.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setModal({ type: 'none' })}>Cancel</button>
                            <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Command, VariablePrompt } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
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
import {
  Pencil,
  Copy,
  Check,
  Play,
  Plus,
  Loader2,
  SquareTerminal,
  X,
} from "lucide-react";
import { GetScriptBody } from "../../wailsjs/go/main/App";
import { isMac } from "../hooks/useKeyboardShortcuts";

const cmdKey = isMac ? '⌘' : 'Ctrl';

function ShortcutHint({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <span className="tooltip-with-shortcut">
      {label} <kbd className="kbd">{shortcut}</kbd>
    </span>
  );
}

interface CommandDetailProps {
  command: Command;
  isExecuting: boolean;
  variables: VariablePrompt[];
  onExecute: (values: Record<string, string>) => void;
  onRunInTerminal: (values: Record<string, string>) => void;
  onManagePresets: () => void;
  onFillVariables: (initialValues: Record<string, string>) => void;
  onEdit: () => void;
  onDelete: () => void;
  onRename: (newTitle: string) => void;
  onRenamePreset: (presetId: string, newName: string) => Promise<void>;
  onDeletePreset: (presetId: string) => Promise<void>;
  onAddPreset: () => Promise<string>;
  onSavePresetValues: (presetId: string, values: Record<string, string>) => Promise<void>;
}

const CommandDetail: React.FC<CommandDetailProps> = ({
  command,
  isExecuting,
  variables,
  onExecute,
  onRunInTerminal,
  onManagePresets,
  onFillVariables,
  onEdit,
  onDelete,
  onRename,
  onRenamePreset,
  onDeletePreset,
  onAddPreset,
  onSavePresetValues,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [editingVar, setEditingVar] = useState<string | null>(null);
  const [editingVarValue, setEditingVarValue] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [titleDraft, setTitleDraft] = useState("");
  const [scriptBody, setScriptBody] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Inline chip rename state
  const [renamingChipId, setRenamingChipId] = useState<string | null>(null);
  const [renamingChipDraft, setRenamingChipDraft] = useState('');

  // Context menu state
  const [chipContextMenu, setChipContextMenu] = useState<{ presetId: string; x: number; y: number } | null>(null);

  // Confirm delete preset state
  const [confirmDeletePresetId, setConfirmDeletePresetId] = useState<string | null>(null);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  useEffect(() => {
    GetScriptBody(command.id)
      .then((body) => setScriptBody(body))
      .catch(() => setScriptBody(""));
  }, [command.id, command.scriptContent]);

  useEffect(() => {
    setOverrides({});
  }, [command.id, selectedPresetId]);

  // Close context menu on mousedown outside the menu
  useEffect(() => {
    if (!chipContextMenu) return;
    const close = () => setChipContextMenu(null);
    window.addEventListener('mousedown', close);
    return () => {
      window.removeEventListener('mousedown', close);
    };
  }, [chipContextMenu]);

  const handleTitleDoubleClick = () => {
    setTitleDraft(command.title);
    setEditingTitle(true);
  };

  const commitTitleEdit = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== command.title) {
      onRename(trimmed);
    }
    setEditingTitle(false);
  };

  const commitChipRename = async () => {
    if (!renamingChipId) return;
    const trimmed = renamingChipDraft.trim().slice(0, 30);
    if (!trimmed) {
      alert('Preset name must not be empty');
      return;
    }
    await onRenamePreset(renamingChipId, trimmed);
    setRenamingChipId(null);
  };

  const resolvedValues = useMemo(() => {
    const vals: Record<string, string> = {};
    if (selectedPresetId) {
      const preset = command.presets.find((p) => p.id === selectedPresetId);
      if (preset) {
        variables.forEach((v) => {
          vals[v.name] = preset.values[v.name] ?? v.defaultValue ?? "";
        });
        return { ...vals, ...overrides };
      }
    }
    variables.forEach((v) => {
      vals[v.name] = v.defaultValue ?? "";
    });
    return { ...vals, ...overrides };
  }, [selectedPresetId, command.presets, variables, overrides]);

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedPresetId || Object.keys(overrides).length === 0) return false;
    const preset = command.presets.find(p => p.id === selectedPresetId);
    if (!preset) return false;
    return Object.entries(overrides).some(([k, v]) => {
      const stored = preset.values[k] ?? variables.find(x => x.name === k)?.defaultValue ?? '';
      return v !== stored;
    });
  }, [selectedPresetId, overrides, command.presets, variables]);

  const renderScriptWithVars = useMemo(() => {
    if (!scriptBody) return null;
    const parts = scriptBody.split(/(\{\{\w+\}\})/g);
    return parts.map((part, i) => {
      if (/^\{\{\w+\}\}$/.test(part)) {
        const varName = part.slice(2, -2);
        const val = resolvedValues[varName];
        return (
          <span key={i} className="var-missing" title={varName}>
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }, [scriptBody, resolvedValues]);

  const renderScriptResolved = useMemo(() => {
    if (!scriptBody) return null;
    const parts = scriptBody.split(/(\{\{\w+\}\})/g);
    return parts.map((part, i) => {
      if (/^\{\{\w+\}\}$/.test(part)) {
        const varName = part.slice(2, -2);
        const val = resolvedValues[varName];
        const isFocused = editingVar === varName;
        if (val) {
          return (
            <span key={i} className={`var-filled${isFocused ? ' var-focused' : ''}`} title={`${varName}=${val}`}>
              {val}
            </span>
          );
        }
        return (
          <span key={i} className={`var-missing${isFocused ? ' var-focused' : ''}`} title={varName}>
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }, [scriptBody, resolvedValues, editingVar]);

  const getResolvedScript = useMemo(() => {
    if (!scriptBody) return "";
    return scriptBody.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return resolvedValues[varName] || match;
    });
  }, [scriptBody, resolvedValues]);

  const handleCopy = useCallback(() => {
    const textToCopy = getResolvedScript || scriptBody;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch((err) => {
      console.error("Failed to copy to clipboard:", err);
      setCopied(false);
    });
  }, [getResolvedScript, scriptBody]);


  return (
    <div className="command-detail">
      <div className="detail-header">
        {editingTitle ? (
          <Input
            ref={titleInputRef}
            className="detail-title-input text-2xl font-bold h-auto py-1"
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitleEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitleEdit();
              if (e.key === "Escape") setEditingTitle(false);
            }}
          />
        ) : (
          <h1
            className="detail-title"
            onDoubleClick={handleTitleDoubleClick}
            title={t("commandDetail.doubleClickToRename")}
          >
            {command.title}
          </h1>
        )}
        {command.tags && command.tags.length > 0 && (
          <div className="detail-tags">
            {command.tags.map((tag, i) => (
              <Badge key={i} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {command.description && (
          <p className="detail-description">{command.description}</p>
        )}
      </div>

      <div className="detail-section">
        <div className="detail-section-title">
          {t("commandDetail.command")}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" onClick={onEdit}>
                <Pencil />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <ShortcutHint label={t("commandDetail.editCommand")} shortcut={`${cmdKey}E`} />
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="command-text-box-glow">
          <div className="command-text-box-inner">
            <div className="command-text-box-header">
              <div className="flex items-center gap-1.5">
                <span className="command-text-box-label">Template</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-primary hover:text-primary"
                      disabled={isExecuting}
                      onClick={() => {
                        if (variables.length === 0) {
                          onExecute({});
                        } else {
                          const defaults: Record<string, string> = {};
                          variables.forEach((v) => { defaults[v.name] = v.defaultValue ?? ""; });
                          onFillVariables(defaults);
                        }
                      }}
                    >
                      {isExecuting ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isExecuting ? t("commandDetail.running") : <ShortcutHint label={t("commandDetail.execute")} shortcut={`${cmdKey}↩`} />}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="command-text-box-header-actions">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" onClick={() => onRunInTerminal(resolvedValues)}>
                      <SquareTerminal className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("commandDetail.runInTerminal")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" onClick={handleCopy}>
                      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{copied ? t("commandDetail.copied") : t("commandDetail.copyCommand")}</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="command-text-box">
              <code className="whitespace-pre-wrap">{renderScriptWithVars}</code>
            </div>
          </div>
        </div>
      </div>


      {variables.length > 0 && (
        <div className="detail-section mt-4">
          <div className="detail-section-title">
            {t("commandDetail.arguments")}
          </div>

          {/* Preset chip row */}
          <div className="preset-chips">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="preset-chip preset-chip-add"
                  onClick={async () => {
                    const newId = await onAddPreset();
                    setSelectedPresetId(newId);
                    setRenamingChipId(newId);
                    setRenamingChipDraft('New Preset');
                  }}
                >
                  <Plus size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Add preset</TooltipContent>
            </Tooltip>
            {command.presets && command.presets.map((p) => {
              if (renamingChipId === p.id) {
                return (
                  <input
                    key={p.id}
                    className="preset-chip preset-chip-renaming"
                    autoFocus
                    value={renamingChipDraft}
                    onChange={(e) => setRenamingChipDraft(e.target.value.slice(0, 30))}
                    onBlur={commitChipRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitChipRename(); }
                      if (e.key === 'Escape') { setRenamingChipId(null); }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                );
              }
              return (
                <button
                  key={p.id}
                  className={`preset-chip${selectedPresetId === p.id ? ' active' : ''}`}
                  onClick={() => setSelectedPresetId(p.id)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    setRenamingChipId(p.id);
                    setRenamingChipDraft(p.name);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setChipContextMenu({ presetId: p.id, x: e.clientX, y: e.clientY });
                  }}
                >
                  {p.name}
                </button>
              );
            })}
          </div>

          {/* Script preview with resolved values */}
          <div className="command-text-box-glow">
            <div className="command-text-box-inner">
              <div className="command-text-box-header">
                <div className="flex items-center gap-1.5">
                  <span className="command-text-box-label">Preview</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-primary hover:text-primary"
                        disabled={isExecuting}
                        onClick={() => {
                          const hasEmpty = variables.some((v) => !resolvedValues[v.name]);
                          if (hasEmpty) {
                            onFillVariables(resolvedValues);
                          } else {
                            onExecute(resolvedValues);
                          }
                        }}
                      >
                        {isExecuting ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isExecuting ? t("commandDetail.running") : <ShortcutHint label={t("commandDetail.execute")} shortcut={`${cmdKey}↩`} />}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="command-text-box-header-actions">
                  {hasUnsavedChanges && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setOverrides({})}
                          >
                            <X className="size-3.5 text-muted-foreground" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Revert changes</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={async () => {
                              await onSavePresetValues(selectedPresetId, resolvedValues);
                              setOverrides({});
                            }}
                          >
                            <Check className="size-3.5 text-success" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Save preset values</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-xs" onClick={() => onRunInTerminal(resolvedValues)}>
                        <SquareTerminal className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("commandDetail.runInTerminal")}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-xs" onClick={handleCopy}>
                        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{copied ? t("commandDetail.copied") : t("commandDetail.copyCommand")}</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="command-text-box text-xs">
                <code className="text-xs whitespace-pre-wrap break-all">{renderScriptResolved}</code>
              </div>
              <div className="preset-vars-panel">
                <div className="preset-vars-list">
                  {variables.map((v) => {
                    const val = resolvedValues[v.name];
                    const isEditing = editingVar === v.name;
                    return (
                      <div key={v.name} className={`preset-var-row${val ? '' : ' preset-var-row-empty'}`}>
                        <span className="preset-var-name" title={"{{" + v.name + "}}"}>{v.name}</span>
                        {isEditing ? (
                          <input
                            className="preset-var-input"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            autoFocus
                            value={editingVarValue}
                            onChange={(e) => setEditingVarValue(e.target.value)}
                            onBlur={() => {
                              if (editingVar) {
                                setOverrides(prev => ({ ...prev, [editingVar]: editingVarValue }));
                              }
                              setEditingVar(null);
                            }}
                            onKeyDown={async (e) => {
                              if (e.key === 'Tab') {
                                e.preventDefault();
                                if (editingVar) {
                                  setOverrides(prev => ({ ...prev, [editingVar]: editingVarValue }));
                                }
                                const idx = variables.findIndex(x => x.name === editingVar);
                                const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
                                if (nextIdx >= 0 && nextIdx < variables.length) {
                                  const next = variables[nextIdx];
                                  setEditingVar(next.name);
                                  setEditingVarValue(resolvedValues[next.name] || '');
                                } else {
                                  setEditingVar(null);
                                }
                              }
                              if (e.key === 'Enter') {
                                const saveValues = { ...resolvedValues, ...(editingVar ? { [editingVar]: editingVarValue } : {}) };
                                setEditingVar(null);
                                if (selectedPresetId) {
                                  await onSavePresetValues(selectedPresetId, saveValues);
                                  setOverrides({});
                                } else {
                                  if (editingVar) setOverrides(prev => ({ ...prev, [editingVar]: editingVarValue }));
                                }
                              }
                              if (e.key === 'Escape') setEditingVar(null);
                            }}
                          />
                        ) : (
                          <span
                            className={`preset-var-value${val ? '' : ' empty'}`}
                            onClick={() => {
                              setEditingVar(v.name);
                              setEditingVarValue(val || '');
                            }}
                            title="Click to edit"
                          >
                            {val || <span className="preset-var-placeholder">click to set…</span>}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Right-click context menu for preset chips — rendered via portal to avoid clipping */}
      {chipContextMenu && createPortal(
        <div
          className="chip-context-menu"
          style={{ top: chipContextMenu.y, left: chipContextMenu.x }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="chip-context-item"
            onMouseDown={(e) => {
              e.preventDefault();
              const preset = command.presets.find(p => p.id === chipContextMenu.presetId);
              if (preset) {
                setRenamingChipId(preset.id);
                setRenamingChipDraft(preset.name);
                setSelectedPresetId(preset.id);
              }
              setChipContextMenu(null);
            }}
          >
            Rename
          </button>
          <button
            className="chip-context-item chip-context-item-danger"
            onMouseDown={(e) => {
              e.preventDefault();
              setConfirmDeletePresetId(chipContextMenu.presetId);
              setChipContextMenu(null);
            }}
          >
            Delete
          </button>
        </div>,
        document.body
      )}

      {/* Confirm delete preset dialog */}
      <AlertDialog open={confirmDeletePresetId !== null} onOpenChange={(open) => { if (!open) setConfirmDeletePresetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Preset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this preset? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (confirmDeletePresetId) {
                  await onDeletePreset(confirmDeletePresetId);
                  if (selectedPresetId === confirmDeletePresetId) setSelectedPresetId('');
                }
                setConfirmDeletePresetId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CommandDetail;

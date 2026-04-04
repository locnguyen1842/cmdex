import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
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
import { toast } from 'sonner';
import { GetScriptBody } from "../../wailsjs/go/main/App";
import { cmdSymbol as cmdKey } from "../hooks/useKeyboardShortcuts";

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
  onResolvedValuesChange?: (values: Record<string, string>) => void;
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
  onResolvedValuesChange,
}) => {
  const { t } = useTranslation();
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [copiedPreview, setCopiedPreview] = useState(false);
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

  // Confirm delete preset state
  const [confirmDeletePresetId, setConfirmDeletePresetId] = useState<string | null>(null);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);

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
      setRenamingChipId(null);
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

  useEffect(() => {
    onResolvedValuesChange?.(resolvedValues);
  }, [resolvedValues, onResolvedValuesChange]);

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedPresetId) return false;
    const preset = command.presets.find(p => p.id === selectedPresetId);
    if (!preset) return false;
    // Check overrides
    const hasOverrideChanges = Object.entries(overrides).some(([k, v]) => {
      const stored = preset.values[k] ?? variables.find(x => x.name === k)?.defaultValue ?? '';
      return v !== stored;
    });
    if (hasOverrideChanges) return true;
    // Check currently editing value (not yet in overrides)
    if (editingVar) {
      const stored = preset.values[editingVar] ?? variables.find(x => x.name === editingVar)?.defaultValue ?? '';
      return editingVarValue !== stored;
    }
    return false;
  }, [selectedPresetId, overrides, command.presets, variables, editingVar, editingVarValue]);

  const scriptParts = useMemo(() => scriptBody ? scriptBody.split(/(\{\{\w+\}\})/g) : null, [scriptBody]);

  const renderScriptWithVars = useMemo(() => {
    if (!scriptParts) return null;
    return scriptParts.map((part, i) => {
      if (/^\{\{\w+\}\}$/.test(part)) {
        const varName = part.slice(2, -2);
        return (
          <span key={i} className="var-missing" title={varName}>
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }, [scriptParts]);

  const renderScriptResolved = useMemo(() => {
    if (!scriptParts) return null;
    return scriptParts.map((part, i) => {
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
  }, [scriptParts, resolvedValues, editingVar]);

  const getResolvedScript = useMemo(() => {
    if (!scriptBody) return "";
    return scriptBody.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return resolvedValues[varName] || match;
    });
  }, [scriptBody, resolvedValues]);

  const handleCopyTemplate = useCallback(() => {
    navigator.clipboard.writeText(scriptBody).then(() => {
      setCopiedTemplate(true);
      setTimeout(() => setCopiedTemplate(false), 1500);
    }).catch((err) => {
      console.error("Failed to copy to clipboard:", err);
      setCopiedTemplate(false);
    });
  }, [scriptBody]);

  const handleCopyPreview = useCallback(() => {
    const textToCopy = getResolvedScript;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedPreview(true);
      setTimeout(() => setCopiedPreview(false), 1500);
    }).catch((err) => {
      console.error("Failed to copy to clipboard:", err);
      setCopiedPreview(false);
    });
  }, [getResolvedScript]);


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
                <span className="command-text-box-label">{t("commandDetail.template")}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-primary hover:text-primary"
                      disabled={isExecuting}
                      onClick={() => onExecute(resolvedValues)}
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
                    <Button variant="ghost" size="icon-xs" onClick={handleCopyTemplate}>
                      {copiedTemplate ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{copiedTemplate ? t("commandDetail.copied") : t("commandDetail.copyCommand")}</TooltipContent>
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
            {/* Default preset chip */}
            <button
              className={`preset-chip${selectedPresetId === "" ? ' active' : ''}`}
              onClick={() => setSelectedPresetId("")}
            >
              {t("commandDetail.defaultPreset")}
            </button>
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
                <ContextMenu key={p.id}>
                  <ContextMenuTrigger asChild>
                    <button
                      className={`preset-chip${selectedPresetId === p.id ? ' active' : ''}`}
                      onClick={() => setSelectedPresetId(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'F2') {
                          e.preventDefault();
                          setRenamingChipId(p.id);
                          setRenamingChipDraft(p.name);
                        }
                      }}
                    >
                      {p.name}
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() => {
                        setRenamingChipId(p.id);
                        setRenamingChipDraft(p.name);
                        setSelectedPresetId(p.id);
                      }}
                    >
                      {t("commandDetail.rename")}
                    </ContextMenuItem>
                    <ContextMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setConfirmDeletePresetId(p.id)}
                    >
                      {t("commandDetail.delete")}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="preset-chip preset-chip-add"
                  onClick={async () => {
                    const newId = await onAddPreset();
                    setSelectedPresetId(newId);
                    setRenamingChipId(newId);
                    setRenamingChipDraft(t("commandDetail.newPresetName"));
                  }}
                >
                  <Plus size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("commandDetail.addPreset")}</TooltipContent>
            </Tooltip>
          </div>

          {/* Script preview with resolved values */}
          <div className="command-text-box-glow">
            <div className="command-text-box-inner">
              <div className="command-text-box-header">
                <div className="flex items-center gap-1.5">
                  <span className="command-text-box-label">{t("commandDetail.preview")}</span>
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
                        <TooltipContent>{t("commandDetail.revertChanges")}</TooltipContent>
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
                        <TooltipContent>{t("commandDetail.savePresetValues")}</TooltipContent>
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
                      <Button variant="ghost" size="icon-xs" onClick={handleCopyPreview}>
                        {copiedPreview ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{copiedPreview ? t("commandDetail.copied") : t("commandDetail.copyCommand")}</TooltipContent>
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
                                e.preventDefault();
                                if (editingVar) {
                                  setOverrides(prev => ({ ...prev, [editingVar]: editingVarValue }));
                                }
                                if (selectedPresetId) {
                                  const saveValues = { ...resolvedValues, [editingVar]: editingVarValue };
                                  try {
                                    await onSavePresetValues(selectedPresetId, saveValues);
                                    setEditingVar(null);
                                    setOverrides({});
                                  } catch (err) {
                                    toast.error(t('commandDetail.savePresetFailed'));
                                  }
                                } else {
                                  setEditingVar(null);
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
                            title={t("commandDetail.clickToEdit")}
                          >
                            {val || <span className="preset-var-placeholder">{t("commandDetail.clickToSet")}</span>}
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

      {/* Confirm delete preset dialog */}
      <AlertDialog open={confirmDeletePresetId !== null} onOpenChange={(open) => { if (!open) { setConfirmDeletePresetId(null); setDeletingPresetId(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("commandDetail.deletePresetTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("commandDetail.deletePresetDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("commandDetail.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const id = deletingPresetId || confirmDeletePresetId;
                if (id) {
                  await onDeletePreset(id);
                  if (selectedPresetId === id) setSelectedPresetId('');
                }
                setConfirmDeletePresetId(null);
                setDeletingPresetId(null);
              }}
            >
              {t("commandDetail.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CommandDetail;

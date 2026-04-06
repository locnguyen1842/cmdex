import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import type { Command, TabDraft, VariablePrompt } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
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
  Copy,
  Check,
  Play,
  Plus,
  Loader2,
  Pencil,
  SquareTerminal,
  X,
  ALargeSmall,
  Hash,
} from 'lucide-react';
import { toast } from 'sonner';
import { cmdSymbol as cmdKey } from '../hooks/useKeyboardShortcuts';
import { Kbd } from '@/components/ui/kbd';
import { Heading } from '@/components/ui/heading';
import { mergeDetectedVariables, extractTemplateVarNames } from '../utils/templateVars';
import { cn } from '@/lib/utils';

interface HighlightedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}

const HighlightedTextarea: React.FC<HighlightedTextareaProps> = ({
  value,
  onChange,
  onKeyDown,
  onBlur,
  autoFocus,
  placeholder,
  className = '',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const syncScroll = useCallback(() => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const highlighted = useMemo(() => {
    const parts = value.split(/(\{\{\w+\}\})/g);
    return parts.map((part, i) => {
      if (/^\{\{\w+\}\}$/.test(part)) {
        return <mark key={i} className="var-highlight">{part}</mark>;
      }
      return <span key={i}>{part}</span>;
    });
  }, [value]);

  return (
    <div className={`highlighted-textarea-wrap ${className}`}>
      <div ref={backdropRef} className="highlighted-textarea-backdrop" aria-hidden>
        <code>{highlighted}{'\n'}</code>
      </div>
      <Textarea
        ref={textareaRef}
        className="highlighted-textarea-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onScroll={syncScroll}
        autoFocus={autoFocus}
        placeholder={placeholder}
      />
    </div>
  );
};

function ShortcutHint({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <span className="tooltip-with-shortcut">
      {label} <Kbd>{shortcut}</Kbd>
    </span>
  );
}

interface SortablePresetChipProps {
  id: string;
  name: string;
  isActive: boolean;
  isRenaming: boolean;
  renamingDraft: string;
  onSelect: () => void;
  onDoubleClick: () => void;
  onSetRenaming: (id: string, name: string) => void;
  onRenameChange: (val: string) => void;
  onCommitRename: () => void;
  onConfirmDelete: (id: string) => void;
  renameLabel: string;
  deleteLabel: string;
  presetNamePlaceholder: string;
}

const SortablePresetChip: React.FC<SortablePresetChipProps> = ({
  id,
  name,
  isActive,
  isRenaming,
  renamingDraft,
  onSelect,
  onDoubleClick,
  onSetRenaming,
  onRenameChange,
  onCommitRename,
  onConfirmDelete,
  renameLabel,
  deleteLabel,
  presetNamePlaceholder,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    display: 'inline-flex',
  };

  if (isRenaming) {
    return (
      <div ref={setNodeRef} style={style}>
        <input
          className="preset-chip preset-chip-renaming"
          autoFocus
          placeholder={presetNamePlaceholder}
          value={renamingDraft}
          onChange={(e) => onRenameChange(e.target.value.slice(0, 30))}
          onBlur={onCommitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onCommitRename(); }
            if (e.key === 'Escape') onCommitRename();
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            className={`preset-chip${isActive ? ' active' : ''}`}
            onClick={onSelect}
            onDoubleClick={(e) => { e.preventDefault(); onDoubleClick(); }}
            onKeyDown={(e) => {
              if (e.key === 'F2') { e.preventDefault(); onDoubleClick(); }
            }}
          >
            {name}
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => { onSetRenaming(id, name); onSelect(); }}>
            {renameLabel}
          </ContextMenuItem>
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onConfirmDelete(id)}
          >
            {deleteLabel}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
};

export interface CommandDetailProps {
  command: Command;
  draft: TabDraft;
  baselineScriptBody: string;
  onDraftChange: (partial: Partial<TabDraft>) => void;
  isNewCommand: boolean;
  isExecuting: boolean;
  variables: VariablePrompt[];
  onExecute: (values: Record<string, string>) => void;
  onRunInTerminal: (values: Record<string, string>) => void;
  onFillVariables: (initialValues: Record<string, string>) => void;
  onDelete: () => void;
  onRenamePreset: (presetId: string, newName: string) => Promise<void>;
  onDeletePreset: (presetId: string) => Promise<void>;
  onAddPreset: (initialValues?: Record<string, string>) => Promise<string>;
  onSavePresetValues: (presetId: string, values: Record<string, string>) => Promise<void>;
  onReorderPresets: (presetIds: string[]) => Promise<void>;
  onResolvedValuesChange?: (values: Record<string, string>) => void;
  onSaveScript?: (scriptBody: string) => Promise<void>;
}

const CommandDetail: React.FC<CommandDetailProps> = ({
  command,
  draft,
  baselineScriptBody,
  onDraftChange,
  isNewCommand,
  isExecuting,
  variables,
  onExecute,
  onRunInTerminal,
  onFillVariables,
  onDelete,
  onRenamePreset,
  onDeletePreset,
  onAddPreset,
  onSavePresetValues,
  onReorderPresets,
  onResolvedValuesChange,
  onSaveScript,
}) => {
  const { t } = useTranslation();
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [focusedVarName, setFocusedVarName] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [tagInput, setTagInput] = useState('');
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [editingTagDraft, setEditingTagDraft] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [scriptEditor, setScriptEditor] = useState(() => isNewCommand);
  const [renamingChipId, setRenamingChipId] = useState<string | null>(null);
  const [renamingChipDraft, setRenamingChipDraft] = useState('');
  const [confirmDeletePresetId, setConfirmDeletePresetId] = useState<string | null>(null);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const [newlyCreatedPresetId, setNewlyCreatedPresetId] = useState<string | null>(null);
  const preAddPresetIdRef = useRef<string>('');
  const [scriptEditDraft, setScriptEditDraft] = useState('');
  const [showScriptDiscardConfirm, setShowScriptDiscardConfirm] = useState(false);
  const [pendingRemovedVars, setPendingRemovedVars] = useState<string[]>([]);
  const [showVarRemovalConfirm, setShowVarRemovalConfirm] = useState(false);
  const scriptWrapRef = useRef<HTMLDivElement>(null);
  const scriptEditDraftRef = useRef('');
  scriptEditDraftRef.current = scriptEditDraft;
  const scriptBodyRef = useRef('');

  const presetSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handlePresetDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !command.presets) return;
      const oldIndex = command.presets.findIndex((p) => p.id === active.id);
      const newIndex = command.presets.findIndex((p) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const ids = command.presets.map((p) => p.id);
      ids.splice(oldIndex, 1);
      ids.splice(newIndex, 0, active.id as string);
      onReorderPresets(ids);
    },
    [command.presets, onReorderPresets],
  );

  const presetIds = useMemo(
    () => (command.presets || []).map((p) => p.id),
    [command.presets],
  );

  const scriptBody = draft.scriptBody;
  scriptBodyRef.current = scriptBody;

  const titleHeadingRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const el = titleHeadingRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const next = draft.title ?? '';
    if (el.textContent !== next) {
      el.textContent = next;
    }
  }, [draft.title, command.id]);

  const handleTitleInput = useCallback(
    (e: React.FormEvent<HTMLHeadingElement>) => {
      const el = e.currentTarget;
      const normalized = (el.textContent ?? '').replace(/\r?\n/g, ' ');
      if (normalized !== (el.textContent ?? '')) {
        el.textContent = normalized;
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(el);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      onDraftChange({ title: normalized });
    },
    [onDraftChange],
  );

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLHeadingElement>) => {
    if (e.key === 'Enter') e.preventDefault();
  }, []);

  const handleTitlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLHeadingElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text/plain').replace(/\r?\n/g, ' ');
      const el = titleHeadingRef.current;
      if (!el) return;
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(pasted));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      onDraftChange({ title: el.textContent ?? '' });
    },
    [onDraftChange],
  );

  useEffect(() => {
    if (isNewCommand) {
      setScriptEditor(!draft.scriptBody.trim());
    } else {
      setScriptEditor(false);
    }
  }, [command.id, isNewCommand]);

  useEffect(() => {
    setOverrides({});
  }, [command.id, selectedPresetId]);

  useEffect(() => {
    if (command.presets && command.presets.length > 0) {
      const isValidPreset = command.presets.some((p) => p.id === selectedPresetId);
      if (!isValidPreset) {
        const newId = command.presets[0].id;
        setSelectedPresetId(newId);
      }
    }
  }, [command.id, command.presets, selectedPresetId]);

  const commitChipRename = async () => {
    if (!renamingChipId) return;
    const trimmed = renamingChipDraft.trim().slice(0, 30);
    if (!trimmed) {
      if (renamingChipId === newlyCreatedPresetId) {
        await onDeletePreset(renamingChipId);
        setSelectedPresetId(preAddPresetIdRef.current);
        setNewlyCreatedPresetId(null);
      }
      setRenamingChipId(null);
      return;
    }
    await onRenamePreset(renamingChipId, trimmed);
    if (renamingChipId === newlyCreatedPresetId) setNewlyCreatedPresetId(null);
    setRenamingChipId(null);
  };

  const reveal = useCallback(
    (key: keyof TabDraft['revealed']) => {
      onDraftChange({
        revealed: { ...draft.revealed, [key]: true },
      });
    },
    [draft.revealed, onDraftChange],
  );

  const handleScriptBodyChange = useCallback(
    (body: string) => {
      onDraftChange({
        scriptBody: body,
        variables: mergeDetectedVariables(body, draft.variables),
      });
    },
    [draft.variables, onDraftChange],
  );

  useEffect(() => {
    if (!scriptEditor || isNewCommand) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (scriptWrapRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.('.command-text-box-glow')) return;
      if ((target as HTMLElement).closest?.('[role="alertdialog"]')) return;
      if (scriptEditDraftRef.current === scriptBodyRef.current) {
        setScriptEditor(false);
      } else {
        setShowScriptDiscardConfirm(true);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [scriptEditor, isNewCommand]);

  const enterScriptEdit = useCallback(() => {
    setScriptEditDraft(scriptBody);
    setScriptEditor(true);
  }, [scriptBody]);

  const doSaveScriptEdit = useCallback(() => {
    handleScriptBodyChange(scriptEditDraft);
    setScriptEditor(false);
    if (!isNewCommand && onSaveScript) {
      onSaveScript(scriptEditDraft);
    }
  }, [scriptEditDraft, handleScriptBodyChange, isNewCommand, onSaveScript]);

  const saveScriptEdit = useCallback(() => {
    if (!isNewCommand && command.presets && command.presets.length > 0) {
      const oldVars = extractTemplateVarNames(scriptBody);
      const newVars = new Set(extractTemplateVarNames(scriptEditDraft));
      const removed = oldVars.filter((v) => !newVars.has(v));
      if (removed.length > 0) {
        setPendingRemovedVars(removed);
        setShowVarRemovalConfirm(true);
        return;
      }
    }
    doSaveScriptEdit();
  }, [isNewCommand, command.presets, scriptBody, scriptEditDraft, doSaveScriptEdit]);

  const discardScriptEdit = useCallback(() => {
    setScriptEditDraft(baselineScriptBody);
    setScriptEditor(false);
  }, [baselineScriptBody]);

  const hasScriptChanges = scriptEditor && !isNewCommand && scriptEditDraft !== scriptBody;

  const resolvedValues = useMemo(() => {
    const vals: Record<string, string> = {};
    if (selectedPresetId) {
      const preset = command.presets.find((p) => p.id === selectedPresetId);
      if (preset) {
        variables.forEach((v) => {
          vals[v.name] = preset.values[v.name] ?? v.defaultValue ?? '';
        });
        return { ...vals, ...overrides };
      }
    }
    variables.forEach((v) => {
      vals[v.name] = v.defaultValue ?? '';
    });
    return { ...vals, ...overrides };
  }, [selectedPresetId, command.presets, variables, overrides]);

  useEffect(() => {
    onResolvedValuesChange?.(resolvedValues);
  }, [resolvedValues, onResolvedValuesChange]);

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedPresetId) return false;
    const preset = command.presets.find((p) => p.id === selectedPresetId);
    if (!preset) return false;
    return Object.entries(overrides).some(([k, v]) => {
      const stored = preset.values[k] ?? variables.find((x) => x.name === k)?.defaultValue ?? '';
      return v !== stored;
    });
  }, [selectedPresetId, overrides, command.presets, variables]);

  const scriptParts = useMemo(
    () => (scriptBody ? scriptBody.split(/(\{\{\w+\}\})/g) : null),
    [scriptBody],
  );

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
        const isFocused = focusedVarName === varName;
        if (val) {
          return (
            <span
              key={i}
              className={`var-filled${isFocused ? ' var-focused' : ''}`}
              title={`${varName}=${val}`}
            >
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
  }, [scriptParts, resolvedValues, focusedVarName]);

  const getResolvedScript = useMemo(() => {
    if (!scriptBody) return '';
    return scriptBody.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
      return resolvedValues[varName] || `{{${varName}}}`;
    });
  }, [scriptBody, resolvedValues]);

  const handleCopyTemplate = useCallback(() => {
    navigator.clipboard
      .writeText(scriptBody)
      .then(() => {
        setCopiedTemplate(true);
        setTimeout(() => setCopiedTemplate(false), 1500);
      })
      .catch(() => setCopiedTemplate(false));
  }, [scriptBody]);

  const handleCopyPreview = useCallback(() => {
    navigator.clipboard
      .writeText(getResolvedScript)
      .then(() => {
        setCopiedPreview(true);
        setTimeout(() => setCopiedPreview(false), 1500);
      })
      .catch(() => setCopiedPreview(false));
  }, [getResolvedScript]);

  const TAG_REGEX = /^[a-zA-Z0-9-]+$/;

  const commitNewTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && TAG_REGEX.test(trimmed) && !draft.tags.includes(trimmed)) {
      onDraftChange({ tags: [...draft.tags, trimmed] });
    }
    setTagInput('');
    setAddingTag(false);
  };

  const commitEditTag = () => {
    if (editingTagIndex === null) return;
    const trimmed = editingTagDraft.trim();
    if (!trimmed || !TAG_REGEX.test(trimmed)) {
      setEditingTagIndex(null);
      return;
    }
    const updated = [...draft.tags];
    if (draft.tags.includes(trimmed) && draft.tags[editingTagIndex] !== trimmed) {
      setEditingTagIndex(null);
      return;
    }
    updated[editingTagIndex] = trimmed;
    onDraftChange({ tags: updated });
    setEditingTagIndex(null);
  };

  const showHeaderBlock =
    draft.revealed.title ||
    draft.revealed.description ||
    draft.revealed.tags;

  const showTitle = draft.revealed.title;
  const showDescription = draft.revealed.description;
  const showTags = draft.revealed.tags;

  return (
    <div className="command-detail">
      {showHeaderBlock && (
        <div className="detail-header">
          {showTitle && (
            <div className="hover-actions-host detail-header-title-wrap inline-icon-field">
              <Heading
                ref={titleHeadingRef}
                level={1}
                className={cn(
                  'text-center title-contenteditable w-full min-w-0 cursor-text outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm',
                  !draft.title.trim() && 'title-contenteditable--empty',
                )}
                contentEditable
                suppressContentEditableWarning
                aria-label={t('commandEditor.title')}
                data-placeholder={t('commandEditor.titlePlaceholder')}
                onInput={handleTitleInput}
                onKeyDown={handleTitleKeyDown}
                onPaste={handleTitlePaste}
              />
              {(!draft.revealed.description || !draft.revealed.tags) && (
                <div className="add-field-pill-anchor">
                  {!draft.revealed.description && (
                    <button
                      type="button"
                      className="add-title-pill"
                      onClick={(e) => { e.stopPropagation(); reveal('description'); }}
                    >
                      <ALargeSmall className="size-3 shrink-0" />
                      <span className="add-title-pill-label">{t('commandDetail.addDescription')}</span>
                    </button>
                  )}
                  {!draft.revealed.tags && (
                    <button
                      type="button"
                      className="add-title-pill"
                      onClick={(e) => { e.stopPropagation(); reveal('tags'); }}
                    >
                      <Hash className="size-3 shrink-0" />
                      <span className="add-title-pill-label">{t('commandDetail.addTags')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {showTags && (
            <div className="inline-icon-field pt-0!">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Hash className="inline-icon-field-icon" color="var(--primary)" />
                </TooltipTrigger>
                <TooltipContent>{t('commandDetail.tagsTooltip')}</TooltipContent>
              </Tooltip>
              <div className="tags-badge-row">
                {draft.tags.map((tag, idx) => (
                  <Badge key={tag} variant="outline-default" className="tag-badge group">
                    {editingTagIndex === idx ? (
                      <input
                        className="tag-edit-input"
                        autoFocus
                        style={{ width: '23ch' }}
                        value={editingTagDraft}
                        onChange={(e) => {
                          let trimmed = e.target.value.replace(/[^a-zA-Z0-9-]/g, '');
                          if (trimmed.length > 30) {
                            trimmed = trimmed.slice(0, 30);
                          }
                          setEditingTagDraft(trimmed);
                        }}
                        onBlur={commitEditTag}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); commitEditTag(); }
                          if (e.key === 'Escape') setEditingTagIndex(null);
                        }}
                      />
                    ) : (
                      <>
                        <span
                          className="tag-name"
                          onClick={() => { setEditingTagIndex(idx); setEditingTagDraft(tag); }}
                        >
                          {tag}
                        </span>
                        <button
                          type="button"
                          className="tag-remove-btn"
                          onClick={() => onDraftChange({ tags: draft.tags.filter((x) => x !== tag) })}
                        >
                        <X className="size-2.5" />
                        </button>
                      </>
                    )}
                  </Badge>
                ))}
                {addingTag ? (
                  <Badge variant="outline" className="tag-badge w-fit">
                    <input
                      className="tag-edit-input"
                      autoFocus
                      value={tagInput}
                      style={{ width: '23ch' }}
                      onChange={(e) => {
                        let trimmed = e.target.value.replace(/[^a-zA-Z0-9-]/g, '');
                        if (trimmed.length > 30) {
                          trimmed = trimmed.slice(0, 30);
                        }
                        setTagInput(trimmed);
                      }}
                      onBlur={commitNewTag}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commitNewTag(); }
                        if (e.key === 'Escape') { setTagInput(''); setAddingTag(false); }
                      }}
                      placeholder={t('commandDetail.tagNamePlaceholder')}
                    />
                  </Badge>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="tag-add-btn"
                        onClick={() => { setTagInput(''); setAddingTag(true); }}
                      >
                        <Plus className="size-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('commandDetail.addTag')}</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          )}

          {showDescription && (
            <div className="inline-icon-field mt-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <ALargeSmall className="inline-icon-field-icon mt-0.5" />
                </TooltipTrigger>
                <TooltipContent>{t('commandDetail.descriptionTooltip')}</TooltipContent>
              </Tooltip>
            <Textarea
              className="detail-description-textarea"
              value={draft?.description}
              onChange={(e) => {
                onDraftChange({ description: e.target.value });
                const el = e.target;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 400) + 'px';
              }}
              onFocus={(e) => {
                const el = e.target;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 450) + 'px';
              }}
              onBlur={(e) => {
                onDraftChange({ description: e.target.value });
                const el = e.target;
                el.style.height = '';
                requestAnimationFrame(() => {
                  el.scrollTop = 0;
                  el.setSelectionRange(0, 0);
                });
              }}
              placeholder={t('commandEditor.descriptionPlaceholder')}
            />
            </div>
          )}

        </div>
      )}

      <div className="detail-section">
        <div className="detail-section-title">{t('commandDetail.command')}</div>
        <div className="hover-actions-host script-area-hover command-text-box-glow">
          {!draft.revealed.title && scriptBody.trim().length > 0 && (
            <div className="add-title-pill-anchor">
              <button
                type="button"
                className="add-title-pill"
                onClick={(e) => { e.stopPropagation(); reveal('title'); }}
              >
                <Plus className="size-3 shrink-0" />
                <span className="add-title-pill-label">{t('commandDetail.addTitle')}</span>
              </button>
            </div>
          )}
          <div className="command-text-box-inner" ref={scriptWrapRef}>
            <div className="command-text-box-header">
              <div className="flex items-center gap-1.5">
                <span className="command-text-box-label">{t('commandDetail.template')}</span>
                {!isNewCommand && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-primary hover:text-primary"
                        disabled={isExecuting}
                        onClick={() => {
                          if (variables.length > 0) {
                            onFillVariables({});
                          } else {
                            onExecute({});
                          }
                        }}
                      >
                        {isExecuting ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Play 
                            className="size-3.5" 
                            style={{
                              filter: `
                                drop-shadow(0 0 2px #007acc) 
                                drop-shadow(0 0 10px #007acc) 
                                drop-shadow(0 0 20px rgba(0, 122, 204, 0.5))
                              `
                            }}
                          />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isExecuting ? (
                        t('commandDetail.running')
                      ) : (
                        <ShortcutHint label={t('commandDetail.execute')} shortcut={`${cmdKey}↩`} />
                      )}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="command-text-box-header-actions">
                {scriptEditor && !isNewCommand && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-xs" onClick={discardScriptEdit}>
                        <X className="size-3.5 text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('commandDetail.revertScript')}</TooltipContent>
                  </Tooltip>
                )}
                {hasScriptChanges && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-xs" onClick={saveScriptEdit}>
                        <Check className="size-3.5 text-success" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('commandDetail.saveScript')}</TooltipContent>
                  </Tooltip>
                )}
                {!scriptEditor && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-xs" onClick={enterScriptEdit}>
                        <Pencil className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('commandDetail.editScript')}</TooltipContent>
                  </Tooltip>
                )}
                {!isNewCommand && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-xs" onClick={() => onRunInTerminal(resolvedValues)}>
                        <SquareTerminal className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('commandDetail.runInTerminal')}</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" onClick={handleCopyTemplate}>
                      {copiedTemplate ? (
                        <Check className="size-3.5 text-success" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {copiedTemplate ? t('commandDetail.copied') : t('commandDetail.copyCommand')}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            {scriptEditor ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="script-edit-wrap">
                    <HighlightedTextarea
                      className="detail-script-textarea"
                      autoFocus={!isNewCommand}
                      value={isNewCommand ? scriptBody : scriptEditDraft}
                      onChange={(val) => {
                        if (isNewCommand) {
                          handleScriptBodyChange(val);
                        } else {
                          setScriptEditDraft(val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && (e.metaKey || e.ctrlKey) && e.shiftKey && !isNewCommand) {
                          e.preventDefault();
                          discardScriptEdit();
                          return;
                        }
                        if (e.key === 'Escape' && !isNewCommand) {
                          e.preventDefault();
                          discardScriptEdit();
                          return;
                        }
                        if (e.key === 'Enter' && !e.shiftKey && !isNewCommand) {
                          e.preventDefault();
                          if (hasScriptChanges) {
                            saveScriptEdit();
                          } else {
                            setScriptEditor(false);
                          }
                        }
                      }}
                      placeholder={t('commandEditor.commandPlaceholder')}
                    />
                  </div>
                </TooltipTrigger>
                {!isNewCommand && (
                  <TooltipContent side="right" sideOffset={5} className="script-edit-tooltip-content p-0">
                    <div className="script-edit-tooltip-card">
                      <div className="script-edit-tooltip-title">{t('commandDetail.scriptEditHintTitle')}</div>
                      <div className="script-edit-tooltip-row">
                        <span>{t('commandDetail.scriptEditHintNewLine')}</span>
                        <Kbd className="ml-2">⇧↩</Kbd>
                      </div>
                      <div className="script-edit-tooltip-row">
                        <span>{t('commandDetail.scriptEditHintSave')}</span>
                        <Kbd className="ml-2">↩</Kbd>
                      </div>
                      <div className="script-edit-tooltip-row">
                        <span>{t('commandDetail.scriptEditHintDiscard')}</span>
                        <Kbd className="ml-2">{cmdKey}⇧⌫</Kbd>
                      </div>
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            ) : (
              <div className="command-text-box script-preview-compact">
                <code className="whitespace-pre-wrap">{renderScriptWithVars}</code>
              </div>
            )}
          </div>
        </div>
      </div>

      {!isNewCommand && variables.length > 0 && (
        <div className="detail-section mt-4">
          <div className="detail-section-title">{t('commandDetail.presets')}</div>

          <div className="preset-chips">
            <DndContext sensors={presetSensors} collisionDetection={closestCenter} onDragEnd={handlePresetDragEnd}>
              <SortableContext items={presetIds} strategy={horizontalListSortingStrategy}>
                {command.presets?.map((p) => (
                  <SortablePresetChip
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    isActive={selectedPresetId === p.id}
                    isRenaming={renamingChipId === p.id}
                    renamingDraft={renamingChipDraft}
                    onSelect={() => setSelectedPresetId(p.id)}
                    onDoubleClick={() => {
                      setRenamingChipId(p.id);
                      setRenamingChipDraft(p.name);
                    }}
                    onSetRenaming={(id, name) => {
                      setRenamingChipId(id);
                      setRenamingChipDraft(name);
                    }}
                    onRenameChange={setRenamingChipDraft}
                    onCommitRename={commitChipRename}
                    onConfirmDelete={setConfirmDeletePresetId}
                    renameLabel={t('commandDetail.rename')}
                    deleteLabel={t('commandDetail.delete')}
                    presetNamePlaceholder={t('commandDetail.presetNamePlaceholder')}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="preset-chip preset-chip-add"
                  onClick={async () => {
                    preAddPresetIdRef.current = selectedPresetId;
                    const hasValues = Object.values(resolvedValues).some((v) => v.trim());
                    const newId = await onAddPreset(hasValues ? resolvedValues : undefined);
                    setSelectedPresetId(newId);
                    setRenamingChipId(newId);
                    setNewlyCreatedPresetId(newId);
                    setRenamingChipDraft('');
                  }}
                >
                  <Plus size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('commandDetail.addPreset')}</TooltipContent>
            </Tooltip>
          </div>

          <div className="command-text-box-glow mt-3">
            <div className="command-text-box-inner">
              <div className="command-text-box-header">
                <div className="flex items-center gap-1.5">
                  <span className="command-text-box-label">{t('commandDetail.preview')}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className={cn("execute-btn-glow", isExecuting && "execute-btn-running")}
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
                        {isExecuting ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Play className="size-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isExecuting ? (
                        t('commandDetail.running')
                      ) : (
                        <ShortcutHint label={t('commandDetail.execute')} shortcut={`${cmdKey}↩`} />
                      )}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="command-text-box-header-actions">
                  {hasUnsavedChanges && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon-xs" onClick={() => setOverrides({})}>
                            <X className="size-3.5 text-destructive" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('commandDetail.revertChanges')}</TooltipContent>
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
                        <TooltipContent>{t('commandDetail.savePresetValues')}</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-xs" onClick={() => onRunInTerminal(resolvedValues)}>
                        <SquareTerminal className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('commandDetail.runInTerminal')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-xs" onClick={handleCopyPreview}>
                        {copiedPreview ? (
                          <Check className="size-3.5 text-success" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {copiedPreview ? t('commandDetail.copied') : t('commandDetail.copyCommand')}
                    </TooltipContent>
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
                    return (
                      <div
                        key={v.name}
                        className={`preset-var-row${val ? '' : ' preset-var-row-empty'}`}
                      >
                        <span className="preset-var-name" title={'{{' + v.name + '}}'}>
                          {v.name}
                        </span>
                        <input
                          className={`preset-var-input preset-var-value${val ? '' : ' empty'}`}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          value={val}
                          onChange={(e) =>
                            setOverrides((prev) => ({ ...prev, [v.name]: e.target.value }))
                          }
                          onFocus={() => setFocusedVarName(v.name)}
                          onBlur={() =>
                            setFocusedVarName((current) => (current === v.name ? null : current))
                          }
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (selectedPresetId) {
                                try {
                                  await onSavePresetValues(selectedPresetId, resolvedValues);
                                  setOverrides({});
                                } catch {
                                  toast.error(t('commandDetail.savePresetFailed'));
                                }
                              }
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              setOverrides((prev) => {
                                const next = { ...prev };
                                delete next[v.name];
                                return next;
                              });
                            }
                          }}
                          title={t('commandDetail.clickToEdit')}
                          placeholder={t('commandDetail.clickToSet')}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        open={confirmDeletePresetId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDeletePresetId(null);
            setDeletingPresetId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('commandDetail.deletePresetTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('commandDetail.deletePresetDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('commandDetail.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
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
              {t('commandDetail.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showScriptDiscardConfirm}
        onOpenChange={(open) => { if (!open) setShowScriptDiscardConfirm(false); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('app.discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('app.discardDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              discardScriptEdit();
            }}>
              {t('commandEditor.discard')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              saveScriptEdit();
            }}>
              {t('commandDetail.saveScript')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showVarRemovalConfirm}
        onOpenChange={(open) => { if (!open) setShowVarRemovalConfirm(false); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('commandDetail.varRemovalTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>{t('commandDetail.varRemovalDescription')}</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pendingRemovedVars.map((v) => (
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
            <AlertDialogCancel>{t('commandDetail.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setShowVarRemovalConfirm(false);
                setPendingRemovedVars([]);
                doSaveScriptEdit();
              }}
            >
              {t('commandDetail.saveScript')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CommandDetail;

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
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DropdownMenu } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import type { Command, TabDraft, VariablePrompt, OSPathMap, OSKey, Category } from '../types';
import { getOSPath, setOSPath } from '../utils/path';
import { formatRelativeTime } from '../utils/relativeTime';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
} from '@/components/ui/popover';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Copy,
  Check,
  Plus,
  Pencil,
  X,
  ALargeSmall,
  Hash,
  FolderOpen,
  Code2,
  Save,
  Play,
  Loader2,
  MoreVertical,
  Trash2,
  Link2,
  Layers,
  CircleHelp,
  FileCode2,
  Folder,
  Clock,
  Braces,
  Search,
} from 'lucide-react';
import { PickDirectory } from '../../bindings/cmdex/app';
import { toast } from 'sonner';
import { ShortcutLabel } from '@/components/ui/kbd';
import { Heading } from '@/components/ui/heading';

import { cn } from '@/lib/utils';

interface HighlightedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
  'data-testid'?: string;
}

const HighlightedTextarea: React.FC<HighlightedTextareaProps> = ({
  value,
  onChange,
  onKeyDown,
  onBlur,
  onFocus,
  autoFocus,
  placeholder,
  className = '',
  'data-testid': dataTestId,
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
    <div className={`highlighted-textarea-wrap ${className}`} data-testid={dataTestId}>
      <div ref={backdropRef} className="highlighted-textarea-backdrop" aria-hidden>
        <code>{highlighted}{'\n'}</code>
      </div>
      <Textarea
        ref={textareaRef}
        className="highlighted-textarea-input"
        data-testid={dataTestId ? `${dataTestId}-textarea` : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onFocus={onFocus}
        onScroll={syncScroll}
        autoFocus={autoFocus}
        placeholder={placeholder}
      />
    </div>
  );
};

interface SortablePresetRowProps {
  id: string;
  name: string;
  isActive: boolean;
  isRenaming: boolean;
  renamingDraft: string;
  previewText: string;
  matchesSearch: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
  onSetRenaming: (id: string, name: string) => void;
  onRenameChange: (val: string) => void;
  onCommitRename: () => void;
  onConfirmDelete: (id: string) => void;
  renameLabel: string;
  deleteLabel: string;
  moreLabel: string;
  presetNamePlaceholder: string;
}

const SortablePresetRow: React.FC<SortablePresetRowProps> = ({
  id,
  name,
  isActive,
  isRenaming,
  renamingDraft,
  previewText,
  matchesSearch,
  onSelect,
  onDoubleClick,
  onSetRenaming,
  onRenameChange,
  onCommitRename,
  onConfirmDelete,
  renameLabel,
  deleteLabel,
  moreLabel,
  presetNamePlaceholder,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  if (isRenaming) {
    return (
      <div ref={setNodeRef} style={style} className="preset-row-wrap" hidden={!matchesSearch}>
        <input
          className="preset-chip preset-chip-renaming"
          data-testid={`preset-chip-rename-${id}`}
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
    <div ref={setNodeRef} style={style} className="preset-row-wrap" hidden={!matchesSearch} {...attributes} {...listeners}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={`preset-chip preset-row${isActive ? ' active' : ''}`}
            data-testid={`preset-chip-${id}`}
            role="button"
            aria-pressed={isActive}
            tabIndex={0}
            onClick={onSelect}
            onDoubleClick={(e) => { e.preventDefault(); onDoubleClick(); }}
            onKeyDown={(e) => {
              if (e.key === 'F2') { e.preventDefault(); onDoubleClick(); }
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
            }}
          >
            <span className={`preset-radio-dot${isActive ? ' active' : ''}`} aria-hidden="true" />
            <span className="preset-row-name">{name}</span>
            {previewText && (
              <span className="preset-row-preview" title={previewText}>{previewText}</span>
            )}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="preset-row-menu-btn"
                  aria-label={moreLabel}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="size-3.5" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="menu-surface" align="end" sideOffset={4}>
                  <DropdownMenu.Item
                    className="menu-item"
                    onSelect={() => { onSetRenaming(id, name); onSelect(); }}
                  >
                    {renameLabel}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="menu-item menu-item-destructive"
                    onSelect={() => onConfirmDelete(id)}
                  >
                    {deleteLabel}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
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
  onFillVariables: (initialValues: Record<string, string>) => void;
  onRenamePreset: (presetId: string, newName: string) => Promise<void>;
  onDeletePreset: (presetId: string) => Promise<void>;
  onAddPreset: (initialValues?: Record<string, string>) => Promise<string>;
  onSavePresetValues: (presetId: string, values: Record<string, string>) => Promise<void>;
  onReorderPresets: (presetIds: string[]) => Promise<void>;
  onResolvedValuesChange?: (values: Record<string, string>) => void;
  onSaveScript?: (scriptBody: string) => Promise<void>;
  currentOS?: OSKey;
  defaultWorkingDir?: OSPathMap;
  /** Full category list, used to resolve the breadcrumb's dot color + name
   * from command.categoryId. Optional — when omitted, no breadcrumb renders. */
  categories?: Category[];
  /** Header "Save" — mirrors the floating save bar's Save action. */
  onSave?: () => void;
  /** Whether this tab currently has unsaved changes (drives the header Save button). */
  isDirty?: boolean;
  /** Header "Duplicate" / ⋮ menu "Duplicate" — creates a copy of this saved command. */
  onDuplicate?: (commandId: string) => void;
  /** ⋮ menu "Delete command". */
  onDeleteCommand?: (command: Command) => void;
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
  onFillVariables,
  onRenamePreset,
  onDeletePreset,
  onAddPreset,
  onSavePresetValues,
  onReorderPresets,
  onResolvedValuesChange,
  onSaveScript,
  currentOS,
  defaultWorkingDir,
  categories,
  onSave,
  isDirty,
  onDuplicate,
  onDeleteCommand,
}) => {
  const { t } = useTranslation();
  const category = useMemo(
    () => categories?.find((c) => c.id === command.categoryId),
    [categories, command.categoryId],
  );
  const commandWD = getOSPath(draft.workingDir, currentOS);
  const defaultWD = getOSPath(defaultWorkingDir, currentOS);
  const effectiveWD = commandWD || defaultWD;
  const { copied, copy } = useCopyToClipboard();
  const [previewOpen, setPreviewOpen] = useState(false);
  const showPreview = previewOpen;
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [focusedVarName, setFocusedVarName] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [tagInput, setTagInput] = useState('');
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [editingTagDraft, setEditingTagDraft] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [scriptEditor, setScriptEditor] = useState(() => isNewCommand);
  const [scriptHintOpen, setScriptHintOpen] = useState(false);
  const [renamingChipId, setRenamingChipId] = useState<string | null>(null);
  const [renamingChipDraft, setRenamingChipDraft] = useState('');
  const [confirmDeletePresetId, setConfirmDeletePresetId] = useState<string | null>(null);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const [newlyCreatedPresetId, setNewlyCreatedPresetId] = useState<string | null>(null);
  const preAddPresetIdRef = useRef<string>('');
  const [scriptEditDraft, setScriptEditDraft] = useState('');
  const [showScriptDiscardConfirm, setShowScriptDiscardConfirm] = useState(false);
  const [workingDirDialogOpen, setWorkingDirDialogOpen] = useState(false);
  const [workingDirDraft, setWorkingDirDraft] = useState('');
  const [presetSearch, setPresetSearch] = useState('');
  const [confirmDeleteCommandOpen, setConfirmDeleteCommandOpen] = useState(false);
  const scriptWrapRef = useRef<HTMLDivElement>(null);
  const scriptEditDraftRef = useRef('');
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

  const openWorkingDirDialog = useCallback(() => {
    setWorkingDirDraft(getOSPath(draft.workingDir, currentOS));
    setWorkingDirDialogOpen(true);
  }, [draft.workingDir, currentOS]);

  const scriptBody = draft.scriptBody;

  const titleHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    scriptEditDraftRef.current = scriptEditDraft;
    scriptBodyRef.current = scriptBody;
  }, [scriptEditDraft, scriptBody]);

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
    /* eslint-disable react-hooks/set-state-in-effect -- auto-open editor for new commands with empty body */
    if (isNewCommand) {
      setScriptEditor(!draft.scriptBody.trim());
    } else {
      setScriptEditor(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [command.id, isNewCommand]); // eslint-disable-line react-hooks/exhaustive-deps -- draft.scriptBody intentionally excluded: only auto-open on command switch

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset overrides when command or preset changes
    setOverrides({});
  }, [command.id, selectedPresetId]);

  useEffect(() => {
    if (command.presets && command.presets.length > 0) {
      const isValidPreset = command.presets.some((p) => p.id === selectedPresetId);
      if (!isValidPreset) {
        const newId = command.presets[0].id;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- fallback to first preset when selected becomes invalid
        setSelectedPresetId(newId);
      }
    }
    // selectedPresetId intentionally excluded: effect should only re-run when the command
    // or its presets change, not when the user explicitly deselects a chip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command.id, command.presets]);

  // Auto-switch to Preview when a preset is selected
  useEffect(() => {
    if (selectedPresetId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-open preview when preset is selected
      setPreviewOpen(true);
    }
  }, [selectedPresetId, command.id]);

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
      });
    },
    [onDraftChange],
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
  }, [scriptBody, setScriptEditDraft, setScriptEditor]);

  const doSaveScriptEdit = useCallback(() => {
    handleScriptBodyChange(scriptEditDraft);
    setScriptEditor(false);
    if (!isNewCommand && onSaveScript) {
      onSaveScript(scriptEditDraft);
    }
  }, [scriptEditDraft, handleScriptBodyChange, isNewCommand, onSaveScript, setScriptEditor]);

  const saveScriptEdit = useCallback(() => {
    doSaveScriptEdit();
  }, [doSaveScriptEdit]);

  const discardScriptEdit = useCallback(() => {
    setScriptEditDraft(baselineScriptBody);
    setScriptEditor(false);
  }, [baselineScriptBody, setScriptEditDraft, setScriptEditor]);

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

  const prevResolvedRef = useRef<Record<string, string>>({});
  useEffect(() => {
    // Only call onResolvedValuesChange when values actually change,
    // preventing infinite loops when parent re-renders create new object references.
    const keys = new Set([...Object.keys(prevResolvedRef.current), ...Object.keys(resolvedValues)]);
    let changed = false;
    for (const k of keys) {
      if (prevResolvedRef.current[k] !== resolvedValues[k]) {
        changed = true;
        break;
      }
    }
    if (changed) {
      onResolvedValuesChange?.(resolvedValues);
      prevResolvedRef.current = resolvedValues;
    }
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

  const renderLinePart = useCallback(
    (part: string, key: string) => {
      if (/^\{\{\w+\}\}$/.test(part)) {
        const varName = part.slice(2, -2);
        if (!showPreview) {
          return (
            <span key={key} className="var-missing" title={varName}>
              {part}
            </span>
          );
        }
        const val = resolvedValues[varName];
        const isFocused = focusedVarName === varName;
        if (val) {
          return (
            <span key={key} className={`var-filled${isFocused ? ' var-focused' : ''}`} title={`${varName}=${val}`}>
              {val}
            </span>
          );
        }
        return (
          <span key={key} className={`var-placeholder-muted${isFocused ? ' var-focused' : ''}`} title={varName}>
            [{varName}]
          </span>
        );
      }
      return <span key={key}>{part}</span>;
    },
    [showPreview, resolvedValues, focusedVarName],
  );

  const scriptLines = useMemo(() => (scriptBody ? scriptBody.split('\n') : []), [scriptBody]);

  const renderScriptLines = useMemo(
    () =>
      scriptLines.map((line, i) => {
        const parts = line.split(/(\{\{\w+\}\})/g);
        return (
          <div key={i} className="script-line">
            {line === '' ? ' ' : parts.map((part, j) => renderLinePart(part, `${i}-${j}`))}
          </div>
        );
      }),
    [scriptLines, renderLinePart],
  );

  const getResolvedScript = useMemo(() => {
    if (!scriptBody) return '';
    return scriptBody.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
      return resolvedValues[varName] || `{{${varName}}}`;
    });
  }, [scriptBody, resolvedValues]);

  const resolveScriptForPreset = useCallback(
    (presetValues: Record<string, string>) => {
      if (!scriptBody) return '';
      return scriptBody.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
        const val = presetValues[varName] ?? variables.find((v) => v.name === varName)?.defaultValue ?? '';
        return val || `{{${varName}}}`;
      });
    },
    [scriptBody, variables],
  );

  const handleCopy = useCallback(() => {
    const text = showPreview ? getResolvedScript : scriptBody;
    copy(text).catch(() => {
      toast.error(t('commandDetail.copyFailed'));
    });
  }, [showPreview, getResolvedScript, scriptBody, copy, t]);

  const handleHeaderRun = useCallback(() => {
    if (variables.length === 0) {
      onExecute({});
      return;
    }
    const hasEmpty = variables.some((v) => !resolvedValues[v.name]);
    if (hasEmpty) {
      onFillVariables(resolvedValues);
    } else {
      onExecute(resolvedValues);
    }
  }, [variables, resolvedValues, onExecute, onFillVariables]);

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

  const filteredPresetsCount = useMemo(() => {
    const q = presetSearch.trim().toLowerCase();
    if (!q) return command.presets?.length ?? 0;
    return (command.presets || []).filter((p) => p.name.toLowerCase().includes(q)).length;
  }, [command.presets, presetSearch]);

  return (
    // Spacing controlled by .main-body CSS (28px 32px 100px) — no inline padding overrides in this component
    <div className="command-detail">
      <div className="editor-header-row">
        <div className="editor-header-main">
          {categories !== undefined && !isNewCommand && (
            <div className="detail-crumb">
              <span
                className="crumb-dot"
                style={{ background: category ? (category.color || 'var(--brand)') : '#6c6c88' }}
              />
              <span>{category ? category.name : t('sidebar.uncategorized')}</span>
            </div>
          )}

          {showHeaderBlock && (
            <div className="detail-header">
              {showTitle && (
                <div className="hover-actions-host detail-header-title-wrap inline-icon-field">
                  <div className="detail-title-row">
                    <span className="detail-title-bar" aria-hidden="true" />
                    <Heading
                      ref={titleHeadingRef}
                      level={1}
                      className={cn(
                        'text-left title-contenteditable w-full min-w-0 cursor-text outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm',
                        !draft.title.trim() && 'title-contenteditable--empty',
                      )}
                      contentEditable
                      suppressContentEditableWarning
                      data-testid="command-title"
                      aria-label={t('commandEditor.title')}
                      data-placeholder={t('commandEditor.titlePlaceholder')}
                      onInput={handleTitleInput}
                      onKeyDown={handleTitleKeyDown}
                      onPaste={handleTitlePaste}
                    />
                  </div>
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
                  rows={1}
                  data-testid="command-description"
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

          {!isNewCommand && !showDescription && (
            <p className="detail-subtitle">{t('commandDetail.subtitleHint')}</p>
          )}

          {!isNewCommand && (
            <div className="detail-meta-row">
              <span className="detail-meta-chip">
                <FileCode2 className="detail-meta-icon" />
                {t('commandDetail.metaCommandLabel')}
              </span>
              <span className="detail-meta-chip">
                <Folder className="detail-meta-icon" />
                {category ? category.name : t('sidebar.uncategorized')}
              </span>
              {command.updatedAt && (
                <span className="detail-meta-chip">
                  <Clock className="detail-meta-icon" />
                  {t('commandDetail.metaUpdated', { time: formatRelativeTime(command.updatedAt) })}
                </span>
              )}
            </div>
          )}
        </div>

        {!isNewCommand && (
          <div className="editor-header-actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="command-save-btn-header"
              disabled={!isDirty}
              onClick={() => onSave?.()}
            >
              <Save className="size-3.5" />
              {t('commandEditor.save')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="command-duplicate-btn-header"
              onClick={() => onDuplicate?.(command.id)}
            >
              <Copy className="size-3.5" />
              {t('commandDetail.duplicate')}
            </Button>
            <Button
              type="button"
              size="sm"
              data-testid="command-run-btn"
              disabled={isExecuting}
              onClick={handleHeaderRun}
            >
              {isExecuting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" fill="currentColor" />
              )}
              {t('commandDetail.run')}
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={t('commandDetail.moreActions')}
                >
                  <MoreVertical className="size-3.5" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="menu-surface" align="end" sideOffset={6}>
                  <DropdownMenu.Item className="menu-item" onSelect={openWorkingDirDialog}>
                    <FolderOpen className="size-3.5" />
                    {t('commandDetail.manageWorkingDirectory')}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className="menu-item" onSelect={() => onDuplicate?.(command.id)}>
                    <Copy className="size-3.5" />
                    {t('commandDetail.duplicate')}
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="menu-separator" />
                  <DropdownMenu.Item
                    className="menu-item menu-item-destructive"
                    onSelect={() => setConfirmDeleteCommandOpen(true)}
                  >
                    <Trash2 className="size-3.5" />
                    {t('commandDetail.deleteCommand')}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        )}
      </div>

      <div className="detail-section">
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
              <div className="command-text-box-header-left">
                <Code2 className="command-text-box-icon" />
                <span className="command-text-box-title">{t('commandDetail.command')}</span>
                <div
                  className="script-mode-toggle"
                  hidden={isNewCommand || variables.length <= 0}
                >
                  <button
                    type="button"
                    className={`script-mode-chip${!showPreview ? ' active' : ''}`}
                    onClick={() => setPreviewOpen(false)}
                    aria-label={t('commandDetail.showTemplate')}
                  >
                    {t('commandDetail.template')}
                  </button>
                  <button
                    type="button"
                    className={`script-mode-chip${showPreview ? ' active' : ''}`}
                    onClick={() => setPreviewOpen(true)}
                    aria-label={t('commandDetail.showPreview')}
                  >
                    {t('commandDetail.preview')}
                  </button>
                </div>
              </div>
              <div className="command-text-box-header-right">
                <span className="command-text-box-hint">{t('commandDetail.scriptHint')}</span>
                <div className="command-text-box-header-actions">
                  {scriptEditor && !isNewCommand && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon-xs" data-testid="script-edit-discard-btn" onClick={discardScriptEdit}>
                          <X className="size-3.5 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('commandDetail.revertScript')}</TooltipContent>
                    </Tooltip>
                  )}
                  {hasScriptChanges && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon-xs" data-testid="script-edit-save-btn" onClick={saveScriptEdit}>
                          <Check className="size-3.5 text-success" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('commandDetail.saveScript')}</TooltipContent>
                    </Tooltip>
                  )}
                  {!scriptEditor && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon-xs" data-testid="script-edit-enter-btn" onClick={enterScriptEdit}>
                          <Pencil className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('commandDetail.editScript')}</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-xs" onClick={handleCopy}>
                        {copied ? (
                          <Check className="size-3.5 text-success" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {copied ? t('commandDetail.copied') : t('commandDetail.copyCommand')}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
            {scriptEditor ? (
              <Tooltip open={scriptHintOpen}>
                <TooltipTrigger asChild>
                  <div className="script-edit-wrap">
                    <HighlightedTextarea
                      className="detail-script-textarea"
                      data-testid="command-script"
                      autoFocus={!isNewCommand}
                      value={isNewCommand ? scriptBody : scriptEditDraft}
                      onChange={(val) => {
                        if (isNewCommand) {
                          handleScriptBodyChange(val);
                        } else {
                          setScriptEditDraft(val);
                        }
                      }}
                      onFocus={() => setScriptHintOpen(true)}
                      onBlur={() => setScriptHintOpen(false)}
                      onKeyDown={(e) => {
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
                {!isNewCommand && (<TooltipContent side="right" sideOffset={5} className="script-edit-tooltip-content p-0">
                  <div className="script-edit-tooltip-card">
                    <div className="script-edit-tooltip-title">{t('common.keyboardShortcuts')}</div>
                    <div className="script-edit-tooltip-row">
                      <span>{t('commandDetail.scriptEditHintNewLine')}</span>
                      <ShortcutLabel id="scriptNewLine" />
                    </div>
                    <div className="script-edit-tooltip-row">
                      <span>{t('commandDetail.scriptEditHintSave')}</span>
                      <ShortcutLabel id="scriptSave" />
                    </div>
                    <div className="script-edit-tooltip-row">
                      <span>{t('commandDetail.scriptEditHintDiscard')}</span>
                      <ShortcutLabel id="escape" />
                    </div>
                  </div>
                </TooltipContent>)}
              </Tooltip>
            ) : (
              <div className="command-text-box script-preview-compact">
                <div className="script-gutter-row">
                  <div className="script-gutter" aria-hidden="true">
                    {(scriptLines.length > 0 ? scriptLines : ['']).map((_, i) => (
                      <span key={i} className="script-gutter-no">{i + 1}</span>
                    ))}
                  </div>
                  <code className="script-gutter-code whitespace-pre-wrap">
                    {renderScriptLines.length > 0 ? renderScriptLines : <div className="script-line">{' '}</div>}
                  </code>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!isNewCommand && (
        <div className="detail-section mt-2">
          <div className="cols">
            <div className="panel-card col-variables">
              <div className="panel-card-header">
                <span className="panel-card-title">
                  <Link2 className="panel-card-icon" />
                  {t('commandEditor.variables')}
                </span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="how-it-works-link">
                      <CircleHelp className="size-3" />
                      {t('commandDetail.howItWorks')}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="how-it-works-popover">
                    <PopoverTitle>{t('commandDetail.howItWorksTitle')}</PopoverTitle>
                    <PopoverDescription>{t('commandDetail.howItWorksDescription')}</PopoverDescription>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="panel-card-body">
                {variables.length > 0 ? (
                  <div className="var-info-list">
                    {variables.map((v) => (
                      <div key={v.name} className="var-info-row">
                        <span className="var-info-name">{'{{' + v.name + '}}'}</span>
                        {(v.description || v.example) && (
                          <span className="var-info-desc">{v.description || v.example}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="var-empty-state">
                    <div className="var-empty-icon">
                      <Braces className="size-5" />
                    </div>
                    <div className="var-empty-title">{t('commandDetail.noVariablesTitle')}</div>
                    <div className="var-empty-hint">{t('commandDetail.noVariablesHint')}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="panel-card col-presets">
              <div className="panel-card-header">
                <span className="panel-card-title">
                  <Layers className="panel-card-icon" />
                  {t('commandDetail.presets')}
                </span>
              </div>

              <div className="panel-card-body">
                <div className="preset-search-row">
                  <div className="preset-search-input-wrap">
                    <Search className="preset-search-icon" />
                    <input
                      type="text"
                      className="preset-search-input"
                      value={presetSearch}
                      onChange={(e) => setPresetSearch(e.target.value)}
                      placeholder={t('commandDetail.searchPresets')}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    data-testid="preset-chip-add"
                    aria-label={t('commandDetail.addPreset')}
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
                    <Plus className="size-3.5" />
                    {t('commandDetail.addPreset')}
                  </Button>
                </div>

                {(command.presets?.length ?? 0) === 0 ? (
                  <div className="preset-empty">{t('commandDetail.noPresetsFound')}</div>
                ) : (
                  <>
                    <DndContext sensors={presetSensors} collisionDetection={closestCenter} onDragEnd={handlePresetDragEnd}>
                      <SortableContext items={presetIds} strategy={verticalListSortingStrategy}>
                        <div className="preset-rows">
                          {command.presets?.map((p) => {
                            const q = presetSearch.trim().toLowerCase();
                            const matchesSearch = !q || p.name.toLowerCase().includes(q);
                            return (
                              <SortablePresetRow
                                key={p.id}
                                id={p.id}
                                name={p.name}
                                isActive={selectedPresetId === p.id}
                                isRenaming={renamingChipId === p.id}
                                renamingDraft={renamingChipDraft}
                                previewText={resolveScriptForPreset(p.values)}
                                matchesSearch={matchesSearch}
                                onSelect={() => setSelectedPresetId((prev) => (prev === p.id ? '' : p.id))}
                                onDoubleClick={() => {
                                  setSelectedPresetId(p.id);
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
                                moreLabel={t('commandDetail.presetRowMenu')}
                                presetNamePlaceholder={t('commandDetail.presetNamePlaceholder')}
                              />
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                    {filteredPresetsCount === 0 && (
                      <div className="preset-empty">{t('commandDetail.noPresetsFound')}</div>
                    )}
                  </>
                )}

                {variables.length > 0 && (
                  <div className="preset-values-form">
                    <div className="preset-values-header">
                      <span>{t('commandDetail.presetValuesLabel')}</span>
                      {hasUnsavedChanges && (
                        <div className="var-section-actions">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon-xs" data-testid="preset-values-revert" onClick={() => setOverrides({})}>
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
                                data-testid="preset-values-save"
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
                        </div>
                      )}
                    </div>

                    <div className="var-cards-list">
                      {variables.map((v) => {
                        const val = resolvedValues[v.name];
                        return (
                          <div key={v.name} className={`var-card${val ? '' : ' var-card-empty'}`}>
                            <div className="var-label" title={'{{' + v.name + '}}'}>{v.name}</div>
                            <input
                              className="var-input preset-var-input"
                              data-testid={`preset-var-input-${v.name}`}
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
                )}
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
        <AlertDialogContent data-testid="confirm-delete-preset-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('commandDetail.deletePresetTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('commandDetail.deletePresetDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="confirm-delete-preset-cancel">{t('commandDetail.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid="confirm-delete-preset-confirm"
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
        {/* NOTE: button semantics here are inverted from what "Cancel"/"Action"
            normally imply — Cancel discards the pending script edit, Action
            saves it. Tests must not assume Cancel is a no-op. */}
        <AlertDialogContent data-testid="script-discard-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('app.discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('app.discardDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="script-discard-discard" onClick={() => {
              discardScriptEdit();
            }}>
              {t('commandEditor.discard')}
            </AlertDialogCancel>
            <AlertDialogAction data-testid="script-discard-save" onClick={() => {
              saveScriptEdit();
            }}>
              {t('commandDetail.saveScript')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDeleteCommandOpen}
        onOpenChange={setConfirmDeleteCommandOpen}
      >
        <AlertDialogContent data-testid="confirm-delete-command-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('commandDetail.deleteCommandTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('commandDetail.deleteCommandDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="confirm-delete-command-cancel">{t('commandDetail.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid="confirm-delete-command-confirm"
              onClick={() => {
                onDeleteCommand?.(command);
                setConfirmDeleteCommandOpen(false);
              }}
            >
              {t('commandDetail.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={workingDirDialogOpen} onOpenChange={setWorkingDirDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="working-directory-dialog">
          <DialogHeader>
            <DialogTitle>{t('commandDetail.workingDirectoryDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('commandDetail.workingDirectoryDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 py-2">
            <input
              type="text"
              data-testid="working-directory-input"
              value={workingDirDraft}
              onChange={(e) => setWorkingDirDraft(e.target.value)}
              placeholder={commandWD ? t('commandDetail.workingDirectoryPlaceholder') : (defaultWD || t('commandDetail.workingDirectoryPlaceholder'))}
              className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="working-directory-browse"
              onClick={async () => {
                if (currentOS === 'unknown') return;
                try {
                  const selected = await PickDirectory(workingDirDraft || effectiveWD);
                  if (selected) {
                    setWorkingDirDraft(selected);
                  }
                } catch (err) {
                  console.error('Directory picker error:', err);
                }
              }}
              disabled={currentOS === 'unknown'}
            >
              <FolderOpen size={14} className="mr-1" />
              {t('commandDetail.browse')}
            </Button>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="working-directory-clear"
              onClick={() => {
                setWorkingDirDraft('');
              }}
            >
              {t('commandDetail.clear')}
            </Button>
            <Button
              type="button"
              size="sm"
              data-testid="working-directory-apply"
              disabled={currentOS === 'unknown'}
              onClick={() => {
                if (currentOS === 'unknown') return;
                onDraftChange({ workingDir: setOSPath(draft.workingDir, currentOS, workingDirDraft) });
                setWorkingDirDialogOpen(false);
              }}
            >
              {t('commandDetail.apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default React.memo(CommandDetail);

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Category, Command, VariableDefinition } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, X } from 'lucide-react';
import { GetScriptBody } from '../../wailsjs/go/main/App';

const TEMPLATE_VAR_RE = /\{\{(\w+)\}\}/g;

function extractTemplateVars(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  let m: RegExpExecArray | null;
  TEMPLATE_VAR_RE.lastIndex = 0;
  while ((m = TEMPLATE_VAR_RE.exec(text)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); result.push(m[1]); }
  }
  return result;
}

export interface CommandEditorTabProps {
  /** undefined = new command */
  command?: Command;
  categories: Category[];
  defaultCategoryId?: string;
  onSave: (data: {
    title: string;
    description: string;
    scriptBody: string;
    categoryId: string;
    tags: string[];
    variables: VariableDefinition[];
  }) => void;
  onDiscard: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const CommandEditorTab: React.FC<CommandEditorTabProps> = ({
  command,
  categories,
  defaultCategoryId,
  onSave,
  onDiscard,
  onDirtyChange,
}) => {
  const { t } = useTranslation();
  const isNew = !command;

  const [title, setTitle] = useState(command?.title ?? '');
  const [description, setDescription] = useState(command?.description ?? '');
  const [scriptBody, setScriptBody] = useState('');
  const [baselineScriptBody, setBaselineScriptBody] = useState('');
  const [categoryId, setCategoryId] = useState(command?.categoryId ?? defaultCategoryId ?? '');
  const [tags, setTags] = useState<string[]>(command?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [variables, setVariables] = useState<VariableDefinition[]>(command?.variables ?? []);
  const scriptRef = useRef<HTMLTextAreaElement>(null);

  // Reset all fields when the command being edited changes
  useEffect(() => {
    setTitle(command?.title ?? '');
    setDescription(command?.description ?? '');
    setCategoryId(command?.categoryId ?? defaultCategoryId ?? '');
    setTags(command?.tags ?? []);
    setTagInput('');
    setVariables(command?.variables ?? []);

    let active = true;
    if (command?.id) {
      GetScriptBody(command.id)
        .then(body => {
          if (!active) return;
          setScriptBody(body);
          setBaselineScriptBody(body);
        })
        .catch(() => {
          if (!active) return;
          setScriptBody('');
          setBaselineScriptBody('');
        });
    } else {
      setScriptBody('');
      setBaselineScriptBody('');
    }
    return () => { active = false; };
  }, [command?.id, defaultCategoryId]);

  // Track dirty state — includes all editable fields
  const isDirty = useMemo(() => {
    if (isNew) return title !== '' || scriptBody !== '' || description !== '';
    const tagsMatch = JSON.stringify(tags) === JSON.stringify(command?.tags ?? []);
    const varsMatch = JSON.stringify(variables.map(v => ({ name: v.name, description: v.description, default: v.default, example: v.example })))
      === JSON.stringify((command?.variables ?? []).map(v => ({ name: v.name, description: v.description, default: v.default, example: v.example })));
    return (
      title !== (command?.title ?? '') ||
      description !== (command?.description ?? '') ||
      scriptBody !== baselineScriptBody ||
      categoryId !== (command?.categoryId ?? '') ||
      !tagsMatch ||
      !varsMatch
    );
  }, [title, description, scriptBody, baselineScriptBody, categoryId, tags, variables, isNew, command]);

  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  useEffect(() => { onDirtyChangeRef.current?.(isDirty); }, [isDirty]);

  // Auto-detect variables from script
  useEffect(() => {
    const detected = extractTemplateVars(scriptBody);
    setVariables(prev => {
      const existing = new Map(prev.map(v => [v.name, v]));
      return detected.map((name, i) => existing.get(name) ?? {
        name,
        description: '',
        example: '',
        default: '',
        sortOrder: i,
      });
    });
  }, [scriptBody]);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/,+$/, '');
      if (newTag && !tags.includes(newTag)) setTags(prev => [...prev, newTag]);
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(prev => prev.slice(0, -1));
    }
  };

  const handleSave = useCallback(() => {
    if (!title.trim() || !scriptBody.trim()) return;
    onSave({ title: title.trim(), description, scriptBody, categoryId, tags, variables });
  }, [title, description, scriptBody, categoryId, tags, variables, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onDiscard();
    }
  };

  return (
    <div className="editor-tab" onKeyDown={handleKeyDown} tabIndex={-1}>

      {/* Header toolbar */}
      <div className="editor-tab-toolbar">
        <span className="editor-tab-breadcrumb">
          {isNew ? 'New Command' : `Edit: ${command.title}`}
        </span>
        <div className="editor-tab-actions">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onDiscard}>
                <X className="size-4 mr-1" /> Discard
              </Button>
            </TooltipTrigger>
            <TooltipContent>Discard changes (Esc)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="success"
                size="sm"
                onClick={handleSave}
                disabled={!title.trim() || !scriptBody.trim()}
              >
                <Save className="size-4 mr-1" /> Save
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save (⌘S)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="editor-tab-body">

        {/* Title */}
        <div className="editor-section">
          <label className="editor-label">Title</label>
          <input
            className="editor-title-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Command title…"
            autoFocus={isNew}
          />
        </div>

        {/* Category */}
        <div className="editor-section">
          <label className="editor-label">Category</label>
          <Select value={categoryId || '__none__'} onValueChange={v => setCategoryId(v === '__none__' ? '' : v)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                <span className="italic opacity-60">Uncategorized</span>
              </SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tags */}
        <div className="editor-section">
          <label className="editor-label">Tags</label>
          <div className="tags-input-wrapper">
            {tags.map(tag => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button onClick={() => setTags(prev => prev.filter(t => t !== tag))}>
                  <X className="size-2.5" />
                </button>
              </Badge>
            ))}
            <input
              className="tags-input-field"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder={tags.length === 0 ? 'Add tags (Enter or comma)…' : ''}
            />
          </div>
        </div>

        {/* Description */}
        <div className="editor-section">
          <label className="editor-label">Description</label>
          <textarea
            className="editor-description-input"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional description…"
            rows={2}
          />
        </div>

        {/* Script */}
        <div className="editor-section editor-section-grow">
          <label className="editor-label">
            Script
            {variables.length > 0 && (
              <span className="editor-label-hint">
                — detected variables: {variables.map(v => `{{${v.name}}}`).join(', ')}
              </span>
            )}
          </label>
          <textarea
            ref={scriptRef}
            className="editor-script-input"
            value={scriptBody}
            onChange={e => setScriptBody(e.target.value)}
            placeholder={"#!/bin/bash\necho 'Hello {{name}}'"}
            spellCheck={false}
          />
        </div>

        {/* Variables summary (auto-detected) */}
        {variables.length > 0 && (
          <div className="editor-section">
            <label className="editor-label">Variables <span className="editor-label-hint">(auto-detected from script)</span></label>
            <div className="editor-vars-list">
              {variables.map((v, i) => (
                <div key={v.name} className="editor-var-row">
                  <span className="editor-var-name">{"{{" + v.name + "}}"}</span>
                  <input
                    className="editor-var-default"
                    value={v.default ?? ''}
                    onChange={e => setVariables(prev => prev.map((vv, ii) =>
                      ii === i ? { ...vv, default: e.target.value } : vv
                    ))}
                    placeholder="default value or CEL expression…"
                  />
                  <input
                    className="editor-var-desc"
                    value={v.description ?? ''}
                    onChange={e => setVariables(prev => prev.map((vv, ii) =>
                      ii === i ? { ...vv, description: e.target.value } : vv
                    ))}
                    placeholder="description (optional)"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommandEditorTab;

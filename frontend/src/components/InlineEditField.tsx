import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil } from 'lucide-react';
import { isCmdOrCtrl } from '@/lib/shortcuts';

export interface InlineEditFieldProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Single-line input or textarea */
  multiline?: boolean;
  /** Min rows when multiline */
  rows?: number;
  displayClassName?: string;
  inputClassName?: string;
  disabled?: boolean;
}

/**
 * Click-to-edit: shows text; pencil on hover; click switches to input.
 * Blur commits to onChange; Escape reverts visual to last committed value without notifying parent until blur cancelled.
 */
const InlineEditField: React.FC<InlineEditFieldProps> = ({
  value,
  onChange,
  placeholder = '',
  multiline = false,
  rows = 2,
  displayClassName = '',
  inputClassName = '',
  disabled = false,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current) inputRef.current.select();
    }
  }, [editing]);

  const startEditing = useCallback(() => {
    setDraft(value);
    setEditing(true);
  }, [value]);

  const commit = useCallback(() => {
    onChange(draft);
    setEditing(false);
  }, [draft, onChange]);

  const cancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  if (disabled) {
    return (
      <span className={`inline-edit-display inline-edit-disabled ${displayClassName}`.trim()}>
        {value || <span className="opacity-50">{placeholder}</span>}
      </span>
    );
  }

  if (editing) {
    const className = `inline-edit-input ${inputClassName}`.trim();
    const onKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
      if (!multiline && e.key === 'Enter') {
        e.preventDefault();
        commit();
      }
      if (multiline && isCmdOrCtrl(e) && e.key === 'Enter') {
        e.preventDefault();
        commit();
      }
    };
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          className={className}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={rows}
          spellCheck
        />
      );
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        className={className}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        spellCheck={false}
      />
    );
  }

  return (
    <button
      type="button"
      className={`inline-edit-display ${displayClassName}`.trim()}
      onClick={startEditing}
    >
      <span className="inline-edit-text">
        {value || <span className="inline-edit-placeholder">{placeholder}</span>}
      </span>
      <span className="inline-edit-pencil" aria-hidden>
        <Pencil className="size-3.5" />
      </span>
    </button>
  );
};

export default InlineEditField;

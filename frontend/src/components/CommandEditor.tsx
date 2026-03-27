import React, { useState, KeyboardEvent } from 'react';
import { Category, Command } from '../types';

interface CommandEditorProps {
  command?: Command; // if editing, otherwise creating
  categories: Category[];
  defaultCategoryId?: string;
  onSave: (data: { title: string; description: string; commandText: string; categoryId: string; tags: string[] }) => void;
  onCancel: () => void;
}

const CommandEditor: React.FC<CommandEditorProps> = ({
  command,
  categories,
  defaultCategoryId,
  onSave,
  onCancel,
}) => {
  const [title, setTitle] = useState(command?.title || '');
  const [description, setDescription] = useState(command?.description || '');
  const [commandText, setCommandText] = useState(command?.commandText || '');
  const [categoryId, setCategoryId] = useState(command?.categoryId || defaultCategoryId || '');
  const [tags, setTags] = useState<string[]>(command?.tags || []);
  const [tagInput, setTagInput] = useState('');

  const handleSave = () => {
    if (!title.trim() || !commandText.trim()) return;
    onSave({ title: title.trim(), description: description.trim(), commandText: commandText.trim(), categoryId, tags });
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(',', '');
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{command ? 'Edit Command' : 'New Command'}</h2>
          <button className="btn-icon" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Title</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g., Scan Redis Keys"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              className="form-input"
              placeholder="What does this command do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>Command</label>
            <textarea
              className="form-input form-input-mono"
              placeholder="redis-cli --scan --pattern {?pattern}"
              value={commandText}
              onChange={(e) => setCommandText(e.target.value)}
              rows={3}
            />
            <div className="form-hint">
              Use <code>{'{?variableName}'}</code> for variable placeholders that will be prompted before execution.
            </div>
          </div>
          <div className="form-group">
            <label>Category</label>
            <select
              className="form-select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Uncategorized</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Tags</label>
            <div className="tags-input-wrapper">
              {tags.map(tag => (
                <span key={tag} className="tag-chip">
                  {tag}
                  <span className="tag-remove" onClick={() => removeTag(tag)}>✕</span>
                </span>
              ))}
              <input
                type="text"
                placeholder={tags.length === 0 ? 'Type and press Enter...' : ''}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!title.trim() || !commandText.trim()}
          >
            {command ? 'Save Changes' : 'Create Command'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommandEditor;

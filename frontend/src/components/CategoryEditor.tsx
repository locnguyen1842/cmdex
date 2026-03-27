import React, { useState } from 'react';
import { Category } from '../types';

const COLORS = [
  '#7c6aef', '#f87272', '#36d399', '#fbbd23', '#66d9ef',
  '#ff79c6', '#f1fa8c', '#bd93f9', '#ff6e6e', '#50fa7b',
  '#8be9fd', '#ffb86c', '#6272a4', '#ff55a3', '#69ff94',
];

interface CategoryEditorProps {
  category?: Category;
  onSave: (data: { name: string; color: string }) => void;
  onCancel: () => void;
}

const CategoryEditor: React.FC<CategoryEditorProps> = ({
  category,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(category?.name || '');
  const [color, setColor] = useState(category?.color || COLORS[0]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), color });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{category ? 'Edit Category' : 'New Category'}</h2>
          <button className="btn-icon" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Name</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g., Redis, Docker, Git"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Color</label>
            <div className="color-picker-row">
              {COLORS.map(c => (
                <div
                  key={c}
                  className={`color-swatch ${color === c ? 'selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                >
                  {color === c && <span className="check">✓</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!name.trim()}
          >
            {category ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryEditor;

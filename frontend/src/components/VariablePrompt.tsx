import React, { useState } from 'react';
import { VariablePrompt as VariablePromptType } from '../types';

interface VariablePromptProps {
  variables: VariablePromptType[];
  commandText: string;
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
}

const VariablePrompt: React.FC<VariablePromptProps> = ({
  variables,
  commandText,
  onSubmit,
  onCancel,
}) => {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    variables.forEach(v => {
      init[v.name] = v.defaultValue || '';
    });
    return init;
  });

  const handleSubmit = () => {
    onSubmit(values);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Build preview of command with substituted values
  const getPreview = () => {
    let preview = commandText;
    for (const [name, value] of Object.entries(values)) {
      preview = preview.replaceAll(`{?${name}}`, value || `{?${name}}`);
    }
    return preview;
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔧 Fill in Variables</h2>
          <button className="btn-icon" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <div className="variable-prompt-list">
            {variables.map((v, i) => (
              <div key={v.name} className="variable-prompt-item">
                <div className="var-name">{v.name}</div>
                <input
                  className="form-input form-input-mono"
                  type="text"
                  placeholder={`Enter value for ${v.name}`}
                  value={values[v.name] || ''}
                  onChange={(e) =>
                    setValues({ ...values, [v.name]: e.target.value })
                  }
                  onKeyDown={handleKeyDown}
                  autoFocus={i === 0}
                />
              </div>
            ))}
          </div>

          <div className="detail-section" style={{ marginTop: 20 }}>
            <div className="detail-section-title">Preview</div>
            <div className="command-text-box" style={{ fontSize: 12 }}>
              {getPreview()}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-success" onClick={handleSubmit}>
            ▶ Execute
          </button>
        </div>
      </div>
    </div>
  );
};

export default VariablePrompt;

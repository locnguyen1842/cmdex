import React from 'react';
import { Command, ExecutionResult } from '../types';

interface CommandDetailProps {
  command: Command;
  executionResult: ExecutionResult | null;
  isExecuting: boolean;
  onExecute: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

// Renders command text with highlighted variable placeholders
function renderCommandText(text: string): React.ReactNode[] {
  const regex = /(\{\?\w+\})/g;
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (regex.test(part)) {
      // Reset regex lastIndex since we're using test after split
      regex.lastIndex = 0;
      return (
        <span key={i} className="variable-highlight">{part}</span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

const CommandDetail: React.FC<CommandDetailProps> = ({
  command,
  executionResult,
  isExecuting,
  onExecute,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="command-detail">
      <div className="detail-header">
        <h1 className="detail-title">{command.title}</h1>
        {command.description && (
          <p className="detail-description">{command.description}</p>
        )}
        {command.tags && command.tags.length > 0 && (
          <div className="detail-tags">
            {command.tags.map((tag, i) => (
              <span key={i} className="tag">{tag}</span>
            ))}
          </div>
        )}
      </div>

      <div className="detail-section">
        <div className="detail-section-title">Command</div>
        <div className="command-text-box">
          {renderCommandText(command.commandText)}
        </div>
      </div>

      <div className="command-actions">
        <button className="btn btn-success" onClick={onExecute} disabled={isExecuting}>
          {isExecuting ? (
            <>
              <span className="spinner" /> Running...
            </>
          ) : (
            <>▶ Execute</>
          )}
        </button>
        <button className="btn btn-ghost" onClick={onEdit}>
          ✎ Edit
        </button>
        <button className="btn btn-danger" onClick={onDelete}>
          🗑 Delete
        </button>
      </div>

      {(executionResult || isExecuting) && (
        <div className="output-terminal">
          <div className="output-terminal-header">
            <div className="terminal-title">
              <span className="terminal-dots">
                <span className="terminal-dot" style={{ background: '#ff5f56' }} />
                <span className="terminal-dot" style={{ background: '#ffbd2e' }} />
                <span className="terminal-dot" style={{ background: '#27c93f' }} />
              </span>
              Output
            </div>
          </div>
          <div className="output-terminal-body">
            {isExecuting && !executionResult && (
              <div className="output-line">
                <span className="output-cmd">$ {command.commandText}</span>
                <br />
                <span className="output-cursor" />
              </div>
            )}
            {executionResult && (
              <>
                <div className="output-cmd">$ {command.commandText}</div>
                {executionResult.output && (
                  <div className="output-line">{executionResult.output}</div>
                )}
                {executionResult.error && (
                  <div className="output-line output-error">{executionResult.error}</div>
                )}
                {executionResult.exitCode !== 0 && (
                  <div className="output-line output-error">
                    Process exited with code {executionResult.exitCode}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommandDetail;

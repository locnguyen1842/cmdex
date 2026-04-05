import React from 'react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { isMac, cmdSymbol as cmd } from '../hooks/useKeyboardShortcuts';

const SHORTCUTS = [
  { keys: `${cmd}T / ${cmd}N`, description: 'New command tab' },
  { keys: `${cmd}P`, description: 'Command palette' },
  { keys: `${cmd}F`, description: 'Search commands' },
  { keys: `${cmd}↩`, description: 'Run command' },
  { keys: `${cmd}S`, description: 'Save command' },
  { keys: `${cmd}1-6`, description: 'Switch to tab 1–6' },
  { keys: `${cmd}0`, description: 'Switch to last tab' },
  { keys: `${cmd},`, description: 'Settings' },
  { keys: isMac ? '⌘W' : 'Ctrl+W', description: 'Close tab' },
];

interface WelcomeTabProps {
  onNewCommand: () => void;
}

const WelcomeTab: React.FC<WelcomeTabProps> = ({ onNewCommand }) => {
  return (
    <div className="welcome-tab">
      <div className="welcome-tab-inner">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="64" height="64">
          <rect width="1024" height="1024" rx="180" ry="180" fill="currentColor" fillOpacity="0.05" />
          <text x="240" y="620" fontFamily="SF Mono, Menlo, Monaco, Consolas, monospace" fontSize="480" fontWeight="800" fill="currentColor" letterSpacing="-20">C</text>
          <text x="530" y="620" fontFamily="SF Mono, Menlo, Monaco, Consolas, monospace" fontSize="320" fontWeight="700" fill="var(--primary)">&gt;_</text>
        </svg>
        <h2 className="welcome-tab-title">Cmdex</h2>
        <p className="welcome-tab-subtitle">Save, organize, and run CLI commands</p>

        <div className="welcome-shortcuts-card">
          <div className="welcome-shortcuts-title">Keyboard Shortcuts</div>
          {SHORTCUTS.map((s) => (
            <div key={s.description} className="welcome-shortcut-row">
              <span className="welcome-shortcut-desc">{s.description}</span>
              <Kbd>{s.keys}</Kbd>
            </div>
          ))}
        </div>

        <Button className="mt-4" onClick={onNewCommand}>
          + New Command
        </Button>
      </div>
    </div>
  );
};

export default WelcomeTab;

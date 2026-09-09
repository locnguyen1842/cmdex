import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { useTranslation } from 'react-i18next';
import { type Command, type Category } from '../types';
import { getCommandDisplayTitle } from '../utils/tab';
import { filterCommands, scriptSnippet } from '../utils/commandSearch';
import { Kbd, ShortcutLabel } from './ui/kbd';
import { isCmdOrCtrl, cmdSymbol } from '../lib/shortcuts';
import { FileText, Search } from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  commands: Command[];
  categories: Category[];
  onClose: () => void;
  onOpen: (cmd: Command) => void;
  onExecute: (cmd: Command) => void;
}

/** Highlight substring matches in text */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="palette-match">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/** Render a script snippet in mono, turning {{var}} placeholders into pills */
function ScriptPreview({ text }: { text: string }) {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return (
    <span className="palette-item-script mono">
      {parts.map((part, i) => {
        const m = /^\{\{([^}]+)\}\}$/.exec(part);
        if (m) return <span key={i} className="palette-var-chip">{m[1]}</span>;
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  commands,
  categories,
  onClose,
  onOpen,
  onExecute,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const catMap = useMemo(() => {
    const m: Record<string, string> = {};
    categories.forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [categories]);

  const filtered = useMemo(() => filterCommands(query, commands), [query, commands]);

  // Reset selection when results change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(0);
  }, [filtered]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset state on open
      setQuery('');
      setActiveIndex(0);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[activeIndex];
        if (!cmd) return;
        if (isCmdOrCtrl(e)) {
          onExecute(cmd);
        } else {
          onOpen(cmd);
        }
        onClose();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [filtered, activeIndex, onOpen, onExecute, onClose],
  );

  if (!open) return null;

  return (
    <div className="palette-overlay" data-testid="command-palette" onMouseDown={onClose}>
      <div className="palette-modal" onMouseDown={(e) => e.stopPropagation()}>

        {/* Search row */}
        <div className="palette-search">
          <Search size={17} className="palette-search-icon" strokeWidth={1.8} />
          <input
            ref={inputRef}
            className="palette-input"
            data-testid="palette-input"
            placeholder={t('palette.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <Kbd className="palette-esc-kbd">{t('palette.esc')}</Kbd>
        </div>

        {/* Results */}
        <div className="palette-results" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="palette-empty" data-testid="palette-empty">
              {t('palette.noMatches', { query })}
            </div>
          ) : (
            <>
              <div className="palette-group-label">{t('palette.commandsGroup')}</div>
              {filtered.map((cmd, i) => {
                const catName = cmd.categoryId ? catMap[cmd.categoryId] : null;
                const isActive = i === activeIndex;
                const hasTitle = !!(cmd.title?.Valid && cmd.title.String.trim());
                return (
                  <div
                    key={cmd.id}
                    data-idx={i}
                    data-testid={`palette-item-${cmd.id}`}
                    className={`palette-item${isActive ? ' active' : ''}`}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => { onOpen(cmd); onClose(); }}
                  >
                    <FileText size={15} className="palette-item-icon" strokeWidth={1.8} />
                    <div className="palette-item-body">
                      {hasTitle ? (
                        <span className="palette-item-title">
                          <Highlight text={getCommandDisplayTitle(cmd)} query={query.trim()} />
                        </span>
                      ) : (
                        <ScriptPreview text={scriptSnippet(cmd.scriptContent)} />
                      )}
                    </div>
                    {catName && <span className="palette-item-cat">{catName}</span>}
                    {i < 9 && <Kbd className="palette-item-kbd">{cmdSymbol}{i + 1}</Kbd>}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer hints */}
        <div className="palette-footer">
          <span className="palette-hint"><Kbd>↑</Kbd><Kbd>↓</Kbd> {t('palette.hintNavigate')}</span>
          <span className="palette-hint"><Kbd>↩</Kbd> {t('palette.hintOpen')}</span>
          <span className="palette-hint"><ShortcutLabel id="execute" /> {t('palette.hintExecute')}</span>
          <span className="palette-hint"><Kbd>Esc</Kbd> {t('palette.hintClose')}</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;

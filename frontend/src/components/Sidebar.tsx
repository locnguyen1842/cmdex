import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Category, Command } from '../types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Search, Plus, Pencil, X, ChevronRight, Terminal, Settings } from 'lucide-react';

const STORAGE_KEY = 'commamer-expanded-categories';

interface SidebarProps {
  categories: Category[];
  commands: Command[];
  selectedCommandId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectCommand: (cmd: Command) => void;
  onAddCategory: () => void;
  onEditCategory: (cat: Category) => void;
  onDeleteCategory: (catId: string) => void;
  onAddCommand: (categoryId?: string) => void;
  onOpenSettings: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  categories,
  commands,
  selectedCommandId,
  searchQuery,
  onSearchChange,
  onSelectCommand,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onAddCommand,
  onOpenSettings,
}) => {
  const { t } = useTranslation();
  const prevCatIdsRef = useRef<string[]>([]);

  const [openCategories, setOpenCategories] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch { /* ignore */ }
    return new Set(categories.map(c => c.id));
  });

  useEffect(() => {
    const prevIds = prevCatIdsRef.current;
    const currentIds = categories.map(c => c.id);
    const newIds = currentIds.filter(id => !prevIds.includes(id));
    if (newIds.length > 0) {
      setOpenCategories(prev => {
        const next = new Set(prev);
        newIds.forEach(id => next.add(id));
        return next;
      });
    }
    prevCatIdsRef.current = currentIds;
  }, [categories]);

  const persistExpanded = useCallback((expanded: Set<string>) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...expanded])); } catch { /* ignore */ }
  }, []);

  const toggleCategory = (catId: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      persistExpanded(next);
      return next;
    });
  };

  const getCommandsForCategory = (categoryId: string) =>
    commands.filter(cmd => cmd.categoryId === categoryId);

  const uncategorizedCommands = commands.filter(cmd => !cmd.categoryId || cmd.categoryId === '');

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">⌘</div>
          <h1>Commamer</h1>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('sidebar.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 bg-secondary border-border"
          />
        </div>
      </div>

      <ScrollArea className="sidebar-content">
        {categories.map(cat => {
          const catCommands = getCommandsForCategory(cat.id);
          const isOpen = openCategories.has(cat.id);

          return (
            <Collapsible key={cat.id} open={isOpen} onOpenChange={() => toggleCategory(cat.id)}>
              <div className="sidebar-section">
                <CollapsibleTrigger asChild>
                  <div className="sidebar-section-header">
                    <div className="section-left">
                      <ChevronRight className={`size-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                      <span
                        className="category-dot"
                        style={{ backgroundColor: cat.color || '#7c6aef' }}
                      />
                      <span>{cat.name}</span>
                    </div>
                    <div className="section-right">
                      <span className="cmd-count">{catCommands.length}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon-xs" onClick={(e) => { e.stopPropagation(); onAddCommand(cat.id); }}>
                            <Plus />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('sidebar.addCommand')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon-xs" onClick={(e) => { e.stopPropagation(); onEditCategory(cat); }}>
                            <Pencil />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('sidebar.editCategory')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon-xs" onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat.id); }}>
                            <X />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('sidebar.deleteCategory')}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="sidebar-commands">
                    {catCommands.map(cmd => (
                      <div
                        key={cmd.id}
                        className={`command-item ${selectedCommandId === cmd.id ? 'active' : ''}`}
                        onClick={() => onSelectCommand(cmd)}
                      >
                        <Terminal className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="cmd-title">{cmd.title}</span>
                        {cmd.tags && cmd.tags.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {cmd.tags[0]}
                          </Badge>
                        )}
                      </div>
                    ))}
                    {catCommands.length === 0 && (
                      <div
                        className="command-item opacity-60"
                        style={{ fontStyle: 'italic', cursor: 'default' }}
                      >
                        <Plus className="size-3.5 shrink-0 opacity-30" />
                        <span className="cmd-title cursor-pointer" onClick={() => onAddCommand(cat.id)}>
                          {t('sidebar.addACommand')}
                        </span>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}

        {uncategorizedCommands.length > 0 && (
          <Collapsible defaultOpen>
            <div className="sidebar-section">
              <CollapsibleTrigger asChild>
                <div className="sidebar-section-header">
                  <div className="section-left">
                    <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
                    <span className="category-dot" style={{ backgroundColor: '#6c6c88' }} />
                    <span>{t('sidebar.uncategorized')}</span>
                  </div>
                  <div className="section-right">
                    <span className="cmd-count">{uncategorizedCommands.length}</span>
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="sidebar-commands">
                  {uncategorizedCommands.map(cmd => (
                    <div
                      key={cmd.id}
                      className={`command-item ${selectedCommandId === cmd.id ? 'active' : ''}`}
                      onClick={() => onSelectCommand(cmd)}
                    >
                      <Terminal className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="cmd-title">{cmd.title}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}
      </ScrollArea>

      <div className="sidebar-footer">
        <div className="add-btns">
          <Button variant="ghost" size="sm" onClick={onAddCategory}>
            <Plus className="size-3.5" /> {t('sidebar.category')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAddCommand()}>
            <Plus className="size-3.5" /> {t('sidebar.command')}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onOpenSettings} className="ml-auto">
            <Settings className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Category, Command } from '../types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Search, Plus, Pencil, X, ChevronRight, Terminal, Settings, GripVertical } from 'lucide-react';

const STORAGE_KEY = 'cmdex-expanded-categories';

/** Normalize null/undefined/'' to '' for uncategorized bucket */
const normCatId = (id: string | null | undefined): string => id || '';

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
  onEditCommand: (cmd: Command) => void;
  onDeleteCommand: (cmd: Command) => void;
  onManagePresets: (cmd: Command) => void;
  onReorderCommand: (id: string, newPosition: number, newCategoryId: string) => void;
  onOpenSettings: () => void;
}

interface SortableCommandItemProps {
  cmd: Command;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onManagePresets: () => void;
}

const SortableCommandItem: React.FC<SortableCommandItemProps> = ({
  cmd,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onManagePresets,
}) => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cmd.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={(e) => e.stopPropagation()}>
        <div
          ref={setNodeRef}
          style={style}
          className={`command-item ${isSelected ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
          onClick={onSelect}
        >
          <span
            className="drag-handle"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="size-3.5" />
          </span>
          <Terminal className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="cmd-title">{cmd.title}</span>
          {cmd.tags && cmd.tags.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {cmd.tags[0]}
            </Badge>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onEdit}>
          <Pencil className="size-3.5" /> {t('sidebar.contextMenu.edit')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={onManagePresets}>
          <Settings className="size-3.5" /> {t('sidebar.contextMenu.managePresets')}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
          <X className="size-3.5" /> {t('sidebar.contextMenu.delete')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

const DroppableCategoryZone: React.FC<{ categoryId: string; children: React.ReactNode }> = ({ categoryId, children }) => {
  const { setNodeRef } = useDroppable({ id: `category-drop-${categoryId}` });
  return (
    <div ref={setNodeRef} className="sidebar-commands" style={{ minHeight: 8 }}>
      {children}
    </div>
  );
};

const DroppableCategoryHeader: React.FC<{ categoryId: string; children: React.ReactNode }> = ({ categoryId, children }) => {
  const { setNodeRef } = useDroppable({ id: `category-header-${categoryId}` });
  return <div ref={setNodeRef}>{children}</div>;
};

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
  onEditCommand,
  onDeleteCommand,
  onManagePresets,
  onReorderCommand,
  onOpenSettings,
}) => {
  const { t } = useTranslation();
  const prevCatIdsRef = useRef<string[]>([]);

  const [openCategories, setOpenCategories] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch { /* ignore */ }
    const initial = new Set(categories.map(c => c.id));
    initial.add('__uncategorized__');
    return initial;
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
    commands.filter(cmd => cmd.categoryId === categoryId).sort((a, b) => a.position - b.position);

  const uncategorizedCommands = commands
    .filter(cmd => !cmd.categoryId || cmd.categoryId === '')
    .sort((a, b) => a.position - b.position);

  // DnD state
  const [activeCommand, setActiveCommand] = useState<Command | null>(null);
  const [overCategoryId, setOverCategoryId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveCommand(commands.find(c => c.id === String(event.active.id)) ?? null);
  }, [commands]);

  const parseCategoryDropId = (id: string): string | null => {
    if (id.startsWith('category-drop-')) return id.slice('category-drop-'.length);
    if (id.startsWith('category-header-')) return id.slice('category-header-'.length);
    return null;
  };

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id;
    if (!overId) { setOverCategoryId(null); return; }
    const overStr = String(overId);
    const catId = parseCategoryDropId(overStr);
    if (catId !== null) {
      setOverCategoryId(catId);
    } else if (categories.some(c => c.id === overId)) {
      setOverCategoryId(overStr);
    } else {
      const cmd = commands.find(c => c.id === overId);
      setOverCategoryId(normCatId(cmd?.categoryId));
    }
  }, [categories, commands]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCommand(null);
    setOverCategoryId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeCmd = commands.find(c => c.id === activeId);
    if (!activeCmd) return;

    const catDropId = parseCategoryDropId(overId);
    const isCatDrop = catDropId !== null || categories.some(c => c.id === overId);
    let targetCategoryId: string;
    let targetIndex: number;

    if (isCatDrop) {
      targetCategoryId = catDropId !== null ? catDropId : overId;
      const catCmds = commands.filter(c => normCatId(c.categoryId) === normCatId(targetCategoryId));
      targetIndex = catCmds.length;
    } else {
      const overCmd = commands.find(c => c.id === overId);
      targetCategoryId = normCatId(overCmd?.categoryId);

      if (normCatId(targetCategoryId) !== normCatId(activeCmd.categoryId)) {
        const catCmds = commands.filter(c => normCatId(c.categoryId) === normCatId(targetCategoryId));
        targetIndex = catCmds.length;
      } else {
        const catCmds = commands
          .filter(c => normCatId(c.categoryId) === normCatId(targetCategoryId))
          .sort((a, b) => a.position - b.position);
        targetIndex = catCmds.findIndex(c => c.id === overId);
        if (targetIndex === -1) targetIndex = catCmds.length;
      }
    }

    onReorderCommand(activeId, targetIndex, targetCategoryId);
  }, [commands, categories, onReorderCommand]);

  const isUncatDropTarget = overCategoryId === '';
  const isUncatOpen = openCategories.has('__uncategorized__');

  return (
    <div className="sidebar">
      {/* Header — outside context menu trigger so right-click doesn't fire */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="32" height="32">
              <rect width="1024" height="1024" rx="180" ry="180" fill="#0F0F14"/>
              <text x="240" y="620" fontFamily="SF Mono, Menlo, Monaco, Consolas, monospace" fontSize="480" fontWeight="800" fill="#FFFFFF" letterSpacing="-20">C</text>
              <text x="530" y="620" fontFamily="SF Mono, Menlo, Monaco, Consolas, monospace" fontSize="320" fontWeight="700" fill="#4A9EFF">&gt;_</text>
            </svg>
          </div>
          <h1>Cmdex</h1>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={onOpenSettings} className="ml-auto">
                <Settings className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('sidebar.settings')}</TooltipContent>
          </Tooltip>
        </div>
        <div className="sidebar-search-row">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('sidebar.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 h-8 bg-secondary border-border"
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                onClick={() => onAddCommand()}
                className="shrink-0 size-8"
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('sidebar.newCommand')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Command list with DnD — context menu scoped to scroll area only */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <ScrollArea className="sidebar-content">
              {categories.map(cat => {
                const catCommands = getCommandsForCategory(cat.id);
                const isOpen = openCategories.has(cat.id);
                const isDropTarget = overCategoryId === cat.id;

                return (
                  <Collapsible key={cat.id} open={isOpen} onOpenChange={() => toggleCategory(cat.id)}>
                    <DroppableCategoryHeader categoryId={cat.id}>
                    <div className={`sidebar-section ${isDropTarget ? 'drop-target' : ''}`}>
                      <ContextMenu>
                        <ContextMenuTrigger asChild onContextMenu={(e) => e.stopPropagation()}>
                          <CollapsibleTrigger asChild>
                            <div className="sidebar-section-header" data-category-id={cat.id}>
                              <div className="section-left">
                                <ChevronRight className={`size-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                                <span className="category-dot" style={{ backgroundColor: cat.color || '#7c6aef' }} />
                                <span>{cat.name}</span>
                              </div>
                              <div className="section-right">
                                <span className="cmd-count">{catCommands.length}</span>
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
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem onSelect={() => onAddCommand(cat.id)}>
                            <Plus className="size-3.5" /> {t('sidebar.contextMenu.newCommand')}
                          </ContextMenuItem>
                          <ContextMenuItem onSelect={onAddCategory}>
                            <ChevronRight className="size-3.5" /> {t('sidebar.contextMenu.newGroup')}
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      <CollapsibleContent>
                        <SortableContext
                          items={catCommands.map(c => c.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <DroppableCategoryZone categoryId={cat.id}>
                            {catCommands.map(cmd => (
                              <SortableCommandItem
                                key={cmd.id}
                                cmd={cmd}
                                isSelected={selectedCommandId === cmd.id}
                                onSelect={() => onSelectCommand(cmd)}
                                onEdit={() => onEditCommand(cmd)}
                                onDelete={() => onDeleteCommand(cmd)}
                                onManagePresets={() => onManagePresets(cmd)}
                              />
                            ))}
                            {catCommands.length === 0 && (
                              <div className="command-item opacity-60" style={{ fontStyle: 'italic', cursor: 'default' }}>
                                <Plus className="size-3.5 shrink-0 opacity-30" />
                                <span className="cmd-title cursor-pointer" onClick={() => onAddCommand(cat.id)}>
                                  {t('sidebar.addACommand')}
                                </span>
                              </div>
                            )}
                          </DroppableCategoryZone>
                        </SortableContext>
                      </CollapsibleContent>
                    </div>
                    </DroppableCategoryHeader>
                  </Collapsible>
                );
              })}

              {/* Uncategorized — always rendered so it's a valid drop target */}
              <Collapsible open={isUncatOpen} onOpenChange={() => toggleCategory('__uncategorized__')}>
                <DroppableCategoryHeader categoryId="">
                <div className={`sidebar-section ${isUncatDropTarget ? 'drop-target' : ''}`}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild onContextMenu={(e) => e.stopPropagation()}>
                      <CollapsibleTrigger asChild>
                        <div className="sidebar-section-header">
                          <div className="section-left">
                            <ChevronRight className={`size-3.5 transition-transform ${isUncatOpen ? 'rotate-90' : ''}`} />
                            <span className="category-dot" style={{ backgroundColor: '#6c6c88' }} />
                            <span>{t('sidebar.uncategorized')}</span>
                          </div>
                          <div className="section-right">
                            <span className="cmd-count">{uncategorizedCommands.length}</span>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onSelect={() => onAddCommand()}>
                        <Plus className="size-3.5" /> {t('sidebar.contextMenu.newCommand')}
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={onAddCategory}>
                        <ChevronRight className="size-3.5" /> {t('sidebar.contextMenu.newGroup')}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  <CollapsibleContent>
                    <SortableContext
                      items={uncategorizedCommands.map(c => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <DroppableCategoryZone categoryId="">
                        {uncategorizedCommands.map(cmd => (
                          <SortableCommandItem
                            key={cmd.id}
                            cmd={cmd}
                            isSelected={selectedCommandId === cmd.id}
                            onSelect={() => onSelectCommand(cmd)}
                            onEdit={() => onEditCommand(cmd)}
                            onDelete={() => onDeleteCommand(cmd)}
                            onManagePresets={() => onManagePresets(cmd)}
                          />
                        ))}
                      </DroppableCategoryZone>
                    </SortableContext>
                  </CollapsibleContent>
                </div>
                </DroppableCategoryHeader>
              </Collapsible>
            </ScrollArea>
          </ContextMenuTrigger>
          {/* Empty-space context menu (scoped to scroll area) */}
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => onAddCommand()}>
              <Plus className="size-3.5" /> {t('sidebar.contextMenu.newCommand')}
            </ContextMenuItem>
            <ContextMenuItem onSelect={onAddCategory}>
              <ChevronRight className="size-3.5" /> {t('sidebar.contextMenu.newGroup')}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {/* Drag overlay ghost */}
        <DragOverlay>
          {activeCommand && (
            <div className="command-item dragging-ghost">
              <GripVertical className="size-3.5 text-muted-foreground" />
              <Terminal className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="cmd-title">{activeCommand.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default Sidebar;

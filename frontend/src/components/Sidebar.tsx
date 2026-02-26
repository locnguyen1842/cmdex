import React, { useState, useRef, KeyboardEvent } from 'react';
import { Category, Command } from '../types';

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
}) => {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (catId: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const getCommandsForCategory = (categoryId: string) => {
    return commands.filter(cmd => cmd.categoryId === categoryId);
  };

  const uncategorizedCommands = commands.filter(cmd => !cmd.categoryId || cmd.categoryId === '');

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">⌘</div>
          <h1>Commamer</h1>
        </div>
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search commands..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="sidebar-content">
        {categories.map(cat => {
          const catCommands = getCommandsForCategory(cat.id);
          const isCollapsed = collapsedCategories.has(cat.id);

          return (
            <div className="sidebar-section" key={cat.id}>
              <div className="sidebar-section-header" onClick={() => toggleCategory(cat.id)}>
                <div className="section-left">
                  <span className={`chevron ${!isCollapsed ? 'open' : ''}`}>▶</span>
                  <span
                    className="category-dot"
                    style={{ backgroundColor: cat.color || '#7c6aef' }}
                  />
                  <span>{cat.name}</span>
                </div>
                <div className="section-right">
                  <span className="cmd-count">{catCommands.length}</span>
                  <button
                    className="section-btn"
                    onClick={(e) => { e.stopPropagation(); onAddCommand(cat.id); }}
                    title="Add command"
                  >+</button>
                  <button
                    className="section-btn"
                    onClick={(e) => { e.stopPropagation(); onEditCategory(cat); }}
                    title="Edit category"
                  >✎</button>
                  <button
                    className="section-btn"
                    onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat.id); }}
                    title="Delete category"
                  >✕</button>
                </div>
              </div>
              <div className={`sidebar-commands ${isCollapsed ? 'collapsed' : ''}`}>
                {catCommands.map(cmd => (
                  <div
                    key={cmd.id}
                    className={`command-item ${selectedCommandId === cmd.id ? 'active' : ''}`}
                    onClick={() => onSelectCommand(cmd)}
                  >
                    <span className="cmd-icon">⌘</span>
                    <span className="cmd-title">{cmd.title}</span>
                    {cmd.tags && cmd.tags.length > 0 && (
                      <div className="cmd-tags">
                        <span className="tag tag-default">{cmd.tags[0]}</span>
                      </div>
                    )}
                  </div>
                ))}
                {catCommands.length === 0 && !isCollapsed && (
                  <div
                    className="command-item"
                    style={{ color: 'var(--text-tertiary)', fontStyle: 'italic', cursor: 'default' }}
                  >
                    <span className="cmd-icon" style={{ opacity: 0.3 }}>+</span>
                    <span className="cmd-title" onClick={() => onAddCommand(cat.id)} style={{ cursor: 'pointer' }}>
                      Add a command...
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {uncategorizedCommands.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-header" onClick={() => toggleCategory('__uncategorized')}>
              <div className="section-left">
                <span className={`chevron ${!collapsedCategories.has('__uncategorized') ? 'open' : ''}`}>▶</span>
                <span
                  className="category-dot"
                  style={{ backgroundColor: '#6c6c88' }}
                />
                <span>Uncategorized</span>
              </div>
              <div className="section-right">
                <span className="cmd-count">{uncategorizedCommands.length}</span>
              </div>
            </div>
            <div className={`sidebar-commands ${collapsedCategories.has('__uncategorized') ? 'collapsed' : ''}`}>
              {uncategorizedCommands.map(cmd => (
                <div
                  key={cmd.id}
                  className={`command-item ${selectedCommandId === cmd.id ? 'active' : ''}`}
                  onClick={() => onSelectCommand(cmd)}
                >
                  <span className="cmd-icon">⌘</span>
                  <span className="cmd-title">{cmd.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="add-btns">
          <button className="btn-add" onClick={onAddCategory}>
            <span>+</span> Category
          </button>
          <button className="btn-add" onClick={() => onAddCommand()}>
            <span>+</span> Command
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;

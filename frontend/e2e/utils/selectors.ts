// CSS selectors mapped to data-testid attributes

export const sel = {
  // Sidebar
  sidebar: '[data-testid="sidebar"]',
  sidebarHeader: '[data-testid="sidebar-header"]',
  sidebarAddCommand: '[data-testid="sidebar-add-command"]',
  sidebarSettings: '[data-testid="sidebar-settings"]',
  categoryGroup: (name: string) => `[data-testid="category-group-${name}"]`,
  categoryHeader: (catId: string) => `[data-testid="category-header-${catId}"]`,
  commandItem: (cmdId: string) => `[data-testid="command-item-${cmdId}"]`,
  commandItemTitle: (cmdId: string) => `[data-testid="command-item-${cmdId}"] .cmd-title`,

  // Tab bar
  tabBar: '[data-testid="tab-bar"]',
  tabItem: (tabId: string) => `[data-testid="tab-${tabId}"]`,

  // Command detail
  commandTitle: '[data-testid="command-title"]',
  commandDescription: '[data-testid="command-description"]',
  commandTags: '[data-testid="command-tags"]',
  commandScript: '[data-testid="command-script"]',
  commandRunBtn: '[data-testid="command-run-btn"]',
  commandSaveBtn: '[data-testid="command-save-btn"]',
  commandRunTerminalBtn: '[data-testid="command-run-terminal-btn"]',

  // Modals
  categoryEditor: '[data-testid="category-editor"]',
  categoryNameInput: '[data-testid="category-name-input"]',
  confirmDialog: '[data-testid="confirm-dialog"]',
  confirmDialogCancel: '[data-testid="confirm-dialog-cancel"]',
  confirmDialogConfirm: '[data-testid="confirm-dialog-confirm"]',

  // Floating save bar
  floatingSaveBar: '[data-testid="floating-save-bar"]',
  saveBarSave: '[data-testid="save-bar-save"]',
  saveBarDiscard: '[data-testid="save-bar-discard"]',

  // Output / History
  outputPane: '[data-testid="output-pane"]',
  historyPane: '[data-testid="history-pane"]',

  // Command palette
  commandPalette: '[data-testid="command-palette"]',
  paletteInput: '[data-testid="palette-input"]',
};

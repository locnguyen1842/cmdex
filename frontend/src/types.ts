// Type definitions matching Go backend models

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface VariableDefinition {
  name: string;
  description: string;
  example: string;
  default: string;
  sortOrder: number;
}

export interface VariablePreset {
  id: string;
  name: string;
  position: number;
  values: Record<string, string>;
}

export interface NullString {
  String: string;
  Valid: boolean;
}

export interface OSPathMap {
  [os: string]: string;
}

export const THEMES: ReadonlyArray<{ id: string; label: string; type: 'dark' | 'light' }> = [
  { id: 'vscode-dark', label: 'VS Code Dark+', type: 'dark' },
  { id: 'vscode-light', label: 'VS Code Light+', type: 'light' },
  { id: 'monokai', label: 'Monokai', type: 'dark' },
  { id: 'tokyo-night', label: 'Tokyo Night', type: 'dark' },
  { id: 'one-dark', label: 'One Dark Pro', type: 'dark' },
  { id: 'classic', label: 'Cmdex Classic', type: 'dark' },
  { id: 'classic-light', label: 'Cmdex Classic Light', type: 'light' },
  { id: 'catppuccin-mocha', label: 'Catppuccin Mocha', type: 'dark' },
  { id: 'dracula', label: 'Dracula', type: 'dark' },
];

export interface CustomTheme {
  id: string;
  name: string;
  type: 'dark' | 'light';
  colors: Record<string, string>;
}

export type OSKey = 'darwin' | 'linux' | 'windows' | 'unknown';

export interface Command {
  id: string;
  title: NullString;
  description: NullString;
  scriptContent: string;
  tags: string[];
  variables: VariableDefinition[];
  presets: VariablePreset[];
  workingDir: OSPathMap;
  categoryId: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface VariablePrompt {
  name: string;
  placeholder: string;
  description: string;
  example: string;
  defaultExpr: string;
  defaultValue: string;
}

export interface SessionInfo {
  id: string;
  name: string;
  running: boolean;
  shellPath: string;
  workingDir: string;
  /** Live cwd as last reported by shell integration (OSC 7), or `workingDir`
   * until the first report. Kept current afterwards via `pty-cwd:<id>`
   * events — see App.tsx's `sessionCwds`. */
  cwd: string;
}

export interface ExecutionRecord {
  id: string;
  commandId: string;
  scriptContent: string;
  finalCmd: string;
  output: string;
  error: string;
  exitCode: number;
  workingDir: string;
  executedAt: string;
}

/** Per-command-tab draft for inline editing (batch save). */
export interface TabDraftRevealed {
  title: boolean;
  description: boolean;
  tags: boolean;
}

export interface TabDraft {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  scriptBody: string;
  variables: VariableDefinition[];
  workingDir: OSPathMap;
  revealed: TabDraftRevealed;
}

export interface SettingsPayload {
  locale?: string;
  theme?: string;
  lastDarkTheme?: string;
  lastLightTheme?: string;
  customThemes?: string;
  uiFont?: string;
  monoFont?: string;
  density?: string;
  defaultWorkingDir?: OSPathMap;
  windowX?: number;
  windowY?: number;
  windowWidth?: number;
  windowHeight?: number;
  shellIntegration?: boolean;
  terminalSuggestions?: boolean;
  autoUpdateCheck?: boolean;
  betaChannel?: boolean;
  lastUpdateCheck?: string;
}

/** About dialog snapshot from UpdateService.GetAppInfo. */
export interface AppInfo {
  version: string;
  arch: string;
  updatesEnabled: boolean;
  betaChannel: boolean;
  /** Last completed check, RFC3339 UTC; '' = never. */
  lastCheck: string;
  state: string;
  pendingVersion: string;
  /** Message of the last check/download failure; '' unless state is 'error'. */
  lastError: string;
}

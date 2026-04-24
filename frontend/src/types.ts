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
  { id: 'classic', label: 'Classic (Purple)', type: 'dark' },
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

/**
 * Normalizes a raw runtime OS string to a well-known OSKey.
 */
export function normalizeOS(raw: string): OSKey {
  if (raw === 'darwin' || raw === 'linux' || raw === 'windows') return raw;
  return 'unknown';
}

/**
 * Returns the path for the current OS from an OSPathMap, or empty string if not set.
 * This is the primary way the frontend should read working directories.
 */
export function getOSPath(map: OSPathMap | undefined, os: OSKey): string {
  if (os === 'unknown') return '';
  return map?.[os] || '';
}

/**
 * Sets or clears a path for the given OS in an OSPathMap.
 * Returns a new map; does not mutate the input.
 * If path is empty, the OS key is removed.
 */
export function setOSPath(map: OSPathMap | undefined, os: OSKey, path: string): OSPathMap {
  const updated: OSPathMap = { ...(map || {}) };
  if (os === 'unknown') return updated;
  if (path) {
    updated[os] = path;
  } else {
    delete updated[os];
  }
  return updated;
}

/**
 * Shortens a file path to show only the last N segments.
 * If the path has fewer than N segments, returns it as-is.
 * If the path is empty, returns empty string.
 */
export function shortenPath(path: string, segments: number = 2): string {
  if (!path) return '';
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= segments) return path;
  const sep = path.includes('\\') ? '\\' : '/';
  return '...' + sep + parts.slice(-segments).join(sep);
}

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

/** Returns a display title for a command, using script body as fallback */
export function getCommandDisplayTitle(cmd: Command | null | undefined): string {
  if (!cmd) return '';
  if (cmd.title?.Valid && cmd.title.String.trim()) return cmd.title.String.trim();
  
  let body = cmd.scriptContent;
  if (body.startsWith('#!/bin/bash\n')) {
    body = body.slice('#!/bin/bash\n'.length);
  } else if (body.startsWith('#!/bin/bash')) {
    body = body.slice('#!/bin/bash'.length);
  }
  
  body = body.replace(/\n/g, ' ').trim();
  
  if (body.length === 0) return '';
  if (body.length <= 50) return body;
  return body.slice(0, 50) + '...';
}

export interface VariablePrompt {
  name: string;
  placeholder: string;
  description: string;
  example: string;
  defaultExpr: string;
  defaultValue: string;
}

export interface TerminalInfo {
  id: string;
  name: string;
}

export interface ExecutionResult {
  output: string;
  error: string;
  exitCode: number;
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

export const NEW_TAB_PREFIX = '__new_';

export function isNewCommandTabId(tabId: string): boolean {
  return tabId.startsWith(NEW_TAB_PREFIX);
}

export function createNewTabId(): string {
  return `${NEW_TAB_PREFIX}${crypto.randomUUID()}`;
}

export interface SettingsPayload {
  locale?: string;
  terminal?: string;
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
}

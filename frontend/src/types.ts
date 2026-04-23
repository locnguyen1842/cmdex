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

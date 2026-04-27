import type { Command } from '../types';

export const NEW_TAB_PREFIX = '__new_';

export function isNewCommandTabId(tabId: string): boolean {
  return tabId.startsWith(NEW_TAB_PREFIX);
}

export function createNewTabId(): string {
  return `${NEW_TAB_PREFIX}${crypto.randomUUID()}`;
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

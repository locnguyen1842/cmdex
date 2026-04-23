import type { Command, TabDraft } from '../types';
import { mergeDetectedVariables, normalizeVariablesForCompare } from './templateVars';

export function emptyDraft(defaultCategoryId?: string): TabDraft {
  return {
    title: '',
    description: '',
    tags: [],
    categoryId: defaultCategoryId ?? '',
    scriptBody: '',
    variables: [],
    workingDir: {},
    revealed: { title: false, description: false, tags: false },
  };
}

export function draftFromCommand(cmd: Command, scriptBody: string): TabDraft {
  const variables = mergeDetectedVariables(scriptBody, cmd.variables);
  return {
    title: cmd.title?.Valid ? cmd.title.String : '',
    description: cmd.description?.Valid ? cmd.description.String : '',
    tags: [...cmd.tags],
    categoryId: cmd.categoryId,
    scriptBody,
    variables,
    workingDir: cmd.workingDir || {},
    revealed: {
      title: !!(cmd.title?.Valid && cmd.title.String.trim()),
      description: !!(cmd.description?.Valid && cmd.description.String.trim()),
      tags: (cmd.tags?.length ?? 0) > 0,
    },
  };
}

export function draftsEqual(a: TabDraft, b: TabDraft): boolean {
  if (
    a.title !== b.title ||
    a.description !== b.description ||
    a.categoryId !== b.categoryId ||
    a.scriptBody !== b.scriptBody
  ) {
    return false;
  }
  if (JSON.stringify(a.tags) !== JSON.stringify(b.tags)) return false;
  if (JSON.stringify(a.revealed) !== JSON.stringify(b.revealed)) return false;
  if (JSON.stringify(a.workingDir) !== JSON.stringify(b.workingDir)) return false;
  if (
    JSON.stringify(normalizeVariablesForCompare(a.variables)) !==
    JSON.stringify(normalizeVariablesForCompare(b.variables))
  ) {
    return false;
  }
  return true;
}

export function cloneDraft(d: TabDraft): TabDraft {
  return JSON.parse(JSON.stringify(d)) as TabDraft;
}

export function makePlaceholderCommand(id: string, categoryId?: string): Command {
  return {
    id,
    title: { String: '', Valid: false },
    description: { String: '', Valid: false },
    scriptContent: '',
    tags: [],
    variables: [],
    presets: [],
    workingDir: {},
    categoryId: categoryId ?? '',
    position: 0,
    createdAt: '',
    updatedAt: '',
  };
}

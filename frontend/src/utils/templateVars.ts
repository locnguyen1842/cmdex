import type { VariableDefinition, VariablePrompt } from '../types';

const TEMPLATE_VAR_RE = /\{\{(\w+)\}\}/g;

export function extractTemplateVarNames(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  let m: RegExpExecArray | null;
  TEMPLATE_VAR_RE.lastIndex = 0;
  while ((m = TEMPLATE_VAR_RE.exec(text)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      result.push(m[1]);
    }
  }
  return result;
}

/** Merge auto-detected names with existing definitions, preserving manually added ones. */
export function mergeDetectedVariables(
  scriptBody: string,
  existing: VariableDefinition[],
): VariableDefinition[] {
  const detected = extractTemplateVarNames(scriptBody);
  const existingMap = new Map(existing.map((v) => [v.name, v]));
  const usedNames = new Set<string>();
  const result: VariableDefinition[] = detected.map((name, i) => {
    usedNames.add(name);
    const prev = existingMap.get(name);
    return (
      prev ?? {
        name,
        description: '',
        example: '',
        default: '',
        sortOrder: i,
      }
    );
  });
  for (const v of existing) {
    if (!usedNames.has(v.name)) {
      result.push({ ...v, sortOrder: result.length });
    }
  }
  return result;
}

export function normalizeVariablesForCompare(vars: VariableDefinition[]) {
  return vars.map((v) => ({
    name: v.name,
    description: v.description,
    default: v.default,
    example: v.example,
  }));
}

export function variableDefinitionsToPrompts(vars: VariableDefinition[]): VariablePrompt[] {
  return vars.map((v) => ({
    name: v.name,
    placeholder: v.name,
    description: v.description,
    example: v.example,
    defaultExpr: v.default,
    defaultValue: v.default ?? '',
  }));
}

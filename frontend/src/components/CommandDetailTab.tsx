import React, { useCallback } from 'react';
import CommandDetail from './CommandDetail';
import FloatingSaveBar from './FloatingSaveBar';
import type { Command, TabDraft, VariablePrompt, OSPathMap, OSKey } from '../types';

interface CommandDetailTabProps {
  tabId: string;
  command: Command;
  draft: TabDraft;
  baseline: TabDraft | undefined;
  isTabNew: boolean;
  isTabActive: boolean;
  isTabDirty: boolean;
  isExecuting: boolean;
  variables: VariablePrompt[];
  currentOS: OSKey;
  defaultWorkingDir: OSPathMap;
  onDraftChange: (partial: Partial<TabDraft>) => void;
  onExecute: (tabId: string, values: Record<string, string>) => void;
  onRunInTerminal: (tabId: string, values: Record<string, string>) => void;
  onFillVariables: (tabId: string, initialValues: Record<string, string>) => void;
  onRenamePreset: (tabId: string, presetId: string, newName: string) => Promise<void>;
  onDeletePreset: (tabId: string, presetId: string) => Promise<void>;
  onAddPreset: (tabId: string, initialValues?: Record<string, string>) => Promise<string>;
  onSavePresetValues: (tabId: string, presetId: string, values: Record<string, string>) => Promise<void>;
  onReorderPresets: (tabId: string, presetIds: string[]) => Promise<void>;
  onSaveScript: (tabId: string, scriptBody: string) => Promise<void>;
  onResolvedValuesChange?: (values: Record<string, string>) => void;
  onSave: () => void;
  onDiscard: () => void;
}

const CommandDetailTab = React.memo<CommandDetailTabProps>(function CommandDetailTab({
  tabId,
  command,
  draft,
  baseline,
  isTabNew,
  isTabActive,
  isTabDirty,
  isExecuting,
  variables,
  currentOS,
  defaultWorkingDir,
  onDraftChange,
  onExecute,
  onRunInTerminal,
  onFillVariables,
  onRenamePreset,
  onDeletePreset,
  onAddPreset,
  onSavePresetValues,
  onReorderPresets,
  onSaveScript,
  onResolvedValuesChange,
  onSave,
  onDiscard,
}) {
  const boundExecute = useCallback(
    (values: Record<string, string>) => onExecute(tabId, values),
    [tabId, onExecute],
  );
  const boundRunInTerminal = useCallback(
    (values: Record<string, string>) => onRunInTerminal(tabId, values),
    [tabId, onRunInTerminal],
  );
  const boundFillVariables = useCallback(
    (initialValues: Record<string, string>) => onFillVariables(tabId, initialValues),
    [tabId, onFillVariables],
  );
  const boundRenamePreset = useCallback(
    (presetId: string, newName: string) => onRenamePreset(tabId, presetId, newName),
    [tabId, onRenamePreset],
  );
  const boundDeletePreset = useCallback(
    (presetId: string) => onDeletePreset(tabId, presetId),
    [tabId, onDeletePreset],
  );
  const boundAddPreset = useCallback(
    (initialValues?: Record<string, string>) => onAddPreset(tabId, initialValues),
    [tabId, onAddPreset],
  );
  const boundSavePresetValues = useCallback(
    (presetId: string, values: Record<string, string>) => onSavePresetValues(tabId, presetId, values),
    [tabId, onSavePresetValues],
  );
  const boundReorderPresets = useCallback(
    (presetIds: string[]) => onReorderPresets(tabId, presetIds),
    [tabId, onReorderPresets],
  );
  const boundSaveScript = useCallback(
    (scriptBody: string) => onSaveScript(tabId, scriptBody),
    [tabId, onSaveScript],
  );
  const boundDraftChange = useCallback(
    (partial: Partial<TabDraft>) => onDraftChange({ ...partial }),
    [onDraftChange],
  );

  return (
    <div
      className="main-body command-tab-shell"
      style={{ display: isTabActive ? 'flex' : 'none' }}
    >
      <CommandDetail
        command={command}
        draft={draft}
        baselineScriptBody={baseline?.scriptBody || ''}
        onDraftChange={boundDraftChange}
        isNewCommand={isTabNew}
        isExecuting={isExecuting}
        variables={variables}
        onExecute={boundExecute}
        onRunInTerminal={boundRunInTerminal}
        onFillVariables={boundFillVariables}
        onRenamePreset={boundRenamePreset}
        onDeletePreset={boundDeletePreset}
        onAddPreset={boundAddPreset}
        onSavePresetValues={boundSavePresetValues}
        onReorderPresets={boundReorderPresets}
        onResolvedValuesChange={onResolvedValuesChange}
        onSaveScript={boundSaveScript}
        currentOS={currentOS}
        defaultWorkingDir={defaultWorkingDir}
      />
      <FloatingSaveBar
        visible={isTabDirty}
        saveDisabled={!draft || !draft.scriptBody.trim()}
        onSave={onSave}
        onDiscard={onDiscard}
      />
    </div>
  );
});

export default CommandDetailTab;

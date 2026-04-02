import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { useTranslation } from "react-i18next";
import { Command, VariablePrompt } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Pencil,
  Copy,
  Check,
  ListTree,
  Play,
  Loader2,
  SquareTerminal,
} from "lucide-react";
import { GetScriptBody } from "../../wailsjs/go/main/App";
import { isMac } from "../hooks/useKeyboardShortcuts";

const cmdKey = isMac ? '⌘' : 'Ctrl';

function ShortcutHint({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <span className="tooltip-with-shortcut">
      {label} <kbd className="kbd">{shortcut}</kbd>
    </span>
  );
}

interface CommandDetailProps {
  command: Command;
  isExecuting: boolean;
  variables: VariablePrompt[];
  onExecute: (values: Record<string, string>) => void;
  onRunInTerminal: (values: Record<string, string>) => void;
  onManagePresets: () => void;
  onFillVariables: (initialValues: Record<string, string>) => void;
  onEdit: () => void;
  onDelete: () => void;
  onRename: (newTitle: string) => void;
}

const CommandDetail: React.FC<CommandDetailProps> = ({
  command,
  isExecuting,
  variables,
  onExecute,
  onRunInTerminal,
  onManagePresets,
  onFillVariables,
  onEdit,
  onDelete,
  onRename,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [editingVar, setEditingVar] = useState<string | null>(null);
  const [editingVarValue, setEditingVarValue] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [titleDraft, setTitleDraft] = useState("");
  const [scriptBody, setScriptBody] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  useEffect(() => {
    GetScriptBody(command.id)
      .then((body) => setScriptBody(body))
      .catch(() => setScriptBody(""));
  }, [command.id, command.scriptContent]);

  useEffect(() => {
    setOverrides({});
  }, [command.id, selectedPresetId]);

  const handleTitleDoubleClick = () => {
    setTitleDraft(command.title);
    setEditingTitle(true);
  };

  const commitTitleEdit = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== command.title) {
      onRename(trimmed);
    }
    setEditingTitle(false);
  };

  const resolvedValues = useMemo(() => {
    const vals: Record<string, string> = {};
    if (selectedPresetId) {
      const preset = command.presets.find((p) => p.id === selectedPresetId);
      if (preset) {
        variables.forEach((v) => {
          vals[v.name] = preset.values[v.name] ?? v.defaultValue ?? "";
        });
        return { ...vals, ...overrides };
      }
    }
    variables.forEach((v) => {
      vals[v.name] = v.defaultValue ?? "";
    });
    return { ...vals, ...overrides };
  }, [selectedPresetId, command.presets, variables, overrides]);

  const renderScriptWithVars = useMemo(() => {
    if (!scriptBody) return null;
    const parts = scriptBody.split(/(\{\{\w+\}\})/g);
    return parts.map((part, i) => {
      if (/^\{\{\w+\}\}$/.test(part)) {
        const varName = part.slice(2, -2);
        const val = resolvedValues[varName];
        return (
          <span key={i} className={val ? "var-filled" : "var-missing"} title={val || varName}>
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }, [scriptBody, resolvedValues]);

  const renderScriptResolved = useMemo(() => {
    if (!scriptBody) return null;
    const parts = scriptBody.split(/(\{\{\w+\}\})/g);
    return parts.map((part, i) => {
      if (/^\{\{\w+\}\}$/.test(part)) {
        const varName = part.slice(2, -2);
        const val = resolvedValues[varName];
        if (val) {
          return (
            <span key={i} className="var-filled" title={`${varName}=${val}`}>
              {val}
            </span>
          );
        }
        return (
          <span key={i} className="var-missing" title={varName}>
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }, [scriptBody, resolvedValues]);

  const getResolvedScript = useMemo(() => {
    if (!scriptBody) return "";
    return scriptBody.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return resolvedValues[varName] || match;
    });
  }, [scriptBody, resolvedValues]);

  const handleCopy = useCallback(() => {
    const textToCopy = getResolvedScript || scriptBody;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch((err) => {
      console.error("Failed to copy to clipboard:", err);
      setCopied(false);
    });
  }, [getResolvedScript, scriptBody]);


  return (
    <div className="command-detail">
      <div className="detail-header">
        {editingTitle ? (
          <Input
            ref={titleInputRef}
            className="detail-title-input text-2xl font-bold h-auto py-1"
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitleEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitleEdit();
              if (e.key === "Escape") setEditingTitle(false);
            }}
          />
        ) : (
          <h1
            className="detail-title"
            onDoubleClick={handleTitleDoubleClick}
            title={t("commandDetail.doubleClickToRename")}
          >
            {command.title}
          </h1>
        )}
        {command.tags && command.tags.length > 0 && (
          <div className="detail-tags">
            {command.tags.map((tag, i) => (
              <Badge key={i} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {command.description && (
          <p className="detail-description">{command.description}</p>
        )}
      </div>

      <div className="detail-section">
        <div className="detail-section-title">
          {t("commandDetail.command")}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" onClick={onEdit}>
                <Pencil />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <ShortcutHint label={t("commandDetail.editCommand")} shortcut={`${cmdKey}E`} />
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="command-text-box">
          <code className="whitespace-pre-wrap">{renderScriptWithVars}</code>
          <div className="preview-actions">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onRunInTerminal(resolvedValues)}
                >
                  <SquareTerminal className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("commandDetail.runInTerminal")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="size-3.5 text-success" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {copied
                  ? t("commandDetail.copied")
                  : t("commandDetail.copyCommand")}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {variables.length === 0 && (
        <div className="command-actions mt-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="success"
                size="sm"
                onClick={() => onExecute({})}
                disabled={isExecuting}
              >
                {isExecuting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isExecuting
                ? t("commandDetail.running")
                : <ShortcutHint label={t("commandDetail.execute")} shortcut={`${cmdKey}↩`} />}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {variables.length > 0 && (
        <div className="detail-section mt-4">
          <div className="detail-section-title">
            {t("commandDetail.arguments")}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-xs" onClick={onManagePresets}>
                  <ListTree />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("commandDetail.managePresets")}</TooltipContent>
            </Tooltip>
          </div>

          {/* Preset chip row */}
          {command.presets && command.presets.length > 0 && (
            <div className="preset-chips">
              <button
                className={`preset-chip${selectedPresetId === '' ? ' active' : ''}`}
                onClick={() => setSelectedPresetId('')}
              >
                {t("commandDetail.noPreset")}
              </button>
              {command.presets.map((p) => (
                <button
                  key={p.id}
                  className={`preset-chip${selectedPresetId === p.id ? ' active' : ''}`}
                  onClick={() => setSelectedPresetId(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {/* Script preview with resolved values */}
          <div className="command-text-box text-xs mb-3">
            <code className="text-xs whitespace-pre-wrap break-all">
              {renderScriptResolved}
            </code>
          </div>

          {/* Pattern=Value rows */}
          <div className="preset-vars-list">
            {variables.map((v) => {
              const val = resolvedValues[v.name];
              const isEditing = editingVar === v.name;
              return (
                <div key={v.name} className="preset-var-row">
                  <span className="preset-var-name">
                    {val ? (
                      <span className="var-filled" title={v.name}>{"{{" + v.name + "}}"}</span>
                    ) : (
                      <span className="var-missing" title={v.name}>{"{{" + v.name + "}}"}</span>
                    )}
                  </span>
                  <span className="preset-var-equals">=</span>
                  {isEditing ? (
                    <input
                      className="preset-var-input"
                      autoFocus
                      value={editingVarValue}
                      onChange={(e) => setEditingVarValue(e.target.value)}
                      onBlur={() => {
                        if (editingVar) {
                          setOverrides(prev => ({ ...prev, [editingVar]: editingVarValue }));
                        }
                        setEditingVar(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (editingVar) {
                            setOverrides(prev => ({ ...prev, [editingVar]: editingVarValue }));
                          }
                          setEditingVar(null);
                        }
                        if (e.key === 'Escape') setEditingVar(null);
                      }}
                    />
                  ) : (
                    <span
                      className={`preset-var-value${val ? '' : ' empty'}`}
                      onClick={() => {
                        setEditingVar(v.name);
                        setEditingVarValue(val || '');
                      }}
                      title="Click to edit"
                    >
                      {val || <span className="preset-var-placeholder">click to set…</span>}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Actions row */}
          <div className="command-actions mt-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => {
                    const hasEmpty = variables.some((v) => !resolvedValues[v.name]);
                    if (hasEmpty) {
                      onFillVariables(resolvedValues);
                    } else {
                      onExecute(resolvedValues);
                    }
                  }}
                  disabled={isExecuting}
                >
                  {isExecuting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isExecuting
                  ? t("commandDetail.running")
                  : <ShortcutHint label={t("commandDetail.execute")} shortcut={`${cmdKey}↩`} />}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => onRunInTerminal(resolvedValues)}>
                  <SquareTerminal className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("commandDetail.runInTerminal")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {copied ? t("commandDetail.copied") : t("commandDetail.copyCommand")}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommandDetail;

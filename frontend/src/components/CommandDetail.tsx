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
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command as CmdPrimitive,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Pencil,
  Copy,
  Check,
  ListTree,
  Play,
  Loader2,
  ChevronDown,
  SquareTerminal,
} from "lucide-react";
import { GetScriptBody } from "../../wailsjs/go/main/App";

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
  const [presetOpen, setPresetOpen] = useState(false);
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
        return vals;
      }
    }
    variables.forEach((v) => {
      vals[v.name] = v.defaultValue ?? "";
    });
    return vals;
  }, [selectedPresetId, command.presets, variables]);

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
    });
  }, [getResolvedScript, scriptBody]);

  const argsPreview = useMemo(() => {
    if (variables.length === 0) return null;
    return variables.map((v) => {
      const val = resolvedValues[v.name];
      return { name: v.name, value: val || "" };
    });
  }, [variables, resolvedValues]);

  const selectedPresetLabel = selectedPresetId
    ? (command.presets.find((p) => p.id === selectedPresetId)?.name ??
      t("commandDetail.noPreset"))
    : t("commandDetail.noPreset");

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
        {command.description && (
          <p className="detail-description">{command.description}</p>
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
            <TooltipContent>{t("commandDetail.editCommand")}</TooltipContent>
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
                : t("commandDetail.execute")}
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
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onManagePresets}
                >
                  <ListTree />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t("commandDetail.managePresets")}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="preview-box-wrapper">
            <div className="preview-floating-actions">
              <Popover open={presetOpen} onOpenChange={setPresetOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-r-none border-r-0 min-w-[120px] justify-between font-normal"
                      >
                        <span
                          className={
                            selectedPresetId ? "" : "italic opacity-60"
                          }
                        >
                          {selectedPresetLabel}
                        </span>
                        <ChevronDown className="size-3.5 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{t("commandDetail.presets")}</TooltipContent>
                </Tooltip>
                <PopoverContent className="w-[200px] p-0" align="start">
                  <CmdPrimitive>
                    <CommandInput
                      placeholder={t("commandDetail.searchPresets")}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {t("commandDetail.noPresetsFound")}
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setSelectedPresetId("");
                            setPresetOpen(false);
                          }}
                        >
                          <Check
                            className={`size-3.5 ${selectedPresetId === "" ? "opacity-100" : "opacity-0"}`}
                          />
                          <span className="italic opacity-60">
                            {t("commandDetail.noPreset")}
                          </span>
                        </CommandItem>
                        {(command.presets || []).map((p) => (
                          <CommandItem
                            key={p.id}
                            onSelect={() => {
                              setSelectedPresetId(p.id);
                              setPresetOpen(false);
                            }}
                          >
                            <Check
                              className={`size-3.5 ${selectedPresetId === p.id ? "opacity-100" : "opacity-0"}`}
                            />
                            {p.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </CmdPrimitive>
                </PopoverContent>
              </Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="success"
                    size="sm"
                    className="rounded-l-none px-3"
                    onClick={() => {
                      const hasEmpty = variables.some(
                        (v) => !resolvedValues[v.name],
                      );
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
                    : t("commandDetail.execute")}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="command-text-box text-xs preview-box-with-float">
              <div className="mb-2 pb-2 border-b border-border/50">
                <code className="text-xs whitespace-pre-wrap break-all">
                  {getResolvedScript}
                </code>
              </div>
              {argsPreview && argsPreview.map((arg, i) => (
                <span key={arg.name}>
                  <span className="text-muted-foreground">{arg.name}=</span>
                  {arg.value ? (
                    <span className="var-filled">{arg.value}</span>
                  ) : (
                    <span className="var-missing">{"<empty>"}</span>
                  )}
                  {i < argsPreview.length - 1 && " "}
                </span>
              ))}
              <div className="preview-actions">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onRunInTerminal(resolvedValues)}
                    >
                      <SquareTerminal className="size-3" />
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
                        <Check className="size-3 text-success" />
                      ) : (
                        <Copy className="size-3" />
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
        </div>
      )}
    </div>
  );
};

export default CommandDetail;

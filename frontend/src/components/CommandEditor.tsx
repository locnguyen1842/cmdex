import React, { useState, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Category, Command, VariableDefinition } from "../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { X, Plus, GripVertical } from "lucide-react";
import { GetScriptBody, GetScriptContent } from "../../wailsjs/go/main/App";

interface CommandEditorProps {
  command?: Command;
  categories: Category[];
  defaultCategoryId?: string;
  onSave: (data: {
    title: string;
    description: string;
    scriptBody: string;
    categoryId: string;
    tags: string[];
    variables: VariableDefinition[];
    isAdvanced: boolean;
  }) => void;
  onCancel: () => void;
}

const CommandEditor: React.FC<CommandEditorProps> = ({
  command,
  categories,
  defaultCategoryId,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState(command?.title || "");
  const [description, setDescription] = useState(command?.description || "");
  const [scriptBody, setScriptBody] = useState("");
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [loaded, setLoaded] = useState(!command);
  const UNCATEGORIZED = "__uncategorized__";
  const [categoryId, setCategoryId] = useState(
    command?.categoryId || defaultCategoryId || UNCATEGORIZED,
  );
  const [tags, setTags] = useState<string[]>(command?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [variables, setVariables] = useState<VariableDefinition[]>(
    command?.variables || [],
  );

  // Load script body from backend when editing
  React.useEffect(() => {
    if (command) {
      GetScriptBody(command.id)
        .then((body) => {
          setScriptBody(body);
          setLoaded(true);
        })
        .catch(() => {
          setScriptBody("");
          setLoaded(true);
        });
    }
  }, [command]);

  const handleToggleAdvanced = async () => {
    if (!isAdvanced && command) {
      // Switching to advanced: load full script content
      try {
        const content = await GetScriptContent(command.id);
        setScriptBody(content);
      } catch {
        // keep current body
      }
    } else if (isAdvanced && command) {
      // Switching back to simple: load just body
      try {
        const body = await GetScriptBody(command.id);
        setScriptBody(body);
      } catch {
        // keep current
      }
    }
    setIsAdvanced(!isAdvanced);
  };

  const addVariable = () => {
    const baseName = "var";
    let idx = variables.length + 1;
    let name = `${baseName}${idx}`;
    const existingNames = new Set(variables.map((v) => v.name));
    while (existingNames.has(name)) {
      idx++;
      name = `${baseName}${idx}`;
    }
    setVariables([
      ...variables,
      { name, description: "", example: "", default: "", sortOrder: variables.length },
    ]);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const updateVariable = (
    index: number,
    field: keyof VariableDefinition,
    value: string,
  ) => {
    setVariables(
      variables.map((v, i) =>
        i === index ? { ...v, [field]: value } : v,
      ),
    );
  };

  const handleSave = () => {
    if (!title.trim() || !scriptBody.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim(),
      scriptBody: scriptBody.trim(),
      categoryId: categoryId === UNCATEGORIZED ? "" : categoryId,
      tags,
      variables,
      isAdvanced,
    });
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(",", "");
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput("");
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const hasVars = variables.length > 0;

  if (!loaded) return null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent
        className={`sm:max-w-xl md:max-w-2xl ${hasVars ? "lg:max-w-4xl" : ""} p-0`}
      >
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>
            {command
              ? t("commandEditor.editCommand")
              : t("commandEditor.newCommand")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {command
              ? t("commandEditor.editCommandDesc")
              : t("commandEditor.createCommandDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className={`flex ${hasVars ? "divide-x divide-border" : ""}`}>
          <div className="flex-1 px-6 py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cmd-title">{t("commandEditor.title")}</Label>
              <Input
                id="cmd-title"
                placeholder={t("commandEditor.titlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cmd-desc">{t("commandEditor.description")}</Label>
              <Textarea
                id="cmd-desc"
                placeholder={t("commandEditor.descriptionPlaceholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="cmd-text">
                  {isAdvanced
                    ? t("commandEditor.script")
                    : t("commandEditor.command")}
                </Label>
                {command && (
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="advanced-mode"
                      className="text-xs text-muted-foreground cursor-pointer"
                    >
                      {t("commandEditor.advancedMode")}
                    </Label>
                    <Switch
                      id="advanced-mode"
                      checked={isAdvanced}
                      onCheckedChange={handleToggleAdvanced}
                    />
                  </div>
                )}
              </div>
              <Textarea
                id="cmd-text"
                className="font-mono"
                placeholder={
                  isAdvanced
                    ? t("commandEditor.scriptPlaceholder")
                    : t("commandEditor.commandPlaceholder")
                }
                value={scriptBody}
                onChange={(e) => setScriptBody(e.target.value)}
                rows={isAdvanced ? 10 : 3}
              />
              {!isAdvanced && (
                <p className="text-xs text-muted-foreground">
                  {t("commandEditor.commandHintNew")}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t("commandEditor.category")}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("commandEditor.uncategorized")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNCATEGORIZED}>
                    {t("commandEditor.uncategorized")}
                  </SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("commandEditor.tags")}</Label>
              <div className="tags-input-wrapper">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X
                      className="size-3 cursor-pointer"
                      onClick={() => removeTag(tag)}
                    />
                  </Badge>
                ))}
                <input
                  type="text"
                  className="tags-input-field"
                  placeholder={
                    tags.length === 0 ? t("commandEditor.tagsPlaceholder") : ""
                  }
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                />
              </div>
            </div>
          </div>

          <div className={`w-72 px-4 py-4 ${hasVars ? "" : "hidden"}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("commandEditor.variables")}
              </h3>
              <Button variant="ghost" size="icon-xs" onClick={addVariable}>
                <Plus className="size-3.5" />
              </Button>
            </div>
            <ScrollArea className="h-[360px]">
              <div className="space-y-4 pr-3">
                {variables.map((v, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <GripVertical className="size-3 text-muted-foreground shrink-0" />
                      <Input
                        className="h-7 text-sm font-medium font-mono flex-1"
                        value={v.name}
                        onChange={(e) =>
                          updateVariable(index, "name", e.target.value.replace(/\s/g, "_"))
                        }
                        placeholder="varName"
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeVariable(index)}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                    <div className="space-y-1.5 pl-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t("commandEditor.varDescription")}
                        </Label>
                        <Input
                          className="h-7 text-xs"
                          value={v.description}
                          onChange={(e) =>
                            updateVariable(index, "description", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t("commandEditor.varExample")}
                        </Label>
                        <Input
                          className="h-7 text-xs"
                          value={v.example}
                          onChange={(e) =>
                            updateVariable(index, "example", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t("commandEditor.varDefault")}
                        </Label>
                        <Input
                          className="h-7 text-xs font-mono"
                          value={v.default}
                          onChange={(e) =>
                            updateVariable(index, "default", e.target.value)
                          }
                        />
                      </div>
                    </div>
                    <Separator className="mt-2" />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter className="px-6 pb-6">
          {!hasVars && (
            <Button variant="outline" onClick={addVariable} className="mr-auto">
              <Plus className="size-4" /> {t("commandEditor.addVariable")}
            </Button>
          )}
          <Button variant="ghost" onClick={onCancel}>
            {t("commandEditor.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || !scriptBody.trim()}
          >
            {command
              ? t("commandEditor.saveChanges")
              : t("commandEditor.createCommand")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CommandEditor;

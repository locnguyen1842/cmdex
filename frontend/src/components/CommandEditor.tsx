import React, { useState, useMemo, KeyboardEvent } from "react";
import { useTranslation, Trans } from "react-i18next";
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
import { X } from "lucide-react";

interface CommandEditorProps {
  command?: Command;
  categories: Category[];
  defaultCategoryId?: string;
  onSave: (data: {
    title: string;
    description: string;
    commandText: string;
    categoryId: string;
    tags: string[];
    variables: VariableDefinition[];
  }) => void;
  onCancel: () => void;
}

const PLACEHOLDER_RE = /\$\{(\w+)\}/g;

function parseVarNames(text: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = PLACEHOLDER_RE.exec(text)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      names.push(m[1]);
    }
  }
  return names;
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
  const [commandText, setCommandText] = useState(command?.commandText || "");
  const UNCATEGORIZED = "__uncategorized__";
  const [categoryId, setCategoryId] = useState(
    command?.categoryId || defaultCategoryId || UNCATEGORIZED,
  );
  const [tags, setTags] = useState<string[]>(command?.tags || []);
  const [tagInput, setTagInput] = useState("");

  const initVarDefs = (): Record<string, VariableDefinition> => {
    const map: Record<string, VariableDefinition> = {};
    (command?.variables || []).forEach((v) => {
      map[v.name] = v;
    });
    return map;
  };
  const [varDefs, setVarDefs] =
    useState<Record<string, VariableDefinition>>(initVarDefs);

  const detectedVars = useMemo(() => parseVarNames(commandText), [commandText]);
  const hasVars = detectedVars.length > 0;

  const updateVarDef = (
    name: string,
    field: keyof Omit<VariableDefinition, "name">,
    value: string,
  ) => {
    setVarDefs((prev) => ({
      ...prev,
      [name]: {
        ...prev[name],
        name,
        description: prev[name]?.description || "",
        example: prev[name]?.example || "",
        default: prev[name]?.default || "",
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    if (!title.trim() || !commandText.trim()) return;
    const variables: VariableDefinition[] = detectedVars.map((name) => ({
      name,
      description: varDefs[name]?.description || "",
      example: varDefs[name]?.example || "",
      default: varDefs[name]?.default || "",
    }));
    onSave({
      title: title.trim(),
      description: description.trim(),
      commandText: commandText.trim(),
      categoryId: categoryId === UNCATEGORIZED ? "" : categoryId,
      tags,
      variables,
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
              <Label htmlFor="cmd-text">{t("commandEditor.command")}</Label>
              <Textarea
                id="cmd-text"
                className="font-mono"
                placeholder={t("commandEditor.commandPlaceholder")}
                value={commandText}
                onChange={(e) => setCommandText(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                <Trans
                  shouldUnescape={true}
                  i18nKey="commandEditor.commandHint"
                  values={{ placeholder: "${variableName}" }}
                  components={{
                    code: <code />,
                  }}
                >
                  Use{" "}
                  <code className="bg-muted px-1 rounded">
                    {"${variableName}"}
                  </code>{" "}
                  for variable placeholders.
                </Trans>
              </p>
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

          {hasVars && (
            <div className="w-72 px-4 py-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {t("commandEditor.variables")}
              </h3>
              <ScrollArea className="h-[360px]">
                <div className="space-y-4 pr-3">
                  {detectedVars.map((name) => (
                    <div key={name} className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        {name}
                      </p>
                      <div className="space-y-1.5">
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            {t("commandEditor.varDescription")}
                          </Label>
                          <Input
                            className="h-7 text-xs"
                            value={varDefs[name]?.description || ""}
                            onChange={(e) =>
                              updateVarDef(name, "description", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            {t("commandEditor.varExample")}
                          </Label>
                          <Input
                            className="h-7 text-xs"
                            value={varDefs[name]?.example || ""}
                            onChange={(e) =>
                              updateVarDef(name, "example", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            {t("commandEditor.varDefault")}
                          </Label>
                          <Input
                            className="h-7 text-xs font-mono"
                            value={varDefs[name]?.default || ""}
                            onChange={(e) =>
                              updateVarDef(name, "default", e.target.value)
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
          )}
        </div>
        <DialogFooter className="px-6 pb-6">
          <Button variant="ghost" onClick={onCancel}>
            {t("commandEditor.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || !commandText.trim()}
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

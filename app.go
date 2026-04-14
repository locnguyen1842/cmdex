package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// EventNames holds all Wails event name constants, exposed to frontend via GetEventNames().
type EventNames struct {
	CmdOutput             string `json:"cmdOutput"`
	OpenSettings          string `json:"openSettings"`
	SettingsChanged       string `json:"settingsChanged"`
	SettingsWindowClosing string `json:"settingsWindowClosing"`
}

var eventNames = EventNames{
	CmdOutput:             "cmd-output",
	OpenSettings:          "open-settings",
	SettingsChanged:       "settings-changed",
	SettingsWindowClosing: "settings-window-closing",
}

// GetEventNames returns all event name constants so the frontend can use
// them via Wails bindings instead of hardcoded strings.
func (a *App) GetEventNames() EventNames {
	return eventNames
}

type App struct {
	app      *application.App
	db       *DB
	executor *Executor
}

// ServiceStartup is called when the app starts
func (a *App) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	a.app = application.Get()
	db, err := NewDB()
	if err != nil {
		return fmt.Errorf("failed to initialize database: %w", err)
	}
	a.db = db
	a.executor = NewExecutor()
	return nil
}

// ServiceShutdown is called when the app is closing
func (a *App) ServiceShutdown() error {
	if a.db != nil {
		a.db.Close()
	}
	return nil
}

// ========== Category Operations ==========

func (a *App) GetCategories() []Category {
	cats, err := a.db.GetCategories()
	if err != nil {
		fmt.Println("Error getting categories:", err)
		return []Category{}
	}
	return cats
}

func (a *App) CreateCategory(name string, icon string, color string) (Category, error) {
	cat := Category{
		ID:        uuid.New().String(),
		Name:      name,
		Icon:      icon,
		Color:     color,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := a.db.CreateCategory(cat); err != nil {
		return Category{}, err
	}
	return cat, nil
}

func (a *App) UpdateCategory(id string, name string, icon string, color string) (Category, error) {
	cat := Category{
		ID:        id,
		Name:      name,
		Icon:      icon,
		Color:     color,
		UpdatedAt: time.Now(),
	}
	if err := a.db.UpdateCategory(cat); err != nil {
		return Category{}, err
	}
	cats, _ := a.db.GetCategories()
	for _, c := range cats {
		if c.ID == id {
			return c, nil
		}
	}
	return cat, nil
}

func (a *App) DeleteCategory(id string) error {
	return a.db.DeleteCategory(id)
}

// ========== Command Operations ==========

func (a *App) GetCommands() []Command {
	cmds, err := a.db.GetCommands()
	if err != nil {
		fmt.Println("Error getting commands:", err)
		return []Command{}
	}
	return cmds
}

func (a *App) GetCommandsByCategory(categoryID string) []Command {
	cmds, err := a.db.GetCommandsByCategory(categoryID)
	if err != nil {
		fmt.Println("Error getting commands:", err)
		return []Command{}
	}
	return cmds
}

func (a *App) CreateCommand(title, description, scriptBody, categoryID string, tags []string, variables []VariableDefinition) (Command, error) {
	if tags == nil {
		tags = []string{}
	}
	if variables == nil {
		variables = []VariableDefinition{}
	}

	for i := range variables {
		variables[i].SortOrder = i
	}

	scriptContent := GenerateScript(scriptBody)

	cmd := Command{
		ID:            uuid.New().String(),
		Title:         sql.NullString{String: title, Valid: title != ""},
		Description:   sql.NullString{String: description, Valid: description != ""},
		ScriptContent: scriptContent,
		CategoryID:    categoryID,
		Tags:          tags,
		Variables:     variables,
		Presets:       []VariablePreset{},
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := a.db.CreateCommand(cmd); err != nil {
		return Command{}, err
	}
	return cmd, nil
}

func (a *App) UpdateCommand(id, title, description, scriptBody, categoryID string, tags []string, variables []VariableDefinition) (Command, error) {
	if tags == nil {
		tags = []string{}
	}
	if variables == nil {
		variables = []VariableDefinition{}
	}

	for i := range variables {
		variables[i].SortOrder = i
	}

	scriptContent := GenerateScript(scriptBody)

	cmd := Command{
		ID:            id,
		Title:         sql.NullString{String: title, Valid: title != ""},
		Description:   sql.NullString{String: description, Valid: description != ""},
		ScriptContent: scriptContent,
		CategoryID:    categoryID,
		Tags:          tags,
		Variables:     variables,
		UpdatedAt:     time.Now(),
	}

	if err := a.db.UpdateCommand(cmd); err != nil {
		return Command{}, err
	}

	return a.db.GetCommand(id)
}

func (a *App) RenameCommand(id string, newTitle string) (Command, error) {
	if err := a.db.RenameCommand(id, newTitle); err != nil {
		return Command{}, err
	}
	return a.db.GetCommand(id)
}

func (a *App) DeleteCommand(id string) error {
	return a.db.DeleteCommand(id)
}

// ReorderCommand moves a command to a new position within a category (or to a
// different category). newCategoryId may be empty string for uncategorized.
// newPosition is the 0-based index within the target category.
func (a *App) ReorderCommand(id string, newPosition int, newCategoryId string) ([]Command, error) {
	if err := a.db.UpdateCommandPosition(id, newCategoryId, newPosition); err != nil {
		return nil, fmt.Errorf("reorder command: %w", err)
	}
	return a.db.GetCommands()
}

// GetScriptContent returns the full script content for the editor
func (a *App) GetScriptContent(commandID string) (string, error) {
	cmd, err := a.db.GetCommand(commandID)
	if err != nil {
		return "", err
	}
	return cmd.ScriptContent, nil
}

// GetScriptBody returns just the body (for simple mode editing)
func (a *App) GetScriptBody(commandID string) (string, error) {
	cmd, err := a.db.GetCommand(commandID)
	if err != nil {
		return "", err
	}
	return ParseScriptBody(cmd.ScriptContent), nil
}

// ========== Execution Operations ==========

func (a *App) GetVariables(commandID string) []VariablePrompt {
	cmd, err := a.db.GetCommand(commandID)
	if err != nil {
		return []VariablePrompt{}
	}

	if len(cmd.Variables) == 0 {
		return []VariablePrompt{}
	}

	evaluated := a.executor.EvalDefaults(cmd.Variables)

	var prompts []VariablePrompt
	for _, v := range cmd.Variables {
		p := VariablePrompt{
			Name:        v.Name,
			Description: v.Description,
			Example:     v.Example,
			DefaultExpr: v.Default,
		}
		if val, exists := evaluated[v.Name]; exists {
			p.DefaultValue = val
		}
		prompts = append(prompts, p)
	}
	if prompts == nil {
		prompts = []VariablePrompt{}
	}
	return prompts
}

func (a *App) RunCommand(commandID string, variables map[string]string) ExecutionRecord {
	cmd, err := a.db.GetCommand(commandID)
	if err != nil {
		return ExecutionRecord{
			ID:       uuid.New().String(),
			Error:    err.Error(),
			ExitCode: -1,
		}
	}

	resolvedScript := ReplaceTemplateVars(cmd.ScriptContent, variables)
	finalCmd := BuildDisplayCommand(cmd.ScriptContent, variables)

	result := a.executor.ExecuteScript(resolvedScript, func(chunk OutputChunk) {
		a.app.Event.Emit(eventNames.CmdOutput, chunk)
	})

	wd, _ := os.Getwd()
	record := ExecutionRecord{
		ID:            uuid.New().String(),
		CommandID:     commandID,
		ScriptContent: cmd.ScriptContent,
		FinalCmd:      finalCmd,
		Output:        result.Output,
		Error:         result.Error,
		ExitCode:      result.ExitCode,
		WorkingDir:    wd,
		ExecutedAt:    time.Now(),
	}

	_ = a.db.AddExecution(record)

	return record
}

func (a *App) RunInTerminal(commandID string, variables map[string]string) error {
	cmd, err := a.db.GetCommand(commandID)
	if err != nil {
		return err
	}

	resolvedScript := ReplaceTemplateVars(cmd.ScriptContent, variables)

	settings, _ := a.db.GetSettings()
	return a.executor.OpenInTerminal(settings.Terminal, resolvedScript)
}

// ========== Execution History ==========

func (a *App) GetExecutionHistory() []ExecutionRecord {
	records, err := a.db.GetExecutions()
	if err != nil {
		fmt.Println("Error getting executions:", err)
		return []ExecutionRecord{}
	}
	return records
}

func (a *App) ClearExecutionHistory() error {
	return a.db.ClearExecutions()
}

// ========== Variable Presets ==========

func (a *App) GetPresets(commandID string) []VariablePreset {
	presets, err := a.db.GetPresets(commandID)
	if err != nil {
		return []VariablePreset{}
	}
	return presets
}

func (a *App) SavePreset(commandID string, name string, values map[string]string) (VariablePreset, error) {
	preset := VariablePreset{
		ID:     uuid.New().String(),
		Name:   name,
		Values: values,
	}
	if err := a.db.SavePreset(commandID, preset); err != nil {
		return VariablePreset{}, err
	}
	return preset, nil
}

func (a *App) UpdatePreset(commandID string, presetID string, name string, values map[string]string) (VariablePreset, error) {
	preset := VariablePreset{
		ID:     presetID,
		Name:   name,
		Values: values,
	}
	if err := a.db.UpdatePreset(preset); err != nil {
		return VariablePreset{}, err
	}
	return preset, nil
}

func (a *App) DeletePreset(commandID string, presetID string) error {
	return a.db.DeletePreset(presetID)
}

func (a *App) ReorderPresets(commandID string, presetIDs []string) error {
	existing, err := a.db.GetPresets(commandID)
	if err != nil {
		return fmt.Errorf("get presets for validation: %w", err)
	}
	if len(presetIDs) != len(existing) {
		return fmt.Errorf("expected %d preset IDs, got %d", len(existing), len(presetIDs))
	}
	existingSet := make(map[string]bool, len(existing))
	for _, p := range existing {
		existingSet[p.ID] = true
	}
	seen := make(map[string]bool, len(presetIDs))
	for _, id := range presetIDs {
		if !existingSet[id] {
			return fmt.Errorf("preset %s does not belong to command %s", id, commandID)
		}
		if seen[id] {
			return fmt.Errorf("duplicate preset ID: %s", id)
		}
		seen[id] = true
	}
	return a.db.ReorderPresets(commandID, presetIDs)
}

// ========== Settings ==========

func (a *App) GetSettings() AppSettings {
	settings, err := a.db.GetSettings()
	if err != nil {
		return AppSettings{Locale: "en"}
	}
	return settings
}

func (a *App) GetAvailableTerminals() []TerminalInfo {
	return a.executor.GetAvailableTerminals()
}

func (a *App) SetSettings(jsonStr string) error {
	var s AppSettings
	if err := json.Unmarshal([]byte(jsonStr), &s); err != nil {
		return fmt.Errorf("invalid settings JSON: %w", err)
	}
	return a.db.SetSettings(s)
}

func (a *App) ShowSettingsWindow() {
	ShowSettingsWindow()
}

// ========== Search ==========

func (a *App) ResetAllData() error {
	return a.db.ResetAll()
}

func (a *App) SearchCommands(query string) []Command {
	if query == "" {
		return a.GetCommands()
	}

	cmds, err := a.db.SearchCommands(query)
	if err != nil {
		fmt.Println("Error searching commands:", err)
		return []Command{}
	}
	return cmds
}

// ========== Theme ==========

func (a *App) SaveThemeTemplate() error {
	path, err := a.app.Dialog.SaveFile().
		SetFilename("cmdex-theme-template.json").
		AddFilter("JSON Files (*.json)", "*.json").
		PromptForSingleSelection()
	if err != nil || path == "" {
		return err
	}
	template := `{
  "name": "My Theme",
  "type": "dark",
  "colors": {
    "background": "#1e1e1e",
    "foreground": "#d4d4d4",
    "card": "#252526",
    "primary": "#007acc",
    "accent": "#2a2d2e",
    "border": "rgba(255,255,255,0.1)",
    "muted": "#3c3c3c",
    "muted-foreground": "#858585",
    "ring": "#007acc",
    "destructive": "#f44747",
    "success": "#4ec9b0",
    "tab-bar-bg": "#2d2d2d",
    "tab-active-bg": "#1e1e1e",
    "tab-active-indicator": "#007acc",
    "status-bar-bg": "#007acc"
  }
}`
	return os.WriteFile(path, []byte(template), 0644)
}

// ========== Import/Export ==========

// ExportCommandIDs exports selected commands to a JSON file
func (a *App) ExportCommands(commandIDs []string) error {
	path, err := a.app.Dialog.SaveFile().
		SetFilename("cmdex-commands.json").
		AddFilter("JSON Files (*.json)", "*.json").
		PromptForSingleSelection()
	if err != nil || path == "" {
		// User cancelled
		return nil
	}

	cmds, err := a.db.GetCommandsByIDs(commandIDs)
	if err != nil {
		return fmt.Errorf("get commands: %w", err)
	}

	// Build export structure
	type ExportPreset struct {
		Name   string            `json:"name"`
		Values map[string]string `json:"values"`
	}

	type ExportCommand struct {
		Title         string               `json:"title"`
		Description   string               `json:"description"`
		ScriptContent string               `json:"scriptContent"`
		Tags          []string             `json:"tags"`
		Variables     []VariableDefinition `json:"variables"`
		Presets       []ExportPreset       `json:"presets"`
		CategoryName  string               `json:"categoryName"`
	}

	exportData := struct {
		Version    string          `json:"version"`
		ExportedAt time.Time       `json:"exportedAt"`
		Commands   []ExportCommand `json:"commands"`
	}{
		Version:    "1.0",
		ExportedAt: time.Now(),
		Commands:   make([]ExportCommand, 0, len(cmds)),
	}

	for _, cmd := range cmds {
		// Get category name
		categoryName := ""
		if cmd.CategoryID != "" {
			cats, _ := a.db.GetCategories()
			for _, c := range cats {
				if c.ID == cmd.CategoryID {
					categoryName = c.Name
					break
				}
			}
		}

		presets := make([]ExportPreset, 0, len(cmd.Presets))
		for _, p := range cmd.Presets {
			presets = append(presets, ExportPreset{
				Name:   p.Name,
				Values: p.Values,
			})
		}

		var title, description string
		if cmd.Title.Valid {
			title = cmd.Title.String
		}
		if cmd.Description.Valid {
			description = cmd.Description.String
		}

		exportData.Commands = append(exportData.Commands, ExportCommand{
			Title:         title,
			Description:   description,
			ScriptContent: cmd.ScriptContent,
			Tags:          cmd.Tags,
			Variables:     cmd.Variables,
			Presets:       presets,
			CategoryName:  categoryName,
		})
	}

	data, err := json.MarshalIndent(exportData, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal JSON: %w", err)
	}

	return os.WriteFile(path, data, 0644)
}

// ImportCommands imports commands from a JSON file
func (a *App) ImportCommands() ([]Command, error) {
	path, err := a.app.Dialog.OpenFile().
		CanChooseFiles(true).
		AddFilter("JSON Files (*.json)", "*.json").
		PromptForSingleSelection()
	if err != nil || path == "" {
		// User cancelled
		return nil, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}

	// Define import data structures
	type ImportedPreset struct {
		Name   string            `json:"name"`
		Values map[string]string `json:"values"`
	}

	type ImportedCommand struct {
		Title         string               `json:"title"`
		Description   string               `json:"description"`
		ScriptContent string               `json:"scriptContent"`
		Tags          []string             `json:"tags"`
		Variables     []VariableDefinition `json:"variables"`
		Presets       []ImportedPreset     `json:"presets"`
		CategoryName  string               `json:"categoryName"`
	}

	type ImportData struct {
		Version    string            `json:"version"`
		ExportedAt time.Time         `json:"exportedAt"`
		Commands   []ImportedCommand `json:"commands"`
	}

	var importData ImportData
	if err := json.Unmarshal(data, &importData); err != nil {
		return nil, fmt.Errorf("parse JSON: %w", err)
	}

	// Validate version
	if importData.Version != "1.0" {
		return nil, fmt.Errorf("unsupported export version: %s", importData.Version)
	}

	// Convert to db-compatible format
	commands := make([]struct {
		Title         string
		Description   string
		ScriptContent string
		Tags          []string
		Variables     []VariableDefinition
		Presets       []struct {
			Name   string
			Values map[string]string
		}
		CategoryName string
	}, len(importData.Commands))

	for i, cmd := range importData.Commands {
		presets := make([]struct {
			Name   string
			Values map[string]string
		}, len(cmd.Presets))
		for j, p := range cmd.Presets {
			presets[j] = struct {
				Name   string
				Values map[string]string
			}{Name: p.Name, Values: p.Values}
		}
		commands[i] = struct {
			Title         string
			Description   string
			ScriptContent string
			Tags          []string
			Variables     []VariableDefinition
			Presets       []struct {
				Name   string
				Values map[string]string
			}
			CategoryName string
		}{
			Title:         cmd.Title,
			Description:   cmd.Description,
			ScriptContent: cmd.ScriptContent,
			Tags:          cmd.Tags,
			Variables:     cmd.Variables,
			Presets:       presets,
			CategoryName:  cmd.CategoryName,
		}
	}

	if err := a.db.ImportCommands(commands); err != nil {
		return nil, fmt.Errorf("import commands: %w", err)
	}

	// Return all commands to refresh UI
	return a.db.GetCommands()
}

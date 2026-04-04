package main

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct holds application state
type App struct {
	ctx      context.Context
	db       *DB
	executor *Executor
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	db, err := NewDB()
	if err != nil {
		wailsruntime.LogFatal(ctx, "Failed to initialize database: "+err.Error())
		return
	}
	a.db = db
	a.executor = NewExecutor()
}

// shutdown is called when the app is closing
func (a *App) shutdown(ctx context.Context) {
	if a.db != nil {
		a.db.Close()
	}
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
		Title:         title,
		Description:   description,
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
		Title:         title,
		Description:   description,
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
		wailsruntime.EventsEmit(a.ctx, "cmd-output", chunk)
	})

	record := ExecutionRecord{
		ID:            uuid.New().String(),
		CommandID:     commandID,
		ScriptContent: cmd.ScriptContent,
		FinalCmd:      finalCmd,
		Output:        result.Output,
		Error:         result.Error,
		ExitCode:      result.ExitCode,
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

func (a *App) SetSettings(locale string, terminal string) error {
	return a.db.SetSettings(AppSettings{Locale: locale, Terminal: terminal})
}

// ========== Search ==========

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

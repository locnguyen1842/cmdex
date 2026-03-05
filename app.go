package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct holds application state
type App struct {
	ctx      context.Context
	store    *Store
	executor *Executor
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	store, err := NewStore()
	if err != nil {
		fmt.Println("Error initializing store:", err)
		return
	}
	a.store = store
	a.executor = NewExecutor()
}

// ========== Category Operations ==========

// GetCategories returns all categories
func (a *App) GetCategories() []Category {
	data := a.store.GetData()
	return data.Categories
}

// CreateCategory creates a new category
func (a *App) CreateCategory(name string, icon string, color string) (Category, error) {
	data := a.store.GetData()

	cat := Category{
		ID:        uuid.New().String(),
		Name:      name,
		Icon:      icon,
		Color:     color,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	data.Categories = append(data.Categories, cat)
	if err := a.store.SetData(data); err != nil {
		return Category{}, err
	}
	return cat, nil
}

// UpdateCategory updates an existing category
func (a *App) UpdateCategory(id string, name string, icon string, color string) (Category, error) {
	data := a.store.GetData()

	for i, cat := range data.Categories {
		if cat.ID == id {
			data.Categories[i].Name = name
			data.Categories[i].Icon = icon
			data.Categories[i].Color = color
			data.Categories[i].UpdatedAt = time.Now()

			if err := a.store.SetData(data); err != nil {
				return Category{}, err
			}
			return data.Categories[i], nil
		}
	}
	return Category{}, fmt.Errorf("category not found: %s", id)
}

// DeleteCategory removes a category and its commands
func (a *App) DeleteCategory(id string) error {
	data := a.store.GetData()

	found := false
	newCats := []Category{}
	for _, cat := range data.Categories {
		if cat.ID == id {
			found = true
			continue
		}
		newCats = append(newCats, cat)
	}

	if !found {
		return fmt.Errorf("category not found: %s", id)
	}

	// Also remove commands belonging to this category
	newCmds := []Command{}
	for _, cmd := range data.Commands {
		if cmd.CategoryID != id {
			newCmds = append(newCmds, cmd)
		}
	}

	data.Categories = newCats
	data.Commands = newCmds
	return a.store.SetData(data)
}

// ========== Command Operations ==========

// GetCommands returns all commands
func (a *App) GetCommands() []Command {
	data := a.store.GetData()
	return data.Commands
}

// GetCommandsByCategory returns commands for a specific category
func (a *App) GetCommandsByCategory(categoryID string) []Command {
	data := a.store.GetData()
	result := []Command{}
	for _, cmd := range data.Commands {
		if cmd.CategoryID == categoryID {
			result = append(result, cmd)
		}
	}
	return result
}

// CreateCommand creates a new command
func (a *App) CreateCommand(title, description, commandText, categoryID string, tags []string, variables []VariableDefinition) (Command, error) {
	data := a.store.GetData()

	if tags == nil {
		tags = []string{}
	}
	if variables == nil {
		variables = []VariableDefinition{}
	}

	cmd := Command{
		ID:          uuid.New().String(),
		Title:       title,
		Description: description,
		CommandText: commandText,
		CategoryID:  categoryID,
		Tags:        tags,
		Variables:   variables,
		Presets:     []VariablePreset{},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	data.Commands = append(data.Commands, cmd)
	if err := a.store.SetData(data); err != nil {
		return Command{}, err
	}
	return cmd, nil
}

// UpdateCommand updates an existing command
func (a *App) UpdateCommand(id, title, description, commandText, categoryID string, tags []string, variables []VariableDefinition) (Command, error) {
	data := a.store.GetData()

	if tags == nil {
		tags = []string{}
	}
	if variables == nil {
		variables = []VariableDefinition{}
	}

	for i, cmd := range data.Commands {
		if cmd.ID == id {
			data.Commands[i].Title = title
			data.Commands[i].Description = description
			data.Commands[i].CommandText = commandText
			data.Commands[i].CategoryID = categoryID
			data.Commands[i].Tags = tags
			data.Commands[i].Variables = variables
			data.Commands[i].UpdatedAt = time.Now()

			if err := a.store.SetData(data); err != nil {
				return Command{}, err
			}
			return data.Commands[i], nil
		}
	}
	return Command{}, fmt.Errorf("command not found: %s", id)
}

// DeleteCommand removes a command
func (a *App) DeleteCommand(id string) error {
	data := a.store.GetData()

	newCmds := []Command{}
	found := false
	for _, cmd := range data.Commands {
		if cmd.ID == id {
			found = true
			continue
		}
		newCmds = append(newCmds, cmd)
	}

	if !found {
		return fmt.Errorf("command not found: %s", id)
	}

	data.Commands = newCmds
	return a.store.SetData(data)
}

// ========== Execution Operations ==========

// GetVariables parses placeholders from command text, merges with stored variable
// definitions and CEL-evaluated defaults, and returns enriched prompts.
func (a *App) GetVariables(commandID string, commandText string) []VariablePrompt {
	parsed := a.executor.ParseVariables(commandText)
	if len(parsed) == 0 {
		return parsed
	}

	// Look up stored definitions for this command
	defMap := make(map[string]VariableDefinition)
	data := a.store.GetData()
	for _, cmd := range data.Commands {
		if cmd.ID == commandID {
			for _, v := range cmd.Variables {
				defMap[v.Name] = v
			}
			break
		}
	}

	// Collect definitions that have defaults for CEL evaluation
	var defsWithDefaults []VariableDefinition
	for _, p := range parsed {
		if d, ok := defMap[p.Name]; ok && d.Default != "" {
			defsWithDefaults = append(defsWithDefaults, d)
		}
	}
	evaluated := a.executor.EvalDefaults(defsWithDefaults)

	// Merge into prompts
	for i, p := range parsed {
		if d, ok := defMap[p.Name]; ok {
			parsed[i].Description = d.Description
			parsed[i].Example = d.Example
			parsed[i].DefaultExpr = d.Default
			if val, exists := evaluated[p.Name]; exists {
				parsed[i].DefaultValue = val
			}
		}
	}

	return parsed
}

// RunCommand executes a command with streaming output via Wails events.
// Emits "cmd-output" events with OutputChunk payloads during execution.
func (a *App) RunCommand(commandID string, commandText string, variables map[string]string) ExecutionRecord {
	finalCmd := a.executor.SubstituteVariables(commandText, variables)

	result := a.executor.ExecuteStreaming(finalCmd, func(chunk OutputChunk) {
		wailsruntime.EventsEmit(a.ctx, "cmd-output", chunk)
	})

	record := ExecutionRecord{
		ID:          uuid.New().String(),
		CommandID:   commandID,
		CommandText: commandText,
		FinalCmd:    finalCmd,
		Output:      result.Output,
		Error:       result.Error,
		ExitCode:    result.ExitCode,
		ExecutedAt:  time.Now(),
	}

	_ = a.store.AddExecution(record)

	return record
}

// RunInTerminal opens the user's preferred terminal and runs the command there
func (a *App) RunInTerminal(commandID string, commandText string, variables map[string]string) error {
	finalCmd := a.executor.SubstituteVariables(commandText, variables)
	terminalID := a.store.GetData().Settings.Terminal
	return a.executor.OpenInTerminal(terminalID, finalCmd)
}

// ========== Execution History ==========

// GetExecutionHistory returns all execution records, newest first
func (a *App) GetExecutionHistory() []ExecutionRecord {
	return a.store.GetExecutions()
}

// ClearExecutionHistory removes all execution records
func (a *App) ClearExecutionHistory() error {
	return a.store.ClearExecutions()
}

// ========== Variable Presets ==========

// GetPresets returns all presets for a command
func (a *App) GetPresets(commandID string) []VariablePreset {
	data := a.store.GetData()
	for _, cmd := range data.Commands {
		if cmd.ID == commandID {
			return cmd.Presets
		}
	}
	return []VariablePreset{}
}

// SavePreset creates a new preset for a command
func (a *App) SavePreset(commandID string, name string, values map[string]string) (VariablePreset, error) {
	data := a.store.GetData()
	for i, cmd := range data.Commands {
		if cmd.ID == commandID {
			preset := VariablePreset{
				ID:     uuid.New().String(),
				Name:   name,
				Values: values,
			}
			data.Commands[i].Presets = append(data.Commands[i].Presets, preset)
			if err := a.store.SetData(data); err != nil {
				return VariablePreset{}, err
			}
			return preset, nil
		}
	}
	return VariablePreset{}, fmt.Errorf("command not found: %s", commandID)
}

// UpdatePreset updates an existing preset's name and values
func (a *App) UpdatePreset(commandID string, presetID string, name string, values map[string]string) (VariablePreset, error) {
	data := a.store.GetData()
	for i, cmd := range data.Commands {
		if cmd.ID == commandID {
			for j, p := range cmd.Presets {
				if p.ID == presetID {
					data.Commands[i].Presets[j].Name = name
					data.Commands[i].Presets[j].Values = values
					if err := a.store.SetData(data); err != nil {
						return VariablePreset{}, err
					}
					return data.Commands[i].Presets[j], nil
				}
			}
			return VariablePreset{}, fmt.Errorf("preset not found: %s", presetID)
		}
	}
	return VariablePreset{}, fmt.Errorf("command not found: %s", commandID)
}

// DeletePreset removes a preset from a command
func (a *App) DeletePreset(commandID string, presetID string) error {
	data := a.store.GetData()
	for i, cmd := range data.Commands {
		if cmd.ID == commandID {
			newPresets := []VariablePreset{}
			for _, p := range cmd.Presets {
				if p.ID != presetID {
					newPresets = append(newPresets, p)
				}
			}
			data.Commands[i].Presets = newPresets
			return a.store.SetData(data)
		}
	}
	return fmt.Errorf("command not found: %s", commandID)
}

// ========== Settings ==========

// GetSettings returns the current app settings
func (a *App) GetSettings() AppSettings {
	data := a.store.GetData()
	return data.Settings
}

// GetAvailableTerminals returns all detected terminal emulators on the system
func (a *App) GetAvailableTerminals() []TerminalInfo {
	return a.executor.GetAvailableTerminals()
}

// SetSettings updates the app settings
func (a *App) SetSettings(locale string, terminal string) error {
	data := a.store.GetData()
	data.Settings.Locale = locale
	data.Settings.Terminal = terminal
	return a.store.SetData(data)
}

// ========== Search ==========

// SearchCommands searches commands by title, description, tags, or command text
func (a *App) SearchCommands(query string) []Command {
	data := a.store.GetData()
	if query == "" {
		return data.Commands
	}

	query = strings.ToLower(query)
	result := []Command{}
	for _, cmd := range data.Commands {
		if strings.Contains(strings.ToLower(cmd.Title), query) ||
			strings.Contains(strings.ToLower(cmd.Description), query) ||
			strings.Contains(strings.ToLower(cmd.CommandText), query) {
			result = append(result, cmd)
			continue
		}
		for _, tag := range cmd.Tags {
			if strings.Contains(strings.ToLower(tag), query) {
				result = append(result, cmd)
				break
			}
		}
	}
	return result
}

package main

import (
	"context"
	"fmt"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// App is the main application service that delegates to individual services.
type App struct {
	app                 *application.App
	db                  *DB
	commandService      *CommandService
	settingsService     *SettingsService
	executionService    *ExecutionService
	importExportService *ImportExportService
	eventService        *EventService
}

// ServiceStartup is called when the app starts
func (a *App) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	a.app = application.Get()
	db, err := NewDB()
	if err != nil {
		return fmt.Errorf("failed to initialize database: %w", err)
	}
	a.db = db
	executor := NewExecutor()

	// Initialize all services
	a.commandService = &CommandService{db: db}
	a.settingsService = &SettingsService{db: db, executor: executor}
	a.executionService = &ExecutionService{db: db, executor: executor, app: a.app}
	a.importExportService = &ImportExportService{db: db, app: a.app}
	a.eventService = &EventService{}

	return nil
}

// ServiceShutdown is called when the app is closing
func (a *App) ServiceShutdown() error {
	if a.db != nil {
		a.db.Close()
	}
	return nil
}

// ========== Forwarders to CommandService ==========

func (a *App) GetCategories() []Category {
	return a.commandService.GetCategories()
}

func (a *App) CreateCategory(name string, icon string, color string) (Category, error) {
	return a.commandService.CreateCategory(name, icon, color)
}

func (a *App) UpdateCategory(id string, name string, icon string, color string) (Category, error) {
	return a.commandService.UpdateCategory(id, name, icon, color)
}

func (a *App) DeleteCategory(id string) error {
	return a.commandService.DeleteCategory(id)
}

func (a *App) GetCommands() []Command {
	return a.commandService.GetCommands()
}

func (a *App) GetCommandsByCategory(categoryID string) []Command {
	return a.commandService.GetCommandsByCategory(categoryID)
}

func (a *App) CreateCommand(title, description, scriptBody, categoryID string, tags []string, variables []VariableDefinition) (Command, error) {
	return a.commandService.CreateCommand(title, description, scriptBody, categoryID, tags, variables)
}

func (a *App) UpdateCommand(id, title, description, scriptBody, categoryID string, tags []string, variables []VariableDefinition) (Command, error) {
	return a.commandService.UpdateCommand(id, title, description, scriptBody, categoryID, tags, variables)
}

func (a *App) RenameCommand(id string, newTitle string) (Command, error) {
	return a.commandService.RenameCommand(id, newTitle)
}

func (a *App) DeleteCommand(id string) error {
	return a.commandService.DeleteCommand(id)
}

func (a *App) ReorderCommand(id string, newPosition int, newCategoryId string) ([]Command, error) {
	return a.commandService.ReorderCommand(id, newPosition, newCategoryId)
}

func (a *App) GetScriptContent(commandID string) (string, error) {
	return a.commandService.GetScriptContent(commandID)
}

func (a *App) GetScriptBody(commandID string) (string, error) {
	return a.commandService.GetScriptBody(commandID)
}

func (a *App) SearchCommands(query string) []Command {
	return a.commandService.SearchCommands(query)
}

func (a *App) GetPresets(commandID string) []VariablePreset {
	return a.commandService.GetPresets(commandID)
}

func (a *App) SavePreset(commandID string, name string, values map[string]string) (VariablePreset, error) {
	return a.commandService.SavePreset(commandID, name, values)
}

func (a *App) UpdatePreset(commandID string, presetID string, name string, values map[string]string) (VariablePreset, error) {
	return a.commandService.UpdatePreset(commandID, presetID, name, values)
}

func (a *App) DeletePreset(commandID string, presetID string) error {
	return a.commandService.DeletePreset(commandID, presetID)
}

func (a *App) ReorderPresets(commandID string, presetIDs []string) error {
	return a.commandService.ReorderPresets(commandID, presetIDs)
}

func (a *App) ResetAllData() error {
	return a.commandService.ResetAllData()
}

// ========== Forwarders to SettingsService ==========

func (a *App) GetSettings() AppSettings {
	return a.settingsService.GetSettings()
}

func (a *App) SetSettings(jsonStr string) error {
	return a.settingsService.SetSettings(jsonStr)
}

func (a *App) GetAvailableTerminals() []TerminalInfo {
	return a.settingsService.GetAvailableTerminals()
}

func (a *App) ShowSettingsWindow() {
	a.settingsService.ShowSettingsWindow()
}

// ========== Forwarders to ExecutionService ==========

func (a *App) GetVariables(commandID string) []VariablePrompt {
	return a.executionService.GetVariables(commandID)
}

func (a *App) RunCommand(commandID string, variables map[string]string) ExecutionRecord {
	return a.executionService.RunCommand(commandID, variables)
}

func (a *App) RunInTerminal(commandID string, variables map[string]string) error {
	return a.executionService.RunInTerminal(commandID, variables)
}

func (a *App) GetExecutionHistory() []ExecutionRecord {
	return a.executionService.GetExecutionHistory()
}

func (a *App) ClearExecutionHistory() error {
	return a.executionService.ClearExecutionHistory()
}

// ========== Forwarders to ImportExportService ==========

func (a *App) ExportCommands(commandIDs []string) error {
	return a.importExportService.ExportCommands(commandIDs)
}

func (a *App) ImportCommands() ([]Command, error) {
	return a.importExportService.ImportCommands()
}

func (a *App) SaveThemeTemplate() error {
	return a.importExportService.SaveThemeTemplate()
}

// ========== Forwarders to EventService ==========

func (a *App) GetEventNames() EventNames {
	return a.eventService.GetEventNames()
}

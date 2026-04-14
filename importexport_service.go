package main

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// ImportExportService handles importing and exporting commands and theme templates.
type ImportExportService struct {
	db  *DB
	app *application.App
}

// SaveThemeTemplate saves a default theme template to a JSON file.
func (s *ImportExportService) SaveThemeTemplate() error {
	path, err := s.app.Dialog.SaveFile().
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

// ExportPreset is the exported format for a variable preset.
type ExportPreset struct {
	Name   string            `json:"name"`
	Values map[string]string `json:"values"`
}

// ExportCommand is the exported format for a command.
type ExportCommand struct {
	Title         string               `json:"title"`
	Description   string               `json:"description"`
	ScriptContent string               `json:"scriptContent"`
	Tags          []string             `json:"tags"`
	Variables     []VariableDefinition `json:"variables"`
	Presets       []ExportPreset       `json:"presets"`
	CategoryName  string               `json:"categoryName"`
}

// ExportCommands exports selected commands to a JSON file.
func (s *ImportExportService) ExportCommands(commandIDs []string) error {
	path, err := s.app.Dialog.SaveFile().
		SetFilename("cmdex-commands.json").
		AddFilter("JSON Files (*.json)", "*.json").
		PromptForSingleSelection()
	if err != nil || path == "" {
		// User cancelled
		return nil
	}

	cmds, err := s.db.GetCommandsByIDs(commandIDs)
	if err != nil {
		return fmt.Errorf("get commands: %w", err)
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
			cats, _ := s.db.GetCategories()
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

// ImportedPreset is the imported format for a variable preset.
type ImportedPreset struct {
	Name   string            `json:"name"`
	Values map[string]string `json:"values"`
}

// ImportedCommand is the imported format for a command.
type ImportedCommand struct {
	Title         string               `json:"title"`
	Description   string               `json:"description"`
	ScriptContent string               `json:"scriptContent"`
	Tags          []string             `json:"tags"`
	Variables     []VariableDefinition `json:"variables"`
	Presets       []ImportedPreset     `json:"presets"`
	CategoryName  string               `json:"categoryName"`
}

// ImportData is the root structure of an import file.
type ImportData struct {
	Version    string            `json:"version"`
	ExportedAt time.Time         `json:"exportedAt"`
	Commands   []ImportedCommand `json:"commands"`
}

// ImportCommands imports commands from a JSON file.
func (s *ImportExportService) ImportCommands() ([]Command, error) {
	path, err := s.app.Dialog.OpenFile().
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

	if err := s.db.ImportCommands(commands); err != nil {
		return nil, fmt.Errorf("import commands: %w", err)
	}

	// Return all commands to refresh UI
	return s.db.GetCommands()
}

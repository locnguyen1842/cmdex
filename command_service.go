package main

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// CommandService handles all command and category CRUD operations.
type CommandService struct {
	db *DB
}

// ========== Category Operations ==========

func (s *CommandService) GetCategories() []Category {
	cats, err := s.db.GetCategories()
	if err != nil {
		fmt.Println("Error getting categories:", err)
		return []Category{}
	}
	return cats
}

func (s *CommandService) CreateCategory(name string, icon string, color string) (Category, error) {
	cat := Category{
		ID:        uuid.New().String(),
		Name:      name,
		Icon:      icon,
		Color:     color,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := s.db.CreateCategory(cat); err != nil {
		return Category{}, err
	}
	return cat, nil
}

func (s *CommandService) UpdateCategory(id string, name string, icon string, color string) (Category, error) {
	cat := Category{
		ID:        id,
		Name:      name,
		Icon:      icon,
		Color:     color,
		UpdatedAt: time.Now(),
	}
	if err := s.db.UpdateCategory(cat); err != nil {
		return Category{}, err
	}
	cats, _ := s.db.GetCategories()
	for _, c := range cats {
		if c.ID == id {
			return c, nil
		}
	}
	return cat, nil
}

func (s *CommandService) DeleteCategory(id string) error {
	return s.db.DeleteCategory(id)
}

// ========== Command Operations ==========

func (s *CommandService) GetCommands() []Command {
	cmds, err := s.db.GetCommands()
	if err != nil {
		fmt.Println("Error getting commands:", err)
		return []Command{}
	}
	return cmds
}

func (s *CommandService) GetCommandsByCategory(categoryID string) []Command {
	cmds, err := s.db.GetCommandsByCategory(categoryID)
	if err != nil {
		fmt.Println("Error getting commands:", err)
		return []Command{}
	}
	return cmds
}

func (s *CommandService) CreateCommand(title, description, scriptBody, categoryID string, tags []string, variables []VariableDefinition) (Command, error) {
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

	if err := s.db.CreateCommand(cmd); err != nil {
		return Command{}, err
	}
	return cmd, nil
}

func (s *CommandService) UpdateCommand(id, title, description, scriptBody, categoryID string, tags []string, variables []VariableDefinition) (Command, error) {
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

	if err := s.db.UpdateCommand(cmd); err != nil {
		return Command{}, err
	}

	return s.db.GetCommand(id)
}

func (s *CommandService) RenameCommand(id string, newTitle string) (Command, error) {
	if err := s.db.RenameCommand(id, newTitle); err != nil {
		return Command{}, err
	}
	return s.db.GetCommand(id)
}

func (s *CommandService) DeleteCommand(id string) error {
	return s.db.DeleteCommand(id)
}

// ReorderCommand moves a command to a new position within a category (or to a
// different category). newCategoryId may be empty string for uncategorized.
// newPosition is the 0-based index within the target category.
func (s *CommandService) ReorderCommand(id string, newPosition int, newCategoryId string) ([]Command, error) {
	if err := s.db.UpdateCommandPosition(id, newCategoryId, newPosition); err != nil {
		return nil, fmt.Errorf("reorder command: %w", err)
	}
	return s.db.GetCommands()
}

// GetScriptContent returns the full script content for the editor
func (s *CommandService) GetScriptContent(commandID string) (string, error) {
	cmd, err := s.db.GetCommand(commandID)
	if err != nil {
		return "", err
	}
	return cmd.ScriptContent, nil
}

// GetScriptBody returns just the body (for simple mode editing)
func (s *CommandService) GetScriptBody(commandID string) (string, error) {
	cmd, err := s.db.GetCommand(commandID)
	if err != nil {
		return "", err
	}
	return ParseScriptBody(cmd.ScriptContent), nil
}

// ========== Search ==========

func (s *CommandService) SearchCommands(query string) []Command {
	if query == "" {
		return s.GetCommands()
	}

	cmds, err := s.db.SearchCommands(query)
	if err != nil {
		fmt.Println("Error searching commands:", err)
		return []Command{}
	}
	return cmds
}

// ========== Variable Presets ==========

func (s *CommandService) GetPresets(commandID string) []VariablePreset {
	presets, err := s.db.GetPresets(commandID)
	if err != nil {
		return []VariablePreset{}
	}
	return presets
}

func (s *CommandService) SavePreset(commandID string, name string, values map[string]string) (VariablePreset, error) {
	preset := VariablePreset{
		ID:     uuid.New().String(),
		Name:   name,
		Values: values,
	}
	if err := s.db.SavePreset(commandID, preset); err != nil {
		return VariablePreset{}, err
	}
	return preset, nil
}

func (s *CommandService) UpdatePreset(commandID string, presetID string, name string, values map[string]string) (VariablePreset, error) {
	preset := VariablePreset{
		ID:     presetID,
		Name:   name,
		Values: values,
	}
	if err := s.db.UpdatePreset(preset); err != nil {
		return VariablePreset{}, err
	}
	return preset, nil
}

func (s *CommandService) DeletePreset(commandID string, presetID string) error {
	return s.db.DeletePreset(presetID)
}

func (s *CommandService) ReorderPresets(commandID string, presetIDs []string) error {
	existing, err := s.db.GetPresets(commandID)
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
	return s.db.ReorderPresets(commandID, presetIDs)
}

// ========== Reset ==========

func (s *CommandService) ResetAllData() error {
	return s.db.ResetAll()
}

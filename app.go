package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// App struct holds application state
type App struct {
	ctx   context.Context
	store *Store
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
func (a *App) CreateCommand(title, description, commandText, categoryID string, tags []string) (Command, error) {
	data := a.store.GetData()

	if tags == nil {
		tags = []string{}
	}

	cmd := Command{
		ID:          uuid.New().String(),
		Title:       title,
		Description: description,
		CommandText: commandText,
		CategoryID:  categoryID,
		Tags:        tags,
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
func (a *App) UpdateCommand(id, title, description, commandText, categoryID string, tags []string) (Command, error) {
	data := a.store.GetData()

	if tags == nil {
		tags = []string{}
	}

	for i, cmd := range data.Commands {
		if cmd.ID == id {
			data.Commands[i].Title = title
			data.Commands[i].Description = description
			data.Commands[i].CommandText = commandText
			data.Commands[i].CategoryID = categoryID
			data.Commands[i].Tags = tags
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

// GetVariables parses and returns variables from a command text
func (a *App) GetVariables(commandText string) []VariablePrompt {
	return ParseVariables(commandText)
}

// RunCommand executes a command after substituting variables
func (a *App) RunCommand(commandText string, variables map[string]string) ExecutionResult {
	finalCmd := SubstituteVariables(commandText, variables)
	return ExecuteCommand(finalCmd)
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

package main

import "time"

// Category represents a group of related commands
type Category struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Icon      string    `json:"icon"`
	Color     string    `json:"color"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Command represents a saved CLI command
type Command struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	CommandText string    `json:"commandText"`
	Tags        []string  `json:"tags"`
	CategoryID  string    `json:"categoryId"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// VariablePrompt represents a parsed variable placeholder from a command
type VariablePrompt struct {
	Name         string `json:"name"`
	Placeholder  string `json:"placeholder"`
	DefaultValue string `json:"defaultValue"`
}

// AppData is the root data structure persisted to disk
type AppData struct {
	Categories []Category `json:"categories"`
	Commands   []Command  `json:"commands"`
}

// ExecutionResult holds the output of a command execution
type ExecutionResult struct {
	Output   string `json:"output"`
	Error    string `json:"error"`
	ExitCode int    `json:"exitCode"`
}

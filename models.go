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

// VariableDefinition stores per-command variable metadata
type VariableDefinition struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Example     string `json:"example"`
	Default     string `json:"default"` // plain value or CEL expression
	SortOrder   int    `json:"sortOrder"`
}

// VariablePreset stores a named set of variable values for a command
type VariablePreset struct {
	ID     string            `json:"id"`
	Name   string            `json:"name"`
	Values map[string]string `json:"values"`
}

// Command represents a saved CLI command
type Command struct {
	ID            string               `json:"id"`
	Title         string               `json:"title"`
	Description   string               `json:"description"`
	ScriptContent string               `json:"scriptContent"`
	Tags          []string             `json:"tags"`
	Variables     []VariableDefinition `json:"variables"`
	Presets       []VariablePreset     `json:"presets"`
	CategoryID    string               `json:"categoryId"`
	Position      int                  `json:"position"`
	CreatedAt     time.Time            `json:"createdAt"`
	UpdatedAt     time.Time            `json:"updatedAt"`
}

// VariablePrompt is returned to the frontend when prompting for variable values
type VariablePrompt struct {
	Name         string `json:"name"`
	Placeholder  string `json:"placeholder"`
	Description  string `json:"description"`
	Example      string `json:"example"`
	DefaultExpr  string `json:"defaultExpr"`  // raw CEL/literal expression from definition
	DefaultValue string `json:"defaultValue"` // evaluated default ready to use
}

// ExecutionRecord captures a single command execution for history
type ExecutionRecord struct {
	ID          string    `json:"id"`
	CommandID   string    `json:"commandId"`
	ScriptContent string    `json:"scriptContent"`
	FinalCmd      string    `json:"finalCmd"`
	Output      string    `json:"output"`
	Error       string    `json:"error"`
	ExitCode    int       `json:"exitCode"`
	ExecutedAt  time.Time `json:"executedAt"`
}

// TerminalInfo describes a detected terminal emulator
type TerminalInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// AppSettings stores user preferences
type AppSettings struct {
	Locale   string `json:"locale"`
	Terminal string `json:"terminal"` // terminal ID; empty = auto-detect
}

// ExecutionResult holds the output of a command execution
type ExecutionResult struct {
	Output   string `json:"output"`
	Error    string `json:"error"`
	ExitCode int    `json:"exitCode"`
}

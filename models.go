package main

import (
	"database/sql"
	"strings"
	"time"
)

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
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	Position int               `json:"position"`
	Values   map[string]string `json:"values"`
}

// Command represents a saved CLI command
type Command struct {
	ID            string               `json:"id"`
	Title         sql.NullString       `json:"title"`
	Description   sql.NullString       `json:"description"`
	ScriptContent string               `json:"scriptContent"`
	Tags          []string             `json:"tags"`
	Variables     []VariableDefinition `json:"variables"`
	Presets       []VariablePreset     `json:"presets"`
	CategoryID    string               `json:"categoryId"`
	Position      int                  `json:"position"`
	CreatedAt     time.Time            `json:"createdAt"`
	UpdatedAt     time.Time            `json:"updatedAt"`
}

// DisplayTitle returns the title if present, otherwise extracts first 50 chars from script
func (c Command) DisplayTitle() string {
	if c.Title.Valid && c.Title.String != "" {
		return c.Title.String
	}
	body := ParseScriptBody(c.ScriptContent)
	body = strings.ReplaceAll(body, "\n", " ")
	body = strings.TrimSpace(body)
	if len(body) > 50 {
		return body[:50] + "..."
	}
	if body == "" {
		return "Untitled"
	}
	return body
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
	ID            string    `json:"id"`
	CommandID     string    `json:"commandId"`
	ScriptContent string    `json:"scriptContent"`
	FinalCmd      string    `json:"finalCmd"`
	Output        string    `json:"output"`
	Error         string    `json:"error"`
	ExitCode      int       `json:"exitCode"`
	WorkingDir    string    `json:"workingDir"`
	ExecutedAt    time.Time `json:"executedAt"`
}

// TerminalInfo describes a detected terminal emulator
type TerminalInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// AppSettings stores user preferences
type AppSettings struct {
	Locale         string `json:"locale"`
	Terminal       string `json:"terminal"`       // terminal ID; empty = auto-detect
	Theme          string `json:"theme"`          // active theme ID
	LastDarkTheme  string `json:"lastDarkTheme"`  // last used dark theme
	LastLightTheme string `json:"lastLightTheme"` // last used light theme
	CustomThemes   string `json:"customThemes"`   // JSON-encoded []CustomTheme; empty string = "[]"
	UIFont         string `json:"uiFont"`         // UI sans-serif font
	MonoFont       string `json:"monoFont"`       // monospace font for editor
	Density        string `json:"density"`        // layout density: compact | comfortable | spacious
	WindowX        int    `json:"windowX"`        // settings window X position, -1 = unset (center on open)
	WindowY        int    `json:"windowY"`        // settings window Y position
	WindowWidth    int    `json:"windowWidth"`    // settings window width, min 480
	WindowHeight   int    `json:"windowHeight"`   // settings window height, min 400
}

// ExecutionResult holds the output of a command execution
type ExecutionResult struct {
	Output   string `json:"output"`
	Error    string `json:"error"`
	ExitCode int    `json:"exitCode"`
}

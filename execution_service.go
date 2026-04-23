package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// ExecutionService handles running commands and execution history.
type ExecutionService struct{}

func (s *ExecutionService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	return nil
}

// resolveWorkingDir determines the working directory for a command using the fallback chain:
// 1. Command-specific working dir for the current OS
// 2. Global default working dir for the current OS
// 3. OS home directory
func (s *ExecutionService) resolveWorkingDir(cmd Command) string {
	if path := cmd.WorkingDir.GetCurrentOS(); path != "" {
		return path
	}

	settings, err := db.GetSettings()
	if err == nil {
		if path := settings.DefaultWorkingDir.GetCurrentOS(); path != "" {
			return path
		}
	}

	home, _ := os.UserHomeDir()
	return home
}

// GetVariables returns variable prompts for a command.
func (s *ExecutionService) GetVariables(commandID string) []VariablePrompt {
	cmd, err := db.GetCommand(commandID)
	if err != nil {
		return []VariablePrompt{}
	}

	if len(cmd.Variables) == 0 {
		return []VariablePrompt{}
	}

	evaluated := executor.EvalDefaults(cmd.Variables)

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

// RunCommand executes a command with resolved variables and streams output via event.
func (s *ExecutionService) RunCommand(commandID string, variables map[string]string) ExecutionRecord {
	cmd, err := db.GetCommand(commandID)
	if err != nil {
		return ExecutionRecord{
			ID:       uuid.New().String(),
			Error:    err.Error(),
			ExitCode: -1,
		}
	}

	resolvedScript := ReplaceTemplateVars(cmd.ScriptContent, variables)
	finalCmd := BuildDisplayCommand(cmd.ScriptContent, variables)
	workingDir := s.resolveWorkingDir(cmd)

	result := executor.ExecuteScript(resolvedScript, workingDir, func(chunk OutputChunk) {
		wailsApp.Event.Emit(eventNames.CmdOutput, chunk)
	})

	record := ExecutionRecord{
		ID:            uuid.New().String(),
		CommandID:     commandID,
		ScriptContent: cmd.ScriptContent,
		FinalCmd:      finalCmd,
		Output:        result.Output,
		Error:         result.Error,
		ExitCode:      result.ExitCode,
		WorkingDir:    workingDir,
		ExecutedAt:    time.Now(),
	}

	if err := db.AddExecution(record); err != nil {
		fmt.Printf("failed to persist execution record: %v\n", err)
	}

	return record
}

// RunInTerminal opens the command in the system terminal.
func (s *ExecutionService) RunInTerminal(commandID string, variables map[string]string) error {
	cmd, err := db.GetCommand(commandID)
	if err != nil {
		return err
	}

	resolvedScript := ReplaceTemplateVars(cmd.ScriptContent, variables)
	workingDir := s.resolveWorkingDir(cmd)

	settings, err := db.GetSettings()
	if err != nil {
		return fmt.Errorf("failed to get settings: %w", err)
	}
	return executor.OpenInTerminal(settings.Terminal, resolvedScript, workingDir)
}

// GetExecutionHistory returns all past execution records.
func (s *ExecutionService) GetExecutionHistory() []ExecutionRecord {
	records, err := db.GetExecutions()
	if err != nil {
		fmt.Println("Error getting executions:", err)
		return []ExecutionRecord{}
	}
	return records
}

// ClearExecutionHistory deletes all execution history.
func (s *ExecutionService) ClearExecutionHistory() error {
	return db.ClearExecutions()
}

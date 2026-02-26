package main

import (
	"bytes"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
)

var variableRegex = regexp.MustCompile(`\{\?(\w+)\}`)

// ParseVariables extracts variable placeholders from command text
// Placeholders use the format {?variableName}
func ParseVariables(cmdText string) []VariablePrompt {
	matches := variableRegex.FindAllStringSubmatch(cmdText, -1)
	seen := make(map[string]bool)
	var prompts []VariablePrompt

	for _, match := range matches {
		name := match[1]
		if seen[name] {
			continue
		}
		seen[name] = true
		prompts = append(prompts, VariablePrompt{
			Name:        name,
			Placeholder: match[0],
		})
	}

	if prompts == nil {
		prompts = []VariablePrompt{}
	}
	return prompts
}

// SubstituteVariables replaces {?var} placeholders with provided values
func SubstituteVariables(cmdText string, variables map[string]string) string {
	result := cmdText
	for name, value := range variables {
		result = strings.ReplaceAll(result, "{?"+name+"}", value)
	}
	return result
}

// ExecuteCommand runs a shell command and returns the result
func ExecuteCommand(cmdText string) ExecutionResult {
	var shell string
	var flag string

	if runtime.GOOS == "windows" {
		shell = "cmd"
		flag = "/C"
	} else {
		shell = "/bin/sh"
		flag = "-c"
	}

	cmd := exec.Command(shell, flag, cmdText)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	result := ExecutionResult{
		Output:   stdout.String(),
		ExitCode: 0,
	}

	if stderr.Len() > 0 {
		result.Error = stderr.String()
	}

	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			result.ExitCode = exitErr.ExitCode()
		} else {
			result.Error = err.Error()
			result.ExitCode = -1
		}
	}

	return result
}

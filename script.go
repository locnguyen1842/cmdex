package main

import (
	"strconv"
	"strings"
)

const scriptHeader = "#!/bin/bash"
const mainOpen = "main() {"
const mainClose = "}"
const mainCall = `main "$@"`

// GenerateScript builds a full bash script from a body and variable definitions.
func GenerateScript(body string, variables []VariableDefinition) string {
	var sb strings.Builder

	sb.WriteString(scriptHeader)
	sb.WriteString("\n\n")
	sb.WriteString(mainOpen)
	sb.WriteString("\n")

	for i, v := range variables {
		sb.WriteString("  local ")
		sb.WriteString(v.Name)
		sb.WriteString("=\"$")
		sb.WriteString(strconv.Itoa(i + 1))
		sb.WriteString("\"\n")
	}

	if len(variables) > 0 {
		sb.WriteString("\n")
	}

	for _, line := range strings.Split(body, "\n") {
		if line == "" {
			sb.WriteString("\n")
		} else {
			sb.WriteString("  ")
			sb.WriteString(line)
			sb.WriteString("\n")
		}
	}

	sb.WriteString(mainClose)
	sb.WriteString("\n\n")
	sb.WriteString(mainCall)
	sb.WriteString("\n")

	return sb.String()
}

// ParseScriptBody extracts the user-editable body from a full script.
func ParseScriptBody(scriptContent string) string {
	lines := strings.Split(scriptContent, "\n")

	mainStart := -1
	for i, line := range lines {
		if strings.TrimSpace(line) == mainOpen {
			mainStart = i
			break
		}
	}
	if mainStart == -1 {
		return scriptContent
	}

	mainEnd := -1
	for i := mainStart + 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) == mainClose {
			mainEnd = i
			break
		}
	}
	if mainEnd == -1 {
		return scriptContent
	}

	bodyStart := mainStart + 1
	for bodyStart < mainEnd {
		trimmed := strings.TrimSpace(lines[bodyStart])
		if strings.HasPrefix(trimmed, "local ") && strings.Contains(trimmed, "=\"$") {
			bodyStart++
			continue
		}
		break
	}

	if bodyStart < mainEnd && strings.TrimSpace(lines[bodyStart]) == "" {
		bodyStart++
	}

	var bodyLines []string
	for i := bodyStart; i < mainEnd; i++ {
		line := lines[i]
		if strings.HasPrefix(line, "  ") {
			line = line[2:]
		}
		bodyLines = append(bodyLines, line)
	}

	return strings.Join(bodyLines, "\n")
}

// RegenerateSignature replaces local declarations in an existing script.
func RegenerateSignature(scriptContent string, variables []VariableDefinition) string {
	lines := strings.Split(scriptContent, "\n")

	mainStart := -1
	for i, line := range lines {
		if strings.TrimSpace(line) == mainOpen {
			mainStart = i
			break
		}
	}
	if mainStart == -1 {
		return GenerateScript(scriptContent, variables)
	}

	bodyStart := mainStart + 1
	for bodyStart < len(lines) {
		trimmed := strings.TrimSpace(lines[bodyStart])
		if strings.HasPrefix(trimmed, "local ") && strings.Contains(trimmed, "=\"$") {
			bodyStart++
			continue
		}
		break
	}
	if bodyStart < len(lines) && strings.TrimSpace(lines[bodyStart]) == "" {
		bodyStart++
	}

	var sb strings.Builder

	for i := 0; i <= mainStart; i++ {
		sb.WriteString(lines[i])
		sb.WriteString("\n")
	}

	for i, v := range variables {
		sb.WriteString("  local ")
		sb.WriteString(v.Name)
		sb.WriteString("=\"$")
		sb.WriteString(strconv.Itoa(i + 1))
		sb.WriteString("\"\n")
	}

	if len(variables) > 0 {
		sb.WriteString("\n")
	}

	for i := bodyStart; i < len(lines); i++ {
		sb.WriteString(lines[i])
		if i < len(lines)-1 {
			sb.WriteString("\n")
		}
	}

	return sb.String()
}

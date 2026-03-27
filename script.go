package main

import (
	"regexp"
	"sort"
	"strings"
)

var templateVarRe = regexp.MustCompile(`\{\{(\w+)\}\}`)

const scriptHeader = "#!/bin/bash"

// GenerateScript wraps a body in a shebang header.
func GenerateScript(body string) string {
	body = strings.TrimSpace(body)
	return scriptHeader + "\n\n" + body + "\n"
}

// ParseScriptBody strips the shebang header and returns the user-editable body.
func ParseScriptBody(scriptContent string) string {
	s := strings.TrimSpace(scriptContent)
	if strings.HasPrefix(s, scriptHeader) {
		s = strings.TrimPrefix(s, scriptHeader)
		s = strings.TrimLeft(s, "\n")
	}
	return s
}

// ExtractTemplateVars returns unique variable names from {{var}} patterns, in order of first appearance.
func ExtractTemplateVars(text string) []string {
	matches := templateVarRe.FindAllStringSubmatch(text, -1)
	seen := map[string]int{}
	for _, m := range matches {
		name := m[1]
		if _, ok := seen[name]; !ok {
			seen[name] = len(seen)
		}
	}
	result := make([]string, len(seen))
	for name, idx := range seen {
		result[idx] = name
	}
	return result
}

// ReplaceTemplateVars replaces all {{var}} placeholders with their values.
func ReplaceTemplateVars(content string, values map[string]string) string {
	return templateVarRe.ReplaceAllStringFunc(content, func(match string) string {
		name := match[2 : len(match)-2] // strip {{ and }}
		if val, ok := values[name]; ok {
			return val
		}
		return match // leave unreplaced if no value
	})
}

// MergeDetectedVars merges auto-detected variable names with existing variable definitions.
// Detected vars not in existing list are added; existing vars not detected are kept (manual vars).
// Order: detected vars first (in detection order), then manual-only vars.
func MergeDetectedVars(detected []string, existing []VariableDefinition) []VariableDefinition {
	existingMap := map[string]VariableDefinition{}
	for _, v := range existing {
		existingMap[v.Name] = v
	}

	detectedSet := map[string]bool{}
	for _, name := range detected {
		detectedSet[name] = true
	}

	var result []VariableDefinition

	// First: detected vars in order
	for i, name := range detected {
		if v, ok := existingMap[name]; ok {
			v.SortOrder = i
			result = append(result, v)
		} else {
			result = append(result, VariableDefinition{
				Name:      name,
				SortOrder: i,
			})
		}
	}

	// Then: manual vars not in detected set, preserving relative order
	var manualVars []VariableDefinition
	for _, v := range existing {
		if !detectedSet[v.Name] {
			manualVars = append(manualVars, v)
		}
	}
	sort.SliceStable(manualVars, func(i, j int) bool {
		return manualVars[i].SortOrder < manualVars[j].SortOrder
	})
	for _, v := range manualVars {
		v.SortOrder = len(result)
		result = append(result, v)
	}

	return result
}

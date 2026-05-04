package main

import (
	"testing"
)

func TestGenerateScript(t *testing.T) {
	// Basic body
	result := GenerateScript("echo hello")
	expected := "echo hello\n"
	if result != expected {
		t.Errorf("GenerateScript: got %q, want %q", result, expected)
	}

	// Empty body
	result = GenerateScript("")
	if result != "" {
		t.Errorf("GenerateScript empty: got %q, want empty", result)
	}

	// Whitespace-only body
	result = GenerateScript("  \n  ")
	if result != "" {
		t.Errorf("GenerateScript whitespace: got %q, want empty", result)
	}

	// Multi-line body
	result = GenerateScript("echo one\necho two")
	expected = "echo one\necho two\n"
	if result != expected {
		t.Errorf("GenerateScript multi-line: got %q, want %q", result, expected)
	}

	// Ensure no shebang prefix
	if len(result) >= 2 && result[:2] == "#!" {
		t.Errorf("GenerateScript contains shebang prefix: %q", result)
	}
}

func TestParseScriptBody(t *testing.T) {
	// Old format: #!/bin/bash shebang
	result := ParseScriptBody("#!/bin/bash\n\necho hello\n")
	expected := "echo hello"
	if result != expected {
		t.Errorf("ParseScriptBody old format: got %q, want %q", result, expected)
	}

	// Old format with #!/usr/bin/env bash
	result = ParseScriptBody("#!/usr/bin/env bash\n\necho hello\n")
	expected = "echo hello"
	if result != expected {
		t.Errorf("ParseScriptBody env bash: got %q, want %q", result, expected)
	}

	// New format: no shebang
	result = ParseScriptBody("echo hello\n")
	expected = "echo hello"
	if result != expected {
		t.Errorf("ParseScriptBody no shebang: got %q, want %q", result, expected)
	}

	// Empty content
	result = ParseScriptBody("")
	if result != "" {
		t.Errorf("ParseScriptBody empty: got %q, want empty", result)
	}

	// Only shebang, no body
	result = ParseScriptBody("#!/bin/bash\n")
	if result != "" {
		t.Errorf("ParseScriptBody shebang only: got %q, want empty", result)
	}
}

func TestExtractTemplateVars(t *testing.T) {
	vars := ExtractTemplateVars("echo {{name}} {{greeting}}")
	if len(vars) != 2 || vars[0] != "name" || vars[1] != "greeting" {
		t.Errorf("ExtractTemplateVars: got %v, want [name greeting]", vars)
	}

	// Duplicate vars should be deduplicated
	vars = ExtractTemplateVars("{{x}} {{x}}")
	if len(vars) != 1 || vars[0] != "x" {
		t.Errorf("ExtractTemplateVars dedup: got %v, want [x]", vars)
	}

	// No vars
	vars = ExtractTemplateVars("echo hello")
	if len(vars) != 0 {
		t.Errorf("ExtractTemplateVars none: got %v, want []", vars)
	}
}

func TestReplaceTemplateVars(t *testing.T) {
	values := map[string]string{"name": "world", "greeting": "hello"}
	result := ReplaceTemplateVars("echo {{greeting}} {{name}}", values)
	expected := "echo hello world"
	if result != expected {
		t.Errorf("ReplaceTemplateVars: got %q, want %q", result, expected)
	}

	// Unreplaced vars left as-is
	result = ReplaceTemplateVars("echo {{unknown}}", values)
	if result != "echo {{unknown}}" {
		t.Errorf("ReplaceTemplateVars unknown: got %q, want %q", result, "echo {{unknown}}")
	}

	// Empty values
	result = ReplaceTemplateVars("echo hi", map[string]string{})
	if result != "echo hi" {
		t.Errorf("ReplaceTemplateVars empty: got %q, want %q", result, "echo hi")
	}
}

func TestMergeDetectedVars(t *testing.T) {
	existing := []VariableDefinition{
		{Name: "name", SortOrder: 0},
		{Name: "manual", SortOrder: 1},
	}
	detected := []string{"name", "auto"}
	result := MergeDetectedVars(detected, existing)
	if len(result) != 3 {
		t.Errorf("MergeDetectedVars len: got %d, want 3", len(result))
	}
	if result[0].Name != "name" || result[1].Name != "auto" || result[2].Name != "manual" {
		t.Errorf("MergeDetectedVars order: got %v", result)
	}
}

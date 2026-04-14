package main

import (
	"encoding/json"
	"fmt"
)

// SettingsService handles user preferences and settings window.
type SettingsService struct {
	db       *DB
	executor *Executor
}

// GetSettings returns the current app settings.
func (s *SettingsService) GetSettings() AppSettings {
	settings, err := s.db.GetSettings()
	if err != nil {
		return AppSettings{Locale: "en"}
	}
	return settings
}

// SetSettings updates the app settings from a JSON string.
func (s *SettingsService) SetSettings(jsonStr string) error {
	var settings AppSettings
	if err := json.Unmarshal([]byte(jsonStr), &settings); err != nil {
		return fmt.Errorf("invalid settings JSON: %w", err)
	}
	return s.db.SetSettings(settings)
}

// GetAvailableTerminals returns all detected terminal emulators.
func (s *SettingsService) GetAvailableTerminals() []TerminalInfo {
	return s.executor.GetAvailableTerminals()
}

// ShowSettingsWindow opens the settings window.
func (s *SettingsService) ShowSettingsWindow() {
	ShowSettingsWindow()
}

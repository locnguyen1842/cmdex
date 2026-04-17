package main

import (
	"context"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// EventNames holds all Wails event name constants, exposed to frontend via GetEventNames().
type EventNames struct {
	CmdOutput             string `json:"cmdOutput"`
	OpenSettings          string `json:"openSettings"`
	SettingsChanged       string `json:"settingsChanged"`
	SettingsWindowClosing string `json:"settingsWindowClosing"`
}

var eventNames = EventNames{
	CmdOutput:             "cmd-output",
	OpenSettings:          "open-settings",
	SettingsChanged:       "settings-changed",
	SettingsWindowClosing: "settings-window-closing",
}

// EventService exposes event name constants to the frontend.
type EventService struct{}

func (s *EventService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	return nil
}

// GetEventNames returns all event name constants so the frontend can use
// them via Wails bindings instead of hardcoded strings.
func (s *EventService) GetEventNames() EventNames {
	return eventNames
}

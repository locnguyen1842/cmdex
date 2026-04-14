package main

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
type EventService struct {
}

// GetEventNames returns all event name constants so the frontend can use
// them via Wails bindings instead of hardcoded strings.
func (s *EventService) GetEventNames() EventNames {
	return eventNames
}

package main

import (
	"context"
	"fmt"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

var (
	db       *DB
	executor *Executor
	wailsApp *application.App
)

// App handles application lifecycle and settings window management.
type App struct {
	settingsWindowMu sync.Mutex
	settingsWindow   *application.WebviewWindow
}

func (a *App) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	wailsApp = application.Get()
	var err error
	db, err = NewDB()
	if err != nil {
		return fmt.Errorf("failed to initialize database: %w", err)
	}
	executor = NewExecutor()
	return nil
}

func (a *App) ServiceShutdown() error {
	if db != nil {
		db.Close()
	}
	return nil
}

// ShowSettingsWindow opens the settings window, creating it if needed.
func (a *App) ShowSettingsWindow() {
	a.settingsWindowMu.Lock()
	if a.settingsWindow == nil {
		a.settingsWindowMu.Unlock()
		a.createSettingsWindow()
		a.settingsWindowMu.Lock()
	}
	w := a.settingsWindow
	a.settingsWindowMu.Unlock()

	if w != nil {
		w.Show()
		w.Focus()
	}
}

func (a *App) createSettingsWindow() {
	a.settingsWindowMu.Lock()
	defer a.settingsWindowMu.Unlock()
	if a.settingsWindow != nil {
		return
	}

	windowOptions := application.WebviewWindowOptions{
		Title:               "Settings",
		UseApplicationMenu:  false,
		BackgroundColour:    application.NewRGBA(15, 15, 20, 255),
		HideOnEscape:        true,
		DisableResize:       true,
		Width:               640,
		Height:              520,
		MinimiseButtonState: application.ButtonDisabled,
		MaximiseButtonState: application.ButtonDisabled,
		URL:                 "/?window=settings",
		Name:                "settings",
		InitialPosition:     application.WindowCentered,
	}

	sw := wailsApp.Window.NewWithOptions(windowOptions)

	sw.OnWindowEvent(events.Common.WindowClosing, func(event *application.WindowEvent) {
		a.settingsWindowMu.Lock()
		defer a.settingsWindowMu.Unlock()

		wailsApp.Event.Emit(eventNames.SettingsWindowClosing)
		a.settingsWindow = nil
	})

	a.settingsWindow = sw
}

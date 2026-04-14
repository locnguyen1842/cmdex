package main

import (
	"embed"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

var appService *App

var settingsWindow *application.WebviewWindow

func CreateSettingsWindow(app *application.App) *application.WebviewWindow {
	if settingsWindow != nil {
		return settingsWindow
	}

	windowOptions := application.WebviewWindowOptions{
		Title: "Settings",
		// Width:  settings.WindowWidth,
		// Height: settings.WindowHeight,
		// MinWidth:            480,
		// MinHeight:           400,
		UseApplicationMenu:  false,
		BackgroundColour:    application.NewRGBA(15, 15, 20, 255),
		HideOnEscape:        true,
		DisableResize:       true,
		MinimiseButtonState: application.ButtonDisabled,
		MaximiseButtonState: application.ButtonDisabled,
		URL:                 "/?window=settings",
		Name:                "settings",
	}

	windowOptions.InitialPosition = application.WindowCentered

	settingsWindow = app.Window.NewWithOptions(windowOptions)

	settingsWindow.OnWindowEvent(events.Common.WindowHide, func(event *application.WindowEvent) {
		app.Event.Emit(eventNames.SettingsWindowClosing)
		settingsWindow.Close()

		settingsWindow = nil
	})

	settingsWindow.OnWindowEvent(events.Common.WindowClosing, func(event *application.WindowEvent) {
		app.Event.Emit(eventNames.SettingsWindowClosing)

		settingsWindow = nil
	})

	return settingsWindow
}

func ShowSettingsWindow() {
	app := application.Get()
	w := CreateSettingsWindow(app)
	w.Show()
	w.Focus()
}

func main() {
	appService = &App{}

	app := application.New(application.Options{
		Name: "Cmdex",
		Services: []application.Service{
			application.NewService(appService),
		},
		Assets: application.AssetOptions{
			Handler: application.BundledAssetFileServer(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	menu := app.NewMenu()

	cmdexMenu := menu.AddSubmenu("CmDex")
	cmdexMenu.AddRole(application.About)
	cmdexMenu.AddSeparator()
	cmdexMenu.Add("Settings...").SetAccelerator("CmdOrCtrl+,").OnClick(func(ctx *application.Context) {
		ShowSettingsWindow()
	})
	cmdexMenu.AddSeparator()
	cmdexMenu.AddRole(application.Hide)
	cmdexMenu.AddRole(application.HideOthers)
	cmdexMenu.AddSeparator()
	cmdexMenu.AddRole(application.Reload)
	cmdexMenu.AddRole(application.Quit)

	menu.AddRole(application.EditMenu)

	helpMenu := menu.AddSubmenu("Help")
	helpMenu.Add("Open Dev Tools").OnClick(func(ctx *application.Context) {
		app.Window.Current().OpenDevTools()
	})

	app.Menu.Set(menu)

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:              "Cmdex",
		Width:              1200,
		Height:             800,
		MinWidth:           900,
		MinHeight:          600,
		UseApplicationMenu: true,
		BackgroundColour:   application.NewRGBA(15, 15, 20, 255),
	})

	if err := app.Run(); err != nil {
		println("Error:", err.Error())
	}
}

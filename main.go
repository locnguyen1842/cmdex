package main

import (
	"embed"
	"fmt"
	goruntime "runtime"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

var settingsWindow *application.WebviewWindow
var appService *App

func GetOrCreateSettingsWindow(app *application.App) *application.WebviewWindow {
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
	}

	windowOptions.InitialPosition = application.WindowCentered

	settingsWindow = app.Window.NewWithOptions(windowOptions)

	settingsWindow.OnWindowEvent(events.Common.WindowClosing, func(event *application.WindowEvent) {
		app.Event.Emit(eventSettingsWindowHiding)
		settingsWindow.Hide()
	})

	return settingsWindow
}

func ShowSettingsWindow() {
	app := application.Get()
	w := GetOrCreateSettingsWindow(app)
	fmt.Printf("Showing settings window: %+v\n", w)
	w.Show()
	w.Focus()
}

func GetSettingsWindowState() (x, y, w, h int) {
	if settingsWindow == nil {
		return -1, -1, 640, 520
	}
	x, y = settingsWindow.Position()
	w, h = settingsWindow.Size()
	return
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
	if goruntime.GOOS == "darwin" {
		cmdexMenu := menu.AddSubmenu("Cmdex")
		cmdexMenu.AddRole(application.About)
		cmdexMenu.AddSeparator()

		cmdexMenu.Add("Settings...").SetAccelerator("CmdOrCtrl+,").OnClick(func(ctx *application.Context) {
			ShowSettingsWindow()
		})
		cmdexMenu.AddSeparator()

		cmdexMenu.Add("Hide Cmdex").SetAccelerator("CmdOrCtrl+h")
		cmdexMenu.Add("Hide Others").SetAccelerator("Alt+h")
		cmdexMenu.AddSeparator()

		cmdexMenu.Add("Quit Cmdex").SetAccelerator("CmdOrCtrl+q").OnClick(func(ctx *application.Context) {
			app.Quit()
		})
		menu.AddRole(application.EditMenu)
	} else {
		fileMenu := menu.AddSubmenu("File")
		fileMenu.Add("Settings").SetAccelerator("CmdOrCtrl+,").OnClick(func(ctx *application.Context) {
			ShowSettingsWindow()
		})
		fileMenu.AddSeparator()
		fileMenu.Add("Quit").SetAccelerator("CmdOrCtrl+q").OnClick(func(ctx *application.Context) {
			app.Quit()
		})
	}
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

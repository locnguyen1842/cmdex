package main

import (
	"embed"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

var (
	settingsWindowMu sync.Mutex
	settingsWindow   *application.WebviewWindow
)

// CreateSettingsWindow returns (and caches) a singleton settings window, sets up
// options (title, URL, initial position), wires WindowClosing to emit
// eventNames.SettingsWindowClosing and clear the cached settingsWindow under settingsWindowMu.
func CreateSettingsWindow(app *application.App) *application.WebviewWindow {
	settingsWindowMu.Lock()
	defer settingsWindowMu.Unlock()
	if settingsWindow != nil {
		return settingsWindow
	}

	windowOptions := application.WebviewWindowOptions{
		Title:               "Settings",
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

	sw := app.Window.NewWithOptions(windowOptions)

	sw.OnWindowEvent(events.Common.WindowHide, func(event *application.WindowEvent) {
	})

	sw.OnWindowEvent(events.Common.WindowClosing, func(event *application.WindowEvent) {
		app.Event.Emit(eventNames.SettingsWindowClosing)
		settingsWindowMu.Lock()
		settingsWindow = nil
		settingsWindowMu.Unlock()
	})

	settingsWindow = sw
	return sw
}

// ShowSettingsWindow fetches the global application via application.Get(), returns
// the cached window or calls CreateSettingsWindow if nil, then calls Show() and
// Focus() on the window.
func ShowSettingsWindow() {
	app := application.Get()
	settingsWindowMu.Lock()
	if settingsWindow == nil {
		settingsWindow = CreateSettingsWindow(app)
	}
	w := settingsWindow
	settingsWindowMu.Unlock()
	if w != nil {
		w.Show()
		w.Focus()
	}
}

func main() {
	// App is registered as the main service; it initializes all sub-services in ServiceStartup.
	// Each sub-service is NOT independently registered to avoid duplicate method bindings.
	// The App facade forwards all calls to the appropriate service.
	appService := &App{}

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

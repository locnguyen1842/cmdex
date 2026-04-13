package main

import (
	"embed"
	goruntime "runtime"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
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
	if goruntime.GOOS == "darwin" {
		menu.AddRole(application.AppMenu)
		cmdexMenu := menu.AddSubmenu("Cmdex")
		cmdexMenu.Add("Preferences...").SetAccelerator("CmdOrCtrl+,").OnClick(func(ctx *application.Context) {
			app.Event.Emit("open-settings")
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
		fileMenu.Add("Preferences").SetAccelerator("CmdOrCtrl+,").OnClick(func(ctx *application.Context) {
			app.Event.Emit("open-settings")
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

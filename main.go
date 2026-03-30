package main

import (
	"embed"
	goruntime "runtime"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	appMenu := menu.NewMenu()

	if goruntime.GOOS == "darwin" {
		firstMenu := appMenu.AddSubmenu("Cmdex")
		firstMenu.AddText("About Cmdex", nil, nil)
		firstMenu.AddSeparator()
		firstMenu.AddText("Preferences…", keys.CmdOrCtrl(","), func(_ *menu.CallbackData) {
			wailsruntime.EventsEmit(app.ctx, "open-settings")
		})
		firstMenu.AddSeparator()
		firstMenu.AddText("Hide Cmdex", keys.CmdOrCtrl("h"), nil)
		firstMenu.AddText("Hide Others", keys.OptionOrAlt("h"), nil)
		firstMenu.AddSeparator()
		firstMenu.AddText("Quit Cmdex", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
			wailsruntime.Quit(app.ctx)
		})
		appMenu.Append(menu.EditMenu())
	} else {
		fileMenu := appMenu.AddSubmenu("File")
		fileMenu.AddText("Preferences", keys.CmdOrCtrl(","), func(_ *menu.CallbackData) {
			wailsruntime.EventsEmit(app.ctx, "open-settings")
		})
		fileMenu.AddSeparator()
		fileMenu.AddText("Quit", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
			wailsruntime.Quit(app.ctx)
		})
	}

	err := wails.Run(&options.App{
		Title:     "Cmdex",
		Width:     1200,
		Height:    800,
		MinWidth:  900,
		MinHeight: 600,
		Menu:      appMenu,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 15, G: 15, B: 20, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}

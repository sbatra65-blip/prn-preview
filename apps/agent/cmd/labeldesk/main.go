// LabelDesk for Windows: the LabelDesk designer in a native window (Wails + WebView2), with the
// Print Agent built in, so labels print straight to installed and network printers.
package main

import (
	"context"
	"embed"
	"encoding/json"
	"flag"
	"io/fs"
	"log"
	"os"
	"path/filepath"

	"github.com/sbatra65-blip/prn-preview/apps/agent/core"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed frontend
var frontend embed.FS

type winState struct {
	X, Y, W, H int
	Max        bool
}

func dataDir() string {
	d := os.Getenv("LOCALAPPDATA")
	if d == "" {
		d, _ = os.UserConfigDir()
	}
	return filepath.Join(d, "LabelDesk")
}

func statePath() string { return filepath.Join(dataDir(), "window.json") }

func loadState() winState {
	s := winState{W: 1400, H: 900}
	if b, err := os.ReadFile(statePath()); err == nil {
		_ = json.Unmarshal(b, &s)
	}
	if s.W < 900 || s.H < 600 {
		s.W, s.H = 1400, 900
	}
	return s
}

func main() {
	portable := flag.Bool("portable", false, "run from where it is, without installing")
	remove := flag.Bool("uninstall", false, "remove the Start-menu shortcut")
	flag.Parse()
	if *remove {
		core.Uninstall("LabelDesk")
		return
	}
	if !*portable && core.SelfInstall("LabelDesk", "LabelDesk.exe") {
		return
	}
	// Built-in Print Agent. If the stand-alone agent already runs, LabelDesk uses that one.
	if !core.Start(true) {
		log.Println("Print Agent already running; using it")
	}

	st := loadState()
	var ctx context.Context
	assets, _ := fs.Sub(frontend, "frontend")
	start := options.Normal
	if st.Max {
		start = options.Maximised
	}
	err := wails.Run(&options.App{
		Title:            "LabelDesk",
		Width:            st.W,
		Height:           st.H,
		MinWidth:         900,
		MinHeight:        600,
		WindowStartState: start,
		BackgroundColour: &options.RGBA{R: 17, G: 24, B: 39, A: 255},
		AssetServer:      &assetserver.Options{Assets: assets},
		EnableDefaultContextMenu: true,
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: "app.labeldesk.desktop",
			OnSecondInstanceLaunch: func(options.SecondInstanceData) {
				if ctx != nil {
					runtime.WindowUnminimise(ctx)
					runtime.WindowShow(ctx)
				}
			},
		},
		OnStartup: func(c context.Context) {
			ctx = c
			if st.W > 0 && (st.X != 0 || st.Y != 0) && !st.Max {
				runtime.WindowSetPosition(c, st.X, st.Y)
			}
		},
		OnBeforeClose: func(c context.Context) bool {
			s := winState{Max: runtime.WindowIsMaximised(c)}
			if s.Max {
				old := loadState()
				s.X, s.Y, s.W, s.H = old.X, old.Y, old.W, old.H
			} else {
				s.X, s.Y = runtime.WindowGetPosition(c)
				s.W, s.H = runtime.WindowGetSize(c)
			}
			_ = os.MkdirAll(dataDir(), 0o755)
			if b, err := json.Marshal(s); err == nil {
				_ = os.WriteFile(statePath(), b, 0o644)
			}
			return false
		},
		Windows: &windows.Options{
			WebviewUserDataPath: filepath.Join(dataDir(), "WebView"),
			Theme:               windows.Light,
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}

//go:build windows || linux

package main

import (
	_ "embed"
	"os"
	"runtime"

	"fyne.io/systray"
	"github.com/sbatra65-blip/prn-preview/apps/agent/core"
)

//go:embed res/icon.ico
var trayIcon []byte

func trayAvailable() bool {
	return runtime.GOOS == "windows" || os.Getenv("DBUS_SESSION_BUS_ADDRESS") != ""
}

func runTray() {
	systray.Run(func() {
		systray.SetIcon(trayIcon)
		systray.SetTitle("LabelDesk")
		systray.SetTooltip(core.AppName + " " + core.Version)
		open := systray.AddMenuItem("Open Print Agent", "Printers, phone printing and recent jobs")
		site := systray.AddMenuItem("Open LabelDesk", "https://labeldesk.app")
		systray.AddSeparator()
		auto := systray.AddMenuItemCheckbox("Start with Windows", "Start the agent when you sign in", core.AutoStartOn())
		if !core.AutoStartSupported() {
			auto.Hide()
		}
		systray.AddSeparator()
		quit := systray.AddMenuItem("Quit", "Stop the agent: LabelDesk can't print until it runs again")
		systray.SetOnTapped(func() { core.OpenURL(core.StatusURL()) })
		for {
			select {
			case <-open.ClickedCh:
				core.OpenURL(core.StatusURL())
			case <-site.ClickedCh:
				core.OpenURL("https://labeldesk.app")
			case <-auto.ClickedCh:
				want := !auto.Checked()
				if core.SetAutoStart(want) == nil {
					if want {
						auto.Check()
					} else {
						auto.Uncheck()
					}
				}
			case <-quit.ClickedCh:
				systray.Quit()
				return
			}
		}
	}, func() {})
}

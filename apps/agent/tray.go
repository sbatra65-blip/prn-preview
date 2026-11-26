//go:build windows || linux

package main

import (
	_ "embed"
	"os"
	"runtime"

	"fyne.io/systray"
)

//go:embed ui/icon.ico
var trayIcon []byte

func trayAvailable() bool {
	return runtime.GOOS == "windows" || os.Getenv("DBUS_SESSION_BUS_ADDRESS") != ""
}

func runTray() {
	systray.Run(func() {
		systray.SetIcon(trayIcon)
		systray.SetTitle("LabelDesk")
		systray.SetTooltip(AppName + " " + Version)
		open := systray.AddMenuItem("Open Print Agent", "Printers, phone printing and recent jobs")
		site := systray.AddMenuItem("Open LabelDesk", "https://labeldesk.app")
		systray.AddSeparator()
		auto := systray.AddMenuItemCheckbox("Start with Windows", "Start the agent when you sign in", autoStartOn())
		if !autoStartSupported() {
			auto.Hide()
		}
		systray.AddSeparator()
		quit := systray.AddMenuItem("Quit", "Stop the agent: LabelDesk can't print until it runs again")
		systray.SetOnTapped(func() { openURL(statusURL()) })
		for {
			select {
			case <-open.ClickedCh:
				openURL(statusURL())
			case <-site.ClickedCh:
				openURL("https://labeldesk.app")
			case <-auto.ClickedCh:
				want := !auto.Checked()
				if setAutoStart(want) == nil {
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

// LabelDesk Print Agent (stand-alone): tray program that keeps the print server running,
// starts with Windows and receives phone jobs even when LabelDesk is closed.
package main

import (
	"flag"

	"github.com/sbatra65-blip/prn-preview/apps/agent/core"
)

func main() {
	noTray := flag.Bool("notray", false, "run without the tray icon")
	background := flag.Bool("background", false, "started with the computer: do not open the status page")
	portable := flag.Bool("portable", false, "run from where it is, without installing")
	remove := flag.Bool("uninstall", false, "stop starting with the computer and remove the Start-menu shortcut")
	flag.Parse()
	if *remove {
		core.Uninstall(core.AppName)
		return
	}
	if !*background && !*portable && core.SelfInstall(core.AppName, "LabelDesk-Print-Agent.exe") {
		return
	}
	if !core.Start(false) { // already running: show it instead of starting twice
		if !*background {
			core.OpenURL(core.StatusURL())
		}
		return
	}
	if core.FirstRun() {
		if core.AutoStartSupported() {
			_ = core.SetAutoStart(true)
		}
		if !*background {
			core.OpenURL(core.StatusURL())
		}
	}
	if *noTray || !trayAvailable() {
		select {}
	}
	runTray()
}

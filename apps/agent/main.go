// LabelDesk Print Agent: a small program on the computer next to the printer.
// LabelDesk (website, Windows app) sends it labels over http://127.0.0.1:41951, and it prints them
// as printer commands (RAW) or as pictures through the printer driver, to installed printers or to
// network printers on port 9100. It can also act as a print station for phones, with no browser open.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"time"
)

const (
	Version = "1.0.0"
	Port    = 41951
	AppName = "LabelDesk Print Agent"
)

type NetPrinter struct {
	Name string `json:"name"`
	Host string `json:"host"`
	Port int    `json:"port"`
}

type Config struct {
	NetPrinters    []NetPrinter `json:"netPrinters"`
	StationToken   string       `json:"stationToken"`
	StationPrinter string       `json:"stationPrinter"`
	StationOn      bool         `json:"stationOn"`
	Server         string       `json:"server"`
	AutoStartSet   bool         `json:"autoStartSet"`
}

var (
	cfgMu sync.Mutex
	cfg   Config
	logMu sync.Mutex
	logs  []string
)

func cfgPath() string {
	d, err := os.UserConfigDir()
	if err != nil {
		d = "."
	}
	return filepath.Join(d, "LabelDesk Agent", "config.json")
}

func loadConfig() {
	cfgMu.Lock()
	defer cfgMu.Unlock()
	b, err := os.ReadFile(cfgPath())
	if err == nil {
		_ = json.Unmarshal(b, &cfg)
	}
	if cfg.Server == "" {
		cfg.Server = "https://labeldesk.app"
	}
}

// saveConfig writes the config; call with cfgMu held.
func saveConfig() {
	p := cfgPath()
	_ = os.MkdirAll(filepath.Dir(p), 0o700)
	b, _ := json.MarshalIndent(cfg, "", "  ")
	tmp := p + ".tmp"
	if os.WriteFile(tmp, b, 0o600) == nil {
		_ = os.Rename(tmp, p)
	}
}

func logf(format string, a ...any) {
	line := time.Now().Format("15:04:05") + " · " + fmt.Sprintf(format, a...)
	logMu.Lock()
	logs = append([]string{line}, logs...)
	if len(logs) > 100 {
		logs = logs[:100]
	}
	logMu.Unlock()
	log.Println(line)
}

func openURL(u string) {
	switch runtime.GOOS {
	case "windows":
		_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", u).Start()
	case "darwin":
		_ = exec.Command("open", u).Start()
	default:
		_ = exec.Command("xdg-open", u).Start()
	}
}

func statusURL() string { return fmt.Sprintf("http://127.0.0.1:%d/", Port) }

func main() {
	noTray := flag.Bool("notray", false, "run without the tray icon")
	background := flag.Bool("background", false, "started with the computer: do not open the status page")
	portable := flag.Bool("portable", false, "run from where it is, without installing")
	remove := flag.Bool("uninstall", false, "stop starting with the computer and remove the Start-menu shortcut")
	flag.Parse()
	if *remove {
		uninstall()
		return
	}
	if !*background && !*portable && selfInstall() {
		return
	}

	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", Port))
	if err != nil { // already running: show it instead of starting twice
		if !*background {
			openURL(statusURL())
		}
		return
	}
	loadConfig()
	cfgMu.Lock()
	first := !cfg.AutoStartSet
	if first && autoStartSupported() {
		if setAutoStart(true) == nil {
			cfg.AutoStartSet = true
			saveConfig()
		}
	}
	cfgMu.Unlock()

	srv := &http.Server{Handler: routes(), ReadHeaderTimeout: 10 * time.Second}
	go func() { log.Fatal(srv.Serve(ln)) }()
	go stationLoop()
	logf("%s %s started on %s", AppName, Version, statusURL())
	if first && !*background {
		openURL(statusURL())
	}
	if *noTray || !trayAvailable() {
		select {}
	}
	runTray()
}

// Package core is the LabelDesk Print Agent: a local print server on http://127.0.0.1:41951 that
// LabelDesk (website or Windows app) uses to print to installed and network printers, plus the
// phone print-station worker. It runs on its own (cmd/print-agent) or inside the Windows app (cmd/labeldesk).
package core

import (
	"encoding/json"
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
	Version = "1.1.0"
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
	host  = "agent" // "agent" (stand-alone) or "desktop" (inside the LabelDesk Windows app)
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
	if b, err := os.ReadFile(cfgPath()); err == nil {
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

func Logf(format string, a ...any) {
	line := time.Now().Format("15:04:05") + " · " + fmt.Sprintf(format, a...)
	logMu.Lock()
	logs = append([]string{line}, logs...)
	if len(logs) > 100 {
		logs = logs[:100]
	}
	logMu.Unlock()
	log.Println(line)
}

// OpenURL opens a web address in the normal browser (or a mail/phone app).
func OpenURL(u string) {
	switch runtime.GOOS {
	case "windows":
		_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", u).Start()
	case "darwin":
		_ = exec.Command("open", u).Start()
	default:
		_ = exec.Command("xdg-open", u).Start()
	}
}

func StatusURL() string { return fmt.Sprintf("http://127.0.0.1:%d/", Port) }

// Start runs the print server. It returns false when another copy (the stand-alone agent or the
// Windows app) already answers on the port; LabelDesk then simply uses that one.
func Start(asDesktop bool) bool {
	if asDesktop {
		host = "desktop"
	}
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", Port))
	if err != nil {
		return false
	}
	loadConfig()
	srv := &http.Server{Handler: routes(), ReadHeaderTimeout: 10 * time.Second}
	go func() { log.Println(srv.Serve(ln)) }()
	go stationLoop()
	Logf("%s %s started on %s (%s)", AppName, Version, StatusURL(), host)
	return true
}

// FirstRun reports (once) whether this is the first start, and records it.
func FirstRun() bool {
	cfgMu.Lock()
	defer cfgMu.Unlock()
	if cfg.AutoStartSet {
		return false
	}
	cfg.AutoStartSet = true
	saveConfig()
	return true
}

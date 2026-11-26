package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"
)

//go:embed ui/index.html
var uiFS embed.FS

// Websites allowed to print through the agent. Any other website is refused by the browser (CORS)
// and by the agent (Origin check), so a random web page can't send jobs to your printers.
var allowedOrigins = map[string]bool{
	"https://labeldesk.app":                  true,
	"https://www.labeldesk.app":              true,
	"https://labels.infinitesolutions.co.in": true,
}

var localOrigin = regexp.MustCompile(`^http://(127\.0\.0\.1|localhost)(:\d+)?$`)
var tokenRe = regexp.MustCompile(`^[A-Za-z0-9_-]{32,96}$`)

func originOK(o string) bool { return o == "" || allowedOrigins[o] || localOrigin.MatchString(o) }

func hostOK(h string) bool { // refuse DNS-rebinding tricks: only our own loopback names
	host, _, err := net.SplitHostPort(h)
	if err != nil {
		host = h
	}
	return host == "127.0.0.1" || host == "localhost" || host == "[::1]" || host == "::1"
}

type Printer struct {
	Name    string `json:"name"`
	Driver  string `json:"driver,omitempty"`
	Port    string `json:"port,omitempty"`
	Kind    string `json:"kind"` // "installed" or "network"
	Default bool   `json:"default,omitempty"`
}

type Job struct {
	Printer  string   `json:"printer"`
	Type     string   `json:"type"` // "raw" or "image"
	Data     []string `json:"data"` // base64: printer commands, or PNG pictures (one per page)
	Copies   int      `json:"copies"`
	WidthMM  float64  `json:"widthMm"`
	HeightMM float64  `json:"heightMm"`
	Title    string   `json:"title"`
}

func allPrinters() []Printer {
	ps, err := sysPrinters()
	if err != nil {
		logf("Could not list printers: %v", err)
	}
	cfgMu.Lock()
	for _, n := range cfg.NetPrinters {
		ps = append(ps, Printer{Name: n.Name, Port: fmt.Sprintf("%s:%d", n.Host, n.Port), Kind: "network"})
	}
	cfgMu.Unlock()
	return ps
}

func findNet(name string) (NetPrinter, bool) {
	cfgMu.Lock()
	defer cfgMu.Unlock()
	for _, n := range cfg.NetPrinters {
		if n.Name == name {
			return n, true
		}
	}
	return NetPrinter{}, false
}

func sendTCP(n NetPrinter, data []byte) error {
	c, err := net.DialTimeout("tcp", net.JoinHostPort(n.Host, strconv.Itoa(n.Port)), 6*time.Second)
	if err != nil {
		return fmt.Errorf("can't reach %s at %s:%d. Check it is on and on the same network", n.Name, n.Host, n.Port)
	}
	defer c.Close()
	_ = c.SetWriteDeadline(time.Now().Add(time.Duration(30+len(data)/50000) * time.Second))
	if _, err = c.Write(data); err != nil {
		return fmt.Errorf("%s stopped receiving: %v", n.Name, err)
	}
	return nil
}

func printJob(j Job) error {
	if j.Printer == "" {
		return errors.New("choose a printer")
	}
	if len(j.Data) == 0 {
		return errors.New("nothing to print")
	}
	if j.Copies < 1 {
		j.Copies = 1
	}
	if j.Copies > 9999 {
		return errors.New("too many copies in one job (9999 at most)")
	}
	if j.Title == "" {
		j.Title = "LabelDesk labels"
	}
	parts := make([][]byte, 0, len(j.Data))
	for _, d := range j.Data {
		b, err := base64.StdEncoding.DecodeString(d)
		if err != nil {
			return errors.New("the print data is damaged (not base64)")
		}
		parts = append(parts, b)
	}
	switch j.Type {
	case "raw":
		data := bytes.Repeat(bytes.Join(parts, nil), j.Copies)
		if n, ok := findNet(j.Printer); ok {
			return sendTCP(n, data)
		}
		return sysPrintRaw(j.Printer, data, j.Title)
	case "image":
		if _, ok := findNet(j.Printer); ok {
			return errors.New("network printers take printer commands only. Choose “Printer commands”, or print pictures through an installed printer")
		}
		if j.WidthMM <= 0 || j.HeightMM <= 0 || j.WidthMM > 2000 || j.HeightMM > 5000 {
			return errors.New("label size is missing or wrong")
		}
		return sysPrintImages(j.Printer, parts, j.WidthMM, j.HeightMM, j.Copies, j.Title)
	}
	return errors.New("unknown print type")
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, code int, err error) {
	writeJSON(w, code, map[string]string{"error": err.Error()})
}

func readBody(r *http.Request, v any) error {
	b, err := io.ReadAll(io.LimitReader(r.Body, 80<<20))
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

func guard(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		o := r.Header.Get("Origin")
		if !hostOK(r.Host) || !originOK(o) {
			http.Error(w, "Not allowed", http.StatusForbidden)
			return
		}
		if o != "" {
			w.Header().Set("Access-Control-Allow-Origin", o)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "content-type, x-labeldesk")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Max-Age", "600")
			if r.Header.Get("Access-Control-Request-Private-Network") == "true" {
				w.Header().Set("Access-Control-Allow-Private-Network", "true")
			}
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		// Changes need our custom header, which a plain HTML form on another site can't send.
		if r.Method != http.MethodGet && r.Header.Get("X-LabelDesk") != "1" {
			http.Error(w, "Missing X-LabelDesk header", http.StatusBadRequest)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func info() map[string]any {
	cfgMu.Lock()
	defer cfgMu.Unlock()
	return map[string]any{
		"name": AppName, "version": Version, "os": runtime.GOOS, "port": Port,
		"autoStart": autoStartOn(), "autoStartSupported": autoStartSupported(),
		"station": map[string]any{"paired": cfg.StationToken != "", "id": stationID(cfg.StationToken), "printer": cfg.StationPrinter, "on": cfg.StationOn,
			"lastSeen": stationSeen.Format(time.RFC3339), "error": stationErr},
	}
}

func routes() http.Handler {
	m := http.NewServeMux()
	m.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		b, _ := uiFS.ReadFile("ui/index.html")
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:")
		_, _ = w.Write(b)
	})
	m.HandleFunc("GET /v1/info", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, info()) })
	m.HandleFunc("GET /v1/printers", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, allPrinters()) })
	m.HandleFunc("GET /v1/log", func(w http.ResponseWriter, r *http.Request) {
		logMu.Lock()
		l := append([]string(nil), logs...)
		logMu.Unlock()
		writeJSON(w, 200, l)
	})
	m.HandleFunc("POST /v1/print", func(w http.ResponseWriter, r *http.Request) {
		var j Job
		if err := readBody(r, &j); err != nil {
			fail(w, 400, errors.New("the print job could not be read"))
			return
		}
		t0 := time.Now()
		if err := printJob(j); err != nil {
			logf("Failed: %s on %s: %v", j.Title, j.Printer, err)
			fail(w, 500, err)
			return
		}
		logf("Printed %s on %s (%s, %d cop%s) in %dms", j.Title, j.Printer, j.Type, max(1, j.Copies), map[bool]string{true: "y", false: "ies"}[max(1, j.Copies) == 1], time.Since(t0).Milliseconds())
		writeJSON(w, 200, map[string]any{"ok": true})
	})
	m.HandleFunc("POST /v1/network", func(w http.ResponseWriter, r *http.Request) {
		var n NetPrinter
		if err := readBody(r, &n); err != nil {
			fail(w, 400, err)
			return
		}
		n.Name, n.Host = strings.TrimSpace(n.Name), strings.TrimSpace(n.Host)
		if n.Port == 0 {
			n.Port = 9100
		}
		if n.Host == "" || len(n.Host) > 253 || strings.ContainsAny(n.Host, " /\\") || n.Port < 1 || n.Port > 65535 {
			fail(w, 400, errors.New("type the printer's IP address, for example 192.168.1.50"))
			return
		}
		if n.Name == "" {
			n.Name = "Network printer " + n.Host
		}
		if len(n.Name) > 80 {
			n.Name = n.Name[:80]
		}
		cfgMu.Lock()
		out := cfg.NetPrinters[:0]
		for _, x := range cfg.NetPrinters {
			if x.Name != n.Name {
				out = append(out, x)
			}
		}
		cfg.NetPrinters = append(out, n)
		saveConfig()
		cfgMu.Unlock()
		logf("Added network printer %s (%s:%d)", n.Name, n.Host, n.Port)
		writeJSON(w, 200, map[string]any{"ok": true})
	})
	m.HandleFunc("DELETE /v1/network", func(w http.ResponseWriter, r *http.Request) {
		name := r.URL.Query().Get("name")
		cfgMu.Lock()
		out := cfg.NetPrinters[:0]
		for _, x := range cfg.NetPrinters {
			if x.Name != name {
				out = append(out, x)
			}
		}
		cfg.NetPrinters = out
		saveConfig()
		cfgMu.Unlock()
		writeJSON(w, 200, map[string]any{"ok": true})
	})
	m.HandleFunc("POST /v1/station", func(w http.ResponseWriter, r *http.Request) {
		var s struct {
			Token   *string `json:"token"`
			Printer *string `json:"printer"`
			On      *bool   `json:"on"`
		}
		if err := readBody(r, &s); err != nil {
			fail(w, 400, err)
			return
		}
		cfgMu.Lock()
		if s.Token != nil {
			if *s.Token != "" && !tokenRe.MatchString(*s.Token) {
				cfgMu.Unlock()
				fail(w, 400, errors.New("bad pairing code"))
				return
			}
			cfg.StationToken = *s.Token
		}
		if s.Printer != nil {
			cfg.StationPrinter = *s.Printer
		}
		if s.On != nil {
			cfg.StationOn = *s.On
		}
		saveConfig()
		on, pr := cfg.StationOn, cfg.StationPrinter
		cfgMu.Unlock()
		stationKick()
		logf("Phone printing %s%s", map[bool]string{true: "on, printing on ", false: "off"}[on], map[bool]string{true: pr, false: ""}[on])
		writeJSON(w, 200, info())
	})
	m.HandleFunc("POST /v1/autostart", func(w http.ResponseWriter, r *http.Request) {
		var s struct{ On bool }
		if err := readBody(r, &s); err != nil {
			fail(w, 400, err)
			return
		}
		if err := setAutoStart(s.On); err != nil {
			fail(w, 500, err)
			return
		}
		writeJSON(w, 200, info())
	})
	return guard(m)
}

// stationID lets LabelDesk tell whether the agent uses this browser's pairing code, without revealing it.
func stationID(tok string) string {
	if tok == "" {
		return ""
	}
	h := sha256.Sum256([]byte("ld-agent:" + tok))
	return hex.EncodeToString(h[:6])
}

//go:build !windows

package core

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// macOS and Linux print through CUPS (lpstat / lp).
func sysPrinters() ([]Printer, error) {
	out, err := exec.Command("lpstat", "-e").Output()
	if err != nil {
		return nil, nil // no CUPS: only network printers
	}
	def := ""
	if d, err := exec.Command("lpstat", "-d").Output(); err == nil {
		if i := strings.LastIndex(string(d), ":"); i >= 0 {
			def = strings.TrimSpace(string(d)[i+1:])
		}
	}
	var ps []Printer
	for _, l := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if l = strings.TrimSpace(l); l != "" {
			ps = append(ps, Printer{Name: l, Kind: "installed", Default: l == def})
		}
	}
	return ps, nil
}

func sysPrintRaw(name string, data []byte, title string) error {
	cmd := exec.Command("lp", "-d", name, "-o", "raw", "-t", title)
	cmd.Stdin = bytes.NewReader(data)
	if out, err := cmd.CombinedOutput(); err != nil {
		return lpErr(name, out, err)
	}
	return nil
}

func sysPrintImages(name string, pngs [][]byte, wmm, hmm float64, copies int, title string) error {
	dir, err := os.MkdirTemp("", "ldagent")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)
	media := fmt.Sprintf("Custom.%.1fx%.1fmm", wmm, hmm)
	for i, p := range pngs {
		f := filepath.Join(dir, fmt.Sprintf("p%04d.png", i))
		if err := os.WriteFile(f, p, 0o600); err != nil {
			return err
		}
		out, err := exec.Command("lp", "-d", name, "-n", fmt.Sprint(copies), "-o", "media="+media, "-o", "fit-to-page", "-t", title, f).CombinedOutput()
		if err != nil {
			return lpErr(name, out, err)
		}
	}
	return nil
}

func lpErr(name string, out []byte, err error) error {
	if m := strings.TrimSpace(string(out)); m != "" {
		return fmt.Errorf("printer “%s”: %s", name, m)
	}
	return fmt.Errorf("printer “%s” not found on this computer (%v)", name, err)
}

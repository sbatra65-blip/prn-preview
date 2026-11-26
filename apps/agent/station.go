package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Print station: phones send jobs to labeldesk.app; the agent collects and prints them,
// so phones can print here even when no browser is open on this computer.
var (
	stationSeen time.Time
	stationErr  string
	kick        = make(chan struct{}, 1)
	client      = &http.Client{Timeout: 25 * time.Second}
)

func stationKick() {
	select {
	case kick <- struct{}{}:
	default:
	}
}

func queueCall(server, token, op string, body any, out any) error {
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", server+"/api/queue/"+op, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-LD", "1")
	req.Header.Set("X-Station", token)
	req.Header.Set("User-Agent", AppName+"/"+Version)
	res, err := client.Do(req)
	if err != nil {
		return errors.New("can't reach LabelDesk (check the internet)")
	}
	defer res.Body.Close()
	rb, _ := io.ReadAll(io.LimitReader(res.Body, 64<<20))
	if res.StatusCode != 200 {
		var e struct{ Error string }
		_ = json.Unmarshal(rb, &e)
		if e.Error == "" {
			e.Error = fmt.Sprintf("LabelDesk answered %d", res.StatusCode)
		}
		return errors.New(e.Error)
	}
	if out != nil {
		return json.Unmarshal(rb, out)
	}
	return nil
}

func stationLoop() {
	var lastHello time.Time
	var helloKey string // token and printer the last hello was for
	for {
		cfgMu.Lock()
		on, tok, pr, srv := cfg.StationOn, cfg.StationToken, cfg.StationPrinter, cfg.Server
		cfgMu.Unlock()
		wait := 4 * time.Second
		if on && tok != "" && pr != "" {
			err := func() error {
				if time.Since(lastHello) > 25*time.Second || helloKey != tok+"|"+pr {
					if err := queueCall(srv, tok, "hello", map[string]string{"name": pr + " (Print Agent)"}, nil); err != nil {
						return err
					}
					lastHello, helloKey = time.Now(), tok+"|"+pr
				}
				var res struct {
					Jobs []struct {
						ID, Title, Prn string
					}
				}
				if err := queueCall(srv, tok, "pull", map[string]string{}, &res); err != nil {
					return err
				}
				cfgMu.Lock()
				stationSeen = time.Now()
				cfgMu.Unlock()
				for _, j := range res.Jobs {
					_, err := base64.StdEncoding.DecodeString(j.Prn)
					if err == nil {
						err = printJob(Job{Printer: pr, Type: "raw", Data: []string{j.Prn}, Copies: 1, Title: j.Title})
					}
					done := map[string]any{"id": j.ID, "ok": err == nil}
					if err != nil {
						done["note"] = err.Error()
						logf("Phone job failed: %s: %v", j.Title, err)
					} else {
						logf("Printed phone job %s on %s", j.Title, pr)
					}
					_ = queueCall(srv, tok, "done", done, nil)
				}
				return nil
			}()
			cfgMu.Lock()
			prev := stationErr
			if err != nil {
				stationErr = err.Error()
				wait = 10 * time.Second
			} else {
				stationErr = ""
			}
			cfgMu.Unlock()
			if err != nil && prev != err.Error() {
				logf("Phone printing: %v", err)
			}
		} else {
			lastHello = time.Time{}
			wait = 30 * time.Second
		}
		select {
		case <-kick:
		case <-time.After(wait):
		}
	}
}

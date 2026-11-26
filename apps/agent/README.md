# LabelDesk Print Agent

A small program (Go, about 8 MB, no installer needed) for the computer next to the label printer. It replaces QZ Tray.

Layout: `core/` is the print server (shared), `cmd/print-agent/` the stand-alone tray program, `cmd/labeldesk/` the LabelDesk Windows app (Wails window + the same print server built in).

- **Direct printing:** LabelDesk (website or Windows app) finds it on `http://127.0.0.1:41951` and lists its printers in the print window.
  - *Printer commands* (TSPL, ZPL, EPL, DPL…) go RAW to installed printers through the Windows spooler, or straight to network printers on port 9100.
  - *Pictures / PDF mode* prints each label row as a picture through the printer driver, at the exact label size.
- **Network printers:** add a printer by IP address on the agent's page (tray icon → Open Print Agent).
- **Phone printing without a browser:** in LabelDesk choose File → Print more → Print station → *Let the Print Agent receive*. Phones that scan the QR code print here even when no browser is open.
- **Starts with Windows**, sits in the tray. First run copies itself to `%LOCALAPPDATA%\LabelDesk Print Agent` and adds a Start-menu shortcut (no admin rights).

## Security
- Listens on 127.0.0.1 only (not reachable from the network).
- Accepts browser requests only from labeldesk.app (and its own page); other websites are refused by Origin check and CORS. Host header is checked against DNS rebinding.
- Changes need the `X-LabelDesk: 1` header, which plain HTML forms can't send.
- Phone printing uses the same pairing code as the browser print station; the code is kept in the agent's config file in the user's profile.

## API (local)
| Method | Path | Body / result |
|---|---|---|
| GET | `/v1/info` | name, version, station status |
| GET | `/v1/printers` | `[{name, driver, port, kind: installed\|network, default}]` |
| POST | `/v1/print` | `{printer, type: "raw"\|"image", data: [base64…], copies, widthMm, heightMm, title}` |
| POST/DELETE | `/v1/network` | `{name, host, port}` / `?name=` |
| POST | `/v1/station` | `{token, printer, on}` |
| POST | `/v1/autostart` | `{on}` |

## Build
```bash
GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-s -w -H windowsgui" -o dist/LabelDesk-Print-Agent.exe ./cmd/print-agent
GOOS=windows GOARCH=amd64 go build -tags desktop,production -trimpath -ldflags "-s -w -H windowsgui" -o dist/LabelDesk.exe ./cmd/labeldesk
go build -o dist/labeldesk-agent ./cmd/print-agent        # macOS / Linux (prints through CUPS)
```
Flags: `-portable` (run without installing), `-notray`, `-background`, `-uninstall`.

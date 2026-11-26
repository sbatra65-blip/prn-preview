# LabelDesk apps

| App | Folder | Built with | Output |
|---|---|---|---|
| Android | `mobile/android` | Capacitor 8 (Java/Kotlin shell) | `.apk` to install, `.aab` for Google Play |
| iPhone / iPad | `mobile/ios` | Capacitor 8 (Swift/Xcode shell) | Simulator build; `.ipa` for TestFlight when Apple secrets are set |
| Windows | `agent/cmd/labeldesk` | Go + Wails (WebView2), Print Agent built in | `LabelDesk.exe` (~12 MB, installs itself, no admin). Download: https://labeldesk.app/download/LabelDesk.exe |
| Print Agent (Windows, also macOS/Linux) | `agent/cmd/print-agent` | Go | `LabelDesk-Print-Agent.exe`: direct printing, network printers, phone printing. Download: https://labeldesk.app/download/LabelDesk-Print-Agent.exe |

All three open **https://labeldesk.app** inside a native window, so every website update reaches the apps at once with no new app release. App-only additions:

- **Android / iPhone:** files the site downloads (.ldl, .prn, PDF, PNG) open the share sheet (save to Files/Drive, WhatsApp, print). Camera access for Picture to label. Friendly offline page.
- **Windows:** built-in Print Agent (direct printing to installed and network printers, no QZ Tray), remembers window size, other websites open in the browser, single window, offline page.

## Build in the cloud (no Mac or Windows PC needed)

GitHub → **Actions → Build apps → Run workflow**. Download results from the run's **Artifacts**. Secrets for signed store builds are listed at the top of `.github/workflows/apps.yml`.

## Build on your own computer

```bash
# Android (needs Android Studio or the Android SDK, JDK 21)
cd apps/mobile && npm ci && npx cap sync android && cd android && ./gradlew assembleDebug
# iPhone (needs a Mac with Xcode 16+)
cd apps/mobile && npm ci && npx cap sync ios && npx cap open ios
# Windows (from any OS; Go 1.24+)
cd apps/agent && GOOS=windows go build -tags desktop,production -ldflags "-s -w -H windowsgui" -o dist/LabelDesk.exe ./cmd/labeldesk
```

New app icons: replace `mobile/resources/icon-only.png` and `icon-foreground.png`, then `npm run assets`. Windows icon: `agent/icon.png` (256 × 256), added by go-winres in the workflow.

Release: raise `Version` in `agent/core/core.go`, `versionName` in `mobile/android/app/build.gradle` and `MARKETING_VERSION` in Xcode, then push a tag `app-v1.0.1`.

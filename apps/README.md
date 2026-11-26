# LabelDesk apps

| App | Folder | Built with | Output |
|---|---|---|---|
| Android | `mobile/android` | Capacitor 8 (Java/Kotlin shell) | `.apk` to install, `.aab` for Google Play |
| iPhone / iPad | `mobile/ios` | Capacitor 8 (Swift/Xcode shell) | Simulator build; `.ipa` for TestFlight when Apple secrets are set |
| Windows | `desktop` | Electron | `LabelDesk-Setup-x.y.z.exe` installer and a portable `.exe` |

All three open **https://labeldesk.app** inside a native window, so every website update reaches the apps at once with no new app release. App-only additions:

- **Android / iPhone:** files the site downloads (.ldl, .prn, PDF, PNG) open the share sheet (save to Files/Drive, WhatsApp, print). Camera access for Picture to label. Friendly offline page.
- **Windows:** remembers window size, Save-as dialog for every file, other websites open in the browser, single window, offline page. QZ Tray printing works as in Chrome.

## Build in the cloud (no Mac or Windows PC needed)

GitHub → **Actions → Build apps → Run workflow**. Download results from the run's **Artifacts**. Secrets for signed store builds are listed at the top of `.github/workflows/apps.yml`.

## Build on your own computer

```bash
# Android (needs Android Studio or the Android SDK, JDK 21)
cd apps/mobile && npm ci && npx cap sync android && cd android && ./gradlew assembleDebug
# iPhone (needs a Mac with Xcode 16+)
cd apps/mobile && npm ci && npx cap sync ios && npx cap open ios
# Windows (on Windows)
cd apps/desktop && npm ci && npx electron-builder --win nsis portable --x64
```

New app icons: replace `mobile/resources/icon-only.png` and `icon-foreground.png`, then `npm run assets`. Windows icon: `desktop/build/icon.png` (256 × 256).

Release: raise `version` in `desktop/package.json`, `versionName` in `mobile/android/app/build.gradle` and `MARKETING_VERSION` in Xcode, then push a tag `app-v1.0.1`.

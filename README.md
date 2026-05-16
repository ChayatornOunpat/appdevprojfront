# IseGrader Expo Frontend

Tablet-ready Expo/React Native version of the IseGrader UI.

## Run

```bash
pnpm install
pnpm start
```

The app uses Expo Router and supports web, Android, and iOS.

## Backend URL

Set the backend base URL when running on a physical tablet:

```bash
$env:EXPO_PUBLIC_API_BASE_URL = "http://YOUR_COMPUTER_LAN_IP:5029"
pnpm start -- --host lan
```

Defaults:

- Android emulator: `http://10.0.2.2:5029`
- Web and iOS simulator: `http://localhost:5029`

## Editor

The code editor runs in a WebView on native platforms and an iframe on web. It loads Monaco and Pyodide from CDNs, so the device needs network access when opening the editor.

## Checks

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm exec expo export --platform web
pnpm exec expo export --platform android
```

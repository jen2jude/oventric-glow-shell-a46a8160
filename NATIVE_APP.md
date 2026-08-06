# Shipping Oventric to the App Store and Play Store

The native apps are thin Capacitor shells around the same web app. All product
code stays in this project — the shells just wrap it.

Everything below runs **on your own machine** (not inside Lovable):
iOS builds need a Mac with Xcode, Android needs Android Studio + JDK 17.

## 1. Get the code locally

1. Export the project to GitHub from Lovable (top-right → GitHub).
2. `git clone <your repo> && cd <repo>`
3. `npm install` (or `bun install`)

## 2. Add the native platforms (once)

```bash
npm run build            # produces dist/client
npx cap add ios
npx cap add android
npx cap sync
```

`ios/` and `android/` are generated locally and are not tracked here.

## 3. Run on a device / simulator

```bash
npx cap open ios         # opens Xcode
npx cap open android     # opens Android Studio
```

Point the shell at a local dev server while developing:

```bash
CAP_SERVER_URL=http://192.168.1.20:8080 npx cap sync && npx cap open ios
```

By default the shell loads `https://www.oventric.com`, so shipping a web
update instantly updates both apps without a store review.

## 4. App icons and splash screens

Put a 1024×1024 icon at `resources/icon.png` and a 2732×2732 splash at
`resources/splash.png`, then:

```bash
npx @capacitor/assets generate --iconBackgroundColor '#121214' --splashBackgroundColor '#121214'
```

## 5. Store submission

**iOS** — in Xcode: set the team/bundle id (`com.oventric.app`), bump the
version, `Product → Archive`, then upload to App Store Connect.

**Android** — in Android Studio: `Build → Generate Signed Bundle (AAB)`, keep
the keystore safe, then upload to the Play Console.

Store review notes worth pre-empting:

- Both stores require a working account deletion path and a published privacy
  policy URL (`/privacy` already exists).
- Apple requires digital goods sold inside the app to use in-app purchase.
  Physical goods and services are fine with the existing card flows.

## 6. What the shell adds

`src/lib/native/capacitor.ts` wires native status bar styling, keyboard resize,
the Android hardware back button, splash-screen hide, native haptics and the
native share sheet. All of it no-ops in a normal browser, so the web app is
unchanged.

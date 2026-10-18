# ALL FOR ONE

One search across every UK second-hand site: eBay, Vinted, Facebook Marketplace, Gumtree and more.

## Get the Android app

Every push to `main` builds a fresh APK automatically.

1. Open this repo's **Releases** page.
2. Tap the newest build and download `ALL-FOR-ONE.apk` on your Android phone.
3. Open it. If Android asks, allow installs from your browser, then tap **Install**.

## Where things live

- `www/index.html` – the app itself (edit this to change the app)
- `android/` – the Android wrapper, made with Capacitor
- `.github/workflows/android.yml` – builds the APK on GitHub
- `tools/make_icons.py` – draws the app icon and splash screen

## Notes

- This is a test build (debug-signed). The Play Store needs a signed release build.
- AI price estimates only work inside Claude for now; the app shows "on site" instead.
- The Pro plan is a demo. No payments are taken.

# ALL FOR ONE

Never overpay. Never miss a deal.

- **Search** every UK second-hand site at once
- **Price check** any listing: great deal, fair, or overpriced
- **Deal alerts** for what you're hunting
- **Flip** calculator: profit after fees

## Get the Android app

Every push to `main` builds a fresh APK automatically.

1. Open this repo's **Releases** page.
2. Tap the newest build and download `ALL-FOR-ONE.apk` on your Android phone.
3. Open it. If Android asks, allow installs from your browser, then tap **Install**.

## Where things live

- `www/index.html` – the app itself (built by `tools/build_www.py` from the app page)
- `api/estimate.js` – the price service (runs on Vercel, needs `ANTHROPIC_API_KEY`)
- `android/` – the Android wrapper, made with Capacitor
- `.github/workflows/android.yml` – builds the APK on GitHub
- `tools/make_icons.py` – draws the app icon and splash screen

## Notes

- This is a test build (debug-signed). The Play Store needs a signed release build.
- Price checks go live once the price service is deployed on Vercel and `API_URL` is set in the app.
- The Pro plan is a demo. No payments are taken.

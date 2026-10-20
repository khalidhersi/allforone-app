# ALL FOR ONE

Never overpay. Never miss a deal.

- **Search** every UK second-hand site at once
- **Price check** any listing: great deal, fair, or overpriced
- **Deal alerts** for what you're hunting
- **Flip** calculator: profit after fees
- **Accounts** with free daily limits and a Pro subscription (Stripe)
- **Admin panel** for the owner

## Get the Android app

Every push to `main` builds an optimised release APK, tests it on an Android 14 emulator (start time, idle CPU, memory, crashes) and only then publishes it. Open this repo's **Releases** page, download `ALL-FOR-ONE.apk` on your phone and install it. Each release note shows the before/after measurements.

New versions install over the old one (same signing key, higher version number).

## Put the server live (Vercel)

1. **Import the repo:** Vercel → Add New → Project → `allforone-app` → Deploy.
2. **Add the database:** project → Storage → Create → **Upstash for Redis** (free) → connect it to this project → Redeploy.
3. **Make your admin account:** open the app and sign up. **The first account ever created is the owner (admin).**

The app expects the server at `https://allforone-app.vercel.app`. If Vercel gives a different address, change `API_URL` in the app (or tap **Change** under the login error to point a test phone at it).

### Optional settings (Vercel → Settings → Environment Variables)

| Name | What it does |
| --- | --- |
| `ANTHROPIC_API_KEY` | Turns on price estimates and price-check verdicts |
| `STRIPE_SECRET_KEY` | Your Stripe secret key (`sk_live_…` or `sk_test_…`) |
| `STRIPE_PRICE_MONTH` | Stripe price ID for £4.99/month |
| `STRIPE_PRICE_YEAR` | Stripe price ID for £29.99/year |
| `ADMIN_EMAILS` | Extra admin emails, comma separated (optional) |
| `APP_URL` | Your site address, if you add a custom domain |

**Stripe webhook:** in Stripe → Developers → Webhooks, add `https://<your-site>/api/stripe` and send `checkout.session.completed` and `customer.subscription.*` events. Also save the default Customer portal settings once, so "Manage subscription" works.

## How the paywall works

- Free accounts get 3 searches, 3 price checks and 1 deal alert. The server counts these, so the app can't be tricked.
- Pro needs Stripe Checkout. The 7-day free trial asks for a card, and Pro only switches on when Stripe confirms it. One trial per account.
- Admins can give someone free Pro, reset their usage, reset their password, sign them out or delete them.
- Admins can switch on **Test as a free user** to see the limits and paywall.

## Where things live

- `www/index.html` – the app (built by `tools/build_www.py` from the app page)
- `www/paid.html` – the page people see after paying
- `api/` – server functions: `auth`, `estimate`, `alerts`, `billing`, `stripe` (webhook), `admin`
- `lib/core.js` – shared server code: database, passwords, sessions, limits, Stripe
- `tools/dev_server.js` – run everything locally with a test database: `node tools/dev_server.js`
- `tools/test_server.js` – server tests: `node tools/test_server.js`
- `.github/workflows/android.yml` – builds the APK on GitHub

## Notes

- APKs are signed with the test key in `android/keystore` (see the README there). For the Play Store, turn on Play App Signing. Google also requires its own billing for subscriptions sold inside Play Store apps.
- Vercel's free Hobby plan is for non-commercial use. Move to Vercel Pro once you start charging.

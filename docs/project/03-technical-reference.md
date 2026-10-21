# ALL FOR ONE: Technical reference

Last updated: 21 October 2026 (build 9, app version 0.7)

## Repo layout (`khalidhersi/allforone-app`)
| Path | What it is |
| --- | --- |
| `src/app.html` | **The app's source.** One page with its HTML, CSS and JavaScript. Edit this one. |
| `tools/build_www.py` | Builds `www/index.html` from `src/app.html`: adds the page wrapper, the bundled font and Android safe-area support, and removes the Google Fonts link |
| `www/` | What ships: `index.html` (built), `paid.html` (after Stripe), `manifest.webmanifest`, `sw.js` (offline cache, web only), `icons/`, `fonts/manrope.woff2` |
| `api/` | Vercel serverless functions: `auth`, `estimate`, `alerts`, `billing`, `stripe` (webhook), `admin` |
| `lib/core.js` | Shared server code: responses, database, passwords, sessions, limits, alerts, Stripe |
| `android/` | Capacitor 8 Android project. `app/src/main/java/com/allforone/app/MainActivity.java` handles the web view process stopping |
| `android/keystore/` | Test signing key and its password file. Private repo only |
| `.github/workflows/android.yml` | Builds, checks, emulator-tests and publishes the APK |
| `tools/` | `dev_server.js` (local server with in-memory DB), `test_server.js` (57 checks), `e2e_test.py` (40 phone checks), `perf_test.py` (idle work), `android_smoke.sh`, `apk_check.sh`, `check_links.sh`, `make_icons.py` |
| `docs/project/` | Copies of these Project files |

## Everyday commands
```bash
python3 tools/build_www.py src/app.html   # after editing the app
npx cap sync android                      # copy www/ into the Android project
node tools/test_server.js                 # server tests (Node 22+)
python3 tools/e2e_test.py                 # app click-through (needs Playwright)
python3 tools/perf_test.py                # idle work per screen
node tools/dev_server.js                  # run locally on :8787 with a test DB
```
After pushing to `main`, GitHub builds the APK, which takes about 8–10 minutes.

## App (front end)
- Plain HTML, CSS and JavaScript. No framework and no bundler.
- **Server address:** `API_URL` near the top of the script, currently `https://allforone-app.vercel.app`.
  - Android uses `API_URL`.
  - The website uses its own address.
  - Inside Claude, it runs a **preview stand-in server** using browser storage, so the artifact works with no backend.
- **Data stored on the phone:** `afo.token`, `afo.session`, `afo.mode`, `afo.last`, `afo.flip`, `afo.server` (address override).
- Every network call **times out after 15 seconds**.
- Account re-check when the app comes back is limited to once a minute, except while waiting for payment.
- **Android back button:** handled by `@capacitor/app`. It closes the open sheet, then goes to the Search tab, then clears results, then minimises the app.
- **No infinite animations.** Loading placeholders are still. This is deliberate, to save battery.
- The login error shows a "Server: … Change" link so a test phone can point at another server.

## Server API (Vercel functions; `?a=` picks the action)
| Endpoint | Action |
| --- | --- |
| `GET /api/auth?a=ping` | Health check |
| `POST /api/auth?a=signup` / `login` | Returns `{token, user, usage, limits}`. The first account becomes the owner |
| `GET /api/auth?a=me` | Current user, usage and limits |
| `POST /api/auth?a=logout` / `password` / `delete` | Log out, change password (`{current,next}`), delete account (`{password}`) |
| `POST /api/estimate` | `{q, cat, sites, kind: search\|check\|alert}`. Counts usage (402 when over the limit), then gives an AI price estimate (cached 24 h) |
| `GET /api/alerts` | List alerts. `POST ?a=add` / `remove` / `checked` |
| `POST /api/billing?a=checkout` | Stripe Checkout link (`{plan: month\|year}`). `?a=portal` is the billing portal |
| `POST /api/stripe` | Stripe webhook. Each event is re-fetched from Stripe by ID, so fake events don't work |
| `GET /api/admin?a=health` / `users&q=` | Admin only |
| `POST /api/admin?a=user` | `{id, action}`: `grant_pro`, `revoke_pro`, `reset_usage`, `signout`, `reset_password`, `make_admin`, `remove_admin`, `test_free` (self only), `delete` |

Logged-in calls send `Authorization: Bearer <token>`. CORS is open (`*`) for the Android app.

## Database (Upstash Redis keys)
- **Accounts:**
  - `user:<id>`: user JSON. Password is scrypt-hashed. Also holds role, compPro, subStatus, stripeCustomer, trialUsed, debugFree
  - `email:<email>` → id
  - `users`: sorted set by sign-up time
  - `owner`: id of the first account
- **Sessions:** `sess:<token>` → id (30 days); `sessions:<id>` is the set of that user's tokens
- **Usage and stats:**
  - `usage:<id>:<YYYY-MM-DD>`: hash of search and check counts
  - `stats:<date>`: sign-ups, searches, checks
- **Other:**
  - `alerts:<id>`: JSON list
  - `cust:<stripeCustomerId>` → id
  - `est:<sha1>`: cached estimate
  - `rl:<key>`: rate limits (login 10 per 15 min per email and 60 per network; sign-up 20 per hour per network)

## Environment variables (Vercel)
| Name | Needed for |
| --- | --- |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`) | Database (added by the Upstash integration) |
| `ANTHROPIC_API_KEY` (optional `PRICE_MODEL`, default `claude-haiku-5-5`) | Price estimates and verdicts |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTH`, `STRIPE_PRICE_YEAR` | Payments |
| `ADMIN_EMAILS` | Extra admins (optional) |
| `APP_URL` | Return address after payment, if using a custom domain |

Stripe webhook URL: `https://<site>/api/stripe`. Send `checkout.session.completed` and `customer.subscription.*`. Save the Customer portal settings once.

## Android build
- **App:** id `com.allforone.app`, minSdk 24 (Android 7), target 36, internet permission only, `allowBackup=false`.
- **Build:** release build with R8 shrinking. Signed with `android/keystore/allforone-test.jks`, or GitHub secrets `ANDROID_KEYSTORE_B64` and `ANDROID_KEYSTORE_PASSWORD` if set.
- **Versions:** `versionCode` = the GitHub run number, so updates install over each other.
- **Release report:** each release has `ALL-FOR-ONE.apk`, `smoke-report.txt` (signature, links, before/after numbers, stability tests), `smoke-screen.png` and `smoke-logcat.txt`.
- **Build 9 numbers:** 891 KB, opens in about 1.0 s, 0.10% idle CPU, 62 MB. No crashes when the web view stops, on back, or in the background.

## Gotchas learned the hard way
- **Endless CSS animations** made the phone redraw about 60 times a second, which drained the battery. Keep placeholders still.
- **Debug builds** were 3.9 MB and slow. Always ship release builds.
- **Web view stopping:** Android can kill the web view process, especially in the background. Without `onRenderProcessGone` in `MainActivity`, the whole app crashes.
- **Back button:** without `@capacitor/app`, back quits the app.
- **Sideways scroll:** a flex `input` without `width:0;min-width:0` pushed the page wider than the phone.
- **Signing key:** builds before build 6 used a different key, so they must be uninstalled once.
- **GitHub from a Claude session:**
  - Actions logs and GraphQL are blocked, so use REST (`gh api …`) and release assets.
  - Setting secrets is blocked.
- **Vercel connector:** returned 403 on the team scope. Fixing it needs reconnecting with "khalidhersi's projects" allowed.
- **Marketplace links:** Gumtree and Vinted are confirmed. eBay, Facebook, Depop, Back Market and AutoTrader block automatic checks, and Preloved is unconfirmed.
- **Google sideloading verification:** enforced in Brazil, Indonesia, Singapore and Thailand from 30 September 2026, and globally in 2027. Plan to register as a developer before then.

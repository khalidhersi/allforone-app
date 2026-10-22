# ALL FOR ONE: Changelog

Each GitHub build is a release (`build-N`) with its test report. Newest first.

| Build | Date | What changed |
| --- | --- | --- |
| 11 | 22 Oct 2026 | Version 0.8. Login and paywall switched off for now (`ACCOUNTS_ON = false` in `src/app.html`). The app opens straight in, everything unlocked, alerts saved on the phone. Price estimates are off until the server is live. |
| 10 | 21 Oct 2026 | No app changes. Added the app source, test scripts and these Project files to the repo. Docs-only changes no longer trigger a build. |
| 9 | 21 Oct 2026 | No more crash when Android stops the web view (on back, in the background or while open). Emulator stability tests added. |
| 8 | 20 Oct 2026 | Extra build checks: crash log after the back button, page titles in the link check. |
| 7 | 20 Oct 2026 | Audit fixes: back button handled, phone backups off, honest paywall wording, verdicts labelled as estimates, stricter email check, per-network login limit, safe payment return link, better contrast and bigger buttons. APK signature, update-over-old and link checks added to every build. |
| 6 | 20 Oct 2026 | Performance: release build (3.9 MB → 0.9 MB, opens about 5x faster), still placeholders instead of endless animations, 15-second timeouts, font built in, permanent signing key. Emulator test before publishing. |
| 5 | 19 Oct 2026 | Accounts (sign up, log in, sessions), Stripe paywall (trial needs a card), server-enforced limits, admin panel, alerts saved on the server. |
| 4 | 18 Oct 2026 | Rebuilt around price check, deal alerts and flip. First-open choice between bargains and flipping. Pro at £4.99 / £29.99. |
| 3 | 18 Oct 2026 | Fixed sideways scrolling, more app-like feel. |
| 2 | 18 Oct 2026 | First Android APK built on GitHub (debug build). |

## Before the Android app (artifact versions in Claude)
- **v1** (18 Oct): "Rummage" multi-site search page.
- **v2:** calm redesign, price next to Open, Pro paywall demo.
- **v3:** renamed ALL FOR ONE.

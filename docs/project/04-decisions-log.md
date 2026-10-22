# ALL FOR ONE: Decisions log

Newest at the bottom. Add a line whenever something is decided, with the reason.

| Date | Decision | Why |
| --- | --- | --- |
| 18 Oct 2026 | Build a "search every second-hand site at once" app, UK first | Khalid's idea. No good UK tool covers every site and category |
| 18 Oct 2026 | Open each site's own live search, don't scrape | Facebook, Vinted and Depop have no public API and ban scraping |
| 18 Oct 2026 | Calm, low-stimulation, phone-first design | Audience is 18–36 with short attention spans. Khalid found v1 overstimulating |
| 18 Oct 2026 | Colour meanings: navy trust, blue action, green savings, gold Pro | Colour psychology for trust and repeat use |
| 18 Oct 2026 | Name **ALL FOR ONE**, in capitals | Khalid's choice. Fits "one search, every site" |
| 18 Oct 2026 | Market on TikTok with AI ads (Higgsfield), £0 → £100 → £200 budgets | Cheapest reach for 18–36s. Plan is in the marketing Doc |
| 18 Oct 2026 | Android app via Capacitor, built on GitHub Actions | No Android tools in Claude's workspace. GitHub builds for free |
| 18 Oct 2026 | Reshape around **price check, deal alerts and flip**, for both bargain hunters and flippers | A plain search engine isn't worth paying for. Khalid chose both audiences |
| 18 Oct 2026 | Pro price £4.99/month or £29.99/year (was £3.99 / £24.99) | Stronger value story: one good deal covers months |
| 19 Oct 2026 | Accounts and a real paywall: Stripe Checkout, trial needs a card, limits enforced by the server | Khalid: "just clicking free trial gives them full access" |
| 19 Oct 2026 | First account on the server becomes the owner (admin) | Gives Khalid an admin account without sharing passwords in chat |
| 19 Oct 2026 | Server on Vercel functions plus Upstash Redis | Khalid already uses Vercel, and both are free to start |
| 19 Oct 2026 | Admin "test as a free user" switch | Khalid wanted an admin account to debug the paywall |
| 20 Oct 2026 | Release builds only, with a permanent signing key and the run number as version | Battery and speed. Updates install over each other |
| 20 Oct 2026 | No endless animations; 15-second timeout on all requests | Khalid reported slowdown and battery drain |
| 20 Oct 2026 | Every build is emulator-tested before it's published | Khalid can't debug builds himself |
| 20 Oct 2026 | Paywall wording: alerts "coming soon", fair use noted; verdicts say "estimate" | Honesty: no notifications or live prices yet |
| 21 Oct 2026 | Handle the web view process stopping (restart or close, never crash) | The audit found a crash on back/background |
| 21 Oct 2026 | App source in `src/app.html` plus Project files in `docs/project/` | Keeps future chats accurate |
- **22 Oct 2026: login and paywall switched off for now.** Khalid isn't ready to sell yet. One switch (`ACCOUNTS_ON` in `src/app.html`) turns them back on. All the server, Stripe and admin code stays in place.

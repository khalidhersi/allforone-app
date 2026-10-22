# ALL FOR ONE: Status and roadmap

Last updated: 22 October 2026

## Where things stand
- **App:** build 11, version 0.8.
- **Login is switched off** (22 Oct, Khalid's choice) until he's ready to sell. The app opens straight in with everything unlocked. Alerts are saved on the phone only. No price estimates without the server.
- **To sell:** set `ACCOUNTS_ON = true` in `src/app.html`, put the server live, then rebuild.
- **Khalid's phone:** the app wouldn't install. Most likely the old test build is still installed and needs uninstalling once.

## Needs Khalid (in this order)
- [ ] Uninstall the old ALL FOR ONE, then install build 9 from the repo's Releases.
- [ ] **Deploy the server:** Vercel → Add New → Project → `allforone-app` → Deploy.
- [ ] **Add the database:** Vercel project → Storage → Create → Upstash for Redis → connect → Redeploy.
- [ ] **Send Claude the site address.** If it isn't `allforone-app.vercel.app`, Claude updates `API_URL` and rebuilds.
- [ ] Sign up first in the app to become the admin.
- [ ] Add `ANTHROPIC_API_KEY` in Vercel to turn on price estimates and verdicts.
- [ ] **Stripe:** create an account and two prices (£4.99/month, £29.99/year), add the keys and webhook in Vercel, and save the Customer portal settings.
- [ ] Privacy policy and terms. Claude can draft them.
- [ ] ICO data protection fee: £52 a year (£47 by direct debit).
- [ ] Check "ALL FOR ONE" on the UK trademark register. Pick a domain and social handles (`@allforone.app` or `@allforoneuk`).
- [ ] Move to Vercel Pro before charging (the free plan is non-commercial).
- [ ] Check each marketplace link once by hand on the phone, especially Preloved.

## Next to build (Claude)
1. **Email:** password reset and sign-up email checks, through Resend or similar. This also stops free-account farming.
2. **Alert notifications:** check saved alerts on a schedule and send a push or email for new matches. This is the main reason people will pay.
3. **Live eBay prices** through eBay's official Browse API. These replace AI estimates for eBay and improve price checks.
4. **Waitlist page** on the Vercel site, for TikTok traffic before launch.
5. **Privacy and terms pages** in the app and on the site.

## Later
- Play Store release: Google developer account, Play App Signing, and Google Play Billing for in-app subscriptions.
- Register as a verified Android developer before Google's global sideloading rules in 2027.
- Move the signing key from the repo into GitHub Secrets.
- Affiliate income (eBay Partner Network). A Pro+ tier around £6.99 once instant alerts exist.
- Update the Capacitor build tool. It has 3 moderate warnings in its iOS parts, which don't affect Android or the server.

## Open questions for Khalid
- Final domain and social handles?
- Launch with Stripe on the website first, or wait for the Play Store?
- Lead the marketing with bargain hunters, flippers, or both?

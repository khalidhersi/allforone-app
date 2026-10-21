# ALL FOR ONE: Context

Last updated: 21 October 2026

## In one line
A UK app that searches every second-hand marketplace at once, tells you whether a price is fair, alerts you to deals and shows flip profit after fees.

## Who it's for
- UK adults aged 18–36 who buy and sell second-hand: trainers, clothes, tech, consoles, cars and furniture.
- **Two audiences.** You pick one when you first open the app, and can switch any time.
  - **Bargain hunters:** "Find bargains, pay less for things you want."
  - **Flippers (resellers):** "Flip for profit, buy low, sell high."
- They use Vinted, Depop, eBay, Facebook Marketplace and Gumtree. They have short attention spans and dislike busy screens.

## Why people pay
- A search shortcut alone isn't worth paying for. That was the lesson from the first version.
- People pay for **speed** (deal alerts), **certainty** (is this a fair price or a scam?) and **profit** (flip maths).
- **Free hook:** the price check. **Paid value:** unlimited checks and searches, plus more alerts.

## Features (version 0.7, build 9)
| Feature | What it does | Status |
| --- | --- | --- |
| Search | One search box that understands "PS5 under £300 near Leeds". Opens each site's own live results with filters set. Shows an estimated price per site and the likely cheapest. | Working; prices need the AI key |
| Price check | Paste a listing link or type the item and price. Says Great deal, Fair, Overpriced or Too good to be true, with scam checks. | Working; verdicts need the AI key |
| Deal alerts | Saves what you're hunting with a max price and area. One tap shows the newest listings. | Saved on the server; no phone notifications yet |
| Flip | Buy and sell price plus platform give profit, return %, fees and break-even. | Working |
| Accounts | Sign up and log in. Account sheet, change password, delete account. | Working (needs the server live) |
| Pro paywall | Stripe Checkout, 7-day trial with a card, one trial per account. | Built and tested with test data; needs Stripe keys |
| Admin panel | Server status, today's numbers, users, give or remove Pro, reset usage or password, sign out, delete, make admin, "test as a free user". | Working |

Marketplaces linked: eBay, Facebook Marketplace, Gumtree, Vinted, Depop, Preloved, CeX, Back Market, AutoTrader. Which ones show depends on the category (cars, tech, fashion, home or everything).

## Pricing
- **Free:** 3 searches, 3 price checks and 1 deal alert a day.
- **Pro:** £4.99/month or £29.99/year (shown as "Save 50%"). The 7-day free trial needs a card and is limited to one per account.
- **Pro fair use:** 300 searches, 150 checks and 30 alerts a day.
- **After Stripe fees** (UK cards 1.4% + 20p): about £4.72/month on monthly, about £2.45/month on yearly. A 50/50 mix is about £3.60 per subscriber per month, before VAT and tax.

## Brand
- **Name:** ALL FOR ONE, always in capitals. allforone.com is taken. Check the UK trademark register before spending on branding.
- **Taglines:** "Never overpay. Never miss a deal." and "One search. Every site."
- **Logo:** a blue price tag with a hole, on white.
- **Font:** Manrope, built into the app.
- **Colours:**
  - Navy `#0F1B2D` (text, trust)
  - Blue `#1D5BF2` (actions)
  - Green `#0E9F63` (savings)
  - Amber `#C26A00` (caution)
  - Gold `#F2B705` (Pro only)
  - Background `#F6F7F9`
  - Grey text `#5B697D`
  - There's a matching dark mode.
- **Style:** calm, minimal, one job per screen, very little text.

## Where things are
- **Code:** GitHub `khalidhersi/allforone-app` (private), branch `main`.
- **Android downloads:** the repo's Releases page. Each build has its test report.
- **App preview in Claude:** https://claude.ai/artifact/A3NeMyTtsMGw9zvCU3GAzh
- **Marketing plan (Doc):** https://claude.ai/code/artifact/ee049430-ef8f-45f1-a655-ce2785e38f4a
- **App audit (Doc):** https://claude.ai/code/artifact/8a52fabc-c1a6-4c78-bf3f-5b9efd6f1ae2
- **Server:** Vercel, expected at `https://allforone-app.vercel.app`. **Not deployed yet.**
- **Database:** Upstash Redis through Vercel. Not created yet.
- **Payments:** Stripe. Not set up yet.

## People and roles
- **Khalid:** owner. Makes the decisions, does the dashboard steps (Vercel, Stripe), and tests on his Android phone.
- **The first account created on the live server** becomes the owner (admin). Khalid should sign up first.

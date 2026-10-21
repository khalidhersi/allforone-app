"""Click-through test of the whole app on a simulated phone, against the local test server.
Usage: python3 tools/e2e_test.py   (needs Playwright and Node 22+; set NODE=/path/to/node if needed)"""
import json, os, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('OUT', '/tmp/afo-e2e'); os.makedirs(OUT, exist_ok=True)
PORT = 8791
BASE = f'http://localhost:{PORT}/'
OVER = """() => { const vw = document.documentElement.clientWidth; const bad = [];
  for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.width && cs.display !== 'none' && cs.visibility !== 'hidden' && (r.right > vw + 0.5 || r.left < -0.5)) bad.push(el.tagName + '#' + el.id + '.' + (typeof el.className === 'string' ? el.className : '') + ' R' + Math.round(r.right)); }
  return bad.slice(0, 5); }"""

srv = subprocess.Popen([os.environ.get('NODE', 'node'), 'tools/dev_server.js'], cwd=APP, env=dict(os.environ, PORT=str(PORT)), stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
for _ in range(50):
    try: urllib.request.urlopen(BASE + 'api/auth?a=ping'); break
    except Exception: time.sleep(0.1)

results, errors, overflow = [], [], {}
def ok(cond, msg):
    results.append(('PASS' if cond else 'FAIL') + ' ' + msg)
def over(pg, name):
    b = pg.evaluate(OVER)
    if b: overflow[name] = b
def toast(pg):
    pg.wait_for_selector('#toast:not([hidden])', timeout=4000); return pg.inner_text('#toast')

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 360, 'height': 780}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(BASE); pg.wait_for_timeout(300)
        ok(pg.is_visible('#auth') and pg.inner_text('#au-go') == 'Create free account', 'login screen first, sign-up mode')
        over(pg, 'auth'); pg.screenshot(path=f'{OUT}/e2e-auth.png')

        # owner signs up
        pg.fill('#au-email', 'owner@test.com'); pg.fill('#au-pw', 'short'); pg.click('#au-go'); pg.wait_for_timeout(300)
        ok('8 characters' in pg.inner_text('#au-err'), 'short password error shown')
        pg.fill('#au-pw', 'password123'); pg.click('#au-go')
        ok('admin' in toast(pg), 'first account told it is the admin')
        ok(pg.is_visible('#onboard'), 'mode choice after sign-up')
        pg.click('[data-mode="flip"]'); pg.wait_for_timeout(200)
        ok(pg.inner_text('#acct-btn') == 'O' and pg.inner_text('#pro-btn') == 'Pro', 'avatar and Pro badge')

        pg.click('#acct-btn'); pg.wait_for_timeout(200)
        ok(pg.inner_text('#ac-plan') == 'Pro · admin' and pg.is_visible('#ac-admin'), 'account shows Pro · admin and admin link')
        over(pg, 'account'); pg.screenshot(path=f'{OUT}/e2e-account.png')
        pg.click('#ac-admin'); pg.wait_for_selector('#ad-health .srow'); pg.wait_for_timeout(200)
        h = pg.inner_text('#ad-health')
        ok('Test database' in h and 'Add ANTHROPIC_API_KEY' in h and 'Add your Stripe keys' in h, 'admin server status')
        ok('1 user' in pg.inner_text('#ad-count'), 'admin user count')
        over(pg, 'admin'); pg.screenshot(path=f'{OUT}/e2e-admin.png', full_page=True)

        # test as a free user: 3 searches then paywall, and the trial button does not unlock Pro
        pg.click('#ad-free'); toast(pg); pg.wait_for_timeout(300)
        ok(pg.get_attribute('#ad-free', 'aria-checked') == 'true' and pg.inner_text('#pro-btn') == 'Go Pro', 'test-as-free switches the owner to free')
        pg.click('.tab[data-tab="search"]')
        for i, q in enumerate(['PS5', 'iPhone 13', 'AirPods Pro']):
            pg.fill('#q', q); pg.press('#q', 'Enter'); pg.wait_for_timeout(350)
            ok(pg.is_visible('#results') and not pg.is_visible('#sheet-pro'), f'free search {i+1} works')
        pg.fill('#q', 'Nintendo Switch'); pg.press('#q', 'Enter'); pg.wait_for_timeout(300)
        ok(pg.is_visible('#sheet-pro') and 'free searches' in pg.inner_text('#p-title'), '4th search opens the paywall')
        ok('Card needed' in pg.inner_text('#pro-body'), 'paywall says card is needed for the trial')
        over(pg, 'paywall'); pg.screenshot(path=f'{OUT}/e2e-paywall.png')
        pg.click('#trial-btn'); pg.wait_for_selector('#pro-err:not([hidden])')
        ok('switched on yet' in pg.inner_text('#pro-err') and pg.inner_text('#pro-btn') == 'Go Pro', 'trial button does NOT give Pro without payment')
        pg.click('#sheet-pro .link'); pg.wait_for_timeout(200)

        # reset my usage from admin
        pg.click('#acct-btn'); pg.click('#ac-admin'); pg.wait_for_selector('#ad-health .srow')
        pg.click('#ad-reset-me'); toast(pg); pg.wait_for_timeout(300)
        pg.click('.tab[data-tab="search"]'); pg.fill('#q', 'Nintendo Switch'); pg.press('#q', 'Enter'); pg.wait_for_timeout(350)
        ok(pg.is_visible('#results') and not pg.is_visible('#sheet-pro'), 'reset usage lets the admin search again')

        # log out, sign up a normal user
        pg.click('#acct-btn'); pg.click('#ac-logout'); pg.wait_for_timeout(300)
        ok(pg.is_visible('#auth') and pg.inner_text('#au-go') == 'Log in', 'log out returns to login')
        pg.click('[data-auth="signup"]'); pg.fill('#au-email', 'owner@test.com'); pg.fill('#au-pw', 'password123'); pg.click('#au-go'); pg.wait_for_timeout(300)
        ok('already has an account' in pg.inner_text('#au-err'), 'duplicate email error')
        pg.fill('#au-email', 'user@test.com'); pg.click('#au-go'); toast(pg); pg.wait_for_timeout(200)
        ok(not pg.is_visible('#auth') and pg.inner_text('#pro-btn') == 'Go Pro', 'normal user is free')
        pg.click('#acct-btn'); pg.wait_for_timeout(150)
        ok(not pg.is_visible('#ac-admin'), 'normal user has no admin link')
        pg.click('#sheet-account [data-close].x')

        # price checks: 3 then paywall
        pg.click('.tab[data-tab="check"]')
        for i in range(3):
            pg.fill('#c-item', 'iPhone 13 128GB'); pg.fill('#c-price', '150'); pg.click('#check-form button[type=submit]'); pg.wait_for_timeout(350)
            ok(pg.is_visible('.verdict') and not pg.is_visible('#sheet-pro'), f'price check {i+1} works')
        ok('0' in pg.inner_text('#checks-left'), 'checks counter at 0')
        pg.click('#check-form button[type=submit]'); pg.wait_for_timeout(300)
        ok(pg.is_visible('#sheet-pro') and 'price checks' in pg.inner_text('#p-title'), '4th price check opens the paywall')
        pg.click('#sheet-pro .link')

        # alerts: 1 free, 2nd opens paywall
        pg.click('.tab[data-tab="alerts"]'); pg.wait_for_timeout(200)
        pg.click('#new-alert'); pg.fill('#a-item', 'Nike Dunk Low size 9'); pg.fill('#a-max', '60'); pg.click('#a-save'); toast(pg); pg.wait_for_timeout(200)
        ok('Nike Dunk Low' in pg.inner_text('#alerts'), 'alert saved on the server')
        pg.click('#new-alert'); pg.wait_for_timeout(200)
        ok(pg.is_visible('#sheet-pro') and 'alerts' in pg.inner_text('#p-title').lower(), '2nd alert opens the paywall')
        pg.click('#sheet-pro .link')
        pg.click('[data-run]'); pg.wait_for_timeout(400)
        ok(pg.is_visible('#results') and not pg.is_visible('#sheet-pro'), 'checking a saved alert is free')

        # owner gives Pro and resets password
        pg.click('#acct-btn'); pg.click('#ac-logout'); pg.wait_for_timeout(200)
        pg.fill('#au-email', 'owner@test.com'); pg.fill('#au-pw', 'password123'); pg.click('#au-go'); toast(pg)
        pg.click('#acct-btn'); pg.click('#ac-admin'); pg.wait_for_selector('#ad-health .srow')
        pg.click('#ad-free'); toast(pg); pg.wait_for_timeout(300)
        ok(pg.inner_text('#pro-btn') == 'Pro', 'owner back to Pro')
        ok('2 users' in pg.inner_text('#ad-count'), 'admin sees 2 users')
        pg.fill('#ad-q', 'user@'); pg.press('#ad-q', 'Enter'); pg.wait_for_timeout(300)
        ok(pg.locator('#ad-users .ur').count() == 1 and '3 checks' in pg.inner_text('#ad-users'), 'admin search finds the user and their usage')
        pg.click('#ad-users .ur'); pg.wait_for_timeout(200)
        over(pg, 'user sheet')
        pg.click('[data-act="grant_pro"]'); toast(pg); pg.wait_for_timeout(200)
        ok('Pro · gift' in pg.inner_text('#user-body'), 'admin gives free Pro')
        pg.click('[data-act="reset_password"]'); pg.wait_for_selector('#us-temp')
        temp = pg.inner_text('#us-temp')
        ok(len(temp) == 10, 'temporary password shown')
        pg.screenshot(path=f'{OUT}/e2e-user.png')
        pg.click('#sheet-user [data-close].x')

        pg.click('#acct-btn'); pg.click('#ac-logout'); pg.wait_for_timeout(200)
        pg.fill('#au-email', 'user@test.com'); pg.fill('#au-pw', 'password123'); pg.click('#au-go'); pg.wait_for_timeout(300)
        ok('Wrong email or password' in pg.inner_text('#au-err'), 'old password stops working')
        pg.fill('#au-pw', temp); pg.click('#au-go'); toast(pg); pg.wait_for_timeout(200)
        ok(pg.inner_text('#pro-btn') == 'Pro', 'user is Pro after admin gift')
        pg.click('.tab[data-tab="check"]'); pg.fill('#c-item', 'iPhone 13'); pg.fill('#c-price', '150'); pg.click('#check-form button[type=submit]'); pg.wait_for_timeout(350)
        ok(pg.is_visible('.verdict') and not pg.is_visible('#sheet-pro'), 'Pro user gets past the free limit')

        # change password from account
        pg.wait_for_timeout(2400)
        pg.click('#acct-btn'); pg.click('#ac-pw-btn'); pg.fill('#ac-pw-cur', temp); pg.fill('#ac-pw-new', 'mynewpass1'); pg.click('#ac-pw button[type=submit]')
        try:
            pg.wait_for_function("document.querySelector('#toast').textContent.includes('Password changed') && !document.querySelector('#toast').hidden", timeout=4000)
            changed = True
        except Exception:
            changed = False
        ok(changed and pg.is_hidden('#ac-pw-err'), 'user changes password (err: ' + (pg.inner_text('#ac-pw-err') if pg.is_visible('#ac-pw-err') else 'none') + ')')
        pg.click('#sheet-account [data-close].x'); pg.wait_for_timeout(150)
        pg.click('#acct-btn'); pg.click('#ac-logout'); pg.wait_for_timeout(200)
        pg.fill('#au-email', 'user@test.com'); pg.fill('#au-pw', 'mynewpass1'); pg.click('#au-go'); pg.wait_for_timeout(500)
        ok(not pg.is_visible('#auth'), 'new password logs in')

        # session survives a reload; bad token logs out
        pg.reload(); pg.wait_for_timeout(500)
        ok(not pg.is_visible('#auth') and pg.inner_text('#pro-btn') == 'Pro', 'still logged in after reopening')
        pg.evaluate("localStorage.setItem('afo.token', JSON.stringify('f'.repeat(64)))"); pg.reload(); pg.wait_for_timeout(600)
        ok(pg.is_visible('#auth'), 'bad session goes back to login')
        b.close()
finally:
    srv.terminate()

print('\n'.join(results))
print('passed', sum(r.startswith('PASS') for r in results), 'of', len(results))
print('overflow:', json.dumps(overflow))
print('page errors:', errors)

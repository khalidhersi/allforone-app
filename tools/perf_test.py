"""Measure how hard the app works while idle on each screen (lower is better).
Usage: python3 tools/perf_test.py [port] [label]"""
import json, os, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright
APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8795; BASE = f'http://localhost:{PORT}/'
srv = subprocess.Popen([os.environ.get('NODE', 'node'), 'tools/dev_server.js'], cwd=APP, env=dict(os.environ, PORT=str(PORT)), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(50):
    try: urllib.request.urlopen(BASE + 'api/auth?a=ping'); break
    except Exception: time.sleep(0.1)
out = {}
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--enable-gpu-benchmarking'])
        ctx = b.new_context(viewport={'width': 360, 'height': 780}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); cdp = ctx.new_cdp_session(pg); cdp.send('Performance.enable')
        hold = {'on': False}
        def slow(route):
            if hold['on']: time.sleep(0)  # keep request pending: never fulfil until released
            route.continue_() if not hold['on'] else None
        pending = []
        pg.route('**/api/estimate', lambda r: pending.append(r) if hold['on'] else r.continue_())
        def idle(name, secs=6):
            pg.wait_for_timeout(800)
            m0 = {m['name']: m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
            f0 = pg.evaluate("window.__f||0")
            pg.evaluate("window.__f=0; (function c(){window.__f++; requestAnimationFrame(c)})()") if not pg.evaluate("!!window.__rafOn") else None
            pg.evaluate("window.__rafOn=true")
            pg.wait_for_timeout(secs * 1000)
            m1 = {m['name']: m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
            d = lambda k: m1.get(k, 0) - m0.get(k, 0)
            out[name] = {'busy_ms_per_s': round(1000 * d('TaskDuration') / secs, 1), 'style_recalcs': int(d('RecalcStyleCount')), 'layouts': int(d('LayoutCount'))}
        pg.goto(BASE); idle('login screen')
        pg.fill('#au-email', 'a@test.com'); pg.fill('#au-pw', 'password123'); pg.click('#au-go'); pg.wait_for_timeout(400)
        pg.click('[data-mode="shop"]'); idle('home')
        hold['on'] = True
        pg.fill('#q', 'PS5'); pg.press('#q', 'Enter'); idle('waiting for prices')
        hold['on'] = False
        for r in pending: r.continue_()
        idle('results')
        b.close()
finally:
    srv.terminate()
print(sys.argv[2] if len(sys.argv) > 2 else 'result', json.dumps(out))

# Test af Stil (arkade/stil.js) i hallen og alle spil:
#  - i hvert spil findes Stil under Indstillinger; et valg skifter stilen med det samme (siden genindlæses)
#  - valget huskes, når man går tilbage til hallen (spillene må ikke slette arkade.stil, når de gemmer)
#  - ingen JS-fejl
#   python3 arkade/test/stil_test.py        ONLY=slangen,muren
import os, sys, pathlib, re
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
spil = re.findall(r"sti: '([^/']+)/'", (ROOT / 'games.js').read_text())
if os.environ.get('ONLY'): spil = [g for g in spil if g in os.environ['ONLY'].split(',')]
fails = []
def check(ok, msg):
    if not ok: fails.append(msg)
    return ok
STIL = "() => [document.documentElement.dataset.stil, (JSON.parse(localStorage.getItem('hojtArkade.arkade.indstillinger') || '{}')).stil]"
def find_knap(pg, v):
    knap = pg.locator('[data-set="stil"][data-value="%s"]' % v)
    for b in pg.locator('#settings [data-tab]').all():
        b.click(); pg.wait_for_timeout(60)
        for _ in range(3):
            if knap.is_visible(): return knap
            n = pg.locator('#settings button:visible').filter(has_text='Næste')
            if not n.count() or n.first.is_disabled(): break
            n.first.click(); pg.wait_for_timeout(100)
    return None
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=CHROME)
    for g in spil:
        tag = g + ':'; pg = br.new_page(viewport={'width': 1280, 'height': 720}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto((ROOT / g / 'index.html').as_uri())
        pg.evaluate("() => { localStorage.clear(); localStorage.setItem('hojtArkade.arkade.indstillinger', JSON.stringify({music: false, sound: false})); localStorage.setItem('hojtArkade.styring.indstillinger', JSON.stringify({valg: 'mus'})); localStorage.setItem('hojtArkade.effekterForslag', 'nej'); }")
        pg.reload(); pg.wait_for_timeout(400)
        pg.locator('#btn-settings').first.click(); pg.wait_for_timeout(200)
        k = find_knap(pg, 'tegneserie')
        if check(k is not None, tag + ' Stil findes i Indstillinger'):
            with pg.expect_navigation(timeout=5000): k.click()
            pg.wait_for_timeout(400)
            check(pg.evaluate(STIL) == ['tegneserie', 'tegneserie'], tag + ' Tegneserie valgt og gemt (%s)' % pg.evaluate(STIL))
            # en anden indstilling i spillet må ikke slette stilen; gå så til hallen
            pg.locator('#btn-settings').first.click(); pg.wait_for_timeout(150)
            k2 = find_knap(pg, 'pixel'); 
            if k2:
                with pg.expect_navigation(timeout=5000): k2.click()
                pg.wait_for_timeout(400)
            pg.goto((ROOT / 'index.html').as_uri()); pg.wait_for_timeout(500)
            check(pg.evaluate(STIL) == ['pixel', 'pixel'], tag + ' hallen husker stilen (%s)' % pg.evaluate(STIL))
        check(not errs, tag + ' JS-fejl: %s' % errs[:2])
        print(('OK   ' if not [f for f in fails if f.startswith(tag)] else 'FEJL ') + g)
        pg.close()
    # hallens "Tilbage til hallen" fra et spil (der gemmer alle indstillinger) bevarer stilen
    pg = br.new_page(viewport={'width': 1280, 'height': 720})
    pg.goto((ROOT / 'slangen' / 'index.html').as_uri())
    pg.evaluate("() => { localStorage.clear(); localStorage.setItem('hojtArkade.arkade.indstillinger', JSON.stringify({stil: 'pixel', music: false, sound: false})); localStorage.setItem('hojtArkade.styring.indstillinger', JSON.stringify({valg: 'mus'})); localStorage.setItem('hojtArkade.effekterForslag', 'nej'); }")
    pg.reload(); pg.wait_for_timeout(400)
    pg.locator('#btn-hallen').click(); pg.wait_for_timeout(800)
    check(pg.evaluate(STIL) == ['pixel', 'pixel'], 'Tilbage til hallen bevarer stilen (%s)' % pg.evaluate(STIL))
    br.close()
for f in fails: print('  ', f)
print('%d spil, %d fejl' % (len(spil), len(fails)))
sys.exit(1 if fails else 0)

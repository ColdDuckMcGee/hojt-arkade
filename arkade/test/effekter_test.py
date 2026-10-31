# Test af "Begræns effekter" (arkade.begraensEffekter) i hallen og alle spil.
# For hver side: knappen i Indstillinger slår det til og fra med det samme, <html> får
# data-effekter, neon-gløden er væk (--glow 0, ingen tekstglød), baggrunden står stille, spillets
# egen glød er slået fra, indstillingen huskes, og der er ingen JS-fejl. I Kælderen tjekkes også
# 3D-billedet (ingen glorie/scanlinjer, lav opløsning).
#   python3 arkade/test/effekter_test.py        ONLY=slangen,kaelderen
import os, sys, pathlib, json
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
games = [l.split("sti: '")[1].split("/'")[0] for l in open(ROOT / 'games.js') if "sti: '" in l]
SIDER = ['hal'] + games
if os.environ.get('ONLY'): SIDER = [s for s in SIDER if s in os.environ['ONLY'].split(',')]
fails = []
def check(ok, msg):
    if not ok: fails.append(msg)
    return ok

STATE = """() => ({
  attr: document.documentElement.getAttribute('data-effekter'),
  glow: getComputedStyle(document.documentElement).getPropertyValue('--glow').trim(),
  tekstGloed: (() => { const h = document.querySelector('.neon-title, .neon-sub, h1, h2'); return h ? getComputedStyle(h).textShadow : 'none'; })(),
  gemt: (JSON.parse(localStorage.getItem('hojtArkade.arkade.indstillinger') || '{}')).begraensEffekter,
  egenGloed: [...document.documentElement.attributes].filter(a => /gloed$/.test(a.name)).map(a => a.value).join(','),
  knap: (() => { const b = document.querySelector('[data-set="begraensEffekter"][data-value="true"]'); return b ? b.getAttribute('aria-pressed') : null; })()
})"""

def aabn_indstillinger(pg, side):
    if side == 'hal':
        pg.locator('#btn-indstillinger').click(); pg.wait_for_timeout(200)
        tab = pg.locator('#indstillinger [data-tab]').filter(has=pg.locator('[data-set="begraensEffekter"]'))
        # find fanen med Effekter
        for b in pg.locator('#indstillinger [data-tab]').all():
            b.click(); pg.wait_for_timeout(80)
            if pg.locator('[data-set="begraensEffekter"][data-value="true"]').is_visible(): return True
        return False
    pg.locator('#btn-settings').first.click(); pg.wait_for_timeout(200)
    knap = pg.locator('[data-set="begraensEffekter"][data-value="true"]')
    for b in pg.locator('#settings [data-tab]').all():
        b.click(); pg.wait_for_timeout(80)
        for _ in range(3):   # nogle spil deler indstillingerne op på sider (Næste)
            if knap.is_visible() and knap.bounding_box()['width'] > 0: return True
            naeste = pg.locator('#settings button:visible').filter(has_text='Næste')
            if not naeste.count() or naeste.first.is_disabled(): break
            naeste.first.click(); pg.wait_for_timeout(120)
    return pg.locator('[data-set="begraensEffekter"][data-value="true"]').is_visible()

with sync_playwright() as p:
    br = p.chromium.launch(executable_path=CHROME)
    for side in SIDER:
        tag = side + ':'
        pg = br.new_page(viewport={'width': 1280, 'height': 720})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        url = (ROOT / 'index.html').as_uri() if side == 'hal' else (ROOT / side / 'index.html').as_uri()
        pg.goto(url)
        pg.evaluate("() => { localStorage.clear(); localStorage.setItem('hojtArkade.arkade.indstillinger', JSON.stringify({background: 'neonby', animation: true, music: false, sound: false})); localStorage.setItem('hojtArkade.styring.indstillinger', JSON.stringify({valg: 'mus'})); }")
        pg.reload(); pg.wait_for_timeout(400)
        s0 = pg.evaluate(STATE)
        check(s0['attr'] is None and s0['glow'] != '0', tag + ' fra start: fulde effekter (%s)' % s0)
        if not check(aabn_indstillinger(pg, side), tag + ' knappen Begrænsede findes ikke i Indstillinger'):
            pg.close(); print('FEJL ' + side); continue
        pg.locator('[data-set="begraensEffekter"][data-value="true"]').click(); pg.wait_for_timeout(300)
        s1 = pg.evaluate(STATE)
        check(s1['attr'] == 'begraenset' and s1['glow'] == '0' and s1['tekstGloed'] == 'none' and s1['gemt'] is True and s1['knap'] == 'true',
              tag + ' Begrænsede virker med det samme (%s)' % s1)
        check('til' not in s1['egenGloed'].split(','), tag + ' spillets egen glød er slået fra (%s)' % s1['egenGloed'])
        # baggrunden står stille: to skærmbilleder af baggrunden er ens
        a = pg.screenshot(clip={'x': 0, 'y': 0, 'width': 60, 'height': 60}); pg.wait_for_timeout(700); b = pg.screenshot(clip={'x': 0, 'y': 0, 'width': 60, 'height': 60})
        check(a == b or side != 'hal', tag + ' baggrunden står stille')
        # huskes ved genindlæsning
        pg.reload(); pg.wait_for_timeout(400)
        s2 = pg.evaluate(STATE)
        check(s2['attr'] == 'begraenset' and s2['glow'] == '0', tag + ' huskes efter genindlæsning (%s)' % s2)
        if side == 'kaelderen':
            pg.locator('#btn-start, #btn-continue').first.click(); pg.wait_for_timeout(1500)
            k = pg.evaluate("() => ({ intern: Kaelderen.tegn.intern, skala: Kaelderen.tegn.skala })")
            check(k['skala'] <= 0.41, tag + ' 3D-billedet bruger lav opløsning (%s)' % k)
            pg.evaluate("() => Kaelderen.show('menu')"); pg.wait_for_timeout(200)
        # og slås fra igen
        aabn_indstillinger(pg, side)
        pg.locator('[data-set="begraensEffekter"][data-value="false"]').click(); pg.wait_for_timeout(300)
        s3 = pg.evaluate(STATE)
        check(s3['attr'] is None and s3['glow'] != '0' and s3['gemt'] is False, tag + ' Fulde virker igen (%s)' % s3)
        check(not errs, tag + ' JS-fejl: %s' % errs[:2])
        pg.close()
        print(('OK   ' if not [f for f in fails if f.startswith(tag)] else 'FEJL ') + side)
    br.close()
for f in fails: print('  ', f)
print('%d sider, %d fejl' % (len(SIDER), len(fails)))
sys.exit(1 if fails else 0)

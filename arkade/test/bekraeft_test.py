# Test af "spørg, før spillet forlades" (arkade/bekraeft.js) i de spil, der bruger den.
# For hvert spil: Til menuen i pausen åbner dialogen, Esc og Nej går tilbage til pausen,
# Ja går til menuen, et hvilende blik (dwell) vælger intet i dialogen, et ekstra klik samme
# sted tæller ikke, og dialogen passer på skærmen (store knapper, god afstand, ingen rulning).
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 arkade/test/bekraeft_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     ONLY=slangen,bomberne
import os, sys, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
GAMES = ['slangen', 'bomberne', 'froeen', 'minestryger', 'labyrinten', 'blokke', 'bobler', 'flipper',
         'kanonen', 'loeberen', 'soeslag', 'kasser']
if os.environ.get('ONLY'): GAMES = [g for g in GAMES if g in os.environ['ONLY'].split(',')]
SIZES = [(1920, 1080), (1366, 768), (1280, 720), (1024, 768), (1024, 1366), (1366, 1024), (390, 844), (844, 390)]
fails = []

def check(ok, msg):
    if not ok: fails.append(msg)
    return ok

ST = """() => ({
  aaben: !!window.ArkadeBekraeft && ArkadeBekraeft.aaben(),
  skaerm: [...document.querySelectorAll('.screen')].filter(s => !s.hidden).map(s => s.id).join(','),
  pause: !!document.querySelector('#pause-overlay') && !document.querySelector('#pause-overlay').hidden })"""

LAYOUT = """() => {
  const ov = document.querySelector('.arkade-bk'); if (!ov) return null;
  const nej = ov.querySelector('.arkade-bk-nej').getBoundingClientRect(), ja = ov.querySelector('.arkade-bk-ja').getBoundingClientRect();
  const W = innerWidth, H = innerHeight;
  const gap = Math.hypot(Math.max(0, Math.max(nej.left, ja.left) - Math.min(nej.right, ja.right)), Math.max(0, Math.max(nej.top, ja.top) - Math.min(nej.bottom, ja.bottom)));
  const inde = r => r.left >= -1 && r.top >= -1 && r.right <= W + 1 && r.bottom <= H + 1;
  return { min: Math.round(Math.min(nej.width, nej.height, ja.width, ja.height)), gap: Math.round(gap),
           inde: inde(nej) && inde(ja), rul: ov.scrollHeight > ov.clientHeight + 1 || ov.scrollWidth > ov.clientWidth + 1,
           fokus: document.activeElement === ov.querySelector('.arkade-bk-nej') };
}"""

def start(pg, g, dwell=False):
    pg.goto((ROOT / g / 'index.html').as_uri())
    pg.evaluate("(d) => { localStorage.setItem('hojtArkade.arkade.indstillinger', JSON.stringify({dwell: d, dwellTime: 0.5, music: false, sound: false, animation: false})); }", dwell)
    pg.reload(); pg.wait_for_timeout(300)
    pg.mouse.move(2, 2)
    pg.locator('#btn-start, #btn-continue').first.click()
    pg.wait_for_timeout(500)
    pg.locator('#btn-pause').click()
    pg.wait_for_timeout(250)

def midt(pg, sel):
    b = pg.locator(sel).first.bounding_box()
    return b['x'] + b['width'] / 2, b['y'] + b['height'] / 2

with sync_playwright() as p:
    br = p.chromium.launch(executable_path=CHROME)
    for g in GAMES:
        errs = []
        pg = br.new_page(viewport={'width': 1280, 'height': 720})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        tag = g + ':'
        # 1. Til menuen spørger først; Esc = Nej
        start(pg, g)
        pg.locator('#btn-quit').click(); pg.wait_for_timeout(150)
        s = pg.evaluate(ST)
        check(s['aaben'] and s['skaerm'] == 'game', tag + ' Til menuen åbnede ikke dialogen (%s)' % s)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
        s = pg.evaluate(ST)
        check(not s['aaben'] and s['skaerm'] == 'game' and s['pause'], tag + ' Esc gik ikke tilbage til pausen (%s)' % s)
        # 2. Nej går tilbage til pausen
        pg.locator('#btn-quit').click(); pg.wait_for_timeout(150)
        x, y = midt(pg, '.arkade-bk-nej'); pg.mouse.move(2, 2); pg.mouse.click(x, y); pg.wait_for_timeout(150)
        s = pg.evaluate(ST)
        check(not s['aaben'] and s['skaerm'] == 'game' and s['pause'], tag + ' Nej gik ikke tilbage til pausen (%s)' % s)
        # 3. Et ekstra klik samme sted som Til menuen tæller ikke i dialogen
        qx, qy = midt(pg, '#btn-quit')
        pg.mouse.click(qx, qy); pg.wait_for_timeout(150)
        pg.mouse.click(qx, qy); pg.wait_for_timeout(150)
        s = pg.evaluate(ST)
        check(s['aaben'] and s['skaerm'] == 'game', tag + ' et ekstra klik samme sted valgte i dialogen (%s)' % s)
        # 4. Ja går til menuen
        x, y = midt(pg, '.arkade-bk-ja'); pg.mouse.move(2, 2); pg.mouse.click(x, y); pg.wait_for_timeout(250)
        s = pg.evaluate(ST)
        check(not s['aaben'] and s['skaerm'] == 'menu', tag + ' Ja gik ikke til menuen (%s)' % s)
        # 5. Dwell: blikket hviler på Til menuen; dialogen åbner, men intet vælges, før blikket flytter sig
        start(pg, g, dwell=True)
        qx, qy = midt(pg, '#btn-quit'); pg.mouse.move(qx, qy); pg.mouse.move(qx + 1, qy)
        pg.wait_for_timeout(600 + 2000)
        s = pg.evaluate(ST)
        check(s['aaben'] and s['skaerm'] == 'game', tag + ' dwell: hvilende blik valgte i dialogen (%s)' % s)
        x, y = midt(pg, '.arkade-bk-nej'); pg.mouse.move(x, y); pg.mouse.move(x + 1, y); pg.wait_for_timeout(900)
        s = pg.evaluate(ST)
        check(not s['aaben'] and s['pause'], tag + ' dwell: Nej virkede ikke (%s)' % s)
        check(not errs, tag + ' JS-fejl: %s' % errs[:2])
        pg.close()
        # 6. Layout ved alle skærme
        for (w, h) in SIZES:
            pg = br.new_page(viewport={'width': w, 'height': h})
            start(pg, g)
            pg.locator('#btn-quit').click(); pg.wait_for_timeout(200)
            L = pg.evaluate(LAYOUT)
            if check(L is not None, tag + ' %dx%d: ingen dialog' % (w, h)):
                check(L['min'] >= 84, tag + ' %dx%d: knap under 84 px (%s)' % (w, h, L['min']))
                check(L['gap'] >= 40, tag + ' %dx%d: under 40 px mellem Nej og Ja (%s)' % (w, h, L['gap']))
                check(L['inde'] and not L['rul'], tag + ' %dx%d: dialogen passer ikke på skærmen (%s)' % (w, h, L))
                check(L['fokus'], tag + ' %dx%d: Nej har ikke fokus' % (w, h))
            pg.close()
        print(('OK   ' if not [f for f in fails if f.startswith(tag)] else 'FEJL ') + g)
    br.close()

for f in fails: print('  ', f)
print('%d spil, %d fejl' % (len(GAMES), len(fails)))
sys.exit(1 if fails else 0)

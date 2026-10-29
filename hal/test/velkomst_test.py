# Playwright-test af hallens velkomstskærm "Hvordan styrer du?" (alle fire valg).
#
# Tjekker:
#  - layout ved de 8 opløsninger + klemte vinduer (1280×500, 900×800, 1024×600) og 1280×800:
#    ingen rulning, intet klippet af, knapper >= 84 px, 0 "tætte" (Color Links: højst én anden
#    knapmidte inden for 120 px) – både trin 1 (fire valg) og trin 2 (kigge-tid);
#  - Mus eller touch: klik → hallen, kigge-klik fra, valget huskes (skærmen vises ikke igen);
#  - Øjenstyring med kigge-klik: valgt med selve kigge-klikket (musen hviler på knappen i 2 s),
#    derefter kigge-tid "Lang" → kigge-klik til med 2 s;
#  - Øjenstyring med mit eget program: kun element.click() (som TD Browse) → kigge-klik fra;
#  - TD Browse/Electron genkendes: ingen velkomst, valg "eget", kort besked, ingen TD-boks;
#  - Kontakt eller tastatur: kun taster (første knap har fokus, pile + Enter, Mellemrum);
#    Spil-knappen får fokus, data-styring="kontakt", og i et spil har Start fokus;
#  - Indstillinger → Skift styring: viser nuværende valg, Escape fortryder, nyt valg gemmes;
#  - alle 27 spil læser den fælles indstilling (kigge-ring vises / vises ikke).
#
#   python3 hal/test/velkomst_test.py
# Miljøvariabler (valgfri): CHROME=/sti/til/chrome  VELKOMST_SKAERMBILLEDER=/mappe
import os, sys, json, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
HALL = (ROOT / 'index.html').as_uri()
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
SHOT = os.environ.get('VELKOMST_SKAERMBILLEDER')
SIZES = [(1920,1080),(1366,768),(1280,720),(1024,768),(1024,1366),(1366,1024),(390,844),(844,390),
         (1280,500),(900,800),(1024,600),(1280,800)]
GAMES = sorted(p.parent.parent.name for p in ROOT.glob('*/js/app.js'))
fails = []; n = 0
def check(ok, msg):
    global n; n += 1
    if not ok: fails.append(msg); print('FEJL', msg)

LAYOUT = """() => { const se = document.scrollingElement, W = innerWidth, H = innerHeight;
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && !e.closest('[hidden]'); };
  const sc = document.querySelector('#velkomst');
  const bs = [...sc.querySelectorAll('button')].filter(vis);
  const c = bs.map(e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; });
  let tight = 0; c.forEach((a, i) => { if (c.filter((b, j) => j !== i && Math.hypot(a.x - b.x, a.y - b.y) < 120).length >= 2) tight++; });
  const clipped = [...sc.querySelectorAll('button, h1, h2, p')].filter(vis).filter(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1; }).map(e => e.textContent.trim().slice(0, 20));
  const textOut = bs.filter(b => [...b.children].some(k => { const a = k.getBoundingClientRect(), r = b.getBoundingClientRect(); return a.width > 0 && (a.bottom > r.bottom + 1 || a.top < r.top - 1 || a.right > r.right + 1 || a.left < r.left - 1); })).map(b => b.textContent.trim().slice(0, 20));
  return { n: bs.length, tight, min: Math.round(Math.min(...c.map(o => Math.min(o.r.width, o.r.height)))), clipped, textOut,
    scroll: se.scrollHeight > se.clientHeight || se.scrollWidth > se.clientWidth || sc.scrollHeight > sc.clientHeight + 1 || sc.scrollWidth > sc.clientWidth + 1 }; }"""
ST = """() => ({ valg: (JSON.parse(localStorage.getItem('hojtArkade.styring.indstillinger') || '{}')).valg || '',
  dwell: HojtHal.settings.get('dwell'), tid: HojtHal.settings.get('dwellTime'), aktiv: HojtHal.dwell.isEnabled(), dwellMs: HojtHal.dwell.getTime(),
  skaerm: [...document.querySelectorAll('.screen')].filter(s => !s.hidden).map(s => s.id)[0],
  fokus: document.activeElement && (document.activeElement.id || document.activeElement.getAttribute('data-styring') || document.activeElement.getAttribute('data-tid') || document.activeElement.tagName),
  styringAttr: document.documentElement.getAttribute('data-styring'), besked: !document.getElementById('hal-besked').hidden,
  tdBoks: !!document.getElementById('arkade-td-besked') })"""
def center(pg, sel):
    r = pg.locator(sel).bounding_box(); return r['x'] + r['width'] / 2, r['y'] + r['height'] / 2

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox', '--allow-file-access-from-files'])
    def ctx(**kw):
        c = b.new_context(**kw); pg = c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.on('console', lambda m: errs.append(m.text[:200]) if m.type == 'error' and 'hojt-arkade-api' not in m.text and 'Failed to load resource' not in m.text else None)
        return c, pg, errs

    # ---------- Layout ----------
    for (w, h) in SIZES:
        c, pg, errs = ctx(viewport={'width': w, 'height': h})
        pg.goto(HALL); pg.wait_for_timeout(400)
        check(pg.evaluate(ST)['skaerm'] == 'velkomst', '%dx%d: velkomst vises ikke ved første besøg' % (w, h))
        for trin in (1, 2):
            if trin == 2: pg.evaluate("document.querySelector('#velkomst [data-styring=kigge]').click()"); pg.wait_for_timeout(200)
            r = pg.evaluate(LAYOUT)
            print('%4dx%-4d trin%d knapper=%d tætte=%d min=%dpx scroll=%s' % (w, h, trin, r['n'], r['tight'], r['min'], r['scroll']))
            check(r['n'] == 4 and r['tight'] == 0 and r['min'] >= 84 and not r['scroll'] and not r['clipped'] and not r['textOut'],
                  '%dx%d trin %d: %s' % (w, h, trin, json.dumps(r, ensure_ascii=False)))
            if SHOT and (w, h) in [(1280, 800), (390, 844)]:
                pg.mouse.move(2, 2); pg.wait_for_timeout(100)
                pg.screenshot(path='%s/velkomst%s_%dx%d.png' % (SHOT.rstrip('/'), '' if trin == 1 else '_kiggetid', w, h))
        check(not errs, '%dx%d konsol: %s' % (w, h, errs))
        c.close()

    # ---------- 1. Mus eller touch ----------
    c, pg, errs = ctx(viewport={'width': 1280, 'height': 800})
    pg.goto(HALL); pg.wait_for_timeout(400)
    s = pg.evaluate(ST)
    check(s['aktiv'] and s['dwellMs'] == 2000, 'kigge-klik er ikke slået til med 2 s på velkomstskærmen: %s' % s)
    pg.click('#velkomst [data-styring=mus]'); pg.wait_for_timeout(300)
    s = pg.evaluate(ST)
    check(s['skaerm'] == 'hal' and s['valg'] == 'mus' and not s['dwell'] and not s['aktiv'] and s['besked'], 'Mus: %s' % s)
    pg.reload(); pg.wait_for_timeout(400)
    check(pg.evaluate(ST)['skaerm'] == 'hal', 'Mus: velkomst vises igen efter genindlæsning')
    check(not errs, 'Mus konsol: %s' % errs); c.close()

    # ---------- 2. Øjenstyring med kigge-klik (valgt med kigge-klik) ----------
    c, pg, errs = ctx(viewport={'width': 1280, 'height': 800})
    pg.goto(HALL); pg.wait_for_timeout(400)
    x, y = center(pg, '#velkomst [data-styring=kigge]'); pg.mouse.move(x - 5, y); pg.mouse.move(x, y)
    pg.wait_for_timeout(1200)
    check(pg.evaluate(ST)['skaerm'] == 'velkomst' and pg.locator('#velkomst-trin1').is_visible(), 'kigge-klik valgte for tidligt (før 2 s)')
    pg.wait_for_timeout(1300)
    check(pg.locator('#velkomst-trin2').is_visible(), 'kigge-klik på "Øjenstyring med kigge-klik" viste ikke kigge-tid')
    x, y = center(pg, '[data-tid="2"]'); pg.mouse.move(x - 5, y); pg.mouse.move(x, y); pg.wait_for_timeout(2500)
    s = pg.evaluate(ST)
    check(s['skaerm'] == 'hal' and s['valg'] == 'kigge' and s['dwell'] and s['tid'] == 2 and s['aktiv'] and s['dwellMs'] == 2000, 'Kigge: %s' % s)
    check(not errs, 'Kigge konsol: %s' % errs)
    # alle spil: kigge-ringen vises, når musen hviler på en knap
    bad = []
    for g in GAMES:
        pg.goto((ROOT / g / 'index.html').as_uri()); pg.wait_for_timeout(350)
        loc = pg.locator('#btn-start, #btn-continue').first
        if not loc.count() or not loc.is_visible(): bad.append(g + ':ingen start'); continue
        x, y = center(pg, '#btn-start:visible, #btn-continue:visible'); pg.mouse.move(x - 4, y); pg.mouse.move(x, y); pg.wait_for_timeout(350)
        if not pg.evaluate("[...document.querySelectorAll('.arkade-dwell-ring')].some(r => r.style.display === 'block')"): bad.append(g)
        pg.mouse.move(1, 1)
    check(not bad, 'kigge-klik virker ikke i: %s' % bad)
    print('kigge-klik til i %d/%d spil' % (len(GAMES) - len(bad), len(GAMES)))
    c.close()

    # ---------- 3. Øjenstyring med mit eget program (kun element.click(), som TD Browse) ----------
    c, pg, errs = ctx(viewport={'width': 1280, 'height': 800})
    pg.goto(HALL); pg.wait_for_timeout(400)
    pg.evaluate("document.querySelector('#velkomst [data-styring=eget]').click()"); pg.wait_for_timeout(300)
    s = pg.evaluate(ST)
    check(s['skaerm'] == 'hal' and s['valg'] == 'eget' and not s['dwell'] and not s['aktiv'], 'Eget: %s' % s)
    bad = []
    for g in GAMES:
        pg.goto((ROOT / g / 'index.html').as_uri()); pg.wait_for_timeout(300)
        x, y = center(pg, '#btn-start:visible, #btn-continue:visible'); pg.mouse.move(x - 4, y); pg.mouse.move(x, y); pg.wait_for_timeout(350)
        if pg.evaluate("[...document.querySelectorAll('.arkade-dwell-ring')].some(r => r.style.display === 'block')"): bad.append(g)
    check(not bad, 'kigge-klik er slået til trods valget i: %s' % bad)
    check(not errs, 'Eget konsol: %s' % errs); c.close()

    # ---------- TD Browse genkendes automatisk ----------
    c, pg, errs = ctx(viewport={'width': 1280, 'height': 800},
                      user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) TDBrowse/1.0 Chrome/120.0 Electron/28.0 Safari/537.36')
    pg.goto(HALL); pg.wait_for_timeout(500)
    s = pg.evaluate(ST)
    check(s['skaerm'] == 'hal' and s['valg'] == 'eget' and not s['dwell'] and s['besked'] and not s['tdBoks'] and s['styringAttr'] == 'eget', 'TD Browse: %s' % s)
    pg.reload(); pg.wait_for_timeout(400)
    check(not pg.evaluate(ST)['besked'], 'TD Browse: beskeden vises igen efter genindlæsning')
    check(not errs, 'TD konsol: %s' % errs); c.close()

    # ---------- 4. Kontakt eller tastatur (kun taster) ----------
    c, pg, errs = ctx(viewport={'width': 1280, 'height': 800})
    pg.goto(HALL); pg.wait_for_timeout(400)
    check(pg.evaluate(ST)['fokus'] == 'mus', 'første valg har ikke fokus: %s' % pg.evaluate(ST)['fokus'])
    pg.keyboard.press('ArrowDown'); pg.keyboard.press('ArrowRight')
    check(pg.evaluate(ST)['fokus'] == 'kontakt', 'pile (ned, højre) nåede ikke "Kontakt eller tastatur": %s' % pg.evaluate(ST)['fokus'])
    pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    s = pg.evaluate(ST)
    check(s['skaerm'] == 'hal' and s['valg'] == 'kontakt' and not s['dwell'] and s['fokus'] == 'btn-spil' and s['styringAttr'] == 'kontakt', 'Kontakt: %s' % s)
    ring = pg.evaluate("getComputedStyle(document.activeElement).outlineWidth")
    check(ring == '6px', 'Kontakt: fokusringen er ikke ekstra tydelig (%s)' % ring)
    pg.goto((ROOT / 'sudoku' / 'index.html').as_uri()); pg.wait_for_timeout(500)
    check(pg.evaluate("document.activeElement.id") == 'btn-start' and pg.evaluate("document.documentElement.getAttribute('data-styring')") == 'kontakt', 'Kontakt: Start har ikke fokus i Sudoku')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(600)
    check(pg.evaluate("!document.querySelector('#menu') || document.querySelector('#menu').hidden"), 'Kontakt: Enter startede ikke Sudoku')
    check(not errs, 'Kontakt konsol: %s' % errs); c.close()
    # Mellemrum + Tab virker også på velkomstskærmen
    c, pg, errs = ctx(viewport={'width': 390, 'height': 844})
    pg.goto(HALL); pg.wait_for_timeout(400)
    pg.keyboard.press('Tab'); pg.keyboard.press('Shift+Tab')
    check(pg.evaluate(ST)['fokus'] == 'mus', 'Tab/Shift+Tab: %s' % pg.evaluate(ST)['fokus'])
    pg.keyboard.press('Tab'); pg.keyboard.press('Space'); pg.wait_for_timeout(200)
    check(pg.locator('#velkomst-trin2').is_visible() and pg.evaluate(ST)['fokus'] == '1.2', 'Mellemrum på kigge-klik / fokus på Mellem: %s' % pg.evaluate(ST)['fokus'])
    pg.keyboard.press('ArrowDown'); pg.keyboard.press('ArrowRight'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    check(pg.locator('#velkomst-trin1').is_visible() and pg.evaluate(ST)['skaerm'] == 'velkomst', 'Tilbage fra kigge-tid med taster')
    c.close()

    # ---------- Indstillinger → Skift styring ----------
    c, pg, errs = ctx(viewport={'width': 1366, 'height': 768})
    pg.goto(HALL); pg.wait_for_timeout(400)
    pg.click('#velkomst [data-styring=mus]'); pg.wait_for_timeout(200)
    pg.click('#btn-indstillinger'); pg.wait_for_timeout(200)
    check(pg.locator('#styring-navn').inner_text() == 'Mus eller touch', 'Indstillinger viser ikke valget')
    pg.click('#btn-skift-styring'); pg.wait_for_timeout(200)
    s = pg.evaluate(ST)
    check(s['skaerm'] == 'velkomst' and s['aktiv'] and pg.evaluate("document.querySelector('#velkomst [data-styring=mus]').getAttribute('aria-pressed')") == 'true', 'Skift styring: %s' % s)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    s = pg.evaluate(ST)
    check(s['skaerm'] == 'indstillinger' and s['valg'] == 'mus' and not s['aktiv'], 'Escape fortryder ikke: %s' % s)
    pg.click('#btn-skift-styring'); pg.wait_for_timeout(200)
    pg.click('#velkomst [data-styring=kigge]'); pg.click('[data-tid="0.8"]'); pg.wait_for_timeout(200)
    s = pg.evaluate(ST)
    check(s['skaerm'] == 'indstillinger' and s['valg'] == 'kigge' and s['dwell'] and s['tid'] == 0.8 and s['dwellMs'] == 800 and s['fokus'] == 'btn-skift-styring', 'Skift til kigge: %s' % s)
    check(pg.locator('#styring-navn').inner_text() == 'Øjenstyring med kigge-klik', 'navnet i Indstillinger opdateres ikke')
    check(not errs, 'Skift konsol: %s' % errs); c.close()
    b.close()

print('%d tjek, %d fejl' % (n, len(fails)))
print('FEJL: %d' % len(fails))
sys.exit(1 if fails else 0)

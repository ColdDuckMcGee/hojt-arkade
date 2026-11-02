"""
Fortsæt, hvor du slap (arkade/fortsaet.js) i alle spil.

For hvert spil: start et spil, klik lidt rundt i spillet (tilfældige knapper i spilskærmen, med fast
frø), genindlæs siden, vælg Fortsæt i menuen, og tjek at
  - Fortsæt-knappen vises med en info-tekst og er mindst 80 px,
  - spillet vises igen (ikke menuen),
  - det gemte spil efter Fortsæt er det samme som før genindlæsningen,
  - Nyt spil spørger, før det gemte slettes,
  - der ikke er JS-fejl.

Kør: python3 arkade/test/fortsaet_test.py [spil ...]
"""
import json, random, sys, os
from playwright.sync_api import sync_playwright

ROD = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')) + '/'

# spil -> (mappe, ekstra JS/valg før Start, antal klik)
SPIL = {
    'slangen': {}, 'sudoku': {'klik': 60}, 'juveler': {'klik': 60}, 'lys-ud': {}, 'pixelgaader': {}, 'rorlaegger': {},
    'minestryger': {'klik': 30}, 'blokke': {'klik': 40}, 'kabalen': {'klik': 40},
    'fire-paa-stribe': {'klik': 20, 'vent': 1500}, 'soeslag': {'klik': 30, 'vent': 1500}, 'kanonen': {'klik': 12, 'vent': 4000},
    'taarnene': {'klik': 30, 'vent': 800}, 'billard': {'klik': 12, 'vent': 5000}, 'golf': {'klik': 12, 'vent': 4000},
    'flipper': {'klik': 16, 'vent': 3000}, 'muren': {'klik': 12, 'vent': 5000}, 'bobler': {'klik': 10, 'vent': 2500, 'efter': "document.getElementById('btn-shoot').click()"},
    'bomberne': {'klik': 30, 'vent': 1500}, 'labyrinten': {'klik': 30, 'vent': 800}, 'froeen': {'klik': 25, 'vent': 1500},
    'loeberen': {'klik': 20, 'vent': 1500}, 'kaelderen': {'klik': 30, 'vent': 1500},
}
# Knapper, der aldrig klikkes i "aben": pause, afslut, hallen, fuld skærm, indstillinger
UNDGAA = '#btn-pause, .pause-btn, [id*="quit"], [id*="afslut"], [id*="hallen"], .js-fullscreen, [id*="settings"], [id*="indstil"], [id*="menu"], a[href]'


def aben(pg, rng, n):
    for _ in range(n):
        if pg.is_visible('.arkade-bk'):
            pg.mouse.move(3, 3); pg.wait_for_timeout(60)
            pg.click('.arkade-bk-nej'); pg.wait_for_timeout(120); continue
        idx = pg.evaluate("""(undgaa) => {
          const scr = [...document.querySelectorAll('.screen')].find(s => !s.hidden);
          if (!scr) return [];
          return [...scr.querySelectorAll('button, [data-dwell]')].map((b, i) => [b, i]).filter(([b]) => {
            if (b.disabled || b.closest('[hidden]') || b.matches(undgaa) || b.closest('.overlay:not([hidden])') && !b.closest('.overlay').id.match(/done|level|next/)) return false;
            const r = b.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0;
          }).map(([b, i]) => i);
        }""", UNDGAA)
        if not idx:
            pg.wait_for_timeout(200); continue
        i = rng.choice(idx)
        pg.evaluate("""([i]) => { const scr = [...document.querySelectorAll('.screen')].find(s => !s.hidden);
          const b = scr.querySelectorAll('button, [data-dwell]')[i]; b && b.click(); }""", [i])
        pg.wait_for_timeout(140)


def gemt(pg, spil):
    return pg.evaluate("(k) => { try { return JSON.parse(localStorage.getItem(k)).data } catch (e) { return null } }",
                       'hojtArkade.' + spil + '.fortsaet')


def test(b, spil, cfg, fejl):
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    log = []
    pg.on('pageerror', lambda e: log.append(str(e)))
    pg.goto(ROD + cfg.get('mappe', spil) + '/index.html')
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(300)

    def tjek(ok, m):
        print(('  OK   ' if ok else '  FEJL '), m)
        if not ok: fejl.append(spil + ': ' + m)

    tjek(not pg.is_visible('.arkade-fortsaet-knap'), 'ingen Fortsæt uden gemt spil')
    if cfg.get('foer'): pg.evaluate(cfg['foer'])
    pg.click('#btn-start'); pg.wait_for_timeout(400)
    start = gemt(pg, spil)
    if cfg.get('efter'):
        pg.evaluate(cfg['efter']); pg.wait_for_timeout(cfg.get('vent', 300))
    aben(pg, random.Random(7), cfg.get('klik', 14))
    pg.wait_for_timeout(cfg.get('vent', 300))
    pg.evaluate("window.dispatchEvent(new Event('pagehide'))")
    foer = gemt(pg, spil)
    tjek(foer is not None, 'spillet er gemt')
    print('    (spillet ændrede sig under testen: %s)' % ('ja' if json.dumps(start, sort_keys=True) != json.dumps(foer, sort_keys=True) else 'NEJ'))
    if foer is None:
        pg.close(); return
    pg.reload(); pg.wait_for_timeout(500)
    k = pg.query_selector('.arkade-fortsaet-knap')
    vis = k is not None and k.is_visible()
    tjek(vis, 'Fortsæt vises i menuen')
    if vis:
        r = k.bounding_box()
        info = pg.text_content('.arkade-fortsaet-info')
        tjek(r['width'] >= 80 and r['height'] >= 80, 'Fortsæt er mindst 80 px (%dx%d)' % (r['width'], r['height']))
        tjek(bool(info.strip()), 'info: ' + info)
        pg.screenshot(path=os.environ.get('SKUD', '/tmp') + '/fortsaet_' + spil + '.png') if os.environ.get('SKUD') else None
        k.click(); pg.wait_for_timeout(cfg.get('vent', 300) + 300)
        synlig = pg.evaluate("[...document.querySelectorAll('.screen')].filter(s => !s.hidden).map(s => s.id)")
        tjek('menu' not in synlig and synlig, 'spillet vises igen ' + str(synlig))
        pg.evaluate("window.dispatchEvent(new Event('pagehide'))")
        efter = gemt(pg, spil)
        ens = json.dumps(foer, sort_keys=True) == json.dumps(efter, sort_keys=True)
        if not ens:
            a, c = foer if isinstance(foer, dict) else {}, efter if isinstance(efter, dict) else {}
            print('    forskel:', str(a)[:300], '\n    efter:  ', str(c)[:300])
        tjek(ens, 'samme spil efter Fortsæt')
        # Nyt spil spørger først
        pg.reload(); pg.wait_for_timeout(400)
        pg.click('#btn-start'); pg.wait_for_timeout(250)
        tjek(pg.is_visible('.arkade-bk'), 'Nyt spil spørger, før det gemte slettes')
    tjek(not log, 'ingen JS-fejl ' + str(log[:2]))
    pg.close()


def test_kasser(b, fejl):
    # Kasser har sin egen Fortsæt (næste bane): stillingen på banen skal stå, hvor man slap den
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    log = []
    pg.on('pageerror', lambda e: log.append(str(e)))
    pg.goto(ROD + 'kasser/index.html'); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(300)
    def tjek(ok, m):
        print(('  OK   ' if ok else '  FEJL '), m)
        if not ok: fejl.append('kasser: ' + m)
    pg.click('#btn-continue'); pg.wait_for_timeout(400)
    for k in ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight']:
        pg.keyboard.press(k); pg.wait_for_timeout(250)
    pg.evaluate("window.dispatchEvent(new Event('pagehide'))")
    foer = gemt(pg, 'kasser')
    tjek(foer is not None and foer['stilling']['moves'] > 0, 'stillingen er gemt')
    pg.click('#btn-pause'); pg.wait_for_timeout(150); pg.click('#btn-quit'); pg.wait_for_timeout(200)
    tjek('fortsætte' in pg.text_content('.arkade-bk-tekst'), 'Afslut siger, at banen gemmes')
    pg.mouse.move(3, 3); pg.click('.arkade-bk-ja'); pg.wait_for_timeout(200)
    pg.reload(); pg.wait_for_timeout(400)
    tjek(not pg.query_selector('.arkade-fortsaet-knap'), 'ingen ekstra Fortsæt-knap')
    pg.click('#btn-continue'); pg.wait_for_timeout(400)
    pg.evaluate("window.dispatchEvent(new Event('pagehide'))")
    efter = gemt(pg, 'kasser')
    tjek(foer is not None and efter == foer, 'samme stilling efter Fortsæt')
    tjek(not log, 'ingen JS-fejl ' + str(log[:2]))
    pg.close()


def main():
    valgt = sys.argv[1:] or list(SPIL) + ['kasser']
    fejl = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
        for s in valgt:
            print('==', s)
            if s == 'kasser': test_kasser(b, fejl)
            else: test(b, s, SPIL.get(s, {}), fejl)
        b.close()
    print('%d spil, %d fejl' % (len(valgt), len(fejl)))
    for f in fejl: print('  -', f)
    sys.exit(1 if fejl else 0)


if __name__ == '__main__':
    main()

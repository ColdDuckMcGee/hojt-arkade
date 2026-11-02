"""
Dagens udfordring (arkade/dagens.js).

For hvert spil:
  - knappen "Dagens udfordring" står i menuen og er mindst 80 px,
  - to spillere (hver sin browser) får præcis det samme spil i dag,
  - et spil, der afbrydes og fortsættes (Fortsæt), ender præcis som et uafbrudt spil med de samme klik,
  - et nyt spil uden Dagens udfordring er anderledes (frøet bruges kun i dagens udfordring),
  - menuen kan være der uden at rulle på små skærme.

Kør: python3 arkade/test/dagens_test.py [spil ...]
"""
import json, os, random, sys
from playwright.sync_api import sync_playwright

ROD = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')) + '/'
SPIL = {
    'slangen': {'klik': 25}, 'minestryger': {'klik': 20}, 'sudoku': {'klik': 40}, 'golf': {'klik': 8, 'vent': 4000},
    'muren': {'klik': 8, 'vent': 5000}, 'blokke': {'klik': 30}, 'kaelderen': {'klik': 25, 'vent': 900},
}
UNDGAA = '#btn-pause, .pause-btn, [id*="quit"], [id*="afslut"], [id*="hallen"], .js-fullscreen, [id*="settings"], [id*="indstil"], [id*="menu"], a[href], [id*="tip"], [id*="hint"]'
# Felter, der må være forskellige (tid, animation)
VOLATIL = {'tid', 'last', 'lastShot', 'haendelser', 'besked'}


def ren(d):
    if isinstance(d, dict): return {k: ren(v) for k, v in d.items() if k not in VOLATIL}
    if isinstance(d, list): return [ren(v) for v in d]
    return d


def gemt(pg, spil):
    return pg.evaluate("(k) => { try { return JSON.parse(localStorage.getItem(k)).data } catch (e) { return null } }", 'hojtArkade.' + spil + '.fortsaet')


def aben(pg, rng, n, vent=140):
    for _ in range(n):
        if pg.is_visible('.arkade-bk'):
            pg.mouse.move(3, 3); pg.wait_for_timeout(60); pg.click('.arkade-bk-nej'); pg.wait_for_timeout(120); continue
        idx = pg.evaluate("""(u) => { const scr = [...document.querySelectorAll('.screen')].find(s => !s.hidden); if (!scr) return [];
          return [...scr.querySelectorAll('button, [data-dwell]')].map((b, i) => [b, i]).filter(([b]) => {
            if (b.disabled || b.closest('[hidden]') || b.matches(u) || (b.closest('.overlay:not([hidden])') && !b.closest('.overlay').id.match(/done|level|next|clear/))) return false;
            const r = b.getBoundingClientRect(); return r.width > 4 && r.height > 4; }).map(([b, i]) => i); }""", UNDGAA)
        if not idx: pg.wait_for_timeout(200); continue
        i = idx[rng.randrange(len(idx))]
        pg.evaluate("([i]) => { const scr = [...document.querySelectorAll('.screen')].find(s => !s.hidden); scr.querySelectorAll('button, [data-dwell]')[i].click(); }", [i])
        pg.wait_for_timeout(vent)


def koer(b, spil, cfg, afbryd, dagens=True):
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    log = []
    pg.on('pageerror', lambda e: log.append(str(e)))
    pg.goto(ROD + spil + '/index.html'); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(300)
    pg.click('.arkade-dag-knap' if dagens else '#btn-start'); pg.wait_for_timeout(cfg.get('start', 600))
    if spil == 'kaelderen': pg.mouse.click(3, 3)
    start = gemt(pg, spil)
    n = cfg.get('klik', 20); rng = random.Random(11)
    aben(pg, rng, n // 2, cfg.get('pause', 160))
    pg.wait_for_timeout(cfg.get('vent', 400))
    if afbryd:
        pg.evaluate("window.dispatchEvent(new Event('pagehide'))"); pg.reload(); pg.wait_for_timeout(500)
        pg.click('.arkade-fortsaet-knap'); pg.wait_for_timeout(500)
    aben(pg, rng, n - n // 2, cfg.get('pause', 160))
    pg.wait_for_timeout(cfg.get('vent', 400))
    pg.evaluate("window.dispatchEvent(new Event('pagehide'))")
    slut = gemt(pg, spil)
    pg.close()
    return start, slut, log


def menu(b, spil, fejl):
    for vw, vh in [(1280, 720), (844, 390), (390, 844), (1920, 1080)]:
        pg = b.new_page(viewport={'width': vw, 'height': vh})
        pg.goto(ROD + spil + '/index.html'); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(500)
        r = pg.evaluate("""(() => { const m = document.getElementById('menu'), k = document.querySelector('.arkade-dag-knap');
          if (!k) return null; const kr = k.getBoundingClientRect();
          const small = [...m.querySelectorAll('button,a[href]')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(r => r.width < 80 || r.height < 80).length;
          const sh = document.getElementById('btn-start').getBoundingClientRect().height;
          return { w: Math.round(kr.width), h: Math.round(kr.height), start: Math.round(sh), small: small, over: m.scrollHeight > m.clientHeight + 1 || m.scrollWidth > m.clientWidth + 1 || kr.bottom > innerHeight + 1 } })()""")
        pg.close()
        ok = r and r['w'] >= 80 and r['h'] >= min(80, r['start']) and not r['over']   # aldrig mindre end Start-knappen
        print(('  OK   ' if ok else '  FEJL '), 'menu %dx%d' % (vw, vh), r)
        if not ok: fejl.append('%s: menu %dx%d %s' % (spil, vw, vh, r))


def main():
    valgt = sys.argv[1:] or list(SPIL)
    fejl = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
        for s in valgt:
            cfg = SPIL.get(s, {})
            print('==', s)
            def tjek(ok, m):
                print(('  OK   ' if ok else '  FEJL '), m)
                if not ok: fejl.append(s + ': ' + m)
            a = koer(b, s, cfg, False); c = koer(b, s, cfg, False); d = koer(b, s, cfg, True); e = koer(b, s, cfg, False, dagens=False)
            tjek(a[0] is not None and json.dumps(ren(a[0]), sort_keys=True) == json.dumps(ren(c[0]), sort_keys=True), 'to spillere får samme start')
            tjek(a[1] is not None and json.dumps(ren(a[1]), sort_keys=True) == json.dumps(ren(c[1]), sort_keys=True), 'samme klik giver samme spil')
            tjek(d[1] is not None and json.dumps(ren(a[1]), sort_keys=True) == json.dumps(ren(d[1]), sort_keys=True), 'afbrudt med Fortsæt giver samme spil')
            tjek(e[0] is not None and json.dumps(ren(e[0]), sort_keys=True) != json.dumps(ren(a[0]), sort_keys=True), 'Start spil giver et andet spil')
            tjek(a[0] is not None and a[0].get('dag') or (a[0] or {}).get('run', {}).get('dag'), 'gemt som dagens udfordring')
            tjek(not (a[2] + c[2] + d[2] + e[2]), 'ingen JS-fejl ' + str((a[2] + d[2])[:2]))
            menu(b, s, fejl)
        b.close()
    print('%d spil, %d fejl' % (len(valgt), len(fejl)))
    for f in fejl: print('  -', f)
    sys.exit(1 if fejl else 0)


if __name__ == '__main__':
    main()

"""
To spillere på én skærm (arkade/tospil.js).

For hvert spil: knappen "To spillere" står i menuen (mindst så stor som Start), et spil for to kan
startes og spilles (tilfældige klik, "Jeg er klar" ved turskift), Fortsæt husker, at det er et spil for
to, der kommer ingen JS-fejl, og menuen kan være der på små skærme.

Kør: python3 arkade/test/tospil_test.py [spil ...]
"""
import os, random, sys
from playwright.sync_api import sync_playwright

ROD = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')) + '/'
SPIL = {'fire-paa-stribe': {'klik': 30, 'pause': 700}, 'kanonen': {'klik': 10, 'pause': 4000}, 'billard': {'klik': 10, 'pause': 4000},
        'soeslag': {'klik': 40, 'pause': 600}, 'golf': {'klik': 12, 'pause': 3000}}
UNDGAA = '#btn-pause, .pause-btn, [id*="quit"], [id*="afslut"], [id*="hallen"], .js-fullscreen, [id*="settings"], [id*="indstil"], [id*="menu"], a[href]'


def aben(pg, rng, n, pause):
    for _ in range(n):
        if pg.is_visible('#skift-overlay'):
            pg.mouse.move(3, 3); pg.wait_for_timeout(60); pg.click('#btn-skift'); pg.wait_for_timeout(200); continue
        if pg.is_visible('.arkade-bk'):
            pg.mouse.move(3, 3); pg.wait_for_timeout(60); pg.click('.arkade-bk-nej'); pg.wait_for_timeout(150); continue
        idx = pg.evaluate("""(u) => { const scr = [...document.querySelectorAll('.screen')].find(s => !s.hidden); if (!scr) return [];
          return [...scr.querySelectorAll('button, [data-dwell], .col')].map((b, i) => [b, i]).filter(([b]) => {
            if (b.disabled || b.getAttribute('aria-disabled') === 'true' || b.closest('[hidden]') || b.matches(u)) return false;
            const r = b.getBoundingClientRect(); return r.width > 4 && r.height > 4; }).map(([b, i]) => i); }""", UNDGAA)
        if not idx: pg.wait_for_timeout(300); continue
        i = idx[rng.randrange(len(idx))]
        pg.evaluate("([i]) => { const scr = [...document.querySelectorAll('.screen')].find(s => !s.hidden); scr.querySelectorAll('button, [data-dwell], .col')[i].click(); }", [i])
        pg.wait_for_timeout(pause)


def main():
    valgt = sys.argv[1:] or list(SPIL)
    fejl = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
        for spil in valgt:
            cfg = SPIL.get(spil, {})
            print('==', spil)
            def tjek(ok, m):
                print(('  OK   ' if ok else '  FEJL '), m)
                if not ok: fejl.append(spil + ': ' + m)
            pg = b.new_page(viewport={'width': 1280, 'height': 720})
            log = []
            pg.on('pageerror', lambda e: log.append(str(e)))
            pg.goto(ROD + spil + '/index.html'); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(400)
            tjek(pg.is_visible('.arkade-to-knap'), 'knappen To spillere vises')
            pg.click('.arkade-to-knap'); pg.wait_for_timeout(600)
            synlig = pg.evaluate("[...document.querySelectorAll('.screen')].filter(s => !s.hidden).map(s => s.id)")
            tjek('game' in synlig, 'spillet starter ' + str(synlig))
            aben(pg, random.Random(5), cfg.get('klik', 20), cfg.get('pause', 500))
            pg.wait_for_timeout(1500)
            if pg.is_visible('#skift-overlay'):
                pg.mouse.move(3, 3); pg.click('#btn-skift'); pg.wait_for_timeout(300)
            pg.evaluate("window.dispatchEvent(new Event('pagehide'))")
            d = pg.evaluate("(k) => { try { return JSON.parse(localStorage.getItem(k)).data } catch (e) { return null } }", 'hojtArkade.' + spil + '.fortsaet')
            er_to = d is not None and bool(d.get('to') or (d.get('run') or {}).get('to') or (d.get('state') or {}).get('to'))
            tjek(er_to, 'gemt som spil for to')
            if d is not None:
                pg.reload(); pg.wait_for_timeout(500)
                info = pg.text_content('.arkade-fortsaet-info') or ''
                tjek('To spillere' in info, 'Fortsæt viser "To spillere": ' + info)
                pg.click('.arkade-fortsaet-knap'); pg.wait_for_timeout(600)
                aben(pg, random.Random(9), 6, cfg.get('pause', 500))
            tjek(not log, 'ingen JS-fejl ' + str(log[:2]))
            pg.close()
            for vw, vh in [(1280, 720), (844, 390), (390, 844), (1920, 1080)]:
                pg = b.new_page(viewport={'width': vw, 'height': vh})
                pg.goto(ROD + spil + '/index.html'); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(500)
                r = pg.evaluate("""(() => { const m = document.getElementById('menu'), k = document.querySelector('.arkade-to-knap'), s = document.getElementById('btn-start');
                  const kr = k.getBoundingClientRect(), sr = s.getBoundingClientRect();
                  return { w: Math.round(kr.width), h: Math.round(kr.height), start: Math.round(sr.height),
                    over: m.scrollHeight > m.clientHeight + 1 || m.scrollWidth > m.clientWidth + 1 || kr.bottom > innerHeight + 1 || kr.right > innerWidth + 1 } })()""")
                pg.close()
                ok = r['w'] >= 80 and r['h'] >= min(80, r['start']) and not r['over']
                tjek(ok, 'menu %dx%d %s' % (vw, vh, r))
        b.close()
    print('%d spil, %d fejl' % (len(valgt), len(fejl)))
    for f in fejl: print('  -', f)
    sys.exit(1 if fejl else 0)


if __name__ == '__main__':
    main()

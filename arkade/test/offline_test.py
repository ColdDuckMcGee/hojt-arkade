# Test af service workeren (sw.js + arkade/offline.js) over en lokal webserver.
# Kører på en kopi af arkaden, så "serveren" kan få en ny version undervejs.
#   python3 arkade/test/offline_test.py
# Tjekker: første besøg, hallen og et spillet spil uden net, et ikke-hentet spil uden net
# (rolig besked), at en ny version på serveren bruges med det samme, at meget langsomt net
# bruger den lokale kopi uden at blande gamle og nye filer, og at intet sker fra disken.
import os, sys, shutil, pathlib, tempfile, threading, functools, http.server, socketserver, time
from playwright.sync_api import sync_playwright

SRC = pathlib.Path(__file__).resolve().parent.parent.parent
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
fails = []
def check(ok, msg):
    print(('OK   ' if ok else 'FEJL ') + msg)
    if not ok: fails.append(msg)

tmp = pathlib.Path(tempfile.mkdtemp(prefix='hojt-offline-'))
root = tmp / 'site'
shutil.copytree(SRC, root, ignore=shutil.ignore_patterns('.git', 'test', 'api', '*.py'))

LANGSOM = [0]       # sekunder, serveren venter før hvert svar (meget langsomt net)
class Stille(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if LANGSOM[0]: time.sleep(LANGSOM[0])
        return super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')     # som en server, der altid tjekker for ny version
        super().end_headers()
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Stille, directory=str(root)))
srv.daemon_threads = True
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:%d/' % port

def marker(navn, tekst):
    p = root / navn; t = p.read_text()
    t = t.replace('window.HOJT_SPIL = [', 'window.__V = %r; window.HOJT_SPIL = [' % tekst, 1)
    p.write_text(t)

with sync_playwright() as p:
    br = p.chromium.launch(executable_path=CHROME)
    ctx = br.new_context(viewport={'width': 1280, 'height': 720})
    errs = []
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(300)
    pg.evaluate("() => localStorage.setItem('hojtArkade.styring.indstillinger', JSON.stringify({valg: 'mus'}))")
    # 1. Første besøg: service workeren installeres og styrer siden efter genindlæsning
    pg.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.ready.then(() => true)", timeout=8000)
    pg.wait_for_timeout(800)
    pg.reload(); pg.wait_for_timeout(600)
    check(pg.evaluate("!!navigator.serviceWorker.controller"), 'service workeren styrer hallen efter første besøg')
    # et spil spilles online (så det gemmes)
    pg.goto(URL + 'slangen/index.html'); pg.wait_for_timeout(800)
    pg.locator('#btn-start').click(); pg.wait_for_timeout(400)
    check(pg.evaluate("[...document.querySelectorAll('.screen')].some(s => !s.hidden && s.id === 'game')"), 'Slangen kan startes online')

    # 2. Uden net
    ctx.set_offline(True)
    pg.goto(URL); pg.wait_for_timeout(800)
    check(pg.evaluate("!!document.querySelector('#btn-spil') && !!window.HOJT_SPIL && window.HOJT_SPIL.length > 20"), 'hallen virker uden net')
    pg.goto(URL + 'slangen/index.html'); pg.wait_for_timeout(800)
    pg.locator('#btn-start').click(); pg.wait_for_timeout(400)
    check(pg.evaluate("[...document.querySelectorAll('.screen')].some(s => !s.hidden && s.id === 'game')"), 'Slangen virker uden net (spillet før)')
    pg.goto(URL + 'sudoku/index.html'); pg.wait_for_timeout(600)
    txt = pg.evaluate("document.body.innerText")
    knap = pg.evaluate("(() => { const a = document.querySelector('a'); if (!a) return null; const r = a.getBoundingClientRect(); return [a.href, Math.round(r.width), Math.round(r.height)]; })()")
    check('Ingen forbindelse' in txt and knap and knap[0] == URL and min(knap[1], knap[2]) >= 84, 'et ikke-hentet spil viser en rolig besked med stor knap tilbage (%s)' % knap)
    ctx.set_offline(False)

    # 3. Ny version på serveren bruges med det samme, når der er net
    marker('games.js', 'NY-VERSION-1')
    pg.goto(URL); pg.wait_for_timeout(800)
    src = pg.evaluate("fetch('games.js').then(r => r.text())")
    check('NY-VERSION-1' in src, 'en ny version på serveren bruges med det samme (ingen gammel kopi)')

    # 4. Meget langsomt net: den lokale kopi bruges, og siden blandes ikke
    marker('games.js', 'NY-VERSION-2')                 # serveren har nu en nyere games.js end kopien
    LANGSOM[0] = 6                                     # serveren svarer først efter 6 s
    t0 = time.time()
    pg.goto(URL, wait_until='load', timeout=20000)
    sek = time.time() - t0
    pg.wait_for_timeout(300)
    check(2.0 < sek < 5.5 and pg.evaluate("!!window.HOJT_SPIL"), 'meget langsomt net: hallen kommer fra kopien på %.1f s (uden service worker: over 6 s)' % sek)
    v = pg.evaluate("window.__V || null")
    check(v == 'NY-VERSION-1', 'meget langsomt net: siden og dens filer kommer fra samme kopi, ingen blanding (games.js = %s)' % v)
    LANGSOM[0] = 0
    # Den langsomme hentning af siden skal være færdig (Chromes HTTP-cache lader kun én hentning af
    # samme adresse være i gang ad gangen); ved et rigtigt næste besøg er den det for længst.
    time.sleep(6.5)
    pg.goto(URL); pg.wait_for_timeout(600)
    v = pg.evaluate("window.__V || null")
    check(v == 'NY-VERSION-2', 'når nettet er normalt igen, bruges den nye version straks (games.js = %s)' % v)

    check(not errs, 'ingen JS-fejl (%s)' % errs[:2])
    ctx.close()

    # 5. Fra disken: ingen service worker
    c2 = br.new_context(); pg2 = c2.new_page()
    pg2.goto((SRC / 'index.html').as_uri()); pg2.wait_for_timeout(800)
    check(not pg2.evaluate("!!(navigator.serviceWorker && navigator.serviceWorker.controller)"), 'fra disken (file://) registreres ingen service worker')
    c2.close()
    br.close()
srv.shutdown()
shutil.rmtree(tmp, ignore_errors=True)
print('%d fejl' % len(fails))
sys.exit(1 if fails else 0)

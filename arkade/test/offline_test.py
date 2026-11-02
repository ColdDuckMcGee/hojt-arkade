# Test af service workeren (sw.js + arkade/offline.js) over en lokal webserver.
# Kører på en kopi af arkaden, så "serveren" kan få en ny udgave undervejs. Serveren sender
# Cache-Control: max-age=600 ligesom GitHub Pages, så browseren gerne må genbruge gamle filer.
#   python3 arkade/test/offline_test.py
# Tjekker, at spillerne altid får den nyeste udgave:
#  - en ny udgave bruges ved næste sideindlæsning, selv om browseren må genbruge den gamle i 10 min,
#  - meget langsomt net venter på serveren i stedet for at vise en gammel udgave,
#  - en side, der står åben, opdager en ny udgave, venter under spillet og genindlæses i menuen,
# og at offline stadig virker (hallen, et spillet spil, rolig besked for et ikke-hentet spil),
# og at intet sker fra disken.
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
class Server(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if LANGSOM[0]: time.sleep(LANGSOM[0])
        return super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control', 'max-age=600')   # som GitHub Pages: gamle filer må genbruges i 10 min
        super().end_headers()
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Server, directory=str(root)))
srv.daemon_threads = True
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:%d/' % port

nyTid = [time.time() + 10]
def udgiv(navn, find, erstat):
    """En ny udgave af en fil på serveren (med en senere ændringstid, så serveren ikke svarer 'uændret')."""
    p = root / navn; t = p.read_text()
    assert find in t, (navn, find)
    p.write_text(t.replace(find, erstat, 1))
    nyTid[0] += 5
    os.utime(p, (nyTid[0], nyTid[0]))
def games_v(v):
    p = root / 'games.js'; t = p.read_text()
    if 'window.__V' in t: t = t.split('window.HOJT_SPIL = [', 1); t = 'window.HOJT_SPIL = ['.join([t[0][:t[0].index('window.__V')], t[1]])
    p.write_text(t)
    udgiv('games.js', 'window.HOJT_SPIL = [', 'window.__V = %r; window.HOJT_SPIL = [' % v)

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
    pg.goto(URL + 'slangen/index.html'); pg.wait_for_timeout(800)
    pg.evaluate("Object.keys(localStorage).filter(function (k) { return /\\.fortsaet$/.test(k); }).forEach(function (k) { localStorage.removeItem(k); })")   # Slangen fra før ligger gemt (fortsaet.js): Start skal starte med det samme
    pg.locator('#btn-start').click(); pg.wait_for_timeout(400)
    check(pg.evaluate("[...document.querySelectorAll('.screen')].some(s => !s.hidden && s.id === 'game')"), 'Slangen kan startes online')

    # 2. Ny udgave bruges ved næste indlæsning, selv om browseren må genbruge den gamle i 10 minutter
    pg.goto(URL); pg.wait_for_timeout(500)
    games_v('NY-1')
    pg.goto(URL); pg.wait_for_timeout(500)
    v = pg.evaluate("window.__V || null")
    check(v == 'NY-1', 'en ny udgave bruges straks, trods max-age=600 (games.js = %s)' % v)
    games_v('NY-2')
    pg.reload(); pg.wait_for_timeout(500)
    v = pg.evaluate("window.__V || null")
    check(v == 'NY-2', 'også ved genindlæsning få sekunder efter (games.js = %s)' % v)

    # 3. Meget langsomt net: vent på serveren, aldrig en gammel udgave, mens der er net
    games_v('NY-3')
    LANGSOM[0] = 4
    t0 = time.time()
    pg.goto(URL, wait_until='load', timeout=60000)
    sek = time.time() - t0
    LANGSOM[0] = 0
    pg.wait_for_timeout(300)
    v = pg.evaluate("window.__V || null")
    check(v == 'NY-3', 'meget langsomt net: siden venter på serveren og får den nye udgave (games.js = %s, %.1f s)' % (v, sek))

    # 4. En side, der står åben: opdager ny udgave, venter under spillet, genindlæses i menuen
    pg.goto(URL + 'slangen/index.html'); pg.wait_for_timeout(800)
    pg.evaluate("ArkadeOffline.snapshot()")
    pg.evaluate("() => { window.__samme = 1; Object.keys(localStorage).filter(function (k) { return /\\.fortsaet$/.test(k); }).forEach(function (k) { localStorage.removeItem(k); }); }")   # intet gemt spil: Start starter med det samme
    pg.locator('#btn-start').click(); pg.wait_for_timeout(300)
    check(pg.evaluate("ArkadeOffline.tjek()") is False, 'åben side: ingen ny udgave, før der er en')
    udgiv('slangen/js/render.js', '(function', 'window.__R = "R2";\n(function')
    ny = pg.evaluate("ArkadeOffline.tjek()")
    pg.wait_for_timeout(500)
    check(ny is True and pg.evaluate("ArkadeOffline.ventende"), 'åben side: den nye udgave opdages')
    check(pg.evaluate("window.__samme === 1") and pg.evaluate("[...document.querySelectorAll('.screen')].some(s => !s.hidden && s.id === 'game')"),
          'åben side: midt i spillet genindlæses der ikke')
    pg.locator('#btn-pause').click(); pg.wait_for_timeout(300)
    pg.locator('#btn-quit').click(); pg.wait_for_timeout(300)
    check(pg.evaluate("window.__samme === 1"), 'åben side: heller ikke mens dialogen "Vil du forlade spillet?" er åben')
    pg.mouse.move(2, 2)
    with pg.expect_navigation(timeout=8000):
        pg.locator('.arkade-bk-ja').click()
    pg.wait_for_timeout(800)
    check(pg.evaluate("window.__samme === undefined && window.__R === 'R2'") and pg.evaluate("[...document.querySelectorAll('.screen')].some(s => !s.hidden && s.id === 'menu')"),
          'åben side: genindlæses med den nye udgave, når spilleren går til menuen')

    # 5. Uden net
    pg.goto(URL); pg.wait_for_timeout(600)
    ctx.set_offline(True)
    pg.goto(URL); pg.wait_for_timeout(800)
    check(pg.evaluate("!!document.querySelector('#btn-spil') && !!window.HOJT_SPIL && window.HOJT_SPIL.length > 20"), 'hallen virker uden net')
    pg.goto(URL + 'slangen/index.html'); pg.wait_for_timeout(800)
    pg.evaluate("Object.keys(localStorage).filter(function (k) { return /\\.fortsaet$/.test(k); }).forEach(function (k) { localStorage.removeItem(k); })")   # Slangen fra før ligger gemt (fortsaet.js)
    pg.locator('#btn-start').click(); pg.wait_for_timeout(400)
    check(pg.evaluate("[...document.querySelectorAll('.screen')].some(s => !s.hidden && s.id === 'game')"), 'Slangen virker uden net (spillet før)')
    pg.goto(URL + 'sudoku/index.html'); pg.wait_for_timeout(600)
    txt = pg.evaluate("document.body.innerText")
    knap = pg.evaluate("(() => { const a = document.querySelector('a'); if (!a) return null; const r = a.getBoundingClientRect(); return [a.href, Math.round(r.width), Math.round(r.height)]; })()")
    check('Ingen forbindelse' in txt and knap and knap[0] == URL and min(knap[1], knap[2]) >= 84, 'et ikke-hentet spil viser en rolig besked med stor knap tilbage (%s)' % knap)
    ctx.set_offline(False)
    games_v('NY-4')
    pg.goto(URL); pg.wait_for_timeout(600)
    v = pg.evaluate("window.__V || null")
    check(v == 'NY-4', 'når nettet er tilbage, bruges den nyeste udgave straks (games.js = %s)' % v)

    check(not errs, 'ingen JS-fejl (%s)' % errs[:2])
    ctx.close()

    # 6. Fra disken: ingen service worker
    c2 = br.new_context(); pg2 = c2.new_page()
    pg2.goto((SRC / 'index.html').as_uri()); pg2.wait_for_timeout(800)
    check(not pg2.evaluate("!!(navigator.serviceWorker && navigator.serviceWorker.controller)") and not pg2.evaluate("!!window.ArkadeOffline"),
          'fra disken (file://) registreres ingen service worker')
    c2.close()
    br.close()
srv.shutdown()
shutil.rmtree(tmp, ignore_errors=True)
print('%d fejl' % len(fails))
sys.exit(1 if fails else 0)

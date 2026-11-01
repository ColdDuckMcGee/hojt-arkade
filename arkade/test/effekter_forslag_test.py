# Test af forslaget om "Begræns effekter" (arkade/effekter.js).
#  1. Slangen gøres kunstigt langsom i 22 s spil: forslaget kommer ikke midt i spillet, men når
#     spilleren går til menuen. Ja slår indstillingen til og genindlæser.
#  2. Nej: der spørges aldrig igen, heller ikke i et andet spil.
#  3. En hurtig computer (ingen lange billeder) får intet forslag.
#  4. Uden grafikkort: forslaget kommer straks i hallen (og i et spils menu), men aldrig midt i et spil.
#  5. Grafikkort-tjekket selv: software-renderere genkendes, et rigtigt grafikkort gør ikke.
#   python3 arkade/test/effekter_forslag_test.py
import os, sys, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
fails = []
def check(ok, msg):
    print(('OK   ' if ok else 'FEJL ') + msg)
    if not ok: fails.append(msg)
TOM = "() => { localStorage.clear(); localStorage.setItem('hojtArkade.effekterTest', '1'); localStorage.setItem('hojtArkade.arkade.indstillinger', JSON.stringify({music: false, sound: false})); localStorage.setItem('hojtArkade.styring.indstillinger', JSON.stringify({valg: 'mus'})); }"
DIALOG = "() => !!window.ArkadeBekraeft && ArkadeBekraeft.aaben() && /langsomt/.test(document.querySelector('.arkade-bk-titel').textContent)"
def til_menu(pg):
    pg.locator('#btn-pause').click(); pg.wait_for_timeout(200)
    pg.locator('#btn-quit').click(); pg.wait_for_timeout(200)
    pg.mouse.move(2, 2); pg.locator('.arkade-bk-ja').click(); pg.wait_for_timeout(400)

with sync_playwright() as p:
    br = p.chromium.launch(executable_path=CHROME)
    # 1. Langsom computer
    pg = br.new_page(viewport={'width': 1280, 'height': 720}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto((ROOT / 'slangen' / 'index.html').as_uri()); pg.evaluate(TOM); pg.reload(); pg.wait_for_timeout(300)
    pg.locator('#btn-start').click(); pg.wait_for_timeout(200)
    # hvert billede tager 120 ms (som en meget langsom computer)
    pg.evaluate("() => { const lang = () => { const t = performance.now(); while (performance.now() - t < 120) {} if (!window.__stop) requestAnimationFrame(lang); }; requestAnimationFrame(lang); }")
    pg.wait_for_timeout(23000)
    pg.evaluate("() => { window.__stop = true; }"); pg.wait_for_timeout(300)
    m = pg.evaluate("() => ArkadeEffekterForslag.maaling")
    check(not pg.evaluate(DIALOG), 'langsom: intet forslag midt i spillet (målt %s)' % m)
    til_menu(pg)
    check(pg.evaluate(DIALOG), 'langsom: forslaget kommer, når spilleren går til menuen')
    knapper = pg.evaluate("() => [...document.querySelectorAll('.arkade-bk button')].map(b => b.textContent.trim().replace(/\\s+/g, ' '))")
    check(len(knapper) == 2 and 'Nej tak' in knapper[0] and pg.evaluate("() => document.activeElement === document.querySelector('.arkade-bk-nej')"), 'langsom: "Nej tak" står først og har fokus (%s)' % knapper)
    pg.mouse.move(2, 2)
    with pg.expect_navigation(timeout=5000):
        pg.locator('.arkade-bk-ja').click()
    pg.wait_for_timeout(500)
    s = pg.evaluate("() => [document.documentElement.getAttribute('data-effekter'), JSON.parse(localStorage.getItem('hojtArkade.arkade.indstillinger')).begraensEffekter, localStorage.getItem('hojtArkade.effekterForslag')]")
    check(s == ['begraenset', True, 'ja'], 'langsom: Ja slår Begræns effekter til og genindlæser (%s)' % s)
    check(not errs, 'langsom: ingen JS-fejl (%s)' % errs[:2])
    pg.close()

    # 2. Nej: aldrig igen
    pg = br.new_page(viewport={'width': 1280, 'height': 720})
    pg.goto((ROOT / 'bomberne' / 'index.html').as_uri()); pg.evaluate(TOM); pg.reload(); pg.wait_for_timeout(300)
    pg.locator('#btn-start').click(); pg.wait_for_timeout(200)
    pg.evaluate("() => ArkadeEffekterForslag.langsom()")
    til_menu(pg)
    check(pg.evaluate(DIALOG), 'nej: forslaget vises i menuen')
    pg.mouse.move(2, 2); pg.locator('.arkade-bk-nej').click(); pg.wait_for_timeout(300)
    check(pg.evaluate("() => !ArkadeBekraeft.aaben() && localStorage.getItem('hojtArkade.effekterForslag') === 'nej' && !document.documentElement.hasAttribute('data-effekter')"), 'nej: dialogen lukker, og intet ændres')
    pg.goto((ROOT / 'slangen' / 'index.html').as_uri()); pg.wait_for_timeout(300)
    pg.locator('#btn-start').click(); pg.wait_for_timeout(200)
    pg.evaluate("() => ArkadeEffekterForslag.langsom()")
    til_menu(pg)
    check(not pg.evaluate(DIALOG), 'nej: der spørges aldrig igen, heller ikke i et andet spil')
    pg.close()

    # 3. Hurtig computer: intet forslag
    pg = br.new_page(viewport={'width': 1280, 'height': 720})
    pg.goto((ROOT / 'froeen' / 'index.html').as_uri()); pg.evaluate(TOM); pg.reload(); pg.wait_for_timeout(300)
    pg.locator('#btn-start').click(); pg.wait_for_timeout(22000)
    m = pg.evaluate("() => ArkadeEffekterForslag.maaling")
    til_menu(pg)
    check(not pg.evaluate(DIALOG), 'hurtig: intet forslag (målt %s)' % m)
    pg.close()

    # 4. Uden grafikkort
    GPU = TOM[:-2] + " localStorage.setItem('hojtArkade.effekterTestGpu', 'ja'); }"
    GDIALOG = "() => !!window.ArkadeBekraeft && ArkadeBekraeft.aaben() && /grafikkort/.test(document.querySelector('.arkade-bk').textContent)"
    pg = br.new_page(viewport={'width': 1280, 'height': 720}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto((ROOT / 'index.html').as_uri()); pg.evaluate(GPU); pg.reload(); pg.wait_for_timeout(2500)
    check(pg.evaluate(GDIALOG), 'grafikkort: forslaget kommer straks i hallen')
    pg.mouse.move(2, 2); pg.locator('.arkade-bk-nej').click(); pg.wait_for_timeout(300)
    check(pg.evaluate("() => localStorage.getItem('hojtArkade.effekterForslag')") == 'nej', 'grafikkort: Nej huskes')
    pg.reload(); pg.wait_for_timeout(2500)
    check(not pg.evaluate("() => ArkadeBekraeft.aaben()"), 'grafikkort: der spørges ikke igen efter Nej')
    check(not errs, 'grafikkort: ingen JS-fejl (%s)' % errs[:2])
    pg.close()
    # i et spil: ikke midt i spillet, men i menuen
    pg = br.new_page(viewport={'width': 1280, 'height': 720})
    pg.goto((ROOT / 'slangen' / 'index.html').as_uri()); pg.evaluate(GPU); pg.reload(); pg.wait_for_timeout(200)
    pg.locator('#btn-start').click(); pg.wait_for_timeout(3000)
    check(not pg.evaluate(GDIALOG), 'grafikkort: intet forslag midt i spillet')
    til_menu(pg)
    check(pg.evaluate(GDIALOG), 'grafikkort: forslaget kommer i spillets menu')
    pg.close()

    # 5. Selve tjekket
    pg = br.new_page(viewport={'width': 1280, 'height': 720})
    pg.goto((ROOT / 'index.html').as_uri()); pg.wait_for_timeout(200)
    r = pg.evaluate("""() => {
      const ud = { sw: ArkadeEffekterForslag.utenGrafikkort() };   // denne testmaskine har intet grafikkort (SwiftShader)
      const orig = HTMLCanvasElement.prototype.getContext;
      const falsk = navn => function () { return { getExtension: x => x === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 1 } : null, getParameter: () => navn, RENDERER: 2 }; };
      for (const [k, n] of [['nvidia', 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Direct3D11 vs_5_0 ps_5_0)'], ['intel', 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)'],
                            ['basic', 'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11)'], ['llvm', 'llvmpipe (LLVM 15.0.7, 256 bits)']]) {
        HTMLCanvasElement.prototype.getContext = falsk(n); ud[k] = ArkadeEffekterForslag.utenGrafikkort(); }
      HTMLCanvasElement.prototype.getContext = () => null; ud.ingenWebgl = ArkadeEffekterForslag.utenGrafikkort();
      HTMLCanvasElement.prototype.getContext = orig; return ud; }""")
    check(r == {'sw': True, 'nvidia': False, 'intel': False, 'basic': True, 'llvm': True, 'ingenWebgl': True}, 'tjek: software genkendes, rigtige grafikkort ikke (%s)' % r)
    pg.close()
    br.close()
print('%d fejl' % len(fails)); sys.exit(1 if fails else 0)

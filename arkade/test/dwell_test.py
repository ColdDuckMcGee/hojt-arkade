# Test af blik-låsen i arkade/dwell.js: ét blik = én handling.
# "Blikket" er musen, der hviler stille (med en lille rystelse), som hos en øjenstyringsbruger.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 arkade/test/dwell_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome
import os, sys, pathlib
from playwright.sync_api import sync_playwright

URL = (pathlib.Path(__file__).resolve().parent / 'dwell_side.html').as_uri()
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
DWELL = 400          # ms, som på testsiden
fails = []

def midt(pg, sel):
    b = pg.locator(sel).bounding_box()
    return b['x'] + b['width'] / 2, b['y'] + b['height'] / 2

def kig(pg, x, y):
    pg.mouse.move(x, y)
    pg.mouse.move(x + 1, y)          # lille rystelse

def ny_side(br):
    pg = br.new_page(viewport={'width': 1000, 'height': 700})
    pg.goto(URL)
    pg.wait_for_timeout(150)
    kig(pg, 900, 650)                # start et neutralt sted
    pg.wait_for_timeout(100)
    pg.evaluate('() => { window.klik = []; }')
    return pg

def klik(pg):
    return pg.evaluate('() => window.klik.slice()')

def test(navn, fn, br):
    pg = ny_side(br)
    try:
        fn(pg)
        print('OK  ', navn)
    except Exception as e:
        fails.append(navn)
        print('FEJL', navn, '-', str(e).splitlines()[0])
    finally:
        pg.close()

def samme_knap_deaktiveres(pg):
    # Kanonen: Skyd deaktiveres under computerens tur og bliver aktiv igen under blikket
    kig(pg, *midt(pg, '#a'))
    pg.wait_for_timeout(DWELL + 200)
    assert klik(pg) == ['a'], 'første dwell skal give ét klik, fik %s' % klik(pg)
    pg.evaluate("() => { document.querySelector('#a').disabled = true; }")
    pg.wait_for_timeout(300)
    pg.evaluate("() => { document.querySelector('#a').disabled = false; }")
    pg.wait_for_timeout(DWELL * 4)
    assert klik(pg) == ['a'], 'knappen må ikke vælges igen uden et nyt blik, fik %s' % klik(pg)
    kig(pg, *midt(pg, '#c')); pg.wait_for_timeout(100)        # kig væk (ud over C's halve dwell)
    kig(pg, 900, 650); pg.wait_for_timeout(100)
    kig(pg, *midt(pg, '#a'))
    pg.wait_for_timeout(DWELL + 200)
    assert klik(pg) == ['a', 'a'], 'efter et nyt blik skal knappen kunne vælges, fik %s' % klik(pg)

def ny_knap_samme_sted(pg):
    # Minestryger-zoom / velkomstens trin 2: en ny knap dukker op lige under blikket
    pg.evaluate("""() => document.querySelector('#a').addEventListener('click', () => {
        document.querySelector('#a').hidden = true; document.querySelector('#b').hidden = false; })""")
    x, y = midt(pg, '#a')
    kig(pg, x, y)
    pg.wait_for_timeout(DWELL * 4)
    assert klik(pg) == ['a'], 'B må ikke vælges uden et nyt blik, fik %s' % klik(pg)
    kig(pg, x + 30, y + 10)                                     # lille rystelse < 48 px
    pg.wait_for_timeout(DWELL * 2)
    assert klik(pg) == ['a'], 'en rystelse på 30 px er ikke et nyt blik, fik %s' % klik(pg)
    kig(pg, x + 60, y + 20)                                     # bevidst flyt inden for B
    pg.wait_for_timeout(DWELL + 200)
    assert klik(pg) == ['a', 'b'], 'efter et flyt på 60 px skal B kunne vælges, fik %s' % klik(pg)

def reset_laaser_dialog(pg):
    # Et spil åbner en dialog af sig selv (game over) og kalder reset(): OK ligger under blikket
    x, y = midt(pg, '#a')
    kig(pg, x, y)
    pg.wait_for_timeout(DWELL / 2)
    pg.evaluate("() => { document.querySelector('#dialog').hidden = false; window.dwell.reset(); }")
    pg.wait_for_timeout(DWELL * 4)
    assert klik(pg) == [], 'OK må ikke vælges uden et nyt blik, fik %s' % klik(pg)
    kig(pg, 900, 650); pg.wait_for_timeout(100)
    kig(pg, x, y)
    pg.wait_for_timeout(DWELL + 200)
    assert klik(pg) == ['ok'], 'efter et nyt blik skal OK kunne vælges, fik %s' % klik(pg)

def gentagelse_virker(pg):
    kig(pg, *midt(pg, '#gentag'))
    pg.wait_for_timeout(DWELL * 3 + 250)
    n = klik(pg).count('gentag')
    assert n >= 3, 'en knap med data-dwell-repeat skal gentage sig, fik %d klik' % n
    pg.evaluate('() => window.dwell.reset()')                  # spillet kalder reset() efter hvert træk
    pg.wait_for_timeout(DWELL * 2 + 150)
    assert klik(pg).count('gentag') >= n + 2, 'reset() må ikke stoppe gentagelse, fik %s' % klik(pg)

def sideindlaesning(pg):
    # Blikket står på en knap, når siden indlæses: den må ikke vælges af sig selv
    pg.goto(URL)
    pg.evaluate('() => { window.klik = []; }')
    x, y = midt(pg, '#a')
    kig(pg, x, y)
    pg.wait_for_timeout(DWELL * 4)
    assert klik(pg) == [], 'knappen under blikket ved indlæsning må ikke vælges, fik %s' % klik(pg)
    kig(pg, 900, 650); pg.wait_for_timeout(100)
    kig(pg, x, y)
    pg.wait_for_timeout(DWELL + 200)
    assert klik(pg) == ['a'], 'efter et nyt blik skal knappen kunne vælges, fik %s' % klik(pg)

def sent_blik_efter_indlaesning(pg):
    # Kommer blikket først ind på knappen et stykke tid efter indlæsningen, låses den ikke
    pg.goto(URL)
    pg.evaluate('() => { window.klik = []; }')
    pg.wait_for_timeout(900)
    kig(pg, *midt(pg, '#a'))
    pg.wait_for_timeout(DWELL + 200)
    assert klik(pg) == ['a'], 'et blik, der kommer senere end 0,6 s efter indlæsning, skal virke, fik %s' % klik(pg)

def rystelse_over_kanten(pg):
    # Blikket glider kort ud over kanten (150 ms): ringen fortsætter i stedet for at starte forfra
    x, y = midt(pg, '#a')
    kig(pg, x, y)
    pg.wait_for_timeout(DWELL * 0.6)
    kig(pg, x, y + 120)                                         # lige under knappen, ingen knap dér
    pg.wait_for_timeout(150)
    kig(pg, x, y)
    pg.wait_for_timeout(DWELL * 0.6)
    assert klik(pg) == ['a'], 'en kort rystelse må ikke nulstille ringen, fik %s' % klik(pg)

def laengere_vaek_nulstiller(pg):
    x, y = midt(pg, '#a')
    kig(pg, x, y)
    pg.wait_for_timeout(DWELL * 0.6)
    kig(pg, x, y + 120)
    pg.wait_for_timeout(500)                                    # længere end 250 ms
    kig(pg, x, y)
    pg.wait_for_timeout(DWELL * 0.6)
    assert klik(pg) == [], 'efter et rigtigt blik væk skal ringen starte forfra, fik %s' % klik(pg)
    pg.wait_for_timeout(DWELL * 0.6)
    assert klik(pg) == ['a'], 'en fuld dwell-tid skal stadig vælge, fik %s' % klik(pg)

def release_slipper(pg):
    x, y = midt(pg, '#a')
    kig(pg, x, y)
    pg.wait_for_timeout(DWELL + 200)
    pg.evaluate('() => window.dwell.release()')
    pg.wait_for_timeout(DWELL + 200)
    assert klik(pg) == ['a', 'a'], 'release() skal slippe låsen, fik %s' % klik(pg)

def almindeligt_klik(pg):
    # Mus og eget øjenstyringsprogram (rigtige klik) påvirkes ikke af låsen
    pg.evaluate('() => window.dwell.setEnabled(false)')
    x, y = midt(pg, '#a')
    pg.mouse.click(x, y); pg.mouse.click(x, y); pg.mouse.click(x, y)
    assert klik(pg) == ['a', 'a', 'a'], 'rigtige klik skal altid virke, fik %s' % klik(pg)

with sync_playwright() as p:
    br = p.chromium.launch(executable_path=CHROME)
    for navn, fn in [
        ('samme knap deaktiveres og bliver aktiv igen under blikket', samme_knap_deaktiveres),
        ('ny knap dukker op samme sted (zoom, nyt trin)', ny_knap_samme_sted),
        ('reset() låser en dialog, der åbner under blikket', reset_laaser_dialog),
        ('data-dwell-repeat gentager stadig, også efter reset()', gentagelse_virker),
        ('knappen under blikket ved sideindlæsning vælges ikke', sideindlaesning),
        ('blik, der kommer senere efter indlæsning, virker', sent_blik_efter_indlaesning),
        ('kort rystelse over kanten nulstiller ikke ringen', rystelse_over_kanten),
        ('rigtigt blik væk nulstiller ringen', laengere_vaek_nulstiller),
        ('release() slipper låsen', release_slipper),
        ('almindelige klik virker altid', almindeligt_klik),
    ]:
        test(navn, fn, br)
    br.close()

print('%d test, %d fejl' % (10, len(fails)))
sys.exit(1 if fails else 0)

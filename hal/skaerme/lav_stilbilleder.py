# Laver hallens skærmbilleder i stilene tegneserie og retro-pixel ud fra selve spillene:
# hvert spil startes i stilen, spillepladen fotograferes og gemmes som hal/skaerme/<stil>/<id>.webp
# (488 × 444, samme format som maskinens skærm). Listen over færdige billeder skrives i games.js
# (window.HOJT_STIL_SKAERME), så hallen ved, hvilke der findes.
#   python3 hal/skaerme/lav_stilbilleder.py            ONLY=slangen,flipper
import os, io, re, pathlib
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
spil = re.findall(r"sti: '([^/']+)/'.*?status: 'aktiv'", (ROOT / 'games.js').read_text())
if os.environ.get('ONLY'): spil = [g for g in spil if g in os.environ['ONLY'].split(',')]
BRAET = '#board, .board, #field, #view, #sea, .sea, #kort, #game canvas'
EFTER_START = {   # spil, hvor der skal vælges noget mere, før pladen vises
  'taarnene': "() => document.querySelector('#bane-valg button')?.click()",
  'kaperen': "() => [...document.querySelectorAll('button')].find(b => /Til søs/i.test(b.textContent))?.click()",
}
W, H = 488, 444
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=CHROME)
    for stil in ['tegneserie', 'pixel']:
        (ROOT / 'hal' / 'skaerme' / stil).mkdir(exist_ok=True)
        for g in spil:
            pg = br.new_page(viewport={'width': 1280, 'height': 800})
            pg.add_init_script("(() => { let a = 7; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();")
            pg.goto((ROOT / g / 'index.html').as_uri())
            pg.evaluate("s => { localStorage.clear(); localStorage.setItem('hojtArkade.stilForhaand', '1'); localStorage.setItem('hojtArkade.arkade.indstillinger', JSON.stringify({stil: s, music: false, sound: false, animation: false})); localStorage.setItem('hojtArkade.styring.indstillinger', JSON.stringify({valg: 'mus'})); localStorage.setItem('hojtArkade.effekterForslag', 'nej'); }", stil)
            pg.reload(); pg.wait_for_timeout(500)
            pg.locator('#btn-start, #btn-continue').first.click(timeout=3000); pg.wait_for_timeout(900)
            if g in EFTER_START: pg.evaluate(EFTER_START[g]); pg.wait_for_timeout(900)
            pg.mouse.move(1, 1); pg.wait_for_timeout(300)
            el = next((e for e in pg.locator(BRAET).all() if e.is_visible() and (e.bounding_box() or {}).get('width', 0) > 150), None)
            box = el.bounding_box() if el else {'x': 240, 'y': 80, 'width': 800, 'height': 640}
            img = Image.open(io.BytesIO(pg.screenshot(clip=box)))
            # beskær til maskinens format (fylder skærmen, midten bevares)
            s = max(W / img.width, H / img.height)
            img = img.resize((max(W, round(img.width * s)), max(H, round(img.height * s))), Image.LANCZOS)
            l, t = (img.width - W) // 2, (img.height - H) // 2
            img.crop((l, t, l + W, t + H)).convert('RGB').save(ROOT / 'hal' / 'skaerme' / stil / (g + '.webp'), quality=82)
            print(stil, g, 'ok')
            pg.close()
    br.close()
# hallen skal vide, hvilke billeder der findes
faerdige = sorted(f.stem for f in (ROOT / 'hal' / 'skaerme' / 'tegneserie').glob('*.webp') if (ROOT / 'hal' / 'skaerme' / 'pixel' / f.name).exists())
gj = (ROOT / 'games.js').read_text()
linje = 'window.HOJT_STIL_SKAERME = [' + ', '.join("'%s'" % x for x in faerdige) + '];'
gj = re.sub(r'\n?// Skærmbilleder i stilene.*\nwindow\.HOJT_STIL_SKAERME = \[.*\];\n?', '\n', gj)
gj = gj.rstrip() + '\n\n// Skærmbilleder i stilene tegneserie og retro-pixel (hal/skaerme/<stil>/), lavet med hal/skaerme/lav_stilbilleder.py\n' + linje + '\n'
(ROOT / 'games.js').write_text(gj)
print(len(faerdige), 'spil med stilbilleder')

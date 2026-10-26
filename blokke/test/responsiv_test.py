# Responsiv test af Blokke: alle skærme ved 8 opløsninger.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knapstørrelse >= 80 px (brættets felter tæller ikke med – deres størrelse
# vises som felt=..px) og ingen fejl i konsollen.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 blokke/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     BLOKKE_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('BLOKKE_SKAERMBILLEDER')
SHOT = (SHOT_DIR.rstrip('/') + '/') if SHOT_DIR else None
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
SIZES = [(1920,1080),(1366,768),(1280,720),(1024,768),(1024,1366),(1366,1024),(390,844),(844,390)]
MIN_BTN = 80
errs=[]; fails=[]; summary={}
CHECK = """(sel) => {
  const se = document.scrollingElement, W = se.clientWidth, H = se.clientHeight;
  const vis = e => !e.closest('[hidden]') && !e.closest('.trin-skjult') && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
  const out = {scroll: se.scrollHeight > se.clientHeight || se.scrollWidth > se.clientWidth, inner: [], clipped: [], overlap: [], textOut: []};
  document.querySelectorAll('.screen, .overlay').forEach(s => {
     if (s.closest('[hidden]')) return;
     if (s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1) out.inner.push((s.id||s.className) + ' ' + s.scrollWidth + 'x' + s.scrollHeight + '/' + s.clientWidth + 'x' + s.clientHeight); });
  const scr = document.querySelector(sel);
  scr.querySelectorAll('button, a, canvas, h1, h2, h3, p, li, .hud, img, .setting-label, .trin-label, .value-box').forEach(e => {
     if (!vis(e)) return; const r = e.getBoundingClientRect();
     if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.clipped.push((e.id || e.tagName + '.' + e.className) + ' ' + [r.left,r.top,r.right,r.bottom].map(Math.round));
  });
  const bs = [...scr.querySelectorAll('button, a.btn')].filter(vis).filter(e => !e.classList.contains('cell'));
  const cells = [...scr.querySelectorAll('#board .cell')].filter(vis);
  out.cellPx = cells.length ? Math.round(cells[0].getBoundingClientRect().width) : null;
  const name = e => e.id || e.dataset.slot || e.dataset.tab || e.dataset.size || e.dataset.recSize || e.getAttribute('aria-label') || e.textContent.trim().replace(/\\s+/g,' ').slice(0,16);
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i].getBoundingClientRect(), b = bs[j].getBoundingClientRect();
     if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1 && !bs[i].contains(bs[j]) && !bs[j].contains(bs[i]) && bs[i].closest('.overlay') === bs[j].closest('.overlay')) out.overlap.push(name(bs[i]) + '/' + name(bs[j])); }
  // Hvis et overlay er åbent, tæller kun dets knapper (resten ligger bag det)
  const ov = [...scr.querySelectorAll('.overlay')].find(o => !o.hidden);
  const counted = ov ? bs.filter(e => ov.contains(e)) : bs;
  const z = e => { let f = 1; for (let n = e; n; n = n.parentElement) { const zz = parseFloat(n.style && n.style.zoom); if (zz) f *= zz; } return f; };
  const sizes = counted.map(e => { const r = e.getBoundingClientRect(); return [Math.round(Math.min(r.width, r.height)), name(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)]; }).sort((a, b) => a[0] - b[0]);
  counted.forEach(e => { if (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2) out.textOut.push(name(e) + ' ' + e.scrollWidth + '>' + e.clientWidth); });
  out.minBtn = sizes.length ? sizes[0][0] : null;
  out.minName = sizes.length ? sizes[0][1] : '';
  out.zoomed = [...document.querySelectorAll('*')].some(e => e.style && e.style.zoom && !e.closest('[hidden]'));
  return out; }"""
def check(pg, name, sel, w, h, shot=None):
    r = pg.evaluate(CHECK, sel)
    small_btn = r['minBtn'] is not None and r['minBtn'] < MIN_BTN
    ok = not r['scroll'] and not r['inner'] and not r['clipped'] and not r['overlap'] and not r['textOut'] and not small_btn
    extra = ''
    if sel == '#game': extra = ' layout=%s felt=%spx' % (pg.evaluate("document.querySelector('#game').dataset.layout"), r['cellPx'])
    if r['zoomed']: extra += ' (zoom)'
    line = '%s %dx%d %-30s mindste knap=%spx (%s)%s' % ('OK  ' if ok else 'FEJL', w, h, name, r['minBtn'], r['minName'], extra)
    if not ok: line += ' ' + json.dumps({k: r[k] for k in ('scroll','inner','clipped','overlap','textOut')}, ensure_ascii=False)
    print(line)
    summary.setdefault('%dx%d' % (w, h), []).append((name, r['minBtn']))
    if not ok: fails.append(line)
    if shot and SHOT: pg.screenshot(path=SHOT + shot)
def pages(pg, scr, w, h, name, shotbase):
    """Gå alle sider igennem på en skærm med Forrige/Næste."""
    n = 1
    while True:
        check(pg, '%s side %d' % (name, n), scr, w, h, shotbase and '%s-trin%d.png' % (shotbase, n))
        nxt = pg.locator(scr + ' .trin-nav:not([hidden]) .trin-next')
        if nxt.count() == 0 or nxt.is_disabled(): break
        nxt.click(); pg.wait_for_timeout(60); n += 1
        if n > 8: fails.append('for mange sider ' + name); break
    return n

# Et bræt hvor den valgte brik passer og rydder nederste række (grøn skygge + gule linjer)
DEMO = """() => { const r = Blokke.run, n = r.n, b = new Array(n*n).fill(0);
  for (let x = 0; x < n; x++) if (x < 2 || x > 4) b[(n-1)*n + x] = 1 + (x % 7);
  for (let y = n-4; y < n-1; y++) b[y*n] = 5; b[(n-2)*n + n-1] = 2; b[(n-3)*n + n-1] = 2;
  r._setBoard(b); r._setTray(['tre-1','hjorne-2','T-1']); Blokke.refresh();
  if (Blokke.selection.slot !== 0) Blokke.selectPiece(0); Blokke.selectCell((n-1)*n + 3); }"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None, args=['--no-sandbox'])
    for (w,h) in [x for x in SIZES if not os.environ.get('ONLY') or '%dx%d'%x in os.environ['ONLY'].split(',')]:
        small = min(w, h) < 560
        tag = 'responsiv-%dx%d' % (w, h)
        ctx = b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, has_touch=w < 900)
        pg = ctx.new_page()
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
        pg.goto(URL); pg.wait_for_timeout(400)
        check(pg,'start','#menu',w,h, tag+'-start.png')
        pg.evaluate("Blokke.show('om')"); pg.wait_for_timeout(100)
        pages(pg, '#om', w, h, 'om', small and tag+'-om')
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("Blokke.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab, small and '%s-indstillinger-%s' % (tag, tab))
        pg.evaluate("Blokke.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h, small and tag+'-rekorder.png')
        for size in ['6x6','8x8','10x10']:
            pg.evaluate("s => { Blokke.gameSettings.set('boardSize', s); Blokke.start(); }", size); pg.wait_for_timeout(150)
            check(pg,'spil '+size,'#game',w,h)
            if size == '8x8':
                pg.evaluate(DEMO); pg.wait_for_timeout(150)
                check(pg,'spil 8x8 skygge','#game',w,h, tag+'-spil.png')
                ok = pg.evaluate("() => { const g = document.querySelectorAll('#board .cell.g-ok').length, c = document.querySelectorAll('#board .cell.clr').length, placeOn = !document.getElementById('btn-place').disabled; return [g, c, placeOn]; }")
                if ok != [3, 8, True]: fails.append('%s skygge forkert %s' % (tag, ok))
                # Klik på et felt lægger ikke brikken
                pg.click('#board .cell >> nth=0'); pg.wait_for_timeout(60)
                if pg.evaluate("Blokke.run.state.moves") != 0: fails.append(tag + ' klik på felt lagde brikken')
                pg.evaluate(DEMO); pg.click('#btn-place'); pg.wait_for_timeout(500)
                if pg.evaluate("[Blokke.run.state.moves, Blokke.run.state.lines]") != [1, 1]: fails.append(tag + ' Læg virkede ikke')
                pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check(pg,'pause','#game',w,h, small and tag+'-pause.png')
                pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
                # Ikke flere træk: skakbræt og brikker der ikke passer
                pg.evaluate("""() => { const r = Blokke.run, n = r.n, b = []; for (let i = 0; i < n*n; i++) b.push(((i % n) + Math.floor(i / n)) % 2 ? 3 : 0);
                  r._setBoard(b); r._setTray(['to-1','kvadrat',null]); Blokke.refresh(); Blokke.showStuck(); }""")
                pg.wait_for_timeout(150)
                check(pg,'ikke flere træk','#game',w,h, tag+'-ikke-flere-traek.png')
        # game over med rekorder
        pg.evaluate("() => { const s = Blokke.run.state; for (let i = 0; i < 3; i++) Blokke.records.add('10x10', 500 + i * 10, {lines: 12}); s.score = 777; s.lines = 31; s.moves = 64; s.bestCombo = 3; s.over = true; Blokke.gameOver(); }")
        pg.wait_for_timeout(150)
        split = pg.evaluate("!document.getElementById('btn-go-rec').hidden")
        check(pg,'game over' + (' (resultat)' if split else ''),'#gameover',w,h, tag+'-gameover.png')
        if split:
            pg.click('#btn-go-rec'); pg.wait_for_timeout(80)
            check(pg,'game over (rekorder)','#gameover',w,h, tag+'-gameover-trin2.png')
            pg.click('#btn-go-rec'); pg.wait_for_timeout(60)
        ctx.close()
    b.close()
print()
print('MINDSTE KNAP PR. OPLØSNING:')
for k, v in summary.items(): print('  %-10s %s px' % (k, min(x[1] for x in v if x[1] is not None)))
print('KONSOL:', errs)
print('FEJL:', len(fails))
for f in fails: print('  ', f)
sys.exit(1 if fails or errs else 0)

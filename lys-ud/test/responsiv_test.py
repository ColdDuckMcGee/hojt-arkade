# Responsiv test af Lys ud: alle skærme ved 8 opløsninger.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knapstørrelse >= 80 px (lamperne på pladen tæller ikke med – deres størrelse
# vises som felt=..px) og ingen fejl i konsollen.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 lys-ud/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     LYSUD_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('LYSUD_SKAERMBILLEDER')
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

# En plade, hvor midterlampen og dens naboer er tændt: ét tryk i midten løser den.
ONE = """() => { const r = LysUd.run, n = r.n, c = Math.floor(n/2) * n + Math.floor(n/2), G = LysUdGame;
  r._setBoard(G.press(G.emptyBoard(n), n, c)); LysUd.refresh(); return c; }"""
# En plade midt i spillet: et par tryk, så der er både tændte og slukkede lamper.
MID = """() => { const r = LysUd.run, n = r.n, G = LysUdGame;
  r._setBoard(G.applyPresses(G.emptyBoard(n), n, [0, n + 2, 2*n + 4, 3*n + 1, n*n - 1])); r.tap(n*n - 1 - n); LysUd.refresh(); }"""
def cls(pg, c):
    return pg.evaluate("c => [...document.querySelectorAll('#board .cell')].map((e, i) => e.classList.contains(c) ? i : -1).filter(i => i >= 0)", c)
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
        sel = pg.evaluate("() => [LysUd.boardSize(), document.querySelector('#menu [data-size][aria-pressed=true]').dataset.size]")
        if sel != ['5x5', '5x5']: fails.append('%s standardplade %s, ventede 5x5' % (tag, sel))
        pg.evaluate("LysUd.show('om')"); pg.wait_for_timeout(100)
        pages(pg, '#om', w, h, 'om', small and tag+'-om')
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("LysUd.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab, small and '%s-indstillinger-%s' % (tag, tab))
        pg.evaluate("LysUd.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h, small and tag+'-rekorder.png')
        for size in ['3x3','4x4','5x5']:
            pg.evaluate("s => { LysUd.gameSettings.set('boardSize', s); LysUd.start(); }", size); pg.wait_for_timeout(150)
            st = pg.evaluate("() => { const s = LysUd.run.state; return [s.minMoves, LysUdGame.minMoves(s.board, LysUd.run.n), LysUdGame.isDark(s.board)]; }")
            if st[0] != st[1] or st[0] < 3 or st[2]: fails.append('%s %s første plade forkert %s' % (tag, size, st))
            check(pg,'spil '+size,'#game',w,h)
        # 5x5 i gang: blik/mus over en lampe markerer den og de fire naboer
        n = 5
        pg.evaluate(MID); pg.wait_for_timeout(100)
        target = 2 * n + 2
        box = pg.locator('#board .cell').nth(target).bounding_box()
        pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2); pg.wait_for_timeout(80)
        pv = cls(pg, 'pv-on'); want = sorted([target, target - 1, target + 1, target - n, target + n])
        if sorted(pv) != want: fails.append('%s markering ved blik %s, ventede %s' % (tag, pv, want))
        check(pg,'spil 5x5 i gang (markering)','#game',w,h, tag+'-spil.png')
        before = pg.evaluate("LysUd.run.state.board.slice()")
        pg.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2); pg.wait_for_timeout(80)
        after = pg.evaluate("LysUd.run.state.board.slice()")
        diff = [i for i in range(n*n) if before[i] != after[i]]
        if diff != want: fails.append('%s klik skiftede %s, ventede %s' % (tag, diff, want))
        if cls(pg, 'on') != [i for i in range(n*n) if after[i]]: fails.append(tag + ' tegningen passer ikke til pladen')
        pg.click('#btn-undo'); pg.wait_for_timeout(60)
        if pg.evaluate("LysUd.run.state.board.slice()") != before: fails.append(tag + ' Fortryd virkede ikke')
        pg.click('#btn-tip'); pg.wait_for_timeout(60)
        tip = cls(pg, 'tip')
        okTip = pg.evaluate("i => { const r = LysUd.run, s = r.state, n = r.n; return LysUdGame.minMoves(LysUdGame.press(s.board, n, i), n) === r.remainingMin() - 1 && s.hintsUsed === 1; }", tip[0] if tip else -1)
        if len(tip) != 1 or not okTip: fails.append('%s tip forkert %s' % (tag, tip))
        check(pg,'spil 5x5 tip','#game',w,h, small and tag+'-tip.png')
        pg.click('#btn-restart'); pg.wait_for_timeout(60)
        if pg.evaluate("[LysUd.run.state.moves, LysUd.run.state.board.join('') === LysUd.run.state.start.join('')]") != [0, True]: fails.append(tag + ' Forfra virkede ikke')
        # Tastatur: piletast viser markøren, Enter vælger, Z fortryder
        pg.mouse.move(1, 1); pg.keyboard.press('ArrowLeft'); pg.keyboard.press('Enter'); pg.wait_for_timeout(60)
        if pg.evaluate("LysUd.run.state.moves") != 1: fails.append(tag + ' Enter valgte ikke lampen')
        pg.keyboard.press('z'); pg.wait_for_timeout(60)
        if pg.evaluate("LysUd.run.state.moves") != 0: fails.append(tag + ' Z fortrød ikke')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check(pg,'pause','#game',w,h, small and tag+'-pause.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
        # Bane klaret: ét tryk i midten
        c = pg.evaluate(ONE); pg.evaluate("c => LysUd.tap(c)", c); pg.wait_for_timeout(900)
        if pg.evaluate("document.getElementById('done-overlay').hidden"): fails.append(tag + ' Bane klaret blev ikke vist')
        check(pg,'bane klaret','#game',w,h, tag+'-bane-klaret.png')
        pts = pg.evaluate("LysUd.run.state.score")
        pg.click('#btn-next'); pg.wait_for_timeout(100)
        if pg.evaluate("[LysUd.run.state.level, LysUd.run.state.levelsSolved]") != [2, 1]: fails.append(tag + ' Næste bane virkede ikke')
        check(pg,'bane 2','#game',w,h)
        # Afslut: rekord gemmes med antal baner
        pg.evaluate("() => { for (let i = 0; i < 3; i++) LysUd.records.add('5x5', 400 + i * 50, {levels: 3 + i}); }")
        pg.keyboard.press('Escape'); pg.wait_for_timeout(80); pg.click('#btn-quit'); pg.wait_for_timeout(150)
        rec = pg.evaluate("LysUd.records.list('5x5').some(e => e.levels === 1 && e.score === %d)" % pts)
        if not rec: fails.append(tag + ' rekorden blev ikke gemt')
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

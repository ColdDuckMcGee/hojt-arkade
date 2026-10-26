# Responsiv test af Søslag: alle skærme ved 8 opløsninger.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knapstørrelse >= 80 px (havets felter tæller ikke med – deres størrelse
# vises som felt=..px) og ingen fejl i konsollen.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 soeslag/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     SOESLAG_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('SOESLAG_SKAERMBILLEDER')
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
  const name = e => e.id || e.dataset.slot || e.dataset.tab || e.dataset.size || e.dataset.recSize || e.dataset.level || e.dataset.recLevel || e.dataset.orient || e.getAttribute('aria-label') || e.textContent.trim().replace(/\\s+/g,' ').slice(0,16);
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


# Hjælpere, der spiller hurtigt frem uden at vente på computerens pause
FWD_WIN = """() => { const r = Soeslag.run, s = r.state, e = s.enemy, h = s.home; const left = [];
  e.ships.forEach(sh => sh.cells.forEach(c => { if (!e.shots[c]) left.push(c); }));
  const miss = []; for (let i = 0; i < r.n * r.n; i++) if (h.map[i] < 0 && !h.shots[i]) miss.push(i);
  while (left.length > 1) { r.playerFire(left.shift()); r.aiFire(miss.shift()); }
  Soeslag.refresh(true); return left[0]; }"""
FWD_LOSE = """() => { const r = Soeslag.run, s = r.state, e = s.enemy, h = s.home; const hit = [];
  h.ships.forEach(sh => sh.cells.forEach(c => { if (!h.shots[c]) hit.push(c); }));
  const water = []; for (let i = 0; i < r.n * r.n; i++) if (e.map[i] < 0 && !e.shots[i]) water.push(i);
  const ship = e.ships[0].cells; r.playerFire(ship[0]); r.aiFire(hit.shift());
  while (hit.length > 1) { r.playerFire(water.shift()); r.aiFire(hit.shift()); }
  r.playerFire(water.shift()); r.aiFire(hit.shift()); Soeslag.refresh(true); }"""
SOME = """() => { const r = Soeslag.run, e = r.state.enemy, h = r.state.home; const sh = e.ships[1].cells, sh2 = e.ships[3].cells;
  const water = []; for (let i = 0; i < r.n * r.n; i++) if (e.map[i] < 0) water.push(i);
  const hit = h.ships[2].cells; const hw = []; for (let i = 0; i < r.n * r.n; i++) if (h.map[i] < 0) hw.push(i);
  const mine = [sh2[0], water[5], sh[0], water[17], water[30], sh2[1], water[40], sh[1]];
  const ai = [hw[3], hit[0], hw[12], hw[20], hit[1], hw[33], hw[41], hw[2]];
  mine.forEach((c, k) => { r.playerFire(c); r.aiFire(ai[k]); });
  Soeslag.refresh(true); Soeslag.pickCell(water[22]); }"""
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
        info = pg.evaluate("() => { const c8 = Soeslag.cellSizeFor('8x8'), c10 = Soeslag.cellSizeFor('10x10'); return [c8, c10, document.querySelector('#menu [data-size=\"10x10\"]').disabled, !document.getElementById('size-note').hidden]; }")
        print('     %dx%d felter: 8x8=%spx (%.1f cm)  10x10=%spx (%.1f cm)  10x10 slået fra=%s  advarsel=%s' % (w, h, info[0], info[0]/37.8, info[1], info[1]/37.8, info[2], info[3]))
        pg.evaluate("Soeslag.show('om')"); pg.wait_for_timeout(100)
        pages(pg, '#om', w, h, 'om', small and tag+'-om')
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("Soeslag.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab, small and '%s-indstillinger-%s' % (tag, tab))
        pg.evaluate("Soeslag.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h, small and tag+'-rekorder.png')
        sizes = ['8x8'] + ([] if info[2] else ['10x10'])
        for size in sizes:
            pg.evaluate("s => { Soeslag.gameSettings.set('boardSize', s); Soeslag.start(); }", size); pg.wait_for_timeout(150)
            check(pg,'placering '+size,'#game',w,h, size == '8x8' and tag+'-placering.png')
            # Manuel placering: vælg skib, vælg felt, Lodret, Læg
            pg.click('.ship-btn >> nth=4'); pg.wait_for_timeout(40)
            ok = pg.evaluate("""() => { const r = Soeslag.run, n = r.n; const occ = new Set(); r.state.fleet.forEach(sh => sh.cells.forEach(c => occ.add(c))); const id = r.state.fleet[4].id;
              for (let i = 0; i < n * n; i++) { if (occ.has(i)) continue; if (Soeslag.view !== undefined && document.querySelector('.ship-btn[aria-pressed=true]') !== document.querySelectorAll('.ship-btn')[4]) Soeslag.chooseShip(id); Soeslag.pickCell(i); Soeslag.chooseOrient('v'); if (!document.getElementById('btn-place').disabled) return i; } return -1; }""")
            if ok < 0: fails.append('%s %s ingen gyldig plads til patruljebåden' % (tag, size))
            check(pg,'placering skygge '+size,'#game',w,h, size == '8x8' and small and tag+'-placering-skygge.png')
            before = pg.evaluate("JSON.stringify(Soeslag.run.state.fleet[4].cells)")
            pg.click('#btn-place'); pg.wait_for_timeout(60)
            after = pg.evaluate("JSON.stringify(Soeslag.run.state.fleet[4].cells)")
            if before == after: fails.append('%s %s Læg flyttede ikke skibet' % (tag, size))
            pg.click('#btn-shuffle'); pg.wait_for_timeout(40)
            pg.click('#btn-begin'); pg.wait_for_timeout(100)
            if pg.evaluate("Soeslag.run.state.phase") != 'battle': fails.append('%s %s Start kamp virkede ikke' % (tag, size))
            pg.evaluate(SOME); pg.wait_for_timeout(120)
            check(pg,'kamp '+size,'#game',w,h, tag+('-spil.png' if size == '8x8' else '-spil-10x10.png'))
            # Skud: vælg felt, tryk Skyd. Allerede beskudte felter kan ikke vælges
            shots0 = pg.evaluate("Soeslag.run.state.shots")
            pg.click('#btn-fire'); pg.wait_for_timeout(250)
            if pg.evaluate("[Soeslag.run.state.shots, Soeslag.run.state.turn, Soeslag.busy]") != [shots0 + 1, 'ai', True]: fails.append('%s %s Skyd virkede ikke' % (tag, size))
            check(pg,'computerens tur '+size,'#game',w,h, size == '8x8' and tag+'-computerens-tur.png')
            pg.wait_for_timeout(1000)
            if pg.evaluate("[Soeslag.run.state.turn, Soeslag.busy]") != ['player', False]: fails.append('%s %s computeren skød ikke efter ca. 1 s' % (tag, size))
            shot = pg.evaluate("() => { const e = Soeslag.run.state.enemy; return e.shots.findIndex(x => x); }")
            pg.evaluate("i => Soeslag.pickCell(i)", shot)
            if pg.evaluate("Soeslag.aim") == shot: fails.append('%s %s beskudt felt kunne vælges' % (tag, size))
            pg.click('#btn-view'); pg.wait_for_timeout(80)
            check(pg,'dit hav stort '+size,'#game',w,h, size == '8x8' and tag+'-dit-hav.png')
            pg.click('#btn-view'); pg.wait_for_timeout(60)
            if size == '8x8':
                pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check(pg,'pause','#game',w,h, small and tag+'-pause.png')
                pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
                last = pg.evaluate(FWD_WIN); pg.wait_for_timeout(50)
                pg.evaluate("i => Soeslag.pickCell(i)", last); pg.click('#btn-fire'); pg.wait_for_timeout(900)
                if pg.evaluate("[Soeslag.run.state.phase, document.querySelector('#game').dataset.phase]") != ['won', 'end']: fails.append(tag + ' sejr blev ikke vist')
                check(pg,'kamp vundet','#game',w,h, tag+'-kamp-vundet.png')
                pg.click('#btn-end'); pg.wait_for_timeout(120)
                if pg.evaluate("[Soeslag.run.state.match, Soeslag.run.state.phase]") != [2, 'place']: fails.append(tag + ' næste kamp startede ikke')
                pg.click('#btn-begin'); pg.wait_for_timeout(80)
                pg.evaluate(FWD_LOSE); pg.wait_for_timeout(120)
                if pg.evaluate("[Soeslag.run.state.phase, document.querySelector('#game').dataset.phase]") != ['lost', 'end']: fails.append(tag + ' nederlag blev ikke vist')
                check(pg,'kamp tabt','#game',w,h, tag+'-kamp-tabt.png')
        # game over efter én vunden og én tabt kamp på 8 × 8 (med et par rekorder i listen)
        pg.evaluate("() => { for (let i = 0; i < 3; i++) Soeslag.records.add('normal|8x8', 400 + i * 90, {wins: 1 + i, shots: 30 + i}); Soeslag.gameSettings.set('boardSize', '8x8'); Soeslag.start(); Soeslag.begin(); }")
        pg.wait_for_timeout(80)
        last = pg.evaluate(FWD_WIN); pg.evaluate("i => { Soeslag.run.playerFire(i); Soeslag.refresh(true); Soeslag.endAction(); Soeslag.begin(); }", last)
        pg.evaluate(FWD_LOSE); pg.wait_for_timeout(100)
        pg.click('#btn-end'); pg.wait_for_timeout(150)
        split = pg.evaluate("!document.getElementById('btn-go-rec').hidden")
        check(pg,'game over' + (' (resultat)' if split else ''),'#gameover',w,h, tag+'-gameover.png')
        if split:
            pg.click('#btn-go-rec'); pg.wait_for_timeout(80)
            check(pg,'game over (rekorder)','#gameover',w,h, tag+'-gameover-trin2.png')
            pg.click('#btn-go-rec'); pg.wait_for_timeout(60)
        pg.evaluate("Soeslag.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder med point','#records',w,h, tag+'-rekorder.png')
        ctx.close()
    b.close()
print()
print('MINDSTE KNAP PR. OPLØSNING:')
for k, v in summary.items(): print('  %-10s %s px' % (k, min(x[1] for x in v if x[1] is not None)))
print('KONSOL:', errs)
print('FEJL:', len(fails))
for f in fails: print('  ', f)
sys.exit(1 if fails or errs else 0)

# Responsiv test af Frøen: alle skærme ved 8 opløsninger.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knapstørrelse >= 80 px og ingen fejl i konsollen.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 froeen/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     FROEEN_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('FROEEN_SKAERMBILLEDER')
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
  const bs = [...scr.querySelectorAll('button, a.btn')].filter(vis);
  const name = e => e.id || e.dataset.dir || e.dataset.tab || e.dataset.mode || e.dataset.recMode || e.getAttribute('aria-label') || e.textContent.trim().replace(/\\s+/g,' ').slice(0,16);
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
    if sel == '#game': extra = ' layout=%s felt=%spx' % (pg.evaluate("document.querySelector('#game').dataset.layout"), pg.evaluate("document.querySelector('#game').dataset.cell"))
    if r['zoomed']: extra += ' (zoom)'
    line = '%s %dx%d %-30s mindste knap=%spx (%s)%s' % ('OK  ' if ok else 'FEJL', w, h, name, r['minBtn'], r['minName'], extra)
    if not ok: line += ' ' + json.dumps({k: r[k] for k in ('scroll','inner','clipped','overlap','textOut')}, ensure_ascii=False)
    print(line)
    summary.setdefault('%dx%d' % (w, h), []).append((name, r['minBtn']))
    if not ok: fails.append(line)
    if shot and SHOT: pg.screenshot(path=SHOT + shot)
BLOCK_SETUP = """kind => { Froeen.start(); const r = Froeen.run, s = r.state;
  if (kind === 'optaget') s.holes[1] = true;
  const lane = r.laneAt(1);
  for (let x = 0; x < s.cols; x++) {
    if (r.topAt(x) === kind && r.objAt(lane, x)) { s.frog = { x: x, y: 1 }; s.bestY = 1; Froeen.refresh(); return x; }
  }
  for (let x = 0; x < s.cols; x++) if (r.topAt(x) === kind) { s.frog = { x: x, y: 1 }; s.bestY = 1; Froeen.refresh(); return x; }
  return -1; }"""
BLOCK_STATE = """() => { const r = Froeen.run, s = r.state, b = document.querySelector('.arrow-up'), n = document.getElementById('up-note');
  return { turn: s.turn, lives: s.lives, dead: s.dead, x: s.frog.x, y: s.frog.y, disabled: b.disabled, note: n.hidden ? '' : n.textContent }; }"""
def blocked_up(pg, w, h, tag, dwell=False):
    """Pil op under muren og et optaget hul: slået fra, med forklaring, og intet træk."""
    for kind, txt in (('mur', 'Muren er i vejen'), ('optaget', 'Hullet er optaget')):
        pg.evaluate(BLOCK_SETUP, kind); pg.wait_for_timeout(80)
        before = pg.evaluate(BLOCK_STATE)
        pg.keyboard.press('ArrowUp'); pg.wait_for_timeout(60)
        pg.click('.arrow-up', force=True); pg.wait_for_timeout(60)
        if dwell:
            pg.evaluate("() => { Froeen.settings.set('dwell', true); Froeen.settings.set('dwellTime', 0.6); }")
            box = pg.locator('.arrow-up').bounding_box()
            pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2, steps=4)
            pg.wait_for_timeout(1600)
            pg.mouse.move(5, 5)
            pg.evaluate("() => Froeen.settings.set('dwell', false)")
        after = pg.evaluate(BLOCK_STATE)
        ok = (before['disabled'] and before['note'] == txt and after == before)
        line = '%s %dx%d %-30s %s' % ('OK  ' if ok else 'FEJL', w, h, 'pil op slået fra (%s)%s' % (kind, ' + dwell' if dwell else ''), json.dumps(after, ensure_ascii=False))
        print(line)
        if not ok: fails.append(line)
        check(pg, 'pil op slået fra (%s)' % kind, '#game', w, h)
        if SHOT and kind == 'mur': pg.screenshot(path=SHOT + tag + '-pil-op-slaaet-fra.png')
        if SHOT and kind == 'mur' and (w, h) == (1920, 1080): pg.screenshot(path=SHOT + 'pil-op-slaaet-fra.png')
        if SHOT and kind == 'optaget' and (w, h) == (1920, 1080): pg.screenshot(path=SHOT + 'pil-op-hul-optaget.png')
    if dwell:
        # kontrol: dwell på en pil, der er slået til, giver præcis ét træk
        pg.evaluate("() => { Froeen.start(); Froeen.settings.set('dwell', true); Froeen.settings.set('dwellTime', 0.6); }")
        t0 = pg.evaluate("Froeen.run.state.turn")
        box = pg.locator('.arrow-up').bounding_box()
        pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2, steps=4)
        for _ in range(40):  # vent op til 4 sek. på dwell (headless kan være langsom)
            pg.wait_for_timeout(100)
            if pg.evaluate("Froeen.run.state.turn") != t0: break
        pg.wait_for_timeout(1500)  # blikket bliver på pilen: der må ikke komme et træk mere
        t1 = pg.evaluate("Froeen.run.state.turn")
        if t1 != t0 + 1:
            print('DEBUG', pg.evaluate("() => { const b = document.querySelector('.arrow-up').getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width/2, b.y + b.height/2); return [e && e.outerHTML.slice(0, 120), Froeen.dwell.isEnabled(), document.querySelector('.arrow-up').disabled, document.activeElement && document.activeElement.id, Froeen.busy, [...document.querySelectorAll('.overlay:not([hidden]), [id$=overlay]:not([hidden])')].map(o => o.id)]; }"))
        pg.mouse.move(5, 5); pg.evaluate("() => Froeen.settings.set('dwell', false)")
        ok = t1 == t0 + 1
        line = '%s %dx%d %-30s tur %d -> %d' % ('OK  ' if ok else 'FEJL', w, h, 'kontrol: dwell på pil op', t0, t1)
        print(line)
        if not ok: fails.append(line)
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
        pg.evaluate("Froeen.show('om')"); pg.wait_for_timeout(100)
        pages(pg, '#om', w, h, 'om', small and tag+'-om')
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("Froeen.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab, small and '%s-indstillinger-%s' % (tag, tab))
        pg.evaluate("Froeen.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h, small and tag+'-rekorder.png')
        for mode in ['3','1']:
            pg.evaluate("m => { Froeen.gameSettings.set('lives', m); Froeen.start(); }", mode); pg.wait_for_timeout(150)
            check(pg,'spil %s liv' % mode,'#game',w,h)
            if mode == '3':
                pg.evaluate("() => { Froeen.act('up'); }"); pg.wait_for_timeout(60)
                pg.wait_for_timeout(100)
                SHOT and pg.screenshot(path=SHOT+tag+'-spil.png')
                pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check(pg,'pause','#game',w,h, small and tag+'-pause.png')
                pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
                for ov, nm in (('death-overlay','mistet liv'),('clear-overlay','bane klaret')):
                    pg.evaluate("id => { document.getElementById(id).hidden = false; window.dispatchEvent(new Event('resize')); }", ov); pg.wait_for_timeout(80)
                    check(pg, nm, '#game', w, h)
                    pg.evaluate("id => { document.getElementById(id).hidden = true; }", ov)
                blocked_up(pg, w, h, tag, dwell=(w, h) == (1920, 1080))
        # game over med rekorder
        pg.evaluate("() => { const s = Froeen.run.state; for (let i = 0; i < 3; i++) Froeen.records.add('1', 500 + i * 10, {level: 3}); s.score = 777; s.level = 4; s.over = true; s.lives = 0; s.deathCause = 'vand'; Froeen.gameOver(); }")
        pg.wait_for_timeout(150)
        split = pg.evaluate("!document.getElementById('btn-go-rec').hidden")
        check(pg,'game over' + (' (resultat)' if split else ''),'#gameover',w,h, tag+'-gameover.png')
        if split:
            SHOT and pg.screenshot(path=SHOT+tag+'-gameover-trin1.png')
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

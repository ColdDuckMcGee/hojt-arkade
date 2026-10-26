# Responsiv test af Flipper: alle skærme ved 8 opløsninger.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knapstørrelse >= 80 px og ingen fejl i konsollen. Bordets størrelse
# vises som bord=BxH.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 flipper/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     FLIPPER_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('FLIPPER_SKAERMBILLEDER')
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
  const bd = document.getElementById('board').getBoundingClientRect();
  out.cellPx = Math.round(bd.width) + 'x' + Math.round(bd.height);
  const name = e => e.id || e.dataset.choice || e.dataset.timing || e.dataset.power || e.dataset.tab || e.dataset.speed || e.dataset.recSpeed || e.getAttribute('aria-label') || e.textContent.trim().replace(/\\s+/g,' ').slice(0,16);
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
    if sel == '#game': extra = ' layout=%s bord=%s' % (pg.evaluate("document.querySelector('#game').dataset.layout"), r['cellPx'])
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
        hall = pg.evaluate("() => { const b = document.getElementById('btn-hall'); const r = b.getBoundingClientRect(); return [b.dataset.href, Math.round(r.width), Math.round(r.height), b.textContent.trim()]; }")
        if hall[0] != '../index.html' or 'Tilbage til hallen' not in hall[3]: fails.append('%s hal-knap %s' % (tag, hall))
        pg.evaluate("Flipper.show('om')"); pg.wait_for_timeout(100)
        pages(pg, '#om', w, h, 'om', small and tag+'-om')
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("Flipper.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab, small and '%s-indstillinger-%s' % (tag, tab))
        pg.evaluate("Flipper.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h, small and tag+'-rekorder.png')
        # Afskydning: kraft 1-5 og Skyd
        pg.evaluate("Flipper.show('menu')"); pg.click('#btn-start'); pg.wait_for_timeout(200)
        check(pg,'spil: afskydning','#game',w,h, tag+'-skyd.png')
        pg.click('#game [data-power="4"]'); pg.wait_for_timeout(60)
        if pg.evaluate("Flipper.run.state.power") != 4: fails.append(tag + ' kraft 4 blev ikke valgt')
        pg.click('#btn-shoot'); pg.wait_for_timeout(250)
        if pg.evaluate("Flipper.phase") == 'launch': fails.append(tag + ' Skyd virkede ikke')
        check(pg,'spil: kuglen ruller','#game',w,h, tag+'-spil.png')
        # Frys: spol frem til næste valg
        ph = pg.evaluate("Flipper.fastForward()")
        if ph != 'decision': fails.append('%s ventede frysning, fik %s' % (tag, ph))
        # Et kendt frosset øjeblik: kuglen falder ned mod venstre flipper
        pg.evaluate("() => { Flipper.run._place(200, 700, 0, 250); Flipper.fastForward(); }"); pg.wait_for_timeout(100)
        # Trin 1: flipper eller Lad være. Højre kan ikke nå kuglen og skal vise det.
        st = pg.evaluate("""() => { const q = s => document.querySelector(s); const r = q('#game [data-choice="right"]');
            return { reach: Flipper.reach, cant: r.classList.contains('cant') && r.getAttribute('aria-disabled') === 'true',
                     txt: r.querySelector('[data-outcome]').textContent, step1: !q('#game [data-ctl="decision"]').hidden }; }""")
        if not (st['step1'] and st['reach'].get('left') and not st['reach'].get('right') and st['cant'] and st['txt'] == 'Når ikke kuglen'):
            fails.append('%s trin 1: %s' % (tag, st))
        pg.hover('#game [data-choice="none"]'); pg.wait_for_timeout(80)
        if pg.evaluate("Flipper.shown && Flipper.shown.preview === Flipper.previews.none") is not True: fails.append(tag + ' Lad være viser ikke sin bane')
        pg.hover('#game [data-choice="left"]'); pg.wait_for_timeout(500)
        check(pg,'spil: frosset, trin 1 (flipper)','#game',w,h, tag+'-fryst-trin1.png')
        pg.click('#game [data-choice="right"]', force=True); pg.wait_for_timeout(60)
        if pg.evaluate("Flipper.pick") is not None: fails.append(tag + ' Højre kunne vælges, selv om den ikke når kuglen')
        # Trin 2: Tidligt eller Sent (og Tilbage)
        pg.click('#game [data-choice="left"]'); pg.wait_for_timeout(80)
        st = pg.evaluate("""() => ({ pick: Flipper.pick, step2: !document.querySelector('#game [data-ctl="timing"]').hidden,
            locked: document.querySelectorAll('#game [data-ctl="timing"] [data-no-dwell]').length,
            outs: [...document.querySelectorAll('#game [data-timing] [data-outcome]')].map(e => e.textContent) })""")
        if not (st['pick'] == 'left' and st['step2'] and st['locked'] == 3 and all(st['outs']) and st['outs'][0] != st['outs'][1]):
            fails.append('%s trin 2: %s' % (tag, st))
        for t in ['late', 'early']:
            pg.hover('#game [data-timing="%s"]' % t); pg.wait_for_timeout(120)
            same = pg.evaluate("t => { const s = Flipper.shown; return !!s && s.preview === Flipper.previews['left-' + t] && !!s.preview.hit; }", t)
            if not same: fails.append('%s sigtelinjen for %s vises ikke' % (tag, t))
        pg.wait_for_timeout(400)
        check(pg,'spil: frosset, trin 2 (tidligt/sent)','#game',w,h, tag+'-fryst.png')
        pg.click('#btn-timing-back'); pg.wait_for_timeout(60)
        if pg.evaluate("Flipper.pick") is not None: fails.append(tag + ' Tilbage virkede ikke')
        # Valget sker, og kuglen følger præcis den viste bane
        pg.click('#game [data-choice="left"]'); pg.wait_for_timeout(60)
        pg.evaluate("() => { window.__fp = Flipper.previews['left-late']; }")
        pg.click('#game [data-timing="late"]'); pg.wait_for_timeout(30)
        # Spillets egen løkke kører videre efter klikket: find kuglens plads i den viste bane og følg den 60 skridt
        got = pg.evaluate("""() => { const r = Flipper.run, p = window.__fp, b = r.state.ball;
            if (r.state.timing !== 'late') return 'timing ' + r.state.timing;
            const i = p.path.findIndex(q => q.x === b.x && q.y === b.y); if (i < 0) return 'kuglen er ikke på den viste bane';
            for (let k = 1; k <= 60 && i + k < p.path.length; k++) { r.step(); if (r.state.ball.x !== p.path[i + k].x || r.state.ball.y !== p.path[i + k].y) return 'afviger ved skridt ' + (i + k); }
            return 'ok'; }""")
        if got != 'ok': fails.append('%s banen passer ikke med sigtelinjen: %s' % (tag, got))
        # Tastatur: venstre pil -> trin 2 med fokus på Tidligt, højre pil -> Sent, Backspace -> tilbage, Enter vælger
        pg.evaluate("() => { Flipper.run._place(200, 700, 0, 250); Flipper.fastForward(); }"); pg.wait_for_timeout(60)
        pg.mouse.move(2, 2)
        pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(40)
        k1 = pg.evaluate("[Flipper.pick, document.activeElement.dataset.timing]")
        pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(40)
        k2 = pg.evaluate("[document.activeElement.dataset.timing, Flipper.shown && Flipper.shown.preview === Flipper.previews['left-late']]")
        pg.keyboard.press('Backspace'); pg.wait_for_timeout(40)
        k3 = pg.evaluate("Flipper.pick")
        pg.keyboard.press('ArrowLeft'); pg.keyboard.press('Enter'); pg.wait_for_timeout(40)
        k4 = pg.evaluate("[Flipper.phase, Flipper.run.state.timing]")
        if k1 != ['left', 'early'] or k2 != ['late', True] or k3 is not None or k4 != ['rolling', 'early']:
            fails.append('%s tastatur %s %s %s %s' % (tag, k1, k2, k3, k4))
        # Dwell: ét dwell = ét valg. Tidligt dukker op under blikket og må ikke vælges, før blikket har været væk.
        if (w, h) == (1920, 1080):
            pg.evaluate("() => { Flipper.settings.set('dwellTime', 0.5); Flipper.settings.set('dwell', true); Flipper.run._place(200, 700, 0, 250); Flipper.fastForward(); }")
            def center(sel):
                r = pg.evaluate("s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }", sel)
                return r
            cx, cy = center('#game [data-choice="left"]')
            pg.mouse.move(cx, cy); pg.mouse.move(cx + 2, cy + 2); pg.wait_for_timeout(900)
            d1 = pg.evaluate("[Flipper.pick, Flipper.phase]")
            pg.mouse.move(cx + 3, cy + 3); pg.wait_for_timeout(1500)
            d2 = pg.evaluate("[Flipper.pick, Flipper.phase]")
            sx, sy = center('#game [data-timing="late"]')
            pg.mouse.move(sx, sy); pg.mouse.move(sx + 2, sy + 2); pg.wait_for_timeout(900)
            d3 = pg.evaluate("[Flipper.phase, Flipper.run.state.timing]")
            pg.evaluate("() => { Flipper.settings.set('dwell', false); Flipper.settings.set('dwellTime', 1.2); }")
            if d1 != ['left', 'decision'] or d2 != ['left', 'decision'] or d3 != ['rolling', 'late']:
                fails.append('%s dwell %s %s %s' % (tag, d1, d2, d3))
            else: print('OK   %dx%d dwell: ét dwell = ét valg i begge trin' % (w, h))
        pg.evaluate("() => { Flipper.run._place(200, 700, 0, 250); Flipper.fastForward(); }"); pg.wait_for_timeout(60)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check(pg,'pause','#game',w,h, small and tag+'-pause.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
        # Tabt kugle: læg kuglen midt over afløbet
        pg.evaluate("() => { Flipper.run._place(280, 960, 0, 300); if (Flipper.fastForward() === 'decision') { Flipper.choose('none'); Flipper.fastForward(); } }"); pg.wait_for_timeout(300)
        if pg.evaluate("Flipper.phase") != 'lost': fails.append(tag + ' kuglen blev ikke tabt')
        check(pg,'spil: kuglen er tabt','#game',w,h, tag+'-tabt.png')
        # game over med rekorder
        pg.evaluate("() => { const s = Flipper.run.state; for (let i = 0; i < 3; i++) Flipper.records.add(s.speedId, 12000 + i * 1500, {mult: 2}); s.score = 23450; s.stats.allLights = 3; s.stats.loops = 2; s.stats.bestMult = 3; Flipper.gameOver(); }")
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

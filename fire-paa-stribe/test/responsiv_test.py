# Responsiv test af Fire på stribe: alle skærme ved 8 opløsninger.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knapstørrelse >= 80 px (kolonnerne på brættet tæller ikke med – deres bredde
# vises som kolonne=..px; er de under 80 px, skal vælgeren ◀ Slip ▶ være der) og ingen
# fejl i konsollen.
#
# Desuden: ghost-brik, slip med mus og tastatur, computerens svar, Fortryd, Tip,
# vundet parti (fire markeret), næste parti, tabt parti -> resultat, rekord gemt,
# bekræftelse ved Afslut (Esc = Nej, dwell-sikker).
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 fire-paa-stribe/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     FP_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('FP_SKAERMBILLEDER')
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
  const bs = [...scr.querySelectorAll('button, a.btn')].filter(vis).filter(e => !e.classList.contains('col'));
  const cells = [...scr.querySelectorAll('#board .col')].filter(vis);
  out.cellPx = cells.length ? Math.round(cells[0].getBoundingClientRect().width) : null;
  const name = e => e.id || e.dataset.slot || e.dataset.tab || e.dataset.level || e.dataset.recLevel || e.getAttribute('aria-label') || e.textContent.trim().replace(/\\s+/g,' ').slice(0,16);
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
    if sel == '#game': extra = ' layout=%s kolonne=%spx' % (pg.evaluate("document.querySelector('#game').dataset.layout"), r['cellPx'])
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

def confirm_check(pg, w, h, tag, name, shot):
    vis = pg.evaluate("!document.getElementById('confirm-overlay').hidden && document.activeElement && document.activeElement.id")
    if vis != 'btn-confirm-no': fails.append('%s %s: bekræftelsen vises ikke / Nej har ikke fokus (%s)' % (tag, name, vis))
    check(pg, name, '#game', w, h, shot)
    r = pg.evaluate("""() => { const a = document.getElementById('btn-confirm-no').getBoundingClientRect(), b = document.getElementById('btn-confirm-yes').getBoundingClientRect();
      const gap = Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);
      return [Math.round(Math.min(a.width, a.height)), Math.round(Math.min(b.width, b.height)), Math.round(gap)]; }""")
    print('     %dx%d bekræft: Nej %spx, Ja %spx, afstand %spx' % (w, h, r[0], r[1], r[2]))
    if min(r[0], r[1]) < MIN_BTN or r[2] < 32: fails.append('%s %s: knapper %s/%s px, afstand %s px' % (tag, name, r[0], r[1], r[2]))
def center(pg, sel):
    bb = pg.locator(sel).bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
def dwell_check(pg, w, h, tag):
    """Dwell-sikker bekræftelse: et dwell på Afslut vælger ikke også knappen på samme plads."""
    pg.evaluate("() => { FirePaaStribe.settings.set('dwellTime', 0.5); }")
    yes = None
    # 1) Rigtigt dwell på Afslut i pausen åbner bekræftelsen, og intet andet sker, mens blikket bliver
    pg.mouse.move(1, 1); pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
    x, y = center(pg, '#btn-quit'); pg.mouse.move(x, y); pg.wait_for_timeout(30)
    pg.evaluate("FirePaaStribe.settings.set('dwell', true)")
    try: pg.wait_for_function("!document.getElementById('confirm-overlay').hidden", timeout=3000)
    except Exception: fails.append(tag + ' dwell på Afslut åbnede ikke bekræftelsen')
    pg.wait_for_timeout(1500)
    st = pg.evaluate("[!document.getElementById('confirm-overlay').hidden, FirePaaStribe.run.state.ended]")
    pg.evaluate("FirePaaStribe.settings.set('dwell', false)")
    if st != [True, False]: fails.append('%s dwell på Afslut valgte også en knap i bekræftelsen %s' % (tag, st))
    if not st[0]: print('FEJL %dx%d dwell' % (w, h)); return
    yes = center(pg, '#btn-confirm-yes')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
    # 2) Værste fald: blikket står præcis dér, hvor "Ja, afslut" dukker op
    pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
    pg.mouse.move(yes[0], yes[1]); pg.wait_for_timeout(30)
    pg.evaluate("() => { FirePaaStribe.askQuit('pause'); FirePaaStribe.settings.set('dwell', true); }")
    pg.wait_for_timeout(1500)
    st = pg.evaluate("[!document.getElementById('confirm-overlay').hidden, FirePaaStribe.run.state.ended, FirePaaStribe.guard]")
    if st != [True, False, 'btn-confirm-yes']: fails.append('%s Ja under blikket blev valgt af dwell %s' % (tag, st))
    if not st[0]:
        pg.evaluate("FirePaaStribe.settings.set('dwell', false)"); print('FEJL %dx%d dwell' % (w, h)); return
    # 3) Når blikket flytter til "Nej, spil videre", virker dwell som normalt
    nx, ny = center(pg, '#btn-confirm-no'); pg.mouse.move(nx, ny, steps=4)
    try: pg.wait_for_function("document.getElementById('confirm-overlay').hidden", timeout=3000)
    except Exception: fails.append(tag + ' dwell på Nej virkede ikke')
    pg.evaluate("FirePaaStribe.settings.set('dwell', false)")
    st = pg.evaluate("[FirePaaStribe.run.state.ended, document.querySelectorAll('#game .overlay:not([hidden])').length]")
    if st != [False, 0]: fails.append('%s efter dwell på Nej %s' % (tag, st))
    print('OK   %dx%d dwell-sikker bekræftelse' % (w, h) if not [f for f in fails if f.startswith(tag) and 'dwell' in f] else 'FEJL %dx%d dwell' % (w, h))
    pg.mouse.move(1, 1)

F = 'FirePaaStribe'
def st(pg, expr): return pg.evaluate("() => { const s = FirePaaStribe.run.state; return " + expr + "; }")
def idle(pg, t=6000): pg.wait_for_function("FirePaaStribe.run && !FirePaaStribe.busy", timeout=t); pg.wait_for_timeout(40)
def slots(pg, c):
    # Hver kolonne har sine seks huller; omregnes til brættets indeks (række * 7 + kolonne)
    return sorted(pg.evaluate("c => [...document.querySelectorAll('#board .slot')].map((e, i) => e.classList.contains(c) ? (i % 6) * 7 + Math.floor(i / 6) : -1).filter(i => i >= 0)", c))
def set_board(pg, rows, turn=1):
    pg.evaluate("([r, t]) => FirePaaStribe.setBoard(FirePaaStribeGame.fromRows(r), t)", [rows, turn]); pg.wait_for_timeout(60)
def col_center(pg, c):
    bb = pg.locator('#board .col').nth(c).bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
MIDPOS = ['.......', '.......', '.......', '...O...', '..XX...', '.OXXO..']
WINPOS = ['.......', '.......', '.......', '.......', '...O...', 'XXX.OO.']   # du vinder i kolonne 4
LOSEPOS = ['.......', '.......', '.......', '.......', 'X.X....', 'OOO.XX.'] # computeren vinder i kolonne 4

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
        check(pg,'start','#menu',w,h, tag+'.png')
        if pg.evaluate("document.querySelector('#menu [data-level][aria-pressed=true]').dataset.level") != 'normal': fails.append(tag + ' standardniveau er ikke Normal')
        if pg.evaluate("document.getElementById('btn-hall').dataset.href") != '../index.html': fails.append(tag + ' Tilbage til hallen peger forkert')
        pg.click('#menu [data-level="svaer"]'); pg.reload(); pg.wait_for_timeout(300)
        if pg.evaluate("FirePaaStribe.gameSettings.get('level')") != 'svaer': fails.append(tag + ' niveauvalg blev ikke husket')
        pg.evaluate("FirePaaStribe.gameSettings.set('level', 'normal')")
        pg.evaluate("FirePaaStribe.show('om')"); pg.wait_for_timeout(100)
        pages(pg, '#om', w, h, 'om', small and tag+'-om')
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("FirePaaStribe.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab, small and '%s-indstillinger-%s' % (tag, tab))
        pg.evaluate("FirePaaStribe.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h, small and tag+'-rekorder.png')
        for lv in ['rolig','svaer','normal']:
            pg.evaluate("l => { FirePaaStribe.gameSettings.set('level', l); FirePaaStribe.start(); }", lv); idle(pg)
            if st(pg, "[s.level, s.game, s.turn, s.history.length]") != [lv, 1, 1, 0]: fails.append('%s %s start forkert' % (tag, lv))
            check(pg,'spil '+lv,'#game',w,h)
        colw = pg.evaluate("Math.round(document.querySelector('#board .col').getBoundingClientRect().width)")
        pick = pg.evaluate("!!document.querySelector('#game-grid.pick-on')")
        if (colw < 80) != pick: fails.append('%s kolonne %s px, vælger=%s' % (tag, colw, pick))
        # Ghost-brik der, hvor brikken lander
        set_board(pg, MIDPOS)
        x, y = col_center(pg, 4); pg.mouse.move(x, y); pg.wait_for_timeout(80)
        if slots(pg, 'ghost') != [4 * 7 + 4]: fails.append('%s ghost %s, ventede %s' % (tag, slots(pg, 'ghost'), [32]))
        check(pg,'spil i gang (ghost)','#game',w,h, tag+'-spil.png')
        if SHOT and (w, h) == (1920, 1080): pg.screenshot(path=SHOT + 'spil-i-gang.png')
        # Klik: din brik lander, computeren svarer
        n0 = st(pg, "s.history.length")
        pg.mouse.click(x, y); idle(pg)
        if st(pg, "[s.history.length, s.board[32], s.turn]") != [n0 + 2, 1, 1]: fails.append('%s klik/svar forkert %s' % (tag, st(pg, "[s.history.length, s.board[32], s.turn]")))
        b1 = st(pg, "s.board.slice()")
        if sorted(slots(pg, 'p1') + slots(pg, 'p2')) != [i for i in range(42) if b1[i]]: fails.append(tag + ' tegningen passer ikke til brættet')
        pg.click('#btn-undo'); idle(pg)
        if st(pg, "[s.history.length, s.undosUsed, s.board[32]]") != [n0, 1, 0]: fails.append('%s Fortryd virkede ikke %s' % (tag, st(pg, "[s.history.length, s.undosUsed, s.board[32]]")))
        if pg.evaluate("document.getElementById('btn-undo').getAttribute('aria-disabled')") != 'true': fails.append(tag + ' Fortryd kan bruges to gange')
        pg.click('#btn-tip'); pg.wait_for_timeout(60)
        tip = slots(pg, 'tipslot')
        if len(tip) != 1 or st(pg, "[s.hintsUsed, s.hintCol]") != [1, tip[0] % 7]: fails.append('%s tip forkert %s' % (tag, tip))
        check(pg,'spil tip','#game',w,h, small and tag+'-tip.png')
        # Tastatur: pil viser markøren, Enter slipper
        pg.mouse.move(1, 1); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(40)
        cur = pg.evaluate("FirePaaStribe.cursor")
        pg.keyboard.press('Enter'); idle(pg)
        if st(pg, "s.history.length") != n0 + 2 or cur < 0: fails.append('%s Enter slap ikke brikken (markør %s)' % (tag, cur))
        pg.keyboard.press('Digit1'); pg.wait_for_timeout(40)
        if pg.evaluate("FirePaaStribe.cursor") != 0: fails.append(tag + ' tasten 1 valgte ikke kolonne 1')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check(pg,'pause','#game',w,h, small and tag+'-pause.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
        # Vundet parti: de fire markeres, Næste parti / Afslut
        set_board(pg, WINPOS)
        sc0 = st(pg, "s.score")
        pg.evaluate("FirePaaStribe.drop(3)"); idle(pg); pg.wait_for_timeout(200)
        r = st(pg, "[s.result, s.wins, s.score > %d]" % sc0)
        if r != ['win', 1, True]: fails.append('%s sejr forkert %s' % (tag, r))
        if slots(pg, 'win') != [35, 36, 37, 38]: fails.append('%s vindende fire %s' % (tag, slots(pg, 'win')))
        if pg.evaluate("[document.getElementById('end-row').hidden, document.getElementById('act-row').hidden]") != [False, True]: fails.append(tag + ' knapperne skiftede ikke efter sejr')
        check(pg,'parti vundet','#game',w,h, tag+'-vundet.png')
        pts = st(pg, "s.score")
        pg.click('#btn-end-quit'); pg.wait_for_timeout(100)
        confirm_check(pg, w, h, tag, 'bekræft afslut (parti slut)', small and tag + '-bekraeft.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
        if pg.evaluate("[document.getElementById('confirm-overlay').hidden, document.getElementById('end-row').hidden, FirePaaStribe.run.state.ended]") != [True, False, False]: fails.append(tag + ' Esc i bekræftelsen gik ikke tilbage')
        pg.click('#btn-next'); pg.wait_for_timeout(100)
        if st(pg, "[s.game, s.starter, s.result]") != [2, 2, None]: fails.append('%s Næste parti forkert %s' % (tag, st(pg, "[s.game, s.starter, s.result]")))
        idle(pg)
        if st(pg, "[s.history.length, s.turn]") != [1, 1]: fails.append(tag + ' computeren startede ikke parti 2')
        check(pg,'parti 2','#game',w,h)
        # Afslut fra pause: bekræftelse, Esc = Nej, dwell-sikker
        pg.keyboard.press('Escape'); pg.wait_for_timeout(80); pg.click('#btn-quit'); pg.wait_for_timeout(100)
        confirm_check(pg, w, h, tag, 'bekræft afslut (pause)', small and tag + '-bekraeft-pause.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
        if pg.evaluate("[document.querySelectorAll('#game .overlay:not([hidden])').length, FirePaaStribe.run.state.ended]") != [0, False]: fails.append(tag + ' Esc i bekræftelsen fortsatte ikke spillet')
        dwell_check(pg, w, h, tag)
        # Tabt parti: computeren tager sin vinder, serien slutter, rekorden gemmes
        pg.evaluate("() => { for (let i = 0; i < 3; i++) FirePaaStribe.records.add('normal', 60 + i * 50, {wins: 1, draws: i}); }")
        set_board(pg, LOSEPOS, 2); idle(pg); pg.wait_for_timeout(200)
        if st(pg, "[s.result, s.ended, s.board[38]]") != ['loss', True, 2]: fails.append('%s tab forkert %s' % (tag, st(pg, "[s.result, s.ended, s.board[38]]")))
        if pg.evaluate("[document.getElementById('btn-next-label').textContent, document.getElementById('btn-end-quit').hidden]") != ['Se resultat', True]: fails.append(tag + ' knappen efter tab er forkert')
        check(pg,'parti tabt','#game',w,h, small and tag+'-tabt.png')
        pg.click('#btn-next'); pg.wait_for_timeout(150)
        if pg.evaluate("document.getElementById('gameover').hidden"): fails.append(tag + ' resultatet blev ikke vist efter tab')
        if not pg.evaluate("FirePaaStribe.records.list('normal').some(e => e.wins === 1 && e.draws === 0 && e.score === %d)" % pts): fails.append(tag + ' rekorden blev ikke gemt')
        split = pg.evaluate("!document.getElementById('btn-go-rec').hidden")
        check(pg,'game over' + (' (resultat)' if split else ''),'#gameover',w,h, tag+'-gameover.png')
        if SHOT and (w, h) == (1920, 1080): pg.screenshot(path=SHOT + 'game-over.png')
        if split:
            pg.click('#btn-go-rec'); pg.wait_for_timeout(80)
            check(pg,'game over (rekorder)','#gameover',w,h, tag+'-gameover-trin2.png')
            pg.click('#btn-go-rec'); pg.wait_for_timeout(60)
        pg.click('#btn-again'); idle(pg)
        if st(pg, "[s.game, s.score, s.ended]") != [1, 0, False]: fails.append(tag + ' Ny serie virkede ikke')
        if SHOT and (w, h) == (1920, 1080):
            pg.evaluate("FirePaaStribe.show('menu')"); pg.wait_for_timeout(100); pg.screenshot(path=SHOT + 'startskaerm.png')
        ctx.close()
    b.close()
print()
print('MINDSTE KNAP PR. OPLØSNING:')
for k, v in summary.items(): print('  %-10s %s px' % (k, min(x[1] for x in v if x[1] is not None)))
print('KONSOL:', errs)
print('FEJL:', len(fails))
for f in fails: print('  ', f)
sys.exit(1 if fails or errs else 0)

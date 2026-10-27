# Kasser – responsiv test og flowtest i headless Chromium.
# Tjekker alle skærme ved 8 opløsninger: ingen rulning, intet klippet af, ingen overlap,
# tekst inden i knapperne, mindste knapstørrelse >= 80 px og ingen fejl i konsollen.
# Spiller også rigtigt i browseren: taster, pileknapper, tryk på felter, fortryd, genstart,
# dwell, fastlåst kasse, banesejr, afslut runde (game over) og top 10. Gemmer skærmbilleder.
#
#   python3 kasser/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   KASSER_ROD=/sti/til/kasser   CHROME=/sti/til/chrome     KASSER_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(os.environ.get('KASSER_ROD') or pathlib.Path(__file__).resolve().parent.parent)
URL = (ROOT / 'index.html').as_uri()
HALL = (ROOT.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('KASSER_SKAERMBILLEDER')
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
  scr.querySelectorAll('button, a, canvas, h1, h2, h3, p:not(.sr-only), li, .hud, img, .setting-label, .trin-label, .value-box').forEach(e => {
     if (!vis(e)) return; const r = e.getBoundingClientRect();
     if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.clipped.push((e.id || e.tagName + '.' + e.className) + ' ' + [r.left,r.top,r.right,r.bottom].map(Math.round));
  });
  const bs = [...scr.querySelectorAll('button, a.btn')].filter(vis);
  const name = e => e.id || e.dataset.dir || e.dataset.tab || e.dataset.level || e.getAttribute('aria-label') || e.textContent.trim().replace(/\\s+/g,' ').slice(0,16);
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i].getBoundingClientRect(), b = bs[j].getBoundingClientRect();
     if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1 && !bs[i].contains(bs[j]) && !bs[j].contains(bs[i]) && bs[i].closest('.overlay') === bs[j].closest('.overlay')) out.overlap.push(name(bs[i]) + '/' + name(bs[j])); }
  // canvas må ikke overlappe knapper
  const cv = scr.querySelector('canvas');
  if (cv && vis(cv)) { const c = cv.getBoundingClientRect(); bs.forEach(e => { if (e.closest('.overlay')) return; const b = e.getBoundingClientRect(); if (c.left < b.right - 1 && b.left < c.right - 1 && c.top < b.bottom - 1 && b.top < c.bottom - 1) out.overlap.push('banen/' + name(e)); }); }
  const ov = [...scr.querySelectorAll('.overlay')].find(o => !o.hidden);
  const counted = ov ? bs.filter(e => ov.contains(e)) : bs;
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
    if sel == '#game': extra = ' layout=%s knap=%spx bane=%s' % (pg.evaluate("document.querySelector('#game').dataset.layout"), pg.evaluate("document.querySelector('#game').dataset.btn"), pg.evaluate("(() => { const r = document.getElementById('board').getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); })()"))
    if r['zoomed']: extra += ' (zoom)'
    line = '%s %dx%d %-28s mindste knap=%spx (%s)%s' % ('OK  ' if ok else 'FEJL', w, h, name, r['minBtn'], r['minName'], extra)
    if not ok: line += ' ' + json.dumps({k: r[k] for k in ('scroll','inner','clipped','overlap','textOut')}, ensure_ascii=False)
    print(line)
    summary.setdefault('%dx%d' % (w, h), []).append((name, r['minBtn']))
    if not ok: fails.append(line)
    if SHOT and shot: pg.screenshot(path=SHOT + shot)

ST = "(() => { const s = Kasser.run.state; return {m: s.moves, p: s.player, b: s.boxes.slice(), solved: s.solved, busy: Kasser.busy}; })()"

def flow_test(b):
    ctx = b.new_context(viewport={'width':1366,'height':768}); pg = ctx.new_page()
    pg.on('console', lambda m: errs.append('flow ' + m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('flow pageerror: ' + str(e)))
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(200)
    def res(name, ok, info=''):
        line = '%s FLOW %-46s %s' % ('OK  ' if ok else 'FEJL', name, info); print(line)
        if not ok: fails.append(line)
    st = lambda: pg.evaluate(ST)
    # Bane 1: '#@ $ .#' – med animation slået til
    pg.click('#btn-continue'); pg.wait_for_timeout(200)
    res('Fortsæt starter bane 1', pg.evaluate("Kasser.screen") == 'game' and pg.evaluate("Kasser.run.state.level") == 0)
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(350)
    s = st(); res('piletast: ét skridt', s['m'] == 1 and s['p'] == 9 and not s['busy'], json.dumps(s))
    pg.keyboard.press('ArrowUp'); pg.wait_for_timeout(350)
    res('væg: intet træk', st()['m'] == 1)
    pg.keyboard.press('z'); pg.wait_for_timeout(100)
    res('Z fortryder', st()['m'] == 0 and st()['p'] == 8)
    pg.keyboard.press('d'); pg.wait_for_timeout(350)
    res('WASD (D) går til højre', st()['m'] == 1)
    pg.keyboard.press('Backspace'); pg.wait_for_timeout(100)
    res('Backspace fortryder', st()['m'] == 0)
    pg.click('.arrow-right'); pg.wait_for_timeout(350)
    pg.click('.arrow-right'); pg.wait_for_timeout(350)
    s = st(); res('pileknap skubber kassen', s['m'] == 2 and s['b'] == [11], json.dumps(s))
    pg.click('#btn-undo'); pg.wait_for_timeout(100)
    res('Fortryd-knap flytter kassen tilbage', st()['b'] == [10] and st()['m'] == 1)
    pg.keyboard.press('r'); pg.wait_for_timeout(100)
    res('R genstarter banen', st()['m'] == 0 and st()['p'] == 8)
    pg.click('#btn-undo'); pg.wait_for_timeout(100)
    res('genstart kan fortrydes', st()['m'] == 1)
    pg.click('#btn-restart'); pg.wait_for_timeout(100)
    # tryk på et felt: gå til feltet til venstre for kassen (2,1), og tryk på kassen for at skubbe
    def click_cell(x, y):
        bb = pg.evaluate("(() => { const r = document.getElementById('board').getBoundingClientRect(); const s = Kasser.run.state; const S = Math.min(r.width / s.w, r.height / s.h); return {x: r.left + (r.width - S * s.w) / 2, y: r.top + (r.height - S * s.h) / 2, S: S}; })()")
        pg.mouse.click(bb['x'] + (x + 0.5) * bb['S'], bb['y'] + (y + 0.5) * bb['S'])
    click_cell(2, 1); pg.wait_for_timeout(350)
    res('tryk på felt: går dertil', st()['p'] == 9 and st()['m'] == 1)
    click_cell(3, 1); pg.wait_for_timeout(350)
    click_cell(4, 1); pg.wait_for_timeout(400)
    res('tryk på kasse ved siden af: skub og banen er løst', st()['solved'], json.dumps(st()))
    res('"Banen er løst" vises med point', pg.evaluate("!document.getElementById('solved-overlay').hidden") and '100 point' in pg.evaluate("document.getElementById('solved-score').textContent"))
    res('runden har 100 point', pg.evaluate("Kasser.progress.roundTotal()") == 100)
    pg.click('#btn-next'); pg.wait_for_timeout(200)
    res('Næste bane er bane 2', pg.evaluate("Kasser.run.state.level") == 1)
    # to kasser i træk: brug en lille testbane
    # bane 2: '#    #','# $  #','#@ #.#' – gå op, skub til højre to gange, så kassen er ved (4,2)
    for k in ['ArrowUp', 'ArrowRight', 'ArrowRight']: pg.keyboard.press(k); pg.wait_for_timeout(330)
    res('bane 2: kassen skubbet', st()['b'] == [2*6+4], json.dumps(st()))
    # dwell: som standard ét skridt pr. dwell; blikket skal væk og tilbage. Med gentagelse: flere skridt
    pg.evaluate("() => { Kasser.settings.set('animation', false); Kasser.settings.set('dwell', true); Kasser.settings.set('dwellTime', 0.6); }")
    pg.keyboard.press('z'); pg.wait_for_timeout(100)
    def gaze(sel, ms):
        bb = pg.locator(sel).bounding_box()
        pg.mouse.move(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2, steps=4)
        pg.wait_for_timeout(ms)
    def away():
        pg.mouse.move(5, 5, steps=2); pg.wait_for_timeout(150)
    res('pilene gentager ikke som standard', pg.evaluate("[...document.querySelectorAll('.arrow')].every(a => !a.hasAttribute('data-dwell-repeat'))") and pg.evaluate("Kasser.gameSettings.get('dwellRepeat')") is False)
    pg.keyboard.press('r'); pg.wait_for_timeout(100)   # spilleren på (1,3): to frie felter opad
    m0 = st()['m']
    gaze('.arrow-up', 2000)             # over tre dwell-tider på samme pil
    m1 = st()['m']
    res('dwell: ét skridt, selv når blikket bliver på pilen', m1 == m0 + 1, '%d -> %d' % (m0, m1))
    away(); gaze('.arrow-up', 900)
    m2 = st()['m']
    res('dwell: kig væk og tilbage giver næste skridt', m2 == m1 + 1, '%d -> %d' % (m1, m2))
    away()
    pg.evaluate("() => { Kasser.gameSettings.set('dwellRepeat', true); Kasser.syncDwellRepeat(); }")
    res('"Gentag skridt ved fortsat blik" sætter gentagelse på pilene', pg.evaluate("[...document.querySelectorAll('.arrow')].every(a => a.hasAttribute('data-dwell-repeat'))"))
    pg.keyboard.press('r'); pg.wait_for_timeout(100)
    m0 = st()['m']
    gaze('.arrow-up', 1500)             # ca. 2,5 dwell-tider: to skridt op
    m1 = st()['m']
    away()
    res('gentag: flere skridt ved fortsat blik', m1 >= m0 + 2, '%d -> %d' % (m0, m1))
    pg.evaluate("() => { Kasser.gameSettings.set('dwellRepeat', false); Kasser.syncDwellRepeat(); Kasser.settings.set('dwell', false); }")
    # fastlåst kasse: bane 2 – skub kassen op i hjørnet (2,1): gå (1,3)->... brug genstart og direkte træk
    pg.click('#btn-restart'); pg.wait_for_timeout(100)
    for k in ['ArrowRight', 'ArrowUp', 'ArrowRight', 'ArrowUp', 'ArrowLeft']:
        pg.keyboard.press(k); pg.wait_for_timeout(80)
    s = st()
    res('kasse skubbet op i hjørnet', s['b'] == [1*6+1], json.dumps(s))
    res('rolig besked om fastlåst kasse vises', pg.evaluate("!document.getElementById('stuck-note').hidden"))
    res('Fortryd-knappen fremhæves', pg.evaluate("document.getElementById('btn-undo').classList.contains('suggest')"))
    pg.evaluate("Kasser.gameSettings.set('stuckWarning', false); Kasser.refresh()")
    res('advarslen kan slås fra', pg.evaluate("document.getElementById('stuck-note').hidden"))
    pg.evaluate("Kasser.gameSettings.set('stuckWarning', true); Kasser.refresh()")
    pg.click('#btn-undo'); pg.wait_for_timeout(100)
    res('fortryd fjerner beskeden', pg.evaluate("document.getElementById('stuck-note').hidden"))
    # pause og banevalg
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    res('Esc giver pause', pg.evaluate("!document.getElementById('pause-overlay').hidden"))
    pg.click('#btn-pause-levels'); pg.wait_for_timeout(150)
    res('banevalg: bane 1 løst, 1–4 åbne, 5 låst', pg.evaluate("[...document.querySelectorAll('.level-btn')].map(b => (b.classList.contains('done') ? 'L' : b.disabled ? 'x' : 'o')).join('')") == 'Looo' + 'xxxx')
    # afslut runde = game over -> top 10 (her fra pausemenuen; banevalget har samme knap)
    res('banevalget har "Afslut runde"', pg.evaluate("!document.getElementById('btn-end-round').disabled"))
    pg.evaluate("Kasser.start(1)"); pg.wait_for_timeout(100)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    res('pausemenuen har "Afslut runde / Gem point"', pg.evaluate("!document.getElementById('pause-overlay').hidden && !document.getElementById('btn-pause-end-round').disabled"))
    pg.click('#btn-pause-end-round'); pg.wait_for_timeout(200)
    res('Afslut runde viser "Runden er slut"', pg.evaluate("Kasser.screen") == 'gameover' and pg.evaluate("document.getElementById('go-score').textContent") == '100')
    rec = pg.evaluate("Kasser.records.list(Kasser.category)")
    res('runden er gemt i top 10', len(rec) == 1 and rec[0]['score'] == 100 and rec[0]['levels'] == 1, json.dumps(rec)[:100])
    res('ny rekord meldes', pg.evaluate("document.getElementById('go-rank').textContent") == 'Ny rekord!')
    pg.reload(); pg.wait_for_timeout(200)
    res('rekord og fremskridt findes efter genindlæsning', len(pg.evaluate("Kasser.records.list(Kasser.category)")) == 1 and pg.evaluate("Kasser.progress.solvedCount()") == 1 and not pg.evaluate("Kasser.progress.roundActive()"))
    res('Fortsæt peger på bane 2', 'Bane 2' in pg.evaluate("document.getElementById('continue-sub').textContent"))
    # Glød kan slås fra (temaets glød-faktor bliver 0), og spillet kan stadig tegnes
    pg.evaluate("Kasser.show('settings')"); pg.click('[data-tab=udseende]'); pg.wait_for_timeout(80)
    pg.click('[data-ksset=glow][data-value=false]'); pg.wait_for_timeout(80)
    res('Glød fra: --glow er 0', pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--glow').trim()") == '0' and pg.evaluate("document.documentElement.classList.contains('ks-gloed-fra')"))
    pg.evaluate("Kasser.start(1)"); pg.wait_for_timeout(100)
    res('Glød fra: lageret tegnes uden glød', pg.evaluate("Kasser.tokens().glod") == 0)
    SHOT and pg.screenshot(path=SHOT + 'uden-gloed.png')
    pg.evaluate("Kasser.gameSettings.set('glow', true); Kasser.show('menu')"); pg.reload(); pg.wait_for_timeout(200)
    res('Glød til igen', pg.evaluate("Kasser.tokens().glod") == 1)
    # Tilbage til hallen
    pg.click('#btn-hall'); pg.wait_for_timeout(400)
    res('Tilbage til hallen åbner ../index.html', pg.url.endswith('/hojt-arkade/index.html'), pg.url)
    ctx.close()

def biggest():
    return "(() => { let bi = 0, bs = 0; KasserBaner.forEach((d, i) => { const s = d.rows.length * Math.max(...d.rows.map(r => r.length)); if (s >= bs) { bs = s; bi = i; } }); return bi; })()"

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None, args=['--no-sandbox'])
    for (w,h) in [x for x in SIZES if not os.environ.get('ONLY') or '%dx%d'%x in os.environ['ONLY'].split(',')]:
        tag = 'responsiv-%dx%d' % (w, h)
        big = (w, h) == (1920, 1080)
        ctx = b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, has_touch=w < 900)
        pg = ctx.new_page()
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.goto(URL); pg.wait_for_timeout(250)
        pg.evaluate("() => { localStorage.clear(); }"); pg.reload(); pg.wait_for_timeout(250)
        check(pg, 'startmenu', '#menu', w, h, big and 'startskaerm.png')
        pg.evaluate("Kasser.show('om')"); pg.wait_for_timeout(80); check(pg, 'om', '#om', w, h)
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("Kasser.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            check(pg, 'indstillinger/'+tab, '#settings', w, h)
        pg.evaluate("Kasser.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h)
        # lidt fremskridt: bane 1-5 løst, en runde i gang
        pg.evaluate("() => { for (let n = 0; n < 5; n++) Kasser.progress.record(n, KasserBaner[n].par + (n % 2), KasserGame.points(n, KasserBaner[n].par + (n % 2), KasserBaner[n].par)); }")
        pg.evaluate("Kasser.openLevels('menu')"); pg.wait_for_timeout(100)
        check(pg, 'banevalg', '#levels', w, h, big and 'banevalg.png')
        # spillet: den største bane, et par træk og en forhåndsvisning
        pg.evaluate("() => { Kasser.settings.set('animation', false); Kasser.start(%s); }" % biggest()); pg.wait_for_timeout(150)
        pg.evaluate("() => { ['left','down','left'].forEach(d => Kasser.move(d)); Kasser.hover(['up','down','left','right'].find(d => Kasser.run.check(d).kind === 'push') || 'down'); }")
        pg.wait_for_timeout(80)
        check(pg, 'spil (største bane)', '#game', w, h, tag + '.png')
        if big and SHOT: pg.screenshot(path=SHOT + 'spil.png')
        pg.evaluate("Kasser.hover(null)")
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check(pg,'pause','#game',w,h, (w, h) == (1920, 1080) and 'pause.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
        # fastlåst kasse (bane 2)
        pg.evaluate("() => { Kasser.start(1); ['right','up','right','up','left'].forEach(d => Kasser.move(d)); document.activeElement && document.activeElement.blur(); }"); pg.wait_for_timeout(80)
        check(pg, 'fastlåst kasse', '#game', w, h, (w, h) == (1920, 1080) and 'fastlaast.png')
        ov = pg.evaluate("""(() => { const n = document.getElementById('stuck-msg').getBoundingClientRect(), s = document.getElementById('stuck-note');
          const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
          const els = ['board-wrap', 'btn-pause', 'hud-box', 'btn-undo', 'btn-restart'].map(id => document.getElementById(id)).concat([...document.querySelectorAll('.arrow')]);
          return { shown: !s.hidden && n.width > 0, inside: n.left >= 0 && n.top >= 0 && n.right <= innerWidth && n.bottom <= innerHeight,
                   hits: els.filter(e => hit(n, e.getBoundingClientRect())).map(e => e.id || e.className) }; })()""")
        line = '%s %dx%d %-28s %s' % ('OK  ' if ov['shown'] and ov['inside'] and not ov['hits'] else 'FEJL', w, h, 'besked uden overlap', json.dumps(ov))
        print(line)
        if not (ov['shown'] and ov['inside'] and not ov['hits']): fails.append(line)
        # løst bane
        pg.evaluate("() => { Kasser.start(0); ['right','right','right'].forEach(d => Kasser.move(d)); }"); pg.wait_for_timeout(120)
        check(pg, 'banen er løst', '#game', w, h, big and 'bane-loest.png')
        # runden er slut med rekorder
        pg.evaluate("() => { for (let i = 0; i < 4; i++) Kasser.records.add(Kasser.category, 400 + i * 150, {levels: 3 + i}); Kasser.endRound(); }")
        pg.wait_for_timeout(150)
        check(pg,'runden er slut','#gameover',w,h, big and 'game-over.png')
        ctx.close()
    if not os.environ.get('ONLY'): flow_test(b)
    if not os.environ.get('ONLY'):
        ctx = b.new_context(viewport={'width':1920,'height':1080}); pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append('hal pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('hal ' + m.type+': '+m.text) if m.type == 'error' else None)
        pg.goto(HALL); pg.wait_for_timeout(800)
        idx = pg.evaluate("(window.HOJT_SPIL || []).findIndex(x => x.sti === 'kasser/')")
        for _ in range(max(0, idx)): pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(120)
        pg.wait_for_timeout(900)
        found = pg.evaluate("() => { const g = (window.HOJT_SPIL || []).find(x => x.sti === 'kasser/'); return g ? g.status + ' ' + g.skaerm : 'mangler'; }")
        print('HAL: Kasser =', found)
        if found != 'aktiv hal/skaerme/kasser.svg': fails.append('hallen: ' + found)
        SHOT and pg.screenshot(path=SHOT + 'hal.png')
        ctx.close()
    b.close()
print()
print('MINDSTE KNAP PR. OPLØSNING:')
for k, v in summary.items(): print('  %-10s %s px' % (k, min(x[1] for x in v if x[1] is not None)))
print('KONSOL:', errs)
print('FEJL:', len(fails))
for f in fails: print('  ', f)
sys.exit(1 if fails or errs else 0)

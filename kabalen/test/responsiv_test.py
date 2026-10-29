# Responsiv test af Kabalen: alle skærme ved de 8 opløsninger fra den fælles brief.
# Tjekker: ingen rulning, intet klippet af, ingen overlappende knapper, tekst inden i knapperne,
# alle mål mindst 84 px (knapper, pladser og de kort, man kan pege på: den synlige del af kortet),
# og ingen fejl i konsollen.
#
# Desuden spillet i browseren: Træk 1/Træk 3 i menuen, vælg et kort med musen (kortene ovenpå
# følger med, og de lovlige mål lyser), læg det på et mål, samme kort igen flytter (ét mål),
# bunken, tastaturet, Hint, Saml, Fortryd, pause, glød fra, et helt spil vundet med løserens træk
# (automatisk afslutning, sejrsboks, næste spil), "sidder fast", Giv op → "Serien er slut",
# rekorder, dwell (ét dwell = én handling) og hallen med Kabalen som aktivt spil.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 kabalen/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     KABALEN_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
HALL = (pathlib.Path(__file__).resolve().parent.parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('KABALEN_SKAERMBILLEDER')
SHOT = (SHOT_DIR.rstrip('/') + '/') if SHOT_DIR else None
if SHOT: os.makedirs(SHOT, exist_ok=True)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
SIZES = [(1920,1080),(1366,768),(1280,720),(1024,768),(1024,1366),(1366,1024),(390,844),(844,390)]
MIN_T = 84
SEED = int(os.environ.get('SEED', '2026'))
errs=[]; fails=[]; summary={}
CHECK = """(sel) => {
  const se = document.scrollingElement, W = se.clientWidth, H = se.clientHeight;
  const vis = e => !e.closest('[hidden]') && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
  const out = {scroll: se.scrollHeight > se.clientHeight || se.scrollWidth > se.clientWidth, inner: [], clipped: [], overlap: [], textOut: [], small: []};
  document.querySelectorAll('.screen, .overlay').forEach(s => {
     if (s.closest('[hidden]')) return;
     if (s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1) out.inner.push((s.id||s.className) + ' ' + s.scrollWidth + 'x' + s.scrollHeight + '/' + s.clientWidth + 'x' + s.clientHeight); });
  const scr = document.querySelector(sel);
  scr.querySelectorAll('button, a, h1, h2, h3, p, li, .hud, .bord, .side, .setting-label').forEach(e => {
     if (!vis(e) || e.classList.contains('kort')) return; const r = e.getBoundingClientRect();
     if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.clipped.push((e.id || e.tagName + '.' + e.className) + ' ' + [r.left,r.top,r.right,r.bottom].map(Math.round));
  });
  const name = e => e.id || e.dataset.slot || e.dataset.tab || e.dataset.mode || e.dataset.recMode || e.getAttribute('aria-label') || e.textContent.trim().replace(/\\s+/g,' ').slice(0,16);
  const ov = [...scr.querySelectorAll('.overlay')].find(o => !o.hidden);
  const inScope = e => ov ? ov.contains(e) : true;
  // Knapper (ikke kort og pladser)
  const bs = [...scr.querySelectorAll('button, a.btn')].filter(vis).filter(e => !e.classList.contains('kort') && !e.classList.contains('plads'));
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i].getBoundingClientRect(), b = bs[j].getBoundingClientRect();
     if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1 && !bs[i].contains(bs[j]) && !bs[j].contains(bs[i]) && bs[i].closest('.overlay') === bs[j].closest('.overlay')) out.overlap.push(name(bs[i]) + '/' + name(bs[j])); }
  const counted = bs.filter(inScope);
  counted.forEach(e => { if (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2) out.textOut.push(name(e) + ' ' + e.scrollWidth + '>' + e.clientWidth); });
  const sizes = counted.map(e => { const r = e.getBoundingClientRect(); return [Math.round(Math.min(r.width, r.height)), name(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)]; }).sort((a, b) => a[0] - b[0]);
  out.minBtn = sizes.length ? sizes[0][0] : null; out.minName = sizes.length ? sizes[0][1] : '';
  // Kort og pladser, man kan pege på (dwell-mål): den synlige del skal være mindst 84 px
  out.minCard = null; out.minSlot = null; out.nTargets = 0;
  if (!ov) {
    const cards = [...scr.querySelectorAll('.bord .kort')].filter(vis).filter(e => !e.hasAttribute('data-no-dwell') && !e.classList.contains('gemt'));
    cards.forEach(e => { const r = e.getBoundingClientRect(), v = Math.min(r.height, +e.dataset.synlig || r.height), m = Math.round(Math.min(r.width, v));
      out.nTargets++; if (out.minCard === null || m < out.minCard) out.minCard = m; if (m < 84) out.small.push('kort ' + e.dataset.k + ' ' + Math.round(r.width) + 'x' + Math.round(v)); });
    const slots = [...scr.querySelectorAll('.bord .plads')].filter(vis).filter(e => !e.hasAttribute('data-no-dwell'));
    slots.forEach(e => { const r = e.getBoundingClientRect(), m = Math.round(Math.min(r.width, r.height));
      out.nTargets++; if (out.minSlot === null || m < out.minSlot) out.minSlot = m; if (m < 84) out.small.push('plads ' + e.dataset.slot + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
  }
  return out; }"""
def check(pg, name, sel, w, h, shot=None):
    r = pg.evaluate(CHECK, sel)
    small_btn = r['minBtn'] is not None and r['minBtn'] < MIN_T
    ok = not r['scroll'] and not r['inner'] and not r['clipped'] and not r['overlap'] and not r['textOut'] and not small_btn and not r['small']
    extra = ''
    if sel == '#game' and r['minCard'] is not None:
        g = pg.evaluate("Kabalen.geo ? [document.querySelector('#game').dataset.layout, Kabalen.geo.mode, Kabalen.geo.cw, Kabalen.geo.ch] : []")
        extra = ' layout=%s/%s kort=%sx%spx mindste kortmål=%spx plads=%spx (%d mål)' % (g[0], g[1], g[2], g[3], r['minCard'], r['minSlot'], r['nTargets']) if g else ''
    line = '%s %dx%d %-30s mindste knap=%spx (%s)%s' % ('OK  ' if ok else 'FEJL', w, h, name, r['minBtn'], r['minName'], extra)
    if not ok: line += ' ' + json.dumps({k: r[k] for k in ('scroll','inner','clipped','overlap','textOut','small')}, ensure_ascii=False)
    print(line)
    summary.setdefault('%dx%d' % (w, h), []).append(min([x for x in (r['minBtn'], r['minCard'], r['minSlot']) if x is not None] or [999]))
    if not ok: fails.append(line)
    if shot and SHOT: pg.screenshot(path=SHOT + shot)
def pages(pg, scr, w, h, name, shotbase):
    n = 1
    while True:
        check(pg, '%s side %d' % (name, n), scr, w, h, shotbase and '%s-trin%d.png' % (shotbase, n))
        nxt = pg.locator(scr + ' .trin-nav:not([hidden]) .trin-next')
        if nxt.count() == 0 or nxt.is_disabled(): break
        nxt.click(); pg.wait_for_timeout(60); n += 1
        if n > 8: fails.append('for mange sider ' + name); break
    return n
def st(pg, expr): return pg.evaluate(expr)
def wait_game(pg, tag):
    try: pg.wait_for_function("Kabalen.game && !Kabalen.waiting && Kabalen.live()", timeout=30000)
    except Exception: fails.append(tag + ' spillet blev aldrig givet'); return False
    pg.wait_for_timeout(350); return True
# Et kort, der kan flyttes (fra bunkerne, ellers fra de vendte kort). want: antal mål (None = mindst ét)
FIND = """(want) => { const g = Kabalen.game, s = g.state;
  for (let c = 0; c < 7; c++) { const p = s.t[c]; for (let i = p.d; i < p.c.length; i++) { const t = g.targets({k:'t', col:c, idx:i});
    if (t.length && (want === null || t.length === want)) return {k: p.c[i], n: p.c.length - i, targets: t}; } }
  if (s.w > 0) { const t = g.targets({k:'w'}); if (t.length && (want === null || t.length === want)) return {k: s.talon[s.w - 1], n: 1, targets: t}; }
  return null; }"""
def find_card(pg, want=None, draws=40):
    for _ in range(draws):
        r = pg.evaluate(FIND, want)
        if r: return r
        pg.evaluate("Kabalen.draw()"); pg.wait_for_timeout(450)   # kortet glider på plads
    return None
def card_point(pg, k):
    return pg.evaluate("""k => { const e = document.querySelector('.bord .kort[data-k="' + k + '"]'), r = e.getBoundingClientRect();
      const v = Math.min(r.height, +e.dataset.synlig || r.height); return [r.left + r.width / 2, r.top + Math.min(v / 2, 40)]; }""", k)
def target_point(pg, t):
    """Målets øverste kort (det, man kan pege på), eller den tomme plads."""
    k = pg.evaluate("t => { const s = Kabalen.game.state; if (t.k === 'f') return s.f[t.s] ? KabaleLogik.kort(t.s, s.f[t.s] - 1) : -1; const p = s.t[t.col]; return p.c.length ? p.c[p.c.length - 1] : -1; }", t)
    if k >= 0: return card_point(pg, k)
    sl = ('g%d' % t['s']) if t['k'] == 'f' else ('t%d' % t['col'])
    return pg.evaluate("""sl => { const e = document.querySelector('.bord .plads[data-slot="' + sl + '"]'), r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }""", sl)
def near_won(draw):
    # Alt er lagt op undtagen dronning og konge i hjerter (to bunker) og kongen i spar (i bunken)
    return "{ t: [{d:0,c:[24]},{d:0,c:[25]},{d:0,c:[]},{d:0,c:[]},{d:0,c:[]},{d:0,c:[]},{d:0,c:[]}], f:[12,11,13,13], talon:[12], w:0, draw:%d }" % draw

def gameplay(pg, w, h, tag, big, small):
    # Vælg et kort med musen: kortene ovenpå følger med, og målene lyser
    c = find_card(pg)
    if not c: fails.append(tag + ' fandt intet kort at flytte'); return
    moves0 = st(pg, "Kabalen.game.moves")
    x, y = card_point(pg, c['k']); pg.mouse.click(x, y); pg.wait_for_timeout(80)
    r = st(pg, "[Kabalen.sel && Kabalen.sel.cards.length, Kabalen.sel && Kabalen.sel.targets.length, document.querySelectorAll('.bord .kort.valgt').length, document.querySelectorAll('.bord .maal').length]")
    if r[0] != c['n'] or r[1] != len(c['targets']) or r[2] != c['n'] or r[3] < len(c['targets']): fails.append('%s valg af kort gav %s (ventet %s kort, %s mål)' % (tag, r, c['n'], len(c['targets'])))
    pg.mouse.move(1, 1); pg.wait_for_timeout(60)
    check(pg, 'kort valgt, mål lyser', '#game', w, h, tag + '.png')
    if big and SHOT: pg.screenshot(path=SHOT + 'spil-i-gang.png')
    x, y = target_point(pg, c['targets'][0]); pg.mouse.click(x, y); pg.wait_for_timeout(450)
    if st(pg, "Kabalen.game.moves") != moves0 + 1 or st(pg, "Kabalen.sel") is not None: fails.append(tag + ' kortet blev ikke lagt på målet')
    # Samme kort igen flytter, når der kun er ét mål
    c = find_card(pg, 1)
    if c:
        m0 = st(pg, "Kabalen.game.moves")
        x, y = card_point(pg, c['k']); pg.mouse.click(x, y); pg.wait_for_timeout(60)
        if 'Vælg målet eller kortet igen' not in pg.inner_text('#hint'): fails.append(tag + ' teksten for ét mål mangler: ' + pg.inner_text('#hint'))
        pg.mouse.click(x, y); pg.wait_for_timeout(450)
        if st(pg, "Kabalen.game.moves") != m0 + 1: fails.append(tag + ' samme kort igen flyttede ikke ' + json.dumps([c, x, y, st(pg, "[Kabalen.sel && Kabalen.sel.targets, Kabalen.game.moves, document.getElementById('hint').textContent]")], ensure_ascii=False))
    # Bunken: klik trækker et kort
    if st(pg, "Kabalen.game.state.talon.length > 0"):
        d0 = st(pg, "Kabalen.game.draws")
        x, y = target_point(pg, {'k': 't', 'col': 0}) if False else pg.evaluate("(() => { const r = document.querySelector('.bord .plads[data-slot=bunke]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
        pg.mouse.click(x, y); pg.wait_for_timeout(80)
        if st(pg, "Kabalen.game.draws") != d0 + 1: fails.append(tag + ' klik på bunken trak ikke')
    # Tastatur: mellemrum trækker, H giver hint, U fortryder (−2), Esc pause
    d0 = st(pg, "Kabalen.game.draws"); pg.keyboard.press(' '); pg.wait_for_timeout(60)
    if st(pg, "Kabalen.game.draws") != d0 + 1: fails.append(tag + ' mellemrum trak ikke')
    u0 = st(pg, "[Kabalen.game.undos, Kabalen.series.total()]")
    pg.keyboard.press('u'); pg.wait_for_timeout(60)
    if st(pg, "Kabalen.game.undos") != u0[0] + 1 or st(pg, "Kabalen.game.draws") != d0: fails.append(tag + ' U fortrød ikke')
    pg.keyboard.press('h'); pg.wait_for_timeout(200)
    if not st(pg, "!!Kabalen.hint") or 'Hint' not in pg.inner_text('#hint'): fails.append(tag + ' H gav intet hint')
    else: check(pg, 'hint', '#game', w, h, small and tag + '-hint.png')
    # Tast 1–7 vælger øverste åbne kort i bunken; Esc fravælger
    pg.keyboard.press('7'); pg.wait_for_timeout(60)
    if st(pg, "!Kabalen.sel || Kabalen.sel.src.col !== 6") : fails.append(tag + ' tast 7 valgte ikke bunke 7')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
    if st(pg, "Kabalen.sel") is not None: fails.append(tag + ' Esc fravalgte ikke')
    # Saml-knappen
    pg.click('#btn-saml'); pg.wait_for_timeout(120)
    # Fortryd-knappen
    if st(pg, "Kabalen.game.canUndo()"):
        n0 = st(pg, "Kabalen.game.undos"); pg.click('#btn-undo'); pg.wait_for_timeout(80)
        if st(pg, "Kabalen.game.undos") != n0 + 1: fails.append(tag + ' Fortryd-knappen virkede ikke')

def win_whole_game(pg, tag):
    """Spil et helt spil færdigt med løserens træk (som spilleren): automatisk afslutning og sejrsboks."""
    ok = pg.evaluate("""() => { const res = KabaleLogik.solve(Kabalen.game.state, {maxNodes: 60000}); if (res.status !== 'vundet') return 'ingen løsning: ' + res.status;
       for (const m of res.path) if (!Kabalen.live() && Kabalen.game.allOpen()) break; else if (!Kabalen.play(m)) return 'trækket kunne ikke spilles ' + JSON.stringify(m); return true; }""")
    if ok is not True: fails.append(tag + ' ' + str(ok)); return False
    try: pg.wait_for_function("!document.getElementById('done-overlay').hidden", timeout=20000)
    except Exception: fails.append(tag + ' sejrsboksen kom ikke efter et vundet spil'); return False
    return True

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None, args=['--no-sandbox'])
    for (w,h) in [x for x in SIZES if not os.environ.get('ONLY') or '%dx%d'%x in os.environ['ONLY'].split(',')]:
        small = min(w, h) < 560
        big = (w, h) == (1920, 1080)
        tag = 'responsiv-%dx%d' % (w, h)
        ctx = b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, has_touch=w < 900)
        pg = ctx.new_page()
        # Fast tilfældighed, så en fejl kan gentages (SEED=... giver andre spil)
        pg.add_init_script("(() => { let a = %d >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; const D = Date; Date.now = () => 1700000000000; })()" % (SEED + w * 7 + h))
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
        pg.goto(URL); pg.wait_for_timeout(400)
        check(pg,'start','#menu',w,h, (big and 'startskaerm.png') or (small and tag + '-start.png'))
        hb = pg.evaluate("(() => { const r = document.getElementById('btn-hall').getBoundingClientRect(); return [Math.round(Math.min(r.width, r.height)), document.getElementById('btn-hall').dataset.href, document.getElementById('btn-hall').textContent.trim()]; })()")
        if hb[0] < MIN_T or hb[1] != '../index.html' or 'Tilbage til hallen' not in hb[2]: fails.append('%s Tilbage til hallen: %s' % (tag, hb))
        for m in ['3', '1']:
            pg.click('#menu [data-mode="%s"]' % m); pg.wait_for_timeout(30)
            if st(pg, "Kabalen.gameSettings.get('draw')") != int(m): fails.append(tag + ' Træk %s kunne ikke vælges' % m)
        pg.evaluate("Kabalen.show('om')"); pg.wait_for_timeout(100)
        pages(pg, '#om', w, h, 'om', small and tag+'-om')
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("Kabalen.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab, small and '%s-indstillinger-%s' % (tag, tab))
        pg.evaluate("Kabalen.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h)
        pg.click('#records [data-rec-mode="3"]'); pg.wait_for_timeout(60); check(pg,'rekorder (Træk 3)','#records',w,h)
        pg.evaluate("Kabalen.show('menu')"); pg.wait_for_timeout(60)
        # Spillet: kun løselige spil, givet i bidder
        pg.click('#btn-start')
        if not wait_game(pg, tag): ctx.close(); continue
        d = st(pg, "Kabalen.deal && [Kabalen.deal.loeselig, Kabalen.deal.deal.draw]")
        if d != [True, 1]: fails.append('%s spillet er ikke bevist løseligt: %s' % (tag, d))
        check(pg,'spil (nyt)','#game',w,h)
        gameplay(pg, w, h, tag, big, small)
        # Glød fra: ingen lysskær, alt kan stadig læses
        pg.evaluate("Kabalen.gameSettings.set('gloed', false)"); pg.wait_for_timeout(300)
        g = pg.evaluate("""() => [document.documentElement.dataset.kaGloed, getComputedStyle(document.querySelector('.bord .kort.opad') || document.body).boxShadow, getComputedStyle(document.querySelector('#btn-hint')).boxShadow]""")
        if g[0] != 'fra' or g[1] != 'none': fails.append('%s glød fra gav %s' % (tag, g))
        check(pg,'spil uden glød','#game',w,h, (big and 'uden-gloed.png') or (small and tag+'-uden-gloed.png'))
        pg.evaluate("Kabalen.gameSettings.set('gloed', true)"); pg.wait_for_timeout(40)
        pg.keyboard.press('p'); pg.wait_for_timeout(100); check(pg,'pause','#game',w,h, small and tag+'-pause.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
        if not st(pg, "Kabalen.live()"): fails.append(tag + ' Esc lukkede ikke pausen')
        # Sidder fast: boksen med Fortryd / Game over
        pg.evaluate("Kabalen.showStuck()"); pg.wait_for_timeout(100)
        check(pg,'sidder fast','#game',w,h, small and tag+'-fast.png')
        pg.click('#btn-stuck-undo'); pg.wait_for_timeout(100)
        if not st(pg, "document.getElementById('stuck-overlay').hidden"): fails.append(tag + ' Fortryd i "sidder fast" lukkede ikke boksen')
        # Et helt spil vundet
        score0 = st(pg, "Kabalen.series.total()")
        if win_whole_game(pg, tag):
            check(pg,'spil vundet','#game',w,h, (big and 'spil-vundet.png') or (small and tag+'-vundet.png'))
            r = st(pg, "[Kabalen.series.wins, Kabalen.game.won(), Kabalen.series.total() > %d + 200, document.getElementById('done-points').textContent]" % score0)
            if r[:3] != [1, True, True]: fails.append('%s sejren gav %s' % (tag, r))
            pg.click('#btn-next')
            if wait_game(pg, tag):
                if st(pg, "[Kabalen.series.games, Kabalen.series.wins, Kabalen.game.moves]") != [2, 1, 0]: fails.append(tag + ' Næste spil virkede ikke')
        # Næsten vundet spil: Saml lægger resten op, og sejrsboksen kommer
        pg.evaluate("Kabalen.loadDeal(%s)" % near_won(1)); pg.wait_for_timeout(100)
        pg.evaluate("Kabalen.draw()"); pg.wait_for_timeout(60)
        pg.click('#btn-saml')
        try: pg.wait_for_function("!document.getElementById('done-overlay').hidden", timeout=5000)
        except Exception: fails.append(tag + ' Saml på næsten vundet spil gav ingen sejr'); ctx.close(); continue
        if st(pg, "Kabalen.series.wins") != 2: fails.append(tag + ' anden sejr blev ikke talt')
        # Stop her → Serien er slut, og rekorden gemmes
        total = st(pg, "Kabalen.series.total()")
        pg.click('#btn-done-quit'); pg.wait_for_timeout(200)
        if st(pg, "document.getElementById('gameover').hidden"): fails.append(tag + ' slutskærmen blev ikke vist')
        if pg.inner_text('#go-title').strip() != 'Serien er slut': fails.append(tag + ' slutskærmen siger %r' % pg.inner_text('#go-title'))
        if not st(pg, "Kabalen.records.list('traek1').some(e => e.score === %d && e.levels === 2)" % total): fails.append(tag + ' rekorden blev ikke gemt (%s)' % total)
        split = st(pg, "!document.getElementById('btn-go-rec').hidden")
        check(pg,'serien er slut','#gameover',w,h, (big and 'serien-er-slut.png') or (small and tag+'-gameover.png'))
        if split:
            pg.click('#btn-go-rec'); pg.wait_for_timeout(80); check(pg,'serien er slut (rekorder)','#gameover',w,h, small and tag+'-gameover-trin2.png')
            pg.click('#btn-go-rec'); pg.wait_for_timeout(60)
        # Træk 3 og Giv op med bekræftelse
        pg.evaluate("Kabalen.show('menu')"); pg.click('#menu [data-mode="3"]'); pg.wait_for_timeout(60); pg.click('#btn-start')
        if wait_game(pg, tag):
            if st(pg, "[Kabalen.series.draw, Kabalen.deal.loeselig]") != [3, True]: fails.append(tag + ' Træk 3 gav ikke et løseligt træk 3-spil')
            pg.evaluate("Kabalen.draw()"); pg.wait_for_timeout(450)
            check(pg,'spil (Træk 3)','#game',w,h, (big and 'traek3.png') or (small and tag+'-traek3.png'))
            pg.click('#btn-opgiv'); pg.wait_for_timeout(100)
            if st(pg, "document.activeElement && document.activeElement.id") != 'btn-confirm-no': fails.append(tag + ' Nej har ikke fokus i bekræftelsen')
            check(pg,'bekræft giv op','#game',w,h, small and tag+'-bekraeft.png')
            pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
            if not st(pg, "document.getElementById('confirm-overlay').hidden && Kabalen.live()"): fails.append(tag + ' Esc i bekræftelsen spillede ikke videre')
            pg.click('#btn-opgiv'); pg.wait_for_timeout(80); pg.click('#btn-confirm-yes'); pg.wait_for_timeout(200)
            if 'gav op' not in pg.inner_text('#go-reason'): fails.append(tag + ' slutskærmen siger ikke "gav op": ' + pg.inner_text('#go-reason'))
            pg.evaluate("Kabalen.gameSettings.set('draw', 1)")
        # Dwell: ét dwell vælger, ét dwell lægger, intet gentages
        pg.evaluate("Kabalen.show('menu')"); pg.click('#btn-start')
        if wait_game(pg, tag):
            pg.mouse.move(1, 1)
            pg.evaluate("Kabalen.settings.set('dwellTime', 0.5); Kabalen.settings.set('dwell', true)")
            c = find_card(pg)
            if c:
                m0 = st(pg, "Kabalen.game.moves")
                x, y = card_point(pg, c['k']); pg.mouse.move(x, y, steps=3); pg.wait_for_timeout(200)
                ring = st(pg, "getComputedStyle(document.querySelector('.arkade-dwell-ring')).display !== 'none' && !Kabalen.sel")
                if not ring: fails.append(tag + ' dwell viste ingen fremskridtsring')
                try: pg.wait_for_function("!!Kabalen.sel", timeout=3000)
                except Exception: fails.append(tag + ' dwell på et kort valgte det ikke ' + json.dumps(pg.evaluate("([x, y]) => { const t = document.elementFromPoint(x, y); const c = t && t.closest('.kort, .plads'); return [Kabalen.live(), Kabalen.guard, Kabalen.dwell.isEnabled(), c && c.outerHTML.slice(0, 260), JSON.stringify(Kabalen.game.state.t.map(p => p.c.length))]; }", [x, y])))
                x, y = target_point(pg, c['targets'][0]); pg.mouse.move(x, y, steps=3)
                try: pg.wait_for_function("Kabalen.game.moves === %d" % (m0 + 1), timeout=3000)
                except Exception: fails.append(tag + ' dwell på målet lagde ikke kortet ' + json.dumps([c, st(pg, "[Kabalen.sel && Kabalen.sel.targets, Kabalen.game.moves]"), pg.evaluate("([x, y]) => { const t = document.elementFromPoint(x, y), c = t && t.closest('.kort, .plads'); return c && c.outerHTML.slice(0, 200); }", [x, y])]))
                pg.wait_for_timeout(1500)
                if st(pg, "[Kabalen.game.moves, !!Kabalen.sel]") != [m0 + 1, False]: fails.append(tag + ' dwell gentog handlingen')
                print('%s %dx%d dwell (ring vist: %s)' % ('OK  ' if not [f for f in fails if f.startswith(tag) and 'dwell' in f] else 'FEJL', w, h, ring))
            pg.evaluate("Kabalen.settings.set('dwell', false)"); pg.mouse.move(1, 1)
        # Tilbage til hallen fra startskærmen, og Kabalen er aktiv i hallen
        if big:
            pg.evaluate("Kabalen.show('menu')"); pg.wait_for_timeout(100); pg.click('#btn-hall'); pg.wait_for_timeout(500)
            if not pg.url.endswith('/index.html') or '/kabalen/' in pg.url: fails.append(tag + ' Tilbage til hallen gik til ' + pg.url)
            else:
                pg.goto(HALL + '?spil=kabalen'); pg.wait_for_timeout(1200)
                if SHOT: pg.screenshot(path=SHOT + 'hallen.png')
                act = pg.evaluate("""() => { const g = (window.HOJT_SPIL || []).find(g => g.sti === 'kabalen/');
                    const img = [...document.querySelectorAll('img, image')].some(e => /kabalen\\.svg/.test(e.getAttribute('src') || e.getAttribute('href') || ''));
                    return !!g && g.status === 'aktiv' && img && /Kabalen/.test(document.body.innerText); }""")
                print('%s hallen: Kabalen er aktiv med skærmbillede = %s' % ('OK  ' if act else 'FEJL', act))
                if not act: fails.append(tag + ' Kabalen er ikke aktiv i hallen')
        ctx.close()
    b.close()
print()
print('MINDSTE MÅL PR. OPLØSNING (knapper, kort og pladser):')
for k, v in summary.items(): print('  %-10s %s px' % (k, min(v)))
print('KONSOL:', errs)
print('FEJL:', len(fails))
for f in fails: print('  ', f)
sys.exit(1 if fails or errs else 0)

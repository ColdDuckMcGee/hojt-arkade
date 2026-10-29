# Responsiv test af Rampen: alle skærme ved 8 opløsninger.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knap >= 80 px og ingen fejl eller advarsler i konsollen.
#
# Desuden spillet i browseren: vinkel og kraft med knapper og tastatur, Send afsted
# (forhåndslinjen viser kun starten af buen), beslutningspunktet med 2–3 valgkort
# (spillet står stille, indtil der er valgt; kortene er >= 80 px og >= 3 cm, når der er
# plads; hvert kort viser et interval og aldrig et præcist landingstal), udsyn (intet
# tegnes ud over udsynet), kort med tastatur (1/2/3, J, V), en afbrudt tur fortsætter
# efter genindlæsning, tåge fra, egne lyde, turens resultat og rekord, værkstedet
# (køb), Ny bil med bekræftelse, pause, glød fra, dwell (ét dwell på Send afsted =
# én tur) og straks slutresultat ved prefers-reduced-motion. Til sidst hallen.
# v1.6 Fund: et fund i luften med kortet "Tag fundet", fundene i HUD'en (store ikoner,
# danske navne, plads til alle syv uden at dække pause-knappen), fundene gemmes med en
# afbrudt tur og vises på slutskærmen.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 rampen/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     RAMPEN_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
HALL = (pathlib.Path(__file__).resolve().parent.parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('RAMPEN_SKAERMBILLEDER')
SHOT = (SHOT_DIR.rstrip('/') + '/') if SHOT_DIR else None
if SHOT: os.makedirs(SHOT + 'ekstra', exist_ok=True)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
SIZES = [(1920,1080),(1366,768),(1280,720),(1024,768),(1024,1366),(1366,1024),(390,844),(844,390)]
MIN_BTN = 80
CM3 = 113   # 3 cm ved 96 css-px pr. tomme
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
  const bs = [...scr.querySelectorAll('button, a.btn')].filter(vis).filter(e => true);
  const cv = scr.querySelector('#course'); out.board = cv && vis(cv) ? [Math.round(cv.getBoundingClientRect().width), Math.round(cv.getBoundingClientRect().height)] : null;
  const name = e => e.id || e.dataset.slot || e.dataset.tab || e.dataset.mode || e.dataset.recMode || e.dataset.ang && ('vinkel' + e.dataset.ang) || e.dataset.pow && ('kraft' + e.dataset.pow) || e.dataset.id && ('kort-' + e.dataset.id) || e.dataset.upg || e.getAttribute('aria-label') || e.textContent.trim().replace(/\\s+/g,' ').slice(0,16);
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
def name_tag(w, h): return 'responsiv-%dx%d' % (w, h)
def check(pg, name, sel, w, h, shot=None):
    r = pg.evaluate(CHECK, sel)
    small_btn = r['minBtn'] is not None and r['minBtn'] < MIN_BTN
    ok = not r['scroll'] and not r['inner'] and not r['clipped'] and not r['overlap'] and not r['textOut'] and not small_btn
    extra = ''
    if sel == '#game': extra += ' layout=%s bane=%s' % (pg.evaluate("document.querySelector('#game').dataset.layout"), r['board'])
    if r['zoomed']: extra += ' (zoom)'
    line = '%s %dx%d %-30s mindste knap=%spx (%s)%s' % ('OK  ' if ok else 'FEJL', w, h, name, r['minBtn'], r['minName'], extra)
    if not ok: line += ' ' + json.dumps({k: r[k] for k in ('scroll','inner','clipped','overlap','textOut')}, ensure_ascii=False)
    print(line)
    summary.setdefault('%dx%d' % (w, h), []).append((name, r['minBtn']))
    if not ok: fails.append(line)
    if shot and SHOT: pg.screenshot(path=SHOT + ('' if shot == '%s.png' % name_tag(w, h) else 'ekstra/') + shot)
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

def st(pg, expr): return pg.evaluate(expr)
def center(pg, sel):
    bb = pg.locator(sel).bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
def idle(pg):
    pg.wait_for_function("!Rampen.playing", timeout=20000); pg.wait_for_timeout(60)

# Et fremskridt med vinger, raket og mønter (så der er noget at vælge og købe)
RIG = """() => { const L = Rampen.logik, p = L.newProgress(1);
  p.coins = 400; p.trips = 3; p.best = 180; p.carScore = 400;
  Object.assign(p.upg, {motor: 3, daek: 2, karrosseri: 2, aero: 2, vinger: 1, raket: 1, braendstof: 1});
  Rampen.setProgress(p); }"""

CARDS = """() => { const g = Rampen, f = g.game.flight, lim = f.x + g.udsyn;
  const bs = [...document.querySelectorAll('#kort-liste .valg-kort')].filter(b => !b.hidden);
  const txt = document.getElementById('game').innerText + ' ' + bs.map(b => b.getAttribute('aria-label')).join(' ') + ' ' + (document.getElementById('course').getAttribute('aria-label') || '');
  return { n: bs.length, ids: g.cards.map(c => c.id), size: bs.map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }),
    interval: bs.every(b => /ca\\. \\d+–\\d+ m/.test(b.textContent) && /ca\\. \\d+–\\d+ m/.test(b.getAttribute('aria-label'))),
    widths: g.cards.map(c => c.felt.til - c.felt.fra),
    exact: /(lander|holder|smadrer) (ved|på) \\d/i.test(txt),
    beyond: g.tegn.drawn.filter(o => o.x - o.r > lim + 0.01).length, drawn: g.tegn.drawn.length,
    hidden: g.game.course.range(lim + 1, lim + 400).length, lim: Math.round(lim) }; }"""
def cards_check(pg, w, h, tag):
    c = st(pg, CARDS)
    room = min(w, h) >= 700
    small = [s for s in c['size'] if min(s) < (CM3 if room else MIN_BTN)]
    bad = []
    if not 2 <= c['n'] <= 3 or c['n'] != len(c['ids']): bad.append('antal kort %s' % c['n'])
    if small: bad.append('for små kort %s' % small)
    if not c['interval']: bad.append('kort uden interval')
    if c['exact']: bad.append('præcist landingstal i teksten')
    if any(x < 10 for x in c['widths']): bad.append('felt under 10 m %s' % c['widths'])
    if c['beyond']: bad.append('%d ting tegnet ud over udsynet' % c['beyond'])
    print('%s %dx%d valgkort %s størrelser %s felter %s m, udsyn til %s m, %d tegnet, %d skjult derude' % ('OK  ' if not bad else 'FEJL', w, h, c['ids'], c['size'], c['widths'], c['lim'], c['drawn'], c['hidden']))
    if bad: fails.append('%s valgkort: %s' % (tag, '; '.join(bad)))

def resume_check(pg, w, h, tag):
    """En tur, der afbrydes ved et valg, fortsætter efter genindlæsning med samme kort."""
    pg.evaluate(RIG); pg.evaluate("Rampen.settings.set('animation', false); Rampen.start(); Rampen.game.setAngle(40); Rampen.refresh()"); pg.wait_for_timeout(60)
    pg.evaluate("Rampen.launch()"); idle(pg)
    before = st(pg, "[Rampen.game.flight.x, Rampen.cards.map(c => c.id + c.felt.fra + '-' + c.felt.til).join(',')]")
    pg.reload(); pg.wait_for_timeout(400)
    lbl = st(pg, "document.getElementById('btn-start-label').textContent")
    pg.evaluate("Rampen.start()"); pg.wait_for_timeout(120)
    after = st(pg, "[Rampen.phase, Rampen.game.flight && Rampen.game.flight.x, Rampen.cards.map(c => c.id + c.felt.fra + '-' + c.felt.til).join(',')]")
    ok = lbl == 'Fortsæt turen' and after == ['freeze'] + before
    print('%s %dx%d fortsæt turen: %s -> %s (%s)' % ('OK  ' if ok else 'FEJL', w, h, before, after, lbl))
    if not ok: fails.append('%s turen fortsatte ikke: %s -> %s (%s)' % (tag, before, after, lbl))
    # Tåge fra: kun pynt, tingene derude er stadig skjulte
    pg.evaluate("Rampen.gameSettings.set('taage', false)"); pg.wait_for_timeout(80)
    fog = st(pg, "[document.documentElement.dataset.rampenTaage, getComputedStyle(document.documentElement).getPropertyValue('--rampen-taage').trim()]")
    c = st(pg, CARDS)
    if fog[0] != 'fra' or fog[1] not in ('transparent', 'rgba(0, 0, 0, 0)') or c['beyond']: fails.append('%s tåge fra gav %s, %s ting ud over udsynet' % (tag, fog, c['beyond']))
    check(pg, 'uden tåge', '#game', w, h, tag + '-uden-taage.png')
    pg.evaluate("Rampen.gameSettings.set('taage', true)")

def gameplay(pg, w, h, tag, shots):
    pg.evaluate(RIG)
    pg.evaluate("Rampen.settings.set('animation', false)")
    pg.evaluate("Rampen.start()"); pg.wait_for_timeout(120); pg.mouse.move(1, 1)
    if st(pg, "Rampen.phase") != 'launch': fails.append(tag + ' turen starter ikke i launch'); return
    a0 = st(pg, "Rampen.game.p.angle")
    pg.click('#controls [data-ang="5"]'); pg.click('#controls [data-ang="-1"]')
    if st(pg, "Rampen.game.p.angle") != a0 + 4: fails.append('%s vinkelknapper gav %s (fra %s)' % (tag, st(pg, "Rampen.game.p.angle"), a0))
    pg.mouse.move(1, 1)
    pg.keyboard.press('Shift+ArrowDown'); pg.keyboard.press('ArrowUp')
    if st(pg, "Rampen.game.p.angle") != a0: fails.append('%s piletaster gav vinkel %s' % (tag, st(pg, "Rampen.game.p.angle")))
    pg.keyboard.press('ArrowLeft')
    if st(pg, "Rampen.game.p.power") != 9: fails.append('%s venstre pil gav kraft %s' % (tag, st(pg, "Rampen.game.p.power")))
    pg.click('#controls [data-pow="1"]')
    if st(pg, "[Rampen.game.p.power, document.querySelectorAll('#pow-meter i.on').length]") != [10, 10]: fails.append(tag + ' kraft + virkede ikke')
    pg.evaluate("Rampen.game.setAngle(40); Rampen.refresh()")
    check(pg, 'opsendelse', '#game', w, h, tag + '-opsendelse.png')
    if shots and SHOT: pg.screenshot(path=SHOT + 'opsendelse.png')
    pv = st(pg, "(() => { const v = Rampen.game.launchPreview(), p = v.pts; return [p.length ? Math.round(p[p.length - 1].x) : 0, v.x === undefined]; })()")
    if pv[0] > 30 or not pv[1]: fails.append('%s opsendelsen viser for meget af buen (%s)' % (tag, pv))
    pg.click('#btn-launch'); idle(pg)
    if st(pg, "Rampen.phase") != 'freeze': fails.append('%s intet beslutningspunkt (fase %s)' % (tag, st(pg, "Rampen.phase"))); return
    # Spillet står stille, til der vælges
    x0 = st(pg, "Rampen.game.flight.x"); pg.wait_for_timeout(500)
    if st(pg, "Rampen.game.flight.x") != x0: fails.append(tag + ' bilen flyttede sig under beslutningspunktet')
    cards_check(pg, w, h, tag)
    check(pg, 'beslutningspunkt', '#game', w, h, tag + '-beslutning.png')
    if shots and SHOT: pg.screenshot(path=SHOT + 'beslutningspunkt.png')
    b0 = st(pg, "Rampen.game.flight.boosts")
    pg.mouse.move(1, 1); pg.keyboard.press('j'); idle(pg)
    used = st(pg, "Rampen.game.flight ? Rampen.game.flight.boostsUsed : Rampen.game.lastResult.boostsUsed")
    if used != 1: fails.append('%s J gav ikke boost (%s brugt, %s før)' % (tag, used, b0))
    # Et kort vælges også med tallet: 1 = første kort
    if st(pg, "Rampen.phase") == 'freeze':
        n0 = st(pg, "Rampen.game.flight.t"); pg.keyboard.press('1'); idle(pg)
        if st(pg, "Rampen.game.flight && Rampen.game.flight.t") == n0: fails.append(tag + ' tasten 1 valgte ikke kort 1')
    k = 0
    while st(pg, "Rampen.phase") == 'freeze' and k < 40:
        top = st(pg, "[Rampen.game.flight.vy <= 0, Rampen.game.flight.y >= 3]")
        if top != [True, True]: fails.append('%s beslutningspunkt uden for toppen af et hop (%s)' % (tag, top))
        has_v = st(pg, "Rampen.cards.some(c => c.id === 'vent')")
        pg.keyboard.press('v' if has_v else '1'); idle(pg); k += 1
    if st(pg, "Rampen.phase") != 'done' or st(pg, "document.getElementById('result-overlay').hidden"): fails.append(tag + ' turens resultat blev ikke vist'); return
    d = st(pg, "Rampen.game.lastResult.dist")
    hd = st(pg, "parseInt(document.getElementById('hud-dist').textContent.replace(/\\D/g, ''), 10)")
    if hd != d: fails.append('%s afstanden i statuslinjen (%s) passer ikke med resultatet (%s)' % (tag, hd, d))
    if not st(pg, "Rampen.records.list('tur').some(e => e.score === %d)" % d): fails.append(tag + ' rekorden blev ikke gemt')
    saved = st(pg, "JSON.parse(localStorage.getItem('hojtArkade.rampen.fremskridt')).trips")
    if saved != 4: fails.append('%s fremskridtet blev ikke gemt (%s ture)' % (tag, saved))
    check(pg, 'tur slut', '#game', w, h, tag + '-tur-slut.png')
    if shots and SHOT: pg.screenshot(path=SHOT + 'tur-slut.png')
    # Værkstedet: køb motor
    pg.click('#btn-res-shop'); pg.wait_for_timeout(120)
    m0, c0 = st(pg, "[Rampen.game.p.upg.motor, Rampen.game.p.coins]")
    price = st(pg, "Rampen.game.price('motor')")
    pg.click('#upg-grid [data-upg="motor"]'); pg.wait_for_timeout(60)
    if st(pg, "[Rampen.game.p.upg.motor, Rampen.game.p.coins]") != [m0 + 1, c0 - price]: fails.append(tag + ' køb af motor virkede ikke')
    check(pg, 'værksted', '#shop', w, h, tag + '-vaerksted.png')
    if shots and SHOT: pg.screenshot(path=SHOT + 'vaerksted.png')
    # Ny bil: kræver en lang tur, og der spørges først
    pg.evaluate("Rampen.game.p.best = 1200; Rampen.game.p.carScore = 3456; Rampen.show('shop')"); pg.wait_for_timeout(80)
    pg.click('#btn-newcar'); pg.wait_for_timeout(80)
    if st(pg, "document.activeElement && document.activeElement.id") != 'btn-newcar-no': fails.append(tag + ' Ny bil: Nej har ikke fokus')
    check(pg, 'ny bil?', '#shop', w, h, tag + '-ny-bil.png')
    pg.click('#btn-newcar-yes'); pg.wait_for_timeout(80)
    if st(pg, "[Rampen.game.p.bil, Rampen.game.p.coins, Rampen.records.list('biler').some(e => e.score === 3456)]") != [2, 0, True]: fails.append(tag + ' Ny bil virkede ikke')
    # Pause
    pg.evaluate("Rampen.start()"); pg.wait_for_timeout(80); pg.mouse.move(1, 1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
    if st(pg, "document.getElementById('pause-overlay').hidden"): fails.append(tag + ' Esc gav ikke pause')
    check(pg, 'pause', '#game', w, h, tag + '-pause.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
    # Glød kan slås fra
    pg.evaluate("Rampen.gameSettings.set('gloed', false)"); pg.wait_for_timeout(120)
    gl = st(pg, """[document.documentElement.dataset.rampenGloed, getComputedStyle(document.documentElement).getPropertyValue('--rampen-gloed').trim(), document.querySelectorAll('#rampen-ikoner symbol').length]""")
    if gl[0] != 'fra' or gl[1] != '0' or gl[2] < 20: fails.append('%s glød fra gav %s' % (tag, gl))
    check(pg, 'uden glød', '#game', w, h, tag + '-uden-gloed.png')
    pg.evaluate("Rampen.gameSettings.set('gloed', true)")

def sound_check(pg, w, h, tag):
    """Egne lyde: alle navne findes, de følger den fælles lydindstilling, og en tur giver lyde."""
    r = st(pg, """(() => { const l = Rampen.lyd, want = ['motor', 'opsendelse', 'boost', 'moent', 'hop', 'landing', 'koeb', 'fund', 'fund-risiko', 'fund-brug'];
      const missing = want.filter(n => !l.has(n));
      Rampen.settings.set('sound', true); const on = want.map(n => l.play(n, 0.5));
      Rampen.settings.set('sound', false); const off = want.map(n => l.play(n));
      Rampen.settings.set('sound', true);
      return [missing, on.filter(Boolean).length, off.filter(Boolean).length]; })()""")
    if r[0] or r[1] < 5 or r[2] != 0: fails.append('%s lyde: mangler %s, spillede %s med lyd til og %s med lyd fra' % (tag, r[0], r[1], r[2]))
    # En hel tur (uden animation) med optagelse af lydene
    pg.evaluate(RIG); pg.evaluate("""Rampen.settings.set('animation', false); window.__lyde = []; const l = Rampen.lyd;
      if (!l.__wrapped) { const p = l.play; l.play = function (n, x) { window.__lyde.push(n); return p.call(l, n, x); }; l.__wrapped = true; }
      Rampen.start(); Rampen.game.setAngle(40); Rampen.refresh()""")
    pg.wait_for_timeout(60)
    pg.evaluate("Rampen.launch()"); idle(pg)
    k = 0
    while st(pg, "Rampen.phase") == 'freeze' and k < 40:
        pg.evaluate("Rampen.decide(Rampen.game.flight.boosts > 0 ? 'boost' : Rampen.cards[0].id)"); idle(pg); k += 1
    heard = st(pg, "[...new Set(window.__lyde)]")
    for n in ['motor', 'opsendelse', 'boost', 'landing']:
        if n not in heard: fails.append('%s lyden %s blev ikke spillet på en tur (%s)' % (tag, n, heard))
    pg.click('#btn-res-shop'); pg.wait_for_timeout(80)
    pg.evaluate("Rampen.game.p.coins = 999; window.__lyde = []"); pg.click('#upg-grid [data-upg="daek"]'); pg.wait_for_timeout(40)
    if 'koeb' not in st(pg, "window.__lyde"): fails.append(tag + ' køb gav ikke lyden koeb')
    print('OK   %dx%d lyde %s' % (w, h, sorted(heard)) if not [f for f in fails if f.startswith(tag) and 'lyd' in f] else 'FEJL %dx%d lyde' % (w, h))

def flying_shot(pg, w, h, tag, shots):
    """Bilen i luften (animation til), midt i en tur."""
    pg.evaluate(RIG); pg.evaluate("Rampen.settings.set('animation', true); Rampen.gameSettings.set('fart', 'rolig')")
    pg.evaluate("Rampen.start(); Rampen.game.setAngle(40); Rampen.refresh()"); pg.wait_for_timeout(80)
    pg.evaluate("Rampen.launch()"); pg.wait_for_timeout(650)
    if st(pg, "Rampen.phase") != 'fly': fails.append('%s fase under flyvning: %s' % (tag, st(pg, "Rampen.phase")))
    check(pg, 'bilen flyver', '#game', w, h, tag + '-flyver.png')
    if shots and SHOT: pg.screenshot(path=SHOT + 'spil-i-gang.png')
    pg.mouse.move(1, 1); pg.keyboard.press('Enter'); idle(pg)
    if st(pg, "Rampen.phase") != 'freeze': fails.append('%s Enter sprang ikke frem til beslutningen (%s)' % (tag, st(pg, "Rampen.phase")))
    pg.evaluate("Rampen.settings.set('animation', false)")

# Bilens længde i px under flyvning målt i v1.3 (før det tætte kamera i v1.4)
V13_FLY = {(1920,1080): 95, (1366,768): 54, (1280,720): 54, (1024,768): 54, (1024,1366): 61, (1366,1024): 62, (390,844): 54, (844,390): 54}
CAM = """() => { const t = Rampen.tegn, b = t.carBox, c = document.getElementById('course'), lim = Rampen.game.flight ? Rampen.game.flight.x + Rampen.udsyn : 0;
  return { len: b ? Math.round(b.len) : 0, box: b, cw: c.clientWidth, ch: c.clientHeight, zooming: t.zooming, labels: t.labels,
    phase: Rampen.phase, beyond: Rampen.phase === 'freeze' ? t.drawn.filter(o => o.x - o.r > lim + 0.01).length : 0 }; }"""
def label_hits(c):
    b = c['box']
    if not b: return []
    return [l['nr'] for l in c['labels'] if l['x'] < b['x'] + b['w'] and b['x'] < l['x'] + l['w'] and l['y'] < b['y'] + b['h'] and b['y'] < l['y'] + l['h']]
def camera_check(pg, w, h, tag):
    """v1.4: tæt kamera under flyvning, rolig udzoom ved beslutningspunktet."""
    pg.evaluate(RIG); pg.evaluate("Rampen.settings.set('animation', true); Rampen.gameSettings.set('fart', 'rolig')")
    pg.evaluate("Rampen.start(); Rampen.game.setAngle(40); Rampen.refresh()"); pg.wait_for_timeout(80)
    pg.evaluate("Rampen.launch()"); pg.wait_for_timeout(720)
    fly = st(pg, CAM)
    fly_parts = st(pg, "Rampen.tegn.particles")
    pg.mouse.move(1, 1); pg.keyboard.press('Enter'); idle(pg)
    z0 = st(pg, "Rampen.tegn.zooming")
    pg.wait_for_timeout(900)
    dec = st(pg, CAM)
    bad = []
    if fly['phase'] != 'fly': bad.append('ikke i luften ved målingen (%s)' % fly['phase'])
    base = V13_FLY.get((w, h), 54)
    if fly['len'] < base * 1.5: bad.append('bilen er kun %d px under flyvning (v1.3: %d)' % (fly['len'], base))
    if dec['len'] * 1.3 > fly['len']: bad.append('ingen udzoom ved beslutningspunktet (%d mod %d px)' % (dec['len'], fly['len']))
    b = fly['box']
    if b and (b['x'] < 0 or b['y'] < 0 or b['x'] + b['w'] > fly['cw'] or b['y'] + b['h'] > fly['ch']): bad.append('bilen uden for billedet under flyvning')
    if not z0: bad.append('ingen rolig zoom ved beslutningspunktet')
    if fly_parts < 1: bad.append('ingen partikler (røg/støv) under flyvning')
    if dec['zooming']: bad.append('zoomen blev ikke færdig')
    if dec['beyond']: bad.append('%d ting tegnet ud over udsynet' % dec['beyond'])
    hits = label_hits(dec)
    if hits: bad.append('felttekst %s dækker bilen' % hits)
    print('%s %dx%d kamera: bil %d px i luften (v1.3: %d), %d px ved beslutningen, rolig zoom %s, felttekster fri af bilen %s' % ('OK  ' if not bad else 'FEJL', w, h, fly['len'], base, dec['len'], z0, not hits))
    if bad: fails.append('%s kamera: %s' % (tag, '; '.join(bad)))
    pg.evaluate("Rampen.settings.set('animation', false)")

def dwell_check(pg, w, h, tag):
    """Ét dwell på Send afsted = én tur. Vinkelknappen gentager."""
    pg.evaluate(RIG); pg.evaluate("Rampen.settings.set('animation', true); Rampen.settings.set('dwellTime', 0.5); Rampen.start()"); pg.wait_for_timeout(120)
    a0 = st(pg, "Rampen.game.p.angle")
    x, y = center(pg, '#controls [data-ang="1"]'); pg.mouse.move(x, y)
    pg.evaluate("Rampen.settings.set('dwell', true)")
    try: pg.wait_for_function("Rampen.game.p.angle >= %d" % (a0 + 2), timeout=4000)
    except Exception: fails.append(tag + ' dwell på vinkel gentog ikke (%s)' % st(pg, "Rampen.game.p.angle"))
    x, y = center(pg, '#btn-launch'); pg.mouse.move(x, y, steps=3)
    try: pg.wait_for_function("Rampen.phase !== 'launch'", timeout=3000)
    except Exception: fails.append(tag + ' dwell på Send afsted sendte ikke bilen')
    pg.evaluate("Rampen.settings.set('dwell', false)"); pg.mouse.move(1, 1)
    pg.evaluate("Rampen.settings.set('animation', false)")
    print('OK   %dx%d dwell' % (w, h) if not [f for f in fails if f.startswith(tag) and 'dwell' in f] else 'FEJL %dx%d dwell' % (w, h))

# v1.6: et frø, hvor der dukker et fund op ved første top, og turen fortsætter efter det er taget
FIND_FUND = """() => { const L = Rampen.logik; let best = null;
  for (let s = 1; s < 3000; s++) {
    const p = L.newProgress(1); p.coins = 400; p.trips = 3; p.best = 180; p.carScore = 400; p.seed = s;
    Object.assign(p.upg, {motor: 3, daek: 2, karrosseri: 2, aero: 2, vinger: 1, raket: 1, braendstof: 1});
    const g = L.createGame(JSON.parse(JSON.stringify(p))); g.setAngle(40); g.setPower(10);
    if (g.launch().event !== 'top') continue;
    const k = g.cards().find(c => c.fund); if (!k) continue;
    let r = g.decide('sigt'); if (r.event === 'end' || !g.flight.fundListe.length) continue;
    let n = 1, ok = 1, guard = 0;   // flere forskellige fund (gerne et risikofund) giver et bedre billede
    while (guard++ < 6) { const k2 = g.cards().find(c => c.fund); if (!k2) break; r = g.decide('sigt'); if (r.event === 'end') break; n++;
      const l = g.flight.fundListe; if (l.length >= 2) ok = l.some(id => L.FUND.find(d => d.id === id).risiko) ? 3 : 2;
      if (ok === 3) break; }
    const sc = ok * 10 - n;
    if (!best || sc > best[2]) best = [s, n, sc];
    if (ok === 3) break;
  }
  return best.slice(0, 2); }"""
FUND_HUD = """() => { const el = document.getElementById('hud-fund'), bw = document.getElementById('board-wrap').getBoundingClientRect(),
  pb = document.getElementById('btn-pause').getBoundingClientRect(), r = el.getBoundingClientRect();
  const chips = [...el.querySelectorAll('.fund-chip')];
  const icons = chips.map(c => { const u = c.querySelector('use').getAttribute('href'); const i = c.querySelector('svg').getBoundingClientRect(); return [!!document.querySelector(u), Math.round(i.width)]; });
  return { shown: !el.hidden && r.width > 0, n: chips.length, names: chips.map(c => c.querySelector('.fund-navn').textContent),
    inside: r.left >= bw.left - 1 && r.top >= bw.top - 1 && r.right <= bw.right + 1 && r.bottom <= bw.bottom + 1,
    pause: r.left < pb.right && pb.left < r.right && r.top < pb.bottom && pb.top < r.bottom,
    icons: icons, mini: el.classList.contains('mini'), h: Math.round(r.height), bh: Math.round(bw.height), label: el.getAttribute('aria-label') }; }"""
FUND_SEED = {}
def fund_check(pg, w, h, tag, shots):
    idle(pg)
    if 'fund' not in FUND_SEED: FUND_SEED['fund'] = st(pg, FIND_FUND)
    seed, nfund = FUND_SEED['fund']
    pg.evaluate(RIG.replace('Rampen.setProgress(p);', 'p.seed = %d; Rampen.setProgress(p);' % seed))
    pg.evaluate("Rampen.settings.set('animation', false); Rampen.start(); Rampen.game.setAngle(40); Rampen.game.setPower(10); Rampen.refresh()"); pg.wait_for_timeout(60)
    pg.evaluate("Rampen.launch()"); idle(pg); pg.mouse.move(1, 1)
    bad = []
    k = st(pg, "(() => { const k = Rampen.cards.find(c => c.fund); return k ? [k.titel, k.ikon, !!document.querySelector('#rampen-ikon-' + k.ikon)] : null; })()")
    drawn = st(pg, "Rampen.tegn.drawn.filter(o => o.type === 'fund').length")
    if not k or not k[2] or not k[0].startswith('Tag fundet: '): bad.append('intet fundkort (%s)' % k)
    if drawn < 1: bad.append('fundet blev ikke tegnet på banen')
    hint = st(pg, "document.getElementById('hint').textContent")
    if 'fund' not in hint.lower(): bad.append('hinten nævner ikke fundet (%s)' % hint)
    check(pg, 'fund på banen', '#game', w, h, tag + '-fund-paa-banen.png')
    if shots and SHOT: pg.screenshot(path=SHOT + 'fund-paa-banen.png')
    # Tag fundet (og flere, hvis de dukker op)
    for _ in range(nfund):
        pg.evaluate("Rampen.decide('sigt')"); idle(pg)
    if st(pg, "Rampen.phase") != 'freeze': bad.append('turen sluttede lige efter fundet (%s)' % st(pg, "Rampen.phase"))
    else:
        f = st(pg, FUND_HUD)
        if not f['shown'] or f['n'] < 1: bad.append('fundene vises ikke i HUD %s' % f)
        if not f['inside'] or f['pause']: bad.append('fund-striben uden for banen eller over pause %s' % f)
        if any(not i[0] or i[1] < 26 for i in f['icons']): bad.append('fundikoner mangler eller er små %s' % f['icons'])
        check(pg, 'fund i HUD', '#game', w, h, tag + '-fund-i-hud.png')
        if shots and SHOT: pg.screenshot(path=SHOT + 'fund-i-hud.png')
        names = f['names']
        # Fundene gemmes med turen og vises igen efter genindlæsning
        pg.reload(); pg.wait_for_timeout(400); pg.evaluate("Rampen.start()"); pg.wait_for_timeout(150)
        f2 = st(pg, FUND_HUD)
        if f2['names'] != names: bad.append('fundene kom ikke med efter genindlæsning (%s -> %s)' % (names, f2['names']))
        # Værste tilfælde: alle syv fund på én gang (bagefter tilbage til turens rigtige fund)
        fund0 = st(pg, "JSON.stringify({fund: Rampen.game.flight.fund, liste: Rampen.game.flight.fundListe})")
        pg.evaluate("""(() => { const f = Rampen.game.flight; Rampen.logik.FUND.forEach(d => { if (!f.fund[d.id]) f.fund[d.id] = 1; if (!f.fundListe.includes(d.id)) f.fundListe.push(d.id); }); Rampen.refresh(); })()""")
        pg.wait_for_timeout(60)
        f3 = st(pg, FUND_HUD)
        if f3['n'] != 7 or not f3['inside'] or f3['pause'] or f3['h'] > f3['bh'] * 0.5: bad.append('7 fund passer ikke %s' % f3)
        check(pg, '7 fund i HUD', '#game', w, h, tag + '-fund-alle.png')
        pg.evaluate("""(() => { const f = Rampen.game.flight, o = %s; f.fund = o.fund; f.fundListe = o.liste; Rampen.refresh(); })()""" % fund0)
    # Til slut: fundene på slutskærmen
    k2 = 0
    while st(pg, "Rampen.phase") == 'freeze' and k2 < 40:
        pg.evaluate("Rampen.decide(Rampen.cards.some(c => c.id === 'vent') ? 'vent' : Rampen.cards[0].id)"); idle(pg); k2 += 1
    r = st(pg, "(() => { const e = document.getElementById('res-fund'); return [Rampen.phase, !e.hidden, e.querySelectorAll('.fund-chip').length, e.innerText.replace(/\\s+/g, ' ')]; })()")
    if r[0] != 'done' or not r[1] or r[2] < 1: bad.append('slutskærmen viser ikke fundene %s' % r)
    check(pg, 'tur slut med fund', '#game', w, h, tag + '-tur-slut-fund.png')
    if shots and SHOT: pg.screenshot(path=SHOT + 'tur-slut-fund.png')
    nf = st(pg, "(() => { Rampen.start(); return [Rampen.game.flight === null || !Rampen.game.flight.fundListe || Rampen.game.flight.fundListe.length === 0, document.getElementById('hud-fund').hidden]; })()")
    if nf != [True, True]: bad.append('fundene blev ikke nulstillet til næste tur %s' % nf)
    print('%s %dx%d fund: frø %d, kort %s, slut %s' % ('OK  ' if not bad else 'FEJL', w, h, seed, k and k[0], r[3][:90] if len(r) > 3 else r))
    if bad: fails.append('%s fund: %s' % (tag, '; '.join(bad)))

def new_page(b, w, h, **kw):
    ctx = b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, has_touch=w < 900, **kw)
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e) + ' @ ' + (e.stack or '')[:600]))
    return ctx, pg

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None, args=['--no-sandbox'])
    for (w,h) in [x for x in SIZES if not os.environ.get('ONLY') or '%dx%d'%x in os.environ['ONLY'].split(',')]:
        small = min(w, h) < 560
        big = (w, h) == (1920, 1080)
        tag = 'responsiv-%dx%d' % (w, h)
        ctx, pg = new_page(b, w, h)
        pg.goto(URL); pg.wait_for_timeout(400)
        pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(400)
        check(pg,'start','#menu',w,h, tag+'-start.png')
        if big and SHOT: pg.screenshot(path=SHOT + 'startskaerm.png')
        pg.evaluate("Rampen.show('om')"); pg.wait_for_timeout(100)
        pages(pg, '#om', w, h, 'om', small and tag+'-om')
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("Rampen.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab, small and '%s-indstillinger-%s' % (tag, tab))
        pg.evaluate("Rampen.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h, small and tag+'-rekorder.png')
        pg.evaluate("Rampen.show('shop')"); pg.wait_for_timeout(80); check(pg,'værksted (ny)','#shop',w,h)
        flying_shot(pg, w, h, tag, big)
        camera_check(pg, w, h, tag)
        gameplay(pg, w, h, tag, big)
        dwell_check(pg, w, h, tag)
        if big or small: sound_check(pg, w, h, tag)
        fund_check(pg, w, h, tag, big)
        resume_check(pg, w, h, tag)
        # Hovedbilledet for opløsningen: beslutningspunktet med vinger
        pg.evaluate(RIG); pg.evaluate("Rampen.settings.set('animation', false); Rampen.start(); Rampen.game.setAngle(40); Rampen.refresh()"); pg.wait_for_timeout(80)
        pg.evaluate("Rampen.launch()"); idle(pg); pg.mouse.move(1, 1)
        c = st(pg, CAM)
        if c['zooming']: fails.append(tag + ' kameraet glider, selv om animation er slået fra')
        if label_hits(c): fails.append('%s felttekst %s dækker bilen' % (tag, label_hits(c)))
        if SHOT: pg.screenshot(path=SHOT + tag + '.png')
        ctx.close()
    # Mindre bevægelse: resultatet vises med det samme
    ctx, pg = new_page(b, 1366, 768, reduced_motion='reduce')
    pg.goto(URL); pg.wait_for_timeout(300)
    pg.evaluate(RIG); pg.evaluate("Rampen.start()"); pg.wait_for_timeout(80)
    pg.evaluate("Rampen.launch()"); pg.wait_for_timeout(150)
    t = st(pg, "[Rampen.tegn.animating || Rampen.tegn.zooming || Rampen.tegn.particles > 0, Rampen.phase]")
    print('%s reduced motion: animerer=%s, fase efter 0,15 s=%s' % ('OK  ' if t == [False, 'freeze'] else 'FEJL', t[0], t[1]))
    if t != [False, 'freeze']: fails.append('reduced motion: %s' % t)
    ctx.close()
    # Hallen med Rampen aktiv
    ctx = b.new_context(viewport={'width':1920,'height':1080})
    pg = ctx.new_page()
    hall_errs = []
    pg.on('pageerror', lambda e: hall_errs.append(str(e)))
    pg.goto(HALL + '?spil=rampen'); pg.wait_for_timeout(1500)
    rl = pg.evaluate("""() => [...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')).filter(t => /Rampen/.test(t))""")
    print('     hallen: %s, fejl %s' % (rl, hall_errs))
    if 'Spil Rampen' not in rl or hall_errs: fails.append('hallen viser ikke Rampen som aktiv: %s %s' % (rl, hall_errs))
    if SHOT: pg.screenshot(path=SHOT + 'hallen.png')
    ctx.close()
    b.close()
print()
print('MINDSTE KNAP PR. OPLØSNING:')
for k, v in summary.items(): print('  %-10s %s px' % (k, min(x[1] for x in v if x[1] is not None)))
print('KONSOL:', errs)
print('FEJL:', len(fails))
for f in fails: print('  ', f)
sys.exit(1 if fails or errs else 0)

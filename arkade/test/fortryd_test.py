# Test af "fortryd sidste træk" i de turbaserede spil, hvor ét utilsigtet blik kan koste et liv:
# Slangen (3 pr. spil), Labyrinten og Frøen (1 pr. bane) og Minestryger (1 pr. plade, livet
# tilbage efter et minetræf). Tjekker, at fortryd tilbydes, før resultatet gemmes, at det sætter
# spillet tilbage, og at det ikke tilbydes, når det er brugt.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 arkade/test/fortryd_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     ONLY=slangen,minestryger
import os, sys, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
ONLY = os.environ.get('ONLY', '').split(',') if os.environ.get('ONLY') else None
fails = []

def check(ok, msg):
    if not ok: fails.append(msg)
    return ok

def side(br, g):
    pg = br.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto((ROOT / g / 'index.html').as_uri())
    pg.evaluate("() => localStorage.setItem('hojtArkade.arkade.indstillinger', JSON.stringify({dwell: false, dwellTime: 1.2, music: false, sound: false, animation: false}))")
    pg.reload(); pg.wait_for_timeout(300)
    pg.mouse.move(2, 2)
    return pg, errs

def dialog(pg):
    return pg.evaluate("() => !!window.ArkadeBekraeft && ArkadeBekraeft.aaben()")

def skaerm(pg):
    return pg.evaluate("() => [...document.querySelectorAll('.screen')].filter(s => !s.hidden).map(s => s.id).join(',')")

# ---------- Slangen ----------
def slangen(br):
    pg, errs = side(br, 'slangen')
    pg.locator('#btn-start').click(); pg.wait_for_timeout(200)
    def crash():
        for _ in range(40):
            if pg.evaluate("() => Slangen.game.state.over"): break
            pg.evaluate("() => Slangen.move('up')")
        pg.wait_for_timeout(100)
    for n in (3, 2, 1):
        crash()
        check(dialog(pg) and skaerm(pg) == 'game', 'slangen: ingen fortryd efter sammenstød (%d tilbage)' % n)
        pg.mouse.move(2, 2)   # blikket væk fra knappen, der dukkede op under det (dialogen kræver et nyt blik)
        pg.locator('.arkade-bk-nej').click(); pg.wait_for_timeout(100)
        st = pg.evaluate("() => ({ over: Slangen.game.state.over, left: Slangen.game.state.undoLeft })")
        check(not st['over'] and st['left'] == n - 1, 'slangen: fortryd satte ikke spillet tilbage (%s)' % st)
    crash()
    check(not dialog(pg) and skaerm(pg) == 'gameover', 'slangen: fortryd blev tilbudt, selv om alle 3 er brugt (%s)' % skaerm(pg))
    # Se resultat gemmer resultatet
    pg.locator('#btn-again').click(); pg.wait_for_timeout(150)
    crash()
    pg.mouse.move(2, 2)
    pg.locator('.arkade-bk-ja').click(); pg.wait_for_timeout(150)
    check(skaerm(pg) == 'gameover', 'slangen: Se resultat gik ikke til resultatet')
    check(not errs, 'slangen: JS-fejl %s' % errs[:2])
    pg.close()

# ---------- Labyrinten ----------
LAB_TIL_FANGET = """() => {
  const run = Labyrinten.run, G = LabyrintenGame;
  for (let i = 0; i < 600; i++) {
    if (run.state.status !== 'play') return run.state.status;
    const dirs = ['up', 'right', 'down', 'left'].filter(d => run.canMove(d));
    const bad = dirs.find(d => { const p = run.preview(d); return p && !p.bump && (p.result === 'caught' || p.result === 'over'); });
    const d = bad || dirs[(i * 7 + 3) % dirs.length];
    Labyrinten.move(d);
  }
  return run.state.status;
}"""
def labyrinten(br):
    pg, errs = side(br, 'labyrinten')
    pg.locator('#btn-start').click(); pg.wait_for_timeout(200)
    st = pg.evaluate(LAB_TIL_FANGET); pg.wait_for_timeout(150)
    if not check(st in ('caught', 'over'), 'labyrinten: blev ikke fanget i testen (%s)' % st): pg.close(); return
    lives = pg.evaluate("() => Labyrinten.run.state.lives")
    check(pg.locator('#btn-caught-undo').is_visible(), 'labyrinten: ingen Fortryd i Fanget-boksen')
    pg.locator('#btn-caught-undo').click(); pg.wait_for_timeout(150)
    st = pg.evaluate("() => ({ status: Labyrinten.run.state.status, lives: Labyrinten.run.state.lives, ov: !document.querySelector('#caught-overlay').hidden })")
    check(st['status'] == 'play' and st['lives'] == lives + 1 and not st['ov'], 'labyrinten: fortryd satte ikke spillet tilbage (%s)' % st)
    st = pg.evaluate(LAB_TIL_FANGET); pg.wait_for_timeout(150)
    check(not pg.locator('#btn-caught-undo').is_visible(), 'labyrinten: Fortryd vises igen på samme bane')
    check(not errs, 'labyrinten: JS-fejl %s' % errs[:2])
    pg.close()

# ---------- Frøen ----------
FROE_TIL_DOED = """() => {
  const run = Froeen.run;
  for (let i = 0; i < 400; i++) {
    if (run.state.dead || run.state.over) return true;
    const acts = ['up', 'left', 'right', 'down', 'wait'];
    const bad = acts.find(a => { const r = run.simulate(a); return r && r !== 'ugyldigt'; });
    Froeen.act(bad || 'wait');
  }
  return run.state.dead;
}"""
def froeen(br):
    pg, errs = side(br, 'froeen')
    pg.locator('#btn-start').click(); pg.wait_for_timeout(200)
    ok = pg.evaluate(FROE_TIL_DOED); pg.wait_for_timeout(1000)   # dødsboksen kommer efter 0,65 s
    if not check(ok, 'froeen: frøen døde ikke i testen'): pg.close(); return
    lives = pg.evaluate("() => Froeen.run.state.lives")
    check(pg.locator('#btn-death-undo').is_visible(), 'froeen: ingen Fortryd i dødsboksen')
    pg.locator('#btn-death-undo').click(); pg.wait_for_timeout(150)
    st = pg.evaluate("() => ({ dead: Froeen.run.state.dead, lives: Froeen.run.state.lives, ov: !document.querySelector('#death-overlay').hidden })")
    check(not st['dead'] and st['lives'] == lives + 1 and not st['ov'], 'froeen: fortryd satte ikke spillet tilbage (%s)' % st)
    pg.evaluate(FROE_TIL_DOED); pg.wait_for_timeout(1000)
    check(not pg.locator('#btn-death-undo').is_visible(), 'froeen: Fortryd vises igen på samme bane')
    check(not errs, 'froeen: JS-fejl %s' % errs[:2])
    pg.close()

# ---------- Minestryger ----------
def minestryger(br):
    pg, errs = side(br, 'minestryger')
    pg.evaluate("() => Minestryger.gameSettings.set('lives', 1)")
    pg.locator('#btn-start').click(); pg.wait_for_timeout(200)
    def ram_mine():
        pg.evaluate("""() => {
          const s = Minestryger.plate.state;
          if (!s.generated) Minestryger.cell(Math.floor(s.cells.length / 2));
          const i = Minestryger.plate.state.cells.findIndex(c => c.mine && !c.revealed);
          Minestryger.cell(i);
        }""")
        pg.wait_for_timeout(1300)
    ram_mine()
    check(dialog(pg), 'minestryger: ingen fortryd efter minetræf')
    pg.mouse.move(2, 2)
    pg.locator('.arkade-bk-nej').click(); pg.wait_for_timeout(1200)
    st = pg.evaluate("() => ({ lives: Minestryger.run.lives, over: Minestryger.run.over, left: Minestryger.run.undoLeft })")
    check(st['lives'] == 1 and not st['over'] and st['left'] == 0 and skaerm(pg) == 'game', 'minestryger: fortryd gav ikke livet tilbage (%s)' % st)
    ram_mine()
    pg.wait_for_timeout(500)
    check(not dialog(pg) and skaerm(pg) == 'gameover', 'minestryger: fortryd tilbudt igen på samme plade (%s)' % skaerm(pg))
    check(not errs, 'minestryger: JS-fejl %s' % errs[:2])
    pg.close()

with sync_playwright() as p:
    br = p.chromium.launch(executable_path=CHROME)
    for navn, fn in [('slangen', slangen), ('labyrinten', labyrinten), ('froeen', froeen), ('minestryger', minestryger)]:
        if ONLY and navn not in ONLY: continue
        try:
            fn(br)
        except Exception as e:
            fails.append('%s: %s' % (navn, str(e).splitlines()[0]))
        print(('OK   ' if not [f for f in fails if f.startswith(navn)] else 'FEJL ') + navn)
    br.close()
for f in fails: print('  ', f)
print('%d fejl' % len(fails))
sys.exit(1 if fails else 0)

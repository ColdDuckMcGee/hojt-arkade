# Hojt Arkade – fælles moduler

Almindelige `<script>`-filer uden import/eksport, så de virker både på
hjemmesiden og når index.html åbnes direkte fra disken (file://).
Hvert modul lægger ét objekt på `window`.

Fra et spil i sin egen mappe (fx `slangen/index.html`):

```html
<link rel="icon" href="../arkade/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../arkade/arkade.css">
<script src="../arkade/settings.js"></script>
<script src="../arkade/highscores.js"></script>
<script src="../arkade/highscore.js"></script>
<script src="../arkade/dwell.js"></script>
<script src="../arkade/taster.js"></script>
<script src="../arkade/bekraeft.js"></script>
<script src="../arkade/audio.js"></script>
<script src="../arkade/background.js"></script>
```

## ArkadeSettings (settings.js)
```js
const s = ArkadeSettings.create('arkade', { dwell: false, dwellTime: 1.2, theme: 'neon' });
s.get('dwell'); s.set('dwell', true); s.toggle('dwell'); s.all(); s.reset();
const stop = s.onChange((key, value) => { /* opdatér UI */ });
```
Gemmes i localStorage under `hojtArkade.<navn>.indstillinger`. Kun nøgler fra
defaults accepteres, og typen skal passe. Navnet `'arkade'` bruges til de
fælles indstillinger (dwell, dwell-tid, tema, baggrund, animation, lyd, musik),
så de følger spilleren fra spil til spil. Hvert spil har sit eget navn til egne
indstillinger, fx `ArkadeSettings.create('slangen', { boardSize: 15 })`.

## ArkadeHighscores (highscores.js)
```js
const hs = ArkadeHighscores.create('slangen', { max: 10 });
const res = hs.add('15', 230);  // { rank, entry, list } – rank 0 = ikke på listen
hs.list('15'); hs.best('15'); hs.qualifies('15', 120); hs.clear('15');
ArkadeHighscores.formatDate(entry.date); // "26.10.2026"
```
Hver plads har point, dato og evt. `navn` (3 bogstaver; ældre pladser uden navn vises som `---`).
Kategori er fri tekst (fx brætstørrelse). `hs.setName(kat, id, 'JON')` sætter navnet.
Navne der ender på `-test` (og `{ global: false }`) kobles ikke på verdenslisten.
`{ globalKat: ['biler'] }` sender kun de nævnte kategorier til verdenslisten (Rampen: kun hele løbet
med en bil ved Ny bil, ikke hver tur); Verden-knappen viser så den første af dem.

## ArkadeHighscore (highscore.js) – verdenslisten og statistik
```js
ArkadeHighscore.start();   // når et nyt spil begynder  (tæller 'start', skærm, tema)
ArkadeHighscore.slut();    // ved game over             (tæller 'slut' + varighed)
ArkadeHighscore.vis(records, kategori);  // åbn top 10 (Verden / Min maskine) uden indtastning
ArkadeHighscore.visSidste();             // samme for den liste, rekordskærmen sidst viste
```
**Verden-knap:** en knap med `data-hs-verden` (i alle spil på rekordskærmen, lige efter Tilbage) åbner
top 10 for den kategori, rekordskærmen sidst viste med `records.list(kat)`. På lave, brede skærme
(højde ≤ 500 px) vises kun ikonet 🌍, så rækken ikke bliver bredere.
Indlæses efter highscores.js og henter selv `highscore.css`. Når `records.add()` giver en plads på
den lokale top 10 – eller scoren slår verdens top 10 – vises efter 0,6 s en arkade-dialog:
3 bogstaver (gitter med A–Z, Æ, Ø, Å, Slet når knapperne kan blive ≥ 84 px, ellers ▲▼ pr. plads),
OK og Spring over. Sidste navn foreslås. Derefter top 10 med fanerne **Verden** og **Min maskine**.
- Uden net: kun den lokale liste; scoren lægges i kø (`hojtArkade.scoreKoe`) og sendes senere.
- Fra disken (file://) laves ingen net-kald.
- Under automatiske tests (`navigator.webdriver`) vises dialogen kun, hvis
  `localStorage['hojtArkade.hsTest'] = '1'`.
- Mens dialogen er åben, er resten af siden `inert`, og tastetryk når ikke spillet.
- Server: se `api/README.md`. Statistiksiden ligger på `/statistik/` (kræver nøglen).

## Taster (taster.js) – kontakter og Smartbox Grid 3
Ingen API; indlæses bare. Piletasterne flytter fokus mellem knapperne i menuer, dialoger
og bokse (nærmeste knap i retningen, ellers næste/forrige rundt). Under spillet (`#game`
uden åben boks) styrer spillet selv piletasterne, og i hallen skifter venstre/højre
spil (op/ned flytter fokus); sæt
`data-arkade-pilefokus` på skærmen, hvis piletasterne også dér skal flytte fokus.
Enter aktiverer altid knappen med synligt fokus (`:focus-visible`), også i spil hvor
Enter ellers er en spilhandling. Mellemrum er uændret.

Styringen, der vælges på hallens velkomstskærm (`hojtArkade.styring.indstillinger`,
`valg`: `mus` | `kigge` | `eget` | `kontakt`), sættes som `data-styring` på `<html>`.
Ved `kontakt` får knapperne en ekstra tydelig fokusring (arkade.css), og efter
indlæsning får `[data-autofokus]`, `#btn-start` eller `#btn-continue` (ellers første
knap) fokus. `ArkadeTaster.setStyring(v)`, `.styring()` og `.autofokus(tving)`.
Kigge-klik selv styres stadig af den fælles `arkade.dwell`/`dwellTime`.

## ArkadeDwell (dwell.js)
```js
const dwell = ArkadeDwell.create({ enabled: false, timeMs: 1200 });
dwell.setEnabled(true); dwell.setTime(1500); dwell.reset(); dwell.release();
// valgfrit: ArkadeDwell.create({ ..., settlePx: 48, graceMs: 250 })
```
- Virker på alle `<button>`, links (`a[href]`) og `[data-dwell]`. Links med
  `target="_blank"` åbnes i ny fane; blokerer browseren det, åbnes de i samme fane.
- Aktiverer med `element.click()`,
  så knappens almindelige click-handler bruges.
- Deaktiverede knapper, `aria-disabled="true"`, `[data-no-dwell]` og skjulte
  elementer ignoreres. Alt andet (fx spillebrættet) er rolige zoner.
- `data-dwell-repeat` på en knap: den gentages for hver fuld dwell-tid, så
  længe blikket bliver der (drejeknapper). Andre knapper kræver, at blikket
  forlader knappen, før de kan vælges igen.
- **Ét blik = én handling (blik-låsen).** Efter et valg kan samme knap først vælges
  igen, når blikket har været uden for knappens kant – også selv om knappen imens
  blev deaktiveret, skjult eller udskiftet. En anden knap, der dukker op lige under
  blikket (ny skærm, dialog, zoom), kan først vælges, når blikket har flyttet sig
  mindst `settlePx` (48 px) eller har forladt den gamle knap. Det samme gælder knappen
  under blikket, når siden indlæses med dwell slået til.
- `dwell.reset()` rydder ringen og låser knappen under blikket (kald den ved
  skærmskift, dialoger og efter et træk). `dwell.release()` slipper låsen helt.
- Ryster blikket kort ud over kanten (under `graceMs`, 250 ms), stopper ringen og
  fortsætter, i stedet for at starte forfra.
- Test: `python3 arkade/test/dwell_test.py` (Playwright og Chrome).
- Touch ignoreres (almindeligt tryk virker). Ringen styles i arkade.css
  (`.arkade-dwell-ring`) og bruger temaets `--accent`.

## ArkadeBekraeft (bekraeft.js) – spørg, før noget ikke kan fortrydes
```js
ArkadeBekraeft.spoerg({
  titel: 'Vil du forlade spillet?',                 // standard
  tekst: 'Spillet stopper, og pointene gemmes ikke.', // standard
  nej: 'Nej, spil videre', ja: 'Ja, til menuen', jaLille: 'pointene gemmes ikke',
  onJa: function () { quitToMenu(); }, onNej: function () {}
});
ArkadeBekraeft.aaben();   // true, mens dialogen er åben
```
Indlæses efter `taster.js` og henter selv `bekraeft.css`. To store knapper med mindst 48 px
imellem; **Nej** står først og har fokus, og Esc er det samme som Nej. Knappen, der dukker op
lige under blikket, kan ikke vælges, før blikket har forladt den – med Hojt-dwell og med klik
fra et eget øjenstyringsprogram – så valget, der åbnede dialogen, aldrig også vælger i den.
Klik ved siden af knapperne gør ingenting, resten af siden er `inert`, og tastetryk når ikke
spillet. Bruges af *Til menuen* i pausen i de spil, der ikke gemmer pointene, når man går.
Test: `python3 arkade/test/bekraeft_test.py`.

## ArkadeAudio (audio.js)
```js
const lyd = ArkadeAudio.create({ sfx: true, music: true });
lyd.unlock();         // ved første klik/tast (browserens autoplay-regel)
lyd.play('eat');      // click, move, eat, bonus, bonusSpawn, bonusGone, obstacle, crash, pause, record
lyd.setSfx(false); lyd.setMusic(true);
```
Al lyd laves i koden med Web Audio API – ingen lydfiler, ingen rettigheder.

## ArkadeBackground (background.js)
```js
const bg = ArkadeBackground.create(document.getElementById('baggrund'));
bg.setPalette({ bg0, bg1, sky0, sky1, sky2, sun0, sun1, grid, light1, light2 });
bg.setMode('mork' | 'solnedgang' | 'neonby');
bg.setAnimated(settings.animation && !prefersReducedMotion);
```
Kun langsom, jævn bevægelse. Ingen blink.

## arkade.css
Temaer (`<html data-theme="neon|solnedgang|cyberpunk|kontrast">`) som
CSS-variabler, store knapper (`.btn`, mindst 3 × 3 cm), valgknapper
(`.btn.option[aria-pressed=true]` med ✓), paneler, rekordliste og dwell-ring.
Et nyt tema kræver kun en ny `[data-theme=...]`-blok.

## Logo og favicon
- `logo.svg` – Hojt Arkade-logoet. Alle bogstaver er tegnet som stier, så der
  bruges ingen skrifttyper og ingen billeder. Gløden ligger som SVG-filtre inde
  i filen, så den ser ens ud alle steder.
  `<img class="arkade-logo" src="../arkade/logo.svg" alt="Hojt Arkade">`
- `favicon.svg` – lille ikon (kursivt krom-H på stribet sol).

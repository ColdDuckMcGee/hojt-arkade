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
<script src="../arkade/dwell.js"></script>
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
Ingen navne – hver plads har point og dato. Kategori er fri tekst (fx brætstørrelse).

## ArkadeDwell (dwell.js)
```js
const dwell = ArkadeDwell.create({ enabled: false, timeMs: 1200 });
dwell.setEnabled(true); dwell.setTime(1500); dwell.reset();
```
- Virker på alle `<button>`, links (`a[href]`) og `[data-dwell]`. Links med
  `target="_blank"` åbnes i ny fane; blokerer browseren det, åbnes de i samme fane.
- Aktiverer med `element.click()`,
  så knappens almindelige click-handler bruges.
- Deaktiverede knapper, `aria-disabled="true"`, `[data-no-dwell]` og skjulte
  elementer ignoreres. Alt andet (fx spillebrættet) er rolige zoner.
- `data-dwell-repeat` på en knap: den gentages for hver fuld dwell-tid, så
  længe blikket bliver der (pileknapper). Andre knapper kræver, at blikket
  forlader knappen, før de kan vælges igen.
- Touch ignoreres (almindeligt tryk virker). Ringen styles i arkade.css
  (`.arkade-dwell-ring`) og bruger temaets `--accent`.

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

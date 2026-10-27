# Juveler

Del af **Hojt Arkade** af Jon Leismann Engsager / Hojt Design (MIT).
Spillet kører direkte fra `index.html` uden server og uden internet (også fra `file://`).

### Juveler
Et roligt match-3-spil i stil med Bejeweled, men turbaseret: der er intet ur. Man bytter to
juveler, der ligger ved siden af hinanden, så der kommer mindst tre ens på række eller i
kolonne. De forsvinder, juvelerne ovenover falder ned, og nye falder ind fra toppen. Giver de
nye juveler nye striber, fortsætter det som en kædereaktion. Spillet er endeløst, til man taber.

- **Regel (træk-budget):** man starter med **25 træk**. Hvert gyldigt byt koster ét træk.
  Store kombinationer giver træk tilbage: **4 på stribe +1**, **5 på stribe, L eller T +2**,
  og i en **kæde på 3 led eller mere giver hvert led fra det tredje +1**. Spillet slutter, når
  trækkene er brugt. Godt spil holder altså spillet i gang længe.
- **Ingen mulige byt:** er der intet muligt byt på brættet, blandes juvelerne af sig selv, og det
  koster intet (man taber ikke på uheld). Et nyt bræt har aldrig striber fra start og altid
  mindst ét muligt byt.
- **Point:** 10 point pr. juvel. 4 på stribe giver 20 ekstra, 5/L/T 50 ekstra. I en kæde ganges
  pointene med leddets nummer (led 2 tæller dobbelt, led 3 tredobbelt osv.).
- **Styring (to trin, uden træk og slip):** 1) vælg en juvel (klik, tryk, dwell eller tastatur).
  De naboer, den kan byttes med, lyser op i cyan med en prik, og resten dæmpes. 2) vælg en af
  de lysende naboer, så bytter de plads. Vælg samme juvel igen eller **Fortryd valg** for at
  fortryde. Vælg en juvel, der ikke er nabo, så bliver den valgt i stedet.
- **Ugyldigt byt:** vælger man en nabo, der ikke giver tre på stribe, sker der intet byt. De to
  felter får en stiplet orange ramme og et ✕, og teksten forklarer roligt hvorfor. Der er intet
  blink, og det koster intet træk. Valget bliver stående, så man kan vælge en anden nabo.
- **Vis et tip:** viser et muligt byt med ✓. Tip er gratis.
- **Tastatur:** piletasterne flytter markøren, Enter eller mellemrum vælger/bytter, Esc eller
  Delete fortryder valget (Esc uden valg giver pause), T viser et tip, P giver pause.
- **Dwell (valgfrit, slået fra som standard):** fremdriftsring på feltet; hvert felt og hver knap
  vælges én gang, og der gentages aldrig, mens blikket bliver.
- **Bræt:** 6 × 6, 7 × 7 eller 8 × 8 med seks slags juveler. 7 × 7 og 8 × 8 tilbydes kun, hvis
  felterne bliver mindst 100 px; 6 × 6 kan altid vælges. Startskærmen siger til, hvis felterne
  bliver små (mobil).
- **Juvelerne skelnes på form og farve:** rubin = rombe (rød), safir = cirkel (blå),
  smaragd = ottekant (grøn), topas = trekant (gul), ametyst = sekskant (lilla), opal = stjerne (hvid).
- **Alle skærme:** man skal aldrig rulle. Knapperne er mindst ca. 80 px.
- **Rekorder:** lokal top 10 (`arkade/highscores.js`) for hver brætstørrelse med point, antal byt og dato.
- **Lyd:** arkadens fælles lyde (`arkade/audio.js`) ved valg, byt, rydning, kæde, optjent træk,
  ugyldigt byt, blanding og game over; musik og effekter slås til og fra hver for sig.
- **Rolig visning:** juvelerne glider, forsvinder og falder roligt. Ingen blink. Er animation slået
  fra, eller er computeren sat til mindre bevægelse (`prefers-reduced-motion`), skifter brættet
  uden bevægelse, og de ryddede juveler vises kort med en grøn ring.
- **Glød:** neon-glød kan slås fra under Indstillinger → Udseende; spillet ser så fladt ud, men alle
  markeringer (ring, prik, stiplet ramme, ✕, ✓) er stadig tydelige.

### Opbygning
- `js/game.js` – spillogikken (`window.JuvelerGame`): striber, L/T-grupper, fald og opfyldning,
  kæder, point, træk, nyt bræt, blanding, mulige byt. Ingen DOM.
- `js/tegn.js` – tegnelaget (`window.JuvelerTegn`): læser kun tilstand og tegner brættet med
  temaets grafik. Ingen farver i JS.
- `js/app.js` – skærme, indstillinger, input, layout og animationernes rækkefølge.
- `css/juveler.css` – layout; bruger kun CSS-variabler (`--jv-*` og arkadens fælles).
- `tema/neon/` – temaet (standard): `grafik.js` og `tema.css`.

### Et nyt tema (fx tegneserie, papirklip, art deco, ler)
Lav en mappe `tema/<navn>/` med to filer, og skift de to linjer i `index.html`:

1. **`grafik.js`** sætter `window.JuvelerTema = { navn, juveler, ikoner }`:
   - `juveler`: SVG-indhold (viewBox 0 0 100 100) for de seks navngivne juveler
     `rubin`, `safir`, `smaragd`, `topas`, `ametyst`, `opal`. Hver juvel skal have sin egen
     **form** (ikke kun farve). Klasser: `jv-krop` (fyldes med `--jv-farve`), `jv-lys`,
     `jv-skygge`, `jv-kant`, `jv-glans`. De installeres som `<symbol id="jv-juvel-<navn>">`.
   - `ikoner`: `tilbage`, `pause`, `tip`, `fortryd` (klasserne `ico-line` og `ico-fill`),
     installeres som `<symbol id="jv-ikon-<navn>">`.
2. **`tema.css`** definerer alle variablerne:
   - juvelfarver: `--jv-rubin --jv-safir --jv-smaragd --jv-topas --jv-ametyst --jv-opal`,
     `--jv-kant --jv-lys-farve --jv-lys-styrke --jv-skygge-farve --jv-skygge-styrke --jv-glans-farve`
   - bræt: `--jv-board --jv-felt-a --jv-felt-b --jv-grid --jv-frame --jv-shadow --jv-board-glow`
   - markeringer: `--jv-valgt --jv-valgt-bg --jv-valgt-glow --jv-maal --jv-maal-bg --jv-maal-glow`
     `--jv-ugyldig --jv-ugyldig-bg --jv-ugyldig-dash --jv-tip --jv-cursor --jv-hover-bg --jv-ok --jv-daempet`
   - status og tekst: `--jv-traek --jv-traek-lav --jv-score-glow --jv-points-glow --jv-text-shadow --jv-text-shadow-strong`
   - overlay og hal-knap: `--jv-overlay-bg --jv-hall-bg --jv-hall-bg-hover --jv-swatch-border`
   - streger, størrelser og hjørner: `--jv-frame-w --jv-grid-w --jv-kant-w --jv-mark-w --jv-cursor-w`
     `--jv-swatch-w --jv-stroke-ico --jv-stroke-hall --jv-juvel-str --jv-juvel-str-valgt`
     `--jv-radius-board --jv-radius-felt --jv-radius-hud --jv-radius-hud-small --jv-radius-swatch`
   - glød: `--jv-juvel-glow` m.fl., og en blok `html[data-jv-gloed="fra"]`, der slår al glød fra.
   - farvesæt pr. `[data-theme="neon|solnedgang|cyberpunk|kontrast"]`.

### Test
- `node juveler/test/spillogik.test.js` – striber, 4/5, L og T, fald og opfyldning, kæder og
  kædepoint, optjente træk, intet startmatch, altid et muligt byt, blanding, ugyldigt byt koster
  intet, game over, og at spillet altid slutter.
- `python3 juveler/test/responsiv_test.py` (Playwright og Chrome) – alle skærme ved 8 opløsninger:
  ingen rulning, intet klippet, ingen overlap, knapper ≥ 80 px, ingen konsolfejl; spillet med mus,
  tastatur og dwell, ugyldigt byt uden blink, tip, glød fra, alle fire farvesæt, pause, bekræft
  afslut, game over og rekorder. `JUVELER_SKAERMBILLEDER=/mappe` gemmer skærmbilleder.

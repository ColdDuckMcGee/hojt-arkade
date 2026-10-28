# Juveler

Del af **Hojt Arkade** af Jon Leismann Engsager / Hojt Design (MIT).
Spillet kører direkte fra `index.html` uden server og uden internet (også fra `file://`).

### Juveler
Et roligt match-3-spil i stil med Bejeweled, men turbaseret: der er intet ur. Man bytter to
juveler, der ligger ved siden af hinanden, så der kommer mindst tre ens på række eller i
kolonne. De forsvinder, juvelerne ovenover falder ned, og nye falder ind fra toppen. Giver de
nye juveler nye striber, fortsætter det som en kædereaktion. Spillet er endeløst med niveauer:
når man når pointmålet, kommer man til næste niveau, får 5 træk mere, og nye elementer kommer
med. Det fortsætter, til trækkene er brugt, eller der ikke er flere mulige byt.

- **Regel (træk-budget):** man starter med **25 træk**. Hvert gyldigt byt koster ét træk.
  Store kombinationer giver træk tilbage: **4 på stribe +1**, **5 på stribe, L eller T +2**,
  og i en **kæde på 3 led eller mere giver hvert led fra det tredje +1** – dog **højst +2 pr. byt**
  (`RULES.maxEarn`). Knuste sten giver +1 hver oven i. Et nyt niveau giver +5, en klaret opgave +3.
- **Game over:** spillet slutter, når **trækkene er brugt**, eller når der **ikke er flere mulige
  byt** på brættet (intet byt kan give tre på stribe). Brættet blandes aldrig. Game over-skærmen
  siger roligt hvorfor: "Trækkene er brugt." eller "Ingen flere mulige byt på brættet." Et nyt bræt har
  aldrig striber fra start og altid mindst ét muligt byt.
- **Point:** 10 point pr. juvel (is +20, sten +30, stjernebyt +50). 4 på stribe giver 20 ekstra, 5/L/T 50 ekstra. I en kæde ganges
  pointene med leddets nummer (led 2 tæller dobbelt, led 3 tredobbelt osv.).
- **Niveauer:** niveauet står i status (Niveau), og målet står under pointene. Målet for at nå
  niveau L+1 er summen af `500 · 1,4^(l−1) · (n/6)²` for l = 1..L (rundet til 50):
  6 × 6: 500, 1200, 2200, 3550, 5450, 8150, 11 900, 17 150 … · 7 × 7: 700, 1650, 3000, 4850 … ·
  8 × 8: 900, 2150, 3900, 6350 … Kurven er valgt ved simulering (se Balance). Når et niveau bringer
  noget nyt, vises et roligt **introkort** med billede og forklaring; det lukkes med den store knap
  **Videre** (eller dwell, Enter, Esc). Intet ur, intet blink. Niveauer uden nyt giver bare en note.
  Får brættet ved et niveauskift intet muligt byt, lægges et nyt bræt (et nyt niveau starter aldrig
  uden et muligt byt).
- **Elementerne (regler):**
  - **Niveau 2 – lynjuvel:** fire på stribe bliver til én lynjuvel (af samme slags, med lyn-mærke)
    på feltet, man byttede til. Er lynjuvelen selv med i en stribe, rydder den hele **rækken**
    (vandret stribe) eller **kolonnen** (lodret). Rammes den af et andet lyn, fyrer den på tværs af
    det; ryddes den af en stjerne, rydder den rækken. Sten i linjen knuses.
  - **Niveau 3 – stjernejuvel:** fem på stribe, L eller T giver en farveløs stjerne (8 takker).
    Den kan byttes med **enhver** fri nabo; så forsvinder alle juveler af naboens slags (+50 bonus).
    To stjerner byttet med hinanden rydder alle juveler.
  - **Niveau 4 – is:** nogle juveler bliver frosne (isflade med streger). En frossen juvel kan **ikke
    byttes**, men kan være med i en stribe – så forsvinder den med isen. En stribe lige ved siden af
    **bryder isen** (juvelen bliver fri). +20 point pr. is. Is falder med juvelen.
  - **Niveau 5 – sten:** grå blokke med revner, kan ikke byttes og falder med tyngdekraften.
    En stribe ved siden af eller et lyn i linjen **knuser** stenen: **+1 træk og +30 point**.
  - **Niveau 6 – opgaver:** status viser en opgave: fjern N juveler af en slags (N = 7, stiger til
    højst 16), bryd N is eller knus N sten – inden for **5 træk**. Klaret: **+3 træk** og en ny opgave.
    Ikke klaret: **ingen straf**, bare en ny opgave. Fremskridtet vises (fx 3/8, 2 træk).
  - **Niveau 7 og op:** mere is (`iceFor`) og flere sten (`stoneFor`) ved hvert niveau, og nye juveler,
    der falder ind, kan være frosne (2 % pr. niveau over 6, højst 10 %).
  - **Niveau 8 – rav:** en syvende juvel, rav (orange **dråbe**), kommer med på alle brætstørrelser.
- **Hjælpsom opfyldning:** giver et byt et bræt uden muligt byt, slås de nye juveler om (op til 12
  gange på niveau 1–3, 3 gange på 4–6, én gang derefter). Lykkes det ikke, slutter spillet.
- **Mulige byt:** tjekket tager højde for is (frosne kan ikke flyttes), sten og stjerner (en stjerne
  med en fri juvel som nabo er altid et muligt byt).
- **Styring (to trin, uden træk og slip):** 1) vælg en juvel (klik, tryk, dwell eller tastatur).
  De naboer, den kan byttes med, lyser op i cyan med en prik, og resten dæmpes. 2) vælg en af
  de lysende naboer, så bytter de plads. Vælg samme juvel igen eller **Fortryd valg** for at
  fortryde. Vælg en juvel, der ikke er nabo, så bliver den valgt i stedet.
- **Ugyldigt byt:** vælger man en nabo, der ikke giver tre på stribe, sker der intet byt. De to
  felter får en stiplet orange ramme og et ✕, og teksten forklarer roligt hvorfor. Der er intet
  blink, og det koster intet træk. Valget bliver stående, så man kan vælge en anden nabo.
- **Vis et tip:** viser et muligt byt med ✓. Et tip **koster 20 point** (intet træk), og det står
  på knappen ("koster 20 point", på små skærme "−20 point"). Scoren bliver aldrig negativ: har man
  under 20 point, koster tippet det, man har. Trykker man igen, mens tippet vises, koster det
  ikke en gang til. Game over-skærmen viser, hvor mange tip man har brugt.
- **Tastatur:** piletasterne flytter markøren, Enter eller mellemrum vælger/bytter, Esc eller
  Delete fortryder valget (Esc uden valg giver pause), T viser et tip, P giver pause.
- **Dwell (valgfrit, slået fra som standard):** fremdriftsring på feltet; hvert felt og hver knap
  vælges én gang, og der gentages aldrig, mens blikket bliver.
- **Bræt:** 6 × 6, 7 × 7 eller 8 × 8 med seks slags juveler (syv fra niveau 8). 7 × 7 og 8 × 8 tilbydes kun, hvis
  felterne bliver mindst 100 px; 6 × 6 kan altid vælges. Startskærmen siger til, hvis felterne
  bliver små (mobil).
- **Juvelerne skelnes på form og farve:** rubin = rombe (rød), safir = cirkel (blå),
  smaragd = ottekant (grøn), topas = trekant (gul), ametyst = sekskant (lilla), opal = stjerne (hvid),
  rav = dråbe (orange). Stjernejuvelen er en farvet 8-takket stjerne; stenen en grå blok med revner.
- **Sten og is kan ikke vælges:** vælger man en, forklares det roligt i teksten.
- **Alle skærme:** man skal aldrig rulle. Knapperne er mindst ca. 80 px.
- **Rekorder:** lokal top 10 (`arkade/highscores.js`) for hver brætstørrelse med point, niveau,
  antal byt og dato (`{levels: byt, niveau}`). Gamle rekorder uden niveau vises stadig (kun byt).
- **Lyd:** arkadens fælles lyde (`arkade/audio.js`) ved valg, byt, rydning, kæde, optjent træk,
  ugyldigt byt, tip og game over; musik og effekter slås til og fra hver for sig.
- **Rolig visning:** juvelerne glider, forsvinder og falder roligt. Ingen blink. Er animation slået
  fra, eller er computeren sat til mindre bevægelse (`prefers-reduced-motion`), skifter brættet
  uden bevægelse, og de ryddede juveler vises kort med en grøn ring.
- **Glød:** neon-glød kan slås fra under Indstillinger → Udseende; spillet ser så fladt ud, men alle
  markeringer (ring, prik, stiplet ramme, ✕, ✓) er stadig tydelige.

### Opbygning
- `js/game.js` – spillogikken (`window.JuvelerGame`): striber, L/T-grupper, fald og opfyldning,
  kæder, point, træk, tip-pris, nyt bræt, mulige byt og game over (med årsag). Ingen DOM.
- `js/tegn.js` – tegnelaget (`window.JuvelerTegn`): læser kun tilstand og tegner brættet med
  temaets grafik. Ingen farver i JS.
- `js/app.js` – skærme, indstillinger, input, layout og animationernes rækkefølge.
- `css/juveler.css` – layout; bruger kun CSS-variabler (`--jv-*` og arkadens fælles).
- `tema/neon/` – temaet (standard): `grafik.js` og `tema.css`.

### Et nyt tema (fx tegneserie, papirklip, art deco, ler)
Lav en mappe `tema/<navn>/` med to filer, og skift de to linjer i `index.html`:

1. **`grafik.js`** sætter `window.JuvelerTema = { navn, juveler, maerker, ikoner }`:
   - `juveler`: SVG-indhold (viewBox 0 0 100 100) for de seks navngivne juveler
     `rubin`, `safir`, `smaragd`, `topas`, `ametyst`, `opal`. Hver juvel skal have sin egen
     **form** (ikke kun farve). Klasser: `jv-krop` (fyldes med `--jv-farve`), `jv-lys`,
     `jv-skygge`, `jv-kant`, `jv-glans`. De installeres som `<symbol id="jv-juvel-<navn>">`.
     Desuden `rav` (dråbe, 7. juvel), `stjerne` (stjernejuvel; takkerne har `jv-stjerne-1..4`,
     midten `jv-stjerne-kerne`) og `sten` (`jv-sten-krop`, `jv-sten-lys`, `jv-sten-revne`, `jv-sten-kant`).
   - `maerker`: lægges oven på en juvel: `lyn` (`jv-lyn-kant`, `jv-lyn-krop`) og `is`
     (`jv-is-flade`, `jv-is-streg`, `jv-is-kant`), installeres som `<symbol id="jv-mark-<navn>">`.
   - `ikoner`: `tilbage`, `pause`, `tip`, `fortryd`, `opgave`, `niveau` (klasserne `ico-line` og
     `ico-fill`), installeres som `<symbol id="jv-ikon-<navn>">`.
2. **`tema.css`** definerer alle variablerne:
   - juvelfarver: `--jv-rubin --jv-safir --jv-smaragd --jv-topas --jv-ametyst --jv-opal --jv-rav`,
     `--jv-kant --jv-lys-farve --jv-lys-styrke --jv-skygge-farve --jv-skygge-styrke --jv-glans-farve`
   - elementer: `--jv-stjerne-1..4 --jv-stjerne-kerne`, `--jv-sten --jv-sten-lys --jv-sten-revne --jv-sten-kant`,
     `--jv-lyn --jv-lyn-kant`, `--jv-is --jv-is-streg --jv-is-kant`, `--jv-opgave`, introkort `--jv-kort-bg --jv-kort-kant`,
     streger `--jv-lyn-kant-w --jv-is-streg-w --jv-sten-revne-w`, lynets størrelse `--jv-lyn-str`
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
  kædepoint, optjente træk, intet startmatch, altid et muligt byt på et nyt bræt, ugyldigt byt
  koster intet, game over når trækkene er brugt og når der ikke er flere byt (ingen blanding),
  tip koster 20 point og intet træk, scoren bliver aldrig negativ, og at spillet altid slutter.
  Desuden: lynjuvel (dannes, rydder række/kolonne, knuser sten), stjernejuvel (5/L, byt, stjerne+stjerne),
  is (kan ikke byttes, med i stribe, brydes ved siden af, falder), sten (falder, knuses: +1 træk og 30 point),
  mulige byt med is, sten og stjerner, opgaver (klaret +3, ikke klaret uden straf), niveau op (+5 træk, element),
  stigende mål, is/sten/rav ved de rigtige niveauer, aldrig et niveau uden muligt byt, maks. +2 træk pr. byt,
  frosne nye juveler og rekorder med niveau (også gamle rekorder uden niveau).
- `python3 juveler/test/responsiv_test.py` (Playwright og Chrome) – alle skærme ved 8 opløsninger:
  ingen rulning, intet klippet, ingen overlap, knapper ≥ 80 px, ingen konsolfejl; spillet med mus,
  tastatur og dwell, ugyldigt byt uden blink, tip og tip-pris, glød fra, alle fire farvesæt, pause, bekræft
  afslut, game over (begge årsager) og rekorder med niveau; introkortene for alle seks elementer ved
  alle opløsninger, niveauskift med kort i kø, et bræt med alle elementer, sten/is kan ikke vælges,
  stjernebyt, opgaven i status og dwell på Videre. `JUVELER_SKAERMBILLEDER=/mappe` gemmer skærmbilleder.

### Balance
Simuleret med en tilfældig spiller (vælger et vilkårligt muligt byt) og en grådig spiller (vælger
det byt, der giver flest point/træk), 300 hhv. 60 spil pr. bræt:

| Bræt | Spiller | Byt (gns./maks.) | Niveau (median/maks.) | Spil ≤ 10 byt |
|---|---|---|---|---|
| 6 × 6 | tilfældig | 49 / 115 | 4 / 7 | 0 % |
| 6 × 6 | grådig | 72 / 150 | 6 / 8 | 0 % |
| 7 × 7 | tilfældig | 48 | 4 / 7 | 0 % |
| 7 × 7 | grådig | 117 / 186 | 8 / 9 | 0 % |
| 8 × 8 | tilfældig | 51 | 3 / 7 | 0 % |
| 8 × 8 | grådig | 182 / 317 | 9 / 10 | 0 % |

En almindelig spiller når altså niveau 3–5. Uden loftet på +2 træk pr. byt, frosne nye juveler og
den syvende juvel kunne en grådig spiller på 8 × 8 spille næsten uendeligt (1000+ byt).

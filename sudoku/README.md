# Sudoku

Del af **Hojt Arkade** af Jon Leismann Engsager / Hojt Design (MIT).
Spillet kører direkte fra `index.html` uden server og uden internet (også fra `file://`).

### Sudoku
Klassisk sudoku på en 9 × 9-plade: hvert tal fra 1 til 9 skal stå præcis én gang i hver række, hver kolonne og hver boks på 3 × 3. Der er intet ur og ingen tidspres. Gåderne laves i spillet (ingen net), og hver gåde har præcis én løsning.

- **To trin, store mål (til øjenstyring):** vælg en **boks**, så zoomer pladen ind på den (felterne i boksen bliver store, resten af pladen kan stadig ses). Vælg derefter et **felt** i boksen og så et **tal** på det store talpanel 1–9. Når boksen er fuld, vender pladen tilbage til oversigten. **Hele pladen** zoomer ud. Med mus og tryk kan man også klikke direkte på et lille felt uden for boksen; så zoomes der dertil.
- **Sværhed:** vælges på startskærmen. Hver gåde graderes af en teknikløser, der altid bruger den letteste teknik, som hjælper (1 nøgne enlige, 2 skjulte enlige, 3 pointing/box-line, 4 nøgne/skjulte par):
  - **Let** (ca. 38 tal): kan løses med nøgne enlige alene.
  - **Mellem** (ca. 28 tal): kræver skjulte enlige.
  - **Svær** (ca. 25 tal): kræver pointing/box-line (kan ikke løses med enlige alene).
  - **Ekspert** (ca. 24 tal, 22–27): kræver nøgne eller skjulte par (kan ikke løses med enlige og pointing/box-line).
  Alle gåder har præcis én løsning og kan løses uden gæt. Laves en gåde, der ikke kræver den rigtige teknik, laves en ny (højst 60 forsøg og ca. 0,4 sekund; derefter bruges den sværeste, der blev fundet). Svær og Ekspert tager typisk 30–70 ms at lave, sjældent op til ca. 0,35 s. Den første gåde laves i forvejen, mens startskærmen står stille, og næste gåde, mens **Gåde løst** vises, så man mærker ikke ventetiden.
- **Gåder uden ende:** når en gåde er løst, kommer næste. Serien fortsætter, til man selv vælger **Afslut serien** (i pausen eller ved **Gåde løst**). Så vises **Serien er slut** med point, løste gåder, fejl og tip, og pointene gemmes på top 10 for sværheden.
- **Fejl giver minuspoint, ingen liv:** et tal, der ikke er det rigtige, trækker straks point fra totalen (Let 5, Mellem 8, Svær 12, Ekspert 16) og står gennemstreget i fejlfarven, til det viskes ud eller overskrives. Linjen under pladen siger tydeligt »−X point« og, hvis tallet bryder reglerne, hvorfor. Intet blinker. Der er ingen game over ved fejl, og totalen bliver aldrig negativ (den stopper ved 0). Feltet **Fejl** øverst viser fejl i den aktuelle gåde.
- **Blyantsnoter:** knappen **Noter** (eller N) skifter mellem at skrive rigtige tal og små blyantstal. Noter koster aldrig point, og de forsvinder af sig selv fra række, kolonne og boks, når det rigtige tal sættes.
- **Visk** fjerner noter og forkerte tal. Rigtige tal bliver stående.
- **Fortryd:** én gang pr. gåde. Tager det sidste træk tilbage (tal, note eller visk). Et fortrudt forkert tal giver ikke pointene tilbage, og fejlen tæller stadig (ingen bonus).
- **Tip:** udfylder det valgte tomme felt (ellers det felt, der er lettest at regne ud) og trækker straks point fra (Let 4, Mellem 6, Svær 10, Ekspert 14). Et tip kan ikke fortrydes.
- **Hjælp på pladen:** række, kolonne og boks omkring det valgte felt er svagt fremhævet, og ens tal (også i noterne) er fremhævet. Kan slås fra under Indstillinger. Tallene på panelet viser, hvor mange af hvert tal der mangler.
- **Point:**

  | Sværhed | Løst gåde | Bonus (fejlfri, uden tip) | Fejl | Tip |
  |---|---|---|---|---|
  | Let | 20 | 10 | −5 | −4 |
  | Mellem | 40 | 20 | −8 | −6 |
  | Svær | 70 | 35 | −12 | −10 |
  | Ekspert | 110 | 55 | −16 | −14 |

  Fejl og tip trækkes fra med det samme; totalen bliver aldrig under 0. Der gives ikke point for hurtighed – der er bevidst intet ur.
- **Rekorder:** lokal top 10 for hver af de fire sværheder med point, antal løste gåder og dato.
- **Tastatur:** piletasterne flytter markøren (og zoomet følger med), 1–9 sætter et tal, Backspace, Delete eller 0 visker, N noter, U fortryd, T tip, O hele pladen, Esc eller P pause. En boks kan også vælges med Tab og Enter.
- **Dwell (valgfrit, slået fra som standard):** bokse, felter og knapper vælges efter den valgte tid med en ring, der fyldes. Ét dwell er altid én handling. Kun de store mål kan vælges med dwell: bokse i oversigten og felterne i den zoomede boks.
- **Alle skærme:** man skal aldrig rulle. Knapperne er mindst ca. 3 cm, når der er plads, ellers mindst ca. 80 px. På en høj skærm står tallene under pladen, på en bred ved siden af. Layoutet, der giver den største plade, vælges.
- **Afslut serien:** fra pausen og fra **Gåde løst** spørger spillet først med to store knapper (**Nej, spil videre** har fokus). Esc er det samme som Nej.
- **Rolig visning:** ingen blink og ingen hvide lysglimt. Er animation slået fra, eller er computeren sat til mindre bevægelse, skifter zoomet uden overgang. **Glød** kan slås fra under Indstillinger → Udseende. Spillet kan læses lige så godt uden.
- **Test:** `node sudoku/test/spillogik.test.js` tjekker regler, løser og entydighed, teknikløseren, generatoren (40 gåder pr. sværhed: gyldig løsning, præcis én løsning, krævet teknik, tid), at Svær og Ekspert er reelt forskellige, fallback, minuspoint (aldrig under 0, ingen game over), noter, visk, fortryd uden refusion, tip, point, prefetch og serien. `node sudoku/test/temaklar.test.js` tjekker, at spillet er klar til flere temaer. `python3 sudoku/test/responsiv_test.py` (Playwright og Chrome) tjekker alle skærme ved 8 opløsninger: ingen rulning, knap- og feltstørrelser, spil med mus og tastatur, fire sværhedsknapper, minuspoint uden blink, glød fra, Gåde løst, Afslut serien med bekræftelse, Serien er slut, rekorder (også Ekspert), en Ekspert-gåde, dwell og vejen tilbage til hallen. Skærmbilleder gemmes, hvis `SUDOKU_SKAERMBILLEDER=<mappe>` er sat.

## Filer

- `index.html` – skærmene (start, spil, pause, Gåde løst, Serien er slut, indstillinger, rekorder, Om).
- `js/game.js` – spillogikken uden DOM og uden grafik: regler, løser (tæller løsninger), teknikløser (gradering), generator, point, noter, fortryd, tip, point og serien.
- `js/tegn.js` – tegnelaget: bygger pladen (81 felter og 9 bokseknapper) og sætter klasser ud fra spillets tilstand. Kender ingen farver.
- `js/app.js` – skærme, styring (mus, tryk, tastatur, dwell), zoom, layout og indstillinger.
- `css/sudoku.css` – opbygning og mål. Farver, glød, skygger, streger, hjørner og skrift kommer kun fra temaets variabler.
- `tema/neon/tema.css` og `tema/neon/grafik.js` – temaet (se nedenfor).
- Fælles moduler fra `../arkade/` (indstillinger, dwell, lyd, rekorder, baggrund, fælles stil).

## Temaet

Al grafik ligger i `tema/neon/`. Spilkoden henter den kun ved navn, så et nyt tema (fx Tegneserie ligne claire, Papirklip, Art deco eller Ler) er en ny mappe `tema/<navn>/` med de samme to filer, som `index.html` peger på i stedet.

**`tema.css`** skal sætte disse CSS-variabler (for hver farvepalet, arkadens Tema-valg: `[data-theme="neon|solnedgang|cyberpunk|kontrast"]`):

- *Plade:* `--su-board` (fladen), `--su-texture` (et billede/mønster oven på fladen, fx papir eller ler; `none` i neon), `--su-frame`, `--su-grid` (tynde linjer), `--su-block` (boksenes linjer).
- *Tal:* `--su-given` (givne tal), `--su-placed` (egne tal), `--su-tip` (tal fra et tip), `--su-err` (forkert tal og streg), `--su-note`, `--su-note-same` (noter, der er ens med det valgte tal), `--su-digit-outline` og `--su-digit-outline-w` (kontur om tallene, fx til ligne claire; 0 i neon).
- *Fremhævning:* `--su-peer-bg` (række, kolonne og boks), `--su-same-bg` og `--su-same` (ens tal), `--su-sel-bg` og `--su-cursor` (valgt felt), `--su-zoom` og `--su-zoom-bg` (den zoomede boks), `--su-dim` (resten af pladen, når der er zoomet), `--su-box-hover-bg`.
- *Øvrige farver:* `--su-ok`, `--su-overlay-bg`, `--su-overlay-soft`, `--su-hall-bg`, `--su-hall-bg-hover`, `--su-hall-border`, `--su-swatch-border`, `--su-shadow`.
- *Skrift:* `--su-font-digit`, `--su-weight-given`, `--su-weight-placed`, `--su-weight-note`.
- *Streger og hjørner:* `--su-frame-w`, `--su-grid-w`, `--su-block-w`, `--su-cursor-w`, `--su-zoom-w`, `--su-err-line-w`, `--su-hall-border-w`, `--su-stroke-ico`, `--su-stroke-hall`, `--su-radius-board`, `--su-radius-hud`, `--su-radius-hud-small`, `--su-radius-zoom`, `--su-radius-swatch`.
- *Glød og skygger:* `--su-board-glow`, `--su-zoom-glow`, `--su-digit-glow`, `--su-score-glow`, `--su-points-glow` (alle `box-shadow`/`text-shadow`-værdier, så et papirtema kan bruge en hård skygge i stedet), samt `--su-text-shadow` og `--su-text-shadow-strong` (læsbarhed). Under `html[data-su-gloed="fra"]` skal glød-variablerne være `none` og `--glow` 0. Spillet må ikke have brug for glød for at kunne aflæses.
- *Farveprøver i Indstillinger:* `.swatch[data-farver="…"]` med `--a`, `--b` og `--c`.

**`grafik.js`** sætter `window.SudokuTema` med `navn` og `ikoner`. Ikonerne er SVG-indhold i et 100 × 100-felt og skal hedde `pause`, `tilbage`, `noter`, `visk`, `fortryd`, `tip` og `oversigt`. De farves kun med klasserne `ico-line` og `ico-fill` (farverne kommer fra CSS). `js/tegn.js` lægger dem ind som `#su-ikon-<navn>`.

Tekster, mål, zoom og layout hører ikke til temaet og er ens for alle temaer.

# Sudoku

Del af **Hojt Arkade** af Jon Leismann Engsager / Hojt Design (MIT).
Spillet kører direkte fra `index.html` uden server og uden internet (også fra `file://`).

### Sudoku
Klassisk sudoku på en 9 × 9-plade: hvert tal fra 1 til 9 skal stå præcis én gang i hver række, hver kolonne og hver boks på 3 × 3. Der er intet ur og ingen tidspres. Gåderne laves i spillet (ingen net), og hver gåde har præcis én løsning.

- **To trin, store mål (til øjenstyring):** vælg en **boks**, så zoomer pladen ind på den (felterne i boksen bliver store, resten af pladen kan stadig ses). Vælg derefter et **felt** i boksen og så et **tal** på det store talpanel 1–9. Når boksen er fuld, vender pladen tilbage til oversigten. **Hele pladen** zoomer ud. Med mus og tryk kan man også klikke direkte på et lille felt uden for boksen; så zoomes der dertil.
- **Sværhed:** vælges på startskærmen. **Let** (ca. 38 tal, kan løses med kun »enlige« tal), **Mellem** (ca. 28 tal, kan løses med enlige og skjulte enlige uden gæt) og **Svær** (ca. 26 tal, kræver som regel mere end det).
- **Gåder uden ende:** når en gåde er løst, kommer næste. Serien slutter, når man mister alle tre liv i en gåde (eller selv vælger Afslut).
- **Fejl og liv:** man har 3 liv i hver gåde, og de fyldes op ved hver ny gåde. Et tal, der ikke er det rigtige, koster et liv og står gennemstreget i fejlfarven, til det viskes ud eller overskrives. Bryder det tydeligt reglerne, siger linjen under tallene hvorfor. Intet blinker. Tre fejl i samme gåde = spillet er slut.
- **Blyantsnoter:** knappen **Noter** (eller N) skifter mellem at skrive rigtige tal og små blyantstal. Noter koster aldrig liv, og de forsvinder af sig selv fra række, kolonne og boks, når det rigtige tal sættes.
- **Visk** fjerner noter og forkerte tal. Rigtige tal bliver stående.
- **Fortryd:** én gang pr. gåde. Tager det sidste træk tilbage (tal, note eller visk) – også et tabt liv.
- **Tip:** udfylder det valgte tomme felt (ellers det felt, der er lettest at regne ud) og koster point. Et tip kan ikke fortrydes.
- **Hjælp på pladen:** række, kolonne og boks omkring det valgte felt er svagt fremhævet, og ens tal (også i noterne) er fremhævet. Kan slås fra under Indstillinger. Tallene på panelet viser, hvor mange af hvert tal der mangler.
- **Point:** hver løst gåde giver grundpoint efter sværheden (Let 20, Mellem 40, Svær 70) og en **bonus for en fejlfri gåde uden tip** (10/20/35). Hver fejl koster 5/8/12, og hvert tip 4/6/10. Mindst 1 point pr. løst gåde. Der gives ikke point for hurtighed – der er bevidst intet ur.
- **Rekorder:** lokal top 10 for hver sværhed med point, antal løste gåder og dato.
- **Tastatur:** piletasterne flytter markøren (og zoomet følger med), 1–9 sætter et tal, Backspace, Delete eller 0 visker, N noter, U fortryd, T tip, O hele pladen, Esc eller P pause. En boks kan også vælges med Tab og Enter.
- **Dwell (valgfrit, slået fra som standard):** bokse, felter og knapper vælges efter den valgte tid med en ring, der fyldes. Ét dwell er altid én handling. Kun de store mål kan vælges med dwell: bokse i oversigten og felterne i den zoomede boks.
- **Alle skærme:** man skal aldrig rulle. Knapperne er mindst ca. 3 cm, når der er plads, ellers mindst ca. 80 px. På en høj skærm står tallene under pladen, på en bred ved siden af. Layoutet, der giver den største plade, vælges.
- **Afslut:** fra pausen og fra **Gåde løst** spørger spillet først med to store knapper (**Nej, spil videre** har fokus). Esc er det samme som Nej.
- **Rolig visning:** ingen blink og ingen hvide lysglimt. Er animation slået fra, eller er computeren sat til mindre bevægelse, skifter zoomet uden overgang. **Glød** kan slås fra under Indstillinger → Udseende. Spillet kan læses lige så godt uden.
- **Test:** `node sudoku/test/spillogik.test.js` tjekker regler, løser og entydighed, generatoren (40 gåder pr. sværhed: gyldig løsning, præcis én løsning, sværhed, symmetri), liv, fejl, game over, noter, visk, fortryd, tip, point og serien. `node sudoku/test/temaklar.test.js` tjekker, at spillet er klar til flere temaer. `python3 sudoku/test/responsiv_test.py` (Playwright og Chrome) tjekker alle skærme ved 8 opløsninger: ingen rulning, knap- og feltstørrelser, spil med mus og tastatur, glød fra, Gåde løst, bekræftelsen ved Afslut, game over, rekorder, dwell og vejen tilbage til hallen. Skærmbilleder gemmes, hvis `SUDOKU_SKAERMBILLEDER=<mappe>` er sat.

## Filer

- `index.html` – skærmene (start, spil, pause, Gåde løst, game over, indstillinger, rekorder, Om).
- `js/game.js` – spillogikken uden DOM og uden grafik: regler, løser (tæller løsninger), logisk løser (sværhed), generator, liv, noter, fortryd, tip, point og serien.
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
- *Øvrige farver:* `--su-heart`, `--su-heart-off`, `--su-heart-off-dash`, `--su-ok`, `--su-overlay-bg`, `--su-overlay-soft`, `--su-hall-bg`, `--su-hall-bg-hover`, `--su-hall-border`, `--su-swatch-border`, `--su-shadow`.
- *Skrift:* `--su-font-digit`, `--su-weight-given`, `--su-weight-placed`, `--su-weight-note`.
- *Streger og hjørner:* `--su-frame-w`, `--su-grid-w`, `--su-block-w`, `--su-cursor-w`, `--su-zoom-w`, `--su-err-line-w`, `--su-hall-border-w`, `--su-stroke-ico`, `--su-stroke-heart`, `--su-stroke-hall`, `--su-radius-board`, `--su-radius-hud`, `--su-radius-hud-small`, `--su-radius-zoom`, `--su-radius-swatch`.
- *Glød og skygger:* `--su-board-glow`, `--su-zoom-glow`, `--su-digit-glow`, `--su-heart-glow`, `--su-score-glow`, `--su-points-glow` (alle `box-shadow`/`text-shadow`-værdier, så et papirtema kan bruge en hård skygge i stedet), samt `--su-text-shadow` og `--su-text-shadow-strong` (læsbarhed). Under `html[data-su-gloed="fra"]` skal glød-variablerne være `none` og `--glow` 0. Spillet må ikke have brug for glød for at kunne aflæses.
- *Farveprøver i Indstillinger:* `.swatch[data-farver="…"]` med `--a`, `--b` og `--c`.

**`grafik.js`** sætter `window.SudokuTema` med `navn` og `ikoner`. Ikonerne er SVG-indhold i et 100 × 100-felt og skal hedde `liv`, `pause`, `tilbage`, `noter`, `visk`, `fortryd`, `tip` og `oversigt`. De farves kun med klasserne `ico-line` og `ico-fill` (farverne kommer fra CSS). `js/tegn.js` lægger dem ind som `#su-ikon-<navn>`.

Tekster, mål, zoom og layout hører ikke til temaet og er ens for alle temaer.

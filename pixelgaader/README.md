# Pixelgåder

Del af **Hojt Arkade** af Jon Leismann Engsager / Hojt Design (MIT).
Spillet kører direkte fra `index.html` uden server og uden internet (også fra `file://`).

### Pixelgåder
Et roligt logikspil (nonogram, også kaldet picross). Der er intet ur og ingen tidspres.
Tallene ved hver række og over hver kolonne fortæller, hvor mange felter i træk der skal farves, i den rækkefølge de står. Farver man de rigtige felter, kommer et neonpixelbillede frem, og når gåden er løst, vises billedets navn (fx »Rumvæsen« eller »Joystick«).

- **Værktøjer:** **Udfyld** farver et felt. **Kryds** sætter et kryds som note (»her er tomt«). Krydset tjekkes ikke, men et krydset felt kan ikke farves ved et uheld. **Visk** fjerner et kryds. Et valg (klik, tryk eller ét dwell) er altid én handling.
- **Fejl og liv:** man har 3 liv i hver gåde, og de fyldes op ved hver ny gåde. Farver man et felt, der er tomt i billedet, mister man et liv, og feltet vises som tomt (orange kryds), så man ikke kan lave samme fejl igen. Mister man alle tre liv, er spillet slut, og serien gemmes.
- **Løste rækker og kolonner:** når en række eller kolonne er færdig, bliver dens tal grønne med et ✓, og dens tomme felter krydses af sig selv (svagt). Intet blinker.
- **Tip:** afslører ét felt i billedet (med en grøn ring). Et tip koster point.
- **Markering:** rækken og kolonnen under musen, blikket eller markøren er svagt fremhævet, også deres tal. Kan slås fra under Indstillinger.
- **Tastatur:** piletasterne flytter markøren, Enter eller mellemrum bruger det valgte værktøj, F farver, X krydser, V eller Delete visker, 1/2/3 vælger værktøj, T giver et tip, og Esc eller P giver pause.
- **Dwell (valgfrit, slået fra som standard):** hvert felt og hver knap vælges én gang, og der gentages aldrig, mens blikket bliver på den.
- **Gåder:** 5 × 5, 8 × 8, 10 × 10 og 15 × 15. **Stigende** (standard) starter med tre 5 × 5, så fire 8 × 8, fem 10 × 10 og derefter den største størrelse, skærmen kan bære, uden ende. Først kommer håndlavede motiver (15 på 5 × 5, 10 på 8 × 8, 7 på 10 × 10, 3 på 15 × 15), derefter genererede spejlsymmetriske »rumvæsner«. Alle gåder har præcis én løsning, og de kan løses uden at gætte (én række eller kolonne ad gangen). Det tjekkes for hver genereret gåde.
- **Størrelser efter skærmen:** en størrelse tilbydes kun, hvis felterne bliver mindst ca. 72 px. 15 × 15 kræver en stor skærm (ca. 2560 × 1440). På 1920 × 1080 er der 5 × 5, 8 × 8 og 10 × 10, på 1366 × 768 og mindre 5 × 5 og 8 × 8, og på en mobil kun 5 × 5. Startskærmen siger til, hvad der mangler og hvorfor.
- **Point:** hver løst gåde giver grundpoint efter størrelsen (5 × 5: 10, 8 × 8: 30, 10 × 10: 50, 15 × 15: 120) minus hver fejl og hvert tip (2/5/8/20) og plus en bonus for en fejlfri gåde uden tip (5/15/25/60). Mindst 1 point pr. gåde.
- **Alle skærme:** man skal aldrig rulle. Knapperne er mindst ca. 3 cm, når der er plads, ellers mindst ca. 80 px. På en høj skærm står knapperne under gitteret, på en bred ved siden af.
- **Rekorder:** der er en lokal top 10 for hver serie (Stigende og hver størrelse) med point, antal løste gåder og dato.
- **Afslut:** fra pausen og fra **Gåde løst** spørger spillet først med to store knapper (**Nej, spil videre** har fokus). Esc er det samme som Nej. Dialogen er dwell-sikker.
- **Rolig visning:** ingen blink og ingen hvide lysglimt. Er animation slået fra, eller er computeren sat til mindre bevægelse, skifter felterne uden overgang. **Glød** kan slås fra under Indstillinger → Udseende. Spillet kan læses lige så godt uden.
- **Test:** `node pixelgaader/test/spillogik.test.js` tjekker hints, linjeløseren, entydighed (sammenlignet med at prøve alle løsninger på små gitre), alle motiver, generatoren (100 gåder pr. størrelse), værktøjerne, liv og game over, point, tip og serien. `python3 pixelgaader/test/responsiv_test.py` (Playwright og Chrome) tjekker alle skærme ved 8 opløsninger (og 2560 × 1440): ingen rulning, knapstørrelser, hvilke størrelser der tilbydes, feltstørrelse, spil med mus og tastatur, glød fra, Gåde løst med navnet, bekræftelsen ved Afslut, game over, rekorder og dwell. Skærmbilleder gemmes, hvis `PIXELGAADER_SKAERMBILLEDER=<mappe>` er sat.

## Filer

- `index.html` – skærmene (start, spil, pause, Gåde løst, game over, indstillinger, rekorder, Om).
- `js/game.js` – spillogikken uden DOM og uden farver: hints, linjeløser, entydighed, generator, regler, point og serier.
- `js/motiver.js` – de håndlavede motiver (kun form: `X` = farvet, `.` = tomt) og deres danske navne.
- `js/tegn.js` – tegnelaget: bygger gitteret og opdaterer det ud fra spillets tilstand. Kender ingen farver.
- `js/app.js` – skærme, styring (mus, tryk, tastatur, dwell), layout og indstillinger.
- `css/pixelgaader.css` – opbygning og mål. Ingen farver, glød, skygger, stregtykkelser eller hjørner.
- `tema/neon/tema.css` og `tema/neon/grafik.js` – temaet (se nedenfor).
- Fælles moduler fra `../arkade/` (indstillinger, dwell, lyd, rekorder, fælles stil).

## Temaet

Al grafik ligger i `tema/neon/`. Spilkoden henter den kun ved navn, så et nyt tema er en ny mappe `tema/<navn>/` med de samme to filer, som `index.html` peger på i stedet.

**`tema.css`** skal sætte disse CSS-variabler (for hver farvepalet, arkadens Tema-valg: `[data-theme="neon|solnedgang|cyberpunk|kontrast"]`):

- *Farver:* `--pg-board`, `--pg-grid`, `--pg-block`, `--pg-frame`, `--pg-clue`, `--pg-clue-bg`, `--pg-clue-hl`, `--pg-clue-hl-bg`, `--pg-corner-bg`, `--pg-fill` og `--pg-fill-core` (pixelmotivernes farve), `--pg-fill-bg` (fladen i et farvet felt), `--pg-cross`, `--pg-auto`, `--pg-err`, `--pg-tip`, `--pg-tip-ring`, `--pg-cursor`, `--pg-line`, `--pg-line-bg`, `--pg-hover-bg`, `--pg-done`, `--pg-done-bg`, `--pg-done-clue`, `--pg-done-dim`, `--pg-done-hl`, `--pg-missed`, `--pg-ok`, `--pg-heart`, `--pg-heart-off`, `--pg-heart-off-dash`, `--pg-pic-bg`, `--pg-overlay-bg`, `--pg-overlay-soft`, `--pg-hall-bg`, `--pg-hall-bg-hover`, `--pg-swatch-border`, `--pg-shadow`.
- *Streger og hjørner:* `--pg-frame-w`, `--pg-grid-w`, `--pg-block-w`, `--pg-cursor-w`, `--pg-stroke-ico`, `--pg-stroke-heart`, `--pg-stroke-hall`, `--pg-stroke-pic`, `--pg-radius-board`, `--pg-radius-hud`, `--pg-radius-hud-small`, `--pg-radius-mark`, `--pg-radius-cross`, `--pg-radius-swatch`, `--pg-pic-rx`.
- *Glød og skygger:* `--pg-board-glow`, `--pg-fill-glow`, `--pg-heart-glow`, `--pg-score-glow`, `--pg-points-glow`, `--pg-text-shadow`, `--pg-text-shadow-strong`. Under `html[data-pg-gloed="fra"]` skal glød-variablerne være `none` og `--glow` 0. Spillet må ikke have brug for glød for at kunne aflæses.
- *Farveprøver i Indstillinger:* `.swatch[data-farver="…"]` med `--a`, `--b` og `--c`.

**`grafik.js`** sætter `window.PixelgaaderTema` med `navn`, `ikoner` og `pixelbillede(sol, n, rx)`. Ikonerne er SVG-indhold i et 100 × 100-felt, og de skal hedde `udfyld`, `kryds`, `visk`, `tip`, `liv`, `pause` og `tilbage`. De farves kun med klasserne `ico-line` og `ico-fill` (farverne kommer fra CSS). `js/tegn.js` lægger dem ind som `#pg-ikon-<navn>`. `pixelbillede` tegner et løst motiv (klasserne `pic-bg` og `pic-px`).

Tekster, mål og layout hører ikke til temaet og er ens for alle temaer.

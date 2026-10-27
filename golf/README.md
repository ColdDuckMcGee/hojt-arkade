# Golf

Del af **Hojt Arkade** af Jon Leismann Engsager / Hojt Design (MIT).
Spillet kører direkte fra `index.html` uden server og uden internet (også fra `file://`).

### Golf
Retro minigolf for voksne, set oppefra og i ture. Der er intet ur og ingen tidspres.
Hvert slag: vælg **retning** og **kraft** med de store knapper, se den prikkede **forhåndslinje**, og tryk på **Slå**. Bolden ruller, stopper, og så er det næste slag. Huller uden ende: hvert hul laves automatisk og bliver lidt sværere, indtil **slagpuljen** er tom.

- **Retning:** fire drejeknapper: 10° og 1° mod uret, 1° og 10° med uret. Under dwell bliver drejeknapperne ved med at dreje ét trin for hver dwell-tid, så længe blikket bliver der. Man kan også **klikke eller trykke på banen** for at sigte lige derhen. Retningen vises som en pil og i grader (0° = op på skærmen). Ved hvert nyt slag sigtes der fra start mod hullet.
- **Kraft:** 1–10 med − og + og en måler med 10 streger. Hver kraft ruller ca. 100 af banens enheder på græs (banen er 1000 × 600). Kraften huskes fra slag til slag.
- **Slå:** ét klik, ét dwell eller Enter er ét slag. Under dwell kan Slå først vælges igen, når blikket har forladt knappen. Alle knapper er låst, mens bolden ruller.
- **Forhåndslinje:** *Kort* (standard) viser vejen til og med det første bandehop og et stykke efter (eller 320 enheder, hvis der ikke er noget hop). *Hele vejen* viser hele rullet og stedet, hvor bolden stopper. Det er lettere, så det har sin egen rekordliste. Vælges under Indstillinger → Styring.
- **Banen:** bander (vægge) kaster bolden tilbage med samme vinkel og lidt mindre fart. **Sand** bremser kraftigt. **Skråninger** (pile) trækker bolden i pilens retning. **Vand** giver **1 strafslag**, og bolden lægges tilbage, hvor den blev slået fra. Bolden falder i hul, hvis den ruller hen over hullet langsomt nok. En for hård bold ruller forbi.
- **Slagpuljen:** man starter med 4 slag i reserve. Hvert hul lægger sit **par** i puljen, og hvert slag tager ét (vand: to). Slag, der er tilbage, når bolden er i hul, gemmes til næste hul (højst 9). Hole-in-one giver 1 slag ekstra. Når puljen er tom, og bolden ikke er i hul, er spillet slut.
- **Genererede huller:** hvert hul laves tilfældigt (med frø) og tjekkes, før det bruges: en søgning med fuld fysik (samme simulering som spillet) skal kunne spille hullet på højst 6 slag. **Par** er den søgnings antal slag + 1 (2–6). Fra hul 2 kommer der sand, fra hul 3 skrå bander og knæk, fra hul 4 vand og fra hul 6 skråninger, og der kommer flere bander (højst 5). Tee'en ligger altid til venstre eller højre, og hullet i den modsatte ende.
- **Point:** et hul giver 100 point for par, +40 pr. slag under par og −25 pr. slag over (mindst 10), +10 × hullets nummer og +100 for hole-in-one.
- **Tastatur:** pil venstre/højre drejer 1° (med Skift 10°), pil op/ned ændrer kraften, Enter, mellemrum eller S slår, og Esc eller P giver pause.
- **Dwell** (valgfrit, slået fra som standard, med ring). Nye dialoger er dwell-sikre: en knap, der dukker op lige under blikket, kan først vælges, når blikket har været væk.
- **Alle skærme:** man skal aldrig rulle. Knapperne er mindst ca. 3 cm, når der er plads, og ellers mindst ca. 80 px. Spillet vælger det layout, der giver den største bane: status til venstre og knapper til højre på brede skærme, knapperne ved siden af på lave skærme og knapperne under banen på højkant. På højkant drejes banen, så tee'en altid er nederst.
- **Rekorder:** en lokal top 10 pr. forhåndslinje (*Kort* og *Hele vejen*) med point, antal huller og dato.
- **Afslut:** fra pausen og fra **I hul!** spørger spillet først (**Nej, spil videre** har fokus, og Esc betyder Nej). Pointene gemmes. Lukkes siden midt i et spil, gemmes de også.
- **Rolig visning:** intet blinker. Når animation er slået fra, eller computeren er sat til mindre bevægelse, vises bolden straks, hvor den stopper, med sporet efter sig. **Glød** kan slås fra under Indstillinger → Udseende, og spillet kan aflæses lige så godt uden.
- **Test:**
  - `node golf/test/spillogik.test.js` tjekker rul og friktion, bander (vinkler, aldrig gennem en væg), sand, skråninger, hul og for hård bold, vand og strafslag, forhåndslinjen, slagtælling og puljen, reserve og loft, game over (også via vand), point, grænser, deterministiske og løselige huller og en hel runde med en simpel computerspiller.
  - `python3 golf/test/responsiv_test.py` (Playwright og Chrome) tjekker alle skærme ved 8 opløsninger: ingen rulning, knapstørrelser, spil med knapper, tastatur og klik på banen, vand, I hul!, bekræftelsen, Næste hul, game over, rekorder, glød fra, dwell, mindre bevægelse og hallen. Skærmbilleder gemmes, når `GOLF_SKAERMBILLEDER=<mappe>` er sat.

## Filer

- `index.html` – skærmene (start, spil, pause, I hul!, bekræft, game over, indstillinger, rekorder, Om).
- `js/logik.js` – spillogikken uden DOM og uden farver: fysik (fast tidsskridt, deterministisk), forhåndslinje, generator, løselighed og par, regler, point og runden.
- `js/tegn.js` – tegnelaget på canvas. Det læser kun spillets tilstand, henter alle mål og farver fra temaets CSS-variabler og kalder temaets tegnefunktioner. Det drejer banen på højkant.
- `js/app.js` – skærme, styring (knapper, mus, tryk, tastatur, dwell), layout, lyd og indstillinger.
- `css/golf.css` – opbygning og mål. Ingen farver, glød, skygger, skrifttyper, stregtykkelser eller hjørner (de kommer fra temaet).
- `tema/neon/tema.css` og `tema/neon/grafik.js` – temaet (se nedenfor).
- Fælles moduler fra `../arkade/` (indstillinger, dwell, lyd, baggrund, rekorder og fælles stil).

## Temaet

Al grafik ligger i `tema/neon/`. Spilkoden henter den kun ved navn. Et nyt tema (Tegneserie – ligne claire, Papirklip, Art deco eller Ler) er en ny mappe `tema/<navn>/` med de samme to filer, som `index.html` så peger på. Konturer, skygger og teksturer har deres egne variabler, så et tema ikke er bundet til glød: Tegneserie kan bruge sort kontur (`--golf-kontur-w`) og ingen glød, Papirklip og Ler en hård skygge (`--golf-skygge-*`) og mønstre (`--golf-*-moenster`), Art deco tynde dobbeltkanter (`--golf-kant-inde-w`).

**`grafik.js`** sætter `window.GolfTema` med:

- `navn`.
- `farver` og `tal`: listerne over de variabler, temaet bruger. `js/tegn.js` læser `--golf-<navn>` for hver af dem og giver værdierne videre i objektet `s`.
- `tegn`: tegnefunktioner på canvas, i banens enheder (1000 × 600; tegnelaget har allerede skaleret og evt. drejet). Følgende skal findes:
  - `flade` (græsset), `sand`, `vand`, `skraaning` (med pil i retningen `dir`).
  - `bande` (væg inde på banen: en tyk linje fra `a` til `b` med tykkelsen `t` og runde ender) og `kant` (yderbanden).
  - `tee`, `hul` og `flag`.
  - `bold`, `sigte` (forhåndslinjen; `full` fortæller, om hele vejen vises), `slutpunkt` (hvor bolden stopper ved *Hele vejen*) og `spor` (det forrige slag).
  - Et tema må tegne, hvad det vil, inden for disse rammer (fx teksturer, papirkanter eller ler-skygger), men intet må være nødvendigt for at kunne aflæse spillet ud over formen.
- `ikoner`: SVG-indhold i et 100 × 100-felt, farvet med klasserne `ico-line` og `ico-fill`.
  - Ikonerne skal hedde `drej-venstre`, `drej-hoejre`, `kraft-ned`, `kraft-op`, `slaa`, `pause`, `tilbage`, `flag`, `bold` og `pil` (retningsviseren, peger op).
  - `js/tegn.js` lægger dem ind som `#golf-ikon-<navn>`.

**`tema.css`** skal sætte disse CSS-variabler for hver farvepalet, som arkadens Tema-valg sætter med `[data-theme="neon|solnedgang|cyberpunk|kontrast"]`:

- *Banens farver* (til canvas): `--golf-flade`, `--golf-flade-2`, `--golf-flade-moenster`, `--golf-kant`, `--golf-kant-inde`, `--golf-bande`, `--golf-bande-kerne`, `--golf-kontur`, `--golf-sand`, `--golf-sand-moenster`, `--golf-vand`, `--golf-vand-boelge`, `--golf-skraaning`, `--golf-skraaning-pil`, `--golf-tee`, `--golf-tee-kant`, `--golf-hul`, `--golf-hul-kant`, `--golf-flag`, `--golf-flagstang`, `--golf-bold`, `--golf-bold-kant`, `--golf-sigte`, `--golf-sigte-pil`, `--golf-spor`, `--golf-slutpunkt`, `--golf-gloed-farve` og `--golf-skygge-farve`.
- *Banens tal* (i banens enheder): `--golf-kant-w`, `--golf-kant-inde-w`, `--golf-kontur-w`, `--golf-bande-kerne-w`, `--golf-moenster-w`, `--golf-moenster-afstand`, `--golf-boelge-w`, `--golf-pil-w`, `--golf-tee-kant-w`, `--golf-hul-kant-w`, `--golf-bold-kant-w`, `--golf-sigte-w`, `--golf-sigte-prik`, `--golf-sigte-afstand`, `--golf-spor-w`, `--golf-flag-w` og `--golf-radius-felt`.
- *Glød og skygge på banen:* `--golf-gloed` (styrke, 0 = ingen), `--golf-gloed-blur`, `--golf-skygge-x`, `--golf-skygge-y` og `--golf-skygge-blur`.
- *Fladerne omkring:* `--golf-board-bg`, `--golf-frame`, `--golf-ok`, `--golf-fejl`, `--golf-vand-tekst`, `--golf-shadow`, `--golf-hud-bg`, `--golf-hud-border`, `--golf-meter`, `--golf-meter-tom`, `--golf-overlay-bg`, `--golf-overlay-soft`, `--golf-hall-bg`, `--golf-hall-bg-hover` og `--golf-swatch-border`.
- *Streger og hjørner:* `--golf-frame-w`, `--golf-block-w`, `--golf-cursor-w`, `--golf-stroke-ico`, `--golf-stroke-hall`, `--golf-hall-border-w`, `--golf-radius-board`, `--golf-radius-hud`, `--golf-radius-hud-small`, `--golf-radius-swatch` og `--golf-radius-meter`.
- *Glød og skygger i siden:* `--golf-board-glow`, `--golf-score-glow`, `--golf-points-glow`, `--golf-text-shadow` og `--golf-text-shadow-strong`.
  - Under `html[data-golf-gloed="fra"]` skal glød være `none` og `--golf-gloed` 0.
  - Spillet må ikke have brug for glød for at kunne aflæses.
- *Farveprøver i Indstillinger:* `.swatch[data-farver="…"]` med `--a`, `--b` og `--c`.

Tekster, mål, regler og layout hører ikke til temaet og er ens for alle temaer.

# Rørlægger

Del af **Hojt Arkade** af Jon Leismann Engsager / Hojt Design (MIT).
Spillet kører direkte fra `index.html` uden server og uden internet (også fra `file://`).

### Rørlægger
Et roligt rørpuslespil i ture. Der er intet ur og ingen tidspres.
På gitteret er der en **kilde** (cyan ring med en dråbe) og et **afløb** (ring med rist). De ligger fast og kan ikke drejes. Alle andre felter er rør: **lige**, **knæk**, **T** og **kryds**. Vælg et rør for at dreje det en kvart omgang med uret. Når du tror, at vandet kan løbe hele vejen, trykker du på **Luk vandet på**. Vandet løber så roligt felt for felt fra kilden.

- **Drej:** klik, tryk, ét dwell eller Enter drejer røret 90°. Et valg er altid én drejning. **Fortryd** giver den seneste drejning tilbage (også drejningen selv).
- **Drejninger:** hver bane har et begrænset antal drejninger: dem, banen mindst kræver, plus en buffer. Bufferen er 7 i bane 1 og falder til 2 fra bane 11.
- **Luk vandet på:** når vandet når afløbet, er banen klaret. Når det ikke gør, mister man et liv. Vandet bliver stående, så man kan se, hvor det stoppede, og man får bufferen igen, hvis man har færre drejninger tilbage. Man har **3 liv**, og hver 5. klarede bane giver et liv tilbage (højst 3). Når det sidste liv er brugt, er spillet slut.
- **Vis forbindelse** (til som standard): rør, der allerede hænger sammen med kilden, lyser svagt op, og teksten siger til, når der er vej til afløbet. Det kan slås fra under Indstillinger → Styring for en sværere udgave.
- **Baner uden ende:** alle baner laves tilfældigt og kan altid løses. Et tilfældigt udspændende træ over gitteret giver en sti fra kilde til afløb, og rørene drejes derefter tilfældigt. En bane er aldrig løst fra start. Stien bliver længere for hver bane. Gitteret er 4 × 4 fra bane 1, 5 × 5 fra bane 4 og 6 × 6 fra bane 9.
- **Størrelser efter skærmen:** en størrelse bruges kun, hvis felterne bliver mindst 80 px. 4 × 4 kan altid bruges. På 1024 × 768 og større gælder alle tre størrelser. På mobil (390 × 844 og 844 × 390) bliver banerne højst 4 × 4, og startskærmen siger det.
- **Point:** en klaret bane giver 10 point for hvert felt med vand, 5 for hver drejning til overs og 5 × banens nummer.
- **Tastatur:** piletasterne flytter markøren, Enter eller mellemrum drejer, V lukker vandet på, F eller Backspace fortryder, og Esc eller P giver pause.
- **Dwell** (valgfrit, slået fra som standard, med ring): hvert felt og hver knap vælges én gang. Der gentages aldrig, mens blikket bliver på den. Nye dialoger er dwell-sikre.
- **Alle skærme:** man skal aldrig rulle. Knapperne er mindst ca. 3 cm, når der er plads, og ellers mindst ca. 80 px.
- **Rekorder:** en lokal top 10 med point, antal klarede baner og dato.
- **Afslut:** fra pausen og fra **Bane klaret** spørger spillet først (**Nej, spil videre** har fokus, og Esc betyder Nej).
- **Rolig visning:** intet blinker. Når animation er slået fra, eller computeren er sat til mindre bevægelse, drejer rørene uden overgang, og vandet vises med det samme. **Glød** kan slås fra under Indstillinger → Udseende, og spillet kan aflæses lige så godt uden.
- **Test:**
  - `node rorlaegger/test/spillogik.test.js` tjekker drejning, brikkernes åbninger, vandets vej, 600 genererede baner (løselige, kontrolleret uafhængigt), sværhedsgrad, frø, størrelser, drejninger og Fortryd, liv, point, game over, et liv tilbage og 60 baner i træk.
  - `python3 rorlaegger/test/responsiv_test.py` (Playwright og Chrome) tjekker alle skærme ved 8 opløsninger: ingen rulning, knap- og feltstørrelser, spil med mus og tastatur, vand med fejl og med succes, Bane klaret, bekræftelsen, game over, rekorder, glød fra, dwell, mindre bevægelse og hallen. Skærmbilleder gemmes, når `RORLAEGGER_SKAERMBILLEDER=<mappe>` er sat.

## Filer

- `index.html` – skærmene (start, spil, pause, Bane klaret, game over, indstillinger, rekorder, Om).
- `js/logik.js` – spillogikken uden DOM og uden farver: brikker, drejning, vandets vej (BFS), generator, regler, point og runden.
- `js/tegn.js` – tegnelaget. Det bygger gitteret og opdaterer det ud fra spillets tilstand (kun læsning), og det kender ingen farver.
- `js/app.js` – skærme, styring (mus, tryk, tastatur, dwell), layout, lyd og indstillinger.
- `css/rorlaegger.css` – opbygning og mål. Ingen farver, glød, skygger, skrifttyper, stregtykkelser eller hjørner (de kommer fra temaet).
- `tema/neon/tema.css` og `tema/neon/grafik.js` – temaet (se nedenfor).
- Fælles moduler fra `../arkade/` (indstillinger, dwell, lyd, baggrund, rekorder og fælles stil).

## Temaet

Al grafik ligger i `tema/neon/`. Spilkoden henter den kun ved navn. Et nyt tema (fx Tegneserie, Papirklip, Art deco eller Ler) er derfor en ny mappe `tema/<navn>/` med de samme to filer, som `index.html` så peger på. Konturer, skygger og teksturer styres med variablerne, så et tema ikke er bundet til glød.

**`grafik.js`** sætter `window.RorlaeggerTema` med:

- `navn`.
- `brikker`: SVG-indhold i et 100 × 100-felt, i grundstilling (tegnelaget drejer dem). Følgende skal findes:
  - `lige` (åben mod nord og syd).
  - `knaek` (nord og øst).
  - `t` (nord, øst og syd).
  - `kryds` (alle fire).
  - `kilde` og `afloeb` (åbne mod nord).
- Brikkerne må bruge disse klasser (farver og streger kommer fra CSS):
  - `rl-ror-kant` (rørets yderkant).
  - `rl-ror` (røret).
  - `rl-flange` (samlingerne ved kanten).
  - `rl-vand` (vandet; vises, når feltet er vådt).
  - `rl-kilde` og `rl-kilde-ikon`.
  - `rl-afloeb` og `rl-afloeb-rist`.

  Et tema kan tilføje egne elementer (fx teksturer og mønstre) i brikkerne.
- `felt`: feltets bund (klassen `rl-felt-bund`).
- `ikoner`: SVG-indhold i et 100 × 100-felt, farvet med klasserne `ico-line` og `ico-fill`.
  - Ikonerne skal hedde `drej`, `vand`, `fortryd`, `liv`, `pause` og `tilbage`.
  - `js/tegn.js` lægger dem ind som `#rl-ikon-<navn>`, og brikkerne som `#rl-brik-<navn>`.

Brikkerne vises gennem `<use>`. Feltets tilstand gives derfor videre som arvede variabler (`--rl-s-ror`, `--rl-s-flange`, `--rl-s-vand`, `--rl-s-rist`, `--rl-s-felt` og `--rl-s-delay`), som `css/rorlaegger.css` sætter. Et tema kan bruge dem i sine egne elementer.

**`tema.css`** skal sætte disse CSS-variabler for hver farvepalet, som arkadens Tema-valg sætter med `[data-theme="neon|solnedgang|cyberpunk|kontrast"]`:

- *Farver:*
  - Brættet: `--rl-board`, `--rl-frame`, `--rl-grid`, `--rl-felt` og `--rl-felt-hover`.
  - Rørene: `--rl-ror`, `--rl-ror-kant`, `--rl-ror-forb`, `--rl-flange` og `--rl-flange-forb`.
  - Vandet: `--rl-vand`.
  - Kilde og afløb: `--rl-kilde`, `--rl-kilde-kant`, `--rl-kilde-ikon`, `--rl-afloeb`, `--rl-afloeb-kant`, `--rl-afloeb-rist` og `--rl-afloeb-vaad`.
  - Markør og tilstande: `--rl-cursor`, `--rl-ok` og `--rl-fejl`.
  - Liv: `--rl-drop` og `--rl-drop-off`.
  - Status og flader: `--rl-hud-bg`, `--rl-hud-border`, `--rl-overlay-bg`, `--rl-overlay-soft`, `--rl-hall-bg`, `--rl-hall-bg-hover` og `--rl-swatch-border`.
- *Streger og hjørner:*
  - Streger: `--rl-frame-w`, `--rl-grid-w`, `--rl-block-w`, `--rl-cursor-w`, `--rl-ror-kant-w`, `--rl-ror-w`, `--rl-vand-w`, `--rl-flange-kant-w`, `--rl-kilde-kant-w` og `--rl-rist-w`.
  - Rørenes ender og hjørner: `--rl-ror-ende` (linecap) og `--rl-ror-hjoerne` (linejoin).
  - Ikoner, liv og hallknap: `--rl-stroke-ico`, `--rl-stroke-drop-off`, `--rl-drop-off-dash`, `--rl-stroke-hall` og `--rl-hall-border-w`.
  - Hjørner: `--rl-radius-board`, `--rl-radius-felt`, `--rl-radius-flange`, `--rl-radius-hud`, `--rl-radius-hud-small` og `--rl-radius-swatch`.
- *Glød og skygger:* `--rl-board-glow`, `--rl-vand-glow`, `--rl-kilde-glow`, `--rl-afloeb-glow`, `--rl-drop-glow`, `--rl-score-glow`, `--rl-points-glow`, `--rl-text-shadow` og `--rl-text-shadow-strong`.
  - Under `html[data-rl-gloed="fra"]` skal de være `none`.
  - Spillet må ikke have brug for glød for at kunne aflæses.
  - Et tema uden glød, fx Tegneserie, sætter dem til `none` eller til en hård skygge.
- *Farveprøver i Indstillinger:* `.swatch[data-farver="…"]` med `--a`, `--b` og `--c`.

Tekster, mål og layout hører ikke til temaet og er ens for alle temaer.

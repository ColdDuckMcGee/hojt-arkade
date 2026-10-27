# Tårnene

Del af **Hojt Arkade** af Jon Leismann Engsager / Hojt Design (MIT).
Spillet kører direkte fra `index.html` uden server og uden internet (også fra `file://`).

### Tårnene
Et roligt tower defense-spil i ture for voksne. Der er intet ur og ingen tidspres.
Fjenderne går ad en fast sti fra **indgangen** (pil) til **målet** (firkant med pil). Man bygger tårne på felterne ved siden af stien i **byggefasen**, så længe man vil, og trykker så på **Start bølgen**. Bølgen kører derefter roligt af sig selv, og man skal ikke reagere på noget. Bølgerne har ingen ende og bliver sværere. Spillet slutter, når de 10 liv er brugt.

- **Byg:** vælg et tomt felt (klik, tryk, ét dwell eller Enter). Så kommer et stort panel med de fire tårne, deres pris og hvad de gør. Tårne, man ikke har råd til, er låst og siger, hvor meget der mangler. **Fortryd** lukker panelet.
- **Opgrader og sælg:** vælg et tårn, man har. Panelet viser niveau, skade og rækkevidde (rækkevidden vises også som en ring på banen). Et tårn har 3 niveauer. Salg giver 70 % tilbage. Et tårn, der er bygget eller opgraderet i samme byggefase, kan sælges for den fulde pris, så et fejlvalg med øjnene altid kan fortrydes.
- **Tårnene:**
  - **Laser** (10): skyder på den forreste fjende. Billig og god.
  - **Puls** (18): rammer alle fjender i rækkevidde på én gang.
  - **Frost** (14): gør alle fjender i rækkevidde langsommere (halv fart; niveau 3 gør også lidt skade).
  - **Kanon** (25): tungt skud langt væk, men kun hvert andet trin.
- **Fjenderne** kan skelnes på form, ikke kun på farve:
  - **Kugle** (cirkel): almindelig.
  - **Pil** (pil): hurtig, men svag. Fra bølge 3.
  - **Kasse** (firkant med plader): langsom og stærk. Fra bølge 4.
  - **Kæmpe** (sekskant med stjerne): hver 5. bølge. Koster 3 liv, hvis den slipper igennem.
  - Hver fjende har en livsbjælke. Fjender, der er gjort langsommere, får en anden kantfarve.
- **Bølgen** kører i trin. I hvert trin går fjenderne først (blødt glidende), og så skyder tårnene. Skud vises som faste streger og ringe resten af trinnet, så intet blinker.
  - **Hurtigere visning** viser bølgen hurtigere (ca. 0,4 s pr. trin i stedet for 0,9 s).
  - **Trin for trin** (Indstillinger → Styring): bølgen tager kun ét trin, når man trykker **Næste trin**. **Vis resten** kører resten af bølgen af sig selv.
- **Penge og point:** man starter med 40 penge. Hver nedkæmpet fjende giver penge (2–15) og point (10–100). En klaret bølge giver 5 + bølgens nummer i penge og 20 × bølgens nummer i point.
- **Sværhedsgrad:** bølge *n* har 3 + *n* fjender (højst 40), og deres liv stiger med ca. 15 % + 7 % pr. bølge. Et godt forsvar holder typisk til omkring bølge 15–25.
- **Baner efter skærmen:** der er faste baner på 8 × 5, 7 × 5, 6 × 4 og 4 × 6 felter (og 5 × 8 og 5 × 7 på høje skærme). Ved spillets start vælges den største bane, hvor felterne bliver mindst 100 px (ellers mindst 80 px). På 1920 × 1080 og 1366 × 768 bliver det 8 × 5, på mobil 6 × 4 (liggende) eller 4 × 6 (stående).
- **Tastatur:** piletasterne flytter markøren, Enter eller mellemrum vælger feltet (og knappen i panelet), S starter bølgen (eller tager næste trin), H skifter hurtigere visning, og Esc eller P giver pause. Esc lukker også panelerne.
- **Dwell** (valgfrit, slået fra som standard, med ring): et felt åbner panelet én gang og gentager ikke, mens blikket bliver. Knappen, der ligger under blikket, når et panel åbner, kan først vælges, når blikket har været væk fra den.
- **Alle skærme:** man skal aldrig rulle. Knapperne og felterne er mindst ca. 3 cm, når der er plads, og ellers mindst ca. 80 px. På stående skærme ligger knapperne under banen.
- **Rekorder:** en lokal top 10 med point, antal klarede bølger og dato.
- **Afslut:** fra pausen spørger spillet først (**Nej, spil videre** har fokus, og Esc betyder Nej). Pointene gemmes.
- **Rolig visning:** når animation er slået fra, eller computeren er sat til mindre bevægelse, vises bølgen som faste billeder trin for trin uden glidning. **Glød** kan slås fra under Indstillinger → Udseende, og spillet kan aflæses lige så godt uden.
- **Test:**
  - `node taarnene/test/spillogik.test.js` tjekker banerne og stien, skade og mål, frost, puls og kanon, økonomien (byg, opgrader, sælg og fortryd), penge og point, liv, bølgernes stigning, game over og at et godt forsvar taber til sidst på alle baner.
  - `python3 taarnene/test/responsiv_test.py` (Playwright og Chrome) tjekker alle skærme ved 8 opløsninger: ingen rulning, knap- og feltstørrelser, byg-, opgrader- og sælg-panelerne, tastatur, bølgen af sig selv og trin for trin, hurtigere visning, bekræftelsen, game over, rekorder, glød fra, dwell, mindre bevægelse og hallen. Skærmbilleder gemmes, når `TAARNENE_SKAERMBILLEDER=<mappe>` er sat.

## Filer

- `index.html` – skærmene (start, hjælp, spil med byg-, tårn- og pausepanel, game over, indstillinger, rekorder, Om).
- `js/logik.js` – spillogikken uden DOM og uden farver: baner, tårne, fjender, bølger, økonomi og trin.
- `js/tegn.js` – tegnelaget. Det bygger banen (SVG og knapper) og tegner tårne, fjender og skud ud fra spillets tilstand (kun læsning). Det kender ingen farver.
- `js/app.js` – skærme, styring (mus, tryk, tastatur, dwell), valg af bane, layout, bølgens afvikling, lyd og indstillinger.
- `css/taarnene.css` – opbygning og mål. Ingen farver, glød, skygger, skrifttyper, stregtykkelser eller hjørner (de kommer fra temaet).
- `tema/neon/tema.css` og `tema/neon/grafik.js` – temaet (se nedenfor).
- Fælles moduler fra `../arkade/` (indstillinger, dwell, lyd, baggrund, rekorder og fælles stil).

## Temaet

Al grafik ligger i `tema/neon/`. Spilkoden henter den kun ved navn. Et nyt tema (fx Tegneserie/ligne claire, Papirklip, Art deco eller Ler) er derfor en ny mappe `tema/<navn>/` med de samme to filer, som `index.html` så peger på. Konturer, skygger og teksturer styres med variablerne, så et tema ikke er bundet til glød.

**`grafik.js`** sætter `window.TaarneneTema` med:

- `navn`.
- `taarne`: SVG-indhold i et 100 × 100-felt for `laser`, `puls`, `frost` og `kanon`. Klasser (farver og streger kommer fra CSS): `tt-taarn-fod`, `tt-taarn-krop`, `tt-taarn-detalje` og `tt-taarn-kerne`. Tårnets farve gives som `--tt-s-taarn`.
- `fjender`: SVG-indhold i et 100 × 100-felt (centreret, mod øst) for `kugle`, `pil`, `kasse` og `kaempe`. De skal kunne skelnes på **form**. Klasser: `tt-fjende-krop` og `tt-fjende-detalje`. Farven gives som `--tt-s-fjende`.
- `niveau`: ét mærke for tårnets niveau (tegnes 1–3 gange), klassen `tt-niveau`.
- `indgang` og `maal`: markeringer, hvor stien starter og slutter (peger mod øst; tegnelaget drejer dem). Klasser `tt-indgang`, `tt-maal` og `tt-pil`.
- `felt`: bunden i et felt, man kan bygge på (klassen `tt-felt-bund`, farven som `--tt-s-felt`).
- `ikoner`: SVG-indhold i et 100 × 100-felt, farvet med klasserne `ico-line` og `ico-fill`. De skal hedde `boelge`, `hurtig`, `trin`, `pause`, `tilbage`, `liv`, `penge`, `opgrader`, `saelg`, `luk` og `byg`.

`js/tegn.js` lægger det hele ind som `<symbol>`: `#tt-taarn-<navn>`, `#tt-fjende-<navn>`, `#tt-ikon-<navn>`, `#tt-niveau`, `#tt-indgang`, `#tt-maal` og `#tt-felt`. Stien selv tegnes af tegnelaget som tre streger oven på hinanden (kant, sti og midterlinje). Et tema kan tilføje egne elementer (fx teksturer og mønstre) i symbolerne.

**`tema.css`** skal sætte disse CSS-variabler for hver farvepalet, som arkadens Tema-valg sætter med `[data-theme="neon|solnedgang|cyberpunk|kontrast"]`:

- *Farver:*
  - Banen: `--tt-board`, `--tt-frame`, `--tt-grid`, `--tt-felt`, `--tt-felt-hover` og `--tt-felt-valgt`.
  - Stien: `--tt-sti`, `--tt-sti-kant`, `--tt-sti-midte`, `--tt-indgang`, `--tt-maal` og `--tt-maal-fyld`.
  - Tårne: `--tt-taarn-fod`, `--tt-taarn-kant`, `--tt-taarn-kerne`, `--tt-taarn-laser`, `--tt-taarn-puls`, `--tt-taarn-frost`, `--tt-taarn-kanon`, `--tt-niveau` og `--tt-niveau-kant`.
  - Fjender: `--tt-fjende-kant`, `--tt-fjende-detalje`, `--tt-fjende-kugle`, `--tt-fjende-pil`, `--tt-fjende-kasse`, `--tt-fjende-kaempe`, `--tt-hp`, `--tt-hp-bund` og `--tt-saenket`.
  - Skud og rækkevidde: `--tt-skud-laser`, `--tt-skud-puls`, `--tt-skud-frost`, `--tt-skud-kanon`, `--tt-raekkevidde` og `--tt-raekkevidde-fyld`.
  - Markør og tilstande: `--tt-cursor`, `--tt-ok`, `--tt-fejl`, `--tt-penge` og `--tt-liv`.
  - Status og flader: `--tt-hud-bg`, `--tt-hud-border`, `--tt-menu-bg`, `--tt-overlay-bg`, `--tt-overlay-soft`, `--tt-hall-bg`, `--tt-hall-bg-hover` og `--tt-swatch-border`.
- *Streger og hjørner:*
  - Streger: `--tt-frame-w`, `--tt-grid-w`, `--tt-block-w`, `--tt-cursor-w`, `--tt-valgt-w`, `--tt-sti-w`, `--tt-sti-kant-w`, `--tt-sti-midte-w`, `--tt-sti-midte-dash`, `--tt-indgang-w`, `--tt-maal-w`, `--tt-taarn-kant-w`, `--tt-taarn-detalje-w`, `--tt-niveau-kant-w`, `--tt-fjende-kant-w`, `--tt-fjende-detalje-w`, `--tt-skud-w`, `--tt-skud-kanon-w`, `--tt-skud-ring-w`, `--tt-skud-ring-dash`, `--tt-raekkevidde-w` og `--tt-raekkevidde-dash`.
  - Stiens ender og hjørner: `--tt-sti-ende` (linecap) og `--tt-sti-hjoerne` (linejoin).
  - Ikoner og hallknap: `--tt-stroke-ico`, `--tt-stroke-hall` og `--tt-hall-border-w`.
  - Hjørner: `--tt-radius-board`, `--tt-radius-felt`, `--tt-radius-taarn-knap`, `--tt-radius-hud`, `--tt-radius-hud-small` og `--tt-radius-swatch`.
- *Teksturer:* `--tt-board-tekstur` og `--tt-felt-tekstur` (et `background-image`, fx et mønster til Papirklip eller Ler; `none` i Neon).
- *Glød og skygger:* `--tt-board-glow`, `--tt-taarn-glow`, `--tt-fjende-glow`, `--tt-skud-glow`, `--tt-sti-glow`, `--tt-maal-glow`, `--tt-score-glow`, `--tt-points-glow`, `--tt-text-shadow`, `--tt-text-shadow-strong`, `--tt-shadow`, `--tt-taarn-skygge`, `--tt-fjende-skygge` og `--tt-knap-skygge`.
  - Glød-variablerne skal være `none` under `html[data-tt-gloed="fra"]`.
  - Spillet må ikke have brug for glød for at kunne aflæses.
  - Skygge-variablerne (`*-skygge`) er til temaer med hårde skygger eller dybde (fx Tegneserie, Papirklip og Ler); de er `none` i Neon.
- *Farveprøver i Indstillinger:* `.swatch[data-farver="…"]` med `--a`, `--b` og `--c`.

Tekster, mål og layout hører ikke til temaet og er ens for alle temaer.

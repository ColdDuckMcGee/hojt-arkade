# Rumhandleren

Et roligt, turbaseret handelsspil til Højt Arkade. Der er ingen kamp, ingen tåge og intet tidspres. Du starter på Kepler med en lille Spurv, 2.500 cr og et lån på 6.000 cr. Hele stjernekortet med 12 planeter kan ses fra start. Du handler 8 varer mellem planeterne, køber flere skibe og sender dem ud på faste ruter, og du bygger miner, fabrikker og lagre. Hver 30. dag kommer en regning, der vokser (de første 90 dage er nemmere, se nedenfor). Kan du ikke betale den, går du konkurs, og spillet er slut. Ellers er spillet endeløst, og du kan selv gå på **pension**.

**Point = din nettoformue, når spillet slutter** (kredit − gæld + skibe, bygninger, lagre og last). Går du på **pension**, tæller hele nettoformuen. Går du **konkurs**, tæller kun **25 %** af den (og aldrig under 0). Det kan altså betale sig at stoppe i tide. Slutskærmen viser nettoformuen og hvor stor en del, der tæller, og top 10 viser *Pension* eller *Konkurs* ved hver score. Top 10 gemmes i arkadens fælles highscores (`ArkadeHighscores`, nøgle `rumhandleren`).

Spillet kører offline, også direkte fra `file://`. Det bruger ingen CDN og intet framework.

## Sådan spiller du

Der er seks faner. Tasterne `1`–`6` skifter mellem dem, og ingen af fanerne skal rulles. Lange lister vises i sider med Forrige og Næste.

* **Kort:** Vælg en planet for at se rejsetid (dage), brændstof, adgang, told og den bedste forventede fortjeneste med din last. **Flyv hertil** rejser ad den korteste vej. Hvert hop koster dage og brændstof, og brændstof købes på hver planet. Hvis regningen falder, mens du er undervejs, spørger spillet først. **Vent 1 dag** lader tiden gå.
* **Marked:** 8 varer: mad, vand, malm, metal, maskiner, medicin, luksus og glimmer. Hver planet laver nogle varer billigt og mangler andre. Dine egne køb hæver prisen, og dine salg sænker den. Priserne glider langsomt tilbage. Nyheder flytter priserne i en periode, fx brændstofmangel, høst eller strejke. Glimmer er forbudt nogle steder. Smugling kan give en bøde i tolden.
* **Skibe:** Køb flere skibe (Spurv, Pelikan og Hval, højst 8). Giv dem en **rute** mellem to planeter, så handler de selv hver dag. Du ser rutens forventede gevinst pr. måned og risiko. Flagskibet flyver du selv, og du kan skifte flagskib.
* **Bygninger:** **Miner** producerer en vare hver dag. **Fabrikker** laver en vare om til en dyrere. **Lagre** gemmer varer, som du kan hente. Alle bygninger har drift på regningen.
* **Kontrakter:** 3 fraktioner: Vega-unionen, Orion-kompagniet og Kantlauget. Lever en bestemt mængde varer til en planet inden fristen, og få betaling og omdømme. Højere omdømme giver rabat og lavere told, og det åbner de låste planeter.
* **Økonomi:** Viser næste regning med renter, afdrag, licens, drift og forsikring, og hvor mange point du får, hvis du går på pension nu. Her kan du afdrage, betale alt, låne mere (højst 40.000 cr) og slå forsikring til eller fra.

**Pirater:** Usikre hop er markeret med ⚠. Møder du pirater, vælger du mellem tre ting:
* **Betal** løsesummen.
* **Flygt.** Chancen vises. Mislykkes det, tager de halvdelen af lasten.
* **Forsikring.** Hvis du har forsikring, tager de hele lasten, og forsikringen udbetaler 80 % af dens værdi.

Et spil i gang gemmes automatisk og kan fortsættes fra startskærmen.

### Regningen og startperioden

Regningen for måned *m* er renter + afdrag + licens + drift (+ forsikring):
* **Renter:** 5 % af gælden.
* **Afdrag:** 250 cr × 1,2^(m − 4). Det trækkes fra gælden.
* **Licens:** 60 cr × m^1,7.
* **Drift:** for ekstra skibe og bygninger.

**Startperioden (dag 1–90):** De første 3 regninger (dag 30, 60 og 90) er **afdragsfri** og har **halv rente** (2,5 %). Afdraget begynder først ved regning 4 og starter på 250 cr. Før startperioden kom til, begyndte afdraget allerede ved regning 1. Startregningerne er derfor 210, 345 og 538 cr (+ drift) mod tidligere 610, 783 og 1.021 cr. Licensens vækst er uændret, så resten af spillet er lige så hårdt som før.

### Balancen (simulering)

`node test/simulering.js 100 1500` spiller 100 spil pr. robotstrategi i op til 1500 dage. Point for spil, der når 1500 dage, er nettoformuen på dag 1500. *+pension* er den samme strategi, men den går på pension, når en regning, den ikke kan betale, er under 10 dage væk.

| Strategi | Median dage | Konkurs dag 30 | Konkurs ≤ 180 | Konkurs ≤ 365 | Konkurs ≤ 730 | Pension | Nåede 1500 dage | Median point | Bedste |
|---|---|---|---|---|---|---|---|---|---|
| passiv (venter) | 150 | 0 % | 100 % | 100 % | 100 % | 0 % | 0 % | 0 | 0 |
| tilfældig | 30 | 92 % | 100 % | 100 % | 100 % | 0 % | 0 % | 0 | 0 |
| handel (kun flagskibet) | 870 | 2 % | 6 % | 6 % | 7 % | 0 % | 0 % | 3.471 | 5.607 |
| imperium (ruter, bygninger og kontrakter) | 1501 | 0 % | 12 % | 27 % | 30 % | 0 % | 69 % | 849.297 | 1.163.922 |
| handel + pension | 861 | 2 % | 2 % | 2 % | 2 % | 98 % | 0 % | 14.051 | 22.449 |
| imperium + pension | 1501 | 0 % | 9 % | 9 % | 9 % | 22 % | 69 % | 849.297 | 1.163.922 |

Før startperioden (samme pointregel, gammel regning): passiv døde median dag 120. Konkurs på dag 30: tilfældig 98 %, handel 7 %, imperium 5 %. Konkurs inden dag 180: handel 7 %, imperium 29 %. Imperium nåede 1500 dage i 62 % af spillene.

Hvis du ikke gør noget, går du stadig altid konkurs (nu ved dag 150). Fornuftig handel holder dig længe i live, men den voksende licens indhenter til sidst den, der kun handler med ét skib. Går den på pension i tide, får den ca. 4 gange så mange point. Et imperium er nødvendigt for at overleve i længden.

## Styring

* **Mus og touch:** Alle handlinger er store knapper på mindst 84 px. Planeterne på kortet kan vælges direkte. Dwell kan slås til under Indstillinger. Det er slået fra som standard, og knappen under blikket vælges ikke af sig selv.
* **Tastatur:**
  * `1`–`6` skifter fane.
  * På **kortet** vælger piletasterne planet, `Enter` flyver, og `V` venter en dag.
  * På **markedet** vælger piletasterne vare. `K` køber og `S` sælger. Med `Skift` handler du 5 ad gangen.
  * Piletasterne vælger skib eller kontrakt, og `Enter` tager eller leverer en kontrakt.
  * `Esc` eller `P` sætter på pause.
* Spillet er helt turbaseret. Intet blinker, og `prefers-reduced-motion` og arkadens animationsindstilling respekteres.

## Filer

```
rumhandleren/
  index.html              skærme og markup
  css/rumhandleren.css    layout (kun --rh-* og arkadens variabler; ingen farver)
  js/logik.js             ren spillogik uden DOM (RumhandlerenLogik; bruges også af testene)
  js/tegn.js              tegnelaget: kortet, planeter, skibe og ikoner ud fra temaets elementer
  js/lyd.js               spillets egne lyde (WebAudio); følger arkadens lyd- og lydstyrkeindstillinger
  js/app.js               skærme, faner, input, layout, gem/fortsæt og highscores
  tema/neon/tema.css      neon-temaets farver, glød, streger, radier og skrift (--rh-*)
  tema/neon/grafik.js     neon-temaets SVG-figurer (window.RumhandlerenTema)
  test/logik.test.js      logiktest (node)
  test/simulering.js      strategisimulering (node)
  test/responsiv_test.py  Playwright: 8 opløsninger, gameplay, dwell og hallen
```

Arkadens fælles moduler i `../arkade/` bruges uændret: indstillinger, highscores, dwell, lyd og baggrund.

## Hvad et tema skal levere

Et tema er en mappe `tema/<navn>/` med to filer. Logikken (`logik.js`) og layoutet (`rumhandleren.css`) kender intet til temaet.

1. **`tema.css`** sætter alle `--rh-*`-variabler på `:root`. Der må ikke stå farver, glød, skrifter, stregbredder eller radier andre steder. Variablerne er:
   * **Rum og kort:** `--rh-rum-1`, `--rh-rum-2`, `--rh-stjerne`, `--rh-gitter`, `--rh-taage`, `--rh-kort-bg`, `--rh-kort-valgt`, `--rh-kort-gloed`
   * **Planeter og fraktioner:** `--rh-planet-vega`, `--rh-planet-vega-kant`, `--rh-planet-orion`, `--rh-planet-kant`, `--rh-planet-detalje`, `--rh-planet-laast`, `--rh-planet-gloed`, `--rh-frak-vega`, `--rh-frak-orion`, `--rh-frak-kant`, `--rh-laas`, `--rh-her`, `--rh-valg`
   * **Navne:** `--rh-navn`, `--rh-navn-valgt`, `--rh-navn-kant`, `--rh-navn-w`
   * **Ruter og stier:** `--rh-rute`, `--rh-rute-1`, `--rh-rute-2`, `--rh-rute-streg-0/1/2`, `--rh-rute-w`, `--rh-sti`, `--rh-sti-w`, `--rh-ruteskib`, `--rh-ruteskib-sti`
   * **Skibe:** `--rh-skib`, `--rh-skrog`, `--rh-skrog-kant`, `--rh-vindue`, `--rh-motor`
   * **Markører:** `--rh-begivenhed`, `--rh-bygning`, `--rh-markoer-w`
   * **Varer og priser:** `--rh-vare`, `--rh-vare-forbudt`, `--rh-billig`, `--rh-dyr`, `--rh-kredit`, `--rh-kredit-gloed`
   * **Status:** `--rh-ok`, `--rh-fejl`, `--rh-advarsel`
   * **HUD, bjælker og overlays:** `--rh-hud-bg`, `--rh-hud-border`, `--rh-bar`, `--rh-bar-lav`, `--rh-bar-tom`, `--rh-overlay-bg`
   * **Streger og radier:** `--rh-kontur`, `--rh-kontur-w`, `--rh-streg-w`, `--rh-tegning-w`, `--rh-ikon-w`, `--rh-ikon-paa-fyld`, `--rh-block-w`, `--rh-frame-w`, `--rh-radius-hud`, `--rh-radius-kort`, `--rh-radius-bar`, `--rh-radius-swatch`, `--rh-swatch-border`
   * **Glød og skygge:** `--rh-gloed-filter`, `--rh-gloed-filter-accent`, `--rh-skygge`, `--rh-shadow`, `--rh-text-shadow`. De skal være `none`, når glød er slået fra under Indstillinger → Udseende (`data-rh-gloed="fra"` på `<html>`).
   * **Hal-knap og skrift:** `--rh-hall-bg`, `--rh-hall-bg-hover`, `--rh-hall-border-w`, `--rh-hall-ikon-w`, `--rh-font`, `--rh-tekstur-synlig`
2. **`grafik.js`** sætter `window.RumhandlerenTema = { navn, ikoner, varer, skibe, planeter, markoerer, rumMoenster }`. Det er SVG-strenge, som kun bruger `class="rh-…"`. Der står ingen farver i dem; farverne kommer fra `tema.css`.
   * **`ikoner`:** fane- og knapikoner (kort, marked, skibe, bygninger, kontrakter, gaeld, forfald, kredit, …)
   * **`varer`:** én figur for hver af de 8 varer
   * **`skibe`:** spurv, pelikan og hval
   * **`planeter`:** typerne (ringplanet, gasgigant, asteroide …)
   * **`markoerer`:** begivenhed og bygning
   * **`rumMoenster`:** `{ w, h, indhold }` til stjernebaggrunden
3. Et nyt tema tilføjes i `index.html` med en `<link>` og en `<script>`, og det skal kunne vælges under Indstillinger. Der er planlagt 5 temaer. v1 har kun **neon**.

Test et nyt tema med `test/responsiv_test.py`. Der må ikke være rulning, kontrasten skal være læselig, og det skal fungere med glød slået fra.

## Test

```
node test/logik.test.js                       # 32 logiktest
node test/simulering.js 100 1500              # strategisimulering (ca. 2 min)
python3 test/responsiv_test.py                # Playwright (Chrome); fra arkadens rodmappe
RUMHANDLEREN_SKAERMBILLEDER=<mappe> ...       # gemmer skærmbilleder
ONLY=1366x768 ...                             # kun én opløsning
```

## Senere versioner

* **Ruter med op til 4 stop:** Faste ruter er i dag mellem 2 planeter (A ↔ B). En senere version kan lade et skib køre en rundtur med op til 4 stop og købe og sælge ved hvert stop.

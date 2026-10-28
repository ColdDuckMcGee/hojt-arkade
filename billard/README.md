# Billard

Del af **Hojt Arkade** af Jon Leismann Engsager / Hojt Design (MIT).
Spillet kører direkte fra `index.html` uden server og uden internet (også fra `file://`).

### Billard
8-ball (pool) mod computeren, set oppefra og i ture. Der er intet ur og ingen tidspres.
Hvert stød: vælg **retning** og **kraft** med de store knapper, se **forhåndslinjen**, og tryk på **Stød**. Kuglerne ruller, stopper, og så er det næste stød. Vinder du partiet, fortsætter serien. Taber du et parti, er spillet slut.

- **Retning:** seks drejeknapper i tre par: **grov** (10°), **mellem** (1°) og **fin** (0,1°), hvert par mod og med uret og med sit eget ikon (stor bue med to pile, bue med én pil, lille bue med en prik). Under dwell bliver drejeknapperne ved med at dreje ét trin for hver dwell-tid, så længe blikket bliver der. Man kan også **klikke eller trykke på bordet** for at sigte lige derhen. Retningen vises som en pil og i grader med én decimal, fx 274,7° (0° = op på skærmen).
- **Næste kugle:** sigter på dine lovlige kugler én ad gangen (den letteste først). Med *Mod hul* (standard) sigtes der via spøgelseskuglen nær det letteste hul, men altid 2° ved siden af den perfekte linje (fast pr. kugle: ulige numre til den ene side, lige til den anden), så du selv skal finjustere. Kraften røres ikke. Med *Kuglens midte* sigtes der bare lige på kuglen. Der trækkes ingen point fra.
- **Kraft:** 1–10 med − og + og en måler med 10 streger. Kraften huskes fra stød til stød.
- **Stød:** ét klik, ét dwell eller Enter er ét stød. Under dwell kan Stød først vælges igen, når blikket har forladt knappen. Alle knapper er låst, mens kuglerne ruller, og mens computeren tænker og sigter.
- **Forhåndslinjen:** prikker fra stødbolden til den første kugle eller bande. Rammer den en kugle, vises spøgelseskuglen (hvor stødbolden står ved sammenstødet), objektkuglens retning (en pil, længere jo mere lige stødet er) og stødboldens retning bagefter. Rammer den en bande, vises retningen efter hoppet. Løber stødbolden direkte i hul, vises et kryds i en advarselsfarve. Dine lovlige kugler har en ring. Er du på 8'eren, og løber den direkte mod et hul, får hullet også en ring (man skal ikke melde hullet).
- **Fysik:** fast tidsskridt og helt deterministisk (samme stød giver altid samme resultat). Rullefriktion, elastiske stød mellem kugler, bander med lidt tab og 6 huller med åbninger i banderne (hjørner lidt bredere end midterhullerne). Ingen effekt (spin), og kuglerne kan ikke hoppe.
- **Regler (forenklet 8-ball):**
  - Den, der først nedlægger en kugle med et lovligt stød (også på åbningsstødet), får den gruppe: **hele** (1–7) eller **halve** (9–15, med stribe). Indtil da er bordet åbent, og man må ramme en hel eller en halv først (ikke 8'eren).
  - Nedlægger man en af sine egne, støder man igen. Ellers går turen videre.
  - **Banderegel:** når stødbolden har ramt sin første (lovlige) kugle, skal en kugle gå i hul, eller en kugle (stødbolden eller en objektkugle) ramme en bande. Ellers er det fejlstød. Sænker du kraften til 3 eller mindre, minder statuslinjen om reglen.
  - **Fejlstød:** stødbolden rammer ingen kugle, rammer først en forkert kugle (modstanderens eller 8'eren for tidligt), går i hul, eller banderegel brydes. Modstanderen får **kuglen i hånden**. Har du kuglen i hånden, lægges den automatisk på det bedste sted, og **Flyt** skifter mellem de 6 bedste steder og bagfeltets punkt. Computeren vælger selv sit sted. Går stødbolden i hul uden fejl (kan ikke ske), eller er der intet frit sted, kommer den op på bagfeltets punkt.
  - **8'eren** (sort med hvid talcirkel, lys kant og en ring) skal nedlægges til sidst. **Partiet slutter, så snart 8'eren er i hul:** lovligt, efter at ens egne kugler er nedlagt, vinder man. Går den i hul, før ens egne kugler er nedlagt, eller med et fejlstød, taber man. Modstanderens resterende kugler bliver bare liggende. Spillet skriver tydeligt "8'eren er i hul – partiet er vundet/tabt". Går 8'eren i hul på åbningsstødet, sættes den op igen.
  - Den, der slår op, skifter fra parti til parti (du slår op i parti 1).
- **Computeren:** prøver kandidatstød (hver af sine kugler mod hvert hul og et udvalg af kræfter) med samme fysik som spillet, giver dem point for nedlagte kugler, fejlstød (også banderegel) og hvor stødbolden ender, og vælger blandt de bedste med lidt støj på retningen:
  - **Rolig** (point × 1): få kandidater, vælger tit et af de 3 bedste og har mest støj.
  - **Normal** (point × 2): flere kandidater, lidt støj, og tænker lidt på næste stød.
  - **Svær** (point × 3): flest kandidater, tænker på næste stød, og næsten ingen støj.
- **Point:** hver af dine egne kugler giver 10 × niveau, og et vundet parti 100 × niveau. Computerens kugler giver ingen point.
- **Tastatur:** pil venstre/højre drejer 1° (med Skift 10°, med Alt eller Ctrl 0,1°), pil op/ned ændrer kraften, N er Næste kugle, F flytter kuglen i hånden, Enter, mellemrum eller S støder, og Esc eller P giver pause.
- **Dwell** (valgfrit, slået fra som standard, med ring). Nye dialoger er dwell-sikre: en knap, der dukker op lige under blikket, kan først vælges, når blikket har været væk.
- **Alle skærme:** man skal aldrig rulle. Knapperne er mindst ca. 3 cm, når der er plads, og ellers mindst ca. 80 px. Spillet vælger det layout, der giver det største bord: status til venstre og knapper til højre på brede skærme, knapperne ved siden af på lave skærme (på meget lave skærme, fx mobil på langs, står status under bordet og alle knapper i 4 kolonner ved siden af) og knapperne under bordet på højkant. Bordet drejes på højkant, når det giver et tydeligt større bord. Kuglernes tal drejes med, så de altid står op.
- **Rekorder:** en lokal top 10 pr. niveau (Rolig, Normal, Svær) med point, vundne partier, nedlagte kugler og dato.
- **Afslut:** fra pausen og fra **Parti vundet!** spørger spillet først (**Nej, spil videre** har fokus, og Esc betyder Nej). Pointene gemmes. Lukkes siden midt i et spil, gemmes de også.
- **Rolig visning:** intet blinker. Når animation er slået fra, eller computeren er sat til mindre bevægelse, står kuglerne straks, hvor de stopper. **Glød** kan slås fra under Indstillinger → Udseende, og spillet kan aflæses lige så godt uden.
- **Uden farver:** kuglerne kan kendes fra hinanden uden farver: alle har tal, de halve har en hvid kugle med en bred stribe, og 8'eren er sort med en hvid talcirkel, en lys kant og en ring, så den ses tydeligt på filten (også uden glød og i høj kontrast). Hvis tur ses både på en tykkere kant og et ▶ ved navnet.
- **Test:**
  - `node billard/test/spillogik.test.js` tjekker rul og friktion, deterministisk fysik, lige og skrå sammenstød, bander, at ingen kugle forsvinder ud af bordet eller ligger oven i en anden, hjørne- og midterhuller, forhåndslinjen (også at den er enig med fysikken), alle regler (grupper, fejlstød, banderegel, 8'eren, åbningsstødet), at partiet slutter, så snart 8'eren er i hul (vundet eller tabt, for både dig og computeren, med andre kugler tilbage på bordet), at alle 15 kugler og stødbolden er med ved start, drejning i trin på 0,1°, markering af 8'erens hul, serien (Næste kugle sigter tæt på, men aldrig perfekt, og ændrer ikke kraften, kuglen i hånden og Flyt, point pr. niveau, tabt parti) og computeren (rammer lette stød, vælger selv et sted, Svær vinder over Rolig, et helt parti spilles færdigt).
  - `node billard/test/temaklar.test.js` tjekker, at logik, computer, tegnelag, app, markup og layout-CSS ikke har farver eller grafik, og at temaet leverer alle navngivne elementer og variabler.
  - `python3 billard/test/responsiv_test.py` (Playwright og Chrome) tjekker alle skærme ved 8 opløsninger: ingen rulning, knapstørrelser, spil med knapper (alle seks drejeknapper, 0,1°-trin og retning med én decimal), tastatur (også Alt/Ctrl+pil) og klik på bordet, at alle 16 kugler (også 8'eren) tegnes ved start, beskeden når 8'eren er i hul, Næste kugle, åbningsstødet, computerens tur, pause, fejlstød og Flyt, parti vundet, bekræftelsen, Næste parti, tabt parti og game over, rekorder pr. niveau, glød fra, dwell, mindre bevægelse og hallen. Skærmbilleder gemmes i `BILLARD_SKAERMBILLEDER` (standard `/workspace/billard/screenshots/`).

## Filer

- `index.html` – skærmene (start, spil, pause, Parti vundet!, bekræft, game over, indstillinger, rekorder, Om).
- `js/logik.js` – spillogikken uden DOM og uden farver: bordet, fysik, forhåndslinje, regler, kandidatstød, point og serien.
- `js/ai.js` – computeren (kandidatstød simuleret med samme fysik + støj pr. niveau).
- `js/tegn.js` – tegnelaget på canvas. Det læser kun spillets tilstand, henter alle mål og farver fra temaets CSS-variabler og kalder temaets tegnefunktioner. Det drejer bordet på højkant og animerer et stød ud fra fysikkens billeder.
- `js/app.js` – skærme, ture, styring (knapper, mus, tryk, tastatur, dwell), layout, lyd og indstillinger.
- `css/billard.css` – opbygning og mål. Ingen farver, glød, skygger eller skrifttyper (de kommer fra temaet eller arkadens fælles tema).
- `tema/neon/tema.css` og `tema/neon/grafik.js` – temaet (se nedenfor).
- Fælles moduler fra `../arkade/` (indstillinger, dwell, lyd, baggrund, rekorder og fælles stil).

## Temaet

Al grafik ligger i `tema/neon/`. Spilkoden henter den kun ved navn. Et nyt tema (fx Tegneserie, Papirklip, Art deco eller Ler) er en ny mappe `tema/<navn>/` med de samme to filer, som `index.html` så peger på. Konturer, skygger og mønstre har deres egne variabler, så et tema ikke er bundet til glød.

**`grafik.js`** sætter `window.BillardTema` med:

- `navn`.
- `farver`, `tekster` og `tal`: listerne over de variabler, temaet bruger. `js/tegn.js` læser `--billard-<navn>` for hver af dem og giver værdierne videre i objektet `s` (tal som tal).
- `tegn`: tegnefunktioner på canvas, i bordets enheder (spillefladen er 1000 × 500, kuglerne har radius 12; tegnelaget har allerede skaleret og evt. drejet). Følgende skal findes:
  - `bord(ctx, b, s)` (rammen uden om filten), `filt(ctx, b, s)` (spillefladen med bagfeltets linje), `hul(ctx, {x, y, r, kind}, s)` (`kind` er `'hjoerne'` eller `'midte'`) og `bande(ctx, b, s)` (banderne med åbninger ved hullerne). `b` er `{W, H, M, head, foot, mc, mm}` (M = rammens bredde, `mc`/`mm` = halve åbninger ved hjørne- og midterhuller).
  - `kugle(ctx, {x, y, r, nr, type, rot}, s)`: `type` er `'stoed'`, `'hel'`, `'halv'` eller `'otte'`. Tallet skal drejes med `rot`, så det står op på skærmen. Halve kugler skal have en stribe, og alle kugler (undtagen stødbolden) et tal, så de kan kendes uden farver.
  - `maal(ctx, {x, y, r}, s)` (ring om dine lovlige kugler og om hullet, 8'eren er på vej mod), `haand(ctx, {x, y, r}, s)` (kuglen i hånden) og `koe(ctx, {x, y, r, aim, power}, s)`.
  - `sigte(ctx, v, s)`: forhåndslinjen. `v` er `{from, to, aim, r, hit}`, og `hit` er `{type: 'kugle', id, ghost, ball, obj, objLen, cue, cueLen, pocket}` (`pocket` er hullets nummer, hvis objektkuglen løber direkte mod et hul, ellers `null`), `{type: 'bande', side, refl}` eller `{type: 'hul', pocket}`.
  - Et tema må tegne, hvad det vil, inden for disse rammer, men intet må være nødvendigt for at kunne aflæse spillet ud over form, tal og striber.
- `ikoner`: SVG-indhold i et 100 × 100-felt, farvet med klasserne `ico-line` og `ico-fill`. De skal hedde `drej-venstre-grov`, `drej-hoejre-grov`, `drej-venstre`, `drej-hoejre` (mellem), `drej-venstre-fin`, `drej-hoejre-fin`, `kraft-ned`, `kraft-op`, `stoed`, `naeste`, `flyt`, `pause`, `tilbage`, `pil` (retningsviseren, peger op) og `kugle`. `js/tegn.js` lægger dem ind som `#billard-ikon-<navn>`.

**`tema.css`** skal sætte disse CSS-variabler for hver farvepalet, som arkadens Tema-valg sætter med `[data-theme="neon|solnedgang|cyberpunk|kontrast"]`:

- *Bordets farver* (til canvas): `--billard-bord`, `-bord-2`, `-bord-kant`, `-diamant`, `-filt`, `-filt-2`, `-filt-moenster`, `-linje`, `-bande`, `-bande-kant`, `-hul`, `-hul-kant`, `-kugle-1` … `-kugle-15`, `-kugle-stoed`, `-kugle-hvid`, `-kugle-tal`, `-kugle-tal-bund`, `-kugle-kant`, `-kugle-glans`, `-otte-ring`, `-otte-kant` (8'erens lyse kant), `-maal`, `-haand`, `-koe`, `-koe-2`, `-koe-spids`, `-sigte`, `-sigte-spoegelse`, `-sigte-obj`, `-sigte-stoed`, `-sigte-advarsel`, `-gloed-farve`, `-skygge-farve` og `-kontur`.
- *Skrift:* `--billard-skrift` (kuglernes tal).
- *Bordets tal* (i bordets enheder): `--billard-bord-radius`, `-bord-kant-w`, `-bande-w`, `-bande-kant-w`, `-diamant-r`, `-linje-w`, `-moenster-w`, `-moenster-afstand`, `-hul-kant-w`, `-kugle-kant-w`, `-kugle-tal-str`, `-kugle-tal-bund-r`, `-otte-kant-w`, `-otte-ring-w`, `-otte-tal-bund-r`, `-stribe`, `-glans`, `-maal-w`, `-haand-w`, `-sigte-w`, `-sigte-prik`, `-sigte-afstand`, `-koe-w`, `-koe-laengde`, `-koe-afstand` og `-kontur-w`.
- *Glød og skygge på bordet:* `--billard-gloed` (styrke, 0 = ingen), `-gloed-blur`, `-skygge-x`, `-skygge-y` og `-skygge-blur`.
- *Fladerne omkring:* `--billard-ok`, `-fejl`, `-sigte`, `-hud-bg`, `-hud-border`, `-hud-tur`, `-meter`, `-meter-tom`, `-overlay-bg`, `-overlay-soft`, `-hall-bg`, `-hall-bg-hover`, `-hall-kant` og `-swatch-border`.
- *Streger og hjørner:* `--billard-frame-w`, `-block-w`, `-stroke-ico`, `-stroke-hall`, `-hall-border-w`, `-radius-board`, `-radius-hud`, `-radius-hud-small`, `-radius-swatch` og `-radius-meter`.
- *Glød og skygger i siden:* `--billard-board-glow`, `-score-glow`, `-points-glow`, `-text-shadow` og `-text-shadow-strong`.
  - Under `html[data-billard-gloed="fra"]` skal glød være `none` og `--billard-gloed` 0.
  - Spillet må ikke have brug for glød for at kunne aflæses.
- *Farveprøver i Indstillinger:* `.swatch[data-farver="…"]` med `--a`, `--b` og `--c`.

Tekster, mål, regler, fysik og layout hører ikke til temaet og er ens for alle temaer.

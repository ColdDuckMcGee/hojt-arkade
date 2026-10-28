# Rampen

Del af **Hojt Arkade** af Jon Leismann Engsager / Hojt Design (MIT).
Spillet kører direkte fra `index.html` uden server og uden internet (også fra `file://`).

### Rampen
En lille, dårlig bil sendes ud over en rampe. Den flyver, hopper, samler mønter og støder ind i ting, til den holder stille. Afstanden og mønterne bliver til opgraderinger i værkstedet, og bilen går fra sæbekassebil til raketbil. Der er intet ur, ingen timing og ingen hurtige reaktioner: **spillet fryser**, hver gang der skal vælges.

- **Opsendelse:** vælg **vinkel** (10–70°, knapper −5°, −1°, +1° og +5°) og **kraft** (1–10, − og + med en måler). En prikket linje viser det første hop, og hvor bilen lander. **Send afsted** sender bilen. Vinkel og kraft huskes.
- **Beslutningspunkter ("Boost nu?"):** bilen stopper helt på **toppen af et hop** (mindst 3 m oppe) og **lige før en landing** (efter et rigtigt hop), men kun når der er noget at vælge, altså et boost tilbage eller vinger. Banen viser to landinger: **Vent** (gul, prikket) og **Boost** (cyan). **Ja, boost** tænder raketten i 1,2 s, og **Vent** kører videre uden. Med **vinger** vælger man også næsen: **op** svæver længere men lander hårdere, **ned** giver et kortere hop men en blød landing, der bevarer farten. Begge linjer følger næsevalget.
- **Turen:** bilen kører, til den holder stille eller er smadret (0 %). Så vises **turens resultat** (det, der svarer til "game over"): afstand, mønter (afstand, samlet op, zonebonus og mål) og evt. rekord. Herfra går man til **værkstedet**, **kører igen** eller går til menuen. Der er ingen grænse for antal ture.
- **Ting på banen:**
  - Gode: **trampolin** (sender bilen op igen uden skade), **ballon** (løfter), **vindstød** (skubber frem og op), **rampe** (nyt hop), **olie** (ruller længere), **mønter** (5 pr. stk.) og **brændstofdunk** (+10 mønter og +1 boost).
  - Dårlige: **sten** (meget skade, bremser), **kaktus** (skade) og **kegle** (lidt skade, lidt bremse). Hårde landinger giver også skade.
  - Der er en forhindring i hvert andet stykke bane (50 m). Banen er den samme hver gang for samme bil, så man kan lære den.
- **Zoner:** Forstaden (0 m), Ørkenen (250 m), Bjergene (700 m), Skyerne (1300 m, lettere tyngdekraft) og Rummet (2200 m, endnu lettere). Hver zone har sine egne ting og farver og giver en **førstegangsbonus** (60/150/350/800 mønter).
- **Mål:** tre små mål er i gang ad gangen (fx "Nå 100 m", "Hop på en trampolin", "Nå 500 m uden boost"). Klarede mål giver mønter, og så kommer det næste. Efter listen kommer der flere afstandsmål uden ende.
- **Værkstedet:** otte opgraderinger i flere niveauer. Priserne stiger for hvert niveau:
  - **Motor** (8): hurtigere ud over rampen.
  - **Dæk** (6): ruller længere og hopper bedre.
  - **Karrosseri** (6): flere liv og mindre skade.
  - **Aerodynamik** (6): mindre luftmodstand.
  - **Vinger** (5): mere opdrift og næsevalget.
  - **Raket** (5): kraftigere boost.
  - **Brændstof** (4): ét boost mere pr. tur. Alle har ét boost fra start.
  - **Faldskærm** (4): tager en del af hårde landinger (folder sig ud af sig selv).
  - Bilen skifter udseende efter det samlede antal niveauer: **sæbekassebil → boblebil → sportsvogn → raketbil**, med vinger, raket og faldskærm, når de er købt.
- **Ny bil (prestige):** når den længste tur er mindst 1000 m, kan man tage en **ny bil**. Alt starter forfra (mønter og opgraderinger), men hver ny bil giver **+25 % mønter** på alle ture, for altid, og en ny bane. Spillet spørger først (**Nej** har fokus, og Esc betyder Nej).
- **Rekorder:** lokal top 10 for **længste tur** og top 10 for **biler** (en bils samlede meter, når man tager en ny bil).
- **Fremskridt** gemmes i `localStorage` (`hojtArkade.rampen.fremskridt`) efter hver tur, hvert køb og når siden lukkes. Lukkes siden midt i en tur, spoles turen færdig (uden flere boost) og gemmes.
- **Mens bilen kører:** **Hurtigere/Roligere** skifter fart, og **Spring frem** går direkte til næste beslutning (eller turens slut). Standardfarten (Rolig eller Hurtig) vælges under Indstillinger → Styring. Pausen har **Spol til slut**, som kører resten af turen uden flere boost.
- **Tastatur:** før opsendelsen ændrer pil op/ned vinklen (med Skift 5°), og pil venstre/højre ændrer kraften. Enter eller mellemrum sender bilen. Ved "Boost nu?" er J Ja og V eller N Vent, og pil op/ned flytter næsen. Mens bilen kører, skifter H farten, og Enter eller mellemrum springer frem. Esc eller P giver pause.
- **Dwell** (valgfrit, slået fra som standard, med ring). Beslutningsknapperne er dwell-sikre: knapper, der dukker op lige under blikket, kan først vælges, når blikket har været væk. Vinkel- og kraftknapperne gentager under dwell.
- **Alle skærme:** man skal aldrig rulle. Knapperne er mindst ca. 3 cm, når der er plads, og ellers mindst ca. 80 px. Spillet vælger det layout, der giver den største bane: knapperne ved siden af på brede og lave skærme og under banen på højkant.
- **Rolig visning:** intet blinker. Kameraet følger bilen roligt. Når animation er slået fra, eller computeren er sat til mindre bevægelse, vises hvert stykke af turen straks med sporet efter sig. **Glød** kan slås fra under Indstillinger → Udseende.
- **Test:**
  - `node rampen/test/spillogik.test.js` tjekker fysikken (deterministisk), skade og faldskærm, alle ting på banen, at banen har forhindringer i alle zoner, beslutningspunkter, at Vent-linjen passer med det, der sker, boost og næsevalg, priser og køb, zoner og mål, Ny bil, rensning af gemte data og balancen (en simpel spiller når skyerne, og en fuld bil når rummet).
  - `python3 rampen/test/responsiv_test.py` (Playwright og Chrome) tjekker alle skærme ved 8 opløsninger: ingen rulning, knapstørrelser, overlap, tekst i knapperne, spil med knapper og tastatur, at spillet står stille ved beslutninger, næsevalg, boost, turens resultat, rekord og gemt fremskridt, værkstedet, Ny bil, pause, glød fra, dwell, mindre bevægelse og hallen. Skærmbilleder gemmes, når `RAMPEN_SKAERMBILLEDER=<mappe>` er sat.

## Filer

- `index.html` – skærmene (start, spil, pause, turens resultat, værksted, ny bil, indstillinger, rekorder, Om).
- `js/logik.js` – spillogikken uden DOM og uden farver: fysik (fast tidsskridt 1/60 s, deterministisk), banen, beslutningspunkter, forhåndslinjer, opgraderinger, zoner, mål, Ny bil og gemte data.
- `js/tegn.js` – tegnelaget på canvas (kamera, animation og billeder af bilen). Det læser kun spillets tilstand, henter alle mål og farver fra temaets CSS-variabler og kalder temaets tegnefunktioner.
- `js/app.js` – skærme, styring (knapper, mus, tryk, tastatur, dwell), layout, lyd, indstillinger og gemte data.
- `css/rampen.css` – opbygning og mål. Ingen farver, glød, skygger, skrifttyper, stregtykkelser eller hjørner (de kommer fra temaet).
- `tema/neon/tema.css` og `tema/neon/grafik.js` – temaet (se nedenfor).
- Fælles moduler fra `../arkade/` (indstillinger, dwell, lyd, baggrund, rekorder og fælles stil).

## Temaet

Al grafik ligger i `tema/neon/`. Spilkoden henter den kun ved navn. Et nyt tema (Tegneserie – ligne claire, Papirklip, Art deco eller Ler) er en ny mappe `tema/<navn>/` med de samme to filer, som `index.html` så peger på. Konturer og skygger har deres egne variabler, så et tema ikke er bundet til glød: Tegneserie kan bruge sort kontur (`--rampen-kontur-w`, `--rampen-kontur`) og ingen glød, Papirklip og Ler en hård skygge (`--rampen-skygge-*`), Art deco tynde streger og guld.

**`grafik.js`** sætter `window.RampenTema` med:

- `navn`, `zoner` (`forstad`, `oerken`, `bjerge`, `skyer`, `rummet`) og `biler` (`saebekasse`, `folkevogn`, `sportsvogn`, `raketbil`; boblebilen hedder `folkevogn` i koden).
- `farver` og `tal`: listerne over de variabler, temaet bruger. `js/tegn.js` læser `--rampen-<navn>` for hver af dem (og `--rampen-font`) og giver værdierne videre i objektet `s`.
- `tegn`: tegnefunktioner på canvas `(ctx, data, v, s)`, hvor `v` er visningen (`v.sx(x)`, `v.sy(y)` fra meter til pixel, `v.k` pixel pr. meter). Følgende skal findes:
  - Baggrund: `himmel` (to farver pr. zone, blandet ved zonegrænser), `kulisse` (huse, kaktusser, bjerge, skyer, stjerner – parallakse), `jord` (pr. zone), `maaler` (afstandsmærker) og `milepael` (zonegrænser med navn).
  - `startrampe`.
  - Ting: `trampolin`, `rampe`, `olie`, `sten`, `kaktus`, `kegle`, `ballon`, `vind`, `moent` og `bonus` (brændstofdunk).
  - `bil` med `x`, `y`, `vinkel` (radianer), `type` (en af `biler`), `vinger`, `raket`, `flamme` (boost tændt), `skaerm` (faldskærm ude) og `naese`.
  - `spor` (vejen bag bilen), `forhaand` (forhåndslinje; `med` = boost) og `landing` (kryds med tekst).
  - Intet må være nødvendigt for at aflæse spillet ud over form og placering.
- `ikoner`: SVG-indhold i et 100 × 100-felt, farvet med klasserne `ico-line` og `ico-fill`. `js/tegn.js` lægger dem ind som `#rampen-ikon-<navn>`. Ikonerne skal hedde:
  - `vinkel-op`, `vinkel-ned`, `kraft-op`, `kraft-ned`, `send`, `boost`, `vent`, `naese-op`, `naese-lige`, `naese-ned`, `fortsaet`, `hurtig`, `rolig`, `spring`, `pause`, `tilbage`, `moent`, `vaerksted` og `bil`.
  - Ét pr. opgradering: `motor`, `daek`, `karrosseri`, `aero`, `vinger`, `raket`, `braendstof` og `faldskaerm`.

**`tema.css`** skal sætte disse CSS-variabler for hver farvepalet, som arkadens Tema-valg sætter med `[data-theme="neon|solnedgang|cyberpunk|kontrast"]`:

- *Zonerne:* `--rampen-himmel-<zone>-1`, `--rampen-himmel-<zone>-2`, `--rampen-jord-<zone>`, `--rampen-jord-<zone>-kant`, `--rampen-kulisse-<zone>` og `--rampen-kulisse-<zone>-2` for alle fem zoner.
- *Ting og bil:* `--rampen-rampe`, `--rampen-rampe-kant`, `--rampen-trampolin`, `--rampen-trampolin-dug`, `--rampen-rampe-ting`, `--rampen-olie`, `--rampen-sten`, `--rampen-sten-kant`, `--rampen-kaktus`, `--rampen-kegle`, `--rampen-kegle-stribe`, `--rampen-ballon`, `--rampen-ballon-snor`, `--rampen-vind`, `--rampen-moent`, `--rampen-moent-kant`, `--rampen-bonus`, `--rampen-bonus-kant`, `--rampen-bil-krop`, `--rampen-bil-krop-2`, `--rampen-bil-kant`, `--rampen-bil-rude`, `--rampen-hjul`, `--rampen-hjul-nav`, `--rampen-vinge`, `--rampen-raket`, `--rampen-flamme`, `--rampen-flamme-kerne`, `--rampen-skaerm` og `--rampen-skaerm-snor`.
- *Linjer og tekst på banen:* `--rampen-spor`, `--rampen-forhaand-uden`, `--rampen-forhaand-med`, `--rampen-forhaand-start`, `--rampen-landing`, `--rampen-maaler`, `--rampen-milepael`, `--rampen-tekst`, `--rampen-tekst-kant`, `--rampen-kontur`, `--rampen-gloed-farve` og `--rampen-skygge-farve`.
- *Tal på banen* (pixel): `--rampen-kontur-w`, `--rampen-streg-w`, `--rampen-forhaand-w`, `--rampen-spor-w`, `--rampen-jord-kant-w`, `--rampen-tekst-str` og `--rampen-radius`; skrift: `--rampen-font`.
- *Glød og skygge på banen:* `--rampen-gloed` (styrke, 0 = ingen), `--rampen-gloed-blur`, `--rampen-skygge-x`, `--rampen-skygge-y` og `--rampen-skygge-blur`.
- *Fladerne omkring:* `--rampen-ok`, `--rampen-fejl`, `--rampen-moent-tekst`, `--rampen-hp`, `--rampen-hp-lav`, `--rampen-shadow`, `--rampen-hud-bg`, `--rampen-hud-border`, `--rampen-meter`, `--rampen-meter-tom`, `--rampen-overlay-bg`, `--rampen-overlay-soft`, `--rampen-hall-bg`, `--rampen-hall-bg-hover` og `--rampen-swatch-border`.
- *Streger og hjørner:* `--rampen-frame-w`, `--rampen-block-w`, `--rampen-stroke-ico`, `--rampen-stroke-hall`, `--rampen-hall-border-w`, `--rampen-radius-board`, `--rampen-radius-hud`, `--rampen-radius-hud-small`, `--rampen-radius-swatch` og `--rampen-radius-meter`.
- *Glød og skygger i siden:* `--rampen-board-glow`, `--rampen-score-glow`, `--rampen-points-glow`, `--rampen-text-shadow` og `--rampen-text-shadow-strong`.
  - Under `html[data-rampen-gloed="fra"]` skal glød være `none` og `--rampen-gloed` 0.
  - Spillet må ikke have brug for glød for at kunne aflæses.
- *Farveprøver i Indstillinger:* `.swatch[data-farver="…"]` med `--a`, `--b` og `--c`.

Tekster, regler, mål og layout hører ikke til temaet og er ens for alle temaer.

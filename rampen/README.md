# Rampen

Del af **Hojt Arkade** af Jon Leismann Engsager / Hojt Design (MIT).
Spillet kører direkte fra `index.html` uden server og uden internet (også fra `file://`).

### Rampen
En lille, dårlig bil sendes ud over en rampe. Den flyver, hopper, samler mønter og støder ind i ting, til den holder stille. Afstanden og mønterne bliver til opgraderinger i værkstedet, og bilen går fra sæbekassebil til raketbil. Der er intet ur, ingen timing og ingen hurtige reaktioner: **spillet fryser**, hver gang der skal vælges.

- **Opsendelse:** vælg **vinkel** (10–70°, knapper −5°, −1°, +1° og +5°) og **kraft** (1–10, − og + med en måler). En prikket linje viser **kun starten af buen** (under 30 m) og **ingen landing**. **Send afsted** sender bilen. Vinkel og kraft huskes.
- **Skjult vind:** hver tur har sin egen **vind** (en grundvind frem/tilbage og op/ned) og **vindstød** langs banen. De er deterministiske (ud fra turens frø), men **skjulte**: spilleren ser dem aldrig direkte. Derfor kan ingen sige præcis, hvor bilen lander. Bilens instrumenter giver et skøn over vinden, og det skøn er forskudt med en skjult fejl pr. beslutning, så det rigtige udfald reelt varierer inden for feltet.
- **Usikkert landingsfelt:** på toppen af hvert hop viser banen et **felt** pr. valgkort ("1: ca. 60–90 m"), et stiplet bånd på jorden. Feltet regnes ud med det skønnede vindspænd (ni gennemregninger med kun det, bilen kan se), rundes udad til hele 5 m og er mindst 10 m bredt. Spillet viser aldrig et præcist landingstal, heller ikke til skærmlæsere (de får "Lander ca. 60–90 m").
- **Udsyn:** bilen kan kun se **35 m frem** (+3 m pr. niveau Instrumenter, op til 50 m). Ting længere fremme tegnes ikke, og de indgår heller ikke i felterne eller kortene. Udsynets grænse vises med **tåge** (temaets `taage`-tegning og farver). Tågen er pynt og kan slås fra under Indstillinger → Udseende → **Tåge**, men tingene derude er stadig skjulte.
- **Ny bane hver tur:** banen laves ud fra et **frø pr. tur** (bil + turnummer). Frøet og den igangværende tur gemmes, så en tur, der afbrydes ved et valg, kan **fortsættes** (menuen viser **Fortsæt turen**), med samme bane, samme vind og samme kort. Zonerne er de samme som før.
- **Valgkort ved hvert stop:** der er **ét beslutningspunkt pr. hop: toppen** (mindst 3 m oppe). Her fryser spillet og viser **2–3 store valgkort**, som afhænger af situationen. Hvert kort viser sin **effekt**, sit **landingsfelt** og evt. "Skade op til N %" eller "Kan smadre bilen":
  - **Brug boost nu** (hvis der er boost tilbage): længere hop, men **hårdere landing** og **overophedning** (ca. 10 % skade med det samme). Det er ikke det oplagte valg ved hvert stop.
  - **Gem boostet** / **Glid videre**: ingen ændring. Ubrugte boost giver **+55 mønter** stykket ved turens slut (når turen nåede mindst 60 m), så det kan betale sig at spare.
  - **Tag ballonen**, **Tag brændstofdunken**, **Styr mod mønterne**, **Dyk mod mønterne** eller **Land på trampolinen**: kun når tingen ligger inden for udsyn, og bilen faktisk kan nå den. Bilen styrer mod den, men taber 10 % fart (dyk giver en hårdere landing).
  - **Næse op** / **Næse ned** (kun med **vinger**; vingerne giver næsekort i stedet for en knaprække): op giver en højere og længere bue (hårdere landing); ned dykker tidligere, lander blødere og bevarer fart. De to kort vises kun sammen, når deres landingsfelter er **tydeligt forskellige**; ellers vises kun det mest nyttige.
  - Med boost er boost-kortet altid nr. 1. "Gem boostet" er med, medmindre begge næsekort er det tydelige valg (næse bruger ikke boost). Ellers vælges det tredje kort blandt mål og næse. Er der intet at vælge (ingen boost, intet mål og ingen vinger), kører bilen bare videre.
  - Kortene er mindst ca. 3 cm, når der er plads, og ellers mindst 80 px. På brede skærme står de under hinanden, på lave og smalle ved siden af hinanden. Hvert kort har et nummer og en farvet kant, der passer med feltets farve på banen.
- **Næsen** i tal (v1.3): ved valg får op et opadgående skub og ned et dyk (plus lidt ekstra fart). Op lander hårdere, ned blødere. Effekten gælder kun for det hop, kortet blev valgt til.
- **Turen:** bilen kører, til den holder stille eller er smadret (0 %). Så vises **turens resultat** (det, der svarer til "game over"): afstand, mønter (afstand, samlet op, zonebonus og mål) og evt. rekord. Herfra går man til **værkstedet**, **kører igen** eller går til menuen. Der er ingen grænse for antal ture.
- **Ting på banen:**
  - Gode: **trampolin** (sender bilen op igen uden skade), **ballon** (løfter), **vindstød** (skubber frem og op), **rampe** (nyt hop), **olie** (ruller længere), **mønter** (5 pr. stk.) og **brændstofdunk** (+10 mønter og +1 boost).
  - Dårlige: **sten** (meget skade, bremser), **kaktus** (skade) og **kegle** (lidt skade, lidt bremse). Hårde landinger giver også skade.
  - Der er en forhindring i hvert stykke bane (50 m), i Forstaden i hvert andet. Banen er ny på hver tur.
- **Zoner:** Forstaden (0 m), Ørkenen (250 m), Bjergene (700 m), Skyerne (1300 m, lettere tyngdekraft) og Rummet (2200 m, endnu lettere). Hver zone har sine egne ting og farver og giver en **førstegangsbonus** (60/150/350/800 mønter).
- **Mål:** tre små mål er i gang ad gangen (fx "Nå 100 m", "Hop på en trampolin", "Nå 500 m uden boost"). Klarede mål giver mønter, og så kommer det næste. Efter listen kommer der flere afstandsmål uden ende.
- **Værkstedet:** ni opgraderinger i flere niveauer. Priserne stiger for hvert niveau:
  - **Motor** (8): hurtigere ud over rampen.
  - **Dæk** (6): ruller længere og hopper bedre.
  - **Karrosseri** (6): flere liv og mindre skade.
  - **Aerodynamik** (6): mindre luftmodstand.
  - **Vinger** (5): mere opdrift og næsekortene.
  - **Raket** (5): kraftigere boost.
  - **Brændstof** (4): ét boost mere pr. tur. Alle har ét boost fra start.
  - **Faldskærm** (4): tager en del af hårde landinger (folder sig ud af sig selv).
  - **Instrumenter** (5, fra 40 mønter, ×1,8 pr. niveau): et bedre vindskøn, så **landingsfeltet bliver smallere** (aldrig præcist: gennemsnitligt ca. 20 m bredt uden, 15 m med 3 niveauer og 12–13 m med 5 niveauer; altid mindst 10 m), og **3 m længere udsyn** pr. niveau.
  - Bilen skifter udseende efter det samlede antal niveauer: **sæbekassebil → boblebil → sportsvogn → raketbil**, med vinger, raket og faldskærm, når de er købt.
- **Ny bil (prestige):** når den længste tur er mindst 1000 m, kan man tage en **ny bil**. Alt starter forfra (mønter og opgraderinger), men hver ny bil giver **+25 % mønter** på alle ture, for altid, og en ny bane. Spillet spørger først (**Nej** har fokus, og Esc betyder Nej).
- **Rekorder:** lokal top 10 for **længste tur** og top 10 for **biler** (en bils samlede meter, når man tager en ny bil).
- **Fremskridt** gemmes i `localStorage` (`hojtArkade.rampen.fremskridt`, version 2) efter hver tur, ved hvert valgkort, hvert køb og når siden lukkes. Lukkes siden midt i en tur, gemmes turen ved det seneste valg og kan fortsættes. Gemt fremskridt fra v1.1 opgraderes (turens frø tilføjes).
- **Mens bilen kører:** **Hurtigere/Roligere** skifter fart, og **Spring frem** går direkte til næste beslutning (eller turens slut). Standardfarten (Rolig eller Hurtig) vælges under Indstillinger → Styring. Pausen har **Spol til slut**, som kører resten af turen uden flere boost.
- **Lyd:** spillet har sine egne lyde i `js/lyd.js`. De laves med Web Audio, så der er ingen lydfiler. Lydene er **motor** (når turen starter), **opsendelse**, **boost**, **mønt**, **hop** (trampolin, rampe og ballon), **landing** (dybere og kraftigere jo hårdere landingen er) og **køb**. De følger arkadens fælles lydindstilling (**Lyd** til/fra og en evt. fælles lydstyrke). Klik, pause, stød, smadret og rekord bruger arkadens fælles lyde (`arkade/audio.js`). Uden animation spilles et kort resumé af lydene, når et stykke af turen vises.
- **Tastatur:** før opsendelsen ændrer pil op/ned vinklen (med Skift 5°), og pil venstre/højre ændrer kraften. Enter eller mellemrum sender bilen. Ved valgkortene vælger **1**, **2** og **3** kortet med det nummer, **J** vælger boost-kortet, og **V** eller **N** vælger "Gem boostet"/"Glid videre" (når det er et kort). Mens bilen kører, skifter H farten, og Enter eller mellemrum springer frem. Esc eller P giver pause.
- **Dwell** (valgfrit, slået fra som standard, med ring). Valgkortene er dwell-sikre: kort, der dukker op lige under blikket, kan først vælges, når blikket har været væk. Vinkel- og kraftknapperne gentager under dwell.
- **Alle skærme:** man skal aldrig rulle. Knapperne er mindst ca. 3 cm, når der er plads, og ellers mindst ca. 80 px. Spillet vælger det layout, der giver den største bane: knapperne ved siden af på brede og lave skærme og under banen på højkant.
- **Kameraet** (v1.4, i `js/tegn.js`): tre udsnit.
  - **Opsendelse:** rampen, bilen og den korte startlinje.
  - **Kørsel og flyvning:** tæt på bilen, så den er stor og tydelig, også på 1920×1080. Bilen er nu ca. 95–260 px lang (før 54–95 px). Når bilen kommer højt op, zoomer kameraet lidt ud (højst til 60 % af den tætte zoom) og følger derefter med op.
  - **Beslutningspunkt:** zoomer roligt ud, så bilen, valgkortenes landingsfelter og udsynet ses. Efter et valg zoomer det roligt ind igen.
  - Skiftene glider blødt i ca. 0,7 s uden at ryste. Uden animation, eller når computeren er sat til mindre bevægelse, skifter kameraet direkte.
  - Kameraet viser aldrig mere end før: ting ud over udsynet tegnes stadig ikke, og tågen ligger der stadig.
  - Feltteksterne holdes fri af bilen. Ville en tekst dække bilen, flyttes den til siden for bilen eller ned under jordlinjen. Temaets `felt()` får `tekstX`/`under`.
- **Liv i bil og landskab** (v1.5, kun i tegnelaget og temaet – fysikken og banens frø påvirkes ikke):
  - *Bilen:* hjulene drejer med farten, bilen sætter sig i fjedrene ved landing, forlygte med lyskegle, røg fra udstødningen, støv når den kører på jorden, gnister ved hårde stød, gløder fra boostflammen og røg fra en hårdt skadet bil. Opgraderingerne kan ses: større hjul (grovmønstrede fra Dæk 3), udstødningsrør (Motor 3 og 6), luftindtag (Motor 5), panserplader med nitter (Karrosseri 2, bøjle fra 4), spoiler og splitter (Aero 2 og 4), faldskærmspakke og antenne/parabol (Instrumenter). En skadet bil får ridser og en revnet rude.
  - *Landskabet:* parallakselag (skyline, mesaer, bjergkæde, skybanker og en måne med ring i rummet), skyer der driver langsomt (fast fart, de viser **ikke** den skjulte vind), fugle i Forstaden og Bjergene, forgrund med græs, blomster, sten og kratere, svævende blade, sand, sne og stjernestøv pr. zone, afstandsskilte for hver 100 m, lys langs startrampen og en sol, der går ned, jo længere man kommer (stjernerne kommer frem). Lagene glider over i hinanden ved zoneskift.
  - Partiklerne har deres eget tilfældighedstal (ikke spillets frø) og højst 220 ad gangen. Målt ca. 60 fps ved 1920×1080.
  - Uden animation eller med mindre bevægelse: ingen partikler, intet der driver eller drejer, men alle faste detaljer (sol, skyer, fugle, forgrund, skilte, rampelys, opgraderinger, skader) er der stadig. Uden glød tegnes alt uden lysskær. Kontrast-paletten dæmper pynten.
- **Rolig visning:** intet blinker. Kameraet glider roligt mellem udsnittene. Når animation er slået fra, eller computeren er sat til mindre bevægelse, vises hvert stykke af turen straks med sporet efter sig. **Glød** og **Tåge** kan slås fra under Indstillinger → Udseende.
- **Test:**
  - `node rampen/test/spillogik.test.js` tjekker fysikken (deterministisk), skade og faldskærm, alle ting på banen, at banen har forhindringer i alle zoner, ét beslutningspunkt pr. hop (toppen), og at et boost giver en ny top, valgkortene (de afhænger af situationen: boost, vinger, en ballon inden for eller uden for udsyn), at opsendelsen og felterne aldrig giver et præcist landingstal, at feltet er smallere med Instrumenter, at det rigtige udfald ligger inden for feltet og varierer, at vinden flytter landingen, ny bane pr. tur, at en gemt tur fortsætter ens, at ting uden for udsyn er skjulte, priser og køb, zoner og mål, Ny bil, rensning af gemte data og balancen (en spiller med omtanke når Ørkenen og Skyerne i et rimeligt tempo, en der altid booster klarer sig mærkbart dårligere, næse op/ned aldrig har samme felt, og en fuld bil når rummet).
  - `python3 rampen/test/responsiv_test.py` (Playwright og Chrome) tjekker alle skærme ved 8 opløsninger: ingen rulning, knapstørrelser, overlap, tekst i knapperne, spil med knapper og tastatur, at opsendelsen kun viser starten af buen, at spillet står stille ved beslutninger, og at de kun kommer på toppen af et hop, valgkortene (2–3 stk., mindst 3 cm når der er plads og ellers 80 px, interval på hvert kort og intet præcist landingstal i teksten), at intet tegnes ud over udsynet, partikler under flyvning og ingen med mindre bevægelse, kameraet (bilen er mindst 1,5 gange så stor under flyvning som i v1.3, kameraet zoomer roligt ud ved beslutningspunktet, ingen rolig zoom uden animation, feltteksterne dækker aldrig bilen), kort med tastatur (J og 1), at en afbrudt tur fortsætter efter genindlæsning, tåge fra, egne lyde, turens resultat, rekord og gemt fremskridt, værkstedet, Ny bil, pause, glød fra, dwell, mindre bevægelse og hallen. Skærmbilleder gemmes, når `RAMPEN_SKAERMBILLEDER=<mappe>` er sat.

## Filer

- `index.html` – skærmene (start, spil, pause, turens resultat, værksted, ny bil, indstillinger, rekorder, Om).
- `js/logik.js` – spillogikken uden DOM og uden farver: fysik (fast tidsskridt 1/60 s, deterministisk), banen (ny pr. tur ud fra et frø), skjult vind og vindstød, udsyn, beslutningspunkter, valgkort og usikre landingsfelter, opgraderinger, zoner, mål, Ny bil og gemte data.
- `js/tegn.js` – tegnelaget på canvas (kamera, animation og billeder af bilen). Det læser kun spillets tilstand, henter alle mål og farver fra temaets CSS-variabler og kalder temaets tegnefunktioner.
- `js/lyd.js` – spillets egne lyde (Web Audio-syntese, ingen filer) i samme stil som Tårnenes `js/lyd.js`: `RampenLyd.create({ sfx, volume, lyde })` med `play(navn, styrke)`, `setSfx`, `setVolume` og `unlock`.
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
  - `bil` med `x`, `y`, `vinkel` (radianer), `type` (en af `biler`), `vinger`, `raket`, `flamme` (boost tændt), `skaerm` (faldskærm ude) og `naese`. Fra v1.5 også `hjul` (hjulenes drejning i radianer), `saet` (fjedring i meter), `opg` (opgraderingernes niveauer), `slid` (0–1, skade), `lys` (forlygte) og `tid` (sekunder, til flammen).
  - v1.5: `sol` (dagens gang ud fra afstanden), `fjern` og `skyer` (parallakselag; skyer må ikke afsløre vinden), `forgrund` (pr. zone), `stemning` (svævende partikler pr. zone, kun med animation), `partikel` (`slags` = `gnist`, `roeg`, `skaderoeg`, `stoev` eller `glod`) og `skilt` (afstandsskilt).
  - `spor` (vejen bag bilen) og `forhaand` (forhåndslinje) med `slags` = `start` (opsendelsen, kun starten af buen) eller `kort-1`, `kort-2`, `kort-3` (den skønnede vej for valgkort 1–3, kun inden for udsyn).
  - `felt` med `fra`, `til` (meter), `nr` (1–3, kortets nummer), `tekst` ("1: ca. 60–90 m") og `raekke` (0–2, så teksterne ikke ligger oven i hinanden): **landingsfeltet** for et kort.
  - `taage` med `x` (udsynets grænse i meter): tåge/mørke fra grænsen og fremefter. Den tegnes oven på ting og kulisse og under felter og linjer. Tingene ud over grænsen tegnes slet ikke, uanset temaet.
  - `landing` (kryds med tekst) bruges ikke længere, men må gerne findes.
  - Intet må være nødvendigt for at aflæse spillet ud over form og placering.
- `lyde` (valgfri): et tema kan give enkelte lyde en anden klang. Navnene er `motor`, `opsendelse`, `boost`, `moent`, `hop`, `landing` og `koeb`, og hver er en funktion `(t, n, v)`, hvor `t` er starttiden, `n` styrken (0–1, fx hvor hård landingen er) og `v` værktøjerne `v.tone(…)`, `v.stoej(…)` og `v.NOTE`. Neon bruger standardlydene (`lyde: {}`). Lydene må ikke være nødvendige for at spille.
- `ikoner`: SVG-indhold i et 100 × 100-felt, farvet med klasserne `ico-line` og `ico-fill`. `js/tegn.js` lægger dem ind som `#rampen-ikon-<navn>`. Ikonerne skal hedde:
  - `vinkel-op`, `vinkel-ned`, `kraft-op`, `kraft-ned`, `send`, `boost`, `vent`, `naese-op`, `naese-lige`, `naese-ned`, `fortsaet`, `hurtig`, `rolig`, `spring`, `pause`, `tilbage`, `moent`, `vaerksted`, `bil`, `ballon` og `trampolin` (de to sidste til valgkortene).
  - Ét pr. opgradering: `motor`, `daek`, `karrosseri`, `aero`, `vinger`, `raket`, `braendstof`, `faldskaerm` og `instrumenter`.

**`tema.css`** skal sætte disse CSS-variabler for hver farvepalet, som arkadens Tema-valg sætter med `[data-theme="neon|solnedgang|cyberpunk|kontrast"]`:

- *Zonerne:* `--rampen-himmel-<zone>-1`, `--rampen-himmel-<zone>-2`, `--rampen-jord-<zone>`, `--rampen-jord-<zone>-kant`, `--rampen-kulisse-<zone>` og `--rampen-kulisse-<zone>-2` for alle fem zoner.
- *Ting og bil:* `--rampen-rampe`, `--rampen-rampe-kant`, `--rampen-trampolin`, `--rampen-trampolin-dug`, `--rampen-rampe-ting`, `--rampen-olie`, `--rampen-sten`, `--rampen-sten-kant`, `--rampen-kaktus`, `--rampen-kegle`, `--rampen-kegle-stribe`, `--rampen-ballon`, `--rampen-ballon-snor`, `--rampen-vind`, `--rampen-moent`, `--rampen-moent-kant`, `--rampen-bonus`, `--rampen-bonus-kant`, `--rampen-bil-krop`, `--rampen-bil-krop-2`, `--rampen-bil-kant`, `--rampen-bil-rude`, `--rampen-hjul`, `--rampen-hjul-nav`, `--rampen-vinge`, `--rampen-raket`, `--rampen-flamme`, `--rampen-flamme-kerne`, `--rampen-skaerm` og `--rampen-skaerm-snor`.
- *Liv (v1.5):* `--rampen-bil-lys`, `--rampen-bil-lys-2`, `--rampen-bil-lygte`, `--rampen-bil-krom`, `--rampen-bil-panser`, `--rampen-bil-skade`, `--rampen-roeg`, `--rampen-roeg-moerk`, `--rampen-stoev`, `--rampen-gnist`, `--rampen-sol-1`, `--rampen-sol-2`, `--rampen-stjerne`, `--rampen-sky`, `--rampen-fugl`, `--rampen-rampe-lys`, `--rampen-skilt`, `--rampen-skilt-flade` og for hver zone `--rampen-fjern-<zone>`, `--rampen-forgrund-<zone>` og `--rampen-partikel-<zone>`.
- *Linjer og tekst på banen:* `--rampen-spor`, `--rampen-forhaand-uden`, `--rampen-forhaand-med`, `--rampen-forhaand-start`, `--rampen-forhaand-kort-1`, `--rampen-forhaand-kort-2`, `--rampen-forhaand-kort-3`, `--rampen-landing`, `--rampen-maaler`, `--rampen-milepael`, `--rampen-tekst`, `--rampen-tekst-kant`, `--rampen-kontur`, `--rampen-gloed-farve` og `--rampen-skygge-farve`.
- *Landingsfelter:* `--rampen-felt-1`, `--rampen-felt-2`, `--rampen-felt-3` (fyld) og `--rampen-felt-1-kant`, `--rampen-felt-2-kant`, `--rampen-felt-3-kant` (kant og tekst). Kantfarverne bruges også som kortets farvede kant og nummer, så kort og felt hører sammen. Brug almindelige farver (fx `rgba(…)`), da canvas læser dem.
- *Tåge:* `--rampen-taage` (fuld tåge længst ude) og `--rampen-taage-2` (tågens begyndelse ved udsynets grænse). Under `html[data-rampen-taage="fra"]` skal begge være `transparent`.
- *Tal på banen* (pixel): `--rampen-kontur-w`, `--rampen-streg-w`, `--rampen-forhaand-w`, `--rampen-spor-w`, `--rampen-jord-kant-w`, `--rampen-tekst-str` og `--rampen-radius`; skrift: `--rampen-font`.
- *Glød og skygge på banen:* `--rampen-gloed` (styrke, 0 = ingen), `--rampen-gloed-blur`, `--rampen-skygge-x`, `--rampen-skygge-y` og `--rampen-skygge-blur`.
- *Fladerne omkring:* `--rampen-ok`, `--rampen-fejl`, `--rampen-moent-tekst`, `--rampen-hp`, `--rampen-hp-lav`, `--rampen-shadow`, `--rampen-hud-bg`, `--rampen-hud-border`, `--rampen-meter`, `--rampen-meter-tom`, `--rampen-overlay-bg`, `--rampen-overlay-soft`, `--rampen-hall-bg`, `--rampen-hall-bg-hover` og `--rampen-swatch-border`.
- *Streger og hjørner:* `--rampen-frame-w`, `--rampen-block-w`, `--rampen-stroke-ico`, `--rampen-stroke-hall`, `--rampen-hall-border-w`, `--rampen-radius-board`, `--rampen-radius-hud`, `--rampen-radius-hud-small`, `--rampen-radius-swatch` og `--rampen-radius-meter`.
- *Glød og skygger i siden:* `--rampen-board-glow`, `--rampen-score-glow`, `--rampen-points-glow`, `--rampen-text-shadow` og `--rampen-text-shadow-strong`.
  - Under `html[data-rampen-gloed="fra"]` skal glød være `none` og `--rampen-gloed` 0.
  - Spillet må ikke have brug for glød for at kunne aflæses.
- *Farveprøver i Indstillinger:* `.swatch[data-farver="…"]` med `--a`, `--b` og `--c`.

Tekster, regler, mål og layout hører ikke til temaet og er ens for alle temaer.

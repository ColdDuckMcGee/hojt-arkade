# Kælderen

Del af **Hojt Arkade** af Jon Leismann Engsager / Hojt Design (MIT).
Spillet kører direkte fra `index.html` uden server og uden internet (også fra `file://`). Ingen frameworks, ingen CDN, kun klassiske `<script>`-tags.

### Kælderen
En turbaseret førsteperson-kælder (dungeon crawler) i 3D. Man går ét felt ad gangen ned gennem kældre, der laves automatisk. Der er intet ur: **fjenderne rykker kun, når du handler** (går, drejer, skyder, venter …).

- **Etager uden ende:** hver etage har et **nøglekort**, en **låst dør** og en **trappe** ned. Find nøglen, lås døren op, og tag trappen. Mellem etagerne er der en **butik**.
- **Fjender:** tre typer, som kommer gradvist: **Kravler** (lille og hurtig i nærkamp, fra etage 1), **Skytte** (skyder på afstand i lige linje, fra etage 2) og **Kolos** (meget liv, slår hårdt, men er langsom, fra etage 3). Over hver fjende står en livbjælke og "Kan ramme dig" eller "sover", og en fjende, der kan ramme dig i næste tur, får en tydelig ramme.
- **Kamp:** træfchancen falder med afstanden (vises på knappen, fx "Skyd 84 %"). Ammunition er begrænset. Står fjenden lige foran dig, og ammoen er sluppet op, bliver Handling til **Slå** (nærkamp).
- **Ting:** ammunition, førstehjælp og skat ligger i gangene og rummene.
- **Butik:** mere liv, førstehjælp, bedre våben, større magasin, ammunition, rustning og bedre lommelygte. Betal med skat.
- **Game over** ved liv 0. **Point = dybde × 1000 + al indsamlet skat.** Lokal top 10.
- **Status:** Etage, Liv, Ammo og Skat (og nøglen, når den er fundet).
- **Styring:** seks store knapper (Frem, Tilbage, Drej venstre, Drej højre, Handling og Kort) plus sidetrin til venstre og højre.
  - **Kig og gå:** klik (eller dwell) på et felt eller en ting i 3D-billedet, så går man derhen af sig selv. **Auto-gang stopper**, når en ny fjende dukker op.
  - **Kortet** (M eller knappen) viser det udforskede område. Klik på et felt på kortet for at gå derhen.
  - **Taster:** pile eller WASD (frem, tilbage, drej), Q og E (sidetrin), mellemrum eller Enter (Handling), M (kort), Esc eller P (pause).
  - **Dwell** er valgfrit og slået fra som standard. I 3D-billedet virker dwell kun på objekter (fjender, ting, døre, trappen), så blikket kan hvile på gulvet.
- **Grafik:** raycaster med teksturer på vægge, gulv og loft, tåge, lyskort fra loftslamper, lommelygte, faklelys med blød (ikke blinkende) variation, sprites med z-buffer, neonkanter, glorie (bloom), vignet og scanlines. Bevægelse glider på ca. 0,3 s; ved "mindre bevægelse" eller animation fra springer billedet direkte.
- **Kvalitet:** Auto (standard) tilpasser den interne opløsning efter, hvor lang tid et billede tager (sigter efter 60 billeder i sekundet), Lav eller Høj.
- **Alle skærme:** man skal aldrig rulle. Knapperne er mindst ca. 3 cm, når der er plads, og ellers mindst ca. 80 px.
- **Rolig visning:** intet blinker. **Glød** kan slås fra under Indstillinger, og spillet kan aflæses lige så godt uden.
- **Lyd:** spillets egne lyde (`js/lyd.js`, Web Audio, ingen lydfiler). De følger arkadens lyd til/fra og lydstyrke.

## Filer

- `index.html` – skærmene (start, spil, kort, pause, bekræft, butik, game over, indstillinger, rekorder, Om).
- `js/logik.js` – spillogikken uden DOM og farver: kortgenerator (seedet), ture, fjendernes træk, kamp, ting, butik, point og game over.
- `js/tegn.js` – raycasteren og alt canvas-tegning. Den læser kun spillets tilstand og henter alle farver, tal, teksturer og sprites fra temaet.
- `js/lyd.js` – lydene.
- `js/app.js` – skærme, styring (knapper, mus, tryk, tastatur, dwell, kig og gå, auto-gang), animation, layout og indstillinger.
- `css/kaelderen.css` – opbygning og mål. Ingen farver, glød, skygger eller skrifttyper (de kommer fra temaet).
- `tema/neon/tema.css` og `tema/neon/grafik.js` – temaet (se nedenfor).
- Fælles moduler fra `../arkade/` (indstillinger, rekorder, dwell, lyd og baggrund).

## Test

- `node kaelderen/test/logik.test.js` – kortgenerator (nøgle, dør og trappe kan altid nås), bevægelse og drej, fjender rykker kun ved handling, de tre fjendetyper, træfchance og afstand, ammo og nærkamp, ting, butik, etageskift, point, game over og determinisme.
- `node kaelderen/test/temaklar.test.js` – ingen farver, glød eller skrifttyper uden for temaet, og temaet leverer alt, spillet beder om.
- `python3 kaelderen/test/responsiv_test.py` (Playwright og Chrome) – alle skærme ved 8 opløsninger: ingen konsolfejl, ingen rulning, knapstørrelser, billedraten, spil med taster, knapper og klik (3D og kort), auto-gang stopper ved fjende, butik, game over, rekorder, glød fra, mindre bevægelse og hallen. Skærmbilleder gemmes, når `KAELDER_SKAERMBILLEDER=<mappe>` er sat.

## Temaet

Al grafik ligger i `tema/<navn>/`. Spilkoden henter den kun ved navn. Fem temaer er planlagt: **Neon** (dette), **Tegneserie – ligne claire**, **Papirklip**, **Art deco** og **Ler**. Et nyt tema er en ny mappe med de samme to filer, som `index.html` så peger på. Intet i temaet må være nødvendigt for at aflæse spillet ud over form, tal og tekst: livbjælker, trusler og tal skal kunne læses uden glød.

**`grafik.js`** sætter `window.KaelderTema` med:

- `navn`.
- `farver`, `tekster` og `tal`: navnene på de variabler, temaet bruger. `js/tegn.js` læser `--kaelder-<navn>` for hver og giver værdierne videre i objektet `s`.
  - Farver: vægge, rum, døre og lås, gulve, trappe, lofter, de tre fjender, ting (ammo, liv, skat, nøgle), lamper, tåge og mørke, lommelygte, livbjælke, trussel, sover, markering, sigte, skade, skud, scanlines, tekst, alle kortets farver og våbnet.
  - Tal: `gloed`, `scanlines`, `vignet`, `taage-start`, `taage-slut`, `lys-omgivelse`, `lys-lampe`, `lys-lygte`, `flimmer` (styrken af faklelysets bløde variation; 0 = helt roligt), `kontur-w`, `skrift-vaegt`, `kort-streg` og `bloom`.
  - Tekster: `skrift`.
- `teksturer`: funktioner, der tegner én tekstur (fx 64 × 64) på et lille canvas: `vaeg`, `vaeg-rum`, `doer`, `doer-laast`, `gulv`, `gulv-rum`, `gulv-trappe`, `loft` og `loft-rum`. `gloed` (valgfri) giver selvlysende lag til de samme navne (neonkanter), som slukkes, når glød er fra.
- `sprites`: `kravler`, `skytte`, `kolos`, `ammo`, `liv`, `skat`, `noegle`, `trappe` og `lampe`, hver `{ str, sted, tegn, gloed }` – højde i forhold til et felt, `sted` = `gulv`, `loft` eller `svaev`, og tegnefunktioner til sprite-canvas.
- `tegn`: tegnefunktioner oven på 3D-billedet og på kortet: `livbar`, `trussel`, `markering`, `feltMarkering`, `sigtekorn`, `vaaben`, `skade`, `efter`, `tal`, `kortBund`, `kortFelt`, `kortSpiller`, `kortFjende`, `kortTing`, `kortRute`, `kortValg` og `kortTekst`.
- `ikoner`: SVG-indhold i et 100 × 100-felt med klasserne `ico-line` og `ico-fill`: `frem`, `tilbage`, `drej-v`, `drej-h`, `side-v`, `side-h`, `skyd`, `slaa`, `aabn`, `laast`, `laas-op`, `saml`, `trappe`, `vent`, `kort`, `syn`, `pause`, `hal`, `liv`, `ammo`, `skat`, `etage`, `noegle` og `rustning`.
- `lyde` (valgfri): andre klange til enkelte lyde, fx `{ skud: function (t, n, v) { v.tone(…); } }`. Tom = spillets egne lyde.

**`tema.css`** sætter alle `--kaelder-*`-variablerne for hver farvepalet, som arkadens Tema-valg sætter med `[data-theme="…"]`: farverne og tallene ovenfor, skrift (`--kaelder-skrift`, `--kaelder-skrift-vaegt`), fladerne omkring (`--kaelder-hud-*`, `--kaelder-overlay-*`, `--kaelder-hall-*`, `--kaelder-vare-bg`, `--kaelder-besked-bg`, `--kaelder-ok`, `--kaelder-fejl`, `--kaelder-advarsel`), streger og hjørner (`--kaelder-frame-w`, `--kaelder-block-w`, `--kaelder-stroke-*`, `--kaelder-radius-*`) samt glød og skygger i siden (`--kaelder-view-glow`, `--kaelder-score-glow`, `--kaelder-text-shadow*`). Under `html[data-kaelder-gloed="fra"]` skal al glød være `none` og `--kaelder-gloed`/`--kaelder-bloom` 0.

Tekster, regler, mål og layout hører ikke til temaet og er ens for alle temaer.

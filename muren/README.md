# Muren

Del af **Hojt Arkade** af Jon Leismann Engsager / Hojt Design (MIT).
Spillet kører direkte fra `index.html` uden server og uden internet (også fra `file://`).

### Muren
Et turbaseret "skyd en salve"-spil (som Ballz) for voksne. Der er intet ur og ingen tidspres: man sigter i ro og mag, og først når man trykker på **Skyd**, sker der noget.
Kanonen står nederst på brættet. Den sender alle sine kugler af sted i en **salve**, én ad gangen, i samme retning. Kuglerne preller af på vægge, loft og sten. Hvert træf tæller stenens tal ét ned, og ved 0 forsvinder stenen. Når alle kugler er landet, **rykker muren ét trin ned**, og en ny række kommer ind øverst. Muren er uendelig – spillet slutter, når en sten når **bundlinjen**.

- **Sigte:** fire store drejeknapper: 10° og 2° mod venstre, 2° og 10° mod højre. Vinklen vises som en pil og i grader (0° = lige op, højst ±80°). Under dwell bliver drejeknapperne ved med at dreje ét trin for hver dwell-tid, så længe blikket bliver der. Man kan også **klikke eller trykke på brættet** for at sigte lige derhen. Vinklen huskes fra tur til tur.
- **Sigtelinje:** den prikkede linje viser kuglens vej til den første flade, den rammer (væg, loft eller sten, markeret med en ring), og ét hop videre.
- **Skyd:** ét klik, ét dwell eller Enter er én salve. Under dwell kan Skyd først vælges igen, når blikket har forladt knappen. Drejeknapperne og Skyd er låst, mens kuglerne flyver.
- **Spring frem:** afslutter salven med det samme (resultatet er præcis det samme som at se den til ende). Knappen er kun aktiv, mens salven flyver. Når animation er slået fra, eller computeren er sat til mindre bevægelse, afvikles salven altid med det samme.
- **Salvens fart:** Rolig, Normal eller Hurtig (Indstillinger → Styring).
- **Affyringspunkt:** hvor den **første** kugle lander i bunden, bliver næste salves affyringspunkt.
- **+1-ringe:** hver ny række har én grøn **+1**-ring. En kugle, der flyver gennem den, samler den op og flyver videre, og næste salve har én kugle mere. En ring, der glider ud under bundlinjen, samles automatisk op.
- **Stenene:** en ny række har 1–3 sten (fra tur 12 én mere og fra tur 24 to mere, altså højst 5) med turens nummer som tal; fra tur 4 kan en sten have det dobbelte. Farven går fra kølig (svag) til varm (stærk) efter tallet i forhold til turen, og tallet står altid på stenen.
- **Game over:** når en sten rykker ned i bundrækken (under den stiplede bundlinje). Står en sten lige over bundlinjen, advarer beskedlinjen.
- **Point:** 1 point pr. træf og 10 point ekstra for hver sten, der knuses. Status viser **Tur**, **Kugler** og **Point**.
- **Tastatur:** pil venstre/højre drejer 2° (med Skift 10°), Enter, mellemrum eller S skyder, F eller Tab springer frem under en salve, og Esc eller P giver pause.
- **Dwell** (valgfrit, slået fra som standard, med ring). Nye dialoger er dwell-sikre: en knap, der dukker op lige under blikket, kan først vælges, når blikket har været væk.
- **Alle skærme:** man skal aldrig rulle. Knapperne er mindst ca. 3 cm, når der er plads, og ellers mindst ca. 80 px. Spillet vælger det layout, der giver det største bræt: status til venstre og knapper til højre på brede skærme, knapperne ved siden af på lave skærme og knapperne under brættet på højkant. Brættet (700 × 1000) drejes aldrig.
- **Rekorder:** en lokal top 10 med point, antal ture og dato.
- **Afslut:** fra pausen spørger spillet først (**Nej, spil videre** har fokus, og Esc betyder Nej). Pointene gemmes. Lukkes siden midt i et spil, gemmes de også.
- **Lyd:** spillets egne bløde lyde (`js/lyd.js`, Web Audio, ingen lydfiler) til skud, træf, knust sten, +1, muren rykker ned og game over. De følger arkadens lyd til/fra (og en fælles lydstyrke, hvis arkaden får en). Mange træf lige efter hinanden dæmpes.
- **Rolig visning:** intet blinker. **Glød** kan slås fra under Indstillinger → Udseende, og spillet kan aflæses lige så godt uden.
- **Test:**
  - `node muren/test/spillogik.test.js` tjekker start, vinkler og sigte ved klik, lige skud og loft, afprelning på vægge (indfaldsvinkel = udfaldsvinkel), at kuglerne aldrig forlader brættet eller går gennem en sten, at sigtelinjen viser det rigtige første stød, træf, knuste sten og point, +1-ringe (også automatisk opsamling), at muren rykker ned, og tallene stiger, første landing som næste affyringspunkt, game over, Spring frem (samme resultat) og determinisme.
  - `node muren/test/temaklar.test.js` tjekker, at ingen farver, skygger eller skrifttyper ligger uden for temaet, og at temaet leverer alt, spillet beder om.
  - `python3 muren/test/responsiv_test.py` (Playwright og Chrome) tjekker alle skærme ved 8 opløsninger: ingen rulning, knapstørrelser, spil med knapper, tastatur og klik på brættet, Skyd og låste knapper, Spring frem, muren rykker ned, bekræftelsen, game over, rekorder, glød fra, dwell, mindre bevægelse og hallen. Skærmbilleder gemmes, når `MUREN_SKAERMBILLEDER=<mappe>` er sat.

## Filer

- `index.html` – skærmene (start, spil, pause, bekræft, game over, indstillinger, rekorder, Om).
- `js/logik.js` – spillogikken uden DOM og uden farver: brættet (7 × 10 felter à 100), fysik med fast tidsskridt (deterministisk, seedet tilfældighed), sigtelinje, salven, ringe, rækker, point og game over.
- `js/tegn.js` – tegnelaget på canvas. Det læser kun spillets tilstand, henter alle mål og farver fra temaets CSS-variabler og kalder temaets tegnefunktioner.
- `js/lyd.js` – spillets egne lyde (Web Audio).
- `js/app.js` – skærme, styring (knapper, mus, tryk, tastatur, dwell), animationsløkken, layout, lyd og indstillinger.
- `css/muren.css` – opbygning og mål. Ingen farver, glød, skygger, skrifttyper, stregtykkelser eller hjørner (de kommer fra temaet).
- `tema/neon/tema.css` og `tema/neon/grafik.js` – temaet (se nedenfor).
- Fælles moduler fra `../arkade/` (indstillinger, dwell, lyd, baggrund, rekorder og fælles stil).

## Temaet

Al grafik ligger i `tema/neon/`. Spilkoden henter den kun ved navn. Et nyt tema (Tegneserie – ligne claire, Papirklip, Art deco eller Ler) er en ny mappe `tema/<navn>/` med de samme to filer, som `index.html` så peger på. Konturer, skygger og skrift har deres egne variabler, så et tema ikke er bundet til glød: Tegneserie kan bruge sort kontur (`--muren-kontur-w`, `--muren-sten-kant-w`) og ingen glød, Papirklip og Ler en hård skygge (`--muren-skygge-*`), Art deco tynde dobbeltkanter (`--muren-kant-inde-w`) og en anden skrift (`--muren-skrift`).

**`grafik.js`** sætter `window.MurenTema` med:

- `navn`.
- `farver`, `tekster` og `tal`: listerne over de variabler, temaet bruger. `js/tegn.js` læser `--muren-<navn>` for hver af dem og giver værdierne videre i objektet `s`.
- `tegn`: tegnefunktioner på canvas, i brættets enheder (700 × 1000; tegnelaget har allerede skaleret). Følgende skal findes:
  - `flade` (baggrund og gitter), `bundlinje` (fareområdet under bundlinjen) og `kant` (rammen).
  - `sten` (`x, y, w, h`, tallet `n` og `tone` 0–4 fra svag til stærk; tallet skal altid kunne læses) og `ring` (+1-ringen).
  - `sigte` (punkterne `pts`), `traef` (den første flade), `kanon` (`x, y`, vinklen `a` i grader, 0 = op), `kugle`, `landing` (hvor første kugle landede) og `antal` (×n ved kanonen).
  - Et tema må tegne, hvad det vil, inden for disse rammer (fx teksturer, papirkanter eller ler-skygger), men intet må være nødvendigt for at kunne aflæse spillet ud over form og tal.
- `ikoner`: SVG-indhold i et 100 × 100-felt, farvet med klasserne `ico-line` og `ico-fill`.
  - Ikonerne skal hedde `drej-venstre`, `drej-hoejre`, `fin-venstre`, `fin-hoejre`, `skyd`, `spring`, `pause`, `tilbage` og `pil` (vinkelviseren, peger op).
  - `js/tegn.js` lægger dem ind som `#muren-ikon-<navn>`.
- `lyde` (valgfri): andre klange til enkelte lyde, fx `{ knust: function (t, n, v) { v.tone(…); } }`. Tom = spillets egne lyde.

**`tema.css`** skal sætte disse CSS-variabler for hver farvepalet, som arkadens Tema-valg sætter med `[data-theme="neon|solnedgang|cyberpunk|kontrast"]`:

- *Brættets farver* (til canvas): `--muren-flade`, `--muren-flade-2`, `--muren-gitter`, `--muren-kant`, `--muren-kant-inde`, `--muren-kontur`, `--muren-fare`, `--muren-fare-streg`, `--muren-sten-0` … `--muren-sten-4`, `--muren-sten-kant`, `--muren-sten-lys`, `--muren-sten-tal`, `--muren-sten-tal-kant`, `--muren-ring`, `--muren-ring-tekst`, `--muren-kugle`, `--muren-kugle-kant`, `--muren-kanon`, `--muren-kanon-kant`, `--muren-antal`, `--muren-antal-kant`, `--muren-sigte`, `--muren-traef`, `--muren-landing`, `--muren-gloed-farve` og `--muren-skygge-farve`.
- *Skrift på brættet:* `--muren-skrift` og `--muren-skrift-vaegt`.
- *Brættets tal* (i brættets enheder): `--muren-kant-w`, `--muren-kant-inde-w`, `--muren-kontur-w`, `--muren-gitter-w`, `--muren-sten-kant-w`, `--muren-sten-radius`, `--muren-sten-tal-kant-w`, `--muren-sten-tal-str`, `--muren-ring-w`, `--muren-kugle-kant-w`, `--muren-sigte-prik`, `--muren-sigte-afstand`, `--muren-traef-w`, `--muren-kanon-w` og `--muren-fare-w`.
- *Glød og skygge på brættet:* `--muren-gloed` (styrke, 0 = ingen), `--muren-gloed-blur`, `--muren-skygge-x`, `--muren-skygge-y` og `--muren-skygge-blur`.
- *Fladerne omkring:* `--muren-frame`, `--muren-ok`, `--muren-fejl`, `--muren-shadow`, `--muren-hud-bg`, `--muren-hud-border`, `--muren-sigte-tekst`, `--muren-overlay-bg`, `--muren-overlay-soft`, `--muren-hall-bg`, `--muren-hall-bg-hover`, `--muren-hall-border` og `--muren-swatch-border`.
- *Streger og hjørner:* `--muren-frame-w`, `--muren-block-w`, `--muren-stroke-ico`, `--muren-stroke-hall`, `--muren-hall-border-w`, `--muren-radius-board`, `--muren-radius-hud`, `--muren-radius-hud-small` og `--muren-radius-swatch`.
- *Glød og skygger i siden:* `--muren-board-glow`, `--muren-score-glow`, `--muren-points-glow`, `--muren-text-shadow` og `--muren-text-shadow-strong`.
  - Under `html[data-muren-gloed="fra"]` skal glød være `none` og `--muren-gloed` 0.
  - Spillet må ikke have brug for glød for at kunne aflæses.
- *Farveprøver i Indstillinger:* `.swatch[data-farver="…"]` med `--a`, `--b` og `--c`.

Tekster, mål, regler og layout hører ikke til temaet og er ens for alle temaer.

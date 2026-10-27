# Kasser

Del af **Hojt Arkade** af Jon Leismann Engsager / Hojt Design (MIT).
Spillet kører direkte fra `index.html` uden server og uden internet (også fra `file://`).

### Kasser
Et roligt skubbespil (i stil med Sokoban) på et neonlager. Der er intet ur og ingen tidspres.
Man skubber alle kasserne hen på de lysende mål. Man kan kun skubbe – ikke trække – og kun én kasse ad gangen.

- **Styring:** fire store pileknapper uden for brættet flytter lagerarbejderen ét felt. Mens blikket eller musen hviler på en pil, viser et stiplet omrids, hvor man går hen, og en lille pil viser, hvor kassen ryger hen, hvis man skubber.
- **Tryk på et felt** (mus eller touch): lagerarbejderen går dertil ad korteste vej, hvis feltet kan nås uden at skubbe noget. Trykker man på en kasse lige ved siden af, skubbes den ét felt. Ellers sker der ingenting. Hele gåturen er ét træk at fortryde.
- **Fortryd og Genstart bane:** **Fortryd** tager sidste træk tilbage, og man kan fortryde helt tilbage til start. **Genstart** sætter banen tilbage til start, og selv en genstart kan fortrydes.
- **Fastlåst kasse:** står en kasse, der ikke er på et mål, fast i et hjørne eller i en 2 × 2-klump af mure og kasser, bliver den rød med et udråbstegn, og en rolig besked foreslår Fortryd. Beskeden står i sin egen stribe under brættet (ikke oven på det), så den aldrig dækker en række felter. Advarslen kan slås fra under Indstillinger → Styring, og så bruges striben til brættet.
- **Tastatur:** piler eller WASD går, Z eller Backspace fortryder, R genstarter banen, og Esc eller P giver pause. En holdt tast gentages ikke.
- **Dwell (valgfrit, slået fra som standard):** én fuld dwell-tid på en pil er ét skridt. Bliver blikket på pilen, sker der ikke mere: blikket (eller musen) skal forlade pilen og komme tilbage før næste skridt. Med **Gentag skridt ved fortsat blik** (Indstillinger → Styring, slået fra som standard) tages i stedet et nyt skridt efter hver dwell-tid, så længe blikket bliver på pilen (med ny ring). Brættet selv er en rolig zone uden dwell, så man kan se på banen uden at gå.
- **Baner:** 30 små baner (højst 8 × 8 felter, så de alle passer på en mobil), sorteret efter sværhed: fra 3 til 62 træk og fra 1 til 4 kasser. **Par** er det færrest mulige antal træk (fundet af løseren).
- **Banevalg og fremgang:** man vælger frit blandt de åbne baner. En bane er åben, når den allerede er løst, eller når den ligger højst tre baner efter antallet af løste baner (bane 1–3 er åbne fra start). Bedste antal træk og point for hver bane gemmes i browseren. **Fortsæt** går til den første åbne bane, der ikke er løst endnu.
- **Point:** en løst bane giver højst 100 + 20 · (banenummer − 1) point (bane 1: 100, bane 30: 680). Løser man den på par eller færre træk, får man fuld pott. Ellers ganges med par/træk, dog mindst en fjerdedel, afrundet til 5.
- **Runder og top 10 (i stedet for liv og game over):** en runde starter med den første løste bane. Hver bane tæller én gang pr. runde med rundens bedste point for den. Spiller man en bane igen med færre træk, lægges kun forskellen til. **Afslut runde / Gem point** (på banevalget og i pausemenuen) gemmer rundens point i top 10 og viser **Runden er slut**. Runden huskes, også hvis man lukker siden, så intet går tabt.
- **Lyd og baggrund:** arkadens fælles lyd (`audio.js`) og baggrund (`background.js`). Effekter og musik slås til og fra hver for sig.
- **Glød:** neonskæret om streger, kasser og knapper kan slås fra under Indstillinger → Udseende → Glød. Spillet er lige så let at aflæse uden.
- **Rolig visning:** ingen blink. Er animation slået fra, eller er computeren sat til mindre bevægelse, flytter brikkerne sig uden glid.
- **Alle skærme:** man skal aldrig rulle. Knapperne er mindst ca. 80 px, og felterne er op til ca. 3,4 cm.

## Banernes oprindelse
Alle 30 baner er lavet til Hojt Arkade og er MIT som resten af spillet. De to første er tegnet i hånden som introduktion, og ligeså en lille bane med to kasser. Resten er fundet med `vaerktoej/generer-baner.js`: den laver tilfældige små rum, trækker kasserne baglæns væk fra målene og vælger den stilling, der kræver flest skub. Kandidaterne er derefter udvalgt i hånden. Der er ingen baner fra andre samlinger.

## Filer

```
index.html                 skærme: start, Om, banevalg, spil, pause, bane løst, runden er slut, indstillinger, rekorder
css/kasser.css             spillets udseende (bygger på ../arkade/arkade.css)
js/baner.js                de 30 baner (XSB-format) med par
js/game.js                 ren spillogik uden DOM: træk, skub, korteste vej, fortryd, fastlåsning, point, fremgang og runder
js/render.js               tegnelaget: læser tilstanden og kalder temaets tegnefunktioner (ingen farver)
tema/neon/tema.css         neon-temaets tokens: farver (4 paletter), streger, radier, skygger og glød
tema/neon/grafik.js        neon-temaets grafik: tegnefunktioner og SVG-ikoner, registreret som "neon"
js/app.js                  brugerflade, layout, dwell, lyd, tastatur og rekorder
test/solver.js             løser (BFS på færrest træk) – bruges af testen og generatoren
test/test-logik.js         node kasser/test/test-logik.js
test/responsiv_test.py     python3 kasser/test/responsiv_test.py (Playwright og Chrome)
vaerktoej/generer-baner.js node kasser/vaerktoej/generer-baner.js [forsøg] [frø]
```

## Temaer
Spillogikken (`js/game.js`) kender ingen farver eller grafik. Tegnelaget (`js/render.js`) læser kun spillets tilstand og kalder temaets **navngivne** tegnefunktioner. Ingen farver, skygger, glød, stregtykkelser eller radier står i JS eller i `css/kasser.css`; de er CSS-variabler i temaets `tema.css`, og canvas-koden læser dem med `getComputedStyle` (`KasserRender.readTokens`). Mål og layout (knapstørrelser, dwell, bræt) og alle tekster ligger uden for temaet.

Et nyt tema laves som en mappe `tema/<navn>/` med:

- **`tema.css`** – de samme CSS-variabler som neon: lagerets farver (`--ks-floor`, `--ks-floor-line`, `--ks-wall`, `--ks-wall-fill`, `--ks-wall-shine`, `--ks-goal`, `--ks-goal-fill`, `--ks-box`, `--ks-box-fill`, `--ks-box-done`, `--ks-box-done-fill`, `--ks-check`, `--ks-player`, `--ks-player-fill`, `--ks-preview`, `--ks-stuck`, `--ks-stuck-text`), stregmål som brøkdel af et felt (`--ks-line`, `--ks-line-min`, `--ks-floor-line-w`, `--ks-wall-shine-w`, `--ks-glow-blur`, `--ks-radius-box`, `--ks-radius-preview`, `--ks-dash`), og brugerfladens skygger, kanter og radier (`--ks-text-shadow`, `--ks-scrim`, `--ks-hall-*`, `--ks-border-w`, `--ks-radius-*`, `--ks-*-glow` osv.). Samt reglen `html.ks-gloed-fra { --glow: 0 }`.
- **`grafik.js`** – `KasserTema.registrer('<navn>', { tokens, tegn, ikoner })`, hvor
  - `tegn` har tegnefunktionerne `gulv`, `mur`, `murkant`, `maal`, `kasse` (også på mål og fastlåst), `spiller` (med retning) og `forhaandsvisning`,
  - `ikoner` har SVG-indhold (viewBox 0 0 100 100) til `hal`, `menu`, `fortryd`, `genstart`, `pil-op`, `pil-venstre`, `pil-hoejre` og `pil-ned`,
  - `tokens` kobler navnene i `T` til CSS-variablerne.

Listen over krævede navne står i `KasserTema.KRAEVET`, og logiktesten tjekker, at temaet leverer dem alle. Indtil videre findes kun neon (med paletterne neon, solnedgang, cyberpunk og høj kontrast fra arkadens fælles temavalg).

**Glød slås fra** under Indstillinger → Udseende → Glød → Fra. Det sætter klassen `ks-gloed-fra` på `<html>`, som sætter arkadens glød-faktor `--glow` til 0. Alle skygger i CSS ganges med `--glow`, og canvas-gløden ganges med `T.glod` (læst fra `--glow`), så alt neonskær forsvinder. Høj kontrast sætter også `--glow: 0`. Baggrundens synthwave-effekter vælges med arkadens fælles indstilling Baggrund (Mørk er rolig).

## Test
- `node kasser/test/test-logik.js` tjekker gang, skub, blokeret skub (mur og to kasser i træk), fortryd og genstart, korteste vej ved tryk, fastlåste kasser, point, fremgang, runder og top 10, og temaet: alle krævede tegnefunktioner og ikoner findes, alle tokens er defineret i `tema.css`, der står ingen hex/rgb-farver eller faste skygger i koden, og med glød fra tegnes intet med glød. Løseren løser alle 30 baner og bekræfter, at par er det færrest mulige antal træk.
- `python3 kasser/test/responsiv_test.py` tjekker alle skærme ved 8 opløsninger (ingen rulning, intet klippet af, ingen overlap, knapper ≥ 80 px og ingen konsolfejl). Den spiller også i browseren: taster, pileknapper, tryk på felter, fortryd, genstart, dwell (ét skridt pr. dwell og kig væk/tilbage, og gentagelse når indstillingen er slået til), fastlåst kasse, bane løst, afslut runde fra pausemenuen, glød fra og rekorden efter genindlæsning, og den tjekker hallen. Ved alle 8 opløsninger tjekker den også, at beskeden om fastlåst kasse hverken dækker brættet eller nogen knap. Med `KASSER_SKAERMBILLEDER=/mappe` gemmes skærmbilleder.

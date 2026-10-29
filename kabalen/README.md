# Kabalen

Del af **Hojt Arkade** af Jon Leismann Engsager / Hojt Design (MIT).
Spillet kører direkte fra `index.html` uden server og uden internet (også fra `file://`).

### Kabalen
Klassisk kabale (Klondike) med 52 kort. Der er intet ur og ingen tidspres, og spillet venter altid på dig.

## Regler

- **Udlægning:** syv bunker med 1–7 kort. Det øverste kort i hver bunke vender op, resten har bagsiden op. Resten af kortene (24) ligger i **bunken** øverst til venstre.
- **Mål:** byg de fire **grundbunker** op fra es til konge, én for hver kulør (♠ ♥ ♣ ♦). Spillet er vundet, når alle 52 kort ligger på grundbunkerne.
- **Bunkerne:** et kort kan lægges på et kort, der er én højere og har den modsatte farve (rød på sort, sort på rød). Et kort flyttes sammen med alle kortene ovenpå. Kun en **konge** (med kortene ovenpå) kan lægges på en tom plads. Når det sidste åbne kort er flyttet fra en bunke, vendes kortet nedenunder.
- **Bunken:** et tryk på bunken vender et kort (**Træk 1**) eller tre kort (**Træk 3**) over på de vendte kort. Kun det øverste vendte kort kan spilles. Når bunken er tom, vender et tryk den om igen. Det kan man gøre så mange gange, man vil, og det koster ikke noget.
- **Grundbunken tilbage:** det øverste kort på en grundbunke kan tages ned igen på en bunke (det koster point).
- **Helt tilfældig blanding:** hvert spil blandes med en ren Fisher–Yates-blanding med browserens kryptografiske tilfældighed (`crypto.getRandomValues`, uden skævhed). Ingen spil sorteres fra, så det er tilfældigt, om et spil kan gå op, ligesom med rigtige kort. Nogle spil kan ikke vindes.
- **Automatisk afslutning:** når alle kort er vendt, og bunken er tom, lægges resten op af sig selv, ét kort ad gangen.
- **Sidder fast:** efter hvert træk tjekker spillet, om du kan komme videre. Det tjekker, om et kort kan vendes, om et kort kan lægges op, og om et kort fra bunken kan bruges, også efter at bunkerne er flyttet rundt. Kan ingen af delene lade sig gøre, kommer en boks med **Fortryd** (prøv en anden vej) eller **Game over** (serien slutter, og pointene gemmes). Da kortene er blandet tilfældigt, kan et spil være umuligt fra starten. Så ender det før eller siden her eller med **Giv op**.

## Serien og point

Spillet er en **serie uden ende**. Vinder du et spil, får du spillets point plus en sejrsbonus, og det næste spil bliver givet. Serien slutter, når du **giver op**, vælger **Stop her** efter en sejr, eller sidder fast og vælger **Game over**. Så vises **Serien er slut**, og summen gemmes på top 10 (én liste for Træk 1 og én for Træk 3).

| Hvad | Point |
|---|---|
| Kort lagt på en grundbunke | +10 |
| Kort vendt i en bunke | +5 |
| Kort fra bunken (de vendte kort) lagt på en bunke | +5 |
| Kort taget ned fra en grundbunke | −15 |
| Fortryd (ubegrænset) | trækkets point tages tilbage, og fortrydelsen koster yderligere −2 |
| Vundet spil | +200 i sejrsbonus |
| Bonus for få træk | (150 − antal træk) × 2, aldrig under 0 |

Et træk er hvert kort eller hver række, du flytter. **Saml** tæller som ét træk. At trække fra bunken og den automatiske afslutning tæller ikke som træk. **Hint** er gratis. Summen for serien bliver aldrig negativ. Et spil, der ikke blev vundet, tæller med de point, det nåede at få.

## Styring

- **Vælg et kort:** kortet og alle kortene ovenpå bliver valgt (gul ramme), og alle lovlige **mål** lyser grønt med en ring. Vælg et mål, så lægges kortene dér. Har kortet kun ét mål, kan du også bare vælge **samme kort igen**, så flytter det. Vælger du det valgte kort igen, når der er flere mål, eller vælger du noget, der ikke er et mål, fortrydes valget. Kan kortet ikke flyttes, står der det i linjen.
- **Knapper:** **Fortryd** (ubegrænset, −2 point pr. gang), **Hint** (viser et godt træk med en stiplet ramme om kortet og målet. Hintet kommer fra løseren, når den finder en vej til sejr, og ellers fra et enkelt, fornuftigt træk. Løseren bruges kun til hint, aldrig til at vælge spil), **Saml** (lægger alle sikre kort på grundbunkerne i ét træk. Er der ingen sikre kort, lægges de kort op, der kan), **Giv op** (afslutter serien efter et "Er du sikker?") og **Pause**.
- **Tastatur:** 1–7 vælger det øverste åbne kort i bunke 1–7 (og lægger kortene i bunken, hvis et kort er valgt). G eller F vælger grundbunken som mål. V eller W vælger det vendte kort. Mellemrum, T eller D trækker fra bunken. U, Z eller Backspace fortryder. H giver hint, og S samler. Esc fravælger et valgt kort eller holder pause, og P holder også pause. Kortene kan også nås med Tab og Enter.
- **Mus og tryk:** klik eller tryk på kort og pladser.
- **Dwell (valgfrit, slået fra som standard):** kort, pladser og knapper vælges, når du har kigget på dem i den valgte tid, og en ring fyldes imens. Ét dwell er altid én handling. Når kortene har flyttet sig, kan det kort, der lander under blikket, først dwelles, når blikket har været væk fra det.
- **Store mål:** alle knapper og alle kort og pladser, der kan vælges med dwell, er mindst 84 px (ca. 3 cm, når der er plads). Lange bunker presses sammen. Kort med bagsiden op samles i en lille stak med et tal for, hvor mange der er. Åbne kort, der ikke kan flyttes, bliver til smalle striber, og er bunken stadig for lang, samles de nederste åbne kort under en **+N**-mærkat. Et tryk på **+N** vælger det nederste af de samlede kort, der kan flyttes. Smalle striber kan klikkes på, men de kan ikke dwelles. Det kan kun de store mål.
- **Alle skærme:** man skal aldrig rulle. På en bred skærm står knapperne ved siden af bordet, og på en høj skærm står de under bordet. På en smal skærm på højkant (fx en telefon) står bordet i fire kolonner: grundbunkerne øverst, bunke 1–4, og derefter bunke 5–7 med bunken og de vendte kort i fjerde kolonne. Layoutet med de største kort vælges.
- **Rolig visning:** intet blinker. Kortene glider kort på plads (220 ms). Er animation slået fra, eller er computeren sat til mindre bevægelse, skifter kortene plads uden overgang. **Glød** kan slås fra under Indstillinger → Udseende, og spillet kan læses lige så godt uden. Røde kulører er hule, og sorte er fyldte, så farverne også kan skelnes uden farve.

## Test

- `node kabalen/test/spillogik.test.js` tjekker:
  - regler, udlægning, træk 1 og træk 3 og point;
  - blandingen: 52 unikke kort, ingen to ens blandinger af 500, jævn fordeling (hvert kort lige ofte på hver plads), og at der ikke findes nogen generator af løselige spil;
  - sikre kort og løseren (som kun bruges til hint). Testen finder selv et spil, løseren kan vinde, og spiller løsningen færdig med spillets egne træk, også i bidder og med Træk 3. En umulig stilling skal afvises;
  - sejr og bonus, fortryd, mål for et valgt kort, Saml og Hint. Følger man hintene, vinder man;
  - automatisk afslutning, "sidder fast" og serien.
- `node kabalen/test/temaklar.test.js` tjekker, at spillet er klar til flere temaer:
  - ingen farver, glød, skygger, skrift, streger eller hjørner i JS eller layout-CSS;
  - alle variabler defineres af temaet;
  - glød kan slås fra;
  - temaet leverer alle ikoner, kulører og bagsiden.
- `python3 kabalen/test/responsiv_test.py` (Playwright og Chrome) tjekker alle skærme ved 8 opløsninger:
  - at udlægningen er en ren blanding (52 unikke kort), og at ingen tekst påstår, at spillet kan vindes;
  - ingen rulning og mindst 84 px for knapper, kort og pladser, der kan vælges;
  - ingen fejl i konsollen;
  - spil med mus og tastatur: valg med mål, samme kort igen og bunken;
  - Hint, Saml, Fortryd, pause og glød fra;
  - et helt spil vundet med løserens træk (testen lægger selv et vindbart spil ind), sejrsboks og Næste spil;
  - "sidder fast", Stop her, Serien er slut og rekorden, Træk 3, Giv op med bekræftelse, dwell og hallen.

  Skærmbilleder gemmes, hvis `KABALEN_SKAERMBILLEDER=<mappe>` er sat. Testen gør tilfældigheden fast (`Math.random` og `crypto`), så en fejl kan gentages. `SEED=<tal>` giver andre spil.

## Filer

- `index.html`: skærmene (start, spil, pause, spil vundet, sidder fast, bekræft, Serien er slut, indstillinger, rekorder og Om).
- `js/logik.js`: spillogikken uden DOM og uden grafik. Den rummer regler, træk, point, den tilfældige blanding, løseren til hint (som kan køres i bidder), "sidder fast", Saml, Hint, fortryd og serien.
- `js/tegn.js`: tegnelaget. Det bygger 52 kort, pladserne og tallene, placerer dem og presser lange bunker sammen. Det kender ingen farver.
- `js/lyd.js`: spillets lyde. De laves i browseren med Web Audio, uden lydfiler, og er bløde og korte.
- `js/app.js`: skærme, styring (mus, tryk, tastatur og dwell), layout, indstillinger og rekorder.
- `css/kabalen.css`: opbygning og mål. Farver, glød, skygger, streger, hjørner og skrift kommer kun fra temaets variabler.
- `tema/neon/tema.css` og `tema/neon/grafik.js`: temaet (se nedenfor).
- Fælles moduler fra `../arkade/`: indstillinger, dwell, musik, rekorder, baggrund og fælles stil.

## Temaet

Al grafik ligger i `tema/neon/`. Spilkoden henter den kun ved navn. Et nyt tema er derfor en ny mappe `tema/<navn>/` med de samme to filer, som `index.html` peger på i stedet. Det kan fx være Tegneserie (ligne claire), Papirklip, Art deco eller Ler, så spillet kan bære fem temaer.

### Grafik, et tema skal levere (`grafik.js` → `window.KabaleTema`)

Alt er SVG-indhold i et 100 × 100-felt og farves kun med klasser. Farverne kommer fra `tema.css`.

| Navn | Hvad | Klasser |
|---|---|---|
| `kulorer.spar`, `kulorer.hjerter`, `kulorer.klor`, `kulorer.ruder` | de fire kulørsymboler (i hjørnet og stort midt på kortet, og svagt på de tomme grundbunker) | `ks-flade` (symbolet) og `ks-ind` (indre felt, der gør de røde kulører hule, så de kan skelnes uden farve) |
| `bagside` | mærket midt på kortenes bagside og på bunken | `bg-line`, `bg-fill` |
| `ikoner.tilbage`, `fortryd`, `hint`, `saml`, `opgiv`, `pause`, `vend`, `traek` | ikoner til knapperne. `vend` vises på en tom bunke, der kan vendes om | `ico-line`, `ico-fill` |
| `lyde` (valgfri) | et tema kan ændre lydenes tone. Se `js/lyd.js` | – |

`js/tegn.js` lægger grafikken ind som `#ka-kulor-<navn>`, `#ka-bagside` og `#ka-ikon-<navn>`.

### CSS-variabler, `tema.css` skal sætte

De skal sættes for hver farvepalet, dvs. arkadens Tema-valg: `[data-theme="neon|solnedgang|cyberpunk|kontrast"]`.

- *Kort:* `--ka-kort-bg`, `--ka-kort-kant`, `--ka-rod`, `--ka-sort`, `--ka-texture` (mønster eller billede på forsiden, fx papir eller ler. `none` i neon).
- *Bagside:* `--ka-bag-bg`, `--ka-bag-bg2`, `--ka-bag-line`, `--ka-bag-kant`, `--ka-bag-fill`, `--ka-bagside` (baggrund, fx en stribet gradient).
- *Pladser og tal:* `--ka-plads-kant`, `--ka-plads-bg`, `--ka-plads-ikon`, `--ka-plads-stil` (kantstil på tomme pladser, fx `dashed`), `--ka-kant-stil` (fuld kant), `--ka-tal-bg`, `--ka-tal`, `--ka-tal-kant` (mærkerne med antal skjulte kort og +N).
- *Markering:* `--ka-valgt`, `--ka-valgt-bg` (valgte kort), `--ka-maal`, `--ka-maal-bg` (lovlige mål), `--ka-tip` (hint), `--ka-ok`, `--ka-err`.
- *Øvrige farver:* `--ka-shadow`, `--ka-overlay-bg`, `--ka-overlay-soft`, `--ka-hall-bg`, `--ka-hall-bg-hover`, `--ka-hall-border`, `--ka-swatch-border`.
- *Skrift:* `--ka-font-kort`, `--ka-weight-kort`, `--ka-weight-tal`.
- *Streger og hjørner:* `--ka-kort-kant-w`, `--ka-plads-kant-w`, `--ka-valgt-w`, `--ka-maal-w`, `--ka-tip-w`, `--ka-stroke-ico`, `--ka-stroke-hall`, `--ka-stroke-kulor`, `--ka-stroke-bag`, `--ka-hall-border-w`, `--ka-block-w`, `--ka-radius-kort`, `--ka-radius-hud`, `--ka-radius-tal`, `--ka-radius-swatch`, `--ka-radius-maal`.
- *Bevægelse:* `--ka-glid-ms` (hvor længe kortene glider).
- *Glød og skygger:* `--ka-kort-skygge`, `--ka-kort-glow`, `--ka-kulor-glow`, `--ka-valgt-glow`, `--ka-maal-glow`, `--ka-tip-glow`, `--ka-bag-glow`, `--ka-score-glow`, `--ka-points-glow` samt `--ka-text-shadow` og `--ka-text-shadow-strong`. Alle er `box-shadow`-, `text-shadow`- eller `filter`-værdier, så et papirtema kan bruge en hård skygge i stedet. Under `html[data-ka-gloed="fra"]` skal de være `none`. Spillet må ikke have brug for glød for at kunne aflæses.
- *Farveprøver i Indstillinger:* `.swatch[data-farver="…"]` med `--a`, `--b` og `--c`.

Tekster, mål og layout hører ikke til temaet og er ens for alle temaer. Tegnelaget sætter selv `--ka-cw`, `--ka-ch`, `--ka-idx`, `--ka-idx-tynd` og `--ka-badge` (kortenes mål).

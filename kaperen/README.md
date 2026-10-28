# Kaperen

Et roligt, turbaseret sørøver- og handelsspil til Højt Arkade. Der er intet tidspres. Du starter med en slup og 300 guld i Tågeskær på et nyt, tilfældigt hav, der ligger i tåge. Du sejler ud felt for felt og opdager øer, 7 andre havne og andre skibe. Du køber billigt og sælger dyrt, og du kan kæmpe, flygte eller borde, når du møder andre skibe til søs. Spillet kører, til du synker, bliver taget af marinen, sulter, mister mandskabet eller selv vælger at **gå i land**.

**Point = formue (guld + lastens værdi + skibets værdi) + 75 × berømmelse.** Faktoren er valgt ved simulering (se nedenfor), så en dygtig sørøver i snit slår handel, men oftere taber. Top 10 gemmes i arkadens fælles highscores (`hojtArkade.kaperen.*`).

Spillet kører offline, også direkte fra `file://`. Det bruger ingen CDN og intet framework.

## Sådan spiller du

* **I havn** er der fire faner:
  * **Marked:** 5 varer (rom, sukker, krydderier, tobak og silke). Priserne svinger fra havn til havn, og hver havn har sine billige og dyre varer. Knapperne viser prisen på forhånd. Hvert køb hæver prisen en smule, og hvert salg sænker den.
  * **Værft:** reparér skroget, køb kanoner, få bedre sejl eller større lastrum, køb en **kikkert** (synsvidde 2 → 3 → 4 felter) og køb et større skib (slup → brig → fregat → galeon).
  * **Værtshus:** hyr mandskab, køb proviant, hør rygter om priserne i de havne, du kender, og køb et **rygte om en ukendt havn** (25 guld), som så tegnes ind på søkortet.
  * **Til søs:** viser havet omkring skibet.
* **Havet** ses fra skibet: det, du kan se lige nu (synsvidden), er klart; det, du har set før, er dunkelt; resten ligger i tåge. Ét felt = én dag = én proviant pr. dag. Du sejler med de 8 kompasknapper eller ved at vælge et nabofelt på kortet. Midt i kompasset åbner **Kort** søkortet. Den store knap er **Vent en dag** til søs og **Gå i havn**, når du ligger ved en havn. Uden proviant mister du folk hver dag.
* **Søkortet** viser det, du har opdaget, og de havne, du kender. Vælg en havn, se dage, proviant og priser, og **sæt kurs**: skibet sejler selv over kendt hav, ét felt ad gangen, og stopper, hvis et skib kommer i sigte, proviantet slipper op, eller der sker noget. Du kan altid stoppe kursen.
* **Andre skibe** ses inden for synsvidden. Handelsskibe holder afstand, og marinen jager dig fra **berømmelse 10**. Et skib, der kommer helt hen til dig (eller som du sejler ind i), giver et møde.
* **Sørøvere angriber aktivt**, også når du handler fredeligt. De jager dig, når de ser dig, og når en sørøver selv når hen til dig, er det et **overfald**: den ligger lige ved siden af, kaster entrehager og **entrer selv**, når den har mindst 80 % så mange folk som dig. Taber du kampen om bord, mister du folk, **60 % af guldet og 60 % af hver vare**. Jo mere berømt du er, des flere og stærkere sørøvere er der (flere folk, kanoner og skrog), og des længere væk ser de dig. Ved berømmelse 0 er de få og svage.
* **Møder til søs** er turbaserede, og hver handling viser sin chance på knappen:
  * **Handelsskib:** angrib, eller lad det sejle videre.
  * **Sørøvere og marinen:** skyd, sejl nærmere, bord eller flygt.
  * **Storm** (kan ske på enhver dag til søs): rid stormen af (skroget tager skade), eller søg læ ved en ø (2 dage og 2 proviant mere).
  * Kapring giver stort bytte: **8 × skibets guld og 3 × dets last** (så meget, der er plads til) og berømmelse (handelsskib 3, sørøver 5 + niveau, marinen 12 + niveau). Et sænket skib giver 30 % af guldet og lidt mindre berømmelse. Ved berømmelse 10 og derover bliver marinen fjendtlig.
* **Gå i land** (via menuen eller pausen, med bekræftelse, kun i en havn) afslutter rejsen og gemmer pointene.
* Et spil i gang gemmes automatisk med alt, hvad du har opdaget, og du kan fortsætte det fra startskærmen. Et gemt spil fra version 1 (det faste kort) indlæses med skib, guld og last i den samme havn på et nyt hav i tåge.

### Balancen og berømmelsesfaktoren (simulering)

`node test/simulering.js 1000 150` spiller 1000 tilfældige have × 3 robotkaptajner i op til 150 dage: en **handelsmand** (handler og flygter), en **kaper** (handler, men kaprer handelsskibe, når han er stærkest og lasten er tom) og en **pirat** (jager kun skibe, sælger byttet, når lastrummet er halvt fuldt, og går i land ved berømmelse 15, når marinen og de andre sørøvere for alvor jager ham). Tabte spil er sunket (også i storm), taget af marinen eller sultet:

| Stil | Median point (F = 75) | Tabt i alt | Sunket | Taget | Sultet |
|---|---|---|---|---|---|
| handel | 4423 | 19 % | 1 % | 0 % | 19 % |
| kaper | 5757 | 24 % | 9 % | 0 % | 15 % |
| pirat | 5645 | 33 % | 19 % | 1 % | 13 % |

Median-point ved andre faktorer F: F = 25: handel 4399, pirat 4884 · F = 50: handel 4399, pirat 5260 · **F = 75: handel 4423, pirat 5645** · F = 100: handel 4433, pirat 6019. Med F = 75 slår sørøveren handel i snit (pirat bedst i 58 % af spillene), men taber næsten dobbelt så tit, og han synker langt oftere. Mest giver blandingen (kaperen).

## Styring

* **Mus/touch:** alle handlinger er store knapper. Dwell kan slås til under Indstillinger (det er slået fra som standard).
* **Tastatur:**
  * `1`–`5` vælger en vare, `K`/`S` køber og sælger (med `Skift` handler du 5 ad gangen).
  * `M`/`V`/`T` skifter mellem marked, værft og værtshus.
  * Til søs: piletasterne sejler mod N/S/Ø/V, `Home`/`PgUp`/`End`/`PgDn` på skrå (eller numpad `7` `9` `1` `3`; `8` `2` `4` `6` lige ud), `Mellemrum`/`5` venter en dag, `K` åbner søkortet, `Enter` går i havn, `Backspace` stopper kursen.
  * På søkortet: piletasterne vælger havn, `Enter` sætter kurs, `Backspace`/`K` går tilbage.
  * I møder: `S` skyd, `N` nærmere, `B` bord og `F`/`V` flygt eller sejl videre. I storm: `R` rid stormen af og `L` søg læ.
  * `Esc`/`P` sætter på pause.

## Filer

```
kaperen/
  index.html            skærme og markup
  css/kaperen.css       layout (kun CSS-variabler; ingen farver)
  js/logik.js           ren spillogik, uden DOM (bruges også af testene)
  js/tegn.js            tegnelaget: bygger SVG-scener, havet og søkortet ud fra temaets elementer
  js/lyd.js             spillets egne lyde (WebAudio via ArkadeAudio)
  js/app.js             skærme, input, layout, gem/fortsæt og highscores
  tema/neon/tema.css    alle farver, streger, glød og skygger (--kap-*)
  tema/neon/grafik.js   navngivne grafikelementer (window.KaperenTema)
  test/spillogik.test.js   node-tests af logikken
  test/simulering.js       robotkaptajner til at vælge berømmelsesfaktoren
  test/responsiv_test.py   Playwright-test ved 8 skærmstørrelser
```

Logik og tegning er adskilt. `logik.js` kender ikke til DOM'en, og `tegn.js`/`app.js` ændrer aldrig spillets tilstand direkte.

## Temaer – det skal et nyt tema levere

Et tema er en mappe `tema/<navn>/` uden æ, ø og å, fx `ligne-claire`, `papirklip`, `art-deco` eller `ler`. Mappen skal have to filer, og `index.html` peger på dem.

### 1. `grafik.js`: sætter `window.KaperenTema` med de samme navne

Elementerne må ikke indeholde farver. Alt farves med klasserne nedenfor.

| Nøgle | Indhold | viewBox | Klasser |
|---|---|---|---|
| `skibe.slup`, `.brig`, `.fregat`, `.galeon` | skib set fra siden med stævnen mod højre og vandlinjen ved y = 80 | 0 0 100 100 | `kap-skrog`, `kap-skrog-kant`, `kap-mast`, `kap-sejl`, `kap-kanonport` |
| `flagPunkt.<skib>` | `[x, y]` for toppen af masten (der sættes flaget) | – | – |
| `flag.spiller`, `.handel`, `.pirat`, `.marine` | flag, der skal kunne skelnes på tegnet og ikke kun på farven | 0 0 40 26 | `kap-flag-dug`, `kap-flag-tegn` |
| `felter.land` | et landfelt (flisebelægges, så det skal kunne ligge kant i kant) | 0 0 100 100 | `kap-felt-land-flade` |
| `felter.top[0..2]` | pynt på land: palme, bjerg og skov (vælges fast pr. felt) | 0 0 100 100 | `kap-felt-top-streg`, `kap-felt-top-fyld` |
| `felter.havn` | en havn på et havfelt: mole, hus og lanterne | 0 0 100 100 | `kap-havn-mole`, `kap-havn-hus`, `kap-havn-lys` |
| `taage` | indholdet af et `<pattern>` med tågeskyer og slør over det ukendte | 0 0 40 40 | `kap-taage-sky`, `kap-taage-sloer` |
| `maal` | ring om den valgte havn på søkortet | 0 0 100 100 | `kap-maal-ring` |
| `kortskib` | skibet på havet, set oppefra og pegende mod højre (drejes i 8 retninger) | 0 0 40 40 | `kap-kortskib-krop`, `kap-kortskib-sejl` |
| `effekter.plask`, `.traef`, `.roeg` | vandsøjle ved forbier, træf og krudtrøg | 0 0 40 40 | `kap-plask`, `kap-traef`, `kap-roeg` |
| `effekter.storm` | sky, regn og et **fast** lyn (intet blinker) | 0 0 100 60 | `kap-storm-sky`, `kap-storm-regn`, `kap-storm-lyn` |
| `havMoenster` | indholdet af et `<pattern>` med bølger | 0 0 60 30 | `kap-hav-boelge` |
| `ikoner.<navn>` (38 stk.) | knap- og HUD-ikoner | 0 0 100 100 | `ico-line`, `ico-fill` |

Ikonnavnene er: `anker beroemmelse bord dag flygt guld kanon kikkert kort krydderier kurs laa land last lastrum mandskab marked menu naermere nytskib pil proviant reparer rom rygte sejl silke skrog skyd stop storm sukker tilbage tobak vaerft vaerthus vent videre`. `pil` peger mod nord og drejes af CSS til de 8 retninger.

Andre skibe på havet tegnes med `kortskib` og deres flag (`flag.handel` osv.), så de kan skelnes på flaget og ikke kun på farven.

### 2. `tema.css`: sætter variablerne på `:root`

* **Hav, himmel og kort:** `--kap-hav-1`, `--kap-hav-2`, `--kap-hav-boelge`, `--kap-hav-moenster-synlig`, `--kap-himmel-1`, `--kap-himmel-2`, `--kap-horisont`, `--kap-kort-gloed`, `--kap-gitter`, `--kap-kortskib`, `--kap-kortskib-sejl`, `--kap-havn-bg`, `--kap-havn-her`
* **Land og havne:** `--kap-felt-land`, `--kap-kyst`, `--kap-kyst-w`, `--kap-felt-top`, `--kap-felt-top-fyld`, `--kap-havn-mole`, `--kap-havn-hus`, `--kap-havn-lys`, `--kap-havn-navn`, `--kap-havn-navn-valgt`
* **Tåge og udsyn:** `--kap-taage`, `--kap-taage-sky`, `--kap-taage-sloer`, `--kap-taage-moenster-synlig`, `--kap-dunkel` (set før, men ikke i syne nu), `--kap-synsvidde`, `--kap-verdens-kant`
* **Kurs og valg:** `--kap-kurs`, `--kap-kurs-w`, `--kap-maal`, `--kap-felt-valg`, `--kap-felt-valg-kant` (nabofeltet under musen/blikket)
* **Skibe og flag:** `--kap-skrog`, `--kap-skrog-kant`, `--kap-spiller-skrog-kant`, `--kap-mast`, `--kap-sejl`, `--kap-sejl-kant`, `--kap-kanonport`, `--kap-flag-dug`, `--kap-flag-spiller`, `--kap-flag-handel`, `--kap-flag-pirat`, `--kap-flag-marine`, `--kap-flag-w`
* **Effekter:** `--kap-plask`, `--kap-traef`, `--kap-roeg`, `--kap-storm-sky`, `--kap-storm-regn`, `--kap-storm-lyn`
* **UI og status:** `--kap-hud-bg`, `--kap-hud-border`, `--kap-guld`, `--kap-guld-gloed`, `--kap-billig`, `--kap-dyr`, `--kap-ok`, `--kap-fejl`, `--kap-bar`, `--kap-bar-lav`, `--kap-bar-tom`, `--kap-overlay-bg`, `--kap-ikon-paa-fyld`, `--kap-swatch-border`, `--kap-hall-bg`, `--kap-hall-bg-hover`
* **Form og streger:** `--kap-font`, `--kap-kontur`, `--kap-kontur-w`, `--kap-streg-w`, `--kap-ikon-w`, `--kap-block-w`, `--kap-frame-w`, `--kap-hall-border-w`, `--kap-hall-ikon-w`, `--kap-radius-hud`, `--kap-radius-kort`, `--kap-radius-bar`, `--kap-radius-swatch`
* **Glød og skygge:** `--kap-gloed-filter`, `--kap-gloed-filter-accent`, `--kap-text-shadow`, `--kap-shadow`, `--kap-skygge`. Under `html[data-kap-gloed="fra"]` skal glød-variablerne være `none`.

Temaet må gerne bruge arkadens egne variabler (`--bg`, `--ui`, `--accent`, `--muted` …), men CSS'en og JS'en uden for `tema/` må ikke indeholde farver.

## Test

```
node test/spillogik.test.js
python3 test/responsiv_test.py            # alle 8 størrelser (ONLY=390x844,... for et udvalg)
KAPEREN_SKAERMBILLEDER=/sti python3 test/responsiv_test.py   # gemmer skærmbilleder
```

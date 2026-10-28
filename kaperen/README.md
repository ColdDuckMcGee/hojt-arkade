# Kaperen

Et roligt, turbaseret sørøver- og handelsspil til Højt Arkade. Der er intet tidspres. Du sejler mellem 8 havne, køber billigt og sælger dyrt, og du kan kæmpe, flygte eller borde, når du møder andre skibe til søs. Spillet kører, til du synker, bliver taget af marinen, sulter, mister mandskabet eller selv vælger at **gå i land**.

**Point = formue (guld + lastens værdi + skibets værdi) + 10 × berømmelse.** Top 10 gemmes i arkadens fælles highscores (`hojtArkade.kaperen.*`).

Spillet kører offline, også direkte fra `file://`. Det bruger ingen CDN og intet framework.

## Sådan spiller du

* **I havn** er der fire faner:
  * **Marked:** 5 varer (rom, sukker, krydderier, tobak og silke). Priserne svinger fra havn til havn, og hver havn har sine billige og dyre varer. Knapperne viser prisen på forhånd. Hvert køb hæver prisen en smule, og hvert salg sænker den.
  * **Værft:** reparér skroget, køb kanoner, få bedre sejl eller større lastrum, og køb et større skib (slup → brig → fregat → galeon).
  * **Værtshus:** hyr mandskab, køb proviant og hør rygter om priserne i andre havne.
  * **Til søs:** åbner kortet.
* **På kortet** vælger du en havn. Panelet viser dage, proviant og risiko, og så sejler du. Hver rejsedag spiser mandskabet proviant.
* **Møder til søs** er turbaserede, og hver handling viser sin chance på knappen:
  * **Handelsskib:** angrib, eller lad det sejle videre.
  * **Sørøvere og marinen:** skyd, sejl nærmere, bord eller flygt.
  * **Storm:** rid stormen af (skroget tager skade), eller søg læ ved en ø (2 dage mere).
  * Kapring og sejre giver bytte og berømmelse. Ved berømmelse 10 og derover bliver marinen fjendtlig.
* **Gå i land** (via menuen eller pausen, med bekræftelse) afslutter rejsen og gemmer pointene.
* Et spil i gang gemmes automatisk, og du kan fortsætte det fra startskærmen.

## Styring

* **Mus/touch:** alle handlinger er store knapper. Dwell kan slås til under Indstillinger (det er slået fra som standard).
* **Tastatur:**
  * `1`–`5` vælger en vare, `K`/`S` køber og sælger (med `Skift` handler du 5 ad gangen).
  * `M`/`V`/`T` skifter mellem marked, værft og værtshus.
  * Piletaster og `Enter` vælger havn og sejler, `Backspace` går tilbage.
  * I møder: `S` skyd, `N` nærmere, `B` bord og `F`/`V` flygt eller sejl videre. I storm: `R` rid stormen af og `L` søg læ.
  * `Esc`/`P` sætter på pause.

## Filer

```
kaperen/
  index.html            skærme og markup
  css/kaperen.css       layout (kun CSS-variabler; ingen farver)
  js/logik.js           ren spillogik, uden DOM (bruges også af testene)
  js/tegn.js            tegnelaget: bygger SVG-scener og kort ud fra temaets elementer
  js/lyd.js             spillets egne lyde (WebAudio via ArkadeAudio)
  js/app.js             skærme, input, layout, gem/fortsæt og highscores
  tema/neon/tema.css    alle farver, streger, glød og skygger (--kap-*)
  tema/neon/grafik.js   navngivne grafikelementer (window.KaperenTema)
  test/spillogik.test.js   node-tests af logikken
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
| `oeer[0..3]` | 4 øformer (strækkes på kortet, så stregen er ikke-skalerende) | 0 0 100 60 | `kap-oe-strand`, `kap-oe-land`, `kap-oe-top` |
| `kortskib` | skibet på kortet, set oppefra og pegende mod højre | 0 0 40 40 | `kap-kortskib-krop`, `kap-kortskib-sejl` |
| `kompas` | kompasrose | 0 0 100 100 | `kap-kompas-ring`, `kap-kompas-pil`, `kap-kompas-n` |
| `effekter.plask`, `.traef`, `.roeg` | vandsøjle ved forbier, træf og krudtrøg | 0 0 40 40 | `kap-plask`, `kap-traef`, `kap-roeg` |
| `effekter.storm` | sky, regn og et **fast** lyn (intet blinker) | 0 0 100 60 | `kap-storm-sky`, `kap-storm-regn`, `kap-storm-lyn` |
| `havMoenster` | indholdet af et `<pattern>` med bølger | 0 0 60 30 | `kap-hav-boelge` |
| `ikoner.<navn>` (39 stk.) | knap- og HUD-ikoner | 0 0 100 100 | `ico-line`, `ico-fill` |

Ikonnavnene er: `anker beroemmelse bord dag flygt guld handel kanon kort krydderier laa land last lastrum mandskab marine marked menu naermere nytskib pirat plask proviant reparer roeg rom rygte sejl silke skrog skyd spiller storm sukker tilbage tobak traef vaerft vaerthus videre`.

### 2. `tema.css`: sætter variablerne på `:root`

* **Hav, himmel og kort:** `--kap-hav-1`, `--kap-hav-2`, `--kap-hav-boelge`, `--kap-hav-moenster-synlig`, `--kap-himmel-1`, `--kap-himmel-2`, `--kap-horisont`, `--kap-kort-gloed`, `--kap-rute`, `--kap-rute-w`, `--kap-rute-valgt`, `--kap-rute-valgt-w`, `--kap-kompas`, `--kap-kompas-pil`, `--kap-kortskib`, `--kap-kortskib-sejl`, `--kap-havn-bg`, `--kap-havn-her`
* **Øer:** `--kap-oe-strand`, `--kap-oe-strand-kant`, `--kap-oe-land`, `--kap-oe-top`, `--kap-oe-top-fyld`
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

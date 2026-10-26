# Lys ud

Del af **Hojt Arkade** af Jon Leismann Engsager / Hojt Design (MIT).
Spillet kører direkte fra `index.html` uden server og uden internet (også fra `file://`).

### Lys ud
Et roligt logikspil med runde neonlamper. Der er intet ur og ingen tidspres.
Når man vælger en lampe, skifter den og de fire lamper ved siden af: tændte slukkes, og slukkede tændes. Målet er at slukke dem alle. Banerne bliver ved, til man selv vælger **Afslut**.

- **Styring:** vælg en lampe med klik, tryk eller dwell. Mens blikket eller musen hviler på en lampe, er den og de lamper, der skifter, markeret med et svagt blåt omrids. Markeringen kan slås fra under Indstillinger.
- **Tændt og slukket:** en tændt lampe er en fyldt, lysende skive med stråler. En slukket lampe er en tom ring med stiplet kant. Forskellen ses altså på formen og ikke kun på farven, også i høj kontrast.
- **Fortryd og Forfra:** **Fortryd** tager sidste træk tilbage, og man kan fortryde lige så mange gange, man vil. **Forfra** sætter banen tilbage til sin start.
- **Tip:** viser én lampe fra en korteste løsning af pladen, som den ser ud nu, med en grøn ring og ordet TIP. Et tip koster 25 point.
- **Tastatur:** piletasterne flytter markøren, Enter eller mellemrum vælger lampen, Z eller Backspace fortryder, R starter forfra, T giver et tip, og Esc eller P giver pause.
- **Dwell (valgfrit, slået fra som standard):** hver lampe og hver knap vælges én gang, og der gentages aldrig, mens blikket bliver på den.
- **Plader:** lille (3 × 3), mellem (4 × 4) eller stor (5 × 5). Standard er 5 × 5. Alle plader kan løses, og ingen er klaret fra start. Spillet regner den korteste løsning ud (lineær algebra over GF(2)), og **Færrest mulige** viser antallet af træk. Det tal vokser langsomt fra bane til bane: på 5 × 5 fra 4 til 13 træk, og på 3 × 3 og 4 × 4 fra 3 til 7.
- **Point:** en klaret bane giver 20 point pr. træk i den korteste løsning. Klarer man den med færrest mulige træk, kommer 100 point i bonus oveni, og bonussen falder med 20 point for hvert træk mere. Hvert tip trækker 25 point fra. En klaret bane giver altid mindst 10 point.
- **Alle skærme:** man skal aldrig rulle. Lamperne er mindst ca. 3 cm, når der er plads (på 5 × 5 ved 1920 × 1080 ca. 5,5 cm). Knapperne er mindst ca. 80 px, også på mobil. Startskærmen siger til, hvis lamperne bliver under ca. 1,8 cm.
- **Rekorder:** der er en lokal top 10 for hver pladestørrelse med point, antal klarede baner og dato. En session gemmes, når man vælger Afslut (eller lukker siden midt i et spil).
- **Lyd:** rolige lyde fra arkadens fælles lyd ved tryk, fortryd, tip og klaret bane, og der er musik. Effekter og musik slås til og fra hver for sig.
- **Rolig visning:** der er ingen blink og ingen hvide lysglimt. Er animation slået fra, eller er computeren sat til mindre bevægelse, skifter lamperne uden overgang.
- **Test:** `node lys-ud/test/spillogik.test.js` tjekker tryk og kanter, at alle løsbare plader findes, at den korteste løsning er korrekt (sammenlignet med at prøve alle), generatoren, fortryd, forfra, tip, point og baneskift. `python3 lys-ud/test/responsiv_test.py` (Playwright og Chrome) tjekker alle skærme ved 8 opløsninger, markeringen ved blik, klik, fortryd, tip, tastatur, Bane klaret og rekorden.

## Filer

```
index.html               skærme: start, Om, spil, pause, bane klaret, slut, indstillinger, rekorder
css/lys-ud.css           spillets udseende (bygger på ../arkade/arkade.css)
js/game.js               ren spillogik uden DOM: tryk, løsning over GF(2), generator, point, session
js/app.js                brugerflade, layout, dwell, lyd, tastatur og rekorder
test/spillogik.test.js   node lys-ud/test/spillogik.test.js
test/responsiv_test.py   python3 lys-ud/test/responsiv_test.py (Playwright og Chrome)
```

## Sådan virker løsningen
Pladen er en vektor over GF(2) (tændt = 1). Et tryk på lampe *i* lægger søjle *i* i matricen A til (lampen og dens naboer). En plade b kan løses, når A·x = b har en løsning. Spillet laver Gauss-elimination én gang pr. størrelse og gemmer resultatet. På 3 × 3 er A fuld rang, så der er præcis én løsning. På 4 × 4 er kernen 4-dimensional (kun 1 ud af 16 plader kan løses), og på 5 × 5 er den 2-dimensional (1 ud af 4). Den korteste løsning findes ved at prøve den ene løsning plus alle kombinationer af kernen (16 eller 4) og tage den med færrest tryk.

Nye plader laves ved at trykke tilfældigt på en slukket plade, så de altid kan løses. Generatoren vælger den plade, hvor den korteste løsning er tættest på banens mål, og den er aldrig slukket fra start eller den samme som sidst.

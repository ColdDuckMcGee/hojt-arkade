# Fire på stribe

Del af **Hojt Arkade** af Jon Leismann Engsager / Hojt Design (MIT).
Spillet kører direkte fra `index.html` uden server og uden internet (også fra `file://`).

### Fire på stribe
Det klassiske spil på et bræt med 7 kolonner og 6 rækker mod computeren. Man skiftes til at slippe en brik ned i en kolonne, og den, der først får fire på stribe (vandret, lodret eller på skrå), vinder partiet. Der er intet ur, og computeren venter altid på dig.

- **Styring:** hver kolonne er ét stort mål. Vælg den med klik, tryk eller dwell. Mens blikket eller musen hviler på en kolonne, viser en stiplet **ghost-brik**, hvor brikken lander (kan slås fra under Indstillinger). Bliver kolonnerne smallere end ca. 80 px (fx på en mobil), kommer der en vælger med store knapper under eller ved siden af brættet: **◀**, **Slip** og **▶**.
- **Brikkerne:** din brik er pink med en ring indeni. Computerens brik er gul med en rombe i midten. Forskellen ses altså på formen og ikke kun på farven, også i høj kontrast. Computerens seneste brik har en tynd ring.
- **Niveauer:** **Rolig** er en svag modstander, der tit overser noget. **Normal** tænker 4 træk frem. **Svær** tænker 8 træk frem (minimax med alfa-beta-beskæring). Normal og Svær tager altid en vinder og blokerer altid, når du har tre og kan vinde i næste træk. Niveauet huskes til næste gang.
- **Serie:** et spil er en serie af partier. Vinder du eller bliver det uafgjort, fortsætter du med **Næste parti**. Taber du, slutter serien. I hvert andet parti starter computeren.
- **Point:** en sejr giver 100 point plus 10 for hvert træk under 21, du ikke brugte. Uafgjort giver 50. Pointene ganges med 1 på Rolig, 2 på Normal og 3 på Svær. Tab giver 0 point for partiet, men du beholder pointene fra serien.
- **Fortryd og Tip:** **Fortryd** tager dit sidste træk og computerens svar tilbage. Det kan bruges én gang pr. parti og koster 25 point. **Tip** viser den kolonne, computeren ville vælge for dig (7 træk frem), med en grøn ring og ordet TIP. Et tip koster 10 point. Point fra et parti trækkes aldrig under 10 (sejr) eller 5 (uafgjort).
- **Slut på et parti:** de vindende fire får en tyk hvid ring, og resten af brikkerne dæmpes. Intet blinker. Fortryd og Tip skifter til **Næste parti** og **Afslut** (eller **Se resultat**, hvis du tabte).
- **Tastatur:** ← og → flytter markøren, 1–7 vælger en kolonne, Enter, mellemrum eller ↓ slipper brikken (første tryk viser markøren), Z eller Backspace fortryder, T eller H giver et tip, og Esc eller P giver pause.
- **Dwell (valgfrit, slået fra som standard):** hver kolonne og hver knap vælges én gang med en ring, der fyldes op, og der gentages aldrig, mens blikket bliver på den. ◀ og ▶ gentager, så man kan flytte flere kolonner.
- **Rolig visning:** computeren venter lidt, før den slipper sin brik, og brikken falder roligt ned. Er animation slået fra, eller er computeren sat til mindre bevægelse, lander brikkerne uden fald.
- **Alle skærme:** man skal aldrig rulle. Knapperne er mindst ca. 3 cm, når der er plads, og mindst ca. 80 px. På skærme på højkant står knapperne under brættet.
- **Rekorder:** der er en lokal top 10 for hvert niveau med point, sejre, uafgjorte og dato. Serien gemmes, når du taber eller vælger Afslut.
- **Afslut:** fra pausen og efter et parti spørger spillet først med to store knapper med god afstand: **Nej, spil videre** (har fokus) og **Ja, afslut**. Esc er det samme som Nej. Dialogen er dwell-sikker.
- **Lyd:** rolige lyde fra arkadens fælles lyd, og der er musik. Effekter og musik slås til og fra hver for sig.
- **Test:** `node fire-paa-stribe/test/spillogik.test.js` tjekker fire på stribe vandret, lodret og på skrå, fuldt bræt = uafgjort, at computeren tager en vinder og blokerer en åben tre, at Svær slår Rolig, tænketiden, tip, point, serie og fortryd. `python3 fire-paa-stribe/test/responsiv_test.py` (Playwright og Chrome) tjekker alle skærme ved 8 opløsninger, ghost-brik, klik, computerens svar, fortryd, tip, tastatur, vundet og tabt parti, rekorden og bekræftelsen ved Afslut (knapstørrelse, afstand, Esc = Nej og dwell-sikkerhed).

## Filer

```
index.html               skærme: start, Om, spil, pause, slut, indstillinger, rekorder
css/fire-paa-stribe.css  spillets udseende (bygger på ../arkade/arkade.css)
js/game.js               ren spillogik uden DOM: bræt, fire på stribe, computer (minimax), point, serie
js/app.js                brugerflade, layout, dwell, lyd, tastatur og rekorder
test/spillogik.test.js   node fire-paa-stribe/test/spillogik.test.js
test/responsiv_test.py   python3 fire-paa-stribe/test/responsiv_test.py (Playwright og Chrome)
```

## Sådan tænker computeren
Computeren bruger negamax (minimax) med alfa-beta-beskæring. Den prøver kolonnerne fra midten og ud, så de bedste træk ofte kommer først, og den stopper straks, hvis et træk vinder. Stillinger vurderes ud fra alle 69 mulige rækker på fire: tre egne brikker og et tomt felt tæller meget, to tæller lidt, og brikker i midterkolonnen tæller lidt ekstra. Er flere træk lige gode, vælges et af dem tilfældigt, så partierne ikke bliver ens. På Svær (8 træk frem) tager et træk typisk få millisekunder og højst ca. 0,1 sekund.

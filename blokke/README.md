# Blokke

Del af **Hojt Arkade** af Jon Leismann Engsager / Hojt Design (MIT).
Spillet kører direkte fra `index.html` uden server og uden internet (også fra `file://`).

### Blokke
Et roligt blokpuslespil i stil med Block Blast og 1010!. Der er intet ur og ingen liv.
Man lægger tre brikker ad gangen på brættet og fylder hele rækker og kolonner, så de forsvinder.

- **Styring i tre trin (uden træk og slip):** 1) vælg en af de tre brikker, 2) vælg et felt på brættet. Så vises en skygge, der er grøn, hvis brikken passer, og rød, hvis den ikke gør. Rækker og kolonner, der vil forsvinde, er gult stribede, og teksten viser, hvor mange point trækket giver. 3) Tryk på den store **Læg**-knap, eller vælg et andet felt. Et klik på et felt lægger aldrig brikken. Man kan også vælge feltet først og brikken bagefter. Er der kun én brik tilbage, og kan den lægges, vælges den af sig selv.
- **Felt og skygge:** brikkens midterfelt (markeret med en prik) lander på det valgte felt. Ligger feltet ved kanten, skubbes brikken ind på brættet, så skyggen kun er rød, når brikken rammer andre blokke.
- **Fortryd:** **Fortryd valg** fjerner valget af brik og felt. Uden et valg fortryder knappen sidste træk, 3 gange pr. spil, også efter spillet er slut. Man får altid præcis de samme brikker igen: fortryder man trækket, der hentede et nyt sæt, og lægger igen, kommer det samme sæt, så man ikke kan fiske efter bedre brikker.
- **Tastatur:** piletasterne flytter feltet, 1, 2 og 3 vælger brik, Enter eller mellemrum lægger, Z eller Backspace fortryder, og Esc eller P giver pause.
- **Dwell (valgfrit, slået fra som standard):** hvert felt og hver knap vælges én gang, og der gentages aldrig, mens blikket bliver på den. Under Indstillinger kan en svag skygge under blikket slås til og fra.
- **Brikker:** 37 brikker i 13 familier (prik, 2–5 på stribe, hjørner, 2 × 2, 3 × 3, store L, T, S, L og 2 × 3). Der er ingen rotation. Brikkerne bliver langsomt lidt større gennem spillet.
- **Retfærdige brikker:** hvert nyt sæt på tre afprøves først, så alle tre kan lægges på brættet, som det ser ud (rydning undervejs regnes med). Lykkes det ikke, kommer et sæt, hvor mindst én brik passer. De første tre sæt har aldrig to store brikker.
- **Point:** 1 point pr. lagt felt. Linjer giver 10 × (antal linjer)², altså 10 for én, 40 for to og 90 for tre på én gang. Ryddes der linjer flere træk i træk (kombo), giver hvert træk 20 ekstra pr. kombo. Et helt tomt bræt giver 100 ekstra.
- **Slut:** spillet slutter, når ingen af de tilbageværende brikker kan være på brættet. Så kommer en rolig besked, **Ikke flere træk**, med forklaringen, og man kan se resultatet eller fortryde.
- **Bræt:** lille (6 × 6), mellem (8 × 8) eller stor (10 × 10). Felterne er mindst ca. 3 cm, når der er plads. Standard er 8 × 8. Ville felterne ved 8 × 8 blive under ca. 1,5 cm (fx på en mobil), er standard 6 × 6. En størrelse, man selv har valgt, huskes og bruges altid. Startskærmen siger til, hvis felterne bliver under ca. 1,8 cm.
- **Alle skærme:** man skal aldrig rulle. På store skærme står brikker og knapper ved siden af brættet, og på høje skærme og mobiler står de under brættet. Knapperne er mindst ca. 80 px, også på mobil.
- **Rekorder:** der er en lokal top 10 med point, linjer og dato for hver brætstørrelse.
- **Lyd:** lyde fra arkadens fælles lyd ved valg, skygge, læg, rydning, kombo, nye brikker og fortryd, og der er musik. Effekter og musik slås til og fra hver for sig.
- **Rolig visning:** der er ingen blink og ingen hvide lysglimt. Er animation slået fra, eller er computeren sat til mindre bevægelse, forsvinder linjerne med en rolig fade.
- **Test:** `node blokke/test/spillogik.test.js` tjekker placering, rydning af række og kolonne på samme tid, point, kombo, game over, fortryd (også at man får de samme brikker igen) og retfærdige brikker. `python3 blokke/test/responsiv_test.py` (Playwright og Chrome) tjekker alle skærme ved 8 opløsninger og standardbrættet ud fra skærmen.

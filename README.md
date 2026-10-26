# Hojt Arkade

Gratis spil til voksne, der bruger øjenstyring. Udviklet af Jon Leismann
Engsager, [Hojt Design](https://hojt.dk).

Spillene er lavet til øjenstyring fra starten:

- **Ingen tidspres.** Der er ingen ure, ingen nedtælling og ingen krav om hurtige reaktioner.
- **Store knapper** på mindst ca. 3 × 3 cm med god afstand og rolige zoner, hvor blikket kan hvile.
- **Dwell er valgfrit.** Det er slået fra som standard, fordi mange allerede har dwell-klik i deres øjenstyringssystem, fx Tobii. Slås det til, vælger man en knap ved at kigge på den i 0,5–3 sekunder, og en ring viser, hvor langt man er.
- **Synthwave-udtryk** med neon på mørk baggrund. Der er fire farvetemaer, heriblandt høj kontrast, og ingen blink.
- **Dansk brugerflade.**
- **Virker offline.** Det er ren HTML, CSS og JavaScript uden server, uden internet og uden eksterne filer.

## Spil

### Slangen
Et roligt, turbaseret slangespil. Slangen flytter sig ét felt for hvert valg og
står helt stille ind imellem.

- **Styring:** fire store pile står over, under, til venstre og til højre for brættet. Piletasterne virker også. Pilen bagud er slået fra.
- **Mad:** almindelig mad (cyan) giver 10 point. Bonusmad (diamant med tal) giver 50 point og forsvinder efter 15 træk.
- **Forhindringer:** en ny kommer for hver 5. mad. De lander aldrig lige foran slangen og lukker den aldrig inde.
- **Tab:** man taber, hvis man rammer væggen, sig selv eller en forhindring.
- **Bræt:** man vælger lille (10 × 10), mellem (15 × 15) eller stor (20 × 20).
- **Rekorder:** der er en lokal top 10 med dato for hver brætstørrelse.
- **Pause:** der er en stor pauseknap, og Esc eller P virker også.

### Minestryger
Et roligt minestrygerspil uden ur. Man spiller plade efter plade, indtil man
har mistet sine liv.

- **Styring:** én stor knap ved siden af brættet skifter mellem **Åbn** og **Flag**. Den valgte halvdel lyser, og felterne viser det samme: i Åbn-tilstand lyser feltet cyan med et åbn-ikon, når blikket er på det, og i Flag-tilstand lyser det pink med et flag. Der er ingen højreklik. Tastaturet virker også: piletasterne flytter, Enter eller mellemrum vælger, F skifter tilstand, og Esc eller P giver pause.
- **Første felt:** det første felt, man åbner på hver plade, er aldrig en mine, og det samme gælder dets naboer, så første valg altid åbner et område. Felter uden nabominer åbner automatisk resten af klyngen. Pladerne laves, så de kan løses uden at gætte.
- **Bræt:** man vælger lille (6 × 6), mellem (8 × 8) eller stor (10 × 8). På en 1920 × 1080-skærm bliver felterne mindst ca. 3 × 3 cm. På mindre skærme siger startskærmen til, hvis felterne bliver mindre.
- **Plader og miner:** første plade har 4, 8 eller 10 miner. Hver ny plade har én mine mere, op til et loft på 8, 14 eller 18 miner (ca. 22 % af felterne).
- **Liv:** man vælger **ét liv** eller **tre liv**. Rammer man en mine, springer pladen i luften. Har man et liv tilbage, spoles eksplosionen baglæns, så pladen samler sig igen. Minen ligger derefter afsløret, og man spiller videre. Livene følger med fra plade til plade.
- **Point:** 10 point for hvert sikkert felt, der åbnes, også felter, der åbnes automatisk. En ryddet plade giver en bonus på 25 point pr. mine på pladen.
- **Rekorder:** der er en lokal top 10 med point, antal ryddede plader og dato for hver kombination af liv og brætstørrelse.
- **Rolig visning:** der er ingen blink og ingen hvide lysglimt. Er animation slået fra, eller er computeren sat til mindre bevægelse, bliver eksplosionen og tilbagespolingen til en rolig fade.

### Bomberne
Et roligt, turbaseret bombespil i en labyrint i stil med Bomberman. Der er intet
ur. Fjenderne flytter sig og bomberne tæller ned, kun når man selv vælger.

- **Styring:** hver tur vælger man én ting: gå et felt med en af de fire store pile omkring brættet, læg en **Bombe**, eller **Vent**. Bagefter flytter fjenderne ét felt, og bomberne tæller én ned. Pile mod en søjle, kasse, bombe eller fjende er slået fra. Tastaturet virker også: piletasterne går, mellemrum eller B lægger en bombe, V eller Enter venter, Z eller Backspace fortryder, og Esc eller P giver pause. Med dwell er hvert dwell præcis ét træk, og en pil gentager aldrig sig selv, mens blikket bliver på den.
- **Bomber:** en bombe springer efter 3 træk, og tallet står på bomben. Flammen går ud i et kors, 2 felter til at begynde med. Den stoppes af søjler, sprænger den første kasse i hver retning og udløser andre bomber (kædereaktion). Felter, som flammen rammer i næste træk, er tydeligt rødt skraverede. Felter, der rammes senere, er svagt skraverede.
- **Fjender:** tre slags, hver med sin egen farve og form. **Vandreren** (grøn kugle) går ligeud og drejer af og til. **Jægeren** (rød trekant) går den korteste vej mod spilleren, men aldrig ind i en flamme, der kommer i næste træk. **Den langsomme** (lilla sekskant) går kun hvert andet træk og frem og tilbage. En svag pil viser hver fjendes næste træk. Pilene kan slås fra under Indstillinger.
- **Kasser og bonusser:** kasserne er glødende glas, søjlerne er mørke med neonkant. Under kasserne gemmer sig **+1 flamme**, **+1 bombe** ad gangen og af og til **+1 liv**. Udgangen ligger også under en kasse og åbner, når alle fjender er væk.
- **Baner:** man spiller bane efter bane uden ende. Hver bane har flere fjender (og flere jægere) og lidt flere kasser end den forrige. Bonusserne følger med fra bane til bane.
- **Fortryd:** man kan fortryde sidste træk én gang pr. bane, også lige efter man har mistet et liv.
- **Liv:** altid tre liv. Mister man et, starter man i hjørnet igen, når man er klar, og fjender tæt på starten flyttes væk.
- **Point:** 100 point for en vandrer eller en langsom fjende, 200 for en jæger, 10 for en kasse og 50 for en bonus. En klaret bane giver 100 point gange banens nummer.
- **Bræt:** man vælger lille (9 × 9), mellem (11 × 9) eller stor (13 × 11). Kanten af søjler tegnes som en tynd ramme, så felterne bliver store. Startskærmen siger til, hvis felterne bliver under ca. 1,8 cm.
- **Alle skærme:** man skal aldrig rulle. På store skærme står pilene rundt om brættet. På lave skærme, tablets og mobiler skifter layoutet, så pilekors og knapper står under eller ved siden af brættet og er så store som muligt.
- **Rekorder:** der er en lokal top 10 med point, nået bane og dato for hver brætstørrelse.
- **Lyd:** lydeffekter for skridt, bombe, nedtælling, eksplosion, fjende væk, bonus, mistet liv og klaret bane, og der er musik. Effekter og musik slås til og fra hver for sig.
- **Rolig visning:** der er ingen blink og ingen hvide lysglimt. Er animation slået fra, eller er computeren sat til mindre bevægelse, bliver eksplosionerne til en rolig fade.
- **Test:** `node bomberne/test/spillogik.test.js` tjekker brættet, lunte, flammer, kædereaktioner, fjenderne, liv, fortryd, bonusser og banskift.

### Frøen
Et roligt, turbaseret spil i stil med Frogger. Der er intet ur. Biler, stammer
og skildpadder rykker sig kun, når man selv hopper eller venter.

- **Styring:** hver tur vælger man én ting: hop et felt med en af de fire store pile omkring brættet, eller **Vent**. Bagefter rykker alle baner ét felt. Nogle baner rykker kun hvert andet træk, men altid på samme faste måde. Tastaturet virker også: piletasterne hopper, V eller Enter venter, og Esc eller P giver pause. Med dwell er hvert dwell præcis ét træk, og en pil gentager aldrig sig selv, mens blikket bliver på den.
- **Næste træk:** svage, stiplede skygger viser, hvor biler, stammer og skildpadder står efter næste træk. Et hop, der vil koste et liv, får stiplet rød kant på pilen, og en rød ring om frøen viser, at det er farligt at stå stille. Det kan slås fra under Indstillinger.
- **Brættet:** 11 × 13 felter. Nederst er startrækken, så kommer fem vejbaner, en sikker midterrække, fem flodbaner og øverst en mur med fem huller.
- **Floden:** frøen skal stå på en stamme eller en skildpadde, og den følger med, når de rykker. Bliver den båret ud over kanten, mister man et liv.
- **Liv:** man vælger tre liv eller ét liv på startskærmen. Man mister et liv, hvis en bil rammer frøen, hvis den falder i vandet, eller hvis den bliver båret ud over kanten. Bagefter starter frøen i bunden igen, når man er klar.
- **Muren og fyldte huller:** står frøen lige under muren eller et hul, der allerede er fyldt, er pilen op slået fra og nedtonet, ligesom pile mod en mur i Bomberne. På pilen står en kort forklaring ("Muren er i vejen" eller "Hullet er optaget"), og feltet over frøen får et roligt kryds. Piletasten op gør heller intet, og et dwell på pilen bliver ikke til et træk, så man mister hverken et træk eller et liv.
- **Baner:** når alle fem huller er fyldt, starter en ny bane uden ende. Hver bane har flere og længere biler og færre eller kortere stammer, og færre baner rykker langsomt. Det testes, at hver bane altid kan klares.
- **Point:** 10 point for hver ny række, frøen når frem til i et forsøg, 50 for et fyldt hul og 200 gange banens nummer for en klaret bane.
- **Alle skærme:** man skal aldrig rulle. På store skærme står pilene rundt om brættet. På lave skærme, tablets og mobiler står pilekors og knapper under eller ved siden af brættet og er så store som muligt. Startskærmen siger til, hvis felterne bliver under ca. 1,2 cm.
- **Rekorder:** der er en lokal top 10 med point, nået bane og dato for tre liv og for ét liv hver for sig.
- **Lyd:** lydeffekter for hop, plask, bil, fyldt hul, mistet liv og klaret bane, og der er musik. Effekter og musik slås til og fra hver for sig.
- **Rolig visning:** der er ingen blink og ingen hvide lysglimt. Er animation slået fra, eller er computeren sat til mindre bevægelse, bliver effekterne til en rolig fade.
- **Test:** `node froeen/test/spillogik.test.js` tjekker brættet, hop, banernes faste rytme, biler, flod og kanten, huller, at muren og fyldte huller afviser hoppet uden træk og uden livstab, banskift, point og liv, og at et hul altid kan nås. `python3 froeen/test/responsiv_test.py` tjekker alle skærmstørrelser i Chrome, også at pilen op er slået fra under muren og et fyldt hul (med mus, tastatur og dwell).

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

### Lys ud
Et roligt logikspil med runde neonlamper. Der er intet ur og ingen tidspres.
Når man vælger en lampe, skifter den og de fire lamper ved siden af: tændte slukkes, og slukkede tændes. Målet er at slukke dem alle. Banerne bliver ved, til man selv vælger **Afslut**.

- **Styring:** vælg en lampe med klik, tryk eller dwell. Mens blikket eller musen hviler på en lampe, er den og de lamper, der skifter, markeret med et svagt blåt omrids. Markeringen kan slås fra under Indstillinger.
- **Tændt og slukket:** en tændt lampe er en fyldt, lysende skive med stråler. En slukket lampe er en tom ring med stiplet kant. Forskellen ses altså på formen og ikke kun på farven, også i høj kontrast.
- **Fortryd og Forfra:** **Fortryd** tager sidste træk tilbage, og man kan fortryde lige så mange gange, man vil. **Forfra** sætter banen tilbage til sin start.
- **Tip:** viser én lampe fra en korteste løsning af pladen, som den ser ud nu, med en grøn ring og ordet TIP. Et tip koster 25 point.
- **Tastatur:** piletasterne flytter markøren, Enter eller mellemrum vælger lampen, Z eller Backspace fortryder, R starter forfra, T giver et tip, og Esc eller P giver pause.
- **Dwell (valgfrit, slået fra som standard):** hver lampe og hver knap vælges én gang, og der gentages aldrig, mens blikket bliver på den.
- **Plader:** lille (3 × 3), mellem (4 × 4) eller stor (5 × 5). Standard er 5 × 5, men 4 × 4 på skærme, hvor lamperne ved 5 × 5 ville blive under ca. 80 px (fx en mobil). Vælger man selv en størrelse, huskes den til næste gang. Alle plader kan løses, og ingen er klaret fra start. Spillet regner den korteste løsning ud (lineær algebra over GF(2)), og **Færrest mulige** viser antallet af træk. Det tal vokser langsomt fra bane til bane: på 5 × 5 fra 4 til 13 træk, og på 3 × 3 og 4 × 4 fra 3 til 7.
- **Point:** en klaret bane giver 20 point pr. træk i den korteste løsning. Klarer man den med færrest mulige træk, kommer 100 point i bonus oveni, og bonussen falder med 20 point for hvert træk mere. Hvert tip trækker 25 point fra. En klaret bane giver altid mindst 10 point.
- **Alle skærme:** man skal aldrig rulle. Lamperne er mindst ca. 3 cm, når der er plads (på 5 × 5 ved 1920 × 1080 ca. 5,5 cm). Knapperne er mindst ca. 80 px, også på mobil. Startskærmen siger til, hvis lamperne bliver under ca. 1,8 cm.
- **Rekorder:** der er en lokal top 10 for hver pladestørrelse med point, antal klarede baner og dato. En session gemmes, når man vælger Afslut (eller lukker siden midt i et spil).
- **Afslut:** fra pausen og fra **Bane klaret** spørger spillet først med to store knapper med god afstand: **Nej, spil videre** (har fokus) og **Ja, afslut**. Esc er det samme som Nej. Pointene gemmes, når man vælger Ja. Dialogen er dwell-sikker: knappen, der dukker op lige dér, hvor man kigger, kan først vælges, når blikket har været væk fra den.
- **Lyd:** rolige lyde fra arkadens fælles lyd ved tryk, fortryd, tip og klaret bane, og der er musik. Effekter og musik slås til og fra hver for sig.
- **Rolig visning:** der er ingen blink og ingen hvide lysglimt. Er animation slået fra, eller er computeren sat til mindre bevægelse, skifter lamperne uden overgang.
- **Test:** `node lys-ud/test/spillogik.test.js` tjekker tryk og kanter, at alle løsbare plader findes, at den korteste løsning er korrekt (sammenlignet med at prøve alle), generatoren, fortryd, forfra, tip, point, baneskift og den automatiske standardplade. `python3 lys-ud/test/responsiv_test.py` (Playwright og Chrome) tjekker alle skærme ved 8 opløsninger, standardpladen ud fra skærmen, at en valgt størrelse huskes, markeringen ved blik, klik, fortryd, tip, tastatur, Bane klaret, bekræftelsen ved Afslut (knapstørrelse, afstand, Esc = Nej og dwell-sikkerhed) og rekorden.

### Flipper
Et roligt flipperspil til øjenstyring. Der er ingen tidspres: spillet fryser, hver gang kuglen er på vej ned mod flipperne, og venter, til man har valgt.
Man har tre kugler og får ekstra kugler ved høje point.

- **Afskydning:** vælg kraft 1–5 med store knapper, og tryk **Skyd**. En svag stiplet linje viser, hvor kuglen vil gå (kan slås fra).
- **Fryst øjeblik:** når kuglen kommer ned i zonen over flipperne, toner bordet roligt ned, kuglen får en ring, og man vælger mellem fire store knapper: **Venstre**, **Højre**, **Begge** og **Lad være**. Den valgte flipper slår selv på det rigtige tidspunkt, så timing er ikke nødvendig. Hvert valg viser en svag sigtelinje og et kort udfald (fx »Slår kuglen op · +400« eller »Kuglen går tabt«). Linjerne regnes med præcis samme fysik som spillet, så de passer altid. De kan slås fra under Indstillinger.
- **Sigte:** hvor kuglen rammer flipperen, og hvor hurtigt den kommer, bestemmer retningen. Tæt på spidsen sendes den skråt, tæt på leddet mere lige op.
- **Ingen kugle tabes uden et valg:** spillet fryser også, hvis kuglen ligger stille eller ruller langsomt mod afløbet. Ligger den stille ude på bordet, får den et lille puf. Det fryser kun, når en flipper faktisk kan nå kuglen, eller når den ellers går tabt.
- **Bordet:** tre bumpere (100 point), to slynger (10), fem lysmål (250, og 50 når de allerede er tændt) og en sløjfe i hver side (500). Når alle fem lys er tændt, gives 2000 point, lysene starter forfra, og **Bonus** stiger fra ×1 op til ×5. Bonussen ganger alle point og nulstilles, når kuglen er tabt.
- **Kugler:** 3 kugler og en ekstra kugle ved 40 000 og ved 100 000 point.
- **Fart:** **Rolig**, **Normal** eller **Hurtig** vælges på startskærmen. Farten styrer kun, hvor hurtigt kuglen ruller på skærmen, ikke fysikken. Der er en top 10 for hver fart.
- **Tastatur:** ← eller A er venstre, → eller L er højre, ↑ eller B er begge, og ↓, N, mellemrum eller Enter er lad være. Ved afskydning vælger 1–5 eller piletasterne kraften, og mellemrum eller Enter skyder. Esc eller P giver pause.
- **Dwell (valgfrit, slået fra som standard):** hver knap vælges én gang, og der gentages aldrig, mens blikket bliver på den.
- **Fysik:** et fast tidsskridt på 1/120 sekund med 4 delskridt og kollision med kapsler, så kuglen ikke smutter gennem væggene, selv ved topfart. Alt er deterministisk.
- **Alle skærme:** man skal aldrig rulle. Bordet står på højkant og skaleres til skærmen. På brede skærme står knapperne ved siden af bordet, og på smalle skærme står de under det. Knapperne er mindst ca. 3 cm, når der er plads, og ellers mindst ca. 80 px.
- **Lyd:** lyde fra arkadens fælles lyd ved bumpere, mål, flipper, frysning og tabt kugle, og der er musik. Effekter og musik slås til og fra hver for sig.
- **Rolig visning:** der er ingen blink og ingen hvide lysglimt. Er animation slået fra, eller er computeren sat til mindre bevægelse, tegnes kuglens bane som et tydeligt spor, og lys og effekter er dæmpede.
- **Test:** `node flipper/test/spillogik.test.js` tjekker frysezonen, at den valgte flipper slår kuglen op, at »Lad være« taber kuglen, at sigtelinjerne passer præcist med kuglens bane, point for bumper, mål, alle lys, bonus og sløjfe, tabt kugle, game over, ekstra kugle, afskydning, frysning ved stille kugle, at farten ikke ændrer fysikken, at kuglen ikke smutter gennem væggene, og at en kugle aldrig tabes uden et valg (hele spil). `python3 flipper/test/responsiv_test.py` (Playwright og Chrome) tjekker alle skærme ved 8 opløsninger.

### Søslag
Klassisk sænke slagskibe mod computeren, i ro og mag. Der er intet ur, og man skyder på skift.
Spillet varer kamp efter kamp og slutter første gang, computeren sænker hele ens flåde.

- **Flåde:** fem skibe hver: slagskib (4), krydser (3), fregat (3), korvet (2) og patruljebåd (2). Skibene rører aldrig hinanden, heller ikke på skrå.
- **Placering:** skibene lægges tilfældigt, og den store **Bland igen**-knap lægger dem på ny. Man kan også flytte dem selv i fire trin uden træk og slip: 1) vælg et skib (på listen eller på havet), 2) vælg et felt til stævnen, 3) vælg **Vandret** eller **Lodret**, 4) tryk **Læg**. Skyggen er grøn, når skibet kan ligge der, og rød, når det ikke kan. Til sidst trykker man **Start kamp**.
- **Skud i to trin:** vælg et felt på computerens hav (det får et gult sigte), og tryk på den store **Skyd**-knap. Et klik på et felt skyder aldrig. Felter, man har skudt på, kan ikke vælges igen.
- **Tydelige mærker:** plask er en blå ring, ramt er et orange kryds, og et sænket skib er røde, fyldte felter med skrog og kryds. Det seneste skud har en lys ramme. Formen siger det hele, også uden farver.
- **Ét stort hav ad gangen:** under kampen er computerens hav stort, og ens eget hav står lille på en stor knap ved siden af (eller under) brættet. Knappen skifter visning, så man kan se sit eget hav stort. Det lille hav viser altid computerens skud.
- **Computerens tur:** efter hvert skud venter computeren roligt ca. 1 sekund. Overskriften skifter til **Computerens tur**, og teksten fortæller, hvor den skød, og hvad den ramte. Computerens sidste skud har en ramme på det lille hav.
- **Computeren:** tre niveauer. **Rolig** skyder tilfældigt. **Normal** jager og sigter: efter et træf skyder den rundt om feltet og fortsætter i skibets retning (og skyder i skakternet, når den leder). **Svær** regner et sandsynlighedskort ud fra alle de måder, de resterende skibe kan ligge på. Computeren snyder aldrig: den ser kun sine egne skud og længden af de skibe, der er tilbage.
- **Overblik:** en liste viser, hvilke af computerens skibe der er tilbage, og hvilke der er sænket. Taber man, vises computerens skibe, man ikke fandt, stiplet.
- **Point:** 20 point for hvert skib, man sænker (også i den kamp, man taber). En vunden kamp giver 100 point plus 10 point for hvert felt på computerens hav, man aldrig skød på, så få skud giver flere point. Pointene lægges sammen kamp efter kamp.
- **Tastatur:** piletasterne flytter sigtet (og springer felter over, man har skudt på), Enter eller mellemrum skyder, V skifter hav, og Esc eller P giver pause. Under placering vælger 1–5 et skib, R drejer, B blander, og S starter kampen.
- **Dwell (valgfrit, slået fra som standard):** ét dwell er én handling. Et felt eller en knap vælges én gang og gentages aldrig, mens blikket bliver på den, så ét dwell på **Skyd** er præcis ét skud.
- **Bræt:** 8 × 8 er standard. 10 × 10 kan vælges, når felterne stadig bliver mindst ca. 1,5 cm. Felterne er ca. 3 cm, når der er plads, og startskærmen siger til, hvis de bliver mindre.
- **Alle skærme:** man skal aldrig rulle. På brede skærme står status og flåde til venstre og det lille hav og knapperne til højre. På lave skærme står alt i et panel ved siden af havet, og på høje skærme og mobiler står knapperne under havet. Knapperne er mindst ca. 80 px, også på mobil.
- **Rekorder:** der er en lokal top 10 for hvert niveau og hver brætstørrelse med point, vundne kampe og dato.
- **Lyd:** lyde fra arkadens fælles lyd ved sigte, plask, træf, sænket, computerens tur, sejr og nederlag, og der er musik. Effekter og musik slås til og fra hver for sig.
- **Rolig visning:** der er ingen blink og ingen hvide lysglimt. Et nyt mærke toner roligt frem, og er animation slået fra, eller er computeren sat til mindre bevægelse, er det kun en blød fade. Der er fire temaer, også høj kontrast.
- **Test:** `node soeslag/test/spillogik.test.js` tjekker placering (også at skibe ikke rører hinanden), skud, sænkning, sejr, nederlag, point og alle tre computerniveauer (også at computeren ikke snyder). `python3 soeslag/test/responsiv_test.py` (Playwright og Chrome) spiller en placering, en kamp, en sejr, et nederlag og game over igennem ved 8 opløsninger og tjekker, at intet ruller, klippes af eller overlapper.

## Sådan spiller og tester du

1. Hent eller pak mappen `hojt-arkade` ud.
2. Åbn `index.html` i Chrome eller Edge (dobbeltklik). Det virker direkte fra disken.
3. Du står nu i arkadehallen. Bladr mellem maskinerne med de store pile (eller
   piletasterne), og vælg **Spil** ved Slangen. Du kan også åbne `slangen/index.html` direkte.
4. Vælg brætstørrelse og **Start spil**. Klik én gang, så lyden starter (det kræver browseren).

Prøv især:

- Pilene og piletasterne. Slangen står stille, til du vælger.
- Pause, game over og **Nyt spil**.
- **Indstillinger:**
  - dwell til eller fra og dwell-tid
  - tema og baggrund
  - animation
  - lydeffekter og musik
- Luk og åbn browseren igen. Indstillinger og rekorder er husket.
- **Om**-siden med links til hojt.dk og koden.

Til hjemmesiden uploades hele mappen, som den er. Alle stier er relative.

## Mappestruktur

```
index.html        forsiden: arkadehallen (arkade.hojt.dk)
games.js          listen over spil i hallen – ét spil pr. linje
hal/              hallens kode (hal.js, hal.css) og skærmbilleder (skaerme/)
CNAME             eget domæne til GitHub Pages: arkade.hojt.dk
arkade/           fælles moduler til alle spil
slangen/          spillet Slangen (index.html, css/, js/)
minestryger/      spillet Minestryger (index.html, css/, js/)
bomberne/         spillet Bomberne (index.html, css/, js/, test/)
froeen/           spillet Frøen (index.html, css/, js/, test/)
lys-ud/           spillet Lys ud (index.html, css/, js/, test/)
flipper/          spillet Flipper (index.html, css/, js/, test/)
soeslag/          spillet Søslag (index.html, css/, js/, test/)
LICENSE           MIT-licens
```

## Genbrugelige moduler i `arkade/`

| Fil | Indhold |
|-----|---------|
| `settings.js`   | `ArkadeSettings` – indstillinger i localStorage. Fælles indstillinger (dwell, tema, baggrund, lyd …) gemmes under `arkade`, så de følger spilleren fra spil til spil. |
| `highscores.js` | `ArkadeHighscores` – lokal top 10 pr. kategori med dato, uden navne. |
| `dwell.js`      | `ArkadeDwell` – dwell-motor med fremskridtsring til knapper og links. |
| `audio.js`      | `ArkadeAudio` – synthwave-musik og lydeffekter lavet med Web Audio API (ingen lydfiler). |
| `background.js` | `ArkadeBackground` – baggrundene Mørk, Solnedgang og Neonby. |
| `arkade.css`    | Temaer, store knapper, paneler, rekordliste og dwell-ring. |
| `logo.svg`, `favicon.svg` | Logo og ikon, tegnet som vektorstier uden skrifttyper. |

Modulerne er almindelige `<script>`-filer uden import og eksport, så de også
virker over `file://`. Se [`arkade/README.md`](arkade/README.md) for API'erne.

## Sådan tilføjer du et spil

1. Lav spillet som en ny mappe ved siden af `slangen/`, der henter `../arkade/...`.
2. Tilføj eller ret én linje i `games.js`:

   ```js
   { navn: 'Muren', sti: 'muren/', farve: 'orange', status: 'aktiv', tekst: 'Send bolden mod muren, og slå murstenene ned én efter én.' },
   ```

   - `farve`: pink, cyan, orange, gul, grøn, lilla, blå eller rød.
   - `status`: `'aktiv'` kan spilles. `'snart'` vises med slukket skærm og skiltet "Kommer snart".
   - `skaerm` (valgfri): et stillbillede i SVG til maskinens skærm, fx `'hal/skaerme/muren.svg'`.
3. Rækkefølgen i `games.js` er rækkefølgen i hallen. Der skal ikke rettes andet.

Hallen er lavet til øjenstyring: én maskine ad gangen, store pile til at bladre,
intet skifter af sig selv, og dwell, lyd og musik styres under **Indstillinger**
med de samme fælles indstillinger som i spillene.

## Hjemmeside

Siden er tænkt til GitHub Pages med det egne domæne `arkade.hojt.dk` (se `CNAME`).

## Licens

Koden er åben og frit tilgængelig under MIT-licensen, så alle kan bruge den og
bygge videre på den. Se [LICENSE](LICENSE).

Copyright (c) 2026 Jon Leismann Engsager / Hojt Design

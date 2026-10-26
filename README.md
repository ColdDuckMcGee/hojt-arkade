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

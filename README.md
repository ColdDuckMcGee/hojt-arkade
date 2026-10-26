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

## Sådan spiller og tester du

1. Hent eller pak mappen `hojt-arkade` ud.
2. Åbn `index.html` i Chrome eller Edge (dobbeltklik). Det virker direkte fra disken.
3. Vælg **Slangen**, eller åbn `slangen/index.html` direkte.
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
index.html        forside for serien
arkade/           fælles moduler til alle spil
slangen/          spillet Slangen (index.html, css/, js/)
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

Et nyt spil laves som en ny mappe ved siden af `slangen/`, der henter
`../arkade/...`, og tilføjes som et kort på forsiden.

## Licens

Koden er åben og frit tilgængelig under MIT-licensen, så alle kan bruge den og
bygge videre på den. Se [LICENSE](LICENSE).

Copyright (c) 2026 Jon Leismann Engsager / Hojt Design

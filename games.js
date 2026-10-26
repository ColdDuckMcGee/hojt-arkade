/*
 * Hojt Arkade – spillene i hallen.
 *
 * Ét spil = én linje. Rækkefølgen her er rækkefølgen i hallen.
 *   navn    Navnet på maskinens skilt.
 *   sti     Mappen med spillet (index.html i mappen åbnes).
 *   farve   Maskinens farvetema: pink, cyan, orange, gul, grøn, lilla, blå eller rød.
 *   status  'aktiv' (kan spilles) eller 'snart' (vises med slukket skærm og "Kommer snart").
 *   tekst   Kort beskrivelse på dansk.
 *   skaerm  (valgfri) Stillbillede (SVG) til maskinens skærm.
 *
 * Almindelig <script>-fil (ingen fetch), så hallen også virker fra disken (file://).
 */
window.HOJT_SPIL = [
  { navn: 'Slangen',        sti: 'slangen/',        farve: 'pink',   status: 'aktiv', tekst: 'Styr slangen ét felt ad gangen, spis maden, og undgå væggen og din egen hale.', skaerm: 'hal/skaerme/slangen.svg' },
  { navn: 'Flipper',        sti: 'flipper/',        farve: 'cyan',   status: 'snart', tekst: 'Hold kuglen i spil med flipperne, og ram de lysende mål.' },
  { navn: 'Muren',          sti: 'muren/',          farve: 'orange', status: 'snart', tekst: 'Send bolden mod muren, og slå murstenene ned én efter én.' },
  { navn: 'Bobler',         sti: 'bobler/',         farve: 'lilla',  status: 'snart', tekst: 'Skyd bobler op, og saml tre i samme farve, så de forsvinder.' },
  { navn: 'Blokke',         sti: 'blokke/',         farve: 'grøn',   status: 'snart', tekst: 'Læg blokkene på plads, og fyld hele rækker.' },
  { navn: 'Minestryger',    sti: 'minestryger/',    farve: 'blå',    status: 'aktiv', tekst: 'Find alle de sikre felter ved hjælp af tallene, og undgå minerne.', skaerm: 'hal/skaerme/minestryger.svg' },
  { navn: 'Vendespil',      sti: 'vendespil/',      farve: 'gul',    status: 'snart', tekst: 'Vend to kort ad gangen, og find alle parrene.' },
  { navn: 'Juveler',        sti: 'juveler/',        farve: 'rød',    status: 'snart', tekst: 'Byt om på to juveler, og lav rækker med tre ens.' },
  { navn: 'Rørlægger',      sti: 'rorlaegger/',     farve: 'cyan',   status: 'snart', tekst: 'Drej rørene, så vandet kan løbe hele vejen igennem.' },
  { navn: 'Kasser',         sti: 'kasser/',         farve: 'orange', status: 'snart', tekst: 'Skub kasserne hen på de markerede felter.' },
  { navn: 'Pixelgåder',     sti: 'pixelgaader/',    farve: 'pink',   status: 'snart', tekst: 'Brug tallene til at finde ud af, hvilke felter der skal farves.' },
  { navn: 'Lys ud',         sti: 'lys-ud/',         farve: 'gul',    status: 'snart', tekst: 'Tryk på lamperne, og sluk dem alle sammen.' },
  { navn: 'Fire på stribe', sti: 'fire-paa-stribe/', farve: 'blå',   status: 'snart', tekst: 'Slip brikkerne ned, og få fire i træk før computeren.' }
];

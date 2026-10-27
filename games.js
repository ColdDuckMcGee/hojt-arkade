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
  { navn: 'Flipper',        sti: 'flipper/',        farve: 'cyan',   status: 'aktiv', tekst: 'Hold kuglen i spil med flipperne, og ram de lysende mål.', skaerm: 'hal/skaerme/flipper.svg' },
  { navn: 'Muren',          sti: 'muren/',          farve: 'orange', status: 'snart', tekst: 'Send bolden mod muren, og slå murstenene ned én efter én.' },
  { navn: 'Bobler',         sti: 'bobler/',         farve: 'lilla',  status: 'aktiv', tekst: 'Skyd bobler op, og saml tre i samme farve, så de forsvinder.', skaerm: 'hal/skaerme/bobler.svg' },
  { navn: 'Blokke',         sti: 'blokke/',         farve: 'grøn',   status: 'aktiv', tekst: 'Læg blokkene på plads i ro og mag, og fyld hele rækker og kolonner.', skaerm: 'hal/skaerme/blokke.svg' },
  { navn: 'Minestryger',    sti: 'minestryger/',    farve: 'blå',    status: 'aktiv', tekst: 'Find alle de sikre felter ved hjælp af tallene, og undgå minerne.', skaerm: 'hal/skaerme/minestryger.svg' },
  { navn: 'Juveler',        sti: 'juveler/',        farve: 'rød',    status: 'aktiv', tekst: 'Byt om på to juveler, og lav rækker med tre ens.', skaerm: 'hal/skaerme/juveler.svg' },
  { navn: 'Rørlægger',      sti: 'rorlaegger/',     farve: 'cyan',   status: 'aktiv', tekst: 'Drej rørene, så vandet kan løbe hele vejen igennem.', skaerm: 'hal/skaerme/rorlaegger.svg' },
  { navn: 'Kasser',         sti: 'kasser/',         farve: 'orange', status: 'aktiv', tekst: 'Skub kasserne hen på de markerede felter.', skaerm: 'hal/skaerme/kasser.svg' },
  { navn: 'Pixelgåder',     sti: 'pixelgaader/',    farve: 'pink',   status: 'aktiv', tekst: 'Brug tallene til at finde ud af, hvilke felter der skal farves.', skaerm: 'hal/skaerme/pixelgaader.svg' },
  { navn: 'Lys ud',         sti: 'lys-ud/',         farve: 'gul',    status: 'aktiv', tekst: 'Tryk på lamperne, og sluk dem alle sammen.', skaerm: 'hal/skaerme/lys-ud.svg' },
  { navn: 'Fire på stribe', sti: 'fire-paa-stribe/', farve: 'blå',   status: 'aktiv', tekst: 'Slip brikkerne ned, og få fire i træk før computeren.', skaerm: 'hal/skaerme/fire-paa-stribe.svg' },
  { navn: 'Bomberne',      sti: 'bomberne/',      farve: 'rød',   status: 'aktiv', tekst: 'Læg bomber i labyrinten, og spræng fjenderne. Alt flytter sig kun, når du gør.', skaerm: 'hal/skaerme/bomberne.svg' },
  { navn: 'Kaperen',       sti: 'kaperen/',       farve: 'cyan',  status: 'snart', tekst: 'Sejl mellem havnene, handl med varer, og vælg, om du vil skyde, borde eller flygte.' },
  { navn: 'Kanonen',       sti: 'kanonen/',       farve: 'orange', status: 'aktiv', tekst: 'Indstil vinkel og krudt, og ram modstanderen på skift i et landskab, der kan sprænges.', skaerm: 'hal/skaerme/kanonen.svg' },
  { navn: 'Labyrinten',    sti: 'labyrinten/',    farve: 'gul',   status: 'aktiv', tekst: 'Spis alle prikkerne, og undgå vagterne. De flytter sig kun, når du gør.', skaerm: 'hal/skaerme/labyrinten.svg' },
  { navn: 'Kælderen',      sti: 'kaelderen/',     farve: 'lilla', status: 'snart', tekst: 'Gå ned gennem kældre, der laves automatisk, ét træk ad gangen, og se, hvor dybt du kommer.' },
  { navn: 'Tårnene',       sti: 'taarnene/',      farve: 'grøn',  status: 'snart', tekst: 'Byg tårne i ro og mag, og stop bølgerne af fjender.' },
  { navn: 'Golf',          sti: 'golf/',          farve: 'pink',  status: 'snart', tekst: 'Sigt, vælg kraft, og få bolden i hul på retro minigolfbaner.' },
  { navn: 'Billard',       sti: 'billard/',       farve: 'blå',   status: 'snart', tekst: 'Sigt, og stød kuglerne i hul mod computeren.' },
  { navn: 'Søslag',        sti: 'soeslag/',       farve: 'cyan',  status: 'aktiv', tekst: 'Find og sænk computerens skibe, før den finder dine.', skaerm: 'hal/skaerme/soeslag.svg' },
  { navn: 'Frøen',         sti: 'froeen/',        farve: 'grøn',  status: 'aktiv', tekst: 'Hop over vejen og floden. Bilerne og stammerne rykker kun, når du hopper.', skaerm: 'hal/skaerme/froeen.svg' },
  { navn: 'Løberen',       sti: 'loeberen/',      farve: 'pink',  status: 'aktiv', tekst: 'Løb gennem datanettet i tre baner – op på blokkene og forbi firewalls. Alt står stille, til du har valgt.', skaerm: 'hal/skaerme/loeberen.svg' },
  { navn: 'Rumhandleren',  sti: 'rumhandleren/',  farve: 'lilla', status: 'snart', tekst: 'Køb billigt og sælg dyrt mellem planeterne, og pas på rumpiraterne.' },
  { navn: 'Sudoku',        sti: 'sudoku/',        farve: 'cyan',  status: 'aktiv', tekst: 'Udfyld pladen, så hvert tal kun står én gang i hver række, kolonne og boks.', skaerm: 'hal/skaerme/sudoku.svg' }
];

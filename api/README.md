# Hojt Arkade – API (global highscore + statistik)

Cloudflare Worker `hojt-arkade-api` med D1-databasen `hojt-arkade`.
Mappen påvirker ikke GitHub Pages – siden er stadig ren statisk HTML.

**Adresse:** https://hojt-arkade-api.hojt.workers.dev

| Kald | Hvad |
|---|---|
| `GET /scores?spil=slangen&kat=15&n=10` | Global top (navn, score, dato). `kat` = spillets kategori (fx brætstørrelse), `n` ≤ 50 |
| `POST /scores` `{spil, kat, navn, score}` | Gemmer en score → `{ok, placering, liste}` |
| `POST /event` `{spil, type:'start'\|'slut', varighed?, skaerm?, tema?}` | Anonym tælling pr. dag og spil |
| `GET /stats?key=…` | Al statistik som JSON (kræver `STATS_KEY`) – vises på `/statistik/` |

## Regler
- `spil` skal stå i `SPIL` i `worker.js` (id = navnet i `ArkadeHighscores.create`, fx `lysud`, `firepaastribe`).
- `navn`: præcis 3 bogstaver A–Z, Æ, Ø, Å, og ikke på listen `GRIMME` (samme liste i `arkade/highscore.js`).
- `score`: heltal fra 1 til spillets loft i `SPIL`.
- Rate limit: højst 1 score pr. 10 s og 50 pr. døgn pr. IP. IP'en gemmes ikke – kun en hash
  af IP + dato + hemmeligt salt, som skifter hver dag og slettes efter 2 døgn.
- CORS: kun `https://arkade.hojt.dk`, `http://localhost:*` og `http://127.0.0.1:*`. POST fra andre
  origins afvises.
- Statistik: kun tællinger pr. dag (starter, færdige spil, samlet varighed, skærmstørrelse afrundet
  til 10 px, tema). Ingen cookies, ingen id'er, ingen IP.

## Drift
```sh
cd api
export CLOUDFLARE_API_TOKEN=…  CLOUDFLARE_ACCOUNT_ID=05fb53460a9be1dbc7979f44d0828636
npx wrangler deploy                                   # udgiv worker.js
npx wrangler d1 execute hojt-arkade --remote --file=schema.sql   # skema (idempotent)
npx wrangler secret put STATS_KEY                     # statistiknøgle
npx wrangler secret put SALT                          # salt til IP-hash
```
Slet en score: `npx wrangler d1 execute hojt-arkade --remote --command "DELETE FROM scores WHERE id = …"`.

Lokalt: `npx wrangler d1 execute hojt-arkade --local --file=schema.sql` og
`npx wrangler dev --local --port 8787` (hemmeligheder i `.dev.vars`, som ikke committes).
Sæt `localStorage['hojtArkade.api'] = 'http://127.0.0.1:8787'` i browseren for at bruge den lokale server.

/*
 * Hojt Arkade – API (Cloudflare Worker + D1)
 *
 *   GET  /scores?spil=slangen&kat=15&n=10   global top (navn, score, dato)
 *   POST /scores {spil, kat?, navn, score}   gem score → {ok, placering}
 *   POST /event  {spil, type, varighed?, skaerm?, tema?}   anonym tælling
 *   GET  /stats?key=...                       statistik (kræver STATS_KEY)
 *
 * Ingen cookies. Ingen IP gemmes: rate limit bruger en hash af IP + dato + salt,
 * som skifter hver dag og slettes efter 2 døgn.
 */

// Spillenes id (= navnet i ArkadeHighscores.create) og højeste tilladte score.
// Lofterne er bevidst rundhåndede: de skal kun stoppe åbenlyst snyd.
export const SPIL = {
  slangen: 100000, flipper: 50000000, muren: 1000000, bobler: 1000000, blokke: 1000000,
  minestryger: 1000000, juveler: 5000000, rorlaegger: 1000000, kasser: 1000000,
  pixelgaader: 1000000, lysud: 1000000, firepaastribe: 1000000, bomberne: 1000000,
  kaperen: 10000000, kanonen: 1000000, labyrinten: 1000000, kaelderen: 1000000,
  taarnene: 5000000, golf: 1000000, billard: 1000000, soeslag: 1000000, froeen: 1000000,
  loeberen: 5000000, rumhandleren: 100000000, sudoku: 1000000, kabalen: 1000000,
  rampen: 10000000
};

// Grimme ord på 3 bogstaver (dansk og engelsk). Sammenlignes efter store bogstaver.
export const GRIMME = new Set([
  // engelsk
  'ASS', 'ARS', 'FUK', 'FUC', 'FCK', 'FUX', 'FAG', 'CUM', 'CUN', 'CNT', 'KKK', 'NIG', 'NGR',
  'NGA', 'SEX', 'TIT', 'DIK', 'DIC', 'DIX', 'COK', 'COC', 'JIZ', 'WTF', 'XXX', 'SOB', 'SUX',
  'VAG', 'HOE', 'KYK', 'FAP', 'NAZ', 'ANL', 'BCH', 'BJS', 'KUM', 'MOF', 'PUS', 'SHT', 'TWT',
  // dansk
  'PIK', 'PIS', 'LRT', 'LOR', 'KUS', 'FIS', 'RØV', 'RØW', 'BØS', 'HOR', 'LUD', 'TIS', 'SÆD', 'SVN'
]);

const NAVN_RE = /^[A-ZÆØÅ]{3}$/;
const ORIGINS = [/^https:\/\/arkade\.hojt\.dk$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

function allowedOrigin(o) { return !!o && ORIGINS.some(function (r) { return r.test(o); }); }

function cors(req) {
  const o = req.headers.get('Origin');
  const h = { 'Vary': 'Origin' };
  if (allowedOrigin(o)) {
    h['Access-Control-Allow-Origin'] = o;
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}
function json(req, data, status, extra) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }, cors(req), extra || {})
  });
}
const dag = (t) => new Date(t).toISOString().slice(0, 10);
const kat = (k) => (typeof k === 'string' || typeof k === 'number') ? String(k).slice(0, 24).replace(/[^\wæøåÆØÅ-]/g, '') : '';

async function readBody(req) {
  const txt = await req.text();
  if (txt.length > 2000) return null;
  try { return JSON.parse(txt); } catch (e) { return null; }
}
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 16).map((x) => x.toString(16).padStart(2, '0')).join('');
}
function sameKey(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !b) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function validerScore(b) {
  if (!b || typeof b !== 'object') return 'ugyldig';
  if (!Object.prototype.hasOwnProperty.call(SPIL, b.spil)) return 'ukendt spil';
  const navn = typeof b.navn === 'string' ? b.navn.normalize('NFC').toUpperCase() : '';
  if (!NAVN_RE.test(navn)) return 'navn skal være 3 bogstaver';
  if (GRIMME.has(navn)) return 'navnet er ikke tilladt';
  if (!Number.isInteger(b.score) || b.score <= 0 || b.score > SPIL[b.spil]) return 'ugyldig score';
  return null;
}

async function top(env, spil, k, n) {
  const r = await env.DB.prepare('SELECT navn, score, dato FROM scores WHERE spil = ? AND kat = ? ORDER BY score DESC, id ASC LIMIT ?')
    .bind(spil, k, n).all();
  return r.results || [];
}

async function postScore(req, env) {
  if (!allowedOrigin(req.headers.get('Origin'))) return json(req, { ok: false, fejl: 'ikke tilladt' }, 403);
  const b = await readBody(req);
  const fejl = validerScore(b);
  if (fejl) return json(req, { ok: false, fejl: fejl }, 400);
  const now = Date.now(), d = dag(now);
  const ip = req.headers.get('CF-Connecting-IP') || '';
  const nogle = await sha(ip + '|' + d + '|' + (env.SALT || ''));
  const r = await env.DB.prepare('SELECT antal, sidst FROM rate WHERE nogle = ?').bind(nogle).first();
  if (r && now - r.sidst < 10000) return json(req, { ok: false, fejl: 'vent lidt', igen: Math.ceil((10000 - (now - r.sidst)) / 1000) }, 429);
  if (r && r.antal >= 50) return json(req, { ok: false, fejl: 'for mange i dag' }, 429);
  const navn = b.navn.normalize('NFC').toUpperCase(), k = kat(b.kat), dato = new Date(now).toISOString();
  const res = await env.DB.batch([
    env.DB.prepare('INSERT INTO rate (nogle, dag, antal, sidst) VALUES (?, ?, 1, ?) ON CONFLICT(nogle) DO UPDATE SET antal = antal + 1, sidst = excluded.sidst').bind(nogle, d, now),
    env.DB.prepare('INSERT INTO scores (spil, kat, navn, score, dato) VALUES (?, ?, ?, ?, ?)').bind(b.spil, k, navn, b.score, dato)
  ]);
  const id = res[1].meta.last_row_id;
  const p = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE spil = ? AND kat = ? AND (score > ? OR (score = ? AND id < ?))')
    .bind(b.spil, k, b.score, b.score, id).first();
  if (Math.random() < 0.05) await env.DB.prepare('DELETE FROM rate WHERE dag < ?').bind(dag(now - 2 * 86400000)).run();
  return json(req, { ok: true, placering: p.n + 1, liste: await top(env, b.spil, k, 10) });
}

async function postEvent(req, env) {
  const b = await readBody(req);
  if (!b || !Object.prototype.hasOwnProperty.call(SPIL, b.spil) || (b.type !== 'start' && b.type !== 'slut')) return json(req, { ok: false }, 400);
  const d = dag(Date.now());
  const st = [];
  let v = Number.isFinite(b.varighed) ? Math.round(b.varighed) : -1;
  if (b.type === 'slut' && v >= 0 && v <= 86400) {
    st.push(env.DB.prepare('INSERT INTO events (dag, spil, type, antal, varighed_sum, varighed_n) VALUES (?, ?, ?, 1, ?, 1) ON CONFLICT(dag, spil, type) DO UPDATE SET antal = antal + 1, varighed_sum = varighed_sum + excluded.varighed_sum, varighed_n = varighed_n + 1').bind(d, b.spil, b.type, v));
  } else {
    st.push(env.DB.prepare('INSERT INTO events (dag, spil, type, antal) VALUES (?, ?, ?, 1) ON CONFLICT(dag, spil, type) DO UPDATE SET antal = antal + 1').bind(d, b.spil, b.type));
  }
  if (b.type === 'start') {
    const m = typeof b.skaerm === 'string' && /^(\d{2,5})x(\d{2,5})$/.exec(b.skaerm);
    if (m) {
      const s = Math.min(9990, Math.round(+m[1] / 10) * 10) + 'x' + Math.min(9990, Math.round(+m[2] / 10) * 10);
      st.push(env.DB.prepare("INSERT INTO dims (dag, felt, vaerdi, antal) VALUES (?, 'skaerm', ?, 1) ON CONFLICT(dag, felt, vaerdi) DO UPDATE SET antal = antal + 1").bind(d, s));
    }
    if (typeof b.tema === 'string' && /^[a-z0-9-]{1,24}$/.test(b.tema)) {
      st.push(env.DB.prepare("INSERT INTO dims (dag, felt, vaerdi, antal) VALUES (?, 'tema', ?, 1) ON CONFLICT(dag, felt, vaerdi) DO UPDATE SET antal = antal + 1").bind(d, b.tema));
    }
  }
  await env.DB.batch(st);
  return json(req, { ok: true });
}

async function getStats(req, env, url) {
  if (!sameKey(url.searchParams.get('key') || '', env.STATS_KEY || '')) return json(req, { ok: false, fejl: 'forkert nøgle' }, 403);
  const fra = dag(Date.now() - 400 * 86400000);
  const [ev, dims, sc, scDag] = await env.DB.batch([
    env.DB.prepare('SELECT dag, spil, type, antal, varighed_sum, varighed_n FROM events WHERE dag >= ? ORDER BY dag').bind(fra),
    env.DB.prepare('SELECT dag, felt, vaerdi, antal FROM dims WHERE dag >= ? ORDER BY dag').bind(fra),
    env.DB.prepare('SELECT spil, COUNT(*) AS antal, MAX(score) AS bedst FROM scores GROUP BY spil ORDER BY antal DESC'),
    env.DB.prepare('SELECT substr(dato, 1, 10) AS dag, spil, COUNT(*) AS antal FROM scores WHERE dato >= ? GROUP BY 1, 2 ORDER BY 1').bind(fra)
  ]);
  return json(req, { ok: true, nu: new Date().toISOString(), events: ev.results, dims: dims.results, scores: sc.results, scoresPrDag: scDag.results });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    try {
      if (url.pathname === '/scores' && req.method === 'GET') {
        const spil = url.searchParams.get('spil');
        if (!Object.prototype.hasOwnProperty.call(SPIL, spil)) return json(req, { ok: false, fejl: 'ukendt spil' }, 400);
        const n = Math.max(1, Math.min(50, parseInt(url.searchParams.get('n'), 10) || 10));
        return json(req, { ok: true, liste: await top(env, spil, kat(url.searchParams.get('kat')), n) });
      }
      if (url.pathname === '/scores' && req.method === 'POST') return await postScore(req, env);
      if (url.pathname === '/event' && req.method === 'POST') return await postEvent(req, env);
      if (url.pathname === '/stats' && req.method === 'GET') return await getStats(req, env, url);
      if (url.pathname === '/') return json(req, { ok: true, navn: 'Hojt Arkade API' });
      return json(req, { ok: false, fejl: 'ikke fundet' }, 404);
    } catch (e) {
      return json(req, { ok: false, fejl: 'serverfejl' }, 500);
    }
  }
};

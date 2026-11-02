// Logiktest af Kælderen (js/logik.js) uden browser.
// Kør: node kaelderen/test/logik.test.js
'use strict';
const path = require('path');
require(path.join(__dirname, '..', 'js', 'logik.js'));
const L = globalThis.KaelderLogik;
let ok = 0, fail = 0;
function check(name, cond, info) { if (cond) { ok++; console.log('OK   ' + name); } else { fail++; console.log('FEJL ' + name + (info !== undefined ? ': ' + JSON.stringify(info) : '')); } }
const clone = o => JSON.parse(JSON.stringify(o));
const pos = s => s.fjender.map(f => [f.id, f.x, f.y, f.hp]);
// Hjælper: sæt en fjende på et bestemt felt (og fjern de andre)
function medFjende(s, type, x, y, ekstra) {
  s.fjender = [Object.assign({ id: 999, type: type, x: x, y: y, px: x, py: y, hp: L.FJENDER[type].hp, max: L.FJENDER[type].hp, vaagen: true, sidst: 0 }, ekstra || {})];
  return s.fjender[0];
}
// Find en lige, fri linje fra spilleren og vend spilleren mod den
function friLinje(s, n) {
  const p = s.spiller;
  for (let d = 0; d < 4; d++) {
    let k = 0; while (k < n && L.gaaelig(L.cell(s, p.x + L.DX[d] * (k + 1), p.y + L.DY[d] * (k + 1)))) k++;
    if (k >= n) { p.dir = d; return d; }
  }
  return -1;
}
function findStartMedLinje(n) {
  for (let seed = 1; seed < 400; seed++) {
    const r = L.createRun({ seed }); const s = r.state; s.ting = s.ting.filter(t => t.type === 'noegle'); s.fjender = [];
    if (friLinje(s, n) >= 0) return r;
  }
  throw new Error('ingen start med fri linje');
}

// 1) Seedet: samme seed giver samme kælder
{
  const a = L.createRun({ seed: 1234 }).state, b = L.createRun({ seed: 1234 }).state, c = L.createRun({ seed: 1235 }).state;
  check('samme seed giver samme etage', JSON.stringify(a.cells) === JSON.stringify(b.cells) && JSON.stringify(pos(a)) === JSON.stringify(pos(b)));
  check('andet seed giver en anden etage', JSON.stringify(a.cells) !== JSON.stringify(c.cells));
}
// 2) Uendelige etager: nøgle → låst dør → trappe kan altid løses (200 seeds × 8 etager)
{
  let fejl = [];
  for (let seed = 1; seed <= 200; seed++) {
    const r = L.createRun({ seed }); const s = r.state;
    for (let e = 1; e <= 8; e++) {
      const v = L.validerEtage(s);
      if (!v.noegleNaaelig || !v.trappeLukket || !v.trappeNaaelig) fejl.push({ seed, etage: s.etage, v });
      if (L.cell(s, s.spiller.x, s.spiller.y) === L.VAEG) fejl.push({ seed, etage: s.etage, start: 'i væg' });
      s.fase = 'butik'; r.naesteEtage();
    }
  }
  check('1600 etager: nøglen kan nås, trappen er bag den låste dør og kan nås med nøglen', fejl.length === 0, fejl.slice(0, 3));
}
// 3) Dybere etager har flere og stærkere fjender
{
  const r = L.createRun({ seed: 77 }); const s = r.state; const n1 = s.fjender.length, typer1 = new Set(s.fjender.map(f => f.type));
  for (let i = 0; i < 5; i++) { s.fase = 'butik'; r.naesteEtage(); }
  const typer6 = new Set(s.fjender.map(f => f.type));
  check('etage 1 har kun kravlere', [...typer1].every(t => t === 'kravler'), [...typer1]);
  check('etage 6 har flere fjender og flere typer', s.fjender.length > n1 && typer6.size >= 2, [s.fjender.length, n1, [...typer6]]);
}
// 4) Turbaseret: fjender rykker kun, når spilleren handler
{
  const r = findStartMedLinje(4); const s = r.state, p = s.spiller;
  const f = medFjende(s, 'kravler', p.x + L.DX[p.dir] * 4, p.y + L.DY[p.dir] * 4);
  const før = clone(pos(s));
  // Gå ind i en væg: intet træk, ingen tur
  const bag = (p.dir + 2) % 4; let res = null;
  if (!L.gaaelig(L.cell(s, p.x + L.DX[bag], p.y + L.DY[bag]))) res = r.act('tilbage');
  else { const gl = p.dir; p.dir = (p.dir + 1) % 4; if (!L.gaaelig(L.cell(s, p.x + L.DX[p.dir], p.y + L.DY[p.dir]))) res = r.act('frem'); p.dir = gl; }
  if (res) check('gå ind i en væg koster ingen tur', res.ok === false && res.tur === false && s.tur === 0 && JSON.stringify(pos(s)) === JSON.stringify(før));
  check('fjender står stille, når der ikke sker noget', JSON.stringify(pos(s)) === JSON.stringify(før));
  const t = r.act('vent');
  check('vent er en tur, og den vågne fjende rykker ét felt nærmere', t.tur && s.tur === 1 && Math.abs(f.x - p.x) + Math.abs(f.y - p.y) === 3, [f.x, f.y, p.x, p.y]);
  const d0 = p.dir; r.act('drejH');
  check('drej koster en tur', s.tur === 2 && p.dir === (d0 + 1) % 4);
  check('ukendt handling gør intet', r.act('flyv').ok === false && s.tur === 2);
}
// 5) Skud: træfchancen falder med afstanden, ammo er begrænset, nærkamp er reserve
{
  const s = L.createRun({ seed: 5 }).state;
  const c = [1, 2, 4, 6, 8].map(d => L.traefChance(s, d));
  check('træfchancen falder med afstanden', c.every((v, i) => i === 0 || v < c[i - 1]) && c[0] > 0.9 && c[4] < 0.25 + 1e-9 + 0.2, c);
  s.spiller.vaaben = 3;
  check('et bedre våben rammer sikrere', L.traefChance(s, 4) > c[2]);
  const r = findStartMedLinje(3); const st = r.state, p = st.spiller;
  medFjende(st, 'kolos', p.x + L.DX[p.dir] * 3, p.y + L.DY[p.dir] * 3, { vaagen: false });
  let k = r.kontekst();
  check('Handling skyder på fjenden foran med en vist chance', k.type === 'skyd' && k.afstand === 3 && Math.abs(k.chance - L.traefChance(st, 3)) < 1e-9, k.type);
  const a0 = p.ammo; r.act('handling');
  check('et skud bruger ét skud ammo', p.ammo === a0 - 1);
  check('skuddet vækker fjenden', st.fjender[0].vaagen === true);
  p.ammo = 0; k = r.kontekst();
  check('uden ammo kan man ikke skyde på afstand', k.type === 'ingenAmmo' && k.kan === false, k);
  const t0 = st.tur; const res = r.act('handling');
  check('Handling uden ammo koster ingen tur', res.ok === false && st.tur === t0);
  const f = st.fjender[0]; f.x = p.x + L.DX[p.dir]; f.y = p.y + L.DY[p.dir]; f.hp = 3;
  k = r.kontekst();
  check('tæt på uden ammo: slå (nærkamp)', k.type === 'slaa', k.type);
  r.act('handling');
  check('slaget gør 1 skade', f.hp === 2, f.hp);
}
// 6) Træf og drab giver skat; fjendens liv tæller ned
{
  const r = findStartMedLinje(1); const s = r.state, p = s.spiller; p.ammo = 50;
  const f = medFjende(s, 'kravler', p.x + L.DX[p.dir], p.y + L.DY[p.dir]);
  let skud = 0; while (f.hp > 0 && skud < 40 && s.fase === 'spil') { r.act('handling'); skud++; p.hp = p.maxHp; }
  check('kravleren kan nedkæmpes', f.hp <= 0 && s.fjender.indexOf(f) < 0 && s.drab === 1, [f.hp, s.drab]);
  check('en nedkæmpet fjende efterlader skat', s.ting.some(t => t.type === 'skat'));
}
// 7) Hvem kan ramme dig: kravler ved siden af, skytte på linje
{
  const r = findStartMedLinje(5); const s = r.state, p = s.spiller;
  medFjende(s, 'kravler', p.x + L.DX[p.dir] * 2, p.y + L.DY[p.dir] * 2);
  check('kravler to felter væk er ingen trussel', r.trusler().length === 0);
  s.fjender[0].x = p.x + L.DX[p.dir]; s.fjender[0].y = p.y + L.DY[p.dir];
  check('kravler ved siden af er en trussel', r.trusler().length === 1);
  medFjende(s, 'skytte', p.x + L.DX[p.dir] * 5, p.y + L.DY[p.dir] * 5);
  check('skytte på fri linje er en trussel', r.trusler().length === 1);
  const hp0 = p.hp; r.act('vent');
  check('skytten på linje skyder (træf eller forbi) – og hændelsen meldes', s.haendelser.some(e => e.type === 'fjendeSkud') && (p.hp < hp0) === s.haendelser.some(e => e.type === 'skade'), s.haendelser.map(e => e.type));
}
// 8) Game over ved liv 0
{
  const r = findStartMedLinje(1); const s = r.state, p = s.spiller;
  medFjende(s, 'kolos', p.x + L.DX[p.dir], p.y + L.DY[p.dir]);
  p.hp = 1; p.rustning = 0;
  for (let i = 0; i < 6 && s.fase === 'spil'; i++) r.act('vent');
  check('liv 0 giver game over', s.fase === 'slut' && p.hp <= 0 && s.doedAf === 'Kolos', [s.fase, p.hp, s.doedAf]);
  check('intet virker efter game over', r.act('frem').ok === false);
  check('point = etage × 1000 + skat', r.point() === s.etage * 1000 + s.skatIalt && r.end().score === r.point());
}
// 9) Nøgle, låst dør og trappe
{
  const r = L.createRun({ seed: 31 }); const s = r.state, p = s.spiller;
  const n = s.ting.find(t => t.type === 'noegle');
  // Teleportér ved siden af nøglen og saml den
  let sat = false;
  for (let d = 0; d < 4 && !sat; d++) { const x = n.x - L.DX[d], y = n.y - L.DY[d]; if (L.gaaelig(L.cell(s, x, y)) && !L.fjendeVed(s, x, y)) { p.x = x; p.y = y; p.dir = d; sat = true; } }
  s.fjender = [];
  r.act('frem');
  check('nøglekortet samles op', p.noegle === true && !s.ting.includes(n));
  // Find den låste dør og stil dig foran den
  let laast = null; for (let i = 0; i < s.cells.length; i++) if (s.cells[i] === L.LAAST) laast = { x: i % s.W, y: Math.floor(i / s.W) };
  let foran = false;
  for (let d = 0; d < 4 && !foran; d++) { const x = laast.x - L.DX[d], y = laast.y - L.DY[d]; if (L.gaaelig(L.cell(s, x, y))) { p.x = x; p.y = y; p.dir = d; foran = true; } }
  check('Handling foran den låste dør: lås op', r.kontekst().type === 'aabnLaast');
  r.act('handling');
  check('døren er åben', L.cell(s, laast.x, laast.y) === L.AABEN);
  p.x = s.trappe.x; p.y = s.trappe.y;
  check('på trappen: Handling = gå ned', r.kontekst().type === 'ned');
  r.act('handling');
  check('trappen fører til butikken', s.fase === 'butik' && s.dybde === 2);
}
// 10) Butik mellem etagerne
{
  const r = L.createRun({ seed: 8 }); const s = r.state; s.fase = 'butik'; s.skat = 100;
  const v = r.butik();
  check('butikken har 7 varer med navn, tekst og pris', v.length === 7 && v.every(x => x.navn && x.tekst && x.pris > 0));
  check('førstehjælp kan ikke købes ved fuldt liv', v.find(x => x.id === 'heal').kan === false);
  const pris = v.find(x => x.id === 'ammo').pris; s.spiller.ammo = 0;
  check('køb trækker skat og giver varen', r.koeb('ammo') && s.skat === 100 - pris && s.spiller.ammo === 6);
  check('prisen stiger efter køb', r.butik().find(x => x.id === 'ammo').pris > pris);
  s.skat = 5;
  check('for lidt skat: kan ikke købe', r.koeb('vaaben') === false && r.butik().find(x => x.id === 'vaaben').grund === 'For lidt skat');
  check('videre giver en ny etage', r.naesteEtage() && s.etage === 2 && s.fase === 'spil');
}
// 11) Kig-og-gå: ruten går kun gennem kendte felter og stopper ved siden af målet
{
  const r = L.createRun({ seed: 12 }); const s = r.state; s.fjender = [];
  s.udforsket.fill(1);
  let maal = null;
  for (let i = s.cells.length - 1; i >= 0 && !maal; i--) if (L.gaaelig(s.cells[i]) && r.rute(i % s.W, Math.floor(i / s.W))) maal = { x: i % s.W, y: Math.floor(i / s.W) };
  const rt = r.rute(maal.x, maal.y);
  check('ruten ender på målet', rt.length > 0 && rt[rt.length - 1].x === maal.x && rt[rt.length - 1].y === maal.y);
  check('ruten går kun gennem gangbare felter, ét felt ad gangen', rt.every((c, i) => { const f = i ? rt[i - 1] : s.spiller; return L.gaaelig(L.cell(s, c.x, c.y)) && Math.abs(c.x - f.x) + Math.abs(c.y - f.y) === 1; }));
  const rn = r.rute(maal.x, maal.y, { nabo: true });
  check('nabo-ruten stopper ved siden af', rn.length === rt.length - 1);
  s.udforsket.fill(0); s.udforsket[s.spiller.y * s.W + s.spiller.x] = 1;
  check('ingen rute gennem ukendte felter', r.rute(maal.x, maal.y) === null);
  const a = r.trinMod(rt[0].x, rt[0].y);
  check('trinMod drejer først eller går frem', ['frem', 'drejV', 'drejH'].includes(a));
}
// 12) Hændelser til lyd og grafik
{
  const r = findStartMedLinje(2); const s = r.state; s.fjender = [];
  r.act('frem');
  check('skridt giver en skridt-hændelse og husker forrige position', s.haendelser.some(e => e.type === 'skridt') && s.forrige && typeof s.forrige.x === 'number');
}
// 13) Fælder: kister (og Mimik) og den spærrede dør med hammeren
{
  // Find en etage med et skatterum (bag brædder) og mindst én kiste
  function etage(nr, krav) {
    for (let seed = 1; seed < 400; seed++) {
      const r = L.createRun({ seed }); const s = r.state;
      while (s.etage < nr) { s.fase = 'butik'; r.naesteEtage(); }
      if (krav(s)) return r;
    }
    return null;
  }
  const ingen1 = L.createRun({ seed: 3 }).state;
  check('etage 1 har ingen kister, hammer eller spærret dør', !ingen1.ting.some(t => t.type === 'kiste' || t.type === 'hammer') && !ingen1.cells.includes(L.SPAERRET));
  // Alle etager 1–8 for mange frø: nøgle, trappe og hammer kan nås uden skatterummet, og kister spærrer ingen vej
  let alleOk = true, medSpaerret = 0, kister = 0, mimik = 0;
  for (let seed = 1; seed <= 25; seed++) {
    const r = L.createRun({ seed }); const s = r.state;
    for (let e = 1; e <= 8; e++) {
      const v = L.validerEtage(s);
      if (!v.ok || !v.hammerNaaelig) alleOk = false;
      if (s.spaerret && s.spaerret.doere) {
        medSpaerret++;
        const h = s.ting.find(t => t.type === 'hammer'); if (!h) alleOk = false;
        // skatterummet kan kun nås gennem brædderne
        const uden = L.naaelige(s, true, false), med = L.naaelige(s, true, true);
        const iRum = s.ting.filter(t => t.skatterum);
        if (!iRum.length || iRum.some(t => uden[t.y * s.W + t.x]) || iRum.some(t => !med[t.y * s.W + t.x])) alleOk = false;
      }
      s.ting.forEach(t => { if (t.type === 'kiste') { kister++; if (t.mimik) mimik++; if (t.mimik && e < L.RULES.mimikFra) alleOk = false; } });
      s.fase = 'butik'; r.naesteEtage();
    }
  }
  check('alle etager kan klares uden skatterummet, og hammeren kan altid nås (' + medSpaerret + ' skatterum)', alleOk && medSpaerret > 50);
  check('der er kister og Mimik-kister (' + kister + ' kister, ' + mimik + ' Mimik)', kister > 100 && mimik > 10 && mimik < kister / 2);

  // Kiste: står i vejen, åbnes med Handling og giver skat
  let r = etage(2, s => s.ting.some(t => t.type === 'kiste' && !t.mimik && !t.skatterum));
  let s = r.state; s.fjender = [];
  let k = s.ting.find(t => t.type === 'kiste' && !t.mimik && !t.skatterum);
  // stil spilleren ved siden af kisten, med ansigtet mod den
  let d = [0, 1, 2, 3].find(d => L.gaaelig(L.cell(s, k.x - L.DX[d], k.y - L.DY[d])) && !L.erKiste(s, k.x - L.DX[d], k.y - L.DY[d]));
  s.spiller.x = k.x - L.DX[d]; s.spiller.y = k.y - L.DY[d]; s.spiller.dir = d;
  check('foran en kiste: Handling er "Åbn kisten"', r.kontekst().type === 'aabnKiste' && r.kontekst().label === 'Åbn kisten');
  check('man kan ikke gå ind i en kiste', r.act('frem').ok === false && s.spiller.x === k.x - L.DX[d]);
  const skat0 = s.skat;
  check('en kiste giver skat og forsvinder', r.act('handling').ok && s.skat === skat0 + k.vaerdi && !s.ting.includes(k));

  // Mimik: knirker foran, og bliver til en vågen fjende, når den åbnes
  r = etage(3, s => s.ting.some(t => t.type === 'kiste' && t.mimik));
  check('der findes en Mimik-kiste fra etage 3', !!r);
  s = r.state; s.fjender = [];
  k = s.ting.find(t => t.type === 'kiste' && t.mimik);
  d = [0, 1, 2, 3].find(d => L.gaaelig(L.cell(s, k.x - L.DX[d], k.y - L.DY[d])) && !L.erKiste(s, k.x - L.DX[d], k.y - L.DY[d]));
  s.spiller.x = k.x - L.DX[d]; s.spiller.y = k.y - L.DY[d]; s.spiller.dir = (d + 1) % 4;
  r.act('drejV');
  check('en Mimik-kiste knirker, når man står foran den', s.spiller.dir === d && /knirker/.test(s.besked) && r.kontekst().knirker === true);
  const hp0 = s.spiller.hp;
  r.act('handling');
  const m = s.fjender.find(f => f.type === 'mimik');
  check('Mimik-kisten bliver til en vågen Mimik', !!m && m.vaagen && m.x === k.x && m.y === k.y && !s.ting.includes(k));
  check('Mimikken bider i samme tur', s.spiller.hp < hp0);
  check('Mimikken kan skydes som andre fjender', r.kontekst().type === 'skyd' || r.kontekst().type === 'slaa');

  // Spærret dør: kræver hammeren, og så åbner den til skatterummet
  r = etage(2, s => s.spaerret && s.spaerret.doere);
  s = r.state; s.fjender = [];
  const dd = s.spaerret.doere[0];
  d = [0, 1, 2, 3].find(d => { const x = dd.x - L.DX[d], y = dd.y - L.DY[d]; return L.gaaelig(L.cell(s, x, y)) && s.rum[y * s.W + x] !== s.spaerret.rum; });
  s.spiller.x = dd.x - L.DX[d]; s.spiller.y = dd.y - L.DY[d]; s.spiller.dir = d;
  check('uden hammer: døren er spærret og kan ikke åbnes', r.kontekst().type === 'spaerret' && r.kontekst().kan === false && r.act('handling').ok === false && L.cell(s, dd.x, dd.y) === L.SPAERRET);
  check('man kan ikke gå gennem brædderne', r.act('frem').ok === false);
  const h = s.ting.find(t => t.type === 'hammer');
  s.ting.splice(s.ting.indexOf(h), 1); s.spiller.hammer = true;   // som om den er samlet op
  check('med hammeren: Handling slår brædderne ned', r.kontekst().type === 'slaaNed' && r.act('handling').ok && s.spaerret.doere.every(p => L.cell(s, p.x, p.y) === L.AABEN));
  // hammeren samles op som en ting
  const r2 = etage(2, s => s.ting.some(t => t.type === 'hammer'));
  const s2 = r2.state, h2 = s2.ting.find(t => t.type === 'hammer');
  const d2 = [0, 1, 2, 3].find(d => L.gaaelig(L.cell(s2, h2.x - L.DX[d], h2.y - L.DY[d])) && !L.tingVed(s2, h2.x - L.DX[d], h2.y - L.DY[d]));
  s2.fjender = []; s2.spiller.x = h2.x - L.DX[d2]; s2.spiller.y = h2.y - L.DY[d2]; s2.spiller.dir = d2;
  r2.act('frem');
  check('hammeren samles op', s2.spiller.hammer === true && !s2.ting.includes(h2));
  // tilstanden kan stadig gemmes som JSON
  check('tilstanden med kister og brædder kan gemmes som JSON', JSON.parse(JSON.stringify(s)).spaerret.rum === s.spaerret.rum);
}
console.log('\n' + ok + ' af ' + (ok + fail) + ' test bestået');
process.exit(fail ? 1 : 0);

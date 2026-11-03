/*
 * Hojt Arkade – audio.js
 * Musik og lydeffekter lavet direkte med Web Audio API
 * (ingen lydfiler, ingen rettighedsproblemer).
 *
 *   const lyd = ArkadeAudio.create({ sfx: true, music: true });
 *   lyd.unlock();             // kald ved første klik/tast (browserens autoplay-regler)
 *   lyd.play('eat');          // se LYDE nedenfor
 *   lyd.setSfx(false); lyd.setMusic(true);
 *
 * Musik: syv numre. Hvert spil får sit eget nummer af sig selv (ud fra mappens navn, se
 * SPIL_NUMRE): Neon-nat, Rolig flade, Chiptune, Lounge, Eventyr, Havet og Rummet. Hvert
 * nummer har to dele (A og B), der skifter, så det ikke bliver ensformigt.
 *
 * Lydpakker: Neon (bløde toner med ekko), Tegneserie (boing, pop og træklods) og Retro-pixel
 * (8-bit firkantbølger i hak). Pakken følger arkadens stil, men kan vælges fast under
 * Indstillinger → Lyd i hallen (arkade.lydpakke: 'stil' | 'neon' | 'tegneserie' | 'pixel').
 * Alle lyde findes i alle tre pakker: de er skrevet én gang med "roller" (blød, lys, bas,
 * summen), og pakken bestemmer klangen.
 *
 * Lydstyrke: arkade.musikStyrke og arkade.lydStyrke ('lav' | 'mellem' | 'hoej'), læses fra de
 * fælles indstillinger. lyd.setVolume({ musik, lyd }) og lyd.setPakke(navn) til hallen.
 *
 * LYDE (fælles): click, move, eat, bonus, bonusSpawn, bonusGone, obstacle, crash, pause, record,
 *   og til de enkelte spil: pop, swap, drop, place, line, flip, card, shuffle, bounce, hit, coin,
 *   splash, water, shoot, explode, step, jump, door, select, win, lose, tick, turn, wrong, levelUp.
 */
(function (global) {
  'use strict';

  var NOTE = function (midi) { return 440 * Math.pow(2, (midi - 69) / 12); };
  var KEY = 'hojtArkade.arkade.indstillinger';
  var STYRKE = { lav: 0.5, mellem: 1, hoej: 1.45 };

  // Hvilket nummer hvert spil (mappe) spiller. Hallen og ukendte sider: Neon-nat.
  var SPIL_NUMRE = {
    hal: 'neon', slangen: 'neon', loeberen: 'neon', flipper: 'neon', muren: 'neon', bobler: 'neon', juveler: 'neon',
    sudoku: 'rolig', kabalen: 'rolig', pixelgaader: 'rolig', 'lys-ud': 'rolig', rorlaegger: 'rolig', minestryger: 'rolig', kasser: 'rolig',
    blokke: 'chip', bomberne: 'chip', froeen: 'chip', labyrinten: 'chip', kanonen: 'chip', rampen: 'chip',
    billard: 'lounge', golf: 'lounge', 'fire-paa-stribe': 'lounge',
    kaelderen: 'eventyr', taarnene: 'eventyr',
    kaperen: 'havet', soeslag: 'havet',
    rumhandleren: 'rummet'
  };
  var NUMRE = { neon: 'Neon-nat', rolig: 'Rolig flade', chip: 'Chiptune', lounge: 'Lounge', eventyr: 'Eventyr', havet: 'Havet', rummet: 'Rummet' };
  var PAKKER = ['neon', 'tegneserie', 'pixel'];

  function prefs() {
    try { var o = JSON.parse(global.localStorage.getItem(KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
  }
  function spilNavn() {
    try {
      var p = String(global.location.pathname || '').split('/').filter(Boolean);
      if (p.length && /\.html?$/.test(p[p.length - 1])) p.pop();
      var d = p.length ? p[p.length - 1] : '';
      return SPIL_NUMRE[d] ? d : 'hal';
    } catch (e) { return 'hal'; }
  }
  function stilNu(pr) {
    if (global.ArkadeStil && global.ArkadeStil.stil) return global.ArkadeStil.stil();
    return PAKKER.indexOf(pr.stil) >= 0 ? pr.stil : 'neon';
  }
  function pakkeFor(valg, pr) { return PAKKER.indexOf(valg) >= 0 ? valg : stilNu(pr); }

  // Pakkernes klang for hver rolle
  var KLANG = {
    neon:       { blod: 'sine', lys: 'triangle', skarp: 'square', bas: 'triangle', summen: 'sawtooth', filter: 1, ekko: true },
    tegneserie: { blod: 'sine', lys: 'sine', skarp: 'triangle', bas: 'sine', summen: 'triangle', filter: 1.6, boing: true },
    pixel:      { blod: 'square', lys: 'square', skarp: 'square', bas: 'square', summen: 'square', filter: 6, hak: true }
  };

  function create(opts) {
    opts = opts || {};
    var pr = prefs();
    var sfxOn = opts.sfx !== false;
    var musicOn = opts.music !== false;
    var musikStyrke = STYRKE[pr.musikStyrke] || 1, lydStyrke = STYRKE[pr.lydStyrke] || 1;
    var pakke = pakkeFor(opts.pakke || pr.lydpakke, pr);
    var nummer = opts.nummer || SPIL_NUMRE[spilNavn()] || 'neon';
    var ctx = null, master, sfxBus, musicBus, delayIn, noiseBuf;
    var timer = null, nextTime = 0, step = 0, unlocked = false;
    var MUSIK_NIVEAU = 0.5, LYD_NIVEAU = 0.55;

    function ensure() {
      if (ctx) return ctx;
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC && !opts.ctx) return null;
      ctx = opts.ctx || new AC();   // opts.ctx: fx en OfflineAudioContext i testen
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = 0.9;
      master.connect(comp); comp.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = LYD_NIVEAU * lydStyrke; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
      // Ekko til arpeggio/pad
      delayIn = ctx.createGain(); delayIn.gain.value = 1;
      var d = ctx.createDelay(1.5); d.delayTime.value = 0.49;
      var fb = ctx.createGain(); fb.gain.value = 0.32;
      var dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2200;
      delayIn.connect(d); d.connect(dl); dl.connect(fb); fb.connect(d); dl.connect(musicBus);
      // Hvid støj til trommer, bølger og pop
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var data = noiseBuf.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      return ctx;
    }

    function tone(dest, freq, t, dur, o) {
      o = o || {};
      var osc = ctx.createOscillator();
      osc.type = o.type || 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      if (o.slideTo) {
        if (o.hak) {   // retro-pixel: tonen springer i fire hak i stedet for at glide
          for (var k = 1; k <= 3; k++) osc.frequency.setValueAtTime(freq * Math.pow(o.slideTo / freq, k / 3), t + dur * k / 4);
        } else osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
      }
      if (o.detune) osc.detune.value = o.detune;
      var g = ctx.createGain();
      var peak = o.gain || 0.2, a = o.attack || 0.005, r = o.release || dur;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      if (o.hold) g.gain.setValueAtTime(peak, t + Math.max(a, r - 0.02));
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.01, r));
      var node = osc;
      if (o.filter) {
        var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.filter; f.Q.value = o.q || 1;
        osc.connect(f); node = f;
      }
      node.connect(g); g.connect(dest);
      if (o.send) g.connect(delayIn);
      osc.start(t); osc.stop(t + Math.max(a + 0.02, r) + 0.05);
    }
    function noise(dest, t, dur, o) {
      o = o || {};
      var src = ctx.createBufferSource(); src.buffer = noiseBuf;
      var f = ctx.createBiquadFilter(); f.type = o.type || 'highpass'; f.frequency.value = o.freq || 6000; f.Q.value = o.q || 0.7;
      if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t + dur);
      var g = ctx.createGain();
      if (o.attack) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain || 0.05, t + o.attack); }
      else g.gain.setValueAtTime(o.gain || 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(dest);
      src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.02);
    }

    // ---------- Lydeffekter ----------
    // v(rolle, frekvens, t, varighed, opts): én tone i pakkens klang.
    //   Tegneserie: lyse toner får et lille "boing" (tonen hopper op og falder på plads).
    //   Retro-pixel: firkantbølger, glid i hak og et kort, fladt forløb.
    function v(rolle, freq, t, dur, o) {
      o = o || {};
      var K = KLANG[pakke], p = {};
      for (var k in o) p[k] = o[k];
      p.type = K[rolle] || 'triangle';
      if (p.filter) p.filter *= K.filter;
      if (K.hak) { p.hak = true; p.gain = (p.gain || 0.2) * 0.32; p.attack = 0.002; p.hold = true; if (!p.filter) p.filter = 5000; }
      if (K.boing && !p.slideTo && (rolle === 'lys' || rolle === 'blod') && dur < 0.4) {
        tone(sfxBus, freq * 0.82, t, Math.min(0.05, dur * 0.3), { type: 'sine', gain: (p.gain || 0.2) * 0.7, slideTo: freq * 1.04 });
        t += 0.03;
      }
      tone(sfxBus, freq, t, dur, p);
    }
    function n(t, dur, o) { o = o || {}; if (KLANG[pakke].hak) { o.type = 'lowpass'; o.freq = Math.min(o.freq || 3000, 3000); } noise(sfxBus, t, dur, o); }
    function klods(t, freq) {   // tegneseriens træklods / pixelens klik / neons lille tik
      if (pakke === 'tegneserie') { tone(sfxBus, freq || 900, t, 0.05, { type: 'sine', gain: 0.14, slideTo: (freq || 900) * 0.7 }); n(t, 0.03, { type: 'bandpass', freq: 1400, gain: 0.05 }); }
      else if (pakke === 'pixel') tone(sfxBus, freq || 880, t, 0.04, { type: 'square', gain: 0.06, hold: true, filter: 5000 });
      else tone(sfxBus, freq || 880, t, 0.08, { type: 'sine', gain: 0.12 });
    }
    function arp(rolle, notes, t, gap, dur, gain) { notes.forEach(function (m, i) { v(rolle, NOTE(m), t + i * gap, dur, { gain: gain }); }); }

    var SFX = {
      click: function (t) { klods(t, 880); },
      move: function (t) { v('lys', 196, t, 0.09, { gain: 0.14, slideTo: 247 }); },
      eat: function (t) {
        v('skarp', NOTE(76), t, 0.12, { gain: 0.09, filter: 2500 });
        v('skarp', NOTE(83), t + 0.08, 0.18, { gain: 0.09, filter: 2500 });
      },
      bonus: function (t) { arp('lys', [72, 76, 79, 84], t, 0.07, 0.22, 0.16); },
      bonusSpawn: function (t) {
        v('blod', NOTE(79), t, 0.2, { gain: 0.12 });
        v('blod', NOTE(86), t + 0.12, 0.3, { gain: 0.1 });
      },
      bonusGone: function (t) {
        v('blod', NOTE(74), t, 0.2, { gain: 0.1 });
        v('blod', NOTE(67), t + 0.14, 0.3, { gain: 0.09 });
      },
      obstacle: function (t) { v('summen', 98, t, 0.35, { gain: 0.12, filter: 500, slideTo: 82 }); },
      crash: function (t) {
        v('summen', 330, t, 0.8, { gain: 0.14, filter: 900, slideTo: 55 });
        n(t, 0.4, { type: 'lowpass', freq: 900, gain: 0.08 });
      },
      pause: function (t) {
        v('blod', NOTE(69), t, 0.15, { gain: 0.1 });
        v('blod', NOTE(64), t + 0.1, 0.2, { gain: 0.1 });
      },
      record: function (t) { arp('lys', [67, 71, 74, 79, 83], t, 0.1, 0.4, 0.13); },

      // ----- Til de enkelte spil -----
      // Boble eller juvel, der springer
      pop: function (t) {
        v('blod', NOTE(84), t, 0.07, { gain: 0.2, slideTo: NOTE(91) });
        n(t, 0.05, { type: 'bandpass', freq: 3200, gain: 0.08 });
      },
      // To ting bytter plads
      swap: function (t) { v('lys', NOTE(67), t, 0.08, { gain: 0.1, slideTo: NOTE(74) }); v('lys', NOTE(74), t + 0.07, 0.08, { gain: 0.09, slideTo: NOTE(67) }); },
      // Noget falder ned og lander (brik, mønt i kolonne)
      drop: function (t) { v('lys', NOTE(79), t, 0.16, { gain: 0.11, slideTo: NOTE(62) }); klods(t + 0.15, 300); },
      // En brik lægges på plads
      place: function (t) { klods(t, 520); v('bas', NOTE(48), t, 0.12, { gain: 0.12, filter: 900 }); },
      // En række/linje fuldført
      line: function (t) { arp('lys', [72, 79, 84, 88], t, 0.05, 0.2, 0.12); n(t, 0.3, { type: 'highpass', freq: 5000, gain: 0.025, sweepTo: 9000 }); },
      // Vend (kort, lampe, felt)
      flip: function (t) { n(t, 0.06, { type: 'bandpass', freq: 2500, gain: 0.1, sweepTo: 5000 }); v('blod', NOTE(81), t + 0.02, 0.06, { gain: 0.1 }); },
      // Et kort lægges
      card: function (t) { n(t, 0.08, { type: 'bandpass', freq: 1800, gain: 0.08, sweepTo: 900 }); klods(t + 0.05, 420); },
      // Bland kortene
      shuffle: function (t) { for (var i = 0; i < 6; i++) n(t + i * 0.05, 0.05, { type: 'bandpass', freq: 2200 + i * 150, gain: 0.05 }); },
      // Kugle mod bande eller væg
      bounce: function (t) { v('blod', NOTE(62), t, 0.1, { gain: 0.12, slideTo: NOTE(57) }); klods(t, 640); },
      // Et træf (kugle i kugle, skud i mål)
      hit: function (t) { klods(t, 1200); v('skarp', NOTE(72), t, 0.08, { gain: 0.07, filter: 3000 }); },
      // Mønt eller skat
      coin: function (t) { v('skarp', NOTE(83), t, 0.07, { gain: 0.08, filter: 4000 }); v('skarp', NOTE(88), t + 0.07, 0.25, { gain: 0.08, filter: 4000 }); },
      // Plask (vand, kugle i hul)
      splash: function (t) { n(t, 0.45, { type: 'bandpass', freq: 1200, gain: 0.18, sweepTo: 400, q: 0.6 }); v('blod', NOTE(55), t, 0.2, { gain: 0.12, slideTo: NOTE(48) }); },
      // Vand, der løber
      water: function (t) { for (var i = 0; i < 5; i++) v('blod', NOTE(72 + (i * 5) % 12), t + i * 0.09, 0.12, { gain: 0.05, slideTo: NOTE(79 + (i * 5) % 12) }); n(t, 0.6, { type: 'bandpass', freq: 900, gain: 0.03, attack: 0.1 }); },
      // Skud (kanon, laser)
      shoot: function (t) {
        if (pakke === 'pixel') { n(t, 0.15, { type: 'lowpass', freq: 2500, gain: 0.1 }); v('skarp', NOTE(76), t, 0.12, { gain: 0.1, slideTo: NOTE(52) }); }
        else { n(t, 0.25, { type: 'lowpass', freq: 1400, gain: 0.12, sweepTo: 200 }); v('bas', 140, t, 0.25, { gain: 0.16, slideTo: 50 }); }
      },
      // Eksplosion (bombe, skib sænket)
      explode: function (t) { n(t, 0.8, { type: 'lowpass', freq: 1800, gain: 0.16, sweepTo: 120 }); v('bas', 90, t, 0.7, { gain: 0.2, slideTo: 32 }); },
      // Et skridt
      step: function (t) { klods(t, 220); },
      // Et hop
      jump: function (t) { v('lys', NOTE(60), t, 0.14, { gain: 0.1, slideTo: NOTE(72) }); },
      // Dør eller låge
      door: function (t) { v('summen', 110, t, 0.3, { gain: 0.14, filter: 700, slideTo: 140 }); n(t + 0.2, 0.1, { type: 'bandpass', freq: 600, gain: 0.1 }); },
      // Et valg (felt, kolonne)
      select: function (t) { v('blod', NOTE(76), t, 0.08, { gain: 0.14 }); },
      // Vundet (runde, kamp)
      win: function (t) { arp('lys', [72, 76, 79, 84, 79, 84, 88], t, 0.09, 0.3, 0.13); },
      // Tabt
      lose: function (t) { arp('blod', [67, 63, 60, 55], t, 0.18, 0.4, 0.11); },
      // Lille tik (tæller, drejning)
      tick: function (t) { klods(t, 1500); },
      // En drejning (rør, sigte)
      turn: function (t) { v('lys', NOTE(69), t, 0.06, { gain: 0.08, slideTo: NOTE(71) }); klods(t + 0.04, 700); },
      // Ikke muligt
      wrong: function (t) { v('summen', 140, t, 0.18, { gain: 0.08, filter: 600 }); v('summen', 120, t + 0.12, 0.2, { gain: 0.08, filter: 600 }); },
      // Ny bane eller nyt niveau
      levelUp: function (t) { arp('lys', [60, 64, 67, 72, 76, 79], t, 0.07, 0.25, 0.12); }
    };

    // ---------- Musik ----------
    // Hvert nummer: { bpm, takt (16-dele pr. takt), A og B (akkorder pr. takt), del(s, t, akkord, pos, takt) }
    function M(rolle, m, t, dur, o) { o = o || {}; o.type = o.type || rolle; tone(musicBus, NOTE(m), t, dur, o); }
    function tromme(t, f, g) { tone(musicBus, f || 110, t, 0.3, { type: 'sine', gain: g || 0.35, slideTo: 42 }); }
    function lille(t, g) { noise(musicBus, t, 0.22, { type: 'bandpass', freq: 1800, gain: g || 0.07 }); }
    function hihat(t, g) { noise(musicBus, t, 0.05, { type: 'highpass', freq: 7500, gain: g || 0.025 }); }
    function pad(ch, t, dur, g, filter, type) {
      ch.notes.forEach(function (m) {
        M(type || 'sawtooth', m, t, dur, { gain: g, attack: 0.5, release: dur, filter: filter || 1100, detune: -7, send: true });
        M(type || 'sawtooth', m, t, dur, { gain: g, attack: 0.5, release: dur, filter: filter || 1100, detune: 7 });
      });
    }
    var C = function (root, notes) { return { root: root, notes: notes }; };
    var ARP = [0, 1, 2, 1, 2, 3, 2, 1];

    var TRACKS = {
      // Neon-nat: rolig synthwave i a-mol (det oprindelige nummer) med en B-del og en melodi
      neon: { bpm: 88, takt: 16,
        A: [C(45, [57, 60, 64]), C(41, [53, 57, 60]), C(48, [55, 60, 64]), C(43, [55, 59, 62])],
        B: [C(38, [57, 62, 65]), C(45, [57, 60, 64]), C(41, [57, 60, 65]), C(40, [56, 59, 64])],
        MEL: [76, -1, 74, 72, -1, 71, 72, -1, 69, -1, 67, 69, 72, -1, 71, -1],
        del: function (s, t, ch, pos, bar, B, S) {
          if (pos === 0) pad(ch, t, S * 16, 0.022);
          if (pos % 2 === 0) {
            var oct = (pos % 4 === 2) ? 12 : 0;
            M('sawtooth', ch.root + oct - 12, t, S * 1.8, { gain: 0.11, filter: 420, q: 4, release: S * 1.8 });
            var nn = ch.notes.concat([ch.notes[0] + 12])[ARP[(pos / 2) % ARP.length]] + 12;
            M('triangle', nn, t, S * 1.5, { gain: B ? 0.022 : 0.035, release: S * 1.5, send: true });
          }
          if (B && pos % 2 === 0) { var mm = this.MEL[(bar % 2) * 8 + pos / 2]; if (mm > 0) M('square', mm, t, S * 2.5, { gain: 0.018, filter: 2400, release: S * 2.5, send: true }); }
          if (pos === 0 || pos === 8) tromme(t);
          if (pos === 4 || pos === 12) lille(t);
          if (pos % 4 === 2) hihat(t);
        } },
      // Rolig flade: langsomme flader og spredte klokketoner, ingen trommer (til tænkespil)
      rolig: { bpm: 66, takt: 16,
        A: [C(48, [60, 64, 67, 71]), C(45, [57, 60, 64, 67]), C(41, [57, 60, 64, 65]), C(43, [55, 59, 62, 64])],
        B: [C(50, [62, 65, 69, 72]), C(43, [59, 62, 67, 71]), C(48, [60, 64, 67, 72]), C(41, [57, 60, 65, 69])],
        BELL: [0, 2, 1, 3, 2, 0, 3, 1],
        del: function (s, t, ch, pos, bar, B, S) {
          if (pos === 0) { pad(ch, t, S * 16, 0.016, 800, 'triangle'); M('sine', ch.root - 12, t, S * 16, { gain: 0.08, attack: 1, release: S * 16 }); }
          if (pos % 4 === 0 && ((s / 4) % 3 !== 2)) {
            var nn = ch.notes[this.BELL[(s / 4) % this.BELL.length] % ch.notes.length] + (B ? 24 : 12);
            M('sine', nn, t, S * 6, { gain: 0.04, attack: 0.01, release: S * 6, send: true });
          }
        } },
      // Chiptune: 8-bit melodi, trekantbas og støjtrommer
      chip: { bpm: 120, takt: 16,
        A: [C(48, [60, 64, 67]), C(43, [55, 59, 62]), C(45, [57, 60, 64]), C(41, [53, 57, 60])],
        B: [C(41, [53, 57, 60]), C(43, [55, 59, 62]), C(48, [60, 64, 67]), C(48, [60, 64, 67])],
        MA: [72, -1, 76, 79, 76, -1, 72, 74, 76, -1, 74, 72, 71, -1, 67, -1],
        MB: [77, 76, 74, 72, 74, -1, 79, -1, 76, 74, 72, 74, 72, -1, -1, -1],
        del: function (s, t, ch, pos, bar, B, S) {
          var mel = B ? this.MB : this.MA, mm = mel[pos];
          if (bar % 2 === 1 && !B) mm = mel[(pos + 8) % 16];
          if (mm > 0) M('square', mm, t, S * 0.9, { gain: 0.018, hold: true, filter: 3500, release: S * 0.9 });
          if (pos % 2 === 0) M('triangle', ch.root + (pos % 4 ? 12 : 0) - 12, t, S * 1.6, { gain: 0.075, hold: true, release: S * 1.6 });
          if (pos % 4 === 0 && pos % 8 !== 0) M('square', ch.notes[(pos / 4) % 3] + 12, t, S * 0.6, { gain: 0.012, hold: true, filter: 3000, release: S * 0.6 });
          if (pos === 0 || pos === 8 || (B && pos === 10)) noise(musicBus, t, 0.08, { type: 'lowpass', freq: 400, gain: 0.16 });
          if (pos === 4 || pos === 12) noise(musicBus, t, 0.12, { type: 'bandpass', freq: 2500, gain: 0.06 });
          if (pos % 2 === 1) hihat(t, 0.015);
        } },
      // Lounge: jazzede akkorder, gående bas, børstetrommer i swing
      lounge: { bpm: 92, takt: 16, swing: 0.33,
        A: [C(50, [60, 65, 69, 72]), C(43, [59, 62, 65, 69]), C(48, [59, 64, 67, 71]), C(45, [61, 64, 67, 72])],
        B: [C(41, [57, 60, 64, 67]), C(40, [56, 59, 62, 65]), C(45, [55, 60, 64, 67]), C(43, [53, 59, 62, 65])],
        WALK: [0, 4, 7, 9],
        del: function (s, t, ch, pos, bar, B, S) {
          if (pos === 0 || pos === 10) ch.notes.forEach(function (m) { M('sine', m, t, S * 5, { gain: 0.03, attack: 0.01, release: S * 5 }); M('triangle', m + 12, t, S * 2, { gain: 0.008, release: S * 2 }); });
          if (pos % 4 === 0) M('triangle', ch.root - 12 + this.WALK[pos / 4], t, S * 3.5, { gain: 0.13, attack: 0.01, release: S * 3.5, filter: 900 });
          if (pos % 4 === 0 || pos % 4 === 3) noise(musicBus, t, pos % 4 ? 0.06 : 0.18, { type: 'bandpass', freq: 5000, gain: pos % 4 ? 0.012 : 0.02, q: 0.4 });
          if (pos === 4 || pos === 12) noise(musicBus, t, 0.25, { type: 'bandpass', freq: 3000, gain: 0.03, q: 0.3 });
          if (pos === 0) tone(musicBus, 70, t, 0.25, { type: 'sine', gain: 0.18, slideTo: 45 });
          if (B && (pos === 6 || pos === 14)) M('sine', ch.notes[3] + 12, t, S * 3, { gain: 0.025, release: S * 3, send: true });
        } },
      // Eventyr: mørk dronetone, langsomme strygere og en klokke (til Kælderen og Tårnene)
      eventyr: { bpm: 70, takt: 16,
        A: [C(38, [50, 57, 62]), C(38, [50, 57, 62]), C(34, [46, 53, 58]), C(36, [48, 55, 60])],
        B: [C(41, [53, 57, 60]), C(36, [48, 55, 60]), C(34, [46, 53, 58]), C(33, [49, 57, 61])],
        MEL: [74, 72, 69, -1, 70, 69, 67, -1],
        del: function (s, t, ch, pos, bar, B, S) {
          if (pos === 0) {
            pad(ch, t, S * 16, 0.02, 600);
            M('sawtooth', 26, t, S * 16, { gain: 0.06, attack: 1.2, release: S * 16, filter: 220 });
            tone(musicBus, 65, t, 0.9, { type: 'sine', gain: 0.22, slideTo: 40 });
          }
          if (pos === 8 && B) tone(musicBus, 60, t, 0.7, { type: 'sine', gain: 0.14, slideTo: 38 });
          if (pos % 4 === 0) { var mm = this.MEL[((bar % 2) * 4 + pos / 4) % 8]; if (mm > 0 && (B || pos % 8 === 0)) M('sine', mm + (B ? 12 : 0), t, S * 7, { gain: 0.03, attack: 0.01, release: S * 7, send: true }); }
        } },
      // Havet: 6/8 som en sømandssang, harmonika og bølger
      havet: { bpm: 100, takt: 12,
        A: [C(43, [55, 59, 62]), C(48, [55, 60, 64]), C(43, [55, 59, 62]), C(50, [54, 57, 62])],
        B: [C(40, [52, 55, 59]), C(48, [52, 55, 60]), C(50, [54, 57, 62]), C(43, [55, 59, 62])],
        MEL: [67, -1, 71, 74, -1, 71, 72, -1, 69, 67, -1, 66],
        del: function (s, t, ch, pos, bar, B, S) {
          if (pos === 0 || pos === 6) M('triangle', ch.root - 12 + (pos ? 7 : 0), t, S * 4, { gain: 0.14, attack: 0.01, release: S * 4, filter: 800 });
          if (pos === 2 || pos === 4 || pos === 8 || pos === 10) ch.notes.forEach(function (m) { M('sawtooth', m, t, S * 1.6, { gain: 0.012, attack: 0.02, release: S * 1.6, filter: 1300, detune: 6 }); });
          if (B || bar % 2 === 1) { var mm = this.MEL[pos]; if (mm > 0) M('sawtooth', mm + 12, t, S * 1.8, { gain: 0.016, attack: 0.03, release: S * 1.8, filter: 1800, detune: -5, send: true }); }
          if (pos === 0 && bar % 2 === 0) noise(musicBus, t, S * 22, { type: 'lowpass', freq: 500, gain: 0.05, attack: S * 8, sweepTo: 1200 });
          if (pos === 0) tone(musicBus, 80, t, 0.3, { type: 'sine', gain: 0.18, slideTo: 45 });
          if (pos === 6) noise(musicBus, t, 0.12, { type: 'bandpass', freq: 2000, gain: 0.03 });
        } },
      // Rummet: dyb flade, hurtig ekko-arpeggio og en blød puls (til Rumhandleren)
      rummet: { bpm: 80, takt: 16,
        A: [C(40, [52, 59, 64, 66]), C(36, [48, 55, 60, 64]), C(43, [55, 62, 67, 69]), C(38, [50, 57, 62, 64])],
        B: [C(45, [57, 64, 67, 71]), C(41, [53, 60, 64, 67]), C(36, [55, 60, 64, 67]), C(43, [55, 59, 62, 66])],
        del: function (s, t, ch, pos, bar, B, S) {
          if (pos === 0) { pad(ch, t, S * 16, 0.018, 700, 'triangle'); M('sine', ch.root - 12, t, S * 16, { gain: 0.1, attack: 1.5, release: S * 16 }); }
          var nn = ch.notes[(pos * (B ? 3 : 1)) % ch.notes.length] + 12 + (pos % 8 >= 4 ? 12 : 0);
          M('sine', nn, t, S * 0.9, { gain: 0.022, release: S * 0.9, send: true });
          if (pos === 0 || pos === 8) tone(musicBus, 90, t, 0.4, { type: 'sine', gain: 0.18, slideTo: 40 });
          if (B && pos % 4 === 2) hihat(t, 0.012);
        } }
    };

    function scheduleStep(s, t) {
      var T = TRACKS[nummer] || TRACKS.neon, S = 60 / T.bpm / 4;
      var bar = Math.floor(s / T.takt), pos = s % T.takt;
      var B = Math.floor(bar / 8) % 2 === 1;          // 8 takter A, 8 takter B
      var prog = B ? T.B : T.A, ch = prog[bar % prog.length];
      T.del(s, t, ch, pos, bar, B, S);
    }
    function stepLen(s) {
      var T = TRACKS[nummer] || TRACKS.neon, S = 60 / T.bpm / 4;
      if (!T.swing) return S;
      return s % 2 === 0 ? S * (1 + T.swing) : S * (1 - T.swing);
    }
    function scheduler() {
      while (nextTime < ctx.currentTime + 0.15) {
        scheduleStep(step, nextTime);
        nextTime += stepLen(step);
        step++;
      }
    }
    function musikNiveau() { return MUSIK_NIVEAU * musikStyrke; }
    function startMusic() {
      if (!ctx || timer || !unlocked) return;
      nextTime = ctx.currentTime + 0.1;
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
      musicBus.gain.linearRampToValueAtTime(musikNiveau(), ctx.currentTime + 2);
      timer = setInterval(scheduler, 30);
      scheduler();
    }
    function stopMusic() {
      if (!ctx || !timer) return;
      clearInterval(timer); timer = null;
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
      musicBus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    }

    return {
      unlock: function () {
        if (!ensure()) return;
        if (ctx.state === 'suspended') { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); }
        unlocked = true;
        if (musicOn) startMusic();
      },
      isUnlocked: function () { return unlocked; },
      play: function (name) {
        if (!sfxOn || !unlocked || !ctx || !SFX[name]) return;
        SFX[name](ctx.currentTime + 0.01);
      },
      setSfx: function (v2) { sfxOn = !!v2; },
      setMusic: function (v2) {
        musicOn = !!v2;
        if (musicOn) startMusic(); else stopMusic();
      },
      isMusicPlaying: function () { return !!timer; },
      // Lydstyrke: 'lav' | 'mellem' | 'hoej' (eller et tal)
      setVolume: function (o) {
        o = o || {};
        if (o.musik !== undefined) musikStyrke = typeof o.musik === 'number' ? o.musik : (STYRKE[o.musik] || 1);
        if (o.lyd !== undefined) lydStyrke = typeof o.lyd === 'number' ? o.lyd : (STYRKE[o.lyd] || 1);
        if (!ctx) return;
        sfxBus.gain.setValueAtTime(LYD_NIVEAU * lydStyrke, ctx.currentTime);
        if (timer) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setValueAtTime(musikNiveau(), ctx.currentTime); }
      },
      setPakke: function (p) { pakke = pakkeFor(p, prefs()); },
      // Skift nummer (til test, og hvis et spil vil skifte undervejs)
      setNummer: function (nm) { if (TRACKS[nm]) { nummer = nm; step = 0; } },
      get pakke() { return pakke; },
      get nummer() { return nummer; },
      lyde: function () { return Object.keys(SFX); },
      // Til test med OfflineAudioContext: planlæg `sek` sekunders musik (uden timer) eller én lyd
      _planlaegMusik: function (sek) {
        ensure(); musicBus.gain.value = musikNiveau(); nextTime = 0.05; step = 0;
        while (nextTime < sek) { scheduleStep(step, nextTime); nextTime += stepLen(step); step++; }
      },
      _planlaegLyd: function (name, t) { ensure(); SFX[name](t || 0.01); }
    };
  }

  // Lydeffekternes styrke (0,5 / 1 / 1,45) til spil med egne lyde (js/lyd.js)
  function lydStyrke() { return STYRKE[prefs().lydStyrke] || 1; }
  global.ArkadeAudio = { create: create, NUMRE: NUMRE, SPIL_NUMRE: SPIL_NUMRE, PAKKER: PAKKER, spilNavn: spilNavn, lydStyrke: lydStyrke };
})(window);

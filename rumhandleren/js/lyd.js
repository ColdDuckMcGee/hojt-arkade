/*
 * Rumhandleren – lyd.js
 * Spillets egne lyde, lavet direkte med Web Audio (ingen lydfiler, intet CDN).
 * Bløde, korte synth-lyde: køb og salg (mønter), afgang og ankomst, pirater,
 * kontrakt, regning, toldkontrol, nyhed, fejl og konkurs.
 *
 * Arkadens fælles lydindstilling styrer, om der er lyd (setSfx), og den fælles
 * lydstyrke (0–1) bruges, hvis arkaden har en (setVolume).
 *
 *   var lyd = RumhandlerenLyd.create({ sfx: true, volume: 1 });
 *   lyd.unlock();          // ved første klik/tast
 *   lyd.play('koeb');      // se lyd.names
 */
(function (global) {
  'use strict';
  var NOTE = function (midi) { return 440 * Math.pow(2, (midi - 69) / 12); };

  function create(opts) {
    opts = opts || {};
    var sfxOn = opts.sfx !== false;
    var volume = typeof opts.volume === 'number' ? opts.volume : 1;
    var ctx = null, out = null, unlocked = false, stoej = null, sidst = {};

    function ensure() {
      if (ctx) return ctx;
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      out = ctx.createGain(); out.gain.value = 0.5 * volume;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
      var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -22; comp.ratio.value = 6;
      out.connect(lp); lp.connect(comp); comp.connect(ctx.destination);
      stoej = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = stoej.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return ctx;
    }
    function tone(freq, t, dur, o) {
      o = o || {};
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
      var peak = o.gain || 0.1, a = o.attack || 0.012;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      var node = osc;
      if (o.filter) { var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.filter; osc.connect(f); node = f; }
      node.connect(g); g.connect(out);
      osc.start(t); osc.stop(t + dur + 0.05);
    }
    function sus(t, dur, o) {
      o = o || {};
      var src = ctx.createBufferSource(); src.buffer = stoej; src.loop = true;
      var f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass';
      f.frequency.setValueAtTime(o.freq || 800, t);
      if (o.slideTo) f.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
      if (o.q) f.Q.value = o.q;
      var g = ctx.createGain(), peak = o.gain || 0.1, a = o.attack || 0.01;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(out);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    }

    var SOUNDS = {
      // Køb: to stigende mønt-klink
      koeb: function (t) { tone(NOTE(84), t, 0.1, { type: 'triangle', gain: 0.07 }); tone(NOTE(88), t + 0.06, 0.16, { type: 'triangle', gain: 0.07 }); },
      // Salg: kasseapparat – tre klink og en klokke
      saelg: function (t) { [91, 88, 96].forEach(function (m, i) { tone(NOTE(m), t + i * 0.06, 0.16, { type: 'triangle', gain: 0.06 }); }); tone(NOTE(103), t + 0.2, 0.4, { type: 'sine', gain: 0.03 }); },
      // Afgang: motor der stiger
      afgang: function (t) { tone(NOTE(40), t, 0.9, { type: 'sawtooth', gain: 0.05, slideTo: NOTE(52), filter: 700, attack: 0.15 }); sus(t, 0.9, { freq: 300, slideTo: 1400, gain: 0.06, attack: 0.3 }); },
      // Ankomst: blød dobbelt-ding
      ankomst: function (t) { tone(NOTE(76), t, 0.5, { type: 'sine', gain: 0.08 }); tone(NOTE(83), t + 0.18, 0.7, { type: 'sine', gain: 0.07 }); },
      // Pirater på radaren
      pirat: function (t) { [0, 0.22].forEach(function (d) { tone(NOTE(64), t + d, 0.18, { type: 'square', gain: 0.04, filter: 1600 }); tone(NOTE(63), t + d + 0.09, 0.18, { type: 'square', gain: 0.04, filter: 1600 }); }); },
      // Undslap / betalte: kort lettelse
      slap: function (t) { tone(NOTE(67), t, 0.16, { type: 'triangle', gain: 0.08 }); tone(NOTE(74), t + 0.1, 0.26, { type: 'triangle', gain: 0.08 }); },
      // Tab: noget blev taget
      tab: function (t) { tone(NOTE(57), t, 0.3, { type: 'triangle', gain: 0.1, slideTo: NOTE(50), filter: 1000 }); },
      // Kontrakt leveret / omdømme
      kontrakt: function (t) { [72, 76, 79, 84].forEach(function (m, i) { tone(NOTE(m), t + i * 0.09, 0.3, { type: 'triangle', gain: 0.08 }); }); },
      // Månedens regning betalt
      regning: function (t) { tone(NOTE(60), t, 0.18, { type: 'triangle', gain: 0.08 }); tone(NOTE(55), t + 0.12, 0.3, { type: 'triangle', gain: 0.07 }); },
      // Toldkontrol
      told: function (t) { sus(t, 0.25, { type: 'bandpass', freq: 1800, q: 3, gain: 0.06 }); tone(NOTE(70), t, 0.4, { type: 'square', gain: 0.03, filter: 1400 }); },
      // Nyhed på nyhedslinjen
      nyhed: function (t) { tone(NOTE(86), t, 0.12, { type: 'sine', gain: 0.05 }); tone(NOTE(81), t + 0.08, 0.2, { type: 'sine', gain: 0.04 }); },
      // Bygget, købt skib, rute sat
      ok: function (t) { tone(NOTE(67), t, 0.14, { type: 'triangle', gain: 0.1 }); tone(NOTE(74), t + 0.08, 0.2, { type: 'triangle', gain: 0.09 }); },
      // Noget kunne ikke lade sig gøre
      nej: function (t) { tone(NOTE(52), t, 0.22, { type: 'triangle', gain: 0.1, filter: 900 }); },
      // Konkurs
      konkurs: function (t) { [69, 65, 62, 57].forEach(function (m, i) { tone(NOTE(m), t + i * 0.22, 0.5, { type: 'triangle', gain: 0.11, filter: 1400 }); }); },
      // Pension: sejr
      pension: function (t) { [72, 76, 79, 84, 88].forEach(function (m, i) { tone(NOTE(m), t + i * 0.1, 0.4, { type: 'triangle', gain: 0.09 }); }); }
    };
    function ready() { return sfxOn && unlocked && ctx && volume > 0; }

    return {
      unlock: function () {
        if (!ensure()) return;
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
        unlocked = true;
      },
      play: function (name, delay) {
        if (!ready() || !SOUNDS[name]) return false;
        var t = ctx.currentTime + 0.01 + (delay || 0);
        if (sidst[name] && t - sidst[name] < 0.08) return false;
        sidst[name] = t;
        SOUNDS[name](t);
        return true;
      },
      setSfx: function (v) { sfxOn = !!v; },
      setVolume: function (v) {
        volume = Math.max(0, Math.min(1, +v || 0));
        if (out) out.gain.setTargetAtTime(0.5 * volume, ctx.currentTime, 0.05);
      },
      isOn: function () { return sfxOn && volume > 0; },
      names: Object.keys(SOUNDS)
    };
  }
  global.RumhandlerenLyd = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);

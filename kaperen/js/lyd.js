/*
 * Kaperen – lyd.js
 * Spillets egne lyde, lavet direkte med Web Audio (ingen lydfiler, intet CDN).
 * Bløde, korte lyde: kanon, træf, plask, bølger/sejl, mønter, bordning, storm,
 * havn (skibsklokke), køb/salg og game over.
 *
 * Arkadens fælles lydindstilling styrer, om der er lyd (setSfx), og den fælles
 * lydstyrke (0–1) bruges, hvis arkaden har en (setVolume).
 *
 *   var lyd = KaperenLyd.create({ sfx: true, volume: 1 });
 *   lyd.unlock();          // ved første klik/tast
 *   lyd.play('kanon');     // se lyd.names
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
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600;
      var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -22; comp.ratio.value = 6;
      out.connect(lp); lp.connect(comp); comp.connect(ctx.destination);
      // Hvid støj (1 sek.) til kanon, plask, bølger og storm
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
    // Filtreret støj: o.type (lowpass/bandpass), o.freq, o.slideTo, o.gain, o.attack
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
      // Kanon: dybt brag med rumlen
      kanon: function (t) { sus(t, 0.5, { freq: 900, slideTo: 120, gain: 0.32, attack: 0.005 }); tone(NOTE(36), t, 0.35, { type: 'triangle', gain: 0.16, slideTo: NOTE(28), filter: 400 }); },
      // Træf: knasende træ
      traef: function (t) { sus(t, 0.18, { type: 'bandpass', freq: 1400, q: 1.2, gain: 0.22, attack: 0.003 }); tone(NOTE(45), t + 0.02, 0.2, { type: 'square', gain: 0.05, filter: 500 }); },
      // Plask: kugle i vandet
      plask: function (t) { sus(t, 0.4, { type: 'bandpass', freq: 2400, slideTo: 500, q: 0.9, gain: 0.14, attack: 0.02 }); },
      // Bølger og sejl: blødt sus, der vokser og falder
      boelger: function (t) { sus(t, 1.6, { freq: 500, slideTo: 260, gain: 0.07, attack: 0.6 }); sus(t + 0.5, 1.4, { freq: 700, slideTo: 300, gain: 0.05, attack: 0.5 }); },
      // Mønter: to klare klink
      moenter: function (t) { tone(NOTE(88), t, 0.12, { type: 'triangle', gain: 0.07 }); tone(NOTE(91), t + 0.07, 0.18, { type: 'triangle', gain: 0.07 }); tone(NOTE(96), t + 0.13, 0.2, { type: 'sine', gain: 0.04 }); },
      // Salg: mønter i den anden retning
      saelg: function (t) { tone(NOTE(91), t, 0.12, { type: 'triangle', gain: 0.07 }); tone(NOTE(86), t + 0.08, 0.2, { type: 'triangle', gain: 0.06 }); },
      // Bordning: klirrende klinger og råb
      bordning: function (t) { [0, 0.12, 0.27].forEach(function (d, i) { tone(NOTE(84 + i * 3), t + d, 0.16, { type: 'square', gain: 0.03, filter: 2600 }); sus(t + d, 0.08, { type: 'bandpass', freq: 3000, q: 3, gain: 0.08 }); }); tone(NOTE(55), t, 0.5, { type: 'sawtooth', gain: 0.03, filter: 700 }); },
      // Storm: dyb rumlen og vind
      storm: function (t) { sus(t, 2.2, { freq: 300, slideTo: 120, gain: 0.16, attack: 0.4 }); sus(t + 0.2, 1.8, { type: 'bandpass', freq: 900, slideTo: 1500, q: 2, gain: 0.05, attack: 0.6 }); },
      // Ankomst i havn: skibsklokke
      havn: function (t) { tone(NOTE(81), t, 0.7, { type: 'sine', gain: 0.08 }); tone(NOTE(81), t + 0.35, 0.8, { type: 'sine', gain: 0.07 }); },
      // Værft og værtshus: kort bekræftelse
      ok: function (t) { tone(NOTE(67), t, 0.14, { type: 'triangle', gain: 0.1 }); tone(NOTE(74), t + 0.08, 0.2, { type: 'triangle', gain: 0.09 }); },
      // Noget kunne ikke lade sig gøre
      nej: function (t) { tone(NOTE(52), t, 0.22, { type: 'triangle', gain: 0.1, filter: 900 }); },
      // Et møde dukker op
      sejlISigte: function (t) { [69, 74, 69].forEach(function (m, i) { tone(NOTE(m), t + i * 0.16, 0.24, { type: 'triangle', gain: 0.08 }); }); },
      // Sejr
      sejr: function (t) { [72, 76, 79, 84].forEach(function (m, i) { tone(NOTE(m), t + i * 0.11, 0.35, { type: 'triangle', gain: 0.1 }); }); },
      gameOver: function (t) { [69, 65, 62, 57].forEach(function (m, i) { tone(NOTE(m), t + i * 0.22, 0.5, { type: 'triangle', gain: 0.11, filter: 1400 }); }); }
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
        if (sidst[name] && t - sidst[name] < 0.08) return false;   // samme lyd højst ca. 12 gange i sekundet
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
  global.KaperenLyd = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);

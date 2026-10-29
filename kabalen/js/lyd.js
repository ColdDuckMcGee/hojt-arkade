/*
 * Kabalen – lyd.js
 * Spillets egne lyde, lavet direkte med Web Audio (ingen lydfiler, intet CDN):
 * bløde, korte og uden skarpe toppe (samme stil som Muren og Rampen).
 *
 * Den fælles lydindstilling fra arkade/settings.js styrer, om der er lyd (setSfx).
 * Mange lyde lige efter hinanden dæmpes (mindste afstand pr. lyd), så Saml og
 * den automatiske afslutning ikke larmer. Et tema kan give lydene andre klange ved at sætte
 * KabaleTema.lyde = { <navn>: function (t, n, v) { … } } (v = værktøjer: tone, stoej, NOTE).
 *
 *   var lyd = KabaleLyd.create({ sfx: true, lyde: KabaleTema.lyde });
 *   lyd.unlock();          // ved første klik/tast
 *   lyd.play('grund', 5);  // vaelg, fravaelg, laeg, grund, vend, traek, blandom, fortryd, nej, hint, sejr, rekord, slut, klik, pause
 */
(function (global) {
  'use strict';

  var NOTE = function (midi) { return 440 * Math.pow(2, (midi - 69) / 12); };

  function create(opts) {
    opts = opts || {};
    var sfxOn = opts.sfx !== false;
    var volume = typeof opts.volume === 'number' ? opts.volume : 1;
    var ctx = null, out = null, unlocked = false, noiseBuf = null;
    var last = {};
    // Mindste afstand (sek.) mellem to ens lyde, så mange mønter eller hop ikke larmer
    var GAP = { grund: 0.05, laeg: 0.04, vend: 0.05, klik: 0.03 };

    function ensure() {
      if (ctx) return ctx;
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      // Blød kæde: lydstyrke → lavpas → kompressor
      out = ctx.createGain(); out.gain.value = 0.5 * volume;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -24; comp.ratio.value = 6;
      out.connect(lp); lp.connect(comp); comp.connect(ctx.destination);
      return ctx;
    }

    // En tone med blød attack og udklingning
    function tone(freq, t, dur, o) {
      o = o || {};
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + (o.slideTime || dur));
      var peak = o.gain || 0.1, a = o.attack || 0.012;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      if (o.hold) g.gain.setValueAtTime(peak, t + a + o.hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      var node = osc;
      if (o.filter) {
        var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.filter;
        osc.connect(f); node = f;
      }
      node.connect(g); g.connect(out);
      osc.start(t); osc.stop(t + dur + 0.05);
    }
    // Blød støj gennem et båndpas (sus, flamme, bump)
    function stoej(t, dur, o) {
      o = o || {};
      if (!noiseBuf) {
        noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1), ctx.sampleRate);
        var d = noiseBuf.getChannelData(0), seed = 7;
        for (var i = 0; i < d.length; i++) { seed = (seed * 16807) % 2147483647; d[i] = seed / 1073741823.5 - 1; }
      }
      var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      var f = ctx.createBiquadFilter(); f.type = o.kind || 'bandpass'; f.Q.value = o.q || 1;
      f.frequency.setValueAtTime(o.freq || 800, t);
      if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, t + dur);
      var g = ctx.createGain(), peak = o.gain || 0.08, a = o.attack || 0.02;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(out);
      src.start(t); src.stop(t + dur + 0.05);
    }
    var V = { tone: function () { tone.apply(null, arguments); }, stoej: function () { stoej.apply(null, arguments); }, NOTE: NOTE };

    var SOUNDS = {
      // Et kort vælges: en lille, rund tik
      vaelg: function (t) { tone(NOTE(76), t, 0.08, { type: 'sine', gain: 0.045 }); },
      // Valget fortrydes: samme tik, lidt lavere
      fravaelg: function (t) { tone(NOTE(69), t, 0.08, { type: 'sine', gain: 0.035 }); },
      // Kort lagt i en bunke: blødt "klap" (papir) og en lav tone
      laeg: function (t) {
        stoej(t, 0.07, { freq: 1800, q: 0.6, gain: 0.035, attack: 0.003 });
        tone(NOTE(60), t, 0.12, { type: 'triangle', gain: 0.05, filter: 1500 });
      },
      // Kort på grundbunken: to lyse toner opad. n = værdi (1–13) giver lidt højere tone
      grund: function (t, n) {
        var up = Math.min(12, Math.max(0, (n || 1) - 1));
        tone(NOTE(72 + up), t, 0.14, { type: 'sine', gain: 0.055 });
        tone(NOTE(79 + up), t + 0.06, 0.18, { type: 'sine', gain: 0.045 });
      },
      // Et kort vendes i en bunke
      vend: function (t) { stoej(t, 0.09, { freq: 2600, q: 0.8, gain: 0.03, attack: 0.004 }); tone(NOTE(84), t + 0.02, 0.1, { type: 'sine', gain: 0.03 }); },
      // Træk fra bunken
      traek: function (t) { stoej(t, 0.08, { freq: 1300, q: 0.7, gain: 0.04, attack: 0.003 }); },
      // Bunken vendes om
      blandom: function (t) { stoej(t, 0.25, { freq: 900, freqTo: 1800, q: 0.6, gain: 0.04, attack: 0.02 }); },
      // Fortryd: blød tone nedad
      fortryd: function (t) { tone(NOTE(67), t, 0.18, { type: 'triangle', gain: 0.05, slideTo: NOTE(60), slideTime: 0.15 }); },
      // Ikke muligt: dyb, blød "bump" (ingen skarp lyd)
      nej: function (t) { tone(NOTE(45), t, 0.18, { type: 'sine', gain: 0.07, filter: 600 }); },
      // Hint: to bløde toner
      hint: function (t) { tone(NOTE(74), t, 0.14, { type: 'sine', gain: 0.045 }); tone(NOTE(81), t + 0.09, 0.16, { type: 'sine', gain: 0.04 }); },
      // Spillet er vundet: rolig, stigende akkord
      sejr: function (t) { [60, 64, 67, 72, 76].forEach(function (m, i) { tone(NOTE(m), t + i * 0.11, 0.6, { type: 'triangle', gain: 0.06, filter: 2400 }); }); },
      // Rekord
      rekord: function (t) { [72, 76, 79, 84].forEach(function (m, i) { tone(NOTE(m), t + i * 0.09, 0.4, { type: 'sine', gain: 0.06 }); }); },
      // Serien er slut / ingen flere træk: tre rolige toner nedad
      slut: function (t) { [67, 63, 58].forEach(function (m, i) { tone(NOTE(m), t + i * 0.2, 0.45, { type: 'triangle', gain: 0.07, filter: 1400 }); }); },
      // Knapper i menuerne
      klik: function (t) { tone(NOTE(79), t, 0.05, { type: 'sine', gain: 0.03 }); },
      pause: function (t) { tone(NOTE(64), t, 0.16, { type: 'triangle', gain: 0.045 }); }
    };
    // Et tema kan erstatte enkelte lyde
    var egne = opts.lyde || {};
    Object.keys(egne).forEach(function (k) { if (typeof egne[k] === 'function') SOUNDS[k] = (function (fn) { return function (t, n) { fn(t, n, V); }; })(egne[k]); });

    function ready() { return sfxOn && unlocked && ctx && volume > 0; }

    return {
      unlock: function () {
        if (!ensure()) return;
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
        unlocked = true;
      },
      play: function (name, n) {
        if (!ready() || !SOUNDS[name]) return false;
        var t = ctx.currentTime + 0.01;
        if (GAP[name] && last[name] && t - last[name] < GAP[name]) return false;
        last[name] = t;
        SOUNDS[name](t, n);
        return true;
      },
      has: function (name) { return !!SOUNDS[name]; },
      setSfx: function (v) { sfxOn = !!v; },
      setVolume: function (v) {
        volume = Math.max(0, Math.min(1, +v || 0));
        if (out) out.gain.setTargetAtTime(0.5 * volume, ctx.currentTime, 0.05);
      },
      isOn: function () { return sfxOn && volume > 0; },
      names: Object.keys(SOUNDS)
    };
  }

  global.KabaleLyd = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);

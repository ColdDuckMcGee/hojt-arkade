/*
 * Kælderen – lyd.js
 * Spillets egne lyde, lavet direkte med Web Audio (ingen lydfiler, intet CDN):
 * bløde, korte og uden skarpe toppe, i samme stil som arkadens andre spil.
 *
 * Arkadens fælles indstillinger styrer, om der er lyd (setSfx), og
 * lydstyrken (setVolume). Mange ens lyde lige efter hinanden dæmpes. Et tema kan
 * give lydene andre klange: KaelderTema.lyde = { <navn>: function (t, n, v) { … } }.
 *
 *   var lyd = KaelderLyd.create({ sfx: true, volume: 1, lyde: KaelderTema.lyde });
 *   lyd.unlock();         // ved første klik/tast
 *   lyd.play('skud');     // skridt, drej, bump, doer, laas, skud, slag, traf, miss, drab,
 *                         // fjende, fjendeSkud, skade, ting, skat, noegle, opgradering, trappe, slut
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
    var GAP = { skridt: 0.08, drej: 0.1, bump: 0.15, fjende: 0.4, fjendeSkud: 0.12, ting: 0.1, skade: 0.15 };

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
      // Et skridt: dæmpet sko mod beton
      skridt: function (t) { stoej(t, 0.09, { freq: 260, q: 1.2, gain: 0.05, attack: 0.004 }); tone(NOTE(40), t, 0.08, { gain: 0.04, filter: 300 }); },
      // Drej: et let sus
      drej: function (t) { stoej(t, 0.16, { freq: 700, freqTo: 1100, q: 0.6, gain: 0.018, attack: 0.03 }); },
      // Gå ind i en væg: blødt, dybt bump
      bump: function (t) { tone(NOTE(36), t, 0.14, { type: 'sine', gain: 0.07, filter: 260 }); },
      // Døren glider op: hydraulisk sus og en lille tone
      doer: function (t) {
        stoej(t, 0.45, { freq: 400, freqTo: 1300, q: 0.8, gain: 0.04, attack: 0.05 });
        tone(NOTE(55), t + 0.05, 0.3, { type: 'triangle', gain: 0.04, slideTo: NOTE(62) });
      },
      // Låst dør åbnes med nøglekortet: to lyse bip og døren
      laas: function (t) { tone(NOTE(84), t, 0.08, { gain: 0.05 }); tone(NOTE(91), t + 0.09, 0.12, { gain: 0.05 }); SOUNDS.doer(t + 0.15); },
      // Skud: kort laserknald (blødt, ingen skarp top)
      skud: function (t) {
        stoej(t, 0.12, { freq: 1500, freqTo: 400, q: 0.7, gain: 0.06, attack: 0.003 });
        tone(NOTE(76), t, 0.18, { type: 'square', gain: 0.03, slideTo: NOTE(52), filter: 1800 });
      },
      // Slag (nærkamp)
      slag: function (t) { stoej(t, 0.1, { freq: 500, q: 1, gain: 0.07, attack: 0.003 }); tone(NOTE(45), t, 0.1, { gain: 0.05 }); },
      traf: function (t) { tone(NOTE(70), t + 0.04, 0.1, { type: 'triangle', gain: 0.05 }); },
      miss: function (t) { stoej(t + 0.03, 0.2, { freq: 2200, freqTo: 900, q: 2, gain: 0.02 }); },
      // En fjende er nedkæmpet: tre toner nedad
      drab: function (t) { [67, 62, 55].forEach(function (m, i) { tone(NOTE(m), t + 0.05 + i * 0.07, 0.16, { type: 'triangle', gain: 0.05, filter: 1500 }); }); },
      // En fjende får øje på dig: lav, rolig to-tone
      fjende: function (t) { tone(NOTE(46), t, 0.3, { type: 'sawtooth', gain: 0.03, filter: 600 }); tone(NOTE(49), t + 0.16, 0.3, { type: 'sawtooth', gain: 0.03, filter: 600 }); },
      // Fjenden skyder eller slår
      fjendeSkud: function (t) { stoej(t, 0.14, { freq: 900, freqTo: 300, q: 0.8, gain: 0.04, attack: 0.004 }); tone(NOTE(50), t, 0.16, { type: 'square', gain: 0.02, filter: 900 }); },
      // Du bliver ramt: dybt, dæmpet dunk
      skade: function (t) { tone(NOTE(38), t, 0.3, { type: 'sine', gain: 0.1, slideTo: NOTE(31), filter: 400 }); stoej(t, 0.2, { freq: 180, q: 0.8, gain: 0.04 }); },
      // Saml noget op
      ting: function (t) { [72, 79].forEach(function (m, i) { tone(NOTE(m), t + i * 0.06, 0.12, { gain: 0.05 }); }); },
      skat: function (t) { [84, 88, 91].forEach(function (m, i) { tone(NOTE(m), t + i * 0.05, 0.12, { type: 'triangle', gain: 0.04 }); }); },
      noegle: function (t) { [72, 76, 79, 84].forEach(function (m, i) { tone(NOTE(m), t + i * 0.08, 0.2, { gain: 0.05 }); }); },
      // Køb i butikken
      opgradering: function (t) { [60, 64, 67, 72, 76].forEach(function (m, i) { tone(NOTE(m), t + i * 0.06, 0.22, { type: 'triangle', gain: 0.05 }); }); },
      // Ned ad trappen: toner, der går nedad
      trappe: function (t) { [72, 67, 64, 60, 55].forEach(function (m, i) { tone(NOTE(m), t + i * 0.09, 0.2, { gain: 0.05 }); stoej(t + i * 0.09, 0.06, { freq: 300, gain: 0.03 }); }); },
      // Spillet er slut
      slut: function (t) { [62, 58, 55, 50].forEach(function (m, i) { tone(NOTE(m), t + i * 0.24, 0.5, { type: 'triangle', gain: 0.07, filter: 1200 }); }); }
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

  global.KaelderLyd = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);

/*
 * Muren – lyd.js
 * Spillets egne lyde, lavet direkte med Web Audio (ingen lydfiler, intet CDN):
 * bløde, korte og uden skarpe toppe (samme stil som Rampen og Tårnene).
 *
 * Den fælles lydindstilling fra arkade/settings.js styrer, om der er lyd
 * (setSfx), og en fælles lydstyrke (0–1) bruges, hvis arkaden har en (setVolume).
 * Mange træf lige efter hinanden dæmpes (mindste afstand pr. lyd), så en stor
 * salve ikke larmer. Et tema kan give lydene andre klange ved at sætte
 * MurenTema.lyde = { <navn>: function (t, n, v) { … } } (v = værktøjer: tone, stoej, NOTE).
 *
 *   var lyd = MurenLyd.create({ sfx: true, volume: 1, lyde: MurenTema.lyde });
 *   lyd.unlock();          // ved første klik/tast
 *   lyd.play('traef', 3);  // skud, traef, knust, ring, raekke, slut
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
    var GAP = { traef: 0.06, knust: 0.08, ring: 0.12, skud: 0.2 };

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
      // Skud: et blødt "pop" og en lille stigende tone, når salven sendes af sted
      skud: function (t) {
        stoej(t, 0.12, { freq: 900, q: 0.8, gain: 0.05, attack: 0.004 });
        tone(NOTE(60), t, 0.22, { type: 'triangle', gain: 0.08, slideTo: NOTE(67), slideTime: 0.15 });
      },
      // Træf på en sten: kort, rund tik. n = hvor mange (giver lidt højere tone)
      traef: function (t, n) {
        var up = Math.min(7, Math.max(0, (n || 1) - 1));
        tone(NOTE(72 + up), t, 0.07, { type: 'sine', gain: 0.035 });
      },
      // Sten knust: to bløde toner nedad og lidt sus
      knust: function (t) {
        tone(NOTE(79), t, 0.12, { type: 'triangle', gain: 0.06 });
        tone(NOTE(72), t + 0.05, 0.2, { type: 'triangle', gain: 0.05 });
        stoej(t, 0.18, { freq: 1600, q: 0.7, gain: 0.025, attack: 0.005 });
      },
      // +1 kugle: tre lyse, stigende toner
      ring: function (t) { [76, 81, 88].forEach(function (m, i) { tone(NOTE(m), t + i * 0.06, 0.16, { type: 'sine', gain: 0.06 }); }); },
      // Muren rykker ned: dybt, blødt bump
      raekke: function (t) {
        tone(NOTE(43), t, 0.3, { type: 'sine', gain: 0.09, slideTo: NOTE(36), filter: 500 });
        stoej(t, 0.14, { freq: 220, q: 0.9, gain: 0.03, attack: 0.006 });
      },
      // Spillet er slut: tre rolige toner nedad
      slut: function (t) { [67, 63, 58].forEach(function (m, i) { tone(NOTE(m), t + i * 0.2, 0.45, { type: 'triangle', gain: 0.08, filter: 1400 }); }); }
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

  global.MurenLyd = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);

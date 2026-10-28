/*
 * Tårnene – lyd.js
 * Spillets egne lyde, lavet direkte med Web Audio (ingen lydfiler, intet CDN).
 * Lydene er bløde og korte. Skud samles: højst én lyd pr. tårntype pr. trin,
 * og samme type tidligst igen efter en kort pause, så mange tårne ikke larmer.
 *
 * Den fælles lydindstilling fra arkade/settings.js styrer, om der er lyd
 * (setSfx), og en fælles lydstyrke (0–1) bruges, hvis arkaden har en (setVolume).
 *
 *   var lyd = TaarneneLyd.create({ sfx: true, volume: 1 });
 *   lyd.unlock();                   // ved første klik/tast
 *   lyd.play('byg');                // byg, saelg, opgrader, nedkaempet, slapIgennem, boelgeKlaret, gameOver
 *   lyd.skud(['laser', 'kanon']);   // tårntyper, der skød i dette trin
 */
(function (global) {
  'use strict';

  var NOTE = function (midi) { return 440 * Math.pow(2, (midi - 69) / 12); };

  function create(opts) {
    opts = opts || {};
    var sfxOn = opts.sfx !== false;
    var volume = typeof opts.volume === 'number' ? opts.volume : 1;
    var ctx = null, out = null, unlocked = false;
    var lastShot = {}, lastKill = 0;
    var SHOT_GAP = 0.22;          // sek. mellem to skudlyde af samme type
    var KILL_GAP = 0.15;

    function ensure() {
      if (ctx) return ctx;
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      // Blød kæde: lydstyrke → lavpas (ingen skarpe toppe) → kompressor
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
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
      var peak = o.gain || 0.1, a = o.attack || 0.012;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      var node = osc;
      if (o.filter) {
        var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.filter;
        osc.connect(f); node = f;
      }
      node.connect(g); g.connect(out);
      osc.start(t); osc.stop(t + dur + 0.05);
    }

    var SOUNDS = {
      // Byg: to stigende, runde toner
      byg: function (t) { tone(NOTE(67), t, 0.16, { type: 'triangle', gain: 0.12 }); tone(NOTE(74), t + 0.09, 0.22, { type: 'triangle', gain: 0.11 }); },
      // Opgradér: tre stigende toner
      opgrader: function (t) { [67, 71, 76].forEach(function (m, i) { tone(NOTE(m), t + i * 0.08, 0.2, { type: 'triangle', gain: 0.11 }); }); },
      // Sælg: to faldende toner (som mønter, der lægges tilbage)
      saelg: function (t) { tone(NOTE(76), t, 0.14, { type: 'sine', gain: 0.1 }); tone(NOTE(69), t + 0.1, 0.2, { type: 'sine', gain: 0.09 }); },
      // Fjende nedkæmpet: kort, lys "plop"
      nedkaempet: function (t, n) { var up = Math.min(4, (n || 1) - 1); tone(NOTE(79 + up), t, 0.12, { type: 'sine', gain: 0.07, slideTo: NOTE(86 + up) }); },
      // En fjende slap igennem: dyb, blød tone
      slapIgennem: function (t) { tone(NOTE(50), t, 0.4, { type: 'triangle', gain: 0.13, slideTo: NOTE(45), filter: 700 }); },
      // Bølge klaret: lille rolig fanfare
      boelgeKlaret: function (t) { [72, 76, 79, 84].forEach(function (m, i) { tone(NOTE(m), t + i * 0.11, 0.35, { type: 'triangle', gain: 0.1 }); }); },
      // Game over: langsomt faldende
      gameOver: function (t) { [69, 65, 62, 57].forEach(function (m, i) { tone(NOTE(m), t + i * 0.22, 0.5, { type: 'triangle', gain: 0.11, filter: 1400 }); }); },
      // Bølgen starter / genoptages
      boelgeStart: function (t) { tone(NOTE(60), t, 0.18, { type: 'triangle', gain: 0.09 }); tone(NOTE(67), t + 0.1, 0.25, { type: 'triangle', gain: 0.09 }); },
      // Bølgen holder pause
      boelgePause: function (t) { tone(NOTE(67), t, 0.18, { type: 'triangle', gain: 0.09 }); tone(NOTE(60), t + 0.1, 0.25, { type: 'triangle', gain: 0.09 }); }
    };
    // Skud pr. tårntype: korte og diskrete, hver med sin egen klang
    var SHOTS = {
      laser: function (t) { tone(NOTE(88), t, 0.07, { type: 'sine', gain: 0.035, slideTo: NOTE(81) }); },
      puls: function (t) { tone(NOTE(57), t, 0.16, { type: 'sine', gain: 0.05, slideTo: NOTE(64) }); },
      frost: function (t) { tone(NOTE(93), t, 0.12, { type: 'sine', gain: 0.025 }); tone(NOTE(100), t + 0.04, 0.1, { type: 'sine', gain: 0.018 }); },
      kanon: function (t) { tone(NOTE(43), t, 0.18, { type: 'triangle', gain: 0.07, slideTo: NOTE(36), filter: 600 }); }
    };

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
        if (name === 'nedkaempet') { if (t - lastKill < KILL_GAP) return false; lastKill = t; }
        SOUNDS[name](t, n);
        return true;
      },
      // Tårntyperne, der skød i ét trin. Hver type giver højst én lyd, lidt forskudt.
      skud: function (types) {
        if (!ready() || !types || !types.length) return 0;
        var seen = {}, k = 0, t0 = ctx.currentTime + 0.01;
        ['kanon', 'laser', 'puls', 'frost'].forEach(function (type) {
          if (types.indexOf(type) < 0 || seen[type]) return;
          seen[type] = 1;
          var t = t0 + k * 0.05;
          if (lastShot[type] && t - lastShot[type] < SHOT_GAP) return;
          lastShot[type] = t; k++;
          SHOTS[type](t);
        });
        return k;
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

  global.TaarneneLyd = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);

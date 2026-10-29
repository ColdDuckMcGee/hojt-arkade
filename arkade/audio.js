/*
 * Hojt Arkade – audio.js
 * Synthwave-musik og lydeffekter lavet direkte med Web Audio API
 * (ingen lydfiler, ingen rettighedsproblemer).
 *
 *   const lyd = ArkadeAudio.create({ sfx: true, music: true });
 *   lyd.unlock();             // kald ved første klik/tast (browserens autoplay-regler)
 *   lyd.play('eat');          // click, move, eat, bonus, bonusSpawn, bonusGone, obstacle, crash, pause, record
 *   lyd.setSfx(false); lyd.setMusic(true);
 */
(function (global) {
  'use strict';

  var NOTE = function (midi) { return 440 * Math.pow(2, (midi - 69) / 12); };

  function create(opts) {
    opts = opts || {};
    var sfxOn = opts.sfx !== false;
    var musicOn = opts.music !== false;
    var ctx = null, master, sfxBus, musicBus, delayIn, noiseBuf;
    var timer = null, nextTime = 0, step = 0, unlocked = false;

    function ensure() {
      if (ctx) return ctx;
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = 0.9;
      master.connect(comp); comp.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
      // Ekko til arpeggio/pad
      delayIn = ctx.createGain(); delayIn.gain.value = 1;
      var d = ctx.createDelay(1.5); d.delayTime.value = 0.49;
      var fb = ctx.createGain(); fb.gain.value = 0.32;
      var dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2200;
      delayIn.connect(d); d.connect(dl); dl.connect(fb); fb.connect(d); dl.connect(musicBus);
      // Hvid støj til trommer
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var data = noiseBuf.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      return ctx;
    }

    function tone(dest, freq, t, dur, o) {
      o = o || {};
      var osc = ctx.createOscillator();
      osc.type = o.type || 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
      if (o.detune) osc.detune.value = o.detune;
      var g = ctx.createGain();
      var peak = o.gain || 0.2, a = o.attack || 0.005, r = o.release || dur;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
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
      var g = ctx.createGain();
      g.gain.setValueAtTime(o.gain || 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(dest);
      src.start(t); src.stop(t + dur + 0.02);
    }

    // ---------- Lydeffekter ----------
    var SFX = {
      click: function (t) { tone(sfxBus, 880, t, 0.08, { type: 'sine', gain: 0.12 }); },
      move: function (t) { tone(sfxBus, 196, t, 0.09, { type: 'triangle', gain: 0.14, slideTo: 247 }); },
      eat: function (t) {
        tone(sfxBus, NOTE(76), t, 0.12, { type: 'square', gain: 0.09, filter: 2500 });
        tone(sfxBus, NOTE(83), t + 0.08, 0.18, { type: 'square', gain: 0.09, filter: 2500 });
      },
      bonus: function (t) {
        [72, 76, 79, 84].forEach(function (m, i) {
          tone(sfxBus, NOTE(m), t + i * 0.07, 0.22, { type: 'triangle', gain: 0.16 });
        });
      },
      bonusSpawn: function (t) {
        tone(sfxBus, NOTE(79), t, 0.2, { type: 'sine', gain: 0.12 });
        tone(sfxBus, NOTE(86), t + 0.12, 0.3, { type: 'sine', gain: 0.1 });
      },
      bonusGone: function (t) {
        tone(sfxBus, NOTE(74), t, 0.2, { type: 'sine', gain: 0.1 });
        tone(sfxBus, NOTE(67), t + 0.14, 0.3, { type: 'sine', gain: 0.09 });
      },
      obstacle: function (t) { tone(sfxBus, 98, t, 0.35, { type: 'sawtooth', gain: 0.12, filter: 500, slideTo: 82 }); },
      crash: function (t) {
        tone(sfxBus, 330, t, 0.8, { type: 'sawtooth', gain: 0.14, filter: 900, slideTo: 55 });
        noise(sfxBus, t, 0.4, { type: 'lowpass', freq: 900, gain: 0.08 });
      },
      pause: function (t) {
        tone(sfxBus, NOTE(69), t, 0.15, { type: 'sine', gain: 0.1 });
        tone(sfxBus, NOTE(64), t + 0.1, 0.2, { type: 'sine', gain: 0.1 });
      },
      record: function (t) {
        [67, 71, 74, 79, 83].forEach(function (m, i) {
          tone(sfxBus, NOTE(m), t + i * 0.1, 0.4, { type: 'triangle', gain: 0.13 });
        });
      }
    };

    // ---------- Musik: rolig synthwave i a-mol, 88 BPM ----------
    var BPM = 88, STEP = 60 / BPM / 4; // 16-dele
    var CHORDS = [ // grundtone (midi) og akkordtoner
      { root: 45, notes: [57, 60, 64] }, // Am
      { root: 41, notes: [53, 57, 60] }, // F
      { root: 48, notes: [55, 60, 64] }, // C
      { root: 43, notes: [55, 59, 62] }  // G
    ];
    var ARP = [0, 1, 2, 1, 2, 3, 2, 1];

    function scheduleStep(s, t) {
      var bar = Math.floor(s / 16) % CHORDS.length;
      var pos = s % 16;
      var ch = CHORDS[bar];
      if (pos === 0) { // pad
        ch.notes.forEach(function (m) {
          tone(musicBus, NOTE(m), t, STEP * 16, { type: 'sawtooth', gain: 0.022, attack: 0.5, release: STEP * 16, filter: 1100, detune: -7, send: true });
          tone(musicBus, NOTE(m), t, STEP * 16, { type: 'sawtooth', gain: 0.022, attack: 0.5, release: STEP * 16, filter: 1100, detune: 7 });
        });
      }
      if (pos % 2 === 0) { // bas i 8-dele
        var oct = (pos % 4 === 2) ? 12 : 0;
        tone(musicBus, NOTE(ch.root + oct - 12), t, STEP * 1.8, { type: 'sawtooth', gain: 0.11, filter: 420, q: 4, release: STEP * 1.8 });
        // arpeggio
        var n = ch.notes.concat([ch.notes[0] + 12])[ARP[(pos / 2) % ARP.length]] + 12;
        tone(musicBus, NOTE(n), t, STEP * 1.5, { type: 'triangle', gain: 0.035, release: STEP * 1.5, send: true });
      }
      if (pos === 0 || pos === 8) { // stortromme
        tone(musicBus, 110, t, 0.3, { type: 'sine', gain: 0.35, slideTo: 42 });
      }
      if (pos === 4 || pos === 12) { // lilletromme
        noise(musicBus, t, 0.22, { type: 'bandpass', freq: 1800, gain: 0.07 });
      }
      if (pos % 4 === 2) { // hi-hat
        noise(musicBus, t, 0.05, { type: 'highpass', freq: 7500, gain: 0.025 });
      }
    }
    function scheduler() {
      while (nextTime < ctx.currentTime + 0.15) {
        scheduleStep(step, nextTime);
        step++;
        nextTime += STEP;
      }
    }
    function startMusic() {
      if (!ctx || timer || !unlocked) return;
      nextTime = ctx.currentTime + 0.1;
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
      musicBus.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2);
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
      setSfx: function (v) { sfxOn = !!v; },
      setMusic: function (v) {
        musicOn = !!v;
        if (musicOn) startMusic(); else stopMusic();
      },
      isMusicPlaying: function () { return !!timer; }
    };
  }

  global.ArkadeAudio = { create: create };
})(window);

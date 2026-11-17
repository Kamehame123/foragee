'use strict';

/* A soft ambient soundtrack generated in the browser. Toggle with U. */
(function () {
  if (!window.FJ) return;

  const KEY = 'foragee-soundtrack-v1';
  let prefs = FJ.load(KEY, { on: false, volume: 0.5 });
  if (!prefs || typeof prefs !== 'object') prefs = { on: false, volume: 0.5 };
  if (typeof prefs.volume !== 'number' || !isFinite(prefs.volume)) prefs.volume = 0.5;
  prefs.volume = Math.max(0, Math.min(1, prefs.volume));

  let ctx = null;
  let master = null;
  let voices = [];
  let timer = null;
  let step = 0;

  // Slow, warm chord progression (Hz), one bar every 15 seconds.
  const CHORDS = [
    [174.61, 220.0, 261.63, 329.63], // Fmaj7
    [196.0, 246.94, 293.66, 392.0], // G
    [130.81, 196.0, 261.63, 329.63], // C
    [146.83, 196.0, 220.0, 293.66], // Dm7
  ];
  const TYPES = ['sine', 'triangle', 'sine', 'sine'];

  function ensureContext() {
    if (ctx) {
      if (ctx.state === 'suspended') {
        try {
          ctx.resume();
        } catch (err) {
          /* ignore */
        }
      }
      return ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch (err) {
      return null;
    }

    master = ctx.createGain();
    master.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1150;
    filter.Q.value = 0.25;

    const sparkle = ctx.createGain();
    sparkle.gain.value = 0.5;

    filter.connect(master);
    master.connect(ctx.destination);

    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = TYPES[i] || 'sine';
      osc.frequency.value = CHORDS[0][i];

      // A gentle detune drift keeps the pad from sounding static.
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.05 + i * 0.017;
      lfoGain.gain.value = 1.6 + i * 0.5;
      lfo.connect(lfoGain).connect(osc.detune);
      lfo.start();

      gain.gain.value = i === 0 ? 0.22 : 0.13;
      osc.connect(gain);
      if (i === 3) gain.connect(sparkle).connect(filter);
      else gain.connect(filter);
      osc.start();

      voices.push({ osc, gain, lfo });
    }

    return ctx;
  }

  function applyVolume() {
    if (!ctx || !master) return;
    const target = prefs.on ? 0.16 * prefs.volume : 0;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
    master.gain.linearRampToValueAtTime(target, t + 1.4);
  }

  function advance() {
    if (!ctx || !prefs.on) return;
    step = (step + 1) % CHORDS.length;
    const chord = CHORDS[step];
    const t = ctx.currentTime;
    voices.forEach((v, i) => {
      v.osc.frequency.cancelScheduledValues(t);
      v.osc.frequency.setValueAtTime(v.osc.frequency.value, t);
      v.osc.frequency.linearRampToValueAtTime(chord[i], t + 4.5);
    });
  }

  function start() {
    if (!ensureContext()) {
      FJ.toast('This browser cannot play the soundtrack.', 'warn');
      prefs.on = false;
      FJ.save(KEY, prefs);
      return false;
    }
    prefs.on = true;
    FJ.save(KEY, prefs);
    applyVolume();
    if (!timer) {
      timer = setInterval(advance, 15000);
    }
    return true;
  }

  function stop() {
    prefs.on = false;
    FJ.save(KEY, prefs);
    applyVolume();
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function toggle() {
    if (prefs.on) {
      stop();
      FJ.popup('🎵 Soundtrack', 'Paused');
    } else if (start()) {
      FJ.popup('🎵 Soundtrack', 'Playing softly');
    }
  }

  function open() {
    FJ.panel(
      'Soundtrack',
      `<p class="fj-sub">A gentle, endless pad for quiet evenings on the homestead. It is generated live in your browser — no downloads.</p>
       <div class="fj-row">
         <span class="fj-ico">${prefs.on ? '🎵' : '🔇'}</span>
         <div class="fj-main">
           <div class="fj-name">Ambient music</div>
           <div class="fj-desc">${prefs.on ? 'Playing now. Press U to pause.' : 'Off. Press U or the button below to begin.'}</div>
         </div>
         <span class="fj-side"><button class="fj-btn" type="button" data-fj-music-toggle="1">${prefs.on ? 'Pause' : 'Play'}</button></span>
       </div>
       <div class="fj-row">
         <span class="fj-ico">🔊</span>
         <div class="fj-main">
           <div class="fj-name">Volume</div>
           <div class="fj-desc">Set how loud the soundtrack should be.</div>
           <input type="range" min="0" max="100" value="${Math.round(prefs.volume * 100)}" data-fj-music-vol="1" style="width:100%;margin-top:6px;accent-color:#ffd166" />
         </div>
       </div>
       <p class="fj-sub" style="margin-top:12px">Music only starts after you interact with the page, as browsers require.</p>`,
      {
        onMount: (overlay) => {
          overlay.querySelector('[data-fj-music-toggle="1"]').addEventListener('click', () => {
            toggle();
            FJ.closePanel();
            open();
          });
          const slider = overlay.querySelector('[data-fj-music-vol="1"]');
          slider.addEventListener('input', () => {
            prefs.volume = Math.max(0, Math.min(1, Number(slider.value) / 100));
            applyVolume();
          });
          slider.addEventListener('change', () => FJ.save(KEY, prefs));
        },
      }
    );
  }

  function init() {
    FJ.button('🎵', 'Soundtrack (U)', open);
    FJ.keydown((e) => {
      if (e.key === 'u' || e.key === 'U') {
        if (FJ.isPanelOpen()) FJ.closePanel();
        else toggle();
      }
    });
    // Resume a saved preference only after the first user gesture.
    if (prefs.on) {
      const resume = () => {
        window.removeEventListener('pointerdown', resume);
        window.removeEventListener('keydown', resume);
        if (prefs.on) start();
      };
      window.addEventListener('pointerdown', resume, { once: true });
      window.addEventListener('keydown', resume, { once: true });
    }
  }

  FJ.ready(init);
})();

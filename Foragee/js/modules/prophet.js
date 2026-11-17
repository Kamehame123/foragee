'use strict';

/* A six-day weather outlook and farming hints. Open with L. */
(function () {
  if (!window.FJ) return;

  function hash(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = (n + (n << 3)) | 0;
    n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    n = n ^ (n >>> 15);
    return n >>> 0;
  }

  function forecast(day, seed, count) {
    const keys = Object.keys(WEATHERS);
    const total = keys.reduce((a, k) => a + (WEATHERS[k].weight || 1), 0);
    const out = [];
    for (let i = 0; i < count; i++) {
      let roll = hash((seed || 12345) + day * 7919 + i * 104729) % total;
      let chosen = keys[0];
      for (const k of keys) {
        roll -= WEATHERS[k].weight || 1;
        if (roll < 0) {
          chosen = k;
          break;
        }
      }
      out.push(chosen);
    }
    return out;
  }

  const ADVICE = {
    clear: 'Good light for foraging and long walks.',
    cloudy: 'Gentle weather. A fine day for the garden.',
    rain: 'The garden waters itself and crops grow faster.',
    fog: 'Quiet and dim. Fishing is peaceful in the fog.',
    storm: 'Stay near the fire. Crops love the rain, though.',
  };

  function fastestCrop(game) {
    if (!game || typeof CROPS === 'undefined') return null;
    let best = null;
    for (const id of Object.keys(CROPS)) {
      let time = CROPS[id].grow || 0;
      try {
        if (game.cropGrowTime) time = game.cropGrowTime(id);
      } catch (err) {
        /* fall back to the base grow time */
      }
      if (!best || time < best.time) best = { id, time, name: CROPS[id].name };
    }
    return best;
  }

  function open() {
    const game = window.foragee;
    const s = game && game.state;
    if (!s) {
      FJ.panel('Weather glass', '<p class="fj-sub">Start the game first.</p>');
      return;
    }
    const days = forecast(s.day || 1, s.seed, 6);
    const rows = days
      .map((key, i) => {
        const w = WEATHERS[key];
        const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `In ${i} days`;
        return `<div class="fj-row">
          <span class="fj-ico">${w.icon}</span>
          <div class="fj-main">
            <div class="fj-name">${label} · ${w.name}</div>
            <div class="fj-desc">${ADVICE[key] || ''}</div>
          </div>
          <span class="fj-side"><span class="fj-tag">day ${s.day + i}</span></span>
        </div>`;
      })
      .join('');

    const fastest = fastestCrop(game);
    const cropLine = fastest
      ? `<div class="fj-row">
           <span class="fj-ico">🌱</span>
           <div class="fj-main">
             <div class="fj-name">Fastest crop right now: ${fastest.name}</div>
             <div class="fj-desc">About ${Math.round(fastest.time)} seconds to ripen with your current tools and weather.</div>
           </div>
         </div>`
      : '';

    FJ.panel(
      'Weather glass',
      `<p class="fj-sub">A old homestead trick: read the sky six days out. The outlook is a best guess, not a promise.</p>${rows}${cropLine}`
    );
  }

  function init() {
    FJ.button('🔮', 'Weather glass (L)', open);
    FJ.keydown((e) => {
      if (e.key === 'l' || e.key === 'L') {
        if (FJ.isPanelOpen()) FJ.closePanel();
        else open();
      }
    });
  }

  FJ.ready(init);
})();

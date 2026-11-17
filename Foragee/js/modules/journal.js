'use strict';

/* A little day-by-day diary of life on the homestead. Open with J. */
(function () {
  if (!window.FJ) return;

  const KEY = 'foragee-journal-v1';
  let entries = FJ.load(KEY, []);
  const seen = { day: null, island: null, tools: null, upgrades: null, bucket: null, initialized: false };

  function totalGathered(s) {
    return Object.values((s.stats && s.stats.gathered) || {}).reduce((a, b) => a + b, 0);
  }

  function add(day, kind, text) {
    entries.push({ day, kind, text, at: Date.now() });
    if (entries.length > 200) entries = entries.slice(entries.length - 200);
    FJ.save(KEY, entries);
  }

  function weatherName(s) {
    const conf = typeof WEATHERS !== 'undefined' ? WEATHERS[s.weather] : null;
    return conf ? conf.name.toLowerCase() : 'clear';
  }

  function tick() {
    const game = window.foragee;
    if (!game || !game.started || !game.state) return;
    const s = game.state;
    const day = s.day || 1;
    const island = (s.islands && s.islands.current) || 'home';
    const toolCount = Object.keys(s.tools || {}).filter((k) => s.tools[k]).length;
    const upgradeCount = Object.keys(s.upgrades || {}).filter((k) => s.upgrades[k]).length;
    const total = totalGathered(s);
    const bucket = Math.floor(total / 25);

    if (!seen.initialized) {
      const last = entries[entries.length - 1];
      if (!last || last.day !== day || last.kind !== 'day') {
        const islandName = typeof ISLANDS !== 'undefined' && ISLANDS[island] ? ISLANDS[island].name : 'Home Isle';
        add(day, 'day', `Day ${day} begins on ${islandName} under ${weatherName(s)} skies.`);
      }
      seen.day = day;
      seen.island = island;
      seen.tools = toolCount;
      seen.upgrades = upgradeCount;
      seen.bucket = bucket;
      seen.initialized = true;
      return;
    }

    if (day !== seen.day) {
      const conf = typeof ISLANDS !== 'undefined' && ISLANDS[island] ? ISLANDS[island].name : 'Home Isle';
      add(day, 'day', `Day ${day}. Waking up on ${conf} to ${weatherName(s)} weather.`);
      seen.day = day;
    }

    if (island !== seen.island) {
      const name = typeof ISLANDS !== 'undefined' && ISLANDS[island] ? ISLANDS[island].name : island;
      add(day, 'island', `Sailed to ${name}.`);
      seen.island = island;
    }

    if (toolCount > seen.tools) {
      add(day, 'tool', `Added a new tool to the kit — ${toolCount} in total now.`);
      seen.tools = toolCount;
    }

    if (upgradeCount > seen.upgrades) {
      add(day, 'build', `Finished a new homestead upgrade — ${upgradeCount} built in all.`);
      seen.upgrades = upgradeCount;
    }

    if (bucket > seen.bucket) {
      add(day, 'gather', `Reached ${bucket * 25} items gathered since the beginning.`);
      seen.bucket = bucket;
    }
  }

  function open() {
    const rows = entries
      .slice()
      .reverse()
      .slice(0, 120)
      .map(
        (e) => `<div class="fj-row">
          <span class="fj-ico">${e.kind === 'day' ? '🌤️' : e.kind === 'island' ? '⛵' : e.kind === 'tool' ? '🧰' : e.kind === 'build' ? '🔨' : '🧺'}</span>
          <div class="fj-main">
            <div class="fj-name">Day ${e.day}</div>
            <div class="fj-desc">${e.text}</div>
          </div>
        </div>`
      )
      .join('');
    FJ.panel(
      'Field journal',
      `<p class="fj-sub">${entries.length} entries. Written as you play, kept in this browser.</p>
       <button class="fj-btn fj-danger" data-fj-clear="1" type="button">Clear journal</button>
       <div style="height:10px"></div>
       ${rows || '<p class="fj-sub">Nothing written yet. Come back after a day or two.</p>'}`,
      {
        onMount: (overlay) => {
          const btn = overlay.querySelector('[data-fj-clear="1"]');
          if (!btn) return;
          btn.addEventListener('click', () => {
            if (btn.dataset.armed === '1') {
              entries = [];
              FJ.save(KEY, entries);
              FJ.closePanel();
              return;
            }
            btn.dataset.armed = '1';
            btn.textContent = 'Click again to clear';
          });
        },
      }
    );
  }

  function init() {
    FJ.button('📔', 'Field journal (J)', open);
    FJ.keydown((e) => {
      if (e.key === 'j' || e.key === 'J') {
        if (FJ.isPanelOpen()) FJ.closePanel();
        else open();
      }
    });
    tick();
    setInterval(tick, 2500);
  }

  FJ.ready(init);
})();

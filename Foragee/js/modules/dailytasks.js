'use strict';

/* Three rotating daily tasks that pay out coins. Open with T. */
(function () {
  if (!window.FJ) return;

  const KEY = 'foragee-dailytasks-v1';
  let data = FJ.load(KEY, null);

  const POOL = [
    { id: 'gather', stat: 'gathered', label: 'Gather {n} items', min: 15, max: 30, reward: 25 },
    { id: 'wood', stat: 'wood', label: 'Gather {n} wood', min: 8, max: 16, reward: 30 },
    { id: 'stone', stat: 'stone', label: 'Gather {n} stone', min: 8, max: 16, reward: 30 },
    { id: 'harvest', stat: 'harvested', label: 'Harvest {n} garden crops', min: 2, max: 5, reward: 30 },
    { id: 'fish', stat: 'fish', label: 'Catch {n} fish', min: 2, max: 5, reward: 30 },
    { id: 'cook', stat: 'cooked', label: 'Cook {n} meals', min: 2, max: 4, reward: 35 },
    { id: 'craft', stat: 'crafted', label: 'Craft {n} things', min: 2, max: 4, reward: 30 },
    { id: 'earn', stat: 'earned', label: 'Earn {n} coins', min: 40, max: 80, reward: 30 },
  ];

  function snapshot(s) {
    const gathered = Object.values((s.stats && s.stats.gathered) || {}).reduce((a, b) => a + b, 0);
    return {
      gathered,
      wood: (s.stats.gathered && s.stats.gathered.wood) || 0,
      stone: (s.stats.gathered && s.stats.gathered.stone) || 0,
      harvested: s.stats.harvested || 0,
      fish: s.stats.fishCaught || 0,
      cooked: s.stats.cooked || 0,
      crafted: s.stats.crafted || 0,
      earned: s.stats.earned || 0,
    };
  }

  function rngFor(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(day, seed, s) {
    const rand = rngFor((day * 2654435761) ^ (seed || 12345) ^ 0x9e3779b9);
    const pool = POOL.slice();
    const chosen = [];
    while (chosen.length < 3 && pool.length) {
      const pick = Math.floor(rand() * pool.length);
      chosen.push(pool.splice(pick, 1)[0]);
    }
    const tasks = chosen.map((t) => {
      const target = t.min + Math.floor(rand() * (t.max - t.min + 1));
      return {
        id: t.id,
        stat: t.stat,
        target,
        reward: t.reward,
        label: t.label.replace('{n}', target),
      };
    });
    return { day, base: snapshot(s), tasks, claimed: [] };
  }

  function ensure() {
    const game = window.foragee;
    if (!game || !game.state) return null;
    const s = game.state;
    if (!data || data.day !== s.day || !data.base) {
      data = create(s.day || 1, s.seed, s);
      FJ.save(KEY, data);
    }
    return data;
  }

  function tick() {
    const game = window.foragee;
    if (!game || !game.started || !game.state) return;
    const d = ensure();
    if (!d) return;
    const now = snapshot(game.state);
    let changed = false;
    for (const task of d.tasks) {
      if (d.claimed.includes(task.id)) continue;
      const progress = (now[task.stat] || 0) - (d.base[task.stat] || 0);
      if (progress < task.target) continue;
      d.claimed.push(task.id);
      game.state.coins += task.reward;
      game.state.stats.earned = (game.state.stats.earned || 0) + task.reward;
      FJ.popup('📋 Daily task complete!', `${task.label} · +${task.reward}🪙`);
      changed = true;
    }
    if (changed) {
      FJ.save(KEY, data);
      if (game.save) game.save();
    }
  }

  function open() {
    const game = window.foragee;
    if (!game || !game.state) {
      FJ.panel('Daily tasks', '<p class="fj-sub">Start the game first.</p>');
      return;
    }
    const d = ensure();
    const now = snapshot(game.state);
    const rows = d.tasks
      .map((task) => {
        const progress = Math.max(0, (now[task.stat] || 0) - (d.base[task.stat] || 0));
        const done = progress >= task.target;
        const pct = Math.min(100, (progress / task.target) * 100);
        return `<div class="fj-row">
          <span class="fj-ico">${done ? '✅' : '📋'}</span>
          <div class="fj-main">
            <div class="fj-name">${task.label}</div>
            <div class="fj-bar"><i style="width:${pct}%"></i></div>
            <div class="fj-desc">${Math.min(progress, task.target)} / ${task.target} · +${task.reward}🪙</div>
          </div>
          <span class="fj-side">${done ? `<span class="fj-tag">+${task.reward}🪙</span>` : ''}</span>
        </div>`;
      })
      .join('');
    FJ.panel(
      'Daily tasks',
      `<p class="fj-sub">Day ${d.day}. Three small goals, refreshed each in-game morning. Rewards are paid automatically.</p>${rows}`
    );
  }

  function init() {
    FJ.button('📋', 'Daily tasks (T)', open);
    FJ.keydown((e) => {
      if (e.key === 't' || e.key === 'T') {
        if (FJ.isPanelOpen()) FJ.closePanel();
        else open();
      }
    });
    tick();
    setInterval(tick, 2000);
  }

  FJ.ready(init);
})();

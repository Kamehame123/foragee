'use strict';

/* Milestone badges with pop-up celebrations. Open with A. */
(function () {
  if (!window.FJ) return;

  const KEY = 'foragee-achievements-v1';
  let unlocked = FJ.load(KEY, {});
  let lastCheck = 0;

  const totalGathered = (s) => Object.values((s.stats && s.stats.gathered) || {}).reduce((a, b) => a + b, 0);
  const gather = (s, id) => (s.stats && s.stats.gathered && s.stats.gathered[id]) || 0;
  const islands = (s) => (s.islands && s.islands.unlocked ? s.islands.unlocked.length : 1);

  const DEFS = [
    { id: 'first-steps', icon: '🌱', name: 'First Steps', desc: 'Gather your first item.', check: (s) => totalGathered(s) >= 1 },
    { id: 'forager', icon: '🧺', name: 'Forager', desc: 'Gather 50 items.', check: (s) => totalGathered(s) >= 50 },
    { id: 'gatherer', icon: '🍂', name: 'Gatherer', desc: 'Gather 150 items.', check: (s) => totalGathered(s) >= 150 },
    { id: 'hoarder', icon: '📦', name: 'Hoarder', desc: 'Gather 500 items.', check: (s) => totalGathered(s) >= 500 },
    { id: 'woodcutter', icon: '🪵', name: 'Woodcutter', desc: 'Gather 25 wood.', check: (s) => gather(s, 'wood') >= 25 },
    { id: 'stonebreaker', icon: '🪨', name: 'Stonebreaker', desc: 'Gather 25 stone.', check: (s) => gather(s, 'stone') >= 25 },
    { id: 'miner', icon: '⛏️', name: 'Ironbound', desc: 'Gather 10 iron.', check: (s) => gather(s, 'iron') >= 10 },
    { id: 'crystals', icon: '💎', name: 'Crystal Clear', desc: 'Gather 10 crystal.', check: (s) => gather(s, 'crystal') >= 10 },
    { id: 'coin-purse', icon: '🪙', name: 'Coin Purse', desc: 'Earn 100 coins in total.', check: (s) => (s.stats.earned || 0) >= 100 },
    { id: 'merchant', icon: '💰', name: 'Merchant', desc: 'Earn 500 coins in total.', check: (s) => (s.stats.earned || 0) >= 500 },
    { id: 'home-fire', icon: '🔥', name: 'Home Fire', desc: 'Build a campfire.', check: (s) => !!s.upgrades.campfire },
    { id: 'builder', icon: '🏠', name: 'Homesteader', desc: 'Build the garden well.', check: (s) => !!s.upgrades.well },
    { id: 'farmer', icon: '🌾', name: 'Farmer', desc: 'Harvest 10 crops.', check: (s) => (s.stats.harvested || 0) >= 10 },
    { id: 'green-thumb', icon: '🌻', name: 'Green Thumb', desc: 'Harvest 50 crops.', check: (s) => (s.stats.harvested || 0) >= 50 },
    { id: 'cook', icon: '🍳', name: 'Cook', desc: 'Craft 5 things.', check: (s) => (s.stats.crafted || 0) >= 5 },
    { id: 'chef', icon: '🍲', name: 'Chef', desc: 'Cook 10 meals.', check: (s) => (s.stats.cooked || 0) >= 10 },
    { id: 'angler', icon: '🎣', name: 'Angler', desc: 'Catch 5 fish.', check: (s) => (s.stats.fishCaught || 0) >= 5 },
    { id: 'sailor', icon: '⛵', name: 'Sailor', desc: 'Chart a second island.', check: (s) => islands(s) >= 2 },
    { id: 'explorer', icon: '🧭', name: 'Explorer', desc: 'Chart four islands.', check: (s) => islands(s) >= 4 },
    { id: 'cartographer', icon: '🗺️', name: 'Cartographer', desc: 'Chart six islands.', check: (s) => islands(s) >= 6 },
    { id: 'all-isles', icon: '🏝️', name: 'Island Hopper', desc: 'Chart every island.', check: (s) => typeof ISLAND_ORDER !== 'undefined' && islands(s) >= ISLAND_ORDER.length },
    { id: 'survivor', icon: '🌙', name: 'Ten Days In', desc: 'Reach day 10.', check: (s) => s.day >= 10 },
    { id: 'veteran', icon: '🕯️', name: 'Old Hand', desc: 'Reach day 30.', check: (s) => s.day >= 30 },
    { id: 'tooled-up', icon: '🧰', name: 'Tooled Up', desc: 'Own five tools.', check: (s) => Object.keys(s.tools || {}).filter((k) => s.tools[k]).length >= 5 },
  ];

  function checkAll() {
    const game = window.foragee;
    if (!game || !game.started || !game.state) return;
    const s = game.state;
    let added = 0;
    for (const def of DEFS) {
      if (unlocked[def.id]) continue;
      let ok = false;
      try { ok = def.check(s, game); } catch (err) { ok = false; }
      if (!ok) continue;
      unlocked[def.id] = s.day || 1;
      added += 1;
      FJ.popup(`${def.icon} ${def.name}`, def.desc);
    }
    if (added) FJ.save(KEY, unlocked);
  }

  function row(def) {
    const on = !!unlocked[def.id];
    return `<div class="fj-row">
      <span class="fj-ico">${on ? def.icon : '🔒'}</span>
      <div class="fj-main">
        <div class="fj-name">${def.name}</div>
        <div class="fj-desc">${def.desc}</div>
      </div>
      <span class="fj-side">${on ? `<span class="fj-tag">day ${unlocked[def.id]}</span>` : '—'}</span>
    </div>`;
  }

  function open() {
    const done = DEFS.filter((d) => unlocked[d.id]).length;
    FJ.panel(
      'Achievements',
      `<p class="fj-sub">${done} / ${DEFS.length} unlocked. Milestones pop up as you play.</p>
       <div class="fj-grid">${DEFS.map(row).join('')}</div>`
    );
  }

  function init() {
    FJ.button('🏅', 'Achievements (A)', open);
    FJ.keydown((e) => {
      if (e.key === 'a' || e.key === 'A') {
        if (FJ.isPanelOpen()) FJ.closePanel();
        else open();
      }
    });
    checkAll();
    setInterval(checkAll, 1200);
  }

  FJ.ready(init);
})();

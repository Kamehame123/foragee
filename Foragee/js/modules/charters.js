'use strict';

/**
 * Island charters from anywhere.
 * Buying a charter normally means walking to the rowboat; this adds a shortcut
 * button and the N key, plus a gentle nudge when you can finally afford one.
 */
(function () {
  if (!window.FJ) return;

  const KEY = 'foragee-charterhints-v1';
  let hinted = FJ.load(KEY, []);
  if (!Array.isArray(hinted)) hinted = [];

  function open() {
    const game = window.foragee;
    if (!game || !game.started) {
      FJ.toast('Start the game first, then chart an island.', 'warn');
      return;
    }
    if (game.ui && game.ui.current === 'islands') {
      game.ui.closePanel();
      return;
    }
    FJ.closePanel();
    game.ui.openPanel('islands');
  }

  function cheapestUnowned(s) {
    if (typeof ISLAND_ORDER === 'undefined' || typeof ISLANDS === 'undefined') return null;
    let best = null;
    for (const id of ISLAND_ORDER) {
      if (id === 'home' || s.islands.unlocked.includes(id)) continue;
      const conf = ISLANDS[id];
      if (!best || conf.cost < best.conf.cost) best = { id, conf };
    }
    return best;
  }

  function tick() {
    const game = window.foragee;
    if (!game || !game.started || !game.state) return;
    const s = game.state;
    const next = cheapestUnowned(s);
    if (!next || hinted.includes(next.id) || s.coins < next.conf.cost) return;
    hinted.push(next.id);
    FJ.save(KEY, hinted);
    FJ.popup(`⛵ ${next.conf.name} is within reach`, `You have ${s.coins}🪙 — press N to chart it.`);
  }

  function init() {
    FJ.button('⛵', 'Island charters (N)', open);
    FJ.keydown((e) => {
      if (e.key === 'n' || e.key === 'N') open();
    });
    tick();
    setInterval(tick, 4000);
  }

  FJ.ready(init);
})();

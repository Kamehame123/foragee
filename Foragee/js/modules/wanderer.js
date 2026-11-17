'use strict';

/* A traveller who visits the homestead every other day with a souvenir trade. Open with Q. */
(function () {
  if (!window.FJ) return;

  const KEY = 'foragee-wanderer-v1';
  let record = FJ.load(KEY, { day: 0, sold: false, bought: false });

  const SELL_POOL = [
    { id: 'berry', qty: 4, label: 'a basket of berries' },
    { id: 'mushroom', qty: 4, label: 'mushroom caps' },
    { id: 'fiber', qty: 5, label: 'soft fiber' },
    { id: 'hazelnut', qty: 3, label: 'hazelnuts' },
    { id: 'clay', qty: 4, label: 'river clay' },
    { id: 'herb', qty: 3, label: 'wild herbs' },
  ];
  const BUY_POOL = [
    { id: 'crystal', qty: 1, price: 70, label: 'a shard of crystal' },
    { id: 'iron', qty: 1, price: 55, label: 'a lump of iron' },
    { id: 'trout', qty: 1, price: 60, label: 'a river trout' },
    { id: 'honey', qty: 2, price: 45, label: 'a jar of honey' },
    { id: 'apple', qty: 3, price: 30, label: 'sweet apples' },
  ];

  function hash(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = (n + (n << 3)) | 0;
    n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    n = n ^ (n >>> 15);
    return n >>> 0;
  }

  function visitDay(s) {
    return (s.day || 1) % 2 === 0;
  }

  function offers(s) {
    const seed = hash((s.seed || 12345) + (s.day || 1) * 3571);
    const sell = SELL_POOL[seed % SELL_POOL.length];
    const buy = BUY_POOL[(seed >>> 5) % BUY_POOL.length];
    const sellPrice = Math.max(4, Math.round((SELL_POOL.indexOf(sell) + 3) * 7));
    return { sell: { ...sell, price: sellPrice }, buy: { ...buy } };
  }

  function ensureDay(s) {
    if (record.day !== s.day) {
      record = { day: s.day, sold: false, bought: false };
      FJ.save(KEY, record);
    }
  }

  function tradeSell(o) {
    const game = window.foragee;
    const s = game.state;
    ensureDay(s);
    if (record.sold) return;
    if ((s.inv[o.sell.id] || 0) < o.sell.qty) {
      FJ.toast('Not enough of that to trade yet.', 'warn');
      return;
    }
    game.removeItem(o.sell.id, o.sell.qty);
    s.coins += o.sell.price;
    s.stats.earned = (s.stats.earned || 0) + o.sell.price;
    record.sold = true;
    FJ.save(KEY, record);
    game.save();
    FJ.toast(`Traded ${o.sell.qty} ${ITEMS[o.sell.id].name.toLowerCase()} for ${o.sell.price}🪙.`, 'good');
    open();
  }

  function tradeBuy(o) {
    const game = window.foragee;
    const s = game.state;
    ensureDay(s);
    if (record.bought) return;
    if (s.coins < o.buy.price) {
      FJ.toast('Not enough coins for that yet.', 'warn');
      return;
    }
    if (game.addItem(o.buy.id, o.buy.qty) <= 0) {
      FJ.toast('Your bag is full.', 'warn');
      return;
    }
    s.coins -= o.buy.price;
    record.bought = true;
    FJ.save(KEY, record);
    game.save();
    FJ.toast(`Bought ${o.buy.qty} ${ITEMS[o.buy.id].name.toLowerCase()} for ${o.buy.price}🪙.`, 'good');
    open();
  }

  function open() {
    const game = window.foragee;
    const s = game && game.state;
    if (!s) {
      FJ.panel('Traveller', '<p class="fj-sub">Start the game first.</p>');
      return;
    }
    const here = visitDay(s);
    if (!here) {
      FJ.panel(
        'Traveller',
        `<p class="fj-sub">No traveller today. They visit the homestead every other day — try again tomorrow.</p>`
      );
      return;
    }
    ensureDay(s);
    const o = offers(s);
    const canSell = !record.sold && (s.inv[o.sell.id] || 0) >= o.sell.qty;
    const canBuy = !record.bought && s.coins >= o.buy.price;

    FJ.panel(
      'Traveller',
      `<p class="fj-sub">A road-worn traveller rests by the stall. "Trade you for something curious?"</p>
       <div class="fj-row">
         <span class="fj-ico">${ITEMS[o.sell.id].icon}</span>
         <div class="fj-main">
           <div class="fj-name">Sell ${o.sell.qty}× ${ITEMS[o.sell.id].name}</div>
           <div class="fj-desc">They are after ${o.sell.label}. You carry ${s.inv[o.sell.id] || 0}.</div>
         </div>
         <span class="fj-side"><button class="fj-btn" type="button" data-fj-sell="1" ${canSell ? '' : 'disabled'}>+${o.sell.price}🪙</button></span>
       </div>
       <div class="fj-row">
         <span class="fj-ico">${ITEMS[o.buy.id].icon}</span>
         <div class="fj-main">
           <div class="fj-name">Buy ${o.buy.qty}× ${ITEMS[o.buy.id].name}</div>
           <div class="fj-desc">"${o.buy.label[0].toUpperCase() + o.buy.label.slice(1)} — ${o.buy.price} coins to you."</div>
         </div>
         <span class="fj-side"><button class="fj-btn" type="button" data-fj-buy="1" ${canBuy ? '' : 'disabled'}>-${o.buy.price}🪙</button></span>
       </div>
       <p class="fj-sub" style="margin-top:12px">One trade each way per visit.</p>`,
      {
        onMount: (overlay) => {
          const sellBtn = overlay.querySelector('[data-fj-sell="1"]');
          const buyBtn = overlay.querySelector('[data-fj-buy="1"]');
          if (sellBtn) sellBtn.addEventListener('click', () => tradeSell(o));
          if (buyBtn) buyBtn.addEventListener('click', () => tradeBuy(o));
        },
      }
    );
  }

  function drawVisitor(game) {
    if (!game.started || !game.state || game.world.island) return;
    if (!visitDay(game.state)) return;
    const stall = game.world.stallPos;
    if (!stall || !game.clock) return;
    const p = game.worldToScreen(stall.x + 54, stall.y + 18);
    const ctx = game.ctx;
    const bob = Math.sin(game.clock * 1.6) * 1.2;
    ctx.save();
    ctx.translate(p.x, p.y + bob);

    ctx.fillStyle = 'rgba(30, 44, 30, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5a4632';
    ctx.beginPath();
    ctx.ellipse(0, 4, 10, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7fa36a';
    ctx.beginPath();
    ctx.ellipse(0, -12, 8, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5b4632';
    ctx.beginPath();
    ctx.ellipse(0, -17, 12, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0b48a';
    ctx.beginPath();
    ctx.arc(0, -11, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f2a22';
    ctx.beginPath();
    ctx.arc(-1.8, -11, 0.8, 0, Math.PI * 2);
    ctx.arc(1.8, -11, 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#8a6a4a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-12, -2);
    ctx.lineTo(-16, 10);
    ctx.stroke();
    ctx.fillStyle = '#6e472d';
    ctx.beginPath();
    ctx.ellipse(-16, 12, 5, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function hook() {
    const game = window.foragee;
    if (!game) return;
    const original = game.render.bind(game);
    game.render = function () {
      original();
      try {
        drawVisitor(game);
      } catch (err) {
        /* keep rendering the world even if the visitor fails */
      }
    };

    FJ.button('🧳', 'Traveller (Q)', () => {
      if (FJ.isPanelOpen()) FJ.closePanel();
      else open();
    });
    FJ.keydown((e) => {
      if (e.key === 'q' || e.key === 'Q') {
        if (FJ.isPanelOpen()) FJ.closePanel();
        else open();
      }
    });
  }

  FJ.ready(hook);
})();

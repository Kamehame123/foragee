'use strict';

class UI {
  constructor(game) {
    this.game = game;
    this.current = null;
    this.invSig = '';
    this.objSig = '';
    this.acc = 0;
    this.resetTimer = null;
    this.plantPlot = null;

    const $ = (id) => document.getElementById(id);
    this.el = {
      coins: $('coinCount'),
      energyFill: $('energyFill'),
      energyText: $('energyText'),
      dayLabel: $('dayLabel'),
      timeLabel: $('timeLabel'),
      timeIcon: $('timeIcon'),
      weatherIcon: $('weatherIcon'),
      invBar: $('invBar'),
      prompt: $('prompt'),
      toast: $('toast'),
      panelRoot: $('panelRoot'),
      objList: $('objList'),
      startScreen: $('startScreen'),
      startButtons: $('startButtons'),
      startNote: $('startNote'),
      muteBtn: $('btnMute'),
    };

    this.chips = new Map();
    this.buildInvBar();
    this.buildObjectives();
    this.bind();
    this.updateInv();
    this.updateMuteIcon();
  }

  /* ---------------- setup ---------------- */

  buildInvBar() {
    const frag = document.createDocumentFragment();
    for (const id of ITEM_ORDER) {
      const item = ITEMS[id];
      const chip = document.createElement('div');
      chip.className = 'inv-chip empty';
      chip.dataset.id = id;
      chip.title = `${item.name} — ${item.desc}`;
      if (item.food) chip.classList.add('food');
      chip.innerHTML = `<span class="icon">${item.icon}</span><span class="count">0</span>`;
      frag.appendChild(chip);
      this.chips.set(id, chip);
    }
    const cap = document.createElement('div');
    cap.className = 'inv-chip';
    cap.id = 'invCapChip';
    cap.innerHTML = '<span class="inv-cap-label">0 / 40</span>';
    frag.appendChild(cap);
    this.el.invBar.appendChild(frag);
  }

  buildObjectives() {
    this.el.objList.innerHTML = '';
    this.objEls = new Map();
    for (const q of QUESTS) {
      const li = document.createElement('li');
      li.className = 'obj-item';
      li.innerHTML = `<span class="obj-bullet"></span><span class="obj-text">${q.title}</span><span class="obj-reward">+${q.reward}🪙</span>`;
      this.el.objList.appendChild(li);
      this.objEls.set(q.id, li);
    }
  }

  bind() {
    const g = this.game;

    document.getElementById('btnCraft').addEventListener('click', () => {
      Sound.click();
      this.togglePanel('craft');
    });
    document.getElementById('btnBag').addEventListener('click', () => {
      Sound.click();
      this.togglePanel('bag');
    });
    document.getElementById('btnHelp').addEventListener('click', () => {
      Sound.click();
      this.togglePanel('help');
    });
    this.el.muteBtn.addEventListener('click', () => g.toggleMute());

    this.el.invBar.addEventListener('click', (e) => {
      const chip = e.target.closest('.inv-chip[data-id]');
      if (!chip) return;
      const id = chip.dataset.id;
      const item = ITEMS[id];
      if (item && item.food) {
        g.eat(id);
      }
    });

    this.el.panelRoot.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) {
        if (e.target === this.el.panelRoot) this.closePanel();
        return;
      }
      this.handleAction(btn.dataset.action, btn);
    });

    this.el.startButtons.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      Sound.ensure();
      if (btn.dataset.action === 'play') {
        g.begin();
      } else if (btn.dataset.action === 'reset') {
        this.confirmStartReset(btn);
      }
    });

    window.addEventListener('resize', () => this.game.resize());
  }

  /* ---------------- per-frame ---------------- */

  update(dt) {
    this.acc += dt;
    if (this.acc < 0.08) return;
    this.acc = 0;

    const g = this.game;
    const s = g.state;

    this.el.coins.textContent = s.coins;
    const e = Math.max(0, s.energy);
    this.el.energyFill.style.width = `${(e / s.maxEnergy) * 100}%`;
    this.el.energyFill.classList.toggle('low', e < 25);
    this.el.energyText.textContent = `${Math.ceil(e)} / ${s.maxEnergy}`;
    this.el.dayLabel.textContent = `Day ${s.day}`;
    this.el.timeLabel.textContent = formatTime(s.time);
    this.el.timeIcon.textContent = g.timeIcon();
    if (this.el.weatherIcon) {
      const w = WEATHERS[g.weatherType()];
      this.el.weatherIcon.textContent = w ? w.icon : '☀';
      this.el.weatherIcon.title = w ? w.name : 'Clear';
    }

    this.updatePrompt();
    this.updateObjectives();

    const sig = ITEM_ORDER.map((id) => s.inv[id] || 0).join(',') + `|${g.capacity()}`;
    if (sig !== this.invSig) {
      this.invSig = sig;
      this.updateInv();
      if (this.current === 'craft' || this.current === 'shop' || this.current === 'bag' || this.current === 'plant') {
        this.renderPanel();
      }
    }
  }

  updateInv() {
    const s = this.game.state;
    for (const [id, chip] of this.chips) {
      const count = s.inv[id] || 0;
      chip.classList.toggle('empty', count <= 0);
      chip.querySelector('.count').textContent = count;
    }
    const cap = document.getElementById('invCapChip');
    if (cap) {
      cap.querySelector('.inv-cap-label').textContent = `${this.game.itemTotal()} / ${this.game.capacity()}`;
    }
  }

  updateObjectives() {
    const s = this.game.state;
    const sig = QUESTS.map((q) => (s.claimed.includes(q.id) ? '1' : '0')).join('') + s.stats.earned;
    if (sig === this.objSig) return;
    this.objSig = sig;
    for (const q of QUESTS) {
      const li = this.objEls.get(q.id);
      const done = s.claimed.includes(q.id);
      li.classList.toggle('done', done);
      li.querySelector('.obj-bullet').textContent = done ? '✓' : '';
    }
  }

  updatePrompt() {
    const info = this.game.started ? this.game.targetInfo() : null;
    const el = this.el.prompt;
    if (!info) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    el.classList.toggle('muted', !!info.muted);
    const key = info.muted ? '' : `<span class="prompt-key">${this.game.isTouch ? '🌿' : 'E'}</span>`;
    el.innerHTML = `${key}${info.text}`;
  }

  updateMuteIcon() {
    this.el.muteBtn.textContent = Sound.muted ? '🔇' : '🔊';
  }

  toast(message, kind) {
    const div = document.createElement('div');
    div.className = `toast-item${kind ? ` ${kind}` : ''}`;
    div.textContent = message;
    this.el.toast.appendChild(div);
    while (this.el.toast.children.length > 4) {
      this.el.toast.firstChild.remove();
    }
    setTimeout(() => div.remove(), 2350);
  }

  /* ---------------- panels ---------------- */

  openPanel(name) {
    if (!this.game.started) return;
    this.current = name;
    this.el.panelRoot.classList.remove('hidden');
    this.renderPanel();
  }

  closePanel() {
    this.current = null;
    this.plantPlot = null;
    this.el.panelRoot.classList.add('hidden');
    this.el.panelRoot.innerHTML = '';
  }

  togglePanel(name) {
    if (this.current === name) this.closePanel();
    else this.openPanel(name);
  }

  handleEscape() {
    if (!this.game.started) return;
    if (this.current) this.closePanel();
    else this.openPanel('pause');
  }

  renderPanel() {
    if (!this.current) return;
    if (this.current === 'craft') this.renderCraft();
    else if (this.current === 'bag') this.renderBag();
    else if (this.current === 'shop') this.renderShop();
    else if (this.current === 'help') this.renderHelp();
    else if (this.current === 'pause') this.renderPause();
    else if (this.current === 'plant') this.renderPlantMenu();
  }

  setPanel(title, sub, body) {
    this.el.panelRoot.innerHTML = `<div class="panel" role="dialog" aria-modal="true">
      <header class="panel-head">
        <div>
          <h2>${title}</h2>
          <p class="panel-sub">${sub}</p>
        </div>
        <button class="panel-close" data-action="close" aria-label="Close">✕</button>
      </header>
      <div class="panel-body">${body}</div>
    </div>`;
  }

  costHtml(cost) {
    const s = this.game.state;
    return Object.entries(cost)
      .map(([id, n]) => {
        const have = s.inv[id] || 0;
        const item = ITEMS[id];
        return `<span class="cost-item${have < n ? ' lack' : ''}" title="You have ${have}">${item.icon} ${n}</span>`;
      })
      .join('');
  }

  renderCraft() {
    const s = this.game.state;
    const needNames = { campfire: ['🔥', 'campfire'], torch: ['🕯️', 'torch'] };
    const rows = RECIPES.map((r) => {
      const owned = r.once && s.upgrades[r.once];
      const needsOk = !r.needs || s.upgrades[r.needs];
      const affordable = Object.entries(r.cost).every(([id, n]) => (s.inv[id] || 0) >= n);
      const space = !r.consumable || this.game.itemTotal() < this.game.capacity();
      const can = !owned && needsOk && affordable && space;

      let label = r.verb || 'Craft';
      if (owned) label = r.once === 'campfire' || r.once === 'hearth' ? 'Built' : 'Owned';
      else if (!needsOk) label = `Needs ${(needNames[r.needs] || [, r.needs])[1]}`;
      else if (!space) label = 'Bag full';

      const cls = owned || !needsOk ? 'ghost' : 'primary';
      const needMeta = needNames[r.needs] || ['', r.needs];
      const needsTag =
        r.needs && !s.upgrades[r.needs]
          ? `<span class="cost-item need">${needMeta[0]} ${needMeta[1]}</span>`
          : '';

      return `<div class="recipe${owned ? ' locked' : ''}">
        <div class="recipe-icon">${r.icon}</div>
        <div class="recipe-main">
          <div class="recipe-name">${r.name}${owned ? ' <span class="bag-tag">✓ built</span>' : ''}</div>
          <div class="recipe-desc">${r.desc}</div>
          <div class="recipe-cost">${this.costHtml(r.cost)}${needsTag}</div>
        </div>
        <div class="recipe-action">
          <button class="${cls}" data-action="craft" data-id="${r.id}" ${can ? '' : 'disabled'}>${label}</button>
        </div>
      </div>`;
    }).join('');

    this.setPanel(
      'Crafting',
      'Turn foraged goods into tools, warmth, and better meals.',
      `<div class="recipe-grid">${rows}</div>`
    );
  }

  openPlantMenu(plot) {
    this.plantPlot = plot;
    this.current = 'plant';
    this.el.panelRoot.classList.remove('hidden');
    this.renderPlantMenu();
  }

  renderPlantMenu() {
    const g = this.game;
    const s = g.state;
    const rows = Object.entries(CROPS)
      .filter(([, conf]) => (s.inv[conf.seed] || 0) > 0)
      .map(([id, conf]) => {
        const have = s.inv[conf.seed] || 0;
        const seedItem = ITEMS[conf.seed];
        return `<div class="recipe">
          <div class="recipe-icon">${conf.icon}</div>
          <div class="recipe-main">
            <div class="recipe-name">${conf.name}</div>
            <div class="recipe-desc">Ready in about ${Math.round(g.cropGrowTime(id))} seconds. Yields ${conf.min}–${conf.max}.</div>
            <div class="recipe-cost"><span class="cost-item">${seedItem.icon} ${have} seed${have === 1 ? '' : 's'} left</span></div>
          </div>
          <div class="recipe-action">
            <button class="primary" data-action="plant" data-crop="${id}">Plant</button>
          </div>
        </div>`;
      })
      .join('');

    this.setPanel(
      'Plant seeds',
      'Choose what to sow in this tilled plot.',
      `<div class="recipe-grid">${rows || '<p class="panel-sub">No seeds in your bag. The trader sells berry, pumpkin, carrot and corn seeds.</p>'}</div>`
    );
  }

  renderBag() {    const g = this.game;
    const s = g.state;
    const cap = g.capacity();
    const total = g.itemTotal();

    const rows = ITEM_ORDER.filter((id) => (s.inv[id] || 0) > 0)
      .map((id) => {
        const item = ITEMS[id];
        const eat = item.food
          ? `<button class="ghost" data-action="eat" data-id="${id}">Eat +${item.food}</button>`
          : '';
        return `<div class="bag-row">
          <span class="bag-icon">${item.icon}</span>
          <span class="bag-name">${item.name}<small>${item.desc}</small></span>
          <span class="bag-count">×${s.inv[id]}</span>
          ${eat}
        </div>`;
      })
      .join('');

    const gear = [];
    const toolNames = TOOL_META;
    for (const [id, meta] of Object.entries(toolNames)) {
      if (s.tools[id]) {
        gear.push(`<div class="bag-row"><span class="bag-icon">${meta.icon}</span><span class="bag-name">${meta.name}</span><span class="bag-tag">equipped</span></div>`);
      }
    }
    const upNames = {
      campfire: ['🔥', 'Campfire'],
      hearth: ['🗿', 'Stone Hearth'],
      backpack: ['🎒', 'Woven Backpack'],
      basket: ['🧺', 'Gathering Basket'],
      torch: ['🕯️', 'Hand Torch'],
      lantern: ['🏮', 'Crystal Lantern'],
      boots: ['🥾', 'Trail Boots'],
      well: ['🪔', 'Garden Well'],
      coop: ['🐓', 'Chicken Coop'],
      apiary: ['🐝', 'Bee Box'],
    };
    for (const [id, [icon, name]] of Object.entries(upNames)) {
      if (s.upgrades[id]) {
        gear.push(`<div class="bag-row"><span class="bag-icon">${icon}</span><span class="bag-name">${name}</span><span class="bag-tag">owned</span></div>`);
      }
    }

    const gathered = Object.values(s.stats.gathered).reduce((a, b) => a + b, 0);

    this.setPanel(
      'Bag',
      'Your satchel, your gear, and a little record of the good life.',
      `<div class="cap-row"><span>Space used</span><span>${total} / ${cap}</span></div>
       <div class="cap-bar"><i style="width:${clamp((total / cap) * 100, 0, 100)}%"></i></div>
       ${rows || '<p class="panel-sub">Your bag is empty. Go forage something!</p>'}
       <h3 class="section-title" style="margin-top:18px">Gear</h3>
       ${gear.join('') || '<p class="panel-sub">No gear yet. Visit the trader by the homestead, or open the crafting panel.</p>'}
       <h3 class="section-title" style="margin-top:18px">Record</h3>
       <div class="stat-grid">
         <div class="stat-box"><b>${s.day}</b><span>Day</span></div>
         <div class="stat-box"><b>${s.stats.earned}</b><span>Coins earned</span></div>
         <div class="stat-box"><b>${gathered}</b><span>Items gathered</span></div>
         <div class="stat-box"><b>${s.stats.harvested || 0}</b><span>Crops harvested</span></div>
       </div>`
    );
  }

  renderShop() {
    const s = this.game.state;

    const buyRows = SHOP_ITEMS.map((item) => {
      const owned = item.kind === 'tool' && !!s.tools[item.id];
      const needsTool = item.requires && !s.tools[item.requires];
      const can = !owned && !needsTool && s.coins >= item.price;
      const count = item.kind === 'item' ? s.inv[item.id] || 0 : 0;
      const right = owned
        ? '<span class="shop-price owned-tag">Owned</span>'
        : `<span class="shop-price">${item.price}🪙</span>`;
      const needNote = needsTool
        ? `<div class="shop-desc">Requires ${TOOL_META[item.requires] ? TOOL_META[item.requires].name : item.requires}.</div>`
        : '';
      return `<div class="shop-row">
        <span class="shop-icon">${item.icon}</span>
        <div class="shop-main">
          <div class="shop-name">${item.name}${count ? ` <span class="shop-count">×${count}</span>` : ''}</div>
          <div class="shop-desc">${item.desc}</div>
          ${needNote}
        </div>
        ${right}
        <button class="${owned ? 'ghost' : 'primary'}" data-action="buy" data-id="${item.id}" ${can ? '' : 'disabled'}>${owned ? 'Owned' : 'Buy'}</button>
      </div>`;
    }).join('');

    const sellRows = ITEM_ORDER.filter((id) => (s.inv[id] || 0) > 0)
      .map((id) => {
        const item = ITEMS[id];
        const count = s.inv[id];
        const total = count * item.sell;
        return `<div class="shop-row">
          <span class="shop-icon">${item.icon}</span>
          <div class="shop-main">
            <div class="shop-name">${item.name} <span class="shop-count">×${count}</span></div>
            <div class="shop-desc">${item.sell}🪙 each</div>
          </div>
          <button class="sell-btn" data-action="sell" data-id="${id}">Sell all · ${total}🪙</button>
        </div>`;
      })
      .join('');

    this.setPanel(
      'Trader',
      `Coins in hand: <b style="color:var(--accent)">${s.coins}🪙</b> · Tools last forever. Seeds and bait restock here.`,
      `<div class="shop-grid">
        <div>
          <h3 class="section-title">Buy</h3>
          ${buyRows}
        </div>
        <div>
          <h3 class="section-title">Sell</h3>
          ${sellRows || '<p class="panel-sub">Nothing to sell. Bring the trader some wood or berries.</p>'}
        </div>
      </div>`
    );
  }

  renderHelp() {
    this.setPanel(
      'How to play',
      'Foragee is a small, gentle loop: gather, craft, sell, grow.',
      `<div class="help-grid">
        <div class="help-block">
          <h3>The loop</h3>
          <p>Walk up to trees, rocks, bushes and grass. Hold <kbd>E</kbd> (or <kbd>Space</kbd>) to gather what they hold.</p>
          <p>Gathering costs energy. Eat with <kbd>F</kbd> or click a food in your bag. Sleep in the tent at the homestead to start a fresh day.</p>
          <p>Sell surplus to the trader and buy an axe, a pickaxe, and a hoe. Craft a campfire to cook and recharge quickly.</p>
          <p>Use the hoe on the four garden plots, then choose which seeds to sow from your bag. Berries, carrots, corn and pumpkins all grow at different speeds.</p>
          <p>Follow the path west to the pond to fish, and look for apple trees, hazelnut trees, beehives, reed beds and clay banks around the forest.</p>
          <p>Build a garden well, chicken coop and bee box to make the homestead work while you explore. Storms roll in now and then and speed up regrowth.</p>
          ${
            this.game.isTouch
              ? '<p><strong>On touch:</strong> drag the stick to move, hold 🌿 to gather, and tap 🍓 to eat.</p>'
              : ''
          }
        </div>
        <div class="help-block">
          <h3>Controls</h3>
          ${
            this.game.isTouch
              ? `<div class="key-row"><span>Move</span><span>Drag the stick</span></div>
                 <div class="key-row"><span>Gather / interact</span><span>Hold 🌿</span></div>
                 <div class="key-row"><span>Eat best food</span><span>Tap 🍓</span></div>
                 <div class="key-row"><span>Plant seeds</span><span>Tap the plot, then choose</span></div>
                 <div class="key-row"><span>Crafting / Bag / Help</span><span>Top buttons</span></div>`
              : `<div class="key-row"><span>Move</span><span><kbd>WASD</kbd> / arrows</span></div>
                 <div class="key-row"><span>Sprint</span><span><kbd>Shift</kbd> (drains energy)</span></div>
                 <div class="key-row"><span>Gather / interact</span><span><kbd>E</kbd> or <kbd>Space</kbd></span></div>
                 <div class="key-row"><span>Plant seeds</span><span>Interact with a tilled plot</span></div>
                 <div class="key-row"><span>Eat best food</span><span><kbd>F</kbd></span></div>
                 <div class="key-row"><span>Crafting</span><span><kbd>C</kbd></span></div>
                 <div class="key-row"><span>Bag</span><span><kbd>I</kbd></span></div>
                 <div class="key-row"><span>Menu</span><span><kbd>Esc</kbd></span></div>
                 <div class="key-row"><span>Mute</span><span><kbd>M</kbd></span></div>`
          }
        </div>
        <div class="help-block">
          <h3>Tips</h3>
          <ul>
            <li>Iron veins need a pickaxe — save up 45 coins.</li>
            <li>Standing by a lit campfire restores energy quickly.</li>
            <li>Night is dark without a torch, but fireflies are pretty.</li>
            <li>Your game saves automatically in this browser.</li>
          </ul>
        </div>
        <div class="help-block">
          <h3>Goals</h3>
          <p>The goal list in the top-left rewards you as you settle in. There is no rush — the forest regrows.</p>
        </div>
      </div>`
    );
  }

  renderPause() {
    this.setPanel(
      'Paused',
      'The forest will wait. Progress saves automatically.',
      `<div class="pause-body">
        <button class="primary" data-action="resume">Resume</button>
        <button class="ghost" data-action="open" data-panel="craft">Crafting</button>
        <button class="ghost" data-action="open" data-panel="bag">Bag</button>
        <button class="ghost" data-action="open" data-panel="help">How to play</button>
        <button class="ghost" data-action="mute">Sound: ${Sound.muted ? 'Off' : 'On'}</button>
        <button class="ghost" data-action="reset">New game</button>
      </div>`
    );
  }

  handleAction(action, btn) {
    const g = this.game;
    switch (action) {
      case 'close':
        Sound.click();
        this.closePanel();
        break;
      case 'craft':
        g.craft(btn.dataset.id);
        this.renderPanel();
        break;
      case 'buy':
        g.buy(btn.dataset.id);
        this.renderPanel();
        break;
      case 'sell':
        g.sell(btn.dataset.id);
        this.renderPanel();
        break;
      case 'eat':
        g.eat(btn.dataset.id);
        this.renderPanel();
        break;
      case 'plant': {
        const plot = this.plantPlot;
        const crop = btn.dataset.crop;
        this.closePanel();
        g.plantCrop(plot, crop);
        break;
      }
      case 'resume':
        this.closePanel();
        break;
      case 'open':
        this.openPanel(btn.dataset.panel);
        break;
      case 'mute':
        g.toggleMute();
        this.renderPanel();
        break;
      case 'reset':
        this.confirmReset(btn);
        break;
      default:
        break;
    }
  }

  confirmReset(btn) {
    if (btn.dataset.armed === '1') {
      clearTimeout(this.resetTimer);
      this.game.newGame();
      this.game.begin();
    } else {
      btn.dataset.armed = '1';
      btn.dataset.label = btn.textContent;
      btn.textContent = 'Click again to erase progress';
      this.resetTimer = setTimeout(() => {
        if (btn.isConnected && btn.dataset.armed === '1') {
          btn.dataset.armed = '';
          btn.textContent = btn.dataset.label || 'New game';
        }
      }, 3000);
    }
  }

  confirmStartReset(btn) {
    if (btn.dataset.armed === '1') {
      clearTimeout(this.resetTimer);
      this.game.newGame();
      this.game.begin();
    } else {
      btn.dataset.armed = '1';
      btn.dataset.label = btn.textContent;
      btn.textContent = 'Click again to start over';
      this.el.startNote.textContent = 'This erases your saved homestead.';
      this.resetTimer = setTimeout(() => {
        if (btn.isConnected && btn.dataset.armed === '1') {
          btn.dataset.armed = '';
          btn.textContent = btn.dataset.label || 'New game';
          this.el.startNote.textContent = '';
        }
      }, 3000);
    }
  }

  /* ---------------- start screen ---------------- */

  showStart() {
    const hasSave = this.game.hasSave();
    this.el.startScreen.classList.remove('hidden', 'fading');
    this.el.startButtons.innerHTML = '';
    this.el.startNote.textContent = hasSave
      ? 'Your homestead is waiting where you left it.'
      : this.game.isTouch
        ? 'Tip: drag the stick to move, then hold 🌿 near a tree, rock, or bush.'
        : 'Tip: hold E near a tree, rock, or bush to gather.';

    const play = document.createElement('button');
    play.className = 'primary';
    play.dataset.action = 'play';
    play.textContent = hasSave ? 'Continue' : 'Start foraging';
    this.el.startButtons.appendChild(play);

    if (hasSave) {
      const reset = document.createElement('button');
      reset.className = 'ghost';
      reset.dataset.action = 'reset';
      reset.textContent = 'New game';
      this.el.startButtons.appendChild(reset);
    }
  }

  hideStart() {
    this.el.startScreen.classList.add('fading');
    setTimeout(() => {
      if (this.el.startScreen.classList.contains('fading')) {
        this.el.startScreen.classList.add('hidden');
      }
    }, 380);
  }
}

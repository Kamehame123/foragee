'use strict';

const SAVE_KEY = 'foragee-save-v1';
const DAY_LENGTH = 300; // real seconds for a full in-game day
const BASE_CAPACITY = 40;
const BACKPACK_BONUS = 20;

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.keys = {};
    this.vw = 0;
    this.vh = 0;
    this.dpr = 1;
    this.camera = { x: 0, y: 0 };
    this.clock = 0;
    this.particles = [];
    this.texts = [];
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.gatherNode = null;
    this.gatherCd = 0;
    this.interactHeld = false;
    this.target = null;
    this.started = false;
    this.saveTimer = 0;
    this.questTimer = 0;
    this.sleepFade = 0;
    this.grassPattern = null;
    this.last = performance.now();
    this.isTouch = this.detectTouch();
    this.joystickPointer = null;
    if (this.isTouch) document.body.classList.add('touch-mode');

    const saved = this.loadRaw();
    this.state = this.normalize(saved);
    this.world = new World(this.state);
    this.player = new Player(this.state.player.x, this.state.player.y);
    this.player.x = clamp(this.player.x, 60, this.world.w - 60);
    this.player.y = clamp(this.player.y, 90, this.world.h - 60);
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.wasNight = this.isNight();

    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d');

    this.resize();

    this.ui = new UI(this);
    this.ui.showStart();

    this.bindInput();
    this.setupTouch();
    requestAnimationFrame((ts) => this.loop(ts));

    window.addEventListener('beforeunload', () => this.save());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save();
    });
  }

  /* ---------------- persistence ---------------- */

  loadRaw() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || !data.seed) return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  hasSave() {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch (err) {
      return false;
    }
  }

  freshState(seed) {
    return {
      v: 1,
      seed: seed || Math.floor(Math.random() * 1000000000) + 1,
      day: 1,
      time: 8,
      coins: 15,
      energy: 100,
      maxEnergy: 100,
      inv: {},
      tools: { axe: false, pickaxe: false, hoe: false },
      upgrades: { campfire: false, backpack: false, torch: false, boots: false },
      stats: { gathered: {}, earned: 0, harvested: 0, crafted: 0 },
      claimed: [],
      player: { x: 1300, y: 1050 },
      nodes: [],
      plots: [],
    };
  }

  normalize(saved) {
    const base = this.freshState(saved && saved.seed);
    if (!saved || typeof saved !== 'object') return base;
    const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    const s = saved;
    return {
      ...base,
      ...s,
      seed: s.seed || base.seed,
      day: Math.max(1, Math.floor(num(s.day, 1))),
      time: clamp(num(s.time, 8), 0, 23.999),
      coins: Math.max(0, Math.floor(num(s.coins, 0))),
      maxEnergy: Math.max(50, num(s.maxEnergy, 100)),
      energy: clamp(num(s.energy, base.energy), 0, Math.max(50, num(s.maxEnergy, 100))),
      inv: s.inv && typeof s.inv === 'object' ? { ...s.inv } : {},
      tools: { ...base.tools, ...(s.tools || {}) },
      upgrades: { ...base.upgrades, ...(s.upgrades || {}) },
      stats: {
        ...base.stats,
        ...(s.stats || {}),
        gathered: s.stats && s.stats.gathered ? { ...s.stats.gathered } : {},
      },
      claimed: Array.isArray(s.claimed) ? s.claimed.slice() : [],
      player: { ...base.player, ...(s.player || {}) },
      nodes: Array.isArray(s.nodes) ? s.nodes : [],
      plots: Array.isArray(s.plots) ? s.plots : [],
    };
  }

  save() {
    if (!this.state) return;
    this.state.player = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
    this.state.nodes = this.world.serializeNodes();
    this.state.plots = this.world.serializePlots();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch (err) {
      /* storage may be full or blocked — the game still runs */
    }
  }

  /* ---------------- lifecycle ---------------- */

  begin() {
    const first = !this.started;
    this.started = true;
    this.last = performance.now();
    Sound.ensure();
    this.ui.hideStart();
    this.save();
    if (first) {
      this.ui.toast(
        this.isTouch
          ? 'Hold 🌿 near a tree, rock, or bush to gather.'
          : 'Hold E near a tree, rock, or bush to gather.',
        'good'
      );
    }
  }

  newGame() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (err) {
      /* ignore */
    }
    this.state = this.freshState();
    this.world = new World(this.state);
    this.player = new Player(this.world.homestead.x, this.world.homestead.y + 40);
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.particles.length = 0;
    this.texts.length = 0;
    this.gatherNode = null;
    this.interactHeld = false;
    this.target = null;
    this.started = false;
    this.wasNight = this.isNight();
    this.ui.closePanel();
    this.ui.invSig = '';
    this.ui.objSig = '';
    this.ui.updateInv();
    this.ui.updateObjectives();
    this.save();
  }

  /* ---------------- input ---------------- */

  detectTouch() {
    try {
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const noHover = window.matchMedia && window.matchMedia('(hover: none)').matches;
      return !!(coarse || (noHover && navigator.maxTouchPoints > 0));
    } catch (err) {
      return 'ontouchstart' in window;
    }
  }

  bindInput() {
    const movement = {
      w: 'up',
      arrowup: 'up',
      s: 'down',
      arrowdown: 'down',
      a: 'left',
      arrowleft: 'left',
      d: 'right',
      arrowright: 'right',
    };

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      const tag = (e.target && e.target.tagName) || '';
      const interactive = tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
      if (!interactive && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();

      if (movement[k]) {
        this.keys[movement[k]] = true;
        return;
      }
      if (k === 'shift') {
        this.keys.sprint = true;
        return;
      }
      if (e.repeat) return;

      switch (k) {
        case 'e':
        case ' ':
          this.interactHeld = true;
          this.tryInteract();
          break;
        case 'f':
          this.eat();
          break;
        case 'c':
          Sound.click();
          this.ui.togglePanel('craft');
          break;
        case 'i':
          e.preventDefault();
          Sound.click();
          this.ui.togglePanel('bag');
          break;
        case 'tab':
          if (!this.ui.current) {
            e.preventDefault();
            Sound.click();
            this.ui.togglePanel('bag');
          }
          break;
        case 'h':
          Sound.click();
          this.ui.togglePanel('help');
          break;
        case 'm':
          this.toggleMute();
          break;
        case 'escape':
          this.ui.handleEscape();
          break;
        default:
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (movement[k]) {
        this.keys[movement[k]] = false;
        return;
      }
      if (k === 'shift') {
        this.keys.sprint = false;
        return;
      }
      if (k === 'e' || k === ' ') {
        this.interactHeld = false;
        this.gatherNode = null;
      }
    });

    window.addEventListener('blur', () => {
      this.keys = {};
      this.interactHeld = false;
      this.gatherNode = null;
      if (this.resetTouchMove) this.resetTouchMove();
    });

    this.canvas.addEventListener('pointerdown', () => Sound.ensure());
  }

  setupTouch() {
    const controls = document.getElementById('touchControls');
    const stick = document.getElementById('joystick');
    const knob = document.getElementById('joystickKnob');
    const gatherBtn = document.getElementById('touchGather');
    const eatBtn = document.getElementById('touchEat');
    if (!controls || !stick || !knob || !gatherBtn || !eatBtn) return;
    if (this.isTouch) controls.classList.remove('hidden');

    const radius = 38;
    const dead = 9;
    let center = { x: 0, y: 0 };

    const setAxis = (dx, dy) => {
      this.keys.left = dx < -dead;
      this.keys.right = dx > dead;
      this.keys.up = dy < -dead;
      this.keys.down = dy > dead;
    };
    const setKnob = (dx, dy) => {
      knob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    };

    const apply = (e) => {
      if (e.pointerId !== this.joystickPointer) return;
      let dx = e.clientX - center.x;
      let dy = e.clientY - center.y;
      const len = Math.hypot(dx, dy);
      if (len > radius) {
        dx = (dx / len) * radius;
        dy = (dy / len) * radius;
      }
      setKnob(dx, dy);
      setAxis(dx, dy);
    };

    const release = (e) => {
      if (e.pointerId !== this.joystickPointer) return;
      this.joystickPointer = null;
      setKnob(0, 0);
      setAxis(0, 0);
    };

    this.resetTouchMove = () => {
      this.joystickPointer = null;
      setKnob(0, 0);
      setAxis(0, 0);
    };

    stick.addEventListener('pointerdown', (e) => {
      if (this.joystickPointer !== null) return;
      e.preventDefault();
      Sound.ensure();
      this.joystickPointer = e.pointerId;
      try {
        stick.setPointerCapture(e.pointerId);
      } catch (err) {
        /* older browsers */
      }
      const r = stick.getBoundingClientRect();
      center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      apply(e);
    });
    stick.addEventListener('pointermove', apply);
    stick.addEventListener('pointerup', release);
    stick.addEventListener('pointercancel', release);
    stick.addEventListener('lostpointercapture', release);

    const stopGather = () => {
      this.interactHeld = false;
      this.gatherNode = null;
    };

    gatherBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Sound.ensure();
      try {
        gatherBtn.setPointerCapture(e.pointerId);
      } catch (err) {
        /* older browsers */
      }
      this.interactHeld = true;
      this.tryInteract();
    });
    gatherBtn.addEventListener('pointerup', stopGather);
    gatherBtn.addEventListener('pointercancel', stopGather);
    gatherBtn.addEventListener('lostpointercapture', stopGather);

    eatBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Sound.ensure();
      this.eat();
    });

    for (const el of [stick, gatherBtn, eatBtn]) {
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  /* ---------------- geometry helpers ---------------- */

  worldToScreen(x, y) {
    return {
      x: x - this.camera.x + this.vw / 2 + this.shakeX,
      y: y - this.camera.y + this.vh / 2 + this.shakeY,
    };
  }

  capacity() {
    return BASE_CAPACITY + (this.state.upgrades.backpack ? BACKPACK_BONUS : 0);
  }

  itemTotal() {
    return Object.values(this.state.inv).reduce((sum, n) => sum + n, 0);
  }

  /* ---------------- inventory ---------------- */

  addItem(id, amount) {
    if (!ITEMS[id] || amount <= 0) return 0;
    const space = Math.max(0, this.capacity() - this.itemTotal());
    const add = Math.min(amount, space);
    if (add <= 0) {
      this.ui.toast('Your bag is full — sell or cook something.', 'warn');
      return 0;
    }
    if (add < amount) {
      this.ui.toast('Bag full — some items were left behind.', 'warn');
    }
    this.state.inv[id] = (this.state.inv[id] || 0) + add;
    return add;
  }

  removeItem(id, amount) {
    const have = this.state.inv[id] || 0;
    const take = Math.min(have, amount);
    if (take <= 0) return 0;
    if (have - take <= 0) delete this.state.inv[id];
    else this.state.inv[id] = have - take;
    return take;
  }

  eat(preferred) {
    if (!this.started) return;
    const s = this.state;
    let id = preferred;

    if (!id || !ITEMS[id] || !ITEMS[id].food || !(s.inv[id] > 0)) {
      const order = ['stew', 'jam', 'berry', 'mushroom'];
      id = order.find((itemId) => (s.inv[itemId] || 0) > 0);
    }

    if (!id) {
      Sound.error();
      this.ui.toast('No food in your bag — try a berry bush.', 'warn');
      return;
    }
    if (s.energy >= s.maxEnergy - 0.5) {
      this.ui.toast("You're already full of energy.");
      return;
    }

    const item = ITEMS[id];
    this.removeItem(id, 1);
    s.energy = Math.min(s.maxEnergy, s.energy + item.food);
    this.addText(this.player.x, this.player.y - 62, `+${item.food} energy`, '#a8e6a1');
    this.spawnSparkle(this.player.x, this.player.y - 30, 4);
    Sound.eat();
  }

  /* ---------------- economy ---------------- */

  craft(id) {
    if (this.ui.current && this.ui.current !== 'craft') return;
    const recipe = RECIPES.find((r) => r.id === id);
    if (!recipe) return;
    const s = this.state;

    if (recipe.once && s.upgrades[recipe.once]) return;
    if (recipe.needs && !s.upgrades[recipe.needs]) {
      Sound.error();
      this.ui.toast('You need a campfire for that.', 'warn');
      return;
    }
    for (const [item, n] of Object.entries(recipe.cost)) {
      if ((s.inv[item] || 0) < n) {
        Sound.error();
        this.ui.toast('Not enough materials yet.', 'warn');
        return;
      }
    }
    if (recipe.consumable && this.itemTotal() >= this.capacity()) {
      Sound.error();
      this.ui.toast('Your bag is full.', 'warn');
      return;
    }

    for (const [item, n] of Object.entries(recipe.cost)) this.removeItem(item, n);
    Sound.craft();
    s.stats.crafted = (s.stats.crafted || 0) + 1;

    if (recipe.once) {
      s.upgrades[recipe.once] = true;
      if (recipe.id === 'campfire') {
        this.spawnSparkle(this.world.campfirePos.x, this.world.campfirePos.y - 20, 20);
        this.ui.toast('Campfire built! Warmth, light, and cooking unlocked.', 'good');
      } else if (recipe.id === 'backpack') {
        this.ui.toast('Backpack woven. You can carry 20 more items.', 'good');
      } else if (recipe.id === 'torch') {
        this.ui.toast('Torch lit. Night walks just got cozier.', 'good');
      } else if (recipe.id === 'boots') {
        this.ui.toast('Trail boots laced. You move 15% faster.', 'good');
      }
    } else {
      this.addItem(recipe.id, 1);
      this.ui.toast(`${recipe.name} added to your bag.`, 'good');
    }

    this.questCheck();
  }

  buy(id) {
    const item = SHOP_ITEMS.find((x) => x.id === id);
    if (!item) return;
    const s = this.state;

    if (item.kind === 'tool' && s.tools[item.id]) {
      this.ui.toast('You already own that.');
      return;
    }
    if (s.coins < item.price) {
      Sound.error();
      this.ui.toast('Not enough coins yet.', 'warn');
      return;
    }
    if (item.kind === 'item' && this.itemTotal() >= this.capacity()) {
      Sound.error();
      this.ui.toast('Your bag is full.', 'warn');
      return;
    }

    s.coins -= item.price;
    if (item.kind === 'tool') {
      s.tools[item.id] = true;
      s.stats.crafted = (s.stats.crafted || 0) + 1;
      this.ui.toast(`${item.name} acquired.`, 'good');
    } else {
      this.addItem(item.id, 1);
      this.ui.toast(`${item.name} purchased.`, 'good');
    }
    Sound.coin();
    this.questCheck();
  }

  sell(id) {
    const count = this.state.inv[id] || 0;
    if (!count || !ITEMS[id]) return;
    const item = ITEMS[id];
    const total = count * item.sell;
    this.removeItem(id, count);
    this.state.coins += total;
    this.state.stats.earned += total;
    Sound.coin();
    this.ui.toast(`Sold ${count} × ${item.name} for ${total}🪙.`, 'good');
    this.questCheck();
  }

  toggleMute() {
    Sound.muted = !Sound.muted;
    if (!Sound.muted) {
      Sound.ensure();
      Sound.click();
    }
    this.ui.updateMuteIcon();
    if (this.ui.current === 'pause') this.ui.renderPanel();
    this.save();
  }

  /* ---------------- quests ---------------- */

  questCheck() {
    const s = this.state;
    for (const quest of QUESTS) {
      if (s.claimed.includes(quest.id)) continue;
      if (!quest.check(s)) continue;
      s.claimed.push(quest.id);
      s.coins += quest.reward;
      s.stats.earned += quest.reward;
      Sound.coin();
      this.ui.toast(`Goal complete: ${quest.title} · +${quest.reward}🪙`, 'good');
    }
  }

  /* ---------------- interactions ---------------- */

  findTarget() {
    const px = this.player.x;
    const py = this.player.y;
    let best = null;
    let bestD = Infinity;

    const consider = (kind, x, y, range, ref) => {
      const d = dist(px, py, x, y);
      if (d <= range && d < bestD) {
        best = { kind, x, y, d, ref };
        bestD = d;
      }
    };

    for (const n of this.world.nodes) {
      if (!n.alive) continue;
      const conf = NODE_TYPES[n.type];
      if (!conf) continue;
      consider('node', n.x, n.y - 6, conf.range, n);
    }
    for (const p of this.world.plots) consider('plot', p.x, p.y, 66, p);
    consider('tent', this.world.tentPos.x, this.world.tentPos.y, 80);
    consider('stall', this.world.stallPos.x, this.world.stallPos.y, 88);

    return best;
  }

  targetInfo() {
    const t = this.target;
    if (!t) return null;

    if (t.kind === 'node') {
      const conf = NODE_TYPES[t.ref.type];
      if (conf.requires && !this.state.tools[conf.requires]) {
        return { text: `${conf.name} — needs a ${conf.requires}`, muted: true };
      }
      return { text: `${conf.action} ${conf.name}` };
    }

    if (t.kind === 'plot') {
      const p = t.ref;
      if (p.state === 'grass') {
        if (!this.state.tools.hoe) return { text: 'Garden plot — needs a hoe', muted: true };
        return { text: 'Till the garden plot' };
      }
      if (p.state === 'tilled') {
        if ((this.state.inv.seed || 0) > 0) return { text: 'Plant berry seeds' };
        return { text: 'Tilled soil — seeds are at the stall', muted: true };
      }
      if (p.state === 'growing') {
        return { text: `Berries growing… ${Math.round(p.growth * 100)}%`, muted: true };
      }
      return { text: 'Harvest ripe berries' };
    }

    if (t.kind === 'tent') return { text: 'Sleep until morning' };
    if (t.kind === 'stall') return { text: 'Trade with the trader' };
    return null;
  }

  tryInteract() {
    if (!this.started || this.ui.current) return;
    const t = this.findTarget();
    this.target = t;
    if (!t) return;

    if (t.kind === 'node') {
      this.gatherNode = t.ref;
      this.gatherCd = 0;
      return;
    }
    if (t.kind === 'plot') {
      this.usePlot(t.ref);
      return;
    }
    if (t.kind === 'tent') {
      this.sleep();
      return;
    }
    if (t.kind === 'stall') {
      Sound.click();
      this.ui.openPanel('shop');
    }
  }

  usePlot(p) {
    const s = this.state;

    if (p.state === 'grass') {
      if (!s.tools.hoe) {
        Sound.error();
        this.ui.toast('You need a hoe to till the garden. The trader sells one.', 'warn');
        return;
      }
      p.state = 'tilled';
      p.growth = 0;
      this.player.swing('hoe');
      Sound.rustle();
      this.spawnBurst(p.x, p.y - 4, ['#8b6a45', '#a57c50', '#6e5136'], 10);
      this.ui.toast('Plot tilled. Plant some berry seeds.');
      this.questCheck();
      return;
    }

    if (p.state === 'tilled') {
      if ((s.inv.seed || 0) <= 0) {
        Sound.error();
        this.ui.toast('No seeds — buy berry seeds from the trader.', 'warn');
        return;
      }
      this.removeItem('seed', 1);
      p.state = 'growing';
      p.growth = 0;
      this.player.swing('hoe');
      Sound.rustle();
      this.spawnSparkle(p.x, p.y - 8, 6);
      this.ui.toast('Planted! Berries in about 45 seconds.');
      return;
    }

    if (p.state === 'growing') {
      this.ui.toast(`Still growing — ${Math.round(p.growth * 100)}%.`);
      return;
    }

    if (p.state === 'ripe') {
      const amount = 2 + Math.floor(Math.random() * 3);
      const added = this.addItem('berry', amount);
      if (added > 0) {
        s.stats.gathered.berry = (s.stats.gathered.berry || 0) + added;
        this.addText(p.x, p.y - 34, `+${added} Berries`, '#ffe9ab');
      }
      if (Math.random() < 0.5) this.addItem('seed', 1);
      s.stats.harvested = (s.stats.harvested || 0) + 1;
      p.state = 'tilled';
      p.growth = 0;
      Sound.collect();
      this.spawnBurst(p.x, p.y - 12, ['#e0567a', '#4c8a46', '#ffd166'], 12);
      this.questCheck();
    }
  }

  sleep() {
    const s = this.state;
    s.day += 1;
    s.time = 6;
    s.energy = s.maxEnergy;
    this.sleepFade = 1.5;
    Sound.sleep();
    this.ui.toast(`Day ${s.day}. You feel rested and ready.`, 'good');
    this.spawnSparkle(this.player.x, this.player.y - 30, 10);
    this.save();
  }

  /* ---------------- gathering ---------------- */

  toolFor(node) {
    const conf = NODE_TYPES[node.type];
    if (conf.tool && this.state.tools[conf.tool]) return conf.tool;
    return 'hand';
  }

  updateGather(dt) {
    const node = this.gatherNode;
    if (!this.interactHeld || !node || !node.alive || this.ui.current) {
      this.gatherNode = null;
      return;
    }
    const conf = NODE_TYPES[node.type];
    if (!conf) {
      this.gatherNode = null;
      return;
    }
    if (dist(this.player.x, this.player.y, node.x, node.y) > conf.range + 8) {
      this.gatherNode = null;
      return;
    }

    this.gatherCd -= dt;
    if (this.gatherCd <= 0) {
      this.gatherCd = this.state.tools[conf.tool] ? 0.3 : 0.4;
      this.swingNode(node);
    }
  }

  swingNode(node) {
    const conf = NODE_TYPES[node.type];
    if (conf.requires && !this.state.tools[conf.requires]) {
      Sound.error();
      this.ui.toast(`You need a ${conf.requires} for that.`, 'warn');
      this.gatherNode = null;
      return;
    }
    if (this.state.energy < conf.energy) {
      Sound.error();
      this.ui.toast('Too tired — eat (F) or sleep in the tent.', 'warn');
      this.gatherNode = null;
      return;
    }

    this.state.energy -= conf.energy;
    const hasTool = !!(conf.tool && this.state.tools[conf.tool]);
    node.hp -= hasTool ? 2 : 1;
    node.shake = conf.shake;
    this.player.swing(this.toolFor(node));

    if (conf.sound === 'chop') Sound.chop();
    else if (conf.sound === 'mine') Sound.mine();
    else Sound.rustle();

    this.spawnBurst(node.x, node.y - 20, conf.particles, 6);
    if (conf.shake >= 5) this.shake = Math.max(this.shake, 2.2);

    if (node.hp <= 0) this.harvestNode(node, conf);
  }

  harvestNode(node, conf) {
    node.alive = false;
    node.hp = 0;
    node.respawn = conf.respawn;
    this.gatherNode = null;
    Sound.collect();

    for (const [id, min, max, chance] of conf.yields) {
      if (chance !== undefined && Math.random() > chance) continue;
      const amount = min + Math.floor(Math.random() * (max - min + 1));
      if (amount <= 0) continue;
      const added = this.addItem(id, amount);
      if (added > 0) {
        this.state.stats.gathered[id] = (this.state.stats.gathered[id] || 0) + added;
        this.addText(node.x, node.y - 38, `+${added} ${ITEMS[id].name}`, '#ffe9ab');
      }
    }

    this.spawnBurst(node.x, node.y - 14, conf.particles, 14);
    this.spawnSparkle(node.x, node.y - 24, 5);
    this.questCheck();
  }

  /* ---------------- time & energy ---------------- */

  isNight() {
    const h = this.state.time;
    return h >= 20 || h < 5;
  }

  timeIcon() {
    const h = this.state.time;
    if (h >= 6 && h < 18) return '☀️';
    if (h >= 18 && h < 20) return '🌇';
    if (h >= 5 && h < 6) return '🌅';
    return '🌙';
  }

  darknessFor(hour) {
    if (hour >= 21 || hour < 4.5) return 0.62;
    if (hour >= 19) return 0.62 * smoothstep((hour - 19) / 2);
    if (hour < 6.5) return 0.62 * (1 - smoothstep((hour - 4.5) / 2));
    return 0;
  }

  advanceTime(dt) {
    const s = this.state;
    s.time += dt * (24 / DAY_LENGTH);
    if (s.time >= 24) {
      s.time -= 24;
      s.day += 1;
      this.ui.toast(`Day ${s.day} on the homestead.`, 'good');
      this.save();
    }

    const night = this.isNight();
    if (night !== this.wasNight) {
      this.wasNight = night;
      if (night) {
        Sound.nightfall();
        this.ui.toast('Night falls. A torch or the campfire helps.', 'warn');
      } else {
        this.ui.toast('Morning light returns.', 'good');
      }
    }
  }

  /* ---------------- particles & text ---------------- */

  spawnBurst(x, y, colors, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = 40 + Math.random() * 120;
      const life = 0.5 + Math.random() * 0.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life,
        maxLife: life,
        size: 2 + Math.random() * 2.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: 240,
        rot: Math.random() * TAU,
        spin: (Math.random() - 0.5) * 12,
        shape: Math.random() < 0.5 ? 'square' : 'circle',
      });
    }
  }

  spawnSparkle(x, y, count) {
    for (let i = 0; i < count; i++) {
      const life = 0.55 + Math.random() * 0.4;
      this.particles.push({
        x: x + (Math.random() * 30 - 15),
        y: y + (Math.random() * 20 - 10),
        vx: (Math.random() - 0.5) * 20,
        vy: -20 - Math.random() * 30,
        life,
        maxLife: life,
        size: 1.4 + Math.random() * 1.8,
        color: Math.random() < 0.5 ? '#ffe9ab' : '#fff6d8',
        gravity: -12,
        rot: 0,
        spin: 0,
        shape: 'spark',
      });
    }
  }

  spawnEmber(x, y) {
    const life = 0.7 + Math.random() * 0.6;
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 14,
      vy: -26 - Math.random() * 30,
      life,
      maxLife: life,
      size: 1.4 + Math.random() * 1.4,
      color: Math.random() < 0.5 ? '#ffb03a' : '#ffe7a3',
      gravity: -8,
      rot: 0,
      spin: 0,
      shape: 'spark',
    });
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      p.vx *= 0.99;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  addText(x, y, text, color) {
    this.texts.push({ x, y, text, color: color || '#ffe9ab', life: 1.2, maxLife: 1.2 });
  }

  updateTexts(dt) {
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= dt * 30;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  /* ---------------- camera ---------------- */

  updateCamera(dt) {
    const k = 1 - Math.exp(-dt * 6.5);
    this.camera.x = lerp(this.camera.x, this.player.x, k);
    this.camera.y = lerp(this.camera.y, this.player.y, k);

    if (this.world.w > this.vw) this.camera.x = clamp(this.camera.x, this.vw / 2, this.world.w - this.vw / 2);
    else this.camera.x = this.world.w / 2;
    if (this.world.h > this.vh) this.camera.y = clamp(this.camera.y, this.vh / 2, this.world.h - this.vh / 2);
    else this.camera.y = this.world.h / 2;
  }

  /* ---------------- main loop ---------------- */

  loop(ts) {
    const dt = Math.min(0.05, Math.max(0, (ts - this.last) / 1000));
    this.last = ts;
    this.update(dt);
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    this.clock += dt;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 18);
      this.shakeX = (Math.random() * 2 - 1) * this.shake;
      this.shakeY = (Math.random() * 2 - 1) * this.shake;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
    if (this.sleepFade > 0) this.sleepFade = Math.max(0, this.sleepFade - dt * 1.15);

    const paused = !this.started || !!this.ui.current;

    if (!paused) {
      this.advanceTime(dt);
      this.player.update(dt, this);
      this.world.update(dt, this);
      this.updateGather(dt);
      this.updateParticles(dt);
      this.updateTexts(dt);

      const s = this.state;
      const nearFire =
        s.upgrades.campfire &&
        dist(this.player.x, this.player.y, this.world.campfirePos.x, this.world.campfirePos.y) < 170;
      if (!this.gatherNode) {
        s.energy = Math.min(s.maxEnergy, s.energy + (nearFire ? 8 : 1.6) * dt);
      }

      this.questTimer += dt;
      if (this.questTimer > 0.7) {
        this.questTimer = 0;
        this.questCheck();
      }

      this.saveTimer += dt;
      if (this.saveTimer > 8) {
        this.saveTimer = 0;
        this.save();
      }
    }

    this.target = this.findTarget();
    this.updateCamera(dt);
    this.ui.update(dt);
  }

  /* ---------------- rendering ---------------- */

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.canvas.width = Math.floor(this.vw * this.dpr);
    this.canvas.height = Math.floor(this.vh * this.dpr);
    this.canvas.style.width = `${this.vw}px`;
    this.canvas.style.height = `${this.vh}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!this.grassPattern) this.makeGrassPattern();
  }

  makeGrassPattern() {
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#7cb263';
    g.fillRect(0, 0, 160, 160);

    const rng = makeRng(4242);
    for (let i = 0; i < 520; i++) {
      const x = rng.range(0, 160);
      const y = rng.range(0, 160);
      g.fillStyle = rng.chance(0.5) ? 'rgba(104, 155, 88, 0.55)' : 'rgba(143, 190, 112, 0.42)';
      g.fillRect(x, y, rng.range(1, 3.2), rng.range(1, 2.2));
    }
    g.strokeStyle = 'rgba(72, 124, 68, 0.36)';
    g.lineWidth = 1.2;
    for (let i = 0; i < 30; i++) {
      const x = rng.range(0, 160);
      const y = rng.range(0, 160);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 2, y - 4, x + rng.range(-2.5, 2.5), y - 7);
      g.stroke();
    }
    this.grassPattern = this.ctx.createPattern(c, 'repeat');
  }

  render() {
    const ctx = this.ctx;
    const vw = this.vw;
    const vh = this.vh;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.fillStyle = '#1a2a20';
    ctx.fillRect(0, 0, vw, vh);

    const ox = Math.round(vw / 2 - this.camera.x + this.shakeX);
    const oy = Math.round(vh / 2 - this.camera.y + this.shakeY);

    ctx.save();
    ctx.translate(ox, oy);

    this.world.drawBackground(ctx, this);
    this.world.drawDecor(ctx, this.clock);
    this.world.drawPlots(ctx, this.clock);

    const pad = 140;
    const left = this.camera.x - vw / 2 - pad;
    const right = this.camera.x + vw / 2 + pad;
    const top = this.camera.y - vh / 2 - pad;
    const bottom = this.camera.y + vh / 2 + pad;

    const drawables = [];
    for (const n of this.world.nodes) {
      if (n.x < left || n.x > right || n.y < top || n.y > bottom) continue;
      drawables.push({ y: n.y, f: () => this.world.drawNode(ctx, n, this.clock) });
    }

    const tent = this.world.tentPos;
    const stall = this.world.stallPos;
    const fire = this.world.campfirePos;

    if (tent.x > left && tent.x < right && tent.y > top && tent.y < bottom) {
      drawables.push({ y: tent.y, f: () => this.world.drawTent(ctx, this.clock) });
    }
    if (stall.x > left && stall.x < right && stall.y > top && stall.y < bottom) {
      drawables.push({ y: stall.y, f: () => this.world.drawStall(ctx, this.clock) });
    }
    drawables.push({
      y: fire.y,
      f: () => this.world.drawCampfire(ctx, this.clock, this.state.upgrades.campfire),
    });
    drawables.push({ y: this.player.y, f: () => this.player.draw(ctx, this) });

    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.f();

    this.drawTargetRing(ctx);
    this.world.drawAmbient(ctx, this.clock, this.isNight());
    this.drawParticles(ctx);
    this.drawTexts(ctx);

    ctx.restore();

    const night = this.isNight();
    this.renderLighting(night);
    this.renderDuskTint();
    this.renderFade();
  }

  drawTargetRing(ctx) {
    const t = this.target;
    if (!t) return;
    let x;
    let y;
    let rx;
    if (t.kind === 'node') {
      x = t.ref.x;
      y = t.ref.y;
      rx = 32;
    } else if (t.kind === 'plot') {
      x = t.ref.x;
      y = t.ref.y;
      rx = 36;
    } else {
      return;
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 246, 216, 0.45)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.ellipse(x, y - 2, rx, rx * 0.42, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    if (this.gatherNode && this.gatherNode === t.ref && t.kind === 'node') {
      const conf = NODE_TYPES[t.ref.type];
      const progress = clamp(1 - t.ref.hp / conf.hp, 0, 1);
      ctx.strokeStyle = '#ffcf6b';
      ctx.lineWidth = 3.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(x, y - 2, rx, rx * 0.42, 0, -Math.PI / 2, -Math.PI / 2 + progress * TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      if (p.shape === 'spark') {
        ctx.globalAlpha = alpha * 0.18;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3.2, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      } else if (p.shape === 'square') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 13px "Segoe UI", ui-sans-serif, sans-serif';
    for (const t of this.texts) {
      ctx.globalAlpha = clamp(t.life / 0.45, 0, 1);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(20, 32, 22, 0.6)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  renderLighting(night) {
    const dark = this.darknessFor(this.state.time);
    if (dark <= 0.015) return;

    const ctx = this.ctx;
    const vw = this.vw;
    const vh = this.vh;
    const lc = this.lightCanvas;
    const W = Math.max(1, Math.floor(vw * this.dpr));
    const H = Math.max(1, Math.floor(vh * this.dpr));
    if (lc.width !== W || lc.height !== H) {
      lc.width = W;
      lc.height = H;
    }

    const g = this.lightCtx;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, vw, vh);
    g.fillStyle = `rgba(8, 14, 38, ${dark})`;
    g.fillRect(0, 0, vw, vh);
    g.globalCompositeOperation = 'destination-out';

    const addLight = (x, y, radius, strength) => {
      const p = this.worldToScreen(x, y);
      const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      grad.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
      grad.addColorStop(0.55, `rgba(0, 0, 0, ${strength * 0.6})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(p.x, p.y, radius, 0, TAU);
      g.fill();
    };

    if (this.state.upgrades.campfire) {
      const flick = Math.sin(this.clock * 7) * 6;
      addLight(this.world.campfirePos.x, this.world.campfirePos.y - 12, 320 + flick, 1);
    }
    if (this.state.upgrades.torch) {
      addLight(this.player.x, this.player.y - 20, 225, 0.88);
    } else {
      addLight(this.player.x, this.player.y - 20, 120, 0.42);
    }

    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(lc, 0, 0, vw, vh);

    // Warm pools of light on top of the darkness.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const warm = (x, y, radius, alpha) => {
      const p = this.worldToScreen(x, y);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      grad.addColorStop(0, `rgba(255, 168, 76, ${alpha})`);
      grad.addColorStop(1, 'rgba(255, 168, 76, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, TAU);
      ctx.fill();
    };
    if (this.state.upgrades.campfire) {
      warm(this.world.campfirePos.x, this.world.campfirePos.y - 14, 250, 0.1);
    }
    if (this.state.upgrades.torch) {
      warm(this.player.x, this.player.y - 20, 180, 0.06);
    }
    ctx.restore();

    if (night) {
      ctx.fillStyle = 'rgba(80, 110, 200, 0.04)';
      ctx.fillRect(0, 0, vw, vh);
    }
  }

  renderDuskTint() {
    const h = this.state.time;
    let tint = 0;
    if (h > 17 && h < 21) tint = 1 - Math.abs(h - 19) / 2;
    else if (h >= 5 && h < 7.5) tint = 1 - Math.abs(h - 6.2) / 1.3;
    if (tint <= 0.02) return;
    this.ctx.fillStyle = `rgba(255, 126, 64, ${0.075 * tint})`;
    this.ctx.fillRect(0, 0, this.vw, this.vh);
  }

  renderFade() {
    if (this.sleepFade <= 0.001) return;
    this.ctx.fillStyle = `rgba(6, 10, 8, ${clamp(this.sleepFade, 0, 1)})`;
    this.ctx.fillRect(0, 0, this.vw, this.vh);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.foragee = new Game();
});

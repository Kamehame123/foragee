'use strict';

const SAVE_KEY = 'foragee-save-v1';
const DAY_LENGTH = 360; // real seconds for a full in-game day
const BASE_CAPACITY = 40;
const BACKPACK_BONUS = 20;
const BASKET_BONUS = 15;

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
    this.restoreIsland();

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
      tools: {
        axe: false,
        pickaxe: false,
        hoe: false,
        fishingRod: false,
        wateringCan: false,
        steelAxe: false,
        steelPick: false,
      },
      upgrades: {
        campfire: false,
        hearth: false,
        backpack: false,
        basket: false,
        torch: false,
        lantern: false,
        boots: false,
        well: false,
        coop: false,
        apiary: false,
      },
      weather: 'clear',
      weatherTimer: 120,
      islands: { unlocked: ['home'], current: 'home', maps: {} },
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
      weather: WEATHERS[s.weather] ? s.weather : 'clear',
      weatherTimer: Math.max(20, num(s.weatherTimer, 120)),
      islands: (() => {
        const src = s.islands && typeof s.islands === 'object' ? s.islands : {};
        const unlocked = Array.isArray(src.unlocked) ? src.unlocked.filter((id) => ISLANDS[id]) : [];
        if (!unlocked.includes('home')) unlocked.unshift('home');
        const current = ISLANDS[src.current] && unlocked.includes(src.current) ? src.current : 'home';
        const maps = src.maps && typeof src.maps === 'object' ? { ...src.maps } : {};
        return { unlocked, current, maps };
      })(),
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
    const s = this.state;
    if (this.world && this.world.island) {
      const id = this.world.islandId;
      s.islands.maps[id] = { nodes: this.world.serializeNodes(), savedAt: Date.now() };
    } else if (this.world) {
      s.islands.current = 'home';
      s.homeSavedAt = Date.now();
      s.player = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
      s.nodes = this.world.serializeNodes();
      s.plots = this.world.serializePlots();
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch (err) {
      /* storage may be full or blocked — the game still runs */
    }
  }

  secondsSince(ts, cap = 600) {
    if (typeof ts !== 'number' || !Number.isFinite(ts)) return 0;
    return clamp((Date.now() - ts) / 1000, 0, cap);
  }

  restoreIsland() {
    const s = this.state;
    const cur = s.islands.current;
    if (!cur || cur === 'home') return;
    const conf = ISLANDS[cur];
    if (!conf || !s.islands.unlocked.includes(cur)) {
      s.islands.current = 'home';
      return;
    }
    const map = s.islands.maps[cur];
    this.world = new World({ seed: s.seed, nodes: map && map.nodes, away: this.secondsSince(map && map.savedAt) }, conf);
    this.player.x = this.world.boatPos.x;
    this.player.y = this.world.boatPos.y - 46;
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
  }

  buyIsland(id) {
    const conf = ISLANDS[id];
    const s = this.state;
    if (!conf || id === 'home' || s.islands.unlocked.includes(id)) return;
    if (s.coins < conf.cost) {
      Sound.error();
      this.ui.toast('Not enough coins for that charter yet.', 'warn');
      return;
    }
    s.coins -= conf.cost;
    s.islands.unlocked.push(id);
    Sound.coin();
    this.ui.toast(`Charted ${conf.name}! Sail there from the dock or any island boat.`, 'good');
    this.questCheck();
    this.save();
  }

  sailTo(id) {
    const conf = ISLANDS[id];
    const s = this.state;
    if (!conf) return;
    if (id !== 'home' && !s.islands.unlocked.includes(id)) {
      Sound.error();
      this.ui.toast('Buy that island charter first.', 'warn');
      return;
    }
    if (s.islands.current === id) {
      this.ui.closePanel();
      return;
    }

    this.save();

    if (id === 'home') {
      this.world = new World({
        seed: s.seed,
        nodes: s.nodes,
        plots: s.plots,
        away: this.secondsSince(s.homeSavedAt),
      });
      this.player.x = (this.world.dock.x1 + this.world.dock.x2) / 2;
      this.player.y = this.world.dock.y2 - 14;
    } else {
      const map = s.islands.maps[id];
      this.world = new World(
        { seed: s.seed, nodes: map && map.nodes, away: this.secondsSince(map && map.savedAt) },
        conf
      );
      this.player.x = this.world.boatPos.x;
      this.player.y = this.world.boatPos.y - 46;
    }

    s.islands.current = id;
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.gatherNode = null;
    this.target = null;
    this.ui.closePanel();
    this.save();
    Sound.splash();
    this.ui.toast(id === 'home' ? 'Home again. The homestead is just as you left it.' : `Welcome to ${conf.name}.`, 'good');
  }

  begin() {
    const first = !this.started;
    this.started = true;
    this.last = performance.now();
    Sound.ensure();
    Sound.startAmbience();
    Sound.setRain(this.isRaining() ? 1 : 0);
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
    return (
      BASE_CAPACITY +
      (this.state.upgrades.backpack ? BACKPACK_BONUS : 0) +
      (this.state.upgrades.basket ? BASKET_BONUS : 0)
    );
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
      const missing = s.maxEnergy - s.energy;
      const foods = Object.keys(ITEMS)
        .filter((itemId) => ITEMS[itemId].food && (s.inv[itemId] || 0) > 0)
        .sort((a, b) => ITEMS[a].food - ITEMS[b].food);
      // Prefer a snack that fills the gap without wasting a whole feast.
      id = foods.filter((itemId) => ITEMS[itemId].food <= missing).pop() || foods[0];
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
      const needNames = { campfire: 'a campfire', torch: 'a torch' };
      Sound.error();
      this.ui.toast(`You need ${needNames[recipe.needs] || recipe.needs} first.`, 'warn');
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
    if (recipe.group === 'cooking') s.stats.cooked = (s.stats.cooked || 0) + 1;

    if (recipe.once) {
      s.upgrades[recipe.once] = true;
      if (recipe.id === 'campfire') {
        if (this.world.campfirePos) this.spawnSparkle(this.world.campfirePos.x, this.world.campfirePos.y - 20, 20);
        this.ui.toast('Campfire built! Warmth, light, and cooking unlocked.', 'good');
      } else if (recipe.id === 'hearth') {
        if (this.world.campfirePos) this.spawnSparkle(this.world.campfirePos.x, this.world.campfirePos.y - 20, 26);
        this.ui.toast('Stone hearth built. A wider glow and faster rest.', 'good');
      } else if (recipe.id === 'backpack') {
        this.ui.toast('Backpack woven. You can carry 20 more items.', 'good');
      } else if (recipe.id === 'basket') {
        this.ui.toast('Gathering basket woven. You can carry 15 more items.', 'good');
      } else if (recipe.id === 'torch') {
        this.ui.toast('Torch lit. Night walks just got cozier.', 'good');
      } else if (recipe.id === 'lantern') {
        this.ui.toast('Crystal lantern glows softly. The dark feels smaller now.', 'good');
      } else if (recipe.id === 'boots') {
        this.ui.toast('Trail boots laced. You move 15% faster.', 'good');
      } else if (recipe.id === 'well') {
        if (this.world.wellPos) this.spawnSparkle(this.world.homestead.x - 120, this.world.homestead.y + 64, 22);
        this.ui.toast('Garden well dug. The plots stay watered and grow faster.', 'good');
      } else if (recipe.id === 'coop') {
        this.ui.toast('Chicken coop built. Fresh eggs every morning.', 'good');
      } else if (recipe.id === 'apiary') {
        this.ui.toast('Bee box set up. Honey every morning.', 'good');
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
    if (item.requires && !s.tools[item.requires]) {
      Sound.error();
      const need = TOOL_META[item.requires] ? TOOL_META[item.requires].name.toLowerCase() : item.requires;
      this.ui.toast(`You need a ${need} first.`, 'warn');
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
    Sound.setRain(this.isRaining() ? 1 : 0);
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
    if (!this.world.island) {
      for (const p of this.world.plots) consider('plot', p.x, p.y, 66, p);
      consider('tent', this.world.tentPos.x, this.world.tentPos.y, 80);
      consider('stall', this.world.stallPos.x, this.world.stallPos.y, 88);
    }
    if (this.world.travelPos) {
      consider('travel', this.world.travelPos.x, this.world.travelPos.y, 100);
    }

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
        const seeds = this.availableSeeds();
        if (seeds.length === 1) return { text: `Plant ${CROPS[seeds[0]].name.toLowerCase()}` };
        if (seeds.length > 1) return { text: 'Plant seeds' };
        return { text: 'Tilled soil — seeds are at the stall', muted: true };
      }
      const conf = CROPS[p.crop] || CROPS.berry;
      if (p.state === 'growing') {
        return { text: `${conf.name} growing… ${Math.round(p.growth * 100)}%`, muted: true };
      }
      return { text: `Harvest ${conf.name.toLowerCase()}` };
    }

    if (t.kind === 'travel') return { text: this.world.travelLabel || 'Sail to the islands' };
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
    if (t.kind === 'travel') {
      Sound.click();
      this.ui.openPanel('islands');
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
      this.openPlanting(p);
      return;
    }

    if (p.state === 'growing') {
      this.ui.toast(`Still growing — ${Math.round(p.growth * 100)}%.`);
      return;
    }

    if (p.state === 'ripe') {
      const conf = CROPS[p.crop] || CROPS.berry;
      const amount = conf.min + Math.floor(Math.random() * (conf.max - conf.min + 1));
      const added = this.addItem(conf.yield, amount);
      if (added > 0) {
        s.stats.gathered[conf.yield] = (s.stats.gathered[conf.yield] || 0) + added;
        if (conf.yield === 'pumpkin') s.stats.pumpkins = (s.stats.pumpkins || 0) + added;
        this.addText(p.x, p.y - 34, `+${added} ${conf.name}`, '#ffe9ab');
      }
      if (Math.random() < conf.seedChance) this.addItem(conf.seed, 1);
      s.stats.harvested = (s.stats.harvested || 0) + 1;
      p.state = 'tilled';
      p.growth = 0;
      Sound.collect();
      this.spawnBurst(p.x, p.y - 12, [conf.color, '#4c8a46', '#ffd166'], 12);
      this.questCheck();
    }
  }

  availableSeeds() {
    return Object.keys(CROPS).filter((id) => (this.state.inv[CROPS[id].seed] || 0) > 0);
  }

  openPlanting(p) {
    const crops = this.availableSeeds();
    if (!crops.length) {
      Sound.error();
      this.ui.toast('No seeds — the trader sells berry, pumpkin, carrot and corn seeds.', 'warn');
      return;
    }
    if (crops.length === 1) {
      this.plantCrop(p, crops[0]);
      return;
    }
    this.ui.openPlantMenu(p);
  }

  plantCrop(p, crop) {
    if (!p || p.state !== 'tilled') return;
    const conf = CROPS[crop];
    if (!conf) return;
    const s = this.state;
    if ((s.inv[conf.seed] || 0) <= 0) {
      Sound.error();
      this.ui.toast(`No ${conf.name.toLowerCase()} seeds left.`, 'warn');
      return;
    }
    this.removeItem(conf.seed, 1);
    p.state = 'growing';
    p.growth = 0;
    p.crop = crop;
    this.player.swing('hoe');
    Sound.rustle();
    this.spawnSparkle(p.x, p.y - 8, 6);
    this.ui.toast(`Planted ${conf.name.toLowerCase()}! Ready in about ${Math.round(this.cropGrowTime(crop))} seconds.`);
  }

  cropGrowTime(crop) {
    const base = CROPS[crop] ? CROPS[crop].grow : 45;
    const watered = this.state.tools.wateringCan ? 0.65 : 1;
    const well = this.state.upgrades.well ? 0.85 : 1;
    const rain = this.isRaining() ? 0.9 : 1;
    return base * watered * well * rain;
  }

  sleep() {
    const s = this.state;
    s.day += 1;
    s.time = 6;
    s.energy = s.maxEnergy;
    this.sleepFade = 1.5;
    Sound.sleep();
    this.ui.toast(`Day ${s.day}. You feel rested and ready.`, 'good');
    this.dailyHomestead();
    this.spawnSparkle(this.player.x, this.player.y - 30, 10);
    this.save();
  }

  dailyHomestead() {
    const s = this.state;
    const gains = [];
    if (s.upgrades.coop) {
      const eggs = Math.random() < 0.35 ? 2 : 1;
      const added = this.addItem('egg', eggs);
      if (added > 0) {
        s.stats.gathered.egg = (s.stats.gathered.egg || 0) + added;
        gains.push(`🥚 ${added}`);
      }
    }
    if (s.upgrades.apiary) {
      const added = this.addItem('honey', 1);
      if (added > 0) {
        s.stats.gathered.honey = (s.stats.gathered.honey || 0) + added;
        gains.push('🍯 1');
      }
    }
    if (gains.length) {
      this.ui.toast(`The homestead provides ${gains.join(' · ')}.`, 'good');
    }
  }

  /* ---------------- gathering ---------------- */

  toolFor(node) {
    const conf = NODE_TYPES[node.type];
    if (conf.tool === 'axe' && this.state.tools.steelAxe) return 'steelAxe';
    if (conf.tool === 'pickaxe' && this.state.tools.steelPick) return 'steelPick';
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
      const steel =
        (conf.tool === 'axe' && this.state.tools.steelAxe) ||
        (conf.tool === 'pickaxe' && this.state.tools.steelPick);
      this.gatherCd = steel ? 0.24 : this.state.tools[conf.tool] ? 0.3 : 0.4;
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
    const steel =
      (conf.tool === 'axe' && this.state.tools.steelAxe) ||
      (conf.tool === 'pickaxe' && this.state.tools.steelPick);
    node.hp -= steel ? 3 : hasTool ? 2 : 1;
    node.shake = conf.shake;
    this.player.swing(this.toolFor(node));

    if (conf.sound === 'chop') Sound.chop();
    else if (conf.sound === 'mine') Sound.mine();
    else if (conf.sound === 'buzz') Sound.buzz();
    else if (conf.sound === 'splash') Sound.splash();
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
        if (node.type === 'pond') this.state.stats.fishCaught = (this.state.stats.fishCaught || 0) + added;
        this.addText(node.x, node.y - 38, `+${added} ${ITEMS[id].name}`, '#ffe9ab');
      }
    }

    if (node.type === 'pond' && (this.state.inv.bait || 0) > 0) {
      this.removeItem('bait', 1);
      const added = this.addItem('fish', 1);
      if (added > 0) {
        this.state.stats.gathered.fish = (this.state.stats.gathered.fish || 0) + added;
        this.state.stats.fishCaught = (this.state.stats.fishCaught || 0) + added;
        this.addText(node.x, node.y - 54, '+1 River Fish (bait)', '#b8e6ef');
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

  weatherType() {
    return this.state.weather || 'clear';
  }

  isRaining() {
    const w = this.weatherType();
    return w === 'rain' || w === 'storm';
  }

  pickWeather() {
    const entries = Object.entries(WEATHERS).filter(([id]) => id !== this.state.weather);
    const total = entries.reduce((sum, [, w]) => sum + w.weight, 0);
    let roll = Math.random() * total;
    for (const [id, w] of entries) {
      roll -= w.weight;
      if (roll <= 0) return id;
    }
    return 'clear';
  }

  updateWeather(dt) {
    const s = this.state;
    s.weatherTimer -= dt;
    if (s.weatherTimer > 0) return;

    const id = this.pickWeather();
    const conf = WEATHERS[id] || WEATHERS.clear;
    s.weather = id;
    s.weatherTimer = conf.min + Math.random() * (conf.max - conf.min);
    Sound.setRain(id === 'rain' || id === 'storm' ? 1 : 0);

    if (id === 'rain') this.ui.toast(`${conf.icon} Rain settles in. The garden drinks deep.`, 'good');
    else if (id === 'storm') this.ui.toast(`${conf.icon} A storm rolls in. Heavy rain and thunder.`, 'warn');
    else if (id === 'fog') this.ui.toast(`${conf.icon} Fog curls between the trees.`);
    else if (id === 'cloudy') this.ui.toast(`${conf.icon} Clouds drift over the homestead.`);
    else this.ui.toast(`${conf.icon} The sky clears.`, 'good');
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
      this.dailyHomestead();
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

  spawnDust(x, y) {
    const life = 0.32 + Math.random() * 0.22;
    this.particles.push({
      x: x + (Math.random() * 8 - 4),
      y,
      vx: (Math.random() - 0.5) * 16,
      vy: -6 - Math.random() * 10,
      life,
      maxLife: life,
      size: 2.6 + Math.random() * 2.4,
      color: 'rgba(206, 186, 148, 0.6)',
      gravity: -4,
      rot: 0,
      spin: 0,
      shape: 'circle',
    });
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
      this.updateWeather(dt);
      this.player.update(dt, this);
      this.world.update(dt, this);
      this.updateGather(dt);
      this.updateParticles(dt);
      this.updateTexts(dt);

      const s = this.state;
      const nearFire =
        s.upgrades.campfire &&
        !!this.world.campfirePos &&
        dist(this.player.x, this.player.y, this.world.campfirePos.x, this.world.campfirePos.y) < 170;
      if (!this.gatherNode) {
        const regen = nearFire ? (s.upgrades.hearth ? 10 : 8) : 1.6;
        s.energy = Math.min(s.maxEnergy, s.energy + regen * dt);
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
    if (!this.world.island) {
      this.world.drawDock(ctx);
    }
    this.world.drawDecor(ctx, this.clock, this);
    if (!this.world.island) {
      this.world.drawPlots(ctx, this.clock);
    }

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

    if (!this.world.island) {
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
        f: () => this.world.drawCampfire(ctx, this.clock, this.state.upgrades.campfire, this.state.upgrades.hearth),
      });
      if (this.state.upgrades.well) {
        drawables.push({ y: this.world.wellPos.y, f: () => this.world.drawWell(ctx, this.clock) });
      }
      if (this.state.upgrades.coop) {
        drawables.push({ y: this.world.coopPos.y, f: () => this.world.drawCoop(ctx, this.clock) });
      }
      if (this.state.upgrades.apiary) {
        drawables.push({ y: this.world.apiaryPos.y, f: () => this.world.drawApiary(ctx, this.clock) });
      }
      for (const c of this.world.chickens) {
        if (c.x < left || c.x > right || c.y < top || c.y > bottom) continue;
        drawables.push({ y: c.y, f: () => this.world.drawChicken(ctx, c, this.clock) });
      }
    }
    for (const r of this.world.rabbits) {
      if (r.x < left || r.x > right || r.y < top || r.y > bottom) continue;
      drawables.push({ y: r.y, f: () => this.world.drawRabbit(ctx, r, this.clock) });
    }
    if (this.world.travelPos) {
      const p = this.world.travelPos;
      drawables.push({ y: p.y + 10, f: () => this.world.drawBoat(ctx, this.clock) });
    }
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
    this.renderWeather();
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
    } else if (t.kind === 'travel') {
      x = t.x;
      y = t.y;
      rx = 34;
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

    if (this.state.upgrades.campfire && this.world.campfirePos) {
      const flick = Math.sin(this.clock * 7) * 6;
      const radius = this.state.upgrades.hearth ? 390 : 320;
      addLight(this.world.campfirePos.x, this.world.campfirePos.y - 12, radius + flick, 1);
    }
    if (this.state.upgrades.lantern) {
      addLight(this.player.x, this.player.y - 20, 340, 0.95);
    } else if (this.state.upgrades.torch) {
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
    if (this.state.upgrades.campfire && this.world.campfirePos) {
      const warmRadius = this.state.upgrades.hearth ? 300 : 250;
      warm(this.world.campfirePos.x, this.world.campfirePos.y - 14, warmRadius, 0.1);
    }
    if (this.state.upgrades.lantern) {
      warm(this.player.x, this.player.y - 20, 240, 0.07);
    } else if (this.state.upgrades.torch) {
      warm(this.player.x, this.player.y - 20, 180, 0.06);
    }
    ctx.restore();

    if (night) {
      ctx.fillStyle = 'rgba(80, 110, 200, 0.04)';
      ctx.fillRect(0, 0, vw, vh);
    }
  }

  renderWeather() {
    const w = this.weatherType();
    if (w === 'clear') return;
    const ctx = this.ctx;
    const vw = this.vw;
    const vh = this.vh;

    if (w === 'cloudy') {
      ctx.fillStyle = 'rgba(64, 84, 104, 0.05)';
      ctx.fillRect(0, 0, vw, vh);
      return;
    }

    if (w === 'fog') {
      const grad = ctx.createLinearGradient(0, 0, 0, vh);
      grad.addColorStop(0, 'rgba(216, 226, 220, 0.17)');
      grad.addColorStop(0.55, 'rgba(216, 226, 220, 0.11)');
      grad.addColorStop(1, 'rgba(216, 226, 220, 0.06)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, vw, vh);
      return;
    }

    // Rain: screen-space streaks, cheap and wind-blown.
    const storm = w === 'storm';
    ctx.save();
    ctx.strokeStyle = storm ? 'rgba(206, 232, 244, 0.55)' : 'rgba(198, 226, 238, 0.4)';
    ctx.lineWidth = storm ? 1.4 : 1.2;
    const t = this.clock;
    const count = storm ? 210 : 130;
    for (let i = 0; i < count; i++) {
      const seed = i * 127.1;
      const speed = 560 + (i % 7) * 45 + (storm ? 160 : 0);
      const x = ((seed * 13.7 + t * 80) % (vw + 140)) - 70;
      const y = ((seed * 7.3 + t * speed) % (vh + 160)) - 80;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - (storm ? 12 : 7), y + (storm ? 24 : 17));
      ctx.stroke();
    }
    ctx.fillStyle = storm ? 'rgba(30, 46, 58, 0.14)' : 'rgba(38, 58, 70, 0.07)';
    ctx.fillRect(0, 0, vw, vh);

    if (storm) {
      const cycle = this.clock % 8;
      const flash = cycle > 7.55 ? Math.sin(((cycle - 7.55) / 0.45) * Math.PI) : 0;
      if (flash > 0.02) {
        ctx.fillStyle = `rgba(226, 240, 255, ${flash * 0.3})`;
        ctx.fillRect(0, 0, vw, vh);
      }
    }
    ctx.restore();
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

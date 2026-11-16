'use strict';

class World {
  constructor(saved) {
    this.w = 2600;
    this.h = 2000;

    this.homestead = { x: 1300, y: 1010 };
    this.tentPos = { x: 1200, y: 918 };
    this.stallPos = { x: 1476, y: 962 };
    this.campfirePos = { x: 1384, y: 1088 };
    this.coopPos = { x: 1516, y: 1162 };
    this.apiaryPos = { x: 1452, y: 1216 };
    this.wellPos = { x: 1268, y: 1150 };
    this.pond = { x: 820, y: 1230, rx: 212, ry: 142 };
    this.dock = { x1: 924, x2: 1078, y1: 1218, y2: 1262, y: 1240 };
    this.plotDefs = [
      { x: 1104, y: 1108 },
      { x: 1184, y: 1108 },
      { x: 1104, y: 1188 },
      { x: 1184, y: 1188 },
    ];
    this.paths = [
      { x: 1300, y: 1012, rx: 158, ry: 104 },
      { x: 1262, y: 1090, rx: 100, ry: 42 },
      { x: 1408, y: 1048, rx: 76, ry: 36 },
      { x: 1456, y: 1002, rx: 54, ry: 28 },
      { x: 1240, y: 970, rx: 60, ry: 28 },
    ];

    this.rng = makeRng(saved && saved.seed ? saved.seed : 12345);
    this.nodes = [];
    this.decor = [];
    this.ambient = [];
    this.patches = [];
    this.rabbits = [];
    this.chickens = [];
    this.ambientTimer = 4;

    this.generatePatches();
    this.generateDecor();
    this.generateAmbient();
    this.generateRabbits();
    this.generateChickens();

    if (saved && Array.isArray(saved.nodes) && saved.nodes.length) {
      this.loadNodes(saved.nodes);
    } else {
      this.generateNodes();
    }
    this.ensureNewContent();

    this.plots = this.makePlots(saved && Array.isArray(saved.plots) ? saved.plots : null);
  }

  /* ---------------- geometry ---------------- */

  inPond(x, y, margin = 0) {
    return pointInEllipse(x, y, this.pond.x, this.pond.y, this.pond.rx + margin, this.pond.ry + margin);
  }

  onDock(x, y, margin = 0) {
    const d = this.dock;
    return x >= d.x1 - margin && x <= d.x2 + margin && y >= d.y1 - margin && y <= d.y2 + margin;
  }

  isBlocked(x, y) {
    return this.inPond(x, y, -8) && !this.onDock(x, y, -2);
  }

  /* ---------------- generation ---------------- */

  generatePatches() {
    const colors = [
      'rgba(48, 104, 52, 0.10)',
      'rgba(150, 196, 110, 0.10)',
      'rgba(64, 132, 74, 0.08)',
      'rgba(196, 214, 132, 0.07)',
    ];
    for (let i = 0; i < 34; i++) {
      this.patches.push({
        x: this.rng.range(0, this.w),
        y: this.rng.range(0, this.h),
        rx: this.rng.range(90, 280),
        ry: this.rng.range(60, 190),
        color: this.rng.pick(colors),
      });
    }
  }

  generateDecor() {
    const flowerColors = ['#f2e6cf', '#ffd166', '#e8a0bf', '#c8b6ff', '#f4a259', '#9fd8c0'];
    for (let i = 0; i < 420; i++) {
      const roll = this.rng.next();
      let type = 'tuft';
      if (roll > 0.9) type = 'stump';
      else if (roll > 0.82) type = 'pebble';
      else if (roll > 0.72) type = 'fern';
      else if (roll > 0.56) type = 'flower';
      else if (roll > 0.44) type = 'clover';

      const flowers = type === 'flower';
      const x = flowers
        ? this.homestead.x + this.rng.range(-540, 540)
        : this.rng.range(40, this.w - 40);
      const y = flowers
        ? this.homestead.y + this.rng.range(-400, 400)
        : this.rng.range(40, this.h - 40);

      if (this.inPond(x, y, 10) || this.onDock(x, y, 24)) continue;

      this.decor.push({
        x: clamp(x, 30, this.w - 30),
        y: clamp(y, 30, this.h - 30),
        type,
        s: this.rng.range(0.7, 1.3),
        seed: this.rng.next() * 100,
        color: this.rng.pick(flowerColors),
      });
    }
  }

  generateAmbient() {
    const colors = ['#f4a259', '#f2e6cf', '#ffd166', '#c8b6ff', '#9fd8c0', '#e8a0bf'];
    for (let i = 0; i < 24; i++) {
      this.ambient.push({
        x: this.rng.range(100, this.w - 100),
        y: this.rng.range(100, this.h - 100),
        seed: this.rng.next() * 10,
        color: this.rng.pick(colors),
      });
    }
  }

  generateRabbits() {
    const spots = [
      [1092, 1258], [1512, 1196], [972, 866], [1704, 1328], [648, 1480], [1146, 616],
    ];
    for (const [bx, by] of spots) {
      this.rabbits.push({
        x: bx,
        y: by,
        homeX: bx,
        homeY: by,
        tx: bx,
        ty: by,
        dir: this.rng.chance(0.5) ? 1 : -1,
        hopT: 0,
        wait: 0.6 + this.rng.next() * 2.2,
        speed: 0,
        moving: false,
        seed: this.rng.next() * 10,
      });
    }
  }

  generateChickens() {
    const spots = [
      [1496, 1196], [1552, 1180], [1470, 1236], [1570, 1222],
    ];
    for (const [bx, by] of spots) {
      this.chickens.push({
        x: bx,
        y: by,
        homeX: bx,
        homeY: by,
        tx: bx,
        ty: by,
        dir: this.rng.chance(0.5) ? 1 : -1,
        peckT: 0,
        wait: 0.5 + this.rng.next() * 2,
        speed: 0,
        moving: false,
        seed: this.rng.next() * 10,
      });
    }
  }

  spotFree(x, y, ignoreHomestead) {
    if (x < 70 || y < 90 || x > this.w - 70 || y > this.h - 70) return false;
    if (this.inPond(x, y, 26) || this.onDock(x, y, 26)) return false;
    if (!ignoreHomestead && dist(x, y, this.homestead.x, this.homestead.y) < 235) return false;
    if (dist(x, y, this.tentPos.x, this.tentPos.y) < 95) return false;
    if (dist(x, y, this.stallPos.x, this.stallPos.y) < 100) return false;
    if (dist(x, y, this.campfirePos.x, this.campfirePos.y) < 85) return false;
    if (dist(x, y, this.coopPos.x, this.coopPos.y) < 110) return false;
    if (dist(x, y, this.apiaryPos.x, this.apiaryPos.y) < 90) return false;
    if (dist(x, y, this.wellPos.x, this.wellPos.y) < 90) return false;
    for (const p of this.plotDefs) {
      if (dist(x, y, p.x, p.y) < 78) return false;
    }
    for (const n of this.nodes) {
      if (dist(x, y, n.x, n.y) < 34) return false;
    }
    return true;
  }

  makeNode(type, x, y) {
    const conf = NODE_TYPES[type];
    return {
      type,
      x,
      y,
      hp: conf.hp,
      maxHp: conf.hp,
      alive: true,
      respawn: 0,
      shake: 0,
      seed: this.rng ? this.rng.next() * 100 : Math.random() * 100,
    };
  }

  addFixedNode(type, x, y) {
    if (!NODE_TYPES[type]) return;
    if (this.nodes.some((n) => n.type === type && dist(n.x, n.y, x, y) < 60)) return;
    this.nodes.push(this.makeNode(type, x, y));
  }

  place(type, count, centers, spread) {
    const conf = NODE_TYPES[type];
    if (!conf) return;
    let placed = 0;
    let tries = 0;
    while (placed < count && tries < count * 90) {
      tries++;
      let x;
      let y;
      if (centers && centers.length) {
        const c = this.rng.pick(centers);
        x = c.x + (this.rng.next() * 2 - 1) * spread;
        y = c.y + (this.rng.next() * 2 - 1) * spread;
      } else {
        x = this.rng.range(70, this.w - 70);
        y = this.rng.range(90, this.h - 70);
      }
      if (!this.spotFree(x, y)) continue;
      this.nodes.push(this.makeNode(type, x, y));
      placed++;
    }
  }

  generateNodes() {
    const forest = [
      { x: 340, y: 380 },
      { x: 760, y: 250 },
      { x: 1050, y: 300 },
      { x: 300, y: 1600 },
      { x: 760, y: 1740 },
      { x: 2160, y: 358 },
      { x: 2140, y: 1580 },
      { x: 1600, y: 1770 },
      { x: 130, y: 1030 },
      { x: 2430, y: 1150 },
      { x: 560, y: 760 },
      { x: 1860, y: 780 },
    ];
    const rocky = [
      { x: 2200, y: 430 },
      { x: 2310, y: 620 },
      { x: 2080, y: 520 },
      { x: 520, y: 980 },
      { x: 2400, y: 1440 },
    ];
    const pondEdge = [
      { x: 560, y: 1170 },
      { x: 640, y: 1388 },
      { x: 1050, y: 1102 },
    ];

    this.place('tree', 46, forest, 190);
    this.place('appleTree', 14, forest, 220);
    this.place('nutTree', 12, forest, 220);
    this.place('fiber', 54, null, 0);
    this.place('rock', 26, rocky, 155);
    this.place('ore', 10, rocky, 135);
    this.place('crystal', 5, rocky, 150);
    this.place('bush', 24, null, 0);
    this.place('mush', 18, forest, 160);
    this.place('herb', 22, null, 0);
    this.place('hive', 8, forest, 180);
    this.place('clay', 3, pondEdge, 42);
    this.place('reed', 20, pondEdge, 62);

    this.addFixedNode('pond', 946, 1208);
    this.addFixedNode('pond', 812, 1374);

    // A friendly starter ring around the homestead.
    const ring = [
      ['tree', -272, 30],
      ['tree', 300, -152],
      ['tree', -90, -300],
      ['appleTree', 268, -262],
      ['nutTree', -350, 220],
      ['fiber', -320, 180],
      ['fiber', 330, 150],
      ['fiber', 180, -250],
      ['bush', -280, -40],
      ['bush', 300, 250],
      ['rock', 140, -310],
      ['rock', -330, -120],
      ['mush', 210, 300],
      ['fiber', -250, 300],
      ['fiber', 240, 300],
      ['bush', 60, 330],
      ['mush', -120, 320],
      ['herb', -300, 80],
      ['herb', 340, 20],
      ['hive', -120, 350],
    ];
    for (const [type, dx, dy] of ring) {
      const x = this.homestead.x + dx;
      const y = this.homestead.y + dy;
      if (this.spotFree(x, y, true)) this.nodes.push(this.makeNode(type, x, y));
    }
  }

  /** Give older saves the new content without wiping progress. */
  ensureNewContent() {
    const count = (type) => this.nodes.filter((n) => n.type === type).length;

    if (count('pond') === 0) {
      this.addFixedNode('pond', 946, 1208);
      this.addFixedNode('pond', 812, 1374);
    }

    const forest = [
      { x: 340, y: 380 }, { x: 760, y: 250 }, { x: 1050, y: 300 }, { x: 2160, y: 358 },
      { x: 2140, y: 1580 }, { x: 1600, y: 1770 }, { x: 130, y: 1030 }, { x: 560, y: 760 },
      { x: 1860, y: 780 },
    ];
    const rocky = [
      { x: 2200, y: 430 }, { x: 2310, y: 620 }, { x: 2080, y: 520 }, { x: 2400, y: 1440 },
    ];
    const pondEdge = [
      { x: 560, y: 1170 }, { x: 640, y: 1388 }, { x: 1050, y: 1102 },
    ];

    const want = [
      ['appleTree', 8, forest, 220],
      ['nutTree', 6, forest, 220],
      ['herb', 10, null, 0],
      ['hive', 5, forest, 180],
      ['crystal', 3, rocky, 150],
      ['clay', 2, pondEdge, 42],
      ['reed', 8, pondEdge, 62],
    ];
    for (const [type, min, centers, spread] of want) {
      const have = count(type);
      if (have < min) this.place(type, min - have, centers, spread);
    }
  }

  loadNodes(saved) {
    this.nodes = [];
    for (const row of saved) {
      if (!Array.isArray(row) || row.length < 5) continue;
      const [type, x, y, alive, hp, respawn, seed] = row;
      if (!NODE_TYPES[type]) continue;
      const conf = NODE_TYPES[type];
      this.nodes.push({
        type,
        x,
        y,
        hp: clamp(typeof hp === 'number' ? hp : conf.hp, 0, conf.hp),
        maxHp: conf.hp,
        alive: !!alive,
        respawn: Math.max(0, respawn || 0),
        shake: 0,
        seed: seed || 0,
      });
    }
  }

  makePlots(saved) {
    return this.plotDefs.map((def, i) => {
      const s = Array.isArray(saved) ? saved[i] : null;
      const crop = s && CROPS[s.crop] ? s.crop : 'berry';
      return {
        x: def.x,
        y: def.y,
        state: s && typeof s.state === 'string' ? s.state : 'grass',
        crop,
        growth: s && typeof s.growth === 'number' ? clamp(s.growth, 0, 1) : 0,
      };
    });
  }

  serializeNodes() {
    return this.nodes.map((n) => [
      n.type,
      Math.round(n.x),
      Math.round(n.y),
      n.alive ? 1 : 0,
      n.hp,
      +n.respawn.toFixed(1),
      +n.seed.toFixed(2),
    ]);
  }

  serializePlots() {
    return this.plots.map((p) => ({
      state: p.state,
      crop: p.crop,
      growth: +p.growth.toFixed(3),
    }));
  }

  /* ---------------- simulation ---------------- */

  update(dt, game) {
    const weather = game.weatherType ? game.weatherType() : 'clear';
    const raining = game.isRaining ? game.isRaining() : weather === 'rain';
    const respawnRate = raining ? 1.35 : 1;

    for (const n of this.nodes) {
      if (n.shake > 0) n.shake = Math.max(0, n.shake - dt * 26);
      if (!n.alive) {
        n.respawn -= dt * respawnRate;
        if (n.respawn <= 0) {
          n.alive = true;
          n.hp = n.maxHp;
          n.respawn = 0;
          game.spawnSparkle(n.x, n.y - 16, 5);
        }
      }
    }

    for (const p of this.plots) {
      if (p.state === 'growing') {
        const total = game.cropGrowTime ? game.cropGrowTime(p.crop) : 45;
        p.growth = Math.min(1, p.growth + dt / total);
        if (p.growth >= 1) {
          p.state = 'ripe';
          game.spawnSparkle(p.x, p.y - 14, 8);
        }
      } else if (p.state === 'ripe' && this.rng.chance(dt * 0.9)) {
        game.spawnSparkle(p.x + (Math.random() * 26 - 13), p.y - 16, 1);
      }
    }

    if (game.state.upgrades.campfire && this.rng.chance(dt * (game.state.upgrades.hearth ? 6 : 3))) {
      game.spawnEmber(
        this.campfirePos.x + (Math.random() * (game.state.upgrades.hearth ? 26 : 16) - (game.state.upgrades.hearth ? 13 : 8)),
        this.campfirePos.y - 18
      );
    }

    this.updateRabbits(dt, game);
    this.updateChickens(dt, game);

    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 6 + Math.random() * 9;
      if (game.isNight && game.isNight()) Sound.cricket();
      else Sound.bird();
    }
  }

  updateRabbits(dt, game) {
    for (const r of this.rabbits) {
      const px = game.player.x;
      const py = game.player.y;
      const d = dist(r.x, r.y, px, py);

      if (d < 130) {
        const away = Math.max(1, d);
        r.tx = clamp(r.x + ((r.x - px) / away) * 110, 50, this.w - 50);
        r.ty = clamp(r.y + ((r.y - py) / away) * 110, 80, this.h - 50);
        r.moving = true;
        r.speed = 128;
        r.wait = 0.6;
      } else {
        r.wait -= dt;
        if (r.wait <= 0) {
          const a = Math.random() * TAU;
          const radius = 30 + Math.random() * 120;
          r.tx = clamp(r.homeX + Math.cos(a) * radius, 50, this.w - 50);
          r.ty = clamp(r.homeY + Math.sin(a) * radius, 80, this.h - 50);
          r.wait = 1.6 + Math.random() * 4;
          r.speed = 46 + Math.random() * 30;
          r.moving = true;
        }
      }

      if (r.moving) {
        if (this.isBlocked(r.tx, r.ty)) {
          r.tx = r.homeX;
          r.ty = r.homeY;
        }
        const dx = r.tx - r.x;
        const dy = r.ty - r.y;
        const len = Math.hypot(dx, dy);
        if (len < 4) {
          r.moving = false;
          r.hopT = 0;
        } else {
          r.x += (dx / len) * r.speed * dt;
          r.y += (dy / len) * r.speed * dt;
          r.dir = dx >= 0 ? 1 : -1;
          r.hopT += dt * (r.speed / 22);
        }
      } else {
        r.hopT = 0;
      }
    }
  }

  updateChickens(dt, game) {
    for (const c of this.chickens) {
      const px = game.player.x;
      const py = game.player.y;
      const d = dist(c.x, c.y, px, py);

      if (d < 78) {
        const away = Math.max(1, d);
        c.tx = clamp(c.x + ((c.x - px) / away) * 70, 50, this.w - 50);
        c.ty = clamp(c.y + ((c.y - py) / away) * 70, 80, this.h - 50);
        c.moving = true;
        c.speed = 76;
        c.wait = 0.8;
      } else {
        c.wait -= dt;
        if (c.wait <= 0) {
          const a = Math.random() * TAU;
          const radius = 20 + Math.random() * 70;
          c.tx = clamp(this.coopPos.x + Math.cos(a) * radius, 50, this.w - 50);
          c.ty = clamp(this.coopPos.y + Math.sin(a) * radius, 80, this.h - 50);
          c.wait = 1.4 + Math.random() * 3.2;
          c.speed = 26 + Math.random() * 18;
          c.moving = true;
        }
      }

      if (c.moving) {
        if (this.isBlocked(c.tx, c.ty)) {
          c.tx = c.homeX;
          c.ty = c.homeY;
        }
        const dx = c.tx - c.x;
        const dy = c.ty - c.y;
        const len = Math.hypot(dx, dy);
        if (len < 3) {
          c.moving = false;
          c.peckT = 0;
        } else {
          c.x += (dx / len) * c.speed * dt;
          c.y += (dy / len) * c.speed * dt;
          c.dir = dx >= 0 ? 1 : -1;
          c.peckT += dt * 7;
        }
      } else {
        c.peckT += dt * 2.4;
      }
    }
  }

  /* ---------------- background ---------------- */

  drawBackground(ctx, game) {
    ctx.fillStyle = game.grassPattern || '#78b061';
    ctx.fillRect(0, 0, this.w, this.h);

    for (const p of this.patches) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU);
      ctx.fill();
    }

    for (let i = 0; i < this.paths.length; i++) {
      const p = this.paths[i];
      ctx.fillStyle = 'rgba(203, 172, 120, 0.32)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(218, 190, 142, 0.26)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 2, p.rx * 0.82, p.ry * 0.76, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(186, 157, 108, 0.22)';
      for (let s = 0; s < 5; s++) {
        const a = i * 1.7 + s * 2.1;
        ctx.beginPath();
        ctx.ellipse(p.x + Math.cos(a) * p.rx * 0.6, p.y + Math.sin(a) * p.ry * 0.6, 2.4, 1.4, a, 0, TAU);
        ctx.fill();
      }
    }

    this.drawPond(ctx, game.clock);

    const edge = 155;
    const grads = [
      [ctx.createLinearGradient(0, 0, 0, edge), 0, 0, this.w, edge],
      [ctx.createLinearGradient(0, this.h, 0, this.h - edge), 0, this.h - edge, this.w, edge],
      [ctx.createLinearGradient(0, 0, edge, 0), 0, 0, edge, this.h],
      [ctx.createLinearGradient(this.w, 0, this.w - edge, 0), this.w - edge, 0, edge, this.h],
    ];
    for (const [g, x, y, w, h] of grads) {
      g.addColorStop(0, 'rgba(28, 58, 34, 0.55)');
      g.addColorStop(1, 'rgba(28, 58, 34, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    }
  }

  drawPond(ctx, t) {
    const { x, y, rx, ry } = this.pond;

    // Sandy shore
    ctx.fillStyle = 'rgba(196, 184, 132, 0.6)';
    ctx.beginPath();
    ctx.ellipse(x, y + 3, rx + 15, ry + 12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(170, 160, 112, 0.55)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, rx + 7, ry + 5, 0, 0, TAU);
    ctx.fill();

    // Water
    const water = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 8, x, y, rx * 1.1);
    water.addColorStop(0, '#8ed6da');
    water.addColorStop(0.45, '#5fb3c2');
    water.addColorStop(1, '#377f96');
    ctx.fillStyle = water;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, rx - 2, ry - 2, 0, 0, TAU);
    ctx.clip();

    // Moving glints and ripples
    ctx.strokeStyle = 'rgba(224, 248, 250, 0.22)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) {
      const phase = (t * 0.09 + i / 5) % 1;
      ctx.globalAlpha = 0.5 * (1 - phase);
      ctx.beginPath();
      ctx.ellipse(x - 20, y - 10, 30 + phase * rx * 0.8, 12 + phase * ry * 0.7, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(212, 245, 248, 0.33)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 7; i++) {
      const wx = x - rx * 0.62 + ((i * 97 + t * 12) % (rx * 1.24));
      const wy = y - ry * 0.5 + ((i * 53) % (ry * 0.95));
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(wx + 9, wy - 2, wx + 18, wy);
      ctx.stroke();
    }

    // Lily pads
    const pads = [
      [-0.42, -0.24, 1],
      [0.3, 0.14, 0.82],
      [0.06, -0.48, 0.66],
      [-0.14, 0.42, 0.92],
      [0.56, -0.08, 0.58],
    ];
    for (let i = 0; i < pads.length; i++) {
      const [ox, oy, s] = pads[i];
      const px = x + ox * rx;
      const py = y + oy * ry + Math.sin(t * 0.9 + i * 2) * 1.5;
      ctx.fillStyle = 'rgba(60, 122, 66, 0.85)';
      ctx.beginPath();
      ctx.ellipse(px, py, 14 * s, 8 * s, 0.15, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(96, 160, 92, 0.9)';
      ctx.beginPath();
      ctx.ellipse(px - 2 * s, py - 1.5 * s, 9 * s, 4.6 * s, 0.15, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(40, 90, 48, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(0.6) * 13 * s, py + Math.sin(0.6) * 7 * s);
      ctx.stroke();
      if (i === 1 || i === 4) {
        ctx.fillStyle = '#f7e6f0';
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * TAU;
          ctx.beginPath();
          ctx.arc(px + Math.cos(a) * 2.4, py - 2 + Math.sin(a) * 2.4, 1.7, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(px, py - 2, 1.4, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();

    // Reeds around the shore
    const reedAngles = [0.18, 0.72, 1.42, 2.1, 2.78, 3.48, 4.12, 4.86, 5.52];
    for (let i = 0; i < reedAngles.length; i++) {
      const a = reedAngles[i];
      const bx = x + Math.cos(a) * (rx + 9 + Math.sin(i * 2.3) * 7);
      const by = y + Math.sin(a) * (ry + 6 + Math.cos(i * 1.7) * 6);
      const sway = Math.sin(t * 1.3 + i) * 3;
      ctx.strokeStyle = i % 2 ? '#4e8a4c' : '#6ba35c';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let b = 0; b < 4; b++) {
        const off = (b - 1.5) * 3;
        ctx.beginPath();
        ctx.moveTo(bx + off, by);
        ctx.quadraticCurveTo(bx + off + sway * 0.5, by - 14, bx + off + sway, by - 24 - b * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#8a6a3c';
      ctx.beginPath();
      ctx.ellipse(bx + sway, by - 26, 2, 5, 0.2, 0, TAU);
      ctx.fill();
    }

    // Ducks
    const ducks = [
      { a: 0.6, sp: 0.1, s: 1 },
      { a: 3.3, sp: -0.075, s: 0.86 },
    ];
    for (const d of ducks) {
      const a = d.a + t * d.sp;
      const dx = x + Math.cos(a) * rx * 0.52;
      const dy = y + Math.sin(a) * ry * 0.5;
      const dir = Math.sin(a) * (d.sp > 0 ? 1 : -1) >= 0 ? 1 : -1;
      this.drawDuck(ctx, dx, dy, dir, d.s, t);
    }
  }

  drawDuck(ctx, x, y, dir, s, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir * s, s);

    ctx.strokeStyle = 'rgba(220, 245, 248, 0.28)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(-9, 1, 10, 3, 0, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = '#f2ead8';
    ctx.beginPath();
    ctx.ellipse(0, -3 + Math.sin(t * 2 + x) * 0.5, 10, 5.6, -0.08, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d9cdb4';
    ctx.beginPath();
    ctx.ellipse(-2, -4.5, 5.4, 3, -0.2, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#f2ead8';
    ctx.beginPath();
    ctx.arc(8, -9, 4.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4c8a46';
    ctx.beginPath();
    ctx.ellipse(8, -10.6, 3.6, 2.2, 0.15, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#e8963c';
    ctx.beginPath();
    ctx.moveTo(11.6, -9.2);
    ctx.lineTo(15.2, -8);
    ctx.lineTo(11.6, -7);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#2b2b26';
    ctx.beginPath();
    ctx.arc(9.4, -9.8, 0.8, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  drawDecor(ctx, t, game) {
    const pad = 90;
    const left = game.camera.x - game.vw / 2 - pad;
    const right = game.camera.x + game.vw / 2 + pad;
    const top = game.camera.y - game.vh / 2 - pad;
    const bottom = game.camera.y + game.vh / 2 + pad;

    for (const d of this.decor) {
      if (d.x < left || d.x > right || d.y < top || d.y > bottom) continue;
      const sway = Math.sin(t * 1.1 + d.seed) * 1.4;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.scale(d.s, d.s);

      if (d.type === 'tuft') {
        ctx.strokeStyle = '#57944c';
        ctx.lineWidth = 1.7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
          ctx.moveTo(i * 3, 0);
          ctx.quadraticCurveTo(i * 4 + sway, -7, i * 5 + sway * 1.6, -12 - Math.abs(i));
        }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(142, 190, 108, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(sway, -5, sway * 1.2, -9);
        ctx.stroke();
      } else if (d.type === 'flower') {
        ctx.strokeStyle = '#4f8f4a';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, 1);
        ctx.quadraticCurveTo(sway, -6, sway * 1.4, -11);
        ctx.stroke();
        const fx = sway * 1.4;
        ctx.fillStyle = d.color;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + d.seed;
          ctx.beginPath();
          ctx.ellipse(fx + Math.cos(a) * 3.4, -12 + Math.sin(a) * 3.4, 2.4, 1.8, a, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = '#f2c66a';
        ctx.beginPath();
        ctx.arc(fx, -12, 1.8, 0, TAU);
        ctx.fill();
      } else if (d.type === 'fern') {
        ctx.strokeStyle = '#4d8a46';
        ctx.lineWidth = 1.5;
        for (let f = -1; f <= 1; f++) {
          const a = f * 0.55 + Math.sin(t + d.seed) * 0.04;
          ctx.save();
          ctx.rotate(a);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(3, -8, 1 + sway * 0.4, -16);
          ctx.stroke();
          ctx.fillStyle = '#5fa054';
          for (let l = 1; l <= 3; l++) {
            const ly = -4 * l;
            ctx.beginPath();
            ctx.ellipse(1 + l * 0.6, ly, 4.2, 1.9, 0.5, 0, TAU);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(-1 - l * 0.4, ly - 1, 3.8, 1.7, -0.5, 0, TAU);
            ctx.fill();
          }
          ctx.restore();
        }
      } else if (d.type === 'clover') {
        ctx.fillStyle = 'rgba(74, 140, 70, 0.8)';
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * TAU + d.seed;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 2.6, -3 + Math.sin(a) * 2.6, 2.9, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(120, 178, 100, 0.5)';
        ctx.beginPath();
        ctx.arc(-0.8, -4, 1.2, 0, TAU);
        ctx.fill();
      } else if (d.type === 'stump') {
        ctx.fillStyle = 'rgba(28, 56, 32, 0.14)';
        ellipse(ctx, 0, 1, 10, 3.6);
        ctx.fillStyle = '#7a5236';
        rr(ctx, -7, -7, 14, 9, 3);
        ctx.fill();
        ctx.fillStyle = '#c9a06f';
        ctx.beginPath();
        ctx.ellipse(0, -7, 7, 3.4, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#a57c50';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, -7, 4, 1.9, 0, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = '#5fa054';
        ctx.beginPath();
        ctx.ellipse(5, -2, 3, 1.8, 0.4, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(140, 148, 152, 0.68)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 4.4, 2.7, 0.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.beginPath();
        ctx.ellipse(-1, -0.9, 2.1, 1, 0.2, 0, TAU);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  /* ---------------- plots ---------------- */

  drawGardenFence(ctx) {
    const x1 = 1058;
    const x2 = 1230;
    const y1 = 1060;
    const y2 = 1236;
    const post = (x, y) => {
      ctx.fillStyle = '#6e4a2e';
      rr(ctx, x - 2.5, y - 13, 5, 16, 2);
      ctx.fill();
      ctx.fillStyle = '#a9713f';
      rr(ctx, x - 2, y - 13, 2.4, 14, 1.2);
      ctx.fill();
    };
    ctx.strokeStyle = '#8a5a3b';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y1);
    ctx.moveTo(x1, y1 + 9);
    ctx.lineTo(x2, y1 + 9);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1, y2);
    ctx.moveTo(x1 + 9, y1);
    ctx.lineTo(x1 + 9, y2);
    ctx.moveTo(x2, y1);
    ctx.lineTo(x2, y2);
    ctx.moveTo(x2 - 9, y1);
    ctx.lineTo(x2 - 9, y2);
    ctx.moveTo(x1, y2);
    ctx.lineTo(x1 + 42, y2);
    ctx.moveTo(x2 - 42, y2);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    for (let i = 0; i <= 4; i++) {
      const fx = x1 + ((x2 - x1) / 4) * i;
      post(fx, y1);
      if (i < 2 || i > 2) post(fx, y2);
    }
    for (let i = 1; i < 4; i++) {
      const fy = y1 + ((y2 - y1) / 4) * i;
      post(x1, fy);
      post(x2, fy);
    }
  }

  drawPlots(ctx, t) {
    this.drawGardenFence(ctx);

    for (const p of this.plots) {
      ctx.save();
      ctx.translate(p.x, p.y);
      const crop = CROPS[p.crop] || CROPS.berry;

      const w = 58;
      const h = 42;

      if (p.state === 'ripe') {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 + p.x);
        const glow = ctx.createRadialGradient(0, -6, 4, 0, -6, 50);
        glow.addColorStop(0, `rgba(255, 235, 150, ${0.12 + pulse * 0.08})`);
        glow.addColorStop(1, 'rgba(255, 235, 150, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, -6, 50, 0, TAU);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(30, 55, 30, 0.16)';
      ellipse(ctx, 0, 8, w * 0.6, 8);

      if (p.state === 'grass') {
        ctx.fillStyle = '#6da85a';
        rr(ctx, -w / 2, -h / 2, w, h, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(48, 88, 42, 0.55)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(88, 148, 76, 0.9)';
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 5; i++) {
          const gx = -20 + i * 10;
          ctx.beginPath();
          ctx.moveTo(gx, 9);
          ctx.quadraticCurveTo(gx + 2, -2, gx + Math.sin(t + i) * 2, -8);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#8b6a45';
        rr(ctx, -w / 2, -h / 2, w, h, 10);
        ctx.fill();
        ctx.strokeStyle = '#6e5136';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'rgba(110, 81, 54, 0.35)';
        for (let i = 0; i < 7; i++) {
          const sx = -21 + (i % 4) * 14;
          const sy = -12 + Math.floor(i / 4) * 18;
          ctx.beginPath();
          ctx.ellipse(sx, sy, 3, 1.6, 0.2, 0, TAU);
          ctx.fill();
        }

        ctx.strokeStyle = 'rgba(94, 69, 44, 0.7)';
        ctx.lineWidth = 2.4;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(-w / 2 + 8, i * 9);
          ctx.quadraticCurveTo(0, i * 9 + 2, w / 2 - 8, i * 9);
          ctx.stroke();
        }

        if (p.state === 'growing' || p.state === 'ripe') {
          const g = p.state === 'ripe' ? 1 : p.growth;
          if (p.crop === 'pumpkin') {
            for (let i = -1; i <= 1; i++) {
              const sx = i * 17;
              const sh = 6 + g * 15;
              ctx.strokeStyle = '#4f8f4a';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(sx, 6);
              ctx.quadraticCurveTo(sx + 2, 3 - sh * 0.5, sx + Math.sin(t * 1.1 + i) * 3, 3 - sh);
              ctx.stroke();
              ctx.fillStyle = '#5fa054';
              ctx.beginPath();
              ctx.ellipse(sx - 5, 1 - sh * 0.45, 5.4, 3, -0.5, 0, TAU);
              ctx.fill();
              ctx.beginPath();
              ctx.ellipse(sx + 5, 2 - sh * 0.7, 5.2, 2.8, 0.5, 0, TAU);
              ctx.fill();
              if (p.state === 'ripe') {
                const px = sx;
                const py = 4 - g * 2;
                ctx.fillStyle = '#e08a3a';
                ctx.beginPath();
                ctx.ellipse(px, py, 7.4, 6, 0, 0, TAU);
                ctx.fill();
                ctx.strokeStyle = '#c9702a';
                ctx.lineWidth = 1;
                for (let r = -1; r <= 1; r++) {
                  ctx.beginPath();
                  ctx.ellipse(px + r * 2.4, py, 1.3, 5.6, 0, 0, TAU);
                  ctx.stroke();
                }
                ctx.fillStyle = '#6e7a3a';
                rr(ctx, px - 1.4, py - 8, 2.8, 4, 1);
                ctx.fill();
                ctx.fillStyle = 'rgba(255, 200, 120, 0.4)';
                ctx.beginPath();
                ctx.ellipse(px - 3, py - 2.4, 2.4, 1.4, -0.4, 0, TAU);
                ctx.fill();
              }
            }
          } else if (p.crop === 'carrot') {
            for (let i = -1; i <= 1; i++) {
              const sx = i * 17;
              const sh = 6 + g * 14;
              const sway = Math.sin(t * 1.4 + i) * 1.4;
              ctx.strokeStyle = '#4f8f4a';
              ctx.lineWidth = 2;
              for (let f = -1; f <= 1; f++) {
                ctx.beginPath();
                ctx.moveTo(sx, 2);
                ctx.quadraticCurveTo(sx + f * 3 + sway, 2 - sh * 0.6, sx + f * 5 + sway, 2 - sh);
                ctx.stroke();
              }
              ctx.fillStyle = '#6fae54';
              ctx.beginPath();
              ctx.ellipse(sx - 4 + sway, 4 - sh * 0.55, 4.2, 2.2, -0.6, 0, TAU);
              ctx.fill();
              ctx.beginPath();
              ctx.ellipse(sx + 4 + sway, 3 - sh * 0.65, 4, 2, 0.6, 0, TAU);
              ctx.fill();
              if (p.state === 'ripe') {
                ctx.fillStyle = '#e07a3a';
                ctx.beginPath();
                ctx.ellipse(sx, 3, 4.8, 5.6, 0.1, 0, TAU);
                ctx.fill();
                ctx.fillStyle = '#f29a54';
                ctx.beginPath();
                ctx.ellipse(sx - 1.4, 1.4, 1.6, 2.2, -0.3, 0, TAU);
                ctx.fill();
                ctx.strokeStyle = '#b85e2a';
                ctx.lineWidth = 0.9;
                ctx.beginPath();
                ctx.moveTo(sx - 2.4, 0);
                ctx.lineTo(sx - 2.8, -2);
                ctx.stroke();
              }
            }
          } else if (p.crop === 'corn') {
            for (let i = -1; i <= 1; i++) {
              const sx = i * 17;
              const sh = 10 + g * 24;
              const sway = Math.sin(t * 1.2 + i) * 2;
              ctx.strokeStyle = '#4f8f4a';
              ctx.lineWidth = 2.4;
              ctx.beginPath();
              ctx.moveTo(sx, 7);
              ctx.quadraticCurveTo(sx + sway * 0.4, 7 - sh * 0.6, sx + sway, 7 - sh);
              ctx.stroke();
              for (let l = 0; l < 3; l++) {
                const ly = 7 - sh * (0.3 + l * 0.22);
                const dir = l % 2 ? 1 : -1;
                ctx.fillStyle = '#5fa054';
                ctx.beginPath();
                ctx.ellipse(sx + dir * 6 + sway * 0.5, ly, 6.5, 2.4, dir * 0.5, 0, TAU);
                ctx.fill();
              }
              if (p.state === 'ripe') {
                const cy = 7 - sh * 0.58;
                ctx.fillStyle = '#f2c66a';
                ctx.beginPath();
                ctx.ellipse(sx + 4, cy, 3.6, 7.2, 0.2, 0, TAU);
                ctx.fill();
                ctx.strokeStyle = '#d9a93f';
                ctx.lineWidth = 0.8;
                for (let k = -1; k <= 1; k++) {
                  ctx.beginPath();
                  ctx.moveTo(sx + 4 + k * 1.8, cy - 6);
                  ctx.lineTo(sx + 4 + k * 1.8, cy + 6);
                  ctx.stroke();
                }
                ctx.fillStyle = '#6e7a3a';
                ctx.beginPath();
                ctx.ellipse(sx + 2, cy - 4, 2, 5, -0.3, 0, TAU);
                ctx.fill();
              }
            }
          } else {
            for (let i = -1; i <= 1; i++) {
              const sx = i * 17;
              const sh = 6 + g * 17;
              ctx.strokeStyle = '#4f8f4a';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(sx, 5);
              ctx.quadraticCurveTo(sx + 1, 5 - sh * 0.6, sx + Math.sin(t * 1.2 + i) * 2, 5 - sh);
              ctx.stroke();
              ctx.fillStyle = '#5fa054';
              ctx.beginPath();
              ctx.ellipse(sx - 3.4, 5 - sh * 0.5, 4.2, 2.4, -0.5, 0, TAU);
              ctx.fill();
              ctx.beginPath();
              ctx.ellipse(sx + 3.4, 5 - sh * 0.7, 4, 2.3, 0.5, 0, TAU);
              ctx.fill();
              if (p.state === 'ripe') {
                for (let b = 0; b < 3; b++) {
                  const bx = sx - 4 + b * 4;
                  const by = 4 - sh + (b % 2) * 2;
                  ctx.fillStyle = '#c94b6b';
                  ctx.beginPath();
                  ctx.arc(bx, by, 2.8, 0, TAU);
                  ctx.fill();
                  ctx.fillStyle = '#f29cba';
                  ctx.beginPath();
                  ctx.arc(bx - 0.8, by - 0.8, 0.9, 0, TAU);
                  ctx.fill();
                }
                ctx.strokeStyle = 'rgba(200, 230, 130, 0.5)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(sx + 4, 6 - sh);
                ctx.quadraticCurveTo(sx + 9, 4 - sh, sx + 10, 7 - sh);
                ctx.stroke();
              }
            }
          }

          if (p.state === 'growing') {
            ctx.fillStyle = 'rgba(20, 30, 22, 0.35)';
            rr(ctx, -20, -h / 2 - 10, 40, 5, 2.5);
            ctx.fill();
            ctx.fillStyle = crop.color;
            rr(ctx, -20, -h / 2 - 10, 40 * p.growth, 5, 2.5);
            ctx.fill();
          }
        }
      }

      ctx.restore();
    }
  }

  /* ---------------- nodes ---------------- */

  drawNode(ctx, n, t) {
    const conf = NODE_TYPES[n.type];
    if (!conf) return;

    const shake = n.shake > 0 ? Math.sin(t * 55 + n.seed) * n.shake : 0;
    ctx.save();
    ctx.translate(n.x + shake, n.y);

    if (!n.alive) {
      this.drawDepleted(ctx, n);
      ctx.restore();
      return;
    }

    const sway = n.type === 'tree' || n.type === 'appleTree'
      ? Math.sin(t * 0.9 + n.seed) * 2.2
      : Math.sin(t * 1.4 + n.seed) * 1.1;
    ctx.translate(sway, 0);

    switch (n.type) {
      case 'tree':
        this.drawTree(ctx, n, t);
        break;
      case 'appleTree':
        this.drawAppleTree(ctx, n, t);
        break;
      case 'nutTree':
        this.drawAppleTree(ctx, n, t, true);
        break;
      case 'rock':
        this.drawRock(ctx, n, false);
        break;
      case 'ore':
        this.drawRock(ctx, n, 'ore');
        break;
      case 'crystal':
        this.drawCrystal(ctx, n, t);
        break;
      case 'bush':
        this.drawBush(ctx, n, t);
        break;
      case 'mush':
        this.drawMushroom(ctx, n, t);
        break;
      case 'hive':
        this.drawHive(ctx, n, t);
        break;
      case 'pond':
        this.drawFishingSpot(ctx, n, t);
        break;
      case 'herb':
        this.drawHerb(ctx, n, t);
        break;
      case 'clay':
        this.drawClay(ctx, n, t);
        break;
      case 'reed':
        this.drawReed(ctx, n, t);
        break;
      default:
        this.drawFiber(ctx, n, t);
        break;
    }

    ctx.restore();
  }

  drawTree(ctx, n, t) {
    const s = 0.92 + ((n.seed * 13) % 10) * 0.018;
    ctx.save();
    ctx.scale(s, s);

    ctx.fillStyle = 'rgba(28, 56, 32, 0.2)';
    ellipse(ctx, 3, 4, 31, 10);

    ctx.fillStyle = '#6e472d';
    ctx.beginPath();
    ctx.ellipse(-11, 1, 8, 3.6, -0.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(11, 2, 7, 3.2, 0.3, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#8a5a3b';
    ctx.beginPath();
    ctx.moveTo(-6, 2);
    ctx.quadraticCurveTo(-4.6, -20, -3.6, -43);
    ctx.lineTo(3.6, -43);
    ctx.quadraticCurveTo(4.8, -20, 6, 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6d4429';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(109, 68, 41, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-2.4, -4);
    ctx.quadraticCurveTo(-4, -20, -2.4, -38);
    ctx.moveTo(2.2, -8);
    ctx.quadraticCurveTo(3.4, -24, 2, -36);
    ctx.stroke();

    ctx.strokeStyle = '#7d5133';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(-13, -40);
    ctx.moveTo(0, -37);
    ctx.lineTo(12, -46);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-13, -40);
    ctx.lineTo(-19, -47);
    ctx.moveTo(12, -46);
    ctx.lineTo(19, -52);
    ctx.stroke();

    const dark = '#2f6a35';
    const mid = '#3f7a3e';
    const light = '#4f8f4a';
    blob(ctx, -18, -54, 19, 16, -0.2, dark);
    blob(ctx, 17, -56, 18, 15, 0.2, dark);
    blob(ctx, 0, -70, 23, 20, 0, dark);
    blob(ctx, -12, -60, 15, 13, -0.3, mid);
    blob(ctx, 12, -64, 14, 12, 0.25, mid);
    blob(ctx, 0, -74, 17, 14, 0, mid);
    blob(ctx, -8, -66, 10, 8, -0.2, light);
    blob(ctx, 8, -72, 9, 7, 0.2, light);
    blob(ctx, 0, -80, 8, 6, 0, light);

    ctx.fillStyle = 'rgba(160, 216, 128, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-11, -77, 7, 4, -0.4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(9, -70, 5, 3, 0.3, 0, TAU);
    ctx.fill();

    const sway = Math.sin(t * 1.4 + n.seed) * 1.6;
    ctx.fillStyle = '#5fa054';
    ctx.beginPath();
    ctx.ellipse(-24 + sway, -43, 5, 3, -0.4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(22 + sway * 0.7, -46, 4.4, 2.6, 0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#79b566';
    ctx.beginPath();
    ctx.ellipse(-21 + sway, -47, 3, 1.8, -0.4, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  drawAppleTree(ctx, n, t, nut = false) {
    const s = 0.88 + ((n.seed * 7) % 10) * 0.016;
    const health = n.hp / n.maxHp;
    ctx.save();
    ctx.scale(s, s);

    ctx.fillStyle = 'rgba(28, 56, 32, 0.18)';
    ellipse(ctx, 2, 3, 25, 8);

    ctx.fillStyle = '#7d5133';
    ctx.beginPath();
    ctx.moveTo(-4.6, 2);
    ctx.quadraticCurveTo(-3.4, -18, -2.6, -34);
    ctx.lineTo(3, -34);
    ctx.quadraticCurveTo(4, -16, 5, 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#63401f';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.strokeStyle = '#6e472d';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -25);
    ctx.lineTo(-12, -34);
    ctx.moveTo(0, -29);
    ctx.lineTo(12, -37);
    ctx.stroke();

    blob(ctx, -13, -42, 15, 12, -0.25, '#3d7a3c');
    blob(ctx, 13, -44, 14, 11, 0.25, '#3d7a3c');
    blob(ctx, 0, -53, 17, 14, 0, '#3d7a3c');
    blob(ctx, -8, -48, 11, 9, -0.2, '#4f8f4a');
    blob(ctx, 8, -51, 10, 8, 0.2, '#4f8f4a');
    blob(ctx, 0, -58, 11, 9, 0, '#5fa054');
    ctx.fillStyle = 'rgba(170, 224, 140, 0.4)';
    ctx.beginPath();
    ctx.ellipse(-5, -56, 5, 3, -0.3, 0, TAU);
    ctx.fill();

    const spots = [
      [-15, -44], [12, -40], [0, -48], [-7, -36], [16, -51], [4, -57],
    ];
    const count = Math.max(1, Math.round(spots.length * health));
    for (let i = 0; i < count; i++) {
      const [ax, ay] = spots[i];
      const bob = Math.sin(t * 1.6 + i + n.seed) * 0.5;
      if (nut) {
        ctx.fillStyle = '#8a5a3b';
        ctx.beginPath();
        ctx.arc(ax, ay + bob, 2.7, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#c9a06f';
        ctx.beginPath();
        ctx.arc(ax - 0.8, ay - 0.8 + bob, 0.9, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#6e472d';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(ax, ay - 2.6 + bob);
        ctx.lineTo(ax + 0.7, ay - 4 + bob);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#c93a3a';
        ctx.beginPath();
        ctx.arc(ax, ay + bob, 2.9, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#f07a6a';
        ctx.beginPath();
        ctx.arc(ax - 0.9, ay - 0.9 + bob, 1, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#6e472d';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(ax, ay - 2.8 + bob);
        ctx.lineTo(ax + 0.8, ay - 4.2 + bob);
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#5fa054';
    ctx.beginPath();
    ctx.ellipse(-20, -32, 4, 2.2, -0.4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(20, -35, 3.6, 2, 0.4, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  drawRock(ctx, n, variant) {
    const ore = variant === 'ore';
    ctx.fillStyle = 'rgba(28, 56, 32, 0.18)';
    ellipse(ctx, 0, 3, 27, 9);

    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.sin(n.seed * 3 + i * 2.3) * 0.12;
      const r = 15 + Math.sin(n.seed * 7 + i * 1.7) * 5;
      pts.push([Math.cos(a) * r, -13 + Math.sin(a) * r * 0.78]);
    }

    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = ore ? '#8a94a0' : '#919aa4';
    ctx.fill();
    ctx.strokeStyle = '#68727c';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pts[6][0], pts[6][1]);
    ctx.lineTo(pts[7][0], pts[7][1]);
    ctx.lineTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[1][0], pts[1][1]);
    ctx.lineTo(2, -20);
    ctx.closePath();
    ctx.fillStyle = '#b6bec7';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(pts[2][0], pts[2][1]);
    ctx.lineTo(pts[3][0], pts[3][1]);
    ctx.lineTo(pts[4][0], pts[4][1]);
    ctx.lineTo(4, -8);
    ctx.closePath();
    ctx.fillStyle = 'rgba(90, 100, 110, 0.5)';
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-9, -20);
    ctx.lineTo(1, -24);
    ctx.moveTo(-12, -10);
    ctx.lineTo(-6, -8);
    ctx.stroke();

    ctx.fillStyle = 'rgba(88, 140, 74, 0.75)';
    ctx.beginPath();
    ctx.ellipse(-10, -5, 6, 2.6, 0.15, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(9, -4, 5, 2.2, -0.2, 0, TAU);
    ctx.fill();

    if (ore) {
      const specks = [
        [-7, -14], [2, -10], [8, -18], [-2, -21], [11, -9], [-11, -19],
      ];
      for (const [sx, sy] of specks) {
        ctx.fillStyle = 'rgba(224, 138, 74, 0.28)';
        ctx.beginPath();
        ctx.arc(sx, sy, 4.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#e08a4a';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#f6d08a';
        ctx.beginPath();
        ctx.arc(sx - 0.6, sy - 0.7, 0.9, 0, TAU);
        ctx.fill();
      }
    }
  }

  drawCrystal(ctx, n, t) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 2 + n.seed);
    const glow = ctx.createRadialGradient(0, -16, 2, 0, -16, 42);
    glow.addColorStop(0, `rgba(178, 150, 255, ${0.18 + pulse * 0.1})`);
    glow.addColorStop(1, 'rgba(178, 150, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -16, 42, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(28, 56, 32, 0.16)';
    ellipse(ctx, 0, 3, 24, 8);

    ctx.fillStyle = '#7f8891';
    ctx.beginPath();
    ctx.ellipse(-11, -2, 10, 5, -0.15, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(10, -1, 9, 4.5, 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#9aa3ad';
    ctx.beginPath();
    ctx.ellipse(-10, -4, 7, 3, -0.15, 0, TAU);
    ctx.fill();

    const shards = [
      [-9, -4, 8, -28, -13, -4],
      [1, -2, 6, -38, -3, -2],
      [9, -3, 12, -21, 16, -3],
      [-2, -4, 3, -18, 2, -4],
    ];
    for (let i = 0; i < shards.length; i++) {
      const [x1, y1, tx, ty, x2, y2] = shards[i];
      const grad = ctx.createLinearGradient(x1, y1, tx, ty);
      grad.addColorStop(0, '#6f5bb0');
      grad.addColorStop(0.55, '#a78fe8');
      grad.addColorStop(1, '#e8dcff');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(tx, ty);
      ctx.lineTo(x2, y2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(240, 230, 255, 0.5)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
      ctx.beginPath();
      ctx.moveTo(x1 + 1, y1 - 2);
      ctx.lineTo(tx + 0.5, ty + 4);
      ctx.lineTo(tx + 2.4, ty + 5);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#5fa054';
    ctx.beginPath();
    ctx.ellipse(-15, -1, 5, 2.2, 0.2, 0, TAU);
    ctx.fill();
  }

  drawBush(ctx, n, t) {
    ctx.fillStyle = 'rgba(28, 56, 32, 0.16)';
    ellipse(ctx, 0, 3, 22, 7);

    const health = n.hp / n.maxHp;

    blob(ctx, -10, -10, 13, 10, -0.2, '#33702f');
    blob(ctx, 10, -11, 12, 9.5, 0.2, '#33702f');
    blob(ctx, 0, -17, 14, 10.5, 0, '#33702f');
    blob(ctx, -7, -17, 10, 8, -0.3, '#4c8a46');
    blob(ctx, 8, -14, 8.5, 6.5, 0.3, '#4c8a46');
    blob(ctx, 0, -21, 9.5, 7, 0, '#5fa054');
    ctx.fillStyle = 'rgba(155, 212, 120, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-4, -23, 4.6, 2.6, -0.3, 0, TAU);
    ctx.fill();

    const berryCount = Math.max(1, Math.round(8 * health));
    const berrySpots = [
      [-11, -13], [5, -8], [11, -15], [-3, -22], [0, -10], [14, -8], [-14, -19], [6, -21],
    ];
    for (let i = 0; i < berryCount; i++) {
      const [bx, by] = berrySpots[i];
      const bob = Math.sin(t * 2 + i) * 0.5;
      ctx.fillStyle = 'rgba(201, 75, 107, 0.22)';
      ctx.beginPath();
      ctx.arc(bx, by + bob, 4.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#c94b6b';
      ctx.beginPath();
      ctx.arc(bx, by + bob, 2.7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f29cba';
      ctx.beginPath();
      ctx.arc(bx - 0.7, by - 0.8 + bob, 0.9, 0, TAU);
      ctx.fill();
    }

    if (health > 0.5) {
      ctx.fillStyle = '#f2e6cf';
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.arc(-12 + i * 22, -25, 1.4, 0, TAU);
        ctx.fill();
      }
    }
  }

  drawMushroom(ctx, n, t) {
    ctx.fillStyle = 'rgba(28, 56, 32, 0.13)';
    ellipse(ctx, 0, 2, 18, 5.5);

    const spots = [
      [-8, -3, 1],
      [6, -1, 0.85],
      [0, -8, 0.7],
    ];
    for (let i = 0; i < spots.length; i++) {
      const [mx, my, scale] = spots[i];
      const bob = Math.sin(t * 1.6 + i + n.seed) * 0.6;
      ctx.save();
      ctx.translate(mx, my + bob);
      ctx.scale(scale, scale);

      ctx.fillStyle = '#efe2c8';
      rr(ctx, -2.4, -10, 4.8, 11, 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(190, 170, 140, 0.5)';
      rr(ctx, 0.6, -9, 1.6, 9, 1);
      ctx.fill();

      const cap = ctx.createLinearGradient(0, -17, 0, -10);
      cap.addColorStop(0, '#ef9b78');
      cap.addColorStop(1, '#c9694c');
      ctx.fillStyle = cap;
      ctx.beginPath();
      ctx.ellipse(0, -11, 8, 5.8, 0, Math.PI, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150, 78, 55, 0.55)';
      ctx.lineWidth = 0.9;
      ctx.stroke();

      ctx.fillStyle = '#f7d7c2';
      ctx.beginPath();
      ctx.arc(-2.5, -12.5, 1.3, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(2.2, -11, 1, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(5, -13.4, 0.7, 0, TAU);
      ctx.fill();

      ctx.restore();
    }

    ctx.strokeStyle = 'rgba(90, 130, 70, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-14, 1);
    ctx.quadraticCurveTo(-12, -4, -10, -6);
    ctx.moveTo(14, 1);
    ctx.quadraticCurveTo(13, -4, 11, -5);
    ctx.stroke();
  }

  drawFiber(ctx, n, t) {
    ctx.fillStyle = 'rgba(28, 56, 32, 0.1)';
    ellipse(ctx, 0, 2, 17, 4.5);

    for (let i = 0; i < 9; i++) {
      const offset = -12 + i * 3;
      const h = 14 + Math.sin(n.seed + i * 1.9) * 5;
      const sway = Math.sin(t * 1.6 + n.seed + i) * 2.6;
      ctx.strokeStyle = i % 2 ? '#7aa84f' : '#96bd61';
      ctx.lineWidth = 1.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(offset, 1);
      ctx.quadraticCurveTo(offset + sway * 0.5, -h * 0.55, offset + sway, -h);
      ctx.stroke();

      if (i === 1 || i === 4 || i === 7) {
        ctx.fillStyle = '#c9b26a';
        ctx.beginPath();
        ctx.ellipse(offset + sway, -h - 2.4, 1.7, 4, 0.12, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#e5d79a';
        ctx.beginPath();
        ctx.ellipse(offset + sway - 0.5, -h - 3.4, 0.7, 2, 0.12, 0, TAU);
        ctx.fill();
      }
    }
  }

  drawReed(ctx, n, t) {
    ctx.fillStyle = 'rgba(28, 56, 32, 0.1)';
    ellipse(ctx, 0, 2, 17, 4.5);

    for (let i = 0; i < 11; i++) {
      const offset = -14 + i * 2.8;
      const h = 22 + Math.sin(n.seed + i * 1.7) * 6;
      const sway = Math.sin(t * 1.4 + n.seed + i) * 3;
      ctx.strokeStyle = i % 3 === 0 ? '#7fae62' : i % 2 ? '#5f9a55' : '#8fbf6c';
      ctx.lineWidth = 1.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(offset, 1);
      ctx.quadraticCurveTo(offset + sway * 0.4, -h * 0.5, offset + sway, -h);
      ctx.stroke();

      if (i % 2 === 0) {
        ctx.fillStyle = '#8a6a3c';
        ctx.beginPath();
        ctx.ellipse(offset + sway, -h - 3.4, 2.1, 5.5, 0.12, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#c9a06f';
        ctx.beginPath();
        ctx.ellipse(offset + sway - 0.6, -h - 4.4, 0.8, 2.4, 0.12, 0, TAU);
        ctx.fill();
      }
    }
  }

  drawHerb(ctx, n, t) {
    ctx.fillStyle = 'rgba(28, 56, 32, 0.11)';
    ellipse(ctx, 0, 2, 16, 4.6);

    const stems = [
      [-7, -14, -0.3],
      [0, -19, 0],
      [7, -13, 0.3],
      [-3, -10, -0.15],
      [4, -9, 0.2],
    ];
    for (let i = 0; i < stems.length; i++) {
      const [sx, sy, a] = stems[i];
      const sway = Math.sin(t * 1.8 + i + n.seed) * 1.4;
      ctx.strokeStyle = '#4f8f4a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, 1);
      ctx.quadraticCurveTo(sx * 0.4 + sway * 0.4, sy * 0.5, sx + sway, sy);
      ctx.stroke();

      ctx.fillStyle = i % 2 ? '#6fae54' : '#8fc46b';
      ctx.beginPath();
      ctx.ellipse(sx - 3 + sway, sy + 2, 3.8, 2.2, a - 0.3, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(sx + 3 + sway, sy + 3, 3.6, 2, a + 0.3, 0, TAU);
      ctx.fill();
    }

    for (let i = 0; i < 3; i++) {
      const fx = -6 + i * 6;
      const fy = -17 - (i % 2) * 3;
      ctx.fillStyle = '#f7f2df';
      for (let p = 0; p < 4; p++) {
        const a = (p / 4) * TAU;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(a) * 1.7, fy + Math.sin(a) * 1.7, 1.2, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#e5b84b';
      ctx.beginPath();
      ctx.arc(fx, fy, 1, 0, TAU);
      ctx.fill();
    }
  }

  drawClay(ctx, n, t) {
    ctx.fillStyle = 'rgba(28, 56, 32, 0.14)';
    ellipse(ctx, 0, 3, 20, 7);

    ctx.fillStyle = '#8a6547';
    ctx.beginPath();
    ctx.ellipse(0, -2, 18, 9, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#a97c57';
    ctx.beginPath();
    ctx.ellipse(-2, -5, 13, 7, -0.08, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#c39669';
    ctx.beginPath();
    ctx.ellipse(-5, -7.5, 6, 4, -0.2, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(110, 81, 54, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-10, -5);
    ctx.quadraticCurveTo(-4, -8, 2, -7);
    ctx.moveTo(4, -2);
    ctx.quadraticCurveTo(9, -4, 13, -2);
    ctx.stroke();

    const sheen = 0.25 + 0.15 * Math.sin(t * 1.6 + n.seed);
    ctx.fillStyle = `rgba(230, 200, 160, ${sheen})`;
    ctx.beginPath();
    ctx.ellipse(-7, -9, 5, 2.2, -0.25, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#9aa3ad';
    ctx.beginPath();
    ctx.ellipse(12, -1, 3.2, 2.2, 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#b6bec7';
    ctx.beginPath();
    ctx.ellipse(11.4, -1.6, 1.6, 1, 0.2, 0, TAU);
    ctx.fill();
  }

  drawHive(ctx, n, t) {
    ctx.fillStyle = 'rgba(28, 56, 32, 0.16)';
    ellipse(ctx, 0, 3, 20, 7);

    ctx.fillStyle = '#7a5236';
    rr(ctx, -11, -12, 22, 14, 4);
    ctx.fill();
    ctx.strokeStyle = '#5f3f27';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#a97c50';
    ctx.beginPath();
    ctx.ellipse(0, -12, 11, 4.4, 0, 0, TAU);
    ctx.fill();

    const baseY = -13;
    ctx.fillStyle = '#d9b355';
    ctx.beginPath();
    ctx.ellipse(0, baseY - 13, 14, 14, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#c99b3f';
    for (let i = 0; i < 4; i++) {
      const y = baseY - 4 - i * 4.2;
      const w = 14 - i * 1.6;
      ctx.beginPath();
      ctx.ellipse(0, y, w, 3, 0, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = 'rgba(122, 80, 30, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, y, w, 3, 0, 0, Math.PI);
      ctx.stroke();
    }
    ctx.fillStyle = '#5b4022';
    ctx.beginPath();
    ctx.ellipse(0, baseY - 2, 3.2, 4, 0, 0, TAU);
    ctx.fill();

    for (let i = 0; i < 3; i++) {
      const a = t * (1.2 + i * 0.25) + n.seed + i * 2.1;
      const bx = Math.cos(a) * (18 + i * 3);
      const by = baseY - 17 + Math.sin(a * 1.4) * 8;
      ctx.fillStyle = 'rgba(255, 220, 130, 0.24)';
      ctx.beginPath();
      ctx.arc(bx, by, 4.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e5b64b';
      ctx.beginPath();
      ctx.arc(bx, by, 1.8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#3a2f20';
      ctx.beginPath();
      ctx.arc(bx + 0.3, by, 0.7, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(bx - 1.6, by - 1);
      ctx.lineTo(bx - 3, by - 2.4);
      ctx.moveTo(bx + 1.6, by - 1);
      ctx.lineTo(bx + 3, by - 2.4);
      ctx.stroke();
    }
  }

  drawFishingSpot(ctx, n, t) {
    const active = n.alive;
    const ripple = active ? 1 : 0.35;
    ctx.fillStyle = 'rgba(180, 230, 235, 0.12)';
    for (let i = 0; i < 3; i++) {
      const phase = (t * 0.4 + i / 3) % 1;
      ctx.globalAlpha = (1 - phase) * 0.7 * ripple;
      ctx.strokeStyle = 'rgba(225, 248, 250, 0.6)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 10 + phase * 22, 4 + phase * 9, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (active) {
      const bob = Math.sin(t * 2.4 + n.seed) * 1.2;
      ctx.strokeStyle = 'rgba(40, 70, 60, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(0, -3 + bob);
      ctx.stroke();
      ctx.fillStyle = '#e0567a';
      ctx.beginPath();
      ctx.arc(0, -2 + bob, 2.8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f7f2df';
      ctx.beginPath();
      ctx.arc(0, -0.4 + bob, 2.3, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = 'rgba(220, 245, 248, 0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 1 + bob, 4.6, 2, 0, 0, TAU);
      ctx.fill();
    }
  }

  drawDepleted(ctx, n) {
    ctx.fillStyle = 'rgba(28, 56, 32, 0.12)';
    ellipse(ctx, 0, 2, 18, 6);

    if (n.type === 'tree' || n.type === 'appleTree') {
      ctx.fillStyle = '#8a5a3b';
      rr(ctx, -8, -13, 16, 14, 3);
      ctx.fill();
      ctx.strokeStyle = '#6d4429';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.fillStyle = '#c9a06f';
      ctx.beginPath();
      ctx.ellipse(0, -13, 7, 3.6, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#a57c50';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, -13, 4, 2, 0, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#5fa054';
      ctx.beginPath();
      ctx.ellipse(8, -2, 3.4, 1.8, 0.4, 0, TAU);
      ctx.fill();
    } else if (n.type === 'rock' || n.type === 'ore') {
      ctx.fillStyle = '#9aa3ad';
      ctx.beginPath();
      ctx.ellipse(-5, -2, 4, 3, 0.3, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(6, -1, 3, 2.4, -0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#b6bec7';
      ctx.beginPath();
      ctx.ellipse(-5.6, -2.8, 1.6, 1, 0.3, 0, TAU);
      ctx.fill();
    } else if (n.type === 'crystal') {
      ctx.fillStyle = 'rgba(140, 120, 200, 0.5)';
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(-1, -10);
      ctx.lineTo(2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(3, 0);
      ctx.lineTo(6, -7);
      ctx.lineTo(8, 0);
      ctx.closePath();
      ctx.fill();
    } else if (n.type === 'bush' || n.type === 'herb') {
      ctx.strokeStyle = '#6b7a45';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-7, 1);
      ctx.lineTo(-9, -8);
      ctx.moveTo(0, 1);
      ctx.lineTo(2, -11);
      ctx.moveTo(6, 1);
      ctx.lineTo(10, -7);
      ctx.stroke();
      ctx.fillStyle = '#6b7a45';
      ctx.beginPath();
      ctx.ellipse(2, -6, 1.6, 1, 0.4, 0, TAU);
      ctx.fill();
    } else if (n.type === 'hive') {
      ctx.fillStyle = '#7a5236';
      rr(ctx, -10, -9, 20, 11, 3);
      ctx.fill();
      ctx.fillStyle = '#a97c50';
      ctx.beginPath();
      ctx.ellipse(0, -9, 10, 4, 0, 0, TAU);
      ctx.fill();
    } else if (n.type === 'clay') {
      ctx.fillStyle = '#6e5136';
      ctx.beginPath();
      ctx.ellipse(0, -1, 13, 5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(160, 120, 84, 0.5)';
      ctx.beginPath();
      ctx.ellipse(0, -1.5, 7, 2.4, 0, 0, TAU);
      ctx.fill();
    } else if (n.type === 'pond') {
      ctx.strokeStyle = 'rgba(225, 248, 250, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 6, 0, 0, TAU);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(90, 110, 70, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, -1, 6, 2.2, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(90, 110, 70, 0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(-8, -5);
      ctx.moveTo(5, 0);
      ctx.lineTo(6, -4);
      ctx.stroke();
    }

    const conf = NODE_TYPES[n.type];
    if (conf && n.respawn > 0) {
      const progress = clamp(1 - n.respawn / conf.respawn, 0, 1);
      ctx.strokeStyle = 'rgba(20, 32, 22, 0.35)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, -24, 7, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(170, 220, 140, 0.7)';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, -24, 7, -Math.PI / 2, -Math.PI / 2 + progress * TAU);
      ctx.stroke();
    }
  }

  /* ---------------- structures ---------------- */

  drawTent(ctx, t) {
    const { x, y } = this.tentPos;
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = 'rgba(28, 56, 32, 0.2)';
    ellipse(ctx, 2, 7, 49, 13);

    ctx.strokeStyle = 'rgba(120, 96, 64, 0.7)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-40, -2);
    ctx.lineTo(-54, 8);
    ctx.moveTo(40, -2);
    ctx.lineTo(54, 8);
    ctx.stroke();
    ctx.fillStyle = '#6e5136';
    rr(ctx, -56, 6, 4, 5, 1.5);
    ctx.fill();
    rr(ctx, 52, 6, 4, 5, 1.5);
    ctx.fill();

    const canvas = ctx.createLinearGradient(-40, -60, 40, 0);
    canvas.addColorStop(0, '#e6d6b4');
    canvas.addColorStop(0.55, '#d9c9a8');
    canvas.addColorStop(1, '#bfae8c');
    ctx.fillStyle = canvas;
    ctx.beginPath();
    ctx.moveTo(-43, 0);
    ctx.quadraticCurveTo(-20, -34, 0, -62);
    ctx.quadraticCurveTo(20, -34, 43, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#a8946f';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(150, 128, 92, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-22, -2);
    ctx.quadraticCurveTo(-10, -30, 0, -55);
    ctx.moveTo(22, -2);
    ctx.quadraticCurveTo(10, -30, 0, -55);
    ctx.stroke();
    blob(ctx, -28, -11, 7, 4, -0.4, 'rgba(180, 150, 108, 0.28)');
    blob(ctx, 26, -8, 6, 3.5, 0.4, 'rgba(180, 150, 108, 0.24)');

    ctx.fillStyle = '#3a2f26';
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.lineTo(0, -46);
    ctx.lineTo(15, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4d4032';
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.lineTo(0, -46);
    ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 235, 190, 0.16)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.lineTo(-4, -34);
    ctx.stroke();

    ctx.strokeStyle = '#8a5a3b';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -62);
    ctx.lineTo(0, -72);
    ctx.stroke();

    const flap = Math.sin(t * 2.2) * 2.2;
    ctx.fillStyle = '#ffcf6b';
    ctx.beginPath();
    ctx.moveTo(0, -72);
    ctx.quadraticCurveTo(8 + flap, -69, 14 + flap, -65);
    ctx.quadraticCurveTo(7 + flap, -64, 0, -62);
    ctx.closePath();
    ctx.fill();

    const lampX = 31;
    const lampY = -26;
    ctx.strokeStyle = '#6e5136';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(27, -39);
    ctx.lineTo(lampX, lampY - 8);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 210, 120, 0.22)';
    ctx.beginPath();
    ctx.arc(lampX, lampY, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e5a83c';
    rr(ctx, lampX - 3, lampY - 6, 6, 8, 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9ab';
    rr(ctx, lampX - 1.6, lampY - 4, 3.2, 4, 1.4);
    ctx.fill();

    ctx.fillStyle = 'rgba(140, 110, 75, 0.55)';
    rr(ctx, -10, 1, 20, 5, 2);
    ctx.fill();

    ctx.restore();
  }

  drawStall(ctx, t) {
    const { x, y } = this.stallPos;
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = 'rgba(28, 56, 32, 0.2)';
    ellipse(ctx, 2, 7, 59, 14);

    ctx.strokeStyle = '#6d4429';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-44, -72);
    ctx.lineTo(-44, 0);
    ctx.moveTo(44, -72);
    ctx.lineTo(44, 0);
    ctx.stroke();
    ctx.strokeStyle = '#a9713f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-45.5, -70);
    ctx.lineTo(-45.5, -2);
    ctx.moveTo(42.5, -70);
    ctx.lineTo(42.5, -2);
    ctx.stroke();

    ctx.fillStyle = '#a9713f';
    rr(ctx, -50, -26, 100, 24, 5);
    ctx.fill();
    ctx.fillStyle = '#c48a52';
    rr(ctx, -52, -32, 104, 9, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110, 68, 41, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-46, -18);
    ctx.lineTo(46, -18);
    ctx.stroke();

    ctx.fillStyle = '#b9814a';
    rr(ctx, -37, -45, 24, 15, 3);
    ctx.fill();
    ctx.strokeStyle = '#8a5a3b';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#c94b6b' : '#e0567a';
      ctx.beginPath();
      ctx.arc(-32 + (i % 3) * 7, -47 + Math.floor(i / 3) * 5, 2.7, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = '#b9814a';
    rr(ctx, 8, -44, 24, 14, 3);
    ctx.fill();
    ctx.strokeStyle = '#8a5a3b';
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#d9534f';
      ctx.beginPath();
      ctx.arc(14 + i * 6, -41, 3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f07a6a';
      ctx.beginPath();
      ctx.arc(13 + i * 6, -42, 0.9, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = '#c9702a';
    ctx.beginPath();
    ctx.ellipse(-19, -38, 6, 4.6, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(130, 70, 30, 0.6)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(-19, -38, 2.6, 4.2, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#6e7a3a';
    rr(ctx, -20, -43, 2, 3.4, 1);
    ctx.fill();
    ctx.fillStyle = '#c96b4a';
    rr(ctx, 34, -42, 7, 9, 2);
    ctx.fill();
    ctx.fillStyle = '#f2c66a';
    rr(ctx, 34.6, -40, 5.8, 3, 1);
    ctx.fill();

    const stripes = 7;
    const stripeW = 108 / stripes;
    for (let i = 0; i < stripes; i++) {
      const sx = -54 + i * stripeW;
      ctx.fillStyle = i % 2 ? '#f2e6cf' : '#dd5a48';
      ctx.beginPath();
      ctx.moveTo(sx, -80);
      ctx.lineTo(sx + stripeW, -80);
      ctx.lineTo(sx + stripeW, -50);
      ctx.arc(sx + stripeW / 2, -50, stripeW / 2, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(120, 50, 38, 0.18)';
    for (let i = 0; i < stripes; i += 2) {
      ctx.fillRect(-54 + i * stripeW, -80, stripeW, 4);
    }

    ctx.fillStyle = '#7a4f2f';
    rr(ctx, -56, -84, 112, 6, 3);
    ctx.fill();

    const bunting = ['#ffcf6b', '#8fd18a', '#e0567a', '#9fd8c0'];
    ctx.strokeStyle = 'rgba(90, 70, 45, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-52, -84);
    ctx.quadraticCurveTo(0, -74, 52, -84);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const bx = -42 + i * 17;
      const by = -81 + Math.abs(i - 2.5) * 1.6;
      ctx.fillStyle = bunting[i % bunting.length];
      ctx.beginPath();
      ctx.moveTo(bx - 4, by);
      ctx.lineTo(bx + 4, by);
      ctx.lineTo(bx, by + 7);
      ctx.closePath();
      ctx.fill();
    }

    const sway = Math.sin(t * 1.6) * 0.05;
    ctx.save();
    ctx.translate(0, -40);
    ctx.rotate(sway);
    ctx.strokeStyle = '#6e5136';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-10, -12);
    ctx.lineTo(-10, 2);
    ctx.moveTo(10, -12);
    ctx.lineTo(10, 2);
    ctx.stroke();
    ctx.fillStyle = '#f2e6cf';
    rr(ctx, -16, 2, 32, 19, 4);
    ctx.fill();
    ctx.strokeStyle = '#b7a483';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = '#b9814a';
    ctx.font = 'bold 9px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TRADER', 0, 11.5);
    ctx.restore();

    ctx.strokeStyle = '#6e5136';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, -70);
    ctx.lineTo(50, -60);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 210, 120, 0.2)';
    ctx.beginPath();
    ctx.arc(50, -58, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e5a83c';
    rr(ctx, 47.5, -62, 5, 7, 1.8);
    ctx.fill();

    ctx.restore();
  }

  drawCampfire(ctx, t, built, hearth) {
    const { x, y } = this.campfirePos;
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = 'rgba(28, 56, 32, 0.2)';
    ellipse(ctx, 0, 4, hearth ? 38 : 31, 11);

    const stones = hearth ? 12 : 9;
    const ringR = hearth ? 32 : 26;
    for (let i = 0; i < stones; i++) {
      const a = (i / stones) * TAU;
      const sx = Math.cos(a) * ringR;
      const sy = Math.sin(a) * (hearth ? 11 : 9);
      ctx.fillStyle = i % 2 ? '#8f98a2' : '#a8b1ba';
      ctx.beginPath();
      ctx.ellipse(sx, sy, hearth ? 6.4 : 5.4, hearth ? 4.8 : 4.2, a, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.beginPath();
      ctx.ellipse(sx - 1, sy - 1.4, hearth ? 2.4 : 2, 1.1, a, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = '#5b4632';
    ellipse(ctx, 0, 0, hearth ? 23 : 19, hearth ? 8 : 6);

    ctx.strokeStyle = '#7a5236';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-13, 3);
    ctx.lineTo(12, -5);
    ctx.moveTo(-11, -5);
    ctx.lineTo(13, 3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200, 160, 110, 0.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(10, -4);
    ctx.lineTo(13, 3);
    ctx.stroke();

    if (built) {
      const flick = Math.sin(t * 9) * 2 + Math.sin(t * 21) * 1.2;
      const big = hearth ? 1.25 : 1;
      ctx.fillStyle = 'rgba(255, 140, 60, 0.2)';
      ctx.beginPath();
      ctx.arc(0, -12, (hearth ? 30 : 24) + flick, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#e8622f';
      ctx.beginPath();
      ctx.moveTo(-12 * big, -2);
      ctx.quadraticCurveTo(-14 * big, -20 - flick, 0, -32 * big - flick);
      ctx.quadraticCurveTo(13 * big, -19 + flick, 11 * big, -2);
      ctx.quadraticCurveTo(0, 4, -12 * big, -2);
      ctx.fill();

      ctx.fillStyle = '#ffb03a';
      ctx.beginPath();
      ctx.moveTo(-7 * big, -3);
      ctx.quadraticCurveTo(-8 * big, -15 - flick, 0, -24 * big - flick);
      ctx.quadraticCurveTo(8 * big, -14 + flick, 6 * big, -3);
      ctx.quadraticCurveTo(0, 1, -7 * big, -3);
      ctx.fill();

      ctx.fillStyle = '#ffe7a3';
      ctx.beginPath();
      ctx.moveTo(-3, -4);
      ctx.quadraticCurveTo(-4, -10, 0, -15);
      ctx.quadraticCurveTo(4, -9, 3, -4);
      ctx.quadraticCurveTo(0, -2, -3, -4);
      ctx.fill();

      if (hearth) {
        ctx.strokeStyle = '#5b4632';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-20, -4);
        ctx.lineTo(0, -42);
        ctx.moveTo(20, -4);
        ctx.lineTo(0, -42);
        ctx.moveTo(0, -42);
        ctx.lineTo(0, -30);
        ctx.stroke();
        ctx.fillStyle = '#3a3f42';
        ctx.beginPath();
        ctx.ellipse(0, -24, 9, 7, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#4d5458';
        ctx.beginPath();
        ctx.ellipse(-2, -26, 5, 3, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#2c3033';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-9, -25);
        ctx.lineTo(-13, -27);
        ctx.moveTo(9, -25);
        ctx.lineTo(13, -27);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = 'rgba(60, 62, 58, 0.5)';
      ellipse(ctx, 0, -2, 8, 3.4);
    }

    ctx.restore();
  }

  drawDock(ctx) {
    const d = this.dock;
    ctx.save();

    ctx.fillStyle = 'rgba(20, 42, 52, 0.22)';
    rr(ctx, d.x1 + 5, d.y1 + 7, d.x2 - d.x1, d.y2 - d.y1, 8);
    ctx.fill();

    ctx.fillStyle = '#5f4027';
    for (const px of [d.x1 + 6, (d.x1 + d.x2) / 2, d.x2 - 6]) {
      for (const py of [d.y1 + 4, d.y2 - 4]) {
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, TAU);
        ctx.fill();
      }
    }

    const planks = 9;
    const step = (d.x2 - d.x1) / planks;
    for (let i = 0; i < planks; i++) {
      const px = d.x1 + i * step;
      ctx.fillStyle = i % 2 ? '#a97c50' : '#b98a58';
      rr(ctx, px + 1, d.y1, step - 2, d.y2 - d.y1, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(110, 68, 41, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(220, 170, 120, 0.25)';
      ctx.fillRect(px + 3, d.y1 + 3, step - 6, 2);
    }

    ctx.strokeStyle = '#8a7a55';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(d.x1 + 8, d.y1 + 10, 5, 3, 0.4, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#6e5136';
    rr(ctx, d.x2 - 12, d.y1 + 6, 8, 3, 1);
    ctx.fill();

    ctx.restore();
  }

  /* ---------------- critters & ambient ---------------- */

  drawCoop(ctx, t) {
    const p = this.coopPos;
    ctx.save();
    ctx.translate(p.x, p.y);

    ctx.fillStyle = 'rgba(28, 56, 32, 0.16)';
    ellipse(ctx, 2, 4, 34, 11);

    ctx.fillStyle = '#8a5a3b';
    rr(ctx, -30, -30, 60, 34, 6);
    ctx.fill();
    ctx.strokeStyle = '#6e472d';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#a9713f';
    rr(ctx, -27, -27, 54, 28, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110, 71, 45, 0.55)';
    ctx.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-26, -14 + i * 6);
      ctx.lineTo(26, -14 + i * 6);
      ctx.stroke();
    }

    ctx.fillStyle = '#8f4f32';
    ctx.beginPath();
    ctx.moveTo(-35, -28);
    ctx.lineTo(0, -54);
    ctx.lineTo(35, -28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6e3a24';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.fillStyle = '#5a341f';
    rr(ctx, -9, -23, 18, 27, 8);
    ctx.fill();
    ctx.fillStyle = '#3a2014';
    rr(ctx, -6, -20, 12, 23, 6);
    ctx.fill();

    ctx.strokeStyle = '#8a5a3b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-12, 4);
    ctx.lineTo(-26, 18);
    ctx.moveTo(12, 4);
    ctx.lineTo(26, 18);
    ctx.stroke();

    ctx.strokeStyle = '#c9b26a';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) {
      const sx = -22 + i * 9;
      const sway = Math.sin(t * 1.2 + i) * 1.2;
      ctx.beginPath();
      ctx.moveTo(sx, 5);
      ctx.quadraticCurveTo(sx + sway, 11, sx + sway * 1.4, 15);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawApiary(ctx, t) {
    const p = this.apiaryPos;
    ctx.save();
    ctx.translate(p.x, p.y);

    ctx.fillStyle = 'rgba(28, 56, 32, 0.15)';
    ellipse(ctx, 1, 3, 22, 7);

    ctx.fillStyle = '#8a5a3b';
    rr(ctx, -17, -28, 34, 30, 4);
    ctx.fill();
    ctx.fillStyle = '#c9a06f';
    rr(ctx, -15, -26, 30, 26, 3);
    ctx.fill();
    ctx.strokeStyle = '#a9713f';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-14, -21 + i * 6);
      ctx.lineTo(14, -21 + i * 6);
      ctx.stroke();
    }

    ctx.fillStyle = '#8f4f32';
    ctx.beginPath();
    ctx.moveTo(-21, -27);
    ctx.lineTo(0, -40);
    ctx.lineTo(21, -27);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#4a2c18';
    ctx.beginPath();
    ctx.ellipse(0, -5, 3, 2.2, 0, 0, TAU);
    ctx.fill();

    for (let i = 0; i < 5; i++) {
      const a = t * 1.7 + i * 1.9;
      const bx = Math.cos(a) * (16 + Math.sin(t + i) * 4);
      const by = -18 + Math.sin(a * 1.3) * 12;
      ctx.fillStyle = 'rgba(255, 209, 102, 0.9)';
      ctx.beginPath();
      ctx.arc(bx, by, 1.3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60, 50, 30, 0.5)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(bx - 1.8, by - 1.8);
      ctx.lineTo(bx + 1.8, by + 1.8);
      ctx.moveTo(bx + 1.8, by - 1.8);
      ctx.lineTo(bx - 1.8, by + 1.8);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawWell(ctx, t) {
    const p = this.wellPos;
    ctx.save();
    ctx.translate(p.x, p.y);

    ctx.fillStyle = 'rgba(28, 56, 32, 0.16)';
    ellipse(ctx, 2, 4, 29, 9);

    ctx.fillStyle = '#9aa3ad';
    ctx.beginPath();
    ctx.ellipse(0, -2, 24, 12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#68727c';
    ctx.beginPath();
    ctx.ellipse(0, -2, 17, 7, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2f4858';
    ctx.beginPath();
    ctx.ellipse(0, -2, 15, 5.6, 0, 0, TAU);
    ctx.fill();

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.fillStyle = i % 2 ? '#919aa4' : '#b6bec7';
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 20, -2 + Math.sin(a) * 9, 5.4, 3.4, a, 0, TAU);
      ctx.fill();
    }

    ctx.strokeStyle = '#8a5a3b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-17, -8);
    ctx.lineTo(-17, -32);
    ctx.moveTo(17, -8);
    ctx.lineTo(17, -32);
    ctx.stroke();

    ctx.fillStyle = '#8f4f32';
    ctx.beginPath();
    ctx.moveTo(-24, -30);
    ctx.lineTo(0, -46);
    ctx.lineTo(24, -30);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6e3a24';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.strokeStyle = '#c9b26a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(0, -12);
    ctx.stroke();
    ctx.fillStyle = '#a9713f';
    rr(ctx, -5, -13, 10, 8, 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(212, 245, 248, 0.4)';
    ctx.lineWidth = 1;
    const ripple = (t * 0.7) % 1;
    ctx.beginPath();
    ctx.ellipse(0, -2, 4 + ripple * 8, 1.6 + ripple * 3, 0, 0, TAU);
    ctx.stroke();

    ctx.restore();
  }

  drawChicken(ctx, c, t) {
    const peck = c.moving ? 0 : Math.max(0, Math.sin(c.peckT)) * 2.6;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = 'rgba(28, 56, 32, 0.13)';
    ctx.beginPath();
    ctx.ellipse(0, 1, 8, 3, 0, 0, TAU);
    ctx.fill();
    ctx.scale(c.dir, 1);

    ctx.fillStyle = '#e8dcc2';
    ctx.beginPath();
    ctx.ellipse(0, -6, 8, 5.6, -0.05, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d6c7a6';
    ctx.beginPath();
    ctx.ellipse(-2, -6, 4.6, 4, -0.2, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#c9b895';
    ctx.beginPath();
    ctx.ellipse(-7, -8, 4, 2.8, 0.5, 0, TAU);
    ctx.fill();

    const headY = -12 + peck;
    ctx.fillStyle = '#e8dcc2';
    ctx.beginPath();
    ctx.arc(5.6, headY, 3.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#c93a3a';
    ctx.beginPath();
    ctx.arc(5.2, headY - 3.4, 1.7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8963c';
    ctx.beginPath();
    ctx.moveTo(8.6, headY);
    ctx.lineTo(12.4, headY + 0.8);
    ctx.lineTo(8.6, headY + 1.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2b2b26';
    ctx.beginPath();
    ctx.arc(6.6, headY - 0.6, 0.7, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = '#c98a3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(-2, 3);
    ctx.moveTo(3, 0);
    ctx.lineTo(3, 3);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(-1, -9, 3.4, 1.8, -0.3, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  drawRabbit(ctx, r, t) {
    const hop = r.moving ? Math.abs(Math.sin(r.hopT)) * 4.5 : 0;
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.fillStyle = 'rgba(28, 56, 32, 0.14)';
    ctx.beginPath();
    ctx.ellipse(0, 1, 10, 3.4, 0, 0, TAU);
    ctx.fill();
    ctx.translate(0, -hop);
    ctx.scale(r.dir, 1);

    const breath = Math.sin(t * 2 + r.seed) * 0.4;
    ctx.fillStyle = '#cbb598';
    ctx.beginPath();
    ctx.ellipse(0, -7 + breath, 9, 6.2, -0.05, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#b8a184';
    ctx.beginPath();
    ctx.ellipse(-4, -7, 5.6, 4.6, -0.15, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#f2ead8';
    ctx.beginPath();
    ctx.arc(-8, -7, 2.6, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#cbb598';
    ctx.beginPath();
    ctx.arc(7, -12 + breath, 4.4, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(5.6, -17 + breath);
    ctx.rotate(-0.32);
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.2, 6, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(9.2, -16.4 + breath);
    ctx.rotate(0.16);
    ctx.beginPath();
    ctx.ellipse(0, 0, 2, 5.6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8b9b0';
    ctx.beginPath();
    ctx.ellipse(0, 0.6, 1, 3.8, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#2b2b26';
    ctx.beginPath();
    ctx.arc(9, -13 + breath, 0.8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d98a8a';
    ctx.beginPath();
    ctx.arc(11.2, -11.4 + breath, 0.8, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#b8a184';
    ctx.beginPath();
    ctx.ellipse(3, -2 + Math.max(0, Math.sin(r.hopT + 1)) * (r.moving ? 2 : 0), 3, 1.8, 0.2, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  drawAmbient(ctx, t, night) {
    for (const a of this.ambient) {
      const px = a.x + Math.sin(t * 0.4 + a.seed * 5) * 46;
      const py = a.y + Math.cos(t * 0.62 + a.seed * 9) * 30;

      if (night) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2 + a.seed * 7);
        ctx.fillStyle = `rgba(255, 234, 140, ${0.06 + pulse * 0.09})`;
        ctx.beginPath();
        ctx.arc(px, py, 6 + pulse * 3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 244, 176, ${0.5 + pulse * 0.4})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, TAU);
        ctx.fill();
      } else {
        const flap = Math.sin(t * 13 + a.seed * 3);
        const bob = Math.sin(t * 2.2 + a.seed) * 1.5;
        ctx.fillStyle = a.color;
        ctx.beginPath();
        ctx.ellipse(px - 3.2, py + bob, 3.4, 1.5 + Math.abs(flap) * 2.6, -0.45, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(px + 3.2, py + bob, 3.4, 1.5 + Math.abs(flap) * 2.6, 0.45, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(40, 50, 40, 0.75)';
        ctx.beginPath();
        ctx.ellipse(px, py + bob, 1.1, 2.4, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(40, 50, 40, 0.6)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(px - 0.6, py - 1.6 + bob);
        ctx.lineTo(px - 2.4, py - 3.4 + bob);
        ctx.moveTo(px + 0.6, py - 1.6 + bob);
        ctx.lineTo(px + 2.4, py - 3.4 + bob);
        ctx.stroke();
      }
    }
  }
}

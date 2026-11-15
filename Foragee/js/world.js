'use strict';

const PLOT_GROW_TIME = 45;

class World {
  constructor(saved) {
    this.w = 2600;
    this.h = 2000;

    this.homestead = { x: 1300, y: 1010 };
    this.tentPos = { x: 1206, y: 928 };
    this.stallPos = { x: 1466, y: 968 };
    this.campfirePos = { x: 1382, y: 1092 };
    this.plotDefs = [
      { x: 1118, y: 1116 },
      { x: 1192, y: 1116 },
      { x: 1266, y: 1116 },
    ];
    this.paths = [
      { x: 1300, y: 1012, rx: 158, ry: 104 },
      { x: 1262, y: 1090, rx: 100, ry: 42 },
      { x: 1408, y: 1048, rx: 76, ry: 36 },
      { x: 1448, y: 1002, rx: 54, ry: 28 },
      { x: 1248, y: 976, rx: 60, ry: 28 },
    ];

    this.rng = makeRng(saved && saved.seed ? saved.seed : 12345);
    this.nodes = [];
    this.decor = [];
    this.ambient = [];
    this.patches = [];

    this.generatePatches();
    this.generateDecor();
    this.generateAmbient();

    if (saved && Array.isArray(saved.nodes) && saved.nodes.length) {
      this.loadNodes(saved.nodes);
    } else {
      this.generateNodes();
    }

    this.plots = this.makePlots(saved && Array.isArray(saved.plots) ? saved.plots : null);
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
    for (let i = 0; i < 300; i++) {
      const roll = this.rng.next();
      let type = 'tuft';
      if (roll > 0.82) type = 'pebble';
      else if (roll > 0.62) type = 'flower';
      else if (roll > 0.5) type = 'clover';

      const flowers = type === 'flower';
      const x = flowers
        ? this.homestead.x + this.rng.range(-520, 520)
        : this.rng.range(40, this.w - 40);
      const y = flowers
        ? this.homestead.y + this.rng.range(-380, 380)
        : this.rng.range(40, this.h - 40);

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
    const colors = ['#f4a259', '#f2e6cf', '#ffd166', '#c8b6ff'];
    for (let i = 0; i < 18; i++) {
      this.ambient.push({
        x: this.rng.range(100, this.w - 100),
        y: this.rng.range(100, this.h - 100),
        seed: this.rng.next() * 10,
        color: this.rng.pick(colors),
      });
    }
  }

  spotFree(x, y, ignoreHomestead) {
    if (x < 70 || y < 90 || x > this.w - 70 || y > this.h - 70) return false;
    if (!ignoreHomestead && dist(x, y, this.homestead.x, this.homestead.y) < 235) return false;
    if (dist(x, y, this.tentPos.x, this.tentPos.y) < 95) return false;
    if (dist(x, y, this.stallPos.x, this.stallPos.y) < 100) return false;
    if (dist(x, y, this.campfirePos.x, this.campfirePos.y) < 85) return false;
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

  place(type, count, centers, spread) {
    const conf = NODE_TYPES[type];
    if (!conf) return;
    let placed = 0;
    let tries = 0;
    while (placed < count && tries < count * 80) {
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
    ];
    const rocky = [
      { x: 2200, y: 430 },
      { x: 2310, y: 620 },
      { x: 2080, y: 520 },
      { x: 520, y: 1180 },
    ];

    this.place('tree', 46, forest, 185);
    this.place('fiber', 52, null, 0);
    this.place('rock', 26, rocky, 150);
    this.place('ore', 9, rocky, 130);
    this.place('bush', 24, null, 0);
    this.place('mush', 18, forest, 160);

    // A friendly starter ring around the homestead.
    const ring = [
      ['tree', -260, 40],
      ['tree', 300, -140],
      ['tree', -80, -300],
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
    ];
    for (const [type, dx, dy] of ring) {
      const x = this.homestead.x + dx;
      const y = this.homestead.y + dy;
      if (this.spotFree(x, y, true)) this.nodes.push(this.makeNode(type, x, y));
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
      return {
        x: def.x,
        y: def.y,
        state: s && typeof s.state === 'string' ? s.state : 'grass',
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
    return this.plots.map((p) => ({ state: p.state, growth: +p.growth.toFixed(3) }));
  }

  /* ---------------- simulation ---------------- */

  update(dt, game) {
    for (const n of this.nodes) {
      if (n.shake > 0) n.shake = Math.max(0, n.shake - dt * 26);
      if (!n.alive) {
        n.respawn -= dt;
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
        p.growth = Math.min(1, p.growth + dt / PLOT_GROW_TIME);
        if (p.growth >= 1) {
          p.state = 'ripe';
          game.spawnSparkle(p.x, p.y - 14, 8);
        }
      } else if (p.state === 'ripe' && this.rng.chance(dt * 0.9)) {
        game.spawnSparkle(p.x + (Math.random() * 26 - 13), p.y - 16, 1);
      }
    }

    if (game.state.upgrades.campfire && this.rng.chance(dt * 3)) {
      game.spawnEmber(
        this.campfirePos.x + (Math.random() * 16 - 8),
        this.campfirePos.y - 18
      );
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

    for (const p of this.paths) {
      ctx.fillStyle = 'rgba(203, 172, 120, 0.30)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(214, 186, 137, 0.22)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 2, p.rx * 0.82, p.ry * 0.78, 0, 0, TAU);
      ctx.fill();
    }
  }

  drawDecor(ctx, t) {
    for (const d of this.decor) {
      const sway = Math.sin(t * 1.1 + d.seed) * 1.4;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.scale(d.s, d.s);

      if (d.type === 'tuft') {
        ctx.strokeStyle = '#57944c';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
          ctx.moveTo(i * 3, 0);
          ctx.quadraticCurveTo(i * 4 + sway, -7, i * 5 + sway * 1.6, -12);
        }
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
          ctx.arc(fx + Math.cos(a) * 3.2, -12 + Math.sin(a) * 3.2, 2.1, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = '#f2c66a';
        ctx.beginPath();
        ctx.arc(fx, -12, 1.7, 0, TAU);
        ctx.fill();
      } else if (d.type === 'clover') {
        ctx.fillStyle = 'rgba(74, 140, 70, 0.75)';
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * TAU + d.seed;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 2.6, -3 + Math.sin(a) * 2.6, 2.8, 0, TAU);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = 'rgba(140, 148, 152, 0.65)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 4.2, 2.6, 0.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.beginPath();
        ctx.ellipse(-1, -0.8, 2, 1, 0.2, 0, TAU);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  /* ---------------- plots ---------------- */

  drawPlots(ctx, t) {
    for (const p of this.plots) {
      ctx.save();
      ctx.translate(p.x, p.y);

      const w = 58;
      const h = 42;

      if (p.state === 'ripe') {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 + p.x);
        const glow = ctx.createRadialGradient(0, -6, 4, 0, -6, 48);
        glow.addColorStop(0, `rgba(255, 235, 150, ${0.12 + pulse * 0.07})`);
        glow.addColorStop(1, 'rgba(255, 235, 150, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, -6, 48, 0, TAU);
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
        for (let i = 0; i < 4; i++) {
          const gx = -18 + i * 12;
          ctx.beginPath();
          ctx.moveTo(gx, 8);
          ctx.quadraticCurveTo(gx + 2, -2, gx + Math.sin(t + i) * 2, -7);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#8b6a45';
        rr(ctx, -w / 2, -h / 2, w, h, 10);
        ctx.fill();
        ctx.strokeStyle = '#6e5136';
        ctx.lineWidth = 2;
        ctx.stroke();

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
          for (let i = -1; i <= 1; i++) {
            const sx = i * 16;
            const sh = 6 + g * 16;
            ctx.strokeStyle = '#4f8f4a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sx, 4);
            ctx.quadraticCurveTo(sx + 1, 4 - sh * 0.6, sx + Math.sin(t * 1.2 + i) * 2, 4 - sh);
            ctx.stroke();
            ctx.fillStyle = '#5fa054';
            ctx.beginPath();
            ctx.ellipse(sx - 3, 4 - sh * 0.55, 4, 2.4, -0.5, 0, TAU);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(sx + 3, 4 - sh * 0.75, 4, 2.4, 0.5, 0, TAU);
            ctx.fill();
            if (p.state === 'ripe') {
              ctx.fillStyle = '#e0567a';
              for (let b = 0; b < 2; b++) {
                ctx.beginPath();
                ctx.arc(sx - 3 + b * 6, 4 - sh + 1, 3, 0, TAU);
                ctx.fill();
              }
            }
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
      this.drawDepleted(ctx, n, t);
      ctx.restore();
      return;
    }

    const sway = n.type === 'tree' ? Math.sin(t * 0.9 + n.seed) * 2.2 : Math.sin(t * 1.4 + n.seed) * 1.1;
    ctx.translate(sway, 0);

    switch (n.type) {
      case 'tree':
        this.drawTree(ctx, n, t);
        break;
      case 'rock':
        this.drawRock(ctx, n, false);
        break;
      case 'ore':
        this.drawRock(ctx, n, true);
        break;
      case 'bush':
        this.drawBush(ctx, n, t);
        break;
      case 'mush':
        this.drawMushroom(ctx, n);
        break;
      default:
        this.drawFiber(ctx, n, t);
        break;
    }

    ctx.restore();
  }

  drawTree(ctx, n) {
    ctx.fillStyle = 'rgba(28, 56, 32, 0.18)';
    ellipse(ctx, 0, 3, 26, 9);

    ctx.fillStyle = '#8a5a3b';
    rr(ctx, -5, -40, 10, 43, 3);
    ctx.fill();
    ctx.strokeStyle = '#6d4429';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.strokeStyle = '#7d5133';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(-11, -34);
    ctx.moveTo(0, -33);
    ctx.lineTo(10, -40);
    ctx.stroke();

    ctx.fillStyle = '#3f7a3e';
    ctx.beginPath();
    ctx.ellipse(-15, -49, 18, 15.5, -0.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(15, -52, 17, 14.5, 0.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -62, 20, 18, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#4f8f4a';
    ctx.beginPath();
    ctx.ellipse(-12, -55, 13, 11, -0.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(10, -61, 11, 9, 0.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(1, -67, 10, 8, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(143, 209, 138, 0.5)';
    ctx.beginPath();
    ctx.ellipse(-3, -68, 6, 4, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#5fa054';
    ctx.beginPath();
    ctx.ellipse(-20, -42, 5, 3, -0.4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(19, -44, 4, 2.6, 0.4, 0, TAU);
    ctx.fill();
  }

  drawRock(ctx, n, ore) {
    ctx.fillStyle = 'rgba(28, 56, 32, 0.16)';
    ellipse(ctx, 0, 3, 24, 8);

    const pts = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + Math.sin(n.seed * 3 + i * 2.3) * 0.14;
      const r = 15 + Math.sin(n.seed * 7 + i * 1.7) * 5;
      pts.push([Math.cos(a) * r, -12 + Math.sin(a) * r * 0.82]);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = '#8f98a2';
    ctx.fill();
    ctx.strokeStyle = '#6f7881';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < 3; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = '#a8b1ba';
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-8, -18);
    ctx.lineTo(2, -22);
    ctx.stroke();

    if (ore) {
      const specks = [
        [-7, -13],
        [2, -9],
        [7, -17],
        [-2, -20],
        [10, -8],
      ];
      for (const [sx, sy] of specks) {
        ctx.fillStyle = '#e08a4a';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#f6d08a';
        ctx.beginPath();
        ctx.arc(sx - 0.6, sy - 0.7, 0.9, 0, TAU);
        ctx.fill();
      }
    }
  }

  drawBush(ctx, n, t) {
    ctx.fillStyle = 'rgba(28, 56, 32, 0.16)';
    ellipse(ctx, 0, 3, 20, 7);

    const health = n.hp / n.maxHp;

    ctx.fillStyle = '#3f7c3c';
    ctx.beginPath();
    ctx.ellipse(-9, -11, 13, 11, -0.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(9, -12, 12, 10, 0.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -18, 14, 11, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#4c8a46';
    ctx.beginPath();
    ctx.ellipse(-4, -19, 9, 7, -0.4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, -14, 7, 5, 0.4, 0, TAU);
    ctx.fill();

    const berryCount = Math.max(1, Math.round(7 * health));
    const berrySpots = [
      [-10, -13], [5, -8], [10, -15], [-3, -21], [0, -10], [13, -9], [-13, -18],
    ];
    for (let i = 0; i < berryCount; i++) {
      const [bx, by] = berrySpots[i];
      ctx.fillStyle = '#c94b6b';
      ctx.beginPath();
      ctx.arc(bx, by + Math.sin(t * 2 + i) * 0.5, 2.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f29cba';
      ctx.beginPath();
      ctx.arc(bx - 0.7, by - 0.8, 0.9, 0, TAU);
      ctx.fill();
    }
  }

  drawMushroom(ctx, n) {
    ctx.fillStyle = 'rgba(28, 56, 32, 0.13)';
    ellipse(ctx, 0, 2, 16, 5);

    const spots = [
      [-8, -3, 1],
      [5, -1, 0.85],
      [-1, -7, 0.7],
    ];
    for (const [mx, my, scale] of spots) {
      ctx.save();
      ctx.translate(mx, my);
      ctx.scale(scale, scale);

      ctx.fillStyle = '#efe2c8';
      rr(ctx, -2.4, -10, 4.8, 11, 2);
      ctx.fill();

      ctx.fillStyle = '#e0876a';
      ctx.beginPath();
      ctx.ellipse(0, -11, 8, 5.6, 0, Math.PI, TAU);
      ctx.fill();

      ctx.fillStyle = '#f7d7c2';
      ctx.beginPath();
      ctx.arc(-2.5, -12.5, 1.3, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(2.2, -11, 1, 0, TAU);
      ctx.fill();

      ctx.restore();
    }
  }

  drawFiber(ctx, n, t) {
    ctx.fillStyle = 'rgba(28, 56, 32, 0.1)';
    ellipse(ctx, 0, 2, 15, 4);

    for (let i = 0; i < 7; i++) {
      const offset = -10 + i * 3.4;
      const h = 13 + Math.sin(n.seed + i * 1.9) * 5;
      const sway = Math.sin(t * 1.6 + n.seed + i) * 2.4;
      ctx.strokeStyle = i % 2 ? '#7aa84f' : '#96bd61';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(offset, 1);
      ctx.quadraticCurveTo(offset + sway * 0.5, -h * 0.55, offset + sway, -h);
      ctx.stroke();
    }
  }

  drawDepleted(ctx, n) {
    if (n.type === 'tree') {
      ctx.fillStyle = 'rgba(28, 56, 32, 0.14)';
      ellipse(ctx, 0, 2, 16, 6);
      ctx.fillStyle = '#8a5a3b';
      rr(ctx, -8, -13, 16, 14, 3);
      ctx.fill();
      ctx.strokeStyle = '#6d4429';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = '#c9a06f';
      ellipse(ctx, 0, -13, 7, 3.6);
      ctx.strokeStyle = '#a57c50';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, -13, 4, 2, 0, 0, TAU);
      ctx.stroke();
    } else if (n.type === 'rock' || n.type === 'ore') {
      ctx.fillStyle = 'rgba(28, 56, 32, 0.1)';
      ellipse(ctx, 0, 2, 13, 4);
      ctx.fillStyle = '#9aa3ad';
      ctx.beginPath();
      ctx.ellipse(-5, -2, 4, 3, 0.3, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(6, -1, 3, 2.4, -0.3, 0, TAU);
      ctx.fill();
    } else if (n.type === 'bush') {
      ctx.fillStyle = 'rgba(28, 56, 32, 0.1)';
      ellipse(ctx, 0, 2, 14, 4);
      ctx.strokeStyle = '#6b7a45';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-6, 1);
      ctx.lineTo(-8, -8);
      ctx.moveTo(0, 1);
      ctx.lineTo(2, -11);
      ctx.moveTo(5, 1);
      ctx.lineTo(9, -7);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(90, 110, 70, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, -1, 5, 2, 0, 0, TAU);
      ctx.fill();
    }
  }

  /* ---------------- structures ---------------- */

  drawTent(ctx, t) {
    const { x, y } = this.tentPos;
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = 'rgba(28, 56, 32, 0.18)';
    ellipse(ctx, 0, 6, 46, 12);

    ctx.fillStyle = '#d9c9a8';
    ctx.beginPath();
    ctx.moveTo(-43, 0);
    ctx.lineTo(0, -60);
    ctx.lineTo(43, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#b7a483';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#3a2f26';
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.lineTo(0, -45);
    ctx.lineTo(15, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#e9dcc0';
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.lineTo(0, -45);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#8a5a3b';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.lineTo(0, -69);
    ctx.stroke();

    const flap = Math.sin(t * 2.2) * 2.2;
    ctx.fillStyle = '#ffcf6b';
    ctx.beginPath();
    ctx.moveTo(0, -69);
    ctx.lineTo(13 + flap, -64);
    ctx.lineTo(0, -60);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 235, 180, 0.35)';
    ellipse(ctx, 0, -20, 7, 10);

    ctx.restore();
  }

  drawStall(ctx, t) {
    const { x, y } = this.stallPos;
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = 'rgba(28, 56, 32, 0.18)';
    ellipse(ctx, 0, 6, 56, 13);

    ctx.strokeStyle = '#7a4f2f';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-42, -70);
    ctx.lineTo(-42, 0);
    ctx.moveTo(42, -70);
    ctx.lineTo(42, 0);
    ctx.stroke();

    ctx.fillStyle = '#a9713f';
    rr(ctx, -48, -26, 96, 24, 5);
    ctx.fill();
    ctx.fillStyle = '#c48a52';
    rr(ctx, -50, -32, 100, 9, 4);
    ctx.fill();

    // crates and produce
    ctx.fillStyle = '#b9814a';
    rr(ctx, -34, -46, 22, 16, 3);
    ctx.fill();
    ctx.strokeStyle = '#8a5a3b';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = '#e0567a';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(-29 + (i % 2) * 10, -48 + Math.floor(i / 2) * 5, 2.6, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = '#b9814a';
    rr(ctx, 12, -44, 20, 14, 3);
    ctx.fill();
    ctx.strokeStyle = '#8a5a3b';
    ctx.stroke();
    ctx.fillStyle = '#ffcf6b';
    ctx.beginPath();
    ctx.arc(20, -40, 3.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#e5a83c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(20, -40, 1.6, 0, TAU);
    ctx.stroke();

    // awning with scalloped stripes
    const stripes = 6;
    const stripeW = 104 / stripes;
    for (let i = 0; i < stripes; i++) {
      const sx = -52 + i * stripeW;
      ctx.fillStyle = i % 2 ? '#f2e6cf' : '#dd5a48';
      ctx.beginPath();
      ctx.moveTo(sx, -78);
      ctx.lineTo(sx + stripeW, -78);
      ctx.lineTo(sx + stripeW, -48);
      ctx.arc(sx + stripeW / 2, -48, stripeW / 2, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#7a4f2f';
    rr(ctx, -54, -82, 108, 6, 3);
    ctx.fill();

    const sway = Math.sin(t * 1.6) * 0.05;
    ctx.save();
    ctx.translate(0, -36);
    ctx.rotate(sway);
    ctx.fillStyle = '#f2e6cf';
    rr(ctx, -14, 6, 28, 18, 4);
    ctx.fill();
    ctx.strokeStyle = '#b7a483';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = '#b9814a';
    ctx.font = 'bold 10px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TRADE', 0, 15);
    ctx.restore();

    ctx.restore();
  }

  drawCampfire(ctx, t, built) {
    const { x, y } = this.campfirePos;
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = 'rgba(28, 56, 32, 0.18)';
    ellipse(ctx, 0, 3, 30, 9);

    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      ctx.fillStyle = i % 2 ? '#8f98a2' : '#a8b1ba';
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 26, Math.sin(a) * 9, 5.4, 4.2, a, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = '#5b4632';
    ellipse(ctx, 0, 0, 19, 6);

    ctx.strokeStyle = '#7a5236';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-12, 3);
    ctx.lineTo(11, -5);
    ctx.moveTo(-10, -5);
    ctx.lineTo(12, 3);
    ctx.stroke();

    if (built) {
      const flick = Math.sin(t * 9) * 2 + Math.sin(t * 21) * 1.2;
      ctx.fillStyle = 'rgba(255, 140, 60, 0.22)';
      ctx.beginPath();
      ctx.arc(0, -12, 24 + flick, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#e8622f';
      ctx.beginPath();
      ctx.moveTo(-12, -2);
      ctx.quadraticCurveTo(-14, -20 - flick, 0, -32 - flick);
      ctx.quadraticCurveTo(13, -19 + flick, 11, -2);
      ctx.quadraticCurveTo(0, 4, -12, -2);
      ctx.fill();

      ctx.fillStyle = '#ffb03a';
      ctx.beginPath();
      ctx.moveTo(-7, -3);
      ctx.quadraticCurveTo(-8, -15 - flick, 0, -24 - flick);
      ctx.quadraticCurveTo(8, -14 + flick, 6, -3);
      ctx.quadraticCurveTo(0, 1, -7, -3);
      ctx.fill();

      ctx.fillStyle = '#ffe7a3';
      ctx.beginPath();
      ctx.moveTo(-3, -4);
      ctx.quadraticCurveTo(-4, -10, 0, -15);
      ctx.quadraticCurveTo(4, -9, 3, -4);
      ctx.quadraticCurveTo(0, -2, -3, -4);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(60, 62, 58, 0.5)';
      ellipse(ctx, 0, -2, 8, 3.4);
    }

    ctx.restore();
  }

  /* ---------------- ambient life ---------------- */

  drawAmbient(ctx, t, night) {
    for (const a of this.ambient) {
      const px = a.x + Math.sin(t * 0.4 + a.seed * 5) * 46;
      const py = a.y + Math.cos(t * 0.62 + a.seed * 9) * 30;

      if (night) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2 + a.seed * 7);
        ctx.fillStyle = `rgba(255, 234, 140, ${0.06 + pulse * 0.08})`;
        ctx.beginPath();
        ctx.arc(px, py, 6 + pulse * 3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 244, 176, ${0.5 + pulse * 0.4})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.7, 0, TAU);
        ctx.fill();
      } else {
        const flap = Math.sin(t * 13 + a.seed * 3);
        ctx.fillStyle = a.color;
        ctx.beginPath();
        ctx.ellipse(px - 3, py, 3, 1.4 + Math.abs(flap) * 2.4, -0.4, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(px + 3, py, 3, 1.4 + Math.abs(flap) * 2.4, 0.4, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(40, 50, 40, 0.7)';
        ctx.beginPath();
        ctx.arc(px, py, 0.9, 0, TAU);
        ctx.fill();
      }
    }
  }
}

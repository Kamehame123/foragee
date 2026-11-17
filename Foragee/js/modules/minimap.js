'use strict';

/* Corner minimap: land, pond, nodes, boat and the player. Toggle with V. */
(function () {
  if (!window.FJ) return;

  const SIZE = 148;
  let canvas = null;
  let visible = true;

  function build() {
    canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.className = 'fj-minimap';
    canvas.title = 'Minimap (V)';
    document.body.appendChild(canvas);

    FJ.button('🗺️', 'Minimap (V)', toggle);
    FJ.keydown((e) => {
      if (e.key === 'v' || e.key === 'V') toggle();
    });

    setInterval(draw, 220);
    draw();
  }

  function toggle() {
    visible = !visible;
    if (canvas) canvas.style.display = visible ? 'block' : 'none';
  }

  function draw() {
    const game = window.foragee;
    const world = game && game.world;
    if (!canvas) return;
    if (!game || !game.started || !world) {
      canvas.style.display = 'none';
      return;
    }
    if (visible) canvas.style.display = 'block';
    else return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const pad = 10;
    const scale = Math.min((w - pad * 2) / world.w, (h - pad * 2) / world.h);
    const ox = (w - world.w * scale) / 2;
    const oy = (h - world.h * scale) / 2;
    const mx = (x) => ox + x * scale;
    const my = (y) => oy + y * scale;

    ctx.fillStyle = world.island ? 'rgba(42, 82, 96, 0.9)' : 'rgba(38, 62, 36, 0.9)';
    ctx.fillRect(0, 0, w, h);

    if (world.island) {
      const c = world.center;
      ctx.fillStyle = 'rgba(214, 200, 150, 0.9)';
      ctx.beginPath();
      ctx.ellipse(mx(c.x), my(c.y), world.landRx * scale * 1.08, world.landRy * scale * 1.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(96, 150, 74, 0.95)';
      ctx.beginPath();
      ctx.ellipse(mx(c.x), my(c.y), world.landRx * scale, world.landRy * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(112, 168, 88, 0.85)';
      ctx.fillRect(mx(0), my(0), world.w * scale, world.h * scale);
      ctx.fillStyle = 'rgba(214, 200, 150, 0.5)';
      for (const path of world.paths || []) {
        ctx.beginPath();
        ctx.ellipse(mx(path.x), my(path.y), Math.max(1, path.rx * scale), Math.max(1, path.ry * scale), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (world.pond) {
      ctx.fillStyle = 'rgba(88, 172, 194, 0.95)';
      ctx.beginPath();
      ctx.ellipse(mx(world.pond.x), my(world.pond.y), Math.max(1.5, world.pond.rx * scale), Math.max(1.5, world.pond.ry * scale), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(240, 236, 210, 0.55)';
    for (const node of world.nodes) {
      if (!node.alive) continue;
      ctx.fillRect(mx(node.x) - 1, my(node.y) - 1, 2, 2);
    }

    if (!world.island && world.homestead) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(mx(world.homestead.x), my(world.homestead.y), 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (world.travelPos) {
      ctx.fillStyle = '#f2e6cf';
      ctx.beginPath();
      ctx.arc(mx(world.travelPos.x), my(world.travelPos.y), 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (game.player) {
      const px = mx(game.player.x);
      const py = my(game.player.y);
      ctx.fillStyle = '#ffe9ab';
      ctx.beginPath();
      ctx.arc(px, py, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 233, 171, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + game.player.facing * 6, py - 4);
      ctx.stroke();
    }
  }

  function init() {
    build();
  }

  FJ.ready(init);
})();

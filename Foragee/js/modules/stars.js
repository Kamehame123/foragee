'use strict';

/* A starfield, moon and the odd shooting star while the game is at night. */
(function () {
  if (!window.FJ) return;

  let canvas = null;
  let ctx = null;
  let stars = [];
  let last = 0;
  let alpha = 0;
  let nextShoot = 0;
  let shoot = null;

  function resize() {
    if (!canvas) return;
    canvas.width = Math.max(1, Math.floor(window.innerWidth));
    canvas.height = Math.max(1, Math.floor(window.innerHeight));
    const count = Math.min(160, Math.floor((canvas.width * canvas.height) / 9000));
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.78,
        r: 0.5 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.6,
      });
    }
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (!canvas) return;
    const game = window.foragee;
    const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0;
    last = ts;

    if (!ctx) return;
    const night = !!(game && game.started && game.isNight && game.isNight());
    const target = night ? 1 : 0;
    alpha += (target - alpha) * Math.min(1, dt * 2.4);
    if (alpha < 0.01) {
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = alpha;

    for (const star of stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(ts / 1000 * star.speed + star.phase);
      ctx.fillStyle = `rgba(232, 240, 255, ${0.35 + twinkle * 0.55})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r * (0.8 + twinkle * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }

    // Moon with a soft halo.
    const mx = canvas.width * 0.82;
    const my = canvas.height * 0.16;
    const mr = Math.max(20, Math.min(canvas.width, canvas.height) * 0.035);
    const halo = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 5);
    halo.addColorStop(0, 'rgba(240, 238, 210, 0.18)');
    halo.addColorStop(1, 'rgba(240, 238, 210, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(mx, my, mr * 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(244, 240, 214, 0.92)';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(210, 204, 176, 0.5)';
    ctx.beginPath();
    ctx.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.22, 0, Math.PI * 2);
    ctx.arc(mx + mr * 0.28, my + mr * 0.24, mr * 0.16, 0, Math.PI * 2);
    ctx.fill();

    // Occasional shooting star.
    if (!shoot && ts > nextShoot) {
      nextShoot = ts + 6000 + Math.random() * 9000;
      shoot = {
        x: canvas.width * (0.15 + Math.random() * 0.6),
        y: canvas.height * (0.05 + Math.random() * 0.25),
        vx: 260 + Math.random() * 200,
        vy: 90 + Math.random() * 80,
        life: 1,
      };
    }
    if (shoot) {
      shoot.x += shoot.vx * dt;
      shoot.y += shoot.vy * dt;
      shoot.life -= dt * 0.9;
      if (shoot.life <= 0) {
        shoot = null;
      } else {
        const tail = 90;
        const grad = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - tail, shoot.y - tail * 0.35);
        grad.addColorStop(0, `rgba(255, 250, 225, ${0.85 * shoot.life})`);
        grad.addColorStop(1, 'rgba(255, 250, 225, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(shoot.x, shoot.y);
        ctx.lineTo(shoot.x - tail, shoot.y - tail * 0.35);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
  }

  function init() {
    canvas = document.createElement('canvas');
    canvas.className = 'fj-overlay-canvas';
    canvas.style.zIndex = '12';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    last = performance.now();
    nextShoot = last + 7000;
    requestAnimationFrame(loop);
  }

  FJ.ready(init);
})();

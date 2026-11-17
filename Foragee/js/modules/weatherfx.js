'use strict';

/* Subtle screen-space weather effects drawn over the game. Toggle with O. */
(function () {
  if (!window.FJ) return;

  let canvas = null;
  let ctx = null;
  let enabled = true;
  let last = 0;
  let flash = 0;
  let nextFlash = 0;

  function resize() {
    if (!canvas) return;
    canvas.width = Math.max(1, Math.floor(window.innerWidth));
    canvas.height = Math.max(1, Math.floor(window.innerHeight));
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (!canvas || !ctx) return;
    const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0;
    last = ts;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const game = window.foragee;
    if (!enabled || !game || !game.started || !game.state) return;

    const weather = game.state.weather || 'clear';
    const t = ts / 1000;
    const w = canvas.width;
    const h = canvas.height;

    if (weather === 'rain' || weather === 'storm') {
      const count = weather === 'storm' ? 150 : 80;
      ctx.strokeStyle = weather === 'storm' ? 'rgba(190, 215, 235, 0.34)' : 'rgba(190, 215, 235, 0.24)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const speed = 700 + (i % 7) * 90;
        const x = ((i * 137 + t * speed * 0.25) % (w + 120)) - 60;
        const y = ((i * 211 + t * speed) % (h + 80)) - 40;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 7, y + 20);
      }
      ctx.stroke();

      if (weather === 'storm') {
        if (ts > nextFlash) {
          nextFlash = ts + 5000 + Math.random() * 9000;
          flash = 1;
        }
        if (flash > 0) {
          ctx.fillStyle = `rgba(230, 238, 255, ${flash * 0.22})`;
          ctx.fillRect(0, 0, w, h);
          flash = Math.max(0, flash - dt * 2.6);
        }
      }
    } else if (weather === 'fog') {
      for (let i = 0; i < 5; i++) {
        const y = h * (0.18 + i * 0.16) + Math.sin(t * 0.2 + i) * 14;
        const x = ((i * 260 + t * 14) % (w + 360)) - 180;
        const g = ctx.createRadialGradient(x, y, 20, x, y, 240);
        g.addColorStop(0, 'rgba(226, 232, 230, 0.10)');
        g.addColorStop(1, 'rgba(226, 232, 230, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 240, y - 140, 480, 280);
      }
    } else if (weather === 'cloudy') {
      ctx.fillStyle = 'rgba(120, 150, 110, 0.14)';
      for (let i = 0; i < 9; i++) {
        const x = ((i * 173 + t * 26) % (w + 120)) - 60;
        const y = ((i * 97 + t * 9) % (h + 60)) - 30;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(t * 0.6 + i) * 0.7);
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function init() {
    canvas = document.createElement('canvas');
    canvas.className = 'fj-overlay-canvas';
    canvas.style.zIndex = '14';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    last = performance.now();
    nextFlash = last + 6000;

    FJ.button('🌧️', 'Weather effects (O)', () => {
      enabled = !enabled;
      if (!enabled) ctx.clearRect(0, 0, canvas.width, canvas.height);
      FJ.popup('Weather effects', enabled ? 'On' : 'Off');
    });
    FJ.keydown((e) => {
      if (e.key === 'o' || e.key === 'O') {
        enabled = !enabled;
        if (!enabled) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });

    requestAnimationFrame(loop);
  }

  FJ.ready(init);
})();

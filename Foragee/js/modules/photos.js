'use strict';

/* Photo mode: save a framed snapshot of the current scene. Press P. */
(function () {
  if (!window.FJ) return;

  function islandName(s) {
    const id = s.islands && s.islands.current;
    if (typeof ISLANDS === 'undefined' || !ISLANDS[id]) return 'Home Isle';
    return ISLANDS[id].name;
  }

  function weatherName(s) {
    const conf = typeof WEATHERS !== 'undefined' ? WEATHERS[s.weather] : null;
    return conf ? conf.name : 'Clear';
  }

  function flash() {
    const el = document.createElement('div');
    el.className = 'fj-flash';
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('fj-on'));
    setTimeout(() => {
      el.classList.remove('fj-on');
      setTimeout(() => el.remove(), 320);
    }, 60);
  }

  function capture() {
    const game = window.foragee;
    if (!game || !game.started || !game.canvas || !game.state) {
      FJ.toast('Start the game first, then take a photo.', 'warn');
      return;
    }
    const src = game.canvas;
    if (!src.width || !src.height) return;

    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d');
    ctx.drawImage(src, 0, 0);

    const scale = Math.max(1, out.width / 1200);
    const barH = Math.round(54 * scale);
    const grad = ctx.createLinearGradient(0, out.height - barH, 0, out.height);
    grad.addColorStop(0, 'rgba(16, 22, 16, 0)');
    grad.addColorStop(0.35, 'rgba(16, 22, 16, 0.62)');
    grad.addColorStop(1, 'rgba(16, 22, 16, 0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, out.height - barH, out.width, barH);

    const pad = Math.round(18 * scale);
    const s = game.state;
    ctx.fillStyle = '#ffe9ab';
    ctx.font = `600 ${Math.round(18 * scale)}px system-ui, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Day ${s.day} · ${islandName(s)}`, pad, out.height - pad - Math.round(10 * scale));
    ctx.fillStyle = 'rgba(242, 230, 207, 0.85)';
    ctx.font = `${Math.round(13 * scale)}px system-ui, sans-serif`;
    ctx.fillText(`${weatherName(s)} · Foragee`, pad, out.height - pad + Math.round(8 * scale));

    flash();
    try {
      const url = out.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `foragee-day-${s.day}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      FJ.popup('📷 Photo saved', `Day ${s.day} · ${islandName(s)}`);
    } catch (err) {
      FJ.toast('Could not save the photo in this browser.', 'warn');
    }
  }

  function init() {
    FJ.button('📷', 'Photo mode (P)', capture);
    FJ.keydown((e) => {
      if (e.key === 'p' || e.key === 'P') capture();
    });
  }

  FJ.ready(init);
})();

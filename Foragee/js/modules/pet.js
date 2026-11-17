'use strict';

/* A small companion that follows you around the map. Open with Y. */
(function () {
  if (!window.FJ) return;

  const KEY = 'foragee-pet-v1';
  let prefs = FJ.load(KEY, { species: 'duck', name: 'Pip', on: true });
  if (!prefs || (prefs.species !== 'duck' && prefs.species !== 'cat')) prefs = { species: 'duck', name: 'Pip', on: true };

  let pet = null;
  let lastClock = 0;

  const SPECIES = {
    duck: { icon: '🦆', body: '#f4e2a8', belly: '#d9c27a', beak: '#e59a3a', label: 'Duck' },
    cat: { icon: '🐈', body: '#c9a37a', belly: '#efe0cc', beak: '#d78b8b', label: 'Cat' },
  };

  function hook() {
    const game = window.foragee;
    if (!game) return;
    const original = game.render.bind(game);
    game.render = function () {
      original();
      try {
        drawPet(game);
      } catch (err) {
        /* never break the main render */
      }
    };

    FJ.button('🦆', 'Companion (Y)', open);
    FJ.keydown((e) => {
      if (e.key === 'y' || e.key === 'Y') {
        if (FJ.isPanelOpen()) FJ.closePanel();
        else open();
      }
    });
  }

  function updatePet(game, dt) {
    if (!game.player) return;
    if (!pet) pet = { x: game.player.x - 38, y: game.player.y + 22 };
    const tx = game.player.x - game.player.facing * 34;
    const ty = game.player.y + 26;
    const k = Math.min(1, dt * 1.8);
    pet.x += (tx - pet.x) * k;
    pet.y += (ty - pet.y) * k;
    if (game.world && game.world.isBlocked && game.world.isBlocked(pet.x, pet.y)) {
      pet.x = game.player.x;
      pet.y = game.player.y + 8;
    }
  }

  function drawPet(game) {
    if (!prefs.on || !game.started || !game.world || !game.player) return;
    const clock = game.clock || 0;
    const dt = lastClock ? Math.min(0.1, clock - lastClock) : 0.016;
    lastClock = clock;
    updatePet(game, dt);

    const conf = SPECIES[prefs.species] || SPECIES.duck;
    const p = game.worldToScreen(pet.x, pet.y);
    const bob = Math.sin(clock * 3.2) * 1.4;
    const ctx = game.ctx;
    ctx.save();
    ctx.translate(p.x, p.y + bob);

    ctx.fillStyle = 'rgba(30, 44, 30, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 7, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (prefs.species === 'duck') {
      ctx.fillStyle = conf.body;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = conf.belly;
      ctx.beginPath();
      ctx.ellipse(1, 2, 5.5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = conf.body;
      ctx.beginPath();
      ctx.arc(7, -5, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = conf.beak;
      ctx.beginPath();
      ctx.moveTo(10.5, -5);
      ctx.lineTo(15, -3.6);
      ctx.lineTo(10.5, -2.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2f2a22';
      ctx.beginPath();
      ctx.arc(8.2, -5.8, 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120, 100, 60, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-9, -1);
      ctx.quadraticCurveTo(-13, -4, -11, -7);
      ctx.stroke();
    } else {
      ctx.fillStyle = conf.body;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(7, -5, 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-2, -5);
      ctx.lineTo(-3, -11);
      ctx.lineTo(1, -6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = conf.body;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.quadraticCurveTo(-15, -2, -13, -7);
      ctx.stroke();
      ctx.fillStyle = conf.beak;
      ctx.beginPath();
      ctx.arc(7.6, -5.2, 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(10.3, -6.4, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    if (prefs.name) {
      ctx.save();
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(242, 230, 207, 0.8)';
      ctx.fillText(prefs.name, p.x, p.y - 18);
      ctx.restore();
    }
  }

  function open() {
    const conf = SPECIES[prefs.species] || SPECIES.duck;
    FJ.panel(
      'Companion',
      `<p class="fj-sub">A little friend who follows you around the homestead and the islands.</p>
       <div class="fj-row">
         <span class="fj-ico">${conf.icon}</span>
         <div class="fj-main">
           <div class="fj-name">${prefs.name || conf.label}</div>
           <div class="fj-desc">Currently a ${conf.label.toLowerCase()}.</div>
         </div>
         <span class="fj-side">
           <button class="fj-btn" type="button" data-fj-pet-duck="1">Duck</button>
           <button class="fj-btn" type="button" data-fj-pet-cat="1">Cat</button>
         </span>
       </div>
       <div class="fj-row">
         <span class="fj-ico">✏️</span>
         <div class="fj-main">
           <div class="fj-name">Name</div>
           <div class="fj-desc">Give your companion a name.</div>
         </div>
         <span class="fj-side"><input data-fj-pet-name="1" maxlength="16" value="${(prefs.name || '').replace(/"/g, '&quot;')}" style="background:rgba(0,0,0,.25);border:1px solid rgba(255,209,102,.3);border-radius:7px;color:#f2e6cf;padding:5px 8px;width:120px;font-family:inherit" /></span>
       </div>
       <div style="display:flex;gap:8px;margin-top:14px">
         <button class="fj-btn" type="button" data-fj-pet-toggle="1">${prefs.on ? 'Send home' : 'Call companion'}</button>
       </div>`,
      {
        onMount: (overlay) => {
          const save = () => FJ.save(KEY, prefs);
          overlay.querySelector('[data-fj-pet-duck="1"]').addEventListener('click', () => {
            prefs.species = 'duck';
            save();
            FJ.closePanel();
            open();
          });
          overlay.querySelector('[data-fj-pet-cat="1"]').addEventListener('click', () => {
            prefs.species = 'cat';
            save();
            FJ.closePanel();
            open();
          });
          const input = overlay.querySelector('[data-fj-pet-name="1"]');
          input.addEventListener('change', () => {
            prefs.name = input.value.trim().slice(0, 16);
            save();
          });
          overlay.querySelector('[data-fj-pet-toggle="1"]').addEventListener('click', () => {
            prefs.on = !prefs.on;
            save();
            FJ.closePanel();
          });
        },
      }
    );
  }

  FJ.ready(hook);
})();

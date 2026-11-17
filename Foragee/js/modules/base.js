'use strict';

/**
 * Shared plumbing for the optional Foragee add-on modules.
 * Every module talks to the running game through window.foragee and this small helper.
 */
window.FJ = (function () {
  const STYLE_ID = 'fj-shared-style';

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.fj-tools{position:fixed;right:10px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px;z-index:30}',
      '.fj-tool-btn{width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,209,102,.35);background:rgba(22,28,20,.82);color:#f2e6cf;font-size:17px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;box-shadow:0 2px 8px rgba(0,0,0,.35);transition:transform .12s ease,background .12s ease}',
      '.fj-tool-btn:hover{transform:translateY(-1px) scale(1.06);background:rgba(46,56,40,.95)}',
      '.fj-overlay{position:fixed;inset:0;background:rgba(8,12,8,.55);display:flex;align-items:center;justify-content:center;z-index:60;padding:16px}',
      '.fj-panel{width:min(640px,100%);max-height:82vh;overflow:auto;background:rgba(24,30,22,.97);border:1px solid rgba(255,209,102,.35);border-radius:14px;color:#f2e6cf;padding:18px 20px 20px;box-shadow:0 18px 50px rgba(0,0,0,.5);font-family:inherit}',
      '.fj-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}',
      '.fj-head h2{margin:0;font-size:20px;color:#ffe6a8}',
      '.fj-close{background:none;border:none;color:#cbbfa4;font-size:18px;cursor:pointer;padding:4px 6px}',
      '.fj-close:hover{color:#fff}',
      '.fj-sub{margin:0 0 12px;color:#c9bda3;font-size:13px;line-height:1.5}',
      '.fj-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.07)}',
      '.fj-row:last-child{border-bottom:none}',
      '.fj-row .fj-ico{font-size:18px;width:24px;text-align:center;flex:0 0 24px}',
      '.fj-row .fj-main{flex:1;min-width:0}',
      '.fj-row .fj-name{font-weight:600;font-size:14px}',
      '.fj-row .fj-desc{font-size:12px;color:#c9bda3;margin-top:2px;line-height:1.4}',
      '.fj-row .fj-side{font-size:12px;color:#ffd166;white-space:nowrap}',
      '.fj-tag{display:inline-block;padding:1px 7px;border-radius:999px;background:rgba(255,209,102,.16);border:1px solid rgba(255,209,102,.35);color:#ffe6a8;font-size:11px}',
      '.fj-btn{background:rgba(255,209,102,.16);border:1px solid rgba(255,209,102,.4);color:#ffe6a8;border-radius:9px;padding:6px 10px;font-size:12px;cursor:pointer;font-family:inherit}',
      '.fj-btn:hover{background:rgba(255,209,102,.28)}',
      '.fj-btn.fj-danger{border-color:rgba(230,110,110,.55);color:#ffb4b4;background:rgba(200,70,70,.16)}',
      '.fj-bar{height:7px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:6px}',
      '.fj-bar i{display:block;height:100%;background:linear-gradient(90deg,#c9a94a,#ffd166);border-radius:999px}',
      '.fj-pop{position:fixed;right:14px;bottom:16px;max-width:290px;background:rgba(24,30,22,.97);border:1px solid rgba(255,209,102,.45);border-radius:12px;padding:10px 14px;color:#f2e6cf;z-index:70;box-shadow:0 12px 30px rgba(0,0,0,.45);animation:fj-pop-in .18s ease-out}',
      '.fj-pop b{color:#ffe6a8}',
      '.fj-pop .fj-pop-sub{font-size:12px;color:#c9bda3;margin-top:2px}',
      '@keyframes fj-pop-in{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}',
      '.fj-minimap{position:fixed;right:10px;top:76px;width:148px;height:148px;border-radius:12px;border:1px solid rgba(255,209,102,.35);background:rgba(18,24,18,.9);z-index:25;box-shadow:0 6px 20px rgba(0,0,0,.35);image-rendering:auto}',
      '.fj-flash{position:fixed;inset:0;background:#fff;z-index:80;pointer-events:none;opacity:0;transition:opacity .28s ease}',
      '.fj-flash.fj-on{opacity:.75;transition:opacity .04s ease}',
      '.fj-overlay-canvas{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:15}',
      '.fj-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}',
      '@media (max-width:720px){.fj-minimap{width:108px;height:108px;top:66px}.fj-tools{right:6px;gap:6px}.fj-tool-btn{width:32px;height:32px;font-size:15px}}',
    ].join('\n');
    document.head.appendChild(style);
  }

  function tools() {
    ensureStyle();
    let el = document.getElementById('fj-tools');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fj-tools';
      el.className = 'fj-tools';
      document.body.appendChild(el);
    }
    return el;
  }

  function button(icon, title, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fj-tool-btn';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.textContent = icon;
    b.addEventListener('click', onClick);
    tools().appendChild(b);
    return b;
  }

  function closePanel() {
    const existing = document.getElementById('fj-overlay');
    if (existing) existing.remove();
  }

  function panel(title, bodyHtml, opts) {
    ensureStyle();
    closePanel();
    const overlay = document.createElement('div');
    overlay.className = 'fj-overlay';
    overlay.id = 'fj-overlay';
    overlay.innerHTML = `<div class="fj-panel" role="dialog" aria-modal="true">
      <div class="fj-head"><h2></h2><button class="fj-close" type="button" aria-label="Close">✕</button></div>
      <div class="fj-body"></div>
    </div>`;
    overlay.querySelector('h2').textContent = title;
    overlay.querySelector('.fj-body').innerHTML = bodyHtml;
    overlay.querySelector('.fj-close').addEventListener('click', closePanel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePanel();
    });
    document.body.appendChild(overlay);
    if (opts && typeof opts.onMount === 'function') opts.onMount(overlay);
    return overlay;
  }

  function isPanelOpen() {
    return !!document.getElementById('fj-overlay');
  }

  function toast(text, kind) {
    const g = window.foragee;
    if (g && g.ui && typeof g.ui.toast === 'function') {
      g.ui.toast(text, kind);
      return true;
    }
    return false;
  }

  function popup(title, sub) {
    ensureStyle();
    const el = document.createElement('div');
    el.className = 'fj-pop';
    const b = document.createElement('b');
    b.textContent = title;
    el.appendChild(b);
    if (sub) {
      const s = document.createElement('div');
      s.className = 'fj-pop-sub';
      s.textContent = sub;
      el.appendChild(s);
    }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3600);
    return el;
  }

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      return value === null || value === undefined ? fallback : value;
    } catch (err) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  function keydown(handler) {
    window.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;
      handler(e);
    });
  }

  /** Run fn once the game instance exists (game.js creates it on DOMContentLoaded). */
  function ready(fn) {
    if (window.foragee) {
      fn();
      return;
    }
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (window.foragee) {
        clearInterval(timer);
        fn();
      } else if (tries > 120) {
        clearInterval(timer);
      }
    }, 50);
  }

  return { style: ensureStyle, tools, button, panel, closePanel, isPanelOpen, toast, popup, load, save, keydown, ready };
})();

'use strict';

/* Save manager: export, import and three manual backup slots. Open with B. */
(function () {
  if (!window.FJ) return;

  const SAVE_KEY = 'foragee-save-v1';
  const KEY = 'foragee-backups-v1';
  let store = FJ.load(KEY, { slots: [null, null, null] });
  if (!store || !Array.isArray(store.slots)) store = { slots: [null, null, null] };
  while (store.slots.length < 3) store.slots.push(null);

  function readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function summary(data) {
    if (!data) return 'No save data';
    const islands = data.islands && data.islands.unlocked ? data.islands.unlocked.length : 1;
    const items = data.inv ? Object.values(data.inv).reduce((a, b) => a + (b || 0), 0) : 0;
    return `Day ${data.day || 1} · ${data.coins || 0}🪙 · ${islands} island${islands === 1 ? '' : 's'} · ${items} items`;
  }

  function validSave(data) {
    return !!data && typeof data === 'object' && (typeof data.seed === 'number' || typeof data.day === 'number') && typeof data.inv === 'object';
  }

  function persist() {
    FJ.save(KEY, store);
  }

  function download(name, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function exportSave() {
    const game = window.foragee;
    if (game && game.save) game.save();
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      FJ.toast('No save to export yet.', 'warn');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    download(`foragee-save-${stamp}.json`, raw);
    FJ.popup('💾 Save exported', 'Check your downloads folder.');
  }

  function slotRow(slot, i) {
    const data = slot && slot.data;
    return `<div class="fj-row">
      <span class="fj-ico">${data ? '💾' : '▫️'}</span>
      <div class="fj-main">
        <div class="fj-name">Backup slot ${i + 1}</div>
        <div class="fj-desc">${data ? `${summary(data)}<br>Saved ${new Date(slot.at).toLocaleString()}` : 'Empty'}</div>
      </div>
      <span class="fj-side" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
        <button class="fj-btn" type="button" data-fj-slot-save="${i}">Save</button>
        ${data ? `<button class="fj-btn" type="button" data-fj-slot-restore="${i}">Restore</button>
                  <button class="fj-btn fj-danger" type="button" data-fj-slot-delete="${i}">Delete</button>` : ''}
      </span>
    </div>`;
  }

  function open() {
    const game = window.foragee;
    if (game && game.save) game.save();
    const current = readSave();
    const bytes = (localStorage.getItem(SAVE_KEY) || '').length;

    FJ.panel(
      'Save manager',
      `<p class="fj-sub">The game saves automatically. Here you can keep manual backups, and move a save between browsers.<br>
        Current: ${summary(current)} · ${Math.round(bytes / 1024)} KB</p>
       <div class="fj-row">
         <span class="fj-ico">📤</span>
         <div class="fj-main"><div class="fj-name">Export</div><div class="fj-desc">Download the current save as a .json file.</div></div>
         <span class="fj-side"><button class="fj-btn" type="button" data-fj-export="1">Export</button></span>
       </div>
       <div class="fj-row">
         <span class="fj-ico">📥</span>
         <div class="fj-main"><div class="fj-name">Import</div><div class="fj-desc">Load a save file from another browser or a backup.</div></div>
         <span class="fj-side"><button class="fj-btn" type="button" data-fj-import="1">Choose file…</button></span>
       </div>
       <input type="file" accept="application/json,.json" data-fj-file="1" style="display:none" />
       <h3 style="margin:16px 0 4px;font-size:14px;color:#ffe6a8">Manual backups</h3>
       ${store.slots.map(slotRow).join('')}
       <p class="fj-sub" style="margin-top:12px">Restoring or importing replaces current progress. A copy of the current save is kept in a slot first.</p>`,
      {
        onMount: (overlay) => {
          const rerender = () => {
            FJ.closePanel();
            open();
          };

          overlay.querySelector('[data-fj-export="1"]').addEventListener('click', exportSave);

          const file = overlay.querySelector('[data-fj-file="1"]');
          overlay.querySelector('[data-fj-import="1"]').addEventListener('click', () => file.click());
          file.addEventListener('change', () => {
            const f = file.files && file.files[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = () => {
              let data = null;
              let err = '';
              try {
                data = JSON.parse(String(reader.result));
              } catch (e) {
                err = 'That file is not valid JSON.';
              }
              if (!err && !validSave(data)) err = 'That file does not look like a Foragee save.';
              if (err) {
                FJ.panel('Import save', `<p class="fj-sub">${err}</p><button class="fj-btn" type="button" data-fj-back="1">Back</button>`, {
                  onMount: (o) => o.querySelector('[data-fj-back="1"]').addEventListener('click', open),
                });
                return;
              }
              FJ.panel(
                'Import save',
                `<p class="fj-sub">This will replace your current progress.</p>
                 <div class="fj-row"><span class="fj-ico">📥</span><div class="fj-main"><div class="fj-name">Imported save</div><div class="fj-desc">${summary(data)}</div></div></div>
                 <div style="display:flex;gap:8px;margin-top:14px">
                   <button class="fj-btn fj-danger" type="button" data-fj-confirm="1">Replace my progress</button>
                   <button class="fj-btn" type="button" data-fj-cancel="1">Cancel</button>
                 </div>`,
                {
                  onMount: (o) => {
                    o.querySelector('[data-fj-cancel="1"]').addEventListener('click', open);
                    o.querySelector('[data-fj-confirm="1"]').addEventListener('click', () => {
                      const old = readSave();
                      if (old) {
                        store.slots[2] = { at: Date.now(), day: old.day, coins: old.coins, data: old };
                        persist();
                      }
                      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
                      location.reload();
                    });
                  },
                }
              );
            };
            reader.readAsText(f);
          });

          overlay.querySelectorAll('[data-fj-slot-save]').forEach((btn) => {
            btn.addEventListener('click', () => {
              const i = Number(btn.dataset.fjSlotSave);
              const cur = readSave();
              if (!cur) {
                FJ.toast('No save to back up yet.', 'warn');
                return;
              }
              store.slots[i] = { at: Date.now(), day: cur.day, coins: cur.coins, data: cur };
              persist();
              rerender();
            });
          });

          overlay.querySelectorAll('[data-fj-slot-restore]').forEach((btn) => {
            btn.addEventListener('click', () => {
              const i = Number(btn.dataset.fjSlotRestore);
              if (btn.dataset.armed !== '1') {
                btn.dataset.armed = '1';
                btn.textContent = 'Confirm?';
                return;
              }
              const slot = store.slots[i];
              if (!slot || !validSave(slot.data)) {
                FJ.toast('That backup is not usable.', 'warn');
                return;
              }
              const cur = readSave();
              if (cur) {
                const spare = store.slots.findIndex((sl) => !sl);
                store.slots[spare >= 0 ? spare : 2] = { at: Date.now(), day: cur.day, coins: cur.coins, data: cur };
                persist();
              }
              localStorage.setItem(SAVE_KEY, JSON.stringify(slot.data));
              location.reload();
            });
          });

          overlay.querySelectorAll('[data-fj-slot-delete]').forEach((btn) => {
            btn.addEventListener('click', () => {
              const i = Number(btn.dataset.fjSlotDelete);
              if (btn.dataset.armed !== '1') {
                btn.dataset.armed = '1';
                btn.textContent = 'Confirm?';
                return;
              }
              store.slots[i] = null;
              persist();
              rerender();
            });
          });
        },
      }
    );
  }

  function init() {
    FJ.button('💾', 'Save manager (B)', open);
    FJ.keydown((e) => {
      if (e.key === 'b' || e.key === 'B') {
        if (FJ.isPanelOpen()) FJ.closePanel();
        else open();
      }
    });
  }

  FJ.ready(init);
})();

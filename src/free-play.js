import { CLASS_POWERS } from './data.js';
import { AXIE_IDS } from './axies.js';
import { clearFreePlay } from './loadout.js';
import { readBackpack, writeBackpack, addToBackpack } from './backpack.js';
import { MERGE_COPIES } from './crafting.js';
import { resetAdventureProgress } from './adventure.js';
import { readProgress, writeProgress, recordOf } from './evolution.js';
import { tr } from './i18n.js';

/**
 * Las herramientas del **modo libre** (`?libre`, ver `FREE_PLAY` en `loadout.js`): el
 * juego es el de siempre —la portada, el mapa, el Taller, la evolución, la mesa—, con
 * todo abierto y la bolsa sin fondo. Esto es solo una pestañita plegada arriba a la
 * derecha para volver a probar: la zona de testeo de poderes y animaciones, llenar la
 * mochila, deshacer las evoluciones o la Aventura y salir.
 *
 * Como la zona de testeo, no es del juego: `main.js` lo carga con `import()` solo con
 * `?libre`, así que no va en `MODULES` ni en `dist/`. Usa los estilos de `sandbox.css`.
 */

function loadSheet() {
  if (document.querySelector('link[href="sandbox.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'sandbox.css';
  document.head.appendChild(link);
}

const go = (search) => { location.href = `${location.pathname}${search}`; };

/** Una carta de cada poder de clase, con el símbolo de su clase, más tres comunes iguales para fusionar. */
function fillBackpack() {
  const cards = Object.entries(CLASS_POWERS).flatMap(([sym, powers]) => powers.map((power) => ({ symbols: [sym], power })));
  for (let i = 0; i < MERGE_COPIES; i++) cards.push({ symbols: ['beast'], power: null });
  writeBackpack(addToBackpack(readBackpack(), cards));
}

function resetEvolutions() {
  const progress = readProgress();
  writeProgress(Object.fromEntries(AXIE_IDS.map((id) => [id, { ...recordOf(progress, id), evolved: [] }])));
}

export function openFreePlay() {
  loadSheet();
  const panel = document.createElement('aside');
  panel.className = 'sbx sbx--free is-folded';
  panel.setAttribute('aria-label', tr('Modo libre'));
  panel.innerHTML = `
    <header class="sbx-head">
      <strong>${tr('Modo libre')}</strong>
      <button type="button" class="sbx-btn sbx-btn--sm" data-act="fold" aria-expanded="false">+</button>
    </header>
    <div class="sbx-body">
      <p class="sbx-note">${tr('Mapa abierto, Axies en nivel 60 y Moonshards y llaves sin fin. Se guarda aparte: tu partida de verdad no cambia.')}</p>
      <div class="sbx-actions">
        <button type="button" class="sbx-btn sbx-btn--go" data-act="sandbox">${tr('Probar poderes y animaciones')}</button>
        <button type="button" class="sbx-btn" data-act="bag">${tr('Llenar la mochila')}</button>
        <button type="button" class="sbx-btn" data-act="evolve">${tr('Deshacer evoluciones')}</button>
        <button type="button" class="sbx-btn" data-act="adventure">${tr('Reiniciar la Aventura')}</button>
        <button type="button" class="sbx-btn" data-act="wipe">${tr('Borrar todo el modo libre')}</button>
        <button type="button" class="sbx-btn" data-act="exit">${tr('Salir del modo libre')}</button>
      </div>
    </div>`;
  document.body.appendChild(panel);

  const fold = (on) => {
    panel.classList.toggle('is-folded', on);
    const btn = panel.querySelector('[data-act="fold"]');
    btn.setAttribute('aria-expanded', String(!on));
    btn.textContent = on ? '+' : '—';
  };

  panel.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'fold') return fold(!panel.classList.contains('is-folded'));
    if (act === 'sandbox') return go('?testeo&libre');
    if (act === 'exit') return go('');
    if (act === 'bag') {
      fillBackpack();
      t.textContent = tr('¡En la mochila!');
      setTimeout(() => { t.textContent = tr('Llenar la mochila'); }, 1200);
      return;
    }
    if (act === 'evolve') resetEvolutions();
    else if (act === 'adventure') resetAdventureProgress();
    else if (act === 'wipe') {
      if (!confirm(tr('¿Borrar todo lo guardado en el modo libre?'))) return;
      clearFreePlay();
    }
    location.reload();
  });
  panel.addEventListener('keydown', (e) => e.stopPropagation());
  return panel;
}

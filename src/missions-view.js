// El panel de las misiones sobre el mapa (ver `missions.js` y docs/missions.md).
//
// En una pantalla ancha es una tabla de madera a la izquierda, debajo de tu perfil: las
// del día o las de la semana, cada una con lo que paga, su barra y, cumplida, el botón
// de cobrar; abajo, la tira del pase. Se pliega a un botón (y se acuerda). En un
// teléfono —parado, o acostado y bajo— es solo el botón, que abre una hoja con lo mismo
// y además el pase entero (`QUESTS_COMPACT`, la misma regla en el CSS).
//
// Todo sale de lo guardado: cada vez que se pinta se renueva lo que toque (y se paga
// solo lo que se iba sin cobrar). Mientras se ve, se vuelve a pintar a cada minuto,
// con un timer: lo que falta para que se renueven es lo único que cambia solo.
import { tr, currentLang } from './i18n.js';
import { AXIES } from './axies.js';
import { moonIcon, KEY_KINDS } from './evolution.js';
import { store } from './loadout.js';
import {
  MISSIONS, PASS_TIERS, TIER_POINTS, PASS_BONUS_POINTS, DAILY_SWAPS,
  taskText, taskDone, taskReward, taskPay, tierReward, passTier, passBonusEarned, resetsIn,
  refreshMissions, claimMission, claimPassTier, claimPassBonus, swapMission,
} from './missions.js';

/** Cuándo el panel no entra al costado del mapa y queda solo el botón. */
export const QUESTS_COMPACT = '(orientation: portrait), (max-width: 620px), (max-height: 500px)';
/** Si el panel quedó abierto o plegado: una comodidad de esta pantalla, nada más. */
const QUESTS_OPEN_KEY = 'axie-chance:quests-open';

const questAmount = (n) => Number(n).toLocaleString(currentLang() === 'en' ? 'en-US' : 'es-AR');

/** El nombre de cada llave. */
export const keyName = (kind) => ({ basic: tr('Llave común'), gold: tr('Llave de oro') }[kind]);

/** Una llave, pintada en `#ic-key`; el color sale de su clase (`.key-ico` en el CSS). */
export const keyIcon = (kind) =>
  `<svg class="key-ico" data-key="${kind}" viewBox="0 0 100 100" aria-hidden="true"><use href="#ic-key"/></svg>`;

/**
 * Lo que lo que paga una misión o un escalón, en chapitas: los Moonshards con su luna,
 * la AXP y cada llave con su dibujo. `{ moonshards?, axp?, basic?, gold? }`.
 */
export function rewardHtml(reward) {
  const parts = [];
  for (const kind of [...KEY_KINDS].reverse()) {
    if (reward[kind]) parts.push(`<span class="qr" title="${keyName(kind)}">${keyIcon(kind)}<b>${reward[kind] > 1 ? `×${reward[kind]}` : ''}</b></span>`);
  }
  if (reward.moonshards) parts.push(`<span class="qr" title="${tr('Moonshards')}">${moonIcon('moon-ico')}<b>${questAmount(reward.moonshards)}</b></span>`);
  if (reward.axp) parts.push(`<span class="qr qr--axp" title="${tr('AXP')}"><i>${tr('AXP')}</i><b>${questAmount(reward.axp)}</b></span>`);
  return parts.join('');
}

/** Lo que falta, corto: "27 d 5 h", "5 h 12 min", "8 min". */
export function leftText(ms) {
  const min = Math.max(1, Math.ceil(ms / 60000));
  if (min >= 1440) {
    const d = Math.floor(min / 1440);
    const h = Math.floor((min % 1440) / 60);
    return h ? tr('{d} d {h} h', { d, h }) : tr('{d} d', { d });
  }
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? tr('{h} h {m} min', { h, m }) : tr('{h} h', { h });
  }
  return tr('{m} min', { m: min });
}

/** Lo que hay para cobrar: misiones del día y de la semana, escalones y llaves de más. */
export function claimableOf(state) {
  const ready = (list) => list.filter((t) => taskDone(t) && !t.claimed).length;
  const daily = ready(state.daily);
  const weekly = ready(state.weekly);
  const reached = passTier(state.pass.points);
  let tiers = 0;
  for (let t = 1; t <= reached; t++) if (!state.pass.claimed.includes(t)) tiers++;
  const bonus = Math.max(0, passBonusEarned(state.pass.points) - state.pass.bonus);
  return { daily, weekly, tiers, bonus, total: daily + weekly + tiers + (bonus > 0 ? 1 : 0) };
}

/** La flecha que da la vuelta, para cambiar una misión. */
const SWAP_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 9A8 8 0 0 0 5 7.5M4.5 15A8 8 0 0 0 19 16.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M20.5 3.5v6h-6M3.5 20.5v-6h6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** Una misión: lo que paga, lo que dice, su barra y, según cómo esté, cobrar o cambiarla. */
function taskHtml(t, index, scope, state, just) {
  const task = MISSIONS[t.id];
  const done = taskDone(t);
  const st = t.claimed ? 'claimed' : done ? 'done' : 'todo';
  const frac = Math.min(1, t.n / task.target);
  const key = `${scope}:${index}`;
  let action = '';
  if (st === 'done') action = `<button type="button" class="qb-claim" data-claim="${key}">${tr('Cobrar')}</button>`;
  else if (st === 'claimed') action = `<span class="qb-check" role="img" aria-label="${tr('Cobrada')}"></span>`;
  else if (scope === 'daily' && state.swaps < DAILY_SWAPS) {
    action = `<button type="button" class="qb-swap" data-swap="${index}" title="${tr('Cambiar esta misión por otra (una por día)')}" aria-label="${tr('Cambiar misión')}">${SWAP_ICON}</button>`;
  }
  const fly = just === key ? `<span class="qb-fly" aria-hidden="true">${rewardHtml(taskReward(task))}</span>` : '';
  return `<li class="qb-task" data-state="${st}"${just === key ? ' data-just="true"' : ''}>
    <span class="qb-reward" data-pays="${task.pays}">${rewardHtml(taskReward(task))}</span>
    <span class="qb-main">
      <span class="qb-text">${taskText(task)}</span>
      <span class="qb-line">
        <span class="qb-bar" style="--fill:${frac.toFixed(3)}"><i></i><small>${questAmount(t.n)}/${questAmount(task.target)}</small></span>
        <small class="qb-pts" title="${tr('Puntos del pase')}">+${taskPay(task).points}</small>
      </span>
    </span>
    ${action}${fly}
  </li>`;
}

/** La tira del pase, abajo del panel: el escalón, la barra al que sigue y si hay qué cobrar. */
function passStripHtml(state, now, ready) {
  const tier = passTier(state.pass.points);
  const into = tier >= PASS_TIERS ? TIER_POINTS : state.pass.points - tier * TIER_POINTS;
  return `<button type="button" class="qb-pass" data-open-pass aria-label="${tr('Pase de temporada')}">
    <span class="qb-pass-tier"><b>${tier}</b></span>
    <span class="qb-pass-main">
      <span class="qb-pass-name">${tr('Temporada {n}', { n: state.pass.season })} · ${tr('termina en {t}', { t: leftText(resetsIn(now).season) })}</span>
      <span class="qb-bar" style="--fill:${(into / TIER_POINTS).toFixed(3)}"><i></i><small>${into}/${TIER_POINTS}</small></span>
    </span>
    <b class="nav-count">${ready || ''}</b>
  </button>`;
}

/** Las pestañas: del día y de la semana con lo que falta para que se renueven; en la hoja, el pase. */
function tabsHtml(tab, now, ready, { pass = false } = {}) {
  const left = resetsIn(now);
  const one = (id, label, sub, n) => `<button type="button" role="tab" class="qb-tab" data-tab="${id}" aria-selected="${tab === id}">
    <span>${label}</span>${sub ? `<small>${sub}</small>` : ''}<b class="nav-count">${n || ''}</b></button>`;
  return `<div class="qb-tabs" role="tablist">
    ${one('daily', tr('Del día'), leftText(left.day), ready.daily)}
    ${one('weekly', tr('Semana'), leftText(left.week), ready.weekly)}
    ${pass ? one('pass', tr('Pase'), '', ready.tiers + (ready.bonus > 0 ? 1 : 0)) : ''}
  </div>`;
}

/** El pase entero: el escalón, la barra, las llaves que tenés y los 40 escalones. */
export function passHtml(state, { now = new Date(), wallet = null } = {}) {
  const { pass } = state;
  const tier = passTier(pass.points);
  const into = tier >= PASS_TIERS ? TIER_POINTS : pass.points - tier * TIER_POINTS;
  const ready = claimableOf(state);
  const tiles = Array.from({ length: PASS_TIERS }, (_, i) => {
    const n = i + 1;
    const st = pass.claimed.includes(n) ? 'claimed' : n <= tier ? 'ready' : 'locked';
    const big = n % 5 === 0;
    const inner = `<span class="qp-no">${n}</span><span class="qp-reward">${rewardHtml(tierReward(n))}</span>`;
    return st === 'ready'
      ? `<li class="qp-tier" data-state="ready" data-big="${big}"><button type="button" data-tier="${n}" aria-label="${tr('Cobrar el escalón {n}', { n })}">${inner}<span class="qp-cta">${tr('Cobrar')}</span></button></li>`
      : `<li class="qp-tier" data-state="${st}" data-big="${big}"${n === tier + 1 ? ' data-next="true"' : ''}>${inner}${st === 'claimed' ? '<span class="qb-check" aria-hidden="true"></span>' : ''}</li>`;
  }).join('');
  const bonusLeft = ready.bonus;
  const keys = wallet ? `<p class="qp-keys"><span>${tr('Tus llaves')}</span>${KEY_KINDS.map((k) => `<span class="qr" title="${keyName(k)}">${keyIcon(k)}<b>${wallet.keys[k]}</b></span>`).join('')}</p>` : '';
  return `<div class="qp-head">
      <span class="qp-tier-big"><small>${tr('Escalón')}</small><b>${tier}</b><small>${tr('de {n}', { n: PASS_TIERS })}</small></span>
      <div class="qp-info">
        <p class="qp-season">${tr('Temporada {n}', { n: pass.season })} <small>${tr('termina en {t}', { t: leftText(resetsIn(now).season) })}</small></p>
        <span class="qb-bar qp-bar" style="--fill:${(into / TIER_POINTS).toFixed(3)}"><i></i><small>${tier >= PASS_TIERS ? tr('¡Completo!') : tr('{a} de {b} puntos', { a: into, b: TIER_POINTS })}</small></span>
        <p class="qp-how">${tr('Cada misión cumplida suma puntos; cada {n}, un escalón.', { n: TIER_POINTS })}</p>
      </div>
      ${ready.tiers > 1 ? `<button type="button" class="qb-claim qp-all" data-claim-all>${tr('Cobrar todo')}</button>` : ''}
    </div>
    ${keys}
    <ol class="qp-track">${tiles}</ol>
    <p class="qp-bonus">${tr('Pasado el {n}, una llave cada {p} puntos.', { n: PASS_TIERS, p: PASS_BONUS_POINTS })}
      ${bonusLeft > 0 ? `<button type="button" class="qb-claim" data-bonus>${tr('Cobrar')} ${rewardHtml({ basic: bonusLeft })}</button>` : ''}</p>`;
}

/**
 * Lo de adentro del panel o de la hoja (`sheet`): las pestañas y la lista, y abajo la
 * tira del pase; en la hoja, la pestaña del pase lo muestra entero.
 */
export function boardHtml(state, { tab = 'daily', now = new Date(), sheet = false, just = null, wallet = null, axieName = '' } = {}) {
  const ready = claimableOf(state);
  const head = tabsHtml(tab, now, ready, { pass: sheet });
  if (tab === 'pass') return head + passHtml(state, { now, wallet });
  const scope = tab === 'weekly' ? 'weekly' : 'daily';
  const list = state[scope].map((t, i) => taskHtml(t, i, scope, state, just)).join('');
  const note = sheet && axieName ? `<p class="qb-note">${tr('La AXP va a {name}, tu Axie elegido.', { name: axieName })}</p>` : '';
  return `${head}<ul class="qb-list" data-scope="${scope}">${list}</ul>${note}${sheet ? '' : passStripHtml(state, now, ready.tiers + (ready.bonus > 0 ? 1 : 0))}`;
}

/**
 * El panel, el botón y la hoja: `panel` (el `<aside>`), `host` (el mapa, que dice si
 * está abierto o plegado en `data-quests`), `body` (lo de adentro),
 * `fold` (plegarlo), `button` y `count` (el botón y su chapa), `navCount` (la chapa en
 * la pestaña del mapa), `sheet` y `sheetBody` (el `<dialog>`). `axie()` dice tu Axie
 * elegido, que cobra la AXP; `wallet()` lee la bolsa; `onPaid` avisa que cambió.
 */
export function createMissionsView({
  panel, host = panel?.parentElement, body, fold, button, count, navCount, sheet, sheetBody,
  axie = () => null, wallet = () => null, audio = null, onPaid = null,
} = {}) {
  let tab = 'daily';
  let sheetTab = 'daily';
  let just = null;
  let timer = null;
  let live = false;
  let state = null;
  let open = true;
  try { open = store()?.getItem(QUESTS_OPEN_KEY) !== 'false'; } catch { /* sin almacenamiento, abierto */ }

  const compact = () => typeof matchMedia === 'function' && matchMedia(QUESTS_COMPACT).matches;
  const axieName = () => AXIES[axie()]?.name ?? '';

  function render(now) {
    const ready = claimableOf(state);
    if (host) host.dataset.quests = open ? 'open' : 'closed';
    if (fold) {
      fold.setAttribute('aria-expanded', String(open));
      fold.setAttribute('aria-label', tr('Ocultar misiones'));
    }
    if (body) body.innerHTML = boardHtml(state, { tab, now, just });
    for (const node of [count, navCount]) if (node) node.textContent = ready.total ? String(ready.total) : '';
    if (button) button.setAttribute('aria-label', ready.total ? tr('Misiones: {n} para cobrar', { n: ready.total }) : tr('Misiones'));
    if (sheet?.open && sheetBody) {
      sheetBody.innerHTML = boardHtml(state, { tab: sheetTab, now, sheet: true, just, wallet: wallet(), axieName: axieName() });
    }
    just = null;
  }

  /** Relee, renueva lo que toque y pinta. Mientras se ve, vuelve a cada minuto. */
  function paint({ now = new Date() } = {}) {
    state = refreshMissions({ now, axie: axie() }).state;
    render(now);
    live = true;
    clearTimeout(timer);
    timer = setTimeout(() => { if (live) paint(); }, 60000 - (Date.now() % 60000) + 50);
    // En Node (los tests) el reloj no tiene que mantener viva la corrida.
    timer?.unref?.();
  }

  /** Deja de volver a pintar: el mapa quedó de fondo. */
  function stop() {
    live = false;
    clearTimeout(timer);
  }

  function setOpen(next) {
    open = next;
    try { store()?.setItem(QUESTS_OPEN_KEY, String(open)); } catch { /* ídem */ }
    if (state) render(new Date());
  }

  function openSheet(which = 'daily') {
    if (!sheet) return;
    sheetTab = which;
    if (!sheet.open) sheet.showModal?.();
    paint();
  }

  /** Lo que se toca adentro del panel o de la hoja. */
  function act(e, inSheet) {
    const t = e.target?.closest?.('[data-claim], [data-swap], [data-tab], [data-open-pass], [data-tier], [data-claim-all], [data-bonus]');
    if (!t) return;
    const d = t.dataset ?? {};
    if (d.tab) {
      if (inSheet) sheetTab = d.tab;
      else tab = d.tab;
      render(new Date());
      return;
    }
    if ('openPass' in d) { openSheet('pass'); return; }
    let paid = null;
    if (d.claim) {
      const [scope, index] = d.claim.split(':');
      paid = claimMission(scope, Number(index), { axie: axie() });
      if (paid) just = d.claim;
    } else if (d.swap) {
      swapMission(Number(d.swap));
    } else if (d.tier) {
      paid = claimPassTier(Number(d.tier));
    } else if ('claimAll' in d) {
      const reached = passTier(state.pass.points);
      const all = [];
      for (let n = 1; n <= reached; n++) {
        const got = claimPassTier(n);
        if (got) all.push(got);
      }
      paid = all.length ? all[all.length - 1] : null;
    } else if ('bonus' in d) {
      paid = claimPassBonus();
    }
    if (paid) {
      audio?.sfx?.('take', { rate: 1.1, gain: 0.85 });
      onPaid?.(paid);
    }
    paint();
  }

  body?.addEventListener('click', (e) => act(e, false));
  sheetBody?.addEventListener('click', (e) => act(e, true));
  fold?.addEventListener('click', () => setOpen(false));
  button?.addEventListener('click', () => {
    if (compact()) openSheet('daily');
    else setOpen(true);
  });

  return { paint, stop, openSheet, setOpen, get state() { return state; } };
}

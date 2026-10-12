// El Taller: donde se crean cartas para la mochila (ver `crafting.js`). Las que se
// repiten se fusionan desde la mochila (ver `fuse` en `lobby.js`).
//
// Es la pestaña del yunque. A la izquierda, la forja: un mazo de dorsos, la barra de la
// carta con poder asegurada (una cada 50) y dos botones, crear una o crear diez, con lo
// que cuesta cada uno: llaves comunes si alcanzan para la tanda (son lo mismo que crear
// con Moonshards), si no Moonshards. Debajo, la llave de oro: usa una de las tuyas o, si
// no tenés, cambia diez comunes (`KEY_TRADE`) o la compra (`KEY_COST`), con la barra de
// su legendaria asegurada (una cada 50). A la derecha, siempre, las chances de cada
// rareza con su gema, y las de la llave de oro al lado: lo que se sortea se dice entero,
// sin letra chica.
//
// Crear es un momento (ver `playCraft` en `card-scene.js`): un cofre que se sacude más
// cuanto mejor es lo de adentro, se abre y suelta las cartas de espaldas, las raras que avisan antes de darse vuelta y
// la mejor en grande. Lo que sale ya está en la mochila cuando arranca: la escena solo
// lo cuenta. La evolución de las cartas de cada Axie no está acá: se hace desde la
// elección de Axies (ver `evolve-view.js`).
import { tr, currentLang } from './i18n.js';
import { readBackpack, writeBackpack, addToBackpack } from './backpack.js';
import { readWallet, writeWallet, shardAmount, shardsHtml, moonIcon, KEY_KINDS } from './evolution.js';
import {
  CRAFT_TIERS, CRAFT_COST, CRAFT_BATCH, CRAFT_PITY, CRAFT_ODDS_TOTAL, KEY_ODDS, KEY_TRADE, KEY_COST, GOLD_PITY,
  readCraft, writeCraft, craftCards, craftBlock, tradeKeys, buyKeys, pityLeft, goldPityLeft, tierName, tierWeight,
} from './crafting.js';
import { keyIcon, keyName } from './missions-view.js';
import { playCraft, gemHtml } from './card-scene.js';
import { preloadVfx } from './vfx.js';

const wsEl = (id) => document.getElementById(id);

/** Lo que trae una carta de esa rareza, en pocas palabras. */
function tierWhat(tier) {
  const symbols = tier.symbols === 1 ? tr('1 símbolo') : tr('{n} símbolos', { n: tier.symbols });
  return tier.power ? tr('{symbols} + poder de clase', { symbols }) : symbols;
}

/** Una chance en diez mil como porcentaje del idioma: 80 %, 0,85 %, 0,01 %. */
const oddsText = (weight) =>
  `${(weight * 100 / CRAFT_ODDS_TOTAL).toLocaleString(currentLang() === 'en' ? 'en-US' : 'es-AR', { maximumFractionDigits: 2 })}%`;

/** Lo que se paga con llaves: la llave y cuántas, como el precio en Moonshards. */
const keysHtml = (kind, n) => `<span class="moon-amt key-amt">${keyIcon(kind)}<b>${n}</b></span>`;

/** Una chance de la tabla, o una raya si así no sale. */
const pctHtml = (weight, kind = '') =>
  `<b class="forge-odd-pct${kind ? ` forge-odd-pct--${kind}` : ''}">${weight ? oddsText(weight) : '—'}</b>`;

/**
 * Un renglón de las chances: la gema de la rareza, una carta en miniatura con tantos
 * casilleros como símbolos (y la estrella del poder), el nombre, lo que trae y su chance
 * con Moonshards o la llave común (son las mismas) y con la de oro.
 */
function oddsRowHtml(tier) {
  const slots = Array.from({ length: tier.symbols }, () => '<i></i>').join('');
  return `<li class="forge-odd" data-tier="${tier.id}">
    ${gemHtml('forge-gem')}
    <span class="forge-mini" aria-hidden="true">${slots}${tier.power ? '<b class="forge-mini-power">★</b>' : ''}</span>
    <span class="forge-odd-name"><b>${tierName(tier.id)}</b><small>${tierWhat(tier)}</small></span>
    ${pctHtml(tier.weight)}${pctHtml(tierWeight(tier, KEY_ODDS.gold), 'gold')}
  </li>`;
}

/**
 * El Taller, montado sobre el HTML de `#lobby-craft`.
 *
 * @param {{audio?: object, host?: HTMLElement, onCrafted?: (bag: object, cards: object[]) => void,
 *   onBag?: () => void}} opts
 *   `audio` es el mezclador de la mesa (ver `audio.js`); `host`, donde se abre la escena
 *   de crear (tapa la portada entera); `onCrafted` le pasa a la portada la mochila nueva
 *   y lo creado, para contar las sueltas y marcar las nuevas; `onBag` abre la mochila.
 */
export function createWorkshop({ audio = null, host = null, onCrafted = null, onBag = null } = {}) {
  const root = wsEl('lobby-craft');
  if (!root) return { open() {}, stop() {}, refresh() {} };
  let wallet = { moonshards: 0, keys: { basic: 0, gold: 0 } };
  let state = { crafted: 0, gold: 0 };
  /** Mientras la escena cuenta lo creado no se crea otra tanda. */
  let busy = false;

  function paintPurse() {
    wsEl('craft-shards').textContent = shardAmount(wallet.moonshards);
    wsEl('craft-purse').title = tr('{n} Moonshards', { n: shardAmount(wallet.moonshards) });
    // Las llaves que tenés, al lado de los Moonshards; sin ninguna, no se ve.
    const keys = wsEl('craft-keys');
    if (!keys) return;
    const own = KEY_KINDS.filter((k) => wallet.keys[k] > 0);
    keys.hidden = !own.length;
    keys.innerHTML = own.map((k) => `<span title="${keyName(k)}">${keyIcon(k)}<b>${wallet.keys[k]}</b></span>`).join('');
  }

  /**
   * Cómo se paga una tanda de `count`. La de siempre (`gold` falso): con llaves comunes
   * si alcanzan para toda, si no con Moonshards. La de oro: con las tuyas, y las que
   * falten, cambiando diez comunes por cada una (`trade`) o, si no alcanzan, comprándolas
   * (`buy`). `block` dice por qué no, `short` cuántos Moonshards faltan y `price` es lo
   * que muestra el botón.
   */
  function payment(count, gold = false) {
    if (gold) {
      const missing = Math.max(0, count - wallet.keys.gold);
      if (!missing) return { key: 'gold', trade: 0, buy: 0, block: null, price: keysHtml('gold', count) };
      if (wallet.keys.basic >= missing * KEY_TRADE) {
        return { key: 'gold', trade: missing, buy: 0, block: null, price: keysHtml('basic', missing * KEY_TRADE) };
      }
      const cost = missing * KEY_COST.gold;
      return {
        key: 'gold', trade: 0, buy: missing,
        block: wallet.moonshards < cost ? 'shards' : null,
        short: cost - wallet.moonshards,
        price: shardsHtml(cost),
      };
    }
    if (wallet.keys.basic >= count) return { key: 'basic', trade: 0, buy: 0, block: null, price: keysHtml('basic', count) };
    return {
      key: null, trade: 0, buy: 0,
      block: craftBlock(wallet, count),
      short: count * CRAFT_COST - wallet.moonshards,
      price: shardsHtml(count * CRAFT_COST),
    };
  }

  /** La barra de la garantía: cuántas faltan para la próxima con poder. */
  function paintPity() {
    const left = pityLeft(state);
    const into = CRAFT_PITY - left;
    const text = left === 1
      ? tr('¡La próxima trae poder!')
      : tr('Carta con poder asegurada en {n}', { n: left });
    wsEl('forge-pity-fill').style.setProperty('--fill', (into / CRAFT_PITY).toFixed(3));
    wsEl('forge-pity-text').textContent = text;
    const bar = wsEl('forge-pity');
    bar.setAttribute('aria-valuenow', String(into));
    bar.setAttribute('aria-valuetext', text);
    bar.dataset.near = String(left === 1);
  }

  /**
   * Los botones, con lo que cuestan: crear una, crear diez y la llave de oro, con la
   * barra de su legendaria asegurada. Apagados si no alcanza o mientras sale una tanda.
   */
  function paintActs() {
    const one = payment(1);
    const many = payment(CRAFT_BATCH);
    const gold = payment(1, true);
    const why = one.block ? tr('Te faltan {n} Moonshards', { n: shardAmount(one.short) }) : '';
    const goldTitle = gold.block
      ? tr('Te faltan {n} Moonshards', { n: shardAmount(gold.short) })
      : gold.buy
        ? tr('Compra una llave de oro y la usa')
        : gold.trade
          ? tr('Cambia {n} llaves comunes por una de oro y la usa', { n: KEY_TRADE })
          : tr('Usa una de tus {n} llaves de oro', { n: wallet.keys.gold });
    const goldLeft = goldPityLeft(state);
    const goldText = goldLeft === 1
      ? tr('¡La próxima de oro es legendaria!')
      : tr('Legendaria asegurada en {n}', { n: goldLeft });
    wsEl('forge-acts').innerHTML = `
      <button class="lobby-play forge-go" data-craft="1" ${one.block || busy ? 'disabled' : ''}>
        <span>${tr('Crear ×1')}</span>${one.price}
      </button>
      <button class="lobby-play forge-go forge-go--batch" data-craft="${CRAFT_BATCH}" ${many.block || busy ? 'disabled' : ''}
        ${many.block && !one.block ? `title="${tr('Te faltan {n} Moonshards', { n: shardAmount(many.short) })}"` : ''}>
        <span>${tr('Crear ×{n}', { n: CRAFT_BATCH })}</span>${many.price}
      </button>
      ${why ? `<p class="forge-why">${why}</p>` : ''}
      <button class="lobby-play forge-go forge-go--gold" data-craft="1" data-key="gold" ${gold.block || busy ? 'disabled' : ''}
        title="${goldTitle}">
        ${keyIcon('gold')}<span>${keyName('gold')}</span>${gold.price}
      </button>
      <div class="forge-pity forge-pity--gold" role="progressbar" aria-valuemin="0" aria-valuemax="${GOLD_PITY}"
        aria-valuenow="${GOLD_PITY - goldLeft}" aria-valuetext="${goldText}" data-near="${goldLeft === 1}">
        <i class="forge-pity-fill" style="--fill:${((GOLD_PITY - goldLeft) / GOLD_PITY).toFixed(3)}"></i>
        <small class="forge-pity-text">${goldText}</small>
      </div>`;
  }

  function paintOdds() {
    // Las dos columnas: con Moonshards o la llave común (lo mismo) y con la de oro.
    wsEl('forge-odds-head').innerHTML = `<span title="Moonshards · ${keyName('basic')}">${moonIcon()}${keyIcon('basic')}</span>`
      + `<span title="${keyName('gold')}">${keyIcon('gold')}</span>`;
    wsEl('forge-odds').innerHTML = CRAFT_TIERS.map(oddsRowHtml).join('');
    wsEl('forge-rule').textContent = tr('Cada símbolo sale entre las seis clases y se pueden repetir. Cada {n} cartas, una con poder asegurada.', { n: CRAFT_PITY });
  }

  function paint() {
    paintPurse();
    paintPity();
    paintActs();
    paintOdds();
  }

  /**
   * Crea `count` cartas: cobra (ver `payment`; con la de oro, cambia o compra las que
   * falten), las guarda en la mochila y abre la escena que las cuenta. Desde ahí se puede
   * crear otra tanda igual, ir a la mochila o seguir.
   */
  async function craft(count, gold = false) {
    const pay = payment(count, gold);
    if (busy || pay.block) return;
    const paid = pay.trade ? tradeKeys(wallet, pay.trade) : pay.buy ? buyKeys(wallet, 'gold', pay.buy) : wallet;
    if (!paid) return;
    const made = craftCards(state, paid, count, Math.random, { key: pay.key });
    if (!made.cards.length) return;
    state = made.state;
    wallet = made.wallet;
    writeWallet(wallet);
    writeCraft(state);
    const bag = addToBackpack(readBackpack(), made.cards);
    writeBackpack(bag);
    onCrafted?.(bag, made.cards);

    busy = true;
    paintPurse();
    paintPity();
    paintActs();
    const next = payment(count, gold);
    const choice = await playCraft({
      host, cards: made.cards, audio,
      again: { count, price: next.price, ok: !next.block },
    });
    busy = false;
    paintActs();
    if (choice === 'again') return craft(count, gold);
    if (choice === 'bag') onBag?.();
    return choice;
  }

  root.addEventListener('click', (e) => {
    const go = e.target.closest?.('[data-craft]:not([disabled])');
    if (go) craft(Number(go.dataset.craft), go.dataset.key === 'gold');
  });

  return {
    /** Pone el Taller, leyendo de nuevo lo guardado. */
    open() {
      wallet = readWallet();
      state = readCraft();
      wsEl('forge-stack').innerHTML = '<i></i><i></i><i></i>';
      // El estallido de las épicas se baja de a poco, con la página libre.
      preloadVfx('win', { later: true });
      paint();
    },
    /** Al salir de la pestaña no queda nada andando: la escena tapa la barra mientras dura. */
    stop() {},
    /** Vuelve a leer lo guardado y repinta (la zona de testeo da Moonshards). */
    refresh() {
      wallet = readWallet();
      state = readCraft();
      paint();
    },
  };
}

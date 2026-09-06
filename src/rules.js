// Una "cadena" es la tirada de un jugador dentro de una ronda.
//
// Reglas:
//  - La primera carta abre una racha por cada símbolo que tiene.
//  - Cada carta siguiente debe compartir al menos un símbolo todavía vivo.
//    Si no comparte ninguno, se corta todo: la ronda vale 0.
//  - Las rachas que la carta nueva no contiene mueren, pero conservan su largo.
//  - Puntos = suma de (largo de racha)^2. Solo puntúan los símbolos de la primera carta.

export function emptyChain() {
  return { cards: [], runs: [], busted: false, bustCard: null };
}

export function activeSymbols(chain) {
  return chain.runs.filter((r) => r.alive).map((r) => r.symbol);
}

function cardExtends(chain, card) {
  if (chain.cards.length === 0) return true;
  const alive = activeSymbols(chain);
  return card.symbols.some((s) => alive.includes(s));
}

// Devuelve una cadena nueva (no muta la anterior) para poder simular en la IA.
export function playCard(chain, card) {
  if (chain.busted) return chain;

  if (chain.cards.length === 0) {
    return {
      cards: [card],
      runs: card.symbols.map((symbol) => ({ symbol, length: 1, alive: true })),
      busted: false,
      bustCard: null,
    };
  }

  if (!cardExtends(chain, card)) {
    return { ...chain, busted: true, bustCard: card };
  }

  return {
    cards: [...chain.cards, card],
    runs: chain.runs.map((run) => {
      if (!run.alive) return run;
      return card.symbols.includes(run.symbol)
        ? { ...run, length: run.length + 1 }
        : { ...run, alive: false };
    }),
    busted: false,
    bustCard: null,
  };
}

export function scoreChain(chain) {
  if (chain.busted) {
    return { total: 0, breakdown: chain.runs.map((r) => ({ ...r, points: 0 })) };
  }
  const breakdown = chain.runs
    .map((r) => ({ ...r, points: r.length * r.length }))
    .sort((a, b) => b.points - a.points);
  return { total: breakdown.reduce((sum, r) => sum + r.points, 0), breakdown };
}

// ¿Esta carta forma parte de la racha del símbolo? Sirve para pintar la mesa.
export function isScoringCell(chain, cardIndex, symbol) {
  const run = chain.runs.find((r) => r.symbol === symbol);
  return Boolean(run && run.length > cardIndex);
}

// Probabilidad de que la próxima carta del mazo continúe la cadena.
export function survivalOdds(chain, deck) {
  if (deck.length === 0) return { ok: 0, total: 0, p: 0 };
  if (chain.cards.length === 0) return { ok: deck.length, total: deck.length, p: 1 };
  const alive = activeSymbols(chain);
  const ok = deck.filter((c) => c.symbols.some((s) => alive.includes(s))).length;
  return { ok, total: deck.length, p: ok / deck.length };
}

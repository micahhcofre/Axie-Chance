// Códigos QR, sin librerías.
//
// Sirven para una sola cosa: que el otro aparato entre a tu sala apuntándole con la
// cámara, en vez de tipear una dirección con puntos y números en el celular. Lo que se
// codifica es siempre texto corto —un link—, así que acá hay lo justo: modo byte,
// corrección de errores M (aguanta ~15 % del código tapado o gastado) y la versión más
// chica en la que entre. El algoritmo es el del estándar (ISO/IEC 18004), en el orden
// en que lo cuenta: armar los bits, repartirlos en bloques con Reed-Solomon, dibujar
// los patrones fijos, llenar el resto en zigzag y quedarse con la máscara que menos
// penaliza.
//
// Todos los nombres de arriba empiezan con `qr`: el build de un solo archivo concatena
// los módulos sin envolverlos y dos nombres iguales en archivos distintos chocan (ver
// `build.mjs`).

/** Palabras de corrección por bloque y cantidad de bloques, nivel M, versiones 1 a 40. */
const QR_ECC_PER_BLOCK = [
  10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26,
  26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
];
const QR_BLOCKS = [
  1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16,
  17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
];
/** El nivel M se escribe 00 en los bits de formato. */
const QR_LEVEL_BITS = 0;

const qrBit = (value, i) => ((value >>> i) & 1) !== 0;

/** Producto en GF(256) con el polinomio del estándar, x⁸ + x⁴ + x³ + x² + 1. */
function qrMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

/** El generador de Reed-Solomon de ese grado, sin el coeficiente principal. */
function qrDivisor(degree) {
  const out = new Array(degree).fill(0);
  out[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      out[j] = qrMul(out[j], root);
      if (j + 1 < degree) out[j] ^= out[j + 1];
    }
    root = qrMul(root, 2);
  }
  return out;
}

function qrRemainder(data, divisor) {
  const out = divisor.map(() => 0);
  for (const byte of data) {
    const factor = byte ^ out.shift();
    out.push(0);
    divisor.forEach((coef, i) => { out[i] ^= qrMul(coef, factor); });
  }
  return out;
}

/** Cuántos módulos quedan para datos una vez dibujado todo lo fijo. */
function qrRawModules(version) {
  let n = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (version >= 7) n -= 36;
  }
  return n;
}

const qrDataCodewords = (version) =>
  Math.floor(qrRawModules(version) / 8) - QR_ECC_PER_BLOCK[version - 1] * QR_BLOCKS[version - 1];

/** Dónde van los centros de los patrones de alineación, en cada eje. */
function qrAlignment(version, size) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < count; pos -= step) out.splice(1, 0, pos);
  return out;
}

/** Los bytes a codificar, con su versión: la más chica en la que entran. */
function qrCodewords(bytes) {
  let version = 1;
  for (; version <= 40; version++) {
    const countBits = version < 10 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= qrDataCodewords(version) * 8) break;
  }
  if (version > 40) throw new RangeError('Texto demasiado largo para un QR');

  const bits = [];
  const push = (value, len) => { for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  push(0b0100, 4);                                  // modo byte
  push(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));

  const capacity = qrDataCodewords(version) * 8;
  push(0, Math.min(4, capacity - bits.length));     // terminador
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((acc, b) => (acc << 1) | b, 0));
  }
  return { version, codewords: qrInterleave(data, version) };
}

/** Parte los datos en bloques, le agrega a cada uno su corrección y los entrelaza. */
function qrInterleave(data, version) {
  const blocks = QR_BLOCKS[version - 1];
  const eccLen = QR_ECC_PER_BLOCK[version - 1];
  const raw = Math.floor(qrRawModules(version) / 8);
  const shortBlocks = blocks - (raw % blocks);
  const shortLen = Math.floor(raw / blocks);
  const divisor = qrDivisor(eccLen);

  const all = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const chunk = data.slice(k, k + shortLen - eccLen + (i < shortBlocks ? 0 : 1));
    k += chunk.length;
    const ecc = qrRemainder(chunk, divisor);
    if (i < shortBlocks) chunk.push(0);
    all.push(chunk.concat(ecc));
  }
  const out = [];
  for (let i = 0; i < all[0].length; i++) {
    all.forEach((block, j) => {
      // El relleno de los bloques cortos no viaja.
      if (i !== shortLen - eccLen || j >= shortBlocks) out.push(block[i]);
    });
  }
  return out;
}

const QR_MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/**
 * Lo que el estándar castiga en una máscara: rachas largas del mismo color, bloques
 * de 2×2, cosas que se parecen a un ojo del QR y mucho más negro que blanco (o al
 * revés). Cualquier máscara se lee; la de menos castigo se lee mejor con mala luz.
 */
function qrPenalty(grid) {
  const size = grid.length;
  let score = 0;
  const lines = [];
  for (let i = 0; i < size; i++) {
    lines.push(grid[i]);
    lines.push(grid.map((row) => row[i]));
  }
  const finderA = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const finderB = [...finderA].reverse();
  for (const line of lines) {
    for (let i = 0, run = 1; i < size; i++, run++) {
      if (i === size - 1 || line[i] !== line[i + 1]) {
        if (run >= 5) score += run - 2;
        run = 0;
      }
    }
    const padded = [0, 0, 0, 0, ...line.map(Number), 0, 0, 0, 0];
    for (let i = 0; i + 11 <= padded.length; i++) {
      const win = padded.slice(i, i + 11);
      if (win.every((v, j) => v === finderA[j]) || win.every((v, j) => v === finderB[j])) score += 40;
    }
  }
  let dark = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y][x]) dark++;
      if (y < size - 1 && x < size - 1) {
        const c = grid[y][x];
        if (c === grid[y][x + 1] && c === grid[y + 1][x] && c === grid[y + 1][x + 1]) score += 3;
      }
    }
  }
  const total = size * size;
  score += Math.max(0, Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return score;
}

/**
 * La grilla de un QR para ese texto: filas de `true` (oscuro) y `false` (claro), sin
 * el margen blanco de alrededor.
 */
export function qrMatrix(text) {
  const { version, codewords } = qrCodewords([...new TextEncoder().encode(text)]);
  const size = version * 4 + 17;
  const grid = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    grid[y][x] = dark;
    fixed[y][x] = true;
  };

  // Lo fijo: las líneas de tiempo, los tres ojos, las alineaciones y la versión.
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, d !== 2 && d !== 4);
      }
    }
  }
  const align = qrAlignment(version, size);
  align.forEach((ay, i) => align.forEach((ax, j) => {
    const last = align.length - 1;
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }));

  const drawFormat = (mask) => {
    const data = (QR_LEVEL_BITS << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(8, i, qrBit(bits, i));
    set(8, 7, qrBit(bits, 6));
    set(8, 8, qrBit(bits, 7));
    set(7, 8, qrBit(bits, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, qrBit(bits, i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, qrBit(bits, i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, qrBit(bits, i));
    set(8, size - 8, true);
  };
  drawFormat(0);  // reserva el lugar; el de verdad va con la máscara elegida

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, qrBit(bits, i));
      set(b, a, qrBit(bits, i));
    }
  }

  // Los datos, en zigzag de a dos columnas desde la esquina de abajo a la derecha.
  let n = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let v = 0; v < size; v++) {
      const y = upward ? size - 1 - v : v;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (fixed[y][x] || n >= codewords.length * 8) continue;
        grid[y][x] = qrBit(codewords[n >>> 3], 7 - (n & 7));
        n++;
      }
    }
  }

  const applyMask = (mask) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!fixed[y][x] && QR_MASKS[mask](x, y)) grid[y][x] = !grid[y][x];
      }
    }
  };
  let best = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask);
    drawFormat(mask);
    const score = qrPenalty(grid);
    if (score < bestScore) { best = mask; bestScore = score; }
    applyMask(mask);  // la máscara es un XOR: aplicarla de nuevo la saca
  }
  applyMask(best);
  drawFormat(best);
  return grid;
}

/**
 * El QR dibujado en SVG, con los cuatro módulos de margen blanco que pide el estándar:
 * sin ese margen las cámaras no encuentran dónde empieza. Oscuro sobre blanco siempre,
 * sea cual sea el tema: al revés muchos lectores no lo leen.
 */
export function qrSvg(text, { label = '' } = {}) {
  const grid = qrMatrix(text);
  const span = grid.length + 8;
  let path = '';
  grid.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) path += `M${x + 4} ${y + 4}h1v1h-1z`;
  }));
  const title = label ? `<title>${label.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${span} ${span}" role="img"`
    + ` shape-rendering="crispEdges">${title}<rect width="${span}" height="${span}" fill="#fff"/>`
    + `<path fill="#1b1008" d="${path}"/></svg>`;
}

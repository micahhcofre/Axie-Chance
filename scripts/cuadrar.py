#!/usr/bin/env python3
"""Extiende los terrenos del kit hasta 1:1, agregando cielo arriba.

    python3 scripts/cuadrar.py <carpeta con los originales apaisados> [salida]

Los fondos del Axie Origins Asset Kit vienen apaisados (16:9), y un dibujo apaisado no
tiene cielo suficiente para llenar una pantalla: para que su horizonte caiga donde lo
quiere el juego —a dos tercios de alto— hay que agrandarlo casi al doble, y a 1600
píxeles de original eso se ve pixelado. Extendidos a 1:1 el horizonte ya está donde
tiene que estar y el dibujo se ve a su tamaño o más chico. Ver `--alto` en `styles.css`.

Corre con `sips`, que viene con macOS, y nada más. La salida hay que copiarla a
`Backgrounds/` y volver a medir `--horizonte` y `--cielo` (los dos cambian: el
horizonte porque la imagen creció para arriba, el cielo porque ahora hay uno).

**No se le da de comer lo que ya está en `Backgrounds/`**: esos archivos ya son 1:1 y
volver a extenderlos los estira de nuevo. Los originales apaisados son la entrada.
"""

import struct, subprocess, os

import sys, tempfile

if len(sys.argv) < 2:
    sys.exit(__doc__)
SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(SRC, 'cuadrados')
SCR = tempfile.mkdtemp(prefix='cuadrar-')
os.makedirs(OUT, exist_ok=True)

BANDA, COSER, FONDO = 40, 34, .70
CALINA, LEJOS = .93, .68      # dónde deja de verse la foto y dónde empieza el color

def bmp_in(path):
    tmp = os.path.join(SCR, '_in.bmp')
    subprocess.run(['sips', '-s', 'format', 'bmp', path, '--out', tmp],
                   capture_output=True, check=True)
    d = open(tmp, 'rb').read()
    off = struct.unpack_from('<I', d, 10)[0]
    w, h = struct.unpack_from('<ii', d, 18)
    assert struct.unpack_from('<H', d, 28)[0] == 24
    flip, h = h < 0, abs(h)
    stride = ((w * 3 + 3) // 4) * 4
    rows = [bytearray(d[off + y*stride: off + y*stride + w*3]) for y in range(h)]
    if not flip: rows.reverse()
    return w, h, rows

def bmp_out(path, w, h, rows):
    stride = ((w * 3 + 3) // 4) * 4
    body = b''.join(bytes(r) + b'\0' * (stride - w*3) for r in reversed(rows))
    head = struct.pack('<2sIHHI', b'BM', 54 + len(body), 0, 0, 54) + \
           struct.pack('<IiiHHIIiiII', 40, w, h, 1, 24, 0, len(body), 2835, 2835, 0, 0)
    open(path, 'wb').write(head + body)

def desenfoque(row, w, r):
    out = bytearray(len(row))
    for c in range(3):
        v = row[c::3]
        acc, n = sum(v[:r+1]), r+1
        for x in range(w):
            out[x*3+c] = acc // n
            if x - r >= 0: acc -= v[x-r]; n -= 1
            if x + r + 1 < w: acc += v[x+r+1]; n += 1
    return out

def limpiar(base, w, med):
    """Saca de la línea lo que no es cielo y lo rellena con lo que sí."""
    dev = [max(abs(base[x*3+c] - med[c]) for c in range(3)) for x in range(w)]
    tope = max(34, sorted(dev)[w // 2] * 3)
    sano = [d <= tope for d in dev]
    out = bytearray(base)
    if not any(sano): return out, 0
    x, tocadas = 0, 0
    while x < w:
        if sano[x]: x += 1; continue
        j = x
        while j < w and not sano[j]: j += 1
        # Se rellena con la mediana y no interpolando las vecinas: al lado del cerro
        # las vecinas sanas son las nubes, y una nube estirada para arriba es otra
        # columna, más clara. La mediana es el cielo y nada más que el cielo.
        for k in range(x, j):
            for c in range(3): out[k*3+c] = med[c]
        tocadas += j - x
        x = j
    return out, tocadas

def mezclar(A, B, k, w):
    if k <= 0: return bytearray(A)
    if k >= 1: return bytearray(B)
    out = bytearray(w*3)
    for c in range(3):
        out[c::3] = bytes(round(a + (b - a) * k) for a, b in zip(A[c::3], B[c::3]))
    return out

for name in sorted(os.listdir(SRC)):
    if not name.endswith('.jpg'): continue
    w, h, rows = bmp_in(os.path.join(SRC, name))
    suma = w - h
    assert suma > 0, (name, w, h)

    base = bytearray(w*3)
    for i in range(w*3):
        base[i] = sum(rows[y][i] for y in range(BANDA)) // BANDA
    med = [sorted(base[c::3])[w // 2] for c in range(3)]
    limpio, tocadas = limpiar(base, w, med)

    cerca = desenfoque(limpio, w, max(6, w // 40))
    lejos = desenfoque(limpio, w, max(24, w // 5))
    plano = bytearray(w*3)
    for c in range(3): plano[c::3] = bytes([round(med[c] * FONDO)]) * w

    nuevas = []
    for y in range(suma):
        t = y / (suma - 1)                                  # 0 arriba, 1 contra la foto
        if t >= CALINA:                                     # la calina, contra la foto
            fila = mezclar(base, cerca, (1 - t) / (1 - CALINA), w)
        elif t >= LEJOS:                                    # se aleja: se desenfoca
            fila = mezclar(cerca, lejos, (CALINA - t) / (CALINA - LEJOS), w)
        else:                                               # se apaga contra el fondo
            fila = mezclar(lejos, plano, ((LEJOS - t) / LEJOS) ** .8, w)
        nuevas.append(fila)

    for y in range(COSER):                                  # la costura, del lado foto
        k = (1 - y / COSER) ** 1.6
        rows[y] = mezclar(rows[y], base, k, w)

    bmp = os.path.join(SCR, '_out.bmp')
    bmp_out(bmp, w, w, nuevas + rows)
    dst = os.path.join(OUT, name)
    subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '72',
                    bmp, '--out', dst], capture_output=True, check=True)
    print('%-22s %dx%d -> %dx%d  %3dK  (%d columnas rellenadas)'
          % (name, w, h, w, w, os.path.getsize(dst)//1024, tocadas))

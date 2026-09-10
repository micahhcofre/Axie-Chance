#!/usr/bin/env python3
"""Agranda los terrenos 1:1 a 3840 px y los guarda en AVIF.

    python3 scripts/agrandar.py [carpeta] [lado] [calidad]

El CSS le da al dibujo el alto que haga falta para que llegue de un costado al otro de
la ventana (`--alto`, en `styles.css`), y en una pantalla apaisada ese piso es el que
manda siempre: en 4K el fondo se dibuja a 3859 px. Contra un archivo de 1600 eso son
2,4 aumentos, y ahí es donde se veían los píxeles — no en el juego, en el archivo.

Así que los seis se llevan a 3840, que es un aumento de 1,005 en 4K: ni se nota. No hay
detalle nuevo —agrandar no lo inventa—, pero el que había deja de repartirse entre dos
píxeles y medio, que es lo que dejaba el borde de una hoja hecho una escalera.

**A 3840 el JPEG no entra**: los seis pasaban de 1,2 MB a 4,2, y el archivo suelto del
build —que los lleva adentro como data URI— se iba a 7 MB. En AVIF los mismos seis
pesan 745 KB, o sea *menos* que los de 1600, y el build queda más liviano que antes. La
letra chica es que AVIF pide navegador de 2023 para arriba (Safari 16.4, Chrome 85,
Firefox 93); en uno más viejo el fondo no carga y queda el color plano de `--cielo` y
`--piso`, que es feo pero no rompe nada.

Corre con `sips`, que viene con macOS, y nada más. La entrada son los `.jpg` cuadrados
que dejó `cuadrar.py`, que se quedan en `Backgrounds/` como original: el `.avif` es lo
que carga el juego, y se puede volver a generar cuando haga falta. No cambia nada más
del CSS: agrandar no mueve el horizonte, que es una fracción del alto y no un píxel.
"""

import os, subprocess, sys

if len(sys.argv) > 1 and sys.argv[1] in ('-h', '--help'):
    sys.exit(__doc__)
SRC = sys.argv[1] if len(sys.argv) > 1 else 'Backgrounds'
LADO = sys.argv[2] if len(sys.argv) > 2 else '3840'
CAL = sys.argv[3] if len(sys.argv) > 3 else '60'

jpgs = sorted(f for f in os.listdir(SRC) if f.endswith('.jpg'))
if not jpgs:
    sys.exit(f'no hay .jpg en {SRC}')

total = 0
for f in jpgs:
    src, dst = os.path.join(SRC, f), os.path.join(SRC, f[:-4] + '.avif')
    antes = os.path.getsize(src)
    subprocess.run(
        ['sips', '--resampleWidth', LADO, '-s', 'format', 'avif',
         '-s', 'formatOptions', CAL, src, '--out', dst],
        capture_output=True, check=True)
    ancho = subprocess.run(['sips', '-g', 'pixelWidth', src], capture_output=True,
                           text=True, check=True).stdout.split()[-1]
    despues = os.path.getsize(dst)
    total += despues
    print(f'{f[:-4]:18} {ancho}→{LADO} px   {antes // 1024:5} KB → {despues // 1024:4} KB')

print(f'{"":18} {"":14}   {"":5}    {total // 1024:4} KB')

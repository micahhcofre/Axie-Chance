// GENERADO por `npm run axies` (@axieinfinity/mixer 1.4.9) — no editar a mano.
//
// Cada Axie es una pila de PNG del CDN de Sky Mavis. `ratio` es el ancho/alto del
// marco recortado al dibujo; `x/y/w/h` son fracciones de ese marco, así el avatar
// escala a cualquier tamaño sin tocar estos números. `from` es la definición del roster
// con la que se generó: si no coincide con `axies.js`, falta correr `npm run axies`.
export const AVATAR_BASE = 'https://axiecdn.axieinfinity.com/mixer-stuffs/v6/';

export const AVATARS = {
  beast: {
    from: {"class":"beast","color":3,"parts":{"eyes":"beast-04","ears":"beast-06","mouth":"beast-02","horn":"beast-12","back":"beast-04","tail":"beast-10"}},
    ratio: 1.32223,
    layers: [
      { src: 'body-normal/leg-front-right/beast-03.png', x: 0.22068, y: 0.84178, w: 0.09434, h: 0.14656 },
      { src: 'beast-10/tail.png', x: 0.75591, y: 0.46695, w: 0.24409, h: 0.38199 },
      { src: 'body-normal/leg-back-left/beast-03.png', x: 0.70328, y: 0.82435, w: 0.09434, h: 0.14656 },
      { src: 'beast-04/back.png', x: 0.44139, y: 0, w: 0.29598, h: 0.35549 },
      { src: 'beast-06/ear-right/beast-03.png', x: 0, y: 0.33322, w: 0.26886, h: 0.36796 },
      { src: 'body-normal/body/beast-03.png', x: 0.07918, y: 0.17057, w: 0.80067, h: 0.79361 },
      { src: 'body-normal/leg-front-left/beast-03.png', x: 0.52709, y: 0.90177, w: 0.0849, h: 0.09823 },
      { src: 'beast-06/ear-left/beast-03.png', x: 0.55895, y: 0.34881, w: 0.25706, h: 0.39135 },
      { src: 'beast-12/horn.png', x: 0.24038, y: 0.04143, w: 0.30187, h: 0.2635 },
      { src: 'beast-04/eyes/beast-03.png', x: 0.13125, y: 0.47555, w: 0.34668, h: 0.10446 },
      { src: 'beast-02/mouth/beast-03.png', x: 0.22145, y: 0.53134, w: 0.14268, h: 0.16527 },
    ],
  },
  aquatic: {
    from: {"class":"aquatic","color":3,"parts":{"eyes":"aquatic-02","ears":"aquatic-04","mouth":"aquatic-08","horn":"aquatic-06","back":"aquatic-02","tail":"aquatic-12"}},
    ratio: 1.32408,
    layers: [
      { src: 'body-normal/leg-front-right/aquatic-03.png', x: 0.13925, y: 0.84408, w: 0.09283, h: 0.14443 },
      { src: 'aquatic-12/tail.png', x: 0.61127, y: 0.56821, w: 0.38873, h: 0.28424 },
      { src: 'body-normal/leg-back-left/aquatic-03.png', x: 0.61415, y: 0.82691, w: 0.09283, h: 0.14443 },
      { src: 'aquatic-02/back.png', x: 0.42573, y: 0, w: 0.32143, h: 0.47015 },
      { src: 'aquatic-04/ear-right.png', x: 0.01828, y: 0.33004, w: 0.08007, h: 0.2443 },
      { src: 'body-normal/body/aquatic-03.png', x: 0, y: 0.18265, w: 0.7879, h: 0.78205 },
      { src: 'body-normal/leg-front-left/aquatic-03.png', x: 0.44077, y: 0.9032, w: 0.08355, h: 0.0968 },
      { src: 'aquatic-04/ear-left.png', x: 0.47345, y: 0.32673, w: 0.13344, h: 0.24737 },
      { src: 'aquatic-06/horn.png', x: 0.18515, y: 0.11638, w: 0.26689, h: 0.24276 },
      { src: 'aquatic-02/eyes/aquatic-03.png', x: 0.07181, y: 0.38564, w: 0.31098, h: 0.18591 },
      { src: 'aquatic-08/mouth/aquatic-03.png', x: 0.14422, y: 0.50752, w: 0.20423, h: 0.24276 },
    ],
  },
  bird: {
    from: {"class":"bird","color":4,"parts":{"eyes":"bird-10","ears":"bird-02","mouth":"bird-04","horn":"bird-08","back":"bird-06","tail":"bird-04"}},
    ratio: 1.11584,
    layers: [
      { src: 'body-normal/leg-front-right/bird-04.png', x: 0.1497, y: 0.85874, w: 0.0998, h: 0.13085 },
      { src: 'bird-04/tail.png', x: 0.67938, y: 0.59243, w: 0.32062, h: 0.27423 },
      { src: 'body-normal/leg-back-left/bird-04.png', x: 0.66027, y: 0.84318, w: 0.0998, h: 0.13085 },
      { src: 'bird-06/back.png', x: 0.4044, y: 0, w: 0.40919, h: 0.4204 },
      { src: 'body-normal/body/bird-04.png', x: 0, y: 0.25947, w: 0.84708, h: 0.70856 },
      { src: 'body-normal/leg-front-left/bird-04.png', x: 0.47387, y: 0.9123, w: 0.08982, h: 0.0877 },
      { src: 'bird-02/ear-left.png', x: 0.48429, y: 0.41223, w: 0.14347, h: 0.16565 },
      { src: 'bird-08/horn/bird-04.png', x: 0.16582, y: 0.19022, w: 0.29192, h: 0.20324 },
      { src: 'bird-10/eyes.png', x: 0.08188, y: 0.47971, w: 0.32062, h: 0.15869 },
      { src: 'bird-04/mouth/bird-04.png', x: 0.15416, y: 0.53813, w: 0.12101, h: 0.17401 },
    ],
  },
  plant: {
    from: {"class":"plant","color":4,"parts":{"eyes":"plant-02","ears":"plant-10","mouth":"plant-04","horn":"plant-02","back":"plant-12","tail":"plant-06"}},
    ratio: 1.34636,
    layers: [
      { src: 'body-normal/leg-front-right/plant-04.png', x: 0.14274, y: 0.8415, w: 0.09281, h: 0.14682 },
      { src: 'plant-06/tail.png', x: 0.62181, y: 0.52491, w: 0.37819, h: 0.35455 },
      { src: 'body-normal/leg-back-left/plant-04.png', x: 0.61752, y: 0.82404, w: 0.09281, h: 0.14682 },
      { src: 'plant-12/back.png', x: 0.37569, y: 0, w: 0.45244, h: 0.48575 },
      { src: 'plant-10/ear-right.png', x: 0, y: 0.32029, w: 0.13225, h: 0.22804 },
      { src: 'body-normal/body/plant-04.png', x: 0.00352, y: 0.16911, w: 0.78771, h: 0.79501 },
      { src: 'body-normal/leg-front-left/plant-04.png', x: 0.44419, y: 0.9016, w: 0.08353, h: 0.0984 },
      { src: 'plant-10/ear-left.png', x: 0.46752, y: 0.23591, w: 0.15893, h: 0.28895 },
      { src: 'plant-02/horn.png', x: 0.18434, y: 0.02317, w: 0.16705, h: 0.31707 },
      { src: 'plant-02/eyes/plant-04.png', x: 0.06021, y: 0.49048, w: 0.32947, h: 0.05154 },
      { src: 'plant-04/mouth/plant-04.png', x: 0.14973, y: 0.56596, w: 0.13341, h: 0.04998 },
    ],
  },
  bug: {
    from: {"class":"bug","color":2,"parts":{"eyes":"bug-08","ears":"bug-12","mouth":"bug-10","horn":"bug-04","back":"bug-08","tail":"bug-02"}},
    ratio: 1.20536,
    layers: [
      { src: 'body-normal/leg-front-right/bug-02.png', x: 0.15613, y: 0.84085, w: 0.10409, h: 0.14742 },
      { src: 'bug-02/tail.png', x: 0.73978, y: 0.57553, w: 0.26022, h: 0.31052 },
      { src: 'body-normal/leg-back-left/bug-02.png', x: 0.68862, y: 0.82332, w: 0.10409, h: 0.14742 },
      { src: 'bug-08/back.png', x: 0.37052, y: 0.00545, w: 0.45799, h: 0.3905 },
      { src: 'bug-12/ear-right.png', x: 0.07203, y: 0.21457, w: 0.06375, h: 0.19604 },
      { src: 'body-normal/body/bug-02.png', x: 0, y: 0.16571, w: 0.88345, h: 0.79826 },
      { src: 'body-normal/leg-front-left/bug-02.png', x: 0.49422, y: 0.9012, w: 0.09368, h: 0.0988 },
      { src: 'bug-12/ear-left.png', x: 0.54043, y: 0.21142, w: 0.14182, h: 0.18349 },
      { src: 'bug-04/horn.png', x: 0.04021, y: 0, w: 0.38513, h: 0.31523 },
      { src: 'bug-08/eyes.png', x: 0.07125, y: 0.29715, w: 0.37732, h: 0.26504 },
      { src: 'bug-10/mouth.png', x: 0.15081, y: 0.54167, w: 0.17565, h: 0.11605 },
    ],
  },
  reptile: {
    from: {"class":"reptile","color":3,"parts":{"eyes":"reptile-04","ears":"reptile-08","mouth":"reptile-02","horn":"reptile-10","back":"reptile-06","tail":"reptile-04"}},
    ratio: 1.25382,
    layers: [
      { src: 'body-normal/leg-front-right/reptile-03.png', x: 0.15783, y: 0.83793, w: 0.1019, h: 0.15012 },
      { src: 'reptile-04/tail.png', x: 0.60895, y: 0.56431, w: 0.39105, h: 0.34497 },
      { src: 'body-normal/leg-back-left/reptile-03.png', x: 0.67913, y: 0.82008, w: 0.1019, h: 0.15012 },
      { src: 'reptile-06/back.png', x: 0.43287, y: 0.04946, w: 0.37703, h: 0.2731 },
      { src: 'reptile-08/ear-right/reptile-03.png', x: 0, y: 0.30042, w: 0.11464, h: 0.31941 },
      { src: 'body-normal/body/reptile-03.png', x: 0.00497, y: 0.15041, w: 0.86489, h: 0.81291 },
      { src: 'body-normal/leg-front-left/reptile-03.png', x: 0.48881, y: 0.89938, w: 0.09171, h: 0.10062 },
      { src: 'reptile-08/ear-left/reptile-03.png', x: 0.52074, y: 0.31388, w: 0.16814, h: 0.30983 },
      { src: 'reptile-10/horn/reptile-03.png', x: 0.17939, y: 0, w: 0.32226, h: 0.31941 },
      { src: 'reptile-04/eyes/reptile-03.png', x: 0.06887, y: 0.3519, w: 0.37576, h: 0.20602 },
      { src: 'reptile-02/mouth/reptile-03.png', x: 0.10303, y: 0.55132, w: 0.29679, h: 0.13894 },
    ],
  },
};

// Partes válidas por clase, para armar el roster de `src/axies.js`. Cambiar una
// parte pide volver a correr `npm run axies`: las capas salen del mixer, no del navegador.
export const PART_CATALOG = {
  beast: {
    eyes: ['beast-02', 'beast-04', 'beast-08', 'beast-10'],
    ears: ['beast-02', 'beast-04', 'beast-06', 'beast-08', 'beast-10', 'beast-12'],
    back: ['beast-02', 'beast-04', 'beast-06', 'beast-08', 'beast-10', 'beast-12'],
    horn: ['beast-02', 'beast-04', 'beast-06', 'beast-08', 'beast-10', 'beast-12'],
    tail: ['beast-02', 'beast-04', 'beast-06', 'beast-08', 'beast-10', 'beast-12'],
    mouth: ['beast-02', 'beast-04', 'beast-08', 'beast-10'],
  },
  bug: {
    mouth: ['bug-02', 'bug-04', 'bug-08', 'bug-10'],
    horn: ['bug-02', 'bug-04', 'bug-06', 'bug-08', 'bug-10', 'bug-12'],
    tail: ['bug-02', 'bug-04', 'bug-06', 'bug-08', 'bug-10', 'bug-12'],
    back: ['bug-02', 'bug-04', 'bug-06', 'bug-08', 'bug-10', 'bug-12'],
    ears: ['bug-02', 'bug-04', 'bug-06', 'bug-08', 'bug-10', 'bug-12'],
    eyes: ['bug-02', 'bug-04', 'bug-08', 'bug-10'],
  },
  aquatic: {
    eyes: ['aquatic-02', 'aquatic-04', 'aquatic-08', 'aquatic-10'],
    mouth: ['aquatic-02', 'aquatic-04', 'aquatic-08', 'aquatic-10'],
    horn: ['aquatic-02', 'aquatic-04', 'aquatic-06', 'aquatic-08', 'aquatic-10', 'aquatic-12'],
    ears: ['aquatic-02', 'aquatic-04', 'aquatic-06', 'aquatic-08', 'aquatic-10', 'aquatic-12'],
    tail: ['aquatic-02', 'aquatic-04', 'aquatic-06', 'aquatic-08', 'aquatic-10', 'aquatic-12'],
    back: ['aquatic-02', 'aquatic-04', 'aquatic-06', 'aquatic-08', 'aquatic-10', 'aquatic-12'],
  },
  bird: {
    ears: ['bird-02', 'bird-04', 'bird-06', 'bird-08', 'bird-10', 'bird-12'],
    tail: ['bird-02', 'bird-04', 'bird-06', 'bird-08', 'bird-10', 'bird-12'],
    back: ['bird-02', 'bird-04', 'bird-06', 'bird-08', 'bird-10', 'bird-12'],
    horn: ['bird-02', 'bird-04', 'bird-06', 'bird-08', 'bird-10', 'bird-12'],
    mouth: ['bird-02', 'bird-04', 'bird-08', 'bird-10'],
    eyes: ['bird-02', 'bird-04', 'bird-08', 'bird-10'],
  },
  reptile: {
    eyes: ['reptile-02', 'reptile-04', 'reptile-08', 'reptile-10'],
    mouth: ['reptile-02', 'reptile-04', 'reptile-08', 'reptile-10'],
    ears: ['reptile-02', 'reptile-04', 'reptile-06', 'reptile-08', 'reptile-10', 'reptile-12'],
    back: ['reptile-02', 'reptile-04', 'reptile-06', 'reptile-08', 'reptile-10', 'reptile-12'],
    tail: ['reptile-02', 'reptile-04', 'reptile-06', 'reptile-08', 'reptile-10', 'reptile-12'],
    horn: ['reptile-02', 'reptile-04', 'reptile-06', 'reptile-08', 'reptile-10', 'reptile-12'],
  },
  plant: {
    tail: ['plant-02', 'plant-04', 'plant-06', 'plant-08', 'plant-10', 'plant-12'],
    mouth: ['plant-02', 'plant-04', 'plant-08', 'plant-10'],
    eyes: ['plant-02', 'plant-04', 'plant-08', 'plant-10'],
    ears: ['plant-02', 'plant-04', 'plant-06', 'plant-08', 'plant-10', 'plant-12'],
    back: ['plant-02', 'plant-04', 'plant-06', 'plant-08', 'plant-10', 'plant-12'],
    horn: ['plant-02', 'plant-04', 'plant-06', 'plant-08', 'plant-10', 'plant-12'],
  },
};

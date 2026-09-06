// GENERADO por `npm run vfx` desde axieinfinity/axie-origins-asset-kit@main — no editar a mano.
//
// Un efecto por clase más el de cadena cortada. Cada uno es una grilla de `cols`
// columnas de cuadros de `frameW`×`frameH` dentro de su `atlas.png`, que se pide
// al CDN recién cuando esa clase golpea por primera vez. `anchor` es el punto del
// cuadro que se apoya sobre el Axie que recibe; `hitAt` es el segundo en que pega.
export const VFX_BASE = 'https://cdn.jsdelivr.net/gh/axieinfinity/axie-origins-asset-kit@main/web-vfx/public/vfx/';

export const CLIPS = {
  aquatic: {'id':'aquatic_slash','kind':'skill','frames':39,'fps':30,'duration':0.9,'cols':8,'frameW':470,'frameH':304,'anchor':{'x':269,'y':175},'hitAt':0.367},
  beast: {'id':'beast_slash','kind':'skill','frames':50,'fps':30,'duration':1,'cols':8,'frameW':566,'frameH':414,'anchor':{'x':281,'y':175},'hitAt':0.367},
  bird: {'id':'bird_slash','kind':'skill','frames':50,'fps':30,'duration':1.1,'cols':8,'frameW':456,'frameH':296,'anchor':{'x':281,'y':175},'hitAt':0.517},
  bug: {'id':'bug_slash','kind':'skill','frames':50,'fps':30,'duration':1.4,'cols':8,'frameW':584,'frameH':417,'anchor':{'x':281,'y':175},'hitAt':0.367},
  plant: {'id':'plant_slash','kind':'skill','frames':47,'fps':30,'duration':1,'cols':8,'frameW':593,'frameH':398,'anchor':{'x':273,'y':175},'hitAt':0.367},
  reptile: {'id':'reptile_slash','kind':'skill','frames':50,'fps':30,'duration':1.5333333333333334,'cols':8,'frameW':591,'frameH':454,'anchor':{'x':281,'y':175},'hitAt':0.367},
  bust: {'id':'disarmed','kind':'buff','frames':69,'fps':30,'duration':1.3666666666666667,'cols':8,'frameW':444,'frameH':305,'anchor':{'x':280,'y':203},'hitAt':1.1},
};

/** La URL del atlas de un clip. */
export const atlasUrl = (clip) => `${VFX_BASE}${clip.id}/atlas.png`;

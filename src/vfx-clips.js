// GENERADO por `npm run vfx` desde axieinfinity/axie-origins-asset-kit@main — no editar a mano.
//
// Un efecto por clase, el de cadena cortada y los de los poderes. Cada uno es una
// grilla de `cols` columnas de cuadros de `frameW`×`frameH` dentro de su
// `atlas.png`, que se pide al CDN recién cuando hace falta. `anchor` es el punto del
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
  eggShield: {'id':'shield','kind':'buff','frames':81,'fps':30,'duration':1.3666666666666667,'cols':8,'frameW':476,'frameH':402,'anchor':{'x':226,'y':199},'hitAt':0.367},
  eggBreak: {'id':'shield_break','kind':'buff','frames':69,'fps':30,'duration':1.0333333333333334,'cols':8,'frameW':428,'frameH':438,'anchor':{'x':213,'y':218},'hitAt':0.3},
  eggThorns: {'id':'reflect_damage','kind':'buff','frames':69,'fps':30,'duration':1.5333333333333334,'cols':8,'frameW':666,'frameH':447,'anchor':{'x':375,'y':227},'hitAt':0.267},
  poison: {'id':'poison_apply','kind':'buff','frames':81,'fps':30,'duration':2.7,'cols':8,'frameW':458,'frameH':457,'anchor':{'x':228,'y':228},'hitAt':0.967},
  feather: {'id':'feather','kind':'buff','frames':81,'fps':30,'duration':2.4,'cols':8,'frameW':361,'frameH':432,'anchor':{'x':179,'y':235},'hitAt':1.467},
  strength: {'id':'dmg_boost','kind':'buff','frames':69,'fps':30,'duration':1.6333333333333333,'cols':8,'frameW':455,'frameH':457,'anchor':{'x':227,'y':229},'hitAt':0.633},
  brutal: {'id':'power_gain','kind':'buff','frames':69,'fps':30,'duration':1.7666666666666666,'cols':8,'frameW':374,'frameH':376,'anchor':{'x':186,'y':186},'hitAt':0.933},
  octopus: {'id':'buff_apply','kind':'buff','frames':81,'fps':30,'duration':1.5,'cols':8,'frameW':512,'frameH':499,'anchor':{'x':256,'y':222},'hitAt':0.6},
  bubble: {'id':'bubble','kind':'buff','frames':69,'fps':30,'duration':1.8,'cols':8,'frameW':448,'frameH':432,'anchor':{'x':224,'y':216},'hitAt':0.567},
  pot: {'id':'heal','kind':'buff','frames':70,'fps':30,'duration':2.066666666666667,'cols':8,'frameW':432,'frameH':437,'anchor':{'x':215,'y':220},'hitAt':0.467},
  leaf: {'id':'leaf','kind':'buff','frames':69,'fps':30,'duration':1.8,'cols':8,'frameW':429,'frameH':431,'anchor':{'x':213,'y':216},'hitAt':0.567},
  snail: {'id':'weak','kind':'buff','frames':69,'fps':30,'duration':2.066666666666667,'cols':8,'frameW':494,'frameH':497,'anchor':{'x':246,'y':232},'hitAt':0.9},
  leech: {'id':'drain','kind':'buff','frames':81,'fps':30,'duration':2.433333333333333,'cols':8,'frameW':685,'frameH':430,'anchor':{'x':468,'y':214},'hitAt':1.3},
  steelskin: {'id':'shield_boost','kind':'buff','frames':69,'fps':30,'duration':2.3,'cols':8,'frameW':420,'frameH':420,'anchor':{'x':209,'y':209},'hitAt':0.133},
  win: {'id':'power_awaken','kind':'buff','frames':69,'fps':30,'duration':1.7666666666666666,'cols':8,'frameW':566,'frameH':512,'anchor':{'x':280,'y':255},'hitAt':0.733},
  lose: {'id':'death_mark_apply','kind':'buff','frames':81,'fps':30,'duration':2.3,'cols':8,'frameW':416,'frameH':423,'anchor':{'x':208,'y':213},'hitAt':0.933},
  tie: {'id':'stunned','kind':'buff','frames':81,'fps':30,'duration':2.7,'cols':8,'frameW':377,'frameH':429,'anchor':{'x':191,'y':193},'hitAt':0.6},
};

/** La URL del atlas de un clip. */
export const atlasUrl = (clip) => `${VFX_BASE}${clip.id}/atlas.png`;

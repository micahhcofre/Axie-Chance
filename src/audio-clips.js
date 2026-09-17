// GENERADO por `npm run sfx` desde axieinfinity/axie-origins-asset-kit@main — no editar a mano.
//
// Los sonidos del kit, medidos: `onset` es el silencio que hay que saltear al
// arrancar, `lead` cuánto tarda en llegar al pico —para que el pico caiga sobre el
// impacto y no después—, `secs` cuánto se oye y `gain` lo que hay que corregirle
// para que todos suenen parejos. El wav se pide al CDN la primera vez que hace falta.
export const SFX_BASE = 'https://cdn.jsdelivr.net/gh/axieinfinity/axie-origins-asset-kit@main/';

export const SOUNDS = {
  aquatic: {'file':'web-vfx/public/sfx/aquatic_slash_attack.wav','secs':1.38,'onset':0,'lead':0.24,'gain':1.03},
  beast: {'file':'web-vfx/public/sfx/beast_slash_attack.wav','secs':1.03,'onset':0.1,'lead':0.33,'gain':1.35},
  bird: {'file':'web-vfx/public/sfx/bird_slash_attack.wav','secs':1.15,'onset':0,'lead':0.27,'gain':1.14},
  bug: {'file':'web-vfx/public/sfx/bug_slash_attack.wav','secs':0.84,'onset':0.01,'lead':0.24,'gain':1.04},
  plant: {'file':'web-vfx/public/sfx/plant_slash_attack.wav','secs':0.88,'onset':0.03,'lead':0.2,'gain':1.05},
  reptile: {'file':'web-vfx/public/sfx/reptile_slash_attack.wav','secs':1.15,'onset':0.01,'lead':0.29,'gain':1.14},
  bust: {'file':'Assets/OriginsKit/Audio/doubt.wav','secs':0.75,'onset':0,'lead':0.31,'gain':0.77},
  draw: {'file':'web-vfx/public/sfx/power_gain.wav','secs':1.79,'onset':0,'lead':0.23,'gain':0.87},
  block: {'file':'web-vfx/public/sfx/shield.wav','secs':1.2,'onset':0,'lead':0.38,'gain':0.92},
  thorns: {'file':'web-vfx/public/sfx/reflect_damage.wav','secs':1.08,'onset':0.05,'lead':0.36,'gain':0.7},
  strength: {'file':'Assets/OriginsKit/Audio/damage_boost.wav','secs':1.43,'onset':0.04,'lead':0.49,'gain':0.89},
  poison: {'file':'Assets/OriginsKit/Audio/poison.wav','secs':1.12,'onset':0.06,'lead':0.39,'gain':0.76},
  egg: {'file':'Assets/OriginsKit/Audio/buff.wav','secs':1.59,'onset':0,'lead':0.53,'gain':0.92},
  pot: {'file':'web-vfx/public/sfx/heal.wav','secs':1.36,'onset':0.04,'lead':0.39,'gain':0.99},
  snail: {'file':'web-vfx/public/sfx/weak.wav','secs':2.01,'onset':0.04,'lead':0.46,'gain':1.06},
  octopus: {'file':'web-vfx/public/sfx/bubble.wav','secs':1.96,'onset':0.04,'lead':0.49,'gain':0.89},
  brutal: {'file':'Assets/OriginsKit/Audio/morph_aura_burst.wav','secs':1.79,'onset':0,'lead':0.23,'gain':0.87},
  bubble: {'file':'Assets/OriginsKit/Audio/secret.wav','secs':2.01,'onset':0.03,'lead':0.13,'gain':0.9},
  bubblePop: {'file':'web-vfx/public/sfx/bubble_bomb.wav','secs':1.92,'onset':0,'lead':0.15,'gain':0.86},
  feather: {'file':'web-vfx/public/sfx/feather.wav','secs':1.95,'onset':0.06,'lead':0.3,'gain':0.78},
  leaf: {'file':'web-vfx/public/sfx/leaf.wav','secs':1.7,'onset':0.01,'lead':0.29,'gain':0.69},
  leafHeal: {'file':'web-vfx/public/sfx/cure.wav','secs':2.64,'onset':0.06,'lead':0.33,'gain':0.9},
  leech: {'file':'web-vfx/public/sfx/drain.wav','secs':2.46,'onset':0.02,'lead':1.16,'gain':0.95},
  open: {'file':'Assets/OriginsKit/Audio/summon_on.wav','secs':0.94,'onset':0,'lead':0.36,'gain':0.83},
  take: {'file':'web-vfx/public/sfx/mech_projectile_hit.wav','secs':1.01,'onset':0,'lead':0.07,'gain':1.01},
  renew: {'file':'web-vfx/public/sfx/dispel.wav','secs':1.32,'onset':0.04,'lead':0.47,'gain':1.04},
  win: {'file':'web-vfx/public/sfx/power_awaken.wav','secs':1.43,'onset':0.04,'lead':0.48,'gain':0.88},
  lose: {'file':'Assets/OriginsKit/Audio/death_mark.wav','secs':1.5,'onset':0.01,'lead':0.62,'gain':1.11},
  tie: {'file':'web-vfx/public/sfx/stunned.wav','secs':1.48,'onset':0.11,'lead':0.77,'gain':0.99},
};

/** Los temas de fondo. `tail` es el fundido del final, que es por donde se empalma. */
export const MUSIC = {
  battle: {'file':'Assets/OriginsKit/PvE/Music/pve_1.wav','secs':114.91,'tail':2.11,'gain':1.94},
  boss: {'file':'Assets/OriginsKit/PvE/Music/boss.wav','secs':122.69,'tail':1,'gain':1},
};

/** La URL de un sonido del catálogo. */
export const soundUrl = (clip) => `${SFX_BASE}${clip.file}`;

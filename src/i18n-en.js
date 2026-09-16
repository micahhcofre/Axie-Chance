// Diccionario de cadenas en inglés para Axie Chance.
// Las tandas subsiguientes agregan sus propias secciones sin eliminar las anteriores.

export const EN_STRINGS = {
  // index.html — Topbar y HUD
  'Tiempo que queda': 'Time remaining',
  'Menú': 'Menu',
  'Configuración': 'Settings',
  'Ajustes': 'Settings',
  'Idioma': 'Language',
  'Cambiar idioma': 'Change language',
  'Cambiar a inglés': 'Switch to English',
  'Español': 'Spanish',
  'English': 'English',
  'Sonido': 'Sound',
  'Música': 'Music',
  'Volumen de la música': 'Music volume',
  'Efectos de sonido': 'Sound effects',
  'Efectos': 'Effects',
  'Volumen de los efectos': 'Effects volume',
  'Historial': 'Match Log',
  'Cómo se juega': 'How to Play',
  'Símbolos especiales': 'Special Symbols',
  'Abandonar partida': 'Forfeit Match',

  // index.html — Mesa y arena
  'Ver el mazo': 'View deck',

  // index.html — Portada y menú principal
  'Creado por: MikhChest': 'Created by: MikhChest',
  'Jugar': 'Play',
  'Modo de juego': 'Game Mode',
  'Modo Aventura': 'Adventure Mode',
  'Avanzá nivel a nivel desbloqueando los 12 poderes': 'Advance level by level unlocking all 12 powers',
  'Vs CPU': 'Vs CPU',
  'Vos contra la máquina, partida libre': 'You against the CPU, free play',
  'Dificultad': 'Difficulty',
  'Fácil': 'Easy',
  'Normal': 'Normal',
  'Duro': 'Hard',
  // La etiqueta de dificultad de la Aventura (`DIFFICULTY_LABELS`) va en femenino.
  'Dura': 'Hard',
  'Multijugador': 'Multiplayer',
  'Contra otra persona, en una sala': 'Against another player, in a room',
  'Volver': 'Back',
  'Elegí tu Axie': 'Choose your Axie',
  'Tutorial': 'Tutorial',
  'Campaña': 'Campaign',
  'Duelo': 'Duel',
  'En Red': 'Online',

  // index.html — Elección de Axie
  '← Volver': '← Back',
  'El Axie anterior': 'Previous Axie',
  'El Axie siguiente': 'Next Axie',
  'Mazo inicial · 10 cartas': 'Starter deck · 10 cards',
  'Símbolos en el mazo': 'Symbols in deck',
  'Elegir Axie': 'Select Axie',

  // index.html — Modo Aventura en lobby
  'Comenzar Nivel': 'Start Level',

  // index.html — Red y multijugador
  'Salas': 'Rooms',
  'Salir de la sala': 'Leave room',
  'Crear sala': 'Create room',
  'Jugar solo': 'Play solo',
  'Desde el otro aparato, en la misma red:': 'From another device, on the same network:',
  'Escaneá para entrar': 'Scan to join',
  'QR para entrar a la sala': 'QR code to join the room',
  'Tu Axie': 'Your Axie',
  'Cambiar': 'Change',
  'Estoy listo': "I'm ready",

  // index.html — Modales de mazo, registro y abandono
  'Cerrar modal': 'Close modal',
  'Tu mazo': 'Your deck',
  'Cerrar': 'Close',
  '¿Abandonar la partida?': 'Forfeit match?',
  'Seguir jugando': 'Keep playing',
  'Abandonar': 'Forfeit',
  'Entendido': 'Understood',

  // index.html — Modal de reglas
  'Es un combate de cartas táctico': 'A tactical',
  'push-your-luck': 'push-your-luck',
  // El nodo anterior (`<i>push-your-luck</i>`) no deja espacio: el inglés lo trae él.
  '. Elegís uno de los': ' card combat game. Choose one of the',
  'seis Axies': 'six Axies',
  '—uno por clase— y peleás con su': '—one per class— and battle with its',
  'mazo personal': 'personal deck',
  'contra el rival. Los dos arrancan con': 'against your rival. Both start with',
  '100 de vida': '100 HP',
  '.': '.',
  'En': 'In',
  'jugás contra la máquina, que compite con un Axie sorteado. En': 'you play against the CPU, which competes with a random Axie. In',
  'jugás en red con otra persona en salas privadas con código.': 'you play online with another player in private code-locked rooms.',
  'Quién abre se sortea': 'Who opens is randomly decided',
  'al empezar la partida: cerrar el intercambio —ver el golpe del otro antes de decidir el tuyo— es una ventaja táctica. Se puede': "at match start: closing the round —seeing your opponent's attack before committing yours— is a tactical advantage. You can",
  'abandonar': 'forfeit',
  'desde el menú: en las primeras 5 rondas la partida se anula sin ganador; después, gana quien se queda.': 'from the menu: during the first 5 rounds the match is voided with no winner; after that, whoever stays wins.',
  'La Última Chance:': 'Last Chance:',
  'Si te quedás sin vida antes de haber atacado en el intercambio, no morís en el acto: jugás tu turno normal. Si tu golpe deja sin vida al otro también, la partida termina en': "If you run out of HP before attacking in the round, you don't die immediately: you play your turn normally. If your attack also reduces your opponent to 0 HP, the match ends in a",
  'empate': 'draw',
  'Se turnan. En tu turno te reparten una carta y vas': 'Players take turns. On your turn, you draw a card and begin',
  'cargando el ataque': 'charging your attack',
  ': cada carta que robás lo hace más fuerte, pero si la cadena se corta el golpe falla. Cuando te plantás,': ': each card you draw makes it stronger, but if the chain busts the attack fails. When you stand,',
  'soltás el ataque': 'you unleash the attack',
  ': los puntos de tu cadena son el': ': your chain points become the',
  'daño': 'damage',
  'que le hacés al rival. Ahí mismo te llevás cartas del centro para tu mazo, y luego ataca el otro. Al cerrar la ronda, se resuelve el veneno y se comprueba la vida.': 'dealt to your rival. You then draft cards from the center for your deck, and then the opponent attacks. At the end of the round, poison resolves and HP is checked.',
  'La cadena': 'The Chain',
  'Las cadenas arrancan en la': 'Chains start on the',
  'primera carta': 'first card',
  'de tu turno: cada símbolo distinto que tiene abre una cadena. Cada carta que robás debe compartir al menos un símbolo con las cadenas que siguen': 'of your turn: each unique symbol on it opens a chain. Each card you draw must share at least one symbol with currently',
  'vivas': 'alive',
  '. Las cadenas cuyos símbolos no aparecen quedan congeladas conservando su largo.': ' chains. Chains whose symbols do not appear freeze, keeping their length.',
  'Si la carta nueva no comparte': 'If the new card shares',
  'ningún': 'no',
  'símbolo vivo, se corta todo: el ataque se desarma y hace': 'living symbols, the chain busts: the attack collapses and deals',
  '0': '0',
  'de daño.': 'damage.',
  'El daño': 'Damage',
  'Cada cadena golpea por su largo': 'Each chain strikes for its length',
  'al cuadrado': 'squared',
  '. Solo puntúan los símbolos que estaban en la primera carta.': '. Only symbols present on the first card score.',
  '1ª': '1st',
  '2ª': '2nd',
  '3ª': '3rd',
  'en 3 cartas → 3² =': 'in 3 cards → 3² =',
  'en 2 cartas → 2² =': 'in 2 cards → 2² =',
  'y': 'and',
  'no estaban en la 1ª carta: no puntúan.': 'were not on the 1st card: they do not score.',
  'Daño del ataque:': 'Attack damage:',
  'Tu mazo y mejoras': 'Your Deck & Upgrades',
  'Tocá un Axie': 'Tap an Axie',
  '—el tuyo o el del rival— para ver su mazo entero: las diez de fábrica y todo lo que fue sumando del centro.': "—yours or your rival's— to view its full deck: the starting ten plus everything drafted from the center.",
  'Cada jugador roba de su': 'Each player draws from their',
  'mazo inicial de 10 cartas': '10-card starter deck',
  ', construido alrededor de su clase: 5 pares con su símbolo, 1 carta solitaria de su símbolo y 4 cartas ajenas. Los mazos iniciales no traen poderes.': ', built around their class: 5 pairs with their symbol, 1 single-symbol card, and 4 off-class cards. Starter decks contain no powers.',
  'Mejoras (+):': 'Upgrades (+):',
  'En la pantalla de elección de tu Axie podés añadir un símbolo extra a cada carta: las de tu clase admiten el tuyo; las ajenas, uno de sus dos símbolos. El símbolo repetido': 'On your Axie selection screen, you can add an extra symbol to each card: class cards take your own; off-class cards, either of their two symbols. Repeated symbols',
  'cuenta cada aparición': 'count every appearance',
  ', acelerando la racha al cuadrado.': ', accelerating the chain squared.',
  'Sin descarte:': 'No Discard Pile:',
  'Al inicio de cada intercambio se rebaraja el mazo completo (lo jugado y lo sumado). Las cartas que salieron no se repiten dentro de la misma ronda.': 'At the start of each round, your entire deck is reshuffled (played and drafted cards). Drawn cards do not repeat within the same round.',
  'El centro (mercado de 6 cartas)': 'The Center (6-Card Market)',
  'En el centro hay siempre': 'The center always has',
  '6 cartas boca arriba': '6 face-up cards',
  ', sacadas de una reserva de 86 cartas: 35 sin poder, 36 con poder (6 por cada poder activo) y 15 cartas comodín Free Game. Al llevarse una carta, se repone al instante. Al terminar tu turno te llevás:': ', drawn from a pool of 86 cards: 35 regular, 36 with powers (6 per active power), and 15 neutral Free Game wildcards. Taken cards are replenished instantly. At the end of your turn, you draft:',
  'Te plantaste': 'You stood',
  '→ 1 carta': '→ 1 card',
  'con poder': 'with power',
  'o': 'or',
  '2 cartas': '2 cards',
  'sin poder': 'without power',
  'Se te cortó': 'You busted',
  'La carta que tocás decide el camino:': 'The card you tap chooses your path:',
  'tocar una con poder la toma y concluye el draft; tocar una sin poder abre la opción a una segunda.': 'tapping one with power drafts it and ends the draft; tapping one without power gives you the option for a second.',
  'Renovación:': 'Refresh:',
  'Si ninguna de las 6 cartas a la vista contiene el símbolo de tu clase, podés renovar el centro entero una vez por draft.': 'If none of the 6 face-up cards contains your class symbol, you may refresh the entire center once per draft.',
  'Los poderes de combate': 'Combat Powers',
  'Al inicio de cada partida se sortea': 'At the start of each match,',
  'un poder activo por clase': 'one active power per class',
  '(de entre los dos posibles para esa clase). Cada poder viaja siempre con su símbolo entre los tres de su carta:': 'is randomly selected (out of the two possible for each class). Each power always appears alongside its class symbol among the card\'s three symbols:',
  '«Al pegar»': '“On hit”',
  'es plantarte con un ataque que haga daño. Si te cortás, esos poderes no salen.': 'means standing with an attack that deals damage. If you bust, these powers do not trigger.',
  '(Bestia) — Al pegar, +1 de daño en ese ataque y en todos los que siguen.': '(Beast) — On hit, +1 damage on this attack and all future attacks.',
  '(Bestia) — Al pegar, +2 de daño por cada símbolo de tu racha más larga.': '(Beast) — On hit, +2 damage per symbol in your longest chain.',
  '(Pez) — Al plantarte (aunque pegues 0), elegís 1 carta extra del mercado para tu mazo.': '(Aquatic) — When standing (even dealing 0), draft 1 extra card from the market for your deck.',
  '(Pez) — Al plantarte, la carta que elijas del mercado abre tu próxima ronda.': '(Aquatic) — When standing, the card you draft from the market opens your next round.',
  '(Pájaro) — Al pegar, ganás un escudo de la mitad del golpe; si el rival lo rompe, recibe 8 de daño.': '(Bird) — On hit, gain a shield for half the damage dealt; if broken, the rival takes 8 counter damage.',
  '(Pájaro) — Apenas la robás, 5 de daño directo al rival, aunque después te cortes.': '(Bird) — As soon as drawn, 5 direct damage to the rival, even if you bust later.',
  '(Planta) — Al pegar, te curás lo mismo que pegaste.': '(Plant) — On hit, heal for the same amount of damage dealt.',
  '(Planta) — Al pegar, +2 hojas (hasta 5); al final de cada turno tuyo, cada hoja te cura 4 y se gasta 1.': '(Plant) — On hit, +2 leaves (up to 5); at the end of each turn, each leaf heals 4 and consumes 1 leaf.',
  '(Bicho) — Al pegar, el próximo ataque del rival hace la mitad de daño.': "(Bug) — On hit, the rival's next attack deals half damage.",
  '(Bicho) — Al pegar, le sacás 6 de vida al rival y te los curás (12 con 4 o más columnas en mesa).': '(Bug) — On hit, steal 6 HP from rival and heal yourself (12 with 4 or more columns on field).',
  '(Reptil) — Al pegar, envenenás al rival con la mitad del golpe; al final de cada turno suyo le saca eso y se reduce a la mitad.': '(Reptile) — On hit, poison the rival for half the damage; at each turn end it bites and halves.',
  '(Reptil) — Al pegar, el próximo golpe del rival te hace 12 de daño como máximo.': "(Reptile) — On hit, the rival's next attack deals a maximum of 12 damage.",
  '(Comodín) — Si comparte un símbolo con tu cadena, tu próximo robo se monta sobre una carta de la mesa y le suma sus símbolos.': '(Wildcard) — If it shares a symbol with your chain, your next draw stacks onto a card on the field, adding its symbols.',
  'Campaña de 6 niveles progresivos donde se desbloquean 2 nuevos poderes de clase por nivel. En el': 'A 6-level progressive campaign where 2 new class powers unlock per level. In',
  'Nivel 1: Primeros Pasos': 'Level 1: First Steps',
  'ya están activos': 'the active powers are',
  '(Bestia),': '(Beast),',
  '(Planta) y las 15 cartas comodín neutrales': '(Plant), and the 15 neutral wildcard cards',

  // index.html — Modal de símbolos especiales
  'Las cartas del mercado pueden incluir': 'Market cards may include',
  'poderes especiales': 'special powers',
  '. No forman cadenas por sí mismos, pero activan': '. They do not form chains on their own, but activate',
  'habilidades tácticas': 'tactical abilities',
  'durante el combate.': 'during combat.',
  'Todos': 'All',
  'Bestia': 'Beast',
  'Pez': 'Aquatic',
  'Pájaro': 'Bird',
  'Planta': 'Plant',
  'Bicho': 'Bug',
  'Reptil': 'Reptile',
  'Especiales': 'Special',
  '+1 de daño permanente en todos tus ataques': '+1 permanent damage on all your attacks',
  'Aumenta tu estadística de daño de forma permanente. Cada carta jugada añade': 'Permanently increases your damage stat. Each card played adds',
  '+1 de daño': '+1 damage',
  'a este ataque y a todos los que hagas en el resto de la partida.': 'to this attack and all future attacks in the match.',
  'Activación:': 'Activation:',
  'Al conectar tu ataque con éxito (daño > 0).': 'On connecting a successful attack (damage > 0).',
  'Permanente:': 'Permanent:',
  'Se conserva para toda la partida (no se pierde si te cortás después).': 'Kept for the entire match (not lost if you bust later).',
  'Acumulable:': 'Stackable:',
  'Cada carta suma otro +1 permanente.': 'Each card adds another permanent +1.',
  'Permanente': 'Permanent',
  'Acumulable': 'Stackable',
  '+2 de daño por cada símbolo de tu racha más larga': '+2 damage per symbol in your longest chain',
  'Potencia tu golpe según el tamaño de tu mejor racha. Al atacar, suma': 'Boosts your attack based on the size of your best chain. When attacking, adds',
  '+2 de daño adicional': '+2 additional damage',
  'por cada símbolo que tenga tu cadena más larga.': 'for each symbol in your longest chain.',
  'Se activa siempre que conectes el ataque (daño > 0).': 'Triggers whenever you connect an attack (damage > 0).',
  'Cadena más larga:': 'Longest chain:',
  'Cuenta los símbolos de tu racha más extendida (de cualquier clase).': 'Counts the symbols of your longest chain (of any class).',
  'Con más de una carta, el bonus se multiplica.': 'With more than one card, the bonus multiplies.',
  'Rematador': 'Finisher',
  '+1 carta extra del mercado para tu mazo': '+1 extra market card for your deck',
  'Te permite llevarte una': 'Allows you to draft an',
  'carta adicional de regalo': 'additional bonus card',
  'del mercado central para sumar a tu mazo.': 'from the central market to add to your deck.',
  'Al plantarte (incluso si tu ataque hizo 0 de daño).': 'On standing (even if your attack dealt 0 damage).',
  'Elección libre:': 'Free pick:',
  'Podés elegir cualquier carta disponible, con o sin poder.': 'You may choose any available card, with or without power.',
  'Cada pulpo en tu cadena te otorga un pick adicional.': 'Each octopus in your chain grants an additional pick.',
  'Draft extra': 'Extra draft',
  'La carta que elijas del mercado abrirá tu próxima ronda': 'The drafted market card will open your next round',
  'La carta que tomes del centro no va al mazo barajado: queda': "The card you take from the center doesn't go into the shuffled deck: it is",
  'atrapada en una burbuja': 'trapped in a bubble',
  'y saldrá asegurada como tu': 'and is guaranteed to appear as your',
  'primera carta': 'first card',
  'de la próxima ronda.': 'in the next round.',
  'Apertura asegurada:': 'Guaranteed opener:',
  'Arrancás la próxima ronda con los símbolos que elijas.': 'Start the next round with the symbols you chose.',
  'Carta Gigante:': 'Giant Card:',
  'Con varias burbujas, fusiona cartas de tu mazo en una supercarta.': 'With multiple bubbles, fuses cards from your deck into a supercard.',
  'Si te cortás:': 'If you bust:',
  'La burbuja no se activa.': 'The bubble does not activate.',
  'Control de mazo': 'Deck control',
  'Carta Gigante': 'Giant Card',
  'Escudo de medio golpe; al romperse devuelve 8 de daño': 'Shield for half damage; returns 8 damage when broken',
  'Genera un': 'Generates a',
  'escudo protector': 'protective shield',
  'equivalente a la mitad del golpe infligido. Dura hasta que se rompa absorbiendo daño rival y, al romperse, contraataca.': 'equal to half the damage dealt. Lasts until broken absorbing enemy damage, and counterattacks when shattered.',
  'Protección no acumulable:': 'Non-stacking protection:',
  'Absorbe daño entrante; si ganás otro huevo, reemplaza al actual.': 'Absorbs incoming damage; gaining another egg replaces the current one.',
  'Contraataque acumulable:': 'Stackable counterattack:',
  'Cada huevo obtenido acumula +8 de daño fijo para cuando se rompa el escudo.': 'Each egg adds +8 flat damage when the shield breaks.',
  'Requiere conectar daño al atacar (daño > 0).': 'Requires dealing damage when attacking (damage > 0).',
  'Escudo': 'Shield',
  'Contraataque': 'Counterattack',
  '5 de daño directo al salir (¡incluso si te cortás!)': '5 direct damage on draw (even if you bust!)',
  'Inflige': 'Deals',
  '5 de daño directo instantáneo': '5 instant direct damage',
  'al oponente en el mismo momento en que la carta es robada, sin necesidad de esperar a plantarte.': 'to the opponent the moment the card is drawn, without needing to stand.',
  'Inmune al corte:': 'Bust-proof:',
  'Es el único poder que funciona aunque la cadena se corte luego.': 'The only power that works even if the chain busts later.',
  'Daño puro:': 'True damage:',
  'Ignora escudos de huevo y efectos defensivos.': 'Ignores egg shields and defensive effects.',
  'Instantáneo:': 'Instant:',
  'Puede derrotar al rival en medio de tu turno.': 'Can defeat the rival in the middle of your turn.',
  'Instantáneo': 'Instant',
  'No se pierde': 'Bust-proof',
  'Te curás todo el daño que pegaste': 'Heal for all damage dealt',
  'Al soltar el golpe, tu Axie': 'Upon unleashing the attack, your Axie',
  'recupera en vida el 100% del daño infligido': 'recovers 100% of the damage dealt as HP',
  'en ese turno (hasta el tope de 100 HP).': 'this turn (up to the 100 HP cap).',
  'Curación directa:': 'Direct healing:',
  'Si pegás 25 de daño, te curás 25 de vida al instante.': 'If you deal 25 damage, you heal 25 HP instantly.',
  'Requisito:': 'Requirement:',
  'Requiere conectar el ataque (daño > 0).': 'Requires connecting the attack (damage > 0).',
  'Al hacer 0 de daño, no hay curación.': 'Dealing 0 damage yields no healing.',
  'Curación': 'Healing',
  'Supervivencia': 'Survival',
  '+2 hojas (hasta 5). Cada hoja te cura 4 de vida al final del turno': '+2 leaves (up to 5). Each leaf heals 4 HP at end of turn',
  'Al atacar con éxito ganás': 'On a successful attack you gain',
  '2 hojas': '2 leaves',
  '(acumulables hasta 5). Al final de cada uno de tus turnos,': '(stacking up to 5). At the end of each of your turns,',
  'cada hoja te cura 4 de vida y luego se consume una hoja': 'each leaf heals 4 HP and then one leaf is consumed',
  'Podés acumular hasta un máximo de 5 hojas.': 'You can stack up to a maximum of 5 leaves.',
  'Regeneración segura:': 'Guaranteed regen:',
  'Curan al final del turno incluso si ese turno luego se corta.': 'Heals at turn end even if that turn subsequently busts.',
  'Requiere conectar daño (daño > 0) para ganar hojas nuevas.': 'Requires connecting damage (damage > 0) to gain new leaves.',
  'Regeneración': 'Regeneration',
  'Máx. 5 hojas': 'Max 5 leaves',
  'El próximo ataque del rival hace la mitad de daño': "The rival's next attack deals half damage",
  'Aplica': 'Applies',
  'debilidad': 'weakness',
  'al rival: su próximo ataque con daño se divide por 2 (redondeando hacia arriba).': 'to the rival: their next damaging attack is divided by 2 (rounded up).',
  'Acumulable por ataques:': 'Stacks per attack:',
  'Dos caracoles debilitan los dos próximos ataques con daño del rival.': "Two snails weaken the rival's next two damaging attacks.",
  'Consumo inteligente:': 'Smart consumption:',
  'Solo se gasta una carga cuando el rival conecta un ataque con daño.': 'Only consumes a charge when the rival lands a damaging attack.',
  'Requiere conectar daño al plantarte (daño > 0).': 'Requires dealing damage when standing (damage > 0).',
  'Debilidad': 'Weakness',
  'Robás 6 de vida al rival (se duplica a 12 con 4 columnas en mesa)': 'Steal 6 HP from rival (doubles to 12 with 4 columns on field)',
  'Al conectar tu ataque,': 'On connecting your attack,',
  'le roba 6 de vida al rival y te los cura a vos': 'steals 6 HP from the rival and heals you',
  '. Si tenés': '. If you have',
  '4 o más columnas en mesa': '4 or more columns on field',
  ', ¡el drenaje se duplica a': ', the drain doubles to',
  '12 de vida': '12 HP',
  '!': '!',
  'Drenaje doble:': 'Dual drain:',
  'Le resta vida al oponente y cura a tu Axie en la misma cantidad.': 'Reduces rival HP and heals your Axie for the same amount.',
  'Bonus de 4 columnas:': '4-column bonus:',
  'Se duplica a 12 con 4 o más cartas en mesa (los Free Games apilados no cuentan como columna nueva).': "Doubles to 12 with 4 or more cards on field (stacked Free Games don't count as new columns).",
  'Drenaje de vida': 'Life steal',
  'Bonus 4 columnas': '4-column bonus',
  'Envenena por la mitad de tu golpe; daña cada turno y se reduce a la mitad': 'Poisons for half your damage; bites each turn and halves',
  'Infecta al oponente con veneno igual a la': 'Infects the opponent with poison equal to',
  'mitad de tu daño': 'half your damage',
  '. Al final del turno del rival, el veneno le resta vida y luego se parte a la mitad.': ". At the end of the rival's turn, poison subtracts HP and then halves.",
  'Daño al final de su turno:': 'Damage at turn end:',
  'Muerde restando vida, se divide a la mitad y se disipa si queda en 2 o menos.': 'Bites dealing damage, halves, and dissipates if 2 or less.',
  'Nuevos venenos se suman al veneno que ya tenga encima el rival.': 'New poison stacks with existing poison on the rival.',
  'Daño continuo': 'Damage over time',
  'Tope defensivo: el próximo ataque rival no superará los 12 de daño': "Defensive cap: rival's next attack will not exceed 12 damage",
  'Cubre a tu Axie con un blindaje que absorbe cualquier exceso de daño, limitando el próximo ataque rival que conecte a un': "Covers your Axie with armor that absorbs excess damage, capping the rival's next hit to a",
  'máximo estricto de 12 de daño': 'strict maximum of 12 damage',
  'Blindaje anti-remates:': 'Anti-finisher armor:',
  'Aunque el rival conecte un golpe de 40 puntos, solo recibirás 12.': 'Even if the rival lands a 40-point strike, you only take 12.',
  'Cada piel extra reduce el tope en -2 puntos (hasta un piso mínimo de 6).': 'Each extra mask reduces the cap by -2 (down to a minimum floor of 6).',
  'Consumo:': 'Consumption:',
  'Se gasta únicamente cuando el rival conecta un ataque con daño.': 'Only consumed when the rival connects an attack with damage.',
  'Tope de daño': 'Damage cap',
  'Acumulable (piso 6)': 'Stackable (min 6)',
  'Especial Neutral': 'Neutral Special',
  'Rocket Stamp (Free Game)': 'Rocket Stamp (Free Game)',
  'Al entrar en mesa, alarga una carta existente': 'On entering field, extends an existing card',
  'Carta comodín neutral con 2 símbolos. Si al salir de tu mazo no coincide con tus cadenas vivas,': "Neutral wildcard with 2 symbols. If drawn and it doesn't match your living chains,",
  'te cortás como con cualquier carta': 'you bust just like any other card',
  '. Al entrar en mesa con éxito, tu próximo robo alarga una carta existente sumando sus símbolos.': '. On successfully entering the field, your next draw extends an existing card, combining their symbols.',
  'Al salir del mazo:': 'When drawn:',
  'Debe compartir al menos un símbolo vivo para no cortarte.': 'Must share at least one living symbol to avoid busting.',
  'Efecto comodín:': 'Wildcard effect:',
  'Tu siguiente robo se monta sobre una columna que elijas de la mesa.': 'Your next draw stacks onto a column of your choice on the field.',
  'Salva cadenas:': 'Chain saver:',
  'Suma sus símbolos a esa carta para continuar o abrir rachas.': 'Adds its symbols to that card to continue or open chains.',
  'Comodín neutral': 'Neutral wildcard',
  'Alarga carta': 'Extends card',
  'Indicadores de Estado en el Axie': 'Status Indicators on Axie',
  'Aparecen en la chapa de vida de cada Axie cuando los efectos están activos:': "Appear on each Axie's HP plate when effects are active:",
  'Fuerza:': 'Strength:',
  'Daño fijo extra permanente': 'Permanent flat bonus damage',
  'Huevo:': 'Egg:',
  'Puntos de escudo activos': 'Active shield points',
  'Caracol:': 'Snail:',
  'Ataques rivales que pegarán la mitad': 'Rival attacks that will deal half damage',
  'Veneno:': 'Poison:',
  'Daño que morderá al final de su turno': 'Damage that bites at end of their turn',
  'Hoja:': 'Leaf:',
  'Hojas activas (curan 4 al fin del turno)': 'Active leaves (heal 4 at end of turn)',
  'Piel:': 'Mask:',
  'Tope de daño máximo activo': 'Active damage cap limit',

  // lobby.js
  '{current} de {total}': '{current} of {total}',
  'Mazo inicial · 10 cartas · {boosted} mejorada': 'Starter deck · 10 cards · {boosted} boosted',
  'Mazo inicial · 10 cartas · {boosted} mejoradas': 'Starter deck · 10 cards · {boosted} boosted',
  'Mazo inicial · 10 cartas · sumale un símbolo con el +': 'Starter deck · 10 cards · add a symbol with +',
  '{name}: {n} en el mazo': '{name}: {n} in deck',
  'Con este vas a jugar hasta que lo cambies.': 'You will play with this one until you change it.',
  'Sacarle el {symbol} de más': 'Remove extra {symbol}',
  'Sumarle otro {symbol}': 'Add another {symbol}',
  'Sumarle uno de sus dos símbolos': 'Add one of its two symbols',
  'Nivel {n}': 'Level {n}',
  'Comodín': 'Wildcard',
  'Nuevos poderes y especiales en este nivel (+{count} poderes + {extra})': 'New powers and specials in this level (+{count} powers + {extra})',
  'Nuevos poderes en este nivel (+{count})': 'New powers in this level (+{count})',
  'Poderes en este nivel': 'Powers in this level',
  '★ Nivel Superado': '★ Level Cleared',
  'Combate Disponible': 'Battle Available',
  '«Al pegar» es plantarte con un ataque que haga daño: si te cortás, esos poderes no salen.': '“On hit” means standing with an attack that deals damage: if you bust, these powers do not trigger.',
  'Rival': 'Rival',
  'Dificultad: {diff}': 'Difficulty: {diff}',
  'Volver a Jugar': 'Play Again',
  'Hace falta abrir el juego con npm start': 'Game needs to be opened with npm start',
  'Switch to English': 'Switch to English',
  'Cambiar a español': 'Cambiar a español',
  ' y ': ' and ',

  // data.js
  'al pegar, +{gain} hojas (hasta {max}); al final de cada turno tuyo, cada hoja te cura {heal} y se gasta 1':
    'on hit, +{gain} leaves (up to {max}); at the end of each turn, each leaf heals {heal} and consumes 1',
  'al pegar, ganás un escudo de la mitad del golpe; si el rival lo rompe, recibe {dmg} de daño':
    'on hit, gain a shield for half the damage dealt; if broken, the rival takes {dmg} damage',
  'apenas la robás, {dmg} de daño directo al rival, aunque después te cortes':
    'as soon as drawn, {dmg} direct damage to the rival, even if you bust later',
  'al plantarte (aunque pegues 0), elegís 1 carta extra del mercado para tu mazo':
    'when standing (even dealing 0), draft 1 extra card from the market for your deck',
  'al pegar, te curás lo mismo que pegaste':
    'on hit, heal for the same amount of damage dealt',
  'al pegar, envenenás al rival con la mitad del golpe; al final de cada turno suyo le saca eso ':
    'on hit, poison the rival for half the damage; at each turn end it bites and halves ',
  'al pegar, envenenás al rival con la mitad del golpe; al final de cada turno suyo le saca eso y se reduce a la mitad':
    'on hit, poison the rival for half the damage; at each turn end it bites and halves',
  'al pegar, el próximo ataque del rival hace la mitad de daño':
    "on hit, the rival's next attack deals half damage",
  'al pegar, +{step} de daño en ese ataque y en todos los que siguen':
    'on hit, +{step} damage on this attack and all future attacks',
  'al pegar, +{step} de daño por cada símbolo de tu racha más larga':
    'on hit, +{step} damage per symbol in your longest chain',
  'al plantarte, la carta que elijas del mercado abre tu próxima ronda':
    'when standing, the card you draft from the market opens your next round',
  'si comparte un símbolo con tu cadena, tu próximo robo se monta sobre una carta de la mesa ':
    'if it shares a symbol with your chain, your next draw stacks onto a card on the field ',
  'si comparte un símbolo con tu cadena, tu próximo robo se monta sobre una carta de la mesa y le suma sus símbolos':
    'if it shares a symbol with your chain, your next draw stacks onto a card on the field, adding its symbols',
  'al pegar, le sacás {drain} de vida al rival y te los curás ':
    'on hit, steal {drain} HP from the rival and heal yourself ',
  'al pegar, le sacás {drain} de vida al rival y te los curás ({bonus} con {thresh} o más columnas en mesa)':
    'on hit, steal {drain} HP from the rival and heal yourself ({bonus} with {thresh} or more columns on field)',
  'al pegar, el próximo golpe del rival te hace {cap} de daño como máximo':
    "on hit, the rival's next attack deals a maximum of {cap} damage",
  'Poder': 'Power',
  'Cola': 'Tail',
  'Boca': 'Mouth',
  'Ojos': 'Eyes',
  'Orejas': 'Ears',
  'Cuerno': 'Horn',
  'Espalda': 'Back',
  'Alianza Presa 1': 'Prey Alliance 1',
  'Alianza Presa 2': 'Prey Alliance 2',
  'Doble Presa': 'Double Prey',
  'Confinamiento': 'Confinement',

  // game.js
  'Vos': 'You',
  'vos': 'you',
  'a vos': 'to you',
  'de vos': 'your',
  'La CPU': 'The CPU',
  'CPU': 'CPU',
  'la CPU': 'the CPU',
  'a la CPU': 'to the CPU',
  'de la CPU': 'of the CPU',
  'el rival': 'the rival',
  'al rival': 'to the rival',
  'del rival': 'of the rival',
  'Jugador 1': 'Player 1',
  'J1': 'P1',
  'el Jugador 1': 'Player 1',
  'al Jugador 1': 'to Player 1',
  'del Jugador 1': 'of Player 1',
  'Jugador 2': 'Player 2',
  'J2': 'P2',
  'el Jugador 2': 'Player 2',
  'al Jugador 2': 'to Player 2',
  'del Jugador 2': 'of Player 2',
  'Se acabó el tiempo: se te desarma el ataque. 0 de daño.':
    'Time is up: your attack collapses. 0 damage.',
  'Se acabó el tiempo: se le desarma el ataque. 0 de daño.':
    'Time is up: their attack collapses. 0 damage.',
  'Se acabó el tiempo de elegir.':
    'Time is up to choose.',
  'Vos rebarajás lo que ya salió.':
    'You reshuffle drawn cards.',
  '{who} rebaraja lo que ya salió.':
    '{who} reshuffles drawn cards.',
  '{mine} contra {theirs}':
    '{mine} vs {theirs}',
  '{target} de vida cada uno.':
    '{target} HP each.',
  '{versus}, dos jugadores. {hp}':
    '{versus}, two players. {hp}',
  'Modo Aventura ({name}): {versus}. {hp}':
    'Adventure Mode ({name}): {versus}. {hp}',
  'Jugás con {versus}. {hp}':
    'Playing with {versus}. {hp}',
  'Ronda {round}':
    'Round {round}',
  'Free Game activo: tu próximo robo no corta y se monta sobre una carta':
    "Free Game active: your next draw won't bust and stacks onto a card",
  'Free Game encadenado: el próximo robo también se monta en mesa':
    'Chained Free Game: next draw also stacks on the field',
  'Vos montás {card} sobre la columna {col} alargándola → ataque de {swing}':
    'You stack {card} onto column {col} extending it → {swing} attack',
  '{who} monta {card} sobre la columna {col} alargándola → ataque de {swing}':
    '{who} stacks {card} onto column {col} extending it → {swing} attack',
  'Vos sacás {card} → ataque de {swing}':
    'You draw {card} → {swing} attack',
  '{who} saca {card} → ataque de {swing}':
    '{who} draws {card} → {swing} attack',
  'Pluma Sagrada le pega a vos por {dmg}: quedás en {hp}.':
    'Feather Earring hits you for {dmg}: you are at {hp} HP.',
  'Pluma Sagrada le pega {target} por {dmg}: queda en {hp}.':
    'Feather Earring deals {dmg} damage {target}: at {hp} HP.',
  'Última chance: a vos no le queda vida, pero sí este golpe. Si deja sin vida {foe}, empatan.':
    "Last Chance: you have no HP left, but you get this strike. If it leaves no HP {foe}, it's a draw.",
  'Última chance: {target} no le queda vida, pero sí este golpe. Si deja sin vida {foe}, empatan.':
    "Last Chance: no HP left {target}, but this strike remains. If it leaves no HP {foe}, it's a draw.",
  'Vos abrís con {card} y 1 carta más en una carta gigante':
    'You open with {card} and 1 more card in a giant card',
  '{who} abre con {card} y 1 carta más en una carta gigante':
    '{who} opens with {card} and 1 more card in a giant card',
  'Vos abrís con {card} y {count} cartas más en una carta gigante':
    'You open with {card} and {count} more cards in a giant card',
  '{who} abre con {card} y {count} cartas más en una carta gigante':
    '{who} opens with {card} and {count} more cards in a giant card',
  'Vos abrís con {card} de la burbuja':
    'You open with {card} from the bubble',
  '{who} abre con {card} de la burbuja':
    '{who} opens with {card} from the bubble',
  'Vos abrís con {card}':
    'You open with {card}',
  '{who} abre con {card}':
    '{who} opens with {card}',
  'Vos sacás {card}: se te desarma el ataque. 0 de daño.':
    'You draw {card}: your attack collapses. 0 damage.',
  '{who} saca {card}: se le desarma el ataque. 0 de daño.':
    '{who} draws {card}: their attack collapses. 0 damage.',
  '{target} le alcanza una cadena de {needs} para empatar.':
    '{target}, a chain of {needs} is enough to draw.',
  'Vos cerrás su ataque con {points}.':
    'You close your attack with {points}.',
  '{who} cierra su ataque con {points}.':
    '{who} closes their attack with {points}.',
  'Vos vas a elegir una carta extra para tu mazo.':
    'You will choose 1 extra card for your deck.',
  '{who} va a elegir una carta extra para tu mazo.':
    '{who} will choose 1 extra card for their deck.',
  'Vos vas a elegir {count} cartas extra para tu mazo.':
    'You will choose {count} extra cards for your deck.',
  '{who} va a elegir {count} cartas extra para tu mazo.':
    '{who} will choose {count} extra cards for their deck.',
  'Vos atrapás la apertura en una burbuja: la carta que elijas del centro abrirá tu próxima ronda.':
    'You trap the opener in a bubble: the card you choose from the center will open your next round.',
  '{who} atrapa la apertura en una burbuja: la carta que elijas del centro abrirá tu próxima ronda.':
    '{who} traps the opener in a bubble: the card chosen from the center will open the next round.',
  '{name} sin efecto: el ataque hizo 0.':
    '{name} has no effect: the attack dealt 0.',
  'Vos afilás: +{str} de daño de acá en más.':
    'You sharpen: +{str} damage from now on.',
  '{who} afila: +{str} de daño de acá en más.':
    '{who} sharpens: +{str} damage from now on.',
  'Vos quedás debilitado: su próximo ataque pega la mitad.':
    'You are weakened: next enemy attack deals half damage.',
  '{who} queda debilitado: su próximo ataque pega la mitad.':
    '{who} is weakened: their next attack deals half damage.',
  'Vos quedás debilitado: sus próximos {weak} ataques pegan la mitad.':
    'You are weakened: next {weak} enemy attacks deal half damage.',
  '{who} queda debilitado: sus próximos {weak} ataques pegan la mitad.':
    '{who} is weakened: their next {weak} attacks deal half damage.',
  'Vos quedás con un huevo de {egg}.':
    'You get an egg shield of {egg}.',
  '{who} queda con un huevo de {egg}.':
    '{who} gets an egg shield of {egg}.',
  'Vos te curás {got} y quedás en {hp}.':
    'You heal {got} and are at {hp} HP.',
  '{who} se cura {got} y queda en {hp}.':
    '{who} heals {got} and is at {hp} HP.',
  'Vos ya estás entero: la maceta no cura nada.':
    'You are already at full HP: Leafy Pot heals nothing.',
  '{who} ya está entero: la maceta no cura nada.':
    '{who} is already at full HP: Leafy Pot heals nothing.',
  'Vos quedás con {poison} de veneno.':
    'You have {poison} poison.',
  '{who} queda con {poison} de veneno.':
    '{who} has {poison} poison.',
  'Vos desgarrás: +{dmg} de daño (+{step} × {longest} de tu cadena más larga).':
    'You rend: +{dmg} damage (+{step} × {longest} from your longest chain).',
  '{who} desgarra: +{dmg} de daño (+{step} × {longest} de tu cadena más larga).':
    '{who} rends: +{dmg} damage (+{step} × {longest} from longest chain).',
  'Vos sumás +{gain} hojas (Leaf) ({leaf}/{max}): curará +{heal} de vida al final del turno.':
    'You gain +{gain} leaves ({leaf}/{max}): will heal +{heal} HP at end of turn.',
  '{who} suma +{gain} hojas (Leaf) ({leaf}/{max}): curará +{heal} de vida al final del turno.':
    '{who} gains +{gain} leaves ({leaf}/{max}): will heal +{heal} HP at end of turn.',
  ' (¡duplicado por tener {count} columnas en mesa!)':
    ' (doubled for having {count} columns on the field!)',
  ' y te curás {got}':
    ' and you heal {got}',
  ' y se cura {got}':
    ' and heals {got}',
  'Vos quedás en {hp}.':
    'You are at {hp} HP.',
  '{who} queda en {hp}.':
    '{who} is at {hp} HP.',
  'Vos drenás {drain} de vida {target}{bonus}{heal}: {foeEnd}':
    'You drain {drain} HP {target}{bonus}{heal}: {foeEnd}',
  '{who} drena {drain} de vida {target}{bonus}{heal}: {foeEnd}':
    '{who} drains {drain} HP {target}{bonus}{heal}: {foeEnd}',
  'Vos endurecés su Piel de Escamas: limitará el próximo golpe rival a un máximo de {cap} de daño.':
    "You harden Gecko Mask: caps the rival's next hit to a maximum of {cap} damage.",
  '{who} endurece su Piel de Escamas: limitará el próximo golpe rival a un máximo de {cap} de daño.':
    "{who} hardens Gecko Mask: caps the rival's next hit to a maximum of {cap} damage.",
  '+{str} de fuerza':
    '+{str} strength',
  '+{brutal} de garra brutal':
    '+{brutal} brutal claw',
  'partido al medio por el caracol':
    'halved by Lazy Snail',
  'Vos atacás por {swing}: {points} de cadena {mods}.':
    'You attack for {swing}: {points} chain {mods}.',
  '{who} ataca por {swing}: {points} de cadena {mods}.':
    '{who} attacks for {swing}: {points} chain {mods}.',
  'Piel de Escamas tuya frena el golpe: mitiga {mitigated} de daño (tope máximo {cap}).':
    'Your Gecko Mask blocks the hit: mitigates {mitigated} damage (maximum cap {cap}).',
  'Piel de Escamas {owner} frena el golpe: mitiga {mitigated} de daño (tope máximo {cap}).':
    'Gecko Mask {owner} blocks the hit: mitigates {mitigated} damage (maximum cap {cap}).',
  ' y se rompe: la cáscara le devuelve {thorns} a vos':
    ' and breaks: the shell returns {thorns} to you',
  ' y se rompe: la cáscara le devuelve {thorns} {target}':
    ' and breaks: the shell returns {thorns} {target}',
  ' y se rompe':
    ' and breaks',
  ' y le quedan {egg}':
    ' and has {egg} left',
  'El huevo tuyo aguanta {blocked}{rest}.':
    'Your egg shield absorbs {blocked}{rest}.',
  'El huevo {owner} aguanta {blocked}{rest}.':
    'The egg shield {owner} absorbs {blocked}{rest}.',
  'Vos pegás por {landed}. {who} queda en {hp}.':
    'You strike for {landed}. {who} is at {hp} HP.',
  '{who} pega por {landed}. Vos quedás en {hp}.':
    '{who} strikes for {landed}. You are at {hp} HP.',
  '{who} pega por {landed}. {target} queda en {hp}.':
    '{who} strikes for {landed}. {target} is at {hp} HP.',
  'La cáscara le vuelve a vos por {thorns}: quedás en {hp}.':
    'The shell hits back at you for {thorns}: you are at {hp} HP.',
  'La cáscara le vuelve {target} por {thorns}: queda en {hp}.':
    'The shell hits back {target} for {thorns}: at {hp} HP.',
  ' (le queda 1 hoja)':
    ' (1 leaf remaining)',
  ' (le quedan {left} hojas)':
    ' ({left} leaves remaining)',
  ' (se consumió la última hoja)':
    ' (last leaf consumed)',
  '1 hoja':
    '1 leaf',
  '{leaves} hojas':
    '{leaves} leaves',
  'Vos te curás +{got} de vida ({leafCount}) y quedás en {hp}.':
    'You heal +{got} HP ({leafCount}) and are at {hp} HP.',
  '{who} se cura +{got} de vida ({leafCount}) y queda en {hp}.':
    '{who} heals +{got} HP ({leafCount}) and is at {hp} HP.',
  'Vos ya estás entero ({leafCount}).':
    'You are already at full HP ({leafCount}).',
  '{who} ya está entero ({leafCount}).':
    '{who} is already at full HP ({leafCount}).',
  'Hoja (Leaf):':
    'Spring Leaf:',
  ' y le baja a {left}':
    ' and drops to {left}',
  ' y se le va':
    ' and dissipates',
  'El veneno le saca {bite} a vos: quedás en {hp}{poisonEnd}.':
    'Poison deals {bite} damage to you: you are at {hp} HP{poisonEnd}.',
  'El veneno le saca {bite} {target}: queda en {hp}{poisonEnd}.':
    'Poison deals {bite} damage {target}: at {hp} HP{poisonEnd}.',
  'Pegaron igual':
    'Tied damage',
  'Pegó más fuerte {winner}':
    '{winner} hit harder',
  'Fin del intercambio {round}: {p1} vs {p2} de daño. {verdict}. Vida {hp1} — {hp2}.':
    'End of round {round}: {p1} vs {p2} damage. {verdict}. HP {hp1} — {hp2}.',
  ' junto a 1 carta más en una carta gigante':
    ' along with 1 more card in a giant card',
  ' junto a {more} cartas más en una carta gigante':
    ' along with {more} more cards in a giant card',
  'Vos atrapás {card} en la burbuja: abrirá tu próxima ronda{more}.':
    'You trap {card} in the bubble: it will open your next round{more}.',
  '{who} atrapa {card} en la burbuja: abrirá tu próxima ronda{more}.':
    '{who} traps {card} in the bubble: it will open their next round{more}.',
  'Vos sumás {card} al mazo.':
    'You add {card} to your deck.',
  '{who} suma {card} al mazo.':
    '{who} adds {card} to their deck.',
  'Vos renovás el centro: no había nada con {crest}.':
    'You refresh the center: nothing matched {crest}.',
  '{who} renueva el centro: no había nada con {crest}.':
    '{who} refreshes the center: nothing matched {crest}.',

  // net.js
  'No se pudo crear la sala.': 'Could not create the room.',
  'Sin conexión con el servidor de salas. Probá de nuevo en un rato.':
    'No connection to the room server. Try again in a moment.',
  'Conectando con el servidor de salas…': 'Connecting to the room server…',
  'Esa sala ya no está.': 'That room is gone.',
  'Sala de {name}': "{name}'s room",
  'La sala se cerró': 'The room was closed',
  'Quien la creó se fue. Volvé a la lista con la cruz.':
    'Its creator left. Go back to the list with the cross.',
  'Esperando que vuelva quien creó la sala…': 'Waiting for the room creator to come back…',
  'Todavía no hay ninguna. Creá una y esperá al otro.':
    'None available yet. Create one and wait for the other player.',
  'ronda {round}':
    'round {round}',
  'completa':
    'full',
  'Mirar':
    'Spectate',
  'Entrar':
    'Join',
  'esperando…':
    'waiting…',
  'listo':
    'ready',
  'sin confirmar':
    'unconfirmed',
  'vos':
    'you',
  'Elegí uno':
    'Choose one',
  'Creá una sala y pasale el QR o el link al otro, esté donde esté.':
    'Create a room and share the QR code or link with the other player, wherever they are.',
  'Se cortó la conexión':
    'Connection lost',
  'Entrando…':
    'Joining…',
  'Reintentando solo. Si no vuelve, revisá tu conexión.':
    'Retrying automatically. If it does not come back, check your connection.',
  'Buscando la sala.':
    'Looking for room.',
  'Sala':
    'Room',
  'Los dos asientos están ocupados: entrás a mirar.':
    'Both seats are taken: you are spectating.',
  'Esperando al otro…':
    'Waiting for the other player…',
  'Listo. Falta que entre el otro aparato.':
    'Ready. Waiting for the other device to join.',
  'Cuando los dos aprieten Listo, empieza.':
    'When both players press Ready, it starts.',
  'Ya no':
    'Not ready',
  'Ya se jugaron {n} rondas: si te vas, <b>gana el otro</b>.':
    '{n} rounds have already been played: if you leave, <b>the opponent wins</b>.',
  'Todavía no se jugaron {n} rondas: si te vas, la partida <b>se anula</b> y no gana nadie.':
    '{n} rounds haven\'t been played yet: if you leave, the match is <b>voided</b> and no one wins.',

  // ui.js
  'Alargar columna {n}': 'Extend column {n}',
  'Carta de Free Game para colocar': 'Free Game card to place',
  'Free Game — Elegí qué columna colocar': 'Free Game — Choose which column to place',
  'Free Game — {name} elige la columna': 'Free Game — {name} is choosing the column',
  'sin cartas': 'no cards',
  'Se acabó el tiempo · el ataque falla': 'Time is up · attack fails',
  'Cadena cortada · el ataque falla': 'Chain busted · attack fails',
  '{name}: {dmg} de daño acumulado al romperse (escudo: {shield})':
    '{name}: {dmg} damage accumulated on break (shield: {shield})',
  '{name}: {poison} de daño al finalizar su turno, después se parte al medio':
    '{name}: {poison} damage at the end of their turn, then halves',
  'Debilitado: su próximo ataque pega la mitad': 'Weakened: next attack deals half damage',
  'Debilitado: sus próximos {weak} ataques pegan la mitad':
    'Weakened: next {weak} attacks deal half damage',
  '{name}: +{strength} de daño en cada ataque': '{name}: +{strength} damage on each attack',
  '{name}: +1 carta extra para tu mazo al cerrar el turno':
    '{name}: +1 extra card for your deck at end of turn',
  '{name}: +{count} cartas extra para tu mazo al cerrar el turno':
    '{name}: +{count} extra cards for your deck at end of turn',
  '{name}: la carta que elijas del centro abrirá tu próxima ronda':
    '{name}: the card you choose from the center will open your next round',
  '{name}: {bubbles} cartas apiladas abrirán tu próxima ronda como carta gigante':
    '{name}: {bubbles} stacked cards will open your next round as a giant card',
  '{name}: apertura lista para la próxima ronda': '{name}: opener ready for next round',
  '{name}: 1 hoja (cura +{heal} al final de tu turno y consume 1)':
    '{name}: 1 leaf (heals +{heal} at the end of your turn and consumes 1)',
  '{name}: {leaf} hojas (cura +{heal} al final de tu turno y consume 1)':
    '{name}: {leaf} leaves (heals +{heal} at the end of your turn and consumes 1)',
  '{name}: limita el próximo ataque rival a máximo {cap} de daño':
    '{name}: caps next rival attack to a maximum of {cap} damage',
  'falló': 'failed',
  '{dealt} de daño': '{dealt} damage',
  'Escudo: aguanta {shield} de daño': 'Shield: absorbs {shield} damage',
  '{raw} de cadena': '{raw} chain',
  'DAÑO': 'DAMAGE',
  ', con {power}': ', with {power}',
  'La CPU cobra su carta del {icon}…': 'The CPU claims its {icon} card…',
  'La CPU está eligiendo…': 'The CPU is choosing…',
  'El centro': 'The Center',
  'Una carta <b>de más</b>, la que quieras. Abre tu próxima ronda.':
    'One <b>extra</b> card, whichever you want. Opens your next round.',
  '<b>{bonus} cartas de más</b>, las que quieras. Abren tu próxima ronda, en el orden que las toques.':
    '<b>{bonus} extra cards</b>, whichever you want. They open your next round, in the order you tap them.',
  'Carta del pulpo': 'Octopus card',
  'Perdés la carta que te debe el pulpo': 'You forfeit the card the octopus owes you',
  'No agarrar': 'Skip',
  'Se te cortó la cadena: llevate <b>una carta sin poder</b>.':
    'Your chain busted: take <b>one card without power</b>.',
  'Llevate <b>una con poder</b> (y listo) <b>o dos sin poder</b>.':
    'Take <b>one with power</b> (and done) <b>or two without power</b>.',
  'Vas por cartas sin poder: te queda 1.': 'Going for cards without power: 1 left.',
  'Vas por cartas sin poder: te quedan {remaining}.':
    'Going for cards without power: {remaining} left.',
  'Elegí del centro': 'Choose from the center',
  'Ninguna carta que podés llevarte tiene tu símbolo':
    'None of the cards you can take has your symbol',
  'Renovar el centro ⟳': 'Refresh center ⟳',
  'No agarrar más': 'Take no more',
  'Cerrá el reparto sin sumar cartas al mazo': 'End the draft without adding cards to your deck',
  '¡Aventura Completada!': 'Adventure Completed!',
  '¡{name} Superado!': '{name} Cleared!',
  'Nivel': 'Level',
  'Derrota en la Aventura': 'Adventure Defeat',
  '¡Victoria!': 'Victory!',
  'Partida anulada': 'Match voided',
  'La suerte no estuvo de tu lado…': 'Luck was not on your side…',
  '{gone} abandonó en las primeras {rounds} rondas: no gana nadie.':
    '{gone} forfeited in the first {rounds} rounds: no one wins.',
  '{gone} abandonó la partida.': '{gone} forfeited the match.',
  '{at}está eligiendo del centro…': '{at}is choosing from the center…',
  'Volver a las salas': 'Back to rooms',
  'Siguiente Nivel': 'Next Level',
  'Ver Aventura': 'View Adventure',
  'Aventura': 'Adventure',
  'Menú principal': 'Main Menu',
  'Reintentar Nivel': 'Retry Level',
  'Jugar de nuevo': 'Play again',
  'Repartiendo…': 'Dealing…',
  '¡ÚLTIMA CHANCE!': 'LAST CHANCE!',
  'Última chance de la CPU: si te deja sin vida, empatan.':
    "CPU's Last Chance: if it leaves you with no HP, it's a draw.",
  'La CPU está cargando su ataque…': 'The CPU is charging its attack…',
  '{at}última chance: si te deja sin vida, empatan.':
    '{at}last chance: if it leaves you with no HP, it\'s a draw.',
  '{at}está cargando su ataque…': '{at}is charging their attack…',
  'Robar carta': 'Draw card',
  'Atacar': 'Attack',
  '✨ Free Game: elegí la columna donde colocar {card}':
    '✨ Free Game: choose the column to place {card}',
  '✨ Free Game activo: robando carta automáticamente…':
    '✨ Free Game active: drawing card automatically…',
  '{at}última chance: si dejás sin vida al otro, empatan.':
    '{at}last chance: if you leave the opponent with no HP, it\'s a draw.',
  'Le toca a {name}.': "It's {name}'s turn.",
  'La próxima carta continúa la cadena: {pct}%.': 'The next card continues the chain: {pct}%.',
  '1 carta': '1 card',
  '{n} cartas': '{n} cards',
  '1 sin salir': '1 undrawn',
  '{n} sin salir': '{n} undrawn',
  'Mazo {of}': 'Deck {of}',
  'Mazo inicial · {count} cartas': 'Starter deck · {count} cards',
  'Sumadas del centro · {count}': 'Drafted from the center · {count}',
  'Sumadas del centro': 'Drafted from the center',
  'Todavía ninguna: las cartas del centro se ganan atacando.':
    'None yet: cards from the center are won by attacking.',
  '{name} roto': '{name} broken',
  '¡se rompe!': 'breaks!',
  'fallo': 'miss',

  // tutorial.js
  '¡Atacá!': 'Attack!',
  'Dejalo en 0': 'Bring it to 0',
  'Más larga, más fuerte': 'Longer hits harder',
  'Cadenas vivas': 'Alive chains',
  'cadenas vivas': 'alive chains',
  'Cadenas largas hacen más daño': 'Longer chains deal more damage',
  'Cadenas largas hacen mas daño': 'Longer chains deal more damage',
  '¡Se le cortó!': 'Its chain broke!',
  'Chances de seguir la cadena': 'Odds of keeping the chain',
  '¡Se cortó la cadena!': 'The chain broke!',
  '¡Cadena rota! No comparte símbolos': 'Broken chain! No matching symbols',
  'Cadena rota! No comparte símbolos': 'Broken chain! No matching symbols',
  'Buscá tu color': 'Look for your color',
  'Llevate el cohete': 'Take the rocket',
  'Sumala a tu cadena': 'Add it to your chain',
  'Montala en la 2ª carta': 'Stack it on the 2nd card',
  '¡Rematalo!': 'Finish it!',
  '¡TUTORIAL COMPLETADO!': 'TUTORIAL COMPLETE!',
  'Ir a modo Aventura': 'Go to Adventure mode',
  'Salir del tutorial': 'Exit tutorial',
  'Salir ✕': 'Exit ✕',

  // adventure-levels.js
  'Aprende los fundamentos del combate, aprovecha la fuerza y la curación, y usá el comodín apilable Free Game.':
    'Learn combat fundamentals, harness strength and healing, and use the stackable Free Game wildcard.',
  'Nivel 2: Defensa y Estrategia': 'Level 2: Defense and Strategy',
  'El combate se intensifica. Protegete con cáscaras de huevo y ralentiza al rival con baba de caracol.':
    'Combat intensifies. Protect yourself with egg shells and slow the rival with snail slime.',
  'Nivel 3: El Arte del Mercado': 'Level 3: The Art of the Market',
  'Los 6 poderes clásicos se completan. Reclama cartas extra con el pulpo e inocula veneno mortal.':
    'The 6 classic powers are complete. Claim extra cards with the octopus and inject deadly poison.',
  'Nivel 4: Furia de la Naturaleza': 'Level 4: Nature\'s Fury',
  'Desata el poder de la garra brutal acumulando bestias y sana progresivamente con hojas de regeneración.':
    'Unleash the power of the brutal claw by stacking beasts and heal progressively with regeneration leaves.',
  'Nivel 5: Sombras y Vuelo': 'Level 5: Shadows and Flight',
  'Golpes directos desde el aire con plumas sagradas y drenaje voraz de vida con sanguijuela.':
    'Direct strikes from the air with sacred feathers and voracious life drain with leech.',
  'Nivel 6: Duelo de Maestros': 'Level 6: Duel of Masters',
  'El desafío definitivo: los 6 poderes avanzados en juego con burbujas estratégicas y piel de escamas impenetrable.':
    'The ultimate challenge: all 6 advanced powers in play with strategic bubbles and impenetrable scale skin.',

  // index.html (enciclopedia)
  'Hoja': 'Leaf',
  'Fuerza': 'Strength',
  'Veneno': 'Poison',
  'Blindaje': 'Armor',
  '+2 de daño por cada símbolo de tu cadena más larga':
    '+2 damage per symbol in your longest chain',
};


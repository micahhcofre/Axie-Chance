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
  'Axies': 'Axies',
  'Tutorial': 'Tutorial',
  'Campaña': 'Campaign',
  'Duelo': 'Duel',
  'En Red': 'Online',

  // index.html — Elección de Axie
  '← Volver': '← Back',
  '← Salir': '← Leave',
  'El Axie anterior': 'Previous Axie',
  'El Axie siguiente': 'Next Axie',
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
  '150 de vida': '150 HP',
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
  '—el tuyo o el del rival— para ver su mazo entero: las ocho de fábrica y todo lo que fue sumando del centro.': "—yours or your rival's— to view its full deck: the starting eight plus everything drafted from the center.",
  'Cada jugador roba de su': 'Each player draws from their',
  'mazo inicial de 8 cartas': '8-card starter deck',
  ', construido alrededor de su clase: 5 pares con su símbolo, 1 carta solitaria de su símbolo y 2 cartas ajenas. Los mazos iniciales no traen poderes.': ', built around their class: 5 pairs with their symbol, 1 single-symbol card, and 2 off-class cards. Starter decks contain no powers.',
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
  '(Bestia) — Al pegar, +3 de daño por cada símbolo de tu racha más larga.': '(Beast) — On hit, +3 damage per symbol in your longest chain.',
  '(Pez) — Al plantarte (aunque pegues 0), elegís 1 carta extra del mercado para tu mazo.': '(Aquatic) — When standing (even dealing 0), draft 1 extra card from the market for your deck.',
  '(Pez) — Al plantarte, la carta que elijas del mercado abre tu próxima ronda.': '(Aquatic) — When standing, the card you draft from the market opens your next round.',
  '(Pájaro) — Al pegar, sumás un escudo de un tercio del golpe (mínimo 1); si el rival lo rompe, recibe 8 de daño por cada huevo.': '(Bird) — On hit, add a shield of a third of the damage dealt (at least 1); if broken, the rival takes 8 counter damage per egg.',
  '(Pájaro) — Apenas la robás, 5 de daño directo al rival, aunque después te cortes.': '(Bird) — As soon as drawn, 5 direct damage to the rival, even if you bust later.',
  '(Planta) — Al pegar, te curás lo mismo que pegaste.': '(Plant) — On hit, heal for the same amount of damage dealt.',
  '(Planta) — Al pegar, +2 hojas (hasta 5); al inicio de cada turno tuyo, cada hoja te cura 4 y se gasta 1.': '(Plant) — On hit, +2 leaves (up to 5); at the start of each of your turns, each leaf heals 4 and consumes 1 leaf.',
  '(Bicho) — Al pegar, el próximo ataque del rival hace la mitad de daño.': "(Bug) — On hit, the rival's next attack deals half damage.",
  '(Bicho) — Al pegar, le sacás 6 de vida al rival y te los curás (12 con 4 o más columnas en mesa).': '(Bug) — On hit, steal 6 HP from rival and heal yourself (12 with 4 or more columns on field).',
  '(Reptil) — Al plantarte, le ponés 6 de veneno al rival (se suma); al final de cada turno suyo le saca eso sin importar su escudo, y se reduce a la mitad.': '(Reptile) — When you stand, give the rival 6 poison (stacks); at the end of each of their turns it bites through their shield and halves.',
  '(Reptil) — Al pegar, sumás 2 de escudo y el próximo golpe del rival te saca 12 de vida como máximo.': "(Reptile) — On hit, add 2 shield and the rival's next attack takes at most 12 HP from you.",
  '(Comodín) — Al salir de tu mazo no te corta: lo ponés gratis sobre la carta de la mesa que elijas y le suma sus símbolos.': "(Wildcard) — It never busts you when drawn: you place it for free on the card of your choice on the field, adding its symbols.",
  'Campaña de 6 niveles progresivos donde se desbloquean 2 nuevos poderes de clase por nivel. En el': 'A 6-level progressive campaign where 2 new class powers unlock per level. In',
  'Primeros Pasos': 'First Steps',
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
  'Neutral': 'Neutral',
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
  '+3 de daño adicional': '+3 additional damage',
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
  'de la próxima ronda.': 'in the next round.',
  'Apertura asegurada:': 'Guaranteed opener:',
  'Arrancás la próxima ronda con los símbolos que elijas.': 'Start the next round with the symbols you chose.',
  'Carta Gigante:': 'Giant Card:',
  'Con varias burbujas, fusiona cartas de tu mazo en una supercarta.': 'With multiple bubbles, fuses cards from your deck into a supercard.',
  'Si te cortás:': 'If you bust:',
  'La burbuja no se activa.': 'The bubble does not activate.',
  'Control de mazo': 'Deck control',
  'Carta Gigante': 'Giant Card',
  'Escudo de un tercio del golpe; al romperse devuelve 8 de daño por huevo': 'Shield of a third of the damage; returns 8 damage per egg when broken',
  'Genera un': 'Generates a',
  'escudo protector': 'protective shield',
  'equivalente a un tercio del golpe infligido (mínimo 1). Dura hasta que se rompa absorbiendo daño rival y, al romperse, contraataca.': 'equal to a third of the damage dealt (at least 1). Lasts until broken absorbing enemy damage, and counterattacks when shattered.',
  'Protección acumulable:': 'Stacking protection:',
  'Absorbe daño entrante; cada huevo suma su escudo al que ya tenés (también el de la Gecko Mask).': 'Absorbs incoming damage; each egg adds its shield to the one you already have (Gecko Mask shield too).',
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
  'en ese turno (hasta el tope de 150 HP).': 'this turn (up to the 150 HP cap).',
  'Curación directa:': 'Direct healing:',
  'Si pegás 25 de daño, te curás 25 de vida al instante.': 'If you deal 25 damage, you heal 25 HP instantly.',
  'Requisito:': 'Requirement:',
  'Requiere conectar el ataque (daño > 0).': 'Requires connecting the attack (damage > 0).',
  'Al hacer 0 de daño, no hay curación.': 'Dealing 0 damage yields no healing.',
  'Curación': 'Healing',
  'Supervivencia': 'Survival',
  '+2 hojas (hasta 5). Cada hoja te cura 4 de vida al inicio de tu turno': '+2 leaves (up to 5). Each leaf heals 4 HP at the start of your turn',
  'Al atacar con éxito ganás': 'On a successful attack you gain',
  '2 hojas': '2 leaves',
  '(acumulables hasta 5). Al inicio de cada uno de tus turnos, antes de robar,': '(stacking up to 5). At the start of each of your turns, before drawing,',
  'cada hoja te cura 4 de vida y luego se consume una hoja': 'each leaf heals 4 HP and then one leaf is consumed',
  'Podés acumular hasta un máximo de 5 hojas.': 'You can stack up to a maximum of 5 leaves.',
  'Regeneración segura:': 'Guaranteed regen:',
  'Curan al inicio del turno, aunque ese turno después se corte.': 'Heals at turn start, even if that turn later busts.',
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
  '6 de veneno por frasco; atraviesa el escudo, daña cada turno y se reduce a la mitad': '6 poison per vial; goes through shields, bites each turn and halves',
  'Cada frasco le pone': 'Each vial gives the opponent',
  '6 de veneno': '6 poison',
  'al oponente, pegues lo que pegues. Al final del turno del rival, el veneno le resta vida sin pasar por su escudo y luego se parte a la mitad.': "regardless of your damage. At the end of the rival's turn, poison takes HP ignoring their shield and then halves.",
  'Daño al final de su turno:': 'Damage at turn end:',
  'Muerde restando vida, se divide a la mitad y se disipa si queda en 2 o menos.': 'Bites dealing damage, halves, and dissipates if 2 or less.',
  'Cada frasco suma 6 al veneno que ya tenga encima el rival.': 'Each vial adds 6 to the poison already on the rival.',
  'Se aplica siempre que te plantes; si te cortás, no.': "Applies whenever you stand; not if you bust.",
  'Daño continuo': 'Damage over time',
  '+2 de escudo y el próximo ataque rival te saca 12 de vida como máximo': "+2 shield and the rival's next attack takes at most 12 HP",
  'Suma': 'Adds',
  '2 de escudo': '2 shield',
  'y cubre a tu Axie con un blindaje: lo que el próximo ataque rival deje pasar después del escudo te saca': "and covers your Axie with armor: whatever the rival's next attack gets past the shield takes",
  '12 de vida como máximo': 'at most 12 HP',
  'Blindaje anti-remates:': 'Anti-finisher armor:',
  'Aunque el rival conecte un golpe de 40 puntos, solo perderás 12 de vida.': 'Even if the rival lands a 40-point strike, you only lose 12 HP.',
  'Cada máscara extra suma 2 de escudo y baja el tope en -2 puntos (hasta un piso mínimo de 6).': 'Each extra mask adds 2 shield and lowers the cap by -2 (down to a minimum floor of 6).',
  'Consumo:': 'Consumption:',
  'El tope se gasta cuando un ataque rival pasa el escudo; el escudo dura hasta romperse.': 'The cap is spent when a rival attack gets past the shield; the shield lasts until broken.',
  'Tope de daño': 'Damage cap',
  'Acumulable (piso 6)': 'Stackable (min 6)',
  'Especial Neutral': 'Neutral Special',
  'Rocket Stamp (Free Game)': 'Rocket Stamp (Free Game)',
  'Es gratis: se pone sobre la carta que elijas': "It's free: it goes on the card of your choice",
  'Carta comodín neutral con 2 símbolos. Cuando sale de tu mazo': 'Neutral wildcard with 2 symbols. When drawn from your deck it',
  'no se encadena ni te corta': "doesn't join the chain and never busts you",
  ': la ponés sobre la columna de la mesa que elijas y le suma sus símbolos.': ': you place it on the column of your choice on the field, adding its symbols.',
  'Al salir del mazo:': 'When drawn:',
  'Nunca te corta: es una carta gratis.': "It never busts you: it's a free card.",
  'Efecto comodín:': 'Wildcard effect:',
  'Se monta sobre la columna que elijas de la mesa.': 'It stacks onto the column of your choice on the field.',
  'Salva cadenas:': 'Chain saver:',
  'Suma sus símbolos a esa carta para continuar o abrir rachas.': 'Adds its symbols to that card to continue or open chains.',
  'Comodín neutral': 'Neutral wildcard',
  'Gratis': 'Free',
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
  'Hojas activas (curan 4 al inicio del turno)': 'Active leaves (heal 4 at start of turn)',
  'Piel:': 'Mask:',
  'Tope de daño máximo activo': 'Active damage cap limit',

  // lobby.js
  '{current} de {total}': '{current} of {total}',
  'Mazo inicial · {count} cartas · {boosted} mejorada': 'Starter deck · {count} cards · {boosted} boosted',
  'Mazo inicial · {count} cartas · {boosted} mejoradas': 'Starter deck · {count} cards · {boosted} boosted',
  '{name}: {n} en el mazo': '{name}: {n} in deck',
  'Con este vas a jugar hasta que lo cambies.': 'You will play with this one until you change it.',
  'En uso': 'In use',
  'Con mejoras': 'Boosted',
  'Buscar': 'Search',
  'Ningún Axie coincide': 'No Axie matches',
  'Listo': 'Done',
  'Sacarle el {symbol} de más': 'Remove extra {symbol}',
  'Sumarle otro {symbol}': 'Add another {symbol}',
  'Sumarle uno de sus dos símbolos': 'Add one of its two symbols',
  'Nivel {n}': 'Level {n}',
  'Comodín': 'Wildcard',
  'Poderes nuevos': 'New powers',
  'Poderes en este nivel': 'Powers in this level',
  'Superado': 'Cleared',
  '{won} de {total} niveles superados': '{won} of {total} levels cleared',
  '{stars} estrellas · {won} de {total} niveles superados': '{stars} stars · {won} of {total} levels cleared',
  'Tu perfil': 'Your profile',
  'Te faltan {n} de experiencia para el nivel {next}': '{n} experience to level {next}',
  'Cada nivel superado da {a}; cada estrella, {b}.': 'Each level cleared gives {a}; each star, {b}.',
  'Niveles superados': 'Levels cleared',
  'Estrellas': 'Stars',
  'Experiencia total': 'Total experience',
  'Cartas en la mochila': 'Cards in backpack',
  'Cartas creadas': 'Cards crafted',
  'Los que más usás': 'Most used',
  'Todavía no terminaste ninguna partida.': "You haven't finished a match yet.",
  '1 partida': '1 match',
  '{n} partidas': '{n} matches',
  'Capítulo {n}': 'Chapter {n}',
  '{into} de {need} de experiencia': '{into} of {need} experience',
  'Nivel {n} · {into} de {need} de experiencia': 'Level {n} · {into} of {need} experience',
  'Con estrella': 'Starred',
  'Barajando el mazo': 'Shuffling the deck',
  '¡A pelear!': 'Fight!',
  'Ganale por K.O. para la estrella': 'Win by K.O. for the star',
  'con estrella': 'starred',
  'sin estrella': 'no star',
  '¡Estrella! Lo ganaste por K.O.': 'Star! You won by K.O.',
  'Sin estrella: ganale por K.O., sin dejarle última chance.': 'No star: win by K.O., without leaving a last chance.',
  'Rival': 'Rival',
  'Volver a Jugar': 'Play Again',
  'No disponible en esta versión': 'Not available in this version',
  'Switch to English': 'Switch to English',
  'Cambiar a español': 'Cambiar a español',
  ' y ': ' and ',

  // data.js
  'al pegar, +{gain} hojas (hasta {max}); al inicio de cada turno tuyo, cada hoja te cura {heal} y se gasta 1':
    'on hit, +{gain} leaves (up to {max}); at the start of each of your turns, each leaf heals {heal} and consumes 1',
  'al pegar, sumás un escudo de un tercio del golpe (mínimo 1); si el rival lo rompe, recibe {dmg} de daño por cada huevo':
    'on hit, add a shield of a third of the damage dealt (at least 1); if broken, the rival takes {dmg} damage per egg',
  'al pegar, te curás lo mismo que pegaste':
    'on hit, heal for the same amount of damage dealt',
  'al plantarte, le ponés {dose} de veneno al rival (se suma); al final de cada turno suyo le saca eso sin importar su escudo, y se reduce a la mitad':
    "when you stand, give the rival {dose} poison (stacks); at the end of each of their turns it bites through their shield and halves",
  'al pegar, el próximo ataque del rival hace la mitad de daño':
    "on hit, the rival's next attack deals half damage",
  'al pegar, +{step} de daño en ese ataque y en todos los que siguen':
    'on hit, +{step} damage on this attack and all future attacks',
  'al aparecer, +{step} permanente de daño':
    'when drawn, permanent +{step} damage',
  'al pegar, +{step} de daño por cada símbolo de tu racha más larga':
    'on hit, +{step} damage per symbol in your longest chain',
  'al pegar, le sacás {drain} de vida al rival y te los curás ':
    'on hit, steal {drain} HP from the rival and heal yourself ',
  'al pegar, le sacás {drain} de vida al rival y te los curás ({bonus} con {thresh} o más columnas en mesa)':
    'on hit, steal {drain} HP from the rival and heal yourself ({bonus} with {thresh} or more columns on field)',
  'en un ataque exitoso, robás {drain} de vida por cada Mantis Dagger en tu cadena':
    'on a successful attack, steal {drain} HP for each Mantis Dagger in your chain',
  'al pegar, sumás {shield} de escudo y el próximo golpe del rival te saca {cap} de vida como máximo':
    "on hit, add {shield} shield and the rival's next attack takes at most {cap} HP from you",
  '+{gain} hojas: cada una te cura {heal} por turno':
    '+{gain} leaves: each heals {heal} per turn',
  'Escudo de un tercio del golpe (mínimo 1); al romperse devuelve {dmg}':
    'Shield of a third of the attack (at least 1); on break returns {dmg}',
  'Una carta de más del centro': 'One extra card from the center',
  'Te curás lo que pegás': 'You heal what you hit',
  '{dose} de veneno que atraviesa el escudo': '{dose} poison that goes through shields',
  'El próximo ataque rival pega la mitad': 'Next rival attack deals half damage',
  '+{step} de daño para siempre': '+{step} permanent damage',
  '+{step} de daño por símbolo de tu mejor racha':
    '+{step} damage per symbol in your best run',
  'Tu carta del centro abre la próxima ronda':
    'Your card from the center opens the next round',
  '+{shield} de escudo; el próximo golpe rival te saca {cap} de vida como máximo':
    '+{shield} shield; next rival attack takes at most {cap} HP',
  'Poder': 'Power',
  'Cola': 'Tail',
  'Boca': 'Mouth',
  'Ojos': 'Eyes',
  'Orejas': 'Ears',
  'Cuerno': 'Horn',
  'Espalda': 'Back',
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
  'Se acabó el tiempo: atacás con lo que tenés.':
    'Time is up: you attack with what you have.',
  'Se acabó el tiempo: ataca con lo que tiene.':
    'Time is up: they attack with what they have.',
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
  'Turno de {name}': "{name}'s turn",
  'Compatibilidad': 'Compatibility',
  'Baja': 'Low',
  'Media': 'Medium',
  'Alta': 'High',
  'Tocá una carta para ver cuánto encadena con tu mazo.': 'Tap a card to see how well it chains with your deck.',
  'Compatibilidad con tu mazo: {pct}%': 'Compatibility with your deck: {pct}%',
  '{n} de tus cartas llevan {symbol}': '{n} of your cards carry {symbol}',
  'Soltás el ataque con {points}.': 'You unleash your attack with {points}.',
  '{who} suelta el ataque con {points}.': '{who} unleashes their attack with {points}.',
  'Dejás pasar la carta del pulpo.': 'You pass on the octopus card.',
  'Dejás pasar las {n} cartas del pulpo.': 'You pass on the {n} octopus cards.',
  '{who} deja pasar la carta del pulpo.': '{who} passes on the octopus card.',
  '{who} deja pasar las {n} cartas del pulpo.': '{who} passes on the {n} octopus cards.',
  'Te quedás con lo que ya agarraste.': 'You keep what you already took.',
  '{who} se queda con lo que ya agarró.': '{who} keeps what they already took.',
  'No te llevás nada del centro.': 'You take nothing from the center.',
  '{who} no se lleva nada del centro.': '{who} takes nothing from the center.',
  'Rocket Stamp gratis: elegí sobre qué carta ponerlo.': 'Free Rocket Stamp: choose which card to place it on.',
  'Rocket Stamp gratis: {who} elige sobre qué carta ponerlo.': 'Free Rocket Stamp: {who} picks which card to place it on.',
  'Abandonás la partida. Gana {winner}.': 'You forfeit the match. {winner} wins.',
  '{who} abandona la partida. Gana {winner}.': '{who} forfeits the match. {winner} wins.',
  'Vos vas a elegir una carta extra para tu mazo.':
    'You will choose 1 extra card for your deck.',
  '{who} va a elegir una carta extra para su mazo.':
    '{who} will choose 1 extra card for their deck.',
  'Vos vas a elegir {count} cartas extra para tu mazo.':
    'You will choose {count} extra cards for your deck.',
  '{who} va a elegir {count} cartas extra para tu mazo.':
    '{who} will choose {count} extra cards for their deck.',
  'Vos atrapás la apertura en una burbuja: la carta que elijas del centro abrirá tu próxima ronda.':
    'You trap the opener in a bubble: the card you choose from the center will open your next round.',
  '{who} atrapa la apertura en una burbuja: la carta que elijas del centro abrirá tu próxima ronda.':
    '{who} traps the opener in a bubble: the card chosen from the center will open the next round.',
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
  'Vos sumás +{gain} hojas (Leaf) ({leaf}/{max}): curará +{heal} de vida al inicio de tu próximo turno.':
    'You gain +{gain} leaves ({leaf}/{max}): will heal +{heal} HP at the start of your next turn.',
  '{who} suma +{gain} hojas (Leaf) ({leaf}/{max}): curará +{heal} de vida al inicio de su próximo turno.':
    '{who} gains +{gain} leaves ({leaf}/{max}): will heal +{heal} HP at the start of their next turn.',
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
  'Vos te ponés la Gecko Mask: +{shield} de escudo, y el próximo golpe rival te saca {cap} de vida como máximo.':
    "You put on the Gecko Mask: +{shield} shield, and the rival's next hit takes at most {cap} HP.",
  '{who} se pone la Gecko Mask: +{shield} de escudo, y el próximo golpe rival le saca {cap} de vida como máximo.':
    "{who} puts on the Gecko Mask: +{shield} shield, and the rival's next hit takes at most {cap} HP.",
  '+{str} de fuerza':
    '+{str} strength',
  '+{brutal} de Energy Drink':
    '+{brutal} Energy Drink',
  'partido al medio por el caracol':
    'halved by Lazy Snail',
  'Vos atacás por {swing}: {points} de cadena {mods}.':
    'You attack for {swing}: {points} chain {mods}.',
  '{who} ataca por {swing}: {points} de cadena {mods}.':
    '{who} attacks for {swing}: {points} chain {mods}.',
  'Tu Gecko Mask frena el golpe: mitiga {mitigated} de daño (tope máximo {cap}).':
    'Your Gecko Mask blocks the hit: mitigates {mitigated} damage (maximum cap {cap}).',
  'La Gecko Mask {owner} frena el golpe: mitiga {mitigated} de daño (tope máximo {cap}).':
    'Gecko Mask {owner} blocks the hit: mitigates {mitigated} damage (maximum cap {cap}).',
  ' y se rompe: la cáscara le devuelve {thorns} a vos':
    ' and breaks: the shell returns {thorns} to you',
  ' y se rompe: la cáscara le devuelve {thorns} {target}':
    ' and breaks: the shell returns {thorns} {target}',
  ' y se rompe':
    ' and breaks',
  ' y le quedan {egg}':
    ' and has {egg} left',
  'Tu escudo aguanta {blocked}{rest}.':
    'Your shield absorbs {blocked}{rest}.',
  'El escudo {owner} aguanta {blocked}{rest}.':
    'The shield {owner} absorbs {blocked}{rest}.',
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
  'Si te vas, la partida se termina ahí y <b>gana el otro</b>.':
    'If you leave, the match ends there and <b>the opponent wins</b>.',

  // ui.js
  'Alargar columna {n}': 'Extend column {n}',
  'Elegí una carta': 'Choose a card',
  'Confirmar selección': 'Confirm selection',
  'Carta para colocar': 'Card to place',
  'Elegí qué columna colocar': 'Choose which column to place',
  '{name} elige la columna': '{name} is choosing the column',
  'Carta de Free Game para colocar': 'Free Game card to place',
  'Free Game — Elegí qué columna colocar': 'Free Game — Choose which column to place',
  'Free Game — {name} elige la columna': 'Free Game — {name} is choosing the column',
  'sin cartas': 'no cards',
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
  '{name}: 1 hoja (cura +{heal} al inicio de tu turno y consume 1)':
    '{name}: 1 leaf (heals +{heal} at the start of your turn and consumes 1)',
  '{name}: {leaf} hojas (cura +{heal} al inicio de tu turno y consume 1)':
    '{name}: {leaf} leaves (heals +{heal} at the start of your turn and consumes 1)',
  '{name}: el próximo ataque rival te saca {cap} de vida como máximo':
    '{name}: next rival attack takes at most {cap} HP',
  'Escudo: aguanta {shield} de daño': 'Shield: absorbs {shield} damage',
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
  'Nivel': 'Level',
  '¡Victoria!': 'Victory!',
  // La pantalla del final (result.js).
  'Derrota': 'Defeat',
  '¡Empate!': 'Draw!',
  '¡Gana {name}!': '{name} wins!',
  '¡Nivel superado!': 'Level cleared!',
  'Contra la CPU · {level}': 'Vs CPU · {level}',
  'Aventura · {name}': 'Adventure · {name}',
  'Partida en red': 'Online match',
  '{name} quedó fuera de combate en la ronda {round}.': '{name} was knocked out in round {round}.',
  '{name} te ganó en la ronda {round}.': '{name} beat you in round {round}.',
  'Doble KO en la ronda {round}.': 'Double KO in round {round}.',
  'Daño hecho': 'Damage dealt',
  'Mejor golpe': 'Best hit',
  'Cadena más larga': 'Longest chain',
  'Rondas': 'Rounds',
  'Botín': 'Loot',
  'Ver la mesa': 'View table',
  'Ver resultado': 'View result',
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
  'Vos no te podés curar en la última chance: la maceta no cura nada.':
    "You can't heal during your Last Chance: the pot heals nothing.",
  '{who} no se puede curar en la última chance: la maceta no cura nada.':
    "{who} can't heal during a Last Chance: the pot heals nothing.",
  'Overkill: te pegaron {extra} de más y no tenés última chance.':
    'Overkill: you took {extra} too much and get no Last Chance.',
  'Overkill: {who} recibió {extra} de más y no tiene última chance.':
    'Overkill: {who} took {extra} too much and gets no Last Chance.',
  '¿Una más? Estás a una carta del K.O. directo.': 'One more? You are one card away from a straight K.O.',
  '¿Una más? {who} está a una carta del K.O. directo.': 'One more? {who} is one card away from a straight K.O.',
  '¡Una más y K.O. directo! Atacás con {points}.': 'One more, and a straight K.O.! You attack with {points}.',
  '¡Una más y K.O. directo! {who} ataca con {points}.': 'One more, and a straight K.O.! {who} attacks with {points}.',
  'Última chance de la CPU: si te deja sin vida, empatan.':
    "CPU's Last Chance: if it leaves you with no HP, it's a draw.",
  'La CPU está cargando su ataque…': 'The CPU is charging its attack…',
  '{at}última chance: si te deja sin vida, empatan.':
    '{at}last chance: if it leaves you with no HP, it\'s a draw.',
  '{at}está cargando su ataque…': '{at}is charging their attack…',
  'Robar carta': 'Draw card',
  'Atacar': 'Attack',
  '✨ Elegí la columna donde colocar {card}':
    '✨ Choose the column to place {card}',
  '✨ Robando carta automáticamente…':
    '✨ Drawing card automatically…',
  '✨ Free Game: elegí la columna donde colocar {card}':
    '✨ Free Game: choose the column to place {card}',
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
  'Tocá tu Axie: es tu mazo': 'Tap your Axie: your deck',
  'Tocá tu Axie: sumaste el cohete': 'Tap your Axie: rocket inside',
  'Sumala a tu cadena': 'Add it to your chain',
  'Reviví la cadena: 2ª carta': 'Revive the chain: 2nd card',
  '¡Rematalo!': 'Finish it!',
  '¡TUTORIAL COMPLETADO!': 'TUTORIAL COMPLETE!',
  'Ir a modo Aventura': 'Go to Adventure mode',
  'Salir del tutorial': 'Exit tutorial',
  'Salir ✕': 'Exit ✕',

  // adventure-levels.js
  'Aprendé lo básico: sumá fuerza, curate con la maceta y montá cartas con Free Game. Si te dejan en 0, te queda un último golpe, pero ahí ya no te podés curar.':
    "Learn the basics: build strength, heal with the pot and stack cards with Free Game. If you drop to 0 you get one last strike, but you can't heal anymore.",
  'Nivel 2: Defensa y Estrategia': 'Level 2: Defense and Strategy',
  'El combate se intensifica. Juntá escudo con el Secret Egg (cada huevo suma el suyo y su cáscara) y partí al medio el golpe rival con el Lazy Snail.':
    "Combat intensifies. Build shield with Secret Egg (each egg adds its own shield and shell) and halve the rival's attack with Lazy Snail.",
  'Nivel 3: El Arte del Mercado': 'Level 3: The Art of the Market',
  'Los 6 poderes clásicos se completan. Llevate cartas extra con el Sticky Octopus y envenená con el Poison Vial: 6 por frasco, y muerde a través del escudo.':
    'The 6 classic powers are complete. Grab extra cards with Sticky Octopus and poison with Poison Vial: 6 per vial, and it bites through shields.',
  'Nivel 4: Furia de la Naturaleza': 'Level 4: Nature\'s Fury',
  'Rachas largas y cura lenta: la Energy Drink suma +3 por cada símbolo de tu mejor racha, y el Spring Leaf te cura al empezar cada turno.':
    'Long chains and slow healing: Energy Drink adds +3 per symbol of your best chain, and Spring Leaf heals you at the start of each turn.',
  'Nivel 5: Sombras y Vuelo': 'Level 5: Shadows and Flight',
  'Daño que no se puede frenar: el Feather Earring pega apenas sale del mazo y la Mantis Dagger le roba vida al rival.':
    "Damage you can't stop: Feather Earring hits as soon as it's drawn and Mantis Dagger steals the rival's life.",
  'Nivel 6: Duelo de Maestros': 'Level 6: Duel of Masters',
  'El desafío final: Bubble Paste elige tu apertura y la Gecko Mask suma escudo y topea el golpe que te llega. Cuidado con el overkill: si te pegan más de 30 pasado el cero, no hay última chance.':
    "The final challenge: Bubble Paste picks your opening and Gecko Mask adds shield and caps the hit you take. Beware overkill: take more than 30 past zero and there's no last chance.",

  // index.html (enciclopedia)
  'Hoja': 'Leaf',
  'Fuerza': 'Strength',
  'Veneno': 'Poison',
  'Blindaje': 'Armor',
  '+3 de daño por cada símbolo de tu cadena más larga':
    '+3 damage per symbol in your longest chain',

  // index.html — Modal de visión del producto
  // ── Visión del producto ───────────────────────────────────────────────────
  'Visión del producto': 'Product Vision',
  'Axie Infinity Vibeathon · Web, sin instalar nada · 3–4 minutos por partida':
    'Axie Infinity Vibeathon · Web, nothing to install · 3–4 minutes per match',

  '1 · El pitch en una línea': '1 · The pitch in one line',
  'Encadená símbolos mientras te animes. Cada carta que robás hace tu golpe más grande; una sola carta que no conecta te lo borra entero. Eso es todo lo que hay que entender para jugar, y es todo lo que hace falta para no poder parar.':
    'Chain symbols for as long as you dare. Every card you draw makes your hit bigger; a single card that does not connect wipes it out entirely. That is everything you need to understand to play, and everything it takes to be unable to stop.',

  '2 · Por qué existe: una categoría nueva': '2 · Why it exists: a new category',
  'Los juegos competitivos de Ronin piden lo mismo de entrada: aprender un árbol de habilidades, memorizar un meta de cartas, entender una economía antes de divertirse. Son juegos excelentes para el que ya está adentro.':
    'Competitive games on Ronin all ask for the same thing up front: learn a skill tree, memorize a card meta, understand an economy before you get to have fun. They are excellent games for whoever is already inside.',
  'Axie Chance apunta al otro lado del embudo. Su mecánica es tan simple que se explica en una frase y se entiende en un turno, pero la decisión que propone —¿robo una más o me planto?— es la misma que sostiene a los juegos de mesa más adictivos de la historia. Esa combinación abre una categoría que el ecosistema todavía no tiene:':
    'Axie Chance aims at the other end of the funnel. Its mechanic is so simple it explains itself in one sentence and clicks in a single turn, yet the decision it poses —draw one more, or stand?— is the same one that carries the most addictive board games ever made. That combination opens a category the ecosystem does not have yet:',
  'Casual de verdad.': 'Genuinely casual.',
  'Sin tutorial de veinte minutos, sin glosario, sin wallet para empezar. Se abre un link y se juega.':
    'No twenty-minute tutorial, no glossary, no wallet to get started. Open a link and play.',
  'Tensión inmediata y visible.': 'Instant, visible tension.',
  'El suspenso no requiere contexto: cualquiera que mire la pantalla entiende que esa próxima carta puede valer todo o nada. Es el formato ideal para streaming, clips cortos y para jugar al lado de alguien.':
    'The suspense needs no context: anyone watching the screen understands that the next card could be worth everything or nothing. It is the ideal format for streaming, short clips, and playing next to someone.',
  'Sesiones de bolsillo.': 'Pocket-sized sessions.',
  'Tres minutos. Entra en la cola del supermercado y entra en un torneo.':
    'Three minutes. It fits in a supermarket queue and it fits in a tournament.',
  'Puerta de entrada al universo Axie.': 'A front door into the Axie universe.',
  'El jugador conoce las seis clases, sus fortalezas y su anatomía jugando, no leyendo una wiki. Cuando llegue a los juegos más profundos de Ronin, ya va a hablar el idioma.':
    'Players learn the six classes, their strengths and their anatomy by playing, not by reading a wiki. By the time they reach the deeper games on Ronin, they already speak the language.',
  'Es el juego que un jugador de Axie le pasa a un amigo que nunca tocó Axie.':
    'This is the game an Axie player hands to a friend who has never touched Axie.',

  '3 · El corazón del juego': '3 · The heart of the game',
  'La decisión': 'The decision',
  'En tu turno robás de tu mazo personal. La primera carta abre una o más cadenas (una por cada símbolo que trae). Cada carta siguiente tiene que compartir al menos un símbolo con alguna cadena viva: si lo hace, la alarga. Si no comparte ninguno con ninguna cadena viva, se corta la cadena y tu ataque de esa ronda vale 0.':
    'On your turn you draw from your personal deck. The first card opens one or more chains (one per symbol it carries). Every card after that has to share at least one symbol with a live chain: if it does, it extends it. If it shares none with any live chain, the chain breaks and your attack that round is worth 0.',
  'En cualquier momento podés plantarte y descargar el daño acumulado sobre el Axie rival.':
    'At any moment you can stand and unload the damage you have piled up onto the rival Axie.',
  'Eso es el juego entero. Dos botones: robar o plantarse.':
    'That is the whole game. Two buttons: draw or stand.',

  'Por qué es divertido': 'Why it is fun',
  'El daño es cuadrático, no lineal.': 'Damage is quadratic, not linear.',
  'Una racha de 2 vale 4, una de 3 vale 9, una de 4 vale 16. Cada carta extra vale mucho más que la anterior, así que el juego te empuja permanentemente hacia adelante mientras el riesgo crece a la par. No es una decisión matemática fría: es una tentación.':
    'A run of 2 is worth 4, a run of 3 is worth 9, a run of 4 is worth 16. Every extra card is worth far more than the last, so the game keeps pushing you forward while the risk climbs right alongside it. It is not a cold math problem: it is a temptation.',
  'La codicia tiene forma visible.': 'Greed has a visible shape.',
  'La rueda de probabilidades te dice, carta a carta, qué chance real tenés de seguir vivo. Se pinta de verde a rojo delante tuyo. Nadie se corta "por mala suerte": se corta porque decidió ir por una más con el 40% en la cara.':
    'The odds dial tells you, card by card, the real chance you have of staying alive. It turns from green to red right in front of you. Nobody busts "out of bad luck": they bust because they chose to go for one more with 40% staring back.',
  'Cada turno es una historia con final.': 'Every turn is a story with an ending.',
  'Salís con una racha corta y segura, o vas por la cadena de cinco y volvés con 25 de daño y las manos temblando, o te cortás en la última y no te llevás nada. Tres minutos de partida son diez historias así.':
    'You walk away with a short, safe run, or you go for the chain of five and come back with 25 damage and shaking hands, or you bust on the last card and take nothing. A three-minute match is ten stories like that.',
  'Las rachas múltiples dan profundidad sin dar complejidad.': 'Parallel runs add depth without adding complexity.',
  'Una carta de apertura con tres símbolos abre tres caminos en paralelo; los que no conectan quedan congelados, guardando lo que ya ganaron. El jugador nuevo ve "muchas chances de seguir". El jugador experto ve un árbol de decisiones. Los dos están jugando bien.':
    'An opening card with three symbols opens three paths at once; the ones that do not connect freeze, keeping what they already earned. The new player sees "lots of chances to keep going". The expert sees a decision tree. Both of them are playing it right.',
  'Tu mazo cambia mientras jugás.': 'Your deck changes while you play.',
  'Al terminar cada turno elegís del mercado central —seis cartas boca arriba, compartidas— y lo que elegís se baraja en tu mazo al instante. Un ataque exitoso te deja llevarte una carta con poder o dos cartas simples; un bust te deja una simple, para que la partida perdida nunca sea una partida muerta. Nadie queda fuera de la remontada.':
    'At the end of each turn you pick from the central market —six face-up cards, shared— and whatever you take is shuffled into your deck immediately. A successful attack lets you take one power card or two plain ones; a bust still leaves you one plain card, so a losing match is never a dead match. Nobody is locked out of the comeback.',
  'Los poderes son personajes, no estadísticas.': 'The powers are characters, not stats.',
  'El frasco de veneno que se revolea, el huevo que rebota y te deja un escudo que contraataca al romperse, el caracol que frena el próximo golpe rival a la mitad, la bebida energética que se vuelca sobre el número de daño y lo hace subir contando. Doce poderes de clase, seis activos por partida —uno por clase—, cada uno con su gesto, su sonido y su momento. El jugador no aprende una tabla: se acuerda del pulpo.':
    "The poison vial that gets hurled, the egg that bounces in and leaves a shield that strikes back when it cracks, the snail that cuts the rival's next hit in half, the energy drink that spills over the damage number and makes it count upward. Twelve class powers, six live per match —one per class—, each with its own gesture, sound and moment. Players do not learn a table: they remember the octopus.",
  'El final tiene un último aliento.': 'The ending has one last breath.',
  'Quien queda en 0 HP recibe una Última Chance: un turno más, con halo de fuego, para llevarse al rival puesto. Si lo logra, la partida termina en empate. Muchas partidas se deciden ahí, y todas las que se deciden ahí se cuentan después.':
    'Whoever drops to 0 HP gets a Last Chance: one more turn, wreathed in fire, to take the rival down with them. If they pull it off, the match ends in a draw. Plenty of matches are decided right there, and every one of them gets retold afterwards.',
  'El reloj mantiene el pulso.': 'The clock keeps the pulse.',
  '30 segundos para decidir, 20 por elección en el mercado. Nunca hay tiempo muerto, nunca hay parálisis por análisis.':
    '30 seconds to decide, 20 per market pick. There is never dead time, and never analysis paralysis.',

  '4 · Tu Axie es tu mazo': '4 · Your Axie is your deck',
  'La integración con Axie Core no es un skin ni una ventaja comprada: es matemática de consistencia. Cada Axie entra a la arena con un mazo de 8 cartas derivado de su genética:':
    'The Axie Core integration is not a skin and it is not a bought advantage: it is consistency math. Every Axie walks into the arena with an 8-card deck derived from its genetics:',
  '6 cartas favorables': '6 favorable cards',
  ', una por cada parte anatómica —Ojos, Orejas, Cuernos, Boca, Espalda, Cola—, todas con el símbolo de su clase base más un símbolo secundario que depende de la parte.':
    ', one per body part —Eyes, Ears, Horn, Mouth, Back, Tail—, each carrying its base class symbol plus a secondary symbol set by that part.',
  '2 cartas desfavorables': '2 unfavorable cards',
  ', una por cada tríada rival de piedra-papel-tijera: la que vencés y la que te vence. No comparten ningún símbolo, así que ninguno te asegura la cadena: aunque evoluciones todas tus partes, siempre queda una carta que te corta.':
    ", one per rival rock-paper-scissors triad: the one you beat and the one that beats you. They share no symbol, so none of them guarantees your chain: even with every part evolved, one card can still cut you.",
  'Part Evolution como reductor de varianza.': 'Part Evolution as a variance reducer.',
  'Evolucionar una parte on-chain agrega un tercer símbolo a la carta de esa parte. Eso no sube el daño directamente: multiplica las formas de conectar. Más conexiones significan menos cortes, cadenas más largas y la libertad de jugar más agresivo. La evolución no necesariamente te hace pegar más fuerte; te hace animarte más.':
    "Evolving a part on-chain adds a third symbol to that part's card. It does not raise your damage directly: it multiplies your ways to connect. More connections mean fewer busts, longer chains and the freedom to play more aggressively. Evolution does not necessarily make you hit harder; it makes you braver.",
  'El flywheel con Ronin': 'The Ronin flywheel',
  'Jugás': 'Play',
  'y ganás AXP según el largo de tus cadenas y el daño ejecutado.':
    'and earn AXP based on the length of your chains and the damage you land.',
  'Evolucionás': 'Evolve',
  'partes on-chain en App.Axie con ese AXP.': 'parts on-chain on App.Axie with that AXP.',
  'Optimizás': 'Optimize',
  ': la parte evolucionada vuelve como una carta mejor en tu mazo inicial.':
    ': the evolved part comes back as a better card in your starting deck.',
  'Coleccionás y criás': 'Collect and breed',
  'buscando combinaciones anatómicas con sinergia real en el mercado central.':
    'hunting for anatomy combinations with real synergy in the central market.',

  '5 · Amuletos que se craftean y se gastan': '5 · Amulets you craft and spend',
  'La progresión a mediano plazo tiene un solo objetivo de diseño: darle al jugador cosas para fabricar sin romper la tensión de la mesa.':
    'Mid-term progression has a single design goal: give players things to craft without breaking the tension at the table.',
  'Amuletos con vencimiento.': 'Amulets that expire.',
  'Los poderes van a poder craftearse como amuletos de uso limitado: duran una cantidad de partidas, de rondas o de activaciones, y después se consumen. Se fabrican con lo que se gana jugando, se equipan antes del duelo y se sienten mientras duran.':
    'Powers will be craftable as limited-use amulets: they last a number of matches, rounds or activations, and then they are spent. You build them with what you earn by playing, equip them before the duel, and feel them for as long as they last.',
  'Por qué expiran:': 'Why they expire:',
  'Mantienen la economía viva.': 'They keep the economy alive.',
  'Hay siempre algo que fabricar, algo que gastar y una razón para volver a jugar mañana.':
    'There is always something to craft, something to spend and a reason to come back tomorrow.',
  'Evitan el mazo definitivo.': 'They prevent the final build.',
  'Nadie llega a una configuración óptima permanente que congele el meta. Cada temporada el arsenal se renueva porque el arsenal se termina.':
    'Nobody reaches a permanent optimal setup that freezes the meta. Every season the arsenal renews itself, because the arsenal runs out.',
  'Hacen que equiparlos sea una decisión.': 'They make equipping a real decision.',
  'Usar el amuleto bueno hoy, en esta partida, contra este rival, tiene peso. Guardarlo también.':
    'Spending the good amulet today, in this match, against this rival, carries weight. So does saving it.',
  'Premian jugar, no acumular.': 'They reward playing, not hoarding.',
  'El que juega mucho tiene el taller lleno; el que compró una vez, no.':
    'Whoever plays a lot has a full workshop; whoever bought once does not.',

  '6 · La promesa: siempre hay una chance': '6 · The promise: there is always a chance',
  'Este es el pilar de diseño que sostiene todo lo anterior.':
    'This is the design pillar holding up everything above.',
  'Incluso con todo maximizado, podés perder.': 'Even fully maxed out, you can lose.',
  'Un jugador con cada parte evolucionada, el mejor mazo y los amuletos más caros equipados sigue estando a una carta de cortarse. Las mejoras mueven la probabilidad, jamás la eliminan. El techo del juego no es la certeza: es una chance muy buena.':
    'A player with every part evolved, the best deck and the most expensive amulets equipped is still one card away from busting. Upgrades move the probability; they never remove it. The ceiling of this game is not certainty: it is a very good chance.',
  'Esto vale por tres razones, y las tres son comerciales tanto como de diseño:':
    'This matters for three reasons, and all three are commercial as much as they are design:',
  'El novato nunca está fuera de la pelea.': 'The newcomer is never out of the fight.',
  'El que abrió el juego hace diez minutos puede ganarle al veterano, y va a volver a intentarlo. No hay muro de entrada que desaliente.':
    'Someone who opened the game ten minutes ago can beat the veteran, and will come back to try again. There is no wall at the entrance to discourage them.',
  'El veterano nunca se aburre.': 'The veteran is never bored.',
  'Su ventaja es real y se siente en cada racha larga, pero tiene que seguir jugando bien. La tensión no se compra.':
    'Their edge is real and it shows in every long run, but they still have to play well. Tension is not for sale.',
  'Ganar siempre significa algo.': 'Winning always means something.',
  'Cuando la victoria no está garantizada, la victoria se celebra. Ese es el clip que se comparte.':
    'When victory is not guaranteed, victory gets celebrated. That is the clip people share.',
  'En Axie Chance la suerte no es lo que te pasa: es lo que decidís tentar. Y siempre, siempre, hay una chance.':
    'In Axie Chance luck is not what happens to you: it is what you choose to push. And there is always, always a chance.',

  '7 · Fricción cero, camino claro a Web3': '7 · Zero friction, a clear road to Web3',
  'Se abre y se juega.': 'Open it and play.',
  'HTML5 y JavaScript nativo, sin instalación, sin wallet, sin firmar nada para la primera partida.':
    'Native HTML5 and JavaScript, no install, no wallet, nothing to sign for the first match.',
  'Se aprende jugando.': 'You learn by playing.',
  'Un tutorial de cinco rondas jugables, sin modales ni paredes de texto: una flecha, un brillo y la partida siguiendo adelante.':
    'A tutorial of five playable rounds, with no modals and no walls of text: an arrow, a glow, and the match carrying on.',
  'Se juega solo o acompañado.': 'Play alone or together.',
  'Campaña por niveles contra los starters de Origins, duelos contra una CPU con dificultad elegible, y partidas online 1v1 por sala con código y QR —le mandás un link a un amigo de cualquier país y están jugando.':
    'A level campaign against the Origins starters, duels against a CPU at the difficulty you choose, and online 1v1 matches in a room with a code and a QR —send a friend in any country a link and you are playing.',
  'La conversión es un paso, no un salto.': 'Conversion is a step, not a leap.',
  'Conectando Ronin Waypoint, el juego lee la metadata del Axie y sus Part Evolutions y arma el mazo personalizado solo. El jugador no cambia de juego: el mismo juego se vuelve suyo.':
    "Connect Ronin Waypoint and the game reads the Axie's metadata and its Part Evolutions and builds the personalized deck on its own. The player does not switch games: the same game becomes theirs.",

  '8 · Hacia dónde va': '8 · Where it is headed',
  'Integración on-chain.': 'On-chain integration.',
  'Ronin Waypoint y Axie Core API para leer genes y Part Evolutions reales, asignación procedimental de las seis cartas anatómicas según el Axie conectado, y acreditación real de AXP contra el endpoint oficial de Sky Mavis.':
    'Ronin Waypoint and the Axie Core API to read real genes and Part Evolutions, procedural assignment of the six anatomy cards from the connected Axie, and real AXP accreditation against the official Sky Mavis endpoint.',
  'Taller de amuletos.': 'The amulet workshop.',
  'Crafteo de amuletos con vencimiento y de mejoras de mazo, con su economía de materiales alimentada por jugar.':
    'Crafting expiring amulets and deck upgrades, with a materials economy fed by playing.',
  'Competencia.': 'Competition.',
  'Matchmaking en tiempo real, temporadas con leaderboards y modo King of the Hill.':
    'Real-time matchmaking, seasons with leaderboards and a King of the Hill mode.',
  'Coleccionismo visible.': 'Collecting you can see.',
  'Soporte cosmético para Axies Mystic, Origin y Shiny con auras y efectos de ataque exclusivos: lo raro se tiene que ver en la mesa.':
    'Cosmetic support for Mystic, Origin and Shiny Axies with exclusive auras and attack effects: rare has to look rare on the table.',

  '9 · Para quién es': '9 · Who it is for',
  'Jugadores casuales y móviles': 'Casual and mobile players',
  'que quieren partidas cortas, intensas y que se entiendan solas.':
    'who want short, intense matches that explain themselves.',
  'Holders y coleccionistas de Axie': 'Axie holders and collectors',
  'que por primera vez ven el impacto de sus Part Evolutions traducido a algo que se siente turno a turno.':
    'who for the first time see their Part Evolutions translated into something they feel turn by turn.',
  'Creadores de contenido y audiencias de streaming': 'Content creators and streaming audiences',
  ': tensión legible, suerte visible, remontadas épicas y clips de treinta segundos que se explican solos.':
    ': readable tension, visible luck, epic comebacks and thirty-second clips that need no setup.',
  'Todo el que todavía no entró al ecosistema': 'Everyone who has not entered the ecosystem yet',
  'y necesita una primera puerta que no pida nada a cambio.':
    'and needs a first door that asks for nothing in return.',

  // trailer.html / trailer.js — el tráiler
  'Axie Chance — Tráiler': 'Axie Chance — Trailer',
  'Ver el tráiler': 'Watch the trailer',
  'Repetir': 'Replay',
  'Silencio': 'Muted',
  'En un mundo': 'In a world',
  'de criaturas adorables…': 'of adorable creatures…',
  'alguien tiene que tomar malas decisiones.': 'somebody has to make bad decisions.',
  'Encadenás símbolos.': 'You chain symbols.',
  'Cuanto más larga, más duele.': 'The longer the chain, the more it hurts.',
  'Fácil.': 'Easy.',
  '¿Una más?': 'One more?',
  '¿…una más?': '…one more?',
  'Sí.': 'Yes.',
  'Cero.': 'Zero.',
  'Absolutamente cero.': 'Absolutely zero.',
  'Siete cartas. Cero de daño.': 'Seven cards. Zero damage.',
  'Por suerte tenés con qué defenderte.': 'Luckily, you are armed.',
  'Un amuleto de poder. Bien.': 'A charm of power. Good.',
  'Un frasco de veneno. Clásico.': 'A vial of poison. Classic.',
  'Una daga. Ahora sí.': 'A dagger. Now we are talking.',
  'Un… huevo.': 'An… egg.',
  'Una máscara de gecko.': 'A gecko mask.',
  'Una lata de energizante.': 'A can of energy drink.',
  'Jabón.': 'Soap.',
  'Un pulpo. Pegajoso.': 'An octopus. Sticky.',
  'Una maceta.': 'A flower pot.',
  'Una hoja. Sola.': 'A leaf. One leaf.',
  'Un arito de plumas: 5 de daño.': 'A feather earring: 5 damage.',
  'Una calcomanía de cohete.': 'A rocket sticker.',
  'Y un caracol perezoso.': 'And a lazy snail.',
  'Trece armas letales.': 'Thirteen lethal weapons.',
  '…más o menos.': '…more or less.',
  'Tu mejor golpe de la partida.': 'Your best hit of the match.',
  'Un caracol.': 'A snail.',
  'Perezoso.': 'Lazy.',
  'Los dos en cero.': 'Both at zero.',
  'Los dos con un golpe más.': 'Both with one hit left.',
  'Empate': 'Draw',
  'Nadie ganó.': 'Nobody won.',
  'Los dos perdimos.': 'We both lost.',
  'Encadená mientras te animes.': 'Chain as far as you dare.',
  'Clasificada P: por decisiones cuestionables':
    'Rated Q: for questionable decisions',
  'Contiene codicia, un caracol y mucho cero.':
    'Contains greed, a snail and a whole lot of zero.',
  'Gratis, en el navegador.': 'Free, in your browser.',
  'En un mundo de criaturas adorables…': 'In a world of adorable creatures…',
  '…alguien tiene que tomar malas decisiones.': '…somebody has to make bad decisions.',
  'Cuanto más larga la cadena, más fuerte el golpe.': 'The longer the chain, the harder the hit.',
  'Cuanto más larga, más fuerte el golpe.': 'Longer chain, harder hit.',
  'Y entonces aparece la pregunta.': 'And then the question shows up.',
  'Por suerte, estás armado.': 'Luckily, you are armed.',
  'Un amuleto. Un veneno. Una daga. Un huevo. Una máscara de gecko. Una lata de energizante. Jabón. Un pulpo. Una maceta. Una hoja. Un arito de plumas. Una calcomanía de cohete. Y un caracol perezoso.': 'A charm. A poison. A dagger. An egg. A gecko mask. A can of energy drink. Soap. An octopus. A flower pot. A leaf. A feather earring. A rocket sticker. And a lazy snail.',
  'Contra un caracol perezoso.': 'Against a lazy snail.',
  'Los dos en cero. Los dos con un golpe más.': 'Both at zero. Both with one hit left.',
  'Axie Chance. Encadená mientras te animes.': 'Axie Chance. Chain as far as you dare.',
  'Cada carta comparte un símbolo.': 'Every card shares a symbol.',
  'La que sigue la racha, la alarga.': 'The one that follows the run extends it.',
  'Al cuadrado.': 'Squared.',
  '¡RACHA x{n}!': 'RUN x{n}!',
  '¡RACHA x{n}! ¡IMPARABLE!': 'RUN x{n}! UNSTOPPABLE!',
  '¿una más?': 'one more?',
  '¿UNA MÁS?': 'ONE MORE?',
  '¡A UNA DEL K.O.!': 'ONE AWAY FROM K.O.!',
  'A {n} DEL K.O.': '{n} AWAY FROM K.O.',
  'QUEDA CON ÚLTIMA CHANCE': 'SURVIVES ON LAST CHANCE',
  '...': '...',
  '70 segundos. Con sonido queda mejor.': '70 seconds. Better with sound.',
  // Los carteles grandes de la mesa (ver `bigWord` en `table-fx.js`).
  '¡K.O.!': 'K.O.!',
  '¡SE CORTÓ!': 'BUSTED!',
  '¿UNA MÁS?': 'ONE MORE?',
  '¡A UNA DEL K.O.!': 'ONE AWAY FROM K.O.!',
  'A {n} DEL K.O.': '{n} AWAY FROM K.O.',
  'QUEDA CON ÚLTIMA CHANCE': 'SURVIVES ON LAST CHANCE',
  // La ficha del selector de Axies: la barra de lo que trae el mazo.
  'Símbolos del mazo': 'Deck symbols',
  // La zona de testeo (`?testeo`, ver `sandbox.js`).
  'Zona de testeo': 'Test zone',
  'Volver al juego': 'Back to the game',
  // El modo libre (`?libre`, ver `free-play.js`).
  'Modo libre': 'Free mode',
  'Mapa abierto, Axies en nivel 60 y Moonshards y llaves sin fin. Se guarda aparte: tu partida de verdad no cambia.': 'Map unlocked, Axies at level 60 and endless Moonshards and keys. Saved separately: your real progress is untouched.',
  'Probar poderes y animaciones': 'Test powers and animations',
  'Llenar la mochila': 'Fill the backpack',
  'Deshacer evoluciones': 'Undo evolutions',
  'Reiniciar la Aventura': 'Reset the Adventure',
  'Borrar todo el modo libre': 'Wipe free mode',
  'Salir del modo libre': 'Leave free mode',
  '¿Borrar todo lo guardado en el modo libre?': 'Wipe everything saved in free mode?',
  'Devuelve': 'Returns',
  'Caracol': 'Snail',
  'Hojas': 'Leaves',
  'Máscara': 'Mask',
  'Burbujas': 'Bubbles',
  'Pulpo': 'Octopus',
  'al robar': 'on draw',
  'al plantarse': 'on stand',
  'al pegar': 'on hit',
  'carta extra': 'extra card',
  'atrapa': 'traps',
  'abre la ronda': 'opens the round',
  'turno': 'turn',
  'frena': 'slows',
  'bloquea': 'blocks',
  'Sin poder': 'No power',
  'Vida': 'HP',
  'Llena': 'Full',
  'Carta': 'Card',
  'Para quién': 'For whom',
  'Símbolos': 'Symbols',
  'Queda en el mazo después de salir': 'Stays in the deck after it comes out',
  'Robar esta': 'Draw this one',
  'Arriba del mazo': 'On top of the deck',
  'Al centro': 'To the market',
  'Próximos robos': 'Next draws',
  'Vida y estados': 'HP and statuses',
  'Animaciones de los poderes': 'Power animations',
  'Solo la animación, sobre el asiento elegido arriba: no cambia la partida.': 'Animation only, on the seat picked above: the match does not change.',
  'Partida': 'Match',
  'Nueva partida': 'New match',
  'Sin reloj y con todos los poderes en la reserva.': 'No clock, and every power in the pool.',
  'Elegí al menos un símbolo.': 'Pick at least one symbol.',
  'Sacar': 'Remove',
  'Nada: sale lo que diga el mazo.': 'Nothing: the deck decides.',

  // Los poderes por clase (data.js): notas y carteles
  '+1 pluma: +{step} de daño y de vida en tu próximo golpe': '+1 feather: +{step} damage and HP on your next hit',
  'El rival pierde {n} de escudo': 'The rival loses {n} shield',
  '+1 burbuja: con {at}, bomba de {dmg}': '+1 bubble: at {at}, a {dmg} bomb',
  'El rival elige a ciegas y sin renovar': 'The rival picks blind and cannot renew',
  'El rival no puede llevarse poderes': 'The rival cannot take powers',
  '+{n} de sangrado al rival': '+{n} bleed on the rival',
  '+1 garra: cada golpe tuyo, +{bleed} de sangrado': '+1 claw: each of your hits, +{bleed} bleed',
  'Herida abierta: su próximo turno el sangrado no baja': 'Open wound: their bleed does not drop next turn',
  'Te curás {heal}': 'You heal {heal}',
  '+{turns} turnos: te curás {heal} al empezar cada uno': '+{turns} turns: heal {heal} at the start of each',
  '+{shield} de escudo y 1 Limpiador': '+{shield} shield and 1 Cleanser',
  'Te limpia y te cura {heal}': 'Cleanses you and heals {heal}',
  'El próximo golpe rival te saca {cap} como máximo': 'The rival’s next hit takes {cap} at most',
  'En el próximo ataque rival no cuenta su mejor racha': 'The rival’s best run does not count on their next attack',
  '+{turns} turnos: {shield} de escudo al empezar cada uno': '+{turns} turns: {shield} shield at the start of each turn',
  'Le robás {n} de escudo (o ganás {m})': 'Steal {n} shield (or gain {m})',
  'Apagás el poder de una carta del rival': 'Turn off the power of a rival card',
  '+{n} espinas: el que te pega las recibe': '+{n} spikes: whoever hits you takes them',
  '+{dose} de veneno que atraviesa el escudo': '+{dose} poison that goes through shield',
  'La próxima cura o escudo del rival no entra': 'The rival’s next heal or shield is blocked',
  'El que te pega se lleva {n} de veneno': 'Whoever hits you takes {n} poison',

  // Los poderes en la partida (game.js)
  '{power} sale apagado: esta vez no actúa.': '{power} comes out turned off: it does nothing this time.',
  'Sangrado: −{dmg} de vida {target} (queda en {hp}).': 'Bleed: −{dmg} HP {target} (left at {hp}).',
  'Secret Egg: {card} cortaba, pero el huevo se rompe y la carta vuelve al mazo. Sigue el turno.':
    'Secret Egg: {card} would bust, but the egg breaks and the card goes back into the deck. The turn goes on.',
  'Charm of Power: {claws} de {max} garras. Cada golpe que conecte pone {bleed} de sangrado.': 'Charm of Power: {claws} of {max} claws. Each hit that lands puts {bleed} bleed.',
  'Feather Fan: {feathers} plumas para el próximo golpe.': 'Feather Fan: {feathers} feathers for the next hit.',
  'Flamingo Hammer: −{lost} de escudo {target}.': 'Flamingo Hammer: −{lost} shield {target}.',
  'Flamingo Hammer: no había escudo que romper.': 'Flamingo Hammer: there was no shield to break.',
  'Bubble Maker: {bubbles} de {at} burbujas.': 'Bubble Maker: {bubbles} of {at} bubbles.',
  '¡Bomba de burbujas! {dmg} de daño {target} (queda en {hp}).': 'Bubble bomb! {dmg} damage {target} (left at {hp}).',
  'Metal Scanner: le saca {took} de escudo {target} y gana {got}.': 'Metal Scanner: takes {took} shield {target} and gains {got}.',
  'Metal Scanner: el rival no tenía escudo, gana {got}.': 'Metal Scanner: the rival had no shield, gains {got}.',
  'Sharp Edge: {spikes} espinas.': 'Sharp Edge: {spikes} spikes.',
  "Viper's Venom: no entra la cura ni el escudo {of}.": "Viper's Venom: the heal or shield {of} is blocked.",
  'Limpiador: se cancela un efecto sobre {who}.': 'Cleanser: an effect on {who} is cancelled.',
  'Limpiador: se cancelan {n} efectos sobre {who}.': 'Cleanser: {n} effects on {who} are cancelled.',
  '{name}: +{n} de sangrado para {who} (total {total}).': '{name}: +{n} bleed for {who} (total {total}).',
  '{name}: +{n} de veneno para {who} (total {total}).': '{name}: +{n} poison for {who} (total {total}).',
  'Storm Shuriken: la cadena se rompe y {dmg} de daño {target} (queda en {hp}).': 'Storm Shuriken: the chain breaks and {dmg} damage {target} (left at {hp}).',
  'Red Sage: limpia a {who} y cura {got}.': 'Red Sage: cleanses {who} and heals {got}.',
  'Red Sage: cura {got} a {who}.': 'Red Sage: heals {who} for {got}.',
  'Sticky Octopus: una carta extra del centro para {who}.': 'Sticky Octopus: one extra market card for {who}.',
  'Sticky Octopus: {count} cartas extra del centro para {who}.': 'Sticky Octopus: {count} extra market cards for {who}.',
  'Bubble Paste: la carta que se lleve del centro abre la próxima ronda {of}.': 'Bubble Paste: the card taken from the market opens the next round {of}.',
  'Paralyzing Jellyfish: centro a ciegas y sin renovar para {who} ({n} repartos).': 'Paralyzing Jellyfish: blind market with no renewal for {who} ({n} drafts).',
  'Red Bubble: sin poderes del centro para {who} hasta llevarse {n} sin poder.': 'Red Bubble: no market powers for {who} until they take {n} without a power.',
  'Sleepy Guard: +{got} de escudo y {n} Limpiador para {who}.': 'Sleepy Guard: +{got} shield and {n} Cleanser for {who}.',
  "Trickster's Card: {n} carta del rival para apagar.": "Trickster's Card: {n} rival card to turn off.",
  'Energy Drink M: herida abierta para {who}, en su próximo turno el sangrado no baja.': 'Energy Drink M: open wound for {who}, their bleed does not drop on their next turn.',
  'Leafy Pot: cura {got} a {who} (queda en {hp}).': 'Leafy Pot: heals {who} for {got} (now at {hp}).',
  'Leafy Pot: no cura nada.': 'Leafy Pot: heals nothing.',
  'Spring Leaf: {turns} turnos de brote para {who} ({heal} de cura cada uno).': 'Spring Leaf: {turns} sprout turns for {who} ({heal} heal each).',
  'Mantis Dagger: le roba {drain} de vida {target} y cura {got} (queda en {hp}).': 'Mantis Dagger: steals {drain} HP {target} and heals {got} (left at {hp}).',
  'Lazy Snail: en el próximo ataque {of} no cuenta su mejor racha.': 'Lazy Snail: on the next attack {of}, the best run does not count.',
  'Lazy Snail: en el próximo ataque {of} no cuentan sus {n} mejores rachas.': 'Lazy Snail: on the next attack {of}, the {n} best runs do not count.',
  'Cocoon Whistle: {turns} turnos de capullo para {who} ({shield} de escudo cada uno).': 'Cocoon Whistle: {turns} cocoon turns for {who} ({shield} shield each).',
  'Gecko Mask: {spikes} espinas para {who}.': 'Gecko Mask: {spikes} spikes for {who}.',
  "Viper's Venom: las próximas {n} curas o escudos {of} no entran.": "Viper's Venom: the next {n} heals or shields {of} are blocked.",
  'Gloves of Infection: el próximo que le pegue {to} se lleva {n} de veneno.': 'Gloves of Infection: the next one to hit {to} takes {n} poison.',
  "Mít's Comfy Pillow: el próximo golpe {to} saca {cap} como máximo.": "Mít's Comfy Pillow: the next hit {to} takes {cap} at most.",
  "Mít's Comfy Pillow frena el golpe: mitiga {mitigated} (tope {cap}).": "Mít's Comfy Pillow stops the hit: mitigates {mitigated} (cap {cap}).",
  'sin sus {n} mejores rachas por el caracol': 'without its {n} best runs because of the snail',
  '+{dmg} de plumas': '+{dmg} from feathers',
  'Espinas: {thorns} de daño {target} (queda en {hp}).': 'Spikes: {thorns} damage {target} (left at {hp}).',
  'Feather Fan: {n} plumas, +{dmg} de daño y {got} de cura.': 'Feather Fan: {n} feathers, +{dmg} damage and {got} heal.',
  'Spring Leaf: cura {got} a {who} (queda en {hp}, {left} turnos más).': 'Spring Leaf: heals {who} for {got} (now at {hp}, {left} more turns).',
  'Spring Leaf: no cura nada ({left} turnos más).': 'Spring Leaf: heals nothing ({left} more turns).',
  'Cocoon Whistle: +{got} de escudo para {who} ({left} turnos más).': 'Cocoon Whistle: +{got} shield for {who} ({left} more turns).',
  'Veneno: −{bite} de vida {target} (queda en {hp}, veneno {left}).': 'Poison: −{bite} HP {target} (left at {hp}, poison {left}).',
  "Trickster's Card: el rival no tiene cartas con poder para apagar.": "Trickster's Card: the rival has no powered cards to turn off.",
  "Trickster's Card: {power} {of} queda apagado hasta que lo juegue.": "Trickster's Card: {power} {of} is turned off until it is played.",
  "Trickster's Card: no apaga nada.": "Trickster's Card: turns off nothing.",

  // Los estados de la chapa y el centro (ui.js)
  'Sangrado: cada carta que roba le saca {bleed} de vida (herida abierta: este turno no baja)': 'Bleed: each card drawn costs {bleed} HP (open wound: it does not drop this turn)',
  'Sangrado: cada carta que roba le saca {bleed} de vida, y baja 1': 'Bleed: each card drawn costs {bleed} HP, then drops by 1',
  'Debilitado: en su próximo ataque no cuenta su mejor racha': 'Weakened: the best run does not count on the next attack',
  'Debilitado: en su próximo ataque no cuentan sus {weak} mejores rachas': 'Weakened: the {weak} best runs do not count on the next attack',
  '{name}: las próximas {n} curas o escudos no entran': '{name}: the next {n} heals or shields are blocked',
  '{name}: elige del centro a ciegas y sin renovar ({n} repartos)': '{name}: picks from the market blind, no renewal ({n} drafts)',
  '{name}: sin cartas con poder del centro hasta llevarse {n} sin poder': '{name}: no powered market cards until taking {n} without a power',
  '{name}: {n} cartas con el poder apagado hasta que las juegue': '{name}: {n} cards with their power off until played',
  '{name}: cada ataque pone {bleed} de sangrado': '{name}: each attack puts {bleed} bleed',
  '{name}: +{dmg} de daño y de vida en el próximo golpe que conecte': '{name}: +{dmg} damage and HP on the next hit that lands',
  '{name}: con {at} burbujas, bomba de {dmg}': '{name}: at {at} bubbles, a {dmg} bomb',
  '{name}: el próximo golpe rival que conecte recibe {spikes}': '{name}: the rival’s next hit that lands takes {spikes}',
  '{name}: el próximo que te pegue se lleva {n} de veneno': '{name}: the next one to hit you takes {n} poison',
  'Limpiador: cancela los próximos {n} efectos que te pongan': 'Cleanser: cancels the next {n} effects put on you',
  '{name}: {turns} turnos de brote, {heal} de cura al empezar cada uno': '{name}: {turns} sprout turns, {heal} heal at the start of each',
  '{name}: {turns} turnos de capullo, {shield} de escudo al empezar cada uno': '{name}: {turns} cocoon turns, {shield} shield at the start of each',
  '{name}: {poison} de daño al finalizar su turno, después baja 1': '{name}: {poison} damage at the end of their turn, then drops by 1',
  'Carta boca abajo': 'Face-down card',
  'Elegís a ciegas y sin renovar.': 'You pick blind and cannot renew.',
  'Sin poderes hasta llevarte {n} sin poder.': 'No powers until you take {n} without a power.',
  "Trickster's Card": "Trickster's Card",
  '{at}está eligiendo qué carta apagar…': '{at}is picking which card to turn off…',
  'Elegí una carta del rival: su poder se apaga hasta que la juegue.': 'Pick a rival card: its power turns off until they play it.',
  'Elegí {n} cartas del rival: su poder se apaga hasta que las juegue.': 'Pick {n} rival cards: their power turns off until they play them.',
  'Perdés el Trickster': 'You lose the Trickster',
  'No apagar': 'Turn off nothing',
  'Espinas': 'Spikes',
  '¡Segunda chance!': 'Second chance!',

  // La zona de testeo (sandbox.js)
  'Sangrado': 'Bleed',
  'Sin cura': 'No heal',
  'Garras': 'Claws',
  'Plumas': 'Feathers',
  'Bomba': 'Bomb',
  'Guantes': 'Gloves',
  'Almohada': 'Pillow',
  'Limpiador': 'Cleanser',
  'Capullo': 'Cocoon',
  'A ciegas': 'Blind',
  'Sin poderes': 'No powers',
  'sangra': 'bleeds',
  'bomba': 'bomb',
  'segunda chance': 'second chance',
  'gasta': 'spends',
  'limpia': 'cleanses',
  'pincha': 'spikes',

  // Aventura: los poderes de cada nivel con sus reglas de ahora
  'Aprendé lo básico: juntá garras que dejan sangrando al rival, curate con la maceta y montá cartas con Free Game. Si te dejan en 0, te queda un último golpe, pero ahí ya no te podés curar.':
    'Learn the basics: collect claws that leave the rival bleeding, heal with the pot and stack cards with Free Game. If you drop to 0, you get one last hit, but you can no longer heal.',
  'El combate se intensifica. El Secret Egg te da una segunda chance si te cortás, y el Lazy Snail le apaga al rival su mejor racha en el próximo ataque.':
    'The fight heats up. The Secret Egg gives you a second chance when you bust, and the Lazy Snail turns off the rival’s best run on their next attack.',
  'Los 6 poderes clásicos se completan. Llevate cartas extra con el Sticky Octopus y envenená con el Poison Vial: 4 por frasco, muerde a través del escudo y baja de a 1.':
    'The 6 classic powers are complete. Take extra cards with the Sticky Octopus and poison with the Poison Vial: 4 per vial, it bites through shield and drops by 1.',
  'Sangre y cura lenta: la Energy Drink deja al rival sangrando con la herida abierta, y el Spring Leaf te cura al empezar cada turno.':
    'Blood and slow healing: the Energy Drink leaves the rival bleeding with an open wound, and the Spring Leaf heals you at the start of each turn.',
  'El desafío final: Bubble Paste elige tu apertura y la Gecko Mask te llena de espinas contra el que te pegue. Cuidado con el overkill: si te pegan más de 30 pasado el cero, no hay última chance.':
    'The final challenge: Bubble Paste picks your opener and the Gecko Mask covers you in spikes against whoever hits you. Watch out for overkill: take more than 30 past zero and there is no last chance.',

  // Mask of Frenzy (Rage)
  '+1 de Rage: +{step} de daño; con {max}, Furia': '+1 Rage: +{step} damage; at {max}, Fury',
  'Mask of Frenzy: ¡Furia! El próximo golpe que conecte suma +{dmg}.': 'Mask of Frenzy: Fury! The next hit that lands adds +{dmg}.',
  'Mask of Frenzy: {rage} de Rage, +{dmg} de daño en cada golpe.': 'Mask of Frenzy: {rage} Rage, +{dmg} damage on every hit.',
  '+{dmg} de Rage': '+{dmg} from Rage',
  'Mask of Frenzy: la Furia se descarga y la Rage vuelve a 0.': 'Mask of Frenzy: the Fury unleashes and Rage resets to 0.',
  'Rage': 'Rage',
  '¡Furia!': 'Fury!',
  '{name}: Furia, +{dmg} en el próximo golpe que conecte': '{name}: Fury, +{dmg} on the next hit that lands',
  '{name}: {rage} de Rage, +{dmg} de daño en cada golpe': '{name}: {rage} Rage, +{dmg} damage on every hit',
  // ---- la Aventura: los niveles, sus rivales y su panel ----
  "El Valle":
    "The Valley",
  "La Costa":
    "The Coast",
  "El Bosque Nevado":
    "The Snowy Forest",
  "La Guarida":
    "The Lair",
  "El Coliseo":
    "The Colosseum",
  "Encadená símbolos y plantate antes de cortarte. Arrancás con tres amuletos neutrales, y el Rocket Stamp se monta gratis sobre tu cadena.":
    "Chain symbols and stand before you bust. You start with three neutral charms, and the Rocket Stamp stacks onto your chain for free.",
  "Pluma Veloz":
    "Swift Feather",
  "Un pichón apurado que roba de más. Dejalo cortarse solo.":
    "A hasty chick that draws too much. Let it bust on its own.",
  "Primera Sangre":
    "First Blood",
  "Tu primer rival de Bestia: rachas cortas y golpes secos.":
    "Your first Beast rival: short runs and sharp hits.",
  "Robo de Vida":
    "Life Steal",
  "La Polilla se esconde y espera tu corte. No le regales uno.":
    "The Moth hides and waits for you to bust. Don't hand it one.",
  "Veneno Lento":
    "Slow Poison",
  "La Víbora tarda en armar, pero cuando arma, muerde.":
    "The Viper is slow to build, but once it does, it bites.",
  "El Renacuajo trae una carta de mochila: un símbolo de su clase, lo más simple que sale del Taller. Con más cartas de su color, encadena un poco mejor.":
    "The Tadpole brings a backpack card: one symbol of its class, the simplest thing the Workshop makes. With more cards of its color, it chains a little better.",
  "Una Carta de Más":
    "One Card More",
  "Hojas Secas":
    "Dry Leaves",
  "La Bellota también trae su carta de más. Tocá al rival en la mesa para ver su mazo entero, con lo que le pusieron.":
    "The Acorn also brings its extra card. Tap the rival on the table to see its whole deck, with what was added.",
  "Dos de Más":
    "Two More",
  "El Gorrión ya lleva dos cartas de mochila. Vos tenés lugar para cuatro: ponéselas a tu Axie desde su inventario.":
    "The Sparrow already carries two backpack cards. You have room for four: put them on your Axie from its inventory.",
  "Antes del Shogun":
    "Before the Shogun",
  "El último antes del jefe. Dos cartas de más y la idea de siempre: plantate antes de cortarte.":
    "The last one before the boss. Two extra cards and the usual idea: stand before you bust.",
  "Pinzas":
    "Pincers",
  "Tres cartas de mochila: el Cangrejo encadena su color más seguido. Las cartas del centro con tu símbolo te ayudan a seguirle el ritmo.":
    "Three backpack cards: the Crab chains its color more often. Market cards with your symbol help you keep up.",
  "Pico Grande":
    "Big Beak",
  "El Pelícano también trae tres. Si te cuesta, revisá tu mochila: una carta rara de tres símbolos encadena con casi todo.":
    "The Pelican brings three as well. If it gets hard, check your backpack: a rare card with three symbols chains with almost anything.",
  "Tinta":
    "Ink",
  "El Calamar llena su mochila: cuatro cartas, el mismo tope que el tuyo. De acá en más los rivales no suman cartas: las mejoran.":
    "The Squid fills its backpack: four cards, the same limit as yours. From here on rivals don't add cards: they upgrade them.",
  "Marea Baja":
    "Low Tide",
  "Cuatro cartas de mochila y el jefe a la vuelta. Llegá con tu mochila llena.":
    "Four backpack cards and the boss around the corner. Arrive with your backpack full.",
  "Segundo jefe, con cuerpo y partes de verano. Sus partes con amuleto llevan los poderes de este nivel: mirá cuáles antes de pegarle.":
    "Second boss, with a summer body and parts. Its charmed parts carry this level's powers: check which before you hit it.",
  "Ojos en la Noche":
    "Eyes in the Night",
  "Una carta de su mochila se fusionó: tres comunes iguales hacen una poco común, con dos símbolos. Vos también podés, desde la mochila.":
    "One of its backpack cards was fused: three matching commons make an uncommon with two symbols. You can do it too, from your backpack.",
  "Hielo Fino":
    "Thin Ice",
  "La Foca trae una poco común entre sus cuatro cartas. Un símbolo de más por carta es una racha que se corta menos.":
    "The Seal brings an uncommon among its four cards. One more symbol per card is a run that breaks less often.",
  "Cuernos de Escarcha":
    "Frost Antlers",
  "Dos cartas poco comunes. El rival se arma como lo harías vos: de a poco, fusionando.":
    "Two uncommon cards. The rival builds up the way you would: little by little, fusing.",
  "Bayas Rojas":
    "Red Berries",
  "El último antes de Nevisca, con dos poco comunes en la mochila. Juntá vida para la tormenta.":
    "The last one before Nevisca, with two uncommons in its backpack. Save up life for the storm.",
  "Tercer jefe, de escarcha. Su cuerno lleva un poder de este nivel. Trae una parte evolucionada: después de ella, todos los rivales.":
    "Third boss, made of frost. Its horn carries a power from this level. It brings an evolved part: after it, every rival does.",
  "Telaraña":
    "Cobweb",
  "Una parte evolucionada y cuatro cartas de mochila: la Araña encadena con símbolos que no son de su clase. Mirá cuáles antes de arriesgar.":
    "One evolved part and four backpack cards: the Spider chains with symbols outside its class. Check which ones before you risk it.",
  "Alas de Cuero":
    "Leather Wings",
  "Tres poco comunes en la mochila del Murciélago. A esta altura tu Axie ya puede tener su primera evolución: se hace desde la elección de Axies.":
    "Three uncommons in the Bat's backpack. By now your Axie can have its first evolution: you do it from the Axie selection.",
  "Esporas":
    "Spores",
  "Tres poco comunes y una parte evolucionada. Si no ves tu color en el mazo, plantate temprano.":
    "Three uncommons and one evolved part. If you don't see your color in the deck, stand early.",
  "Descarga":
    "Shock",
  "Las cuatro cartas de la Anguila ya son poco comunes. La próxima es Umbra: llegá con tu Axie evolucionado.":
    "All four of the Eel's cards are uncommon now. Next is Umbra: arrive with your Axie evolved.",
  "Cuarto jefe, de pesadilla, con dos partes de evento con amuleto que llevan los poderes de este nivel. Pegale antes de que se arme.":
    "Fourth boss, a nightmare, with two event parts whose charms carry this level's powers. Hit it before it builds up.",
  "Aguijón":
    "Stinger",
  "Una carta rara: tres símbolos en una sola. El Escorpión encadena con casi cualquier cosa que robe.":
    "A rare card: three symbols in one. The Scorpion chains with almost anything it draws.",
  "Ojos de Serpiente":
    "Snake Eyes",
  "La Cobra también trae una rara. Las tuyas salen del Taller o de fusionar tres poco comunes iguales.":
    "The Cobra brings a rare too. Yours come from the Workshop or from fusing three matching uncommons.",
  "Garras del Cielo":
    "Sky Talons",
  "Dos raras en la mochila del Grifo: es la mochila de un jugador que ya fusionó bastante.":
    "Two rares in the Griffin's backpack: the backpack of a player who has fused quite a bit.",
  "Espinas del Desierto":
    "Desert Thorns",
  "El último antes del Basilisco, con dos raras. Vení con la mochila llena y tu Axie evolucionado.":
    "The last one before the Basilisk, with two rares. Come with your backpack full and your Axie evolved.",
  "Quinto jefe: cuerpo místico y 190 de vida. Sus partes místicas llevan los poderes de este nivel.":
    "Fifth boss: mystic body and 190 life. Its mystic parts carry this level's powers.",
  "Jefe Final":
    "Final Boss",
  "1 carta de mochila":
    "1 backpack card",
  "{n} cartas de mochila":
    "{n} backpack cards",
  "Su mochila":
    "Its backpack",
  "La mochila del rival":
    "The rival's backpack",
  "Sus amuletos, según la partida":
    "Its charms, depending on the match",
  "El Bosque de Otoño":
    "The Autumn Forest",
  "Más Allá del Coliseo":
    "Beyond the Colosseum",
  "El viaje sigue del otro lado del Coliseo. El Ciervo ya trae tres raras en la mochila.":
    "The journey goes on past the Colosseum. The Deer already carries three rares in its backpack.",
  "Hojas que Crujen":
    "Crunching Leaves",
  "Un rival de Planta con las cartas de su clase fusionadas. Robá con calma.":
    "A Plant rival with its class cards fused. Draw calmly.",
  "Caparazón Dorado":
    "Golden Shell",
  "Mirale el mazo antes de pelear: sus raras encadenan con casi todo.":
    "Check its deck before fighting: its rares chain with almost anything.",
  "Ojos de Lechuza":
    "Owl Eyes",
  "La Lechuza espera tu error. Plantate antes de que la rueda se ponga roja.":
    "The Owl waits for your mistake. Stand before the wheel turns red.",
  "Charco de Lluvia":
    "Rain Puddle",
  "Una racha larga pega mucho más que dos cortas: cuidá la que crece.":
    "One long run hits much harder than two short ones: protect the one that grows.",
  "Cola de Fuego":
    "Fire Tail",
  "La Salamandra envenena y espera. Una cura a tiempo vale un golpe.":
    "The Salamander poisons and waits. A timely heal is worth a hit.",
  "Embestida":
    "Charge",
  "Pega de frente y sin miedo. Juntá escudo antes de que llegue.":
    "It charges head on. Build shield before it arrives.",
  "Luz Entre los Árboles":
    "Light Between the Trees",
  "Una luz chiquita con una mochila grande. No te confíes.":
    "A tiny light with a big backpack. Don't get cocky.",
  "Antes del Guardián":
    "Before the Guardian",
  "El último antes de Kodama. Llegá con tus cartas raras puestas.":
    "The last one before Kodama. Arrive with your rare cards equipped.",
  "Kodama, el Guardián del Bosque":
    "Kodama, Guardian of the Forest",
  "Sexto jefe: partes de Japón y la puerta de piedra a su espalda. Su cuerno y su espalda llevan los poderes de este nivel.":
    "Sixth boss: Japan parts and the stone gate at its back. Its horn and back carry this level's powers.",
  "La Jungla":
    "The Jungle",
  "Pico de Colores":
    "Colorful Beak",
  "Lo medio empieza acá: las cuatro cartas del rival ya son raras, y el primero con una parte coleccionable.":
    "The middle stretch starts here: all four rival cards are rare, and the first with a collectible part.",
  "Flor Venenosa":
    "Poison Flower",
  "Las partes místicas brillan, pero se juegan igual: su carta es la de siempre.":
    "Mystic parts shine, but play the same: its card is the usual one.",
  "Garras en la Sombra":
    "Claws in the Shade",
  "El Jaguar arma rachas largas. Pegale antes de que las suelte.":
    "The Jaguar builds long runs. Hit it before it lets them go.",
  "Aguas Rápidas":
    "Rapid Waters",
  "Muerde de a poco y seguido. No le regales cartas del centro.":
    "It bites little by little. Don't gift it market cards.",
  "Cambio de Color":
    "Color Shift",
  "Sus partes de otras clases le dan símbolos raros: mirá con qué encadena.":
    "Its off-class parts give it odd symbols: see what it chains with.",
  "Fila de Hormigas":
    "Ant Line",
  "Chiquita y organizada. Su mochila está llena de raras.":
    "Small and organized. Its backpack is full of rares.",
  "Entre Lianas":
    "Among the Vines",
  "Se cura y se cura. Pegale fuerte y seguido, no de a poco.":
    "It heals and heals. Hit it hard and often, not little by little.",
  "Grito de la Selva":
    "Jungle Cry",
  "El Guacamayo grita y pega. Cortale el ritmo con una cadena larga.":
    "The Macaw screams and strikes. Break its rhythm with a long chain.",
  "Antes de la Reina":
    "Before the Queen",
  "El último antes de Mantodea. Tu segunda evolución ya está cerca.":
    "The last one before Mantodea. Your second evolution is close.",
  "Mantodea, Reina de la Jungla":
    "Mantodea, Queen of the Jungle",
  "Séptimo jefe, casi entera de partes coleccionables. Su cuerno y su boca llevan los poderes de este nivel.":
    "Seventh boss, almost entirely collectible parts. Its horn and mouth carry this level's powers.",
  "La Laguna":
    "The Lagoon",
  "Patas Largas":
    "Long Legs",
  "Desde acá los rivales traen dos partes evolucionadas, como vos con tu segunda evolución.":
    "From here rivals bring two evolved parts, like you with your second evolution.",
  "Juego en el Agua":
    "Water Play",
  "Juguetona y peligrosa: la Nutria pega cuando menos la esperás.":
    "Playful and dangerous: the Otter strikes when you least expect it.",
  "Vuelo Rasante":
    "Skimming Flight",
  "Rápida para encadenar. Plantate temprano si no ves tu color.":
    "Quick to chain. Stand early if you don't see your color.",
  "Orilla de Juncos":
    "Reed Shore",
  "Escudo y paciencia: el Junco se dobla, pero no se rompe.":
    "Shield and patience: the Reed bends, but doesn't break.",
  "Sol en la Roca":
    "Sun on the Rock",
  "Lento y duro. Ganale con rachas largas, no con apuro.":
    "Slow and tough. Beat it with long runs, not haste.",
  "Escamas de Oro":
    "Golden Scales",
  "La Carpa brilla al sol y encadena con todo. Llevate lo mejor del centro antes.":
    "The Carp shines in the sun and chains with everything. Take the best of the center first.",
  "Canto de Noche":
    "Night Song",
  "Dos Pez seguidos: el centro se llena de su color.":
    "Two Aquatic rivals in a row: the market fills with its color.",
  "Zumbido":
    "Buzz",
  "Molesto y chupasangre: cada golpe suyo le devuelve algo.":
    "Annoying and bloodsucking: each of its hits gives something back.",
  "Antes de la Dama":
    "Before the Lady",
  "El último antes de Nenúfar. Llegá con escudo.":
    "The last one before Nenúfar. Arrive with shield.",
  "Nenúfar, la Dama del Lago":
    "Nenúfar, Lady of the Lake",
  "La Isla del Verano":
    "Summer Island",
  "Salto del Delfín":
    "Dolphin Leap",
  "Llega la primera épica: una carta del rival con un poder de su clase, desde la primera ronda.":
    "The first epic arrives: a rival card with a power of its class, from round one.",
  "Cáscara Dura":
    "Hard Shell",
  "Su épica es de Planta: cura o escudo. Pegale antes de que se arme.":
    "Its epic is Plant: heal or shield. Hit it before it builds up.",
  "Siesta al Sol":
    "Sun Nap",
  "La Lagartija toma sol y espera. Pegale mientras duerme.":
    "The Lizard sunbathes and waits. Hit it while it naps.",
  "Alas Largas":
    "Long Wings",
  "El Albatros arriesga más de la cuenta. Dejalo cortarse.":
    "The Albatross takes more risks than it should. Let it bust.",
  "Travesuras":
    "Mischief",
  "Garras para siempre. Cada golpe suyo deja más sangre.":
    "Claws forever. Each of its hits leaves more bleed.",
  "Picadura":
    "Sting",
  "La Medusa pica y se va. No le dejes la última palabra.":
    "The Jellyfish stings and drifts away. Don't give it the last word.",
  "Flor de Playa":
    "Beach Flower",
  "El Hibisco aguanta tus golpes: juntá rachas largas.":
    "The Hibiscus soaks up your hits: build long runs.",
  "Nido de Avispas":
    "Wasp Nest",
  "Te roba cartas con poder del mazo. Que no tengas una sola.":
    "It steals power cards from your deck. Don't rely on just one.",
  "Antes del Verano":
    "Before Summer",
  "El último antes del Sol de Verano. Ya podés tener tu primera épica.":
    "The last one before Summer Sun. You can have your first epic by now.",
  "Verano, el Sol de la Isla":
    "Verano, Sun of the Island",
  "La Meseta":
    "The Mesa",
  "Rey de la Meseta":
    "King of the Mesa",
  "Dos partes coleccionables y una épica: los rivales ya parecen jefes chicos.":
    "Two collectible parts and an epic: rivals already look like small bosses.",
  "Círculos en el Cielo":
    "Circles in the Sky",
  "Espera que te cortes para caerte con el shuriken.":
    "It waits for you to bust to drop the shuriken on you.",
  "Centinela":
    "Sentinel",
  "Mira todo desde arriba. Vos mirá su mazo antes de arriesgar.":
    "It watches everything from above. You check its deck before risking.",
  "Árbol Viejo":
    "Old Tree",
  "Aguanta mucho. Que tus amuletos le cobren cada ronda.":
    "It takes a lot. Let your charms charge it every round.",
  "Bajo la Tierra":
    "Underground",
  "Come de a poco tu vida. Un huevo en la mesa te salva un corte.":
    "It eats your HP little by little. An egg on the table saves you a bust.",
  "Carrera":
    "Race",
  "Rápido para plantarse. Vos aguantá la carta de más.":
    "Quick to stand. You hold for the extra card.",
  "Salto Largo":
    "Long Jump",
  "Las épicas de Bestia sangran. Tené una cura lista.":
    "Beast epics bleed. Keep a heal ready.",
  "Orilla del Río":
    "Riverbank",
  "El Cocodrilo espera en la orilla con la boca abierta. No le des el primer golpe.":
    "The Crocodile waits on the shore with its jaws open. Don't give it the first hit.",
  "Antes de Sauria":
    "Before Sauria",
  "El último antes de Sauria. Llegá con la vida alta.":
    "The last one before Sauria. Arrive with high life.",
  "Sauria, la Escama del Sol":
    "Sauria, Scale of the Sun",
  "Décimo jefe: partes de verano, de Japón y de Navidad, y una mística. Su cuerno y su espalda llevan los poderes de este nivel.":
    "Tenth boss: summer, Japan and Christmas parts, plus a mystic one. Its horn and back carry this level's powers.",
  "El Cañón Rojo":
    "The Red Canyon",
  "Aullido Rojo":
    "Red Howl",
  "Dos épicas en la mochila del rival. Vos también deberías tener la tuya.":
    "Two epics in the rival's backpack. You should have yours too.",
  "Polvo en el Camino":
    "Dust on the Road",
  "Ataca rápido y se va. Plantate cuando tu racha llega a tres.":
    "It strikes fast and leaves. Stand when your run reaches three.",
  "Cien Patas":
    "A Hundred Legs",
  "Un mazo largo y conectado. No le dejes el centro.":
    "A long, connected deck. Don't leave it the market.",
  "Flor de Espinas":
    "Thorn Flower",
  "El Cardo se cura y te pincha. Pegale fuerte y de una.":
    "The Thistle heals and pricks you. Hit it hard, all at once.",
  "Mordida Lenta":
    "Slow Bite",
  "La Gila muerde despacio y no suelta.":
    "The Gila bites slowly and never lets go.",
  "Pozo Escondido":
    "Hidden Well",
  "El Ajolote sonríe mientras te gana de a poco.":
    "The Axolotl smiles while it beats you little by little.",
  "Salto desde la Roca":
    "Leap from the Rock",
  "El Puma salta desde la roca cada tanto. Escudo antes de que llegue.":
    "The Puma leaps from the rock now and then. Shield up before it lands.",
  "Cola Levantada":
    "Tail Raised",
  "Te roba lo mejor de tu mazo. Repartí tus poderes.":
    "It steals the best of your deck. Spread your powers.",
  "Antes del Cóndor":
    "Before the Condor",
  "El último antes de Carmín. Tu tercera evolución ya está cerca.":
    "The last one before Carmín. Your third evolution is close.",
  "Carmín, el Cóndor Rojo":
    "Carmín, the Red Condor",
  "El Cielo":
    "The Sky",
  "Sobre las Nubes":
    "Above the Clouds",
  "El viaje sube al cielo. Los rivales siguen con dos épicas y dos partes evolucionadas.":
    "The journey climbs to the sky. Rivals still bring two epics and two evolved parts.",
  "Semillas al Viento":
    "Seeds on the Wind",
  "Liviano pero con escudo. Rompéselo antes de pegar.":
    "Light but shielded. Break its shield before you strike.",
  "Alas de Papel":
    "Paper Wings",
  "La Mariposa vuela liviana y pega donde duele. Armá dos rachas medianas.":
    "The Butterfly flies light and hits where it hurts. Build two medium runs.",
  "Galope Celeste":
    "Sky Gallop",
  "Garras que se suman ronda a ronda. No dejes que la partida se alargue.":
    "Claws that stack round after round. Don't let the match drag on.",
  "Nube de Lluvia":
    "Rain Cloud",
  "El Nimbo se lleva lo mejor del centro. Elegí antes que él.":
    "The Nimbus takes the best of the center. Pick before it does.",
  "Cola de Luz":
    "Tail of Light",
  "Pega aunque se corte. Juntá escudo.":
    "It hits even when it busts. Gather shield.",
  "Primer Vuelo":
    "First Flight",
  "Chico pero con veneno y espinas. Limpiá antes de pegar.":
    "Small but with poison and spikes. Cleanse before hitting.",
  "Panal en las Nubes":
    "Hive in the Clouds",
  "Su daga le cura lo que te saca. Pegale más de lo que te roba.":
    "Its dagger heals what it takes. Hit it more than it steals.",
  "Antes de la Flor":
    "Before the Flower",
  "El último antes de Celeste, que se cura sin parar. Llegá pegando fuerte.":
    "The last one before Celeste, who heals nonstop. Arrive hitting hard.",
  "Celeste, la Flor del Cielo":
    "Celeste, Flower of the Sky",
  "Duodécimo jefe: cuerpo místico, partes de Navidad y de Japón. Su cuerno y su espalda llevan los poderes de este nivel.":
    "Twelfth boss: mystic body, Christmas and Japan parts. Its horn and back carry this level's powers.",
  "La Caverna":
    "The Cavern",
  "Túneles":
    "Tunnels",
  "Desde acá los rivales traen tres partes evolucionadas, como vos con tu tercera.":
    "From here rivals bring three evolved parts, like you with your third.",
  "Tierra Blanda":
    "Soft Earth",
  "Lento pero encadena con todo. Cortale el centro.":
    "Slow but chains with everything. Cut off its market.",
  "Pez sin Ojos":
    "Eyeless Fish",
  "No te ve venir, pero sus burbujas sí. Llevate las del centro.":
    "It doesn't see you coming, but its bubbles do. Take the market ones.",
  "Bajo Tierra":
    "Underground",
  "Se cura en la oscuridad. Que no pase una ronda sin que le pegues.":
    "It heals in the dark. Don't let a round pass without hitting it.",
  "Pegado al Techo":
    "Stuck to the Ceiling",
  "El Geco se pega al techo y espera. Que tu cadena no se corte.":
    "The Gecko clings to the ceiling and waits. Don't let your chain break.",
  "Telas en la Cueva":
    "Webs in the Cave",
  "Te roba cartas con poder. Las tuyas, que estén repartidas.":
    "It steals power cards. Keep yours spread out.",
  "Hibernación":
    "Hibernation",
  "Duerme hasta que no. Cuando se despierta, pega por dos.":
    "It sleeps until it doesn't. When it wakes, it hits twice as hard.",
  "Musgo Brillante":
    "Glowing Moss",
  "Escudo sobre escudo. Hace falta una cadena larga.":
    "Shield upon shield. It takes a long chain.",
  "Antes del Ojo":
    "Before the Eye",
  "El último de lo medio. Después de Óculo, la CPU juega en serio.":
    "The last of the middle stretch. After Óculo, the CPU plays for real.",
  "Óculo, el Ojo de la Caverna":
    "Óculo, Eye of the Cavern",
  "Decimotercer jefe: cuerpo de pesadilla y seis partes coleccionables. Su cuerno, su cola y su espalda llevan los poderes de este nivel.":
    "Thirteenth boss: nightmare body and six collectible parts. Its horn, tail and back carry this level's powers.",
  "El Desierto":
    "The Desert",
  "La CPU Despierta":
    "The CPU Wakes Up",
  "Lo difícil empieza: desde acá la CPU juega en dura, mide la partida entera y no regala nada.":
    "The hard stretch begins: from here the CPU plays on hard, reads the whole match and gives nothing away.",
  "Vista de Arriba":
    "Seen from Above",
  "Tres épicas y tres partes coleccionables. Llegá con tu mejor mochila.":
    "Three epics and three collectible parts. Arrive with your best backpack.",
  "Bola de Arena":
    "Sand Ball",
  "Gigante Espinoso":
    "Spiny Giant",
  "Se cura, se protege y te pincha. Paciencia y rachas largas.":
    "It heals, protects itself and pricks you. Patience and long runs.",
  "Aviso de Cola":
    "Tail Warning",
  "Orejas Grandes":
    "Big Ears",
  "Escucha tus riesgos. La CPU dura sabe cuándo te conviene cortarte.":
    "It hears your risks. The hard CPU knows when busting would suit you.",
  "Agua que No Está":
    "Water That Isn't There",
  "Lo que ves en el centro puede no ser para vos: tomá lo que encadena.":
    "What you see in the market may not be for you: take what chains.",
  "Plaga":
    "Plague",
  "Salta y roba. No dejes una carta con poder sola en tu mazo.":
    "It jumps and steals. Don't leave a lone power card in your deck.",
  "Antes del Faraón":
    "Before the Pharaoh",
  "El último antes del Faraón. Su veneno se suma al tuyo: llevá limpieza.":
    "The last one before the Pharaoh. Its poison stacks: bring cleansing.",
  "Faraón, el Escamado":
    "Faraón, the Scaled One",
  "Decimocuarto jefe: cuerpo de verano y partes de Agamo, Japón y Navidad. Su cuerno, su espalda y su cola llevan los poderes de este nivel.":
    "Fourteenth boss: summer body and Agamo, Japan and Christmas parts. Its horn, back and tail carry this level's powers.",
  "El Ocaso":
    "The Dusk",
  "Río de Lava":
    "River of Lava",
  "Las cuatro cartas del rival ya son épicas. Cada robo suyo puede traer un poder.":
    "All four rival cards are epic now. Every draw of its may bring a power.",
  "Renacer":
    "Rebirth",
  "El Fénix renace de cada corte. Contá con que arriesgue de más.":
    "The Phoenix rises from every bust. Expect it to overreach.",
  "Chispas":
    "Sparks",
  "Te saca el escudo y se lo queda. No lo juntes de más.":
    "It takes your shield and keeps it. Don't over-stack it.",
  "Después del Fuego":
    "After the Fire",
  "Brota de nuevo cada turno. Pegale fuerte cuando le baje el escudo.":
    "It sprouts again every turn. Hit hard when its shield drops.",
  "Cueva Caliente":
    "Hot Den",
  "Sangrado sobre sangrado. Cada carta que robás te cuesta vida.":
    "Bleed on bleed. Every card you draw costs HP.",
  "Niebla Roja":
    "Red Mist",
  "Su bomba de burbujas pega 32. Contá sus burbujas.":
    "Its bubble bomb hits for 32. Count its bubbles.",
  "Piedra Negra":
    "Black Stone",
  "Espinas duras como vidrio. El primer golpe que le das, vuelve.":
    "Spikes as hard as glass. The first hit you land comes back.",
  "Canto del Ocaso":
    "Dusk Song",
  "Plumas que se suman. Cortale la partida antes de que junte tres.":
    "Feathers that stack. End the match before it gathers three.",
  "Antes de Behemot":
    "Before Behemot",
  "El último antes de Behemot, que trae las primeras partes Shiny de jefe.":
    "The last one before Behemot, who brings the first Shiny boss parts.",
  "Behemot del Ocaso":
    "Behemot of the Dusk",
  "El Bosque Nocturno":
    "The Night Forest",
  "Bajo la Luna":
    "Under the Moon",
  "Desde acá los rivales traen cuatro partes evolucionadas, como vos con tu cuarta.":
    "From here rivals bring four evolved parts, like you with your fourth.",
  "Ve en la oscuridad. Vos mirá la rueda antes de robar.":
    "It sees in the dark. You check the wheel before drawing.",
  "Polilla de la Noche":
    "Night Moth",
  "La Esfinge vuela de noche y pega justo cuando más te duele.":
    "The Sphinx moth flies by night and strikes just when it hurts most.",
  "Flor Oscura":
    "Dark Flower",
  "Bonita y venenosa. No te confíes con la vida baja.":
    "Pretty and poisonous. Don't get comfortable with low life.",
  "Lago de Estrellas":
    "Lake of Stars",
  "Pulpos y burbujas: se lleva medio centro. Ganale de mano.":
    "Octopuses and bubbles: it takes half the market. Get there first.",
  "Abrazo":
    "Embrace",
  "Te aprieta con veneno de a poco. Una carta de cura por ronda.":
    "It squeezes you with poison little by little. One heal card per round.",
  "Ojos en la Rama":
    "Eyes on the Branch",
  "Garras y ojos en la oscuridad. Que la partida sea corta.":
    "Claws and eyes in the dark. Keep the match short.",
  "Faro Verde":
    "Green Beacon",
  "Su luz te distrae mientras te roba la carta buena.":
    "Its light distracts you while it steals your good card.",
  "Antes del Leviatán":
    "Before the Leviathan",
  "El último antes del Leviatán. Traé tu mejor mochila.":
    "The last one before the Leviathan. Bring your best backpack.",
  "Leviatán de la Noche":
    "Leviathan of the Night",
  "El Salón de Invierno":
    "The Winter Hall",
  "La Primera Legendaria":
    "The First Legendary",
  "El rival trae una legendaria: dos símbolos y un poder de su clase en una carta.":
    "The rival brings a legendary: two symbols and a power of its class in one card.",
  "Deslizarse":
    "Sliding",
  "Se tira de panza y pega con plumas. Escudo antes de su turno.":
    "It belly-slides and hits with feathers. Shield before its turn.",
  "Bajo el Muérdago":
    "Under the Mistletoe",
  "Te besa y se cura. Que tu sangrado le cobre cada carta.":
    "It kisses you and heals. Let your bleed charge every card.",
  "Colmillos de Hielo":
    "Ice Tusks",
  "Pesada y con burbujas. No le dejes juntar tres.":
    "Heavy and bubbly. Don't let it gather three.",
  "Bolita":
    "Little Ball",
  "Se enrolla en escudo. Desenrollala con una cadena larga.":
    "It curls up in its shield. Unroll it with a long chain.",
  "Aliento Frío":
    "Cold Breath",
  "Un reptil de hielo que no se derrite.":
    "An ice reptile that doesn't melt.",
  "Cornamenta":
    "Antlers",
  "Embiste con garras para siempre. Cada ronda pega más.":
    "It charges with permanent claws. Each round it hits harder.",
  "Adornos":
    "Ornaments",
  "Lleno de luces y de escudo. Pegale hasta apagarlo.":
    "Full of lights and shield. Hit it until it goes dark.",
  "Antes de la Estrella":
    "Before the Star",
  "El último antes de Estrella. Su shuriken pega aunque se corte.":
    "The last one before Estrella. Its shuriken hits even when it busts.",
  "Estrella, el Ave de Navidad":
    "Estrella, the Christmas Bird",
  "Los Engranajes":
    "The Gearworks",
  "Ajuste Fino":
    "Fine Tuning",
  "Dos legendarias en la mochila del rival. Es la mochila de alguien que jugó mucho.":
    "Two legendaries in the rival's backpack. The backpack of someone who played a lot.",
  "Rebote":
    "Bounce",
  "Salta con furia. Cuando la Rage llega a cinco, escudo arriba.":
    "It bounces with fury. When Rage hits five, shield up.",
  "Viento de Metal":
    "Metal Wind",
  "Gira con el viento y te tira plumas. Contalas.":
    "It turns with the wind and throws feathers. Count them.",
  "Paciencia":
    "Patience",
  "Chiquito y eterno. Ganale por K.O., no por cansancio.":
    "Tiny and eternal. Beat it by K.O., not by attrition.",
  "Bajo Presión":
    "Under Pressure",
  "La Escafandra baja al fondo y sube con lo mejor del centro.":
    "The Diving Suit sinks to the bottom and comes up with the best of the center.",
  "Rosca":
    "Thread",
  "Espinas de metal. Pegale con veneno, que no las toca.":
    "Metal spikes. Hit it with poison, which doesn't touch them.",
  "Golpe Hidráulico":
    "Hydraulic Punch",
  "Pega fuerte y seguido. Juntá escudo entre golpe y golpe.":
    "It hits hard and often. Build shield between blows.",
  "Ruido de Fábrica":
    "Factory Noise",
  "Te roba lo mejor. Llevá más de una carta con poder.":
    "It steals the best. Bring more than one power card.",
  "Antes del Autómata":
    "Before the Automaton",
  "Autómata, el Corazón de Acero":
    "Automaton, the Steel Heart",
  "Decimoctavo jefe: cuerpo místico, ojos místicos y partes de Navidad, Japón y Agamo. Su cuerno, su espalda y su cola llevan los poderes de este nivel.":
    "Eighteenth boss: mystic body, mystic eyes and Christmas, Japan and Agamo parts. Its horn, back and tail carry this level's powers.",
  "El Mar Violeta":
    "The Violet Sea",
  "Alas de Agua":
    "Water Wings",
  "Tres legendarias. Lo que queda del viaje es para los que llegaron con todo.":
    "Three legendaries. What's left of the journey is for those who came with everything.",
  "Arrecife":
    "Reef",
  "Escudo, cura y paciencia en un mismo mazo. Hace falta un K.O.":
    "Shield, healing and patience in one deck. It takes a K.O.",
  "Eco del Mar":
    "Echo of the Sea",
  "La Caracola repite lo que escucha. Armá varias rachas.":
    "The Conch repeats what it hears. Build several runs.",
  "Ocho Brazos":
    "Eight Arms",
  "Se lleva cartas de más del centro. Ganale de mano.":
    "It takes extra market cards. Get there first.",
  "Grieta":
    "Crevice",
  "La Morena espera escondida en la grieta.":
    "The Moray waits hidden in the crevice.",
  "Pico Rápido":
    "Quick Beak",
  "El Gaviotín pica rápido. No le des tiempo.":
    "The Tern pecks fast. Don't give it time.",
  "Roca del Puerto":
    "Harbor Rock",
  "Sangra y hace sangrar. Ganale antes de que te desangre.":
    "It bleeds and makes you bleed. Beat it before it bleeds you dry.",
  "Tentáculos":
    "Tentacles",
  "Pica y se cura. Atacala cuando tenga la cura bloqueada.":
    "It stings and heals. Attack when its healing is blocked.",
  "Antes de Nácar":
    "Before Nácar",
  "El último antes de Nácar. Guardá tu mejor carta para el jefe.":
    "The last one before Nácar. Save your best card for the boss.",
  "Nácar, la Orquídea Abisal":
    "Nácar, the Abyssal Orchid",
  "El Amanecer":
    "The Dawn",
  "Primera Luz":
    "First Light",
  "El último capítulo. Cada rival trae tres legendarias y cuatro partes coleccionables.":
    "The last chapter. Every rival brings three legendaries and four collectible parts.",
  "Gotas de la Mañana":
    "Morning Drops",
  "Se cura con la primera luz. No le des tiempo.":
    "It heals with the first light. Give it no time.",
  "Rayo":
    "Lightning",
  "Rápida y con furia. Escudo en cuanto llega a cuatro de Rage.":
    "Fast and furious. Shield as soon as Rage reaches four.",
  "Estrella de la Mañana":
    "Morning Star",
  "Te roba el escudo y la carta buena. Jugale corto.":
    "It steals your shield and your good card. Play it short.",
  "Línea del Mar":
    "Sea Line",
  "En la línea del mar, el centro es suyo si lo dejás.":
    "On the sea line, the center is its own if you let it.",
  "Tres Cabezas":
    "Three Heads",
  "Partes de todos lados y veneno de los tres poderes.":
    "Parts from everywhere and poison from all three powers.",
  "Escudo de Luz":
    "Shield of Light",
  "Sangra y furia. Que tu primer golpe sea grande.":
    "Bleed and fury. Make your first hit a big one.",
  "Seis Alas":
    "Six Wings",
  "Plumas por todos lados. Contalas y pegale antes de la tercera.":
    "Feathers everywhere. Count them and hit before the third.",
  "La Puerta":
    "The Gate",
  "El último antes de Aurora. Del otro lado de la puerta, el final.":
    "The last one before Aurora. Beyond the gate, the end.",
  "Aurora, la Última Escama":
    "Aurora, the Last Scale",
  "El último jefe: cuerpo místico, cuerno y espalda Shiny, todas sus partes evolucionadas y una mítica en la mochila. Su cuerno, su espalda y su cola llevan Viper's Venom, Gecko Mask, Gloves of Infection o Poison Vial.":
    "The last boss: a mystic body, Shiny horn and back, every part evolved and a mythic in its backpack. Its horn, back and tail carry Viper's Venom, Gecko Mask, Gloves of Infection or Poison Vial.",
  "Rueda su bola de arena con tres partes coleccionables. Mirá con qué encadena antes de arriesgar.":
    "It rolls its sand ball with three collectible parts. See what it chains with before you risk it.",
  "La primera parte Shiny de un rival común: tornasolada, pero juega como cualquier otra. Su veneno, en cambio, no perdona.":
    "The first Shiny part on a regular rival: iridescent, but it plays like any other. Its poison, though, is unforgiving.",
  "Silencio":
    "Silence",
  "Decimonoveno jefe: cuerpo místico y partes de Navidad y de Japón. Su cuerno, su espalda y su cola llevan Mít's Comfy Pillow, Red Sage o Spring Leaf.":
    "Nineteenth boss: a mystic body with Christmas and Japanese parts. Its horn, back and tail carry Mít's Comfy Pillow, Red Sage or Spring Leaf.",
  "Octavo jefe: cuerpo místico y partes de Japón y Agamo. Su cuerno y su cola llevan los poderes de este nivel.":
    "Eighth boss: mystic body and Japan and Agamo parts. Its horn and tail carry this level's powers.",
  "Decimoquinto jefe: cuerpo de pesadilla, cola Shiny y partes de Navidad y de Japón. Su espalda y su cuerno llevan los poderes de este nivel.":
    "Fifteenth boss: nightmare body, Shiny tail and Christmas and Japan parts. Its back and horn carry this level's powers.",
  "Decimosexto jefe: cuerpo místico, boca Shiny y partes de Japón y Agamo. Su cuerno y su cola llevan los poderes de este nivel.":
    "Sixteenth boss: mystic body, Shiny mouth and Japan and Agamo parts. Its horn and tail carry this level's powers.",
  "Decimoséptimo jefe: cuerpo de escarcha, partes de Navidad y de Japón y una boca mística. Su cuerno y sus ojos llevan los poderes de este nivel.":
    "Seventeenth boss: frost body, Christmas and Japan parts and a mystic mouth. Its horn and eyes carry this level's powers.",
  "El último antes del Autómata. Su corazón de acero aguanta 270.":
    "The last one before the Automaton. Its steel heart holds 270.",
  "Noveno jefe: cuerpo y partes de verano, y un cuerno de Japón. Su espalda lleva un poder de este nivel.":
    "Ninth boss: summer body and parts, and a Japan horn. Its back carries a power from this level.",
  "Undécimo jefe, todo de partes coleccionables: Japón, Navidad y una boca mística. Su espalda y su cuerno llevan los poderes de este nivel.":
    "Eleventh boss, all collectible parts: Japan, Christmas and a mystic mouth. Its back and horn carry this level's powers.",
  "El Shogun del Valle":
    "The Valley Shogun",
  "Primer jefe, con más vida que vos y partes de evento con amuleto: llevan los poderes de este nivel. Mirá cuáles antes de pegarle.":
    "First boss, with more life than you and event parts with charms: they carry this level's powers. Check which before you hit it.",
  "Segunda Chance":
    "Second Chance",
  "La Gaviota planea sobre la playa y baja cuando te ve dudar.":
    "The Gull glides over the beach and swoops when it sees you hesitate.",
  "Marea de Burbujas":
    "Bubble Tide",
  "Un rival de Pez que encadena con casi todo su mazo. Sé paciente.":
    "An Aquatic rival whose deck chains with almost everything. Be patient.",
  "Brotes de Primavera":
    "Spring Sprouts",
  "El Musgo crece despacio. Ganale antes de que se acomode.":
    "The Moss grows slowly. Beat it before it settles in.",
  "Paso de Caracol":
    "Snail's Pace",
  "El Ermitaño no sale de su caparazón: pega poco, pero pega siempre.":
    "The Hermit never leaves its shell: it hits little, but it always hits.",
  "Caparazón de Espinas":
    "Spiked Shell",
  "La Tortuga aguanta todo. Armá una cadena larga y soltala entera.":
    "The Turtle takes everything. Build a long chain and let it all out.",
  "Solazo, Rey de la Playa":
    "Solazo, King of the Beach",
  "Guardia de Invierno":
    "Winter Guard",
  "Un pino de guardia en la nieve. Tus amuletos ya alcanzan para pasarlo.":
    "A pine on guard in the snow. Your charms are enough to get past it.",
  "Bomba de Hielo":
    "Ice Bomb",
  "El Témpano parece quieto, pero se lleva lo mejor del centro.":
    "The Iceberg looks still, but it takes the best of the center.",
  "Colmillo Helado":
    "Frozen Fang",
  "La Ventisca pega rápido y se corta seguido. Aguantá.":
    "The Blizzard hits fast and busts often. Hold on.",
  "Escáner de Escarcha":
    "Frost Scanner",
  "La Escarcha te espera con el mazo lleno de bichos. Contá sus símbolos.":
    "The Frost waits with a deck full of bugs. Count its symbols.",
  "Filo de Carámbano":
    "Icicle Edge",
  "El Carámbano tiene filo. No le des el primer golpe gratis.":
    "The Icicle is sharp. Don't give it the first hit for free.",
  "Nevisca, la Tormenta Blanca":
    "Nevisca, the White Storm",
  "Plumas Negras":
    "Black Feathers",
  "Desde acá cada rival trae partes evolucionadas: sus cartas llevan un símbolo más y encadenan mejor.":
    "From here on every rival brings evolved parts: their cards carry one more symbol and chain better.",
  "Hiedra Roja":
    "Red Ivy",
  "La Hiedra trepa por la cueva y se te enreda en la cadena.":
    "The Ivy climbs the cave and tangles in your chain.",
  "Aguas Profundas":
    "Deep Waters",
  "Aguas profundas y un rival que no se apura. Pegale fuerte.":
    "Deep waters and a rival in no hurry. Hit it hard.",
  "Aullido":
    "Howl",
  "El Lobo aúlla antes de pegar. Cuando aúlla, plantate.":
    "The Wolf howls before it strikes. When it howls, stand.",
  "Guantes Venenosos":
    "Poison Gloves",
  "La Mamba es rápida y no avisa. Que no te tome con la vida baja.":
    "The Mamba is fast and gives no warning. Don't let it catch you low.",
  "Umbra, la Pesadilla":
    "Umbra, the Nightmare",
  "Martillo del Cielo":
    "Sky Hammer",
  "El Halcón baja en picada sobre el Coliseo. Plantate a tiempo.":
    "The Hawk dives over the Colosseum. Stand in time.",
  "Flor de Loto":
    "Lotus Flower",
  "El Loto flota en medio de la arena, tranquilo. No te confíes.":
    "The Lotus floats calmly in the middle of the arena. Don't get cocky.",
  "El Kraken":
    "The Kraken",
  "El Kraken se lleva lo que quiere del centro. Elegí rápido.":
    "The Kraken takes what it wants from the center. Pick fast.",
  "Furia Desatada":
    "Unleashed Fury",
  "Furia pura en la arena: pega de a mucho y se corta de a poco.":
    "Pure fury in the arena: it hits big and rarely busts.",
  "El Truco de la Mantis":
    "The Mantis's Trick",
  "La Mantis espera inmóvil a que te cortes. Que no pase.":
    "The Mantis waits, motionless, for you to bust. Don't let it happen.",
  "Basilisco Místico":
    "Mystic Basilisk",
  "{p1} de vida contra {p2}.":
    "{p1} HP against {p2}.",
  "Jefe":
    "Boss",
  "{n} partes evolucionadas":
    "{n} evolved parts",
  "1 parte evolucionada":
    "1 evolved part",
  "Capítulo {n} · {name}":
    "Chapter {n} · {name}",
  "Capítulo {n}":
    "Chapter {n}",
  "También pueden salir":
    "Can also show up",
  "{hp} de vida":
    "{hp} HP",
  "Evolucionadas: {parts}. Cada carta de una parte evolucionada suma un símbolo y encadena mejor.":
    "Evolved: {parts}. Each card of an evolved part adds a symbol and chains better.",
  "Poder nuevo":
    "New power",
  '¡Pelear!': 'Fight!',
  'Vencé a {boss} para seguir el viaje': 'Beat {boss} to continue the journey',
  'Capítulo anterior': 'Previous chapter',
  'Capítulo siguiente': 'Next chapter',
  'Detalles': 'Details',
  'Menos': 'Less',
  'Nuevo': 'New',
  'Por K.O.': 'By K.O.',
  'Nivel {n} · {rival}': 'Level {n} · {rival}',
  // La barra de pestañas de la portada y sus pantallas (ver `lobby.js`).
  'Secciones': 'Sections',
  'Duelos': 'Duels',
  'Taller': 'Workshop',
  'Próximamente': 'Coming soon',
  'Acá vas a fabricar cartas nuevas para tu mochila.': 'Here you will craft new cards for your backpack.',
  'Aprendé a jugar en cinco rondas': 'Learn to play in five rounds',
  'Elegido': 'Chosen',
  // El inventario y la mochila (ver `lobby.js` y `backpack.js`).
  'Mochila': 'Backpack',
  'Inventario': 'Inventory',
  'LVL': 'LVL',
  'Mazo': 'Deck',
  'De la mochila': 'From the backpack',
  '{count} cartas · {extras} de la mochila': '{count} cards · {extras} from the backpack',
  'Cartas de la mochila: {n}': 'Backpack cards: {n}',
  'Sumar una carta de la mochila': 'Add a card from the backpack',
  'Devolver a la mochila': 'Return to the backpack',
  'Mochila · para {name}': 'Backpack · for {name}',
  'La mochila está vacía.': 'The backpack is empty.',
  '{name} no tiene más espacio.': '{name} has no more room.',
  'Tocá una carta para sumarla a su mazo.': 'Tap a card to add it to the deck.',
  'No te quedan cartas sueltas.': 'You have no loose cards left.',
  '{n} cartas · se suman a un Axie desde su inventario': '{n} cards · add them to an Axie from its inventory',
  'Todas': 'All',
  'Reciclar': 'Recycle',
  'No': 'No',
  'Reciclar sueltas · {n}': 'Recycle loose · {n}',
  'Reciclado rápido · {n}': 'Quick recycle · {n}',
  'Ver todas': 'Show all',
  'Filtrar por símbolo': 'Filter by symbol',
  'Ninguna carta trae esos símbolos.': 'No card has those symbols.',
  'Ninguna carta trae ese símbolo.': 'No card has that symbol.',
  'Recicla todo lo que no tiene puesto ningún Axie': 'Recycles everything no Axie has equipped',
  '¿Reciclar las {n} sueltas? No se recuperan.': 'Recycle all {n} loose cards? They can\'t be recovered.',
  '¿Reciclar las {n} sueltas? {k} tienen poder. No se recuperan.': 'Recycle all {n} loose cards? {k} have a power. They can\'t be recovered.',
  '¿Reciclar {n} sueltas? No se recuperan.': 'Recycle {n} loose cards? They can\'t be recovered.',
  '¿Seguro? La carta se rompe y no se recupera.': 'Sure? The card breaks and can\'t be recovered.',
  'Sacala de {name} para reciclarla.': 'Take it off {name} to recycle it.',
  'Equipada en {name}': 'Equipped on {name}',
  'Cartas': 'Cards',
  'Poderes': 'Powers',
  'Lista para fusionar': 'Ready to merge',
  'Reciclaste una carta: +{n} Moonshards': 'You recycled a card: +{n} Moonshards',
  'Reciclaste {count} cartas: +{n} Moonshards': 'You recycled {count} cards: +{n} Moonshards',
  'En {name}': 'On {name}',
  // La fusión, en la mochila (paintMerge en lobby.js)
  'Fusionar': 'Merge',
  'Fusionar otra': 'Merge another',
  '¡{tier}!': '{tier}!',
  'Queda 1 símbolo y gana un poder de su clase': 'Keeps 1 symbol and gains a power of its class',
  'Gana 1 símbolo al azar': 'Gains 1 random symbol',
  '{n} de {k} para fusionar': '{n} of {k} to merge',
  'Listas para fusionar': 'Ready to merge',
  'Mochila ×{n}': 'Backpack ×{n}',
  '¡En la mochila!': 'In the backpack!',
  'Abrir la mochila': 'Open the backpack',
  // Categorías de los poderes (MOMENTS en data.js)
  'Al robar': 'On draw',
  'Al atacar': 'On attack',
  'Al cortarte': 'On bust',
  'Se activa apenas la robás, aunque después te cortes.': 'Triggers as soon as you draw it, even if you bust later.',
  'Se activa cuando te plantás sin cortarte, aunque el golpe haga 0.': 'Triggers when you stand without busting, even if the hit deals 0.',
  'Se activa solo si se corta tu cadena.': 'Triggers only if your chain busts.',
  'Algunas cartas traen un poder. No cuenta para la cadena: se activa en uno de tres momentos, y su etiqueta te dice cuál.':
    'Some cards carry a power. It does not count for the chain: it triggers at one of three moments, and its tag tells you which.',
  'Todos los poderes, con lo que hace cada uno, están en Símbolos especiales.': 'Every power and what it does is listed in Special Symbols.',
  'Algunas cartas traen un poder. No cuenta para la cadena: su etiqueta dice cuándo se activa.':
    'Some cards carry a power. It does not count for the chain: its tag says when it triggers.',
  // Poderes: la explicación sin su momento (lo dice la etiqueta).
  'el huevo se rompe: la carta que te cortó vuelve a tu mazo y seguís jugando (una segunda chance por huevo)':
    'the egg breaks: the card that busted you goes back to your deck and you keep playing (one second chance per egg)',
  'La carta vuelve al mazo y seguís':
    'The card goes back and you keep going',
  '{dmg} de daño directo al rival':
    '{dmg} direct damage to the rival',
  '{dmg} de daño directo':
    '{dmg} direct damage',
  '+1 pluma (hasta {max}); tu próximo ataque las gasta: +{step} de daño y +{step} de vida por pluma':
    '+1 feather (up to {max}); your next attack spends them: +{step} damage and +{step} HP per feather',
  'el rival pierde {n} de escudo':
    'the rival loses {n} shield',
  'elegís 1 carta extra del centro para tu mazo':
    'you pick 1 extra card from the center for your deck',
  'la carta que elijas del centro abre tu próxima ronda':
    'the card you pick from the center opens your next round',
  '+1 burbuja; con {at} estalla una bomba de {dmg} contra el rival (el escudo la frena)':
    '+1 bubble; at {at} a {dmg} bomb blows up on the rival (shield stops it)',
  'el rival elige a ciegas del centro en su próximo reparto y no lo puede renovar (un reparto más por medusa); si no se lleva nada, se le pasa':
    'the rival picks blind from the center in their next draft and can’t renew it (one more draft per jellyfish); if they take nothing, it wears off',
  'el rival no puede llevarse cartas con poder del centro hasta que se lleve una sin poder (una más por burbuja)':
    'the rival can’t take power cards from the center until they take a plain one (one more per bubble)',
  '+{n} de sangrado al rival (hasta {max}): cada carta que robe le saca vida igual a su sangrado, y el sangrado baja 1':
    '+{n} bleed on the rival (up to {max}): each card they draw costs HP equal to their bleed, and bleed drops by 1',
  '+1 garra para toda la partida (hasta {max}): cada ataque tuyo le pone +{bleed} de sangrado al rival por garra':
    '+1 claw for the whole match (up to {max}): each of your attacks puts +{bleed} bleed on the rival per claw',
  '+{n} de sangrado al rival y herida abierta: en su próximo turno, robar no le baja el sangrado':
    '+{n} bleed on the rival and an open wound: on their next turn, drawing doesn’t lower their bleed',
  '+1 de Rage (hasta {max}): cada punto suma +{step} al daño de tus golpes, para toda la partida. Con {max} entrás en Furia: tu próximo ataque suma +{fury} más y la Rage vuelve a 0':
    '+1 Rage (up to {max}): each point adds +{step} damage to your hits, for the whole match. At {max} you enter Fury: your next attack adds +{fury} more and Rage resets to 0',
  'te curás {heal}':
    'you heal {heal}',
  '+{turns} turnos de brote (hasta {max}): al empezar cada turno tuyo te curás {heal} y se gasta uno':
    '+{turns} sprout turns (up to {max}): at the start of each of your turns you heal {heal} and one is spent',
  '+{shield} de escudo y 1 Limpiador: cancela el próximo efecto que te ponga el rival (veneno, sangrado, debilidad, bloqueos)':
    '+{shield} shield and 1 Cleanser: cancels the next effect the rival puts on you (poison, bleed, weakness, locks)',
  'te sacás veneno, sangrado, debilidad y bloqueos, y te curás {heal}':
    'you clear poison, bleed, weakness and locks, and heal {heal}',
  'el próximo golpe rival te saca {cap} de vida como máximo; cada almohada más lo baja {step} (hasta {floor})':
    'the rival’s next hit takes {cap} HP at most; each extra pillow lowers it by {step} (down to {floor})',
  'le robás {drain} de vida al rival, sin que lo frene su escudo':
    'you steal {drain} HP from the rival, ignoring their shield',
  'Le robás {drain} de vida al rival':
    'Steal {drain} HP from the rival',
  'en el próximo ataque del rival no cuenta su mejor racha (con dos caracoles, tampoco la segunda)':
    'on the rival’s next attack their best streak doesn’t count (with two snails, neither does the second)',
  '+{turns} turnos de capullo (hasta {max}): al empezar cada turno tuyo ganás {shield} de escudo y se gasta uno':
    '+{turns} cocoon turns (up to {max}): at the start of each of your turns you gain {shield} shield and one is spent',
  'le sacás hasta {n} de escudo al rival y pasa a ser tuyo; si no tiene, ganás {m}':
    'you take up to {n} shield from the rival and it becomes yours; if they have none, you gain {m}',
  'elegís una carta con poder del rival: su poder se apaga hasta que la juegue':
    'you pick one of the rival’s power cards: its power is off until they play it',
  '+{dose} de veneno al rival (hasta {max}); al final de cada turno suyo le saca eso sin importar su escudo, y baja 1':
    '+{dose} poison on the rival (up to {max}); at the end of each of their turns it deals that much, ignoring shield, then drops by 1',
  '+{n} espinas (hasta {max}): el próximo golpe del rival que conecte le devuelve eso':
    '+{n} spikes (up to {max}): the rival’s next hit that lands takes that back',
  'la próxima vez que el rival gane vida o escudo, no gana nada':
    'the next time the rival would gain HP or shield, they gain nothing',
  'el próximo golpe del rival que conecte le pone {n} de veneno':
    'the rival’s next hit that lands gives them {n} poison',
  'no te corta: lo ponés sobre la carta de la mesa que elijas y le suma sus símbolos':
    'it never busts you: you place it on the card of your choice on the field, adding its symbols',
  'Ponelo sobre una carta':
    'Place it on a card',
  // La evolución de las cartas (ver `evolve-view.js` y `evolve-scene.js`).
  'Tu mazo al evolucionar: {part}': 'Your deck after evolving: {part}',
  '{symbol} en tu mazo: {from}% → {to}%': '{symbol} in your deck: {from}% → {to}%',
  'Evoluciones': 'Evolutions',
  'Cartas favorables': 'Favorable cards',
  'Moonshards': 'Moonshards',
  '{n} Moonshards': '{n} Moonshards',
  'Nivel máximo': 'Max level',
  'Evolución {n}: hecha': 'Evolution {n}: done',
  'Evolución {n}: nivel {level} · {cost} Moonshards': 'Evolution {n}: level {level} · {cost} Moonshards',
  'Las seis cartas evolucionaron': 'All six cards have evolved',
  '¡Evolución disponible!': 'Evolution available!',
  'Próxima evolución en el nivel {n}': 'Next evolution at level {n}',
  'Cartas favorables · {n}/6 evolucionadas': 'Favorable cards · {n}/6 evolved',
  'Evolucionada': 'Evolved',
  '{part} · evolucionada': '{part} · evolved',
  'Suma {symbol} a tu mazo.': 'Adds {symbol} to your deck.',
  'Se abre en el nivel {n}': 'Unlocks at level {n}',
  'Te faltan {n} Moonshards': 'You need {n} more Moonshards',
  'Evolucionar: {part}': 'Evolve: {part}',
  'La parte es de {class}: la carta suma ese símbolo.': 'This part is {class}: the card gains that symbol.',
  'Evolucionar': 'Evolve',
  'Evolución': 'Evolution',
  '¡Evolución!': 'Evolution!',
  '{part} de {name}': '{name}’s {part}',
  'Evolución {n}/6': 'Evolution {n}/6',
  'Seguir': 'Continue',
  // La zona de testeo: la evolución (ver `sandbox.js`).
  'Del Axie elegido en Partida: su nivel, sus evoluciones y tus Moonshards.': 'For the Axie chosen under Match: its level, its evolutions and your Moonshards.',
  '+1 nivel': '+1 level',
  '+10 niveles': '+10 levels',
  'Nivel 60': 'Level 60',
  '+1.000 Moonshards': '+1,000 Moonshards',
  'Sin evoluciones': 'Clear evolutions',
  'Abrir el Taller': 'Open the Workshop',
  'Abrir su evolución': 'Open its evolution',
  // El Taller: la forja de cartas (ver `workshop.js` y `crafting.js`).
  'Crear cartas': 'Craft cards',
  'Cartas sueltas para tu mochila, con símbolos al azar.': 'Loose cards for your backpack, with random symbols.',
  'Probabilidades': 'Odds',
  'Ver en la mochila': 'See in backpack',
  'Común': 'Common',
  'Poco común': 'Uncommon',
  'Rara': 'Rare',
  'Épica': 'Epic',
  'Legendaria': 'Legendary',
  'Mítica': 'Mythic',
  '1 símbolo': '1 symbol',
  '{n} símbolos': '{n} symbols',
  '{symbols} + poder de clase': '{symbols} + class power',
  '¡La próxima trae poder!': 'The next one has a power!',
  'Carta con poder asegurada en {n}': 'Power card guaranteed in {n}',
  'Crear ×1': 'Craft ×1',
  'Cambia {n} llaves comunes por una de oro y la usa': 'Trades {n} common keys for a gold one and uses it',
  'Compra una llave de oro y la usa': 'Buys a gold key and uses it',
  '¡La próxima de oro es legendaria!': 'The next gold one is Legendary!',
  'Legendaria asegurada en {n}': 'Legendary guaranteed in {n}',
  'Usa una de tus {n} llaves de oro': 'Uses one of your {n} gold keys',
  'Crear ×{n}': 'Craft ×{n}',
  'Una carta nueva en tu mochila': 'One new card in your backpack',
  '{n} cartas nuevas en tu mochila': '{n} new cards in your backpack',
  'Cada símbolo sale entre las seis clases y se pueden repetir. Cada {n} cartas, una con poder asegurada.':
    'Each symbol is drawn from the six classes and can repeat. Every {n} cards, one power card is guaranteed.',
  '{name}: nivel {level} · {n} evolucionadas · {shards} Moonshards': '{name}: level {level} · {n} evolved · {shards} Moonshards',

  // ---- el resumen y el botín de la pantalla del final (result.js, payout.js) ----
  'Resumen': 'Summary',
  'AXP de {name}': '{name}\'s AXP',
  'En la bolsa': 'In your pouch',
  'Por la victoria': 'For the win',
  'Por la victoria por K.O.: el doble': 'For the K.O. win: double',
  'Primera victoria del nivel': 'First win on this level',
  'Primera victoria del nivel, por K.O.: el doble': 'First win on this level, by K.O.: double',
  'Por la estrella del K.O.': 'For the K.O. star',
  'Contra la CPU se practica: no se ganan Moonshards ni AXP.': 'Playing the CPU is practice: no Moonshards or AXP.',
  'Ganá para llevarte Moonshards y AXP.': 'Win to earn Moonshards and AXP.',
  'En el empate nadie se lleva Moonshards ni AXP.': 'In a draw nobody earns Moonshards or AXP.',
  'Un abandono antes de la ronda {round} no paga.': 'A forfeit before round {round} pays nothing.',
  'Este nivel ya lo ganaste: paga solo la primera vez.': 'You already beat this level: it only pays the first time.',
  'Ganalo por K.O. y te llevás la estrella y {n} Moonshards.': 'Win it by K.O. to get the star and {n} Moonshards.',
  '¡{name} subió al nivel {level}!': '{name} reached level {level}!',
  'Se abrió una evolución': 'An evolution unlocked',
  // Las misiones (`missions.js`)
  'Jugá {n} batallas': 'Play {n} battles',
  'Ganá {n} batallas': 'Win {n} battles',
  'Atacá con una cadena de {n} o más': 'Attack with a chain of {n} or more',
  'Pegá un golpe de {n} o más': 'Land a hit of {n} or more',
  'Hacé {n} de daño': 'Deal {n} damage',
  'Curate {n} de vida': 'Heal {n} HP',
  'Llevate {n} cartas del centro': 'Take {n} cards from the center',
  'Robá {n} cartas con poder': 'Draw {n} power cards',
  'Apilá {n} Rocket Stamps': 'Stack {n} Rocket Stamps',
  'Hacé {n} de daño con sangrado': 'Deal {n} bleed damage',
  'Hacé {n} de daño directo con plumas y shuriken': 'Deal {n} direct damage with feathers and shuriken',
  'Robale al rival {n} de vida o escudo': 'Steal {n} HP or shield from your rival',
  'Hacé {n} de daño con veneno o espinas': 'Deal {n} poison or thorn damage',
  'Ganá una batalla': 'Win a battle',
  'Creá una carta en el Taller': 'Create a card in the Workshop',
  'Ganá un nivel de la Aventura': 'Win an Adventure level',
  'Jugá una batalla multijugador': 'Play a multiplayer battle',
  'Ganá por K.O.': 'Win by K.O.',
  'Ganá con {n} de vida o más': 'Win with {n} HP or more left',
  'Ganá sin cortarte': 'Win without busting',
  'Ganá una batalla multijugador': 'Win a multiplayer battle',
  'Ganá {n} batallas por K.O.': 'Win {n} battles by K.O.',
  'Atacá {n} veces con una cadena de {v} o más': 'Attack {n} times with a chain of {v} or more',
  'Jugá {n} batallas multijugador': 'Play {n} multiplayer battles',
  'Ganá {n} batallas con un Axie {cls}': 'Win {n} battles with a {cls} Axie',
  'Robá {n} cartas con poder de {cls}': 'Draw {n} {cls} power cards',
  'Creá {n} cartas en el Taller': 'Create {n} cards in the Workshop',
  'Fusioná {n} cartas': 'Fuse {n} cards',
  'Reciclá {n} cartas': 'Recycle {n} cards',
  'Ganá {n} niveles distintos de la Aventura': 'Win {n} different Adventure levels',
  'Ganá {n} niveles de la Aventura por K.O.': 'Win {n} Adventure levels by K.O.',
  'Subí de nivel a un Axie': 'Level up an Axie',
  'Ganá con {n} Axies distintos': 'Win with {n} different Axies',
  'Ganá {n} batallas con cartas de la mochila puestas': 'Win {n} battles with backpack cards equipped',
  'Ganá {n} batallas seguidas': 'Win {n} battles in a row',
  'Ganá con {n} de vida o menos': 'Win with {n} HP or less left',
  'Vencé a un jefe de la Aventura': 'Beat an Adventure boss',
  'Hacé un K.O. con ¿UNA MÁS?': 'Land a K.O. on ONE MORE?',
  'Ganá {n} batallas sin cortarte': 'Win {n} battles without busting',
  'Ganá {n} batallas multijugador por K.O.': 'Win {n} multiplayer battles by K.O.',
  // El panel de las misiones (`missions-view.js`)
  'Misiones': 'Missions',
  'Ocultar misiones': 'Hide missions',
  'Misiones: {n} para cobrar': 'Missions: {n} to claim',
  'Llave común': 'Common key',
  'Llave de oro': 'Gold key',
  'AXP': 'AXP',
  '{d} d {h} h': '{d}d {h}h',
  '{d} d': '{d}d',
  '{h} h {m} min': '{h}h {m}m',
  '{h} h': '{h}h',
  '{m} min': '{m}m',
  'Cobrar': 'Claim',
  'Cobrada': 'Claimed',
  'Cambiar esta misión por otra (una por día)': 'Swap this mission for another (one a day)',
  'Cambiar misión': 'Swap mission',
  'Puntos del pase': 'Pass points',
  'Pase de temporada': 'Season pass',
  'Temporada {n}': 'Season {n}',
  'termina en {t}': 'ends in {t}',
  'Del día': 'Daily',
  'Semana': 'Weekly',
  'Pase': 'Pass',
  'Cobrar el escalón {n}': 'Claim tier {n}',
  'Tus llaves': 'Your keys',
  'Escalón': 'Tier',
  'de {n}': 'of {n}',
  '¡Completo!': 'Complete!',
  '{a} de {b} puntos': '{a} of {b} points',
  'Cada misión cumplida suma puntos; cada {n}, un escalón.': 'Every mission you complete adds points; every {n}, a tier.',
  'Cobrar todo': 'Claim all',
  'Pasado el {n}, una llave cada {p} puntos.': 'Past tier {n}, a key every {p} points.',
  'La AXP va a {name}, tu Axie elegido.': 'AXP goes to {name}, your chosen Axie.',
  // Los poderes rebalanceados (2026-10).
  '{dmg} de daño al rival; su escudo lo frena primero': '{dmg} damage to the rival; their shield stops it first',
  '{dmg} de daño al rival': '{dmg} damage to the rival',
  '+1 pluma (hasta {max}); tu próximo ataque las gasta: +{step} de daño por pluma':
    '+1 feather (up to {max}); your next attack spends them: +{step} damage per feather',
  '+1 pluma: +{step} de daño en tu próximo golpe': '+1 feather: +{step} damage on your next hit',
  'el rival pierde todo su escudo': 'the rival loses all their shield',
  'El rival pierde todo su escudo': 'The rival loses all their shield',
  'le mezclás {n} medusas en el mazo al rival: no tienen símbolos, así que si roba una con la cadena abierta se corta, y si abre con una no arma nada. Cada medusa se rompe apenas sale':
    'you shuffle {n} jellyfish into the rival\'s deck: they have no symbols, so drawing one with an open chain busts it, and opening with one builds nothing. Each jellyfish breaks as soon as it comes out',
  '{n} medusas en el mazo del rival: lo cortan': '{n} jellyfish in the rival\'s deck: they bust them',
  'el rival no puede llevarse cartas con poder del centro hasta que se lleve {n} sin poder':
    'the rival cannot take power cards from the market until they take {n} without power',
  '+{n} de sangrado al rival: cada carta que robe le saca {dmg} de vida, y el sangrado baja 1':
    '+{n} bleed on the rival: each card they draw costs them {dmg} HP, and bleed drops by 1',
  '+{n} de sangrado al rival y herida abierta: en su próximo turno, cada carta que pague sangrando te cura {heal}':
    '+{n} bleed on the rival and an open wound: on their next turn, each card they pay bleeding heals you {heal}',
  '+{n} de sangrado: lo que sangre te cura': '+{n} bleed: what they bleed heals you',
  'durante los próximos {turns} turnos del rival, cada ataque suyo te saca {cut} menos; cada almohada más suma {turns} turnos':
    'for the rival\'s next {turns} turns, each of their attacks takes {cut} less from you; each extra pillow adds {turns} turns',
  '−{cut} a sus ataques por {turns} turnos': '−{cut} to their attacks for {turns} turns',
  'le pegás {drain} al rival (su escudo lo frena primero) y te curás lo que le llegue a la vida':
    'you hit the rival for {drain} (their shield stops it first) and heal what reaches their HP',
  'Le robás hasta {drain} de vida al rival': 'Steal up to {drain} HP from the rival',
  'en el próximo ataque del rival que no se corte, no cuenta su mejor racha (con dos caracoles, tampoco la segunda)':
    'in the rival\'s next attack that doesn\'t bust, their best streak doesn\'t count (with two snails, the second one neither)',
  'le sacás todo el escudo al rival y pasa a ser tuyo; si no tiene, ganás {m}':
    'you take all the rival\'s shield and it becomes yours; if they have none, you gain {m}',
  'Le robás el escudo (o ganás {m})': 'Steal their shield (or gain {m})',
  'elegís una carta con poder del mazo del rival, Rocket incluido, y pasa a tu mazo':
    'pick a power card from the rival\'s deck, Rocket included, and it goes to your deck',
  'Le robás una carta con poder al rival': 'Steal a power card from the rival',
  'el próximo turno en que el rival se cure, no le entra ninguna cura de ese turno':
    'the next turn the rival heals, no healing of that turn gets through',
  'Le cancelás la cura de un turno al rival': 'Cancel a turn of the rival\'s healing',
  '+{n} de veneno para los dos; al final de este turno tu veneno te cura en vez de dañarte':
    '+{n} poison for both; at the end of this turn your poison heals you instead of hurting you',
  '+{n} de veneno a los dos: el tuyo te cura este turno': '+{n} poison to both: yours heals you this turn',
  'Medusa': 'Jellyfish',
  'Una medusa: no comparte nada y se rompe.': 'A jellyfish: it shares nothing and breaks.',
  'Energy Drink M: la herida cura {got} a {who}.': 'Energy Drink M: the wound heals {who} for {got}.',
  'Gloves of Infection: {n} de veneno para {who} también; al final de este turno le cura.':
    'Gloves of Infection: {n} poison for {who} too; at the end of this turn it heals.',
  "Viper's Venom: este turno no le entra ninguna cura {to}.": "Viper's Venom: no healing gets through {to} this turn.",
  'Flamingo Hammer: le rompe los {lost} de escudo {to}.': 'Flamingo Hammer: breaks all {lost} shield {to}.',
  'Paralyzing Jellyfish: {n} medusas en el mazo {of}.': 'Paralyzing Jellyfish: {n} jellyfish in the deck {of}.',
  "Trickster's Card: {n} carta del rival para robar.": "Trickster's Card: {n} rival card to steal.",
  'Energy Drink M: herida abierta para {who}: en su próximo turno, lo que sangre te cura.':
    'Energy Drink M: open wound for {who}: on their next turn, what they bleed heals you.',
  "Viper's Venom: el próximo turno en que {who} se cure, no le entra nada ({n} turnos).":
    "Viper's Venom: the next turn {who} heals, nothing gets through ({n} turns).",
  "Mít's Comfy Pillow: los ataques {to} sacan {cut} menos durante {turns} turnos del rival.":
    "Mít's Comfy Pillow: attacks {to} take {cut} less for {turns} rival turns.",
  "Mít's Comfy Pillow frena el golpe: le resta {mitigated}.": "Mít's Comfy Pillow softens the hit: {mitigated} less.",
  'Gloves of Infection: el veneno cura {got} a {who} (veneno {left}).': 'Gloves of Infection: the poison heals {who} for {got} (poison {left}).',
  "Trickster's Card: el rival no tiene cartas con poder para robar.": "Trickster's Card: the rival has no power cards to steal.",
  "Trickster's Card: le roba {power} {to}.": "Trickster's Card: steals {power} {to}.",
  "Trickster's Card: no roba nada.": "Trickster's Card: steals nothing.",
  'cura con la herida': 'heals with the wound',
  'sale la medusa': 'jellyfish comes out',
  'se infecta': 'gets infected',
  'el veneno cura': 'poison heals',
  'Sangrado: sus próximas {bleed} cartas le sacan {dmg} de vida cada una (herida abierta: lo que sangre cura al rival)':
    'Bleed: their next {bleed} cards cost {dmg} HP each (open wound: what they bleed heals the rival)',
  'Sangrado: sus próximas {bleed} cartas le sacan {dmg} de vida cada una': 'Bleed: their next {bleed} cards cost {dmg} HP each',
  '{name}: este turno no le entra ninguna cura': '{name}: no healing gets through this turn',
  '{name}: el próximo turno en que se cure, no le entra nada ({n} turnos)': '{name}: the next turn they heal, nothing gets through ({n} turns)',
  '{name}: {n} medusas en su mazo, que lo cortan al salir': '{name}: {n} jellyfish in their deck, which bust them when drawn',
  '{name}: +{dmg} de daño en el próximo golpe que conecte': '{name}: +{dmg} damage on the next hit that lands',
  '{name}: al final de este turno su veneno le cura': '{name}: at the end of this turn their poison heals them',
  '{name}: los ataques rivales le sacan {cut} menos durante {n} turnos': '{name}: rival attacks take {cut} less for {n} turns',
  '{at}está eligiendo qué carta robar…': '{at}is choosing which card to steal…',
  'Elegí una carta del rival: pasa a tu mazo.': 'Pick a rival card: it goes to your deck.',
  'Elegí {n} cartas del rival: pasan a tu mazo.': 'Pick {n} rival cards: they go to your deck.',
  'No robar': "Don't steal",
  'Sumadas en la partida · {count}': 'Added this match · {count}',
  'Sumadas en la partida': 'Added this match',
  // Los amuletos neutrales de la Aventura.
  "+1 foco para toda la partida (hasta {max}): cada ataque tuyo suma +{step} de daño por foco":
    "+1 focus for the whole match (up to {max}): each of your attacks deals +{step} damage per focus",
  "+{step} de daño en todos tus ataques":
    "+{step} damage on all your attacks",
  "ves las {n} cartas de arriba de tu mazo antes de decidir si robás otra":
    "you see the top {n} cards of your deck before deciding whether to draw again",
  "Ves las {n} cartas que siguen":
    "See the next {n} cards",
  "elegís uno: te curás {n}, ganás {n} de escudo o le pegás {n} al rival":
    "pick one: heal {n}, gain {n} shield or deal {n} to the rival",
  "Elegís: curar, escudo o daño ({n})":
    "Pick: heal, shield or damage ({n})",
  "copia los símbolos de la carta anterior de tu cadena, así que engancha siempre; si abre la ronda, vale con los suyos":
    "copies the symbols of the previous card in your chain, so it always links; if it opens the round, it keeps its own",
  "Copia la carta anterior: engancha siempre":
    "Copies the previous card: always links",
  "los puntos de tu cadena valen el doble en este ataque, y la bebida se rompe: sale de tu mazo para siempre":
    "your chain points count double in this attack, and the drink breaks: it leaves your deck for good",
  "Tu cadena vale el doble; después se rompe":
    "Your chain counts double; then it breaks",
  "en ronda par tu golpe suma +{dmg}; en ronda impar ganás {shield} de escudo":
    "on even rounds your hit deals +{dmg}; on odd rounds you gain {shield} shield",
  "Par: +{dmg} de daño. Impar: +{shield} de escudo":
    "Even: +{dmg} damage. Odd: +{shield} shield",
  "en ronda impar te curás {heal}; en ronda par le ponés +{bleed} de sangrado al rival":
    "on odd rounds you heal {heal}; on even rounds the rival gets +{bleed} bleed",
  "Impar: te curás {heal}. Par: +{bleed} de sangrado":
    "Odd: heal {heal}. Even: +{bleed} bleed",
  "tu golpe suma +{dmg}, pero vos quedás con +{self} de sangrado":
    "your hit deals +{dmg}, but you get +{self} bleed",
  "+{dmg} de daño; vos sangrás {self}":
    "+{dmg} damage; you bleed {self}",
  "antes de tu golpe le sacás al rival lo que tiene encima: escudo, espinas, plumas, Rage, almohada y regalo":
    "before your hit you strip the rival of everything on it: shield, thorns, plumes, Rage, pillow and gift",
  "Le sacás escudo, espinas y lo demás":
    "Strips shield, thorns and the rest",
  "te llevás una carta del centro de regalo, la que quieras, aparte de lo que te toque":
    "you take one free card of your choice from the center, on top of what you get",
  "Una carta del centro de regalo":
    "A free card from the center",
  "la cadena queda pegada hasta la última cinta: atacás con lo que tenías hasta ahí, pero no te llevás nada del centro":
    "your chain sticks up to the last tape: you attack with what you had up to there, but you take nothing from the center",
  "Atacás con la cadena hasta la cinta":
    "Attack with the chain up to the tape",
  "guardás un regalo: tu próximo ataque suma +{dmg} (hasta {max})":
    "you keep a gift: your next attack deals +{dmg} (up to {max})",
  "+{dmg} en tu próximo ataque":
    "+{dmg} on your next attack",
  "Scotch Tape: {card} cortaba, pero la cadena queda pegada hasta la cinta. Atacás con eso.":
    "Scotch Tape: {card} would bust, but the chain sticks up to the tape. You attack with that.",
  "Scotch Tape: {card} cortaba, pero la cadena queda pegada hasta la cinta. {who} ataca con eso.":
    "Scotch Tape: {card} would bust, but the chain sticks up to the tape. {who} attacks with that.",
  "Red Mirror: copia {card}.":
    "Red Mirror: copies {card}.",
  "Novice Spell: cura {got} a {who}.":
    "Novice Spell: heals {who} for {got}.",
  "Novice Spell: +{got} de escudo para {who}.":
    "Novice Spell: +{got} shield for {who}.",
  "Novice Spell: {got} de daño {target} (queda en {hp}).":
    "Novice Spell: {got} damage {target} (down to {hp}).",
  "Charm of Focus: +{dmg} de daño en cada ataque, para toda la partida.":
    "Charm of Focus: +{dmg} damage on every attack, for the whole match.",
  "Lens of Revelation: ves las {n} cartas que siguen.":
    "Lens of Revelation: you see the next {n} cards.",
  "Lens of Revelation: {who} mira las {n} cartas que siguen.":
    "Lens of Revelation: {who} looks at the next {n} cards.",
  "Novice Spell: elegí curarte, escudarte o pegarle.":
    "Novice Spell: choose to heal, shield or hit.",
  "Novice Spell: {who} elige qué hace.":
    "Novice Spell: {who} chooses what it does.",
  "Earth Stamp: una carta del centro de regalo para {who}.":
    "Earth Stamp: a free card from the center for {who}.",
  "Earth Stamp: {n} cartas del centro de regalo para {who}.":
    "Earth Stamp: {n} free cards from the center for {who}.",
  "Last Gift: el próximo ataque {of} suma +{dmg}.":
    "Last Gift: the next attack {of} deals +{dmg}.",
  "Energy Drink S: la cadena vale el doble y la bebida se rompe.":
    "Energy Drink S: the chain counts double and the drink breaks.",
  "Papa Bear: ronda par, +{dmg} al golpe.":
    "Papa Bear: even round, +{dmg} to the hit.",
  "Papa Bear: ronda impar, +{got} de escudo para {who}.":
    "Papa Bear: odd round, +{got} shield for {who}.",
  "Mama Bear: ronda impar, cura {got} a {who}.":
    "Mama Bear: odd round, heals {who} for {got}.",
  "Bloodpact: +{dmg} al golpe, y {who} queda con {n} de sangrado.":
    "Bloodpact: +{dmg} to the hit, and {who} is left with {n} bleed.",
  "Black Sage: le saca todo lo que tenía encima {to}.":
    "Black Sage: strips everything off {to}.",
  "Black Sage: no había nada que sacar.":
    "Black Sage: there was nothing to strip.",
  "×{n} de la bebida":
    "×{n} from the drink",
  "+{dmg} de amuletos":
    "+{dmg} from charms",
  "Dejás pasar la carta de la Earth Stamp.":
    "You pass on the Earth Stamp card.",
  "{who} deja pasar la carta de la Earth Stamp.":
    "{who} passes on the Earth Stamp card.",
  "{name} elige":
    "{name} is choosing",
  "Te curás {n}":
    "Heal {n}",
  "Ganás {n} de escudo":
    "Gain {n} shield",
  "Le pegás {n} al rival":
    "Deal {n} to the rival",
  "Lo que sigue en tu mazo":
    "What comes next in your deck",
  "{name}: +{dmg} de daño en cada ataque, para toda la partida":
    "{name}: +{dmg} damage on every attack, for the whole match",
  "{name}: +{dmg} en el próximo ataque":
    "{name}: +{dmg} on the next attack",
  "{name}: {n} cartas del centro de regalo":
    "{name}: {n} free cards from the center",
  "Sus amuletos":
    "Its charms",
  "También en este nivel":
    "Also in this level",
  "Los poderes de este nivel":
    "This level's powers",
  "¡Pegada!":
    "Stuck!",
};

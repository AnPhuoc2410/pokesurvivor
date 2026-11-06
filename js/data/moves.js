/* ============ moves.js — move catalog ============
 *
 * kind (behavior, implemented in systems/combat.js):
 *   projectile  fires `count` projectiles at the nearest enemy
 *   melee       arced strike around the Pokémon
 *   beam        straight beam piercing everything in its path
 *   orbit       orbs orbiting around the user while active
 *   nova        radial burst in all directions
 *   aura        continuous damage circle around the user
 *   buff        boosts self stats (stackable, expires)
 *   ---- since 2026-10-10 (same sprites, new playstyles) ----
 *   boomerang   travels towards target and returns, hitting both ways
 *   chain       strikes one target and jumps to the next `count` nearest foes
 *   mine        ground mines that detonate on touch
 *   meteor      calls down `count` meteors on nearby foes (shadow telegraph)
 *   turret      spawns a turret that automatically shoots for `dur` seconds
 *   dash        dashes through foes dealing damage along the path (invulnerable)
 *   trail       leaves damaging hazard pools along the movement path
 *   cone        spread spray of short-range projectiles (breath, stream...)
 *   ---- since 2026-10-19 (more attacks per type) ----
 *   homing      projectiles that home in on enemies
 *   bounce      projectile bouncing from enemy to enemy `bounce` times
 *   charge      charges for `charge` s before releasing a massive beam
 *   spin        spins in place striking all around `count` consecutive times
 *   quake       shockwave traveling along the ground: `count` eruptions
 *   vortex      whirlpool pulling enemies inward while dealing damage
 *   shove       radial wave dealing damage and pushing enemies back
 *   stun        telegraphed zone that damages and stuns foes for `stun` s
 *
 * Only the ACTIVE move executes. Switch with 1-4 / Q / E / U I O P.
 *
 * Icons are procedurally generated: G.Icons composites them (type crest +
 * family badge), see ui/icons.js.
 *
 * Upgrades (lvl 1 -> 5) share standard ladders by `kind`:
 *   multiplicative mods -> dmg, cd, speed, radius, dur, amount, arc
 *   additive mods       -> count, pierce, stacks
 */
(() => {
  const LADDERS = {
    projectile: [
      { t: '+1 proyectil', m: { count: 1, spread: 1.4 } },
      { t: '+45% daño', m: { dmg: 1.45 } },
      { t: '-25% recarga', m: { cd: 0.75 } },
      { t: '+1 proyectil y +1 perforación', m: { count: 1, pierce: 1, spread: 1.2 } }
    ],
    melee: [
      { t: '+40% daño', m: { dmg: 1.40 } },
      { t: '+25% alcance', m: { radius: 1.25 } },
      { t: '-25% recarga', m: { cd: 0.75 } },
      { t: 'Golpea en 360° y +50% daño', m: { arc: 9, dmg: 1.50 } }
    ],
    beam: [
      { t: '+45% daño', m: { dmg: 1.45 } },
      { t: '+30% alcance y grosor', m: { radius: 1.30, width: 1.30 } },
      { t: '-25% recarga', m: { cd: 0.75 } },
      { t: '+50% daño', m: { dmg: 1.50 } }
    ],
    orbit: [
      { t: '+1 orbe', m: { count: 1 } },
      { t: '+55% daño', m: { dmg: 1.55 } },
      { t: '+25% radio y gira más rápido', m: { radius: 1.25, speed: 1.35 } },
      { t: '+1 orbe y +55% daño', m: { count: 1, dmg: 1.55 } }
    ],
    nova: [
      { t: '+4 proyectiles', m: { count: 4 } },
      { t: '+40% daño', m: { dmg: 1.40 } },
      { t: '-25% recarga', m: { cd: 0.75 } },
      { t: '+4 proyectiles y +1 perforación', m: { count: 4, pierce: 1 } }
    ],
    aura: [
      { t: '+30% radio', m: { radius: 1.30 } },
      { t: '+45% daño', m: { dmg: 1.45 } },
      { t: 'Golpea un 40% más a menudo', m: { cd: 0.70 } },
      { t: '+30% radio y +50% daño', m: { radius: 1.30, dmg: 1.50 } }
    ],
    boomerang: [
      { t: '+1 bumerán', m: { count: 1 } },
      { t: '+45% daño', m: { dmg: 1.45 } },
      { t: '+30% alcance', m: { radius: 1.30 } },
      { t: '+1 bumerán y +40% daño', m: { count: 1, dmg: 1.40 } }
    ],
    chain: [
      { t: '+2 saltos', m: { count: 2 } },
      { t: '+45% daño', m: { dmg: 1.45 } },
      { t: '-25% recarga', m: { cd: 0.75 } },
      { t: '+2 saltos y +40% daño', m: { count: 2, dmg: 1.40 } }
    ],
    mine: [
      { t: '+1 mina', m: { count: 1 } },
      { t: '+50% daño', m: { dmg: 1.50 } },
      { t: '+30% radio de explosión', m: { radius: 1.30 } },
      { t: '+1 mina y -25% recarga', m: { count: 1, cd: 0.75 } }
    ],
    meteor: [
      { t: '+1 meteoro', m: { count: 1 } },
      { t: '+45% daño', m: { dmg: 1.45 } },
      { t: '+30% radio', m: { radius: 1.30 } },
      { t: '+2 meteoros y -20% recarga', m: { count: 2, cd: 0.80 } }
    ],
    turret: [
      { t: '+50% daño', m: { dmg: 1.50 } },
      { t: 'Dispara un 35% más rápido', m: { rate: 0.74 } },
      { t: '+1 a la vez', m: { count: 1 } },
      { t: '+50% duración y +40% daño', m: { dur: 1.50, dmg: 1.40 } }
    ],
    dash: [
      { t: '+40% daño', m: { dmg: 1.40 } },
      { t: '+30% distancia', m: { radius: 1.30 } },
      { t: '-25% recarga', m: { cd: 0.75 } },
      { t: '+60% daño y más ancho', m: { dmg: 1.60, width: 1.40 } }
    ],
    trail: [
      { t: '+40% daño', m: { dmg: 1.40 } },
      { t: '+40% duración', m: { dur: 1.40 } },
      { t: 'Charcos un 30% más grandes', m: { radius: 1.30 } },
      { t: '+50% daño y +30% radio', m: { dmg: 1.50, radius: 1.30 } }
    ],
    cone: [
      { t: '+3 disparos', m: { count: 3 } },
      { t: '+40% daño', m: { dmg: 1.40 } },
      { t: '+30% alcance', m: { life: 1.30 } },
      { t: '+3 disparos y +1 perforación', m: { count: 3, pierce: 1 } }
    ],
    homing: [
      { t: '+1 proyectil', m: { count: 1, spread: 1.3 } },
      { t: '+45% daño', m: { dmg: 1.45 } },
      { t: '-25% recarga', m: { cd: 0.75 } },
      { t: '+1 proyectil y +40% daño', m: { count: 1, dmg: 1.40 } }
    ],
    bounce: [
      { t: '+1 rebote', m: { bounce: 1 } },
      { t: '+45% daño', m: { dmg: 1.45 } },
      { t: '-25% recarga', m: { cd: 0.75 } },
      { t: '+1 proyectil y +1 rebote', m: { count: 1, bounce: 1, spread: 1.3 } }
    ],
    charge: [
      { t: '+45% daño', m: { dmg: 1.45 } },
      { t: '+30% alcance y grosor', m: { radius: 1.30, width: 1.30 } },
      { t: 'Carga más rápido y -20% recarga', m: { charge: 0.7, cd: 0.8 } },
      { t: '+50% daño', m: { dmg: 1.50 } }
    ],
    spin: [
      { t: '+40% daño', m: { dmg: 1.40 } },
      { t: '+25% radio', m: { radius: 1.25 } },
      { t: '+1 vuelta', m: { count: 1 } },
      { t: '-25% recarga y +30% daño', m: { cd: 0.75, dmg: 1.30 } }
    ],
    quake: [
      { t: '+2 ondas', m: { count: 2 } },
      { t: '+45% daño', m: { dmg: 1.45 } },
      { t: '+25% tamaño', m: { radius: 1.25 } },
      { t: '-25% recarga y +2 ondas', m: { cd: 0.75, count: 2 } }
    ],
    vortex: [
      { t: '+40% daño', m: { dmg: 1.40 } },
      { t: '+30% radio', m: { radius: 1.30 } },
      { t: '+50% duración', m: { dur: 1.50 } },
      { t: 'Atrae más fuerte y +40% daño', m: { pull: 1.40, dmg: 1.40 } }
    ],
    shove: [
      { t: '+40% daño', m: { dmg: 1.40 } },
      { t: '+25% radio', m: { radius: 1.25 } },
      { t: '-25% recarga', m: { cd: 0.75 } },
      { t: '+50% empuje y +40% daño', m: { knock: 1.50, dmg: 1.40 } }
    ],
    stun: [
      { t: '+40% daño', m: { dmg: 1.40 } },
      { t: '+25% radio', m: { radius: 1.25 } },
      { t: '+50% aturdimiento', m: { stun: 1.50 } },
      { t: '-25% recarga y +30% daño', m: { cd: 0.75, dmg: 1.30 } }
    ],
    buff: [
      { t: '+1 acumulación máxima', m: { stacks: 1 } },
      { t: '+40% potencia', m: { amount: 1.40 } },
      { t: '+50% duración', m: { dur: 1.50 } },
      { t: '+1 acumulación y +40% potencia', m: { stacks: 1, amount: 1.40 } }
    ]
  };

  const RAW = [
    // ---------------- NORMAL (common pool for all) ----------------
    {
      id: 'tackle', name: 'Placaje', type: 'normal', kind: 'melee',
      desc: 'Embiste en arco a todo lo que tengas delante.',
      cd: 0.50, dmg: 13, radius: 48, arc: 1.7, knock: 90
    },

    {
      id: 'quick-attack', name: 'Ataque Rápido', type: 'normal', kind: 'dash',
      desc: 'Cruzas como un rayo hacia el enemigo y golpeas todo el camino.',
      cd: 0.75, dmg: 20, radius: 110, width: 34, knock: 40
    },

    {
      id: 'swords-dance', name: 'Danza Espada', type: 'normal', kind: 'buff',
      desc: 'No hace daño: acumula ATAQUE (físico) mientras esté activo.',
      cd: 0.85, stat: 'patk', amount: 0.13, dur: 7, stacks: 5
    },
    // Similar to Swords Dance, but for Special Attack (in main series it is Dark-type;
    // placed in Normal here so any Pokémon can learn it).
    {
      id: 'nasty-plot', name: 'Maquinación', type: 'normal', kind: 'buff',
      desc: 'No hace daño: acumula ATAQUE ESPECIAL mientras esté activo.',
      cd: 0.85, stat: 'satk', amount: 0.13, dur: 7, stacks: 5
    },

    {
      id: 'agility', name: 'Agilidad', type: 'normal', kind: 'buff',
      desc: 'No hace daño: acumula VELOCIDAD mientras esté activo.',
      cd: 0.85, stat: 'spd', amount: 0.10, dur: 7, stacks: 5
    },

    {
      id: 'harden', name: 'Fortaleza', type: 'normal', kind: 'buff',
      desc: 'No hace daño: acumula DEFENSA mientras esté activo.',
      cd: 0.85, stat: 'def', amount: 0.07, dur: 7, stacks: 5
    },

    // ---------------- FIRE ----------------
    {
      id: 'ember', name: 'Ascuas', type: 'fire', kind: 'projectile',
      desc: 'Bola de fuego al enemigo más cercano.',
      cd: 0.52, dmg: 18, speed: 310, count: 1, spread: 0.12, pierce: 0, life: 1.6, size: 7, burn: 1
    },

    {
      id: 'flamethrower', name: 'Lanzallamas', type: 'fire', kind: 'cone',
      desc: 'Chorro de llamas en abanico corto que quema.',
      cd: 0.70, dmg: 7, count: 7, arc: 0.9, speed: 380, life: 0.42, size: 6, pierce: 1, burn: 1
    },

    {
      id: 'fire-spin', name: 'Giro Fuego', type: 'fire', kind: 'orbit',
      desc: 'Llamas que giran a tu alrededor. Defensa constante.',
      cd: 0.30, dmg: 14, count: 3, radius: 62, speed: 2.4, size: 9, burn: 1
    },

    {
      id: 'heat-wave', name: 'Onda Ígnea', type: 'fire', kind: 'nova',
      desc: 'Explota en llamas en todas las direcciones.',
      cd: 1.25, dmg: 13, speed: 250, count: 10, pierce: 1, life: 1.1, size: 7, burn: 1
    },

    // ---------------- WATER ----------------
    {
      id: 'water-gun', name: 'Pistola Agua', type: 'water', kind: 'projectile',
      desc: 'Chorro perforante. Fiable a cualquier distancia.',
      cd: 0.44, dmg: 14, speed: 350, count: 1, spread: 0.10, pierce: 1, life: 1.5, size: 6
    },

    {
      id: 'bubble', name: 'Burbuja', type: 'water', kind: 'nova',
      desc: 'Burbujas en abanico que ralentizan a quien tocan.',
      cd: 1.00, dmg: 9, speed: 210, count: 8, pierce: 0, life: 1.3, size: 8, slow: 0.45
    },

    {
      id: 'hydro-pump', name: 'Hidrobomba', type: 'water', kind: 'beam',
      desc: 'Cañonazo de agua lento pero devastador.',
      cd: 1.50, dmg: 29, radius: 250, width: 30
    },

    {
      id: 'aqua-ring', name: 'Acua Aro', type: 'water', kind: 'buff',
      desc: 'No hace daño: acumula REGENERACIÓN de vida.',
      cd: 0.90, stat: 'regen', amount: 1.6, dur: 8, stacks: 4
    },

    // ---------------- GRASS ----------------
    {
      id: 'vine-whip', name: 'Látigo Cepa', type: 'grass', kind: 'melee',
      desc: 'Látigos de largo alcance en arco amplio.',
      cd: 0.62, dmg: 16, radius: 68, arc: 1.3, knock: 60
    },

    {
      id: 'razor-leaf', name: 'Hoja Afilada', type: 'grass', kind: 'boomerang',
      desc: 'Dos hojas que van y vuelven cortando a la ida y a la vuelta.',
      cd: 0.90, dmg: 10, speed: 330, count: 2, spread: 0.5, radius: 210, size: 6
    },

    {
      id: 'leaf-storm', name: 'Tormenta Floral', type: 'grass', kind: 'orbit',
      desc: 'Un ciclón de hojas gira amplio a tu alrededor.',
      cd: 0.26, dmg: 14, count: 4, radius: 74, speed: 2.6, size: 8
    },

    // (Formerly Giga Drain: healed on every hit and was overtuned. Retaining same id to preserve save compatibility.)
    {
      id: 'giga-drain', name: 'Hierba Lazo', type: 'grass', kind: 'aura',
      desc: 'Raíces que atrapan y machacan todo lo que tienes cerca.',
      cd: 0.55, dmg: 9, radius: 76
    },

    // ---------------- ELECTRIC ----------------
    {
      id: 'thunder-shock', name: 'Impactrueno', type: 'electric', kind: 'projectile',
      desc: 'Descarga rapidísima que atraviesa varios enemigos.',
      cd: 0.40, dmg: 13, speed: 480, count: 1, spread: 0.08, pierce: 2, life: 1.1, size: 5
    },

    {
      id: 'discharge', name: 'Chispazo', type: 'electric', kind: 'aura',
      desc: 'Campo eléctrico permanente alrededor de ti.',
      cd: 0.45, dmg: 8, radius: 70
    },

    {
      id: 'thunderbolt', name: 'Rayo', type: 'electric', kind: 'chain',
      desc: 'Un rayo que salta de un enemigo a otro.',
      cd: 0.95, dmg: 21, count: 4, radius: 140
    },

    // ---------------- PSYCHIC ----------------
    // (11-10-2026: -22/-30% damage and reduced homing strength)
    {
      id: 'confusion', name: 'Confusión', type: 'psychic', kind: 'projectile',
      desc: 'Onda que persigue sola a su objetivo.',
      cd: 0.58, dmg: 13, speed: 280, count: 1, spread: 0.1, pierce: 0, life: 2.2, size: 8, homing: 2.0
    },

    {
      id: 'psybeam', name: 'Psicorrayo', type: 'psychic', kind: 'beam',
      desc: 'Rayo psíquico ancho y contundente.',
      cd: 1.15, dmg: 17, radius: 215, width: 40
    },

    {
      id: 'psychic', name: 'Psíquico', type: 'psychic', kind: 'nova',
      desc: 'Estallido mental radial que busca enemigos.',
      cd: 1.35, dmg: 10, speed: 230, count: 12, pierce: 1, life: 1.6, size: 7, homing: 1.0
    },

    // ---------------- SECONDARY TYPES ----------------
    {
      id: 'sludge', name: 'Residuos', type: 'poison', kind: 'projectile',
      desc: 'Lodo tóxico que envenena al impactar.',
      cd: 0.60, dmg: 17, speed: 290, count: 1, spread: 0.12, pierce: 0, life: 1.5, size: 8, poison: 1
    },

    {
      id: 'mud-shot', name: 'Disparo Lodo', type: 'ground', kind: 'nova',
      desc: 'Salpica lodo alrededor y ralentiza.',
      cd: 1.10, dmg: 11, speed: 200, count: 7, pierce: 0, life: 1.0, size: 9, slow: 0.4
    },

    {
      id: 'gust', name: 'Tornado', type: 'flying', kind: 'orbit',
      desc: 'Remolinos de viento que te escoltan.',
      cd: 0.26, dmg: 13, count: 3, radius: 72, speed: 2.8, size: 8, knock: 40
    },

    {
      id: 'wing-attack', name: 'Ataque Ala', type: 'flying', kind: 'melee',
      desc: 'Barrido de alas amplio que empuja.',
      cd: 0.55, dmg: 14, radius: 58, arc: 1.9, knock: 70
    },

    // ---------------- NORMAL (extra) ----------------
    {
      id: 'body-slam', name: 'Golpe Cuerpo', type: 'normal', kind: 'melee',
      desc: 'Placaje con todo el peso: lento, corto y brutal.',
      cd: 0.95, dmg: 30, radius: 46, arc: 2.2, knock: 140
    },

    {
      id: 'hyper-voice', name: 'Vozarrón', type: 'normal', kind: 'nova',
      desc: 'Onda sonora que sale en todas direcciones.',
      cd: 1.15, dmg: 12, speed: 260, count: 9, pierce: 1, life: 0.9, size: 7
    },

    // ---------------- POISON (extra) ----------------
    {
      id: 'poison-sting', name: 'Picotazo Veneno', type: 'poison', kind: 'projectile',
      desc: 'Aguijón rápido que envenena.',
      cd: 0.34, dmg: 8, speed: 420, count: 1, spread: 0.08, pierce: 0, life: 1.0, size: 4, poison: 1
    },

    {
      id: 'toxic', name: 'Tóxico', type: 'poison', kind: 'trail',
      desc: 'Vas dejando charcos de veneno que intoxican a quien los pisa.',
      cd: 0.3, dmg: 6, radius: 26, dur: 3, poison: 1
    },

    // ---------------- GROUND (extra) ----------------
    {
      id: 'bulldoze', name: 'Terratemblor', type: 'ground', kind: 'aura',
      desc: 'Sacude el suelo: daña y frena a lo cercano.',
      cd: 0.7, dmg: 11, radius: 80, slow: 0.35
    },

    // ---------------- BUG ----------------
    {
      id: 'bug-bite', name: 'Picadura', type: 'bug', kind: 'melee',
      desc: 'Mordisco rápido en arco corto.',
      cd: 0.42, dmg: 11, radius: 44, arc: 1.6, knock: 40
    },

    {
      id: 'string-shot', name: 'Disparo Demora', type: 'bug', kind: 'mine',
      desc: 'Deja telarañas en el suelo que atrapan y frenan mucho al que las pisa.',
      cd: 1.1, dmg: 14, count: 2, radius: 56, dur: 7, slow: 0.6
    },

    {
      id: 'bug-buzz', name: 'Zumbido', type: 'bug', kind: 'aura',
      desc: 'Vibración constante que machaca lo cercano.',
      cd: 0.45, dmg: 8, radius: 66
    },

    // ---------------- ROCK ----------------
    {
      id: 'rock-throw', name: 'Lanzarrocas', type: 'rock', kind: 'projectile',
      desc: 'Pedrusco pesado que empuja al enemigo.',
      cd: 0.7, dmg: 24, speed: 260, count: 1, spread: 0.12, pierce: 0, life: 1.4, size: 9, knock: 90
    },

    {
      id: 'rock-slide', name: 'Avalancha', type: 'rock', kind: 'meteor',
      desc: 'Caen rocas del cielo sobre los enemigos cercanos.',
      cd: 1.3, dmg: 21, count: 3, radius: 46, knock: 50
    },

    // ---------------- ICE ----------------
    {
      id: 'ice-beam', name: 'Rayo Hielo', type: 'ice', kind: 'beam',
      desc: 'Rayo helado que congela casi del todo.',
      cd: 1.1, dmg: 20, radius: 220, width: 30, slow: 0.7
    },

    {
      id: 'powder-snow', name: 'Nieve Polvo', type: 'ice', kind: 'aura',
      desc: 'Ventisca a tu alrededor que ralentiza.',
      cd: 0.55, dmg: 8, radius: 76, slow: 0.45
    },

    // ---------------- FIGHTING ----------------
    {
      id: 'karate-chop', name: 'Golpe Kárate', type: 'fighting', kind: 'melee',
      desc: 'Golpe seco y potente al frente.',
      cd: 0.5, dmg: 18, radius: 50, arc: 1.2, knock: 110
    },

    {
      id: 'aura-sphere', name: 'Esfera Aural', type: 'fighting', kind: 'projectile',
      desc: 'Esfera de energía que nunca falla.',
      cd: 0.62, dmg: 17, speed: 300, count: 1, spread: 0.1, pierce: 0, life: 2.0, size: 8, homing: 4
    },

    // ---------------- GHOST ----------------
    {
      id: 'lick', name: 'Lengüetazo', type: 'ghost', kind: 'melee',
      desc: 'Lametazo espectral que paraliza un poco.',
      cd: 0.48, dmg: 12, radius: 48, arc: 1.8, slow: 0.4
    },

    {
      id: 'shadow-ball', name: 'Bola Sombra', type: 'ghost', kind: 'projectile',
      desc: 'Esfera oscura que atraviesa a varios.',
      cd: 0.66, dmg: 19, speed: 280, count: 1, spread: 0.1, pierce: 2, life: 1.6, size: 9
    },

    // ---------------- DRAGON ----------------
    {
      id: 'dragon-rage', name: 'Furia Dragón', type: 'dragon', kind: 'beam',
      desc: 'Llamarada dracónica en línea recta.',
      cd: 1.0, dmg: 24, radius: 230, width: 34
    },

    {
      id: 'dragon-dance', name: 'Danza Dragón', type: 'dragon', kind: 'buff',
      desc: 'No hace daño: acumula ATAQUE (físico) más rápido que Danza Espada.',
      cd: 0.7, stat: 'patk', amount: 0.11, dur: 7, stacks: 5
    },

    // ---------------- FAIRY ----------------
    {
      id: 'fairy-wind', name: 'Viento Feérico', type: 'fairy', kind: 'nova',
      desc: 'Brisa mágica en todas direcciones.',
      cd: 1.0, dmg: 11, speed: 230, count: 10, pierce: 0, life: 1.2, size: 7
    },

    {
      id: 'dazzling-gleam', name: 'Brillo Mágico', type: 'fairy', kind: 'aura',
      desc: 'Destello a tu alrededor.',
      cd: 0.5, dmg: 9, radius: 72
    },

    // ---------------- STEEL ----------------
    {
      id: 'metal-claw', name: 'Garra Metal', type: 'steel', kind: 'melee',
      desc: 'Zarpazo de acero en arco.',
      cd: 0.5, dmg: 15, radius: 50, arc: 1.6, knock: 60
    },

    {
      id: 'flash-cannon', name: 'Foco Resplandor', type: 'steel', kind: 'beam',
      desc: 'Rayo de luz metálica que perfora.',
      cd: 1.05, dmg: 23, radius: 220, width: 30
    },

    // ---------------- DARK ----------------
    {
      id: 'bite', name: 'Mordisco', type: 'dark', kind: 'melee',
      desc: 'Dentellada rápida que hace retroceder.',
      cd: 0.45, dmg: 14, radius: 46, arc: 1.5, knock: 70
    },

    {
      id: 'dark-pulse', name: 'Pulso Umbrío', type: 'dark', kind: 'nova',
      desc: 'Onda de energía oscura en todas direcciones.',
      cd: 1.15, dmg: 14, speed: 240, count: 10, pierce: 1, life: 1.1, size: 8
    },

    {
      id: 'night-shade', name: 'Tinieblas', type: 'dark', kind: 'aura',
      desc: 'Una sombra te rodea y consume lo cercano.',
      cd: 0.5, dmg: 9, radius: 72
    },

    // ---------------- NEW (2026-10-10): same sprites, new mechanics ----------------
    {
      id: 'bonemerang', name: 'Huesomerang', type: 'ground', kind: 'boomerang',
      desc: 'Un hueso que va y vuelve golpeando fuerte.',
      cd: 0.95, dmg: 16, speed: 300, count: 1, radius: 230, size: 8, knock: 40
    },

    {
      id: 'psycho-cut', name: 'Psicocorte', type: 'psychic', kind: 'boomerang',
      desc: 'Cuchillas psíquicas que vuelven a ti.',
      cd: 0.8, dmg: 9, speed: 360, count: 2, spread: 0.6, radius: 200, size: 7
    },

    {
      id: 'spikes', name: 'Púas', type: 'ground', kind: 'mine',
      desc: 'Siembra púas que estallan al pisarlas.',
      cd: 1.2, dmg: 18, count: 2, radius: 60, dur: 8
    },

    {
      id: 'toxic-spikes', name: 'Púas Tóxicas', type: 'poison', kind: 'mine',
      desc: 'Púas venenosas que envenenan mucho al estallar.',
      cd: 1.1, dmg: 11, count: 2, radius: 56, dur: 8, poison: 2
    },

    {
      id: 'hail', name: 'Granizo', type: 'ice', kind: 'meteor',
      desc: 'Bolas de hielo caen sobre los enemigos y los frenan.',
      cd: 1.2, dmg: 18, count: 4, radius: 40, slow: 0.4
    },

    {
      id: 'meteor-mash', name: 'Puño Meteoro', type: 'steel', kind: 'meteor',
      desc: 'Dos meteoros de acero que aplastan donde caen.',
      cd: 1.4, dmg: 24, count: 2, radius: 48, knock: 70
    },     // (2026-10-23: was 34 dmg and 54 radius; maxed & evolved dealt 1.8x Rock Slide)

    {
      id: 'will-o-wisp', name: 'Fuego Fatuo', type: 'fire', kind: 'turret',
      desc: 'Deja una llama flotante que dispara sola y quema.',
      cd: 3.5, dmg: 15, rate: 0.55, dur: 6, count: 1, range: 300, speed: 300, size: 7, burn: 1
    },

    {
      id: 'substitute', name: 'Sustituto', type: 'normal', kind: 'turret',
      desc: 'Un muñeco que se queda disparando por ti.',
      cd: 4.0, dmg: 14, rate: 0.4, dur: 6, count: 1, range: 280, speed: 320, size: 6
    },

    {
      id: 'aerial-ace', name: 'Golpe Aéreo', type: 'flying', kind: 'dash',
      desc: 'Te lanzas en picado y cortas todo lo que cruzas.',
      cd: 0.75, dmg: 18, radius: 120, width: 40, knock: 60
    },

    {
      id: 'flame-wheel', name: 'Rueda Fuego', type: 'fire', kind: 'trail',
      desc: 'Corres envuelto en fuego y dejas un rastro de llamas.',
      cd: 0.28, dmg: 10, radius: 28, dur: 2.6, burn: 1
    },

    {
      id: 'bubble-beam', name: 'Rayo Burbuja', type: 'water', kind: 'cone',
      desc: 'Chorro de burbujas en abanico corto que frena.',
      cd: 0.65, dmg: 6, count: 7, arc: 1.0, speed: 340, life: 0.45, size: 6, slow: 0.3
    },

    {
      id: 'hex', name: 'Infortunio', type: 'ghost', kind: 'chain',
      desc: 'Maldición que salta entre enemigos. Mucho más daño si están quemados, envenenados o frenados.',
      cd: 0.9, dmg: 17, count: 4, radius: 150, hex: 1.7
    },

    // ================= NEW (19-10-2026): all types with 5 or more moves =================
    // Normal
    {
      id: 'hyper-beam', name: 'Hiperrayo', type: 'normal', kind: 'charge',
      desc: 'Se carga un momento y suelta un rayo enorme que lo atraviesa todo.',
      cd: 2.2, charge: 0.75, dmg: 58, radius: 300, width: 44
    },
    {
      id: 'rapid-spin', name: 'Giro Rápido', type: 'normal', kind: 'spin',
      desc: 'Giras sobre ti mismo golpeando todo lo que te rodea varias veces.',
      cd: 1.0, dmg: 9, count: 3, radius: 62
    },
    // Fire
    {
      id: 'flame-charge', name: 'Nitrocarga', type: 'fire', kind: 'dash',
      desc: 'Te lanzas envuelto en llamas y quemas todo el camino.',
      cd: 0.8, dmg: 19, radius: 115, width: 36, burn: 1
    },
    // Water
    {
      id: 'whirlpool', name: 'Torbellino', type: 'water', kind: 'vortex',
      desc: 'Un remolino que arrastra a los enemigos a su centro y los va dañando.',
      cd: 3.0, dmg: 8, radius: 72, dur: 2.6, pull: 150
    },
    // Grass
    {
      id: 'seed-bomb', name: 'Bomba Germen', type: 'grass', kind: 'bounce',
      desc: 'Una semilla que rebota de enemigo en enemigo.',
      cd: 0.6, dmg: 10, speed: 320, life: 1.6, size: 7, bounce: 3
    },
    {
      id: 'energy-ball', name: 'Energibola', type: 'grass', kind: 'homing',
      desc: 'Una bola de energía que persigue al enemigo.',
      cd: 0.62, dmg: 19, speed: 280, life: 2.0, size: 8, homing: 5
    },
    {
      id: 'solar-beam', name: 'Rayo Solar', type: 'grass', kind: 'charge',
      desc: 'Absorbe luz un momento y la suelta en un rayo enorme.',
      cd: 2.3, charge: 0.85, dmg: 62, radius: 290, width: 40
    },
    // Electric
    {
      id: 'thunder-wave', name: 'Onda Trueno', type: 'electric', kind: 'stun',
      desc: 'Una descarga que avisa en el suelo y deja paralizados a los que pilla.',
      cd: 1.6, dmg: 22, radius: 58, stun: 1.0
    },
    {
      id: 'electro-ball', name: 'Bola Voltio', type: 'electric', kind: 'bounce',
      desc: 'Una bola eléctrica que salta de enemigo en enemigo.',
      cd: 0.62, dmg: 10, speed: 340, life: 1.6, size: 7, bounce: 3
    },
    // Psychic
    {
      id: 'extrasensory', name: 'Paranormal', type: 'psychic', kind: 'shove',
      desc: 'Una onda mental que daña y aparta a todos los que tienes cerca.',
      cd: 1.2, dmg: 16, radius: 92, knock: 320
    },
    {
      id: 'mist-ball', name: 'Bola Neblina', type: 'psychic', kind: 'homing',
      desc: 'Una bola de bruma que persigue al enemigo y le frena.',
      cd: 0.55, dmg: 13, speed: 270, life: 2.0, size: 8, homing: 5, slow: 0.3
    },
    // Poison
    {
      id: 'acid-spray', name: 'Bomba Ácida', type: 'poison', kind: 'bounce',
      desc: 'Un chorro ácido que salta entre enemigos y los envenena.',
      cd: 0.66, dmg: 8, speed: 310, life: 1.6, size: 7, bounce: 3, poison: 1
    },
    // Ground
    {
      id: 'sand-tomb', name: 'Bucle Arena', type: 'ground', kind: 'vortex',
      desc: 'Un remolino de arena que atrapa y arrastra a los enemigos.',
      cd: 3.0, dmg: 9, radius: 70, dur: 2.6, pull: 140
    },
    {
      id: 'magnitude', name: 'Magnitud', type: 'ground', kind: 'quake',
      desc: 'El suelo revienta en línea delante de ti, onda tras onda.',
      cd: 1.15, dmg: 18, count: 6, radius: 30
    },
    // Flying
    {
      id: 'whirlwind', name: 'Remolino', type: 'flying', kind: 'shove',
      desc: 'Un golpe de viento que barre a todos los que tienes cerca.',
      cd: 1.1, dmg: 14, radius: 96, knock: 360
    },
    {
      id: 'air-slash', name: 'Tajo Aéreo', type: 'flying', kind: 'homing',
      desc: 'Dos cuchillas de aire que buscan al enemigo.',
      cd: 0.55, dmg: 9, count: 2, spread: 0.35, speed: 330, life: 1.6, size: 7, homing: 4
    },
    // Bug
    {
      id: 'signal-beam', name: 'Rayo Señal', type: 'bug', kind: 'bounce',
      desc: 'Un destello que rebota entre los enemigos.',
      cd: 0.6, dmg: 10, speed: 340, life: 1.6, size: 7, bounce: 3
    },
    {
      id: 'u-turn', name: 'Ida y Vuelta', type: 'bug', kind: 'dash',
      desc: 'Cruzas entre los enemigos golpeando a todos los del camino.',
      cd: 0.7, dmg: 17, radius: 120, width: 34
    },
    // Rock
    {
      id: 'rock-tomb', name: 'Tumba Rocas', type: 'rock', kind: 'stun',
      desc: 'Caen rocas donde avisa el suelo y dejan atrapados a los que pilla.',
      cd: 1.7, dmg: 31, radius: 56, stun: 0.9
    },
    {
      id: 'ancient-power', name: 'Poder Pasado', type: 'rock', kind: 'orbit',
      desc: 'Rocas antiguas que giran a tu alrededor.',
      cd: 0.28, dmg: 13, count: 3, radius: 70, speed: 2.6, size: 9
    },
    {
      id: 'power-gem', name: 'Joya de Luz', type: 'rock', kind: 'bounce',
      desc: 'Un destello de gema que rebota de enemigo en enemigo.',
      cd: 0.66, dmg: 11, speed: 320, life: 1.6, size: 8, bounce: 3
    },
    // Ice
    {
      id: 'ice-shard', name: 'Canto Helado', type: 'ice', kind: 'homing',
      desc: 'Esquirlas rapidísimas que persiguen al enemigo.',
      cd: 0.32, dmg: 9, speed: 380, life: 1.5, size: 6, homing: 7
    },
    {
      id: 'freeze-dry', name: 'Liofilización', type: 'ice', kind: 'stun',
      desc: 'Un frío repentino que avisa en el suelo y deja congelados a los que pilla.',
      cd: 1.6, dmg: 24, radius: 60, stun: 1.0
    },
    // Fighting
    {
      id: 'rolling-kick', name: 'Patada Giro', type: 'fighting', kind: 'spin',
      desc: 'Patadas en giro que golpean todo lo que tienes alrededor.',
      cd: 0.95, dmg: 11, count: 3, radius: 60
    },
    {
      id: 'vacuum-wave', name: 'Onda Vacío', type: 'fighting', kind: 'shove',
      desc: 'Un puñetazo al aire que lanza una onda y aparta a los enemigos.',
      cd: 1.1, dmg: 17, radius: 88, knock: 330
    },
    {
      id: 'dynamic-punch', name: 'Puño Dinámico', type: 'fighting', kind: 'stun',
      desc: 'Un puñetazo tremendo donde avisa el suelo: deja aturdidos a los que pilla.',
      cd: 1.7, dmg: 33, radius: 54, stun: 0.9
    },
    // Ghost
    {
      id: 'shadow-sneak', name: 'Sombra Vil', type: 'ghost', kind: 'homing',
      desc: 'Una sombra que se escurre por el suelo hasta el enemigo.',
      cd: 0.45, dmg: 14, speed: 300, life: 1.8, size: 7, homing: 6
    },
    {
      id: 'ominous-wind', name: 'Viento Aciago', type: 'ghost', kind: 'vortex',
      desc: 'Un viento maldito que arremolina a los enemigos y los va dañando.',
      cd: 3.0, dmg: 9, radius: 74, dur: 2.6, pull: 140
    },
    // Dragon
    {
      id: 'dragon-breath', name: 'Dragoaliento', type: 'dragon', kind: 'cone',
      desc: 'Un aliento de dragón en abanico corto que frena.',
      cd: 0.7, dmg: 7, count: 7, arc: 0.95, speed: 330, life: 0.5, size: 7, slow: 0.25
    },
    {
      id: 'dragon-claw', name: 'Garra Dragón', type: 'dragon', kind: 'melee',
      desc: 'Un zarpazo de dragón en arco.',
      cd: 0.52, dmg: 19, radius: 52, arc: 2.0, knock: 70
    },
    {
      id: 'outrage', name: 'Enfado', type: 'dragon', kind: 'spin',
      desc: 'Una furia de golpes en giro que no deja a nadie en pie.',
      cd: 1.1, dmg: 12, count: 4, radius: 64
    },
    // Fairy
    {
      id: 'draining-kiss', name: 'Beso Drenaje', type: 'fairy', kind: 'homing',
      desc: 'Un beso que persigue al enemigo y te cura un poco al darle.',
      cd: 0.55, dmg: 13, speed: 280, life: 2.0, size: 7, homing: 5, drain: 1
    },
    {
      id: 'play-rough', name: 'Carantoña', type: 'fairy', kind: 'melee',
      desc: 'Un ataque juguetón pero muy fuerte en arco.',
      cd: 0.6, dmg: 22, radius: 50, arc: 2.0, knock: 60
    },
    {
      id: 'disarming-voice', name: 'Voz Cautivadora', type: 'fairy', kind: 'shove',
      desc: 'Un grito encantador que daña y aparta a los que tienes cerca.',
      cd: 1.15, dmg: 15, radius: 94, knock: 300
    },
    // Steel
    {
      id: 'mirror-shot', name: 'Disparo Espejo', type: 'steel', kind: 'bounce',
      desc: 'Un destello metálico que rebota entre los enemigos.',
      cd: 0.64, dmg: 10, speed: 340, life: 1.6, size: 7, bounce: 3
    },
    {
      id: 'gyro-ball', name: 'Giro Bola', type: 'steel', kind: 'spin',
      desc: 'Giras como una bola de acero golpeando todo alrededor.',
      cd: 1.05, dmg: 12, count: 3, radius: 60
    },
    // Dark
    {
      id: 'sucker-punch', name: 'Golpe Bajo', type: 'dark', kind: 'homing',
      desc: 'Un golpe a traición que busca al enemigo.',
      cd: 0.7, dmg: 22, speed: 330, life: 1.6, size: 7, homing: 6
    },
    {
      id: 'night-slash', name: 'Tajo Umbrío', type: 'dark', kind: 'spin',
      desc: 'Cortes en giro que alcanzan a todo lo que te rodea.',
      cd: 1.0, dmg: 11, count: 3, radius: 62
    },

    // Exclusive signature moves for Legendary Pokémon (authentic design)
    // size (radio) y life (segundos) son ajustes del juego; PokeAPI no los proporciona.
    {
      id: 'electro-drift', name: 'Electroderrape', type: 'electric', kind: 'dash', sig: 1008,
      desc: 'Embiste en modo aceleración dejando un rastro eléctrico en el suelo que electrocuta y potencia tu velocidad.',
      cd: 0.85, dmg: 32, radius: 150, width: 46, knock: 60
    },
    {
      id: 'collision-course', name: 'Nitrochoque', type: 'fighting', kind: 'quake', sig: 1007,
      desc: 'Salta y se estrella contra el suelo causando un cataclismo prehistórico que desintegra el centro del impacto.',
      cd: 1.10, dmg: 48, radius: 140, knock: 140
    },
    {
      id: 'psystrike', name: 'Onda Mental', type: 'psychic', kind: 'homing', sig: 150,
      desc: 'Dispara densas esferas psíquicas que explotan en ondas de choque cinéticas de daño físico demoledor.',
      cd: 0.80, dmg: 32, speed: 380, count: 2, radius: 115, knock: 85
    },
    {
      id: 'dragon-ascent', name: 'Ascenso Draco', type: 'flying', kind: 'meteor', sig: 384,
      desc: 'Asciende a la estratosfera y se precipita como un cometa dragón esmeralda con un impacto devastador.',
      cd: 1.35, dmg: 60, radius: 150, knock: 180
    },
    {
      id: 'origin-pulse', name: 'Pulso Primigenio', type: 'water', kind: 'beam', sig: 382,
      desc: 'Invoca el poder del océano primordial disparando cinco colosales haces de luz azulada que barren el campo.',
      cd: 1.40, dmg: 34, radius: 330, width: 32
    },
    {
      id: 'precipice-blades', name: 'Filo del Abismo', type: 'ground', kind: 'quake', sig: 383,
      desc: 'Hace brotar gigantescas hojas afiladas de roca y magma directamente bajo grupos de enemigos.',
      cd: 1.25, dmg: 42, count: 7, radius: 45, knock: 100
    },
    {
      id: 'judgment', name: 'Sentencia', type: 'normal', kind: 'nova', sig: 493,
      desc: 'El Creador desata el Juicio Divino: una lluvia de incontables rayos de luz celestial que purifican todo el mapa.',
      cd: 1.60, dmg: 26, count: 18, radius: 52
    },
    {
      id: 'aeroblast', name: 'Aerochorro', type: 'flying', kind: 'beam', sig: 249,
      desc: 'Dispara un cañón ciclónico a propulsión que succiona a los enemigos hacia su vórtice y los desgarra con alta probabilidad crítica.',
      cd: 1.20, dmg: 40, radius: 340, width: 46
    },
    {
      id: 'sacred-fire', name: 'Fuego Sagrado', type: 'fire', kind: 'cone', sig: 250,
      desc: 'Libera una espiral de fuego sagrado purificador en 360° que quema a todos los adversarios y regenera vida al Fénix.',
      cd: 1.10, dmg: 32, radius: 160, knock: 80, burn: 1
    },
    {
      id: 'roar-of-time', name: 'Distorsión', type: 'dragon', kind: 'charge', sig: 483,
      desc: 'Ruge distorsionando el flujo del tiempo: congela y ralentiza a los enemigos cercanos mientras desata un haz temporal.',
      cd: 2.20, charge: 0.70, dmg: 75, radius: 350, width: 56
    },
    {
      id: 'spacial-rend', name: 'Corte Vacío', type: 'dragon', kind: 'melee', sig: 484,
      desc: 'Desgarra el espacio abriendo una grieta dimensional que atrae a los enemigos y los corta con fuerza crítica.',
      cd: 0.85, dmg: 38, radius: 115, arc: 2.8, knock: 90
    },
    {
      id: 'shadow-force', name: 'Golpe Umbrío', type: 'ghost', kind: 'dash', sig: 487,
      desc: 'Se desvanece en el Mundo Distorsión haciéndose invulnerable y reaparece emboscando con una explosión sombría que ignora defensas.',
      cd: 1.20, dmg: 55, radius: 150, width: 44, knock: 110
    },
    {
      id: 'water-shuriken', name: 'Shuriken de Agua', type: 'water', kind: 'projectile', sig: 658,
      desc: 'Lanza veloces shurikens de agua a presión (1 a 5 según el nivel).',
      cd: 0.9, dmg: 30, count: 1, speed: 440, spread: 0.13, pierce: 0, size: 5, life: 1.4,
      ups: [
        { t: '+1 shuriken', m: { count: 1 } },
        { t: '+45% daño', m: { dmg: 1.45 } },
        { t: '+1 shuriken y -25% recarga', m: { count: 1, cd: 0.75, spread: 1.2 } },
        { t: '+2 shurikens y +25% daño', m: { count: 2, dmg: 1.25 } }
      ]
    },
    { id: 'pyro-ball', name: 'Balón Ígneo', type: 'fire', kind: 'meteor', sig: 815, desc: 'Chuta una esfera de fuego llameante que explota con violencia al impactar.', cd: 1.15, dmg: 48, radius: 110, knock: 100 },
    { id: 'spirit-shackle', name: 'Puntada Sombría', type: 'ghost', kind: 'homing', sig: 724, desc: 'Dispara flechas espectrales que cosen al enemigo al suelo frenándolo.', cd: 0.85, dmg: 34, count: 3, speed: 380, life: 1.6, homing: 5 },
    { id: 'darkest-lariat', name: 'Lariat Oscuro', type: 'dark', kind: 'spin', sig: 727, desc: 'Gira con los brazos en llamas ignorando las defensas y apartando a todos.', cd: 0.95, dmg: 22, count: 4, radius: 85, knock: 110 },
    { id: 'drum-beating', name: 'Batería Asalto', type: 'grass', kind: 'quake', sig: 812, desc: 'Toca sus tambores y hace que raíces broten del suelo en ondas frenando al enemigo.', cd: 1.1, dmg: 32, count: 6, radius: 42, knock: 80 },
    { id: 'flower-trick', name: 'Truco Floral', type: 'grass', kind: 'homing', sig: 908, desc: 'Lanza un ramo floral con truco que busca al rival y asesta un golpe crítico seguro.', cd: 0.8, dmg: 32, count: 2, speed: 360, homing: 6 },
    { id: 'torch-song', name: 'Canto Ardiente', type: 'fire', kind: 'beam', sig: 911, desc: 'Entona un canto ardiente acompañado de un pájaro de fuego que potencia tu ataque.', cd: 1.2, dmg: 38, radius: 320, width: 44 },
    { id: 'aqua-step', name: 'Danza Acuática', type: 'water', kind: 'melee', sig: 914, desc: 'Ejecuta una patada de baile acuático que daña y aumenta tu velocidad.', cd: 0.65, dmg: 28, radius: 80, arc: 2.6, knock: 70 },
    { id: 'gigaton-hammer', name: 'Martillo Colosal', type: 'steel', kind: 'quake', sig: 959, desc: 'Descarga un colosal martillo de acero que hace retumbar la tierra con fuerza devastadora.', cd: 1.4, dmg: 65, count: 4, radius: 60, knock: 160 },
    { id: 'bitter-blade', name: 'Espada Lamento', type: 'fire', kind: 'melee', sig: 937, desc: 'Tajo con espadas llameantes malditas que absorbe vida de los enemigos.', cd: 0.75, dmg: 32, radius: 85, arc: 2.5, knock: 75 },
    { id: 'armor-cannon', name: 'Cañón Armadura', type: 'fire', kind: 'charge', sig: 936, desc: 'Junta sus hombreras para formar un cañón y dispara una gran bola de fuego.', cd: 1.5, charge: 0.5, dmg: 58, radius: 320, width: 50 },
    { id: 'fiery-dance', name: 'Danza Llama', type: 'fire', kind: 'spin', sig: 637, desc: 'Aleteo en espiral de llamas que abrasa a los enemigos y eleva tu fuerza.', cd: 0.9, dmg: 24, count: 3, radius: 80 },
    { id: 'night-daze', name: 'Pulso Noche', type: 'dark', kind: 'shove', sig: 571, desc: 'Libera una onda de choque oscura de tono siniestro que ciega a los rivales.', cd: 1.15, dmg: 36, radius: 120, knock: 240 },
    { id: 'leaf-blade', name: 'Hoja Aguda', type: 'grass', kind: 'melee', sig: 254, desc: 'Corta con afiladas hojas en los brazos con alta probabilidad de golpe crítico.', cd: 0.6, dmg: 28, radius: 85, arc: 2.4, knock: 65 },
    { id: 'blaze-kick', name: 'Patada Ígnea', type: 'fire', kind: 'melee', sig: 257, desc: 'Lanza una patada ardiente de gran impacto que puede causar quemaduras.', cd: 0.7, dmg: 30, radius: 80, arc: 2.2, burn: 1, knock: 120 },
    { id: 'muddy-water', name: 'Agua Lodosa', type: 'water', kind: 'cone', sig: 260, desc: 'Lanza una ola de agua lodosa que arrastra y frena a los rivales.', cd: 0.9, dmg: 22, count: 9, speed: 340, life: 0.55, arc: 1.1, slow: 0.45, size: 8 },
    { id: 'blast-burn', name: 'Anillo Ígneo', type: 'fire', kind: 'meteor', sig: 6, desc: 'Desata una colosal explosión volcánica en forma de anillo ígneo que calcina todo.', cd: 1.5, dmg: 65, radius: 130, knock: 140 },
    { id: 'hydro-cannon', name: 'Hidrocañón', type: 'water', kind: 'beam', sig: 9, desc: 'Dispara dos cañones de agua a máxima presión que repelen violentamente a los rivales.', cd: 1.45, dmg: 55, radius: 330, width: 48, knock: 160 },
    { id: 'frenzy-plant', name: 'Planta Feroz', type: 'grass', kind: 'quake', sig: 3, desc: 'Enormes raíces ancestrales brotan del suelo aplastando a todos a su paso.', cd: 1.4, dmg: 58, count: 6, radius: 55, knock: 120 },
    { id: 'dragon-darts', name: 'Dracoflechas', type: 'dragon', kind: 'homing', sig: 887, desc: 'Lanza dos misiles dragón fantasmales que persiguen a blancos distintos.', cd: 0.7, dmg: 26, count: 2, speed: 420, homing: 7, size: 8, life: 1.4 },
    { id: 'dark-void', name: 'Brecha Negra', type: 'dark', kind: 'vortex', sig: 491, desc: 'Abre una brecha de oscuridad de pesadilla que arrastra a los enemigos y los sume en el sueño.', cd: 2, dmg: 18, radius: 140, dur: 3, pull: 220 },
    { id: 'psycho-boost', name: 'Psicoataque', type: 'psychic', kind: 'beam', sig: 386, desc: 'Dispara un haz cósmico de energía psíquica a máxima potencia.', cd: 1.5, dmg: 65, radius: 340, width: 50 },
    { id: 'doom-desire', name: 'Deseo Oculto', type: 'steel', kind: 'meteor', sig: 385, desc: 'Concentra la luz de las estrellas que cae poco después en un rayo demoledor.', cd: 1.4, dmg: 60, radius: 120, knock: 100 },
    { id: 'v-create', name: 'V de Fuego', type: 'fire', kind: 'dash', sig: 494, desc: 'Enciende su frente en una V ardiente y embiste con una explosión cataclísmica.', cd: 1.3, dmg: 70, radius: 160, width: 55, knock: 140 },
    { id: 'blue-flare', name: 'Llama Azul', type: 'fire', kind: 'cone', sig: 643, desc: 'Envuelve el campo en un vendaval de bellas e intensas llamas azules.', cd: 1.25, dmg: 40, count: 10, speed: 420, life: 0.55, arc: 1, burn: 1, size: 8 },
    { id: 'bolt-strike', name: 'Ataque Fulgor', type: 'electric', kind: 'dash', sig: 644, desc: 'Carga rodeado de rayos de alto voltaje como un proyectil eléctrico viviente.', cd: 1.2, dmg: 60, radius: 155, width: 50, knock: 120 },
    { id: 'glaciate', name: 'Mundo Gélido', type: 'ice', kind: 'nova', sig: 646, desc: 'Emite una ventisca a cero absoluto que congela y ralentiza a los enemigos.', cd: 1.3, dmg: 28, count: 16, speed: 300, pierce: 3, life: 1.4, slow: 0.8, size: 8 },
    { id: 'geomancy', name: 'Geocontrol', type: 'fairy', kind: 'aura', sig: 716, desc: 'Canaliza la energía del árbol de la vida creando un aura de luz que restaura salud.', cd: 2.4, dmg: 20, radius: 150 },
    { id: 'oblivion-wing', name: 'Ala Mortífera', type: 'flying', kind: 'beam', sig: 717, desc: 'Dispara el rayo de la muerte que absorbe la vitalidad de todos los enemigos alcanzados.', cd: 1.35, dmg: 45, radius: 320, width: 44 },
    { id: 'core-enforcer', name: 'Núcleo Castigo', type: 'dragon', kind: 'beam', sig: 718, desc: 'Dispara rayos de energía del núcleo que trazan una gran Z de castigo en el suelo.', cd: 1.6, dmg: 55, radius: 340, width: 52 },
    { id: 'sunsteel-strike', name: 'Meteoimpacto', type: 'steel', kind: 'dash', sig: 791, desc: 'Embiste con la furia del sol como un meteoro de acero imparable.', cd: 1.2, dmg: 55, radius: 150, width: 48, knock: 120 },
    { id: 'moongeist-beam', name: 'Rayo Umbrío', type: 'ghost', kind: 'beam', sig: 792, desc: 'Emite un siniestro haz de luz lunar que atraviesa cualquier defensa.', cd: 1.3, dmg: 48, radius: 330, width: 42 },
    { id: 'photon-geyser', name: 'Géiser Fotónico', type: 'psychic', kind: 'meteor', sig: 800, desc: 'Hace brotar columnas de fotones de luz pura desde el suelo bajo los enemigos.', cd: 1.3, dmg: 50, count: 2, radius: 80, knock: 110 },
    { id: 'spectral-thief', name: 'Robasombra', type: 'ghost', kind: 'dash', sig: 802, desc: 'Se cuela entre las sombras y asesta una ráfaga de golpes espectrales.', cd: 0.9, dmg: 40, radius: 130, width: 42, knock: 80 },
    { id: 'plasma-fists', name: 'Puños Plasma', type: 'electric', kind: 'melee', sig: 807, desc: 'Puñetazos de plasma cargados de electricidad que dejan chispas en el suelo.', cd: 0.7, dmg: 35, radius: 85, arc: 2.8, knock: 90 },
    { id: 'behemoth-blade', name: 'Tajo Supremo', type: 'steel', kind: 'melee', sig: 888, desc: 'Un tajo de espada gigante con energía celeste que corta a multitudes.', cd: 0.85, dmg: 45, radius: 120, arc: 3, knock: 130 },
    { id: 'behemoth-bash', name: 'Embate Supremo', type: 'steel', kind: 'shove', sig: 889, desc: 'Embate con el escudo supremo que aplasta y empuja a todos los rivales.', cd: 1.05, dmg: 45, radius: 130, knock: 280 },
    { id: 'dynamax-cannon', name: 'Cañón Dinamax', type: 'dragon', kind: 'beam', sig: 890, desc: 'Dispara un cañonazo espiral de energía Dinamax desde el núcleo de su pecho.', cd: 1.4, dmg: 54, radius: 340, width: 50 },
    { id: 'wicked-blow', name: 'Golpe Oscuro', type: 'dark', kind: 'melee', sig: 892, desc: 'Un golpe marcial certero y demoledor que siempre asesta un golpe crítico.', cd: 0.8, dmg: 42, radius: 85, arc: 2, knock: 120 },
    { id: 'astral-barrage', name: 'Orbes Espectro', type: 'ghost', kind: 'homing', sig: 898, desc: 'Dispara una multitud de orbes fantasmales astrales que persiguen a los rivales.', cd: 0.9, dmg: 28, count: 4, speed: 380, homing: 6, size: 8, life: 1.4 },
    { id: 'ivy-cudgel', name: 'Garrote Liana', type: 'grass', kind: 'melee', sig: 1017, desc: 'Golpea con el garrote de lianas desatando una lluvia de espinas críticas.', cd: 0.75, dmg: 38, radius: 90, arc: 2.5, knock: 95 },
    { id: 'tera-starstorm', name: 'Teraclúster', type: 'normal', kind: 'nova', sig: 1024, desc: 'Desata una tormenta cristalina de estrellas Teracristal en 360 grados.', cd: 1.4, dmg: 26, count: 18, speed: 310, pierce: 3, life: 1.4, size: 8 },
    { id: 'electro-shot', name: 'Electrorrayo', type: 'electric', kind: 'charge', sig: 1018, desc: 'Acumula electricidad como un cañón de riel y dispara un rayo fulminante.', cd: 1.6, charge: 0.45, dmg: 60, radius: 350, width: 48 }
  ];

  // Melee adjustment (2026-10-12): +20% damage and +25% reach/arc
  // (and -25% damage taken while it is your active attack, in player.js).
  // Strong hits, but required significantly higher risk compared to ranged moves.
  for (const m of RAW) {
    if (m.kind !== 'melee') continue;
    m.dmg = Math.round(m.dmg * 1.2);
    m.radius = Math.round(m.radius * 1.25);
    if (m.arc) m.arc = Math.min(3, +(m.arc * 1.25).toFixed(2));
  }

  // Move pools by type. All Pokémon have access to the 'normal' pool.
  // Exclusive signature moves (sig: dex) are only added to their Pokémon's pool.
  const POOL = {}, SIG_MOVES = {};
  for (const m of RAW) {
    if (m.sig) {
      (SIG_MOVES[m.sig] = SIG_MOVES[m.sig] || []).push(m.id);
    } else {
      (POOL[m.type] = POOL[m.type] || []).push(m.id);
    }
  }

  /*
   * Physical or special (G.Stats), similar to main series games. Status moves
   * that deal damage here are categorized by their nature: traps and physical hits
   * are physical (Spikes, String Shot, Substitute); elemental effects and energy
   * are special (Toxic, Hail, Will-O-Wisp). Buffs have none (deal no damage).
   */
  const PHYSICAL = new Set(['tackle', 'quick-attack', 'vine-whip', 'razor-leaf', 'wing-attack', 'body-slam', 'poison-sting',
    'bulldoze', 'bug-bite', 'string-shot', 'rock-throw', 'rock-slide', 'karate-chop', 'lick', 'metal-claw', 'bite',
    'bonemerang', 'psycho-cut', 'spikes', 'toxic-spikes', 'meteor-mash', 'substitute', 'aerial-ace', 'flame-wheel',
    // 2026-10-19 additions
    'rapid-spin', 'flame-charge', 'seed-bomb', 'sand-tomb', 'magnitude', 'u-turn', 'rock-tomb', 'ice-shard',
    'rolling-kick', 'dynamic-punch', 'shadow-sneak', 'dragon-claw', 'outrage', 'play-rough', 'gyro-ball',
    'sucker-punch', 'night-slash',
    // physical signature moves
    'collision-course', 'dragon-ascent', 'precipice-blades', 'sacred-fire', 'shadow-force',
    'pyro-ball', 'spirit-shackle', 'darkest-lariat', 'drum-beating', 'flower-trick', 'aqua-step', 'gigaton-hammer', 'bitter-blade', 'leaf-blade', 'blaze-kick', 'dragon-darts', 'v-create', 'bolt-strike', 'sunsteel-strike', 'spectral-thief', 'plasma-fists', 'behemoth-blade', 'behemoth-bash', 'wicked-blow', 'ivy-cudgel']);

  // Projectile moves require base count and spread: upgrades multiply them.
  for (const m of RAW) {
    if (m.kind !== 'projectile' && m.kind !== 'homing' && m.kind !== 'bounce') continue;
    if (m.count == null) m.count = 1;
    if (m.spread == null) m.spread = 0.12;
  }

  const BY_ID = {};
  for (const m of RAW) {
    m.cat = m.kind === 'buff' ? null : PHYSICAL.has(m.id) ? 'physical' : 'special';
    m.ups = m.ups || LADDERS[m.kind];
    m.maxLvl = m.ups.length + 1;
    BY_ID[m.id] = m;
  }

  /**
   * Moves this Pokémon can learn (its types + normal) and, unless
   * `natural` is true, those learned via TM (Kecleon Shop, see G.Mons).
   */
  function poolFor(mon, natural) {
    const ids = new Set(POOL.normal || []);
    for (const t of (mon && mon.types || [])) for (const id of (POOL[t] || [])) ids.add(id);
    if (mon && mon.dex && SIG_MOVES[mon.dex]) for (const id of SIG_MOVES[mon.dex]) ids.add(id);
    if (mon && mon.start && BY_ID[mon.start]) ids.add(mon.start);
    if (!natural && G.Mons && mon && mon.dex) for (const id of G.Mons.taught(mon.dex)) ids.add(id);
    return [...ids];
  }

  /**
   * In-run move instance: base values from `def` with ladder upgrades
   * up to `lvl` applied.
   */
  function instance(id, lvl = 1) {
    const def = BY_ID[id];
    const s = Object.assign({}, def, { id, def, lvl, t: 0 });
    delete s.ups;
    for (let i = 0; i < lvl - 1; i++) applyMods(s, def.ups[i].m);
    return s;
  }

  const MULT = ['dmg', 'cd', 'speed', 'radius', 'dur', 'amount', 'arc', 'width', 'spread', 'life', 'size', 'rate',
    'pull', 'knock', 'stun', 'charge'];
  const ADD = ['count', 'pierce', 'stacks', 'bounce'];

  function applyMods(s, m) {
    for (const k in m) {
      if (MULT.includes(k) && s[k] != null) s[k] *= m[k];
      else if (ADD.includes(k)) s[k] = (s[k] || 0) + m[k];
      else s[k] = m[k];
    }
  }

  /** Levels up an existing move instance. */
  function levelUp(s, levels = 1) {
    if (s.lvl >= s.def.maxLvl) return false;
    const end = Math.min(s.def.maxLvl, s.lvl + levels);
    while (s.lvl < end) {
      applyMods(s, s.def.ups[s.lvl - 1].m);
      s.lvl++;
    }
    return true;
  }

  /** Next upgrade description for the level-up card. */
  function nextUpText(s, levels = 1) {
    return s.lvl >= s.def.maxLvl ? null : s.def.ups.slice(s.lvl - 1, s.lvl - 1 + levels).map(u => u.t).join('<br>');
  }

  /** Default starting move based on primary type (if Pokémon has none assigned). */
  const START = {
    fire: 'ember', water: 'water-gun', grass: 'vine-whip', electric: 'thunder-shock',
    psychic: 'confusion', poison: 'sludge', ground: 'mud-shot', flying: 'gust',
    bug: 'bug-bite', rock: 'rock-throw', ice: 'ice-beam', fighting: 'karate-chop',
    ghost: 'shadow-ball', dragon: 'dragon-rage', fairy: 'fairy-wind', steel: 'metal-claw',
    dark: 'bite', normal: 'tackle'
  };
  function startFor(mon) {
    if (mon.start && BY_ID[mon.start]) return mon.start;
    if (mon.dex && SIG_MOVES[mon.dex] && SIG_MOVES[mon.dex][0]) return SIG_MOVES[mon.dex][0];
    for (const t of mon.types) if (START[t]) return START[t];
    return 'tackle';
  }

  // ---------------- move evolution ----------------
  /*
   * A move at MAX LEVEL evolves if during the run the player picked its
   * required stat upgrade (`needs`, a LevelUp.STATS id). Displays as a golden card.
   * Buffs do not evolve.
   */
  const NEED_NAME = {
    hp: 'Vigor', atk: 'Potencia', spd: 'Carrera', cd: 'Reflejos', def: 'Coraza',
    rgn: 'Síntesis', mag: 'Imán', xp: 'Aprendizaje'
  };
  // Requirement for each move. Evolved moves append " +" (e.g., Meteor Mash +):
  // preserves original move names without exhausting name variants.
  const EVO = {
    'tackle': 'hp', 'quick-attack': 'spd',
    'body-slam': 'atk', 'hyper-voice': 'cd',
    'ember': 'atk', 'flamethrower': 'cd',
    'fire-spin': 'rgn', 'heat-wave': 'hp',
    'water-gun': 'atk', 'bubble': 'spd',
    'hydro-pump': 'atk', 'vine-whip': 'atk',
    'razor-leaf': 'cd', 'leaf-storm': 'rgn',
    'giga-drain': 'hp', 'thunder-shock': 'atk',
    'discharge': 'def', 'thunderbolt': 'cd',
    'confusion': 'cd', 'psybeam': 'atk',
    'psychic': 'mag', 'sludge': 'atk',
    'poison-sting': 'spd', 'toxic': 'rgn',
    'mud-shot': 'atk', 'bulldoze': 'atk',
    'gust': 'spd', 'wing-attack': 'atk',
    'bug-bite': 'atk', 'string-shot': 'cd',
    'bug-buzz': 'rgn', 'rock-throw': 'atk',
    'rock-slide': 'cd', 'ice-beam': 'atk',
    'powder-snow': 'spd', 'karate-chop': 'atk',
    'aura-sphere': 'cd', 'lick': 'atk',
    'shadow-ball': 'cd', 'dragon-rage': 'atk',
    'fairy-wind': 'atk', 'dazzling-gleam': 'rgn',
    'metal-claw': 'atk', 'flash-cannon': 'def',
    'bite': 'atk', 'dark-pulse': 'spd',
    'night-shade': 'rgn',
    'bonemerang': 'atk', 'psycho-cut': 'cd',
    'spikes': 'atk', 'toxic-spikes': 'rgn',
    'hail': 'cd', 'meteor-mash': 'atk',
    'will-o-wisp': 'cd', 'substitute': 'def',
    'aerial-ace': 'spd', 'flame-wheel': 'spd',
    'bubble-beam': 'atk', 'hex': 'mag',
    // added on 2026-10-19
    'hyper-beam': 'atk', 'rapid-spin': 'spd',
    'flame-charge': 'spd', 'whirlpool': 'rgn',
    'seed-bomb': 'atk', 'energy-ball': 'rgn',
    'solar-beam': 'cd', 'thunder-wave': 'atk',
    'electro-ball': 'spd', 'extrasensory': 'def',
    'mist-ball': 'cd', 'acid-spray': 'rgn',
    'sand-tomb': 'hp', 'magnitude': 'atk',
    'whirlwind': 'spd', 'air-slash': 'cd',
    'signal-beam': 'atk', 'u-turn': 'rgn',
    'rock-tomb': 'hp', 'ancient-power': 'def',
    'power-gem': 'atk', 'ice-shard': 'cd',
    'freeze-dry': 'atk', 'rolling-kick': 'spd',
    'vacuum-wave': 'def', 'dynamic-punch': 'atk',
    'shadow-sneak': 'cd', 'ominous-wind': 'mag',
    'dragon-breath': 'atk', 'dragon-claw': 'atk',
    'outrage': 'hp', 'draining-kiss': 'rgn',
    'play-rough': 'atk', 'disarming-voice': 'def',
    'mirror-shot': 'atk', 'gyro-ball': 'def',
    'sucker-punch': 'atk', 'night-slash': 'spd',
    // signature / exclusive moves
    'electro-drift': 'spd', 'collision-course': 'atk',
    'psystrike': 'cd', 'dragon-ascent': 'atk',
    'origin-pulse': 'mag', 'precipice-blades': 'hp',
    'judgment': 'atk', 'aeroblast': 'cd',
    'sacred-fire': 'rgn', 'roar-of-time': 'atk',
    'spacial-rend': 'cd', 'shadow-force': 'spd',
    'water-shuriken': 'spd', 'pyro-ball': 'atk', 'spirit-shackle': 'cd', 'darkest-lariat': 'atk', 'drum-beating': 'hp', 'flower-trick': 'spd', 'torch-song': 'cd', 'aqua-step': 'spd', 'gigaton-hammer': 'atk', 'bitter-blade': 'hp', 'armor-cannon': 'def', 'fiery-dance': 'cd', 'night-daze': 'mag', 'leaf-blade': 'atk', 'blaze-kick': 'spd', 'muddy-water': 'rgn', 'blast-burn': 'atk', 'hydro-cannon': 'def', 'frenzy-plant': 'hp', 'dragon-darts': 'spd', 'dark-void': 'cd', 'psycho-boost': 'atk', 'doom-desire': 'mag', 'v-create': 'atk', 'blue-flare': 'atk', 'bolt-strike': 'atk', 'glaciate': 'cd', 'geomancy': 'rgn', 'oblivion-wing': 'hp', 'core-enforcer': 'def', 'sunsteel-strike': 'atk', 'moongeist-beam': 'cd', 'photon-geyser': 'atk', 'spectral-thief': 'spd', 'plasma-fists': 'atk', 'behemoth-blade': 'atk', 'behemoth-bash': 'def', 'dynamax-cannon': 'hp', 'wicked-blow': 'atk', 'astral-barrage': 'cd', 'ivy-cudgel': 'atk', 'tera-starstorm': 'mag', 'electro-shot': 'def'
  };
  // Stat and effect modifications granted upon evolution by move kind.
  const EVO_MODS = {
    projectile: { t: '×1,8 daño, +2 proyectiles, +2 perforación y más grandes', m: { dmg: 1.8, count: 2, pierce: 2, size: 1.3, spread: 1.1 } },
    melee: { t: '×1,9 daño, más alcance y golpea en 360°', m: { dmg: 1.9, radius: 1.3, arc: 9 } },
    beam: { t: '×1,8 daño, rayo un 50% más grueso y más largo', m: { dmg: 1.8, width: 1.5, radius: 1.2, cd: 0.85 } },
    orbit: { t: '+2 orbes, ×1,7 daño y más radio', m: { count: 2, dmg: 1.7, radius: 1.15 } },
    nova: { t: '+6 proyectiles, ×1,6 daño y +1 perforación', m: { count: 6, dmg: 1.6, pierce: 1 } },
    aura: { t: '×1,8 daño y un 35% más de radio', m: { dmg: 1.8, radius: 1.35 } },
    boomerang: { t: '×1,8 daño, +1 bumerán y más alcance', m: { dmg: 1.8, count: 1, radius: 1.2, size: 1.2 } },
    chain: { t: '×1,7 daño y +3 saltos', m: { dmg: 1.7, count: 3, radius: 1.2 } },
    mine: { t: '×1,8 daño, +2 minas y explosión más grande', m: { dmg: 1.8, count: 2, radius: 1.25 } },
    meteor: { t: '×1,7 daño, +2 meteoros y más radio', m: { dmg: 1.7, count: 2, radius: 1.2 } },
    turret: { t: '×1,8 daño, +1 a la vez y dispara más rápido', m: { dmg: 1.8, count: 1, rate: 0.8 } },
    dash: { t: '×1,9 daño, más distancia y menos recarga', m: { dmg: 1.9, radius: 1.25, cd: 0.8 } },
    trail: { t: '×1,8 daño, charcos más grandes y duraderos', m: { dmg: 1.8, radius: 1.25, dur: 1.3 } },
    cone: { t: '×1,7 daño, +4 disparos y +1 perforación', m: { dmg: 1.7, count: 4, pierce: 1 } },
    homing: { t: '×1,8 daño, +2 proyectiles y más grandes', m: { dmg: 1.8, count: 2, size: 1.3, spread: 1.2 } },
    bounce: { t: '×1,8 daño, +2 rebotes y +1 proyectil', m: { dmg: 1.8, bounce: 2, count: 1, spread: 1.3 } },
    charge: { t: '×1,8 daño, rayo un 50% más grueso y carga más rápido', m: { dmg: 1.8, width: 1.5, charge: 0.7 } },
    spin: { t: '×1,8 daño, +1 vuelta y más radio', m: { dmg: 1.8, count: 1, radius: 1.2 } },
    quake: { t: '×1,8 daño, +3 ondas y ondas más grandes', m: { dmg: 1.8, count: 3, radius: 1.25 } },
    vortex: { t: '×1,8 daño, más radio y atrae más fuerte', m: { dmg: 1.8, radius: 1.3, pull: 1.4 } },
    shove: { t: '×1,8 daño, más radio y empuja más', m: { dmg: 1.8, radius: 1.25, knock: 1.4 } },
    stun: { t: '×1,8 daño, más radio y aturde más rato', m: { dmg: 1.8, radius: 1.3, stun: 1.4 } }
  };

  const evoName = name => name + ' +';

  /** Can it evolve now? → { name, needs, needName, text, ready } or null */
  function evoInfo(m, statsTaken) {
    const needs = EVO[m.id];
    if (!needs || m.evolved || m.lvl < m.def.maxLvl || !EVO_MODS[m.kind]) return null;
    const text = m.id === 'water-shuriken'
      ? '×1,8 daño y Shuriken Gigante'
      : EVO_MODS[m.kind].t;
    return {
      name: evoName(m.def.name), needs, needName: NEED_NAME[needs], text,
      ready: !!(statsTaken && statsTaken[needs])
    };
  }

  /** Evolves an instance (updates name and stats; retains original type). */
  function evolve(m) {
    if (!EVO[m.id] || m.evolved) return false;
    const mods = m.id === 'water-shuriken'
      ? { dmg: 1.8, size: 1.3 }
      : EVO_MODS[m.kind].m;
    applyMods(m, mods);
    m.baseName = m.name;
    m.name = evoName(m.baseName);
    m.evolved = true;
    return true;
  }

  G.Moves = {
    ALL: RAW, BY_ID, POOL, SIG_MOVES, poolFor, instance, levelUp, nextUpText, startFor,
    EVO, NEED_NAME, evoInfo, evolve
  };
})();

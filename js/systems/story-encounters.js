/* Story challenge mechanics. State belongs to one practice arena and is discarded on exit. */
G.StoryEncounters = (() => {
  const TAU = Math.PI * 2;
  const STAGES = {
    weather: { waves: [[382, 383]], description: 'Water pools slow movement, lava drains HP. Defeat one boss to summon Rayquaza; defeat all to win.' },
    creation: { waves: [[483, 484, 487]], description: 'Dialga slows time; Palkia fluctuates speed and curves projectiles; Giratina cloaks in shadows before lunging.' },
    tao: { waves: [[643, 644], [646]], description: 'Fire storms and targeted lightning; defeat both to face fused Kyurem and a raging blizzard.' },
    lake: { waves: [[480, 481, 482]], description: 'Teleports and charges 0.8s before firing; minor projectiles invert controls for 3s. Defeat all three.' },
    beasts: { waves: [[243, 244, 245]], description: 'Charges across the arena leaving lightning, fire, and ice trails. Defeat all three.' },
    birds: { waves: [[144, 145, 146]], description: 'Three birds strafe the arena, leaving ice paths, electric grids, and fire trails. Defeat all three.' },
    swords: { waves: [[638, 639, 640, 647]], description: 'Attacks from four arena corners; projectile volleys fan out rhythmically. Defeat all four.' },
    tapu: { waves: [[785, 786, 787, 788]], description: 'Four terrain zones: electric delays dash, grass binds movement, mist blocks healing, psychic disables dash. Defeat zone owners to clear terrain.' },
    ruin: { waves: [[1001, 1002, 1003, 1004]], description: 'Four bosses reduce player damage and speed by 50%. Defeat one boss to break the aura; defeat all to win.' },
    regi: { waves: [[377, 378, 379, 894, 895], [486]], description: 'Defeat five Regi pillars to awaken Regigigas. After a 10s Slow Start, it sweeps across the arena.' },
    eon: { waves: [[380, 381]], description: 'Latias heals and shields Latios. Defeating Latias first enrages Latios, doubling its speed and damage.' },
    moon: { waves: [[488, 491]], description: 'Cresselia flashes crescent moon blades; Darkrai blinds the screen for 0.5s when casting.' },
    tower: { waves: [[249, 250]], description: 'Ho-Oh fire ash lingers for 5s; Lugia wind gusts push you toward fire zones. Defeat both.' },
    heroes: { waves: [[888, 889]], description: 'Zamazenta raises a frontal shield protecting Zacian. Flank from behind or pierce; dodge Zacian shadow charge slashes.' }
};
  const MOVES = {
    382: ['Primordial Surge', 'Horizontal/vertical waves cover the arena; find safe gaps.'],
    383: ['Cataclysmic Eruption', 'Escape volcanic vents before eruption; avoid lingering magma.'],
    384: ['Celestial Judgment', 'Dodge diagonal laser beams; beam intersections deal heavy damage.'],
    483: ['Roar of Time', 'Temporal distortion field slows movement and projectiles.'],
    484: ['Spacial Warp', 'Projectile trajectories curve around spacial rifts.'],
    487: ['Antimatter Phantasm', 'Shadow indicators telegraph attack direction before Giratina strikes.'],
    643: ['Firestorm', 'Dodge flame fans and scorched burn trails.'], 644: ['Targeted Bolt Strike', 'Lightning strikes lock onto previous positions; keep moving.'],
    646: ['Fused Blizzard', 'Dodge giant ice boulders; freezing floors cause slippery footing.'],
    480: ['Memory Maze', 'Hits invert movement controls for 3 seconds.'], 481: ['Wave of Emotion', 'Hits invert movement controls for 3 seconds.'], 482: ['Willpower Chaos', 'Hits invert movement controls for 3 seconds.'],
    243: ['Thunder Trail', 'Avoid electrified shockwave trails on the floor.'], 244: ['Magma Trail', 'Avoid burning lava paths.'], 245: ['Aurora Ice Path', 'Ice terrain causes slippery footing.'],
    144: ['Glacial Wings', 'Ice terrain causes slippery footing.'], 145: ['Thunder Wings', 'Dodge intersecting lightning lines.'], 146: ['Flame Wings', 'Dodge lingering fire walls.'],
    638: ['Sacred Sword Dance', 'Dodge blade waves from four corners; weave through cutting bands.'],
    639: ['Sacred Sword Dance', 'Dodge blade waves from four corners; weave through cutting bands.'],
    640: ['Sacred Sword Dance', 'Dodge blade waves from four corners; weave through cutting bands.'],
    647: ['Sacred Sword Dance', 'Dodge blade waves from four corners; weave through cutting bands.'],
    785: ['Electric Terrain', 'Temporarily delays dash abilities.'], 786: ['Psychic Terrain', 'Psychic zone disables dash abilities.'],
    787: ['Awakened Roots', 'Binds movement briefly; leave grassy patches.'], 788: ['Guardian Mist', 'Misty aura completely blocks healing.'],
    377: ['Ancient Rockfall', 'Dodge falling boulders; pillars obstruct firing paths.'], 378: ['Ancient Frost', 'Dodge falling icicles and slippery ground.'],
    379: ['Ancient Steel Cannon', 'Dodge steel projectile volleys fired from pillars.'], 894: ['Ancient Shock Grid', 'Dodge accelerating electric discharge volleys.'],
    895: ['Ancient Dragon Blast', 'Dodge spreading dragon bullet fans.'], 486: ['Continental Sweep', 'Dodge massive arena sweeping cleaves; full power unleashes after 10s.'],
    380: ['Eon Veil', 'Latias heals and grants shields to Latios.'], 381: ['Eon Dragonforce', 'Dodge dragon projectile salvos; Latios enrages if Latias falls.'],
    488: ['Crescent Light', 'Bright flash illuminates the arena; dodge crescent blades.'], 491: ['Abyssal Nightmare', 'Blinds screen for 0.5s; remember your trajectory.'],
    249: ['Cyclone Gale', 'Arrow-telegraphed wind tunnels push you into fire ash.'], 250: ['Ash Conflagration', 'Volcanic ash burns for 5s; stay clear of active flame patches.'],
    888: ['Shadow Blade', 'Sidestep telegraphed lunging thrusts.'], 889: ['Royal Bastion', 'Dodge shield charges; flank from behind or use piercing attacks.']
};
  let arena = null, fields = [], volleyQueue = [], clock = 0, nextField = 1, sharedHealth = null;
  let statuses = new WeakMap();
  const host = () => !G.Coop.active || G.Coop.isHost;
  const tile = () => G.Tiles.T * G.Sprites.PX;
  const radius = () => (arena.r - 1.4) * tile();
  const attackRadius = radius;
  const active = () => !!arena && arena.phase === 'fight';
  const living = () => arena ? (arena.bossIds || []).map(id => G.EnemyMgr.get(id)).filter(e => e && !e.dead) : [];
  const color = type => G.U.TYPE_COLOR[type] || '#c3a5ff';
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const emit = (op, data) => { if (G.Coop.isHost) G.Coop.broadcast(['enc', op, data]); };

  function reset() { arena = null; fields = []; volleyQueue = []; clock = 0; nextField = 1; sharedHealth = null; statuses = new WeakMap(); }
  function begin(a) { reset(); if (a.challenge && STAGES[a.challengeId]) arena = a; }
  function controls(e) { return !!arena && !!e && e.storyBoss && STAGES[arena.challengeId].waves.flat().concat(arena.challengeId === 'weather' ? [384] : []).includes(e.dex); }
  function beginSharedHealth(ids) {
    if (!arena || arena.challengeId !== 'regi' || arena.storyIndex !== 0) return;
    const bosses = ids.map(id => G.EnemyMgr.get(id)).filter(Boolean);
    const max = bosses.reduce((sum, boss) => sum + boss.maxHp, 0);
    sharedHealth = max > 0 ? { ids: bosses.map(boss => boss.id), max, hp: max } : null;
  }
  function hasSharedHealth(e) { return !!sharedHealth && sharedHealth.ids.includes(e.id); }
  function damageSharedHealth(e, damage) {
    if (!hasSharedHealth(e) || !host()) return false;
    sharedHealth.hp = Math.max(0, sharedHealth.hp - damage);
    const bosses = sharedHealth.ids.map(id => G.EnemyMgr.get(id)).filter(boss => boss && !boss.dead);
    if (sharedHealth.hp <= 0) for (const boss of bosses) boss.die();
    return true;
  }
  function sharedHealthBar() {
    return sharedHealth ? { hp: sharedHealth.hp, maxHp: sharedHealth.max, name: 'Đội hình Regi' } : null;
  }
  function status(p) {
    if (!statuses.has(p)) statuses.set(p, { confuse: 0, confuseReady: 0, dark: 0, darkReady: 0, root: 0, rootReady: 0, slow: 0, slide: 0, noHeal: 0, noDash: 0, moonFlashReady: 0 });
    return statuses.get(p);
  }
  function effects(p) {
    if (!active()) return { speed: 1, damage: 1 };
    const s = status(p), bosses = living();
    const ruin = arena.challengeId === 'ruin' && bosses.length === 4;
    const time = bosses.some(e => e.dex === 483);
    const space = bosses.some(e => e.dex === 484) ? 0.65 + (Math.sin(clock * 2.7) + 1) * 0.45 : 1;
    return { speed: (ruin ? 0.5 : 1) * (time ? 0.72 : 1) * space * (s.root > 0 ? 0 : s.slow > 0 ? 0.6 : 1),
      damage: ruin ? 0.5 : 1, confused: s.confuse > 0, dark: s.dark > 0, slide: s.slide > 0, noHeal: s.noHeal > 0, noDash: s.noDash > 0 };
  }
  function applyStatus(p, effect) {
    if (!active() || p.dead || !effect) return;
    const s = status(p);
    if (effect === 'confuse' && clock >= s.confuseReady) { s.confuse = 3; s.confuseReady = clock + 6; }
    if (effect === 'dark' && clock >= s.darkReady) { s.dark = 0.5; s.darkReady = clock + 2; }
    if (effect === 'moonFlash' && clock >= s.moonFlashReady) { G.Game.flash('#fff3cd', 0.5); s.moonFlashReady = clock + 0.65; }
    if (effect === 'root' && clock >= s.rootReady) { s.root = 0.45; s.rootReady = clock + 3; }
    if (effect === 'slow') s.slow = Math.max(s.slow, 0.6);
    if (effect === 'ice') { s.slide = Math.max(s.slide, 0.35); s.slow = Math.max(s.slow, 0.15); }
    if (effect === 'mist') s.noHeal = 0.3;
    if (effect === 'psychic') s.noDash = 0.3;
    if (effect === 'electric') s.noDash = 0.5;
  }
  function pointNear(p, spread = 100) {
    const a = Math.random() * TAU;
    return { x: p.x + Math.cos(a) * spread, y: p.y + Math.sin(a) * spread };
  }
  function bound(p, padding = 0) {
    const dx = p.x - arena.x, dy = p.y - arena.y, d = Math.hypot(dx, dy), r = radius() - padding;
    return d > r ? { x: arena.x + dx / d * r, y: arena.y + dy / d * r } : { x: p.x, y: p.y };
  }
  function addField(o, remote = false) {
    const f = Object.assign({ id: nextField++, born: clock, delay: 0.7, duration: 6, radius: 65, damage: 0, tick: 0, color: color(o.type), shape: 'pool' }, o);
    if (remote) f.born = clock;
    // Permanent ash is retained until exit; merge dense nearby ash to bound rendering cost.
    const near = f.permanent && fields.find(g => g.permanent && Math.hypot(g.x - f.x, g.y - f.y) < 50);
    if (near) { near.radius = Math.min(100, near.radius + 8); return near; }
    if (fields.length >= 100) {
      const disposable = fields.findIndex(g => !g.permanent && !g.terrain);
      if (disposable >= 0) fields.splice(disposable, 1); else return null;
    }
    fields.push(f);
    if (!remote) emit('field', f);
    return f;
  }
  function shot(e, angle, options = {}) {
    const type = options.type || e.atkType, speed = options.speed || 190;
    const p = G.Projectiles.spawn(Object.assign({ x: e.x, y: e.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      r: 7, dmg: e.dmg * 0.55, life: radius() * 2.5 / speed, friendly: false, color: color(type), mtype: type, cat: e.cat,
      vis: G.VFX.forType(type), enc: { owner: e.id } }, options));
    p.enc = Object.assign({ owner: e.id }, options.enc);
    if (G.Coop.isHost) G.Coop.enemyShot(p, type);
    e.anim.play('Shoot');
    return p;
  }
  function fan(e, target, count = 7, spread = 1.3, options = {}) {
    const aim = Math.atan2(target.y - e.y, target.x - e.x);
    for (let i = 0; i < count; i++) shot(e, aim + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread), options);
  }
  function staggeredVolley(e, target, count, type, duration = 0.9, spread = 2.8) {
    const aim = Math.atan2(target.y - e.y, target.x - e.x);
    for (let i=0;i<count;i++) {
      const angle = aim + (i / Math.max(1,count-1) - 0.5) * spread + (Math.random()-0.5)*0.16;
      volleyQueue.push({ at:clock+Math.random()*duration, enemy:e, angle, type, speed:150, radius:5 });
    }
  }
  function beam(e, from, to, width = 32, delay = 0.8, type = e.atkType) {
    G.Hazards.add({ kind: 'beam', x: from.x, y: from.y, angle: Math.atan2(to.y - from.y, to.x - from.x), len: Math.hypot(to.x - from.x, to.y - from.y),
      w: width, delay, end: 0.45, enc: true, dmg: e.dmg * 0.9, type, color: color(type), cat: e.cat });
  }
  function pool(e, p, type, effect, options = {}) {
    return addField(Object.assign({ x: p.x, y: p.y, owner: e.id, type, effect, color: color(type), damage: ['fire', 'electric', 'ground'].includes(type) ? e.dmg * 0.28 : 0 }, options));
  }
  function configure(e) {
    if (!controls(e) || e.encounter) return;
    const s = e.encounter = { age: 0, cooldown: 1.1 + Math.random()*1.2, support: 4, trail: 0, hidden: false, dash: null, enraged: false, facing: 0, born: clock };
    if ([480, 481, 482].includes(e.dex)) {
      e.scale = 0.75; e.anim.scale = e.scale; e.r = G.Sprites.bodyRadius(e.dex, e.scale); e.bodyH = G.Sprites.bodyHeight(e.dex, e.scale);
      s.cooldown = 1.2 + (e.dex - 480) * 0.7;
    }
    if (arena.challengeId === 'swords' || arena.challengeId === 'tapu') {
      const roster = STAGES[arena.challengeId].waves[0], i = roster.indexOf(e.dex);
      const d = arena.challengeId === 'swords' ? (radius() - 8) / Math.SQRT2 : radius() * 0.6;
      e.x = arena.x + (i % 2 ? d : -d); e.y = arena.y + (i < 2 ? -d : d);
      s.anchor = { x: e.x, y: e.y };
      if (arena.challengeId === 'tapu' && host()) {
        const effect = ({ 785: 'electric', 786: 'psychic', 787: 'root', 788: 'mist' })[e.dex];
        addField({ owner: e.id, x: arena.x + (i % 2 ? 1 : -1) * radius() / 2, y: arena.y + (i < 2 ? -1 : 1) * radius() / 2,
          terrain: true, half: radius() / 2, type: e.atkType, effect, color: ({785:'#ffe260',786:'#d585fa',787:'#70dd77',788:'#80d9ed'})[e.dex], delay: 1, duration: Infinity });
      }
    }
    if (arena.challengeId === 'regi' && e.dex !== 486) {
      const i = STAGES.regi.waves[0].indexOf(e.dex), a = i * TAU / 5 - Math.PI / 2;
      e.x = arena.x + Math.cos(a) * (radius() - 8); e.y = arena.y + Math.sin(a) * (radius() - 8);
    }
    if (['birds', 'beasts', 'tower', 'eon'].includes(arena.challengeId)) {
      const roster = STAGES[arena.challengeId].waves[0], i = roster.indexOf(e.dex), a = i * TAU / roster.length - Math.PI / 2;
      e.x = arena.x + Math.cos(a) * radius() * 0.82; e.y = arena.y + Math.sin(a) * radius() * 0.82;
      s.orbit = a;
    }
    G.BossForms?.configure(e);
    if (e.dex === 646) {
      s.fusion = arena.lastDefeated === 643 ? 'white' : 'black';
      e.name = s.fusion === 'white' ? 'White Kyurem' : 'Black Kyurem';
      // Only switch art if the requested form is actually installed.
      const form = s.fusion === 'white' ? '0002' : '0001';
      if (G.SPRITE_META[e.dex]?.f?.[form]) e.setStoryForm(form);
      G.Game.flash('#a8eaff', 0.7);
    }
  }
  function startDash(e, p, options = {}) {
    const s = e.encounter;
    // Extend the player's bearing to the far arena edge, even when the boss starts near the center.
    const angle = Math.atan2(p.y - e.y, p.x - e.x);
    const end = bound(options.across ? { x: e.x + Math.cos(angle) * radius() * 4, y: e.y + Math.sin(angle) * radius() * 4 } : p, e.r);
    if (Math.hypot(end.x - e.x, end.y - e.y) < 80) Object.assign(end, pointNear(p, radius() * 0.6));
    const trailAllowed = options.trail && !(arena.challengeId === 'beasts' && [243,244,245].includes(e.dex));
    s.dash = { from: { x: e.x, y: e.y }, to: end, t: 0, wind: options.wind ?? (options.special ? 0.55 : 0.8), duration: options.duration || 0.65, type: options.type || e.atkType, trail: !!trailAllowed, hide: !!options.hide, special: !!options.special };
    beam(e, s.dash.from, end, e.r * 1.6, s.dash.wind + s.dash.duration * 0.5, s.dash.type);
    e.anim.play('Charge');
  }
  function dashMove(e, dt) {
    const s = e.encounter, d = s.dash;
    d.t += dt;
    const wasHidden = s.hidden;
    s.hidden = d.hide && d.t > 0.2 && d.t < d.wind + d.duration;
    if (wasHidden !== s.hidden) emit('state', { id: e.id, hidden: s.hidden });
    if (d.t < d.wind) return [0, 0, 'Charge'];
    const k = clamp((d.t - d.wind) / d.duration, 0, 1);
    const x = d.from.x + (d.to.x - d.from.x) * k, y = d.from.y + (d.to.y - d.from.y) * k;
    const vx = (x - e.x) / Math.max(dt, 0.001), vy = (y - e.y) / Math.max(dt, 0.001);
    s.trail -= dt;
    if (d.trail && s.trail <= 0) { s.trail = 0.13; pool(e, { x, y }, d.type, d.type === 'ice' ? 'ice' : d.type === 'electric' ? 'electric' : null, { radius: 34, delay: 0.2, duration: 5 }); }
    if (k >= 1) { s.dash = null; s.hidden = false; s.cooldown = 2.4 + Math.random()*1.8; }
    return [vx, vy, 'Attack'];
  }
  function move(e, dt, p, spd) {
    if (!controls(e)) return null;
    configure(e);
    const s = e.encounter;
    s.age += dt; s.cooldown -= dt; s.support -= dt;
    if (e.dex !== 889 || s.cooldown <= 0 || !s.faced) {
      s.facing = Math.atan2(p.y - e.y, p.x - e.x); s.faced = true;
    }
    if (s.dash) return dashMove(e, dt);
    if (s.teleportCast) {
      s.teleportCast.delay -= dt;
      if (s.teleportCast.delay <= 0) {
        fan(e, s.teleportCast.target, 3, 1.3, { type:'psychic', speed:115, r:4, life:2.6, enc:{effect:'confuse'} });
        s.teleportCast = null;
      }
      return [0, 0, 'Charge'];
    }
    const formMove = G.BossForms?.move(e, dt, p, spd);
    if (formMove) return formMove;
    if (e.dex === 486) return regigigasMove(e, p, spd);
    const dist = Math.hypot(p.x - e.x, p.y - e.y), a = s.facing;
    let speed = dist > 230 ? spd * 0.65 : dist < 130 ? -spd * 0.4 : 0;
    if ([638,639,640,647,377,378,379,894,895].includes(e.dex)) speed = 0;
    if ([480,481,482].includes(e.dex) && s.cooldown <= 0) {
      const dest = pointNear(p, 150 + Math.random() * 70);
      G.FX.ring(e.x, e.y, 8, 45, '#caa0ff', 0.35, 3);
      e.x = dest.x; e.y = dest.y;
      G.FX.ring(e.x, e.y, 8, 45, '#caa0ff', 0.35, 3);
      G.FX.ring(e.x, e.y, 36, 6, '#fff1ba', 0.8, 3);
      s.teleportCast = { delay:0.8, target:{x:p.x,y:p.y} };
      s.cooldown = 3.8;
      e.anim.play('Charge');
      return [0, 0, 'Charge'];
    } else if ([243,244,245,144,145,146,487,888].includes(e.dex) && s.cooldown <= 0) {
      const type = ({243:'electric',244:'fire',245:'ice',144:'ice',145:'electric',146:'fire'})[e.dex] || e.atkType;
      const beasts = [243,244,245].includes(e.dex);
      startDash(e, p, { across: [243,244,245,144,145,146].includes(e.dex), trail: [144,145,146].includes(e.dex), type,
        wind: beasts ? 0.55 : undefined, duration: beasts ? 0.5 : undefined, hide: e.dex === 487 || e.dex === 888 });
      return [0, 0, 'Charge'];
    } else if (s.cooldown <= 0) {
      normalAttack(e, p);
      const stagger = ['swords','regi'].includes(arena.challengeId);
      s.cooldown = stagger ? 2 + Math.random()*1.6 : e.dex === 381 && s.enraged ? 1.1 : 2.8;
    }
    if (e.dex === 380 && s.support <= 0) {
      s.support = 7;
      const ally = living().find(b => b.dex === 381);
      if (ally) {
        const sustain = Math.max(20, (ally.rd || 0) / 6);
        ally.hp = Math.min(ally.maxHp, ally.hp + Math.min(ally.maxHp * 0.025, sustain * 0.5));
        ally.shield = Math.max(ally.shield, Math.min(ally.maxHp * 0.06, sustain * 1.2)); ally.shieldT = 3;
        G.FX.ring(ally.x, ally.y, ally.r, ally.r * 2, '#ffb3e7', 0.6, 4);
      }
    }
    if (e.dex === 888) {
      const guard = living().find(b => b.dex === 889);
      if (guard?.encounter) {
        const x = guard.x - Math.cos(guard.encounter.facing) * 85, y = guard.y - Math.sin(guard.encounter.facing) * 85;
        const d = Math.hypot(x - e.x, y - e.y);
        return d > 12 ? [(x - e.x) / d * spd, (y - e.y) / d * spd, 'Walk'] : [0, 0, 'Idle'];
      }
    }
    if ([249, 250, 380, 381].includes(e.dex)) {
      // Opposite orbit anchors keep the duo apart while their normal skills remain active.
      const angle = s.orbit + s.age * (arena.challengeId === 'tower' ? 0.5 : 0.22);
      const reach = radius() * (arena.challengeId === 'tower' ? 0.78 : 0.72);
      const x = arena.x + Math.cos(angle) * reach, y = arena.y + Math.sin(angle) * reach;
      const d = Math.hypot(x - e.x, y - e.y), speed = Math.min(d / Math.max(dt, 0.001), spd * 1.6);
      return d > 2 ? [(x - e.x) / d * speed, (y - e.y) / d * speed, 'Walk'] : [0, 0, 'Idle'];
    }
    return [Math.cos(a) * speed, Math.sin(a) * speed, 'Walk'];
  }
  function regigigasMove(e, p, spd) {
    const s = e.encounter, angle = Math.atan2(p.y-e.y,p.x-e.x);
    if (s.age < 10) return [Math.cos(angle)*spd*0.15,Math.sin(angle)*spd*0.15,'Walk'];
    if (!s.awakened) {
      s.awakened = true;
      s.cooldown = 0;
      s.attackTurn = 0;
      G.Spawner.say('Regigigas thức tỉnh! Sức mạnh của năm trụ đã hội tụ.',3,true);
      G.FX.ring(e.x,e.y,e.r,radius(),'#ffe4a1',0.8,10);
      G.Camera.kick(0.8);
    }
    if (s.cooldown <= 0) {
      if (s.attackTurn++ % 2 === 0) startDash(e,p,{across:true,wind:0.9,duration:0.5,type:'normal'});
      else {
        regigigasQuake(e,p,false);
        s.cooldown = 3.2;
      }
      return [0,0,'Charge'];
    }
    return [Math.cos(angle)*spd*0.5,Math.sin(angle)*spd*0.5,'Walk'];
  }
  function regigigasQuake(e, p, special) {
    const safeAngle = Math.atan2(p.y-e.y,p.x-e.x) + 0.55;
    const count = special ? 28 : 18;
    for (let i = 0; i < count; i++) {
      const angle = i * TAU / count;
      const delta = Math.atan2(Math.sin(angle-safeAngle),Math.cos(angle-safeAngle));
      if (Math.abs(delta) > 0.42) shot(e,angle,{type:'rock',speed:145,r:7,life:special?2.3:3.5,enc:{shape:'shard'}});
    }
    G.Hazards.add({kind:'zone',x:p.x,y:p.y,r:special?65:48,delay:0.95,end:0.25,
      dmg:e.dmg*0.8,type:'ground',color:'#dcb477',cat:e.cat,enc:true});
  }
  function regigigasFinale(e, p) {
    const R = attackRadius(), types = ['rock','ice','steel','electric','dragon'];
    const angle = e.encounter.facing, dx = Math.cos(angle), dy = Math.sin(angle), step = R / 3;
    const playerOffset = -(p.x-arena.x)*dy+(p.y-arena.y)*dx;
    const gap = clamp(Math.floor((playerOffset+R)/step),1,4);
    let element = 0;
    for (let i = 0; i < 6; i++) {
      if (i === gap) continue;
      const offset = -R+(i+0.5)*step;
      beam(e,{x:arena.x-dx*R-dy*offset,y:arena.y-dy*R+dx*offset},
        {x:arena.x+dx*R-dy*offset,y:arena.y+dy*R+dx*offset},step*0.6,0.85,types[element++]);
    }
  }
  function normalAttack(e, p) {
    switch (e.dex) {
      case 382: pool(e, pointNear(p, 65), 'water', 'slow', { radius: 85, duration: 7 }); break;
      case 383: pool(e, pointNear(p, 85), 'fire', null, { radius: 72, duration: 8 }); break;
      case 644: addField({ owner: e.id, x:p.x, y:p.y, radius:45, type:'electric', color:color('electric'), damage:e.dmg, delay:0.95, duration:0.3, shape:'lightning' }); break;
      case 643: fan(e, p, 9, 1.5, { type:'fire', speed:170 }); pool(e, pointNear(p), 'fire', null); break;
      case 646: fan(e, p, 9, 1.6, { type:'ice', speed:115, r:13, enc:{effect:'slow'} }); break;
      case 488: fan(e, p, 7, 1.6, { type:'fairy', r:7, speed:150, enc:{curve:0.45, shape:'crescent', effect:'moonFlash'} }); break;
      case 491: fan(e, p, 5, 1, { type:'dark', speed:130, enc:{effect:'dark'} }); break;
      case 250: pool(e, pointNear(p, 100), 'fire', null, { radius:50, duration:5 }); break;
      case 249: wind(e, p, false); break;
      case 889: fan(e, p, 3, 0.8, { type:'steel', speed:160 }); break;
      case 483: fan(e, p, 5, 1.1, { type:'steel', speed:145, enc:{effect:'slow'} }); break;
      case 484: fan(e, p, 7, 1.8, { type:'water', speed:155, enc:{curve:0.8} }); break;
      case 638: case 639: case 640: case 647:
      case 377: case 378: case 379: case 894: case 895:
        staggeredVolley(e,p,5,e.atkType,0.8,2.2); break;
      default: fan(e, p, 5, 1.1);
    }
  }
  function wind(e, p, special) {
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    addField({ owner:e.id, x:e.x, y:e.y, shape:'wind', angle:a, length:radius()*2, width:100, delay:0.8, duration:1.2,
      type:'flying', color:'#a9eaff', push:100, special });
  }
  function cancelCasts() {
    if (!arena) return;
    volleyQueue = [];
    for (const e of living()) if (e.encounter) { e.encounter.dash = null; e.encounter.teleportCast = null; e.encounter.hidden = false; e.encounter.cooldown = Math.max(1, e.encounter.cooldown); }
    fields = fields.filter(f => f.permanent || f.terrain);
    for (const f of fields) f.special = false;
    emit('cancel', {});
  }
  function specialWave(e, wave) {
    if (!controls(e)) return false;
    if (G.BossForms?.special(e, wave)) return true;
    const p = G.Game.everyone().find(p => !p.dead) || G.Game.player, R = attackRadius(), T = tile();
    G.FX.ring(e.x, e.y, e.r, e.r * 4, color(e.atkType), 0.55, 7);
    G.FX.burst(e.x, e.y - e.bodyH * 0.4, color(e.atkType), 24, 160);
    const field = (point, type, effect, extra = {}) => pool(e, point, type, effect, Object.assign({special:true}, extra));
    switch (e.dex) {
      case 382: {
        // Random full-arena strips with one guaranteed wide corridor, independently sampled each wave.
        const vertical = Math.random() < 0.5, bands = 7, step = R * 2 / bands, gap = 1 + Math.floor(Math.random() * (bands - 2));
        for (let i=0;i<bands;i++) if(i!==gap) {
          const offset = -R + (i+0.5)*step + (Math.random()-0.5)*step*0.15;
          const a = vertical ? {x:arena.x+offset,y:arena.y-R} : {x:arena.x-R,y:arena.y+offset};
          const b = vertical ? {x:a.x,y:arena.y+R} : {x:arena.x+R,y:a.y};
          beam(e,a,b,step*0.68,0.95,'water');
        }
        field(pointNear(p,90),'water','slow',{radius:75,duration:3}); break;
      }
      case 383:
        for(let i=0;i<5;i++) field(pointNear(p, 50+i*45),'fire',null,{radius:55,delay:0.7+i*0.08,duration:4}); break;
      case 384: {
        const a = Math.random()*Math.PI, c = pointNear(p,100);
        for(let i=0;i<2;i++) { const d=a+i*Math.PI/2; beam(e,{x:c.x-Math.cos(d)*R*1.5,y:c.y-Math.sin(d)*R*1.5},{x:c.x+Math.cos(d)*R*1.5,y:c.y+Math.sin(d)*R*1.5},36,0.85,'dragon'); }
        break;
      }
      case 483: field(pointNear(p,80),'steel','slow',{radius:120,damage:e.dmg*0.3,duration:2}); fan(e,p,17,2.6,{speed:110,type:'steel',enc:{effect:'slow'}}); break;
      case 484: for(let i=0;i<28;i++) shot(e,i*TAU/28+wave*0.2,{type:'water',speed:150,enc:{curve:0.45}}); break;
      case 487: for(let i=0;i<3;i++) { const a=wave+i*TAU/3; beam(e,{x:arena.x+Math.cos(a)*R,y:arena.y+Math.sin(a)*R},pointNear(p,90),40,0.9,'ghost'); } break;
      case 643: fan(e,p,15,2.2,{type:'fire',speed:175}); for(let i=0;i<3;i++) field(pointNear(p,160),'fire',null,{radius:55,duration:3}); break;
      case 644: for(let i=0;i<4;i++) field(i?pointNear(p,120):p,'electric',null,{shape:'lightning',radius:45,damage:e.dmg,delay:0.8+i*0.06,duration:0.3}); break;
      case 646: {
        const side=wave%2?1:-1;
        for(let i=0;i<11;i++) if(i!==wave+4) shot(e,side>0?Math.PI:0,{x:arena.x+side*R,y:arena.y-R+i*R/5,type:'ice',speed:170,r:15,life:2*R/170,enc:{effect:'ice'}});
        field(pointNear(p,160),'ice','ice',{radius:100,duration:4}); break;
      }
      case 480: case 481: case 482: fan(e,p,9,2.8,{type:'psychic',speed:115,r:4,life:2.6,enc:{effect:'confuse'}}); break;
      case 243: case 244: case 245: case 144: case 145: case 146: {
        const type=({243:'electric',244:'fire',245:'ice',144:'ice',145:'electric',146:'fire'})[e.dex], a=wave*0.7+Math.random();
        if ([243,244,245].includes(e.dex)) {
          startDash(e,p,{across:true,special:true,trail:false,wind:1.05,duration:0.45,type});
          break;
        }
        for (let lane = -2; lane <= 2; lane++) {
          const offset = lane * R * 0.34, dx = Math.cos(a), dy = Math.sin(a);
          const from={x:arena.x-dx*R-dy*offset,y:arena.y-dy*R+dx*offset};
          const to={x:arena.x+dx*R-dy*offset,y:arena.y+dy*R+dx*offset};
          beam(e,from,to,34,0.75+Math.abs(lane)*0.09,type);
          for(let i=0;i<10;i++) field({x:from.x+(to.x-from.x)*i/9,y:from.y+(to.y-from.y)*i/9},type,type==='ice'?'ice':type==='electric'?'electric':null,{radius:24,delay:0.85,duration:1.2});
        }
        fan(e,p,15,TAU*0.9,{type,speed:175,r:6});
        break;
      }
      case 638: case 639: case 640: case 647:
        sacredSwordDance(wave);
        break;
      case 785: case 786: case 787: case 788: {
        const effect=({785:'electric',786:'psychic',787:'root',788:'mist'})[e.dex];
        for(let i=0;i<3;i++) field(pointNear(p,80+i*80),e.atkType,effect,{radius:80,damage:e.dmg*0.35,duration:2}); break;
      }
      case 1001: case 1002: case 1003: case 1004: fan(e,p,11,2.4,{type:'dark',speed:145}); break;
      case 377: case 378: case 379: case 894: case 895: staggeredVolley(e,p,10,e.atkType,1.15,3.3); break;
      case 486:
        if (wave === 0) regigigasQuake(e,p,true);
        else if (wave === 1) startDash(e,p,{across:true,special:true,wind:0.7,duration:0.45,type:'normal'});
        else regigigasFinale(e,p);
        break;
      case 380: case 381: fan(e,p,e.dex===381?23:17,3.2,{type:e.dex===381?'dragon':'psychic',speed:185}); break;
      case 488: {
        const angle = Math.atan2(p.y - e.y, p.x - e.x) + (wave - 1) * 0.2;
        const dx = Math.cos(angle), dy = Math.sin(angle);
        G.Rift.moonSpecialEffect(488, wave);
        for (let lane = -1; lane <= 1; lane++) {
          const offset = lane * R * 0.28;
          const from = { x: arena.x - dx * R - dy * offset, y: arena.y - dy * R + dx * offset };
          const to = { x: arena.x + dx * R - dy * offset, y: arena.y + dy * R + dx * offset };
          beam(e, from, to, T * 0.42, 0.38 + Math.abs(lane) * 0.08, 'fairy');
        }
        for (let i = 0; i < 3; i++) field(pointNear(p, R * 0.62), 'fairy', null,
          { radius: T * 0.58, damage: e.dmg * 0.32, delay: 0.42 + i * 0.12, duration: 1, color: '#e8baff', special: true });
        G.Game.flash('#fff3cd', 0.28);
        G.Camera.kick(0.85);
        fan(e,p,13,2.8,{type:'fairy',speed:145,r:7,enc:{curve:wave%2?-.45:.45,shape:'crescent',effect:'moonFlash'}});
        break;
      }
      case 491:
        G.Rift.moonSpecialEffect(491, wave);
        status(p).dark = 0.5;
        G.Game.flash('#7666aa', 0.22);
        for (let i = 0; i < 4; i++) field(pointNear(p, R * 0.72), 'dark', 'dark',
          { radius: T * 0.48, damage: e.dmg * 0.28, delay: 0.34 + i * 0.14, duration: 0.9, color: '#7657bd', special: true });
        fan(e,p,19,3.2,{type:'dark',speed:150,enc:{effect:'dark'}});
        break;
      case 249: wind(e,p,true); fan(e,p,17,2.6,{type:'flying',speed:180,enc:{curve:0.35}}); break;
      case 250: for(let i=0;i<5;i++) field(pointNear(p,90+i*65),'fire',null,{radius:45,duration:5,delay:0.95}); fan(e,p,17,2.8,{type:'fire',speed:180}); break;
      case 888: case 889: startDash(e,p,{across:true,special:true,duration:0.65,type:'steel'}); break;
    }
    return true;
  }
  function progress(spawn) {
    if (!arena || !host()) return null;
    const all = (arena.bossIds||[]).map(id=>G.EnemyMgr.get(id));
    for(const e of all) if(e?.dead && !e.encDeathNoted) { e.encDeathNoted=true; arena.lastDefeated=e.dex; }
    if(arena.challengeId==='weather' && !arena.rayArrived && all.some(e=>!e||e.dead)) {
      arena.rayArrived=true;
      fields=[]; emit('clearFields',{}); G.Weather.clear();
      const e=spawn(384); configure(e); return e;
    }
    const latios=all.find(e=>e?.dex===381 && !e.dead), latias=all.find(e=>e?.dex===380);
    if(arena.challengeId==='eon' && latios && (!latias||latias.dead) && !latios.encounter.enraged) {
      latios.encounter.enraged=true; latios.spd*=2; latios.dmg*=2;
      G.Spawner.say('Enraged Latios: Speed and Damage ×2!',3,true);
      G.FX.ring(latios.x,latios.y,latios.r,latios.r*4,'#ff596c',0.8,4);
    }
    return null;
  }
  function sacredSwordDance(wave) {
    const dancers=living().filter(b=>[638,639,640,647].includes(b.dex));
    for (let i=0;i<dancers.length;i++) {
      const b=dancers[i], from={x:b.x,y:b.y}, dx=from.x-arena.x, dy=from.y-arena.y;
      const distance=Math.max(1,Math.hypot(dx,dy)), offset=(i-1.5)*tile()*0.8;
      const centerX=arena.x-dy/distance*offset, centerY=arena.y+dx/distance*offset;
      const to=bound({x:centerX-dx/distance*radius(),y:centerY-dy/distance*radius()},b.r);
      const angle=Math.atan2(to.y-from.y,to.x-from.x), length=Math.hypot(to.x-from.x,to.y-from.y);
      b.encounter.dash={from,to,t:0,wind:0.42+Math.random()*0.12,duration:0.86,type:'fighting',trail:false,hide:false,special:true};
      b.encounter.swordDance=true;
      G.Hazards.add({kind:'beam',x:from.x,y:from.y,angle,len:length,w:Math.max(28,b.r*0.58),delay:0.72+Math.random()*0.14,
        end:0.34,dmg:b.dmg*0.78,type:'fighting',color:'#fff0a8',cat:b.cat,enc:true,source:wave});
      b.anim.play('Charge');
    }
  }
  function contains(f,p) {
    if(f.terrain) return Math.abs(p.x-f.x)<=f.half && Math.abs(p.y-f.y)<=f.half;
    if(f.shape==='wind') { const dx=p.x-f.x,dy=p.y-f.y,c=Math.cos(f.angle),s=Math.sin(f.angle); return dx*c+dy*s>=0 && dx*c+dy*s<=f.length && Math.abs(-dx*s+dy*c)<f.width/2; }
    return Math.hypot(p.x-f.x,p.y-f.y)<=f.radius+p.r*0.3;
  }
  function update(dt) {
    if(!active()) return;
    clock+=dt;
    if (host() && !G.Rift.specialLock) {
      for (let i=volleyQueue.length-1;i>=0;i--) {
        const v=volleyQueue[i];
        if (v.at>clock) continue;
        volleyQueue.splice(i,1);
        if (!v.enemy.dead) shot(v.enemy,v.angle,{type:v.type,speed:v.speed,r:v.radius});
      }
    }
    for(const e of living()) {
      configure(e);
      if(e.remote && !G.Rift.specialLock) e.encounter.age += dt;
      if (host()) G.BossForms?.updateArena(e, dt);
      if (!G.Rift.specialLock && host()) G.BossForms?.update(e, dt);
    }
    const p=G.Game.player, s=status(p);
    for(const key of ['confuse','dark','root','slow','slide','noHeal','noDash']) s[key]=Math.max(0,s[key]-dt);
    fields=fields.filter(f=>(f.permanent||f.terrain||clock-f.born<f.delay+f.duration) && (!f.terrain||(G.EnemyMgr.get(f.owner) && !G.EnemyMgr.get(f.owner).dead)));
    for(const f of fields) {
      if(clock-f.born<f.delay || (G.Rift.specialLock && !f.special) || p.dead) continue;
      if (!f.activated) {
        f.activated = true;
        if (!f.terrain) {
          G.FX.ring(f.x, f.y, 4, f.radius || f.width, f.color, 0.45, 5);
          G.FX.burst(f.x, f.y, f.color, f.special ? 14 : 6, 120);
        }
      }
      f.tick=Math.max(0,f.tick-dt);
      if(!contains(f,p)) continue;
      applyStatus(p,f.effect);
      if(f.damage>0 && f.tick<=0) { f.tick=0.75; p.hurt(f.damage,f.type); }
      if(f.push) { p.x+=Math.cos(f.angle)*f.push*dt; p.y+=Math.sin(f.angle)*f.push*dt; G.World.collide(p); }
      if(f.pull) { const d=Math.hypot(f.x-p.x,f.y-p.y); if(d>8) {p.x+=(f.x-p.x)/d*f.pull*dt;p.y+=(f.y-p.y)/d*f.pull*dt;G.World.collide(p);} }
    }
  }
  function updateProjectile(p,dt) {
    if(!active() || p.orb) return;
    if(p.friendly) {
      const bosses=living();
      if(bosses.some(e=>e.dex===483)) { p.vx*=p.encTimeSlow?1:0.55; p.vy*=p.encTimeSlow?1:0.55; p.encTimeSlow=true; }
      else if(p.encTimeSlow) { p.vx/=0.55; p.vy/=0.55; p.encTimeSlow=false; }
      if(bosses.some(e=>e.dex===484)) rotateVelocity(p,Math.sin(clock*2)*0.8*dt);
    } else if(p.enc?.curve) rotateVelocity(p,p.enc.curve*dt);
    if (!p.friendly && p.enc?.homing) {
      const target=G.Game.player, speed=Math.hypot(p.vx,p.vy), a=Math.atan2(target.y-p.y,target.x-p.x), old=Math.atan2(p.vy,p.vx);
      const delta=Math.atan2(Math.sin(a-old),Math.cos(a-old));rotateVelocity(p,clamp(delta,-dt*p.enc.homing,dt*p.enc.homing));
    }
    if (!p.friendly && p.enc?.zigzag) rotateVelocity(p,Math.cos(p.t*7)*dt*2.5);
    if (!p.friendly && p.enc?.bounce) {
      const dx=p.x-arena.x,dy=p.y-arena.y,d=Math.hypot(dx,dy), dot=(p.vx*dx+p.vy*dy)/d;
      if(d>radius()-p.r && dot>0) {
        if (p.enc.maxBounces != null && (p.encBounces || 0) >= p.enc.maxBounces) p.life = p.t;
        else {
          p.vx-=2*dot*dx/d;p.vy-=2*dot*dy/d;p.encBounces=(p.encBounces||0)+1;
          if (p.enc.returnToOwner) { p.enc.returning = true; p.enc.bounce = false; }
        }
      }
    }
    if (!p.friendly && p.enc?.returning) {
      const owner=G.EnemyMgr.get(p.enc.owner);
      if (!owner || owner.dead) { p.life=p.t; return; }
      const dx=owner.x-p.x,dy=owner.y-p.y,d=Math.hypot(dx,dy),speed=Math.hypot(p.vx,p.vy);
      if(d<=owner.r+p.r+6) {p.life=p.t;return;}
      const target=Math.atan2(dy,dx),current=Math.atan2(p.vy,p.vx);
      const turn=clamp(Math.atan2(Math.sin(target-current),Math.cos(target-current)),-dt*2.8,dt*2.8);
      rotateVelocity(p,turn);
      const a=Math.atan2(p.vy,p.vx);p.vx=Math.cos(a)*speed;p.vy=Math.sin(a)*speed;
    }
  }
  function rotateVelocity(p,a) { const x=p.vx,y=p.vy; p.vx=x*Math.cos(a)-y*Math.sin(a); p.vy=x*Math.sin(a)+y*Math.cos(a); }
  function projectileHit(p,player,damaged=true) {
    if (damaged && p.enc?.effect) applyStatus(player,p.enc.effect);
    if (G.EnemyMgr.get(p.enc?.owner)?.dex === 488) applyStatus(player,'moonFlash');
  }
  function intercept(p) {
    if(!active() || !p.friendly || p.orb) return false;
    if (G.BossForms?.intercept(p)) return true;
    if (p.pierce>0) return false;
    const defense=living().find(e=>G.BossForms?.blocksProjectile(e,p));
    if(defense && Math.hypot(p.x-defense.x,p.y-defense.y)<defense.r+65) return true;
    const guard=living().find(e=>e.dex===889);
    if(!guard || !guard.encounter || G.Rift.specialLock) return false;
    const a=guard.encounter.facing, c=Math.cos(a), s=Math.sin(a), dx=p.x-guard.x,dy=p.y-guard.y;
    if(p.vx*c+p.vy*s>=0) return false;
    const front=dx*c+dy*s, side=-dx*s+dy*c, plane=guard.r+25;
    const px=(p.px??p.x)-guard.x, py=(p.py??p.y)-guard.y, before=px*c+py*s;
    if(before>=plane && front<=plane && before!==front) {
      const t=(before-plane)/(before-front), previousSide=-px*s+py*c;
      return Math.abs(previousSide+(side-previousSide)*t)<=100+p.r;
    }
    return Math.abs(front-plane)<=p.r+8 && Math.abs(side)<=100+p.r;
  }
  function blocksDamage(e, dx, dy, move) {
    if (!controls(e) || (move && move.pierce > 0)) return false;
    if (move?.friendly && G.BossForms?.blocksProjectile(e,move)) return true;
    const guard = living().find(b => b.dex === 889);
    if (!guard?.encounter || Math.hypot(e.x - guard.x, e.y - guard.y) > 160) return false;
    return dx * Math.cos(guard.encounter.facing) + dy * Math.sin(guard.encounter.facing) < 0;
  }
  function drawGround(ctx) {
    if(!arena) return;
    for (const e of living()) G.BossForms?.drawGround(ctx,e);
    for(const f of fields) {
      const age=clock-f.born, ready=age>=f.delay;
      if (f.shape === 'hoopaGate') {
        ctx.save();ctx.translate(f.x,f.y);
        ctx.globalAlpha=Math.min(1,age/0.2)*0.9;
        ctx.fillStyle='#251238';ctx.strokeStyle='#ffd760';ctx.lineWidth=5;
        ctx.beginPath();ctx.ellipse(0,0,f.radius,f.radius*0.7,0,0,TAU);ctx.fill();ctx.stroke();
        ctx.strokeStyle='#d695ff';ctx.lineWidth=3;
        ctx.beginPath();ctx.ellipse(0,0,f.radius*0.65,f.radius*0.45,age*2,0,TAU);ctx.stroke();
        ctx.restore();continue;
      }
      ctx.save(); ctx.strokeStyle=f.color; ctx.fillStyle=f.color;
      ctx.globalAlpha=ready?0.24:0.12; ctx.lineWidth=ready?3:2;
      if(!ready) ctx.setLineDash([7,5]);
      ctx.beginPath();
      if(f.terrain) ctx.rect(f.x-f.half,f.y-f.half,f.half*2,f.half*2);
      else if(f.shape==='wind') { ctx.translate(f.x,f.y); ctx.rotate(f.angle); ctx.rect(0,-f.width/2,f.length,f.width); }
      else ctx.arc(f.x,f.y,f.radius,0,TAU);
      ctx.fill(); ctx.globalAlpha=0.8; ctx.stroke(); ctx.setLineDash([]);
      if(f.shape==='wind') for(let x=20;x<f.length;x+=45) {ctx.beginPath();ctx.moveTo(x-8,-10);ctx.lineTo(x+8,0);ctx.lineTo(x-8,10);ctx.stroke();}
      else if(f.shape==='lightning' && ready) {ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(f.x+12,f.y-140);ctx.lineTo(f.x-10,f.y-65);ctx.lineTo(f.x+12,f.y-65);ctx.lineTo(f.x,f.y);ctx.stroke();}
      else if(!f.terrain) {ctx.globalAlpha=0.5;ctx.beginPath();ctx.arc(f.x,f.y,f.radius*(ready?0.65+Math.sin(age*4)*0.12:clamp(age/f.delay,0,1)),0,TAU);ctx.stroke();}
      if (ready && !f.terrain && f.shape !== 'wind') drawFieldEffect(ctx, f, age);
      ctx.restore();
    }
    for (const e of living()) if(e.dex===386 && e.encounter?.formIndex===1) {
      ctx.save();ctx.strokeStyle='#9affd8';ctx.lineWidth=5;ctx.globalAlpha=0.7;
      ctx.beginPath();ctx.arc(e.x,e.y,e.r+55,0,TAU);ctx.stroke();ctx.restore();
    }
    const guard=living().find(e=>e.dex===889);
    if(guard?.encounter && !G.Rift.specialLock) {
      ctx.save();ctx.translate(guard.x,guard.y);ctx.rotate(guard.encounter.facing);ctx.strokeStyle='#9bdcff';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(guard.r+25,-100);ctx.lineTo(guard.r+25,100);ctx.stroke();ctx.restore();
    }
  }
  function drawFieldEffect(ctx, f, age) {
    // Animated element silhouettes distinguish active danger from the dashed warning footprint.
    ctx.globalAlpha=0.75;ctx.lineWidth=2;
    if (f.type==='water' || f.shape==='vortex') {
      for(let j=0;j<3;j++) {
        const r=f.radius*(0.2+((age*0.45+j/3)%1)*0.8);
        ctx.beginPath();ctx.arc(f.x,f.y,r,age+j,age+j+Math.PI*1.5);ctx.stroke();
      }
    } else if (f.type==='fire') {
      for(let j=0;j<7;j++) {
        const a=j*TAU/7+age*0.25, r=f.radius*0.55, x=f.x+Math.cos(a)*r,y=f.y+Math.sin(a)*r;
        const h=12+12*(0.5+Math.sin(age*9+j)*0.5);
        ctx.beginPath();ctx.moveTo(x-5,y);ctx.quadraticCurveTo(x+8,y-h*0.4,x,y-h);ctx.quadraticCurveTo(x-10,y-h*0.3,x+5,y);ctx.fill();
      }
    } else if(f.type==='ice') {
      for(let j=0;j<6;j++) {
        const a=j*TAU/6,x=f.x+Math.cos(a)*f.radius*0.6,y=f.y+Math.sin(a)*f.radius*0.6;
        ctx.beginPath();ctx.moveTo(x,y-17);ctx.lineTo(x+7,y);ctx.lineTo(x,y+7);ctx.lineTo(x-7,y);ctx.closePath();ctx.stroke();
      }
    } else if(f.type==='electric') {
      ctx.beginPath();
      for(let j=0;j<13;j++) {const a=j*TAU/12,r=f.radius*(j%2?0.5:0.9);const x=f.x+Math.cos(a+age)*r,y=f.y+Math.sin(a+age)*r;j?ctx.lineTo(x,y):ctx.moveTo(x,y);}
      ctx.stroke();
    } else {
      ctx.beginPath();for(let j=0;j<=6;j++){const a=j*TAU/6+age*0.6,x=f.x+Math.cos(a)*f.radius*0.8,y=f.y+Math.sin(a)*f.radius*0.8;j?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
    }
  }
  function drawOverlay(ctx,w,h) {
    if(!active()) return;
    const fx=effects(G.Game.player), labels=[];
    for (const e of living()) {
      const label=G.BossForms?.statusLabel(e);
      if (label) labels.push(label);
    }
    if(fx.dark) {
      ctx.save();ctx.fillStyle='rgba(5,2,16,.97)';ctx.fillRect(0,0,w,h);ctx.restore();
      labels.push('Nightmare · 0.5s');
    }
    if(fx.confused) labels.push('Confused · Controls Inverted 3s');
    if(fx.noHeal) labels.push('Mist: Healing Blocked'); if(fx.noDash) labels.push('Terrain: Dash Disabled');
    if(fx.damage<1) labels.push('Ruin Aura: Damage & Speed −50%');
    if(living().some(e=>e.dex===483)) labels.push('Dialga: Time Dilation');
    if(living().some(e=>e.dex===484)) labels.push('Palkia: Warped Trajectories');
    const regi=living().find(e=>e.dex===486 && e.encounter?.age<10);
    if(regi) labels.push('Slow Start · '+Math.ceil(10-regi.encounter.age)+'s');
    if(labels.length) {ctx.save();ctx.textAlign='center';ctx.font='700 13px Pixelify, sans-serif';ctx.fillStyle='#ffe5a0';ctx.strokeStyle='#121629';ctx.lineWidth=4;const t=labels.join(' · ');ctx.strokeText(t,w/2,h-88,w-40);ctx.fillText(t,w/2,h-88,w-40);ctx.restore();}
  }
  function drawProjectile(ctx,p) {
    const shape=p.enc?.shape;
    if(!shape) return false;
    ctx.save();ctx.translate(p.x,p.y-G.LIFT);ctx.rotate(Math.atan2(p.vy,p.vx));ctx.strokeStyle=p.color;ctx.fillStyle=p.color;ctx.lineWidth=2;
    if(shape==='portal') {
      ctx.strokeStyle='#ffd760';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(0,0,p.r,p.r*0.65,0,0,TAU);ctx.stroke();
      ctx.strokeStyle='#c87aff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,p.r*0.65,p.r*0.4,0,0,TAU);ctx.stroke();
    }
    else if(shape==='crescent') {ctx.strokeStyle='#fff0ad';ctx.lineWidth=3;ctx.beginPath();ctx.arc(-p.r*0.4,0,p.r,-Math.PI/2,Math.PI/2);ctx.stroke();}
    else if(shape==='bubble') {ctx.globalAlpha=0.35;ctx.beginPath();ctx.arc(0,0,p.r,0,TAU);ctx.fill();ctx.globalAlpha=1;ctx.stroke();ctx.strokeStyle='#ecfbff';ctx.beginPath();ctx.arc(-2,-2,p.r*0.65,Math.PI,Math.PI*1.5);ctx.stroke();}
    else if(shape==='note') {ctx.rotate(-Math.atan2(p.vy,p.vx));ctx.beginPath();ctx.ellipse(-3,4,5,3,-0.4,0,TAU);ctx.fill();ctx.beginPath();ctx.moveTo(1,4);ctx.lineTo(1,-10);ctx.lineTo(8,-5);ctx.stroke();}
    else if(shape==='saw') {ctx.rotate(p.t*9);ctx.beginPath();for(let i=0;i<24;i++){const a=i*TAU/24,r=p.r*(i%2?0.65:1);i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.strokeStyle='#e6ffb4';ctx.stroke();}
    else {ctx.beginPath();ctx.moveTo(p.r*1.5,0);ctx.lineTo(0,p.r);ctx.lineTo(-p.r,0);ctx.lineTo(0,-p.r);ctx.closePath();ctx.fill();ctx.strokeStyle='#fff';ctx.stroke();}
    ctx.restore();return true;
  }
  function onEvent(ev) {
    if(!arena) return;
    if(ev[1]==='field') addField(ev[2],true);
    if(ev[1]==='clearFields') fields=[];
    if(ev[1]==='state') {const e=G.EnemyMgr.get(ev[2].id);if(e) {configure(e);if(e.encounter)e.encounter.hidden=!!ev[2].hidden;}}
    if(ev[1]==='cancel') {fields=fields.filter(f=>f.permanent||f.terrain);for(const f of fields)f.special=false;for(const e of living()) if(e.encounter) {e.encounter.dash=null;e.encounter.teleportCast=null;e.encounter.hidden=false;}}
  }
  return { STAGES, begin, reset, controls, configure, move, update, updateProjectile, projectileHit, intercept, blocksDamage, effects, specialWave, progress, cancelCasts, beginSharedHealth, hasSharedHealth, damageSharedHealth, sharedHealthBar,
    drawGround, drawOverlay, drawProjectile, onEvent,
    get active() { return active(); }, get fields() { return fields; },
    defeated(e) { if (controls(e)) { arena.lastDefeated = e.dex; e.encDeathNoted = true; } },
    skill(dex) { return G.BossForms?.skill(dex) || MOVES[dex] || ['Ruinous Power','Defeat one boss to break the aura, then dodge dark bullet volleys.']; },
  attacks: { shot, fan, beam, pool, pointNear, bound, radius, attackRadius: radius, startDash, dashMove, applyStatus },
    specialMove(e, dt) {
      const swordDance=arena?.challengeId==='swords' && e.encounter?.swordDance && e.encounter?.dash?.special;
      if (!controls(e) || !(e.encounter?.dash?.special && (G.Rift.specialBossId===e.id || swordDance))) return false;
      const [vx,vy,anim]=dashMove(e,dt);e.x+=vx*dt;e.y+=vy*dt;e.anim.loop(anim);return true;
    },
    hidden(e) { return controls(e) && !!e.encounter?.hidden; }
  };
})();

/* ============ rift.js — rifts and legendary arena ============
 *
 * Occasionally (a few times per run), a RIFT opens near a player.
 * It lasts TTL seconds; entering transports the player (and party)
 * to an arena in the Distortion World against a LEGENDARY Pokémon.
 *
 *   win   the legendary drops tickets (x10 ticket ~50% of the time) and coins,
 *         and each player gets a BOND (fuse moves, see Player.fuse); after a
 *         few seconds players return to the map to choose their fusion.
 *   lose  (all faint or time expires) return without reward, with remaining
 *         HP; the run continues.
 *
 * While the arena lasts, map enemies are stashed (EnemyMgr.stash) and
 * no new enemies spawn; upon returning, state is restored.
 *
 * Coop: decided by host. Messages (see coop.js):
 *   'rift' x y ttl · 'riftx' · 'arena' cfg · 'aw' (won) · 'al' (lost)
 *   and from client to host: 're' (entered rift).
 */
G.Rift = (() => {
  // Cooldown and spawn chance:
  // After each failed check, chance increases (20%, 40%, 60%, 80%, 100%):
  // at most 2.5 min between rifts. Closed 2 min prior to Judgment (minute 30).
  const CHECK = 30, CHANCE = 0.2, TTL = 45;
  const ARENA_R = 11, ARENA_TIME = 120, STORY_TIME = 300, FROM = 75;
  const STORY_BOSSES = [382, 383, 384]; // Kyogre, Groudon, Rayquaza
  const CHALLENGES = [
    ['zygarde','Zygarde · Order Restored','forms',[718],[[718]]], ['darmanitan','Darmanitan · Zen Awakening','forms',[555],[[555]]],
    ['wishiwashi','Wishiwashi · Schooling','forms',[746],[[746]]], ['necrozma','Necrozma · Ultra Burst','forms',[800],[[800]]],
    ['aegislash','Aegislash · Stance Change','forms',[681],[[681]]], ['deoxys','Deoxys · Four Formes','forms',[386],[[386]]],
    ['rotom','Rotom · Appliance Shifts','forms',[479],[[479]]], ['meloetta','Meloetta · Relic Song','forms',[648],[[648]]],
    ['hoopa','Hoopa · Unbound Prison','forms',[720],[[720]]], ['terapagos','Terapagos · Terastal Form','forms',[1024],[[1024]]],
    ['weather','Weather Trio','trio',[382,383,384],[[382,383],[384]]], ['creation','Creation Trio','trio',[483,484,487],[[483,484],[487]]],
    ['tao','Tao Trio','trio',[643,644,646],[[643,644],[646]]], ['lake','Lake Trio','trio',[480,481,482],[[480,481,482]]],
    ['beasts','Legendary Beasts','trio',[243,244,245],[[243,244,245]]], ['birds','Legendary Birds','trio',[144,145,146],[[144,145,146]]],
    ['swords','Swords of Justice','squad',[638,639,640,647],[[638,639,640,647]]], ['tapu','Guardian Deities','squad',[785,786,787,788],[[785,786,787,788]]],
    ['ruin','Treasures of Ruin','squad',[1001,1002,1003,1004],[[1001,1002,1003,1004]]],
    ['regi','Legendary Titans','squad',[377,378,379,894,895,486],[[377,378,379,894,895],[486]]],
    ['eon','Eon Duo','duo',[380,381],[[380,381]]], ['moon','Lunar Duo','duo',[488,491],[[488,491]]],
    ['tower','Tower Duo','duo',[249,250],[[249,250]]], ['heroes','Hero Duo','duo',[888,889],[[888,889]]]
  ].map(([id,title,kind,dexes,waves]) => ({id,title,kind,dexes,waves,available:id!=='ruin',description:({
    ruin:'Locked: Wo-Chien and Chien-Pao missing sprites.', weather:'Kyogre/Groudon deploy blast hazards; Rayquaza sweeps diagonal beams.',
    swords:'Four bosses converge; dodge red danger zones and bullet fans.', eon:'Latias supports Latios; danger zones appear around the player.',
    creation:'Dialga/Palkia create danger zones; Giratina delivers the final assault.', tao:'Initial duo opens battle; Kyurem follows with dense bullet zones.',
    forms:'Boss has two HP bars. When the first empties, dodge during the transformation.'
  })[id] || (kind==='forms'?'Boss has two HP bars; when first empties, boss transforms; dodge danger zones.':'Bosses unleash telegraphed special attacks in sequence.')}));
  CHALLENGES.forEach(stage => {
    stage.title = ({
      zygarde: 'Zygarde: Order Restored', darmanitan: 'Darmanitan: Zen Awakening', wishiwashi: 'Wishiwashi: Schooling', necrozma: 'Necrozma: Ultra Burst',
      aegislash: 'Aegislash: Stance Change', deoxys: 'Deoxys: Four Formes', rotom: 'Rotom: Appliance Shifts', meloetta: 'Meloetta: Relic Song',
      hoopa: 'Hoopa: Unbound Prison', terapagos: 'Terapagos: Terastal Form', weather: 'Weather Trio', creation: 'Creation Trio', tao: 'Tao Trio', lake: 'Lake Trio',
      beasts: 'Legendary Beasts', birds: 'Legendary Birds', swords: 'Swords of Justice', tapu: 'Guardian Deities', ruin: 'Treasures of Ruin', regi: 'Legendary Titans',
      eon: 'Eon Duo', moon: 'Lunar Duo', tower: 'Tower Duo', heroes: 'Hero Duo'
    })[stage.id];
    stage.description = stage.id === 'zygarde' ? 'Three forms: 10% → 50% → Complete.' : stage.kind === 'forms'
      ? 'Boss has two HP bars; when first empties, it transforms with a special attack.'
      : 'Defeat bosses across sequential waves. Watch hazard telegraphs to evade special attacks.';
    if (stage.id === 'zygarde') stage.previewForms = ['10% Form', '50% Form', 'Complete Form'];
  });
  let rift = null;          // { x, y, ttl, t }
  let arena = null;         // { tx, ty, r, dex, shiny, x, y, back, biome, t, phase, endT, bossId }
  let zone = null;          // previous arena location { x, y, r } (see leftBehind)
  let checkT = CHECK, asked = false, downT = 0, misses = 0;
  let storyStarted = false;
  const authority = () => !G.Coop.active || G.Coop.isHost;
  const TS = () => G.Tiles.T * G.Sprites.PX;
  const T = (k, ctx) => (G.I18n?.t ? G.I18n.t(k, ctx) : (typeof G.T === 'function' ? G.T(k, ctx) : k));

  function reset() { G.StoryEncounters?.reset(); rift = null; arena = null; zone = null; checkT = CHECK; asked = false; downT = 0; misses = 0; storyStarted = false; }

  /**
   * Is this player still in the arena even if we already returned to the map?
   * In coop, host returns slightly before clients (network delay) and still sees
   * them in the arena zone.
   */
  function leftBehind(p) {
    return !arena && !!zone && G.U.dist2(p.x, p.y, zone.x, zone.y) < zone.r * zone.r;
  }

  // ---------------- rift on map ----------------

  function update(dt, pl, time) {
    if (!arena && authority() && time >= 10 * 60 && !storyDone()) {
      if (!rift || !rift.story) {
        rift = null;
        openStoryRift();
      }
    }
    if (rift) {
      rift.t += dt;
      rift.ttl -= dt;
      if (rift.ttl <= 0) { rift = null; return; }
      if (!arena && !pl.dead && G.U.dist2(pl.x, pl.y, rift.x, rift.y - 10) < 30 * 30) enter();
    } else if (!arena && authority() && time > FROM && time < G.Judgment.AT - 120 && time < 10 * 60) {
      checkT -= dt * (G.Game && G.Game.timeScale != null ? G.Game.timeScale : 1);
      if (checkT <= 0) {
        checkT = CHECK;
        if (G.EnemyMgr.bossAlive()) return;           // a living boss prevents rift attempts
        if (Math.random() < CHANCE * (1 + misses)) { misses = 0; open(); }
        else misses++;
      }
    }
    if (arena) arenaTick(dt, pl);
  }

  function open() {
    const alive = G.Game.everyone().filter(p => !p.dead);
    const near = G.U.pick(alive.length ? alive : [G.Game.player]);
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(380, 560);
      const x = near.x + Math.cos(a) * d, y = near.y + Math.sin(a) * d * 0.85;
      if (!G.World.isFree(x, y, 22)) continue;
      show(x, y, TTL);
      if (G.Coop.isHost) G.Coop.broadcast(['rift', Math.round(x), Math.round(y), TTL]);
      return;
    }
  }

  function openStoryRift() {
    storyStarted = false;
    const alive = G.Game.everyone().filter(p => !p.dead);
    const near = G.U.pick(alive.length ? alive : [G.Game.player]);
    let x = near.x, y = near.y;
    for (let i = 0; i < 24; i++) {
      const angle = i * 2.39996, distance = G.U.rand(110, 190);
      x = near.x + Math.cos(angle) * distance;
      y = near.y + Math.sin(angle) * distance * 0.8;
      if (G.World.isFree(x, y, 22)) break;
    }
    show(x, y, TTL, true);
    if (G.Coop.isHost) G.Coop.broadcast(['rift', Math.round(x), Math.round(y), TTL, 1]);
  }

  /** Spawns the rift (including broadcast from host). */
  function show(x, y, ttl, story = false) {
    rift = { x, y, ttl, t: 0, story };
    asked = false;
    // (Banner is drawn by hud.js while rift.t < 4.5s)
    G.Audio.sfx('rift');
    G.FX.ring(x, y, 6, 80, '#b48aff', 0.7, 5);
  }

  function enter() {
    if (asked) return;
    asked = true;
    if (authority()) rift && rift.story ? startStory() : start();
    else G.Coop.toHost(['re']);
  }

  // ---------------- arena ----------------

  /** Host authority: selects legendary and location, and broadcasts to party. */
  let nextType = null;          // debug/video: next arena type

  function start(forceType) {
    if (arena) return;
    forceType = forceType || nextType; nextType = null;
    let pool = G.DEX.filter(p => p.leg && G.SPRITE_META[p.dex]);
    if (forceType && pool.some(p => p.types.includes(forceType))) pool = pool.filter(p => p.types.includes(forceType));
    // Unbeaten legendaries have 4x weight (fewer repeats).
    const beaten = (G.DB.save && G.DB.save.legends) || {};
    const ws = pool.map(p => (beaten[p.dex] ? 1 : 4));
    let r = Math.random() * ws.reduce((a, b) => a + b, 0), mi = 0;
    while (mi < pool.length - 1 && (r -= ws[mi]) > 0) mi++;
    const mon = pool[mi];
    const cfg = {
      tx: 5000 + Math.floor(Math.random() * 3000), ty: 5000 + Math.floor(Math.random() * 3000), r: ARENA_R,
      dex: mon.dex, shiny: G.Sprites.hasShiny(mon.dex) && Math.random() < 1 / 512,
      // Arena matches one of the boss types at random.
      type: forceType || G.U.pick(mon.types)
    };
    if (G.Coop.isHost) G.Coop.broadcast(['arena', cfg]);
    begin(cfg);
    spawnLegend();
  }

  function storyDone() { return storyStarted; }

  function startStory() {
    if (storyStarted) return;
    storyStarted = true;
    rift = null;
    const cfg = {
      tx: 5000 + Math.floor(Math.random() * 3000), ty: 5000 + Math.floor(Math.random() * 3000),
      r: ARENA_R, type: 'fire', story: true, bosses: STORY_BOSSES
    };
    if (G.Coop.isHost) G.Coop.broadcast(['arena', cfg]);
    begin(cfg);
  }

  function challengeStages() {
    return CHALLENGES.map(stage => Object.assign({}, stage, G.StoryEncounters?.STAGES[stage.id] || {},
      { reason: stage.id === 'ruin' ? 'Locked: missing Wo-Chien (#1001) and Chien-Pao (#1002) sprites.' : '' }));
  }

  function startChallenge(stageId) {
    if (arena) return false;
    const stage = challengeStages().find(item => item.id === stageId);
    if (!stage || !stage.available || stage.dexes.some(dex => !G.DEX_BY[dex] || !G.SPRITE_META[dex])) return false;
    const cfg = { tx: 5000 + Math.floor(Math.random() * 3000), ty: 5000 + Math.floor(Math.random() * 3000), r: ARENA_R,
      type: 'dragon', story: true, challenge: true, challengeId: stage.id, challengeKind: stage.kind, challengeWaves: stage.waves, challengeTitle: stage.title };
    begin(cfg);
    if (G.Coop.isHost) G.Coop.broadcast(['arena', cfg]);
    return true;
  }

  /** Local machine: travel to arena. */
  function begin(cfg) {
    const pl = G.Game.player;
    const ts = TS();
    arena = Object.assign({}, cfg, {
      x: cfg.tx * ts + ts / 2, y: cfg.ty * ts + ts / 2,
      back: { x: pl.x, y: pl.y }, biome: G.World.biome, t: 0, phase: cfg.story ? 'intro' : 'fight', endT: 0, bossId: 0,
      story: !!cfg.story, challenge: !!cfg.challenge, challengeId: cfg.challengeId || '', challengeKind: cfg.challengeKind || '', challengeTitle: cfg.challengeTitle || '', challengeWaves: cfg.challengeWaves || null,
      introT: 0, storyIndex: 0, bosses: cfg.story ? (cfg.bosses || STORY_BOSSES) : null,
      autoSwapBefore: cfg.story ? !!pl.autoSwap : null
    });
    if (arena.challenge) arena.previewMons = [...new Set(arena.challengeWaves.flat())].map(dex => {
      const animator = new G.Sprites.Animator(dex, 1.25);
      animator.dir = 0;
      return { dex, animator };
    });
    G.StoryEncounters?.begin(arena);
    if (cfg.story) { pl.autoSwap = false; pl.autoSwapTimer = 0; }
    zone = { x: arena.x, y: arena.y, r: (cfg.r + 10) * ts };
    rift = null; asked = false; downT = 0;
    if (authority()) G.EnemyMgr.stash(); else G.EnemyMgr.clearRemote();
    G.Projectiles.clear();
    G.Combat.clearFields();
    G.Hazards.clear();
    G.World.setArena({ tx: cfg.tx, ty: cfg.ty, r: cfg.r, type: cfg.type, clearFloor: !!(cfg.challenge && G.StoryEncounters?.STAGES[cfg.challengeId]) });
    G.World.setBiome(G.Tiles.arenaBiome(cfg.type), true);
    // Each arena brings its weather (volcano -> sun, glacier -> snow, etc.).
    const th = G.Tiles.ARENA_THEMES[cfg.type];
    if (th && th.weather) G.Weather.force(th.weather, ARENA_TIME + 15);
    // Players spawn to the south in a line; legendary spawns north.
    const ps = G.Game.everyone();
    ps.forEach((p, i) => { p.x = arena.x + (i - (ps.length - 1) / 2) * 34; p.y = arena.y + ts * 3; });
    G.Camera.x = pl.x; G.Camera.y = pl.y;
    G.Game.flash(cfg.story ? '#fff1a3' : '#c9a6ff', 0.9);
    G.Audio.sfx('rift');
    G.Spawner.say(cfg.challenge ? cfg.challengeTitle : cfg.story ? T('La tríada del clima…') : T('Has entrado en la grieta…'), 2.4, true);
  }

  function spawnLegend(dex = arena.dex, storyBoss = false, x = arena.x, y = arena.y - TS() * 3.5) {
    const mon = G.DEX_BY[dex];
    const t = G.Game.st.matchTime;
    const n = G.Game.everyone().length;
    const ts = TS();
    const def = {
      dex: mon.dex, name: mon.name,
      hp: Math.round((3200 + t * 9) * G.Coop.scaleHp(n) * (n > 1 ? 1.4 : 1)),
      spd: Math.round(G.U.clamp(48 + (mon.spd - 78) * 0.6, 48, 105)),
      dmg: Math.round(36 + t / 20), xp: Math.round(500 + t * 1.2),
      behavior: mon.types.some(x => ['psychic', 'electric', 'ghost', 'fairy', 'fire', 'water', 'ice', 'dragon'].includes(x)) ? 'ranged' : 'charger',
      shotDmg: Math.round(18 + t / 40), shotCd: 0.9, range: 300
    };
    const e = new G.Enemy(def, x, y, G.Enemies.hurryScale(t, true), true);
    e.legend = true;
    e.storyBoss = storyBoss;
    // Collides with walls and pillars like player so shots can hit.
    e.flying = false;
    if (arena.shiny) e.makeShiny();
    G.EnemyMgr.add(e);
    arena.bossId = e.id;
    G.Spawner.say('¡' + e.name + (e.shiny ? ' shiny' : '') + ' te esperaba en la grieta!', 3.2);
    G.Camera.kick(1.1);
    G.Audio.sfx('boss');
  }

  /** Constrain entities within the circular arena boundary. */
  function keepInside() {
    const ts = TS(), max = (arena.r - 1.4) * ts;
    for (const e of G.EnemyMgr.all()) {
      if (e.remote) continue;
      const dx = e.x - arena.x, dy = e.y - arena.y, d = Math.hypot(dx, dy);
      if (d > max) { e.x = arena.x + dx / d * max; e.y = arena.y + dy / d * max; }
    }
  }

  function arenaTick(dt, pl) {
    arena.t += dt;
    if (arena.phase === 'intro') {
      arena.introT += dt;
      arena.previewMons?.forEach(entry => entry.animator.update(dt));
      if (arena.introT >= 4) {
        if (authority()) spawnStoryBoss();
        arena.phase = 'fight';
      }
      return;
    }
    if (arena.phase === 'fight') {
      if (arena.story && !authority() && arena.evading > 0) arena.evading = Math.max(0, arena.evading - dt);
      if (!authority()) return;
      keepInside();
      const boss = G.EnemyMgr.get(arena.bossId);
      if (arena.story && arena.bossIds) {
        if (G.StoryEncounters?.active) {
          const arrival = G.StoryEncounters.progress(dex => {
            spawnLegend(dex, true);
            const e = G.EnemyMgr.get(arena.bossId);
            e.challengeStageId = arena.challengeId;
            arena.bossIds.push(e.id);
            return e;
          });
          if (arrival) {
            arena.evading = 0; arena.cine = null;
            arena.activeEvadeBossId = arrival.id;
            startStorySpecialCue(arrival);
          }
        }
        const living = arena.bossIds.map(id => G.EnemyMgr.get(id)).filter(e => e && !e.dead);
        if (living.length) {
          arena.bossId = living[0].id;
          if (!G.StoryEncounters?.active && arena.storyIndex === 0 && living.length === 1 && !arena.linkEnrage) {
            arena.linkEnrage = true;
            living[0].spd *= 1.5;
            living[0].dmg *= 1.5;
            G.Spawner.say('¡El vínculo enfurece al superviviente!', 2.4, true);
          }
          storyEvadeTick(dt, living);
        } else if (arena.storyIndex + 1 < (arena.challenge ? arena.challengeWaves.length : 2)) {
          arena.storyIndex++;
          spawnStoryBoss();
          return;
        } else {
          G.Coop.isHost && G.Coop.broadcast(['aw']); won(); return;
        }
      } else if (!boss || boss.dead) {
        G.Coop.isHost && G.Coop.broadcast(['aw']); won(); return;
      }
      if (!arena.story) {
        if (!boss || boss.dead) {
          G.Coop.isHost && G.Coop.broadcast(['aw']); won(); return;
        }
      }
      const allDown = G.Game.everyone().every(p => p.dead);
      downT = allDown ? downT + dt : 0;
      if (downT > 1.4 || (!arena.challenge && arena.t > (arena.story ? STORY_TIME : ARENA_TIME))) { G.Coop.isHost && G.Coop.broadcast(['al']); lost(); }
      return;
    }
    arena.endT -= dt;
    if (arena.endT <= 0) finish();
  }

  function spawnStoryBoss() {
    if (!arena || !arena.story) return;
    const ts = TS();
    arena.bossIds = [];
    arena.storyBossTurn = 0;
    if (arena.challenge) {
      const wave = arena.challengeWaves[arena.storyIndex] || [];
      const spacing = wave.length > 1 ? Math.min(2.4, 7 / (wave.length - 1)) : 0;
      wave.forEach((dex, i) => {
        spawnLegend(dex, true, arena.x + (i - (wave.length - 1) / 2) * ts * spacing, arena.y - ts * 3.5);
        const enemy = G.EnemyMgr.get(arena.bossId);
        if (enemy) { enemy.challengeBoss = arena.challengeKind === 'forms'; enemy.challengeStageId = arena.challengeId; }
        arena.bossIds.push(arena.bossId);
        G.StoryEncounters?.configure(enemy);
      });
      arena.dex = wave[0];
      arena.evading = 0; arena.cine = null; arena.evadeT = 12;
      arena.targetId = arena.bossIds[0];
      if (arena.challengeId === 'tao' && wave.includes(646)) {
        const boss = G.EnemyMgr.get(arena.bossIds[0]);
        arena.activeEvadeBossId = boss.id;
        startStorySpecialCue(boss);
      }
      return;
    }
    if (arena.storyIndex === 0) {
      for (const [dex, x] of [[382, arena.x - ts * 2.5], [383, arena.x + ts * 2.5]]) {
        spawnLegend(dex, true, x, arena.y - ts * 3.5);
        arena.bossIds.push(arena.bossId);
      }
      arena.dex = 382;
    } else {
      spawnLegend(384, true, arena.x, arena.y - ts * 3.5);
      arena.bossIds.push(arena.bossId);
      arena.dex = 384;
    }
  }

  function storyEvadeTick(dt, bosses) {
    if (arena.cine) return;
    if (arena.evadeT == null) arena.evadeT = 12;
    if (arena.evading > 0) {
      if (arena.specialWaveCount < 3) {
        arena.specialWaveCd -= dt;
        if (arena.specialWaveCd <= 0) {
          const attacker = G.EnemyMgr.get(arena.activeEvadeBossId);
          arena.specialWaveCount++;
          arena.specialWaveCd = 4 / 3;
          if (attacker && !attacker.dead) fireStorySpecialWave(attacker);
        }
      }
      arena.evading -= dt;
      if (arena.evading <= 0) {
        arena.evading = 0;
        if (G.Coop.isHost) G.Coop.broadcast(['se', 0]);
        const boss = G.EnemyMgr.get(arena.activeEvadeBossId);
        if (boss && !boss.dead && G.Game.everyone().some(p => !p.dead)) boss.applyStun(1.5);
        G.Spawner.say('¡Buen esquive! El jefe queda aturdido.', 2.2, true);
      }
      return;
    }
    arena.evadeT -= dt;
    if (arena.evadeT > 0) return;
    const living = bosses.filter(e => e && !e.dead && !(e.transformT > 0));
    if (!living.length) return;
    arena.evadeT = living.length > 1 ? 9 : 18;
    const boss = living[(arena.storyBossTurn || 0) % living.length];
    arena.storyBossTurn = (arena.storyBossTurn || 0) + 1;
    arena.activeEvadeBossId = boss.id;
    startStorySpecialCue(boss);
  }

  function startStorySpecialCue(boss) {
    if (arena.cine || arena.evading > 0) return;
    arena.cine = { t: 0, dur: 1, bossId: boss.id, dex: boss.dex, form: boss.spriteForm || '', shiny: boss.shiny };
    G.Hazards.clear();
    G.Projectiles.clearHostile();
    G.StoryEncounters?.cancelCasts();
    G.Game.flash(G.U.TYPE_COLOR[boss.atkType] || '#fff1a3', 0.8);
    G.Camera.kick(1.1);
    if (G.Coop.isHost) G.Coop.broadcast(['sc', boss.id]);
  }

  function moonSpecialEffect(dex, wave) {
    if (!arena) return;
    if (dex === 491) arena.moonDarkUntil = arena.t + 0.5;
    if (dex === 488) arena.moonSweep = { until: arena.t + 1.4, wave };
  }

  function startStoryEvade(boss) {
    if (!arena || !arena.story || !boss || boss.dead) return;
    arena.evading = 4;
    arena.specialWaveCd = 4 / 3;
    arena.specialWaveIndex = 0;
    arena.specialWaveCount = 1;
    if (G.Coop.isHost) G.Coop.broadcast(['se', 4]);
    G.Spawner.say('¡Esquiva! Mantén la movilidad.', 4, true);
    fireStorySpecialWave(boss);
  }

  function fireStorySpecialWave(boss) {
    const ts = TS();
    const wave = arena.specialWaveIndex++;
    boss.specialAttackAnimT = 0.72;
    boss.anim.play('Shoot', { speed: 1.5 });
    if (G.StoryEncounters?.specialWave(boss, wave)) return;
    const color = G.U.TYPE_COLOR[boss.atkType] || '#ff5f6d';
    const players = G.Game.everyone().filter(p => !p.dead);
    const target = wave % 2 === 0 && players.length ? G.U.pick(players) : null;
    const cx = target ? target.x : arena.x + G.U.rand(-ts * 3.5, ts * 3.5);
    const cy = target ? target.y : arena.y + G.U.rand(-ts * 3.5, ts * 3.5);
    if (arena.challenge) { fireChallengeSpecialWave(boss, wave, cx, cy, ts, color); return; }
    if (boss.dex === 384) {
      // Rayquaza sweeps crossing beams through changing points around the players.
      const angle = G.U.rand(-Math.PI * 0.45, Math.PI * 0.45);
      for (let i = 0; i < 2; i++) {
        const beamAngle = angle + i * Math.PI / 2;
        const dx = Math.cos(beamAngle), dy = Math.sin(beamAngle);
        G.Hazards.add({ kind: 'beam', x: cx - dx * ts * 5, y: cy - dy * ts * 5,
          angle: beamAngle, len: ts * 10, w: ts * 0.52, delay: 0.3 + i * 0.08,
          dmg: boss.dmg * 0.82, type: boss.atkType, color });
      }
    } else if (boss.dex === 382) {
      // Kyogre sends broad horizontal surges, leaving one changing safe lane.
      const reach = (arena.r - 1.4) * ts;
      const candidateCount = 15, laneCount = 7;
      const candidates = Array.from({ length: candidateCount }, (_, i) => i);
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = G.U.randInt(0, i);
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      const lanes = [];
      for (const candidate of candidates) {
        if (lanes.length >= laneCount) break;
        if (lanes.every(index => Math.abs(index - candidate) >= 2)) lanes.push(candidate);
      }
      if (lanes.length < laneCount) {
        for (const candidate of candidates) {
          if (lanes.length >= laneCount) break;
          if (!lanes.includes(candidate)) lanes.push(candidate);
        }
      }
      const jitter = (reach * 2 / (candidateCount - 1)) * 0.35;
      for (const lane of lanes) {
        const baseY = arena.y - reach + lane * (reach * 2 / (candidateCount - 1));
        const y = G.U.clamp(baseY + G.U.rand(-jitter, jitter), arena.y - reach, arena.y + reach);
        const fromLeft = Math.random() < 0.5;
        G.Hazards.add({ kind: 'beam', x: fromLeft ? arena.x - reach : arena.x + reach, y,
          angle: fromLeft ? 0 : Math.PI, len: reach * 2, w: ts * 1.1, delay: G.U.rand(0.82, 1.1),
          dmg: boss.dmg * 0.78, type: boss.atkType, color: '#55dfff' });
      }
    } else if (boss.dex === 383) {
      // Groudon triggers a readable, staggered chain of lava craters.
      for (let i = 0; i < 6; i++) {
        const x = cx + (i - 2.5) * ts * 1.12;
        const y = cy + Math.sin(i * 1.7 + wave) * ts * 1.1;
        G.Hazards.add({ kind: 'zone', x, y, r: ts * 0.82, delay: 0.22 + i * 0.13,
          dmg: boss.dmg * 0.88, type: boss.atkType, color: '#ff6038' });
      }
    }
  }

  function fireChallengeSpecialWave(boss, wave, cx, cy, ts, color) {
    const zone = (x, y, r, delay = 0.38, dmg = 0.8, tint = color) =>
      G.Hazards.add({ kind: 'zone', x, y, r, delay, dmg: boss.dmg * dmg, type: boss.atkType, color: tint });
    const beam = (x, y, angle, width = 22, delay = 0.42, dmg = 0.9, tint = color) =>
      G.Hazards.add({ kind: 'beam', x, y, angle, len: ts * 10, w: width, delay, dmg: boss.dmg * dmg, type: boss.atkType, color: tint });
    const aim = Math.atan2(cy - boss.y, cx - boss.x);
    const ring = (count, radius, size, phase = 0) => {
      for (let i = 0; i < count; i++) {
        const a = phase + i * Math.PI * 2 / count;
        zone(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, size, 0.3 + i * 0.06);
      }
    };

    switch (boss.dex) {
      case 718: // Zygarde: fast darts, then sweeping 100% form beams.
        if (boss.challengePhase2) {
          beam(arena.x - ts * 5, arena.y + G.U.rand(-ts * 2, ts * 2), wave % 2 ? 0.12 : -0.12, ts * 0.65, 0.32, 1.05, '#8eff62');
          beam(arena.x + ts * 5, arena.y + G.U.rand(-ts * 2, ts * 2), Math.PI + (wave % 2 ? 0.12 : -0.12), ts * 0.65, 0.45, 1.05, '#8eff62');
        } else ring(3, ts * 1.2, ts * 0.55, aim);
        break;
      case 555: // Darmanitan: Zen snipes the player's last position.
        zone(cx, cy, ts * 1.15, 0.56, 1.15, '#ff9955');
        ring(3, ts * 1.9, ts * 0.48, aim + wave * 0.4);
        break;
      case 746: // Wishiwashi: giant school-form water burst.
        zone(cx, cy, ts * 1.75, 0.62, 1.35, '#5bdcff');
        ring(5, ts * 2.5, ts * 0.55, wave * 0.28);
        break;
      case 800: // Necrozma: long, piercing parallel light lanes.
        for (let i = -1; i <= 1; i++) beam(arena.x - ts * 5, cy + i * ts * 1.05, 0, ts * 0.5, 0.38 + Math.abs(i) * 0.12, 0.95, '#fff17a');
        break;
      case 681: // Aegislash: crossing sword slashes.
        beam(cx - ts * 4, cy - ts * 4, Math.PI / 4 + wave * 0.12, ts * 0.7, 0.36, 1.05, '#d9ddff');
        beam(cx - ts * 4, cy + ts * 4, -Math.PI / 4 - wave * 0.12, ts * 0.7, 0.5, 1.05, '#d9ddff');
        break;
      case 386: // Deoxys: attack-form fan of narrow beams.
        for (let i = -2; i <= 2; i++) beam(boss.x, boss.y, aim + i * 0.19, ts * 0.42, 0.32 + Math.abs(i) * 0.05, 0.75, '#ff6b87');
        break;
      case 479: { // Rotom: appliance attacks rotate through four elements.
        const colors = ['#ff8a3d', '#63dafa', '#9cdfff', '#a7e66d'];
        const rotColor = colors[wave % colors.length];
        if (wave % 4 === 1) ring(5, ts * 1.8, ts * 0.62, wave * 0.22);
        else for (let i = -1; i <= 1; i++) beam(boss.x, boss.y, aim + i * 0.23, ts * 0.55, 0.42, 0.72, rotColor);
        break;
      }
      case 648: // Meloetta: Aria notes scatter; Pirouette sweeps the arena.
        if (wave % 2) ring(6, ts * 2, ts * 0.48, wave * 0.35);
        else for (let i = -1; i <= 1; i++) beam(boss.x, boss.y, aim + i * 0.24, ts * 0.5, 0.35, 0.78, '#eaa5ff');
        break;
      case 720: // Hoopa: portal ring followed by falling strikes.
        if (wave % 2) ring(6, ts * 2.7, ts * 0.58, wave * 0.2);
        else for (let i = 0; i < 3; i++) zone(cx + G.U.rand(-ts * 2.5, ts * 2.5), cy + G.U.rand(-ts * 2.5, ts * 2.5), ts * 0.72, 0.48 + i * 0.1, 1.05, '#bd83ff');
        break;
      case 1024: // Terapagos: three elemental crystal bursts.
        ['#ff925c', '#5bdcff', '#83e878'].forEach((tint, i) => zone(cx + Math.cos(wave + i * 2.1) * ts * 1.35, cy + Math.sin(wave + i * 2.1) * ts * 1.35, ts * 0.72, 0.34 + i * 0.1, 0.82, tint));
        break;
      case 382: // Kyogre: broad surging water rings.
        ring(5, ts * 1.8, ts * 0.75, wave * 0.26);
        break;
      case 383: // Groudon: staggered lava eruptions.
        for (let i = 0; i < 5; i++) zone(cx + (i - 2) * ts * 0.9, cy + Math.sin(i + wave) * ts * 1.5, ts * 0.68, 0.25 + i * 0.12, 0.95, '#ff653d');
        break;
      case 384: // Rayquaza: crossing screen-wide dragon beams.
        beam(cx - Math.cos(aim) * ts * 5, cy - Math.sin(aim) * ts * 5, aim + 0.42, ts * 0.65, 0.3, 0.95, '#6af2c7');
        beam(cx - Math.cos(aim) * ts * 5, cy - Math.sin(aim) * ts * 5, aim - 0.42, ts * 0.65, 0.44, 0.95, '#6af2c7');
        break;
      case 483: // Dialga: temporal parallel lanes.
        for (let i = -1; i <= 1; i++) beam(arena.x - ts * 5, cy + i * ts, 0, ts * 0.62, 0.35 + Math.abs(i) * 0.08, 0.8, '#7abaff');
        break;
      case 484: // Palkia: spatial rifts converge on the target.
        ring(4, ts * 2.2, ts * 0.78, aim + wave * 0.18);
        break;
      case 487: // Giratina: alternating portal strikes at changing points.
        zone(cx, cy, ts * 1.2, 0.42, 1.05, '#9e76e8');
        zone(arena.x + G.U.rand(-ts * 3, ts * 3), arena.y + G.U.rand(-ts * 3, ts * 3), ts * 0.82, 0.58, 1.05, '#9e76e8');
        break;
      case 643: // Reshiram: expanding fire bursts.
        ring(4, ts * 1.3, ts * 0.8, wave * 0.3);
        break;
      case 644: // Zekrom: directed thunder lanes.
        for (let i = -1; i <= 1; i++) beam(boss.x, boss.y, aim + i * 0.2, ts * 0.55, 0.32 + Math.abs(i) * 0.08, 0.9, '#ffe45a');
        break;
      case 646: // Kyurem: a broad ice field broken by safe gaps.
        for (let i = 0; i < 6; i++) if (i !== (wave % 6)) zone(arena.x + (i - 2.5) * ts * 1.25, arena.y + ((wave % 2) ? ts : -ts), ts * 0.72, 0.3 + i * 0.07, 0.82, '#8fe9ff');
        break;
      case 638: case 639: case 640: case 647: // Sacred Sword Dance: crisscrossing dash lanes.
        for (let i = 0; i < 4; i++) beam(arena.x + (i < 2 ? -1 : 1) * ts * 5, arena.y + (i % 2 ? -1 : 1) * ts * 4, Math.atan2(-((i % 2) ? -1 : 1) * ts * 4, -((i < 2) ? -1 : 1) * ts * 5) + wave * 0.04, ts * 0.48, 0.3 + i * 0.08, 0.78, '#fff1a6');
        break;
      case 380: case 381: // Eon pair: orbital psychic blasts.
        ring(7, ts * 2.1, ts * 0.5, wave * 0.32);
        break;
      case 488: case 491: // Moon pair: sleep mark then a sweeping crescent.
        if (boss.dex === 491) zone(cx, cy, ts * 1.2, 0.54, 0.95, '#8269c9');
        else {
          const angle = aim + Math.sin(wave * 1.3) * 0.24;
          for (let i = -1; i <= 1; i++) beam(arena.x - ts * 5, cy + i * ts * 0.68, angle + i * 0.16, ts * 0.62, 0.32 + Math.abs(i) * 0.09, 0.88, '#f2d8ff');
          for (let i = 0; i < 3; i++) zone(cx + G.U.rand(-ts * 2.1, ts * 2.1), cy + G.U.rand(-ts * 1.7, ts * 1.7), ts * 0.5, 0.48 + i * 0.08, 0.7, '#cfa8ff');
          G.Game.flash('#fff3cd', 0.22);
        }
        break;
      case 249: case 250: // Tower duo: long wind/fire lanes.
        for (let i = -1; i <= 1; i++) beam(arena.x - ts * 5, cy + i * ts * 1.2, 0, ts * 0.65, 0.32 + i * 0.06, 0.84, boss.dex === 250 ? '#ff8a48' : '#b3e9ff');
        break;
      case 888: case 889: // Heroes: aimed sword strike with a marked escape area.
        beam(boss.x, boss.y, aim, ts * 0.9, 0.4, 1.05, boss.dex === 888 ? '#f5d65a' : '#b9dcff');
        zone(cx + Math.cos(aim + Math.PI / 2) * ts * 1.3, cy + Math.sin(aim + Math.PI / 2) * ts * 1.3, ts * 0.72, 0.55, 0.8, '#f5d65a');
        break;
      default:
        if (boss.atkType === 'electric' || boss.atkType === 'dragon') {
          for (let i = -2; i <= 2; i++) beam(boss.x, boss.y, aim + i * 0.17, ts * 0.45, 0.32 + Math.abs(i) * 0.05, 0.75);
        } else if (boss.atkType === 'fire' || boss.atkType === 'ground') {
          for (let i = 0; i < 5; i++) zone(cx + (i - 2) * ts, cy + G.U.rand(-ts, ts), ts * 0.65, 0.3 + i * 0.08, 0.82);
        } else ring(4, ts * 1.8, ts * 0.65, wave * 0.2);
    }
  }

  function specialName(dex) {
    if (G.StoryEncounters?.active) return G.StoryEncounters.skill(dex)[0];
    if (dex === 382) return arena.challenge ? 'Tidal Ring' : '4-Way Tidal Wave';
    if (dex === 383) return 'Magma Eruption Chain';
    if (dex === 384) return 'Diagonal Cutting Beams';
    return 'Special Attack Wave';
  }

  function cineTick(dt) {
    if (!arena || !arena.cine) return;
    const cine = arena.cine;
    cine.t += dt;
    if (cine.t < cine.dur) return;
    if (!authority()) { cine.t = cine.dur; return; }
    arena.cine = null;
    startStoryEvade(G.EnemyMgr.get(cine.bossId));
  }

  function cycleStoryTarget(dir = 1) {
    if (!arena || !arena.story) return;
    const bosses = G.EnemyMgr.all().filter(e => e.storyBoss && !e.dead);
    if (bosses.length < 2) return;
    let index = bosses.findIndex(e => e.id === arena.targetId);
    index = (index + dir + bosses.length) % bosses.length;
    if (G.Coop.active) G.Coop.targetBoss(bosses[index].id);
    else setStoryTarget(bosses[index].id);
  }

  function setStoryTarget(id) {
    if (!arena || !arena.story) return;
    const boss = G.EnemyMgr.get(id);
    if (!boss || boss.dead || !boss.storyBoss) return;
    arena.targetId = boss.id;
    if (G.Coop.isHost) G.Coop.broadcast(['st', boss.id]);
  }

  function won() {
    if (!arena || arena.phase !== 'fight') return;
    arena.phase = 'won'; arena.endT = 5;
    if (!arena.challenge) G.Progress.event('rift', { type: arena.type });
    G.Pickups.pullAll();
    G.Spawner.say('¡Has vencido a ' + G.DEX_BY[arena.dex].name + '! Recoge el premio…', 3.4, true);
    G.Audio.sfx('legend');
    const pl = G.Game.player;
    if (arena.story && !arena.challenge) {
      G.Pickups.dropXp(pl.x, pl.y, 1800, true, true, true);
      G.Pickups.pullAll();
    }
    if (pl && !arena.story) {
      pl.bonds++;
      G.FX.dmgText(pl.x, pl.y - pl.bodyH - 10, T('¡Vínculo!'), '#ff8ad8', true);
      G.FX.ring(pl.x, pl.y, 8, 90, '#ff8ad8', 0.7, 5);
    }
  }

  function lost() {
    if (!arena || arena.phase !== 'fight') return;
    arena.phase = 'lost'; arena.endT = 1.2;
    G.Spawner.say(T('La grieta os ha expulsado…'), 2.6, true);
    G.Audio.sfx('back');
  }

  /** Local machine: return to map. */
  function finish() {
    const pl = G.Game.player;
    const a = arena;
    arena = null;
    G.StoryEncounters?.reset();
    if (a.challenge) { G.Game.exitBossChallenge(); return; }
    G.World.setBiome(a.biome, true);
    G.Weather.clear();
    // Client: host notifies arena despawns and map enemy restoration.
    if (authority()) G.EnemyMgr.restore();
    G.Projectiles.clear();
    G.Combat.clearFields();
    G.Hazards.clear();
    for (const p of G.Game.everyone()) { p.x = a.back.x; p.y = a.back.y; }
    pl.x = a.back.x; pl.y = a.back.y;
    if (a.story && a.autoSwapBefore != null) pl.autoSwap = a.autoSwapBefore;
    if (pl.dead) pl.revive(0.3);
    G.Camera.x = pl.x; G.Camera.y = pl.y;
    G.Game.flash('#c9a6ff', 0.8);
    if (pl.bonds > 0) G.Game.offerBond();
  }

  function drawOverlay(ctx, w, h) {
    if (!arena || !arena.story) return;
    if (arena.cine) {
      const cine = arena.cine;
      const k = Math.min(1, cine.t / 0.14, (cine.dur - cine.t) / 0.18);
      const mon = G.DEX_BY[cine.dex];
      const title = mon ? T(mon.name).toUpperCase() : '¡EL JEFE!';
      const boss = G.EnemyMgr.get(cine.bossId);
      const color = G.U.TYPE_COLOR[boss && boss.atkType] || '#fff0ad';
      const pulse = 0.5 + 0.5 * Math.sin(cine.t * 13);
      ctx.save();
      ctx.fillStyle = `rgba(5, 7, 20, ${0.78 * Math.max(0, k)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = Math.max(0, k);
      ctx.strokeStyle = color; ctx.lineWidth = 3 + pulse * 2;
      for (let i = 0; i < 6; i++) {
        const radius = 28 + i * 24 + cine.t * 34;
        ctx.beginPath(); ctx.arc(w / 2, h / 2 - 12, radius, cine.t * 2 + i, cine.t * 2 + i + 4.6); ctx.stroke();
      }
      ctx.strokeStyle = `rgba(255,70,80,${0.18 + pulse * 0.3})`;
      ctx.lineWidth = 5 + pulse * 4;
      for (let i = 0; i < 4; i++) {
        const y = ((cine.t * (210 + i * 36) + i * h / 4) % (h + 80)) - 40;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y - 28); ctx.stroke();
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (boss) {
        const preview = new G.Sprites.Animator(cine.dex, 1.35, !!cine.shiny, cine.form || '');
        preview.dir = 0;
        preview.draw(ctx, w / 2, h / 2 - 12, { alpha: Math.max(0, k) });
      }
      ctx.font = '700 ' + Math.max(18, Math.min(36, w * 0.05)) + 'px Pixelify, monospace';
      ctx.shadowColor = color; ctx.shadowBlur = 20 + pulse * 18; ctx.fillStyle = '#fff2c7';
      ctx.fillText(title, w / 2, h / 2 + 64);
      ctx.shadowBlur = 0; ctx.font = '700 14px Pixelify, monospace'; ctx.fillStyle = '#ff8278';
      ctx.fillText('¡ATAQUE ESPECIAL INMINENTE!', w / 2, h / 2 + 92);
      ctx.restore();
      return;
    }
    if (arena.moonDarkUntil > arena.t) {
      ctx.save(); ctx.fillStyle = 'rgba(4, 2, 18, 0.94)'; ctx.fillRect(0, 0, w, h); ctx.restore();
    }
    if (arena.moonSweep && arena.moonSweep.until > arena.t) {
      const age = arena.moonSweep.until - arena.t, alpha = Math.min(0.9, age * 1.2);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = alpha;
      ctx.shadowColor = '#e4aaff'; ctx.shadowBlur = 22; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        const y = h * (0.5 + i * 0.16) + Math.sin((1.4 - age) * 8 + arena.moonSweep.wave) * h * 0.08;
        ctx.strokeStyle = i === 0 ? '#fff0c9' : '#d89bff'; ctx.lineWidth = i === 0 ? 9 : 5;
        ctx.beginPath(); ctx.moveTo(-w * 0.05, y - h * 0.42); ctx.lineTo(w * 1.05, y + h * 0.42); ctx.stroke();
      }
      ctx.restore();
    }
    if (arena.phase === 'fight' && arena.evading > 0) {
      const boss = G.EnemyMgr.get(arena.activeEvadeBossId);
      const title = boss ? `${T(boss.name).toUpperCase()} · ${specialName(boss.dex).toUpperCase()}` : 'SPECIAL ATTACK';
      const progress = Math.max(0, Math.min(1, arena.evading / 4));
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.translate(0, 96);
      ctx.fillStyle = 'rgba(8,12,25,.72)'; ctx.fillRect(w * 0.12, 10, w * 0.76, 62);
      ctx.font = '700 20px Pixelify, monospace'; ctx.fillStyle = '#ff6868';
      ctx.shadowColor = '#300'; ctx.shadowBlur = 12; ctx.fillText(title, w / 2, 16, w * 0.74);
      ctx.font = '700 14px Pixelify, monospace'; ctx.fillStyle = '#fff1bc';
      const instruction = G.StoryEncounters?.active && boss ? G.StoryEncounters.skill(boss.dex)[1] : 'MOVE TO EVADE · 3 WAVES IN 4 SECONDS';
      ctx.fillText(instruction, w / 2, 42, w * 0.74);
      ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.24)';
      ctx.fillRect(w * 0.25, 64, w * 0.5, 5);
      ctx.fillStyle = '#ff6868'; ctx.fillRect(w * 0.25, 64, w * 0.5 * progress, 5);
      ctx.restore();
      return;
    }
    if (arena.phase !== 'intro') return;
    const t = arena.introT, fade = Math.min(1, t * 2, (4 - t) * 2);
    const title = arena.challenge ? arena.challengeTitle.toUpperCase() : 'WEATHER TRIO';
    ctx.save();
    ctx.fillStyle = `rgba(4, 8, 22, ${0.74 * Math.max(0, fade)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    const cx = w / 2, cy = h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.16);
    ctx.strokeStyle = '#f5d778'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 35 + i * 22, i * 2.1, i * 2.1 + 4.8); ctx.stroke(); }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 ' + Math.max(20, Math.min(40, w * 0.055)) + 'px Pixelify, monospace';
    ctx.shadowColor = '#efb84d'; ctx.shadowBlur = 18; ctx.fillStyle = '#fff1bc';
    ctx.fillText(title, cx, cy - 76, w * 0.9);
    if (arena.challenge && arena.previewMons?.length) {
      const count = arena.previewMons.length, gap = Math.min(88, w * 0.82 / count);
      arena.previewMons.forEach((entry, i) => {
        const x = cx + (i - (count - 1) / 2) * gap, y = cy + 20;
        entry.animator.draw(ctx, x, y, { alpha: Math.max(0, fade) });
        ctx.shadowBlur = 0; ctx.font = '700 11px Pixelify, monospace'; ctx.fillStyle = '#e8edff';
        ctx.fillText(G.DEX_BY[entry.dex]?.name || `#${entry.dex}`, x, y + 22);
      });
    }
    ctx.shadowBlur = 0; ctx.font = '700 ' + Math.max(13, Math.min(20, w * 0.026)) + 'px Pixelify, monospace';
    ctx.fillStyle = '#c8dcff'; ctx.fillText(arena.challenge ? 'POKÉMON INCOMING' : 'WEATHER TRIO', cx, cy + 82);
    ctx.restore();
  }

  // ---------------- dibujo ----------------

  /** Rift drawable for Y-sorting with scene elements. */
  function drawable() {
    if (!rift) return null;
    return {
      y: rift.y,
      draw(ctx) {
        const P = G.Sprites.PX;
        const img = G.Tiles.propSprite(0, 'rift', Math.floor(rift.t * 8) % 4);
        const w = img.width * P, h = img.height * P;
        const fadeIn = Math.min(1, rift.t * 2), fadeOut = Math.min(1, rift.ttl / 1.5);
        ctx.save();
        ctx.globalAlpha = 0.25 * fadeIn * fadeOut;
        ctx.fillStyle = '#7b3cff';
        ctx.beginPath(); ctx.ellipse(rift.x, rift.y, 34, 12, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = fadeIn * fadeOut;
        ctx.drawImage(img, Math.round(rift.x - w / 2), Math.round(rift.y - h + 4), w, h);
        ctx.restore();
        if (Math.random() < 0.3) G.FX.px(rift.x + G.U.rand(-14, 14), rift.y - G.U.rand(10, 80), '#d9c2ff', { vy: -40, life: 0.6 });
      }
    };
  }

  // ---------------- red ----------------

  function onEvent(ev) {
    switch (ev[0]) {
      case 'rift': show(ev[1], ev[2], ev[3], !!ev[4]); break;
      case 'riftx': rift = null; break;
      case 'arena': begin(ev[1]); break;
      case 'aw': won(); break;
      case 'al': lost(); break;
      case 'se': if (arena && arena.story) { arena.cine = null; arena.evading = Math.max(0, Number(ev[1]) || 0); } break;
      case 'sc': if (arena && arena.story) { const boss = G.EnemyMgr.get(ev[1]); G.Hazards.clear(); G.Projectiles.clearHostile(); arena.cine = { t: 0, dur: 1, bossId: ev[1], dex: boss?.dex || 0, form: boss?.spriteForm || '', shiny: !!boss?.shiny }; } break;
      case 'st': setStoryTarget(ev[1]); break;
    }
  }

  return {
    reset, update, drawable, onEvent, leftBehind, moonSpecialEffect, enterRequest() { if (!arena) rift && rift.story ? startStory() : start(); },
    get rift() { return rift; }, get arena() { return arena; },
    get inArena() { return !!arena; },
    get challengeTitle() { return arena && arena.challenge ? arena.challengeTitle : ''; },
    get specialLock() { return !!(arena && arena.story && (arena.cine || arena.evading > 0)); },
    get specialBossId() { return arena ? (arena.cine ? arena.cine.bossId : arena.activeEvadeBossId || 0) : 0; },
    get pauseRunClock() { return !!(arena && arena.story); },
    get duelStance() { return !!(arena && arena.story && arena.phase === 'fight'); },
    get lockAutoSwap() { return !!(arena && arena.story); },
    get targetBossId() {
      if (arena && arena.targetId && G.EnemyMgr.get(arena.targetId) && !G.EnemyMgr.get(arena.targetId).dead) return arena.targetId;
      if (arena && arena.bossId) return arena.bossId;
      const boss = G.EnemyMgr.all().find(e => e.storyBoss && !e.dead);
      return boss ? boss.id : 0;
    },
    cycleStoryTarget, setStoryTarget,
    get evading() { return !!(arena && arena.story && arena.evading > 0); },
    get cinematic() { return !!(arena && arena.story && arena.cine); },
    cineTick,
    drawOverlay,
    challengeStages, startChallenge,
    get timeLeft() { return arena ? (arena.challenge ? Infinity : Math.max(0, (arena.story ? STORY_TIME : ARENA_TIME) - arena.t)) : 0; },
    debugOpen() { open(); },
    debugStory() { if (!arena) startStory(); },
    /** Debug: test arena by type. */
    debugArena(type) { start(type); },
    /** Debug: set next rift arena type. */
    debugNextType(type) { nextType = type; }
  };
})();

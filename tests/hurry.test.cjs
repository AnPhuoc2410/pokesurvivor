const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const load = (G, f) => new Function('G', source(f))(G);
const oldXp = (lv, hurry) => Math.floor((8 + lv * 6 + lv ** 1.75 * 1.6) * (hurry ? 2 : 4));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

function setup(hurry = true) {
  const G = {};
  new Function('window', 'G', source('js/core/util.js'))({ G }, G);
  G.Game = { st: { hurryMode: hurry, time: 300, matchTime: hurry ? 600 : 300 }, timeScale: hurry ? 2 : 1 };
  G.T = s => s;
  G.Sprites = { hasShiny: () => false, playerScale: () => 1, playerRadius: () => 8, bodyHeight: () => 24,
    bodyRadius: () => 8, hovers: () => false, preload() {}, Animator: class {} };
  G.Stats = { fit: () => 1, sideOf: () => 'physical', NAME: { physical: 'Físico', special: 'Especial' } };
  G.FX = { ring() {}, burst() {}, dmgText() {} }; G.Audio = { sfx() {} }; G.Progress = { event() {} };
  load(G, 'js/data/moves.js'); load(G, 'js/entities/player.js'); load(G, 'js/systems/levelup.js');
  load(G, 'js/data/enemies.js');
  const mon = { dex: 4, name: 'Charmander', hp: 100, atk: 30, spd: 100, types: ['fire'] };
  const pl = new G.Player(mon); pl.addMove('ember'); G.Game.player = pl;
  // Inspect every candidate; randomness and the three-card selection have their own UI checks.
  G.U.pickN = a => a;
  const cards = () => G.LevelUp.offer(pl, 100);
  const card = key => cards().find(c => c.key === key);
  return { G, pl, cards, card };
}

test('Hurry XP: the old level-200 budget becomes 42 choices; the opening and Standard stay intact', () => {
  const { G, pl } = setup();
  for (let lv = 1; lv <= 200; lv++) assert.equal(G.Player.xpFor(lv, false), oldXp(lv, false));
  for (let lv = 1; lv <= 3; lv++) assert.equal(G.Player.xpFor(lv, true), oldXp(lv, true));
  assert.equal(pl.xpNext, oldXp(1, true), 'the constructor uses the selected mode');
  const budget = Array.from({ length: 199 }, (_, i) => oldXp(i + 1, true)).reduce((a, b) => a + b, 0);
  let choices = 0;
  for (let i = 0; i < 100; i++) choices += pl.gainXp(budget / 100 / 2.3);
  assert.equal(pl.level, 43); assert.equal(choices, 42);
  assert.equal(G.Player.powerLevel(pl.level), 199);
  assert.equal(G.Player.powerLevel(43, false), 43);
  assert.equal(pl.gainXp(Infinity), 0); assert.equal(pl.gainXp(-5), 0);
  assert.ok(pl.xp < pl.xpNext);
  G.Game.st.hurryMode = false;
  assert.equal(G.Player.xpFor(20), oldXp(20, false));
});

test('Hurry move bundles equal sequential upgrades for every move and never pass the cap', () => {
  const { G } = setup();
  for (const def of G.Moves.ALL) {
    const bundled = G.Moves.instance(def.id), normal = G.Moves.instance(def.id);
    assert.equal(G.Moves.nextUpText(bundled, 2), def.ups.slice(0, 2).map(u => u.t).join('<br>'));
    while (normal.lvl < normal.def.maxLvl) G.Moves.levelUp(normal);
    G.Moves.levelUp(bundled, 2); G.Moves.levelUp(bundled, 2); G.Moves.levelUp(bundled, 2);
    assert.deepEqual(bundled, normal, def.id);
    assert.equal(G.Moves.levelUp(bundled, 2), false);
    assert.equal(G.Moves.nextUpText(bundled, 2), null);
  }
});

test('Hurry cards show both upgrade steps; maxing a move does not automatically evolve it', () => {
  const { G, pl, card } = setup();
  const up = card('up:ember');
  assert.equal(up.tag, 'Nv.1 > 3'); assert.ok(up.desc.includes('<br>'));
  up.apply(pl); assert.equal(pl.moves[0].lvl, 3);
  card('up:ember').apply(pl); assert.equal(pl.moves[0].lvl, 5);
  assert.equal(card('up:ember'), undefined); assert.equal(card('evo:ember'), undefined);
  card('stat:atk').apply(pl);
  assert.equal(pl.statsTaken.atk, 5);
  const evo = card('evo:ember'); assert.ok(evo); assert.ok(!pl.moves[0].evolved);
  evo.apply(pl); assert.equal(pl.moves[0].evolved, true);
  assert.equal(card('evo:ember'), undefined);
  assert.equal(G.LevelUp.offer(pl).length, 3);
});

test('Hurry stat bundles preserve compounding and caps; healing remains one 45% heal', () => {
  const { G, pl, card } = setup();
  for (const s of G.LevelUp.STATS.filter(s => s.id !== 'heal')) {
    const normal = new G.Player(pl.mon);
    const n = Math.min(5, s.max || 5);
    for (let i = 0; i < n; i++) s.apply(normal);
    const before = new G.Player(pl.mon);
    const one = setup();
    one.card('stat:' + s.id).apply(one.pl);
    for (const k of ['atkMul', 'spdMul', 'cdMul', 'dmgReduce', 'regenFlat', 'magnet', 'xpMul', 'maxHp', 'hp']) {
      near(one.pl[k] - before[k], normal[k] - before[k]);
    }
    assert.equal(one.pl.statsTaken[s.id], n);
    if (s.max) {
      while (one.card('stat:' + s.id)) one.card('stat:' + s.id).apply(one.pl);
      assert.equal(one.pl.statsTaken[s.id], s.max);
    }
  }
  assert.ok(card('stat:atk').desc.includes('61.1'));
  assert.ok(card('stat:cd').desc.includes('34.1'));
  assert.ok(card('stat:hp').desc.includes('100'));
  pl.hp = 0; card('stat:heal').apply(pl); assert.equal(pl.hp, 45);
  assert.equal(pl.statsTaken.heal, 1);
  pl.statsTaken.spd = 7; pl.spdMul = 1.07 ** 7;
  const last = card('stat:spd'); last.apply(pl);
  near(pl.spdMul, 1.07 ** 8); assert.equal(pl.statsTaken.spd, 8);
  last.apply(pl); near(pl.spdMul, 1.07 ** 8);
  pl.statsTaken.def = 10; pl.dmgReduce = 0.6;
  assert.ok(card('stat:def').desc.includes('10%'));
  card('stat:def').apply(pl); near(pl.dmgReduce, 0.7);
  assert.equal(pl.statsTaken.def, 12);
});

test('Standard offers still apply one step, original text, and original stat limits', () => {
  const { G, pl, card } = setup(false);
  assert.equal(card('up:ember').tag, 'Nv.1 > 2');
  assert.equal(card('up:ember').desc, G.Moves.BY_ID.ember.ups[0].t);
  card('up:ember').apply(pl); assert.equal(pl.moves[0].lvl, 2);
  const atk = card('stat:atk'); assert.equal(atk.desc, '+10% de daño con todos los movimientos.');
  atk.apply(pl); near(pl.atkMul, 1.1); assert.equal(pl.statsTaken.atk, 1);
});

test('enemy curves are time based, monotonic, and leave Standard and movement speed unchanged', () => {
  const { G, pl } = setup();
  for (const t of [0, 70, 180, 380, 600, 900, 1200, 1800, 2100]) {
    const normal = G.Enemies.scale(t, false), hurry = G.Enemies.scale(t, true);
    near(normal.hp, 1 + t / 95); near(normal.dmg, 1 + t / 420);
    near(normal.spd, 1 + Math.min(0.35, t / 1400));
    assert.ok(hurry.hp >= normal.hp); assert.ok(hurry.dmg >= normal.dmg);
    assert.equal(hurry.spd, normal.spd);
    assert.ok(G.Enemies.scale(t + 1, true).hp > hurry.hp);
    const boss = G.Enemies.bossScale(t, false);
    assert.deepEqual(boss, { hp: 1 + t / 600, dmg: 1 + t / 600, spd: 1 });
  }
  near(G.Enemies.scale(1800, true).hp / G.Enemies.scale(1800, false).hp, 1.6);
  near(G.Enemies.bossScale(1800, true).hp / G.Enemies.bossScale(1800, false).hp, 1.4);
  const before = G.Enemies.scale(600);
  pl.level = 999; pl.atkMul = 1000;
  assert.deepEqual(G.Enemies.scale(600), before);
});

function spawning(hurry) {
  const { G, pl } = setup(hurry), spawned = [], times = [];
  const def = { dex: 4, name: 'Charmander', hp: 100, dmg: 10, xp: 10, spd: 50 };
  G.Coop = { active: false, isHost: false, scaleHp: () => 1, scaleRate: () => 1 };
  G.Camera = { zoom: 1, outerRadius: () => 500, kick() {} };
  G.World = { isFree: () => true }; G.Rift = { inArena: false, leftBehind: () => false };
  G.Judgment = { active: false }; G.Events = { golden: false };
  G.Enemies.bagAt = t => { times.push(t); return [def]; };
  G.Enemies.rollRun = () => {}; G.Enemies.upcomingDex = () => [];
  Object.defineProperty(G.Enemies, 'BOSSES', { value: [] });
  G.EnemyMgr = { count: 0, all: () => [], bossAlive: () => false, add: e => spawned.push(e) };
  G.Enemy = class { constructor(d, x, y, sc) {
    Object.assign(this, { hp: Math.round(d.hp * sc.hp), maxHp: Math.round(d.hp * sc.hp), dmg: d.dmg * sc.dmg, xp: d.xp });
  } };
  load(G, 'js/systems/spawner.js');
  return { G, pl, spawned, times };
}

test('burst uses matchTime, Hurry adds no XP, and existing enemies are not rescaled', () => {
  const hurry = spawning(true), normal = spawning(false);
  for (const r of [hurry, normal]) { r.G.Game.st.matchTime = 600; r.G.Spawner.burst(1); }
  assert.deepEqual(hurry.times, [600]); assert.deepEqual(normal.times, [600]);
  assert.ok(hurry.spawned[0].hp > normal.spawned[0].hp);
  assert.ok(hurry.spawned[0].dmg > normal.spawned[0].dmg);
  assert.equal(hurry.spawned[0].xp, normal.spawned[0].xp);
  const hp = hurry.spawned[0].hp;
  hurry.G.Game.st.matchTime = 1200; hurry.G.Spawner.burst(1);
  assert.equal(hurry.spawned[0].hp, hp); assert.ok(hurry.spawned[1].hp > hp);
});

test('surges and event opportunities use compressed scheduling without speeding combat effects', () => {
  for (const hurry of [false, true]) {
    const r = spawning(hurry), { G, pl } = r;
    G.Spawner.reset(); G.Spawner.update(hurry ? 16 : 32, pl, 0);
    assert.ok(G.Spawner.banner().text.includes('Marea'));
    let bursts = 0;
    G.Spawner.burst = () => bursts++;
    G.U.rand = a => a; G.U.pick = a => a[0];
    G.Enemies.hordeTypes = () => ['fire']; G.Enemies.hordeDefs = () => [{}];
    G.DEX_BY = {}; G.SPRITE_META = {};
    load(G, 'js/systems/events.js');
    G.Events.reset(); G.Events.update(hurry ? 119 : 239, [pl], 500);
    assert.equal(bursts, 0);
    G.Events.update(1, [pl], 500); assert.equal(bursts, 1);
    G.Events.update(20, [pl], 500); assert.ok(G.Events.bag(), 'horde still lasts 30 combat seconds');
  }
});

test('Rift bosses use matchTime and the boss curve, with the original XP budget', () => {
  for (const hurry of [false, true]) {
    const { G, pl, spawned } = spawning(hurry);
    G.Game.st.matchTime = 600;
    const mon = { dex: 146, name: 'Moltres', spd: 100, types: ['fire'], leg: true };
    G.DEX = [mon]; G.DEX_BY = { 146: mon }; G.SPRITE_META = { 146: {} };
    G.DB = { save: { legends: {} } };
    G.Tiles = { T: 16, arenaBiome: () => 0, ARENA_THEMES: { fire: {} } }; G.Sprites.PX = 1;
    G.World.setArena = () => {}; G.World.setBiome = () => {};
    G.EnemyMgr.stash = () => {};
    G.Projectiles = { clear() {} }; G.Combat = { clearFields() {} }; G.Hazards = { clear() {} };
    G.Game.everyone = () => [pl]; G.Game.flash = () => {};
    load(G, 'js/systems/rift.js'); G.Rift.debugArena('fire');
    const k = G.Enemies.hurryScale(600, true);
    assert.equal(spawned[0].hp, Math.round((3200 + 600 * 9) * k.hp));
    near(spawned[0].dmg, (36 + 600 / 20) * k.dmg);
    assert.equal(spawned[0].xp, 500 + 600 * 1.2);
  }
});

test('weather checks compress in Hurry but weather duration remains combat time', () => {
  for (const hurry of [false, true]) {
    const { G, pl } = spawning(hurry);
    // Put a guaranteed successful weather check in its own Math scope.
    const math = Object.create(Math); math.random = () => 0;
    G.World.biome = 0;
    new Function('G', 'Math', source('js/systems/weather.js'))(G, math);
    G.Weather.update(hurry ? 29 : 59, 300, pl); assert.equal(G.Weather.current, null);
    G.Weather.update(1, 300, pl);
    G.Weather.update(20, 300, pl);
    const weather = G.Weather.current;
    assert.ok(weather); assert.equal(weather.t, 20);
    assert.ok(weather.left >= 35);
  }
});

test('starting Hurry initializes the right XP curve and a chest grants one level with XP bonuses', () => {
  const { G, pl } = setup(false), mon = pl.mon;
  const reset = { reset() {}, clear() {} };
  G.Halloween = { runStart() {} }; G.DB = { save: { partner: 4 }, upgradesOf: () => ({}) };
  G.Mons = { monFor: () => mon, abilityOf: () => ({ id: 'none' }) };
  G.Upgrades = { perks: () => ({ xpMul: 1.3 }) }; G.AbilityFX = { of: () => ({}) };
  G.UI = { hideAll() {}, chrome() {} }; G.Skins = { worn: () => null };
  G.FX.clear = () => {}; G.Audio.music = () => {}; G.BIOME_MUSIC = ['forest'];
  G.Combat = { clearFields() {} };
  for (const k of ['Projectiles', 'EnemyMgr', 'Pickups', 'Spawner', 'Rift', 'Events', 'Weather', 'Path', 'Hazards', 'Orbs']) G[k] = reset;
  G.Judgment = { ...reset, active: false };
  G.World = { reset() {}, setBiome() {} }; G.Tiles = { runBiome: () => 0 };
  G.Camera = {}; G.Ranking = { newSeal() {}, runStarted() {} };
  G.startMoveOf = () => 'ember';
  G.Coop = { active: true, isHost: true, begin() {}, xpFactor: () => 0.8 };
  G.Social = { setPlaying() {} };
  new Function('G', 'addEventListener', source('js/game.js'))(G, () => {});
  G.Game.startRun({ hurry: true, members: [] });
  const player = G.Game.player;
  assert.equal(G.Game.st.hurryMode, true);
  assert.equal(player.xpNext, G.Player.xpFor(1, true));
  player.gainXp((G.Player.xpFor(1, true) + G.Player.xpFor(2, true) + G.Player.xpFor(3, true) + 1) / (2.3 * player.xpMul));
  assert.equal(player.level, 4);
  player.xp = player.xpNext / 3;
  const drop = G.Game.levelXp();
  assert.equal(player.gainXp(drop * G.Coop.xpFactor()), 1);
});

test('game clock reaches Arceus at 15 minutes in Hurry and 30 in Standard', () => {
  const { G } = setup(); G.Judgment = { active: false };
  new Function('G', 'addEventListener', source('js/game.js'))(G, () => {});
  G.Game.setHurryMode(true); G.Game.debugTime(1800);
  assert.equal(G.Game.st.time, 900); assert.equal(G.Game.st.matchTime, 1800);
  assert.equal(G.Game.timeScale, 2);
  G.Judgment.active = true; assert.equal(G.Game.timeScale, 1);
  G.Judgment.active = false; G.Game.setHurryMode(false); G.Game.debugTime(1800);
  assert.equal(G.Game.st.time, 1800); assert.equal(G.Game.timeScale, 1);
});

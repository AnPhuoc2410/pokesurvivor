const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const load = (G, f) => new Function('G', source(f))(G);

function setup() {
  const G = {}, enemies = [], shots = [], hazards = [], messages = [], events = [];
  new Function('window', 'G', source('js/core/util.js'))({ G }, G);
  const noop = () => {};
  G.Sprites = { PX: 2, bodyRadius: (dex,scale) => 14*scale, bodyHeight: (dex,scale) => 50*scale, hasShiny: () => false,
    Animator: class { update() {} } };
  G.Tiles = { T: 16, ARENA_THEMES: {}, arenaBiome: () => 0 };
  G.Coop = { active: false, isHost: false, scaleHp: () => 1, broadcast: e => events.push(e), enemyShot: noop };
  G.Game = { player: {x:0,y:100,r:12,hp:100,maxHp:100,dead:false,autoSwap:false, hurt(d){this.hp-=d;}}, st:{matchTime:0}, flash:noop, exitBossChallenge:noop };
  G.Game.everyone = () => [G.Game.player];
  G.EnemyMgr = { all:()=>enemies, get:id=>enemies.find(e=>e.id===id), add:e=>enemies.push(e), stash:()=>{enemies.length=0;}, clearRemote:noop, restore:noop };
  G.Projectiles = { spawn:o=>{ const p=Object.assign({t:0,life:3,friendly:false},o); shots.push(p);return p;}, clear:()=>{shots.length=0;}, clearHostile:()=>{shots.length=0;} };
  G.Hazards = {add:o=>{hazards.push(o);return o;},clear:()=>{hazards.length=0;}};
  G.VFX = {forType:()=>({proj:'ball',pal:'normal'})}; G.FX = {ring:noop,burst:noop};
  G.World = {biome:0,collide:noop,setBiome:noop,setArena:noop,isFree:()=>true};
  G.Weather = {clear:noop,force:noop}; G.Camera = {kick:noop}; G.Audio = {sfx:noop};
  G.Spawner = {say:(...m)=>messages.push(m)}; G.Combat = {clearFields:noop};
  G.Pickups = {pullAll:noop,dropXp:noop}; G.Progress = {event:()=>{throw new Error('Practice must not grant progress');}};
  G.Enemies = {hurryScale:()=>({hp:1,spd:1,dmg:1})}; G.Judgment={AT:1800};
  G.SPRITE_META={};G.DEX_BY={}; G.DB={save:{}};
  let id=1;
  G.Enemy=class {
    constructor(def,x,y) {Object.assign(this,def,{id:id++,x,y,r:18,scale:1,bodyH:50,maxHp:def.hp,hp:def.hp,dead:false,cat:'special',atkType:'psychic',shield:0,rd:120,anim:{play:noop,loop:noop,_start:noop}});}
    applyStun(t){this.stunT=t;}
    setStoryForm(f){this.spriteForm=f;}
    startStoryTransformation(f){this.transformT=2;this.transformForm=f;this.setStoryForm(f);}
  };
  load(G,'js/systems/rift.js');load(G,'js/systems/story-encounters.js');load(G,'js/systems/boss-forms.js');
  for(const dex of G.Rift.challengeStages().flatMap(s=>s.dexes).concat(384)) {
    G.DEX_BY[dex]={dex,name:String(dex),spd:90,types:['psychic']};G.SPRITE_META[dex]={};
  }
  function start(stage) {
    assert.equal(G.Rift.startChallenge(stage),true);
    G.Rift.update(4,G.Game.player,0);
    return G.Rift.arena;
  }
  function step(dt=0.05) {G.StoryEncounters.update(dt);G.Rift.update(dt,G.Game.player,0);}
  return {G,enemies,shots,hazards,messages,events,start,step};
}

test('Hurry enters the finale at 15 combat minutes, retaining the player build', () => {
  const { G } = setup();
  G.Game.hurryMode = true;
  const player = G.Game.player;
  Object.assign(player, { hp: 73, level: 43, atkMul: 2, moves: [{ id: 'ember', lvl: 5 }] });
  G.Rift.update(0, player, 1799);
  assert.equal(G.Rift.hurryFinale, false);
  G.Rift.update(0, player, 1800);
  assert.equal(G.Rift.hurryFinale, true);
  assert.equal(G.Rift.arena.difficulty, 'easy');
  assert.equal(G.Game.player, player);
  assert.equal(player.hp, 73); assert.equal(player.level, 43); assert.equal(player.atkMul, 2);
  assert.deepEqual(player.moves, [{ id: 'ember', lvl: 5 }]);
});

test('Hurry visits exactly one randomly selected stage per tier and ends after three wins', () => {
  const { G } = setup(), visited = [], results = [];
  G.Game.finishHurryFinale = won => results.push(won);
  assert.equal(G.Rift.startHurryFinale(), true);
  const expected = G.Rift.arena.finaleStages.slice();
  assert.equal(expected.length, 3);
  assert.deepEqual(expected.map(id => G.Rift.challengeStages().find(s => s.id === id).difficulty), ['easy', 'medium', 'hard']);
  assert.equal(G.Rift.startHurryFinale(), false, 'cannot restart an active arena');
  for (const id of expected) {
    assert.equal(G.Rift.arena.challengeId, id);
    visited.push(id);
    G.Rift.update(4, G.Game.player, 1800);
    G.Rift.onEvent(['aw']);
    G.Rift.update(5, G.Game.player, 1800);
  }
  assert.deepEqual(visited, expected); assert.ok(!visited.includes('ruin'));
  assert.deepEqual(results, [true]); assert.equal(G.Rift.inArena, false);
});

test('Hurry draws from each full playable tier and can choose different stages on a new run', () => {
  const queues = [];
  for (const chooseLast of [false, true]) {
    const { G } = setup(), pools = [];
    delete G.SPRITE_META[555];
    G.U.pick = pool => { pools.push(pool.map(s => s.id)); return chooseLast ? pool[pool.length - 1] : pool[0]; };
    assert.equal(G.Rift.startHurryFinale(), true);
    assert.equal(pools.length, 3);
    for (const [index, tier] of ['easy', 'medium', 'hard'].entries()) {
      const candidates = G.Rift.challengeStages().filter(s => s.available && s.difficulty === tier && s.dexes.every(d => G.SPRITE_META[d]));
      assert.deepEqual(pools[index], candidates.map(s => s.id));
    }
    const queue = G.Rift.arena.finaleStages;
    assert.ok(!queue.includes('ruin')); assert.ok(!queue.includes('darmanitan'));
    queues.push(queue);
  }
  assert.notDeepEqual(queues[0], queues[1]);
});

test('Hurry does not start an incomplete queue when a difficulty has no playable stage', () => {
  const { G } = setup();
  for (const stage of G.Rift.challengeStages().filter(s => s.difficulty === 'medium')) {
    for (const dex of stage.dexes) delete G.SPRITE_META[dex];
  }
  assert.equal(G.Rift.startHurryFinale(), false);
  assert.equal(G.Rift.inArena, false);
});

test('Hurry defeat ends the run instead of entering the next boss stage', () => {
  const { G } = setup(), results = [];
  G.Game.finishHurryFinale = won => results.push(won);
  G.Rift.startHurryFinale(); G.Rift.update(4, G.Game.player, 1800);
  G.Rift.onEvent(['al']); G.Rift.update(2, G.Game.player, 1800);
  assert.deepEqual(results, [false]); assert.equal(G.Rift.inArena, false);
});

test('real enemy death runs boss-stage cleanup during the Hurry finale', () => {
  const { G } = setup(); G.Rift.startHurryFinale();
  let defeated = 0;
  G.StoryEncounters.defeated = () => defeated++;
  G.Pickups.drop = G.Pickups.dropXp = () => assert.fail('stage bosses must not drop survival loot');
  load(G, 'js/entities/enemy.js');
  const boss = { dead: false, boss: true, remote: false, x: 0, y: 0, r: 16, bodyH: 40, anim: { play() {} } };
  G.Enemy.prototype.die.call(boss);
  assert.equal(boss.dead, true); assert.equal(defeated, 1);
});

test('Standard and standalone boss practice do not automatically enter the Hurry finale', () => {
  for (const [hurryMode, bossChallengeMode] of [[false, false], [true, true]]) {
    const { G } = setup(); Object.assign(G.Game, { hurryMode, bossChallengeMode });
    G.Rift.update(0, G.Game.player, 1800);
    assert.equal(G.Rift.hurryFinale, false);
  }
});

test('Coop host sends the finale queue and guests wait for the next host arena', () => {
  const host = setup(); Object.assign(host.G.Coop, { active: true, isHost: true });
  host.G.Rift.startHurryFinale();
  const cfg = host.events.find(e => e[0] === 'arena')[1];
  assert.equal(cfg.finaleStages.length, 3);
  const guest = setup(); Object.assign(guest.G.Coop, { active: true, isHost: false });
  guest.G.Game.finishHurryFinale = () => assert.fail('guest must not advance the host queue');
  guest.G.Rift.onEvent(['arena', cfg]); guest.G.Rift.update(4, guest.G.Game.player, 1800);
  assert.deepEqual(guest.G.Rift.arena.finaleStages, cfg.finaleStages);
  guest.G.Rift.onEvent(['aw']); guest.G.Rift.update(5, guest.G.Game.player, 1800);
  assert.equal(guest.G.Rift.inArena, false);
});

test('weather: first defeat summons Rayquaza once, retaining the surviving weather boss',()=>{
  const {G,enemies,start,step}=setup();const a=start('weather');
  assert.deepEqual(enemies.map(e=>e.dex),[382,383]);
  enemies[0].dead=true;step();
  assert.deepEqual(enemies.filter(e=>!e.dead).map(e=>e.dex),[383,384]);
  assert.equal(G.Rift.cinematic,true);assert.equal(G.Rift.specialBossId,enemies[2].id);
  G.Rift.cineTick(1);for(let i=0;i<90;i++)step();
  assert.equal(enemies.filter(e=>e.dex===384).length,1);
  assert.equal(a.phase,'fight');
  enemies.forEach(e=>e.dead=true);step();assert.equal(a.phase,'won');
});

test('creation starts with all three bosses; Tao and Regi wait for the entire opening roster',()=>{
  const c=setup();c.start('creation');assert.deepEqual(c.enemies.map(e=>e.dex),[483,484,487]);
  for(const [stage,expected] of [['tao',646],['regi',486]]) {
    const t=setup();t.start(stage);
    t.enemies[0].dead=true;t.step();assert.ok(!t.enemies.some(e=>e.dex===expected));
    t.enemies.forEach(e=>e.dead=true);t.step();
    assert.equal(t.enemies.filter(e=>!e.dead).length,1);
    assert.equal(t.enemies.at(-1).dex,expected);
    if(stage==='tao') {assert.equal(t.G.Rift.cinematic,true);assert.match(t.enemies.at(-1).name,/Kyurem/);}
  }
});

test('each special emits exactly three waves, with one cue and no fourth wave at the deadline',()=>{
  const t=setup();t.start('tao');let calls=0;
  const original=t.G.StoryEncounters.specialWave;
  t.G.StoryEncounters.specialWave=(e,w)=>{calls++;return original(e,w);};
  t.G.Rift.update(12,t.G.Game.player,0);assert.equal(t.G.Rift.cinematic,true);
  t.G.Rift.cineTick(1);assert.equal(calls,1);
  for(let i=0;i<81;i++)t.step(0.05);
  assert.equal(calls,3);assert.equal(t.G.Rift.evading,false);assert.equal(t.G.Rift.specialLock,false);
});

test('Kyogre waves span the arena and leave a safe corridor rather than a central explosion',()=>{
  const t=setup(),a=t.start('weather'),e=t.enemies[0],R=(a.r-1.4)*32;
  t.G.StoryEncounters.specialWave(e,0);
  assert.equal(t.hazards.length,6);
  for(const h of t.hazards) {assert.equal(h.kind,'beam');assert.ok(Math.abs(h.len-R*2)<1e-6);assert.ok(h.delay>=0.8);assert.ok(h.w<R*2/7);}
  assert.ok(t.G.StoryEncounters.fields.some(f=>f.effect==='slow'));
});

test('water slows, lava hurts repeatedly, and spell lock pauses older environmental attacks',()=>{
  const t=setup();t.start('weather');const S=t.G.StoryEncounters;
  S.move(t.enemies[0],1.3,t.G.Game.player,70);
  const water=S.fields.find(f=>f.effect==='slow');assert.ok(water);
  Object.assign(t.G.Game.player,{x:water.x,y:water.y});S.update(1);
  assert.equal(S.effects(t.G.Game.player).speed,0.6);
  S.move(t.enemies[1],1.3,t.G.Game.player,70);const lava=S.fields.find(f=>f.type==='fire');
  Object.assign(t.G.Game.player,{x:lava.x,y:lava.y});S.update(1);const hp=t.G.Game.player.hp;S.update(1);assert.ok(t.G.Game.player.hp<hp);
  const a=t.G.Rift.arena;a.evading=4;const before=t.G.Game.player.hp;S.update(1);assert.equal(t.G.Game.player.hp,before);
});

test('Dialga slows movement and projectiles without compounding; Palkia no longer curves them',()=>{
  const t=setup();t.start('creation');const S=t.G.StoryEncounters,p={friendly:true,vx:200,vy:0};
  assert.equal(S.effects(t.G.Game.player).speed,0.72);
  S.update(0.2);S.updateProjectile(p,0.1);const speed=Math.hypot(p.vx,p.vy);assert.ok(Math.abs(speed-110)<1e-6);assert.equal(p.vy,0);
  S.updateProjectile(p,0.1);assert.ok(Math.abs(Math.hypot(p.vx,p.vy)-speed)<1e-6);
  const before=S.effects(t.G.Game.player).speed;S.update(1);assert.equal(S.effects(t.G.Game.player).speed,before);
  t.enemies[0].dead=true;t.enemies[1].dead=true;S.updateProjectile(p,0.1);assert.ok(Math.abs(Math.hypot(p.vx,p.vy)-200)<1e-6);assert.equal(S.effects(t.G.Game.player).speed,1);
});

test('boss stages have exactly one difficulty, are grouped by tier, and use their HP and damage multipliers', () => {
  const { G } = setup(), tiers = G.Rift.DIFFICULTIES, stages = G.Rift.challengeStages();
  assert.equal(stages.length, 24);
  const order = stages.map(s => Object.keys(tiers).indexOf(s.difficulty));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  for (const stage of stages) assert.equal(Object.values(tiers).filter(t => t.stages.includes(stage.id)).length, 1, stage.id);
  for (const [id, hp, damage] of [['lake', 2560, 31], ['eon', 3200, 36], ['creation', 4000, 41]]) {
    const t = setup(); t.start(id);
    assert.equal(t.enemies[0].hp, hp); assert.equal(t.enemies[0].dmg, damage);
  }
});

test('boss maps grow with the real party; solo practice reproduces the same map and HP for 1–10 players', () => {
  const radii = [11, 14, 16, 18, 20, 22, 25, 27, 29, 31];
  for (let n = 1; n <= 10; n++) {
    const coop = setup(), practice = setup();
    const players = Array.from({ length: n }, (_, i) => ({ ...coop.G.Game.player, uid: String(i) }));
    coop.G.Game.everyone = () => players;
    Object.assign(coop.G.Coop, { active: true, isHost: true, scaleHp: n => 1 + 0.25 * (n - 1) });
    practice.G.Coop.scaleHp = coop.G.Coop.scaleHp;
    coop.G.Rift.startChallenge('creation');
    practice.G.Rift.startChallenge('creation', null, n);
    assert.equal(coop.G.Rift.arena.r, radii[n - 1]);
    assert.equal(practice.G.Rift.arena.r, radii[n - 1]);
    assert.equal(coop.events.find(e => e[0] === 'arena')[1].r, radii[n - 1]);
    for (const t of [coop, practice]) t.G.Rift.update(4, t.G.Game.player, 0);
    assert.equal(coop.enemies[0].hp, practice.enemies[0].hp);
    assert.equal(coop.enemies[0].dmg, practice.enemies[0].dmg);
    assert.equal(coop.G.Rift.arenaRadius(n, 24), Math.ceil(24 * (1 + 0.2 * (n - 1))));
  }
  const { G } = setup();
  assert.equal(G.Rift.arenaRadius(-10), 11); assert.equal(G.Rift.arenaRadius(99), 31);
});

test('Palkia warns before teleport, lands inside the arena away from bosses, and stops on defeat', () => {
  const t = setup(); t.start('creation');
  const S = t.G.StoryEncounters, p = t.G.Game.player, before = { x: p.x, y: p.y };
  S.update(7); assert.equal(p.x, before.x); assert.equal(p.y, before.y);
  S.update(0.9); assert.equal(p.x, before.x); assert.equal(p.y, before.y);
  S.update(0.11);
  assert.ok(Math.hypot(p.x - before.x, p.y - before.y) >= 64);
  const a = t.G.Rift.arena;
  assert.ok(Math.hypot(p.x - a.x, p.y - a.y) < (a.r - 1.4) * 32 - p.r);
  assert.ok(t.enemies.every(e => Math.hypot(p.x - e.x, p.y - e.y) >= e.r + p.r + 24));
  assert.ok(p.invuln >= 0.75);
  const landed = { x: p.x, y: p.y };
  t.enemies.find(e => e.dex === 484).dead = true;
  S.update(20); assert.equal(p.x, landed.x); assert.equal(p.y, landed.y);
});

test('Palkia cancels a warned teleport if defeated and never places players into blocked terrain', () => {
  for (const killed of [false, true]) {
    const t = setup(); t.start('creation');
    const p = t.G.Game.player, before = { x: p.x, y: p.y };
    t.G.World.isFree = () => false;
    t.G.StoryEncounters.update(7);
    if (killed) t.enemies.find(e => e.dex === 484).dead = true;
    t.G.StoryEncounters.update(1);
    assert.equal(p.x, before.x); assert.equal(p.y, before.y);
  }
});

test('Palkia teleports every living coop player and clients use host destinations', () => {
  const t = setup();
  const p = t.G.Game.player; p.uid = 'host';
  const other = { ...p, uid: 'guest' }, dead = { ...p, uid: 'dead', dead: true };
  t.G.Game.everyone = () => [p, other, dead];
  Object.assign(t.G.Coop, { active: true, isHost: true });
  t.start('creation');
  t.G.StoryEncounters.update(7); t.G.StoryEncounters.update(1);
  const event = t.events.find(e => e[0] === 'enc' && e[1] === 'warp');
  assert.ok(t.events.some(e => e[0] === 'enc' && e[1] === 'warpWarning'));
  assert.deepEqual(event[2].map(t => t.uid), ['host', 'guest']);
  assert.ok(Math.hypot(p.x - other.x, p.y - other.y) >= p.r + other.r + 16);
  const client = setup();
  client.G.Rift.onEvent(t.events.find(e => e[0] === 'arena'));
  client.G.Rift.update(4, client.G.Game.player, 0);
  const local = client.G.Game.player; local.uid = 'guest';
  const remote = { ...local, uid: 'host' };
  client.G.Game.everyone = () => [local, remote];
  Object.assign(client.G.Coop, { active: true, isHost: false });
  client.G.StoryEncounters.onEvent(event);
  assert.equal(local.x, other.x); assert.equal(local.y, other.y);
  assert.equal(remote.x, p.x); assert.equal(remote.y, p.y);
  client.G.StoryEncounters.update(20);
  assert.equal(local.x, other.x); assert.equal(local.y, other.y);
  client.G.StoryEncounters.onEvent(['enc', 'warp', [{ uid: 'guest', x: Infinity, y: 0 }]]);
  assert.equal(local.x, other.x);
});

test('lake confusion lasts three seconds; Darkrai darkness lasts half a second',()=>{
  const t=setup();t.start('lake');const S=t.G.StoryEncounters,p=t.G.Game.player;
  S.specialWave(t.enemies[0],0);assert.ok(t.shots.some(s=>s.enc.effect==='confuse'));
  S.projectileHit(t.shots[0],p);assert.equal(S.effects(p).confused,true);
  S.update(3.01);assert.equal(S.effects(p).confused,false);
  S.projectileHit(t.shots[0],p);assert.equal(S.effects(p).confused,false);
  S.projectileHit({enc:{effect:'dark'}},p);assert.equal(S.effects(p).dark,true);
  S.update(0.49);assert.equal(S.effects(p).dark,true);
  S.update(0.02);assert.equal(S.effects(p).dark,false);
});

test('Tapu terrain has distinct restrictions, releases on owner defeat, and clears on exit',()=>{
  const t=setup();t.start('tapu');const S=t.G.StoryEncounters,p=t.G.Game.player;
  assert.equal(S.fields.filter(f=>f.terrain).length,4);
  const mist=S.fields.find(f=>f.effect==='mist');Object.assign(p,{x:mist.x,y:mist.y});S.update(1.1);assert.equal(S.effects(p).noHeal,true);
  t.enemies.find(e=>e.id===mist.owner).dead=true;S.update(0.4);assert.equal(S.effects(p).noHeal,false);
  const psychic=S.fields.find(f=>f.effect==='psychic');Object.assign(p,{x:psychic.x,y:psychic.y});S.update(0.1);assert.equal(S.effects(p).noDash,true);
  S.reset();assert.deepEqual(S.effects(p),{speed:1,damage:1});assert.equal(S.fields.length,0);
});

test('Eon support is bounded and Latias defeat doubles Latios stats exactly once',()=>{
  const t=setup();t.start('eon');const [latias,latios]=t.enemies;latios.hp-=500;
  t.G.StoryEncounters.move(latias,5,t.G.Game.player,70);
  assert.ok(latios.hp>latios.maxHp-500);assert.ok(latios.shield>0);const spd=latios.spd,dmg=latios.dmg;
  latias.dead=true;t.step();assert.equal(latios.spd,spd*2);assert.equal(latios.dmg,dmg*2);
  t.step();assert.equal(latios.spd,spd*2);
});

test('Regigigas has a ten-second slow start; beasts dash and lay actual elemental trails',()=>{
  const t=setup();t.start('regi');t.enemies.forEach(e=>e.dead=true);t.step();const e=t.enemies.at(-1),S=t.G.StoryEncounters;
  const v=S.move(e,1,t.G.Game.player,100);assert.ok(Math.hypot(v[0],v[1])<=15.001);assert.equal(e.encounter.dash,null);
  S.move(e,9.1,t.G.Game.player,100);assert.ok(e.encounter.dash);
  const b=setup();b.start('beasts');const beast=b.enemies[0];b.G.StoryEncounters.move(beast,2,b.G.Game.player,100);
  b.G.StoryEncounters.move(beast,1,b.G.Game.player,100);
  assert.ok(b.G.StoryEncounters.fields.some(f=>f.type==='electric'));
});

test('Ho-Oh ash remains for the encounter, Lugia wind pushes, and a new run clears both',()=>{
  const t=setup();t.start('tower');const S=t.G.StoryEncounters,[lugia,hooh]=t.enemies,p=t.G.Game.player;
  S.move(hooh,2,p,70);const ash=S.fields.find(f=>f.permanent);assert.ok(ash);S.update(50);assert.ok(S.fields.includes(ash));
  S.specialWave(lugia,0);const f=S.fields.find(f=>f.shape==='wind');p.x=f.x+Math.cos(f.angle)*100;p.y=f.y+Math.sin(f.angle)*100;
  const before={x:p.x,y:p.y};S.update(1);assert.ok(Math.hypot(p.x-before.x,p.y-before.y)>50);
  t.G.Rift.reset();assert.equal(S.fields.length,0);assert.equal(S.active,false);
});

test('Zamazenta blocks frontal shots and AOE, but permits piercing shots and rear attacks',()=>{
  const t=setup();t.start('heroes');const S=t.G.StoryEncounters,z=t.enemies.find(e=>e.dex===889);z.encounter.facing=0;
  const shot={friendly:true,x:z.x+z.r+20,y:z.y,vx:-100,vy:0,pierce:0,r:6};
  assert.equal(S.intercept(shot),true);assert.equal(S.intercept({...shot,pierce:1}),false);
  assert.equal(S.intercept({...shot,x:z.x-50,vx:100}),false);
  assert.equal(S.intercept({...shot,px:z.x+150,py:z.y,x:z.x-50}),true,'fast projectiles cannot tunnel through the shield');
  assert.equal(S.blocksDamage(z,-1,0,{kind:'nova'}),true);assert.equal(S.blocksDamage(z,1,0,{kind:'nova'}),false);
});

test('new mechanics do not activate in survival Rifts; missing-art Ruin remains unavailable',()=>{
  const t=setup();assert.equal(t.G.Rift.startChallenge('ruin'),false);
  t.G.Rift.debugStory();t.G.Rift.update(4,t.G.Game.player,0);
  assert.equal(t.G.StoryEncounters.active,false);assert.equal(t.G.StoryEncounters.controls(t.enemies[0]),false);
  assert.deepEqual(t.G.StoryEncounters.effects(t.G.Game.player),{speed:1,damage:1});
});

test('birds cross to the far edge and specials cover five separated full-arena lanes',()=>{
  const t=setup(),a=t.start('birds'),S=t.G.StoryEncounters,R=S.attacks.radius(),e=t.enemies[0];
  Object.assign(t.G.Game.player,{x:a.x,y:a.y});S.move(e,2,t.G.Game.player,100);
  const d=e.encounter.dash;
  assert.ok(Math.hypot(d.to.x-d.from.x,d.to.y-d.from.y)>R*1.6);
  t.hazards.length=0;S.specialWave(e,0);
  assert.equal(t.hazards.length,5);assert.ok(t.hazards.every(h=>Math.abs(h.len-2*R)<0.01));
  assert.equal(t.shots.length,15);
});

test('Swords and Regi turrets spawn at the rim; Eon stays separated and Tower keeps moving',()=>{
  for(const stage of ['swords','regi']) {
    const t=setup(),a=t.start(stage),R=t.G.StoryEncounters.attacks.radius();
    assert.ok(t.enemies.every(e=>Math.hypot(e.x-a.x,e.y-a.y)>R*0.85));
  }
  for(const stage of ['eon','tower']) {
    const t=setup();t.start(stage);const S=t.G.StoryEncounters,R=S.attacks.radius();
    for(let i=0;i<100;i++) for(const e of t.enemies) {
      const [vx,vy]=S.move(e,0.05,t.G.Game.player,100);e.x+=vx*0.05;e.y+=vy*0.05;
    }
    const [a,b]=t.enemies;assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>R);
    const v=S.move(a,0.05,t.G.Game.player,100);assert.ok(Math.hypot(v[0],v[1])>20);
  }
});

test('Hero specials dash physically and leave the other boss stationary',()=>{
  for(const dex of [888,889]) {
    const t=setup();t.start('heroes');const S=t.G.StoryEncounters,e=t.enemies.find(e=>e.dex===dex),other=t.enemies.find(e=>e!==t.enemies.find(e=>e.dex===dex));
    const from={x:e.x,y:e.y},still={x:other.x,y:other.y};
    S.specialWave(e,0);assert.equal(e.encounter.dash.special,true);
    for(let i=0;i<24;i++) {S.specialMove(e,0.05);assert.equal(S.specialMove(other,0.05),false);}
    assert.ok(Math.hypot(e.x-from.x,e.y-from.y)>100);assert.deepEqual({x:other.x,y:other.y},still);
  }
});

test('Moon special flashes once, uses smaller crescents, and Darkrai darkens for exactly 0.5 seconds',()=>{
  const t=setup();t.start('moon');const S=t.G.StoryEncounters;let flashes=0;t.G.Game.flash=()=>flashes++;
  for(let w=0;w<3;w++) S.specialWave(t.enemies[0],w);
  assert.equal(flashes,1);assert.ok(t.shots.every(p=>p.r===7 && p.enc.shape==='crescent'));
  S.specialWave(t.enemies[1],0);assert.equal(S.effects(t.G.Game.player).dark,true);
  S.update(0.51);assert.equal(S.effects(t.G.Game.player).dark,false);
});

test('HP forms change real sprite IDs and survive the second health bar in the correct form',()=>{
  for(const [stage,threshold,form] of [['darmanitan',0.5,'0001'],['necrozma',0.3,'0003']]) {
    const t=setup();t.start(stage);const e=t.enemies[0],F=t.G.BossForms;
    e.hp=e.maxHp*(threshold+0.01);F.update(e,0.1);assert.equal(e.encounter.formIndex,0);
    e.hp=e.maxHp*threshold;F.update(e,0.1);assert.equal(e.spriteForm,form);assert.equal(e.transformT,2);
    e.hp=e.maxHp;e.challengePhase2=true;assert.equal(F.onBarBreak(e),true);assert.equal(e.transformForm,form);
    if(stage==='darmanitan') assert.equal(F.damageTaken(e),0.2);
  }
});

test('timed forms cycle real art and Deoxys Defense blocks shots',()=>{
  const t=setup();t.start('deoxys');const e=t.enemies[0],F=t.G.BossForms;
  assert.equal(e.spriteForm,'0003');
  for(const f of ['0002','0001','','0003']) {
    e.transformT=0;F.update(e,9.9);const current=e.spriteForm;F.update(e,0.1);assert.notEqual(e.spriteForm,current);assert.equal(e.spriteForm,f);
    assert.equal(F.blocksProjectile(e,{pierce:0}),f==='0002');
  }
  const m=setup();m.start('meloetta');m.G.BossForms.update(m.enemies[0],10);assert.equal(m.enemies[0].spriteForm,'0001');
  m.enemies[0].transformT=0;m.G.BossForms.update(m.enemies[0],10);assert.equal(m.enemies[0].spriteForm,'');
  const r=setup();r.start('rotom');r.G.BossForms.update(r.enemies[0],10);assert.notEqual(r.enemies[0].spriteForm,'0001');
});

test('Darmanitan and Wishiwashi create multiple impacts across the arena in each burst',()=>{
  for(const stage of ['darmanitan','wishiwashi']) {
    const t=setup(),a=t.start(stage);const S=t.G.StoryEncounters,R=S.attacks.radius();
    S.specialWave(t.enemies[0],0);
    assert.ok(t.hazards.length>=12);
    assert.ok(t.hazards.some(h=>Math.hypot(h.x-a.x,h.y-a.y)>R*0.8));
    if(stage==='darmanitan') assert.equal(t.shots.length,0);
    else assert.ok(t.shots.length>=20);
  }
});

test('form specials have distinct mechanics and reach the arena boundary',()=>{
  const n=setup();n.start('necrozma');const N=n.G.StoryEncounters,e=n.enemies[0];
  N.specialWave(e,0);assert.ok(n.shots.every(p=>p.enc.bounce));
  e.encounter.formIndex=1;n.hazards.length=0;N.specialWave(e,1);
  assert.ok(n.hazards.filter(h=>h.kind==='beam').every(h=>h.len>=N.attacks.radius()*2-0.01));
  const m=setup();m.start('meloetta');m.G.StoryEncounters.specialWave(m.enemies[0],0);
  assert.ok(m.shots.every(p=>p.enc.shape==='note' && p.enc.bounce));
  m.enemies[0].encounter.formIndex=1;m.G.StoryEncounters.specialWave(m.enemies[0],1);assert.equal(m.enemies[0].encounter.dash.special,true);
  const r=setup(),a=r.start('rotom'),S=r.G.StoryEncounters,re=r.enemies[0];
  for(let i=0;i<4;i++) {re.encounter.formIndex=i;S.specialWave(re,0);}
  assert.ok(S.fields.some(f=>f.pull>0));assert.ok(r.shots.some(p=>p.enc.effect==='slow'));assert.ok(r.shots.some(p=>p.enc.zigzag));
  assert.ok(r.shots.filter(p=>p.enc.shape==='saw').every(p=>Math.hypot(p.x-a.x,p.y-a.y)<=S.attacks.radius()));
});

test('all installed form metadata has matching PNG assets for every animation',()=>{
  const G={};load(G,'js/data/sprites-meta.js');
  for(const [dex,forms] of Object.entries({555:['0001'],746:['0001'],800:['0003'],386:['0001','0002','0003'],479:['0001','0002','0003','0005'],648:['0001']})) {
    for(const form of forms) {
      const m=G.SPRITE_META[dex].f[form];assert.ok(m.a.Idle && m.a.Walk && m.a.Attack);
      for(const anim of Object.keys(m.a)) assert.ok(fs.existsSync(path.join(__dirname,'..','assets','pokemon',dex,'f-'+form,anim+'.png')));
    }
  }
});

test('real Combat resolution blocks close projectiles before they can damage Zamazenta',()=>{
  const t=setup();t.start('heroes');const G=t.G,z=t.enemies.find(e=>e.dex===889);z.encounter.facing=0;
  let hurt=0;z.hurt=()=>hurt++;
  G.Projectiles.all=()=>t.shots;G.EnemyMgr.queryCircle=()=>[z];
  G.World.projectileBlock=()=>false;G.World.propsInCircle=()=>[];
  G.Game.player.dead=true;
  t.shots.push({friendly:true,x:z.x+5,y:z.y,px:z.x+10,py:z.y,vx:-100,vy:0,pierce:0,r:4,phits:new Set(),hits:new Set()});
  load(G,'js/systems/combat.js');G.Combat.resolve(0.05,G.Game.player,0);
  assert.equal(hurt,0);assert.equal(t.shots.length,0);
});

test('Wishiwashi remains Solo throughout phase one and only becomes School on the second bar',()=>{
  const t=setup();t.start('wishiwashi');const e=t.enemies[0],F=t.G.BossForms;
  for(const fraction of [0.8,0.5,0.01]) {e.hp=e.maxHp*fraction;F.update(e,1);assert.equal(e.spriteForm,'');}
  e.challengePhase2=true;e.storyPhase=2;e.hp=e.maxHp;F.onBarBreak(e);
  assert.equal(e.spriteForm,'0001');assert.equal(e.scale,1.5);assert.equal(e.storyPhase,2);
});

test('real enemy damage advances the phase once; timed form changes preserve HP and phase two',()=>{
  for(const stage of ['wishiwashi','deoxys','rotom','meloetta']) {
    const t=setup();t.start(stage);const G=t.G,e=t.enemies[0],manager=G.EnemyMgr;
    load(G,'js/entities/enemy.js');const hurt=G.Enemy.prototype.hurt;G.EnemyMgr=manager;
    G.Judgment.noteDmg=()=>{};e.showHurt=()=>{};e.die=()=>{e.dead=true;};e.storyPhase=1;e.challengePhase2=false;
    hurt.call(e,e.maxHp*2);assert.equal(e.storyPhase,2);assert.equal(e.challengePhase2,true);assert.equal(e.hp,e.maxHp);
    e.transformT=0;const hp=e.hp;G.BossForms.update(e,10);assert.equal(e.storyPhase,2);assert.equal(e.hp,hp);
    e.transformT=0;e.phaseInvuln=0;hurt.call(e,e.maxHp*2);assert.equal(e.dead,true,'no third health bar after a form change');
  }
});

test('Darmanitan special emits explosions without projectiles in either form',()=>{
  const t=setup();t.start('darmanitan');const e=t.enemies[0];
  for(const mode of [0,1]) {e.encounter.formIndex=mode;for(let wave=0;wave<3;wave++)t.G.StoryEncounters.specialWave(e,wave);}
  assert.equal(t.shots.length,0);assert.equal(t.hazards.length,72);
});

test('Lake trio waits after teleport, snapshots aim, and reduces bullet count and collision radius',()=>{
  const t=setup();t.start('lake');const S=t.G.StoryEncounters,e=t.enemies[0],p=t.G.Game.player;
  assert.ok(t.enemies[1].encounter.cooldown>e.encounter.cooldown);
  S.move(e,1.3,p,100);assert.equal(t.shots.length,0);assert.ok(e.encounter.teleportCast);
  const target={...e.encounter.teleportCast.target};p.x+=140;
  S.move(e,0.79,p,100);assert.equal(t.shots.length,0);
  S.move(e,0.02,p,100);assert.equal(t.shots.length,3);
  const center=t.shots[1];assert.ok(Math.abs(Math.atan2(center.vy,center.vx)-Math.atan2(target.y-e.y,target.x-e.x))<1e-6);
  assert.ok(t.shots.every(p=>p.r===4 && p.life===2.6));
  t.shots.length=0;S.specialWave(e,0);assert.equal(t.shots.length,9);assert.ok(t.shots.every(p=>p.r===4));
  e.encounter.cooldown=0;S.move(e,0.1,p,100);S.cancelCasts();S.move(e,0.9,p,100);assert.equal(t.shots.length,9,'a canceled teleport cast must not fire after the special');
});

test('Necrozma and Attack Deoxys have a consistent open sector and short-lived volleys',()=>{
  for(const stage of ['necrozma','deoxys']) {
    const t=setup();t.start(stage);const e=t.enemies[0],S=t.G.StoryEncounters;
    if(stage==='deoxys')e.encounter.formIndex=2;
    for(let wave=0;wave<3;wave++) {
      const before=t.shots.length;S.specialWave(e,wave);const shots=t.shots.slice(before);
      const aim=Math.atan2(t.G.Game.player.y-e.y,t.G.Game.player.x-e.x);
      assert.ok(Math.abs(Math.abs(e.encounter.safeAngle-aim)-0.65)<1e-8);
      assert.ok(shots.length>8 && shots.length<=(stage==='necrozma'?18:24));
      assert.ok(shots.every(p=>p.r<=5 && p.life<=2.6 && Math.hypot(p.vx,p.vy)<=175.01));
      for(const p of shots) {
        const delta=Math.atan2(p.vy,p.vx)-e.encounter.safeAngle;
        assert.ok(Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))>=0.38-1e-8);
      }
    }
    if(stage==='necrozma') {
      const p=t.shots[0],a=t.G.Rift.arena;Object.assign(p,{x:a.x+S.attacks.radius(),y:a.y,vx:150,vy:0});
      S.updateProjectile(p,0.01);assert.equal(p.encBounces,1);assert.ok(p.vx<0);
      p.vx=150;S.updateProjectile(p,0.01);assert.equal(p.life,p.t,'second bounce expires the projectile');
      e.encounter.formIndex=1;t.hazards.length=0;S.specialWave(e,0);
      assert.equal(t.hazards.length,4);assert.ok(t.hazards.every(h=>h.kind==='beam' && h.delay>=1 && h.w===24));
    }
  }
});

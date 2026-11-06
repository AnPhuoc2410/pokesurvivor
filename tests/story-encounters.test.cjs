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
  G.Sprites = { PX: 2, bodyRadius: (dex,scale) => 14*scale, bodyHeight: (dex,scale) => 50*scale, hasShiny: () => false };
  G.Sprites.Animator = class { constructor(dex,scale) { this.dex=dex; this.scale=scale; } update() {} };
  G.Tiles = { T: 16, ARENA_THEMES: {}, arenaBiome: () => 0 };
  G.Coop = { active: false, isHost: false, scaleHp: () => 1, broadcast: e => events.push(e), enemyShot: noop };
  G.Game = { player: {x:0,y:100,r:12,hp:100,maxHp:100,dead:false,autoSwap:false, hurt(d){this.hp-=d;}}, st:{matchTime:0}, flash:noop, exitBossChallenge:noop };
  G.Game.everyone = () => [G.Game.player];
  G.EnemyMgr = { all:()=>enemies, get:id=>enemies.find(e=>e.id===id), add:e=>enemies.push(e), stash:()=>{enemies.length=0;}, clearRemote:noop, restore:noop };
  G.Projectiles = { spawn:o=>{ const p=Object.assign({t:0,life:3,friendly:false},o); shots.push(p);return p;}, clear:()=>{shots.length=0;}, clearHostile:()=>{shots.length=0;} };
  G.Projectiles.all = () => shots;
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
  for(const dex of Object.values(G.StoryEncounters.STAGES).flatMap(s=>s.waves.flat()).concat(384)) {
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

function realDamage(t, enemy) {
  const manager=t.G.EnemyMgr;
  load(t.G,'js/entities/enemy.js');
  const hurt=t.G.Enemy.prototype.hurt;
  t.G.EnemyMgr=manager;t.G.Judgment.noteDmg=()=>{};
  enemy.showHurt=()=>{};enemy.die=()=>{enemy.dead=true;};
  return damage=>hurt.call(enemy,damage);
}

function takeTeraEnergy(t,e,type) {
  const crystal=e.encounter.crystals.find(c=>c.type===type && !c.collected);
  assert.ok(crystal,'requested energy is available');
  Object.assign(t.G.Game.player,{x:crystal.x,y:crystal.y});
  t.G.BossForms.updateArena(e,0.01);
}

test('Terapagos: actual damage visits Normal, Terastal, and Stellar without adding a third HP bar',()=>{
  const t=setup();t.start('terapagos');const e=t.enemies[0],hit=realDamage(t,e);
  assert.equal(e.spriteForm,'');hit(e.maxHp*2);
  assert.equal(e.spriteForm,'0001');assert.equal(e.hp,e.maxHp*0.6);assert.equal(e.dead,false);
  e.transformT=0;takeTeraEnergy(t,e,'water');hit(e.maxHp*2);
  assert.equal(e.spriteForm,'0002');assert.equal(e.storyPhase,2);assert.equal(e.hp,e.maxHp);
  e.transformT=0;takeTeraEnergy(t,e,'grass');hit(e.maxHp*2);
  assert.equal(e.dead,true);
});

test('Terapagos: shield blocks real damage, requires the right crystal, and rotates after eight open seconds',()=>{
  const t=setup();t.start('terapagos');const e=t.enemies[0],hit=realDamage(t,e),F=t.G.BossForms;
  hit(e.maxHp);e.transformT=0;const hp=e.hp;
  hit(100);assert.equal(e.hp,hp,'closed shield does not leak minimum-one damage');
  takeTeraEnergy(t,e,'fire');hit(100);assert.equal(e.hp,hp,'wrong element cannot break the shield');
  takeTeraEnergy(t,e,'water');hit(100);assert.equal(e.hp,hp-100);assert.equal(e.encounter.shellOpen,8);
  const s=e.encounter;assert.equal(s.shellActive,false);assert.equal(s.energyType,null);assert.equal(s.crystals.length,0);
  F.updateArena(e,8);assert.equal(s.shellIndex,1);assert.equal(s.shellActive,true);assert.equal(s.crystals.length,3);
  takeTeraEnergy(t,e,'grass');hit(1);F.updateArena(e,8);assert.equal(s.shellIndex,2);
  takeTeraEnergy(t,e,'fire');hit(1);F.updateArena(e,8);assert.equal(s.shellIndex,0);
});

test('Terapagos: evade permits crystal collection and preserves both the charge and earned damage window',()=>{
  const t=setup(),a=t.start('terapagos'),e=t.enemies[0],hit=realDamage(t,e),F=t.G.BossForms;
  hit(e.maxHp);e.transformT=0;a.evading=4;
  takeTeraEnergy(t,e,'water');const hp=e.hp;hit(100);
  assert.equal(e.hp,hp);assert.equal(e.encounter.energyType,'water');
  assert.match(F.statusLabel(e),/Né xong/);
  a.evading=0;hit(100);assert.equal(e.encounter.shellOpen,8);
  a.evading=4;F.updateArena(e,4);assert.equal(e.encounter.shellOpen,8);
  a.evading=0;F.updateArena(e,2);assert.equal(e.encounter.shellOpen,6);
});

test('Terapagos: three forms have distinct specials; Stellar hazards finish before the evade reward',()=>{
  const t=setup();t.start('terapagos');const e=t.enemies[0],hit=realDamage(t,e),S=t.G.StoryEncounters;
  S.specialWave(e,0);assert.ok(t.shots.length>10);assert.equal(t.hazards.length,0);
  hit(e.maxHp);e.transformT=0;t.shots.length=0;S.specialWave(e,0);
  assert.equal(t.hazards.length,4);assert.ok(t.hazards.every(h=>h.type==='fire' && h.kind==='beam'));
  takeTeraEnergy(t,e,'water');hit(e.maxHp*2);e.transformT=0;
  t.hazards.length=0;t.shots.length=0;
  for(let wave=0;wave<3;wave++) {
    const before=t.hazards.length;S.specialWave(e,wave);
    for(const h of t.hazards.slice(before)) assert.ok(wave*4/3+h.delay+(h.end||0.45)<4);
  }
  assert.equal(t.hazards.filter(h=>h.vis==='teraCrystal').length,7);
  assert.equal(t.hazards.filter(h=>h.kind==='beam').length,4);
  assert.ok(t.shots.length>20 && t.shots.every(p=>p.life<=1.2));
  assert.equal(S.skill(1024)[0],'Tera Starstorm');
  S.reset();assert.equal(t.G.BossForms.damageTaken(e),1,'shield never leaks into another arena');
});

test('Zygarde: actual damage triggers both thresholds, heals once, and cannot skip Complete',()=>{
  const t=setup();t.start('zygarde');const e=t.enemies[0],hit=realDamage(t,e);
  assert.equal(e.spriteForm,'0001');assert.equal(e.challengeBoss,false);
  hit(e.maxHp*2);
  assert.equal(e.spriteForm,'');assert.equal(e.encounter.formIndex,1);assert.equal(e.hp,e.maxHp*0.5);assert.equal(e.dead,false);
  e.transformT=0;hit(Math.ceil(e.maxHp*0.41));
  assert.equal(e.spriteForm,'0002');assert.equal(e.encounter.formIndex,2);
  assert.ok(e.hp>=e.maxHp*0.58 && e.hp<=e.maxHp*0.6);
  e.transformT=0;const hp=e.hp;t.G.BossForms.update(e,1);assert.equal(e.hp,hp);
  hit(e.maxHp*2);assert.equal(e.dead,true);
});

test('Zygarde: each form has distinct attacks and Complete sweeps with staggered full-arena warnings',()=>{
  const t=setup(),a=t.start('zygarde'),e=t.enemies[0],S=t.G.StoryEncounters;
  e.encounter.cooldown=0;S.move(e,0.1,t.G.Game.player,100);
  assert.ok(e.encounter.dash);assert.ok(t.shots.every(p=>p.r===4));
  e.hp=e.maxHp*0.49;t.G.BossForms.onDamage(e);e.transformT=0;
  S.specialWave(e,0);assert.ok(S.fields.some(f=>f.type==='poison' && f.damage>0 && f.delay>=0.8));
  e.hp=e.maxHp*0.09;t.G.BossForms.onDamage(e);e.transformT=0;t.hazards.length=0;
  S.specialWave(e,0);assert.equal(t.hazards.length,5);
  const r=(a.r-1.4)*32;
  assert.ok(t.hazards.every(h=>h.kind==='beam' && Math.abs(h.len-2*r)<0.01));
  assert.ok(t.hazards.every((h,i)=>i===0 || h.delay>t.hazards[i-1].delay));
});

test('Hoopa: portals reflect crossing player shots through actual combat resolution',()=>{
  const t=setup();t.start('hoopa');const e=t.enemies[0],G=t.G;
  e.encounter.cooldown=0;G.StoryEncounters.move(e,0.1,G.Game.player,100);
  assert.equal(t.shots.filter(p=>p.enc?.portal).length,3);
  const ring=t.shots[0];
  const bullet=G.Projectiles.spawn({friendly:true,x:ring.x+60,y:ring.y,px:ring.x-60,py:ring.y,vx:400,vy:0,r:5,dmg:99999,pierce:3});
  G.EnemyMgr.queryCircle=()=>[];
  load(G,'js/systems/combat.js');G.Combat.resolve(0.016,G.Game.player,0);
  assert.ok(!t.shots.includes(bullet));
  const reflected=t.shots.find(p=>p.enc?.reflected);
  assert.ok(reflected && !reflected.friendly && reflected.vx<0);
  assert.ok(reflected.dmg<=e.dmg && Math.hypot(reflected.vx,reflected.vy)<=220.01);
});

test('Hoopa: Confined special uses six stationary gates and snapshots aim for each pair',()=>{
  const t=setup(),a=t.start('hoopa'),e=t.enemies[0],G=t.G,p=G.Game.player;
  a.evading=4;
  for(let wave=0;wave<3;wave++) {
    p.x=a.x+wave*60;p.y=a.y+80-wave*50;
    G.StoryEncounters.specialWave(e,wave);
    const pair=t.hazards.slice(-2);
    assert.equal(pair.length,2);
    for(const h of pair) {
      assert.equal(h.vis,'hoopaBeam');assert.equal(h.kind,'beam');
      const cross=(p.x-h.x)*Math.sin(h.angle)-(p.y-h.y)*Math.cos(h.angle);
      assert.ok(Math.abs(cross)<1e-7,'beam points at the position sampled for this wave');
      assert.ok(wave*4/3+h.delay+h.end<4,'beam ends before the stun reward');
    }
    const angles=pair.map(h=>h.angle);p.x+=80;
    assert.deepEqual(pair.map(h=>h.angle),angles,'warnings do not track after locking');
  }
  const gates=G.StoryEncounters.fields.filter(f=>f.shape==='hoopaGate');
  assert.equal(gates.length,6);assert.ok(gates.every(f=>f.damage===0 && f.special && f.duration===4));
  assert.equal(new Set(t.hazards.map(h=>`${h.x},${h.y}`)).size,6);
  assert.equal(t.shots.length,0,'special needs no player projectile to work');
  assert.ok(G.Rift.evading);
});

test('Hoopa: portal beams hurt after warning with firing disabled, and sidestepping avoids them',()=>{
  for(const sidestep of [false,true]) {
    const t=setup();t.start('hoopa');const G=t.G,p=G.Game.player;
    load(G,'js/systems/hazards.js');G.Camera.sees=()=>false;G.FX.beam=()=>{};G.LIFT=0;
    G.Rift.update(12,p,0);G.Rift.cineTick(1);
    assert.ok(G.Rift.evading);assert.equal(G.Hazards.all.length,2);
    const beam=G.Hazards.all[0],hp=p.hp;
    G.Hazards.update(0.5);assert.equal(p.hp,hp,'no damage during the warning');
    if(sidestep) {p.x-=Math.sin(beam.angle)*90;p.y+=Math.cos(beam.angle)*90;}
    G.Hazards.update(0.2);
    assert.equal(p.hp<hp,!sidestep);
  }
});

test('Hoopa: Unbound uses installed art and telegraphed falling orbs instead of portals',()=>{
  const t=setup();t.start('hoopa');const e=t.enemies[0],hit=realDamage(t,e);
  hit(e.maxHp*2);assert.equal(e.spriteForm,'0001');assert.equal(e.encounter.formIndex,1);assert.equal(e.hp,e.maxHp);
  e.transformT=0;t.G.StoryEncounters.specialWave(e,0);
  assert.equal(t.hazards.length,7);assert.equal(t.shots.length,0);
  assert.ok(t.hazards.every(h=>h.vis==='hoopaOrb' && h.r>=46 && h.delay>=0.85));
  hit(e.maxHp*2);assert.equal(e.dead,true);
});

test('Regigigas finale: Slow Start, physical charge, and five elements with an open corridor',()=>{
  const t=setup(),a=t.start('regi');t.enemies.forEach(e=>e.dead=true);t.step();
  const e=t.enemies.at(-1),S=t.G.StoryEncounters,p=t.G.Game.player;
  const v=S.move(e,9.9,p,100);assert.ok(Math.hypot(...v.slice(0,2))<=15.01);assert.equal(e.encounter.dash,null);
  S.move(e,0.2,p,100);assert.ok(e.encounter.awakened && e.encounter.dash);
  S.cancelCasts();t.hazards.length=0;S.specialWave(e,0);
  assert.ok(t.shots.length>10 && t.shots.every(p=>p.life<8/3));
  assert.ok(t.hazards.some(h=>h.kind==='zone' && h.delay>=0.8));
  S.specialWave(e,1);a.activeEvadeBossId=e.id;
  const x=e.x,y=e.y;
  for(let i=0;i<24;i++)S.specialMove(e,0.05);
  assert.ok(Math.hypot(e.x-x,e.y-y)>100);
  t.hazards.length=0;S.specialWave(e,2);
  assert.deepEqual(t.hazards.map(h=>h.type),['rock','ice','steel','electric','dragon']);
  load(t.G,'js/systems/hazards.js');
  const r=S.attacks.radius(),dx=Math.cos(e.encounter.facing),dy=Math.sin(e.encounter.facing),step=r/3;
  const gaps=Array.from({length:6},(_,i)=>-r+(i+0.5)*step).filter(offset=>
    t.hazards.every(h=>!t.G.Hazards.inside(h,a.x-dy*offset,a.y+dx*offset,p.r)));
  assert.ok(gaps.length>=1);
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

test('Dialga changes speed without compounding it; Palkia curves projectiles; defeat releases the effects',()=>{
  const t=setup();t.start('creation');const S=t.G.StoryEncounters,p={friendly:true,vx:200,vy:0};
  assert.ok(Math.abs(S.effects(t.G.Game.player).speed-0.72*1.1)<1e-8);
  S.update(0.2);S.updateProjectile(p,0.1);const speed=Math.hypot(p.vx,p.vy);assert.ok(Math.abs(speed-110)<1e-6);assert.notEqual(p.vy,0);
  S.updateProjectile(p,0.1);assert.ok(Math.abs(Math.hypot(p.vx,p.vy)-speed)<1e-6);
  const before=S.effects(t.G.Game.player).speed;S.update(1);assert.notEqual(S.effects(t.G.Game.player).speed,before);
  t.enemies[0].dead=true;t.enemies[1].dead=true;S.updateProjectile(p,0.1);assert.ok(Math.abs(Math.hypot(p.vx,p.vy)-200)<1e-6);assert.equal(S.effects(t.G.Game.player).speed,1);
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

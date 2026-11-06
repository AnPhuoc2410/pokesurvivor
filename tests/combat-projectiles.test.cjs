const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const moves = ['ember', 'muddy-water', 'dragon-darts', 'blue-flare', 'glaciate', 'astral-barrage', 'tera-starstorm'];

for (const id of moves) test(`${id} creates finite projectiles that damage an enemy`, () => {
  const noop = () => {};
  const G = { U: {
    TYPE_COLOR: {}, rand: (a, b) => (a + b) / 2,
    dist: (x, y, a, b) => Math.hypot(x - a, y - b),
    dist2: (x, y, a, b) => (x - a) ** 2 + (y - b) ** 2,
    norm: (x, y) => { const length = Math.hypot(x, y) || 1; return [x / length, y / length]; },
    damp: (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt))
  }, FX: { spark: noop, ring: noop, sp: noop, burst: noop }, Audio: { sfx: noop },
  Camera: { sees: () => true }, VFX: { forMove: () => ({}) }, Coop: { active: false },
  World: { projectileBlock: () => null, propsInCircle: () => [] },
  Types: { mult: () => 1, label: () => null }, Weather: { mult: () => 1 },
  Stats: { taken: () => 1 } };
  for (const file of ['js/data/moves.js', 'js/entities/projectile.js', 'js/entities/enemy.js', 'js/systems/combat.js']) {
    new Function('G', fs.readFileSync(path.join(__dirname, '..', file), 'utf8'))(G);
  }
  const m = G.Moves.instance(id);
  const enemy = { id: 1, x: 80, y: 0, r: 12, hp: 100, dead: false,
    cy() { return this.y; }, hurt(damage) { this.hp -= damage; }, applyBurn: noop, applySlow: noop };
  G.EnemyMgr.all().push(enemy);
  G.EnemyMgr.rebuildGrid();
  const pl = { dead: false, x: 0, y: 0, r: 12, aim: 0, target: enemy,
    cdMul: 1, dmgDealt: 0, atkFor: () => 1, cast: noop, onDealt: noop, activeGroup: () => [m] };
  G.Combat.tick(0.016, pl, 0);
  assert.ok(G.Projectiles.all().length > 0);
  for (const p of G.Projectiles.all()) {
    for (const key of ['r', 'life', 'vx', 'vy', 'dmg']) assert.ok(Number.isFinite(p[key]), `${key} must be finite`);
    assert.ok(p.r > 0 && p.life > 0);
  }
  for (let frame = 1; frame <= 30; frame++) {
    G.Projectiles.update(1 / 60, pl, [enemy]);
    G.Combat.resolve(1 / 60, pl, frame / 60);
  }
  assert.ok(enemy.hp < 100, 'projectiles must reduce enemy HP');
  G.Projectiles.update(10, pl, [enemy]);
  assert.equal(G.Projectiles.all().length, 0, 'projectiles must expire');
});

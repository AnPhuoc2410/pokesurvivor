/* ============ hazards.js — ataques con aviso de los enemigos ============
 * Un peligro se dibuja primero en el suelo como AVISO (se va llenando) y, al
 * cumplirse el tiempo, golpea a quien esté dentro:
 *
 *   zone  círculo (zonas de Tierra/Fuego/Veneno, explosiones, caídas de salto)
 *   beam  rayo recto desde el enemigo (Eléctrico, Psíquico, Dragón, Hielo)
 *
 * Cada ordenador dibuja los peligros y comprueba sólo SU Pokémon. En
 * cooperativo los crea el anfitrión y los manda con 'hz'.
 *
 * Los de Arceus (systems/judgment.js) quitan un % de la vida (pct) sin mirar
 * tipos ni defensa (pure), y la Sentencia cae como un pilar de luz (vis).
 */
G.Hazards = (() => {
  let list = [];

  /** h: { kind, x, y, r | angle, len, w, delay, dmg, type, color, pct?, pure?, vis? } */
  function add(h, fromNet = false) {
    const o = Object.assign({ t: 0, hit: false, end: 0.3 }, h);
      list.push(o);
    if (!fromNet && G.Coop.isHost) {
      G.Coop.broadcast(['hz', { kind: o.kind, x: Math.round(o.x), y: Math.round(o.y), r: o.r, angle: o.angle, len: o.len, w: o.w,
                                delay: o.delay, dmg: Math.round(o.dmg), type: o.type, color: o.color, pct: o.pct, pure: o.pure, vis: o.vis, cat: o.cat,
                                boom: o.boom ? 1 : 0, telegraph: o.telegraph !== false, enc: !!o.enc, end: o.end }]);
    }
    return o;
  }

  function clear() { list = []; }

  function inside(h, x, y, r) {
    if (h.kind === 'zone') return G.U.dist2(x, y, h.x, h.y) < (h.r + r * 0.6) ** 2;
    const ca = Math.cos(h.angle), sa = Math.sin(h.angle);
    const px = x - h.x, py = y - h.y;
    const along = px * ca + py * sa;
    if (along < -r || along > h.len + r) return false;
    return Math.abs(-px * sa + py * ca) <= h.w / 2 + r * 0.6;
  }

  function update(dt) {
    const pl = G.Game.player;
    for (let i = list.length - 1; i >= 0; i--) {
      const h = list[i];
      h.t += dt;
      if (!h.hit && h.t >= h.delay) {
        h.hit = true;
        detonate(h);
        // (Humedad: la explosión de un kamikaze no le daña, ver data/ability-fx.js.)
        if (pl && !pl.dead && inside(h, pl.x, pl.y, pl.r) && !(h.boom && pl.abil && pl.abil.damp)) {
          pl.invuln = 0;
          pl.hurt(h.pct ? Math.max(h.dmg, pl.maxHp * h.pct) : h.dmg, h.type, !!h.pure, h.cat);
        }
      }
      if (h.hit && h.t >= h.delay + h.end) list.splice(i, 1);
    }
  }

  function detonate(h) {
    const near = G.Camera.sees(h.x, h.y, 120);
    if (h.vis === 'pillar') {
      // Pilar de luz que cae del cielo.
      G.FX.beam(h.x, h.y, -Math.PI / 2, 420, h.r * 1.1, h.color, G.VFX.forType('electric'));
      G.FX.ring(h.x, h.y, 4, h.r * 1.3, '#fff3c8', 0.4, 5);
      G.FX.burst(h.x, h.y - 6, h.color, 10, 180);
      if (near) { G.Audio.sfx('judge'); G.Camera.kick(0.2); }
    } else if (h.kind === 'zone') {
      G.FX.ring(h.x, h.y, 4, h.r, h.color, 0.35, 5);
      G.FX.burst(h.x, h.y - 6, h.color, Math.round(h.r / 3), 160);
      if (h.enc) {
        G.FX.ring(h.x, h.y, h.r * 0.25, h.r, '#e5fbff', 0.65, 7);
        G.FX.sp('impact', G.VFX.forType(h.type).pal, h.x, h.y - 18, {life:0.55,scale:3});
        for (let i=0;i<6;i++) {
          const a=i*Math.PI/3;
          G.FX.px(h.x+Math.cos(a)*h.r*0.5,h.y+Math.sin(a)*h.r*0.5,h.color,{vy:-95,grav:120,life:0.8,size:3});
        }
      }
      if (near) { G.Audio.sfx('break'); if (h.r > 60) G.Camera.kick(0.35); }
    } else {
      const visual = G.VFX.forType(h.type || (h.pure ? 'electric' : 'normal'));
      if (h.enc) visual.life = 0.45;
      G.FX.beam(h.x, h.y - G.LIFT, h.angle, h.len, h.w, h.color, visual);
      if (h.vis === 'hoopaBeam') G.FX.ring(h.x,h.y,18,42,'#ffd760',0.25,6);
      if (near) G.Audio.sfx('shot', { kind: 'beam', type: h.type });
    }
  }

  /** Avisos en el suelo (debajo de los Pokémon). */
  function draw(ctx) {
    const blink = Math.sin(performance.now() / 60) > 0;
    for (const h of list) {
      if (h.hit || h.telegraph === false) continue;
      const k = Math.min(1, h.t / h.delay);
      ctx.save();
      if (h.kind === 'zone') {
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = h.color;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.75, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 0.32;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * k, h.r * 0.75 * k, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = k > 0.75 && blink ? 0.95 : 0.6;
        ctx.strokeStyle = h.color; ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.75, 0, 0, 6.2832); ctx.stroke();
        if (h.vis === 'teraCrystal') {
          const crystalY=h.y-170*(1-k*k),size=h.r*0.65;
          ctx.setLineDash([]);ctx.globalAlpha=0.9;ctx.fillStyle=h.color;ctx.strokeStyle='#f5fcff';ctx.lineWidth=3;
          ctx.beginPath();ctx.moveTo(h.x,crystalY-size);ctx.lineTo(h.x+size*0.6,crystalY);
          ctx.lineTo(h.x,crystalY+size);ctx.lineTo(h.x-size*0.6,crystalY);ctx.closePath();ctx.fill();ctx.stroke();
          ctx.beginPath();ctx.moveTo(h.x,crystalY-size);ctx.lineTo(h.x,crystalY+size);ctx.stroke();
        }
        if (h.vis === 'hoopaOrb') {
          const height = 200 * (1 - k * k), orbY = h.y - height;
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.85; ctx.strokeStyle = '#ffd760'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.ellipse(h.x,h.y-200,h.r*0.8,h.r*0.25,0,0,6.2832); ctx.stroke();
          ctx.fillStyle = '#7135a7'; ctx.strokeStyle = '#edb6ff'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(h.x,orbY,h.r*0.7,0,6.2832); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = '#ffd760'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(h.x,orbY,h.r*0.85,h.r*0.28,k*4,0,6.2832); ctx.stroke();
        }
      } else {
        ctx.translate(h.x, h.y);
        ctx.rotate(h.angle);
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = h.color;
        ctx.fillRect(0, -h.w / 2, h.len, h.w);
        ctx.globalAlpha = 0.34;
        ctx.fillRect(0, -h.w / 2 * k, h.len, h.w * k);
        ctx.globalAlpha = k > 0.75 && blink ? 0.95 : 0.55;
        ctx.strokeStyle = h.color; ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(0, -h.w / 2, h.len, h.w);
      }
      ctx.restore();
    }
  }

  return { add, clear, update, draw, inside, get all() { return list; }, get count() { return list.length; } };
})();

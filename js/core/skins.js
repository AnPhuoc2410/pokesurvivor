/* ============ skins.js — sombrero y capa de bruja (Halloween 2026) ============
 * Una skin es un disfraz que se dibuja encima del sprite de Mundo Misterioso:
 * sombrero de bruja en la cabeza y capa en la espalda. Se colocan con la
 * cabeza y el centro del cuerpo de cada fotograma y dirección (G.SKIN_POS,
 * sacados de los -Offsets.png de SpriteCollab: tools/fetch_skin_pos.py), así
 * que siguen al Pokémon en todas sus animaciones.
 *
 *   Animator.skin = id    (core/sprites.js lo dibuja en draw())
 *   SKINS[id]             las que se compran con caramelos en la Tienda Kecleon
 *   'hat'                 sólo el sombrero (Kecleon, en la tienda esos días)
 *
 * Se guardan en la partida: save.skins { id: fecha } (compradas, para siempre)
 * y save.pskin { dex: [id, fecha] } (la que lleva puesta cada Pokémon; '' = ninguna).
 */
G.Skins = (() => {
  const K = '#1b1528';            // contorno (el de los iconos)
  const PUR = '#3d2266', PUR_L = '#6a40a8', PUR_D = '#26133f';
  const ORA = '#ff8a2a', ORA_D = '#c45a12', YEL = '#ffd23f';

  // Sombrero de bruja, en dos tamaños (el ancla es el centro de abajo del ala).
  const HAT_BIG = ['........kk.....', '.......kpk.....', '......kplk.....', '......kpplk....', '.....kppplk....',
                   '.....kpppplk...', '....kppppplk...', '....koooyook...', '.kkkpppppppkkk.', 'kpppppppppppplk', '.kkkkkkkkkkkkk.'];
  const HAT_SMALL = ['.....kk....', '....kpk....', '....kplk...', '...kpplk...', '...kppplk..',
                     '..kooyook..', 'kkpppppppkk', '.kkkkkkkkk.'];
  const PAL = { k: K, p: PUR, l: PUR_L, o: ORA, y: YEL };

  /*
   * hat    'big' | 'small' · lift: cuánto por encima del punto de la cabeza va el ala
   * cape   w/W ancho arriba/abajo, h alto, up: cuánto por encima del centro del cuerpo empieza
   * (Ajustado a ojo con capturas, 25-10-2026.)
   */
  const SKINS = {
    'bruja-gengar':  { dex: 94,  name: 'Gengar bruja',  hat: 'big',   lift: 5, cape: { w: 12, W: 19, h: 14, up: 5 } },
    'bruja-pikachu': { dex: 25,  name: 'Pikachu bruja', hat: 'small', lift: 4, cape: { w: 8,  W: 14, h: 11, up: 3 } },
    'bruja-umbreon': { dex: 197, name: 'Umbreon bruja', hat: 'small', lift: 4, cape: { w: 9,  W: 14, h: 9,  up: 4 } }
  };
  const HAT_ONLY = { hat: 'small', lift: 4, cape: null };
  const LIST = Object.keys(SKINS);

  // ---------------- dibujos (a 1 píxel de arte por píxel; se escalan al pintar) ----------------

  const cache = new Map();
  function canvasOf(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function fromRows(rows, flip) {
    const k = 'r:' + rows[0] + flip;
    if (cache.has(k)) return cache.get(k);
    const w = rows[0].length, h = rows.length, c = canvasOf(w, h), x = c.getContext('2d');
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const ch = rows[j][flip ? w - 1 - i : i];
      if (ch === '.') continue;
      x.fillStyle = PAL[ch]; x.fillRect(i, j, 1, 1);
    }
    cache.set(k, c);
    return c;
  }

  /*
   * La capa: un trapecio con el bajo en picos. Vista de frente (detrás del
   * Pokémon) se ve el forro naranja con el borde morado; de espaldas (delante)
   * el morado con un cuello naranja; de lado, morada y estrecha.
   */
  function cape(c, view, wave) {
    const W = view === 'side' ? Math.round(c.W * 0.7) : c.W, w = view === 'side' ? Math.round(c.w * 0.7) : c.w, h = c.h;
    const k = `c:${w}:${W}:${h}:${view}:${wave}`;
    if (cache.has(k)) return cache.get(k);
    const cv = canvasOf(W + 2, h + 2), x = cv.getContext('2d');
    const half = y => (w + (W - w) * (y / (h - 1))) / 2;
    const cx = (W + 2) / 2;
    for (let y = 0; y < h; y++) {
      // El bajo: picos que se mueven un poco al andar (wave).
      const hw = half(y), l = Math.round(cx - hw), r = Math.round(cx + hw);
      for (let i = l; i < r; i++) {
        const tooth = (i + wave) % 4;
        if (y >= h - 2 && (y === h - 1 ? tooth !== 1 : tooth === 3)) continue;
        const edge = i === l || i === r - 1 || y === 0;
        let col;
        if (view === 'front') col = edge ? PUR : ((i - l) % 5 === 2 ? ORA_D : ORA);
        else if (view === 'back') col = y < 2 ? (edge ? ORA_D : ORA) : edge ? PUR_D : ((i - l) % 4 === 1 ? PUR_L : PUR);
        else col = edge ? PUR_D : (y % 5 === 2 ? PUR_L : PUR);
        x.fillStyle = col; x.fillRect(i, y + 1, 1, 1);
      }
    }
    // Contorno de 1 píxel alrededor de lo pintado.
    const img = x.getImageData(0, 0, cv.width, cv.height), d = img.data, out = x.createImageData(cv.width, cv.height);
    out.data.set(d);
    const on = (i, j) => i >= 0 && j >= 0 && i < cv.width && j < cv.height && d[(j * cv.width + i) * 4 + 3] > 0;
    for (let j = 0; j < cv.height; j++) for (let i = 0; i < cv.width; i++) {
      if (on(i, j)) continue;
      if (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1)) {
        const o = (j * cv.width + i) * 4; out.data[o] = 0x1b; out.data[o + 1] = 0x15; out.data[o + 2] = 0x28; out.data[o + 3] = 255;
      }
    }
    x.putImageData(out, 0, 0);
    cache.set(k, cv);
    return cv;
  }

  // ---------------- dónde va ----------------

  /** Filas: 0 abajo · 1 abajo-der · 2 der · 3 arriba-der · 4 arriba · 5 arriba-izq · 6 izq · 7 abajo-izq */
  const BACK = new Set([3, 4, 5]), SIDE = new Set([2, 6]), LEFT = new Set([5, 6, 7]);
  function pos(dex, anim, row, frame) {
    const a = G.SKIN_POS && G.SKIN_POS[dex];
    const r = a && (a[anim] || a.Idle);
    const fr = r && (r[Math.min(row, r.length - 1)] || r[0]);
    return fr ? fr[Math.min(frame, fr.length - 1)] || fr[0] : null;
  }

  /** La skin de un id (o el sombrero solo); null si no hay o no es de ese Pokémon. */
  function get(id, dex) {
    if (id === 'hat') return HAT_ONLY;
    const s = SKINS[id];
    return s && s.dex === dex ? s : null;
  }

  /*
   * Pinta lo de detrás (back = true, antes del sprite) o lo de delante.
   * (x, y) los pies del sprite, k su escala (PX * scale).
   */
  function draw(ctx, sk, dex, anim, row, frame, x, y, k, behind, alpha = 1) {
    const p = pos(dex, anim, row, frame);
    if (!p) return;
    const back = BACK.has(row), side = SIDE.has(row), left = LEFT.has(row);
    const prevA = ctx.globalAlpha, prevS = ctx.imageSmoothingEnabled;
    if (alpha < 1) ctx.globalAlpha = prevA * alpha;
    ctx.imageSmoothingEnabled = false;
    if (sk.cape && behind === !back) {
      const view = back ? 'back' : side ? 'side' : 'front';
      const wave = anim === 'Walk' ? Math.floor(performance.now() / 160) % 4 : 0;
      const c = cape(sk.cape, view, wave);
      // De lado, la capa va hacia atrás (al contrario de donde mira).
      const off = side ? (left ? 2 : -2) : 0;
      const cx = x + (p[2] + off) * k, top = y + (p[3] - sk.cape.up) * k;
      // Detrás del Pokémon no asoma por debajo de los pies (se vería el forro en el suelo).
      const cut = !back && !side;
      if (cut) { ctx.save(); ctx.beginPath(); ctx.rect(x - 400 * k, y - 400 * k, 800 * k, 400 * k - 2 * k); ctx.clip(); }
      ctx.drawImage(c, Math.round(cx - c.width * k / 2), Math.round(top - k), c.width * k, c.height * k);
      if (cut) ctx.restore();
    }
    if (!behind) {
      const h = fromRows(sk.hat === 'big' ? HAT_BIG : HAT_SMALL, left);
      const hw = h.width * k, hh = h.height * k;
      ctx.drawImage(h, Math.round(x + p[0] * k - hw / 2), Math.round(y + (p[1] - sk.lift) * k - hh), hw, hh);
    }
    ctx.globalAlpha = prevA;
    ctx.imageSmoothingEnabled = prevS;
  }

  // ---------------- en la partida guardada ----------------

  const owns = (s, id) => !!(s && s.skins && s.skins[id]);
  /** La skin que lleva puesta un Pokémon ('' si ninguna o si no es suya). */
  function worn(s, dex) {
    const e = s && s.pskin && s.pskin[dex];
    const id = e && e[0];
    return id && SKINS[id] && SKINS[id].dex === +dex && owns(s, id) ? id : '';
  }
  function wear(s, dex, id) {
    s.pskin = s.pskin || {};
    s.pskin[dex] = [id || '', Date.now()];
  }

  return { SKINS, LIST, get, draw, owns, worn, wear, pos };
})();

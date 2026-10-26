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
   * hat    'big' | 'small' · sink: cuánto se hunde el ala por debajo de la coronilla
   * cape   w/W ancho arriba/abajo, h alto, up: cuánto por encima del centro del cuerpo empieza,
   *        fw: ancho por abajo vista de frente (detrás del Pokémon: asoma por los lados)
   * clasp  dónde va el broche de la capa, de frente: píxeles por debajo de la cara
   * (Ajustado a ojo con capturas, 26-10-2026.)
   */
  const SKINS = {
    'bruja-gengar':  { dex: 94,  name: 'Gengar bruja',  hat: 'big',   sink: 2, clasp: 4, cape: { w: 10, W: 24, fw: 38, h: 15, up: 8 } },
    'bruja-pikachu': { dex: 25,  name: 'Pikachu bruja', hat: 'small', sink: 1, clasp: 3, cape: { w: 7,  W: 15, fw: 21, h: 11, up: 5 } },
    'bruja-umbreon': { dex: 197, name: 'Umbreon bruja', hat: 'small', sink: 1, clasp: 3, cape: { w: 8,  W: 15, fw: 19, h: 9,  up: 4 } }
  };
  const HAT_ONLY = { hat: 'small', sink: 1, cape: null };
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
    const W = view === 'side' ? Math.round(c.W * 0.7) : view === 'front' ? c.fw : c.W, w = view === 'side' ? Math.round(c.w * 0.7) : c.w, h = c.h;
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
        if (view === 'front' || view === 'diag') col = edge ? PUR : ((i - l) % 5 === 2 ? ORA_D : ORA);
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
  const FACE_X = [0, 1, 1, 1, 0, -1, -1, -1];          // hacia dónde mira (en x)
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

  /** Broche de la capa (de frente): dos lazos morados y una piedra naranja. */
  const CLASP = ['kk...kk', 'kpkkkpk', 'kpoyopk', 'kpkkkpk', 'kk...kk'];

  /*
   * Pinta lo de detrás (behind = true, antes del sprite) o lo de delante.
   * (x, y) los pies del sprite, k su escala (PX * scale).
   *
   * La capa, según hacia dónde mira:
   *   de espaldas (y en diagonal hacia arriba)  delante, tapando la espalda
   *   de lado                                   delante, sólo por la mitad de atrás
   *   de frente y en diagonal hacia abajo       detrás, más ancha para que asome por
   *                                             los lados (y hacia atrás en diagonal),
   *                                             con el broche bajo la cara
   */
  function draw(ctx, sk, dex, anim, row, frame, x, y, k, behind, alpha = 1) {
    const p = pos(dex, anim, row, frame);
    if (!p) return;
    const back = BACK.has(row), side = SIDE.has(row), fx = FACE_X[row] || 0;
    const prevA = ctx.globalAlpha, prevS = ctx.imageSmoothingEnabled;
    if (alpha < 1) ctx.globalAlpha = prevA * alpha;
    ctx.imageSmoothingEnabled = false;
    const c = sk.cape;
    if (c && behind === !(back || side)) {
      const view = back ? 'back' : side ? 'side' : fx ? 'diag' : 'front';
      const wave = anim === 'Walk' ? Math.floor(performance.now() / 160) % 4 : 0;
      const img = cape(c, view, wave);
      // Hacia atrás (al contrario de donde mira): de lado, casi entera detrás del cuerpo.
      const off = -fx * (side ? img.width * 0.32 : back ? 1 : img.width * 0.2);
      const cx = x + (p[2] + off) * k, top = y + (p[3] - c.up) * k;
      // Detrás del Pokémon no asoma por debajo de los pies (se vería el forro en el suelo).
      const cut = view === 'front' || view === 'diag';
      if (cut) { ctx.save(); ctx.beginPath(); ctx.rect(x - 400 * k, y - 400 * k, 800 * k, 400 * k - 2 * k); ctx.clip(); }
      ctx.drawImage(img, Math.round(cx - img.width * k / 2), Math.round(top - k), img.width * k, img.height * k);
      if (cut) ctx.restore();
    }
    if (!behind) {
      if (c && sk.clasp && !back && !side && p.length > 4) {
        const b = fromRows(CLASP, false);
        ctx.drawImage(b, Math.round(x + p[4] * k - b.width * k / 2), Math.round(y + (p[5] + sk.clasp) * k - b.height * k / 2), b.width * k, b.height * k);
      }
      const h = fromRows(sk.hat === 'big' ? HAT_BIG : HAT_SMALL, LEFT.has(row));
      const hw = h.width * k, hh = h.height * k;
      ctx.drawImage(h, Math.round(x + p[0] * k - hw / 2), Math.round(y + (p[1] + sk.sink) * k - hh), hw, hh);
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

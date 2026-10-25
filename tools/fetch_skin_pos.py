"""
fetch_skin_pos.py — dónde está la cabeza y el cuerpo de un Pokémon en cada fotograma.

Para las skins (sombrero y capa de bruja, Halloween 2026): SpriteCollab trae,
junto a cada animación, un -Offsets.png con cuatro puntos por fotograma:
  negro = cabeza · verde = centro del cuerpo · rojo / azul = manos
(comprobado el 25-10-2026: el negro va arriba y se adelanta hacia donde mira).

Genera js/data/skin-pos.js:
  G.SKIN_POS[dex][anim] = [fila][fotograma] -> [hx, hy, bx, by]
en píxeles de arte, relativos al ancla al suelo de esa animación (ax, ay de
sprites-meta.js), así que se dibujan igual que el sprite.

Uso: python tools/fetch_skin_pos.py            (los Pokémon de DEXES)
"""
import io
import json
import os
import re
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_sprites import BASE, WANT, FALLBACK, fetch, parse_animdata, resolve  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'js', 'data', 'skin-pos.js')
META = os.path.join(ROOT, 'js', 'data', 'sprites-meta.js')

# Pikachu, Gengar y Umbreon (las skins) y Kecleon (su gorro en la tienda).
DEXES = [25, 94, 197, 352]
HEAD, BODY = (0, 0, 0), (0, 255, 0)


def game_meta():
    """El ancla al suelo de cada animación, la que usa el juego."""
    src = open(META, encoding='utf8').read()
    out = {}
    for dex in DEXES:
        m = re.search(r'\n  %d: (\{.*\}),?\n' % dex, src)
        out[dex] = json.loads(m.group(1))['a']
    return out


def points(png, w, h, rows, n):
    im = Image.open(io.BytesIO(png)).convert('RGBA')
    px = im.load()
    W, H = im.size
    out = []
    for r in range(rows):
        row = []
        for f in range(n):
            head = body = None
            for y in range(r * h, min(H, r * h + h)):
                for x in range(f * w, min(W, f * w + w)):
                    p = px[x, y]
                    if p[3] < 200:
                        continue
                    if p[:3] == HEAD:
                        head = (x - f * w, y - r * h)
                    elif p[:3] == BODY:
                        body = (x - f * w, y - r * h)
            row.append((head, body))
        out.append(row)
    return out


def main():
    gm = game_meta()
    res = {}
    for dex in DEXES:
        tag = str(dex).zfill(4)
        xml = fetch(f'{BASE}/{tag}/AnimData.xml')
        if not xml:
            print('sin AnimData:', dex)
            continue
        anims, _ = parse_animdata(xml.decode('utf8'))
        res[dex] = {}
        for want in WANT:
            if want not in gm[dex]:
                continue
            g = gm[dex][want]
            src = geom = None
            for cand in [want] + FALLBACK[want]:
                src, geom = resolve(anims, cand)
                if geom:
                    break
            png = geom and fetch(f'{BASE}/{tag}/{src}-Offsets.png')
            if not png:
                print('  sin Offsets:', dex, want)
                continue
            pts = points(png, g['w'], g['h'], g['r'], g['n'])
            rows = []
            for row in pts:
                frames = []
                last = None
                for head, body in row:
                    head = head or (last and last[0]) or (g['ax'], g['ay'] - g['h'] * 0.5)
                    body = body or (last and last[1]) or head
                    last = (head, body)
                    # Relativo al ancla al suelo (como el sprite); el +0.5 centra el píxel.
                    frames.append([round(head[0] + 0.5 - g['ax'], 1), round(head[1] + 0.5 - g['ay'], 1),
                                   round(body[0] + 0.5 - g['ax'], 1), round(body[1] + 0.5 - g['ay'], 1)])
                rows.append(frames)
            res[dex][want] = rows
        print(dex, ', '.join(res[dex]))
    with open(OUT, 'w', encoding='utf8', newline='\n') as f:
        f.write('/* ============ skin-pos.js — GENERADO, no editar a mano ============\n'
                ' * Lo produce tools/fetch_skin_pos.py a partir de los -Offsets.png de\n'
                ' * SpriteCollab: cabeza y centro del cuerpo de cada fotograma, para\n'
                ' * colocar el sombrero y la capa de las skins (core/skins.js).\n'
                ' *   G.SKIN_POS[dex][anim][fila][fotograma] = [hx, hy, bx, by]\n'
                ' * en píxeles de arte, relativos al ancla al suelo de la animación.\n'
                ' */\n')
        f.write('G.SKIN_POS = ' + json.dumps(res, separators=(',', ':')) + ';\n')
    print('->', os.path.relpath(OUT, ROOT), os.path.getsize(OUT), 'bytes')


if __name__ == '__main__':
    main()

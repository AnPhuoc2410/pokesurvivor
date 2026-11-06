#!/usr/bin/env python3
"""Fetch explicitly selected story-boss forms without replacing base sprites."""
import json
import os
import re
import sys
import urllib.request

from PIL import Image, ImageSequence

import fetch_sprites as sprites


FORMS = {382: ['0001'], 383: ['0001'], 384: ['0001'],
         718: ['0001', '0002'], 720: ['0001'],
         1024: ['0001', '0002'],
         555: ['0001'], 746: ['0001'], 800: ['0003'],
         386: ['0001', '0002', '0003'],
         479: ['0001', '0002', '0003', '0005'], 648: ['0001']}


def stellar_form():
    """Import the Showdown animation unchanged into the engine's one-row sheet format."""
    url = 'https://play.pokemonshowdown.com/sprites/gen5ani/terapagos-stellar.gif'
    cache = os.path.join(sprites.CACHE, 'terapagos-stellar.gif')
    if not os.path.exists(cache):
        os.makedirs(sprites.CACHE, exist_ok=True)
        request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://play.pokemonshowdown.com/'})
        with urllib.request.urlopen(request, timeout=60) as response, open(cache, 'wb') as file:
            file.write(response.read())
    with Image.open(cache) as animation:
        durations, frames = [], []
        for frame in ImageSequence.Iterator(animation):
            durations.append(max(1, round(frame.info.get('duration', 100) * 60 / 1000)))
            frames.append(frame.convert('RGBA'))
    width, height = frames[0].size
    sheet = Image.new('RGBA', (width * len(frames), height))
    for index, frame in enumerate(frames):
        sheet.paste(frame, (index * width, 0))
    out_dir = os.path.join(sprites.OUT_ASSETS, '1024', 'f-0002')
    os.makedirs(out_dir, exist_ok=True)
    for name in sprites.WANT:
        sheet.save(os.path.join(out_dir, name + '.png'))
    meta = {'w': width, 'h': height, 'n': len(frames), 'r': 1, 'd': durations,
            'ax': width / 2, 'ay': max(frame.getbbox()[3] for frame in frames) - 1}
    return {'s': 2, 'a': {name: dict(meta) for name in sprites.WANT}}


def main():
    metas = {}
    selected = {int(arg) for arg in sys.argv[1:]} or set(FORMS)
    for dex in sorted(selected):
        for form in FORMS[dex]:
            if (dex, form) == (1024, '0002'):
                metas.setdefault(dex, {})[form] = stellar_form()
                print('Imported 1024/0002: Showdown Stellar animation', flush=True)
                continue
            base = f'{sprites.BASE}/{dex:04d}/{form}'
            xml = sprites.fetch(f'{base}/AnimData.xml')
            if not xml:
                raise RuntimeError(f'Missing subgroup {form}: {dex}')
            anims, shadow = sprites.parse_animdata(xml.decode('utf-8', 'replace'))
            out_dir = os.path.join(sprites.OUT_ASSETS, str(dex), f'f-{form}')
            meta = sprites.download_set(base, out_dir, anims)
            if not {'Idle', 'Walk', 'Attack'} <= set(meta):
                raise RuntimeError(f'Incomplete required animations: {dex}/{form}')
            metas.setdefault(dex, {})[form] = {'s': shadow, 'a': meta}
            print(f'Fetched {dex}/{form}: {", ".join(meta)}', flush=True)

    if not metas:
        raise SystemExit('No form sprites downloaded.')

    with open(sprites.OUT_META, encoding='utf-8') as file:
        content = file.read()
    for match in list(re.finditer(r'^\s*(\d+):\s*(\{.*\}),\s*$', content, re.MULTILINE))[::-1]:
        dex = int(match.group(1))
        if dex not in metas:
            continue
        value = json.loads(match.group(2))
        value.setdefault('f', {}).update(metas[dex])
        content = content[:match.start(2)] + json.dumps(value, separators=(',', ':')) + content[match.end(2):]
    with open(sprites.OUT_META, 'w', encoding='utf-8', newline='\n') as file:
        file.write(content)


if __name__ == '__main__':
    main()

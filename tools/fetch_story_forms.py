#!/usr/bin/env python3
"""Fetch explicitly selected story-boss forms without replacing base sprites."""
import json
import os
import re
import sys

import fetch_sprites as sprites


FORMS = {382: ['0001'], 383: ['0001'], 384: ['0001'],
         555: ['0001'], 746: ['0001'], 800: ['0003'],
         386: ['0001', '0002', '0003'],
         479: ['0001', '0002', '0003', '0005'], 648: ['0001']}


def main():
    metas = {}
    selected = {int(arg) for arg in sys.argv[1:]} or set(FORMS)
    for dex in sorted(selected):
        for form in FORMS[dex]:
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

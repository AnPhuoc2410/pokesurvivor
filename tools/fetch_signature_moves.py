import urllib.request
import json
import os
import sys

DEFAULT_MOVES = [
    'electro-drift', 'collision-course', 'psystrike', 'dragon-ascent',
    'origin-pulse', 'precipice-blades', 'judgment', 'aeroblast',
    'sacred-fire', 'roar-of-time', 'spacial-rend', 'shadow-force'
]

moves = sys.argv[1:] if len(sys.argv) > 1 else DEFAULT_MOVES

results = {}
for m in moves:
    url = f'https://pokeapi.co/api/v2/move/{m}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'pokesurvivor/1.0'})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode('utf-8'))
        
        name_es = next((n['name'] for n in data['names'] if n['language']['name'] == 'es'), data['name'])
        name_en = next((n['name'] for n in data['names'] if n['language']['name'] == 'en'), data['name'])
        desc_es = next((f['flavor_text'] for f in data['flavor_text_entries'] if f['language']['name'] == 'es'), '')
        desc_en = next((f['flavor_text'] for f in data['flavor_text_entries'] if f['language']['name'] == 'en'), '')
        
        results[m] = {
            'name_es': name_es,
            'name_en': name_en,
            'type': data['type']['name'],
            'power': data.get('power'),
            'damage_class': data['damage_class']['name'],
            'accuracy': data.get('accuracy'),
            'pp': data.get('pp'),
            'desc_es': desc_es.replace('\n', ' ').strip(),
            'desc_en': desc_en.replace('\n', ' ').strip()
        }
        print(f"Fetched {m}: {name_en} ({name_es}) - {data['type']['name']} {data.get('power')} BP ({data['damage_class']['name']})")
    except Exception as e:
        print(f"Error fetching {m}: {e}")

out_path = os.path.join(os.path.dirname(__file__), 'signature_moves.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print(f"Saved {len(results)} moves to {out_path}")

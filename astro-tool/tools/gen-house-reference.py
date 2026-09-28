# -*- coding: utf-8 -*-
"""用瑞士星历表生成宫位制基准数据（同一个 ARMC + 交角，隔离宫位算法本身）"""
import json, os, swisseph as swe

ROOT = r'C:\Users\whlqb\Documents\ChatGPT\工作\astro-tool'
OUT = os.path.join(ROOT, 'tests', 'fixtures')
EPS = 23.4392911

lats = [-60, -45, -23.5, 0, 23.5, 40, 51.5, 60]
armcs = list(range(0, 360, 30))
systems = {
    'placidus': b'P', 'koch': b'K', 'porphyry': b'O', 'regiomontanus': b'R',
    'campanus': b'C', 'equal': b'A', 'equal-mc': b'E', 'vehlow': b'V',
    'whole': b'W', 'alcabitius': b'B', 'meridian': b'X', 'topocentric': b'T',
    'morinus': b'M', 'horizontal': b'H', 'krusinski': b'U'
}

result = {}
for name, code in systems.items():
    cases = []
    for lat in lats:
        for armc in armcs:
            try:
                cusps, ascmc = swe.houses_armc(float(armc), float(lat), EPS, code)
                cases.append({
                    'lat': lat, 'armc': armc,
                    'cusps': [round(c, 6) for c in cusps[0:12]],
                    'asc': round(ascmc[0], 6), 'mc': round(ascmc[1], 6)
                })
            except Exception as e:
                pass
    result[name] = cases
    print('%-14s 用例 %3d' % (name, len(cases)))

with open(os.path.join(OUT, 'houses-reference.json'), 'w', encoding='utf-8') as f:
    json.dump({'eps': EPS, 'systems': result}, f, ensure_ascii=False)
print('已生成 tests/fixtures/houses-reference.json')
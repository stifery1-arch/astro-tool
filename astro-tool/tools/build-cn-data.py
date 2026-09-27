# -*- coding: utf-8 -*-
"""
build-cn-data.py —— 把 AreaCity 省市区三级数据编译成占星工具用的紧凑数据文件
输入：tools/ok_data_level3.csv（名称+拼音）、tools/ok_geo.csv（名称+ext_path+经纬度+边界）
输出：js/data-cn.js

原始数据下载（免费开源，仓库不附带 160MB 源文件）：
  1) 名称+拼音：https://raw.githubusercontent.com/xiangyuecn/AreaCity-JsSpider-StatsGov/master/src/采集到的数据/ok_data_level3.csv
  2) 坐标+边界：https://github.com/xiangyuecn/AreaCity-JsSpider-StatsGov/releases  →  ok_geo.csv.7z（用 py7zr 或 7-Zip 解压）
  下载后放到本目录（tools/），再运行：python tools/build-cn-data.py

数据来源：https://github.com/xiangyuecn/AreaCity-JsSpider-StatsGov （免费开源的省市区坐标边界数据）
"""
import csv, io, json, os, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools')
OUT = os.path.join(ROOT, 'js', 'data-cn.js')
VERSION = '2025.251231.260403'

csv.field_size_limit(10 * 1024 * 1024)

def load_pinyin(path):
    """id -> (pinyin, pinyin_prefix)"""
    m = {}
    with io.open(path, 'r', encoding='utf-8-sig', newline='') as f:
        for row in csv.DictReader(f):
            m[row['id']] = (row.get('pinyin', '') or '', row.get('pinyin_prefix', '') or '')
    return m

def clean(s):
    return (s or '').strip()

def main():
    t0 = time.time()
    pin = load_pinyin(os.path.join(SRC, 'ok_data_level3.csv'))
    print('拼音表: %d 条' % len(pin))

    nodes = {}
    order = []
    with io.open(os.path.join(SRC, 'ok_geo.csv'), 'r', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            nid = clean(row['id'])
            deep = int(clean(row['deep']) or 0)
            geo = clean(row['geo']).split()
            if len(geo) < 2:
                continue
            try:
                lng = round(float(geo[0]), 4)
                lat = round(float(geo[1]), 4)
            except ValueError:
                continue
            p = pin.get(nid, ('', ''))
            nodes[nid] = {
                'id': nid, 'pid': clean(row['pid']), 'deep': deep,
                'name': clean(row['name']), 'path': clean(row['ext_path']),
                'lng': lng, 'lat': lat, 'py': p[0], 'pyf': p[1], 'children': []
            }
            order.append(nid)
    print('坐标表: %d 条  (%.1fs)' % (len(nodes), time.time() - t0))

    # 组树
    roots = []
    for nid in order:
        n = nodes[nid]
        pid = n['pid']
        if pid in nodes and pid != nid:
            nodes[pid]['children'].append(n)
        else:
            roots.append(n)

    # 港澳台时区特殊处理
    def tz_of(prov):
        if '香港' in prov: return 'Asia/Hong_Kong'
        if '澳门' in prov: return 'Asia/Macau'
        if '台湾' in prov: return 'Asia/Taipei'
        return 'Asia/Shanghai'

    def arr(n, level, prov_name):
        """[名称, 拼音, 首字母, 经度, 纬度, 时区?] 省/市/区县 统一结构，children 用第 6 项（或第 6 项后）"""
        py = n['py'].replace(' ', '')          # bei jing -> beijing
        # 首字母缩写：按音节取首字母（bei jing -> bj），支持 hz / sh / nmg 这类输入
        pyf = ''.join([w[0] for w in n['py'].split() if w]) or n['pyf']
        tz = tz_of(prov_name)
        kids = n['children']
        base = [n['name'], py, pyf, n['lng'], n['lat']]
        if kids:
            return base + [tz, [arr(k, level + 1, prov_name) for k in kids]]
        return base + [tz]

    def init_of(n):
        return ''.join([w[0] for w in n['py'].split() if w]) or n['pyf']

    provinces = []
    for r in roots:
        name = r['name']
        kids = [arr(c, 1, name) for c in r['children']]
        provinces.append([name, r['py'].replace(' ', ''), init_of(r), r['lng'], r['lat'], tz_of(name), kids])

    # 统计
    n_prov = len(provinces)
    n_city = sum(len(p[6]) for p in provinces)
    n_dist = 0
    for p in provinces:
        for c in p[6]:
            if len(c) > 6 and isinstance(c[6], list):
                n_dist += len(c[6])
    print('省 %d / 市 %d / 区县 %d' % (n_prov, n_city, n_dist))

    js = []
    js.append('/*!')
    js.append(' * data-cn.js —— 中国省市区三级数据（名称 + 拼音 + 中心经纬度）')
    js.append(' * 数据版本：%s（AreaCity-JsSpider-StatsGov，免费开源）' % VERSION)
    js.append(' * 结构：[省名, 拼音, 首字母, 经度, 纬度, 时区, [市...]]；市/区县为 [名, 拼音, 首字母, 经度, 纬度, 时区(/[区县...])]')
    js.append(' * 由 tools/build-cn-data.py 自动生成，请勿手工编辑。')
    js.append(' */')
    js.append('(function (root, factory) {')
    js.append("  if (typeof module === 'object' && module.exports) { module.exports = factory(); }")
    js.append("  else { root.AstroDataCN = factory(); }")
    js.append("})(typeof self !== 'undefined' ? self : this, function () {")
    js.append("  'use strict';")
    js.append('  var VERSION = %s;' % json.dumps(VERSION))
    js.append('  var PROVINCES = [')
    lines = []
    for p in provinces:
        lines.append('    ' + json.dumps(p, ensure_ascii=False, separators=(',', ':')))
    js.append(',\n'.join(lines))
    js.append('  ];')
    js.append('  return { version: VERSION, provinces: PROVINCES };')
    js.append('});')
    out = '\n'.join(js) + '\n'
    with io.open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(out)
    print('输出: %s  (%.0f KB)' % (OUT, len(out.encode('utf-8')) / 1024))

if __name__ == '__main__':
    main()
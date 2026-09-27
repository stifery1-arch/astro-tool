/*!
 * place.js —— 出生地检索：中国省/市/区县（含拼音、简称）+ 国际城市
 * 依赖：data-cn.js（全国行政区划坐标）、data.js（国际城市）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./data-cn.js'), require('./data.js'));
  } else {
    root.AstroPlace = factory(root.AstroDataCN, root.AstroData);
  }
})(typeof self !== 'undefined' ? self : this, function (CN, D) {
  'use strict';

  /* 港澳台等数据源未覆盖到的常用地点补充 */
  var SUPPLEMENT = [
    ['台湾省', '台北市', '', 121.5654, 25.0330, 'Asia/Taipei'],
    ['台湾省', '新北市', '', 121.4628, 25.0169, 'Asia/Taipei'],
    ['台湾省', '桃园市', '', 121.3010, 24.9936, 'Asia/Taipei'],
    ['台湾省', '台中市', '', 120.6736, 24.1477, 'Asia/Taipei'],
    ['台湾省', '台南市', '', 120.2269, 22.9998, 'Asia/Taipei'],
    ['台湾省', '高雄市', '', 120.3014, 22.6273, 'Asia/Taipei'],
    ['台湾省', '基隆市', '', 121.7419, 25.1283, 'Asia/Taipei'],
    ['台湾省', '新竹市', '', 120.9675, 24.8138, 'Asia/Taipei'],
    ['台湾省', '嘉义市', '', 120.4491, 23.4801, 'Asia/Taipei'],
    ['台湾省', '宜兰县', '', 121.7530, 24.7570, 'Asia/Taipei'],
    ['台湾省', '花莲县', '', 121.6112, 23.9910, 'Asia/Taipei'],
    ['台湾省', '台东县', '', 121.1500, 22.7554, 'Asia/Taipei'],
    ['台湾省', '屏东县', '', 120.4942, 22.6761, 'Asia/Taipei'],
    ['台湾省', '南投县', '', 120.6853, 23.9099, 'Asia/Taipei'],
    ['台湾省', '彰化县', '', 120.5444, 24.0756, 'Asia/Taipei'],
    ['台湾省', '云林县', '', 120.4313, 23.7092, 'Asia/Taipei'],
    ['台湾省', '苗栗县', '', 120.8214, 24.5602, 'Asia/Taipei'],
    ['台湾省', '澎湖县', '', 119.5793, 23.5711, 'Asia/Taipei'],
    ['台湾省', '金门县', '', 118.3170, 24.4370, 'Asia/Taipei'],
    ['台湾省', '连江县(马祖)', '', 119.9516, 26.1605, 'Asia/Taipei'],
    ['香港特别行政区', '香港岛', '', 114.1834, 22.2635, 'Asia/Hong_Kong'],
    ['香港特别行政区', '九龙', '', 114.1690, 22.3120, 'Asia/Hong_Kong'],
    ['香港特别行政区', '新界', '', 114.1300, 22.3980, 'Asia/Hong_Kong'],
    ['香港特别行政区', '中西区', '', 114.1540, 22.2820, 'Asia/Hong_Kong'],
    ['香港特别行政区', '湾仔区', '', 114.1750, 22.2770, 'Asia/Hong_Kong'],
    ['香港特别行政区', '沙田区', '', 114.1910, 22.3820, 'Asia/Hong_Kong'],
    ['香港特别行政区', '元朗区', '', 114.0330, 22.4440, 'Asia/Hong_Kong'],
    ['香港特别行政区', '观塘区', '', 114.2260, 22.3120, 'Asia/Hong_Kong'],
    ['澳门特别行政区', '澳门半岛', '', 113.5439, 22.1987, 'Asia/Macau'],
    ['澳门特别行政区', '氹仔', '', 113.5570, 22.1560, 'Asia/Macau'],
    ['澳门特别行政区', '路环', '', 113.5560, 22.1180, 'Asia/Macau'],
    ['河北省', '雄安新区', '', 115.9930, 39.0163, 'Asia/Shanghai']
  ];

  var SUFFIX = ['特别行政区', '维吾尔自治区', '壮族自治区', '回族自治区', '自治区', '自治州', '自治县', '自治旗', '地区', '林区', '新区', '盟', '省', '市', '区', '县', '旗'];

  function core(s) {
    s = String(s || '').trim();
    var changed = true;
    while (changed) {
      changed = false;
      for (var i = 0; i < SUFFIX.length; i++) {
        if (s.length > 2 && s.slice(-SUFFIX[i].length) === SUFFIX[i]) {
          s = s.slice(0, -SUFFIX[i].length);
          changed = true;
          break;
        }
      }
    }
    return s;
  }
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[\s·・,，.。'’\-_/\\]/g, '');
  }

  /* ---------- 构建索引 ---------- */

  var INDEX = [];
  var byProv = CN.provinces;
  var PROV_INDEX = [];   // 省 → 市列表
  var CITY_INDEX = [];   // [省][市] → 区县列表

  function pushEntry(e) { INDEX.push(e); }

  byProv.forEach(function (p, pi) {
    var provName = p[0], provTz = p[5];
    pushEntry({ name: provName, core: core(provName), py: p[1] || '', pyf: p[2] || '', lat: p[4], lng: p[3], tz: provTz, level: 0, prov: provName, city: '', path: provName });
    var cities = [];
    (p[6] || []).forEach(function (c, ci) {
      var cityName = c[0];
      var cityTz = (typeof c[5] === 'string' && c[5]) ? c[5] : provTz;
      var rawKids = c[6];
      var kids = Array.isArray(rawKids) ? rawKids : [];
      var dupSelf = (cityName === provName);
      var displayCity = dupSelf ? '' : cityName;
      if (!dupSelf) {
        pushEntry({ name: cityName, core: core(cityName), py: c[1] || '', pyf: c[2] || '', lat: c[4], lng: c[3], tz: cityTz, level: 1, prov: provName, city: cityName, path: provName + ' ' + cityName });
      }
      cities.push({ name: cityName, display: cityName, tz: cityTz, lat: c[4], lng: c[3], districts: [] });
      var dists = [];
      kids.forEach(function (d) {
        var dName = d[0];
        var dTz = (typeof d[5] === 'string' && d[5]) ? d[5] : cityTz;
        if (dName === cityName || dName === provName) { return; }
        var path = provName + ' ' + (displayCity ? displayCity + ' ' : '') + dName;
        pushEntry({ name: dName, core: core(dName), py: d[1] || '', pyf: d[2] || '', lat: d[4], lng: d[3], tz: dTz, level: 2, prov: provName, city: cityName, path: path });
        dists.push({ name: dName, tz: dTz, lat: d[4], lng: d[3] });
      });
      cities[cities.length - 1].districts = dists;
    });
    PROV_INDEX.push({ name: provName, tz: provTz, lat: p[4], lng: p[3], cities: cities.filter(function (c) { return c.name !== provName || c.districts.length; }) });
  });

  // 补充数据
  SUPPLEMENT.forEach(function (s) {
    var provName = s[0], cityName = s[1], distName = s[2], lng = s[3], lat = s[4], tz = s[5];
    var name = distName || cityName;
    pushEntry({ name: name, core: core(name), py: '', pyf: '', lat: lat, lng: lng, tz: tz, level: distName ? 2 : 1,
      prov: provName, city: cityName, path: provName + ' ' + name, supplement: true });
    var prov = PROV_INDEX.filter(function (p) { return p.name === provName; })[0];
    if (!prov) { return; }
    var city = prov.cities.filter(function (c) { return c.name === cityName; })[0];
    if (!city) { city = { name: cityName, display: cityName, tz: tz, lat: lat, lng: lng, districts: [] }; prov.cities.push(city); }
    if (distName) { city.districts.push({ name: distName, tz: tz, lat: lat, lng: lng }); }
  });

  /* 国际城市 */
  var WORLD = (D.CITIES || []).map(function (w) {
    return { name: w.name, core: core(w.name), py: '', pyf: '', lat: w.lat, lng: w.lon, tz: w.tz, level: 3, prov: '', city: '', path: w.name + '（' + w.tz + '）', world: true };
  });

  /* ---------- 打分与检索 ---------- */

  function score(e, q, qc) {
    var s = 0;
    var n = e.name, nc = e.core || core(n), py = e.py || '', pyf = e.pyf || '';
    if (n === q || nc === q) { s = 1000; }
    else if (qc && nc === qc) { s = 960; }
    else if (qc && nc.indexOf(qc) === 0) { s = 860 - Math.min(120, nc.length * 6); }
    else if (qc && nc.indexOf(qc) > 0) { s = 780 - Math.min(120, nc.length * 6); }
    else if (py && py === q) { s = 900; }
    else if (py && py.indexOf(q) === 0) { s = 790 - Math.min(80, py.length * 3); }
    else if (pyf && pyf === q && q.length >= 2) { s = 770; }
    else if (pyf && pyf.indexOf(q) === 0 && q.length >= 2) { s = 700 - Math.min(60, pyf.length * 3); }
    else if (qc && qc.length >= 2 && e.path && norm(e.path).indexOf(qc) >= 0) { s = 620; }
    else { return 0; }
    s += (3 - Math.min(3, e.level)) * 6;             // 同级时：省 > 市 > 区县
    // 嵌套同名（如「阿坝」→ 阿坝藏族羌族自治州 内含 阿坝县）：优先更高级别的行政区
    if (e.level <= 1 && qc && qc.length >= 2 && nc.indexOf(qc) === 0 && nc.length > qc.length) { s += 200; }
    return s;
  }

  function search(query, limit) {
    var q = norm(query);
    limit = limit || 12;
    if (!q) { return []; }
    var qc = norm(core(query));
    var hits = [];
    INDEX.forEach(function (e) {
      var s = score(e, q, qc);
      if (s > 0) { hits.push({ e: e, s: s }); }
    });
    WORLD.forEach(function (e) {
      var s = score(e, q, qc);
      if (s > 0) { hits.push({ e: e, s: s - 40 }); }
    });
    hits.sort(function (a, b) { return b.s - a.s || a.e.name.length - b.e.name.length; });
    return hits.slice(0, limit).map(function (h) { return h.e; });
  }

  /* 精确/高置信匹配（表单提交时用） */
  function byName(text) {
    var raw = String(text || '').trim();
    if (!raw) { return null; }
    // 允许 "浙江省 杭州市" / "杭州市 · 西湖区" 形式：取最后一段为主名
    var parts = raw.split(/[\s·]+/).filter(Boolean);
    var last = parts.length > 1 ? parts[parts.length - 1] : raw;
    var list = search(last, 8);
    if (list.length) {
      // 若指定了省份（多段），优先路径匹配
      if (parts.length > 1) {
        var provPart = norm(parts[0]);
        var matched = list.filter(function (e) { return norm(e.prov).indexOf(provPart) >= 0 || provPart.indexOf(norm(e.prov)) >= 0; });
        if (matched.length) { return matched[0]; }
      }
      return list[0];
    }
    var w = WORLD.filter(function (x) { return norm(x.name) === norm(last); })[0];
    return w || null;
  }

  function provinces() { return PROV_INDEX; }
  function cities(provName) {
    var p = PROV_INDEX.filter(function (x) { return x.name === provName; })[0];
    return p ? p.cities : [];
  }
  function districts(provName, cityName) {
    var cs = cities(provName);
    var c = cs.filter(function (x) { return x.name === cityName; })[0];
    return c ? c.districts : [];
  }

  /* 路径显示：去掉重复层（直辖市 / 港澳） */
  function label(e) {
    if (!e) { return ''; }
    if (e.world) { return e.name; }
    var parts = [];
    if (e.prov && core(e.prov) !== core(e.name)) { parts.push(e.prov); }
    if (e.city && core(e.city) !== core(e.name) && core(e.city) !== core(e.prov)) { parts.push(e.city); }
    parts.push(e.name);
    var seen = {}, out = [];
    parts.forEach(function (p) { var k = core(p); if (!seen[k]) { seen[k] = 1; out.push(p); } });
    return out.join(' · ');
  }

  return {
    search: search,
    byName: byName,
    provinces: provinces,
    cities: cities,
    districts: districts,
    label: label,
    core: core,
    norm: norm,
    all: function () { return INDEX; },
    count: function () { return INDEX.length; }
  };
});
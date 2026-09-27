/*!
 * astro.js —— 星盘组装层：星座 / 宫位 / 相位 / 格局 / 行运
 * 依赖：ephemeris.js
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(require('./ephemeris.js')); }
  else { root.AstroChart = factory(root.AstroEphemeris); }
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  var norm360 = E.norm360, norm180 = E.norm180;

  /* ---------------- 基础数据 ---------------- */

  var SIGNS = [
    { name: '白羊座', glyph: '♈', en: 'Aries', element: '火', mode: '基本', ruler: '火星', exalt: '太阳', key: '开创' },
    { name: '金牛座', glyph: '♉', en: 'Taurus', element: '土', mode: '固定', ruler: '金星', exalt: '月亮', key: '稳固' },
    { name: '双子座', glyph: '♊', en: 'Gemini', element: '风', mode: '变动', ruler: '水星', exalt: '—', key: '交流' },
    { name: '巨蟹座', glyph: '♋', en: 'Cancer', element: '水', mode: '基本', ruler: '月亮', exalt: '木星', key: '保护' },
    { name: '狮子座', glyph: '♌', en: 'Leo', element: '火', mode: '固定', ruler: '太阳', exalt: '—', key: '发光' },
    { name: '处女座', glyph: '♍', en: 'Virgo', element: '土', mode: '变动', ruler: '水星', exalt: '水星', key: '精进' },
    { name: '天秤座', glyph: '♎', en: 'Libra', element: '风', mode: '基本', ruler: '金星', exalt: '土星', key: '平衡' },
    { name: '天蝎座', glyph: '♏', en: 'Scorpio', element: '水', mode: '固定', ruler: '冥王星', exalt: '—', key: '深潜' },
    { name: '射手座', glyph: '♐', en: 'Sagittarius', element: '火', mode: '变动', ruler: '木星', exalt: '—', key: '远行' },
    { name: '摩羯座', glyph: '♑', en: 'Capricorn', element: '土', mode: '基本', ruler: '土星', exalt: '火星', key: '攀登' },
    { name: '水瓶座', glyph: '♒', en: 'Aquarius', element: '风', mode: '固定', ruler: '天王星', exalt: '—', key: '超越' },
    { name: '双鱼座', glyph: '♓', en: 'Pisces', element: '水', mode: '变动', ruler: '海王星', exalt: '金星', key: '融合' }
  ];

  var PLANETS = [
    { key: 'sun', name: '太阳', glyph: '☉', theme: '自我核心与生命力', weight: 2 },
    { key: 'moon', name: '月亮', glyph: '☽', theme: '情绪需求与安全感', weight: 2 },
    { key: 'mercury', name: '水星', glyph: '☿', theme: '思维与表达', weight: 1.4 },
    { key: 'venus', name: '金星', glyph: '♀', theme: '爱与审美', weight: 1.4 },
    { key: 'mars', name: '火星', glyph: '♂', theme: '行动与欲望', weight: 1.4 },
    { key: 'jupiter', name: '木星', glyph: '♃', theme: '扩张与幸运', weight: 1 },
    { key: 'saturn', name: '土星', glyph: '♄', theme: '责任与限制', weight: 1 },
    { key: 'uranus', name: '天王星', glyph: '♅', theme: '突变与自由', weight: 0.8 },
    { key: 'neptune', name: '海王星', glyph: '♆', theme: '理想与消融', weight: 0.8 },
    { key: 'pluto', name: '冥王星', glyph: '♇', theme: '转化与权力', weight: 0.8 },
    { key: 'node', name: '北交点', glyph: '☊', theme: '此生成长方向', weight: 0.7 }
  ];
  var PLANET_MAP = {};
  PLANETS.forEach(function (p) { PLANET_MAP[p.key] = p; });
  PLANET_MAP.southnode = { key: 'southnode', name: '南交点', glyph: '☋', theme: '过往习气与舒适区', weight: 0.7 };

  var ASPECTS = [
    { key: 'conjunction', name: '合相', glyph: '☌', angle: 0, orb: 8, major: true, nature: '中性' },
    { key: 'opposition', name: '对冲', glyph: '☍', angle: 180, orb: 8, major: true, nature: '挑战' },
    { key: 'trine', name: '三分相', glyph: '△', angle: 120, orb: 7, major: true, nature: '和谐' },
    { key: 'square', name: '四分相', glyph: '□', angle: 90, orb: 7, major: true, nature: '挑战' },
    { key: 'sextile', name: '六分相', glyph: '⚹', angle: 60, orb: 5, major: true, nature: '和谐' },
    { key: 'quincunx', name: '十二分相', glyph: '⚻', angle: 150, orb: 3, major: false, nature: '调整' },
    { key: 'semisextile', name: '半六分', glyph: '⚺', angle: 30, orb: 2, major: false, nature: '轻微' },
    { key: 'semisquare', name: '半四分', glyph: '∠', angle: 45, orb: 2, major: false, nature: '摩擦' },
    { key: 'sesquiquadrate', name: '补八分', glyph: '⚼', angle: 135, orb: 2, major: false, nature: '摩擦' }
  ];
  var ASPECT_MAP = {};
  ASPECTS.forEach(function (a) { ASPECT_MAP[a.key] = a; });

  /* 庙旺落陷 */
  var RULERSHIP = { sun: [4], moon: [3], mercury: [2, 5], venus: [1, 6], mars: [0, 7], jupiter: [8, 11], saturn: [9, 10], uranus: [10], neptune: [11], pluto: [7] };
  var EXALTATION = { sun: 0, moon: 1, mercury: 5, venus: 11, mars: 9, jupiter: 3, saturn: 6 };

  function dignityOf(key, signIndex) {
    var out = [];
    var r = RULERSHIP[key];
    if (r) {
      if (r.indexOf(signIndex) >= 0) out.push({ type: '庙', desc: '入庙（力量最顺畅）' });
      else if (r.map(function (x) { return (x + 6) % 12; }).indexOf(signIndex) >= 0) out.push({ type: '陷', desc: '落陷（最不擅长的表达方式）' });
    }
    if (EXALTATION[key] !== undefined) {
      if (EXALTATION[key] === signIndex) out.push({ type: '旺', desc: '入旺（能量被强化）' });
      else if ((EXALTATION[key] + 6) % 12 === signIndex) out.push({ type: '弱', desc: '入弱（能量被削弱）' });
    }
    return out;
  }

  /* ---------------- 工具函数 ---------------- */

  function signIndexOf(lon) { return Math.floor(norm360(lon) / 30); }
  function degInSign(lon) { return norm360(lon) - signIndexOf(lon) * 30; }

  function formatDeg(lon) {
    var d = degInSign(lon);
    var deg = Math.floor(d);
    var minFloat = (d - deg) * 60;
    var min = Math.floor(minFloat);
    var sec = Math.round((minFloat - min) * 60);
    if (sec === 60) { sec = 0; min += 1; }
    if (min === 60) { min = 0; deg += 1; }
    return deg + '°' + (min < 10 ? '0' : '') + min + '′';
  }
  function formatLon(lon) {
    var si = signIndexOf(lon);
    return SIGNS[si].name + ' ' + formatDeg(lon);
  }
  function formatLonGlyph(lon) {
    var si = signIndexOf(lon);
    return SIGNS[si].glyph + ' ' + formatDeg(lon);
  }
  function houseOf(lon, cusps) {
    for (var i = 0; i < 12; i++) {
      var a = cusps[i], b = cusps[(i + 1) % 12];
      var span = norm360(b - a);
      var rel = norm360(lon - a);
      if (rel < span) return i + 1;
    }
    return 1;
  }

  function aspectBetween(lonA, lonB, keyA, keyB) {
    var diff = Math.abs(norm180(lonB - lonA));
    var lum = (keyA === 'sun' || keyA === 'moon') && (keyB === 'sun' || keyB === 'moon');
    var best = null;
    for (var i = 0; i < ASPECTS.length; i++) {
      var a = ASPECTS[i];
      var orb = a.orb + (lum && a.major ? 2 : 0);
      var delta = Math.abs(diff - a.angle);
      if (delta <= orb) {
        if (!best || delta < best.delta) { best = { aspect: a, orb: delta, maxOrb: orb, exact: delta < 1 }; }
      }
    }
    return best;
  }

  /* ---------------- 组装星盘 ---------------- */

  function build(raw) {
    var bodies = raw.bodies;
    var cusps = raw.houses.cusps;
    var points = PLANETS.map(function (def) {
      var b = bodies[def.key];
      var si = signIndexOf(b.lon);
      var speed = raw.speeds[def.key];
      return {
        key: def.key,
        name: def.name,
        glyph: def.glyph,
        theme: def.theme,
        weight: def.weight,
        lon: norm360(b.lon),
        lat: b.lat,
        speed: speed,
        retrograde: speed < 0,
        signIndex: si,
        sign: SIGNS[si],
        deg: degInSign(b.lon),
        degText: formatDeg(b.lon),
        house: houseOf(b.lon, cusps),
        dignity: dignityOf(def.key, si)
      };
    });

    // 南交点
    var node = points.filter(function (p) { return p.key === 'node'; })[0];
    var southLon = norm360(node.lon + 180);
    var southSi = signIndexOf(southLon);
    points.push({
      key: 'southnode', name: '南交点', glyph: '☋', theme: '过往习气与舒适区', weight: 0.7,
      lon: southLon, lat: 0, speed: node.speed, retrograde: true,
      signIndex: southSi, sign: SIGNS[southSi], deg: degInSign(southLon),
      degText: formatDeg(southLon), house: houseOf(southLon, cusps), dignity: []
    });

    // 上升 / 天顶 / 天底 / 下降
    var angles = [
      { key: 'asc', name: '上升', glyph: 'AC', lon: raw.houses.asc },
      { key: 'mc', name: '天顶', glyph: 'MC', lon: raw.houses.mc },
      { key: 'dsc', name: '下降', glyph: 'DC', lon: norm360(raw.houses.asc + 180) },
      { key: 'ic', name: '天底', glyph: 'IC', lon: norm360(raw.houses.mc + 180) }
    ].map(function (a) {
      var si = signIndexOf(a.lon);
      return { key: a.key, name: a.name, glyph: a.glyph, lon: norm360(a.lon), signIndex: si, sign: SIGNS[si], deg: degInSign(a.lon), degText: formatDeg(a.lon) };
    });

    var houseList = cusps.map(function (clon, i) {
      var si = signIndexOf(clon);
      return {
        index: i + 1,
        lon: norm360(clon),
        signIndex: si,
        sign: SIGNS[si],
        deg: degInSign(clon),
        degText: formatDeg(clon),
        ruler: SIGNS[si].ruler,
        planets: points.filter(function (p) { return p.house === i + 1; }).map(function (p) { return p.key; })
      };
    });

    // 相位
    var core = points.filter(function (p) { return p.key !== 'southnode'; });
    var aspects = [];
    for (var i = 0; i < core.length; i++) {
      for (var j = i + 1; j < core.length; j++) {
        var hit = aspectBetween(core[i].lon, core[j].lon, core[i].key, core[j].key);
        if (hit) {
          aspects.push({
            a: core[i].key, b: core[j].key,
            aName: core[i].name, bName: core[j].name,
            aGlyph: core[i].glyph, bGlyph: core[j].glyph,
            type: hit.aspect.key, typeName: hit.aspect.name, typeGlyph: hit.aspect.glyph,
            nature: hit.aspect.nature, major: hit.aspect.major,
            angle: hit.aspect.angle, orb: hit.orb, maxOrb: hit.maxOrb,
            exact: hit.exact,
            power: Math.max(0, 1 - hit.orb / hit.maxOrb) * Math.sqrt(core[i].weight * core[j].weight)
          });
        }
      }
    }
    aspects.sort(function (a, b) { return b.power - a.power; });

    // 分布统计
    var counted = points.filter(function (p) { return p.key !== 'southnode' && p.key !== 'node'; });
    var elementCount = { 火: 0, 土: 0, 风: 0, 水: 0 };
    var modeCount = { 基本: 0, 固定: 0, 变动: 0 };
    var houseGroup = { 自我宫: 0, 资源宫: 0, 学习宫: 0, 家庭宫: 0, 创造宫: 0, 服务宫: 0, 关系宫: 0, 深层宫: 0, 远方宫: 0, 事业宫: 0, 人脉宫: 0, 潜意宫: 0 };
    var upper = 0, lower = 0, east = 0, west = 0;
    counted.forEach(function (p) {
      elementCount[p.sign.element]++;
      modeCount[p.sign.mode]++;
      houseGroup[HOUSE_NAMES[p.house - 1]]++;
      if (p.house >= 7) upper++; else lower++;
      if (p.house <= 6) { if ([0, 1, 2].indexOf(p.house - 1) >= 0) east++; else west++; }
      else { if ([6, 7, 8].indexOf(p.house - 1) >= 0) east++; else west++; }
    });

    // 格局识别
    var patterns = [];

    // 群星聚集（星座）
    Object.keys(elementCount).forEach(function () {});
    SIGNS.forEach(function (s, idx) {
      var inSign = counted.filter(function (p) { return p.signIndex === idx; });
      if (inSign.length >= 3) {
        patterns.push({ type: 'stellium-sign', name: '群星落' + s.name, detail: inSign.map(function (p) { return p.name; }).join('、') + '同落' + s.name, planets: inSign.map(function (p) { return p.key; }) });
      }
    });
    // 群星聚集（宫位）
    houseList.forEach(function (h) {
      if (h.planets.length >= 3) {
        patterns.push({ type: 'stellium-house', name: '群星聚第' + h.index + '宫', detail: h.planets.map(function (k) { return PLANET_MAP[k].name; }).join('、') + '同落第' + h.index + '宫（' + h.ruler + '为宫主星）', planets: h.planets.slice() });
      }
    });

    function hasAspect(a, b, type) {
      return aspects.some(function (x) {
        return x.type === type && ((x.a === a && x.b === b) || (x.a === b && x.b === a));
      });
    }
    var pkeys = counted.map(function (p) { return p.key; });
    // 大三角
    for (var g1 = 0; g1 < pkeys.length; g1++) for (var g2 = g1 + 1; g2 < pkeys.length; g2++) for (var g3 = g2 + 1; g3 < pkeys.length; g3++) {
      var A = pkeys[g1], B = pkeys[g2], C = pkeys[g3];
      if (hasAspect(A, B, 'trine') && hasAspect(B, C, 'trine') && hasAspect(A, C, 'trine')) {
        patterns.push({ type: 'grand-trine', name: '大三角', detail: PLANET_MAP[A].name + '、' + PLANET_MAP[B].name + '、' + PLANET_MAP[C].name + '互成三分相，天赋流动顺畅', planets: [A, B, C] });
      }
    }
    // T 三角 / 大十字
    for (var o1 = 0; o1 < pkeys.length; o1++) for (var o2 = o1 + 1; o2 < pkeys.length; o2++) {
      if (!hasAspect(pkeys[o1], pkeys[o2], 'opposition')) continue;
      for (var o3 = 0; o3 < pkeys.length; o3++) {
        var D = pkeys[o3];
        if (D === pkeys[o1] || D === pkeys[o2]) continue;
        if (hasAspect(pkeys[o1], D, 'square') && hasAspect(pkeys[o2], D, 'square')) {
          patterns.push({ type: 't-square', name: 'T 型三角', detail: PLANET_MAP[D].name + '同时四分' + PLANET_MAP[pkeys[o1]].name + '与' + PLANET_MAP[pkeys[o2]].name + '（两者对冲），形成持续的行动张力', planets: [pkeys[o1], pkeys[o2], D] });
        }
      }
    }
    // Yod
    for (var y1 = 0; y1 < pkeys.length; y1++) {
      var apex = pkeys[y1];
      for (var y2 = 0; y2 < pkeys.length; y2++) {
        if (y2 === y1) continue;
        for (var y3 = y2 + 1; y3 < pkeys.length; y3++) {
          if (y3 === y1) continue;
          if (hasAspect(apex, pkeys[y2], 'quincunx') && hasAspect(apex, pkeys[y3], 'quincunx') && hasAspect(pkeys[y2], pkeys[y3], 'sextile')) {
            patterns.push({ type: 'yod', name: '上帝之指（Yod）', detail: PLANET_MAP[apex].name + '成为顶点，' + PLANET_MAP[pkeys[y2]].name + '与' + PLANET_MAP[pkeys[y3]].name + '六分相，指向需要长期调整的议题', planets: [apex, pkeys[y2], pkeys[y3]] });
          }
        }
      }
    }

    // 星盘形状（简化 Jones 分类）
    var sorted = counted.map(function (p) { return p.lon; }).sort(function (a, b) { return a - b; });
    var maxGap = 0, gapAt = 0;
    for (var s = 0; s < sorted.length; s++) {
      var g = norm360(sorted[(s + 1) % sorted.length] - sorted[s]);
      if (g > maxGap) { maxGap = g; gapAt = s; }
    }
    var shape;
    if (maxGap >= 240) shape = { name: '集团型 Bundle', desc: '能量高度集中，天赋聚焦但视野容易受限' };
    else if (maxGap >= 180) shape = { name: '碗型 Bowl', desc: '能量占据半个星盘，有明确的空缺需要他人补足' };
    else if (maxGap >= 120) shape = { name: '火车头型 Locomotive', desc: '有一颗领头星带动整体，行动目标感强' };
    else if (maxGap >= 90) shape = { name: '群聚型 Splash', desc: '两组能量交替主导，人生在两条主线间切换' };
    else shape = { name: '散落型 Splash', desc: '能量分布广泛，多线发展、兴趣多元' };

    // 命主星：上升星座的传统守护星
    var ascSign = SIGNS[signIndexOf(raw.houses.asc)];
    var ascRuler = ascSign.ruler;
    var rulerPoint = points.filter(function (p) { return p.name === ascRuler; })[0];

    return {
      raw: raw,
      SIGNS: SIGNS,
      PLANETS: PLANETS,
      points: points,
      byKey: (function () { var m = {}; points.forEach(function (p) { m[p.key] = p; }); return m; })(),
      planets: points.filter(function (p) { return p.key !== 'southnode' && p.key !== 'node' ? true : true; }),
      corePlanets: counted,
      angles: angles,
      angleByKey: (function () { var m = {}; angles.forEach(function (a) { m[a.key] = a; }); return m; })(),
      houses: houseList,
      aspects: aspects,
      patterns: patterns,
      distributions: {
        elements: elementCount,
        modes: modeCount,
        houseGroups: houseGroup,
        hemispheres: { upper: upper, lower: lower, east: east, west: west }
      },
      shape: shape,
      ascRuler: { name: ascRuler, point: rulerPoint || null },
      input: raw.input
    };
  }

  var HOUSE_NAMES = ['自我宫', '资源宫', '学习宫', '家庭宫', '创造宫', '服务宫', '关系宫', '深层宫', '远方宫', '事业宫', '人脉宫', '潜意宫'];

  /* ---------------- 行运 ---------------- */

  function transits(natal, date) {
    var jd = E.julianDay(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate() + (date.getUTCHours() + date.getUTCMinutes() / 60) / 24);
    var now = E.planetPositions(jd);
    var targets = [
      { key: 'asc', name: '上升', lon: natal.raw.houses.asc },
      { key: 'mc', name: '天顶', lon: natal.raw.houses.mc }
    ].concat(natal.corePlanets.map(function (p) { return { key: p.key, name: p.name, lon: p.lon }; }));

    var list = [];
    PLANETS.forEach(function (tp, idx) {
      if (idx > 9) return;
      var tlon = now.bodies[tp.key].lon;
      targets.forEach(function (t) {
        var hit = aspectBetween(tlon, t.lon, tp.key, t.key);
        if (!hit || !hit.aspect.major) return;
        var orbLimit = (t.key === 'asc' || t.key === 'mc' || t.key === 'sun' || t.key === 'moon') ? 1.5 : 1;
        if (hit.orb > orbLimit) return;
        list.push({
          transiting: tp.key, transitingName: tp.name, transitingGlyph: tp.glyph,
          natal: t.key, natalName: t.name,
          type: hit.aspect.key, typeName: hit.aspect.name, typeGlyph: hit.aspect.glyph,
          orb: hit.orb, exact: hit.exact,
          transitingLon: tlon
        });
      });
    });
    list.sort(function (a, b) {
      var w = { pluto: 5, neptune: 5, uranus: 5, saturn: 4, jupiter: 3, mars: 2, venus: 1.5, mercury: 1.5, sun: 1, moon: 0.5 };
      if (a.exact !== b.exact) { return a.exact ? -1 : 1; }
      if (Math.abs(a.orb - b.orb) > 0.001) { return a.orb - b.orb; }
      return (w[b.transiting] || 1) - (w[a.transiting] || 1);
    });
    return { date: date, positions: now.bodies, list: list };
  }

  return {
    SIGNS: SIGNS,
    PLANETS: PLANETS,
    PLANET_MAP: PLANET_MAP,
    ASPECTS: ASPECTS,
    ASPECT_MAP: ASPECT_MAP,
    HOUSE_NAMES: HOUSE_NAMES,
    build: build,
    transits: transits,
    signIndexOf: signIndexOf,
    degInSign: degInSign,
    formatDeg: formatDeg,
    formatLon: formatLon,
    formatLonGlyph: formatLonGlyph,
    houseOf: houseOf,
    aspectBetween: aspectBetween
  };
});
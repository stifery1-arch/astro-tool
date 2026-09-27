/*!
 * chart.js —— 星盘 SVG 渲染
 * 绘制：黄道十二宫环 / 宫位分割 / 行星与度数 / 相位线 / 四轴
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.AstroWheel = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CX = 380, CY = 380;
  var R_RING_OUT = 358, R_RING_IN = 296;
  var R_CUSP_OUT = 288, R_CUSP_IN = 176;
  var R_ASPECT = 170;
  var R_HOUSE_NUM = 132;
  var R_LABEL = 330;

  var ELEMENT_COLOR = { '火': '#c8563f', '土': '#a5764b', '风': '#4a86b8', '水': '#2f7f8a' };
  var ELEMENT_SOFT = { '火': 'rgba(200,86,63,.30)', '土': 'rgba(165,118,75,.30)', '风': 'rgba(74,134,184,.30)', '水': 'rgba(47,127,138,.30)' };
  var ASPECT_COLOR = {
    conjunction: '#e8c46a', opposition: '#e2604a', square: '#d8834a',
    trine: '#57a8c4', sextile: '#66c39a', quincunx: '#a97fd0',
    semisextile: '#8b93b5', semisquare: '#b06a7a', sesquiquadrate: '#b06a7a'
  };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function pt(lon, asc, r) {
    var a = (180 + (lon - asc)) * Math.PI / 180;
    return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a), a: a };
  }
  function xy(chart, lon, r) { return pt(lon, chart.angleByKey.asc.lon, r); }
  function fmt(n) { return Math.round(n * 100) / 100; }

  var SEQ = 0;

  function render(chart, opts) {
    opts = opts || {};
    var showMinor = !!opts.showMinor;
    var asc = chart.angleByKey.asc.lon;
    var uid = 'w' + (++SEQ);          // 同一页面可能有多张星盘图，渐变/滤镜 ID 必须唯一
    var s = [];
    s.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 760" width="100%" height="100%" role="img" aria-label="本命星盘">');
    s.push('<defs>');
    s.push('<radialGradient id="wheelBg' + uid + '" cx="50%" cy="46%" r="62%">');
    s.push('<stop offset="0%" stop-color="#1b2340"/><stop offset="62%" stop-color="#141a2e"/><stop offset="100%" stop-color="#0d1120"/>');
    s.push('</radialGradient>');
    s.push('<radialGradient id="coreGlow' + uid + '" cx="50%" cy="50%" r="50%">');
    s.push('<stop offset="0%" stop-color="rgba(232,196,106,.16)"/><stop offset="100%" stop-color="rgba(232,196,106,0)"/>');
    s.push('</radialGradient>');
    s.push('<filter id="softGlow' + uid + '" x="-30%" y="-30%" width="160%" height="160%">');
    s.push('<feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>');
    s.push('</filter>');
    s.push('</defs>');
    s.push('<circle cx="' + CX + '" cy="' + CY + '" r="' + R_RING_OUT + '" fill="url(#wheelBg' + uid + ')" stroke="rgba(232,196,106,.30)" stroke-width="1.2"/>');
    s.push('<circle cx="' + CX + '" cy="' + CY + '" r="' + R_ASPECT + '" fill="url(#coreGlow' + uid + ')"/>');
    s.push('<circle cx="' + CX + '" cy="' + CY + '" r="' + R_ASPECT + '" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="1"/>');

    // ---- 黄道十二宫扇区 ----
    chart.SIGNS.forEach(function (sg, i) {
      var start = i * 30, end = start + 30;
      var p1 = xy(chart, start, R_RING_OUT), p2 = xy(chart, end, R_RING_OUT);
      var p3 = xy(chart, end, R_RING_IN), p4 = xy(chart, start, R_RING_IN);
      s.push('<path d="M ' + fmt(p1.x) + ' ' + fmt(p1.y) +
        ' A ' + R_RING_OUT + ' ' + R_RING_OUT + ' 0 0 0 ' + fmt(p2.x) + ' ' + fmt(p2.y) +
        ' L ' + fmt(p3.x) + ' ' + fmt(p3.y) +
        ' A ' + R_RING_IN + ' ' + R_RING_IN + ' 0 0 1 ' + fmt(p4.x) + ' ' + fmt(p4.y) + ' Z" fill="' +
        ELEMENT_SOFT[sg.element] + '" stroke="rgba(255,255,255,.10)" stroke-width=".7"/>');
      var mid = start + 15;
      var g = xy(chart, mid, R_LABEL);
      s.push('<text x="' + fmt(g.x) + '" y="' + fmt(g.y + 11) + '" text-anchor="middle" font-size="26" fill="' +
        ELEMENT_COLOR[sg.element] + '">' + sg.glyph + '</text>');
    });

    // ---- 刻度 ----
    for (var deg = 0; deg < 360; deg++) {
      var big = deg % 5 === 0, mid2 = deg % 1 === 0;
      if (!mid2) continue;
      var len = big ? 10 : 5;
      var a1 = xy(chart, deg, R_RING_IN), a2 = xy(chart, deg, R_RING_IN - len);
      s.push('<line x1="' + fmt(a1.x) + '" y1="' + fmt(a1.y) + '" x2="' + fmt(a2.x) + '" y2="' + fmt(a2.y) +
        '" stroke="rgba(255,255,255,' + (big ? '.30' : '.12') + ')" stroke-width="' + (big ? '1' : '.6') + '"/>');
    }

    // ---- 宫位分割 ----
    chart.houses.forEach(function (h, i) {
      var isAngle = (i === 0 || i === 3 || i === 6 || i === 9);
      var isAxis2 = (i === 1 || i === 2 || i === 4 || i === 5 || i === 7 || i === 8 || i === 10 || i === 11);
      var p1 = xy(chart, h.lon, R_CUSP_IN), p2 = xy(chart, h.lon, R_CUSP_OUT);
      var stroke = isAngle ? 'rgba(232,196,106,.85)' : (i % 3 === 1 ? 'rgba(255,255,255,.30)' : 'rgba(255,255,255,.16)');
      var w = isAngle ? 2 : 1;
      s.push('<line x1="' + fmt(p1.x) + '" y1="' + fmt(p1.y) + '" x2="' + fmt(p2.x) + '" y2="' + fmt(p2.y) +
        '" stroke="' + stroke + '" stroke-width="' + w + '"' + (isAngle ? '' : ' stroke-dasharray="' + (i % 3 === 1 ? 'none' : '4 5') + '"') + '/>');
      var nextLon = chart.houses[(i + 1) % 12].lon;
      var span = ((nextLon - h.lon) % 360 + 360) % 360;
      var midLon = h.lon + span / 2;
      var np = xy(chart, midLon, R_HOUSE_NUM);
      s.push('<text x="' + fmt(np.x) + '" y="' + fmt(np.y + 5) + '" text-anchor="middle" font-size="15" fill="rgba(220,228,255,.45)">' + (i + 1) + '</text>');
    });

    // ---- 四轴标注 ----
    [['asc', 'ASC'], ['mc', 'MC'], ['dsc', 'DSC'], ['ic', 'IC']].forEach(function (pair) {
      var a = chart.angleByKey[pair[0]];
      if (!a) return;
      var p = xy(chart, a.lon, R_CUSP_OUT + 6);
      var sign = chart.SIGNS[a.signIndex];
      var p2 = xy(chart, a.lon, R_RING_IN + 4);
      s.push('<text x="' + fmt(p.x) + '" y="' + fmt(p.y + 4) + '" text-anchor="middle" font-size="12.5" fill="#e8c46a" font-weight="600">' +
        pair[1] + ' ' + sign.glyph + a.degText + '</text>');
    });

    // ---- 相位线 ----
    chart.aspects.forEach(function (a) {
      if (!showMinor && !a.major && a.type !== 'quincunx') return;
      var pa = chart.byKey[a.a], pb = chart.byKey[a.b];
      if (!pa || !pb) return;
      var q1 = xy(chart, pa.lon, R_ASPECT), q2 = xy(chart, pb.lon, R_ASPECT);
      var dash = a.major ? '' : ' stroke-dasharray="3 4"';
      var width = (0.5 + a.power * 2.2).toFixed(2);
      var op = (0.18 + a.power * 0.6).toFixed(2);
      s.push('<line x1="' + fmt(q1.x) + '" y1="' + fmt(q1.y) + '" x2="' + fmt(q2.x) + '" y2="' + fmt(q2.y) +
        '" stroke="' + (ASPECT_COLOR[a.type] || '#888') + '" stroke-width="' + width + '" opacity="' + op + '"' + dash + '/>');
    });

    // ---- 行星（含角度避让） ----
    var show = chart.points.filter(function (p) { return p.key !== 'southnode' || opts.showNodes; });
    var sorted = show.slice().sort(function (x, y) { return x.lon - y.lon; });
    var levels = {};
    sorted.forEach(function (p, i) {
      var prev = sorted[(i - 1 + sorted.length) % sorted.length];
      var d = ((p.lon - prev.lon) % 360 + 360) % 360;
      var prevLevel = levels[prev.key] || 0;
      levels[p.key] = d < 6 ? (prevLevel + 1) % 3 : 0;
    });
    sorted.forEach(function (p) {
      var lv = levels[p.key] || 0;
      var rGlyph = 240 - lv * 26;
      var g = xy(chart, p.lon, rGlyph);
      var degPos = xy(chart, p.lon, rGlyph + 21);
      var color = p.retrograde && p.key !== 'node' ? '#e2a45c' : '#eef2ff';
      var dot = xy(chart, p.lon, R_CUSP_OUT - 2);
      s.push('<line x1="' + fmt(dot.x) + '" y1="' + fmt(dot.y) + '" x2="' + fmt(xy(chart, p.lon, rGlyph + 12).x) + '" y2="' + fmt(xy(chart, p.lon, rGlyph + 12).y) + '" stroke="rgba(255,255,255,.28)" stroke-width=".8"/>');
      s.push('<circle cx="' + fmt(dot.x) + '" cy="' + fmt(dot.y) + '" r="2" fill="rgba(255,255,255,.55)"/>');
      s.push('<text x="' + fmt(g.x) + '" y="' + fmt(g.y + 8) + '" text-anchor="middle" font-size="21" fill="' + color + '" filter="url(#softGlow' + uid + ')">' + p.glyph + '</text>');
      s.push('<text x="' + fmt(degPos.x) + '" y="' + fmt(degPos.y + 4) + '" text-anchor="middle" font-size="10.5" fill="rgba(226,232,255,.72)">' + p.degText + (p.retrograde && p.key !== 'node' ? '℞' : '') + '</text>');
    });

    // ---- 中心信息 ----
    s.push('<text x="' + CX + '" y="' + (CY - 6) + '" text-anchor="middle" font-size="13" fill="rgba(232,196,106,.85)">' + esc(chart.input.name || '本命盘') + '</text>');
    s.push('<text x="' + CX + '" y="' + (CY + 14) + '" text-anchor="middle" font-size="10.5" fill="rgba(226,232,255,.5)">' + esc((chart.input.dateText || '').slice(0, 16)) + '</text>');
    s.push('<text x="' + CX + '" y="' + (CY + 31) + '" text-anchor="middle" font-size="10" fill="rgba(226,232,255,.38)">' + esc(chart.input.placeName || '') + '</text>');
    s.push('</svg>');
    return s.join('');
  }

  function toDataURL(svgMarkup, cb, size) {
    var sizePx = size || 1200;
    var svg = svgMarkup.indexOf('width=') >= 0 ? svgMarkup.replace(/width="[^"]*"/, 'width="' + sizePx + '"').replace(/height="[^"]*"/, 'height="' + sizePx + '"') : svgMarkup;
    var img = new Image();
    var blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = sizePx; canvas.height = sizePx;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0d1120';
      ctx.fillRect(0, 0, sizePx, sizePx);
      ctx.drawImage(img, 0, 0, sizePx, sizePx);
      URL.revokeObjectURL(url);
      cb(canvas.toDataURL('image/png'));
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(null); };
    img.src = url;
  }

  return { render: render, toDataURL: toDataURL, ASPECT_COLOR: ASPECT_COLOR, ELEMENT_COLOR: ELEMENT_COLOR };
});
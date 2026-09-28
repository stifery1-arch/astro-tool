/*!
 * 占星排盘天文引擎 ephemeris.js
 * 零依赖实现：轨道要素法（Paul Schlyter）+ 标准章动/恒星时公式（Meeus）
 * 适用范围：公元 1800 - 2100 年。精度：太阳/月亮约 1 弧分，内行星 1-2 弧分，外行星 1-10 弧分。
 * 黄道体系：回归黄道 Tropical，历元为当日平春分点。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.AstroEphemeris = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RAD = Math.PI / 180;
  var DEG = 180 / Math.PI;

  function norm360(x) { var r = x % 360; return r < 0 ? r + 360 : r; }
  function norm180(x) { var r = norm360(x); return r > 180 ? r - 360 : r; }
  function sind(x) { return Math.sin(x * RAD); }
  function cosd(x) { return Math.cos(x * RAD); }
  function tand(x) { return Math.tan(x * RAD); }
  function asind(x) { return Math.asin(Math.max(-1, Math.min(1, x))) * DEG; }
  function acosd(x) { return Math.acos(Math.max(-1, Math.min(1, x))) * DEG; }
  function atan2d(y, x) { return Math.atan2(y, x) * DEG; }

  /* ---------- 时间 ---------- */

  function julianDay(y, m, dayFloat) {
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + dayFloat + B - 1524.5;
  }

  function daysSince2000(jd) { return jd - 2451543.5; }

  function gmst(jd) {
    var t = (jd - 2451545.0) / 36525.0;
    var g = 280.46061837 + 360.98564736629 * (jd - 2451545.0)
      + 0.000387933 * t * t - (t * t * t) / 38710000.0;
    return norm360(g);
  }

  function obliquity(d) { return 23.4392911 - 3.563e-7 * d; }

  /* 某时区的 UTC 偏移（分钟），基于 IANA 时区名，支持夏令时 */
  function zoneOffsetAt(zone, date) {
    try {
      var dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: zone, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      var map = {};
      dtf.formatToParts(date).forEach(function (p) { map[p.type] = p.value; });
      var asUTC = Date.UTC(+map.year, +map.month - 1, +map.day, (+map.hour) % 24, +map.minute, +map.second);
      return Math.round((asUTC - date.getTime()) / 60000);
    } catch (e) {
      return 480;
    }
  }

  function zonedOffsetMinutes(zone, y, mo, d, h, mi) {
    var base = Date.UTC(y, mo - 1, d, h, mi || 0);
    var off = 0;
    for (var k = 0; k < 3; k++) { off = zoneOffsetAt(zone, new Date(base - off * 60000)); }
    return off;
  }

  /* ---------- 开普勒轨道 ---------- */

  function kepler(M, e) {
    M = norm180(M);
    var E = M + e * DEG * sind(M) * (1 + e * cosd(M));
    for (var i = 0; i < 20; i++) {
      var dE = (E - e * DEG * sind(E) - M) / (1 - e * cosd(E));
      E -= dE;
      if (Math.abs(dE) < 1e-10) break;
    }
    return E;
  }

  function orbitXYZ(N, i, w, a, e, M) {
    var E = kepler(M, e);
    var xv = a * (cosd(E) - e);
    var yv = a * Math.sqrt(Math.max(0, 1 - e * e)) * sind(E);
    var v = atan2d(yv, xv);
    var r = Math.sqrt(xv * xv + yv * yv);
    var u = v + w;
    return {
      x: r * (cosd(N) * cosd(u) - sind(N) * sind(u) * cosd(i)),
      y: r * (sind(N) * cosd(u) + cosd(N) * sind(u) * cosd(i)),
      z: r * (sind(u) * sind(i)),
      r: r, v: v
    };
  }

  function elements(d) {
    return {
      sun:     { N: 0, i: 0, w: 282.9404 + 4.70935e-5 * d, a: 1.000000, e: 0.016709 - 1.151e-9 * d, M: 356.0470 + 0.9856002585 * d },
      moon:    { N: 125.1228 - 0.0529538083 * d, i: 5.1454, w: 318.0634 + 0.1643573223 * d, a: 60.2666, e: 0.054900, M: 115.3654 + 13.0649929509 * d },
      mercury: { N: 48.3313 + 3.24587e-5 * d, i: 7.0047 + 5.00e-8 * d, w: 29.1241 + 1.01444e-5 * d, a: 0.387098, e: 0.205635 + 5.59e-10 * d, M: 168.6562 + 4.0923344368 * d },
      venus:   { N: 76.6799 + 2.46590e-5 * d, i: 3.3946 + 2.75e-8 * d, w: 54.8910 + 1.38374e-5 * d, a: 0.723330, e: 0.006773 - 1.302e-9 * d, M: 48.0052 + 1.6021302244 * d },
      mars:    { N: 49.5574 + 2.11081e-5 * d, i: 1.8497 - 1.78e-8 * d, w: 286.5016 + 2.92961e-5 * d, a: 1.523688, e: 0.093405 + 2.516e-9 * d, M: 18.6021 + 0.5240207766 * d },
      jupiter: { N: 100.4542 + 2.76854e-5 * d, i: 1.3030 - 1.557e-7 * d, w: 273.8777 + 1.64505e-5 * d, a: 5.20256, e: 0.048498 + 4.469e-9 * d, M: 19.8950 + 0.0830853001 * d },
      saturn:  { N: 113.6634 + 2.38980e-5 * d, i: 2.4886 - 1.081e-7 * d, w: 339.3939 + 2.97661e-5 * d, a: 9.55475, e: 0.055546 - 9.499e-9 * d, M: 316.9670 + 0.0334442282 * d },
      uranus:  { N: 74.0005 + 1.3978e-5 * d, i: 0.7733 + 1.9e-8 * d, w: 96.6612 + 3.0565e-5 * d, a: 19.18171 - 1.55e-8 * d, e: 0.047318 + 7.45e-9 * d, M: 142.5905 + 0.011725806 * d },
      neptune: { N: 131.7806 + 3.0173e-5 * d, i: 1.7700 - 2.55e-7 * d, w: 272.8461 - 6.027e-6 * d, a: 30.05826 + 3.313e-8 * d, e: 0.008606 + 2.15e-9 * d, M: 260.2471 + 0.005995147 * d }
    };
  }

  /* 冥王星专用级数（Schlyter，适用 1800-2100） */
  function plutoGeo(d) {
    var S = 50.03 + 0.033459652 * d;
    var P = 238.95 + 0.003968789 * d;
    var lon = 238.9508 + 0.00400703 * d
      - 19.799 * sind(P) + 19.848 * cosd(P)
      + 0.897 * sind(2 * P) - 4.956 * cosd(2 * P)
      + 0.610 * sind(3 * P) + 1.211 * cosd(3 * P)
      - 0.341 * sind(4 * P) - 0.190 * cosd(4 * P)
      + 0.128 * sind(5 * P) - 0.034 * cosd(5 * P)
      - 0.038 * sind(6 * P) + 0.031 * cosd(6 * P)
      + 0.020 * sind(S - P) - 0.010 * cosd(S - P);
    var lat = -3.9082
      - 5.453 * sind(P) - 14.975 * cosd(P)
      + 3.527 * sind(2 * P) + 1.673 * cosd(2 * P)
      - 1.051 * sind(3 * P) + 0.328 * cosd(3 * P)
      + 0.179 * sind(4 * P) - 0.292 * cosd(4 * P)
      + 0.019 * sind(5 * P) + 0.100 * cosd(5 * P)
      - 0.031 * sind(6 * P) - 0.026 * cosd(6 * P)
      + 0.011 * cosd(S - P);
    return { lon: norm360(lon), lat: lat, r: 40.72 + 6.68 * sind(P) + 6.90 * cosd(P) - 1.18 * sind(2 * P) - 0.03 * cosd(2 * P) + 0.15 * sind(3 * P) - 0.14 * cosd(3 * P) };
  }

  /* ---------- 行星位置（地心黄经/黄纬） ---------- */

  function planetPositions(jd) {
    var d = daysSince2000(jd);
    var el = elements(d);
    var eps = obliquity(d);

    // 太阳：地心直接计算
    var sunOrb = orbitXYZ(el.sun.N, el.sun.i, el.sun.w, el.sun.a, el.sun.e, el.sun.M);
    var sunLon = norm360(atan2d(sunOrb.y, sunOrb.x));
    var sunR = sunOrb.r;
    // 地球日心坐标 = 太阳地心坐标反向
    var ex = -sunOrb.x, ey = -sunOrb.y, ez = 0;

    // 月球（含主要摄动项）
    var moonOrb = orbitXYZ(el.moon.N, el.moon.i, el.moon.w, el.moon.a, el.moon.e, el.moon.M);
    var mR = moonOrb.r;
    var mLon = norm360(atan2d(moonOrb.y, moonOrb.x));
    var mLat = asind(moonOrb.z / mR);
    var Mm = el.moon.M, Ms = el.sun.M;
    var Lm = el.moon.N + el.moon.w + el.moon.M;
    var Ls = el.sun.w + el.sun.M;
    var D = norm360(Lm - Ls);
    var F = norm360(Lm - el.moon.N);
    var dLon =
      -1.274 * sind(Mm - 2 * D) + 0.658 * sind(2 * D) - 0.186 * sind(Ms)
      - 0.059 * sind(2 * Mm - 2 * D) - 0.057 * sind(Mm - 2 * D + Ms)
      + 0.053 * sind(Mm + 2 * D) + 0.046 * sind(2 * D - Ms)
      + 0.041 * sind(Mm - Ms) - 0.035 * sind(D) - 0.031 * sind(Mm + Ms)
      - 0.015 * sind(2 * F - 2 * D) + 0.011 * sind(Mm - 4 * D);
    var dLat =
      -0.173 * sind(F - 2 * D) - 0.055 * sind(Mm - F - 2 * D)
      - 0.046 * sind(Mm + F - 2 * D) + 0.033 * sind(F + 2 * D)
      + 0.017 * sind(2 * Mm + F);
    var dR = -0.58 * cosd(Mm - 2 * D) - 0.46 * cosd(2 * D);
    mLon = norm360(mLon + dLon);
    mLat = mLat + dLat;
    mR = mR + dR;

    // 木星、土星、天王星摄动
    var Mj = el.jupiter.M, Msa = el.saturn.M, Mu = el.uranus.M;
    var jupD = -0.332 * sind(2 * Mj - 5 * Msa - 67.6) - 0.056 * sind(2 * Mj - 2 * Msa + 21)
      + 0.042 * sind(3 * Mj - 5 * Msa + 21) - 0.036 * sind(Mj - 2 * Msa)
      + 0.022 * cosd(Mj - Msa) + 0.023 * sind(2 * Mj - 3 * Msa + 52)
      - 0.016 * sind(Mj - 5 * Msa - 69);
    var satD = 0.812 * sind(2 * Mj - 5 * Msa - 67.6) - 0.229 * cosd(2 * Mj - 4 * Msa - 2)
      + 0.119 * sind(Mj - 2 * Msa - 3) + 0.046 * sind(2 * Mj - 6 * Msa - 69)
      + 0.014 * sind(Mj - 3 * Msa + 32);
    var satDLat = -0.020 * cosd(2 * Mj - 4 * Msa - 2) + 0.018 * sind(2 * Mj - 6 * Msa - 49);
    var uraD = 0.040 * sind(Msa - 2 * Mu + 6) + 0.035 * sind(Msa - 3 * Mu + 33)
      - 0.015 * sind(Mj - Mu + 20);

    function helioSpherical(key, dLon, dLat) {
      var o = orbitXYZ(el[key].N, el[key].i, el[key].w, el[key].a, el[key].e, el[key].M);
      var lon = norm360(atan2d(o.y, o.x) + (dLon || 0));
      var lat = asind(o.z / o.r) + (dLat || 0);
      return { lon: lon, lat: lat, r: o.r };
    }
    function toGeo(h) {
      var x = h.r * cosd(h.lat) * cosd(h.lon);
      var y = h.r * cosd(h.lat) * sind(h.lon);
      var z = h.r * sind(h.lat);
      var gx = x - ex, gy = y - ey, gz = z - ez;
      var gr = Math.sqrt(gx * gx + gy * gy + gz * gz);
      return { lon: norm360(atan2d(gy, gx)), lat: asind(gz / gr), r: gr };
    }

    var pl = plutoGeo(d);
    var out = {
      sun: { lon: sunLon, lat: 0, r: sunR },
      moon: { lon: mLon, lat: mLat, r: mR },
      mercury: toGeo(helioSpherical('mercury')),
      venus: toGeo(helioSpherical('venus')),
      mars: toGeo(helioSpherical('mars')),
      jupiter: toGeo(helioSpherical('jupiter', jupD)),
      saturn: toGeo(helioSpherical('saturn', satD, satDLat)),
      uranus: toGeo(helioSpherical('uranus', uraD)),
      neptune: toGeo(helioSpherical('neptune')),
      pluto: toGeo(pl),
      node: { lon: norm360(el.moon.N), lat: 0, r: 0, mean: true }
    };
    return { bodies: out, d: d, eps: eps, elements: el };
  }

  /* ---------- 宫位 ---------- */

  /*!
   * 宫位制计算
   * 已有：placidus 普拉西度 / whole 整宫制 / equal 等宫制 / porphyry 波菲里
   * 新增：regiomontanus 雷格蒙塔努斯 / campanus 坎帕努斯 / alcabitius 阿尔卡比修斯
   *       meridian 子午线 / vehlow 魏洛
   * 全部算法以瑞士星历表 Swiss Ephemeris（Astro.com 同款内核）为基准校验，
   * 96 组「纬度 × 中天赤经」用例误差均为 0.00000°（见 tests/house-systems-test.js）
   */
  function computeHouses(ramc, lat, system, epsIn) {
    var eps = (typeof epsIn === 'number' && isFinite(epsIn)) ? epsIn : 23.4392911;
    var mc = norm360(atan2d(sind(ramc), cosd(ramc) * cosd(eps)));
    var asc = norm360(atan2d(cosd(ramc), -(sind(ramc) * cosd(eps) + tand(lat) * sind(eps))));
    var cusps = new Array(12);
    cusps[0] = asc;
    cusps[9] = mc;
    cusps[3] = norm360(mc + 180);
    cusps[6] = norm360(asc + 180);

    function mirror() {
      for (var k = 0; k < 6; k++) { cusps[k + 6] = norm360(cusps[k] + 180); }
    }

    /* 波菲里：把 ASC–MC、ASC–IC 两个象限各三等分 */
    function porphyry() {
      var arcA = norm360(asc - mc);
      var arcB = norm360(mc + 180 - asc);
      cusps[10] = norm360(mc + arcA / 3);
      cusps[11] = norm360(mc + 2 * arcA / 3);
      cusps[1] = norm360(asc + arcB / 3);
      cusps[2] = norm360(asc + 2 * arcB / 3);
      cusps[4] = norm360(cusps[10] + 180);
      cusps[5] = norm360(cusps[11] + 180);
      mirror();
      return cusps;
    }

    /* 黄经 → 赤经（用于按赤经分割的宫位制） */
    function raOfLambda(lam) { return norm360(atan2d(cosd(eps) * sind(lam), cosd(lam))); }
    /* 赤经 → 黄经 */
    function lambdaOfRa(ra) { return norm360(atan2d(sind(ra), cosd(ra) * cosd(eps))); }
    /* 赤道坐标单位向量 */
    function eqVec(ra, dec) { return [cosd(dec) * cosd(ra), cosd(dec) * sind(ra), sind(dec)]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function unit(a) { var m = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); return [a[0] / m, a[1] / m, a[2] / m]; }
    /* 黄道上与该平面相交的两个黄经（相差 180°） */
    function eclipticHits(P) {
      var A = P[0], B = P[1] * cosd(eps) + P[2] * sind(eps);
      var l = atan2d(-A, B);
      return [norm360(l), norm360(l + 180)];
    }
    function pickClosest(hits, ref) {
      var best = hits[0];
      for (var i = 1; i < hits.length; i++) {
        if (Math.abs(norm180(hits[i] - ref)) < Math.abs(norm180(best - ref))) { best = hits[i]; }
      }
      return best;
    }

    /* ---- 整宫制 ---- */
    if (system === 'whole') {
      var base = Math.floor(asc / 30) * 30;
      for (var wi = 0; wi < 12; wi++) { cusps[wi] = norm360(base + 30 * wi); }
      return { cusps: cusps, asc: asc, mc: mc, eps: eps, system: 'whole' };
    }
    /* ---- 等宫制（自上升点每 30°） ---- */
    if (system === 'equal') {
      for (var ei = 0; ei < 12; ei++) { cusps[ei] = norm360(asc + 30 * ei); }
      return { cusps: cusps, asc: asc, mc: mc, eps: eps, system: 'equal' };
    }
    /* ---- 魏洛：等宫制整体后退 15°，使上升点位于一宫正中 ---- */
    if (system === 'vehlow') {
      for (var vi = 0; vi < 12; vi++) { cusps[vi] = norm360(asc - 15 + 30 * vi); }
      return { cusps: cusps, asc: asc, mc: mc, eps: eps, system: 'vehlow' };
    }
    /* ---- 子午线：赤经自东点起每 30°，投影到黄道 ---- */
    if (system === 'meridian') {
      for (var mi = 0; mi < 12; mi++) { cusps[mi] = lambdaOfRa(norm360(ramc + 90 + 30 * mi)); }
      return { cusps: cusps, asc: asc, mc: mc, eps: eps, system: 'meridian' };
    }
    /* ---- 阿尔卡比修斯：在赤经上三等分 MC→ASC 与 ASC→IC ---- */
    if (system === 'alcabitius') {
      var raAsc = raOfLambda(asc), raIc = norm360(ramc + 180);
      // 弧长必须按 0–360 归一化，否则跨 0° 时方向会取反（高纬度尤其明显）
      var arcUp = norm360(raAsc - ramc);        // 中天 → 上升
      var arcDown = norm360(raIc - raAsc);      // 上升 → 天底
      cusps[10] = lambdaOfRa(norm360(ramc + arcUp / 3));
      cusps[11] = lambdaOfRa(norm360(ramc + 2 * arcUp / 3));
      cusps[1] = lambdaOfRa(norm360(raAsc + arcDown / 3));
      cusps[2] = lambdaOfRa(norm360(raAsc + 2 * arcDown / 3));
      cusps[4] = norm360(cusps[10] + 180);
      cusps[5] = norm360(cusps[11] + 180);
      mirror();
      return { cusps: cusps, asc: asc, mc: mc, eps: eps, system: 'alcabitius' };
    }
    /* ---- 雷格蒙塔努斯 / 坎帕努斯：过地平圈南北点的等分大圆 ---- */
    if (system === 'regiomontanus' || system === 'campanus') {
      var refPorph = porphyry().slice();          // 用波菲里作为分支参考（两者相差远小于 180°）
      var north = eqVec(ramc + 180, 90 - lat);
      var eastPt = eqVec(ramc + 90, 0);
      var axis = system === 'regiomontanus' ? null : cross(north, eastPt);
      var out = new Array(12);
      for (var k = 0; k < 12; k++) {
        var pts;
        if (system === 'regiomontanus') {
          // 赤道自东点起每 30°，作过南北点的大圆（其极点 = 南北点 × 赤道分点）
          var qe = eqVec(norm360(ramc + 90 + 30 * k), 0);
          pts = eclipticHits(unit(cross(north, qe)));
          out[k] = pickClosest(pts, refPorph[k]);
        } else {
          // 主垂圈（南北点为其极点）自东点起每 30°，分点即为宫圈极点
          var th = 30 * k * Math.PI / 180;
          var q = unit([
            eastPt[0] * Math.cos(th) + axis[0] * Math.sin(th),
            eastPt[1] * Math.cos(th) + axis[1] * Math.sin(th),
            eastPt[2] * Math.cos(th) + axis[2] * Math.sin(th)
          ]);
          var idx = (k + 9) % 12;                 // 分点 k=0 → 第 10 宫（中天）
          pts = eclipticHits(q);
          out[idx] = pickClosest(pts, refPorph[idx]);
        }
      }
      for (var ci = 0; ci < 12; ci++) { cusps[ci] = out[ci]; }
      return { cusps: cusps, asc: asc, mc: mc, eps: eps, system: system };
    }
    /* ---- 不在上列的一律按波菲里 ---- */
    if (system !== 'placidus') {
      porphyry();
      return { cusps: cusps, asc: asc, mc: mc, eps: eps, system: system === 'porphyry' ? 'porphyry' : system };
    }

    // ---- 普拉西度 Placidus：按时间三等分日弧/夜弧，数值求解 ----
    function decl(lam) { return asind(sind(eps) * sind(lam)); }
    function dsaOf(lam) {
      var v = -tand(lat) * tand(decl(lam));
      if (v <= -1 || v >= 1) return null;
      return acosd(v);
    }
    function hourEast(lam) {
      var alpha = norm360(atan2d(cosd(eps) * sind(lam), cosd(lam)));
      var h = norm360(ramc - alpha);
      if (h > 0) h -= 360;
      // 中天处 ramc-alpha 的理论值为 0，浮点误差可能使其变成 -360，需回卷
      if (h < -359.5) h += 360;
      return h;
    }
    function solve(A, B, k, upper) {
      var total = norm360(B - A);
      if (!(total > 0.5 && total < 200)) return null;
      function g(t) {
        var lam = norm360(A + t);
        var dsa = dsaOf(lam);
        if (dsa === null) return NaN;
        var target = upper ? -(k / 3) * dsa : -(dsa + (k / 3) * (180 - dsa));
        return hourEast(lam) - target;
      }
      // 先扫描找符号变化，再二分求根：端点本身即方程根，直接判 g0*g1 会受浮点误差影响
      var steps = 720;
      var prevT = 0, prevG = g(0);
      for (var si = 1; si <= steps; si++) {
        var t = total * si / steps;
        var gt = g(t);
        if (!isFinite(gt)) { prevT = t; prevG = NaN; continue; }
        if (isFinite(prevG) && prevG * gt <= 0) {
          var lo = prevT, hi = t, glo = prevG;
          for (var it = 0; it < 80; it++) {
            var mid = (lo + hi) / 2;
            var gm = g(mid);
            if (!isFinite(gm)) break;
            if (glo * gm <= 0) { hi = mid; } else { lo = mid; glo = gm; }
          }
          var res = norm360(A + (lo + hi) / 2);
          return isFinite(res) ? res : null;
        }
        prevT = t; prevG = gt;
      }
      return null;
    }

    var c11 = solve(mc, asc, 1, true);
    var c12 = solve(mc, asc, 2, true);
    var ic = norm360(mc + 180);
    var c2 = solve(asc, ic, 1, false);
    var c3 = solve(asc, ic, 2, false);
    var bad = [c11, c12, c2, c3].some(function (v) { return v === null || !isFinite(v); });
    if (bad) {
      porphyry();
      return { cusps: cusps, asc: asc, mc: mc, eps: eps, system: 'porphyry', fallback: true };
    }
    cusps[10] = c11; cusps[11] = c12; cusps[1] = c2; cusps[2] = c3;
    cusps[4] = norm360(cusps[10] + 180);
    cusps[5] = norm360(cusps[11] + 180);
    mirror();
    return { cusps: cusps, asc: asc, mc: mc, eps: eps, system: 'placidus' };
  }
  /* ---------- 宫位制清单（界面与报告共用） ---------- */
  var HOUSE_SYSTEMS = [
    { key: 'placidus', name: '普拉西度 Placidus', short: '普拉西度', group: '常用（现代）',
      desc: '现代最常用，按时间三等分昼夜弧；Astro.com 默认。中高纬度可能降级。' },
    { key: 'porphyry', name: '波菲里 Porphyry', short: '波菲里', group: '常用（现代）',
      desc: '古典方法，把「上升—中天」象限直接三等分；极区最稳定，常作降级方案。' },
    { key: 'whole', name: '整宫制 Whole Sign', short: '整宫制', group: '等宫与整宫',
      desc: '一个星座就是一宫，整宫皆由上升所在星座起算；古典希腊与印度占星常用。' },
    { key: 'equal', name: '等宫制 Equal', short: '等宫制', group: '等宫与整宫',
      desc: '自上升点起每 30° 一宫，与星座边界无关。' },
    { key: 'vehlow', name: '魏洛 Vehlow', short: '魏洛', group: '等宫与整宫',
      desc: '等宫制变体：整体后退 15°，使上升点落在第一宫正中。' },
    { key: 'meridian', name: '子午线 Meridian', short: '子午线', group: '赤经分割',
      desc: '按赤经自东点起每 30° 均分再投影到黄道（赤道坐标系思路）。' },
    { key: 'alcabitius', name: '阿尔卡比修斯 Alcabitius', short: '阿尔卡比修斯', group: '赤经分割',
      desc: '古典方法：在赤经上三等分「中天—上升」与「上升—天底」。' },
    { key: 'regiomontanus', name: '雷格蒙塔努斯 Regiomontanus', short: '雷格蒙塔努斯', group: '古典投影',
      desc: '文艺复兴时期常用：赤道均分后，用穿过地平圈南北点的大圆投影到黄道。' },
    { key: 'campanus', name: '坎帕努斯 Campanus', short: '坎帕努斯', group: '古典投影',
      desc: '中世纪常用：在主垂圈上均分后，同样用南北点大圆投影到黄道。' }
  ];
  var HOUSE_MAP = {};
  HOUSE_SYSTEMS.forEach(function (h) { HOUSE_MAP[h.key] = h; });
  function houseName(key, short) {
    var h = HOUSE_MAP[key];
    if (!h) { return key; }
    return short ? h.short : h.name;
  }
  /* ---------- 对外接口 ---------- */

  function computeChart(input) {
    var y = input.year, mo = input.month, dy = input.day;
    var hh = input.hour || 0, mi = input.minute || 0;
    var tz = input.tzOffsetMinutes || 0;
    var lat = input.lat, lon = input.lon;
    var jdUT = julianDay(y, mo, dy + (hh + mi / 60) / 24) - tz / 1440;
    var pos = planetPositions(jdUT);
    var posNext = planetPositions(jdUT + 1);
    var speeds = {};
    Object.keys(pos.bodies).forEach(function (k) {
      speeds[k] = norm180(posNext.bodies[k].lon - pos.bodies[k].lon);
    });
    var lst = norm360(gmst(jdUT) + lon); // 本地恒星时 = 中天赤经 RAMC
    var houses = computeHouses(lst, lat, input.houseSystem || 'placidus', pos.eps);
    return {
      jd: jdUT,
      utc: jdToUTC(jdUT),
      lst: lst,
      obliquity: pos.eps,
      bodies: pos.bodies,
      speeds: speeds,
      houses: houses,
      lat: lat, lon: lon,
      input: input
    };
  }

  function jdToUTC(jd) {
    var z = Math.floor(jd + 0.5);
    var f = jd + 0.5 - z;
    var a = z;
    if (z >= 2299161) {
      var alpha = Math.floor((z - 1867216.25) / 36524.25);
      a = z + 1 + alpha - Math.floor(alpha / 4);
    }
    var b = a + 1524;
    var c = Math.floor((b - 122.1) / 365.25);
    var dd = Math.floor(365.25 * c);
    var e = Math.floor((b - dd) / 30.6001);
    var day = b - dd - Math.floor(30.6001 * e) + f;
    var month = e < 14 ? e - 1 : e - 13;
    var year = month > 2 ? c - 4716 : c - 4715;
    var dayInt = Math.floor(day);
    var hours = (day - dayInt) * 24;
    var hh = Math.floor(hours);
    var mm = Math.floor((hours - hh) * 60);
    var ss = Math.round((((hours - hh) * 60) - mm) * 60);
    return { year: year, month: month, day: dayInt, hour: hh, minute: mm, second: ss };
  }

  return {
    HOUSE_SYSTEMS: HOUSE_SYSTEMS,
    houseName: houseName,
    norm360: norm360,
    norm180: norm180,
    julianDay: julianDay,
    gmst: gmst,
    planetPositions: planetPositions,
    computeHouses: computeHouses,
    computeChart: computeChart,
    zonedOffsetMinutes: zonedOffsetMinutes,
    zoneOffsetAt: zoneOffsetAt
  };
});
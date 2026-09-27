/* 星盘组装层测试：星座/宫位/相位/格局 + 物理自洽性验证 */
const E = require('../js/ephemeris.js');
const A = require('../js/astro.js');
let pass = 0, fail = 0;
function ok(name, cond, info) {
  if (cond) { pass++; console.log('  PASS  ' + name + (info ? '  ' + info : '')); }
  else { fail++; console.log('  FAIL  ' + name + (info ? '  ' + info : '')); }
}

console.log('\n== 星盘结构 ==');
const raw = E.computeChart({ year: 1994, month: 8, day: 22, hour: 6, minute: 15, tzOffsetMinutes: 480, lat: 31.23, lon: 121.47, houseSystem: 'placidus' });
const chart = A.build(raw);
ok('点位数量 = 10 行星 + 南北交点 = 12', chart.points.length === 12, chart.points.map(p => p.name).join('/'));
ok('四轴齐全（上升/天顶/下降/天底）', chart.angles.length === 4);
ok('12 宫全部就位', chart.houses.length === 12);
ok('每颗行星都有宫位与星座', chart.points.every(p => p.house >= 1 && p.house <= 12 && p.sign && isFinite(p.deg)));
ok('相位列表非空且已排序', chart.aspects.length > 0 && chart.aspects.every((a, i, arr) => i === 0 || arr[i - 1].power >= a.power), chart.aspects.length + ' 个相位');
ok('每个相位差值都在容许度内', chart.aspects.every(a => a.orb <= a.maxOrb + 1e-9));
ok('元素统计合计 = 10', Object.values(chart.distributions.elements).reduce((x, y) => x + y, 0) === 10, JSON.stringify(chart.distributions.elements));
ok('模式统计合计 = 10', Object.values(chart.distributions.modes).reduce((x, y) => x + y, 0) === 10, JSON.stringify(chart.distributions.modes));
ok('命主星已确定', !!chart.ascRuler.name, '上升' + chart.angleByKey.asc.sign.name + ' → 命主星 ' + chart.ascRuler.name);
ok('星盘形状已判定', !!chart.shape.name, chart.shape.name);

console.log('\n== 相位判定 ==');
function mk(lon) { return { lon: lon }; }
let hit = A.aspectBetween(10, 100, 'sun', 'moon');
ok('90° → 四分相', hit && hit.aspect.key === 'square', 'orb ' + hit.orb.toFixed(2));
hit = A.aspectBetween(10, 130, 'sun', 'moon');
ok('120° → 三分相', hit && hit.aspect.key === 'trine');
hit = A.aspectBetween(10, 190, 'sun', 'moon');
ok('180° → 对冲', hit && hit.aspect.key === 'opposition');
hit = A.aspectBetween(10, 70, 'sun', 'moon');
ok('60° → 六分相', hit && hit.aspect.key === 'sextile');
hit = A.aspectBetween(10, 13, 'sun', 'moon');
ok('3° → 合相', hit && hit.aspect.key === 'conjunction');
hit = A.aspectBetween(10, 160.5, 'jupiter', 'saturn');
ok('150.5° → 十二分相', hit && hit.aspect.key === 'quincunx');
hit = A.aspectBetween(10, 100, 'jupiter', 'saturn');
ok('90° 但超大轨道行星使用同样容许度', !!hit);
hit = A.aspectBetween(10, 50, 'jupiter', 'saturn');
ok('40° 差值不构成任何主相位', hit === null || !hit.aspect.major, hit ? hit.aspect.name : 'null');
hit = A.aspectBetween(0, 90.5, 'sun', 'moon');
ok('日月相位容许度放宽到 10°（90.5° 仍算四分）', hit && hit.aspect.key === 'square');
hit = A.aspectBetween(0, 100.5, 'jupiter', 'saturn');
ok('非日月 100.5° 超出 7° 容许度则不算相位', hit === null, hit ? hit.aspect.name : 'null');

console.log('\n== 宫位归属 ==');
const cusps = chart.raw.houses.cusps;
ok('宫头所在经度归属该宫', cusps.every((c, i) => A.houseOf(c, cusps) === i + 1));
ok('宫头前 1° 归属上一宫', cusps.every((c, i) => A.houseOf(E.norm360(c - 1), cusps) === (i === 0 ? 12 : i)));

console.log('\n== 物理自洽性：日出时刻太阳必在上升点 ==');
function sunAltitude(lat, lon, jd) {
  const p = E.planetPositions(jd);
  const d = jd - 2451543.5;
  const eps = 23.4392911 - 3.563e-7 * d;
  const lam = p.bodies.sun.lon * Math.PI / 180;
  const dec = Math.asin(Math.sin(eps * Math.PI / 180) * Math.sin(lam));
  const ra = Math.atan2(Math.cos(eps * Math.PI / 180) * Math.sin(lam), Math.cos(lam)) * 180 / Math.PI;
  const H = (E.gmst(jd) + lon - ra) * Math.PI / 180;
  const phi = lat * Math.PI / 180;
  return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) * 180 / Math.PI;
}
function findSunsetRise(lat, lon, y, m, d, rising) {
  let prev = null, prevJd = null;
  for (let jd = E.julianDay(y, m, d); jd < E.julianDay(y, m, d + 1); jd += 1 / 1440) {
    const alt = sunAltitude(lat, lon, jd);
    if (prev !== null) {
      const cross = rising ? (prev < 0 && alt >= 0) : (prev > 0 && alt <= 0);
      if (cross) return prevJd + (jd - prevJd) * (0 - prev) / (alt - prev);
    }
    prev = alt; prevJd = jd;
  }
  return null;
}
[
  { n: '上海', lat: 31.23, lon: 121.47, y: 1994, m: 8, d: 22, tz: 480 },
  { n: '伦敦', lat: 51.51, lon: -0.13, y: 2010, m: 5, d: 10, tz: 0 },
  { n: '悉尼', lat: -33.87, lon: 151.21, y: 2005, m: 2, d: 14, tz: -600 },
  { n: '纽约', lat: 40.71, lon: -74.01, y: 1980, m: 11, d: 20, tz: 300 }
].forEach(loc => {
  const jdRise = findSunsetRise(loc.lat, loc.lon, loc.y, loc.m, loc.d, true);
  if (jdRise === null) { ok(loc.n + ' 找到日出时刻', false); return; }
  const ch = E.computeChart({
    year: loc.y, month: loc.m, day: loc.d + (jdRise - E.julianDay(loc.y, loc.m, loc.d)), hour: 0, minute: 0,
    tzOffsetMinutes: 0, lat: loc.lat, lon: loc.lon, houseSystem: 'placidus'
  });
  const sunLon = ch.bodies.sun.lon;
  const diff = Math.abs(E.norm180(ch.houses.asc - sunLon));
  ok(loc.n + ' 日出时上升点 ≈ 太阳黄经', diff < 0.6, '偏差 ' + diff.toFixed(3) + '° (ASC=' + ch.houses.asc.toFixed(2) + ' 太阳=' + sunLon.toFixed(2) + ')');
});
[
  { n: '上海', lat: 31.23, lon: 121.47, y: 1994, m: 8, d: 22 },
  { n: '伦敦', lat: 51.51, lon: -0.13, y: 2010, m: 5, d: 10 }
].forEach(loc => {
  const jdSet = findSunsetRise(loc.lat, loc.lon, loc.y, loc.m, loc.d, false);
  const ch = E.computeChart({
    year: loc.y, month: loc.m, day: loc.d + (jdSet - E.julianDay(loc.y, loc.m, loc.d)), hour: 0, minute: 0,
    tzOffsetMinutes: 0, lat: loc.lat, lon: loc.lon, houseSystem: 'placidus'
  });
  const diff = Math.abs(E.norm180(E.norm360(ch.houses.asc + 180) - ch.bodies.sun.lon));
  ok(loc.n + ' 日落时下降点 ≈ 太阳黄经', diff < 0.6, '偏差 ' + diff.toFixed(3) + '°');
});

console.log('\n== 行运 ==');
const natal = A.build(E.computeChart({ year: 1994, month: 8, day: 22, hour: 6, minute: 15, tzOffsetMinutes: 480, lat: 31.23, lon: 121.47, houseSystem: 'placidus' }));
const tr = A.transits(natal, new Date(Date.UTC(2026, 8, 27, 4, 0)));
ok('行运返回列表结构完整', Array.isArray(tr.list) && tr.list.every(x => x.transiting && x.natal && x.typeName && isFinite(x.orb)));
ok('所有行运相位都在 1.5° 容许度内', tr.list.every(x => x.orb <= 1.5 + 1e-9));
console.log('  2026-09-27 行运命中 ' + tr.list.length + ' 条: ' + tr.list.slice(0, 5).map(x => 'T' + x.transitingName + x.typeGlyph + x.natalName + '(' + x.orb.toFixed(2) + '°)').join(' '));
ok('行运包含当前天象位置', !!tr.positions.jupiter && !!tr.positions.saturn);

console.log('\n== 已知星盘交叉验证 ==');
const einstein = A.build(E.computeChart({ year: 1879, month: 3, day: 14, hour: 11, minute: 30, tzOffsetMinutes: 0, lat: 48.4, lon: 10.0, houseSystem: 'placidus' }));
console.log('  爱因斯坦（1879-03-14 11:30 LMT 乌尔姆）: 太阳 ' + A.formatLon(einstein.byKey.sun.lon) + ' / 月亮 ' + A.formatLon(einstein.byKey.moon.lon) + ' / 上升 ' + A.formatLon(einstein.angleByKey.asc.lon));
ok('爱因斯坦太阳 ≈ 双鱼座 23°（公开星盘一致）', einstein.byKey.sun.sign.name === '双鱼座' && einstein.byKey.sun.deg > 20 && einstein.byKey.sun.deg < 27, A.formatLon(einstein.byKey.sun.lon));
ok('爱因斯坦月亮 ≈ 射手座（公开星盘一致）', einstein.byKey.moon.sign.name === '射手座', A.formatLon(einstein.byKey.moon.lon));
ok('爱因斯坦上升星座 = 巨蟹座（公开星盘一致）', einstein.angleByKey.asc.sign.name === '巨蟹座', A.formatLon(einstein.angleByKey.asc.lon));

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败\n');
process.exit(fail ? 1 : 0);
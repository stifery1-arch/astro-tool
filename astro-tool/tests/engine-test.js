/* 天文引擎基准测试：用真实天象（日月食、节气、逆行天象）校验 */
const E = require('../js/ephemeris.js');
let pass = 0, fail = 0;
function ok(name, cond, info) {
  if (cond) { pass++; console.log('  PASS  ' + name + (info ? '  ' + info : '')); }
  else { fail++; console.log('  FAIL  ' + name + (info ? '  ' + info : '')); }
}
function posAt(y, m, d, h, mi) {
  const jd = E.julianDay(y, m, d + (h + (mi || 0) / 60) / 24);
  return { p: E.planetPositions(jd), jd };
}
function fmt(x) { return x.toFixed(3); }
function angDiff(a, b) { return Math.abs(E.norm180(a - b)); }
function speedOf(jd, key) {
  const a = E.planetPositions(jd).bodies[key].lon;
  const b = E.planetPositions(jd + 1).bodies[key].lon;
  return E.norm180(b - a);
}
function retroStats(year, key) {
  let days = 0, periods = 0, wasRetro = false;
  const start = E.julianDay(year, 1, 1), end = E.julianDay(year + 1, 1, 1);
  for (let jd = start; jd < end; jd += 1) {
    const retro = speedOf(jd, key) < 0;
    if (retro) days++;
    if (retro && !wasRetro) periods++;
    wasRetro = retro;
  }
  return { days, periods };
}

console.log('\n== 太阳黄经基准（回归黄道，当日真黄经）==');
let t = posAt(2000, 1, 1, 12);
ok('J2000.0 太阳真黄经 ≈ 280.38°', angDiff(t.p.bodies.sun.lon, 280.38) < 0.03, '算出 ' + fmt(t.p.bodies.sun.lon));
t = posAt(2026, 9, 27, 12);
ok('2026-09-27 太阳 ≈ 天秤座 4.4°', angDiff(t.p.bodies.sun.lon, 184.4) < 0.3, '算出 ' + fmt(t.p.bodies.sun.lon) + '°');
t = posAt(2026, 3, 20, 14, 46);
ok('2026 春分 太阳 ≈ 0° 白羊', angDiff(t.p.bodies.sun.lon, 0) < 0.05, '算出 ' + fmt(t.p.bodies.sun.lon) + '°');
t = posAt(2026, 6, 21, 8, 25);
ok('2026 夏至 太阳 ≈ 90° 巨蟹', angDiff(t.p.bodies.sun.lon, 90) < 0.05, '算出 ' + fmt(t.p.bodies.sun.lon) + '°');
t = posAt(2026, 12, 21, 20, 50);
ok('2026 冬至 太阳 ≈ 270° 摩羯', angDiff(t.p.bodies.sun.lon, 270) < 0.05, '算出 ' + fmt(t.p.bodies.sun.lon) + '°');

console.log('\n== 日月合朔 / 望（日食月食时刻，最严格的月亮精度检验）==');
t = posAt(2026, 8, 12, 17, 46);
ok('2026-08-12 日全食 = 新月', Math.abs(E.norm180(t.p.bodies.moon.lon - t.p.bodies.sun.lon)) < 0.6,
  '日月距角 ' + fmt(E.norm180(t.p.bodies.moon.lon - t.p.bodies.sun.lon)) + '°');
ok('  同日月亮黄纬接近 0', Math.abs(t.p.bodies.moon.lat) < 1.0, '黄纬 ' + fmt(t.p.bodies.moon.lat) + '°');
t = posAt(2026, 2, 17, 12, 13);
ok('2026-02-17 日环食 = 新月', Math.abs(E.norm180(t.p.bodies.moon.lon - t.p.bodies.sun.lon)) < 0.6,
  '日月距角 ' + fmt(E.norm180(t.p.bodies.moon.lon - t.p.bodies.sun.lon)) + '°');
t = posAt(2026, 3, 3, 11, 34);
ok('2026-03-03 月全食 = 满月', Math.abs(Math.abs(E.norm180(t.p.bodies.moon.lon - t.p.bodies.sun.lon)) - 180) < 0.8,
  '日月距角 ' + fmt(E.norm180(t.p.bodies.moon.lon - t.p.bodies.sun.lon)) + '°');
t = posAt(2026, 8, 28, 4, 13);
ok('2026-08-28 月偏食 = 满月', Math.abs(Math.abs(E.norm180(t.p.bodies.moon.lon - t.p.bodies.sun.lon)) - 180) < 0.8,
  '日月距角 ' + fmt(E.norm180(t.p.bodies.moon.lon - t.p.bodies.sun.lon)) + '°');

console.log('\n== 行星逆行结构校验（2026 全年逐日扫描）==');
const sun = retroStats(2026, 'sun'), moon = retroStats(2026, 'moon');
ok('太阳全年不逆行', sun.days === 0, '逆行 ' + sun.days + ' 天');
ok('月亮全年不逆行（地心黄经单调递增）', moon.days === 0, '逆行 ' + moon.days + ' 天');
const me = retroStats(2026, 'mercury');
ok('水星 2026 逆行 55-80 天、3-4 次', me.days >= 55 && me.days <= 80 && me.periods >= 3 && me.periods <= 4,
  me.days + ' 天 / ' + me.periods + ' 次');
const ve = retroStats(2026, 'venus');
ok('金星 2026 逆行 35-48 天、1 次', ve.days >= 35 && ve.days <= 48 && ve.periods === 1, ve.days + ' 天 / ' + ve.periods + ' 次');
const ma = retroStats(2026, 'mars');
ok('火星 2026 不逆行（真实天象）', ma.days === 0, ma.days + ' 天');
const jup = retroStats(2026, 'jupiter');
ok('木星逆行天数符合跨年分段真实天象 (60-150)', jup.days > 60 && jup.days < 150, '木星 ' + jup.days + ' 天 / ' + jup.periods + ' 次');
['saturn', 'uranus', 'neptune', 'pluto'].forEach(k => {
  const s = retroStats(2026, k);
  ok(k + ' 逆行约 4-6 个月（真实天象）', s.days > 110 && s.days < 200, s.days + ' 天 / ' + s.periods + ' 次');
});
ok('speed 计算无异常跳变', (() => {
  let maxJump = 0;
  for (let jd = E.julianDay(2026, 1, 1); jd < E.julianDay(2026, 12, 31); jd += 5) {
    maxJump = Math.max(maxJump, Math.abs(speedOf(jd, 'mercury')));
  }
  return maxJump < 3;
})(), '水星最大日行度 < 3°');

console.log('\n== 宫位几何自洽性 ==');
const chart = E.computeChart({
  year: 1990, month: 6, day: 15, hour: 14, minute: 30,
  tzOffsetMinutes: 480, lat: 39.9042, lon: 116.4074, houseSystem: 'placidus'
});
const epsR = chart.obliquity * Math.PI / 180, phiR = chart.lat * Math.PI / 180;
function horizonF(lam) {
  const L = lam * Math.PI / 180;
  const dec = Math.asin(Math.sin(epsR) * Math.sin(L));
  const ra = Math.atan2(Math.cos(epsR) * Math.sin(L), Math.cos(L));
  const H = chart.lst * Math.PI / 180 - ra;
  return Math.sin(phiR) * Math.sin(dec) + Math.cos(phiR) * Math.cos(dec) * Math.cos(H);
}
ok('上升点位于地平线', Math.abs(horizonF(chart.houses.asc)) < 1e-9, 'f=' + horizonF(chart.houses.asc).toExponential(2));
ok('下降点位于地平线', Math.abs(horizonF(E.norm360(chart.houses.asc + 180))) < 1e-9);
ok('中天赤经 = 本地恒星时', angDiff(E.norm360(Math.atan2(Math.sin(chart.lst * Math.PI / 180), Math.cos(chart.lst * Math.PI / 180) * Math.cos(epsR)) * 180 / Math.PI), chart.houses.mc) < 1e-9);
ok('宫位制 = 普拉西度', chart.houses.system === 'placidus', chart.houses.system);
const c = chart.houses.cusps;
let ordered = true, spanSum = 0;
for (let i = 0; i < 12; i++) {
  const span = E.norm360(c[(i + 1) % 12] - c[i]);
  if (!(span > 0 && span < 180)) { ordered = false; console.log('    跨度异常: 第' + (i + 1) + '宫 = ' + span.toFixed(2)); }
  spanSum += span;
}
ok('12 宫宫头顺序递增', ordered); ok('12 宫跨度合计 360°', Math.abs(spanSum - 360) < 1e-6, spanSum.toFixed(6));
ok('一宫头 = 上升', angDiff(c[0], chart.houses.asc) < 1e-9);
ok('十宫头 = 中天', angDiff(c[9], chart.houses.mc) < 1e-9);
ok('对宫相差 180°', angDiff(E.norm360(c[0] + 180), c[6]) < 1e-9);
ok('Placidus 11/12 宫介于 MC 与 ASC 之间', E.norm360(c[10] - c[9]) > 0 && E.norm360(c[11] - c[10]) > 0 && E.norm360(c[0] - c[11]) > 0);
console.log('  宫头度数: ' + c.map(x => x.toFixed(2)).join(' / '));

console.log('\n== 多地点排盘 ==');
[
  { n: '北京', lat: 39.9, lon: 116.4, sys: 'placidus' },
  { n: '广州', lat: 23.1, lon: 113.3, sys: 'placidus' },
  { n: '乌鲁木齐', lat: 43.8, lon: 87.6, sys: 'placidus' },
  { n: '摩尔曼斯克(北极圈)', lat: 68.97, lon: 33.08, sys: 'placidus' },
  { n: '悉尼(南半球)', lat: -33.87, lon: 151.21, sys: 'placidus' },
  { n: '基多(赤道)', lat: -0.18, lon: -78.47, sys: 'placidus' },
  { n: '纽约', lat: 40.71, lon: -74.01, sys: 'whole' }
].forEach(loc => {
  const ch = E.computeChart({ year: 1995, month: 11, day: 3, hour: 8, minute: 5, tzOffsetMinutes: 480, lat: loc.lat, lon: loc.lon, houseSystem: loc.sys });
  const cc = ch.houses.cusps;
  const finite = cc.every(v => isFinite(v));
  const inc = cc.every((v, i) => E.norm360(cc[(i + 1) % 12] - v) > 0);
  ok(loc.n + ' 排盘成功 (' + ch.houses.system + ')', finite && inc, 'ASC=' + cc[0].toFixed(2) + ' MC=' + cc[9].toFixed(2));
});
const w = E.computeChart({ year: 1990, month: 1, day: 1, hour: 0, minute: 0, tzOffsetMinutes: 480, lat: 39.9, lon: 116.4, houseSystem: 'whole' });
ok('整宫制 12 宫全部为星座起点', w.houses.cusps.every(x => Math.abs(x % 30) < 1e-9));

console.log('\n== 时区与夏令时 ==');
ok('上海 1990-06-15 启用夏令时 → 540 分钟', E.zonedOffsetMinutes('Asia/Shanghai', 1990, 6, 15, 14, 30) === 540);
ok('上海 1993-06-15 已取消夏令时 → 480 分钟', E.zonedOffsetMinutes('Asia/Shanghai', 1993, 6, 15, 14, 30) === 480);
ok('纽约 1990-06-15 夏令时 → -240', E.zonedOffsetMinutes('America/New_York', 1990, 6, 15, 14, 30) === -240);
ok('纽约 1990-01-15 冬令时 → -300', E.zonedOffsetMinutes('America/New_York', 1990, 1, 15, 14, 30) === -300);
ok('伦敦 2026-07-01 夏令时 → +60', E.zonedOffsetMinutes('Europe/London', 2026, 7, 1, 12, 0) === 60);
ok('东京全年 → +540', E.zonedOffsetMinutes('Asia/Tokyo', 2026, 7, 1, 12, 0) === 540);
ok('UTC 世界时 → 0', E.zonedOffsetMinutes('UTC', 2026, 7, 1, 12, 0) === 0);

console.log('\n== 输出字段完整性 ==');
const full = E.computeChart({ year: 2000, month: 1, day: 1, hour: 12, minute: 0, tzOffsetMinutes: 0, lat: 39.9, lon: 116.4, houseSystem: 'placidus' });
const keys = Object.keys(full.bodies);
ok('包含 10 大行星 + 交点', keys.length === 11, keys.join(','));
ok('每颗星都有黄经/黄纬', keys.every(k => isFinite(full.bodies[k].lon) && isFinite(full.bodies[k].lat)));
ok('每颗星都有速度', keys.every(k => isFinite(full.speeds[k])));
ok('土星速度合理', Math.abs(full.speeds.saturn) > 0.0 && Math.abs(full.speeds.saturn) < 0.2, '土星 ' + full.speeds.saturn.toFixed(4) + '°/天');
ok('月亮速度 11-15°/天', Math.abs(full.speeds.moon) > 11 && Math.abs(full.speeds.moon) < 15.5, '月亮 ' + full.speeds.moon.toFixed(3) + '°/天');

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败\n');
process.exit(fail ? 1 : 0);
/* 压力测试：全球纬度 × 全年日期 × 全天时刻，验证宫位计算永不退化、永不 NaN */
const E = require('../js/ephemeris.js');
const A = require('../js/astro.js');
let pass = 0, fail = 0, fallback = 0, worstSpan = 0, total = 0;
const problems = [];
function ok(name, cond, info) {
  if (cond) { pass++; } else { fail++; console.log('  FAIL  ' + name + '  ' + (info || '')); }
}
const lats = [-66, -55, -40, -23.5, -8, 0, 8, 23.5, 40, 55, 62, 66];
const months = [1, 3, 6, 9, 11];
const hours = [0, 3, 6, 9, 12, 15, 18, 21];
const systems = ['placidus', 'whole', 'equal', 'porphyry'];
let minSpan = 999, maxSpan = 0;
lats.forEach(lat => {
  months.forEach(mo => {
    hours.forEach(hh => {
      systems.forEach(sys => {
        total++;
        const ch = E.computeChart({
          year: 1975 + ((lat + mo + hh) % 60), month: mo, day: 12, hour: hh, minute: 30,
          tzOffsetMinutes: 0, lat: lat, lon: (lat * 2) % 180, houseSystem: sys
        });
        const c = ch.houses.cusps;
        if (!c.every(v => isFinite(v))) problems.push('NaN cusp lat=' + lat + ' mo=' + mo + ' h=' + hh + ' ' + sys);
        const spans = c.map((v, i) => E.norm360(c[(i + 1) % 12] - v));
        if (!spans.every(s => s > 0.0001 && s < 359.9999)) {
          problems.push('span out of range lat=' + lat + ' mo=' + mo + ' h=' + hh + ' ' + sys + ' -> ' + spans.map(x => x.toFixed(2)).join(','));
        }
        if (!ch.bodies.sun || !isFinite(ch.bodies.sun.lon)) problems.push('sun NaN');
        spans.forEach(s => { minSpan = Math.min(minSpan, s); maxSpan = Math.max(maxSpan, s); });
        if (ch.houses.fallback) fallback++;
      });
    });
  });
});
ok('全球 ' + total + ' 组排盘无 NaN / 无乱序', problems.length === 0, problems.slice(0, 5).join(' | '));
console.log('  宫位跨度范围: ' + minSpan.toFixed(2) + '° ~ ' + maxSpan.toFixed(2) + '°   高纬度降级次数: ' + fallback + ' / ' + total);

console.log('\n== 与已知资料交叉验证（多张公开星盘）==');
const cases = [
  { n: '爱因斯坦 1879-03-14 11:30 乌尔姆', y: 1879, mo: 3, d: 14, h: 11, mi: 30, lat: 48.4, lon: 10.0, tz: null,
    sun: '双鱼座', moon: '射手座', asc: '巨蟹座' },
  { n: '玛丽莲·梦露 1926-06-01 09:30 洛杉矶', y: 1926, mo: 6, d: 1, h: 9, mi: 30, lat: 34.05, lon: -118.24, tz: 'America/Los_Angeles',
    sun: '双子座', moon: '水瓶座', asc: '狮子座' },
  { n: '乔布斯 1955-02-24 19:15 旧金山', y: 1955, mo: 2, d: 24, h: 19, mi: 15, lat: 37.77, lon: -122.42, tz: 'America/Los_Angeles',
    sun: '双鱼座', moon: '白羊座', asc: '处女座' },
  { n: 'Lady Gaga 1986-03-28 16:00 纽约(出生时间存疑,仅校验日月)', y: 1986, mo: 3, d: 28, h: 16, mi: 0, lat: 40.71, lon: -74.01, tz: 'America/New_York',
    sun: '白羊座', moon: '天蝎座', asc: null }
];
cases.forEach(cs => {
  const tzOff = cs.tz ? E.zonedOffsetMinutes(cs.tz, cs.y, cs.mo, cs.d, cs.h, cs.mi) : 0;
  const ch = A.build(E.computeChart({
    year: cs.y, month: cs.mo, day: cs.d, hour: cs.h, minute: cs.mi, tzOffsetMinutes: tzOff,
    lat: cs.lat, lon: cs.lon, houseSystem: 'placidus'
  }));
  const s = ch.byKey.sun.sign.name, m = ch.byKey.moon.sign.name, a = ch.angleByKey.asc.sign.name;
  console.log('  ' + cs.n + ' → 太阳' + s + '(' + ch.byKey.sun.degText + ') 月亮' + m + '(' + ch.byKey.moon.degText + ') 上升' + a + '(' + ch.angleByKey.asc.degText + ')');
  ok(cs.n + ' 太阳星座吻合', s === cs.sun);
  ok(cs.n + ' 月亮星座吻合', m === cs.moon);
  if (cs.asc) { ok(cs.n + ' 上升星座吻合', a === cs.asc); } else { console.log('  （出生时间评级存疑，跳过上升校验）'); }
});

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败\n');
process.exit(fail ? 1 : 0);
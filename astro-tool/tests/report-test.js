/* 付费报告模块测试：模型、章节、水印、行运、HTML 排版 */
const E = require('../js/ephemeris.js'), A = require('../js/astro.js'), T = require('../js/interpretations.js'), R = require('../js/report.js');
let pass = 0, fail = 0;
function ok(name, cond, info) {
  if (cond) { pass++; console.log('  PASS  ' + name + (info ? '  ' + info : '')); }
  else { fail++; console.log('  FAIL  ' + name + (info ? '  ' + info : '')); }
}
function chart(city) {
  const raw = E.computeChart({ year: 1995, month: 8, day: 18, hour: 9, minute: 20, tzOffsetMinutes: 480, lat: 30.2741, lon: 120.1551, houseSystem: 'placidus' });
  raw.input = { name: '小星', dateText: '1995-08-18 09:20', placeName: '杭州（UTC+8）', lat: 30.2741, lon: 120.1551, unknownTime: false };
  const ch = A.build(raw);
  return { chart: ch, report: T.report(ch) };
}

console.log('\n== 报告模型 ==');
const { chart: ch, report: rep } = chart();
const m = R.model(ch, rep, { author: '星语星盘', client: '小星', orderNo: '20260927001', contact: '微信 astro-demo-001', watermark: '仅限 小星 使用' });
ok('有 6 个章节', m.chapters.length === 6, m.chapters.map(c => c.num).join('/'));
ok('章节编号连续', m.chapters.every((c, i) => c.num === ('0' + (i + 1))));
ok('每章都有内容块', m.chapters.every(c => c.blocks.length > 0));
ok('报告编号格式正确', /^XY\d{6}-[0-9A-Z]{5}$/.test(m.meta.reportNo), m.meta.reportNo);
ok('同一星盘的报告编号稳定', R.makeReportNo(ch.input) === R.makeReportNo(ch.input));
ok('不同星盘报告编号不同', R.makeReportNo(ch.input) !== R.makeReportNo({ name: '别人', dateText: '2000-01-01 08:00', placeName: '北京' }));
ok('客户/订单/署名写入元数据', m.meta.client === '小星' && m.meta.orderNo === '20260927001' && m.meta.author === '星语星盘');
ok('水印已写入', m.meta.watermark === '仅限 小星 使用');

console.log('\n== 章节内容完整性 ==');
const c1 = m.chapters[0].blocks, c2 = m.chapters[1].blocks, c3 = m.chapters[2].blocks, c5 = m.chapters[4].blocks;
ok('第 1 章含三大主星卡 + 星盘图 + 行星表', c1.some(b => b.t === 'cards3') && c1.some(b => b.t === 'wheel') && c1.some(b => b.t === 'table'));
ok('第 1 章行星表 = 10 行', c1.filter(b => b.t === 'table')[0].rows.length === 10);
ok('第 2 章含 10 颗行星的解读段', c2.filter(b => b.t === 'p').length >= 10);
ok('第 2 章含十二宫位表（12 行）', c2.filter(b => b.t === 'table')[0].rows.length === 12);
ok('第 3 章含相位表与详解', c3.filter(b => b.t === 'table')[0].rows.length > 0 && c3.filter(b => b.t === 'p').length > 0);
ok('第 5 章含行运表', c5.some(b => b.t === 'table'));
ok('未来一年行运节点 1-10 条', R.yearTransits(ch, 12).length >= 1 && R.yearTransits(ch, 12).length <= 10, R.yearTransits(ch, 12).length + ' 条');
ok('行运节点按重要度排序（外行星优先）', (() => {
  const list = R.yearTransits(ch, 12);
  const heavy = ['pluto', 'neptune', 'uranus', 'saturn'];
  return !list.length || heavy.indexOf(list[0].transiting) >= 0;
})(), R.yearTransits(ch, 12)[0] ? ('第一条: 行运' + R.yearTransits(ch, 12)[0].transitingName) : '');
ok('成长建议 4-8 条', R.suggestions(ch).length >= 4 && R.suggestions(ch).length <= 8, R.suggestions(ch).length + ' 条');

console.log('\n== HTML 排版 ==');
const html = R.renderHTML(m, '<svg id="wheel"></svg>');
ok('含封面 + 目录 + 6 章 = 8 个 A4 区块', (html.match(/class="a4-page/g) || []).length === 8);
ok('封面含客户名与报告编号', html.includes('小星') && html.includes(m.meta.reportNo));
ok('含星盘 SVG', html.includes('<svg id="wheel">'));
ok('含水印层', html.includes('class="wm"') && html.includes('仅限 小星 使用'));
ok('含免责声明', html.includes('免责声明'));
ok('含计算说明（回归黄道）', html.includes('回归黄道'));
ok('表格数量 = 4', (html.match(/class="rep-table/g) || []).length === 4);
ok('HTML 转义生效（防止注入）', (() => {
  const bad = R.model(ch, rep, { client: '<script>alert(1)</script>', author: 'a&b', watermark: '<img>' });
  const h = R.renderHTML(bad, '');
  return !h.includes('<script>alert(1)</script>') && h.includes('&lt;script&gt;') && !h.includes('<img>');
})());

console.log('\n== 无出生时间 / 无联系方式场景 ==');
const m2 = R.model(ch, rep, { client: '', contact: '', watermark: '' });
ok('客户留空时回退到昵称', m2.meta.client === '小星');
ok('水印留空时不渲染水印层', !R.renderHTML(m2, '').includes('class="wm"'));
const raw2 = E.computeChart({ year: 1988, month: 3, day: 8, hour: 12, minute: 0, tzOffsetMinutes: 480, lat: 39.9, lon: 116.4, houseSystem: 'placidus' });
raw2.input = { name: '未知时间', dateText: '1988-03-08 12:00', placeName: '北京', lat: 39.9, lon: 116.4, unknownTime: true };
const ch2 = A.build(raw2), rep2 = T.report(ch2);
const m3 = R.model(ch2, rep2, {});
ok('出生时间不详时目录页有提示', R.renderHTML(m3, '').includes('未提供准确出生时间'));

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败\n');
process.exit(fail ? 1 : 0);
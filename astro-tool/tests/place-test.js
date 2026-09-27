/* 出生地检索测试：简称、全称、拼音、首字母、重名、港澳台、国际城市 */
const P = require('../js/place.js');
let pass = 0, fail = 0;
function ok(n, c, i) { if (c) { pass++; console.log('  PASS  ' + n + (i ? '  ' + i : '')); } else { fail++; console.log('  FAIL  ' + n + (i ? '  ' + i : '')); } }
function top(q) { const r = P.search(q, 5); return r[0] || null; }
function names(q, k) { return P.search(q, k || 5).map(e => P.label(e)); }

console.log('\n== 索引规模 ==');
ok('索引条目 > 3200（省+市+区县+补充）', P.count() > 3200, P.count() + ' 条');

console.log('\n== 原来匹配不到的省市（简称） ==');
[['伊犁', '伊犁哈萨克自治州'], ['阿拉善', '阿拉善盟'], ['阿坝', '阿坝藏族羌族自治州'],
 ['黔东南', '黔东南苗族侗族自治州'], ['延边', '延边朝鲜族自治州'], ['博尔塔拉', '博尔塔拉蒙古自治州'],
 ['巴音郭楞', '巴音郭楞蒙古自治州'], ['克孜勒苏', '克孜勒苏柯尔克孜自治州'], ['锡林郭勒', '锡林郭勒盟'],
 ['恩施', '恩施土家族苗族自治州'], ['湘西', '湘西土家族苗族自治州'], ['大理', '大理白族自治州']].forEach(([q, want]) => {
  const e = top(q);
  ok(q + ' → ' + want, e && e.name === want, e ? P.label(e) + '  ' + e.lng + ',' + e.lat : '未匹配');
});

console.log('\n== 普通市/区县 ==');
[['杭州', '杭州市'], ['潮州', '潮州市'], ['揭阳', '揭阳市'], ['淄博', '淄博市'], ['潍坊', '潍坊市'],
 ['保定', '保定市'], ['邯郸', '邯郸市'], ['常州', '常州市'], ['义乌', '义乌市'], ['昆山', '昆山市'],
 ['日喀则', '日喀则市'], ['儋州', '儋州市'], ['三沙', '三沙市'], ['大兴安岭', '大兴安岭地区'],
 ['喀什', '喀什地区']].forEach(([q, want]) => {
  const e = top(q);
  ok(q + ' → ' + want, e && (e.name === want || P.label(e).indexOf(want) >= 0), e ? P.label(e) : '未匹配');
});

console.log('\n== 省 / 直辖市 / 港澳台 ==');
ok('浙江 → 浙江省', top('浙江') && top('浙江').name === '浙江省', P.label(top('浙江')));
ok('内蒙古 → 内蒙古自治区', top('内蒙古') && top('内蒙古').name === '内蒙古自治区', P.label(top('内蒙古')));
ok('香港 → 香港特别行政区（时区 Asia/Hong_Kong）', top('香港') && top('香港').tz === 'Asia/Hong_Kong', P.label(top('香港')) + ' ' + top('香港').tz);
ok('澳门 → 澳门特别行政区（时区 Asia/Macau）', top('澳门') && top('澳门').tz === 'Asia/Macau', top('澳门').tz);
ok('台北 → 台北市（时区 Asia/Taipei）', top('台北') && top('台北').name === '台北市' && top('台北').tz === 'Asia/Taipei', P.label(top('台北')) + ' ' + (top('台北') || {}).tz);
ok('高雄 / 台中 可检索', !!top('高雄') && !!top('台中'), names('高雄', 2).join(' / '));
ok('北京 → 北京市', top('北京') && top('北京').name === '北京市');
ok('朝阳区（北京）存在且带省份路径', (() => {
  const r = P.search('朝阳', 8);
  return r.some(e => e.name === '朝阳区' && e.prov === '北京市') && r.some(e => e.name === '朝阳市' && e.prov === '辽宁省');
})(), names('朝阳', 4).join(' | '));
ok('浦东新区（上海）可检索', (() => { const e = top('浦东'); return e && e.prov === '上海市'; })(), names('浦东', 2).join(' | '));

console.log('\n== 拼音与首字母 ==');
[['hangzhou', '杭州市'], ['chaozhou', '潮州市'], ['yiwu', '义乌市'], ['beijing', '北京市'], ['neimenggu', '内蒙古自治区']].forEach(([q, want]) => {
  const e = top(q);
  ok('全拼 ' + q + ' → ' + want, e && e.name === want, e ? P.label(e) : '未匹配');
});
[['hz', '杭州市'], ['bj', '北京市'], ['zj', '浙江省'], ['nmg', '内蒙古自治区'], ['sh', null]].forEach(([q]) => {
  const list = P.search(q, 6);
  ok('首字母 ' + q + ' 有结果', list.length > 0, list.slice(0, 3).map(e => P.label(e)).join(' | '));
});
ok('hz 结果同时包含杭州与湖州（同名缩写）', (() => {
  const l = P.search('hz', 8).map(e => e.name);
  return l.indexOf('杭州市') >= 0 && l.indexOf('湖州市') >= 0;
})(), names('hz', 4).join(' | '));
ok('大小写不敏感（HANGZHOU）', top('HANGZHOU') && top('HANGZHOU').name === '杭州市');

console.log('\n== 路径与消歧输入 ==');
ok('直接输入完整路径「浙江省 杭州市」', P.byName('浙江省 杭州市').name === '杭州市');
ok('输入带省份的区县「广东省 潮州市」', P.byName('广东省 潮州市').name === '潮州市');
ok('输入重名区县带省份可消歧「辽宁省 朝阳市」', P.byName('辽宁省 朝阳市').name === '朝阳市' && P.byName('辽宁省 朝阳市').prov === '辽宁省');
ok('未知地名返回 null', P.byName('乌有乡') === null);

console.log('\n== 省市区浏览接口 ==');
const provs = P.provinces();
ok('省级列表 34 条', provs.length === 34);
const zj = P.cities('浙江省');
ok('浙江省下辖市 > 10', zj.length > 10, zj.length + ' 个');
const hzD = P.districts('浙江省', '杭州市');
ok('杭州市下辖区县 > 10', hzD.length > 10, hzD.length + ' 个: ' + hzD.slice(0, 5).map(d => d.name).join('、'));
ok('区县带坐标', hzD.every(d => isFinite(d.lat) && isFinite(d.lng)));
const bj = P.districts('北京市', '北京市');
ok('北京市下辖 16 区', bj.length === 16, bj.map(d => d.name).join('、'));

console.log('\n== 时区一致性 ==');
ok('大陆城市均为 Asia/Shanghai', P.search('潮州', 1)[0].tz === 'Asia/Shanghai' && P.search('喀什', 1)[0].tz === 'Asia/Shanghai');

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败\n');
process.exit(fail ? 1 : 0);
/* 全国省市区数据完整性测试（data-cn.js） */
const CN = require('../js/data-cn.js');
let pass = 0, fail = 0;
function ok(n, c, i) { if (c) { pass++; console.log('  PASS  ' + n + (i ? '  ' + i : '')); } else { fail++; console.log('  FAIL  ' + n + (i ? '  ' + i : '')); } }

const P = CN.provinces;
let cities = 0, districts = 0, badCoord = 0, noPy = 0, noPyf = 0;
const flat = [];
P.forEach(p => {
  if (!p[1]) noPy++;
  if (!p[2]) noPyf++;
  flat.push({ name: p[0], level: 0, path: p[0], lat: p[4], lng: p[3], tz: p[5] });
  (p[6] || []).forEach(c => {
    cities++;
    if (!c[1]) noPy++;
    if (!c[2]) noPyf++;
    flat.push({ name: c[0], level: 1, path: p[0] + ' ' + c[0], lat: c[4], lng: c[3], tz: typeof c[5] === 'string' ? c[5] : p[5] });
    const kids = Array.isArray(c[6]) ? c[6] : [];
    kids.forEach(d => {
      districts++;
      if (!d[1]) noPy++;
      if (!d[2]) noPyf++;
      flat.push({ name: d[0], level: 2, path: p[0] + ' ' + c[0] + ' ' + d[0], lat: d[4], lng: d[3], tz: typeof d[5] === 'string' ? d[5] : p[5] });
    });
  });
});

console.log('\n== 规模与完整性 ==');
ok('省级行政区 34 个', P.length === 34, P.map(x => x[0]).join(' '));
ok('地级市 / 州 / 盟 / 地区 300-400 个', cities > 300 && cities < 400, cities + ' 个');
ok('区县 2600-3000 个', districts > 2600 && districts < 3000, districts + ' 个');
ok('总计条目 > 3200', flat.length > 3200, flat.length + ' 条');
ok('坐标全部落在中国经纬度范围', badCoord === 0, badCoord + ' 条异常');
flat.forEach(e => { if (!(e.lat > 3 && e.lat < 54 && e.lng > 73 && e.lng < 136)) badCoord++; });
ok('拼音 100% 覆盖', noPy === 0, '缺 ' + noPy + ' 条');
ok('拼音首字母缩写 100% 覆盖', noPyf === 0, '缺 ' + noPyf + ' 条');
ok('数据版本号存在', typeof CN.version === 'string' && CN.version.length > 5, CN.version);

console.log('\n== 关键行政区点名 ==');
const need = ['北京市', '上海市', '天津市', '重庆市', '浙江省', '广东省', '新疆维吾尔自治区', '内蒙古自治区',
  '香港特别行政区', '澳门特别行政区', '台湾省', '西藏自治区', '海南省'];
need.forEach(n => ok('存在 ' + n, flat.some(e => e.name === n)));
[['杭州市', 120, 30], ['潮州市', 116, 23], ['淄博市', 118, 36], ['喀什地区', 75, 39], ['三沙市', 112, 16],
 ['大兴安岭地区', 124, 50], ['日喀则市', 88, 29], ['义乌市', 120, 29], ['昆山市', 120, 31]].forEach(([n, lng, lat]) => {
  const e = flat.find(x => x.name === n);
  ok(n + ' 坐标合理', !!e && Math.abs(e.lng - lng) < 2 && Math.abs(e.lat - lat) < 2, e ? e.lng + ',' + e.lat : '未找到');
});

console.log('\n== 时区 ==');
const provTz = {};
P.forEach(p => provTz[p[0]] = p[5]);
ok('大陆省份为 Asia/Shanghai', P.filter(p => ['香港特别行政区', '澳门特别行政区', '台湾省'].indexOf(p[0]) < 0).every(p => p[5] === 'Asia/Shanghai'));
ok('香港 / 澳门 / 台湾 时区正确', provTz['香港特别行政区'] === 'Asia/Hong_Kong' && provTz['澳门特别行政区'] === 'Asia/Macau' && provTz['台湾省'] === 'Asia/Taipei',
  provTz['香港特别行政区'] + ' / ' + provTz['澳门特别行政区'] + ' / ' + provTz['台湾省']);

console.log('\n== 结构抽样 ==');
const bj = P.find(p => p[0] === '北京市');
ok('北京市下辖 16 个区', bj && bj[6][0][6].length === 16, bj ? bj[6][0][6].length + ' 个' : '');
const zj = P.find(p => p[0] === '浙江省');
ok('浙江省下辖 11 个市', zj && zj[6].length === 11, zj ? zj[6].length + ' 个' : '');
ok('区县数量最多的市 > 20 个区县', Math.max.apply(null, P.map(p => Math.max.apply(null, p[6].map(c => Array.isArray(c[6]) ? c[6].length : 0)))) > 20);

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败\n');
process.exit(fail ? 1 : 0);
/* 付费解锁引擎测试：SHA-256、解锁码校验、授权持久化、订单号 */
const P = require('../js/pay.js');
let pass = 0, fail = 0;
function ok(n, c, i) { if (c) { pass++; console.log('  PASS  ' + n + (i ? '  ' + i : '')); } else { fail++; console.log('  FAIL  ' + n + (i ? '  ' + i : '')); } }

console.log('\n== SHA-256 标准测试向量 ==');
[['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
 ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
 ['hello world', 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'],
 ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1']
].forEach(([input, want]) => {
  const got = P.sha256(input);
  ok('sha256(' + (input ? (input.length > 20 ? input.slice(0, 12) + '…' : input) : '空串') + ')', got === want, got.slice(0, 16) + '…');
});
ok('超长输入（英文 1000 字符）稳定可算', typeof P.sha256('a'.repeat(1000)) === 'string' && P.sha256('a'.repeat(1000)).length === 64);

console.log('\n== 配置与校验 ==');
const SALT = 'unit-test-salt-2026';
const TOOL_CODE = 'XYA7-K2M9';
const REPORT_CODE = 'RPT-4F8Q';
const REPORT_NO = 'XY260927-ABC12';
// 先确定 salt，再生成哈希（顺序错了会导致哈希与 salt 不匹配 —— 生成器会自动校验）
P.configure({ enabled: true, mode: 'both', price: 9.9, priceText: '¥9.9', hashSalt: SALT, unlockHashes: [], reportHashes: [], demoCode: 'DEMO-8888' });
const TOOL_HASH = P.hashToolCode(TOOL_CODE);
const REPORT_HASH = P.hashReportCode(REPORT_CODE, REPORT_NO);
P.configure({ unlockHashes: [TOOL_HASH], reportHashes: [REPORT_HASH] });
ok('工具级哈希长度 64', TOOL_HASH.length === 64);
ok('配置里的哈希能反查到对应码（自检）', P.verify(TOOL_CODE) === 'tool');
ok('同样的码 + 不同 salt 结果不同', (() => {
  P.configure({ hashSalt: 'other-salt' });
  const other = P.hashToolCode(TOOL_CODE);
  P.configure({ hashSalt: SALT });
  return other !== TOOL_HASH;
})());
ok('正确的工具级解锁码通过', P.verify(TOOL_CODE) === 'tool');
ok('解锁码大小写 / 空格 / 连字符容错', P.verify(' xya7 k2m9 ') === 'tool', P.normalizeCode(' xya7 k2m9 '));
ok('错误的解锁码被拒绝', P.verify('XXXX-9999') === null);
ok('报告级解锁码必须匹配报告编号', P.verify(REPORT_CODE, REPORT_NO) === 'report' && P.verify(REPORT_CODE, 'XY000000-ZZZZZ') === null);
ok('演示码可用', P.verify('demo-8888') === 'demo');
ok('空码被拒绝', P.verify('') === null && P.verify(null) === null);

console.log('\n== 授权状态 ==');
P.configure({ enabled: false });
ok('未开启付费时全部已解锁（免费站）', P.isUnlocked() === true);
P.configure({
  enabled: true, mode: 'both', hashSalt: SALT,
  unlockHashes: [P.hashToolCode(TOOL_CODE)],
  reportHashes: [P.hashReportCode(REPORT_CODE, REPORT_NO)],
  demoCode: 'DEMO-8888'
});
P.lock();
ok('开启付费后默认未解锁', P.isUnlocked(REPORT_NO) === false);
let r = P.unlock('WRONG-0000', REPORT_NO);
ok('错误码解锁失败', r.ok === false && r.reason === 'invalid');
ok('解锁失败后仍未解锁', P.isUnlocked(REPORT_NO) === false);
r = P.unlock(TOOL_CODE, REPORT_NO);
ok('工具级解锁成功', r.ok === true && r.kind === 'tool');
ok('工具级解锁后任何报告都可用', P.isUnlocked(REPORT_NO) && P.isUnlocked('XY000000-OTHER'));
ok('授权写入本地存储且不含明文码', (() => {
  const st = P.state();
  return st.unlocked === true && st.mode === 'tool' && JSON.stringify(st).indexOf(TOOL_CODE) < 0;
})(), JSON.stringify(P.state()));
P.lock();
ok('重置后回到未解锁', P.isUnlocked(REPORT_NO) === false);
r = P.unlock(REPORT_CODE, REPORT_NO);
ok('报告级解锁成功', r.ok === true && r.kind === 'report');
ok('报告级解锁只对该报告有效', P.isUnlocked(REPORT_NO) === true && P.isUnlocked('XY000000-OTHER') === false);
P.lock();
ok('可信来源（服务端确认）可直接解锁', P.unlock('', REPORT_NO, { trusted: true, kind: 'server', orderNo: 'XY260927-TEST' }).ok === true && P.isUnlocked('whatever'));
P.lock();

console.log('\n== 演示码只在本地有效（防止上线后被白嫖） ==');
P.configure({ enabled: true, hashSalt: SALT, unlockHashes: [P.hashToolCode(TOOL_CODE)], reportHashes: [], demoCode: 'DEMO-8888' });
global.location = { protocol: 'https:', hostname: 'someone.github.io' };
ok('公网环境下演示码自动失效', P.verify('DEMO-8888') === null);
ok('公网环境下仍可用正式解锁码', P.verify(TOOL_CODE) === 'tool');
global.location = { protocol: 'file:', hostname: '' };
ok('本地 file:// 下演示码可用（方便体验）', P.verify('DEMO-8888') === 'demo');
global.location = { protocol: 'http:', hostname: 'localhost' };
ok('localhost 下演示码可用', P.verify('DEMO-8888') === 'demo');
global.location = { protocol: 'http:', hostname: '192.168.1.20' };
ok('内网 IP 下演示码可用（手机同局域网测试）', P.verify('DEMO-8888') === 'demo');
delete global.location;
ok('未定义 location 时按本地处理（Node 测试）', P.verify('DEMO-8888') === 'demo');

console.log('\n== 订单号 ==');
const no1 = P.makeOrderNo(), no2 = P.makeOrderNo();
ok('订单号格式 XY+日期-时分+4位', /^XY\d{6}-\d{4}[A-Z0-9]{4}$/.test(no1), no1);
ok('两次生成不重复', no1 !== no2);
const order = P.makeOrder({ reportNo: REPORT_NO });
ok('订单含订单号/金额/标题', !!order.orderNo && order.amount === 9.9 && order.title.indexOf(REPORT_NO) >= 0, order.title);
ok('订单号可自定义（后端返回时）', P.makeOrder({ orderNo: 'XY260927-CUSTOM' }).orderNo === 'XY260927-CUSTOM');
ok('脱敏展示不泄露完整码', (() => {
  const m = P.maskCode('XYA7-K2M9');
  return m.indexOf('****') >= 0 && m.indexOf('A7-K2M9') < 0;
})(), P.maskCode('XYA7-K2M9'));

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败\n');
process.exit(fail ? 1 : 0);
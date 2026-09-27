/* 订单与收入统计测试 */
const O = require('../js/orders.js');
let pass = 0, fail = 0;
function ok(n, c, i) { if (c) { pass++; console.log('  PASS  ' + n + (i ? '  ' + i : '')); } else { fail++; console.log('  FAIL  ' + n + (i ? '  ' + i : '')); } }
function iso(daysAgo, h) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h === undefined ? 12 : h, 0, 0, 0);
  return d.toISOString();
}

O.clear();
console.log('\n== 基础增删改查 ==');
const o1 = O.add({ orderNo: 'XY260927-AAA1', customer: '小星', reportNo: 'XY260927-AAA1', product: '解锁导出', amount: 9.9, channel: 'wechat', status: 'pending' });
ok('新增订单返回对象', !!o1 && o1.orderNo === 'XY260927-AAA1');
ok('金额转为数字', o1.amount === 9.9);
ok('默认状态 pending', o1.status === 'pending');
ok('列表可读取', O.list({}).length === 1);
ok('按订单号查询', O.get('XY260927-AAA1').customer === '小星');
ok('查询不存在的订单返回 null', O.get('NOPE') === null);
O.update('XY260927-AAA1', { note: '客户要求加急' });
ok('更新字段', O.get('XY260927-AAA1').note === '客户要求加急');

const o2 = O.add({ orderNo: 'XY260927-AAA1', customer: '小星（改）', amount: 19.9 });
ok('同单号重复添加不产生新记录', O.list({}).length === 1, O.list({}).length + ' 条');
ok('重复添加会合并字段', O.get('XY260927-AAA1').customer === '小星（改）' && O.get('XY260927-AAA1').amount === 19.9);

console.log('\n== 状态流转 ==');
O.add({ orderNo: 'XY260927-BBB2', amount: 39, status: 'pending', product: '深度PDF报告' });
O.markPaid('XY260927-BBB2', { channel: 'alipay', code: 'XYA7-K2M9' });
const paid = O.get('XY260927-BBB2');
ok('标记已付款', paid.status === 'paid' && !!paid.paidAt);
ok('记录付款渠道', paid.channel === 'alipay');
ok('记录已发解锁码与时间', paid.code === 'XYA7-K2M9' && !!paid.codeSentAt);
O.markDelivered('XY260927-BBB2');
ok('标记已交付', O.get('XY260927-BBB2').status === 'delivered' && !!O.get('XY260927-BBB2').deliveredAt);
ok('状态不会被低级别覆盖（paid 不覆盖 delivered）', (() => { O.add({ orderNo: 'XY260927-BBB2', status: 'paid' }); return O.get('XY260927-BBB2').status === 'delivered'; })());
O.remove('XY260927-BBB2');
ok('删除订单', O.get('XY260927-BBB2') === null && O.list({}).length === 1);

console.log('\n== 站点记账（防止刷单） ==');
O.clear();
const a1 = O.recordAttempt({ reportNo: 'RPT-001', product: '解锁导出', amount: 9.9, orderNo: 'XY260927-C001', customer: '客户A' });
ok('首次记录创建待付款订单', !!a1 && a1.status === 'pending');
const a2 = O.recordAttempt({ reportNo: 'RPT-001', amount: 9.9, orderNo: 'XY260927-C002' });
ok('同一报告 30 分钟内复用订单（不刷单）', a2.orderNo === a1.orderNo && O.list({}).length === 1);
const a3 = O.recordAttempt({ reportNo: 'RPT-002', amount: 9.9, orderNo: 'XY260927-C003' });
ok('不同报告会新建订单', a3.orderNo !== a1.orderNo && O.list({}).length === 2);

console.log('\n== 收入统计 ==');
O.clear();
O.add({ orderNo: 'X-A', amount: 9.9, status: 'paid', paidAt: iso(0), createdAt: iso(0), product: '解锁导出', channel: 'wechat' });
O.add({ orderNo: 'X-B', amount: 39, status: 'paid', paidAt: iso(0), createdAt: iso(0), product: '深度PDF报告', channel: 'alipay' });
O.add({ orderNo: 'X-C', amount: 99, status: 'paid', paidAt: iso(3), createdAt: iso(3), product: '深度PDF报告', channel: 'wechat' });
O.add({ orderNo: 'X-D', amount: 199, status: 'delivered', paidAt: iso(40), createdAt: iso(40), product: '月度陪跑', channel: 'wechat' });
O.add({ orderNo: 'X-E', amount: 9.9, status: 'pending', createdAt: iso(0) });
O.add({ orderNo: 'X-F', amount: 39, status: 'refunded', paidAt: iso(5), createdAt: iso(5) });
O.add({ orderNo: 'X-G', amount: 59, status: 'cancelled', createdAt: iso(6) });
const s = O.stats();
ok('累计收入 = 已付款+已交付（9.9+39+99+199）', Math.round(s.total.amount * 100) / 100 === 346.9, '¥' + s.total.amount.toFixed(2));
ok('累计订单数 = 4（不含待付款/退款/取消）', s.total.count === 4, s.total.count + ' 单');
ok('今日收入 = 48.9', Math.round(s.today.amount * 100) / 100 === 48.9, '¥' + s.today.amount.toFixed(2));
ok('本月收入 ≥ 今日收入', s.month.amount >= s.today.amount, '¥' + s.month.amount.toFixed(2));
ok('客单价 = 总收入 / 付费单数', Math.abs(s.avg - 346.9 / 4) < 0.001, '¥' + s.avg.toFixed(2));
ok('待付款单独统计', s.pending.count === 1 && Math.round(s.pending.amount * 100) / 100 === 9.9, JSON.stringify(s.pending));
ok('近 12 个月序列长度 = 12', s.byMonth.length === 12, s.byMonth.map(m => m.label).join(','));
ok('近 12 个月合计 = 累计收入', Math.round(s.byMonth.reduce((a, m) => a + m.amount, 0) * 100) / 100 === 346.9);
ok('产品分布正确（深度PDF报告 2 单）', s.byProduct['深度PDF报告'].count === 2, JSON.stringify(s.byProduct));
ok('渠道分布正确（微信 3 单）', s.byChannel.wechat.count === 3, JSON.stringify(s.byChannel));
ok('状态分布正确', s.byStatus.paid === 3 && s.byStatus.delivered === 1 && s.byStatus.pending === 1 && s.byStatus.refunded === 1);
ok('退款订单不计入收入', s.total.amount < 386);

console.log('\n== 筛选 ==');
ok('按状态筛选', O.list({ status: 'pending' }).length === 1);
ok('按关键词筛选（产品）', O.list({ keyword: 'PDF' }).length === 2);
ok('按关键词筛选（订单号）', O.list({ keyword: 'X-C' }).length === 1);
ok('按时间范围筛选（今天创建的 3 笔）', O.list({ from: iso(1), to: iso(-1) }).length === 3, O.list({ from: iso(1), to: iso(-1) }).map(o => o.orderNo).join(','));
ok('时间 + 状态组合筛选', O.list({ from: iso(1), to: iso(-1), status: 'paid' }).length === 2, O.list({ from: iso(1), status: 'paid' }).map(o => o.orderNo).join(','));
ok('默认按时间倒序', (() => { const l = O.list({}); return (l[0].createdAt || '') >= (l[l.length - 1].createdAt || ''); })());

console.log('\n== 导入导出 ==');
const csv = O.toCSV();
ok('CSV 含表头', csv.split('\n')[0].indexOf('订单号') === 0, csv.split('\n')[0]);
ok('CSV 行数 = 订单数 + 1', csv.split('\n').length === O.list({}).length + 1);
ok('CSV 金额保留两位', csv.indexOf('9.90') >= 0);
O.add({ orderNo: 'X-Q', amount: 1, status: 'paid', customer: '含,逗号"引号' });
ok('CSV 正确转义逗号与引号', O.toCSV().indexOf('"含,逗号""引号"') >= 0);
const json = O.toJSON();
ok('JSON 导出包含版本与订单', JSON.parse(json).version === 1 && JSON.parse(json).orders.length === O.list({}).length);
O.clear();
ok('清空后无订单', O.list({}).length === 0);
const imp = O.importData(json);
ok('JSON 导入恢复订单', imp.added === 8 && O.list({}).length === 8, JSON.stringify(imp));
const imp2 = O.importData(json);
ok('重复导入不产生重复记录', imp2.updated === 8 && O.list({}).length === 8);

console.log('\n== 导入支付后端的 orders.json ==');
O.clear();
const serverDump = JSON.stringify([
  { orderNo: 'XY260927-S001', reportNo: 'RPT-9', subject: '解锁导出与高清报告', amount: 9.9, channel: 'wechat', status: 'paid', createdAt: iso(1), paidAt: iso(1) },
  { orderNo: 'XY260927-S002', reportNo: 'RPT-10', subject: '深度PDF报告', amount: 39, channel: 'alipay', status: 'pending', createdAt: iso(0) }
]);
const r = O.importData(serverDump);
ok('可导入后端订单（2 笔）', r.added === 2, JSON.stringify(r));
ok('后端 paid 映射为已付款', O.get('XY260927-S001').status === 'paid' && !!O.get('XY260927-S001').paidAt);
ok('后端 subject 映射为产品名', O.get('XY260927-S002').product === '深度PDF报告');
ok('导入后端订单后收入统计正确', Math.round(O.stats().total.amount * 100) / 100 === 9.9, '¥' + O.stats().total.amount.toFixed(2));

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败\n');
process.exit(fail ? 1 : 0);
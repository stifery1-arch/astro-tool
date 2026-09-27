/* 支付后端集成测试（模拟模式）：建单 → 查单 → 支付 → 查单 → 自动支付 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
let pass = 0, fail = 0;
function ok(n, c, i) { if (c) { pass++; console.log('  PASS  ' + n + (i ? '  ' + i : '')); } else { fail++; console.log('  FAIL  ' + n + (i ? '  ' + i : '')); } }

const PORT = 8899;
const BASE = 'http://127.0.0.1:' + PORT;
const ORDER_FILE = path.join(__dirname, '..', 'server', 'orders.json');
const serverPath = path.join(__dirname, '..', 'server', 'pay-server.js');

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  try { fs.unlinkSync(ORDER_FILE); } catch (e) {}
  const child = spawn(process.execPath, [serverPath], {
    env: Object.assign({}, process.env, { PORT: String(PORT), MOCK: '1', MOCK_PAY_DELAY_MS: '1200' })
  });
  let log = '';
  child.stdout.on('data', d => { log += d.toString(); });
  child.stderr.on('data', d => { log += d.toString(); });

  // 等服务起来
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await wait(100);
    try { const r = await fetch(BASE + '/health'); if (r.ok) { ready = true; break; } } catch (e) {}
  }
  ok('服务启动成功', ready, ready ? '' : log.slice(-200));

  console.log('\n== 健康检查 ==');
  const health = await (await fetch(BASE + '/health')).json();
  ok('健康检查返回 ok', health.ok === true);
  ok('识别为模拟模式', health.mock === true);
  ok('未配置商户时 wechatReady=false', health.wechatReady === false);

  console.log('\n== 下单 ==');
  const createRes = await fetch(BASE + '/api/order', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportNo: 'XY260927-TEST1', amount: 9.9, subject: '星盘报告导出解锁', channel: 'wechat' })
  });
  const order = await createRes.json();
  ok('返回订单号', /^XY\d{6}-\d{4}[A-Z0-9]{4}$/.test(order.orderNo || ''), order.orderNo);
  ok('返回支付链接（模拟）', !!order.codeUrl, order.codeUrl);
  ok('订单状态为 pending', order.status === 'pending');
  ok('金额正确（9.9）', order.amount === 9.9);
  ok('未安装 qrcode 时 qrcodeDataUrl 为空字符串', order.qrcodeDataUrl === '');
  ok('带 mock 标记与提示', order.mock === true && !!order.notice);

  console.log('\n== 查询订单 ==');
  let q = await (await fetch(BASE + '/api/order/' + order.orderNo)).json();
  ok('新订单未支付', q.paid === false && q.status === 'pending');
  ok('未知订单返回 404', (await fetch(BASE + '/api/order/XY000000-NOPE')).status === 404);

  console.log('\n== 手动标记支付 ==');
  const payRes = await fetch(BASE + '/api/mock/pay', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNo: order.orderNo })
  });
  ok('模拟支付接口返回成功', (await payRes.json()).ok === true);
  q = await (await fetch(BASE + '/api/order/' + order.orderNo)).json();
  ok('支付后 paid=true', q.paid === true && q.status === 'paid');
  ok('记录了支付时间', !!q.paidAt);

  console.log('\n== 自动到账（模拟延时）==');
  const o2 = await (await fetch(BASE + '/api/order', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportNo: 'XY260927-TEST2', amount: 9.9, subject: '测试', channel: 'alipay' })
  })).json();
  ok('支付宝渠道下单成功', o2.status === 'pending' && !!o2.orderNo);
  await wait(1600);
  const q2 = await (await fetch(BASE + '/api/order/' + o2.orderNo)).json();
  ok('延时后自动变为已支付（模拟回调）', q2.paid === true);

  console.log('\n== 订单事件同步 /api/track ==');
  const tr1 = await (await fetch(BASE + '/api/track', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderNo: 'XY260927-TRACK1', reportNo: 'RPT-T1', customer: '小星', product: '解锁导出', amount: 9.9, channel: 'wechat', status: 'pending' })
  })).json();
  ok('记账接口接受待付款订单', tr1.ok === true && tr1.status === 'pending', JSON.stringify(tr1));
  const q3 = await (await fetch(BASE + '/api/order/XY260927-TRACK1')).json();
  ok('记账订单可被查询', q3.orderNo === 'XY260927-TRACK1' && q3.paid === false);
  await fetch(BASE + '/api/track', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderNo: 'XY260927-TRACK1', status: 'paid', paidAt: new Date().toISOString() })
  });
  const q4 = await (await fetch(BASE + '/api/order/XY260927-TRACK1')).json();
  ok('同一订单状态更新为已付款（不重复建单）', q4.paid === true);
  const saved2 = JSON.parse(fs.readFileSync(ORDER_FILE, 'utf8'));
  ok('记账订单已落盘', saved2.some(o => o.orderNo === 'XY260927-TRACK1' && o.customer === '小星'));
  ok('缺少订单号时返回 400', (await fetch(BASE + '/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status === 400);

  console.log('\n== 校验与边界 ==');
  ok('回调接口在未配置密钥时拒绝（微信）', (await fetch(BASE + '/api/notify/wechat', { method: 'POST', body: '{}' })).status === 401);
  ok('回调接口在未配置密钥时拒绝（支付宝）', (await (await fetch(BASE + '/api/notify/alipay', { method: 'POST', body: 'out_trade_no=x' })).text()) === 'fail');
  ok('未知路径返回 404', (await fetch(BASE + '/api/nope')).status === 404);
  ok('订单已落盘到 orders.json', fs.existsSync(ORDER_FILE));
  const saved = JSON.parse(fs.readFileSync(ORDER_FILE, 'utf8'));
  ok('落盘内容包含多笔订单', Array.isArray(saved) && saved.length >= 2, saved.length + ' 笔');
  ok('落盘订单不含明文解锁码', JSON.stringify(saved).indexOf('unlockCode') < 0);

  child.kill();
  await wait(200);
  try { fs.unlinkSync(ORDER_FILE); } catch (e) {}
  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败\n');
  process.exit(fail ? 1 : 0);
})();
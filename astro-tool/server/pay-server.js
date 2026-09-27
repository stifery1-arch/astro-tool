/*!
 * pay-server.js —— 星盘工具支付后端（微信 Native 扫码支付 + 支付宝当面付）
 *
 * 运行：node server/pay-server.js
 * 依赖：仅 Node 内置模块；生成二维码图片需可选安装 `npm i qrcode`
 *
 * 环境变量：
 *   PORT              监听端口（默认 8787）
 *   PUBLIC_BASE_URL   公网地址，如 https://pay.yourdomain.com（用于回调 notify_url）
 *   MOCK=1            模拟模式：不调用真实支付，用 /api/mock/pay 手动标记已支付（用于联调）
 *   WX_APPID / WX_MCHID / WX_SERIAL / WX_PRIVATE_KEY_PATH / WX_API_V3_KEY / WX_PLATFORM_CERT_PATH
 *   ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY_PATH / ALIPAY_PUBLIC_KEY_PATH
 *
 * 接口：
 *   POST /api/order            创建订单 → { orderNo, codeUrl, qrcodeDataUrl, status }
 *   GET  /api/order/:orderNo   查询订单 → { orderNo, status, paid }
 *   POST /api/notify/wechat    微信支付回调（自动验签 + 解密）
 *   POST /api/notify/alipay    支付宝回调（自动验签）
 *   POST /api/mock/pay         仅模拟模式：把订单标记为已支付
 */
'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT || '8787', 10);
const MOCK = process.env.MOCK === '1' || process.env.MOCK === 'true';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || ('http://localhost:' + PORT);
const MOCK_PAY_DELAY_MS = parseInt(process.env.MOCK_PAY_DELAY_MS || '6000', 10);

let qrcodeLib = null;
try { qrcodeLib = require('qrcode'); } catch (e) { qrcodeLib = null; }

/* ---------------- 订单存储（内存 + 可选文件持久化） ---------------- */
const DATA_FILE = path.join(__dirname, 'orders.json');
const orders = new Map();

function loadOrders() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    JSON.parse(raw).forEach(o => orders.set(o.orderNo, o));
    console.log('[store] 已载入订单 ' + orders.size + ' 条');
  } catch (e) { /* 文件不存在则忽略 */ }
}
function saveOrders() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify([...orders.values()], null, 2)); } catch (e) {}
}
function newOrderNo() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  const s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = '';
  for (let i = 0; i < 4; i++) r += s[crypto.randomInt(s.length)];
  return 'XY' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + r;
}

/* ---------------- 工具 ---------------- */
function json(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(data);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({ __raw: raw }); }
    });
    req.on('error', reject);
  });
}
function readKey(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}
function nonce() { return crypto.randomBytes(16).toString('hex'); }
function rsaSign(message, privateKeyPem, algorithm) {
  const sign = crypto.createSign(algorithm || 'RSA-SHA256');
  sign.update(message, 'utf8');
  sign.end();
  return sign.sign(privateKeyPem, 'base64');
}
function rsaVerify(message, signature, publicKeyPem) {
  try {
    const v = crypto.createVerify('RSA-SHA256');
    v.update(message, 'utf8');
    v.end();
    return v.verify(publicKeyPem, signature, 'base64');
  } catch (e) { return false; }
}
async function qrDataUrl(text) {
  if (!qrcodeLib) return '';
  try { return await qrcodeLib.toDataURL(text, { margin: 1, width: 300 }); } catch (e) { return ''; }
}
function postJson(urlStr, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const payload = Buffer.from(JSON.stringify(body));
    const req = http.request({
      hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': payload.length }, headers || {}),
      timeout: 15000
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('支付网关请求超时')));
    req.write(payload);
    req.end();
  });
}
function postForm(urlStr, form) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const payload = Buffer.from(new URLSearchParams(form).toString());
    const req = http.request({
      hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8', 'Content-Length': payload.length },
      timeout: 15000
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('支付网关请求超时')));
    req.write(payload);
    req.end();
  });
}

/* ---------------- 微信支付（Native 扫码，APIv3） ---------------- */
const WX = {
  appid: process.env.WX_APPID || '',
  mchid: process.env.WX_MCHID || '',
  serial: process.env.WX_SERIAL || '',
  apiV3Key: process.env.WX_API_V3_KEY || '',
  privateKey: process.env.WX_PRIVATE_KEY_PATH ? readKey(process.env.WX_PRIVATE_KEY_PATH) : null,
  platformCert: process.env.WX_PLATFORM_CERT_PATH ? readKey(process.env.WX_PLATFORM_CERT_PATH) : null
};
function wxReady() { return !!(WX.appid && WX.mchid && WX.serial && WX.privateKey); }

async function wechatCreateOrder(order) {
  if (!wxReady()) { throw new Error('未配置微信支付商户参数'); }
  const pathname = '/v3/pay/transactions/native';
  const body = {
    appid: WX.appid,
    mchid: WX.mchid,
    description: order.subject,
    out_trade_no: order.orderNo,
    notify_url: PUBLIC_BASE_URL.replace(/\/$/, '') + '/api/notify/wechat',
    amount: { total: Math.round(order.amount * 100), currency: 'CNY' }
  };
  const bodyStr = JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000).toString();
  const nc = nonce();
  const message = 'POST\n' + pathname + '\n' + ts + '\n' + nc + '\n' + bodyStr + '\n';
  const signature = rsaSign(message, WX.privateKey);
  const auth = 'WECHATPAY2-SHA256-RSA2048 mchid="' + WX.mchid + '",nonce_str="' + nc +
    '",timestamp="' + ts + '",serial_no="' + WX.serial + '",signature="' + signature + '"';
  const res = await postJson('https://api.mch.weixin.qq.com' + pathname, body, { Authorization: auth, Accept: 'application/json' });
  const data = JSON.parse(res.body || '{}');
  if (res.status >= 300 || !data.code_url) {
    throw new Error('微信下单失败：' + (data.message || res.body || res.status));
  }
  return { codeUrl: data.code_url, prepayId: data.prepay_id };
}

function wechatVerifyNotify(headers, rawBody) {
  if (!WX.platformCert || !WX.apiV3Key) return { ok: false, reason: '未配置平台证书或 APIv3 密钥' };
  const ts = headers['wechatpay-timestamp'], nc = headers['wechatpay-nonce'];
  const sig = headers['wechatpay-signature'];
  if (!ts || !nc || !sig) return { ok: false, reason: '缺少签名头' };
  const message = ts + '\n' + nc + '\n' + rawBody + '\n';
  if (!rsaVerify(message, sig, WX.platformCert)) return { ok: false, reason: '验签失败' };
  try {
    const body = JSON.parse(rawBody);
    const resource = body.resource;
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(WX.apiV3Key), Buffer.from(resource.nonce));
    decipher.setAuthTag(Buffer.from(resource.ciphertext, 'base64').slice(-16));
    decipher.setAAD(Buffer.from(resource.associated_data || ''));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(resource.ciphertext, 'base64').slice(0, -16)),
      decipher.final()
    ]).toString('utf8');
    return { ok: true, data: JSON.parse(dec) };
  } catch (e) { return { ok: false, reason: '解密失败: ' + e.message }; }
}

/* ---------------- 支付宝（当面付 precreate） ---------------- */
const ALIPAY = {
  appId: process.env.ALIPAY_APP_ID || '',
  privateKey: process.env.ALIPAY_PRIVATE_KEY_PATH ? readKey(process.env.ALIPAY_PRIVATE_KEY_PATH) : null,
  publicKey: process.env.ALIPAY_PUBLIC_KEY_PATH ? readKey(process.env.ALIPAY_PUBLIC_KEY_PATH) : null
};
function alipayReady() { return !!(ALIPAY.appId && ALIPAY.privateKey); }
function alipaySign(params) {
  const keys = Object.keys(params).sort().filter(k => params[k] !== '' && params[k] != null && k !== 'sign');
  const content = keys.map(k => k + '=' + params[k]).join('&');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(content, 'utf8');
  sign.end();
  return sign.sign(ALIPAY.privateKey, 'base64');
}
function alipayVerify(params) {
  if (!ALIPAY.publicKey) return false;
  const sign = params.sign;
  const keys = Object.keys(params).sort().filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== '' && params[k] != null);
  const content = keys.map(k => k + '=' + params[k]).join('&');
  return rsaVerify(content, sign, ALIPAY.publicKey);
}
function alipayTimestamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}
async function alipayCreateOrder(order) {
  if (!alipayReady()) { throw new Error('未配置支付宝应用参数'); }
  const biz = { out_trade_no: order.orderNo, total_amount: order.amount.toFixed(2), subject: order.subject };
  const params = {
    app_id: ALIPAY.appId,
    method: 'alipay.trade.precreate',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: alipayTimestamp(),
    version: '1.0',
    notify_url: PUBLIC_BASE_URL.replace(/\/$/, '') + '/api/notify/alipay',
    biz_content: JSON.stringify(biz)
  };
  params.sign = alipaySign(params);
  const res = await postForm('https://openapi.alipay.com/gateway.do', params);
  let data = {};
  try { data = JSON.parse(res.body); } catch (e) { throw new Error('支付宝返回解析失败'); }
  const r = data.alipay_trade_precreate_response || {};
  if (r.code !== '10000' || !r.qr_code) { throw new Error('支付宝下单失败：' + (r.sub_msg || r.msg || res.body)); }
  return { codeUrl: r.qr_code };
}

/* ---------------- 路由 ---------------- */
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, PUBLIC_BASE_URL);
  const p = u.pathname;

  if (req.method === 'OPTIONS') { return json(res, 204, {}); }

  try {
    // 创建订单
    if (req.method === 'POST' && p === '/api/order') {
      const body = await readBody(req);
      const channel = (body.channel === 'alipay') ? 'alipay' : 'wechat';
      const order = {
        orderNo: newOrderNo(),
        reportNo: body.reportNo || '',
        subject: body.subject || '星盘报告导出解锁',
        amount: Number(body.amount || 9.9),
        channel,
        status: 'pending',
        createdAt: new Date().toISOString(),
        paidAt: null
      };
      let codeUrl = '', qrcodeDataUrl = '', notice = '';
      if (MOCK) {
        codeUrl = 'mock://pay/' + order.orderNo;
        notice = '模拟模式：调用 POST /api/mock/pay 可标记已支付';
        setTimeout(() => {
          const o = orders.get(order.orderNo);
          if (o && o.status === 'pending') { o.status = 'paid'; o.paidAt = new Date().toISOString(); saveOrders(); }
        }, MOCK_PAY_DELAY_MS);
      } else if (channel === 'alipay') {
        const r = await alipayCreateOrder(order);
        codeUrl = r.codeUrl;
      } else {
        const r = await wechatCreateOrder(order);
        codeUrl = r.codeUrl;
      }
      qrcodeDataUrl = await qrDataUrl(codeUrl);
      order.codeUrl = codeUrl;
      orders.set(order.orderNo, order);
      saveOrders();
      return json(res, 200, {
        orderNo: order.orderNo, amount: order.amount, channel, status: order.status,
        codeUrl, qrcodeDataUrl, mock: MOCK, notice
      });
    }

    // 查询订单
    if (req.method === 'GET' && p.startsWith('/api/order/')) {
      const orderNo = decodeURIComponent(p.slice('/api/order/'.length));
      const o = orders.get(orderNo);
      if (!o) return json(res, 404, { ok: false, message: '订单不存在' });
      return json(res, 200, { orderNo: o.orderNo, status: o.status, paid: o.status === 'paid', amount: o.amount, paidAt: o.paidAt });
    }

    // 模拟支付（仅模拟模式）
    if (req.method === 'POST' && p === '/api/mock/pay') {
      if (!MOCK) return json(res, 403, { ok: false, message: '非模拟模式不可用' });
      const body = await readBody(req);
      const o = orders.get(body.orderNo);
      if (!o) return json(res, 404, { ok: false, message: '订单不存在' });
      o.status = 'paid'; o.paidAt = new Date().toISOString();
      saveOrders();
      return json(res, 200, { ok: true, orderNo: o.orderNo, status: o.status });
    }

    // 订单事件同步（站点记账 → 后端，便于部署后在管理台统一查看）
    if (req.method === 'POST' && p === '/api/track') {
      const body = await readBody(req);
      if (!body.orderNo) return json(res, 400, { ok: false, message: '缺少 orderNo' });
      const prev = orders.get(body.orderNo) || {};
      const merged = Object.assign({}, prev, {
        orderNo: body.orderNo,
        reportNo: body.reportNo || prev.reportNo || '',
        customer: body.customer || prev.customer || '',
        subject: body.product || prev.subject || '解锁导出',
        product: body.product || prev.product || '解锁导出',
        amount: Number(body.amount || prev.amount || 0),
        channel: body.channel || prev.channel || 'wechat',
        status: body.status || prev.status || 'pending',
        createdAt: body.createdAt || prev.createdAt || new Date().toISOString(),
        paidAt: body.paidAt || prev.paidAt || '',
        tracked: true
      });
      orders.set(merged.orderNo, merged);
      saveOrders();
      return json(res, 200, { ok: true, orderNo: merged.orderNo, status: merged.status });
    }

    // 微信支付回调
    if (req.method === 'POST' && p === '/api/notify/wechat') {
      let raw = '';
      const chunks = [];
      await new Promise(r => { req.on('data', c => chunks.push(c)); req.on('end', r); });
      raw = Buffer.concat(chunks).toString('utf8');
      const v = wechatVerifyNotify(req.headers, raw);
      if (!v.ok) return json(res, 401, { code: 'FAIL', message: v.reason });
      const o = orders.get(v.data.out_trade_no);
      if (o && v.data.trade_state === 'SUCCESS') { o.status = 'paid'; o.paidAt = new Date().toISOString(); saveOrders(); }
      return json(res, 200, { code: 'SUCCESS', message: '成功' });
    }

    // 支付宝回调
    if (req.method === 'POST' && p === '/api/notify/alipay') {
      const chunks = [];
      await new Promise(r => { req.on('data', c => chunks.push(c)); req.on('end', r); });
      const raw = Buffer.concat(chunks).toString('utf8');
      const params = Object.fromEntries(new URLSearchParams(raw));
      if (!alipayVerify(params)) return res.end('fail');
      const o = orders.get(params.out_trade_no);
      const okTrade = ['TRADE_SUCCESS', 'TRADE_FINISHED'].indexOf(params.trade_status) >= 0;
      if (o && okTrade) { o.status = 'paid'; o.paidAt = new Date().toISOString(); saveOrders(); }
      return res.end('success');
    }

    // 健康检查
    if (p === '/' || p === '/health') {
      return json(res, 200, {
        ok: true, mock: MOCK, wechatReady: wxReady(), alipayReady: alipayReady(),
        qrcode: !!qrcodeLib, orders: orders.size, publicBaseUrl: PUBLIC_BASE_URL
      });
    }

    return json(res, 404, { ok: false, message: 'Not Found' });
  } catch (err) {
    console.error('[error]', err);
    return json(res, 500, { ok: false, message: err.message || String(err) });
  }
});

loadOrders();
server.listen(PORT, () => {
  console.log('支付服务已启动 http://localhost:' + PORT + (MOCK ? '  [模拟模式]' : ''));
  console.log('  微信支付：' + (wxReady() ? '已配置' : '未配置') + '　支付宝：' + (alipayReady() ? '已配置' : '未配置') +
    '　二维码模块：' + (qrcodeLib ? '已安装' : '未安装（npm i qrcode 可生成二维码图片）'));
});
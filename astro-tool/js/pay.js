/*!
 * pay.js —— 付费解锁引擎（纯前端零依赖）
 * 能力：订单号生成 / SHA-256 / 解锁码校验（工具级 or 按报告绑定）/ 授权持久化 / 后端支付网关对接
 * 说明：纯前端校验只能提高门槛，无法绝对防止技术用户绕过；正式经营建议使用 server/ 里的
 *       微信 Native 支付 / 支付宝当面付（服务端验签），前端会自动切换成「支付后自动解锁」。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.AstroPay = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'astro_pay_v1';
  var DEFAULT_CFG = {
    enabled: false,
    mode: 'tool',              // tool = 一次解锁本设备 | report = 每个报告单独解锁 | both
    price: 9.9,
    priceText: '¥9.9',
    title: '解锁导出与高清报告',
    hashSalt: 'astro-tool-salt',
    unlockHashes: [],          // 工具级解锁码的 SHA-256（salt:code）
    reportHashes: [],          // 报告级解锁码的 SHA-256（salt:reportNo:code）
    demoCode: '',              // 演示码（明文只用于本地演示，正式上线请置空）
    payeeName: '',
    wechatQrcode: '',
    alipayQrcode: '',
    contact: '',
    apiBase: '',               // 后端地址，如 https://pay.example.com
    apiEnabled: false
  };

  var memStore = {};

  function defaultCfg() {
    var o = {};
    for (var k in DEFAULT_CFG) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_CFG, k)) {
        o[k] = Array.isArray(DEFAULT_CFG[k]) ? DEFAULT_CFG[k].slice() : DEFAULT_CFG[k];
      }
    }
    return o;
  }
  var cfg = defaultCfg();

  /* 合并式配置：只覆盖传入的字段（可在运行中多次调用） */
  function configure(c) {
    if (!c) { return cfg; }
    for (var k in c) {
      if (Object.prototype.hasOwnProperty.call(c, k)) { cfg[k] = c[k]; }
    }
    return cfg;
  }
  function resetConfig() { cfg = defaultCfg(); return cfg; }
  function config() { return cfg; }

  /* ---------------- 存储（浏览器 localStorage / Node 内存） ---------------- */
  function store() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) { return localStorage; }
    } catch (e) {}
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(memStore, k) ? memStore[k] : null; },
      setItem: function (k, v) { memStore[k] = String(v); },
      removeItem: function (k) { delete memStore[k]; }
    };
  }

  function readState() {
    try {
      var raw = store().getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function writeState(s) {
    try { store().setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
  }

  /* ---------------- SHA-256（纯 JS，可在 file:// 下工作） ---------------- */
  function sha256(ascii) {
    function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
    var mathPow = Math.pow, maxWord = mathPow(2, 32), lengthProperty = 'length', i, j, result = '';
    var words = [], asciiBitLength = ascii[lengthProperty] * 8;
    var hash = sha256.h = sha256.h || [], k = sha256.k = sha256.k || [], primeCounter = k[lengthProperty];
    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) { isComposite[i] = candidate; }
        hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    var msg = ascii + '\x80';
    while (msg[lengthProperty] % 64 - 56) { msg += '\x00'; }
    for (i = 0; i < msg[lengthProperty]; i++) {
      j = msg.charCodeAt(i);
      if (j >> 8) { return null; }
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
    words[words[lengthProperty]] = (asciiBitLength);
    for (j = 0; j < words[lengthProperty];) {
      var w = words.slice(j, j += 16);
      var oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (
              w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
              + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
            ) | 0);
        var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) { hash[i] = (hash[i] + oldHash[i]) | 0; }
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? 0 : '') + b.toString(16);
      }
    }
    return result;
  }

  /* 统一解锁码写法：去大小写、去空格/下划线/连字符等分隔符（XYA7-K2M9 = xya7 k2m9） */
  function normalizeCode(code) {
    return String(code || '').toUpperCase().replace(/[\s_·.–—-]/g, '');
  }
  function hashToolCode(code) { return sha256(normalizeCode(code) + '|' + cfg.hashSalt + '|tool'); }
  function hashReportCode(code, reportNo) { return sha256(normalizeCode(code) + '|' + cfg.hashSalt + '|' + (reportNo || '') + '|report'); }

  /* ---------------- 订单 ---------------- */
  function rand4() {
    var s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '';
    for (var i = 0; i < 4; i++) { out += s[Math.floor(Math.random() * s.length)]; }
    return out;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function makeOrderNo() {
    var d = new Date();
    return 'XY' + String(d.getFullYear()).slice(2) + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
      '-' + pad2(d.getHours()) + pad2(d.getMinutes()) + rand4();
  }

  function makeOrder(meta) {
    meta = meta || {};
    var orderNo = meta.orderNo || makeOrderNo();
    return {
      orderNo: orderNo,
      amount: cfg.price,
      amountText: cfg.priceText,
      title: cfg.title + (meta.reportNo ? '（报告 ' + meta.reportNo + '）' : ''),
      reportNo: meta.reportNo || '',
      createdAt: new Date().toISOString()
    };
  }

  /* ---------------- 解锁校验 ---------------- */
  /* 是否本地开发环境（file:// / localhost / 内网）：演示码只在这里生效，防止忘记删除后被白嫖 */
  function isLocalDev() {
    try {
      if (typeof location === 'undefined' || !location) { return true; }   // Node 环境（测试）
      var p = location.protocol, h = location.hostname || '';
      if (p === 'file:' || h === '' || h === 'localhost' || h === '127.0.0.1' || h === '::1') { return true; }
      if (/^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) { return true; }
      return false;
    } catch (e) { return true; }
  }

  function verify(code, reportNo) {
    var c = normalizeCode(code);
    if (!c) { return null; }
    // 演示码仅在本地开发环境有效：部署到公网后即使忘记删掉也不会被白嫖
    if (cfg.demoCode && isLocalDev() && normalizeCode(cfg.demoCode) === c) { return 'demo'; }
    var h1 = hashToolCode(c);
    if (h1 && (cfg.unlockHashes || []).indexOf(h1) >= 0) { return 'tool'; }
    if (reportNo && (cfg.mode === 'report' || cfg.mode === 'both')) {
      var h2 = hashReportCode(c, reportNo);
      if (h2 && (cfg.reportHashes || []).indexOf(h2) >= 0) { return 'report'; }
    }
    return null;
  }

  function isUnlocked(reportNo) {
    if (!cfg.enabled) { return true; }          // 未开启付费：全部功能免费
    var st = readState();
    if (!st || !st.unlocked) { return false; }
    if (st.mode === 'tool' || st.mode === 'demo') { return true; }
    if (st.mode === 'report') { return !reportNo || st.reportNo === reportNo; }
    return true;
  }

  function unlock(code, reportNo, opts) {
    opts = opts || {};
    var kind = opts.trusted ? (opts.kind || 'server') : verify(code, reportNo);
    if (!kind) { return { ok: false, reason: 'invalid' }; }
    var st = readState();
    var mode = (kind === 'report') ? 'report' : (kind === 'demo' ? 'demo' : 'tool');
    if (mode === 'tool' || mode === 'demo') {
      writeState({
        unlocked: true, mode: mode, code: maskCode(code),
        orderNo: opts.orderNo || st.orderNo || '',
        at: new Date().toISOString()
      });
    } else {
      writeState({
        unlocked: true, mode: 'report', reportNo: reportNo,
        codes: (st.codes || []).concat([maskCode(code)]).slice(-20),
        at: new Date().toISOString()
      });
    }
    return { ok: true, kind: kind, mode: mode };
  }

  function lock() { writeState({}); }

  function maskCode(code) {
    var c = normalizeCode(code);
    if (c.length <= 4) { return '****'; }
    return c.slice(0, 2) + '****' + c.slice(-2);
  }

  function state() { return readState(); }

  /* ---------------- 后端支付网关（可选） ---------------- */
  function api(path, options) {
    if (!cfg.apiBase) { return Promise.reject(new Error('未配置支付后端 apiBase')); }
    var url = cfg.apiBase.replace(/\/$/, '') + path;
    return fetch(url, options);
  }

  function createRemoteOrder(meta) {
    return api('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportNo: (meta || {}).reportNo || '',
        amount: cfg.price,
        subject: (meta || {}).subject || cfg.title,
        channel: (meta || {}).channel || 'wechat'
      })
    }).then(function (r) { return r.json(); });
  }

  function queryRemoteOrder(orderNo) {
    return api('/api/order/' + encodeURIComponent(orderNo), {}).then(function (r) { return r.json(); });
  }

  /* 轮询支付状态，收到 paid 后自动解锁 */
  function pollRemoteOrder(orderNo, onTick, intervalMs, timeoutMs) {
    var started = Date.now();
    var iv = intervalMs || 3000, to = timeoutMs || 10 * 60 * 1000;
    return new Promise(function (resolve, reject) {
      (function tick() {
        queryRemoteOrder(orderNo).then(function (res) {
          if (onTick) { onTick(res); }
          if (res && res.paid) { resolve(res); return; }
          if (Date.now() - started > to) { reject(new Error('支付确认超时，请联系客服')); return; }
          setTimeout(tick, iv);
        }, function (err) {
          if (Date.now() - started > to) { reject(err); return; }
          setTimeout(tick, iv);
        });
      })();
    });
  }

  /* 配置自检：让解读师在控制台里快速确认「sal t + 哈希」是否配套 */
  function selfCheck(code, reportNo) {
    var kind = verify(code, reportNo);
    return {
      code: normalizeCode(code),
      salt: cfg.hashSalt,
      toolHash: hashToolCode(code),
      reportHash: reportNo ? hashReportCode(code, reportNo) : null,
      inToolList: (cfg.unlockHashes || []).indexOf(hashToolCode(code)) >= 0,
      inReportList: reportNo ? ((cfg.reportHashes || []).indexOf(hashReportCode(code, reportNo)) >= 0) : false,
      result: kind
    };
  }

  return {
    isLocalDev: isLocalDev,
    configure: configure,
    resetConfig: resetConfig,
    selfCheck: selfCheck,
    config: config,
    sha256: sha256,
    normalizeCode: normalizeCode,
    hashToolCode: hashToolCode,
    hashReportCode: hashReportCode,
    makeOrderNo: makeOrderNo,
    makeOrder: makeOrder,
    verify: verify,
    isUnlocked: isUnlocked,
    unlock: unlock,
    lock: lock,
    state: state,
    maskCode: maskCode,
    createRemoteOrder: createRemoteOrder,
    queryRemoteOrder: queryRemoteOrder,
    pollRemoteOrder: pollRemoteOrder
  };
});
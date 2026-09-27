/*!
 * orders.js —— 订单与收入统计引擎（零依赖，站点与后台共用）
 * 订单状态：pending 待付款 → paid 已付款 → delivered 已交付；refunded 已退款 / cancelled 已取消
 * 收入口径：paid + delivered 计入收入；pending / refunded / cancelled 不计入
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.AstroOrders = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEY = 'astro_orders_v1';
  var memStore = {};
  var REVENUE_STATUS = { paid: 1, delivered: 1 };
  var STATUS_TEXT = {
    pending: '待付款', paid: '已付款', delivered: '已交付',
    refunded: '已退款', cancelled: '已取消'
  };
  var CHANNEL_TEXT = { wechat: '微信', alipay: '支付宝', other: '其他', free: '赠送' };

  function store() {
    try { if (typeof localStorage !== 'undefined' && localStorage) { return localStorage; } } catch (e) {}
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(memStore, k) ? memStore[k] : null; },
      setItem: function (k, v) { memStore[k] = String(v); },
      removeItem: function (k) { delete memStore[k]; }
    };
  }

  function read() {
    try {
      var raw = store().getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function write(list) {
    try { store().setItem(KEY, JSON.stringify(list)); } catch (e) {}
    return list;
  }

  function nowISO() { return new Date().toISOString(); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  function normalize(o) {
    o = o || {};
    return {
      orderNo: String(o.orderNo || '').trim(),
      createdAt: o.createdAt || nowISO(),
      paidAt: o.paidAt || '',
      deliveredAt: o.deliveredAt || '',
      customer: o.customer || '',
      reportNo: o.reportNo || '',
      product: o.product || '解锁导出',
      amount: num(o.amount),
      channel: o.channel || 'wechat',
      status: STATUS_TEXT[o.status] ? o.status : 'pending',
      code: o.code || '',
      codeSentAt: o.codeSentAt || '',
      note: o.note || ''
    };
  }

  /* ---------------- 增删改查 ---------------- */

  function list(filter) {
    var arr = read();
    filter = filter || {};
    if (filter.status && filter.status !== 'all') {
      arr = arr.filter(function (o) { return o.status === filter.status; });
    }
    if (filter.from) { arr = arr.filter(function (o) { return (o.createdAt || '') >= filter.from; }); }
    if (filter.to) { arr = arr.filter(function (o) { return (o.createdAt || '') <= filter.to; }); }
    if (filter.keyword) {
      var k = String(filter.keyword).toLowerCase();
      arr = arr.filter(function (o) {
        return [o.orderNo, o.customer, o.reportNo, o.product, o.note, o.code]
          .join(' ').toLowerCase().indexOf(k) >= 0;
      });
    }
    arr.sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
    return arr;
  }

  function get(orderNo) {
    var arr = read();
    for (var i = 0; i < arr.length; i++) { if (arr[i].orderNo === orderNo) { return arr[i]; } }
    return null;
  }

  function add(order) {
    var o = normalize(order);
    if (!o.orderNo) { return null; }
    var arr = read();
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].orderNo === o.orderNo) {
        // 已存在：合并（保留已有时间戳与状态，除非新值更"靠后"）
        var merged = arr[i];
        ['customer', 'reportNo', 'product', 'amount', 'channel', 'note'].forEach(function (f) {
          if (o[f] !== '' && o[f] !== undefined && o[f] !== null) { merged[f] = o[f]; }
        });
        if (o.status && statusRank(o.status) > statusRank(merged.status)) { merged.status = o.status; }
        if (o.paidAt && !merged.paidAt) { merged.paidAt = o.paidAt; }
        if (o.deliveredAt && !merged.deliveredAt) { merged.deliveredAt = o.deliveredAt; }
        if (o.code) { merged.code = o.code; merged.codeSentAt = o.codeSentAt || nowISO(); }
        write(arr);
        return merged;
      }
    }
    arr.push(o);
    write(arr);
    return o;
  }

  function statusRank(s) {
    return { pending: 0, paid: 1, delivered: 2, refunded: 3, cancelled: 3 }[s] || 0;
  }

  function update(orderNo, patch) {
    var arr = read();
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].orderNo === orderNo) {
        for (var k in patch) {
          if (Object.prototype.hasOwnProperty.call(patch, k)) { arr[i][k] = patch[k]; }
        }
        write(arr);
        return arr[i];
      }
    }
    return null;
  }

  function remove(orderNo) {
    var arr = read().filter(function (o) { return o.orderNo !== orderNo; });
    write(arr);
    return arr.length;
  }

  function markPaid(orderNo, opts) {
    opts = opts || {};
    return update(orderNo, {
      status: 'paid',
      paidAt: opts.paidAt || nowISO(),
      channel: opts.channel || undefined,
      code: opts.code || undefined,
      codeSentAt: opts.code ? nowISO() : undefined
    });
  }
  function markDelivered(orderNo) {
    return update(orderNo, { status: 'delivered', deliveredAt: nowISO() });
  }

  /* 站点在弹出付费窗时记录一笔待付款订单（同一报告 30 分钟内复用，避免刷出垃圾单） */
  function recordAttempt(meta) {
    meta = meta || {};
    var arr = read();
    if (meta.reportNo) {
      for (var i = 0; i < arr.length; i++) {
        var o = arr[i];
        if (o.status === 'pending' && o.reportNo === meta.reportNo) {
          var age = Date.now() - new Date(o.createdAt).getTime();
          if (age >= 0 && age < 30 * 60 * 1000) {
            if (meta.amount && o.amount !== num(meta.amount)) { update(o.orderNo, { amount: num(meta.amount) }); }
            return o;
          }
        }
      }
    }
    return add({
      orderNo: meta.orderNo,
      customer: meta.customer,
      reportNo: meta.reportNo,
      product: meta.product || '解锁导出',
      amount: meta.amount,
      channel: meta.channel || 'wechat',
      status: 'pending',
      note: meta.note || ''
    });
  }

  /* ---------------- 收入统计 ---------------- */

  function dayKey(d) {
    var x = (d instanceof Date) ? d : new Date(d);
    if (isNaN(x.getTime())) { return ''; }
    return x.getFullYear() + '-' + pad2(x.getMonth() + 1) + '-' + pad2(x.getDate());
  }
  function monthKey(d) {
    var x = (d instanceof Date) ? d : new Date(d);
    if (isNaN(x.getTime())) { return ''; }
    return x.getFullYear() + '-' + pad2(x.getMonth() + 1);
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* 收入归属日期：优先付款时间，其次创建时间 */
  function revenueDate(o) { return o.paidAt || o.createdAt; }

  function stats(opts) {
    opts = opts || {};
    var arr = read();
    var today = dayKey(new Date());
    var thisMonth = monthKey(new Date());
    var out = {
      total: { count: 0, amount: 0 },
      today: { count: 0, amount: 0 },
      month: { count: 0, amount: 0 },
      avg: 0,
      pending: { count: 0, amount: 0 },
      byStatus: {}, byChannel: {}, byProduct: {}, byMonth: [],
      count: arr.length
    };
    var monthMap = {}, productMap = {}, channelMap = {}, statusMap = {};
    var revenueCount = 0;

    arr.forEach(function (o) {
      statusMap[o.status] = (statusMap[o.status] || 0) + 1;
      if (o.status === 'pending') { out.pending.count++; out.pending.amount += num(o.amount); }
      if (!REVENUE_STATUS[o.status]) { return; }
      var amt = num(o.amount);
      var dk = dayKey(revenueDate(o)), mk = monthKey(revenueDate(o));
      revenueCount++;
      out.total.count++; out.total.amount += amt;
      if (dk === today) { out.today.count++; out.today.amount += amt; }
      if (mk === thisMonth) { out.month.count++; out.month.amount += amt; }
      monthMap[mk] = monthMap[mk] || { count: 0, amount: 0 };
      monthMap[mk].count++; monthMap[mk].amount += amt;
      var p = o.product || '未分类';
      productMap[p] = productMap[p] || { count: 0, amount: 0 };
      productMap[p].count++; productMap[p].amount += amt;
      var ch = o.channel || 'other';
      channelMap[ch] = channelMap[ch] || { count: 0, amount: 0 };
      channelMap[ch].count++; channelMap[ch].amount += amt;
    });

    out.avg = revenueCount ? out.total.amount / revenueCount : 0;
    out.byStatus = statusMap;
    out.byChannel = channelMap;
    out.byProduct = productMap;

    // 近 12 个月序列（含空月份）
    var months = [];
    var base = new Date();
    base.setDate(1);
    for (var i = 11; i >= 0; i--) {
      var d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      var k = monthKey(d);
      var m = monthMap[k] || { count: 0, amount: 0 };
      months.push({ month: k, label: (d.getMonth() + 1) + '月', count: m.count, amount: m.amount });
    }
    out.byMonth = months;
    return out;
  }

  /* ---------------- 导入 / 导出 ---------------- */

  function csvCell(v) {
    var s = String(v === undefined || v === null ? '' : v);
    return /[",\n]/.test(s) ? ('"' + s.replace(/"/g, '""') + '"') : s;
  }
  function toCSV(rows) {
    rows = rows || list({});
    var head = ['订单号', '创建时间', '付款时间', '交付时间', '客户', '报告编号', '产品', '金额', '渠道', '状态', '解锁码', '备注'];
    var lines = [head.join(',')];
    rows.forEach(function (o) {
      lines.push([o.orderNo, o.createdAt, o.paidAt, o.deliveredAt, o.customer, o.reportNo, o.product,
        num(o.amount).toFixed(2), CHANNEL_TEXT[o.channel] || o.channel, STATUS_TEXT[o.status] || o.status,
        o.code, o.note].map(csvCell).join(','));
    });
    return lines.join('\n');
  }

  function toJSON() { return JSON.stringify({ version: 1, exportedAt: nowISO(), orders: read() }, null, 2); }

  /* 导入：支持本模块格式、纯数组、以及 server/pay-server.js 的 orders.json */
  function importData(text, opts) {
    opts = opts || {};
    var data = text;
    if (typeof text === 'string') { data = JSON.parse(text); }
    var arr = Array.isArray(data) ? data : (data.orders || []);
    var added = 0, updated = 0;
    arr.forEach(function (raw) {
      var o = normalize({
        orderNo: raw.orderNo || raw.out_trade_no,
        createdAt: raw.createdAt || raw.created_at,
        paidAt: raw.paidAt || (raw.status === 'paid' ? raw.paidAt : ''),
        customer: raw.customer || '',
        reportNo: raw.reportNo || '',
        product: raw.product || raw.subject || '解锁导出',
        amount: raw.amount || raw.total_amount,
        channel: raw.channel,
        status: raw.status === 'paid' ? 'paid' : (raw.status || 'pending'),
        code: raw.code || '',
        note: raw.note || (raw.mock ? '模拟订单' : '')
      });
      if (!o.orderNo) { return; }
      var existed = !!get(o.orderNo);
      if (existed) { updated++; } else { added++; }
      add(o);
    });
    return { added: added, updated: updated, total: read().length };
  }

  function clear() { write([]); }

  return {
    KEY: KEY,
    STATUS_TEXT: STATUS_TEXT,
    CHANNEL_TEXT: CHANNEL_TEXT,
    REVENUE_STATUS: REVENUE_STATUS,
    list: list,
    get: get,
    add: add,
    update: update,
    remove: remove,
    markPaid: markPaid,
    markDelivered: markDelivered,
    recordAttempt: recordAttempt,
    stats: stats,
    toCSV: toCSV,
    toJSON: toJSON,
    importData: importData,
    clear: clear,
    dayKey: dayKey,
    monthKey: monthKey,
    normalize: normalize
  };
});
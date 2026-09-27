/*!
 * app.js —— 页面逻辑：表单 / 排盘 / 渲染 / 导出 / 引流转化
 * 配置区 CONFIG 可直接修改成你自己的信息
 */
(function () {
  'use strict';

  /* ===================== 站点与转化配置（改这里） ===================== */
  var CONFIG = {
    siteName: '星语星盘',
    slogan: '输入出生时间，免费生成你的本命星盘与解读报告',
    brandNote: '回归黄道 · 普拉西度宫位 · 十行星与交点',
    ctaShow: true,
    ctaTitle: '想要更深入的个人解读？',
    ctaText: '自动报告只能给出星盘的骨架。如果你想针对具体议题（感情走向、事业方向、近期行运）做一次深度解读，可以加我。',
    ctaBullets: ['一对一深度星盘解读', '关系合盘与情感模式分析', '未来一年行运重点与时间窗口'],
    contactType: 'wechat',
    contactLabel: '微信号',
    contactValue: 'LB5263',
    qrcodeSrc: 'images/qr.png',   // 可选：把二维码图片放进 images/ 目录，然后填 'images/qr.png'
    contactTip: '备注「星盘」通过更快，每日前 5 位可获免费简评',
    disclaimer: '本工具的所有计算与内容仅供自我探索、心理反思与娱乐参考，不构成医疗、法律、投资、婚姻等任何专业建议。请勿将结果用于重大决策依据。',

    /* ---- 付费 PDF 报告配置 ---- */
    report: {
      title: '深度个人星盘报告',
      author: '',                          // 留空则使用 siteName（解读师/工作室署名）
      watermark: '仅限 {client} 使用',      // {client} 会自动替换为报告上填写的客户称呼；留空则无水印
      footer: '本报告仅供个人参考 · 请勿转发',
      pdfQuality: 0.92,                    // 不支持无损压缩时使用 JPEG 的质量
      lossless: true                       // true = 优先无损打包（文字更清晰，体积略大）
    },

    /* ---- 付费解锁配置（导出功能收费） ---- */
    pay: {
      enabled: true,                       // false = 全部免费（可随时关闭收费）
      mode: 'tool',                        // tool = 一次解锁本设备 | report = 每份报告单独解锁 | both = 两种码都认
      price: 9.9,
      priceText: '¥9.9',
      title: '解锁导出与高清报告',
      payeeName: '星语星盘',
      hashSalt: 'stifery-astro-2e56pj',   // 换掉它！并同步到 tools/unlock-codegen.html
      unlockHashes: [
        '1620e4b46c63b99e26ae798d6d2d0b2212664738fd9d3381964de487b16d1f4b',
        'e69a26152068a3d53f04304d2f1f6ee0c9fda9a3e5c9095df0ebc07a67b155a3',
        '3be381211a4584ca0826f844e0c2a00f85f97df8e469bbfccfacbcd3db368c32',
        '0ea022bf4489aee804eb33a34e98c719638228b430a5ca73c257a73f92117035',
        'b7a292c056ed5cd4523d6640510329ad5011c3c0c46feef55e7b34a3513d5871',
        '159b1795671cef8b8550873abcbf23520fbbec78d668c08eafb002289a7111be',
        '369632feeb3fc0ac18bd3a5a92f5b38d47ea36d88cc4ce359b1f4958f7f91093',
        '549d303ff9f3ee47bdda9d4f410cef29400a6864da4274eb8bff78e641c599f2',
        '247f84cfeee3dfe57e87fb849701d909ceb50106aae400b43a1c0b4f9337ddda',
        '45360a7482665b6bd5952e3694da597683a79f6d213943c7c4be12c02ee25def'
      ],                    // ← 用 tools/unlock-codegen.html 生成的哈希粘贴到这里
      reportHashes: [],                    // ← 报告级解锁码哈希（绑定报告编号）
      demoCode: '',                // 演示码，正式上线前请改成 ''
      wechatQrcode: 'images/wechat-qr.png',                     // 例如 'images/wechat-qr.png'（把收款码图片放进 images/）
      alipayQrcode: '',                     // 例如 'images/alipay-qr.png'
      contact: '微信 LB5263｜付款后把订单号发给我领取解锁码',
      apiBase: '',                          // 填后端地址（server/pay-server.js）则启用「支付后自动解锁」
      apiEnabled: false
    }
  };

  /* ===================== 工具函数 ===================== */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  var E = window.AstroEphemeris, A = window.AstroChart, T = window.AstroText, D = window.AstroData, W = window.AstroWheel;
  var R = window.AstroReport, RC = window.AstroReportCanvas, P = window.AstroPdf;
  var PLACE = window.AstroPlace;
  var PAY = window.AstroPay;
  var ORDERS = window.AstroOrders;
  var lastChart = null, lastReport = null, lastTransit = null;

  /* ===================== 初始化 ===================== */
  function init() {
    buildBrand();
    buildPlacePickers();
    buildZoneSelect();
    PAY.configure(CONFIG.pay);
    bindEvents();
    bindPaywall();
    updateUnlockBadge();
    setExample(false);
    restoreLast();
  }

  function buildBrand() {
    $$('[data-brand]').forEach(function (el) { el.textContent = CONFIG.siteName; });
    $$('[data-slogan]').forEach(function (el) { el.textContent = CONFIG.slogan; });
    $$('[data-brandnote]').forEach(function (el) { el.textContent = CONFIG.brandNote; });
    document.title = CONFIG.siteName + ' · 在线星盘排盘与解读';
    var cta = $('#ctaCard');
    if (!CONFIG.ctaShow) { cta.classList.add('hidden'); return; }
    cta.innerHTML = '<div class="cta-inner">' +
      '<div class="cta-left">' +
        '<h3>' + esc(CONFIG.ctaTitle) + '</h3>' +
        '<p>' + esc(CONFIG.ctaText) + '</p>' +
        '<ul>' + CONFIG.ctaBullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>' +
      '</div>' +
      '<div class="cta-right">' +
        (CONFIG.qrcodeSrc ? '<img class="qr" src="' + esc(CONFIG.qrcodeSrc) + '" alt="扫码添加">' : '') +
        '<div class="contact-label">' + esc(CONFIG.contactLabel) + '</div>' +
        '<div class="contact-value" id="contactValue">' + esc(CONFIG.contactValue) + '</div>' +
        '<button class="btn btn-gold" id="copyContact">复制' + esc(CONFIG.contactLabel) + '</button>' +
        '<div class="contact-tip">' + esc(CONFIG.contactTip) + '</div>' +
      '</div></div>';
    $('#copyContact').addEventListener('click', function () {
      copy(CONFIG.contactValue, '已复制' + CONFIG.contactLabel + '，加我时请备注「星盘」');
    });
  }

  /* ===================== 出生地检索（全国省市区） ===================== */
  var suggestList = [], suggestIndex = -1, suggestTimer = null;

  function buildPlacePickers() {
    var provs = PLACE.provinces();
    $('#provSelect').innerHTML = '<option value="">选择省份 / 直辖市 / 特别行政区</option>' +
      provs.map(function (p) { return '<option value="' + esc(p.name) + '">' + esc(p.name) + '</option>'; }).join('');
    $('#citySelect').innerHTML = '<option value="">先选择省份</option>';
    $('#distSelect').innerHTML = '<option value="">先选择城市（区县可选）</option>';
  }

  function bindPlacePickers() {
    $('#pickerToggle').addEventListener('click', function () {
      var box = $('#cityPicker');
      box.classList.toggle('hidden');
      this.textContent = (box.classList.contains('hidden') ? '▸ ' : '▾ ') + '不知道怎么写？按省 / 市 / 区县逐级选择';
    });
    $('#provSelect').addEventListener('change', function () {
      var p = this.value;
      var cities = p ? PLACE.cities(p) : [];
      $('#citySelect').disabled = !p;
      $('#citySelect').innerHTML = '<option value="">' + (p ? '选择城市 / 地区' : '先选择省份') + '</option>' +
        cities.map(function (c) { return '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>'; }).join('');
      $('#distSelect').disabled = true;
      $('#distSelect').innerHTML = '<option value="">先选择城市（区县可选）</option>';
      if (p) { applyPickerPlace(); }
    });
    $('#citySelect').addEventListener('change', function () {
      var p = $('#provSelect').value, c = this.value;
      var ds = (p && c) ? PLACE.districts(p, c) : [];
      $('#distSelect').disabled = !ds.length;
      $('#distSelect').innerHTML = '<option value="">' + (ds.length ? '选择区县（可跳过）' : '该市无需选择区县') + '</option>' +
        ds.map(function (d) { return '<option value="' + esc(d.name) + '">' + esc(d.name) + '</option>'; }).join('');
      if (c) { applyPickerPlace(); }
    });
    $('#distSelect').addEventListener('change', function () { if (this.value) { applyPickerPlace(); } });
  }

  function applyPickerPlace() {
    var prov = $('#provSelect').value, city = $('#citySelect').value, dist = $('#distSelect').value;
    var e = null;
    if (dist) {
      var ds = PLACE.districts(prov, city).filter(function (d) { return d.name === dist; });
      if (ds.length) {
        e = { name: dist, prov: prov, city: city, lat: ds[0].lat, lng: ds[0].lng, tz: ds[0].tz, level: 2 };
      }
    }
    if (!e && city && city !== prov) { e = PLACE.byName(city); }
    if (!e && prov) { e = PLACE.byName(prov); }
    if (!e) { return; }
    $('#city').value = e.name;
    applyPlace(e);
    hideSuggest();
  }

  function applyPlace(e) {
    $('#lat').value = e.lat;
    $('#lon').value = e.lng;
    $('#zone').value = e.tz;
    var lv = e.level === 0 ? '省级' : e.level === 1 ? '市级' : e.level === 2 ? '区县级' : '国际城市';
    $('#cityHint').textContent = '已匹配：' + PLACE.label(e) + '（' + lv + '）　' +
      e.lat.toFixed(4) + ', ' + e.lng.toFixed(4) + '　时区 ' + e.tz;
    $('#cityHint').className = 'hint ok';
  }

  var POPULAR = ['北京市', '上海市', '广州市', '深圳市', '杭州市', '成都市', '武汉市', '西安市', '重庆市', '南京市', '天津市', '长沙市'];

  function renderSuggest(list, tip) {
    var box = $('#citySuggest');
    suggestList = list || [];
    suggestIndex = -1;
    if (tip) {
      box.innerHTML = '<div class="suggest-empty">' + esc(tip) + '</div>' + suggestList.map(function (e, i) {
        return '<div class="suggest-item" data-i="' + i + '" role="option">' +
          '<span class="si-name">' + esc(e.name) + '</span>' +
          '<span class="si-path">' + esc(PLACE.label(e)) + '</span>' +
          '<span class="si-lv lv' + e.level + '">' + (e.level === 0 ? '省' : e.level === 1 ? '市' : e.level === 2 ? '区县' : '海外') + '</span></div>';
      }).join('');
      box.classList.remove('hidden');
      bindSuggestItems();
      return;
    }
    if (!suggestList.length) {
      box.innerHTML = '<div class="suggest-empty">没有找到匹配的省市。可在「高级选项」里直接填写经纬度，或换个更常见的写法。</div>';
      box.classList.remove('hidden');
      return;
    }
    box.innerHTML = suggestList.map(function (e, i) {
      var lvName = e.level === 0 ? '省' : e.level === 1 ? '市' : e.level === 2 ? '区县' : '海外';
      return '<div class="suggest-item" data-i="' + i + '" role="option">' +
        '<span class="si-name">' + esc(e.name) + '</span>' +
        '<span class="si-path">' + esc(PLACE.label(e)) + '</span>' +
        '<span class="si-lv lv' + e.level + '">' + lvName + '</span></div>';
    }).join('');
    box.classList.remove('hidden');
    bindSuggestItems();
  }

  function bindSuggestItems() {
    $$('#citySuggest .suggest-item').forEach(function (el) {
      el.addEventListener('mousedown', function (ev) {
        ev.preventDefault();
        selectSuggest(+el.getAttribute('data-i'));
      });
    });
  }

  function hideSuggest() { $('#citySuggest').classList.add('hidden'); suggestList = []; suggestIndex = -1; }

  function selectSuggest(i) {
    var e = suggestList[i];
    if (!e) { return; }
    $('#city').value = e.name;
    applyPlace(e);
    hideSuggest();
  }

  function highlightSuggest() {
    $$('#citySuggest .suggest-item').forEach(function (el) {
      el.classList.toggle('active', +el.getAttribute('data-i') === suggestIndex);
    });
  }

  /* 判断是否可以直接采用该匹配结果（避免在只输入 1 个字时乱跳） */
  function shouldAutoApply(e, q) {
    var qn = PLACE.norm(q);
    var qc = PLACE.norm(PLACE.core(q));
    var nc = PLACE.norm(e.core || PLACE.core(e.name));
    if (qn === PLACE.norm(e.name) || (qc.length >= 2 && qc === nc)) { return true; }
    if (qn.length >= 2 && e.py && PLACE.norm(e.py) === qn) { return true; }
    if (qn.length >= 2 && e.pyf && PLACE.norm(e.pyf) === qn) { return true; }
    if (qc.length >= 2 && nc.indexOf(qc) === 0) { return true; }
    if (qn.length >= 3 && e.py && e.py.indexOf(qn) === 0) { return true; }
    return false;
  }

  function onCityInput(showPopular) {
    var q = $('#city').value.trim();
    if (!q) {
      if (showPopular) {
        renderSuggest(POPULAR.map(function (n) { return PLACE.byName(n); }).filter(Boolean), '常用城市：');
      } else { hideSuggest(); }
      return;
    }
    var list = PLACE.search(q, 14);
    renderSuggest(list);
    var top = list[0];
    if (top && shouldAutoApply(top, q)) { applyPlace(top); }
    else if (!list.length) {
      $('#cityHint').textContent = '未匹配到「' + q + '」，试试只输入城市名（如 潮州），或直接在高级选项填写经纬度';
      $('#cityHint').className = 'hint warn';
    }
  }
  function buildZoneSelect() {
    $('#zone').innerHTML = D.ZONES.map(function (z) {
      return '<option value="' + esc(z.zone) + '">' + esc(z.zone + '　' + z.label) + '</option>';
    }).join('');
  }

  function bindEvents() {
    $('#chartForm').addEventListener('submit', function (e) {
      e.preventDefault();
      run();
    });
    $('#city').addEventListener('input', function () {
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(function () { onCityInput(false); }, 120);
    });
    $('#city').addEventListener('focus', function () { if (!this.value.trim()) { onCityInput(true); } });
    $('#city').addEventListener('keydown', function (e) {
      var box = $('#citySuggest');
      if (box.classList.contains('hidden') || !suggestList.length) {
        if (e.key === 'ArrowDown') { onCityInput(true); e.preventDefault(); }
        return;
      }
      if (e.key === 'ArrowDown') { suggestIndex = Math.min(suggestIndex + 1, suggestList.length - 1); highlightSuggest(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { suggestIndex = Math.max(suggestIndex - 1, 0); highlightSuggest(); e.preventDefault(); }
      else if (e.key === 'Enter') { if (suggestIndex >= 0) { selectSuggest(suggestIndex); e.preventDefault(); } }
      else if (e.key === 'Escape') { hideSuggest(); }
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest('.combo')) { hideSuggest(); }
    });
    bindPlacePickers();
    $('#unknownTime').addEventListener('change', function () {
      $('#time').disabled = this.checked;
      $('#time').closest('.field').classList.toggle('disabled', this.checked);
    });
    $('#exampleBtn').addEventListener('click', function () { setExample(true); });
    $('#resetBtn').addEventListener('click', function () { resetForm(); });
    $('#advancedToggle').addEventListener('click', function () {
      var box = $('#advanced');
      box.classList.toggle('open');
      this.textContent = box.classList.contains('open') ? '收起高级选项' : '高级选项（经纬度 / 宫位制）';
    });
    $('#printBtn').addEventListener('click', function () { gated('打印 / 存为 PDF', function () { window.print(); }); });
    $('#pngBtn').addEventListener('click', function () { gated('下载高清星盘图片', exportPNG); });
    $('#copyReport').addEventListener('click', function () { gated('复制完整文字报告', function () { copy(lastReport.summary, '完整报告已复制'); }); });
    $('#copyShare').addEventListener('click', function () {
      var c = lastChart;
      var txt = '我的星盘：太阳' + c.byKey.sun.sign.name + ' · 月亮' + c.byKey.moon.sign.name + ' · 上升' + c.angleByKey.asc.sign.name +
        '\n命主星' + c.ascRuler.name + '落第' + (c.ascRuler.point ? c.ascRuler.point.house : '-') + '宫' +
        '\n你也来排一张：' + location.href.split('#')[0];
      copy(txt, '分享文案已复制');
    });
    $('#transitDate').addEventListener('change', function () { if (lastChart) renderTransits(lastChart); });
    $('#rpPreviewBtn').addEventListener('click', showReportPreview);
    $('#rpPdfBtn').addEventListener('click', function () { gated('下载多页 PDF 交付报告', downloadReportPdf, '深度PDF报告'); });
    $('#rpPrintBtn').addEventListener('click', function () { gated('打印 / 存为矢量 PDF 报告', printReport, '深度PDF报告'); });
    $('#rpCopyBtn').addEventListener('click', copyDelivery);
    window.addEventListener('beforeunload', function () { /* noop */ });
  }

  /* ===================== 表单 ===================== */
  function setExample(showToast) {
    $('#name').value = '示例：小星';
    $('#date').value = '1995-08-18';
    $('#time').value = '09:20';
    $('#unknownTime').checked = false;
    $('#time').disabled = false;
    var c = PLACE.byName('杭州');
    $('#city').value = c.name;
    applyPlace(c);
    $('#houseSystem').value = 'placidus';
    if (showToast) toast('已填入示例数据，点击「开始排盘」查看');
  }

  function resetForm() {
    $('#name').value = '';
    $('#date').value = '';
    $('#time').value = '';
    $('#unknownTime').checked = false;
    $('#time').disabled = false;
    $('#city').value = '';
    $('#lat').value = '';
    $('#lon').value = '';
    $('#cityHint').textContent = '';
    $('#results').classList.add('hidden');
    $('#placeholder').classList.remove('hidden');
  }

  function readForm() {
    var name = $('#name').value.trim() || '匿名';
    var dateVal = $('#date').value;
    if (!dateVal) { toast('请填写出生日期', 'warn'); return null; }
    var parts = dateVal.split('-');
    var year = +parts[0], month = +parts[1], day = +parts[2];
    if (year < 1800 || year > 2100) { toast('请填写 1800 - 2100 年之间的出生日期', 'warn'); return null; }
    var unknown = $('#unknownTime').checked;
    var timeVal = $('#time').value || '12:00';
    var tp = timeVal.split(':');
    var hour = unknown ? 12 : (+tp[0] || 0), minute = unknown ? 0 : (+tp[1] || 0);
    var cityName = $('#city').value.trim();
    var place = PLACE.byName(cityName);
    var lat = parseFloat($('#lat').value), lon = parseFloat($('#lon').value);
    if (place) { lat = place.lat; lon = place.lng; }
    if (!isFinite(lat) || !isFinite(lon)) { toast('未识别出生地，请在「高级选项」中填写经纬度，或换一个常见的城市名', 'warn'); return null; }
    var zone = $('#zone').value || (place ? place.tz : 'Asia/Shanghai');
    var tzOffset = E.zonedOffsetMinutes(zone, year, month, day, hour, minute);
    return {
      name: name, year: year, month: month, day: day, hour: hour, minute: minute,
      lat: lat, lon: lon, zone: zone, tzOffsetMinutes: tzOffset,
      houseSystem: $('#houseSystem').value, unknownTime: unknown,
      dateText: year + '-' + pad2(month) + '-' + pad2(day) + ' ' + pad2(hour) + ':' + pad2(minute),
      placeName: (place ? PLACE.label(place) : (cityName || '自定义地点')) + '（UTC' + (tzOffset >= 0 ? '+' : '-') + Math.abs(tzOffset / 60) + '）'
    };
  }

  /* ===================== 主流程 ===================== */
  function run() {
    var input = readForm();
    if (!input) return;
    var btn = $('#submitBtn');
    btn.disabled = true; btn.textContent = '正在计算星盘…';
    setTimeout(function () {
      try {
        var raw = E.computeChart(input);
        raw.input = input;
        lastChart = A.build(raw);
        lastReport = T.report(lastChart);
        renderAll();
        saveHistory(input);
        $('#placeholder').classList.add('hidden');
        $('#results').classList.remove('hidden');
        var top = $('#results').getBoundingClientRect().top + window.pageYOffset - 70;
        window.scrollTo({ top: top, behavior: 'smooth' });
      } catch (err) {
        console.error(err);
        toast('排盘失败：' + err.message, 'warn');
      } finally {
        btn.disabled = false; btn.textContent = '开始排盘';
      }
    }, 30);
  }

  function renderAll() {
    var c = lastChart, r = lastReport;
    renderWheel(c);
    renderBigThree(c, r);
    renderPlanetsTable(c);
    renderHousesTable(c);
    renderAspects(c);
    renderBalance(c, r);
    renderReading(r);
    renderTransits(c);
    $('#metaLine').textContent = c.input.name + ' · ' + c.input.dateText + ' · ' + c.input.placeName +
      (c.input.unknownTime ? ' · ⚠ 出生时间未知，上升与宫位仅供参考' : '') +
      ' · 宫位制：' + (c.raw.houses.system === 'placidus' ? '普拉西度' : c.raw.houses.system === 'whole' ? '整宫制' : c.raw.houses.system === 'equal' ? '等分宫位' : '波菲里' + (c.raw.houses.fallback ? '（高纬度自动降级）' : ''));
    $('#unknownWarn').classList.toggle('hidden', !c.input.unknownTime);
    resetReportPanel(c);
  }

  function renderWheel(c) {
    var svg = W.render(c, { showNodes: false });
    $('#wheel').innerHTML = svg;
  }

  function renderBigThree(c, r) {
    var html = r.bigThree.map(function (b, i) {
      var p = i === 0 ? c.byKey.sun : i === 1 ? c.byKey.moon : c.angleByKey.asc;
      var cls = i === 0 ? 'sun' : i === 1 ? 'moon' : 'asc';
      return '<div class="big-card ' + cls + '">' +
        '<div class="big-glyph">' + (i === 2 ? 'AC' : p.glyph) + '</div>' +
        '<div class="big-title">' + esc(b.title) + '</div>' +
        '<div class="big-sub">' + esc(b.sub) + '</div>' +
        '<div class="big-body">' + esc(b.body) + '</div></div>';
    }).join('');
    $('#bigThree').innerHTML = html;
  }

  function renderPlanetsTable(c) {
    var rows = c.points.filter(function (p) { return p.key !== 'southnode'; }).map(function (p) {
      var dig = p.dignity && p.dignity.length ? '<span class="tag tag-dig">' + p.dignity.map(function (d) { return d.type; }).join('') + '</span>' : '';
      var rx = p.retrograde && p.key !== 'node' ? '<span class="tag tag-rx">℞ 逆行</span>' : '';
      return '<tr>' +
        '<td class="c-planet"><span class="glyph">' + p.glyph + '</span>' + esc(p.name) + '</td>' +
        '<td>' + p.sign.glyph + ' ' + esc(p.sign.name) + '</td>' +
        '<td class="num">' + p.degText + '</td>' +
        '<td class="num">' + p.house + ' 宫</td>' +
        '<td>' + p.sign.element + ' · ' + p.sign.mode + '</td>' +
        '<td>' + (p.speed < 0 ? '−' : '+') + Math.abs(p.speed).toFixed(3) + '°/天</td>' +
        '<td>' + rx + dig + '</td>' +
      '</tr>';
    }).join('');
    $('#planetsTable').innerHTML = '<thead><tr><th>行星</th><th>星座</th><th>度数</th><th>宫位</th><th>元素</th><th>日行度</th><th>状态</th></tr></thead><tbody>' + rows + '</tbody>';
    var angles = c.angles.map(function (a) {
      return '<tr><td class="c-planet"><span class="glyph">' + a.glyph + '</span>' + esc(a.name) + '</td><td>' + a.sign.glyph + ' ' + esc(a.sign.name) + '</td><td class="num">' + a.degText + '</td><td class="num">—</td><td>' + a.sign.element + ' · ' + a.sign.mode + '</td><td>—</td><td></td></tr>';
    }).join('');
    $('#anglesTable').innerHTML = '<thead><tr><th>四轴</th><th>星座</th><th>度数</th><th>宫位</th><th>元素</th><th>日行度</th><th>状态</th></tr></thead><tbody>' + angles + '</tbody>';
  }

  function renderHousesTable(c) {
    var rows = c.houses.map(function (h) {
      var planets = h.planets.map(function (k) { return '<span class="glyph-sm">' + (c.byKey[k] ? c.byKey[k].glyph : '') + '</span>'; }).join('');
      var name = T.HOUSE_MEANING[h.index];
      return '<tr>' +
        '<td class="num">' + h.index + '</td>' +
        '<td>' + esc(name) + '</td>' +
        '<td>' + h.sign.glyph + ' ' + esc(h.sign.name) + ' <span class="dim">' + h.degText + '</span></td>' +
        '<td>' + esc(h.ruler) + '</td>' +
        '<td>' + (planets || '<span class="dim">空</span>') + '</td>' +
      '</tr>';
    }).join('');
    $('#housesTable').innerHTML = '<thead><tr><th>宫位</th><th>领域</th><th>宫头</th><th>宫主星</th><th>宫内行星</th></tr></thead><tbody>' + rows + '</tbody>';
  }

  function renderAspects(c) {
    var list = c.aspects.filter(function (a) { return a.major || a.type === 'quincunx'; });
    var rows = list.map(function (a) {
      return '<tr class="nature-' + a.nature + '">' +
        '<td>' + a.aGlyph + ' ' + esc(a.aName) + '</td>' +
        '<td class="num">' + a.typeGlyph + ' ' + esc(a.typeName) + '</td>' +
        '<td>' + a.bGlyph + ' ' + esc(a.bName) + '</td>' +
        '<td class="num">' + a.orb.toFixed(2) + '°</td>' +
        '<td>' + esc(a.nature) + (a.exact ? ' <span class="tag tag-exact">紧密</span>' : '') + '</td>' +
      '</tr>';
    }).join('');
    $('#aspectsTable').innerHTML = '<thead><tr><th>行星 A</th><th>相位</th><th>行星 B</th><th>容许度</th><th>性质</th></tr></thead><tbody>' + rows + '</tbody>';

    // 相位网格
    var pts = c.corePlanets.slice();
    var head = '<tr><th></th>' + pts.map(function (p) { return '<th title="' + esc(p.name) + '">' + p.glyph + '</th>'; }).join('') + '</tr>';
    var body = pts.map(function (p, i) {
      var tds = pts.map(function (q, j) {
        if (j >= i) return '<td class="grid-empty"></td>';
        var hit = A.aspectBetween(p.lon, q.lon, p.key, q.key);
        if (!hit || !hit.aspect.major) return '<td class="grid-empty"></td>';
        return '<td class="grid-' + hit.aspect.key + '" title="' + esc(hit.aspect.name + ' ' + hit.orb.toFixed(2) + '°') + '">' + hit.aspect.glyph + '</td>';
      }).join('');
      return '<tr><th title="' + esc(p.name) + '">' + p.glyph + '</th>' + tds + '</tr>';
    }).join('');
    $('#aspectGrid').innerHTML = '<table class="grid-table">' + head + body + '</table>';
  }

  function renderBalance(c, r) {
    var el = c.distributions.elements, mode = c.distributions.modes;
    var elTotal = Object.keys(el).reduce(function (s, k) { return s + el[k]; }, 0) || 1;
    var bar = function (obj, colorMap) {
      return Object.keys(obj).map(function (k) {
        var pct = Math.round(obj[k] / 10 * 100);
        return '<div class="bar-row"><span class="bar-label">' + k + '</span>' +
          '<span class="bar-track"><span class="bar-fill" style="width:' + pct + '%;background:' + colorMap[k] + '"></span></span>' +
          '<span class="bar-num">' + obj[k] + '</span></div>';
      }).join('');
    };
    $('#balanceBars').innerHTML =
      '<div class="bar-col"><h4>元素分布</h4>' + bar(el, { '火': '#c8563f', '土': '#a5764b', '风': '#4a86b8', '水': '#2f7f8a' }) + '</div>' +
      '<div class="bar-col"><h4>模式分布</h4>' + bar(mode, { '基本': '#e8c46a', '固定': '#7f9ad0', '变动': '#66c39a' }) + '</div>' +
      '<div class="bar-col"><h4>半球分布</h4>' +
        '<div class="bar-row"><span class="bar-label">地平线上</span><span class="bar-track"><span class="bar-fill" style="width:' + (c.distributions.hemispheres.upper * 10) + '%;background:#e8c46a"></span></span><span class="bar-num">' + c.distributions.hemispheres.upper + '</span></div>' +
        '<div class="bar-row"><span class="bar-label">地平线下</span><span class="bar-track"><span class="bar-fill" style="width:' + (c.distributions.hemispheres.lower * 10) + '%;background:#7f9ad0"></span></span><span class="bar-num">' + c.distributions.hemispheres.lower + '</span></div>' +
        '<div class="bar-row"><span class="bar-label">东半球</span><span class="bar-track"><span class="bar-fill" style="width:' + (c.distributions.hemispheres.east * 10) + '%;background:#66c39a"></span></span><span class="bar-num">' + c.distributions.hemispheres.east + '</span></div>' +
        '<div class="bar-row"><span class="bar-label">西半球</span><span class="bar-track"><span class="bar-fill" style="width:' + (c.distributions.hemispheres.west * 10) + '%;background:#c8563f"></span></span><span class="bar-num">' + c.distributions.hemispheres.west + '</span></div>' +
      '</div>';

    var pats = c.patterns.length
      ? c.patterns.map(function (p) { return '<li><b>' + esc(p.name) + '</b>：' + esc(p.detail) + '</li>'; }).join('')
      : '<li class="dim">未检测到明显的古典格局（大三角 / T 三角 / Yod / 群星聚集）</li>';
    $('#patternList').innerHTML = pats;
  }

  function renderReading(r) {
    var sec = function (title, items, open) {
      if (!items.length) return '';
      return '<section class="read-block">' +
        '<h3>' + esc(title) + '</h3>' +
        '<div class="read-items">' + items.map(function (it) {
          return '<details class="read-item"' + (open ? ' open' : '') + '>' +
            '<summary><span class="ri-title">' + esc(it.title) + '</span><span class="ri-sub">' + esc(it.sub || '') + '</span></summary>' +
            '<p>' + esc(it.body) + '</p></details>';
        }).join('') + '</div></section>';
    };
    $('#reading').innerHTML =
      sec('行星落座与落宫（共 ' + r.planets.length + ' 项）', r.planets) +
      sec('重要相位解析', r.aspects) +
      sec('星盘格局', r.patterns) +
      sec('能量平衡', r.balance);
  }

  function renderTransits(c) {
    var val = $('#transitDate').value;
    var date = val ? new Date(val + 'T12:00:00Z') : new Date();
    var tr = A.transits(c, date);
    lastTransit = tr;
    var items = T.transitReport(tr);
    var today = date.getUTCFullYear() + '-' + pad2(date.getUTCMonth() + 1) + '-' + pad2(date.getUTCDate());
    $('#transitDateLabel').textContent = today;
    if (!items.length) {
      $('#transitList').innerHTML = '<li class="dim">这一天没有 1.5° 以内的紧密行运相位，属于相对平稳的时期。</li>';
    } else {
      $('#transitList').innerHTML = items.map(function (x) {
        return '<li><b>' + esc(x.title) + '</b><span class="dim">（' + esc(x.sub) + '）</span><br>' + esc(x.body) + '</li>';
      }).join('');
    }
    var nowSigns = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].map(function (k) {
      var lon = tr.positions[k].lon;
      var si = A.signIndexOf(lon);
      return A.SIGNS[si].glyph + '<span class="dim">' + A.formatDeg(lon) + '</span>';
    }).join(' ');
    $('#currentSky').innerHTML = nowSigns;
  }

  /* ===================== 付费解锁 ===================== */
  var pendingAction = null, currentOrder = null, payChannel = 'wechat';

  function currentReportNo() {
    try { return lastChart ? R.makeReportNo(lastChart.input) : ''; } catch (e) { return ''; }
  }
  function isUnlockedNow() { return PAY.isUnlocked(currentReportNo()); }

  /* 统一的付费闸门：已解锁直接执行，未解锁先弹付费窗 */
  function gated(label, fn, product) {
    if (isUnlockedNow()) { fn(); return; }
    openPaywall(label, fn, product || '解锁导出');
  }

  function updateUnlockBadge() {
    var badge = $('#unlockBadge');
    if (!badge) { return; }
    badge.classList.toggle('hidden', !isUnlockedNow());
    var st = PAY.state();
    if (st && st.unlocked) { badge.textContent = '🔓 已解锁导出功能'; }
  }

  function bindPaywall() {
    $$('#paywall [data-close]').forEach(function (el) { el.addEventListener('click', closePaywall); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#paywall').classList.contains('hidden')) { closePaywall(); } });
    $$('#qrTabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        payChannel = b.getAttribute('data-ch');
        renderQr(payChannel);
        if (currentOrder) { try { ORDERS.update(currentOrder.orderNo, { channel: payChannel }); } catch (e) {} }
        if (CONFIG.pay.apiEnabled && CONFIG.pay.apiBase) { startRemoteOrder(); }
      });
    });
    $('#payUnlock').addEventListener('click', doUnlock);
    $('#payCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') { doUnlock(); } });
    $('#copyOrderNo').addEventListener('click', function () {
      if (currentOrder) { copy(currentOrder.orderNo, '订单号已复制，付款后发给解读师即可'); }
    });
    $('#payReset').addEventListener('click', function () {
      PAY.lock(); updateUnlockBadge();
      showPayMsg('已重置解锁状态，可重新输入解锁码验证', '');
    });
  }

  /* 若配置了支付后端，把订单事件同步过去（失败不影响本地流程） */
  function syncOrder(orderNo, status) {
    var cfg = CONFIG.pay || {};
    if (!cfg.apiBase || !cfg.apiEnabled) { return; }
    var o = ORDERS.get(orderNo) || {};
    try {
      fetch(cfg.apiBase.replace(/\/$/, '') + '/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNo: o.orderNo, reportNo: o.reportNo, customer: o.customer, product: o.product,
          amount: o.amount, channel: o.channel, status: status || o.status,
          createdAt: o.createdAt, paidAt: o.paidAt
        })
      }).catch(function () {});
    } catch (e) {}
  }
  function openPaywall(label, fn, product) {
    pendingAction = fn || null;
    var cfg = CONFIG.pay || {};
    currentOrder = PAY.makeOrder({ reportNo: currentReportNo(), subject: cfg.title });
    currentOrder.product = product || '解锁导出';
    // 本地记账（客户点了付费导出即生成一笔待付款订单）
    try {
      ORDERS.recordAttempt({
        orderNo: currentOrder.orderNo,
        reportNo: currentOrder.reportNo,
        customer: lastChart ? (lastChart.input.name || '') : '',
        product: currentOrder.product,
        amount: cfg.price,
        channel: payChannel
      });
      syncOrder(currentOrder.orderNo, 'pending');
    } catch (e) { console.error(e); }
    $('#payOrderNo').textContent = currentOrder.orderNo;
    $('#payTitle').textContent = cfg.title || '解锁导出与高清报告';
    $('#paySub').textContent = (cfg.mode === 'report')
      ? '本报告需要单独解锁后才可导出'
      : '一次解锁，本设备即可下载图片、打印/存为 PDF、复制完整报告';
    $('#payPrice').innerHTML = esc(cfg.priceText || '') + '<small>' + (cfg.mode === 'report' ? '每份报告' : '一次解锁，永久可用') + '</small>';
    $('#payAmount').textContent = cfg.priceText || '';
    showPayMsg(label ? '解锁后即可：' + label : '', '');
    $('#payCode').value = '';
    $('#payContact').innerHTML = cfg.contact ? ('解读师：<b>' + esc(cfg.payeeName || '') + '</b><br>' + esc(cfg.contact)) : '';
    var availChannels = syncQrTabs();
    if (!availChannels.length) { payChannel = 'wechat'; }
    renderQr(payChannel);
    // 防御：还没配置任何解锁码哈希（也没接后端）时明确提示，避免客户付款后无法解锁
    var hasCodes = (cfg.unlockHashes && cfg.unlockHashes.length) || (cfg.reportHashes && cfg.reportHashes.length);
    if (!hasCodes && !(cfg.apiEnabled && cfg.apiBase)) {
      showPayMsg('当前站点尚未开放自助解锁，请联系解读师获取解锁方式', 'err');
    }
    $('#paywall').classList.remove('hidden');
    document.body.classList.add('paywall-open');
    $('#payPoll').classList.add('hidden');
    if (cfg.apiEnabled && cfg.apiBase) { startRemoteOrder(); }
    setTimeout(function () { $('#payCode').focus(); }, 160);
  }

  function closePaywall() {
    $('#paywall').classList.add('hidden');
    document.body.classList.remove('paywall-open');
  }

  /* 当前可用的收款渠道：后端支付模式下两个都可用；否则看有没有配二维码 */
  function availableChannels() {
    var cfg = CONFIG.pay || {};
    if (cfg.apiEnabled && cfg.apiBase) { return ['wechat', 'alipay']; }
    var list = [];
    if (cfg.wechatQrcode || CONFIG.qrcodeSrc) { list.push('wechat'); }
    if (cfg.alipayQrcode) { list.push('alipay'); }
    return list;
  }

  function syncQrTabs() {
    var avail = availableChannels();
    $$('#qrTabs button').forEach(function (b) {
      b.classList.toggle('hidden', avail.indexOf(b.getAttribute('data-ch')) < 0);
    });
    // 只配了一个渠道时，不需要切换栏
    $('#qrTabs').classList.toggle('hidden', avail.length <= 1);
    if (avail.length && avail.indexOf(payChannel) < 0) { payChannel = avail[0]; }
    return avail;
  }

  function renderQr(channel) {
    payChannel = channel;
    var cfg = CONFIG.pay || {};
    var who = channel === 'alipay' ? '支付宝' : '微信';
    var src = channel === 'alipay' ? cfg.alipayQrcode : cfg.wechatQrcode;
    var fallback = false;
    // 微信没单独配收款码时，退回用「加微信二维码」：客户加好友后转账，再把订单号发过来
    if (!src && channel === 'wechat' && CONFIG.qrcodeSrc) { src = CONFIG.qrcodeSrc; fallback = true; }

    function tipText(isFallback) {
      if (cfg.apiEnabled && cfg.apiBase) { return '扫码支付后会自动解锁，无需手动输入解锁码'; }
      if (isFallback) {
        return '扫码加' + (cfg.payeeName || '解读师') + '，转账 ' + (cfg.priceText || '') + ' 后把订单号发过来领取解锁码';
      }
      return '付款后把订单号发给' + (cfg.payeeName || '解读师') + '领取解锁码';
    }

    if (src) {
      $('#qrBox').innerHTML = '<img src="' + esc(src) + '" alt="' + who + (fallback ? '联系二维码' : '收款码') + '">';
      var img = $('#qrBox img');
      // 图片不存在 / 打不开时：微信渠道退回加好友二维码，其它渠道给出明确提示，避免显示裂图
      img.addEventListener('error', function () {
        if (!fallback && channel === 'wechat' && CONFIG.qrcodeSrc && src !== CONFIG.qrcodeSrc) {
          fallback = true;
          img.src = CONFIG.qrcodeSrc;
          $('#qrTip').textContent = tipText(true);
        } else {
          $('#qrBox').innerHTML = '<div class="qr-empty">二维码图片加载失败<br>请检查 ' + esc(src) + '<br>是否已放进 images 目录</div>';
        }
      });
    } else {
      $('#qrBox').innerHTML = '<div class="qr-empty">尚未配置' + who + '收款码<br>请在 CONFIG.pay.' + (channel === 'alipay' ? 'alipayQrcode' : 'wechatQrcode') + ' 里填写图片路径</div>';
    }
    $('#qrTip').textContent = tipText(fallback);
    $$('#qrTabs button').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-ch') === channel); });
  }
  function showPayMsg(text, cls) {
    var el = $('#payMsg');
    el.textContent = text || '';
    el.className = 'pay-msg' + (cls ? ' ' + cls : '');
  }

  function doUnlock() {
    var code = $('#payCode').value.trim();
    if (!code) { showPayMsg('请输入解锁码', 'err'); return; }
    var res = PAY.unlock(code, currentReportNo(), { orderNo: currentOrder ? currentOrder.orderNo : '' });
    if (!res.ok) {
      showPayMsg('解锁码不正确。请核对大小写与连字符，或把订单号 ' + (currentOrder ? currentOrder.orderNo : '') + ' 发给解读师重新获取', 'err');
      return;
    }
    showPayMsg('解锁成功，感谢支持！', 'ok');
    try {
      if (currentOrder) {
        ORDERS.markPaid(currentOrder.orderNo, { channel: payChannel, code: code });
        syncOrder(currentOrder.orderNo, 'paid');
      }
    } catch (e) { console.error(e); }
    updateUnlockBadge();
    var act = pendingAction; pendingAction = null;
    setTimeout(function () {
      closePaywall();
      toast('已解锁导出功能');
      if (act) { act(); }
    }, 520);
  }

  /* 后端支付（微信 Native / 支付宝当面付）：创建订单 → 轮询 → 自动解锁 */
  function startRemoteOrder() {
    var cfg = CONFIG.pay || {};
    if (!cfg.apiBase) { return; }
    var pollBox = $('#payPoll');
    pollBox.classList.remove('hidden');
    $('#payPollText').textContent = '正在创建支付订单…';
    PAY.createRemoteOrder({ reportNo: currentReportNo(), subject: cfg.title, channel: payChannel }).then(function (res) {
      if (!res || !res.orderNo) { throw new Error((res && res.message) || '订单创建失败'); }
      currentOrder.orderNo = res.orderNo;
      $('#payOrderNo').textContent = res.orderNo;
      var img = res.qrcodeDataUrl || '';
      if (!img && res.codeUrl) { img = ''; }
      if (img) {
        $('#qrBox').innerHTML = '<img src="' + img + '" alt="支付二维码">';
      } else if (res.codeUrl) {
        $('#qrBox').innerHTML = '<div class="qr-empty">支付链接：<br>' + esc(String(res.codeUrl).slice(0, 60)) + '<br>（后端未安装 qrcode 模块，无法生成二维码图片）</div>';
      }
      $('#payPollText').textContent = '等待支付结果，支付成功后会自动解锁…';
      return PAY.pollRemoteOrder(res.orderNo, null, 3000, 10 * 60 * 1000);
    }).then(function () {
      PAY.unlock('', currentReportNo(), { trusted: true, kind: 'server', orderNo: currentOrder.orderNo });
      try {
        ORDERS.markPaid(currentOrder.orderNo, { channel: payChannel });
        syncOrder(currentOrder.orderNo, 'paid');
      } catch (e) {}
      updateUnlockBadge();
      showPayMsg('支付成功，已自动解锁！', 'ok');
      var act = pendingAction; pendingAction = null;
      setTimeout(function () { closePaywall(); toast('支付成功，已解锁'); if (act) { act(); } }, 700);
    }).catch(function (err) {
      $('#payPollText').textContent = '自动解锁暂不可用：' + (err && err.message ? err.message : '未知错误') + '，可联系解读师领取解锁码';
    });
  }
  /* ===================== 付费报告 ===================== */
  function resetReportPanel(c) {
    var cfg = CONFIG.report || {};
    $('#rpTitle').value = cfg.title || '深度个人星盘报告';
    $('#rpClient').value = c.input.name || '';
    $('#rpAuthor').value = cfg.author || CONFIG.siteName;
    $('#rpOrder').value = '';
    $('#rpWatermark').value = (cfg.watermark || '').replace('{client}', c.input.name || '');
    $('#rpContact').value = CONFIG.contactValue || '';
    $('#rpPreview').classList.add('hidden');
    $('#rpPreview').innerHTML = '';
    setReportStatus('');
  }

  function setReportStatus(html) { $('#rpStatus').innerHTML = html || ''; }

  function collectReportOptions() {
    var cfg = CONFIG.report || {};
    var client = $('#rpClient').value.trim() || lastChart.input.name || '匿名';
    return {
      title: $('#rpTitle').value.trim() || cfg.title || '深度个人星盘报告',
      client: client,
      author: $('#rpAuthor').value.trim() || cfg.author || CONFIG.siteName,
      orderNo: $('#rpOrder').value.trim(),
      contact: $('#rpContact').value.trim() || CONFIG.contactValue || '',
      watermark: ($('#rpWatermark').value.trim() || '').replace('{client}', client),
      footer: cfg.footer || (CONFIG.siteName + ' · 本报告仅供个人参考')
    };
  }

  function buildReportModel() {
    if (!lastChart) { return null; }
    return R.model(lastChart, lastReport, collectReportOptions());
  }

  function showReportPreview() {
    if (!lastChart) { toast('请先排盘', 'warn'); return; }
    var model = buildReportModel();
    $('#rpPreview').innerHTML = R.renderHTML(model, W.render(lastChart, { showNodes: false }));
    $('#rpPreview').classList.remove('hidden');
    setReportStatus('报告编号 <b>' + esc(model.meta.reportNo) + '</b> · 共 ' + model.chapters.length +
      ' 章 · 交付建议：先「下载 PDF 文件」，再「复制交付话术」发给客户。');
    $('#rpPreview').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* 把星盘 SVG 转成可供画布绘制的图片 */
  function loadWheelImage(chart, size) {
    return new Promise(function (resolve) {
      var svg = W.render(chart, { showNodes: false });
      var blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        try {
          var cv = document.createElement('canvas');
          cv.width = cv.height = size || 1400;
          var ctx = cv.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.drawImage(img, 0, 0, cv.width, cv.height);
          URL.revokeObjectURL(url);
          resolve(cv);
        } catch (e) { URL.revokeObjectURL(url); resolve(null); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  function downloadReportPdf() {
    if (!lastChart) { toast('请先排盘', 'warn'); return; }
    var btn = $('#rpPdfBtn');
    btn.disabled = true;
    var cfg = CONFIG.report || {};
    var model = buildReportModel();
    setReportStatus('正在绘制星盘图…');
    loadWheelImage(lastChart, 1400).then(function (wheelImg) {
      var pages = RC.render(model, { wheelImage: wheelImg });
      if (!pages.length) { setReportStatus('生成失败：没有页面'); btn.disabled = false; return; }
      var queue = pages.slice(), out = [], total = pages.length;
      function step() {
        if (!queue.length) {
          var blob = P.build(out, {
            title: model.meta.title + ' · ' + model.meta.client,
            author: model.meta.author,
            subject: '星盘报告 ' + model.meta.reportNo,
            creator: CONFIG.siteName
          });
          var name = (model.meta.client || '星盘') + '-' + (model.meta.reportNo || '') + '-星盘报告.pdf';
          var size = P.download(blob, name);
          setReportStatus('✔ PDF 已生成：<b>' + total + ' 页</b>，约 ' + (size / 1048576).toFixed(2) +
            ' MB。文件名：' + esc(name));
          btn.disabled = false;
          toast('PDF 报告已开始下载');
          return;
        }
        var idx = total - queue.length + 1;
        setReportStatus('正在打包 PDF… 第 <b>' + idx + ' / ' + total + '</b> 页');
        var cv = queue.shift();
        P.canvasToPage(cv, { quality: cfg.pdfQuality || 0.92, lossless: cfg.lossless !== false }).then(function (pg) {
          out.push(pg);
          cv.width = 0; cv.height = 0;
          setTimeout(step, 0);
        }, function () {
          setReportStatus('打包失败，请改用「打印 / 存为矢量 PDF」');
          btn.disabled = false;
        });
      }
      step();
    });
  }

  function printReport() {
    if (!lastChart) { toast('请先排盘', 'warn'); return; }
    var model = buildReportModel();
    $('#printRoot').innerHTML = R.renderHTML(model, W.render(lastChart, { showNodes: false }));
    document.body.classList.add('printing-report');
    var cleanup = function () {
      document.body.classList.remove('printing-report');
      window.onafterprint = null;
    };
    window.onafterprint = cleanup;
    setTimeout(function () { window.print(); setTimeout(cleanup, 1200); }, 80);
    setReportStatus('已打开打印面板：目标选择「另存为 PDF」即可得到矢量版（文字可选中、体积小）。');
  }

  function copyDelivery() {
    if (!lastChart) { toast('请先排盘', 'warn'); return; }
    var model = buildReportModel();
    var t = [
      '【' + model.meta.title + '】已生成',
      '客户：' + model.meta.client,
      '报告编号：' + model.meta.reportNo,
      '内容：封面 + 目录 + ' + model.chapters.length + ' 章（' + model.chapters.map(function (c) { return c.title.split(' · ')[0]; }).join(' / ') + '）',
      '说明：本报告为个人定制解读，仅供本人参考，请勿转发或商用。',
      '如需二次解读（关系合盘 / 未来一年推运 / 具体问题答疑），可以随时找我。'
    ].join('\n');
    copy(t, '交付话术已复制');
  }
  /* ===================== 导出 / 复制 ===================== */
  function exportPNG() {
    if (!lastChart) return;
    var svg = W.render(lastChart, {});
    W.toDataURL(svg, function (data) {
      if (!data) { toast('导出失败，请改用打印 / 另存为 PDF', 'warn'); return; }
      var a = document.createElement('a');
      a.href = data;
      a.download = (lastChart.input.name || '星盘') + '-' + lastChart.input.dateText.replace(/[^\d]/g, '').slice(0, 12) + '-星盘.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast('星盘图片已下载');
    }, 1400);
  }

  function copy(text, msg) {
    var done = function () { toast(msg || '已复制'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else { fallbackCopy(text, done); }
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动选择文本', 'warn'); }
    document.body.removeChild(ta);
  }

  /* ===================== 本地历史 ===================== */
  function saveHistory(input) {
    try {
      var key = 'astro_history_v1';
      var list = JSON.parse(localStorage.getItem(key) || '[]');
      list = list.filter(function (x) { return !(x.dateText === input.dateText && x.placeName === input.placeName && x.name === input.name); });
      list.unshift(input);
      localStorage.setItem(key, JSON.stringify(list.slice(0, 6)));
      localStorage.setItem('astro_last_v1', JSON.stringify(input));
      renderHistory();
    } catch (e) {}
  }
  function restoreLast() {
    try { renderHistory(); } catch (e) {}
  }
  function renderHistory() {
    var list = [];
    try { list = JSON.parse(localStorage.getItem('astro_history_v1') || '[]') || []; } catch (e) { list = []; }
    var box = $('#history');
    if (!list.length) { box.innerHTML = ''; return; }
    box.innerHTML =
      '<div class="history-head">' +
        '<span class="history-title">最近排盘</span>' +
        '<button type="button" class="history-clear" id="historyClear">清除</button>' +
      '</div>' +
      '<div class="history-list">' + list.map(function (x, i) {
        return '<button class="chip" data-idx="' + i + '">' + esc(x.name) + ' · ' + esc(x.dateText.slice(0, 10)) + '</button>';
      }).join('') + '</div>';
    $$('#history .chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = list[+btn.getAttribute('data-idx')];
        $('#name').value = item.name;
        $('#date').value = item.year + '-' + pad2(item.month) + '-' + pad2(item.day);
        $('#time').value = pad2(item.hour) + ':' + pad2(item.minute);
        $('#unknownTime').checked = !!item.unknownTime;
        $('#time').disabled = !!item.unknownTime;
        $('#city').value = (item.placeName || '').split('（')[0];
        $('#lat').value = item.lat; $('#lon').value = item.lon;
        $('#zone').value = item.zone || 'Asia/Shanghai';
        $('#houseSystem').value = item.houseSystem || 'placidus';
        toast('已载入历史记录，点击「开始排盘」重新计算');
      });
    });
    // 清除按钮：第一次点变成「确认清除？」，3 秒内再点一次才真正清除
    var clearBtn = $('#historyClear');
    var resetTimer = null;
    clearBtn.addEventListener('click', function () {
      if (clearBtn.getAttribute('data-confirm') === '1') {
        clearHistory();
        return;
      }
      clearBtn.setAttribute('data-confirm', '1');
      clearBtn.textContent = '确认清除？';
      clearBtn.classList.add('danger');
      clearTimeout(resetTimer);
      resetTimer = setTimeout(function () {
        clearBtn.setAttribute('data-confirm', '');
        clearBtn.textContent = '清除';
        clearBtn.classList.remove('danger');
      }, 3000);
    });
  }

  function clearHistory() {
    try {
      localStorage.removeItem('astro_history_v1');
      localStorage.removeItem('astro_last_v1');
    } catch (e) {}
    renderHistory();
    toast('已清除最近排盘记录（已有星盘结果不受影响）');
  }
  /* ===================== 提示 ===================== */
  var toastTimer = null;
  function toast(msg, type) {
    var el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show' + (type === 'warn' ? ' warn' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, 2600);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
/*!
 * report.js —— 付费 PDF 报告：内容模型 + HTML 排版
 * 输出结构化章节（model），供「网页预览 / 打印矢量 PDF / 画布图片版 PDF」三种渲染共用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./astro.js'), require('./interpretations.js'), require('./ephemeris.js'));
  } else {
    root.AstroReport = factory(root.AstroChart, root.AstroText, root.AstroEphemeris);
  }
})(typeof self !== 'undefined' ? self : this, function (A, T, E) {
  'use strict';

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function makeReportNo(input) {
    var s = (input.name || '') + '|' + input.dateText + '|' + (input.placeName || '');
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    var d = new Date();
    var ymd = String(d.getFullYear()).slice(2) + pad2(d.getMonth() + 1) + pad2(d.getDate());
    var code = h.toString(36).toUpperCase();
    while (code.length < 5) { code = '0' + code; }
    return 'XY' + ymd + '-' + code.slice(0, 5);
  }

  /* ---------------- 未来一年重点行运 ---------------- */

  function yearTransits(chart, months) {
    months = months || 12;
    var start = new Date();
    var hits = {};
    for (var d = 0; d < months * 31; d += 7) {
      var date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + d, 12, 0));
      var tr = A.transits(chart, date);
      tr.list.forEach(function (x) {
        var key = x.transiting + '|' + x.natal + '|' + x.type;
        var prev = hits[key];
        if (!prev || x.orb < prev.orb) {
          hits[key] = {
            key: key, date: date, orb: x.orb,
            transiting: x.transiting, transitingName: x.transitingName,
            natal: x.natal, natalName: x.natalName,
            type: x.type, typeName: x.typeName, typeGlyph: x.typeGlyph
          };
        }
      });
    }
    var out = Object.keys(hits).map(function (k) { return hits[k]; });
    var weight = { pluto: 6, neptune: 5.5, uranus: 5, saturn: 4.5, jupiter: 3.5, mars: 2, sun: 1.5, venus: 1.2, mercury: 1.2, moon: 0.4 };
    var targetWeight = { asc: 2, mc: 2, sun: 2, moon: 1.8 };
    out.sort(function (a, b) {
      var wa = (weight[a.transiting] || 1) * (targetWeight[a.natal] || 1);
      var wb = (weight[b.transiting] || 1) * (targetWeight[b.natal] || 1);
      return wb - wa;
    });
    return out.slice(0, 10);
  }

  /* ---------------- 成长建议规则 ---------------- */

  function suggestions(chart) {
    var out = [];
    var el = chart.distributions.elements, mode = chart.distributions.modes;
    var elMax = ['火', '土', '风', '水'].reduce(function (a, b) { return el[b] > el[a] ? b : a; }, '火');
    var elMin = ['火', '土', '风', '水'].reduce(function (a, b) { return el[b] < el[a] ? b : a; }, '火');
    var suggest = {
      '火': '你的火元素很强，行动力是你的杀手锏，但请给热情配一个冷却期：重大决定隔夜再做。',
      '土': '你的土元素很强，落地能力可靠，但要小心用「还没准备好」拖住自己，给自己一个「先做 60 分版本」的规则。',
      '风': '你的风元素很强，信息与人脉是优势，用输出倒逼输入：每周把学到的东西写成一篇短内容。',
      '水': '你的水元素很强，感受力是天赋，但需要边界：每天留一段完全属于自己的静默时间。',
      '缺火': '你缺少火元素，启动困难是正常的，不必自责。用「五分钟启动法」：只承诺做五分钟，让身体先动起来。',
      '缺土': '你缺少土元素，容易飘在想法里。从两件小事补土：固定起床时间、每月记账一次。',
      '缺风': '你缺少风元素，容易陷在情绪里出不来。用「写下来」拉开距离：把情绪写成三句话再读一遍。',
      '缺水': '你缺少水元素，不太习惯表达感受。先练习命名情绪（我现在是委屈，还是失望），再决定说不说出口。'
    };
    out.push(suggest[elMax] || suggest['火']);
    if (el[elMin] === 0) { out.push(suggest['缺' + elMin]); }
    else {
      out.push('你的' + elMin + '元素相对偏弱，可以有意识地往这个方向补：' +
        ({ '火': '运动与主动表达', '土': '规律与身体照顾', '风': '学习与交流', '水': '共情与情绪表达' }[elMin]) + '。');
    }
    var maxMode = ['基本', '固定', '变动'].reduce(function (a, b) { return mode[b] > mode[a] ? b : a; }, '基本');
    out.push({
      '基本': '你是天然的开创者。请给手上同时进行的项目设上限（不超过 2 个），把「收尾」当成一种能力来练。',
      '固定': '你的坚持是稀缺品质。每年主动为自己设置一次「打破惯例」的小实验，别让固化变成天花板。',
      '变动': '你的适应力极强。为对抗分散，只保留一条主线目标，其余兴趣定位为「补给站」而非「主业」。'
    }[maxMode]);
    var retro = chart.corePlanets.filter(function (p) { return p.retrograde && p.key !== 'node'; });
    if (retro.length) {
      out.push('你出生时有 ' + retro.length + ' 颗行星逆行（' + retro.map(function (p) { return p.name; }).join('、') +
        '）。它们的力量更多向内运作：你可能比同龄人晚一点掌握这些能力，但一旦掌握，深度会远超常人。');
    }
    var saturn = chart.byKey.saturn;
    if (saturn) {
      out.push('土星落在第 ' + saturn.house + ' 宫（' + T.HOUSE_MEANING[saturn.house] + '），是你这一生最需要「熬」出来的领域。它不给捷径，但会给你真正扛得住的本事。');
    }
    var ruler = chart.ascRuler.point;
    if (ruler) {
      out.push('命主星 ' + chart.ascRuler.name + ' 落在第 ' + ruler.house + ' 宫，你人生的关键钥匙握在「' + T.HOUSE_MEANING[ruler.house] + '」这个领域：在这里投入，回报最明显。');
    }
    return out;
  }

  /* ---------------- 报告模型 ---------------- */

  function model(chart, report, opts) {
    opts = opts || {};
    var input = chart.input;
    var now = new Date();
    var meta = {
      title: opts.title || '深度个人星盘报告',
      enTitle: 'NATAL CHART REPORT',
      client: opts.client || input.name || '匿名',
      orderNo: opts.orderNo || '',
      reportNo: opts.reportNo || makeReportNo(input),
      birth: input.dateText + ' · ' + (input.placeName || ''),
      issued: now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate()),
      author: opts.author || '星语星盘',
      contact: opts.contact || '',
      footer: opts.footer || '本报告仅供个人参考 · 请勿转发',
      watermark: opts.watermark || '',
      unknownTime: !!input.unknownTime
    };

    var sun = chart.byKey.sun, moon = chart.byKey.moon, asc = chart.angleByKey.asc;
    var el = chart.distributions.elements, mode = chart.distributions.modes;
    var retroList = chart.corePlanets.filter(function (p) { return p.retrograde && p.key !== 'node'; });
    var houseSystemName = E.houseName(chart.raw.houses.system) + (chart.raw.houses.fallback ? '（高纬度自动降级）' : '');
    var chapters = [];

    /* --- 01 星盘总览 --- */
    chapters.push({
      num: '01', title: '星盘总览',
      blocks: [
        { t: 'lead', text: '这是一份基于你出生时刻天象的个人星盘报告。星盘不是命运判决书，而是一张先天气质的地图：它描述你最自然的反应方式、最容易重复的模式，以及可以主动选择的方向。' },
        { t: 'cards3', items: report.bigThree.map(function (b, i) {
          var p = i === 0 ? sun : i === 1 ? moon : asc;
          return { glyph: i === 2 ? 'AC' : p.glyph, title: b.title, sub: b.sub, body: b.body };
        }) },
        { t: 'h2', text: '你的本命星盘' },
        { t: 'wheel' },
        { t: 'kv', cols: 2, pairs: [
          { k: '命主星', v: chart.ascRuler.name + (chart.ascRuler.point ? '（' + chart.ascRuler.point.sign.name + ' 第' + chart.ascRuler.point.house + '宫）' : '') },
          { k: '宫位制', v: houseSystemName },
          { k: '元素分布', v: ['火', '土', '风', '水'].map(function (k) { return k + ' ' + el[k]; }).join('　') },
          { k: '模式分布', v: ['基本', '固定', '变动'].map(function (k) { return k + ' ' + mode[k]; }).join('　') },
          { k: '星盘形状', v: chart.shape.name },
          { k: '逆行行星', v: retroList.length ? retroList.map(function (p) { return p.name; }).join('、') : '无' },
          { k: '计算体系', v: '回归黄道 · 当日真黄经' },
          { k: '观测坐标', v: chart.input.lat.toFixed(4) + '° / ' + chart.input.lon.toFixed(4) + '°' }
        ] },
        { t: 'h2', text: '行星落点总表' },
        { t: 'table', font: 'small', head: ['行星', '星座', '度数', '宫位', '元素', '状态'], widths: [16, 20, 20, 12, 14, 18],
          rows: chart.corePlanets.map(function (p) {
            return [
              p.glyph + ' ' + p.name,
              p.sign.glyph + ' ' + p.sign.name,
              p.degText,
              '第' + p.house + '宫',
              p.sign.element + '·' + p.sign.mode,
              (p.retrograde && p.key !== 'node' ? '逆行 ℞' : '顺行') + (p.dignity.length ? ' ' + p.dignity.map(function (x) { return x.type; }).join('') : '')
            ];
          }) }
      ]
    });

    /* --- 02 行星与宫位 --- */
    var pb = [{ t: 'lead', text: '以下逐颗解读你十颗行星的落座与落宫。行星代表「什么样的能量」，星座代表「用什么方式运作」，宫位代表「在人生哪个领域发生」。三者叠加，才是完整的描述。' }];
    chart.corePlanets.forEach(function (p) {
      var it = null;
      report.planets.forEach(function (x) { if (it === null && x.title.indexOf(p.name) >= 0) { it = x; } });
      if (!it) { return; }
      pb.push({ t: 'h2', text: p.glyph + ' ' + p.name + ' · ' + p.sign.name + ' · 第' + p.house + '宫' });
      pb.push({ t: 'meta', text: p.sign.name + ' ' + p.degText + '　|　第' + p.house + '宫 ' + T.HOUSE_MEANING[p.house] +
        (p.retrograde && p.key !== 'node' ? '　|　逆行 ℞' : '') + (p.dignity.length ? '　|　' + p.dignity.map(function (d) { return d.type; }).join('') : '') });
      pb.push({ t: 'p', text: it.body });
    });
    pb.push({ t: 'h2', text: '十二宫位与宫主星' });
    pb.push({ t: 'table', font: 'small', head: ['宫位', '领域', '宫头星座', '宫主星', '宫内行星'], widths: [10, 26, 24, 16, 24],
      rows: chart.houses.map(function (h) {
        return ['第' + h.index + '宫', T.HOUSE_MEANING[h.index], h.sign.name + ' ' + h.degText, h.ruler,
          h.planets.length ? h.planets.map(function (k) { return chart.byKey[k] ? chart.byKey[k].name : k; }).join('、') : '空宫'];
      }) });
    chapters.push({ num: '02', title: '行星落座与宫位', blocks: pb });

    /* --- 03 相位与格局 --- */
    var aspList = chart.aspects.filter(function (a) { return a.major || a.type === 'quincunx'; });
    var ab = [
      { t: 'lead', text: '相位是星盘里真正的「剧情」。它描述两颗行星之间是互相支持、互相拉扯，还是必须不断调整。容许度越小，这股力量越强；紧密相位（1° 以内）往往是整张星盘最核心的议题。' },
      { t: 'h2', text: '主要相位一览' },
      { t: 'table', font: 'small', head: ['行星 A', '相位', '行星 B', '容许度', '性质'], widths: [24, 22, 24, 14, 16],
        rows: aspList.map(function (a) {
          return [a.aGlyph + ' ' + a.aName, a.typeGlyph + ' ' + a.typeName, a.bGlyph + ' ' + a.bName,
            a.orb.toFixed(2) + '°', a.nature + (a.exact ? ' · 紧密' : '')];
        }) },
      { t: 'h2', text: '重点相位详解' }
    ];
    report.aspects.forEach(function (x) {
      ab.push({ t: 'h2', text: x.title });
      ab.push({ t: 'meta', text: x.sub });
      ab.push({ t: 'p', text: x.body });
    });
    if (report.patterns.length) {
      ab.push({ t: 'h2', text: '星盘格局' });
      report.patterns.forEach(function (pt) {
        ab.push({ t: 'meta', text: pt.title + '：' + pt.sub });
        ab.push({ t: 'p', text: pt.body });
      });
    }
    chapters.push({ num: '03', title: '相位与格局', blocks: ab });

    /* --- 04 能量平衡 --- */
    var bb = [
      { t: 'lead', text: '元素与模式描述你天生的「能量配方」。星盘的价值不在于解释你，而在于给你一个可以马上行动的切入点。' },
      { t: 'kv', cols: 2, pairs: [
        { k: '火象', v: el['火'] + ' 颗' }, { k: '土象', v: el['土'] + ' 颗' },
        { k: '风象', v: el['风'] + ' 颗' }, { k: '水象', v: el['水'] + ' 颗' },
        { k: '基本模式', v: mode['基本'] + ' 颗' }, { k: '固定模式', v: mode['固定'] + ' 颗' },
        { k: '变动模式', v: mode['变动'] + ' 颗' },
        { k: '半球分布', v: '地平线上 ' + chart.distributions.hemispheres.upper + ' · 下 ' + chart.distributions.hemispheres.lower }
      ] },
      { t: 'h2', text: '平衡解读' }
    ];
    report.balance.forEach(function (b) { bb.push({ t: 'p', text: b.title + '：' + b.body }); });
    bb.push({ t: 'h2', text: '给你的成长建议' });
    bb.push({ t: 'bullets', items: suggestions(chart) });
    bb.push({ t: 'callout', tone: 'gold', title: '关于「命中注定」', text: '同一个星盘，可以活成完全不同的版本。星盘描述的是倾向与课题，不是结果。真正的自由，来自看见自己的模式之后，仍然愿意做出不同的选择。' });
    chapters.push({ num: '04', title: '能量平衡与成长建议', blocks: bb });

    /* --- 05 行运重点 --- */
    var tr = A.transits(chart, now);
    var yt = yearTransits(chart, 12);
    chapters.push({
      num: '05', title: '行运重点 · 未来一年',
      blocks: [
        { t: 'lead', text: '行运是「天上的星走到哪里、碰到了你本命盘的哪个点」。它标记出这段时间的主题与节奏，尤其外行星（木、土、天、海、冥）的行运，往往对应人生阶段性的转折。' },
        { t: 'h2', text: '当下正在发生的行运' },
        { t: 'bullets', items: tr.list.length ? T.transitReport(tr).slice(0, 6).map(function (x) {
            return x.title + '（' + x.sub + '）：' + x.body;
          }) : ['当前没有 1.5° 以内的紧密行运，属于相对平稳的时期，适合按自己的节奏推进。'] },
        { t: 'h2', text: '未来 12 个月值得留意的行运节点' },
        { t: 'table', font: 'small', head: ['预计时间', '行运星', '相位', '本命点'], widths: [24, 22, 24, 30],
          rows: yt.map(function (x) {
            return [x.date.getUTCFullYear() + '-' + pad2(x.date.getUTCMonth() + 1) + '-' + pad2(x.date.getUTCDate()),
              '行运' + x.transitingName, x.typeName + ' ' + x.typeGlyph, '本命' + x.natalName];
          }) },
        { t: 'p', text: '提示：以上时间为该行运最接近精确相位的日期，通常前后各 2-4 周都会感受到影响。外行星行运的影响期最长，土星、天王星、海王星、冥王星的单次行运可持续数月甚至一年以上。' }
      ]
    });

    /* --- 06 附录 --- */
    chapters.push({
      num: '06', title: '附录 · 计算说明与声明',
      blocks: [
        { t: 'h2', text: '计算方法' },
        { t: 'bullets', items: [
          '黄道体系：回归黄道（Tropical），以当日平春分点为 0° 起点，与主流西方占星软件一致。',
          '行星位置：轨道要素法计算地心黄经，含月亮主要摄动项与木星、土星、天王星相互摄动修正。',
          '宫位系统：' + houseSystemName + '。',
          '恒星时：格林尼治平恒星时 + 出生地经度，用于确定中天赤经与上升点。',
          '时区：采用 IANA 时区数据库，含历史夏令时修正（例如中国 1986-1991 年夏令时）。'
        ] },
        { t: 'h2', text: '精度说明' },
        { t: 'bullets', items: [
          '太阳、月亮黄经误差约 1 弧分；内行星约 1-2 弧分；外行星约 1-10 弧分。',
          '适用年份 1800 - 2100 年，超出范围精度会下降。',
          '计算校验：以 2026 年真实日月食时刻反算，日月距角误差小于 0.1°；以日出时刻反算上升点，误差小于 0.001°。'
        ] },
        { t: 'h2', text: '免责声明' },
        { t: 'p', text: '本报告基于出生时刻的天象数据与占星学传统解释自动生成，仅供个人自我探索、心理反思与娱乐参考。报告内容不构成医疗、心理、法律、投资、婚姻等任何专业建议，亦不应作为重大决策的唯一依据。如需专业意见，请咨询相应领域的执业人士。' },
        { t: 'callout', tone: 'dark', title: '报告信息', text: '报告编号 ' + meta.reportNo + '　|　出具日期 ' + meta.issued + '　|　解读师 ' + meta.author +
          (meta.contact ? '　|　联系方式 ' + meta.contact : '') + (meta.orderNo ? '　|　订单号 ' + meta.orderNo : '') }
      ]
    });

    return { meta: meta, chapters: chapters, chart: chart, report: report, options: opts };
  }

  /* ---------------- HTML 排版 ---------------- */

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderHTML(m, wheelSvg) {
    var meta = m.meta, out = [];
    var wm = meta.watermark ? '<div class="wm">' + esc(meta.watermark) + '</div>' : '';

    out.push('<section class="a4-page cover">' + wm +
      '<div class="cover-frame">' +
      '<div class="cover-brand">' + esc(meta.author) + '</div>' +
      '<div class="cover-en">' + esc(meta.enTitle) + '</div>' +
      '<h1 class="cover-title">' + esc(meta.title) + '</h1>' +
      '<div class="cover-line"></div>' +
      '<div class="cover-client">' + esc(meta.client) + '</div>' +
      '<div class="cover-birth">' + esc(meta.birth) + '</div>' +
      '<div class="cover-wheel">' + (wheelSvg || '') + '</div>' +
      '<div class="cover-foot">' +
        '<span>报告编号 ' + esc(meta.reportNo) + '</span>' +
        (meta.orderNo ? '<span>订单号 ' + esc(meta.orderNo) + '</span>' : '') +
        '<span>出具日期 ' + esc(meta.issued) + '</span>' +
      '</div></div></section>');

    out.push('<section class="a4-page">' + wm +
      '<div class="page-head"><span class="page-brand">' + esc(meta.author) + '</span><span class="page-no">CONTENTS</span></div>' +
      '<h2 class="toc-title">目录</h2>' +
      '<ol class="toc">' + m.chapters.map(function (c) {
        return '<li><span class="toc-num">' + esc(c.num) + '</span><span class="toc-name">' + esc(c.title) + '</span></li>';
      }).join('') + '</ol>' +
      '<div class="toc-note">' + (meta.unknownTime
        ? '提示：本次未提供准确出生时间，上升星座与宫位按中午 12:00 推算，相关章节仅供参考。'
        : '建议按章节顺序阅读。第 05 章的行运节点可作为未来一年的时间参考。') + '</div>' +
      '<div class="page-foot">' + esc(meta.footer) + '</div></section>');

    m.chapters.forEach(function (c) {
      out.push('<section class="a4-page chapter-start">' + wm +
        '<div class="page-head"><span class="page-brand">' + esc(meta.author) + '</span><span class="page-no">' + esc(meta.reportNo) + '</span></div>' +
        '<div class="chapter-head"><span class="chapter-num">' + esc(c.num) + '</span><h2 class="chapter-title">' + esc(c.title) + '</h2></div>' +
        blocksHTML(c.blocks, wheelSvg) +
        '<div class="page-foot">' + esc(meta.footer) + '</div></section>');
    });

    return out.join('');
  }

  function blocksHTML(blocks, wheelSvg) {
    var out = [];
    blocks.forEach(function (b) {
      switch (b.t) {
        case 'lead': out.push('<p class="lead">' + esc(b.text) + '</p>'); break;
        case 'p': out.push('<p>' + esc(b.text) + '</p>'); break;
        case 'meta': out.push('<p class="meta-line">' + esc(b.text) + '</p>'); break;
        case 'h2': out.push('<h3>' + esc(b.text) + '</h3>'); break;
        case 'bullets': out.push('<ul class="rep-list">' + b.items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'); break;
        case 'callout': out.push('<div class="callout ' + (b.tone || 'gold') + '"><b>' + esc(b.title) + '</b><p>' + esc(b.text) + '</p></div>'); break;
        case 'kv': out.push('<div class="kv" style="grid-template-columns:repeat(' + (b.cols || 2) + ',1fr)">' + b.pairs.map(function (p) {
            return '<div class="kv-item"><span class="kv-k">' + esc(p.k) + '</span><span class="kv-v">' + esc(p.v) + '</span></div>';
          }).join('') + '</div>'); break;
        case 'cards3': out.push('<div class="cards3">' + b.items.map(function (it) {
            return '<div class="card3"><div class="c3-glyph">' + esc(it.glyph) + '</div><div class="c3-title">' + esc(it.title) + '</div><div class="c3-sub">' + esc(it.sub) + '</div><div class="c3-body">' + esc(it.body) + '</div></div>';
          }).join('') + '</div>'); break;
        case 'wheel': out.push('<div class="rep-wheel">' + (wheelSvg || '') + '</div>'); break;
        case 'table': out.push('<table class="rep-table ' + (b.font || '') + '"><thead><tr>' + b.head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + b.rows.map(function (r) {
            return '<tr>' + r.map(function (cell) { return '<td>' + esc(cell) + '</td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table>'); break;
        default: break;
      }
    });
    return out.join('');
  }

  return {
    model: model,
    renderHTML: renderHTML,
    yearTransits: yearTransits,
    suggestions: suggestions,
    makeReportNo: makeReportNo,
    esc: esc
  };
});
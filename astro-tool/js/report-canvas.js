/*!
 * report-canvas.js —— 把报告模型排版成 A4 画布页（供图片版 PDF 使用）
 * A4 200dpi = 1654 x 2339 px
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.AstroReportCanvas = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var W = 1654, H = 2339;
  var ML = 118, MR = 118, MT = 104, MB = 112;
  var CW = W - ML - MR;
  var CONTENT_BOTTOM = H - MB - 34;

  var INK = '#1d2334', DIM = '#6b7280', GOLD = '#b98a2e', GOLD_SOFT = '#efe3c8';
  var RULE = '#e4e1d9', PANEL = '#f8f7f3', PANEL2 = '#fbfaf7', DARK = '#161c2c';
  var FONT = '"Microsoft YaHei","PingFang SC","Hiragino Sans GB","Noto Sans SC",sans-serif';
  var SYM = '"Segoe UI Symbol","Apple Symbols",' + FONT;

  function f(size, weight) { return (weight ? weight + ' ' : '') + size + 'px ' + FONT; }
  function fSym(size) { return size + 'px ' + SYM; }

  /* ---------- 文本处理 ---------- */

  function tokenize(text) {
    var out = [], buf = '';
    function flush() { if (buf) { out.push(buf); buf = ''; } }
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (/[A-Za-z0-9@._%+\-/:]/.test(ch)) { buf += ch; }
      else if (ch === ' ' || ch === '\u3000') { flush(); out.push(' '); }
      else { flush(); out.push(ch); }
    }
    flush();
    return out;
  }

  function wrap(ctx, text, maxWidth) {
    var lines = [];
    String(text).split('\n').forEach(function (para) {
      var tokens = tokenize(para), cur = '';
      tokens.forEach(function (tk) {
        if (tk === ' ' && !cur) { return; }
        var test = cur + tk;
        if (ctx.measureText(test).width <= maxWidth || !cur) { cur = test; }
        else { lines.push(cur.replace(/\s+$/, '')); cur = (tk === ' ' ? '' : tk); }
      });
      lines.push(cur.replace(/\s+$/, ''));
    });
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ---------- 分页器 ---------- */

  function Paginator(model) {
    this.model = model;
    this.meta = model.meta;
    this.pages = [];
    this.pageIndex = 0;
    this.newPage(true);
  }
  Paginator.prototype.newPage = function (isFirst) {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';
    this.pages.push(c);
    this.ctx = ctx;
    this.y = MT;
    this.pageIndex = this.pages.length;
    if (!isFirst) { this.drawHead(); }
  };
  Paginator.prototype.drawHead = function () {
    var ctx = this.ctx, m = this.meta;
    ctx.save();
    ctx.font = f(21, '500');
    ctx.fillStyle = DIM;
    ctx.textAlign = 'left';
    ctx.fillText(m.author, ML, MT - 34);
    ctx.textAlign = 'right';
    ctx.fillText(m.reportNo, W - MR, MT - 34);
    ctx.strokeStyle = RULE; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(ML, MT - 20); ctx.lineTo(W - MR, MT - 20); ctx.stroke();
    ctx.textAlign = 'left';
    ctx.restore();
  };
  Paginator.prototype.drawFoot = function () {
    var ctx = this.ctx, m = this.meta;
    ctx.save();
    ctx.font = f(20, '400');
    ctx.fillStyle = '#9aa0ab';
    ctx.textAlign = 'left';
    ctx.fillText(m.footer, ML, H - 56);
    ctx.textAlign = 'right';
    ctx.fillText('第 ' + this.pageIndex + ' 页', W - MR, H - 56);
    ctx.restore();
  };
  Paginator.prototype.drawWatermark = function () {
    var ctx = this.ctx, text = this.meta.watermark;
    if (!text) { return; }
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#1d2334';
    ctx.font = f(26, '500');
    ctx.textAlign = 'center';
    for (var row = 0; row < 6; row++) {
      for (var col = 0; col < 3; col++) {
        ctx.save();
        ctx.translate(180 + col * 620, 260 + row * 400);
        ctx.rotate(-Math.PI / 9);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();
  };
  Paginator.prototype.ensure = function (h) {
    if (this.y + h > CONTENT_BOTTOM) { this.newPage(); return true; }
    return false;
  };

  /* ---------- 文本绘制 ---------- */

  Paginator.prototype.paragraph = function (text, opt) {
    opt = opt || {};
    var size = opt.size || 29, lh = opt.lh || Math.round(size * 1.62), color = opt.color || INK;
    var indent = opt.indent || 0, panel = opt.panel;
    this.ctx.font = f(size, opt.weight);
    var maxW = CW - indent - (panel ? 56 : 0);
    var lines = wrap(this.ctx, text, maxW);
    var blockH = lines.length * lh + (panel ? 44 : 0) + 10;
    if (panel && this.y + blockH > CONTENT_BOTTOM) { this.newPage(); }
    var startY = this.y;
    if (panel) {
      this.ctx.fillStyle = opt.panelColor || PANEL;
      roundRect(this.ctx, ML, this.y, CW, blockH - 10, 14);
      this.ctx.fill();
      this.ctx.fillStyle = GOLD;
      this.ctx.fillRect(ML, this.y + 12, 5, blockH - 34);
      this.y += 22;
    }
    this.ctx.fillStyle = color;
    for (var i = 0; i < lines.length; i++) {
      if (this.y + lh > CONTENT_BOTTOM) {
        this.newPage();
        if (panel) {
          this.ctx.fillStyle = opt.panelColor || PANEL;
          roundRect(this.ctx, ML, this.y - 6, CW, lh + 24, 12);
          this.ctx.fill();
          this.ctx.fillStyle = GOLD;
          this.ctx.fillRect(ML, this.y - 6, 5, lh + 24);
        }
        this.ctx.fillStyle = color;
        this.ctx.font = f(size, opt.weight);
      }
      this.ctx.fillText(lines[i], ML + indent + (panel ? 28 : 0), this.y + size);
      this.y += lh;
    }
    this.y += panel ? 12 : 8;
    return startY;
  };

  Paginator.prototype.heading2 = function (text) {
    // 先量高度（可能触发分页），分页后必须重新取当前页上下文
    this.ctx.font = f(34, '700');
    var probe = wrap(this.ctx, text, CW - 30);
    var need = probe.length * 50 + 26;
    if (this.y + need + 90 > CONTENT_BOTTOM) { this.newPage(); }
    var ctx = this.ctx;                       // ← 关键：分页之后重新获取
    var lines = wrap(ctx, text, CW - 30);
    ctx.font = f(34, '700');
    this.y += 12;
    ctx.fillStyle = GOLD;
    ctx.fillRect(ML, this.y + 6, 7, 34);
    ctx.fillStyle = INK;
    var self = this;
    lines.forEach(function (ln, i) {
      ctx.fillText(ln, ML + 22, self.y + 36 + i * 48);
    });
    this.y += lines.length * 48 + 26;
  };

  Paginator.prototype.bullets = function (items) {
    var self = this;
    items.forEach(function (it) {
      var size = 28, lh = Math.round(size * 1.62);
      self.ctx.font = f(size);
      var lines = wrap(self.ctx, it, CW - 46);
      if (self.y + lines.length * lh + 18 > CONTENT_BOTTOM) { self.newPage(); }
      self.ctx.fillStyle = GOLD;
      self.ctx.beginPath();
      self.ctx.arc(ML + 9, self.y + 14, 5, 0, Math.PI * 2);
      self.ctx.fill();
      self.ctx.fillStyle = INK;
      self.ctx.font = f(size);
      lines.forEach(function (ln, i) {
        if (self.y + lh > CONTENT_BOTTOM) {
          self.newPage();
          self.ctx.fillStyle = INK; self.ctx.font = f(size);
        }
        self.ctx.fillText(ln, ML + 34, self.y + size);
        self.y += lh;
      });
      self.y += 16;
    });
  };

  Paginator.prototype.callout = function (b) {
    var pad = 30, size = 28, lh = Math.round(size * 1.6);
    this.ctx.font = f(size);
    var lines = wrap(this.ctx, b.text, CW - pad * 2 - 8);
    var titleH = 46;
    var boxH = pad + titleH + lines.length * lh + pad - 8;
    if (this.y + boxH > CONTENT_BOTTOM) { this.newPage(); }
    var dark = b.tone === 'dark';
    this.ctx.fillStyle = dark ? DARK : (b.tone === 'gold' ? '#fdf8ec' : PANEL);
    roundRect(this.ctx, ML, this.y, CW, boxH, 14);
    this.ctx.fill();
    this.ctx.fillStyle = dark ? GOLD : GOLD;
    this.ctx.fillRect(ML, this.y, 5, boxH);
    this.ctx.font = f(30, '700');
    this.ctx.fillStyle = dark ? '#f3e6c6' : INK;
    this.ctx.fillText(b.title, ML + pad, this.y + pad + 24);
    this.ctx.font = f(size);
    this.ctx.fillStyle = dark ? '#cfd6e6' : '#3a4152';
    var yy = this.y + pad + titleH;
    lines.forEach(function (ln, i) { this.ctx.fillText(ln, ML + pad, yy + 24 + i * lh); }, this);
    this.y += boxH + 22;
  };

  Paginator.prototype.kv = function (b) {
    var cols = b.cols || 2, gap = 18;
    var colW = (CW - gap * (cols - 1)) / cols;
    var rowH = 74;
    for (var i = 0; i < b.pairs.length; i += cols) {
      if (this.y + rowH > CONTENT_BOTTOM) { this.newPage(); }
      for (var c = 0; c < cols; c++) {
        var p = b.pairs[i + c];
        if (!p) { break; }
        var x = ML + c * (colW + gap);
        this.ctx.fillStyle = PANEL2;
        roundRect(this.ctx, x, this.y, colW, rowH - 10, 10);
        this.ctx.fill();
        this.ctx.fillStyle = DIM;
        this.ctx.font = f(21, '500');
        this.ctx.fillText(p.k, x + 20, this.y + 30);
        this.ctx.fillStyle = INK;
        this.ctx.font = f(26, '600');
        var v = wrap(this.ctx, p.v, colW - 40);
        this.ctx.fillText(v[0] || '', x + 20, this.y + 58);
      }
      this.y += rowH;
    }
    this.y += 10;
  };

  Paginator.prototype.cards3 = function (items) {
    var gap = 20, colW = (CW - gap * 2) / 3;
    var self = this;
    self.ctx.font = f(22);
    var heights = items.map(function (it) {
      var lines = wrap(self.ctx, it.body, colW - 44);
      return 150 + lines.length * 36 + 26;
    });
    var boxH = Math.max.apply(null, heights);
    if (self.y + boxH > CONTENT_BOTTOM) { self.newPage(); }
    items.forEach(function (it, i) {
      var x = ML + i * (colW + gap);
      var ctx = self.ctx;
      ctx.fillStyle = PANEL2;
      roundRect(ctx, x, self.y, colW, boxH, 14); ctx.fill();
      ctx.fillStyle = GOLD; ctx.fillRect(x, self.y, colW, 5);
      ctx.fillStyle = GOLD; ctx.font = fSym(40);
      ctx.fillText(it.glyph, x + 22, self.y + 66);
      ctx.fillStyle = INK; ctx.font = f(27, '700');
      var tl = wrap(ctx, it.title, colW - 44);
      tl.slice(0, 2).forEach(function (ln, k) { ctx.fillText(ln, x + 22, self.y + 108 + k * 34); });
      ctx.fillStyle = DIM; ctx.font = f(20);
      ctx.fillText(it.sub.slice(0, 30), x + 22, self.y + 108 + tl.slice(0, 2).length * 34 + 4);
      ctx.fillStyle = '#3a4152'; ctx.font = f(22);
      var lines = wrap(ctx, it.body, colW - 44);
      var yy = self.y + 150 + tl.slice(0, 2).length * 34;
      lines.forEach(function (ln, k) { ctx.fillText(ln, x + 22, yy + 26 + k * 36); });
    });
    self.y += boxH + 24;
  };

  Paginator.prototype.table = function (b) {
    var rows = b.rows || [], head = b.head || [];
    var widths = b.widths || [];
    var sum = widths.reduce(function (a, x) { return a + x; }, 0) || 1;
    var cols = head.length;
    var colW = widths.map(function (x) { return CW * (x / sum); });
    var size = b.font === 'small' ? 23 : 25;
    var rowH = size + 26;
    var headH = size + 30;
    var self = this;

    function drawHead(y) {
      self.ctx.fillStyle = '#f2efe6';
      self.ctx.fillRect(ML, y, CW, headH);
      self.ctx.fillStyle = '#6a5426';
      self.ctx.font = f(size, '700');
      var x = ML;
      head.forEach(function (h, i) {
        self.ctx.fillText(clip(h, colW[i] - 22), x + 11, y + headH - 16);
        x += colW[i];
      });
      self.ctx.strokeStyle = '#ddd8ca'; self.ctx.lineWidth = 1.2;
      self.ctx.beginPath(); self.ctx.moveTo(ML, y + headH); self.ctx.lineTo(ML + CW, y + headH); self.ctx.stroke();
      return y + headH;
    }
    function clip(text, maxW) {
      text = String(text);
      if (self.ctx.measureText(text).width <= maxW) { return text; }
      var out = text;
      while (out.length > 1 && self.ctx.measureText(out + '…').width > maxW) { out = out.slice(0, -1); }
      return out + '…';
    }

    if (this.y + headH + rowH > CONTENT_BOTTOM) { this.newPage(); }
    this.ctx.font = f(size);
    var y = drawHead(this.y);
    this.y = y;
    rows.forEach(function (r, ri) {
      if (self.y + rowH > CONTENT_BOTTOM) {
        self.newPage();
        self.ctx.font = f(size);
        self.y = drawHead(self.y);
      }
      self.ctx.fillStyle = ri % 2 === 0 ? '#ffffff' : PANEL2;
      self.ctx.fillRect(ML, self.y, CW, rowH);
      self.ctx.fillStyle = '#2c3446';
      self.ctx.font = f(size, '400');
      var x = ML;
      r.forEach(function (cell, ci) {
        self.ctx.fillText(clip(cell === undefined ? '' : cell, colW[ci] - 22), x + 11, self.y + rowH - 17);
        x += colW[ci];
      });
      self.ctx.strokeStyle = '#efede7'; self.ctx.lineWidth = 1;
      self.ctx.beginPath(); self.ctx.moveTo(ML, self.y + rowH); self.ctx.lineTo(ML + CW, self.y + rowH); self.ctx.stroke();
      self.y += rowH;
    });
    this.y += 22;
  };

  Paginator.prototype.image = function (img, opt) {
    opt = opt || {};
    var maxW = CW * (opt.scale || 0.82);
    var ratio = img.height / img.width;
    var w = maxW, h = maxW * ratio;
    if (this.y + h > CONTENT_BOTTOM) { this.newPage(); }
    var x = ML + (CW - w) / 2;
    this.ctx.drawImage(img, x, this.y, w, h);
    this.y += h + 24;
  };

  /* ---------- 封面 ---------- */

  function cover(model, wheelImg) {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d'), m = model.meta;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = GOLD_SOFT; ctx.lineWidth = 3;
    ctx.strokeRect(48, 48, W - 96, H - 96);
    ctx.strokeStyle = '#e9e2d0'; ctx.lineWidth = 1.2;
    ctx.strokeRect(62, 62, W - 124, H - 124);

    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.font = f(26, '600');
    ctx.fillText(m.author, W / 2, 170);
    ctx.fillStyle = '#b9b1a0';
    ctx.font = f(19, '500');
    ctx.fillText(m.enTitle, W / 2, 208);

    ctx.fillStyle = INK;
    ctx.font = f(62, '700');
    ctx.fillText(m.title, W / 2, 380);
    ctx.fillStyle = GOLD;
    ctx.fillRect(W / 2 - 70, 420, 140, 3);

    ctx.fillStyle = '#2c3446';
    ctx.font = f(44, '600');
    ctx.fillText(m.client, W / 2, 500);
    ctx.fillStyle = DIM;
    ctx.font = f(24, '400');
    ctx.fillText(m.birth, W / 2, 548);

    if (wheelImg) {
      var size = 980;
      ctx.drawImage(wheelImg, (W - size) / 2, 610, size, size);
    }

    ctx.fillStyle = DARK;
    ctx.fillRect(0, H - 250, W, 250);
    ctx.fillStyle = GOLD;
    ctx.fillRect(0, H - 250, W, 4);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f0e7d2';
    ctx.font = f(23, '500');
    ctx.fillText('报告编号　' + m.reportNo, ML, H - 170);
    if (m.orderNo) { ctx.fillText('订单号　' + m.orderNo, ML, H - 128); }
    ctx.fillText('出具日期　' + m.issued, ML, m.orderNo ? H - 86 : H - 128);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(240,231,210,.72)';
    ctx.font = f(20, '400');
    ctx.fillText('本报告仅供个人参考，请勿转发', W - MR, H - 86);
    return c;
  }

  /* ---------- 目录页 ---------- */

  function tocPage(model) {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d'), m = model.meta;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    var p = new Paginator(model);
    p.pages = [c]; p.ctx = ctx; p.pageIndex = 2; p.y = MT;
    p.drawHead();

    ctx.fillStyle = INK; ctx.font = f(46, '700');
    ctx.fillText('目录', ML, p.y + 60);
    ctx.fillStyle = GOLD; ctx.fillRect(ML, p.y + 82, 90, 4);
    p.y += 150;

    model.chapters.forEach(function (ch) {
      ctx.fillStyle = GOLD; ctx.font = f(30, '700');
      ctx.fillText(ch.num, ML + 6, p.y + 36);
      ctx.fillStyle = INK; ctx.font = f(30, '600');
      ctx.fillText(ch.title, ML + 90, p.y + 36);
      ctx.strokeStyle = '#eeebe3'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ML, p.y + 62); ctx.lineTo(W - MR, p.y + 62); ctx.stroke();
      p.y += 82;
    });
    ctx.fillStyle = DIM; ctx.font = f(23);
    var note = m.unknownTime
      ? '提示：本次未提供准确出生时间，上升星座与宫位按中午 12:00 推算，相关章节仅供参考。'
      : '建议按章节顺序阅读。第 05 章的行运节点可作为未来一年的时间参考。';
    wrap(ctx, note, CW).forEach(function (ln, i) { ctx.fillText(ln, ML, p.y + 50 + i * 40); });
    p.y += 50 + wrap(ctx, note, CW).length * 40 + 30;
    p.drawWatermark();
    p.drawFoot();
    return c;
  }

  /* ---------- 主入口 ---------- */

  function render(model, opts) {
    opts = opts || {};
    var pages = [];
    pages.push(cover(model, opts.wheelImage));
    pages.push(tocPage(model));

    var p = new Paginator(model);
    p.pages = []; // 首页由章节头开始
    p.newPage(true);
    var first = true;

    model.chapters.forEach(function (ch, ci) {
      if (!first) { p.newPage(); } else { first = false; }
      // 章标题
      var ctx = p.ctx;
      ctx.fillStyle = GOLD_SOFT;
      roundRect(ctx, ML, p.y + 6, 96, 96, 18); ctx.fill();
      ctx.fillStyle = GOLD; ctx.font = f(42, '700'); ctx.textAlign = 'center';
      ctx.fillText(ch.num, ML + 48, p.y + 70);
      ctx.textAlign = 'left';
      ctx.fillStyle = INK; ctx.font = f(46, '700');
      ctx.fillText(ch.title, ML + 120, p.y + 74);
      ctx.fillStyle = GOLD; ctx.fillRect(ML, p.y + 124, CW, 2.4);
      p.y += 170;

      ch.blocks.forEach(function (b) {
        switch (b.t) {
          case 'lead': p.paragraph(b.text, { size: 30, lh: 52, panel: true, color: '#3a4152' }); break;
          case 'p': p.paragraph(b.text, { size: 28, lh: 48 }); break;
          case 'meta': p.paragraph(b.text, { size: 22, lh: 38, color: DIM }); break;
          case 'h2': p.heading2(b.text); break;
          case 'bullets': p.bullets(b.items); break;
          case 'callout': p.callout(b); break;
          case 'kv': p.kv(b); break;
          case 'cards3': p.cards3(b.items); break;
          case 'table': p.table(b); break;
          case 'wheel': if (opts.wheelImage) { p.image(opts.wheelImage, { scale: 0.86 }); } break;
          default: break;
        }
      });
    });

    p.pages.forEach(function (cv, i) { p.pageIndex = i + 3; p.ctx = cv.getContext('2d'); p.drawWatermark(); p.drawFoot(); });
    return pages.concat(p.pages);
  }

  return { render: render, W: W, H: H };
});
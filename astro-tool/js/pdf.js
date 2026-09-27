/*!
 * pdf.js —— 极简 PDF 生成器（零依赖）
 * 把若干张画布页面（无损 FlateDecode 或 JPEG）打包成标准 PDF 1.4 文件。
 * 支持：/Info 元数据、xref 交叉引用表、多页、A4 尺寸。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.AstroPdf = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // A4 尺寸（PostScript 点，1pt = 1/72 inch）
  var A4_W = 595.276, A4_H = 841.89;

  function strBytes(s) {
    var b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) { b[i] = s.charCodeAt(i) & 0xff; }
    return b;
  }

  function pad10(n) {
    var s = String(n);
    while (s.length < 10) s = '0' + s;
    return s;
  }
  function pad5(n) {
    var s = String(n);
    while (s.length < 5) s = '0' + s;
    return s;
  }

  function pdfDate(d) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return 'D:' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  /**
   * 由图像页构建 PDF
   * pages: [{ bytes:Uint8Array, width:Number, height:Number, filter:'FlateDecode'|'DCTDecode', colorSpace?:String, bits?:Number }]
   * meta:  { title, author, subject, creator }
   */
  function build(pages, meta) {
    if (!pages || !pages.length) throw new Error('PDF 至少需要一页');
    meta = meta || {};
    var n = pages.length;
    var objCount = 2 + n * 3 + 1;            // catalog + pages + (page/image/content)*n + info
    var infoId = objCount;
    var chunks = [];
    var length = 0;
    var offsets = new Array(objCount + 1);

    function push(x) {
      var b = (typeof x === 'string') ? strBytes(x) : x;
      chunks.push(b); length += b.length;
    }
    function beginObj(id) { offsets[id] = length; push(id + ' 0 obj\n'); }
    function endObj() { push('endobj\n'); }

    push('%PDF-1.4\n');
    push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A])); // 二进制标识注释

    // 1: Catalog
    beginObj(1);
    push('<< /Type /Catalog /Pages 2 0 R >>\n');
    endObj();

    // 2: Pages
    var kids = [];
    for (var i = 0; i < n; i++) { kids.push((3 + i * 3) + ' 0 R'); }
    beginObj(2);
    push('<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>\n');
    endObj();

    // 每页：page / image / content
    for (var p = 0; p < n; p++) {
      var page = pages[p];
      var pageId = 3 + p * 3, imgId = pageId + 1, contentId = pageId + 2;
      var cs = page.colorSpace || 'DeviceRGB';
      var bits = page.bits || 8;

      beginObj(pageId);
      push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + A4_W + ' ' + A4_H + ']' +
        ' /Resources << /XObject << /Im0 ' + imgId + ' 0 R >> /ProcSet [/PDF /ImageC /ImageB] >>' +
        ' /Contents ' + contentId + ' 0 R >>\n');
      endObj();

      beginObj(imgId);
      push('<< /Type /XObject /Subtype /Image /Width ' + page.width + ' /Height ' + page.height +
        ' /ColorSpace /' + cs + ' /BitsPerComponent ' + bits + ' /Filter /' + (page.filter || 'DCTDecode') +
        ' /Length ' + page.bytes.length + ' >>\nstream\n');
      push(page.bytes);
      push('\nendstream\n');
      endObj();

      var content = 'q\n' + A4_W + ' 0 0 ' + A4_H + ' 0 0 cm\n/Im0 Do\nQ\n';
      beginObj(contentId);
      push('<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream\n');
      endObj();
    }

    // Info
    beginObj(infoId);
    push('<< /Title ' + pdfString(meta.title || 'Astrology Report') +
      ' /Author ' + pdfString(meta.author || '') +
      ' /Subject ' + pdfString(meta.subject || '') +
      ' /Creator ' + pdfString(meta.creator || 'Astro Report Generator') +
      ' /Producer (Astro Tool built-in PDF writer)' +
      ' /CreationDate (' + pdfDate(new Date()) + ') >>\n');
    endObj();

    // xref
    var xrefOffset = length;
    push('xref\n0 ' + (objCount + 1) + '\n');
    push('0000000000 65535 f \n');
    for (var k = 1; k <= objCount; k++) {
      push(pad10(offsets[k] || 0) + ' ' + pad5(0) + ' n \n');
    }
    push('trailer\n<< /Size ' + (objCount + 1) + ' /Root 1 0 R /Info ' + infoId + ' 0 R >>\n');
    push('startxref\n' + xrefOffset + '\n%%EOF\n');

    // 合并成 Blob / Buffer
    var total = new Uint8Array(length), pos = 0;
    for (var c = 0; c < chunks.length; c++) { total.set(chunks[c], pos); pos += chunks[c].length; }
    if (typeof Blob !== 'undefined') { return new Blob([total], { type: 'application/pdf' }); }
    return total;
  }

  function esc(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  /* PDF 文本串：ASCII 用 () 字面串；含中文等非 ASCII 时用 UTF-16BE 十六进制串 */
  function pdfString(s) {
    s = String(s === undefined || s === null ? '' : s);
    if (/^[\x20-\x7E]*$/.test(s)) { return '(' + esc(s) + ')'; }
    var hex = 'FEFF';
    for (var i = 0; i < s.length; i++) {
      hex += ('0000' + s.charCodeAt(i).toString(16).toUpperCase()).slice(-4);
    }
    return '<' + hex + '>';
  }

  /* ---------- 画布 → 图像数据（浏览器） ---------- */

  function canvasToJpegPage(canvas, quality) {
    var dataUrl = canvas.toDataURL('image/jpeg', quality || 0.92);
    var b64 = dataUrl.split(',')[1];
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
    return { bytes: bytes, width: canvas.width, height: canvas.height, filter: 'DCTDecode', colorSpace: 'DeviceRGB', bits: 8 };
  }

  function canvasToFlatePage(canvas) {
    return new Promise(function (resolve, reject) {
      try {
        var ctx = canvas.getContext('2d');
        var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        var px = canvas.width * canvas.height;
        var rgb = new Uint8Array(px * 3);
        for (var i = 0, j = 0; i < data.length; i += 4) {
          rgb[j++] = data[i]; rgb[j++] = data[i + 1]; rgb[j++] = data[i + 2];
        }
        var cs = new CompressionStream('deflate');
        var writer = cs.writable.getWriter();
        writer.write(rgb);
        writer.close();
        new Response(cs.readable).arrayBuffer().then(function (buf) {
          resolve({ bytes: new Uint8Array(buf), width: canvas.width, height: canvas.height, filter: 'FlateDecode', colorSpace: 'DeviceRGB', bits: 8 });
        }, reject);
      } catch (e) { reject(e); }
    });
  }

  /* 无损优先，不支持 CompressionStream 时退回 JPEG */
  function canvasToPage(canvas, opts) {
    opts = opts || {};
    var lossless = opts.lossless !== false && typeof CompressionStream === 'function';
    if (!lossless) { return Promise.resolve(canvasToJpegPage(canvas, opts.quality)); }
    return canvasToFlatePage(canvas).catch(function () { return canvasToJpegPage(canvas, opts.quality); });
  }

  function download(blobOrBytes, filename) {
    var blob = (blobOrBytes instanceof Blob) ? blobOrBytes : new Blob([blobOrBytes], { type: 'application/pdf' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename || 'report.pdf';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    return blob.size;
  }

  return {
    A4_W: A4_W,
    A4_H: A4_H,
    build: build,
    canvasToPage: canvasToPage,
    canvasToJpegPage: canvasToJpegPage,
    download: download
  };
});
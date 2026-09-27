/* PDF 生成器测试：结构、xref 偏移、流长度、Flate 流可解压 */
const zlib = require('zlib');
const P = require('../js/pdf.js');
let pass = 0, fail = 0;
function ok(name, cond, info) {
  if (cond) { pass++; console.log('  PASS  ' + name + (info ? '  ' + info : '')); }
  else { fail++; console.log('  FAIL  ' + name + (info ? '  ' + info : '')); }
}
function toBuf(x) { return x instanceof Uint8Array ? Buffer.from(x) : Buffer.from(x); }

(async () => {
  console.log('\n== 基本结构 ==');
  const jpegB64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
  const jpeg = Uint8Array.from(Buffer.from(jpegB64, 'base64'));
  const pages = [];
  for (let i = 0; i < 4; i++) pages.push({ bytes: jpeg, width: 1, height: 1, filter: 'DCTDecode' });
  const blob = P.build(pages, { title: '报告标题', author: '星语星盘', subject: '测试', creator: 'Astro Tool' });
  const buf = Buffer.from(blob instanceof Blob ? await blob.arrayBuffer() : blob);
  const text = buf.toString('latin1');

  ok('以 %PDF-1.4 开头', text.startsWith('%PDF-1.4'));
  ok('以 %%EOF 结尾', text.trim().endsWith('%%EOF'));
  ok('/Count 等于页数', text.includes('/Count 4'));
  ok('页对象数量正确', (text.match(/\/Type \/Page[^s]/g) || []).length === 4);
  ok('图像对象数量正确', (text.match(/\/Subtype \/Image/g) || []).length === 4);
  ok('包含 Info 元数据', text.includes('/Producer') && text.includes('/CreationDate'));
  ok('中文标题以 UTF-16BE 十六进制串写入（符合 PDF 规范）', (() => {
    const mm = text.match(/\/Title <(FEFF[0-9A-F]+)>/);
    if (!mm) { return false; }
    const hex = mm[1].slice(4);
    let dec = '';
    for (let i = 0; i < hex.length; i += 4) { dec += String.fromCharCode(parseInt(hex.substr(i, 4), 16)); }
    return dec === '报告标题';
  })());

  console.log('\n== xref 交叉引用 ==');
  const objCount = 2 + 4 * 3 + 1;
  const sx = +(text.match(/startxref\s+(\d+)/) || [])[1];
  ok('startxref 指向 xref 关键字', text.slice(sx, sx + 4) === 'xref');
  const lines = text.slice(sx).split('\n');
  ok('xref 声明对象总数正确', lines[1].trim() === '0 ' + (objCount + 1));
  let allOk = true, firstBad = null;
  for (let i = 1; i <= objCount; i++) {
    const off = parseInt(lines[2 + i].slice(0, 10), 10);
    const expect = i + ' 0 obj';
    if (text.slice(off, off + expect.length) !== expect) { allOk = false; firstBad = i + ' @' + off; }
  }
  ok('每个 xref 偏移都能定位到对应对象', allOk, allOk ? '' : ('第一个错误: ' + firstBad));
  ok('free 条目格式正确', lines[2].slice(0, 20) === '0000000000 65535 f ');
  ok('对象 0 之后的条目均为 20 字节', lines.slice(3, 3 + objCount).every(l => l.length === 19 || l.length === 20));

  console.log('\n== 图像流长度 ==');
  const imgLens = [];
  const re = /\/Subtype \/Image[\s\S]*?\/Length (\d+) >>\nstream\n/g;
  let m;
  while ((m = re.exec(text))) imgLens.push(+m[1]);
  ok('每个图像流 /Length 与实际字节数一致', imgLens.length === 4 && imgLens.every(x => x === jpeg.length), imgLens.join(','));

  console.log('\n== FlateDecode（无损）流校验 ==');
  const raw = Buffer.alloc(1654 * 3 * 2);           // 模拟两行 RGB
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7) % 256;
  const flate = Uint8Array.from(zlib.deflateSync(raw));
  const blob2 = P.build([{ bytes: flate, width: 1654, height: 2, filter: 'FlateDecode' }], { title: 'flate' });
  const buf2 = Buffer.from(blob2 instanceof Blob ? await blob2.arrayBuffer() : blob2);
  const t2 = buf2.toString('latin1');
  const start = t2.indexOf('stream\n', t2.indexOf('/Subtype /Image')) + 7;
  const end = t2.indexOf('\nendstream', start);
  const streamBytes = buf2.slice(start, end);
  ok('FlateDecode 流可被解压且与原数据一致', zlib.inflateSync(streamBytes).equals(raw), '原始 ' + raw.length + ' 字节');

  console.log('\n== 异常处理 ==');
  let threw = false;
  try { P.build([], {}); } catch (e) { threw = true; }
  ok('空页列表会抛错', threw);

  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败\n');
  process.exit(fail ? 1 : 0);
})();
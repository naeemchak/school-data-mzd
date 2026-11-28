/* =====================================================================
   PDF on the phone (v4H): reports, fee challans, result cards.
   jsPDF (vendor/jspdf.umd.min.js, cached for offline use) draws English
   text as vector; Urdu text is drawn by the browser on a canvas (Naskh
   font, proper joining) and placed as a sharp image. Works offline and
   where printing is blocked (iPhone home-screen app, Chrome on iPhone,
   in-app browsers).
   ===================================================================== */
const PDFK = {
  _p: null,
  load() {
    if (window.jspdf && window.qrcode) return Promise.resolve();
    if (PDFK._p) return PDFK._p;
    const one = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    PDFK._p = Promise.all([window.jspdf ? 0 : one('vendor/jspdf.umd.min.js'), window.qrcode ? 0 : one('vendor/qrcode.js')])
      .catch(() => { PDFK._p = null; throw new Error('The PDF tool could not be loaded. Open the app once with internet, then try again.'); });
    return PDFK._p;
  },
  /** a QR code drawn as squares (vector), size in mm */
  qr(d, text, x, y, size) {
    const q = window.qrcode(0, 'M'); q.addData(String(text)); q.make();
    const n = q.getModuleCount(), m = size / n; d.setFillColor(0, 0, 0);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d.rect(x + c * m, y + r * m, m + 0.02, m + 0.02, 'F');
  },
  async doc(landscape) {
    await PDFK.load();
    try { await document.fonts.load('700 20px Naskh'); } catch (e) { }
    const d = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: landscape ? 'landscape' : 'portrait', compress: true });
    d.setFont('helvetica', 'normal'); d.setLineHeightFactor(1.2);
    return d;
  },
  /** text the built-in PDF font can show (Latin-1 + common punctuation); Urdu goes through PDFK.ur */
  t(v) {
    return String(v == null ? '' : v).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/→/g, '->').replace(/✓/g, 'Yes').replace(/[^\x00-\xFF–—•…·×€]/g, '');
  },
  isUrdu(v) { return /[؀-ۿ]/.test(String(v || '')); },
  /** Urdu text as an image. align 'left' | 'right' | 'center' at x; y = baseline-ish top. Returns width in mm */
  ur(d, text, x, y, sizePt, align, bold, color) {
    text = String(text || '').trim(); if (!text) return 0;
    const sc = 4, px = sizePt * 1.333 * sc, c = document.createElement('canvas'), g = c.getContext('2d');
    const font = `${bold === false ? 400 : 700} ${px}px Naskh, "Noto Naskh Arabic", serif`;
    g.font = font; const w = Math.ceil(g.measureText(text).width) + 4, h = Math.ceil(px * 1.7);
    c.width = w; c.height = h; g.font = font; g.direction = 'rtl'; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillStyle = color || '#111';
    g.fillText(text, w - 2, h / 2);
    const mmPerPx = 25.4 / 96 / sc, wm = w * mmPerPx, hm = h * mmPerPx;
    const x0 = align === 'right' ? x - wm : align === 'center' ? x - wm / 2 : x;
    d.addImage(c.toDataURL('image/png'), 'PNG', x0, y - hm * 0.62, wm, hm, undefined, 'FAST');
    return wm;
  },
  /** an Urdu paragraph wrapped to width (mm), right-aligned, from top y. Returns the height used (mm) */
  urPara(d, text, x, y, width, sizePt, color) {
    const sc = 4, px = sizePt * 1.333 * sc, g = document.createElement('canvas').getContext('2d'), mmPerPx = 25.4 / 96 / sc;
    g.font = `400 ${px}px Naskh, "Noto Naskh Arabic", serif`;
    const lines = []; let cur = '';
    String(text || '').split(/\s+/).forEach(w => { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width * mmPerPx > width && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    const lh = sizePt * 0.3528 * 1.9;
    lines.forEach((l, k) => PDFK.ur(d, l, x + width, y + lh * (k + 0.6), sizePt, 'right', false, color));
    return lines.length * lh;
  },
  /** a table with wrapping cells, repeated heading and page breaks. cols: [{h, w, align}] (w in mm). Returns the y after the table */
  table(d, o) {
    const fs = o.fs || 8, lh = fs * 0.3528 * 1.18, pad = o.pad || 1.1, pw = d.internal.pageSize.getWidth(), ph = d.internal.pageSize.getHeight(), bottom = o.bottom || ph - 12;
    let y = o.y, x0 = o.x;
    const cell = (txt, w) => d.splitTextToSize(PDFK.t(txt), w - 2 * pad);
    const head = () => {
      d.setFont('helvetica', 'bold'); d.setFontSize(o.hfs || fs - 0.5);
      const ls = o.cols.map(c => cell(c.h, c.w)), hh = Math.max(...ls.map(l => l.length)) * lh + 2 * pad;
      d.setFillColor(232, 240, 235); d.rect(x0, y, o.cols.reduce((s, c) => s + c.w, 0), hh, 'F');
      let x = x0; o.cols.forEach((c, j) => { d.text(ls[j], c.align === 'right' ? x + c.w - pad : x + pad, y + pad + lh * 0.8, { align: c.align === 'right' ? 'right' : 'left' }); x += c.w; });
      d.setDrawColor(150); d.line(x0, y + hh, x0 + o.cols.reduce((s, c) => s + c.w, 0), y + hh); y += hh; d.setFont('helvetica', 'normal'); d.setFontSize(fs);
    };
    head();
    o.rows.forEach((r, i) => {
      const ls = o.cols.map((c, j) => PDFK.isUrdu(r[j]) ? [''] : cell(r[j], c.w)), rh = Math.max(...ls.map(l => l.length)) * lh + 2 * pad;
      if (y + rh > bottom) { if (o.onPage) o.onPage(); d.addPage(); y = o.top || 12; head(); }
      if (o.bold && o.bold(r, i)) d.setFont('helvetica', 'bold');
      if (o.shade && o.shade(r, i)) { d.setFillColor(...o.shade(r, i)); d.rect(x0, y, o.cols.reduce((s, c) => s + c.w, 0), rh, 'F'); }
      let x = x0; o.cols.forEach((c, j) => {
        if (o.draw && o.draw(d, r, i, j, x, y, c.w, rh, pad, lh)) { x += c.w; return; }   // custom cell (symbols)
        const col = o.color && o.color(r, i, j); if (col) d.setTextColor(...col);
        if (PDFK.isUrdu(r[j])) PDFK.ur(d, r[j], x + c.w - pad, y + rh / 2 + 0.6, fs + 1, 'right', false);
        else d.text(ls[j], c.align === 'right' ? x + c.w - pad : x + pad, y + pad + lh * 0.8, { align: c.align === 'right' ? 'right' : 'left' });
        if (col) d.setTextColor(0);
        x += c.w; });
      d.setFont('helvetica', 'normal'); d.setDrawColor(215); d.line(x0, y + rh, x0 + o.cols.reduce((s, c) => s + c.w, 0), y + rh); y += rh;
    });
    return y;
  },
  /** column widths in proportion to content, within the page width */
  widths(head, rows, total, min) {
    // a column is as wide as its longest heading word or its usual (95th percentile) content, whichever is more; headings wrap at spaces
    const len = head.map((h, j) => { const word = Math.max(...String(h).split(/\s+/).map(w => w.length)) * 1.05;
      const v = rows.slice(0, 400).map(r => String(r[j] == null ? '' : r[j]).length).sort((a, b) => a - b), p95 = v.length ? v[Math.floor(v.length * 0.95)] : 0;
      return Math.max(word, p95 * 1.12 + 1, 3); });
    const cap = len.map(l => Math.min(l, 40)), sum = cap.reduce((a, b) => a + b, 0);
    let w = cap.map(l => Math.max(min || 9, total * l / sum)); const k = total / w.reduce((a, b) => a + b, 0); return w.map(x => x * k);
  },
  footer(d, left) {
    const n = d.getNumberOfPages(), pw = d.internal.pageSize.getWidth(), ph = d.internal.pageSize.getHeight();
    for (let i = 1; i <= n; i++) { d.setPage(i); d.setFontSize(7); d.setTextColor(110); d.text(PDFK.t(left || ''), 10, ph - 6); d.text(`Page ${i} of ${n}`, pw - 10, ph - 6, { align: 'right' }); d.setTextColor(0); }
  },
  /** save: share sheet on iPhone (Print / Save to Files / WhatsApp), download elsewhere */
  async save(d, name) {
    name = name.replace(/[^\w\- .]+/g, '').replace(/\s+/g, '_') + '.pdf';
    const blob = d.output('blob');
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios && navigator.canShare) { try { const f = new File([blob], name, { type: 'application/pdf' }); if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return; } } catch (e) { if (e && e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  },
  /** where window.print() is ignored: iPhone home-screen app, Chrome / Firefox on iPhone, in-app browsers */
  printBlocked() {
    const ua = navigator.userAgent, ios = /iPad|iPhone|iPod/.test(ua);
    return (ios && (navigator.standalone || /CriOS|FxiOS|EdgiOS/.test(ua))) || /FBAN|FBAV|Instagram|; wv\)/.test(ua);
  },
  /** money in words (Pakistani style: thousand, lakh, crore) */
  words(n) {
    n = Math.round(Number(n) || 0); if (!n) return 'Rupees zero only';
    const o = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const t = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const h = x => { let s = ''; if (x >= 100) { s += o[Math.floor(x / 100)] + ' Hundred'; x %= 100; if (x) s += ' and '; } if (x >= 20) s += t[Math.floor(x / 10)] + (x % 10 ? ' ' + o[x % 10] : ''); else if (x) s += o[x]; return s; };
    const r = []; [[1e7, 'Crore'], [1e5, 'Lakh'], [1e3, 'Thousand']].forEach(([v, l]) => { if (n >= v) { r.push(h(Math.floor(n / v)) + ' ' + l); n %= v; } }); if (n) r.push(h(n));
    return 'Rupees ' + r.join(' ') + ' only';
  }
};

/* ---------- reports ---------- */
/** the report on screen (rows after search and sort) as a landscape A4 PDF */
REP.pdf = async () => {
  if (!REP.cur) return toast('Open a report first');
  try {
    toast('Making the PDF…');
    const r = REP.cur, rows = REP.rows, d = await PDFK.doc(true), pw = d.internal.pageSize.getWidth();
    const f = role() !== 'SCHOOL' ? [LS.get('r_halqa', ''), LS.get('r_level', '')].filter(Boolean).join(' · ') : (inst(S.emis) || {}).name || '';
    d.setFont('helvetica', 'bold'); d.setFontSize(13); d.text(PDFK.t(r.title), 10, 13);
    d.setFont('helvetica', 'normal'); d.setFontSize(8); d.setTextColor(90);
    d.text(PDFK.t(`District Education Office (Male) Muzaffarabad · ${f || 'All institutions in scope'} · ${rows.length} rows · ${dmy(today())}`), 10, 18);
    const note = d.splitTextToSize(PDFK.t(r.note || ''), pw - 20); d.text(note.slice(0, 3), 10, 22); d.setTextColor(0);
    let y = 22 + Math.min(3, note.length) * 3.4 + 1;
    if (REP.keys && REP.keys.length) { d.setFontSize(9); let x = 10; REP.keys.forEach(([l, v]) => { const s = PDFK.t(`${l}: ${fmtN(v)}`); d.setFont('helvetica', 'bold'); d.text(s, x, y + 3); x += d.getTextWidth(s) + 8; }); d.setFont('helvetica', 'normal'); y += 6; }
    const fmt = v => typeof v === 'number' ? fmtN(v) : dmy(v);
    const body = rows.map(x => x.map(fmt));
    if (REP.tot) body.push(REP.tot.map((v, j) => j === 0 ? 'Total' : v === null ? '' : fmtN(v)));
    const W = PDFK.widths(r.head, body, pw - 20, 8);
    const cols = r.head.map((h, j) => ({ h, w: W[j], align: rows.some(x => typeof x[j] === 'number') ? 'right' : 'left' }));
    PDFK.table(d, { x: 10, y, cols, rows: body, fs: r.head.length > 14 ? 6.3 : r.head.length > 9 ? 7 : 8, bold: (x, i) => REP.tot && i === body.length - 1, top: 10 });
    PDFK.footer(d, r.title + ' · District School Data System');
    await PDFK.save(d, r.title + ' ' + today());
  } catch (e) { toast(e.message || String(e)); }
};
/** Print, or a PDF where this phone ignores printing */
REP.print = () => { if (PDFK.printBlocked()) { toast('Printing is not available here; making a PDF instead'); return REP.pdf(); } window.print(); };

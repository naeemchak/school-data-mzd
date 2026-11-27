/* =====================================================================
   FEE CHALLAN for Government Account No. 101 (v4H)
   Made on the phone from the enrolment already saved, for the months and
   fee heads ticked; works without internet. 1989 refugees exempt; ECE not
   charged; scout fund not on this challan. Three copies on one A4 page:
   bank, institution, district office. After depositing, the bank's
   transaction number and date are typed from the returned copy.
   ===================================================================== */
const CH = {
  HEADS: [['tuition', 'Tuition fee', 'C02818-Others'], ['admission', 'Admission fee', 'C02813'], ['annual_fund', 'Annual fund', 'C02818-Others']],
  BANDS: [['Primary', 'Primary (I–V)', ['I', 'II', 'III', 'IV', 'V']], ['Middle', 'Middle (VI–VIII)', ['VI', 'VII', 'VIII']], ['High', 'High (IX–X)', ['IX', 'X']], ['Inter', 'Higher Sec. (XI–XII)', ['XI', 'XII']]],
  /** months of this school year with enrolment saved, oldest first */
  months(d) { const s = feeSession(thisMonth()); return [...new Set(d.enrolment.map(r => r.month))].filter(m => m >= s && m <= thisMonth()).sort(); },
  /** per band for one month: enrolled, refugees, fee-paying, new admissions … and the amounts */
  band(d, m) {
    const f = S.boot.meta.fees, march = m === feeSession(m), rows = d.enrolment.filter(r => r.month === m);
    return CH.BANDS.map(([k, label, cls]) => {
      const o = { k, label, en: 0, ref: 0, nw: 0, nref: 0, rate: f[k] };
      rows.filter(r => cls.includes(r.class)).forEach(r => { o.en += Number(r.boys || 0) + Number(r.girls || 0); o.ref += Number(r.refugees || 0); o.nw += Number(r.new_admissions || 0); o.nref += Number(r.refugee_adm || 0); });
      o.pay = Math.max(0, o.en - o.ref); o.npay = Math.max(0, o.nw - o.nref);
      o.tuition = o.pay * f[k].tuition; o.admission = o.npay * f[k].admission; o.annual_fund = (march ? o.pay : o.npay) * f[k].annual_fund;
      return o;
    });
  },
  /** amount per head for one month (same rule as the server's expectedFees_) */
  due(d, m) { const b = CH.band(d, m), o = {}; CH.HEADS.forEach(([h]) => { o[h] = b.reduce((s, x) => s + x[h], 0); }); return o; },
  /** month+head already on a challan that is not cancelled → challan number */
  taken(d) { const t = {}; (d.challans || []).filter(c => c.status !== 'Cancelled').forEach(c => String(c.months).split(' ').forEach(m => String(c.heads).split(' ').forEach(h => { t[m + '|' + h] = c; }))); return t; },
  levels(d) { const top = { Primary: 0, Middle: 1, High: 2, 'Higher Secondary': 3 }[d.inst.level]; return CH.BANDS.slice(0, (top === undefined ? 3 : top) + 1).map(b => b[0]); },
  nextNo(d, months) {
    const last = months[months.length - 1].replace('-', '').slice(2), pre = S.emis + '-' + last + '-';
    let tag = LS.get('devtag', ''); if (!tag) { tag = 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]; LS.set('devtag', tag); }
    const n = (d.challans || []).filter(c => String(c.no).startsWith(pre)).length + 1;
    return pre + String(n).padStart(2, '0') + tag;
  }
};

/** the card on the Fees screen: what is still to be deposited, and the challans made */
function challanCard(d) {
  const ms = CH.months(d), tk = CH.taken(d);
  const out = ms.map(m => { const due = CH.due(d, m), left = CH.HEADS.filter(([h]) => due[h] && !tk[m + '|' + h]); return left.length ? `<li>${monthLabel(m)}: ${left.map(([h, l]) => `${l} Rs ${fmtN(due[h])}`).join(' · ')}</li>` : ''; }).join('');
  const list = (d.challans || []).slice().reverse().map(c => {
    const st = c.status === 'Deposited' ? `<span class="badge o">Deposited ${esc(dmy(c.deposit_date))}</span>` : c.status === 'Cancelled' ? '<span class="badge">Cancelled</span>' : '<span class="badge w">Not yet deposited</span>';
    return `<div class="it"><div class="grow"><b>Rs ${fmtN(c.total)}</b> · ${esc(String(c.months).split(' ').map(monthLabel).join(', '))}<div class="sub">${esc(c.no)} · ${esc(String(c.heads).split(' ').map(h => (CH.HEADS.find(x => x[0] === h) || [h, h])[1]).join(', '))}${c.txn_no ? ' · ' + esc(c.bank) + ' txn ' + esc(c.txn_no) : ''}</div></div>${st}
      <span class="chbtn">${c.status !== 'Cancelled' ? `<button class="btn alt" onclick="CHA.print('${esc(c.no)}')">PDF</button>` : ''}${c.status === 'Printed' ? `<button class="btn" onclick="go('chdep',{no:'${esc(c.no)}'})">Record deposit</button>` : ''}</span></div>`; }).join('');
  return `<div class="card" id="chc"><h2>Fee challan · Account No. 101</h2><div class="ur">فیس چالان</div>
    <p class="muted">Made from the enrolment saved, at the notified rates (1989 refugees exempt, ECE not charged). Choose the months and fees to deposit; the challan prints three copies on one A4 page: bank, institution, district office. Works without internet.</p>
    ${out ? `<div class="msg w"><b>Not yet on a challan this school year</b><ul class="chdue">${out}</ul></div>` : ms.length ? '<p class="muted">Every fee due this school year is on a challan.</p>' : '<p class="muted">Enter this month\'s enrolment first.</p>'}
    <button class="btn" onclick="go('challan')" ${ms.length ? '' : 'disabled'}>Make a challan</button>
    <div class="list">${list}</div></div>`;
}

V.challan = () => {
  const d = D(); if (!d) return noData();
  const ms = CH.months(d); if (!ms.length) return '<div class="card"><h2>Fee challan</h2><p>Enter the enrolment for the month first; the challan is worked out from it.</p></div>';
  const tk = CH.taken(d), cur = ms[ms.length - 1];
  return `<div class="card"><h2>Make a fee challan</h2><p class="muted">${esc(d.inst.name)} · EMIS ${esc(S.emis)} · Government Account No. 101</p>
    <h3>Months</h3><div class="chm" id="chm">${ms.map(m => { const all = CH.HEADS.every(([h]) => tk[m + '|' + h] || !CH.due(d, m)[h]);
      return `<button type="button" data-m="${m}" class="${m === cur && !all ? 'on' : ''}" ${all ? 'disabled title="Already on a challan"' : ''}>${monthLabel(m)}${m === feeSession(m) ? ' <small>start of year</small>' : ''}${all ? ' <small>done</small>' : ''}</button>`; }).join('')}</div>
    <h3>Fees to deposit</h3><div class="chh" id="chh">${CH.HEADS.map(([h, l, code]) => `<label class="chk"><input type="checkbox" data-h="${h}" ${h === 'tuition' || cur === feeSession(cur) ? 'checked' : ''}> ${l} <small class="muted">${code}</small></label>`).join('')}</div>
    <p class="muted">Admission fee and annual fund are usually deposited at the start of the school year (March); tick them in other months only when depositing them for children admitted later.</p>
    <div id="chp"></div>
    <button class="btn full" id="chmk">Make challan (PDF)</button></div>`;
};
BIND.challan = () => {
  const d = D(); if (!$('#chm')) return;
  const tk = CH.taken(d);
  const sel = () => ({ months: [...$('#chm').querySelectorAll('button.on')].map(b => b.dataset.m).sort(), heads: [...$('#chh').querySelectorAll('input:checked')].map(i => i.dataset.h) });
  const calc = () => { const { months, heads } = sel(); const per = {}, skip = []; let tot = 0;
    months.forEach(m => { const due = CH.due(d, m); per[m] = {}; CH.HEADS.forEach(([h]) => { const on = heads.includes(h) && !tk[m + '|' + h]; if (heads.includes(h) && tk[m + '|' + h]) skip.push(`${monthLabel(m)} ${h.replace('_', ' ')} (on ${tk[m + '|' + h].no})`); per[m][h] = on ? due[h] : 0; tot += per[m][h]; }); });
    return { months, heads, per, tot, skip }; };
  const draw = () => { const c = calc();
    if (!c.months.length || !c.heads.length) { $('#chp').innerHTML = '<p class="muted">Tick at least one month and one fee.</p>'; return; }
    $('#chp').innerHTML = `<table class="ftab chtab"><thead><tr><th>Month</th>${CH.HEADS.filter(([h]) => c.heads.includes(h)).map(([, l]) => `<th class="num">${l}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>
      ${c.months.map(m => `<tr><td>${monthLabel(m)}</td>${CH.HEADS.filter(([h]) => c.heads.includes(h)).map(([h]) => `<td class="num">${fmtN(c.per[m][h])}</td>`).join('')}<td class="num">${fmtN(CH.HEADS.reduce((s, [h]) => s + c.per[m][h], 0))}</td></tr>`).join('')}
      </tbody><tfoot><tr><td><b>Total (Rs)</b></td>${CH.HEADS.filter(([h]) => c.heads.includes(h)).map(([h]) => `<td class="num"><b>${fmtN(c.months.reduce((s, m) => s + c.per[m][h], 0))}</b></td>`).join('')}<td class="num"><b>${fmtN(c.tot)}</b></td></tr></tfoot></table>
      <p class="muted">${esc(PDFK.words(c.tot))}</p>${c.skip.length ? `<div class="msg w">Left out, already on a challan: ${esc(c.skip.join(', '))}</div>` : ''}`; };
  $('#chm').querySelectorAll('button').forEach(b => b.onclick = () => { b.classList.toggle('on'); draw(); });
  $('#chh').querySelectorAll('input').forEach(i => i.onchange = draw);
  draw();
  $('#chmk').onclick = async () => {
    const c = calc(); if (!c.months.length || !c.heads.length) return toast('Tick a month and a fee');
    if (!c.tot) return toast('Nothing is due for what is ticked');
    const usedHeads = c.heads.filter(h => c.months.some(m => c.per[m][h]));
    const no = CH.nextNo(d, c.months);
    const rec = { no, emis: S.emis, months: c.months.join(' '), heads: usedHeads.join(' '), total: c.tot, detail: c.per, status: 'Printed', made_on: now_(), _pending: 1,
      bands: c.months.length === 1 ? CH.band(d, c.months[0]) : null };
    ['tuition', 'admission', 'annual_fund'].forEach(h => { rec[h] = c.months.reduce((s, m) => s + (c.per[m][h] || 0), 0); });
    queue('saveChallan', { challan: { no, emis: S.emis, months: c.months, heads: usedHeads, amounts: c.per, total: c.tot, device_time: ATTC ? ATTC.now() : now_() } }, 'Challan ' + no);
    d.challans = (d.challans || []).concat([rec]); saveD(d);
    await CHA.print(no); back();
  };
};

V.chdep = arg => {
  const d = D(), c = (d.challans || []).find(x => x.no === arg.no); if (!c) return '<div class="card"><p>Challan not found.</p></div>';
  return `<form class="card" id="chdf"><h2>Record the deposit</h2><p class="muted">Challan ${esc(c.no)} · Rs ${fmtN(c.total)} · ${esc(String(c.months).split(' ').map(monthLabel).join(', '))}</p>
    <p class="muted">Copy from the bank's stamp on the institution's copy. Keep that copy in the record and send the district office copy to the DEO office.</p>
    <label>Bank *</label><select name="bank">${opts(S.boot.meta.challanBanks && S.boot.meta.challanBanks.length ? S.boot.meta.challanBanks : ['State Bank of Pakistan', 'National Bank of Pakistan', 'Bank of AJK'], '', '— choose —')}</select>
    <label>Branch</label><input name="branch">
    <label>Transaction / scroll No. *</label><input name="txn_no" autocomplete="off">
    <label>Date of deposit *</label><input type="date" name="deposit_date">
    <div class="decide"><button class="btn">Save deposit</button><button type="button" class="btn warn" id="chx">Cancel this challan</button></div></form>`;
};
BIND.chdep = arg => {
  const f = $('#chdf'); if (!f) return;
  f.onsubmit = e => { e.preventDefault(); const o = formData(f);
    if (!o.bank || !o.txn_no || !o.deposit_date) return toast('Bank, transaction number and date are required');
    if (o.deposit_date > today()) return toast('The date cannot be in the future');
    queue('depositChallan', Object.assign({ no: arg.no }, o), 'Deposit of challan ' + arg.no);
    const d = D(); const c = d.challans.find(x => x.no === arg.no); Object.assign(c, o, { status: 'Deposited' });
    d.deposits = (d.deposits || []).concat(String(c.months).split(' ').map(m => ({ month: m, account: 'Govt A/C 101 (tuition, admission, annual fund)', challan_no: c.no, challan_date: o.deposit_date, amount: Object.values((c.detail || {})[m] || {}).reduce((s, v) => s + Number(v || 0), 0), status: 'Not sent yet' })));
    saveD(d); toast('Deposit recorded'); back(); };
  $('#chx').onclick = () => { if (!confirm('Cancel this challan? Use this only if it was not deposited (for example, printed with a mistake).')) return;
    queue('cancelChallan', { no: arg.no }, 'Cancel challan ' + arg.no); const d = D(); d.challans.find(x => x.no === arg.no).status = 'Cancelled'; saveD(d); back(); };
};

/* ---------- the PDF: three copies, A4 landscape ---------- */
const CHA = {
  async print(no) {
    try {
      const d0 = D(), c = (d0.challans || []).find(x => x.no === no); if (!c) return toast('Challan not found');
      let det = c.detail; if (typeof det === 'string') { try { det = JSON.parse(det); } catch (e) { det = {}; } }
      const months = String(c.months).split(' '), heads = String(c.heads).split(' ');
      const bands = c.bands || (months.length === 1 ? CH.band(d0, months[0]) : null), lv = CH.levels(d0);
      const d = await PDFK.doc(true), W = 297, sw = (W - 14) / 3, ins = d0.inst;
      const per = {}; CH.HEADS.forEach(([h]) => { per[h] = months.reduce((s, m) => s + Number(((det || {})[m] || {})[h] || 0), 0); });
      const total = CH.HEADS.reduce((s, [h]) => s + per[h], 0);
      const copies = [['BANK COPY', 'بینک کاپی', 'Kept by the bank.'], ['INSTITUTION COPY', 'ادارہ کی کاپی', 'Returned to the depositor; kept in the institution record.'], ['DISTRICT OFFICE COPY', 'دفتری کاپی', 'Returned to the depositor; sent to the District Education Office.']];
      const T = PDFK.t, aeo = ins.level === 'Primary';
      copies.forEach(([lab, ur, foot], k) => {
        const x = 7 + k * sw + 3, w = sw - 6; let y = 7;
        if (k) { d.setLineDashPattern([1.2, 1.2], 0); d.setDrawColor(140); d.line(7 + k * sw, 6, 7 + k * sw, 204); d.setLineDashPattern([], 0); d.setFontSize(6); d.setTextColor(140); d.text('cut here', 7 + k * sw - 1.2, 105, { angle: 90 }); d.setTextColor(0); }
        d.setFillColor(15, 74, 50); d.roundedRect(x, y, w, 7, 1.2, 1.2, 'F'); d.setTextColor(255); d.setFont('helvetica', 'bold'); d.setFontSize(8.5); d.text(lab, x + 2.5, y + 4.8);
        PDFK.ur(d, ur, x + w - 2.5, y + 3.9, 9, 'right', true, '#ffffff'); d.setTextColor(0);
        y += 11; d.setFontSize(8.2); d.text('Azad Government of the State of Jammu & Kashmir', x + w / 2, y, { align: 'center' });
        PDFK.ur(d, 'آزاد حکومت ریاست جموں و کشمیر', x + w / 2, y + 4.2, 9.5, 'center');
        d.setFont('helvetica', 'normal'); d.setFontSize(6.6); d.setTextColor(70); d.text('Elementary & Secondary Education Department · DEO (Male) Muzaffarabad', x + w / 2, y + 8.6, { align: 'center' }); d.setTextColor(0);
        y += 10.5; d.setLineWidth(0.35); d.line(x, y, x + w, y); d.setFont('helvetica', 'bold'); d.setFontSize(7.1); d.text('CHALLAN OF FEE DEPOSITED INTO GOVERNMENT ACCOUNT No. 101', x + w / 2, y + 3.4, { align: 'center' }); d.line(x, y + 5, x + w, y + 5);
        y += 7.5; PDFK.qr(d, `SDS-CHALLAN|${c.no}|EMIS ${S.emis}|${months.join(',')}|Rs ${total}`, x, y, 15);
        d.setFontSize(7.5); [['Challan No.', c.no], ['Issued', dmy(String(c.made_on || today()).slice(0, 10))], ['Fee of', months.map(monthLabel).join(', ') + (months.length === 1 && months[0] === feeSession(months[0]) ? ' (start of year)' : '')]].forEach(([l, v], j) => {
          d.setFont('helvetica', 'normal'); d.setTextColor(90); d.text(l, x + 18, y + 3.5 + j * 4.3); d.setTextColor(0); d.setFont('helvetica', 'bold'); d.text(d.splitTextToSize(T(v), w - 38)[0], x + 36, y + 3.5 + j * 4.3); });
        y += 18; d.setFont('helvetica', 'bold'); d.setFontSize(7.2); d.text('Bank:', x, y);
        d.setFont('helvetica', 'normal'); let bx = x + 8; ['State Bank of Pakistan', 'National Bank', 'Bank of AJK'].forEach(b => { d.rect(bx, y - 2.3, 2.6, 2.6); d.text(b, bx + 3.4, y); bx += d.getTextWidth(b) + 7; });
        d.text('Branch ______________________________', x, y + 4.2);
        y += 7;
        const kv = [['Institution', T(ins.name) + '\nEMIS ' + S.emis + (ins.halqa ? ' · ' + ins.halqa : '')], ['Deposited by', aeo ? 'AEO, on behalf of the school\nName ______________ Mobile ______________' : '______________________________\nDesignation ____________ Mobile ____________']];
        kv.forEach(([l, v]) => { const ls = v.split('\n'); const h = ls.length * 3.4 + 2; d.setDrawColor(80); d.rect(x, y, w, h); d.line(x + 19, y, x + 19, y + h);
          d.setFontSize(7.1); d.setTextColor(90); d.text(l, x + 1.2, y + 3); d.setTextColor(0); ls.forEach((t, j) => { d.setFont('helvetica', j === 0 && l === 'Institution' ? 'bold' : 'normal'); d.text(t, x + 20.2, y + 3 + j * 3.4); }); y += h; });
        d.setFont('helvetica', 'normal'); y += 2.5;
        const B = bands ? bands.filter(b => lv.includes(b.k)) : null, fm = v => v ? fmtN(v) : '–';
        const cap = s => { d.setFont('helvetica', 'bold'); d.setFontSize(6.8); d.setTextColor(15, 74, 50); d.text(s, x, y); d.setTextColor(0); d.setFont('helvetica', 'normal'); y += 1.2; };
        if (B && heads.includes('tuition')) {
          cap('Tuition fee — every enrolled student except 1989 refugees');
          y = PDFK.table(d, { x, y, fs: 7, hfs: 6.2, pad: 0.75, cols: [{ h: 'Classes', w: w * 0.30 }, { h: 'Enrolled', w: w * 0.13, align: 'right' }, { h: 'Refugees (exempt)', w: w * 0.16, align: 'right' }, { h: 'Fee- paying', w: w * 0.14, align: 'right' }, { h: 'Rate', w: w * 0.10, align: 'right' }, { h: 'Tuition', w: w * 0.17, align: 'right' }],
            rows: B.map(b => [b.label, fm(b.en), fm(b.ref), fm(b.pay), b.rate.tuition, fm(b.tuition)]) }) + 2.5;
        }
        if (B && (heads.includes('admission') || heads.includes('annual_fund'))) {
          const march = months[0] === feeSession(months[0]);
          cap(march ? 'Admission fee — new admissions; annual fund — whole school (March)' : 'Admission fee and annual fund — new admissions this month');
          y = PDFK.table(d, { x, y, fs: 7, hfs: 6.2, pad: 0.75, cols: [{ h: 'Classes', w: w * 0.27 }, { h: 'New adm.', w: w * 0.11, align: 'right' }, { h: 'Refugees (exempt)', w: w * 0.16, align: 'right' }, { h: 'Fee- paying', w: w * 0.13, align: 'right' }, { h: 'Admission', w: w * 0.17, align: 'right' }, { h: 'Annual fund', w: w * 0.16, align: 'right' }],
            rows: B.map(b => [b.label, fm(b.nw), fm(b.nref), fm(b.npay), heads.includes('admission') ? fm(b.admission) : '–', heads.includes('annual_fund') ? fm(b.annual_fund) : '–']) }) + 2.5;
        }
        if (!B) {
          cap('Fee by month (enrolment of each month × notified rates; 1989 refugees exempt)');
          y = PDFK.table(d, { x, y, fs: 7, hfs: 6.2, pad: 0.75, cols: [{ h: 'Month', w: w * 0.28 }].concat(CH.HEADS.map(([h, l]) => ({ h: l, w: w * 0.18, align: 'right' })), [{ h: 'Total', w: w * 0.18, align: 'right' }]),
            rows: months.map(m => { const a = (det || {})[m] || {}; return [monthLabel(m)].concat(CH.HEADS.map(([h]) => heads.includes(h) ? fm(a[h]) : '–'), [fmtN(CH.HEADS.reduce((s, [h]) => s + Number(a[h] || 0), 0))]); }) }) + 2.5;
        }
        // heads of account
        const hr = CH.HEADS.filter(([h]) => heads.includes(h));
        hr.forEach(([h, l, code]) => { d.setDrawColor(80); d.rect(x, y, w, 4.6); d.line(x + w * 0.72, y, x + w * 0.72, y + 4.6); d.setFontSize(7.4); d.text(`${code} · ${l}`, x + 1.2, y + 3.2); d.text(fmtN(per[h]), x + w - 1.2, y + 3.2, { align: 'right' }); y += 4.6; });
        d.setFillColor(232, 240, 235); d.rect(x, y, w, 6, 'FD'); d.line(x + w * 0.72, y, x + w * 0.72, y + 6); d.setFont('helvetica', 'bold'); d.setFontSize(9); d.text('TOTAL AMOUNT (Rs)', x + 1.2, y + 4.2); d.text(fmtN(total), x + w - 1.2, y + 4.2, { align: 'right' }); y += 8;
        d.setFont('helvetica', 'normal'); d.setFontSize(7.2); const wl = d.splitTextToSize('In words: ' + PDFK.words(total), w - 3); d.rect(x, y - 0.5, w, wl.length * 3.3 + 2); d.text(wl, x + 1.2, y + 2.4); y += wl.length * 3.3 + 2;
        // signatures, just above the bank box
        y = Math.max(y + 8, 204 - 34 - 9); d.setDrawColor(80); d.line(x, y, x + w * 0.4, y); d.line(x + w * 0.58, y, x + w, y); d.setFontSize(7.2); d.text('Depositor', x + w * 0.2, y + 3.2, { align: 'center' });
        d.text(aeo ? 'Assistant Education Officer' : 'Head of institution', x + w * 0.79, y + 3.2, { align: 'center' }); d.setFontSize(6.2); d.text('signature & stamp', x + w * 0.79, y + 6, { align: 'center' });
        // bank box at the foot
        const by = 204 - 34; d.setDrawColor(20); d.setLineWidth(0.45); d.roundedRect(x, by, w, 25, 1, 1); d.setLineWidth(0.2);
        d.setFont('helvetica', 'bold'); d.setFontSize(7.4); d.text('FOR BANK USE · Received payment', x + 2, by + 4.2); d.setFont('helvetica', 'normal');
        d.text('Transaction / scroll No. ______________', x + 2, by + 9); d.text('Date __________', x + w - 2, by + 9, { align: 'right' });
        d.line(x + 2, by + 20.5, x + w * 0.3, by + 20.5); d.line(x + w * 0.35, by + 20.5, x + w * 0.62, by + 20.5); d.text('Cashier', x + w * 0.16, by + 23.3, { align: 'center' }); d.text('Officer', x + w * 0.485, by + 23.3, { align: 'center' });
        d.setLineDashPattern([0.8, 0.8], 0); d.setDrawColor(150); d.rect(x + w * 0.68, by + 11, w * 0.3, 12.5); d.setLineDashPattern([], 0); d.setTextColor(150); d.text('Bank stamp', x + w * 0.83, by + 18, { align: 'center' }); d.setTextColor(0);
        d.setFontSize(6); d.setTextColor(100); d.text(d.splitTextToSize(foot + ' Scout fund is deposited separately. Verify with the QR code.', w), x, 204 - 6); d.setTextColor(0);
      });
      await PDFK.save(d, 'Challan ' + c.no);
    } catch (e) { toast(e.message || String(e)); }
  }
};
